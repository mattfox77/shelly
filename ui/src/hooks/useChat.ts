'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

const API_BASE = '/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: ToolCall[];
  created_at: string;
  streaming?: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ChatSession {
  id: string;
  created_at: string;
  message_count?: number;
}

export function useChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load sessions
  const loadSessions = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/chat/sessions`);
      const data = await response.json();
      setSessions(data.sessions);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  }, []);

  // Create a new session
  const createSession = useCallback(async (): Promise<string> => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/chat/sessions`, {
        method: 'POST',
      });
      const data = await response.json();
      const sessionId = data.session.id;

      setSessions(prev => [{ id: sessionId, created_at: new Date().toISOString() }, ...prev]);
      setCurrentSession(sessionId);
      setMessages([]);

      return sessionId;
    } catch (err) {
      setError('Failed to create session');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Load a session
  const loadSession = useCallback(async (sessionId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/chat/sessions/${sessionId}`);
      const data = await response.json();

      setCurrentSession(sessionId);
      setMessages(data.session.messages);
    } catch (err) {
      setError('Failed to load session');
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete a session
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await fetch(`${API_BASE}/chat/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      setSessions(prev => prev.filter(s => s.id !== sessionId));

      if (currentSession === sessionId) {
        setCurrentSession(null);
        setMessages([]);
      }
    } catch (err) {
      setError('Failed to delete session');
    }
  }, [currentSession]);

  // Send a message with SSE streaming
  const sendMessage = useCallback(async (content: string) => {
    if (!currentSession || streaming) return;

    // Abort any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setStreaming(true);
    setError(null);

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Add placeholder for assistant message
    const assistantMessage: ChatMessage = {
      id: `temp-assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      streaming: true,
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const response = await fetch(
        `${API_BASE}/chat/sessions/${currentSession}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';
      let toolCalls: ToolCall[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            // Handle event type
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'text' || data.type === 'delta') {
                accumulatedContent += data.content || '';
                setMessages(prev =>
                  prev.map(m =>
                    m.streaming
                      ? { ...m, content: accumulatedContent }
                      : m
                  )
                );
              } else if (data.type === 'tool_call') {
                toolCalls.push({
                  id: data.id,
                  name: data.tool,
                  input: data.input || {},
                });
              } else if (data.type === 'complete') {
                setMessages(prev =>
                  prev.map(m =>
                    m.streaming
                      ? {
                          ...data.message,
                          streaming: false,
                        }
                      : m.id.startsWith('temp-') && m.role === 'user'
                      ? { ...m, id: data.message.id || m.id }
                      : m
                  )
                );
              } else if (data.type === 'error') {
                setError(data.error);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('Failed to send message');
        // Remove the streaming message on error
        setMessages(prev => prev.filter(m => !m.streaming));
      }
    } finally {
      setStreaming(false);
      abortControllerRef.current = null;
    }
  }, [currentSession, streaming]);

  // Cancel streaming
  const cancelStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setStreaming(false);
    }
  }, []);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return {
    sessions,
    currentSession,
    messages,
    loading,
    streaming,
    error,
    createSession,
    loadSession,
    deleteSession,
    sendMessage,
    cancelStreaming,
    loadSessions,
  };
}
