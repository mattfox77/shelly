'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  streaming?: boolean;
  onCancel?: () => void;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled,
  streaming,
  onCancel,
  placeholder = 'Ask Shelly about your repositories...',
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled && !streaming) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-200 dark:border-gray-700 p-4">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              'input resize-none min-h-[40px] max-h-[200px] py-2 pr-24',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1 text-xs text-gray-400">
            <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700">Enter</kbd>
            <span>to send</span>
          </div>
        </div>

        {streaming ? (
          <Button
            type="button"
            variant="danger"
            onClick={onCancel}
            className="flex-shrink-0"
          >
            <StopIcon className="h-4 w-4 mr-1" />
            Stop
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={!message.trim() || disabled}
            className="flex-shrink-0"
          >
            <SendIcon className="h-4 w-4 mr-1" />
            Send
          </Button>
        )}
      </div>

      {/* Quick actions */}
      <div className="mt-2 flex flex-wrap gap-2">
        <QuickAction
          label="Status Report"
          onClick={() => setMessage('Give me a status report on the repository')}
        />
        <QuickAction
          label="Open Issues"
          onClick={() => setMessage('What are the open issues?')}
        />
        <QuickAction
          label="Pending PRs"
          onClick={() => setMessage('List the pull requests that need review')}
        />
        <QuickAction
          label="Daily Summary"
          onClick={() => setMessage('Generate a daily summary report')}
        />
      </div>
    </form>
  );
}

interface QuickActionProps {
  label: string;
  onClick: () => void;
}

function QuickAction({ label, onClick }: QuickActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
    >
      {label}
    </button>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
        clipRule="evenodd"
      />
    </svg>
  );
}
