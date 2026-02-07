'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Project } from '@/hooks/useShelly';
import { formatDate, cn } from '@/lib/utils';

interface RepositoryManagerProps {
  projects: Project[];
  onAdd: (repo: string, description?: string) => Promise<void>;
  onRemove: (owner: string, repo: string) => Promise<void>;
}

export function RepositoryManager({ projects, onAdd, onRemove }: RepositoryManagerProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [newRepo, setNewRepo] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const handleAdd = async () => {
    if (!newRepo.trim()) {
      setError('Repository is required');
      return;
    }

    if (!newRepo.match(/^[\w-]+\/[\w.-]+$/)) {
      setError('Invalid format. Use owner/repo');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onAdd(newRepo.trim(), newDescription.trim() || undefined);
      setShowAddModal(false);
      setNewRepo('');
      setNewDescription('');
    } catch {
      setError('Failed to add repository');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!selectedProject) return;

    setLoading(true);

    try {
      await onRemove(selectedProject.owner, selectedProject.name);
      setShowRemoveModal(false);
      setSelectedProject(null);
    } catch {
      // Error handled in hook
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Tracked Repositories</CardTitle>
            <Button onClick={() => setShowAddModal(true)} size="sm">
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Repository
            </Button>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {projects.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              No repositories tracked yet. Add one to get started.
            </p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {projects.map((project) => (
                <li
                  key={project.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <RepoIcon className="h-5 w-5 text-gray-400" />
                      <a
                        href={`https://github.com/${project.github_repo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-gray-900 dark:text-white hover:text-primary-500"
                      >
                        {project.github_repo}
                      </a>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium',
                          project.is_active
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        )}
                      >
                        {project.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {project.description && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 truncate">
                        {project.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">
                      Added {formatDate(project.created_at)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedProject(project);
                      setShowRemoveModal(true);
                    }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setError(null);
          setNewRepo('');
          setNewDescription('');
        }}
        title="Add Repository"
      >
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="repo">
              Repository (owner/name)
            </label>
            <input
              id="repo"
              type="text"
              value={newRepo}
              onChange={(e) => setNewRepo(e.target.value)}
              placeholder="e.g., facebook/react"
              className="input mt-1"
            />
          </div>

          <div>
            <label className="label" htmlFor="description">
              Description (optional)
            </label>
            <input
              id="description"
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Brief description"
              className="input mt-1"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddModal(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAdd} loading={loading}>
              Add Repository
            </Button>
          </div>
        </div>
      </Modal>

      {/* Remove Confirmation */}
      <ConfirmModal
        isOpen={showRemoveModal}
        onClose={() => setShowRemoveModal(false)}
        onConfirm={handleRemove}
        title="Remove Repository"
        message={`Are you sure you want to remove ${selectedProject?.github_repo}? This will not delete any data, but Shelly will stop tracking this repository.`}
        confirmLabel="Remove"
        variant="danger"
        loading={loading}
      />
    </>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function RepoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
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
