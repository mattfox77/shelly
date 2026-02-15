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

export interface RepoStatsInput {
  repo: string;
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

/**
 * Fetch repository stats with retry/timeout/observability.
 */
export async function repoStatsWorkflow(input: RepoStatsInput): Promise<ReturnType<Activities['fetchRepoStats']>> {
  return activities.fetchRepoStats(input.repo);
}

// ==================== Saga Oversight ====================

export interface SagaOversightInput {
  sagaId: string;
  config?: {
    name: string;
    codename: string;
    repo_url: string;
    base_branch: string;
    slack_channel?: string;
    dimensions: Array<{
      id: string;
      name: string;
      type: string;
      requires?: string[];
      adventures?: Array<{ name: string; prompt: string }>;
    }>;
  };
  autoHandleReviews?: boolean;
  pollIntervalMs?: number;
  maxReviewAttempts?: number;
  notifyChannel?: string;
  notifyRecipient?: string;
}

export interface SagaOversightResult {
  sagaId: string;
  finalStatus: string;
  decisionsLog: Array<{ timestamp: string; decision: string; reasoning: string }>;
  summary: string;
  totalDimensions: number;
  completedDimensions: number;
  collapsedDimensions: number;
  durationMs: number;
}

const TERMINAL_STATUSES = ['complete', 'failed', 'collapsed', 'partial'];

/**
 * Oversees a saga-orchestrator workflow from start to finish.
 *
 * Starts the saga, polls for status, auto-handles review decisions
 * when dimensions collapse, and records the full oversight trail.
 */
export async function sagaOversightWorkflow(input: SagaOversightInput): Promise<SagaOversightResult> {
  const {
    sagaId,
    config,
    autoHandleReviews = true,
    pollIntervalMs = 30_000,
    maxReviewAttempts = 3,
    notifyChannel,
    notifyRecipient,
  } = input;

  const startTime = Date.now();
  const decisionsLog: Array<{ timestamp: string; decision: string; reasoning: string }> = [];
  let reviewAttempts = 0;

  // Step 1: Start the saga
  await activities.startSagaActivity(sagaId, config);

  // Step 2: Record oversight start
  await activities.saveSagaOversightRecord(
    sagaId, 'running', [], `Saga ${sagaId} started`, 0, 0, 0, 0
  );

  // Step 3: Notify start
  if (notifyChannel && notifyRecipient) {
    await activities.sendNotification(
      notifyChannel,
      notifyRecipient,
      `Saga started: ${sagaId}`,
      `Saga ${sagaId} has been started and is being monitored by Shelly.`,
      'normal'
    );
  }

  await activities.logWorkflowActivity(
    null, 'saga_oversight_started', sagaId, { autoHandleReviews, pollIntervalMs }
  );

  // Step 4: Poll loop
  const MAX_CONSECUTIVE_FAILURES = 20;
  let consecutiveFailures = 0;
  let finalStatus = 'unknown';
  let lastDetail = {
    total_dimensions: 0,
    completed_dimensions: 0,
    collapsed_dimensions: 0,
  };

  while (true) {
    await sleep(pollIntervalMs);

    let detail;
    try {
      detail = await activities.getSagaStatusActivity(sagaId);
      consecutiveFailures = 0;
    } catch {
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        finalStatus = 'failed';
        break;
      }
      continue;
    }

    lastDetail = {
      total_dimensions: detail.total_dimensions,
      completed_dimensions: detail.completed_dimensions,
      collapsed_dimensions: detail.collapsed_dimensions,
    };

    // Check for terminal state
    if (TERMINAL_STATUSES.includes(detail.status)) {
      finalStatus = detail.status;
      break;
    }

    // Check for human review needed
    if (detail.needs_human_review && autoHandleReviews && reviewAttempts < maxReviewAttempts) {
      reviewAttempts++;

      const reviewResult = await activities.handleSagaReviewActivity(sagaId, {
        totalDimensions: detail.total_dimensions,
        completedDimensions: detail.completed_dimensions,
        collapsedDimensions: detail.collapsed_dimensions,
        pendingInterrupt: detail.pending_interrupt,
        attemptNumber: reviewAttempts,
      });

      // Send the decision signal
      await activities.sendSagaSignalActivity(
        sagaId, 'interrupt_response', reviewResult.decision
      );

      const entry = {
        timestamp: new Date().toISOString(),
        decision: reviewResult.decision,
        reasoning: reviewResult.reasoning,
      };
      decisionsLog.push(entry);

      await activities.logWorkflowActivity(
        null, 'saga_oversight_decision', sagaId, entry
      );

      if (notifyChannel && notifyRecipient) {
        await activities.sendNotification(
          notifyChannel,
          notifyRecipient,
          `Saga review decision: ${sagaId}`,
          `Decision: ${reviewResult.decision}\nReasoning: ${reviewResult.reasoning}`,
          'high'
        );
      }
    }
  }

  const durationMs = Date.now() - startTime;
  const summary = `Saga ${sagaId} finished with status "${finalStatus}". ` +
    `${lastDetail.completed_dimensions}/${lastDetail.total_dimensions} dimensions completed, ` +
    `${lastDetail.collapsed_dimensions} collapsed. ` +
    `${decisionsLog.length} automated decision(s) made. Duration: ${Math.round(durationMs / 1000)}s.`;

  // Step 5: Save final oversight record
  await activities.saveSagaOversightRecord(
    sagaId,
    finalStatus,
    decisionsLog,
    summary,
    lastDetail.total_dimensions,
    lastDetail.completed_dimensions,
    lastDetail.collapsed_dimensions,
    durationMs
  );

  // Step 6: Notify completion
  if (notifyChannel && notifyRecipient) {
    await activities.sendNotification(
      notifyChannel,
      notifyRecipient,
      `Saga ${finalStatus}: ${sagaId}`,
      summary,
      finalStatus === 'complete' ? 'normal' : 'high'
    );
  }

  await activities.logWorkflowActivity(
    null, 'saga_oversight_completed', sagaId, { finalStatus, durationMs, decisions: decisionsLog.length }
  );

  return {
    sagaId,
    finalStatus,
    decisionsLog,
    summary,
    totalDimensions: lastDetail.total_dimensions,
    completedDimensions: lastDetail.completed_dimensions,
    collapsedDimensions: lastDetail.collapsed_dimensions,
    durationMs,
  };
}
