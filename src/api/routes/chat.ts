/**
 * Chat API Routes
 *
 * Chat sessions and message endpoints with SSE streaming.
 * Uses Claude CLI for processing instead of direct API calls.
 */

import { Router, Request, Response } from 'express';
import { ShellyDataStore } from '../../data/store';
import { ClaudeCLIAgent } from '../../agent';
import { GitHubClient } from '../../github';
import { loggers } from 'the-machina';
import { v4 as uuidv4 } from 'uuid';

interface ChatSession {
  id: string;
  claudeSessionId?: string; // Claude CLI session ID for resuming
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    tool_calls?: unknown[];
    created_at: Date;
  }>;
  created_at: Date;
}

// In-memory sessions with Claude CLI agents
const sessions = new Map<string, ChatSession>();
const agents = new Map<string, ClaudeCLIAgent>();

export function createChatRouter(
  dataStore: ShellyDataStore,
  github: GitHubClient,
  workspacePath: string
): Router {
  const router = Router();

  // Check CLI availability on startup
  const testAgent = new ClaudeCLIAgent({ workspacePath });
  testAgent.isAvailable().then(available => {
    if (available) {
      loggers.app.info('Claude CLI is available for chat');
    } else {
      loggers.app.warn('Claude CLI not available - chat will not work');
    }
  });

  /**
   * GET /api/chat/status
   * Check if Claude CLI is available
   */
  router.get('/status', async (req: Request, res: Response) => {
    const agent = new ClaudeCLIAgent({ workspacePath });
    const available = await agent.isAvailable();
    res.json({ available, message: available ? 'Claude CLI ready' : 'Claude CLI not available' });
  });

  /**
   * POST /api/chat/sessions
   * Create a new chat session
   */
  router.post('/sessions', async (req: Request, res: Response) => {
    try {
      const id = uuidv4();
      const session: ChatSession = {
        id,
        messages: [],
        created_at: new Date()
      };

      sessions.set(id, session);

      // Create a Claude CLI agent for this session
      const agent = new ClaudeCLIAgent({
        workspacePath,
        allowedTools: ['Read', 'Glob', 'Grep', 'Bash', 'Edit', 'Write', 'WebSearch', 'WebFetch']
      });
      agents.set(id, agent);

      // Persist to database
      await dataStore.query(
        'INSERT INTO chat_sessions (id) VALUES ($1)',
        [id]
      );

      loggers.app.info('Created chat session', { sessionId: id });

      res.status(201).json({ session: { id, created_at: session.created_at } });
    } catch (error) {
      loggers.app.error('Failed to create chat session', { error });
      res.status(500).json({ error: 'Failed to create chat session' });
    }
  });

  /**
   * GET /api/chat/sessions/:id
   * Get chat session with messages
   */
  router.get('/sessions/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Check in-memory first
      let session = sessions.get(id);

      if (!session) {
        // Try to load from database
        const sessionResult = await dataStore.query(
          'SELECT * FROM chat_sessions WHERE id = $1',
          [id]
        );

        if (!sessionResult.rows[0]) {
          return res.status(404).json({ error: 'Session not found' });
        }

        const messagesResult = await dataStore.query(
          'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at',
          [id]
        );

        session = {
          id,
          messages: messagesResult.rows.map(row => ({
            id: row.id,
            role: row.role,
            content: row.content,
            tool_calls: row.tool_calls,
            created_at: row.created_at
          })),
          created_at: sessionResult.rows[0].created_at
        };

        sessions.set(id, session);

        // Create agent for resumed session
        const agent = new ClaudeCLIAgent({ workspacePath });
        agents.set(id, agent);
      }

      res.json({ session });
    } catch (error) {
      loggers.app.error('Failed to get chat session', { error });
      res.status(500).json({ error: 'Failed to get chat session' });
    }
  });

  /**
   * DELETE /api/chat/sessions/:id
   * Delete a chat session
   */
  router.delete('/sessions/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      sessions.delete(id);
      agents.delete(id);

      await dataStore.query(
        'DELETE FROM chat_messages WHERE session_id = $1',
        [id]
      );
      await dataStore.query(
        'DELETE FROM chat_sessions WHERE id = $1',
        [id]
      );

      res.status(204).send();
    } catch (error) {
      loggers.app.error('Failed to delete chat session', { error });
      res.status(500).json({ error: 'Failed to delete chat session' });
    }
  });

  /**
   * POST /api/chat/sessions/:id/messages
   * Send a message and receive streaming response via SSE
   */
  router.post('/sessions/:id/messages', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Message content required' });
    }

    let session = sessions.get(id);
    let agent = agents.get(id);

    if (!session) {
      // Try to load from database
      const sessionResult = await dataStore.query(
        'SELECT * FROM chat_sessions WHERE id = $1',
        [id]
      );

      if (!sessionResult.rows[0]) {
        return res.status(404).json({ error: 'Session not found' });
      }

      session = {
        id,
        messages: [],
        created_at: sessionResult.rows[0].created_at
      };
      sessions.set(id, session);
    }

    if (!agent) {
      agent = new ClaudeCLIAgent({ workspacePath });
      agents.set(id, agent);
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      // Add user message
      const userMessage = {
        id: uuidv4(),
        role: 'user' as const,
        content,
        created_at: new Date()
      };
      session.messages.push(userMessage);

      // Persist user message
      await dataStore.query(
        'INSERT INTO chat_messages (id, session_id, role, content) VALUES ($1, $2, $3, $4)',
        [userMessage.id, id, userMessage.role, userMessage.content]
      );

      // Send user message event
      res.write(`event: message\ndata: ${JSON.stringify({ type: 'user', message: userMessage })}\n\n`);

      // Process with Claude CLI (streaming)
      loggers.app.info('Processing chat message with Claude CLI', { sessionId: id, contentLength: content.length });

      let assistantContent = '';
      const toolCalls: unknown[] = [];

      // Use streaming for real-time output
      for await (const event of agent.processStream(content)) {
        if (event.type === 'stream_event' && event.event) {
          // Handle text deltas
          if (event.event.delta?.text) {
            const text = event.event.delta.text;
            assistantContent += text;
            res.write(`event: delta\ndata: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
          }

          // Handle tool calls
          if (event.event.type === 'tool_use') {
            const toolCall = {
              name: (event.event as any).name,
              input: (event.event as any).input
            };
            toolCalls.push(toolCall);
            res.write(`event: tool_call\ndata: ${JSON.stringify({ type: 'tool_call', tool: toolCall.name })}\n\n`);
          }
        } else if (event.result) {
          // Final result
          assistantContent = event.result;
        }

        // Track Claude session ID for resume capability
        if (event.session_id && !session.claudeSessionId) {
          session.claudeSessionId = event.session_id;
          agent.setSessionId(event.session_id);
        }
      }

      // Create assistant message
      const assistantMessage = {
        id: uuidv4(),
        role: 'assistant' as const,
        content: assistantContent,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        created_at: new Date()
      };
      session.messages.push(assistantMessage);

      // Persist assistant message
      await dataStore.query(
        'INSERT INTO chat_messages (id, session_id, role, content, tool_calls) VALUES ($1, $2, $3, $4, $5)',
        [assistantMessage.id, id, assistantMessage.role, assistantMessage.content, JSON.stringify(toolCalls)]
      );

      // Send complete event
      res.write(`event: complete\ndata: ${JSON.stringify({ type: 'complete', message: assistantMessage })}\n\n`);

      loggers.app.info('Chat message processed via Claude CLI', {
        sessionId: id,
        claudeSessionId: session.claudeSessionId,
        responseLength: assistantMessage.content.length,
        toolCallsCount: toolCalls.length
      });

    } catch (error) {
      loggers.app.error('Failed to process chat message', { error, sessionId: id });
      const errorMessage = error instanceof Error ? error.message : 'Failed to process message';
      res.write(`event: error\ndata: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
    } finally {
      res.write('event: done\ndata: {}\n\n');
      res.end();
    }
  });

  /**
   * GET /api/chat/sessions
   * List all chat sessions
   */
  router.get('/sessions', async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

      const result = await dataStore.query(
        `SELECT cs.id, cs.created_at,
                (SELECT COUNT(*) FROM chat_messages cm WHERE cm.session_id = cs.id) as message_count
         FROM chat_sessions cs
         ORDER BY cs.created_at DESC
         LIMIT $1`,
        [limit]
      );

      res.json({
        sessions: result.rows.map(row => ({
          id: row.id,
          created_at: row.created_at,
          message_count: parseInt(row.message_count)
        }))
      });
    } catch (error) {
      loggers.app.error('Failed to list chat sessions', { error });
      res.status(500).json({ error: 'Failed to list chat sessions' });
    }
  });

  return router;
}
