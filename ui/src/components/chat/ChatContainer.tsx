'use client';

import { useChat, ChatSession } from '@/hooks/useChat';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { Button } from '@/components/ui/Button';
import { cn, formatRelativeTime } from '@/lib/utils';

export function ChatContainer() {
  const {
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
  } = useChat();

  const handleNewSession = async () => {
    try {
      await createSession();
    } catch {
      // Error handled in hook
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <Button onClick={handleNewSession} className="w-full" loading={loading}>
            <PlusIcon className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {sessions.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">
              No conversations yet
            </p>
          ) : (
            <ul className="p-2 space-y-1">
              {sessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isActive={session.id === currentSession}
                  onClick={() => loadSession(session.id)}
                  onDelete={() => deleteSession(session.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {currentSession ? 'Chat with Shelly' : 'Select or start a chat'}
            </h2>
            {streaming && (
              <p className="text-sm text-primary-500">Shelly is thinking...</p>
            )}
          </div>
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </div>

        {/* Messages */}
        <MessageList messages={messages} className="flex-1" />

        {/* Input */}
        {currentSession && (
          <ChatInput
            onSend={sendMessage}
            disabled={!currentSession}
            streaming={streaming}
            onCancel={cancelStreaming}
          />
        )}

        {/* Placeholder when no session */}
        {!currentSession && (
          <div className="p-4 text-center border-t border-gray-200 dark:border-gray-700">
            <Button onClick={handleNewSession} loading={loading}>
              Start a New Conversation
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface SessionItemProps {
  session: ChatSession;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}

function SessionItem({ session, isActive, onClick, onDelete }: SessionItemProps) {
  return (
    <li
      className={cn(
        'group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors',
        isActive
          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
      )}
      onClick={onClick}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">
          Chat {session.id.slice(0, 8)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {formatRelativeTime(session.created_at)}
          {session.message_count !== undefined && ` • ${session.message_count} messages`}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-opacity"
        title="Delete chat"
      >
        <TrashIcon className="h-4 w-4 text-gray-400 hover:text-red-500" />
      </button>
    </li>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}
