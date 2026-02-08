/**
 * Temporal Activities
 *
 * Activity implementations that wrap existing Shelly services.
 * Dependencies are injected via closure at worker startup.
 */

import { ReportingService, DailyReportData, WeeklyReportData } from '../skills/reporting';
import { ShellyDataStore, Project } from '../data/store';
import { GitHubClient, Issue, PullRequest } from '../github/client';
import { NotificationService, NotificationResult } from '../channels/notifications';
import { loggers } from 'the-machina';

export interface ActivityDependencies {
  reportingService: ReportingService;
  dataStore: ShellyDataStore;
  github: GitHubClient;
  notificationService: NotificationService;
}

export interface RepoStats {
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

export interface StaleItem {
  type: 'issue' | 'pr';
  number: number;
  title: string;
  updatedAt: string;
  daysSinceUpdate: number;
  url: string;
}

/**
 * Create activity implementations with injected dependencies.
 * Returns an object of activity functions suitable for Temporal worker registration.
 */
export function createActivities(deps: ActivityDependencies) {
  const { reportingService, dataStore, github, notificationService } = deps;

  return {
    async generateDailyReportForRepo(
      repo: string,
      date?: string
    ): Promise<DailyReportData> {
      loggers.app.info('Activity: generating daily report', { repo, date });
      const reportDate = date ? new Date(date) : new Date();
      return reportingService.generateDailyReport(repo, reportDate);
    },

    async generateWeeklyReportForRepo(
      repo: string,
      weekStart?: string
    ): Promise<WeeklyReportData> {
      loggers.app.info('Activity: generating weekly report', { repo, weekStart });
      const startDate = weekStart ? new Date(weekStart) : undefined;
      return reportingService.generateWeeklyReport(repo, startDate);
    },

    async getActiveProjects(): Promise<Project[]> {
      loggers.app.info('Activity: fetching active projects');
      return dataStore.listActiveProjects();
    },

    async detectStaleIssues(
      repo: string,
      staleDays: number
    ): Promise<StaleItem[]> {
      loggers.app.info('Activity: detecting stale issues', { repo, staleDays });
      const issues = await github.listIssues(repo, { state: 'open' });
      const now = Date.now();
      const cutoffMs = staleDays * 24 * 60 * 60 * 1000;

      return issues
        .filter(issue => (now - new Date(issue.updated_at).getTime()) > cutoffMs)
        .map(issue => ({
          type: 'issue' as const,
          number: issue.number,
          title: issue.title,
          updatedAt: issue.updated_at,
          daysSinceUpdate: Math.floor((now - new Date(issue.updated_at).getTime()) / (24 * 60 * 60 * 1000)),
          url: issue.html_url,
        }));
    },

    async detectStalePRs(
      repo: string,
      staleDays: number
    ): Promise<StaleItem[]> {
      loggers.app.info('Activity: detecting stale PRs', { repo, staleDays });
      const prs = await github.listPullRequests(repo, { state: 'open' });
      const now = Date.now();
      const cutoffMs = staleDays * 24 * 60 * 60 * 1000;

      return prs
        .filter(pr => (now - new Date(pr.updated_at).getTime()) > cutoffMs)
        .map(pr => ({
          type: 'pr' as const,
          number: pr.number,
          title: pr.title,
          updatedAt: pr.updated_at,
          daysSinceUpdate: Math.floor((now - new Date(pr.updated_at).getTime()) / (24 * 60 * 60 * 1000)),
          url: pr.html_url,
        }));
    },

    async sendNotification(
      channel: string,
      recipient: string,
      subject: string,
      body: string,
      priority: 'low' | 'normal' | 'high'
    ): Promise<NotificationResult> {
      loggers.app.info('Activity: sending notification', { channel, recipient, subject });
      return notificationService.send(channel, recipient, {
        subject,
        body,
        priority,
      });
    },

    async fetchRepoStats(repo: string): Promise<RepoStats> {
      loggers.app.info('Activity: fetching repo stats', { repo });

      const [issues, prs, repoInfo] = await Promise.all([
        github.listIssues(repo, { state: 'open' }),
        github.listPullRequests(repo, { state: 'open' }),
        github.getRepository(repo),
      ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const commits = await github.listCommits(repo, {
        since: today.toISOString(),
      });

      // Group issues by label
      const labelCounts: Record<string, number> = {};
      for (const issue of issues) {
        for (const label of issue.labels || []) {
          labelCounts[label.name] = (labelCounts[label.name] || 0) + 1;
        }
      }

      return {
        repository: {
          name: repoInfo.name,
          full_name: repoInfo.full_name,
          description: repoInfo.description,
          stars: repoInfo.stargazers_count,
          forks: repoInfo.forks_count,
          default_branch: repoInfo.default_branch,
        },
        issues: {
          open: issues.length,
          labels: labelCounts,
        },
        pullRequests: {
          open: prs.length,
          reviewPending: prs.filter(pr => !pr.requested_reviewers?.length).length,
          withReviewers: prs.filter(pr => pr.requested_reviewers?.length).length,
        },
        today: {
          commits: commits.length,
          contributors: [...new Set(commits.map(c => c.author?.login).filter(Boolean))].length,
        },
        lastUpdated: new Date().toISOString(),
      };
    },

    async logWorkflowActivity(
      projectId: number | null,
      actionType: string,
      actionTarget: string,
      details: Record<string, unknown>
    ): Promise<void> {
      loggers.app.info('Activity: logging workflow activity', { actionType, actionTarget });
      await dataStore.logActivity(projectId, actionType, actionTarget, details);
    },
  };
}

export type Activities = ReturnType<typeof createActivities>;
