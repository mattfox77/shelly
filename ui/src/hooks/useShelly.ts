'use client';

import { useState, useCallback } from 'react';

const API_BASE = '/api';

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

interface ApiError {
  error: string;
  status: number;
}

export function useShelly() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchApi = useCallback(async <T>(
    endpoint: string,
    options: FetchOptions = {}
  ): Promise<T> => {
    const { params, ...fetchOptions } = options;

    let url = `${API_BASE}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw { error: data.error || response.statusText, status: response.status };
      }

      return await response.json();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.error || 'An error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Dashboard endpoints
  const getProjects = useCallback(() =>
    fetchApi<{ projects: Project[] }>('/projects'),
    [fetchApi]
  );

  const getProjectStats = useCallback((owner: string, repo: string) =>
    fetchApi<ProjectStats>(`/projects/${owner}/${repo}/stats`),
    [fetchApi]
  );

  const getDailyReports = useCallback((owner: string, repo: string, limit = 7) =>
    fetchApi<{ reports: DailyReport[] }>(`/projects/${owner}/${repo}/reports/daily`, {
      params: { limit: String(limit) },
    }),
    [fetchApi]
  );

  const getActivity = useCallback((owner: string, repo: string, limit = 50) =>
    fetchApi<{ activity: Activity[] }>(`/projects/${owner}/${repo}/activity`, {
      params: { limit: String(limit) },
    }),
    [fetchApi]
  );

  const getVelocity = useCallback((owner: string, repo: string, days = 14) =>
    fetchApi<{ velocity: VelocityData[] }>(`/projects/${owner}/${repo}/velocity`, {
      params: { days: String(days) },
    }),
    [fetchApi]
  );

  const getContributors = useCallback((owner: string, repo: string) =>
    fetchApi<{ contributors: Contributor[] }>(`/projects/${owner}/${repo}/contributors`),
    [fetchApi]
  );

  // Admin endpoints
  const getSettings = useCallback(() =>
    fetchApi<{ settings: Settings }>('/admin/settings'),
    [fetchApi]
  );

  const updateSettings = useCallback((settings: Partial<Settings>) =>
    fetchApi<{ success: boolean; settings: Settings }>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
    [fetchApi]
  );

  const getNotificationChannels = useCallback(() =>
    fetchApi<{ channels: NotificationChannel[] }>('/admin/notifications/channels'),
    [fetchApi]
  );

  const configureChannel = useCallback((channel: string, config: Record<string, unknown>) =>
    fetchApi<{ success: boolean }>(`/admin/notifications/channels/${channel}`, {
      method: 'PUT',
      body: JSON.stringify(config),
    }),
    [fetchApi]
  );

  const testNotification = useCallback((channel: string, recipient: string) =>
    fetchApi<{ result: NotificationResult }>('/admin/notifications/test', {
      method: 'POST',
      body: JSON.stringify({ channel, recipient }),
    }),
    [fetchApi]
  );

  const addProject = useCallback((repo: string, description?: string) =>
    fetchApi<{ project: Project }>('/admin/projects', {
      method: 'POST',
      body: JSON.stringify({ repo, description }),
    }),
    [fetchApi]
  );

  const removeProject = useCallback((owner: string, repo: string) =>
    fetchApi<void>(`/admin/projects/${owner}/${repo}`, {
      method: 'DELETE',
    }),
    [fetchApi]
  );

  // Workflow endpoints
  const getWorkflows = useCallback((limit?: number) =>
    fetchApi<{ workflows: WorkflowExecution[] }>('/workflows', {
      params: limit ? { limit: String(limit) } : undefined,
    }),
    [fetchApi]
  );

  const getWorkflowStatus = useCallback((workflowId: string) =>
    fetchApi<WorkflowExecution>(`/workflows/${workflowId}`),
    [fetchApi]
  );

  const getWorkflowResult = useCallback((workflowId: string) =>
    fetchApi<{ workflowId: string; result: unknown }>(`/workflows/${workflowId}/result`),
    [fetchApi]
  );

  const triggerDailyReport = useCallback((repos?: string[], date?: string) =>
    fetchApi<WorkflowTriggerResult>('/workflows/trigger/daily-report', {
      method: 'POST',
      body: JSON.stringify({ repos, date }),
    }),
    [fetchApi]
  );

  const triggerWeeklyReport = useCallback((repos?: string[], weekStart?: string) =>
    fetchApi<WorkflowTriggerResult>('/workflows/trigger/weekly-report', {
      method: 'POST',
      body: JSON.stringify({ repos, weekStart }),
    }),
    [fetchApi]
  );

  const triggerStaleDetection = useCallback((opts?: { repos?: string[]; staleDays?: number; notifyChannel?: string; notifyRecipient?: string }) =>
    fetchApi<WorkflowTriggerResult>('/workflows/trigger/stale-detection', {
      method: 'POST',
      body: JSON.stringify(opts || {}),
    }),
    [fetchApi]
  );

  const getSchedules = useCallback(() =>
    fetchApi<{ schedules: WorkflowSchedule[] }>('/workflows/schedules'),
    [fetchApi]
  );

  const cancelWorkflow = useCallback((workflowId: string) =>
    fetchApi<{ workflowId: string; status: string }>(`/workflows/${workflowId}/cancel`, {
      method: 'POST',
    }),
    [fetchApi]
  );

  return {
    loading,
    error,
    // Dashboard
    getProjects,
    getProjectStats,
    getDailyReports,
    getActivity,
    getVelocity,
    getContributors,
    // Admin
    getSettings,
    updateSettings,
    getNotificationChannels,
    configureChannel,
    testNotification,
    addProject,
    removeProject,
    // Workflows
    getWorkflows,
    getWorkflowStatus,
    getWorkflowResult,
    triggerDailyReport,
    triggerWeeklyReport,
    triggerStaleDetection,
    getSchedules,
    cancelWorkflow,
  };
}

// Types
export interface Project {
  id: number;
  github_repo: string;
  owner: string;
  name: string;
  description?: string;
  default_branch: string;
  is_active: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProjectStats {
  repository: {
    name: string;
    full_name: string;
    description: string | null;
    stars: number;
    forks: number;
    default_branch: string;
  };
  issues: {
    open: number;
    labels: Record<string, number>;
  };
  pullRequests: {
    open: number;
    reviewPending: number;
    withReviewers: number;
  };
  today: {
    commits: number;
    contributors: number;
  };
  lastUpdated: string;
}

export interface DailyReport {
  id: number;
  project_id: number;
  report_date: string;
  issues_opened: number;
  issues_closed: number;
  prs_opened: number;
  prs_merged: number;
  prs_closed: number;
  commits_count: number;
  active_contributors: number;
  summary?: string;
  highlights: string[];
  blockers: string[];
}

export interface Activity {
  id: number;
  action_type: string;
  action_target: string;
  action_details: Record<string, unknown>;
  created_at: string;
}

export interface VelocityData {
  date: string;
  issuesClosed: number;
  prsMerged: number;
  commits: number;
  contributors: number;
}

export interface Contributor {
  author: { login: string } | null;
  total: number;
  weeks: Array<{ w?: number; a?: number; d?: number; c?: number }>;
}

export interface Settings {
  dailyReportTime: string;
  weeklyReportDay: string;
  defaultStalePRDays: number;
  notificationDefaults: {
    channel: string;
    priority: string;
  };
}

export interface NotificationChannel {
  name: string;
  configured: boolean;
  description: string;
}

export interface NotificationResult {
  success: boolean;
  channel: string;
  recipient: string;
  messageId?: string;
  error?: string;
}

export interface WorkflowExecution {
  workflowId: string;
  runId: string;
  type: string;
  status: string;
  startTime?: string;
  closeTime?: string;
  executionTime?: string;
}

export interface WorkflowTriggerResult {
  workflowId: string;
  runId: string;
}

export interface WorkflowSchedule {
  scheduleId: string;
  info: unknown;
}
