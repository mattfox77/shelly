'use client';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { PendingPermission, PendingQuestion } from '@/hooks/useSandbox';
import { formatRelativeTime } from '@/lib/utils';

interface PermissionModalProps {
  permission: PendingPermission | null;
  onApprove: () => void;
  onDeny: () => void;
  loading?: boolean;
}

export function PermissionModal({
  permission,
  onApprove,
  onDeny,
  loading,
}: PermissionModalProps) {
  if (!permission) return null;

  return (
    <Modal
      isOpen={!!permission}
      onClose={onDeny}
      title="Permission Request"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <ShieldIcon className="h-6 w-6 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-800 dark:text-yellow-300">
              Agent requesting permission
            </h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
              The agent wants to execute a tool that requires your approval.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Tool
            </label>
            <p className="font-mono text-gray-900 dark:text-white">
              {permission.tool}
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Description
            </label>
            <p className="text-gray-700 dark:text-gray-300">
              {permission.description}
            </p>
          </div>

          <p className="text-xs text-gray-400">
            Requested {formatRelativeTime(permission.timestamp)}
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="secondary" onClick={onDeny} disabled={loading}>
            Deny
          </Button>
          <Button onClick={onApprove} loading={loading}>
            Approve
          </Button>
        </div>
      </div>
    </Modal>
  );
}

interface QuestionModalProps {
  question: PendingQuestion | null;
  onAnswer: (answer: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function QuestionModal({
  question,
  onAnswer,
  onCancel,
  loading,
}: QuestionModalProps) {
  if (!question) return null;

  return (
    <Modal
      isOpen={!!question}
      onClose={onCancel}
      title="Agent Question"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <QuestionIcon className="h-6 w-6 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-blue-800 dark:text-blue-300">
            {question.question}
          </p>
        </div>

        {question.options ? (
          <div className="space-y-2">
            {question.options.map((option, index) => (
              <button
                key={index}
                onClick={() => onAnswer(option)}
                disabled={loading}
                className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {option}
              </button>
            ))}
          </div>
        ) : (
          <div>
            <textarea
              id="answer"
              rows={3}
              placeholder="Type your answer..."
              className="input"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const value = (e.target as HTMLTextAreaElement).value;
                  if (value.trim()) {
                    onAnswer(value.trim());
                  }
                }
              }}
            />
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="secondary" onClick={onCancel} disabled={loading}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const textarea = document.getElementById('answer') as HTMLTextAreaElement;
                  if (textarea?.value.trim()) {
                    onAnswer(textarea.value.trim());
                  }
                }}
                loading={loading}
              >
                Submit
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400">
          Asked {formatRelativeTime(question.timestamp)}
        </p>
      </div>
    </Modal>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

function QuestionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
