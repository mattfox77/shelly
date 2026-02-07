'use client';

import { useRef, useEffect } from 'react';
import { ChatMessage } from '@/hooks/useChat';
import { MessageItem } from './MessageItem';
import { cn } from '@/lib/utils';

interface MessageListProps {
  messages: ChatMessage[];
  className?: string;
}

export function MessageList({ messages, className }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className={cn('flex-1 flex items-center justify-center', className)}>
        <div className="text-center">
          <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <ChatBubbleIcon className="h-8 w-8 text-primary-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            Start a Conversation
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md">
            Ask Shelly about your repositories, request reports, or get help managing issues and PRs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex-1 overflow-y-auto scrollbar-thin', className)}>
      <div className="p-4 space-y-4">
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function ChatBubbleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}
