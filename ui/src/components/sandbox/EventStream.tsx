'use client';

import { useRef, useEffect } from 'react';
import { ContentItem } from '@/hooks/useSandbox';
import { ContentParts } from './ContentParts';
import { cn } from '@/lib/utils';

interface EventStreamProps {
  items: ContentItem[];
  className?: string;
}

export function EventStream({ items, className }: EventStreamProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items]);

  if (items.length === 0) {
    return (
      <div className={cn('flex-1 flex items-center justify-center', className)}>
        <div className="text-center">
          <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <TerminalIcon className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            Ready for Tasks
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md">
            Send a task to the agent to begin. The agent will stream its progress here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex-1 overflow-y-auto scrollbar-thin', className)}>
      <div className="p-4 space-y-3">
        {items.map((item) => (
          <ContentParts key={item.id} item={item} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}
