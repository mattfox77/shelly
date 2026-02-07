/**
 * Session Manager
 *
 * Manages sandbox session lifecycle and state.
 */

import { loggers } from 'the-machina';

export interface SessionState {
  id: string;
  agent: string;
  status: 'pending' | 'active' | 'completed' | 'error' | 'terminated';
  created_at: Date;
  updated_at: Date;
  lastEventSequence: number;
  pendingPermissions: Map<string, PendingPermission>;
  pendingQuestions: Map<string, PendingQuestion>;
}

export interface PendingPermission {
  id: string;
  tool: string;
  description: string;
  timestamp: Date;
}

export interface PendingQuestion {
  id: string;
  question: string;
  options?: string[];
  timestamp: Date;
}

/**
 * Manages in-memory session state for active sandbox sessions
 */
export class SessionManager {
  private sessions: Map<string, SessionState> = new Map();

  /**
   * Register a new session
   */
  register(
    sessionId: string,
    initial: { id: string; agent: string; status: SessionState['status']; created_at: Date }
  ): void {
    const state: SessionState = {
      ...initial,
      updated_at: new Date(),
      lastEventSequence: 0,
      pendingPermissions: new Map(),
      pendingQuestions: new Map()
    };

    this.sessions.set(sessionId, state);
    loggers.app.debug('Registered session', { sessionId });
  }

  /**
   * Get session state
   */
  get(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Update session status
   */
  updateStatus(sessionId: string, status: SessionState['status']): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = status;
      session.updated_at = new Date();
      loggers.app.debug('Updated session status', { sessionId, status });
    }
  }

  /**
   * Update last event sequence
   */
  updateEventSequence(sessionId: string, sequence: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastEventSequence = sequence;
      session.updated_at = new Date();
    }
  }

  /**
   * Add a pending permission request
   */
  addPendingPermission(sessionId: string, permission: PendingPermission): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pendingPermissions.set(permission.id, permission);
      session.updated_at = new Date();
      loggers.app.debug('Added pending permission', { sessionId, permissionId: permission.id });
    }
  }

  /**
   * Remove a pending permission
   */
  removePendingPermission(sessionId: string, permissionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pendingPermissions.delete(permissionId);
      session.updated_at = new Date();
    }
  }

  /**
   * Add a pending question
   */
  addPendingQuestion(sessionId: string, question: PendingQuestion): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pendingQuestions.set(question.id, question);
      session.updated_at = new Date();
      loggers.app.debug('Added pending question', { sessionId, questionId: question.id });
    }
  }

  /**
   * Remove a pending question
   */
  removePendingQuestion(sessionId: string, questionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pendingQuestions.delete(questionId);
      session.updated_at = new Date();
    }
  }

  /**
   * Get all pending permissions for a session
   */
  getPendingPermissions(sessionId: string): PendingPermission[] {
    const session = this.sessions.get(sessionId);
    return session ? Array.from(session.pendingPermissions.values()) : [];
  }

  /**
   * Get all pending questions for a session
   */
  getPendingQuestions(sessionId: string): PendingQuestion[] {
    const session = this.sessions.get(sessionId);
    return session ? Array.from(session.pendingQuestions.values()) : [];
  }

  /**
   * Remove a session
   */
  remove(sessionId: string): void {
    this.sessions.delete(sessionId);
    loggers.app.debug('Removed session', { sessionId });
  }

  /**
   * List all active sessions
   */
  listActive(): SessionState[] {
    return Array.from(this.sessions.values()).filter(
      s => s.status === 'active' || s.status === 'pending'
    );
  }

  /**
   * Clean up stale sessions (older than maxAge)
   */
  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const cutoff = new Date(Date.now() - maxAgeMs);
    let removed = 0;

    for (const [id, session] of this.sessions.entries()) {
      if (session.updated_at < cutoff && session.status !== 'active') {
        this.sessions.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      loggers.app.info('Cleaned up stale sessions', { removed });
    }

    return removed;
  }

  /**
   * Get session count
   */
  get size(): number {
    return this.sessions.size;
  }
}
