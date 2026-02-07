'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ContentItem } from '@/hooks/useSandbox';
import { cn } from '@/lib/utils';

interface ContentPartsProps {
  item: ContentItem;
}

export function ContentParts({ item }: ContentPartsProps) {
  const [expanded, setExpanded] = useState(false);

  switch (item.type) {
    case 'text':
      return <TextContent item={item} />;
    case 'tool_call':
      return <ToolCallContent item={item} expanded={expanded} onToggle={() => setExpanded(!expanded)} />;
    case 'tool_result':
      return <ToolResultContent item={item} expanded={expanded} onToggle={() => setExpanded(!expanded)} />;
    case 'file_ref':
      return <FileRefContent item={item} />;
    default:
      return null;
  }
}

interface TextContentProps {
  item: ContentItem;
}

function TextContent({ item }: TextContentProps) {
  return (
    <div
      className={cn(
        'p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50',
        item.status === 'in_progress' && 'animate-pulse'
      )}
    >
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown>{item.content || ''}</ReactMarkdown>
      </div>
    </div>
  );
}

interface ToolCallContentProps {
  item: ContentItem;
  expanded: boolean;
  onToggle: () => void;
}

function ToolCallContent({ item, expanded, onToggle }: ToolCallContentProps) {
  const statusColors = {
    pending: 'border-gray-300 dark:border-gray-600',
    in_progress: 'border-yellow-400 dark:border-yellow-500',
    completed: 'border-green-400 dark:border-green-500',
    error: 'border-red-400 dark:border-red-500',
  };

  const statusIcons = {
    pending: <ClockIcon className="h-4 w-4 text-gray-400" />,
    in_progress: <LoadingIcon className="h-4 w-4 text-yellow-500 animate-spin" />,
    completed: <CheckIcon className="h-4 w-4 text-green-500" />,
    error: <ErrorIcon className="h-4 w-4 text-red-500" />,
  };

  return (
    <div
      className={cn(
        'rounded-lg border-l-4 bg-white dark:bg-gray-800 shadow-sm overflow-hidden',
        statusColors[item.status]
      )}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
      >
        <ToolIcon className="h-5 w-5 text-primary-500" />
        <span className="flex-1 font-mono text-sm text-gray-900 dark:text-white">
          {item.tool_name}
        </span>
        {statusIcons[item.status]}
        <ChevronIcon
          className={cn(
            'h-4 w-4 text-gray-400 transition-transform',
            expanded && 'rotate-180'
          )}
        />
      </button>

      {expanded && item.tool_input && (
        <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700">
          <div className="mt-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Input:
            </p>
            <pre className="text-xs font-mono bg-gray-900 dark:bg-gray-950 text-gray-100 p-2 rounded overflow-x-auto">
              {JSON.stringify(item.tool_input, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

interface ToolResultContentProps {
  item: ContentItem;
  expanded: boolean;
  onToggle: () => void;
}

function ToolResultContent({ item, expanded, onToggle }: ToolResultContentProps) {
  const isError = item.status === 'error';

  return (
    <div
      className={cn(
        'rounded-lg bg-gray-50 dark:bg-gray-800/50 overflow-hidden',
        isError && 'bg-red-50 dark:bg-red-900/20'
      )}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700/50"
      >
        <ResultIcon
          className={cn(
            'h-5 w-5',
            isError ? 'text-red-500' : 'text-green-500'
          )}
        />
        <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
          {isError ? 'Error Result' : 'Tool Result'}
        </span>
        <ChevronIcon
          className={cn(
            'h-4 w-4 text-gray-400 transition-transform',
            expanded && 'rotate-180'
          )}
        />
      </button>

      {expanded && item.tool_output && (
        <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700">
          <pre className="mt-2 text-xs font-mono bg-gray-900 dark:bg-gray-950 text-gray-100 p-2 rounded overflow-x-auto max-h-48 overflow-y-auto">
            {item.tool_output}
          </pre>
        </div>
      )}
    </div>
  );
}

interface FileRefContentProps {
  item: ContentItem;
}

function FileRefContent({ item }: FileRefContentProps) {
  return (
    <div className="flex items-center gap-2 p-2 rounded bg-blue-50 dark:bg-blue-900/20">
      <FileIcon className="h-4 w-4 text-blue-500" />
      <span className="text-sm font-mono text-blue-700 dark:text-blue-400">
        {item.file_path}
      </span>
    </div>
  );
}

// Icons
function ToolIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function LoadingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
  );
}

function ResultIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
