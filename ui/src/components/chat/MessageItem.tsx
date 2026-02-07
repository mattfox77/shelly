'use client';

import ReactMarkdown from 'react-markdown';
import { ChatMessage, ToolCall } from '@/hooks/useChat';
import { ToolCallDisplay } from './ToolCallDisplay';
import { cn, formatTime } from '@/lib/utils';

interface MessageItemProps {
  message: ChatMessage;
}

export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium',
          isUser
            ? 'bg-primary-500 text-white'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
        )}
      >
        {isUser ? 'U' : 'S'}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          'flex-1 max-w-[80%]',
          isUser ? 'text-right' : 'text-left'
        )}
      >
        <div
          className={cn(
            'inline-block rounded-lg px-4 py-2',
            isUser
              ? 'bg-primary-500 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white',
            message.streaming && 'animate-pulse'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  // Style code blocks
                  code: ({ className, children, ...props }) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = !match;
                    return isInline ? (
                      <code
                        className="px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-sm font-mono"
                        {...props}
                      >
                        {children}
                      </code>
                    ) : (
                      <pre className="p-3 rounded-lg bg-gray-900 dark:bg-gray-950 overflow-x-auto">
                        <code className="text-sm font-mono text-gray-100" {...props}>
                          {children}
                        </code>
                      </pre>
                    );
                  },
                  // Style links
                  a: ({ children, ...props }) => (
                    <a
                      className="text-primary-500 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                      {...props}
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {message.content || (message.streaming ? 'Thinking...' : '')}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Tool Calls */}
        {message.tool_calls && message.tool_calls.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.tool_calls.map((tool: ToolCall) => (
              <ToolCallDisplay key={tool.id} toolCall={tool} />
            ))}
          </div>
        )}

        {/* Timestamp */}
        <p
          className={cn(
            'mt-1 text-xs text-gray-400',
            isUser ? 'text-right' : 'text-left'
          )}
        >
          {formatTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}
