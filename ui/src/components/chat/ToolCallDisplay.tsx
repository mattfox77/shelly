'use client';

import { useState } from 'react';
import { ToolCall } from '@/hooks/useChat';
import { cn } from '@/lib/utils';

interface ToolCallDisplayProps {
  toolCall: ToolCall;
}

export function ToolCallDisplay({ toolCall }: ToolCallDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  const { icon, color, label } = getToolDisplay(toolCall.name);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
          'hover:bg-gray-50 dark:hover:bg-gray-800'
        )}
      >
        <div className={cn('p-1 rounded', color)}>
          {icon}
        </div>
        <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white">
          {label}
        </span>
        <ChevronIcon
          className={cn(
            'h-4 w-4 text-gray-400 transition-transform',
            expanded && 'rotate-180'
          )}
        />
      </button>

      {/* Details */}
      {expanded && (
        <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Input:</p>
          <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-x-auto">
            {JSON.stringify(toolCall.input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function getToolDisplay(toolName: string): {
  icon: React.ReactNode;
  color: string;
  label: string;
} {
  switch (toolName) {
    case 'list_issues':
    case 'get_issue':
    case 'create_issue':
    case 'update_issue':
      return {
        icon: <IssueIcon className="h-4 w-4 text-yellow-600" />,
        color: 'bg-yellow-100 dark:bg-yellow-900/30',
        label: formatToolName(toolName),
      };

    case 'list_pull_requests':
    case 'get_pull_request':
      return {
        icon: <PRIcon className="h-4 w-4 text-blue-600" />,
        color: 'bg-blue-100 dark:bg-blue-900/30',
        label: formatToolName(toolName),
      };

    case 'list_commits':
      return {
        icon: <CommitIcon className="h-4 w-4 text-purple-600" />,
        color: 'bg-purple-100 dark:bg-purple-900/30',
        label: 'List Commits',
      };

    case 'search_issues':
    case 'search_code':
      return {
        icon: <SearchIcon className="h-4 w-4 text-green-600" />,
        color: 'bg-green-100 dark:bg-green-900/30',
        label: formatToolName(toolName),
      };

    case 'generate_daily_report':
    case 'generate_weekly_report':
      return {
        icon: <ReportIcon className="h-4 w-4 text-indigo-600" />,
        color: 'bg-indigo-100 dark:bg-indigo-900/30',
        label: formatToolName(toolName),
      };

    case 'send_notification':
      return {
        icon: <BellIcon className="h-4 w-4 text-pink-600" />,
        color: 'bg-pink-100 dark:bg-pink-900/30',
        label: 'Send Notification',
      };

    case 'add_comment':
      return {
        icon: <CommentIcon className="h-4 w-4 text-gray-600" />,
        color: 'bg-gray-100 dark:bg-gray-700',
        label: 'Add Comment',
      };

    default:
      return {
        icon: <ToolIcon className="h-4 w-4 text-gray-600" />,
        color: 'bg-gray-100 dark:bg-gray-700',
        label: formatToolName(toolName),
      };
  }
}

function formatToolName(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function IssueIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
}

function PRIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  );
}

function CommitIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function ReportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 10-2 0v7a1 1 0 102 0V8z" clipRule="evenodd" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
    </svg>
  );
}

function CommentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
    </svg>
  );
}

function ToolIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  );
}
