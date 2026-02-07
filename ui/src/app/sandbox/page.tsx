'use client';

import { useState, useEffect } from 'react';
import { useSandbox } from '@/hooks/useSandbox';
import { SessionList } from '@/components/sandbox/SessionList';
import { EventStream } from '@/components/sandbox/EventStream';
import { PermissionModal, QuestionModal } from '@/components/sandbox/PermissionModal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export default function SandboxPage() {
  const {
    sessions,
    currentSession,
    items,
    pendingPermissions,
    pendingQuestions,
    agents,
    loading,
    streaming,
    error,
    createSession,
    connectToStream,
    sendMessage,
    respondToPermission,
    respondToQuestion,
    terminateSession,
    setCurrentSession,
  } = useSandbox();

  const [taskInput, setTaskInput] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('claude-code');
  const [respondingPermission, setRespondingPermission] = useState(false);
  const [respondingQuestion, setRespondingQuestion] = useState(false);

  // Connect to stream when session changes
  useEffect(() => {
    if (currentSession) {
      connectToStream(currentSession);
    }
  }, [currentSession, connectToStream]);

  const handleNewSession = async () => {
    try {
      const sessionId = await createSession(selectedAgent);
      connectToStream(sessionId);
    } catch {
      // Error handled in hook
    }
  };

  const handleSendTask = async () => {
    if (!taskInput.trim() || !currentSession) return;
    await sendMessage(taskInput.trim());
    setTaskInput('');
  };

  const handleApprovePermission = async () => {
    const permission = pendingPermissions[0];
    if (!permission) return;

    setRespondingPermission(true);
    try {
      await respondToPermission(permission.id, true);
    } finally {
      setRespondingPermission(false);
    }
  };

  const handleDenyPermission = async () => {
    const permission = pendingPermissions[0];
    if (!permission) return;

    setRespondingPermission(true);
    try {
      await respondToPermission(permission.id, false);
    } finally {
      setRespondingPermission(false);
    }
  };

  const handleAnswerQuestion = async (answer: string) => {
    const question = pendingQuestions[0];
    if (!question) return;

    setRespondingQuestion(true);
    try {
      await respondToQuestion(question.id, answer);
    } finally {
      setRespondingQuestion(false);
    }
  };

  return (
    <div className="h-full">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Sandbox Sessions
      </h1>

      <div className="flex h-[calc(100vh-12rem)] gap-4">
        {/* Sidebar */}
        <div className="w-72 flex-shrink-0">
          <SessionList
            sessions={sessions}
            currentSession={currentSession}
            onSelect={setCurrentSession}
            onTerminate={terminateSession}
            onNewSession={handleNewSession}
            loading={loading}
          />

          {/* Agent Selector */}
          <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <label className="label">Agent</label>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="input mt-1"
            >
              {agents.map((agent) => (
                <option
                  key={agent.name}
                  value={agent.name}
                  disabled={!agent.supported}
                >
                  {agent.name} {!agent.supported && '(unavailable)'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">
                {currentSession ? `Session: ${currentSession.slice(0, 12)}...` : 'No Session Selected'}
              </h2>
              {streaming && (
                <p className="text-sm text-primary-500 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary-500 animate-pulse" />
                  Streaming events...
                </p>
              )}
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>

          {/* Event Stream */}
          <EventStream items={items} className="flex-1" />

          {/* Task Input */}
          {currentSession && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-2">
                <textarea
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  placeholder="Enter a task for the agent..."
                  rows={2}
                  className="input flex-1 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendTask();
                    }
                  }}
                />
                <Button
                  onClick={handleSendTask}
                  disabled={!taskInput.trim() || streaming}
                  className="self-end"
                >
                  <SendIcon className="h-4 w-4 mr-1" />
                  Send
                </Button>
              </div>

              {/* Quick Task Templates */}
              <div className="mt-2 flex flex-wrap gap-2">
                <TaskTemplate
                  label="Fix bug"
                  onClick={() => setTaskInput('Find and fix the bug in ')}
                />
                <TaskTemplate
                  label="Add tests"
                  onClick={() => setTaskInput('Add unit tests for ')}
                />
                <TaskTemplate
                  label="Refactor"
                  onClick={() => setTaskInput('Refactor the code in ')}
                />
                <TaskTemplate
                  label="Document"
                  onClick={() => setTaskInput('Add documentation for ')}
                />
              </div>
            </div>
          )}

          {/* Placeholder when no session */}
          {!currentSession && (
            <div className="p-4 text-center border-t border-gray-200 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Select a session or create a new one to get started.
              </p>
              <Button onClick={handleNewSession} loading={loading}>
                Create New Session
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Permission Modal */}
      <PermissionModal
        permission={pendingPermissions[0] || null}
        onApprove={handleApprovePermission}
        onDeny={handleDenyPermission}
        loading={respondingPermission}
      />

      {/* Question Modal */}
      <QuestionModal
        question={pendingQuestions[0] || null}
        onAnswer={handleAnswerQuestion}
        onCancel={() => respondToQuestion(pendingQuestions[0]?.id || '', '')}
        loading={respondingQuestion}
      />
    </div>
  );
}

interface TaskTemplateProps {
  label: string;
  onClick: () => void;
}

function TaskTemplate({ label, onClick }: TaskTemplateProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
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
