/**
 * Temporal Workflows
 *
 * Workflow definitions that run in Temporal's V8 sandbox.
 * These must only import from @temporalio/workflow and use proxyActivities.
 */

import { proxyActivities, sleep } from '@temporalio/workflow';
import type { Activities } from './activities';

const activities = proxyActivities<Activities>({
  startToCloseTimeout: '5m',
  retry: {
    maximumAttempts: 3,
    initialInterval: '5s',
    backoffCoefficient: 2,
    maximumInterval: '1m',
  },
});

export interface DailyReportInput {
  repos?: string[];
  date?: string;
}

export interface WeeklyReportInput {
  repos?: string[];
  weekStart?: string;
}

export interface StaleDetectionInput {
  repos?: string[];
  staleDays?: number;
  notifyChannel?: string;
  notifyRecipient?: string;
}

export interface NotificationInput {
  channel: string;
  recipient: string;
  subject: string;
  body: string;
  priority?: 'low' | 'normal' | 'high';
}

/**
 * Generates daily reports for all active projects or specified repos.
 */
export async function dailyReportWorkflow(input: DailyReportInput = {}): Promise<{
  reportsGenerated: number;
  repos: string[];
  errors: Array<{ repo: string; error: string }>;
}> {
  const repos = input.repos?.length
    ? input.repos
    : (await activities.getActiveProjects()).map(p => p.github_repo);

  const results: string[] = [];
  const errors: Array<{ repo: string; error: string }> = [];

  for (const repo of repos) {
    try {
      await activities.generateDailyReportForRepo(repo, input.date);
      results.push(repo);
      await activities.logWorkflowActivity(
        null,
        'workflow:daily-report',
        repo,
        { date: input.date || new Date().toISOString() }
      );
    } catch (err) {
      errors.push({ repo, error: String(err) });
    }
  }

  return {
    reportsGenerated: results.length,
    repos: results,
    errors,
  };
}

/**
 * Generates weekly reports for all active projects or specified repos.
 */
export async function weeklyReportWorkflow(input: WeeklyReportInput = {}): Promise<{
  reportsGenerated: number;
  repos: string[];
  errors: Array<{ repo: string; error: string }>;
}> {
  const repos = input.repos?.length
    ? input.repos
    : (await activities.getActiveProjects()).map(p => p.github_repo);

  const results: string[] = [];
  const errors: Array<{ repo: string; error: string }> = [];

  for (const repo of repos) {
    try {
      await activities.generateWeeklyReportForRepo(repo, input.weekStart);
      results.push(repo);
      await activities.logWorkflowActivity(
        null,
        'workflow:weekly-report',
        repo,
        { weekStart: input.weekStart || new Date().toISOString() }
      );
    } catch (err) {
      errors.push({ repo, error: String(err) });
    }
  }

  return {
    reportsGenerated: results.length,
    repos: results,
    errors,
  };
}

/**
 * Scans repos for stale issues/PRs, optionally sends notification.
 */
export async function staleDetectionWorkflow(input: StaleDetectionInput = {}): Promise<{
  reposScanned: number;
  staleIssues: number;
  stalePRs: number;
  notificationSent: boolean;
  details: Array<{ repo: string; issues: number; prs: number }>;
}> {
  const staleDays = input.staleDays ?? 7;
  const repos = input.repos?.length
    ? input.repos
    : (await activities.getActiveProjects()).map(p => p.github_repo);

  let totalStaleIssues = 0;
  let totalStalePRs = 0;
  const details: Array<{ repo: string; issues: number; prs: number }> = [];

  for (const repo of repos) {
    const staleIssues = await activities.detectStaleIssues(repo, staleDays);
    const stalePRs = await activities.detectStalePRs(repo, staleDays);

    totalStaleIssues += staleIssues.length;
    totalStalePRs += stalePRs.length;
    details.push({ repo, issues: staleIssues.length, prs: stalePRs.length });

    await activities.logWorkflowActivity(
      null,
      'workflow:stale-detection',
      repo,
      { staleDays, staleIssues: staleIssues.length, stalePRs: stalePRs.length }
    );
  }

  let notificationSent = false;
  if (input.notifyChannel && input.notifyRecipient && (totalStaleIssues > 0 || totalStalePRs > 0)) {
    const body = details
      .filter(d => d.issues > 0 || d.prs > 0)
      .map(d => `${d.repo}: ${d.issues} stale issues, ${d.prs} stale PRs`)
      .join('\n');

    await activities.sendNotification(
      input.notifyChannel,
      input.notifyRecipient,
      `Stale Detection: ${totalStaleIssues} issues, ${totalStalePRs} PRs need attention`,
      body,
      'normal'
    );
    notificationSent = true;
  }

  return {
    reposScanned: repos.length,
    staleIssues: totalStaleIssues,
    stalePRs: totalStalePRs,
    notificationSent,
    details,
  };
}

/**
 * Durable notification delivery with retry.
 */
export async function notificationDeliveryWorkflow(input: NotificationInput): Promise<{
  success: boolean;
  channel: string;
  recipient: string;
  messageId?: string;
  error?: string;
}> {
  const result = await activities.sendNotification(
    input.channel,
    input.recipient,
    input.subject,
    input.body,
    input.priority ?? 'normal'
  );

  await activities.logWorkflowActivity(
    null,
    'workflow:notification',
    `${input.channel}:${input.recipient}`,
    { subject: input.subject, success: result.success }
  );

  return {
    success: result.success,
    channel: result.channel,
    recipient: result.recipient,
    messageId: result.messageId,
    error: result.error,
  };
}
