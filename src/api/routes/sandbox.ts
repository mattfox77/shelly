/**
 * Sandbox API Routes
 *
 * Proxy to sandbox-agent for managing coding agent sessions.
 */

import { Router, Request, Response } from 'express';
import { ShellyDataStore } from '../../data/store';
import { SandboxService } from '../../sandbox';
import { loggers } from 'the-machina';

export function createSandboxRouter(
  dataStore: ShellyDataStore,
  sandboxService: SandboxService
): Router {
  const router = Router();

  /**
   * POST /api/sandbox/sessions
   * Create a new sandbox session
   */
  router.post('/sessions', async (req: Request, res: Response) => {
    try {
      const { agent = 'claude-code', options = {} } = req.body;

      const session = await sandboxService.createSession(agent, options);

      // Persist to database
      await dataStore.query(
        `INSERT INTO sandbox_sessions (session_id, agent, status)
         VALUES ($1, $2, 'active')`,
        [session.id, agent]
      );

      loggers.app.info('Created sandbox session', { sessionId: session.id, agent });
      res.status(201).json({ session });
    } catch (error) {
      loggers.app.error('Failed to create sandbox session', { error });
      res.status(500).json({ error: 'Failed to create sandbox session' });
    }
  });

  /**
   * GET /api/sandbox/sessions
   * List sandbox sessions
   */
  router.get('/sessions', async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string || 'active';

      const result = await dataStore.query(
        `SELECT * FROM sandbox_sessions
         WHERE status = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [status]
      );

      res.json({ sessions: result.rows });
    } catch (error) {
      loggers.app.error('Failed to list sandbox sessions', { error });
      res.status(500).json({ error: 'Failed to list sessions' });
    }
  });

  /**
   * GET /api/sandbox/sessions/:id
   * Get sandbox session details
   */
  router.get('/sessions/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const result = await dataStore.query(
        'SELECT * FROM sandbox_sessions WHERE session_id = $1',
        [id]
      );

      if (!result.rows[0]) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Get session status from sandbox-agent
      const status = await sandboxService.getSessionStatus(id);

      res.json({
        session: {
          ...result.rows[0],
          ...status
        }
      });
    } catch (error) {
      loggers.app.error('Failed to get sandbox session', { error });
      res.status(500).json({ error: 'Failed to get session' });
    }
  });

  /**
   * POST /api/sandbox/sessions/:id/messages
   * Send a message/task to the sandbox session
   */
  router.post('/sessions/:id/messages', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { content, attachments = [] } = req.body;

      if (!content) {
        return res.status(400).json({ error: 'Message content required' });
      }

      const result = await sandboxService.sendMessage(id, content, attachments);

      loggers.app.info('Sent message to sandbox session', { sessionId: id });
      res.json({ result });
    } catch (error) {
      loggers.app.error('Failed to send message to sandbox', { error });
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  /**
   * POST /api/sandbox/sessions/:id/permissions
   * Respond to a permission request
   */
  router.post('/sessions/:id/permissions', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { permissionId, approved } = req.body;

      await sandboxService.respondToPermission(id, permissionId, approved);

      loggers.app.info('Responded to permission request', { sessionId: id, permissionId, approved });
      res.json({ success: true });
    } catch (error) {
      loggers.app.error('Failed to respond to permission', { error });
      res.status(500).json({ error: 'Failed to respond to permission' });
    }
  });

  /**
   * POST /api/sandbox/sessions/:id/questions
   * Respond to a question from the agent
   */
  router.post('/sessions/:id/questions', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { questionId, answer } = req.body;

      await sandboxService.respondToQuestion(id, questionId, answer);

      loggers.app.info('Responded to question', { sessionId: id, questionId });
      res.json({ success: true });
    } catch (error) {
      loggers.app.error('Failed to respond to question', { error });
      res.status(500).json({ error: 'Failed to respond to question' });
    }
  });

  /**
   * GET /api/sandbox/sessions/:id/events/stream
   * SSE stream of session events
   */
  router.get('/sessions/:id/events/stream', async (req: Request, res: Response) => {
    const { id } = req.params;
    const offset = parseInt(req.query.offset as string) || 0;

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    loggers.app.info('Started event stream', { sessionId: id, offset });

    try {
      // Stream events from sandbox-agent
      for await (const event of sandboxService.streamEvents(id, offset)) {
        // Store event in database
        await dataStore.query(
          `INSERT INTO sandbox_events (session_id, sequence, type, data)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (session_id, sequence) DO NOTHING`,
          [id, event.sequence, event.type, JSON.stringify(event.data)]
        );

        // Send to client
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);

        // Check for terminal events
        if (event.type === 'session.ended' || event.type === 'session.error') {
          // Update session status
          await dataStore.query(
            `UPDATE sandbox_sessions SET status = $1 WHERE session_id = $2`,
            [event.type === 'session.ended' ? 'completed' : 'error', id]
          );
          break;
        }
      }
    } catch (error) {
      loggers.app.error('Event stream error', { error, sessionId: id });
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
    } finally {
      res.write('event: done\ndata: {}\n\n');
      res.end();
    }
  });

  /**
   * DELETE /api/sandbox/sessions/:id
   * Terminate a sandbox session
   */
  router.delete('/sessions/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      await sandboxService.terminateSession(id);

      await dataStore.query(
        `UPDATE sandbox_sessions SET status = 'terminated' WHERE session_id = $1`,
        [id]
      );

      loggers.app.info('Terminated sandbox session', { sessionId: id });
      res.status(204).send();
    } catch (error) {
      loggers.app.error('Failed to terminate sandbox session', { error });
      res.status(500).json({ error: 'Failed to terminate session' });
    }
  });

  /**
   * GET /api/sandbox/agents
   * List available agents
   */
  router.get('/agents', async (req: Request, res: Response) => {
    try {
      const agents = await sandboxService.listAgents();
      res.json({ agents });
    } catch (error) {
      loggers.app.error('Failed to list agents', { error });
      res.status(500).json({ error: 'Failed to list agents' });
    }
  });

  return router;
}
