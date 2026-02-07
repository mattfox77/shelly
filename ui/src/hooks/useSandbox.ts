'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

const API_BASE = '/api';

export interface SandboxSession {
  id: string;
  session_id: string;
  agent: string;
  status: 'pending' | 'active' | 'completed' | 'error' | 'terminated';
  created_at: string;
}

export interface SandboxEvent {
  sequence: number;
  type: string;
  timestamp: string;
  data: EventData;
}

export interface EventData {
  type: string;
  item?: ContentItem;
  delta?: ContentDelta;
  error?: string;
  [key: string]: unknown;
}

export interface ContentItem {
  id: string;
  type: 'text' | 'tool_call' | 'tool_result' | 'file_ref';
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  content?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: string;
  file_path?: string;
}

export interface ContentDelta {
  item_id: string;
  content?: string;
}

export interface PendingPermission {
  id: string;
  tool: string;
  description: string;
  timestamp: string;
}

export interface PendingQuestion {
  id: string;
  question: string;
  options?: string[];
  timestamp: string;
}

export interface AgentInfo {
  name: string;
  description: string;
  supported: boolean;
}

export function useSandbox() {
  const [sessions, setSessions] = useState<SandboxSession[]>([]);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [events, setEvents] = useState<SandboxEvent[]>([]);
  const [items, setItems] = useState<Map<string, ContentItem>>(new Map());
  const [pendingPermissions, setPendingPermissions] = useState<PendingPermission[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<AbortController | null>(null);

  // Load available agents
  const loadAgents = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/sandbox/agents`);
      const data = await response.json();
      setAgents(data.agents);
    } catch (err) {
      console.error('Failed to load agents:', err);
    }
  }, []);

  // Load sessions
  const loadSessions = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/sandbox/sessions`);
      const data = await response.json();
      setSessions(data.sessions);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  }, []);

  // Create a new session
  const createSession = useCallback(async (agent: string = 'claude-code', options: Record<string, unknown> = {}): Promise<string> => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/sandbox/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent, options }),
      });
      const data = await response.json();
      const session = data.session;

      setSessions(prev => [session, ...prev]);
      setCurrentSession(session.id);
      setEvents([]);
      setItems(new Map());
      setPendingPermissions([]);
      setPendingQuestions([]);

      return session.id;
    } catch (err) {
      setError('Failed to create session');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Connect to event stream
  const connectToStream = useCallback(async (sessionId: string, offset: number = 0) => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.abort();
    }
    eventSourceRef.current = new AbortController();

    setStreaming(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/sandbox/sessions/${sessionId}/events/stream?offset=${offset}`,
        {
          headers: { 'Accept': 'text/event-stream' },
          signal: eventSourceRef.current.signal,
        }
      );

      if (!response.ok) {
        throw new Error('Failed to connect to event stream');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: SandboxEvent = JSON.parse(line.slice(6));
              handleEvent(event);
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('Connection to event stream lost');
      }
    } finally {
      setStreaming(false);
    }
  }, []);

  // Handle incoming events
  const handleEvent = useCallback((event: SandboxEvent) => {
    setEvents(prev => [...prev, event]);

    const { type, data } = event;

    switch (type) {
      case 'item.started':
        if (data.item) {
          setItems(prev => new Map(prev).set(data.item!.id, data.item!));
        }
        break;

      case 'item.delta':
        if (data.delta) {
          setItems(prev => {
            const newMap = new Map(prev);
            const item = newMap.get(data.delta!.item_id);
            if (item && data.delta!.content) {
              newMap.set(data.delta!.item_id, {
                ...item,
                content: (item.content || '') + data.delta!.content,
              });
            }
            return newMap;
          });
        }
        break;

      case 'item.completed':
        if (data.item) {
          setItems(prev => new Map(prev).set(data.item!.id, data.item!));
        }
        break;

      case 'permission.requested':
        setPendingPermissions(prev => [
          ...prev,
          {
            id: data.permission_id as string,
            tool: data.tool as string,
            description: data.description as string,
            timestamp: event.timestamp,
          },
        ]);
        break;

      case 'question.asked':
        setPendingQuestions(prev => [
          ...prev,
          {
            id: data.question_id as string,
            question: data.question as string,
            options: data.options as string[] | undefined,
            timestamp: event.timestamp,
          },
        ]);
        break;

      case 'session.ended':
      case 'session.error':
        setStreaming(false);
        break;
    }
  }, []);

  // Send a message to the session
  const sendMessage = useCallback(async (content: string, attachments: Array<{ type: string; content: string }> = []) => {
    if (!currentSession) return;

    try {
      await fetch(`${API_BASE}/sandbox/sessions/${currentSession}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, attachments }),
      });
    } catch (err) {
      setError('Failed to send message');
    }
  }, [currentSession]);

  // Respond to permission request
  const respondToPermission = useCallback(async (permissionId: string, approved: boolean) => {
    if (!currentSession) return;

    try {
      await fetch(`${API_BASE}/sandbox/sessions/${currentSession}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionId, approved }),
      });

      setPendingPermissions(prev => prev.filter(p => p.id !== permissionId));
    } catch (err) {
      setError('Failed to respond to permission');
    }
  }, [currentSession]);

  // Respond to question
  const respondToQuestion = useCallback(async (questionId: string, answer: string) => {
    if (!currentSession) return;

    try {
      await fetch(`${API_BASE}/sandbox/sessions/${currentSession}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, answer }),
      });

      setPendingQuestions(prev => prev.filter(q => q.id !== questionId));
    } catch (err) {
      setError('Failed to respond to question');
    }
  }, [currentSession]);

  // Terminate session
  const terminateSession = useCallback(async (sessionId: string) => {
    try {
      await fetch(`${API_BASE}/sandbox/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (eventSourceRef.current) {
        eventSourceRef.current.abort();
      }

      setSessions(prev => prev.filter(s => s.session_id !== sessionId));

      if (currentSession === sessionId) {
        setCurrentSession(null);
        setEvents([]);
        setItems(new Map());
        setStreaming(false);
      }
    } catch (err) {
      setError('Failed to terminate session');
    }
  }, [currentSession]);

  // Disconnect from stream
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.abort();
      eventSourceRef.current = null;
    }
    setStreaming(false);
  }, []);

  // Load agents on mount
  useEffect(() => {
    loadAgents();
    loadSessions();
  }, [loadAgents, loadSessions]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.abort();
      }
    };
  }, []);

  return {
    sessions,
    currentSession,
    events,
    items: Array.from(items.values()),
    pendingPermissions,
    pendingQuestions,
    agents,
    loading,
    streaming,
    error,
    createSession,
    connectToStream,
    sendMessage,
    respondToPermission,
    respondToQuestion,
    terminateSession,
    disconnect,
    loadSessions,
    setCurrentSession,
  };
}
