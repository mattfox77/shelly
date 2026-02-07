'use client';

import { SandboxSession } from '@/hooks/useSandbox';
import { Button } from '@/components/ui/Button';
import { formatRelativeTime, cn } from '@/lib/utils';

interface SessionListProps {
  sessions: SandboxSession[];
  currentSession: string | null;
  onSelect: (sessionId: string) => void;
  onTerminate: (sessionId: string) => void;
  onNewSession: () => void;
  loading?: boolean;
}

export function SessionList({
  sessions,
  currentSession,
  onSelect,
  onTerminate,
  onNewSession,
  loading,
}: SessionListProps) {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <Button onClick={onNewSession} className="w-full" loading={loading}>
          <PlusIcon className="h-4 w-4 mr-2" />
          New Session
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {sessions.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">
            No active sessions
          </p>
        ) : (
          <ul className="p-2 space-y-1">
            {sessions.map((session) => (
              <SessionItem
                key={session.session_id}
                session={session}
                isActive={session.session_id === currentSession}
                onClick={() => onSelect(session.session_id)}
                onTerminate={() => onTerminate(session.session_id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

interface SessionItemProps {
  session: SandboxSession;
  isActive: boolean;
  onClick: () => void;
  onTerminate: () => void;
}

function SessionItem({ session, isActive, onClick, onTerminate }: SessionItemProps) {
  const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    terminated: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };

  return (
    <li
      className={cn(
        'group flex flex-col p-3 rounded-lg cursor-pointer transition-colors',
        isActive
          ? 'bg-primary-50 dark:bg-primary-900/20'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AgentIcon agent={session.agent} />
          <span className="font-medium text-sm text-gray-900 dark:text-white">
            {session.agent}
          </span>
        </div>
        <span
          className={cn(
            'px-2 py-0.5 rounded-full text-xs font-medium',
            statusColors[session.status] || statusColors.pending
          )}
        >
          {session.status}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {session.session_id.slice(0, 12)}...
        </span>
        <span className="text-xs text-gray-400">
          {formatRelativeTime(session.created_at)}
        </span>
      </div>

      {session.status === 'active' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTerminate();
          }}
          className="mt-2 opacity-0 group-hover:opacity-100 text-xs text-red-500 hover:text-red-600 transition-opacity"
        >
          Terminate
        </button>
      )}
    </li>
  );
}

function AgentIcon({ agent }: { agent: string }) {
  const className = 'h-5 w-5';

  switch (agent) {
    case 'claude-code':
      return (
        <div className="p-1 rounded bg-orange-100 dark:bg-orange-900/30">
          <svg className={cn(className, 'text-orange-600')} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
      );
    default:
      return (
        <div className="p-1 rounded bg-gray-100 dark:bg-gray-700">
          <svg className={cn(className, 'text-gray-600')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      );
  }
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}
