/**
 * Sandbox Service
 *
 * Integration with sandbox-agent for managing coding agent sessions.
 */

import { loggers } from 'the-machina';
import { SessionManager } from './session-manager';

export interface SandboxConfig {
  baseUrl: string;
  timeout?: number;
}

export interface SessionOptions {
  workdir?: string;
  env?: Record<string, string>;
  model?: string;
  systemPrompt?: string;
}

export interface SandboxSession {
  id: string;
  agent: string;
  status: 'pending' | 'active' | 'completed' | 'error' | 'terminated';
  created_at: Date;
}

export interface SandboxEvent {
  sequence: number;
  type: string;
  timestamp: string;
  data: unknown;
}

export interface AgentInfo {
  name: string;
  description: string;
  supported: boolean;
}

/**
 * Service for managing sandbox-agent sessions
 */
export class SandboxService {
  private baseUrl: string;
  private timeout: number;
  private sessionManager: SessionManager;

  constructor(config: SandboxConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeout = config.timeout || 30000;
    this.sessionManager = new SessionManager();
  }

  /**
   * Create a new sandbox session
   */
  async createSession(agent: string, options: SessionOptions = {}): Promise<SandboxSession> {
    try {
      const response = await fetch(`${this.baseUrl}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent,
          options: {
            workdir: options.workdir || '/workspace',
            env: options.env,
            model: options.model,
            system_prompt: options.systemPrompt
          }
        }),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create session: ${error}`);
      }

      const data = await response.json() as { session_id: string };
      const session: SandboxSession = {
        id: data.session_id,
        agent,
        status: 'active',
        created_at: new Date()
      };

      this.sessionManager.register(session.id, session);
      loggers.app.info('Created sandbox session', { sessionId: session.id, agent });

      return session;
    } catch (error) {
      loggers.app.error('Failed to create sandbox session', { error, agent });
      throw error;
    }
  }

  /**
   * Get session status from sandbox-agent
   */
  async getSessionStatus(sessionId: string): Promise<Record<string, unknown>> {
    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { exists: false };
        }
        throw new Error(`Failed to get session status: ${response.statusText}`);
      }

      return await response.json() as Record<string, unknown>;
    } catch (error) {
      loggers.app.error('Failed to get session status', { error, sessionId });
      throw error;
    }
  }

  /**
   * Send a message/task to a session
   */
  async sendMessage(
    sessionId: string,
    content: string,
    attachments: Array<{ type: string; content: string }> = []
  ): Promise<{ messageId: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, attachments }),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      const data = await response.json() as { message_id: string };
      loggers.app.info('Sent message to session', { sessionId, messageId: data.message_id });

      return { messageId: data.message_id };
    } catch (error) {
      loggers.app.error('Failed to send message', { error, sessionId });
      throw error;
    }
  }

  /**
   * Respond to a permission request
   */
  async respondToPermission(
    sessionId: string,
    permissionId: string,
    approved: boolean
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseUrl}/sessions/${sessionId}/permissions/${permissionId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approved }),
          signal: AbortSignal.timeout(this.timeout)
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to respond to permission: ${response.statusText}`);
      }

      loggers.app.info('Responded to permission', { sessionId, permissionId, approved });
    } catch (error) {
      loggers.app.error('Failed to respond to permission', { error, sessionId, permissionId });
      throw error;
    }
  }

  /**
   * Respond to a question from the agent
   */
  async respondToQuestion(
    sessionId: string,
    questionId: string,
    answer: string
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseUrl}/sessions/${sessionId}/questions/${questionId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answer }),
          signal: AbortSignal.timeout(this.timeout)
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to respond to question: ${response.statusText}`);
      }

      loggers.app.info('Responded to question', { sessionId, questionId });
    } catch (error) {
      loggers.app.error('Failed to respond to question', { error, sessionId, questionId });
      throw error;
    }
  }

  /**
   * Stream events from a session
   */
  async *streamEvents(sessionId: string, offset: number = 0): AsyncGenerator<SandboxEvent> {
    const url = `${this.baseUrl}/sessions/${sessionId}/events?offset=${offset}`;

    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'text/event-stream' }
      });

      if (!response.ok) {
        throw new Error(`Failed to connect to event stream: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let sequence = offset;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const event: SandboxEvent = {
                sequence: sequence++,
                type: data.type || 'unknown',
                timestamp: data.timestamp || new Date().toISOString(),
                data
              };
              yield event;
            } catch {
              // Skip malformed events
            }
          }
        }
      }
    } catch (error) {
      loggers.app.error('Event stream error', { error, sessionId });
      throw error;
    }
  }

  /**
   * Terminate a session
   */
  async terminateSession(sessionId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok && response.status !== 404) {
        throw new Error(`Failed to terminate session: ${response.statusText}`);
      }

      this.sessionManager.remove(sessionId);
      loggers.app.info('Terminated session', { sessionId });
    } catch (error) {
      loggers.app.error('Failed to terminate session', { error, sessionId });
      throw error;
    }
  }

  /**
   * List available agents
   */
  async listAgents(): Promise<AgentInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/agents`, {
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`Failed to list agents: ${response.statusText}`);
      }

      const data = await response.json() as { agents?: AgentInfo[] };
      return data.agents || [];
    } catch (error) {
      loggers.app.error('Failed to list agents', { error });

      // Return default agents if sandbox-agent is not available
      return [
        { name: 'claude-code', description: 'Claude Code CLI', supported: true },
        { name: 'codex', description: 'OpenAI Codex', supported: false },
        { name: 'amp', description: 'Amp Agent', supported: false },
        { name: 'open-code', description: 'OpenCode', supported: false }
      ];
    }
  }

  /**
   * Check if sandbox-agent is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export { SessionManager } from './session-manager';
