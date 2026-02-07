/**
 * Reporting Service
 *
 * Generates daily and weekly project reports with metrics and insights.
 */

import { GitHubClient, Issue, PullRequest } from '../github/client';
import { ShellyDataStore, DailyReport, WeeklyReport } from '../data/store';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, daysAgo, formatDate } from '../utils/dates';
import { loggers } from 'the-machina';

export interface ReportingConfig {
  github: GitHubClient;
  dataStore: ShellyDataStore;
}

export interface DailyReportData {
  date: Date;
  issues: {
    opened: Issue[];
    closed: Issue[];
    total_open: number;
  };
  pullRequests: {
    opened: PullRequest[];
    merged: PullRequest[];
    closed: PullRequest[];
    total_open: number;
  };
  commits: number;
  contributors: string[];
  highlights: string[];
  blockers: string[];
}

export interface WeeklyReportData {
  weekStart: Date;
  weekEnd: Date;
  dailyReports: DailyReport[];
  totals: {
    issues_opened: number;
    issues_closed: number;
    prs_opened: number;
    prs_merged: number;
  };
  velocity: {
    score: number;
    trend: 'up' | 'down' | 'stable';
    change: number;
  };
  health: {
    score: number;
    factors: Record<string, number>;
  };
  topContributors: Array<{ username: string; contributions: number }>;
  recommendations: string[];
}

export class ReportingService {
  private github: GitHubClient;
  private dataStore: ShellyDataStore;

  constructor(config: ReportingConfig) {
    this.github = config.github;
    this.dataStore = config.dataStore;
  }

  /**
   * Generate a daily report for a repository
   */
  async generateDailyReport(repo: string, date: Date = new Date()): Promise<DailyReportData> {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    const since = dayStart.toISOString();

    loggers.app.info('Generating daily report', { repo, date: formatDate(date) });

    // Fetch issues
    const allIssues = await this.github.listIssues(repo, { state: 'all', since });
    const openedIssues = allIssues.filter(i =>
      new Date(i.created_at) >= dayStart && new Date(i.created_at) <= dayEnd
    );
    const closedIssues = allIssues.filter(i =>
      i.closed_at && new Date(i.closed_at) >= dayStart && new Date(i.closed_at) <= dayEnd
    );
    const currentOpenIssues = await this.github.listIssues(repo, { state: 'open' });

    // Fetch PRs
    const allPRs = await this.github.listPullRequests(repo, { state: 'all' });
    const openedPRs = allPRs.filter(pr =>
      new Date(pr.created_at) >= dayStart && new Date(pr.created_at) <= dayEnd
    );
    const mergedPRs = allPRs.filter(pr =>
      pr.merged_at && new Date(pr.merged_at) >= dayStart && new Date(pr.merged_at) <= dayEnd
    );
    const closedPRs = allPRs.filter(pr =>
      pr.closed_at && !pr.merged_at &&
      new Date(pr.closed_at) >= dayStart && new Date(pr.closed_at) <= dayEnd
    );
    const currentOpenPRs = await this.github.listPullRequests(repo, { state: 'open' });

    // Fetch commits
    const commits = await this.github.listCommits(repo, { since });
    const todayCommits = commits.filter(c =>
      c.commit.author?.date &&
      new Date(c.commit.author.date) >= dayStart &&
      new Date(c.commit.author.date) <= dayEnd
    );

    // Get unique contributors
    const contributors = new Set<string>();
    todayCommits.forEach(c => {
      if (c.author?.login) contributors.add(c.author.login);
    });
    openedPRs.forEach(pr => {
      if (pr.user?.login) contributors.add(pr.user.login);
    });

    // Generate highlights
    const highlights: string[] = [];
    if (mergedPRs.length > 0) {
      highlights.push(`${mergedPRs.length} PR(s) merged`);
      mergedPRs.slice(0, 3).forEach(pr => {
        highlights.push(`  - #${pr.number}: ${pr.title}`);
      });
    }
    if (closedIssues.length > 0) {
      highlights.push(`${closedIssues.length} issue(s) closed`);
    }

    // Identify blockers (stale PRs, high-priority issues)
    const blockers: string[] = [];
    const stalePRs = currentOpenPRs.filter(pr => {
      const daysSinceUpdate = (Date.now() - new Date(pr.updated_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate > 3;
    });
    if (stalePRs.length > 0) {
      blockers.push(`${stalePRs.length} stale PR(s) need attention`);
    }

    // Save to database
    const project = await this.dataStore.getProject(repo);
    if (project) {
      await this.dataStore.saveDailyReport({
        project_id: project.id,
        report_date: dayStart,
        issues_opened: openedIssues.length,
        issues_closed: closedIssues.length,
        prs_opened: openedPRs.length,
        prs_merged: mergedPRs.length,
        prs_closed: closedPRs.length,
        commits_count: todayCommits.length,
        active_contributors: contributors.size,
        summary: this.generateDailySummary(openedIssues.length, closedIssues.length, mergedPRs.length),
        highlights,
        blockers,
        raw_data: {
          opened_issues: openedIssues.map(i => i.number),
          closed_issues: closedIssues.map(i => i.number),
          merged_prs: mergedPRs.map(pr => pr.number)
        }
      });
    }

    return {
      date,
      issues: {
        opened: openedIssues,
        closed: closedIssues,
        total_open: currentOpenIssues.length
      },
      pullRequests: {
        opened: openedPRs,
        merged: mergedPRs,
        closed: closedPRs,
        total_open: currentOpenPRs.length
      },
      commits: todayCommits.length,
      contributors: Array.from(contributors),
      highlights,
      blockers
    };
  }

  /**
   * Generate a weekly report for a repository
   */
  async generateWeeklyReport(repo: string, weekStart?: Date): Promise<WeeklyReportData> {
    const start = weekStart ? startOfWeek(weekStart) : startOfWeek(new Date());
    const end = endOfWeek(start);

    loggers.app.info('Generating weekly report', {
      repo,
      weekStart: formatDate(start),
      weekEnd: formatDate(end)
    });

    const project = await this.dataStore.getProject(repo);
    if (!project) {
      throw new Error(`Project not found for repository: ${repo}`);
    }

    // Get daily reports for the week
    const dailyReports = await this.dataStore.getRecentDailyReports(project.id, 7);
    const weekReports = dailyReports.filter(r => {
      const reportDate = new Date(r.report_date);
      return reportDate >= start && reportDate <= end;
    });

    // Calculate totals
    const totals = weekReports.reduce((acc, r) => ({
      issues_opened: acc.issues_opened + r.issues_opened,
      issues_closed: acc.issues_closed + r.issues_closed,
      prs_opened: acc.prs_opened + r.prs_opened,
      prs_merged: acc.prs_merged + r.prs_merged
    }), { issues_opened: 0, issues_closed: 0, prs_opened: 0, prs_merged: 0 });

    // Calculate velocity (issues closed + PRs merged per day)
    const velocityScore = (totals.issues_closed + totals.prs_merged) / 7;

    // Get previous week for comparison
    const prevWeekStart = daysAgo(7, start);
    const prevWeekEnd = daysAgo(7, end);
    const prevWeekReports = dailyReports.filter(r => {
      const reportDate = new Date(r.report_date);
      return reportDate >= prevWeekStart && reportDate <= prevWeekEnd;
    });

    const prevTotals = prevWeekReports.reduce((acc, r) => ({
      issues_closed: acc.issues_closed + r.issues_closed,
      prs_merged: acc.prs_merged + r.prs_merged
    }), { issues_closed: 0, prs_merged: 0 });

    const prevVelocity = (prevTotals.issues_closed + prevTotals.prs_merged) / 7;
    const velocityChange = prevVelocity > 0 ? ((velocityScore - prevVelocity) / prevVelocity) * 100 : 0;
    const velocityTrend: 'up' | 'down' | 'stable' =
      velocityChange > 10 ? 'up' : velocityChange < -10 ? 'down' : 'stable';

    // Calculate health score (0-100)
    const healthFactors = {
      velocity: Math.min(velocityScore * 20, 30), // Up to 30 points
      closure_rate: totals.issues_opened > 0
        ? Math.min((totals.issues_closed / totals.issues_opened) * 30, 30)
        : 30, // Up to 30 points
      pr_throughput: totals.prs_opened > 0
        ? Math.min((totals.prs_merged / totals.prs_opened) * 20, 20)
        : 20, // Up to 20 points
      activity: Math.min(weekReports.length * 3, 20) // Up to 20 points for daily activity
    };
    const healthScore = Object.values(healthFactors).reduce((a, b) => a + b, 0);

    // Get contributor stats
    const contributorStats = await this.github.getContributorStats(repo);
    const topContributors = contributorStats
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map(c => ({
        username: c.author?.login || 'unknown',
        contributions: c.total
      }));

    // Generate recommendations
    const recommendations: string[] = [];
    if (velocityTrend === 'down') {
      recommendations.push('Velocity decreased this week - consider reviewing blockers');
    }
    if (totals.issues_opened > totals.issues_closed * 1.5) {
      recommendations.push('Issue backlog growing - prioritize closing existing issues');
    }
    if (healthScore < 50) {
      recommendations.push('Project health is below average - review contribution patterns');
    }

    // Save to database
    await this.dataStore.saveWeeklyReport({
      project_id: project.id,
      week_start: start,
      week_end: end,
      issues_opened: totals.issues_opened,
      issues_closed: totals.issues_closed,
      prs_opened: totals.prs_opened,
      prs_merged: totals.prs_merged,
      velocity_score: velocityScore,
      health_score: healthScore,
      summary: this.generateWeeklySummary(totals, velocityTrend),
      trends: { velocity: velocityTrend, change: velocityChange },
      recommendations,
      raw_data: { health_factors: healthFactors }
    });

    return {
      weekStart: start,
      weekEnd: end,
      dailyReports: weekReports,
      totals,
      velocity: {
        score: velocityScore,
        trend: velocityTrend,
        change: velocityChange
      },
      health: {
        score: healthScore,
        factors: healthFactors
      },
      topContributors,
      recommendations
    };
  }

  /**
   * Get velocity metrics for a time period
   */
  async getVelocityMetrics(repo: string, period: 'day' | 'week' | 'month'): Promise<{
    period: string;
    issues_closed: number;
    prs_merged: number;
    velocity_score: number;
    daily_average: number;
  }> {
    const project = await this.dataStore.getProject(repo);
    if (!project) {
      throw new Error(`Project not found: ${repo}`);
    }

    const days = period === 'day' ? 1 : period === 'week' ? 7 : 30;
    const reports = await this.dataStore.getRecentDailyReports(project.id, days);

    const totals = reports.reduce((acc, r) => ({
      issues_closed: acc.issues_closed + r.issues_closed,
      prs_merged: acc.prs_merged + r.prs_merged
    }), { issues_closed: 0, prs_merged: 0 });

    const velocityScore = totals.issues_closed + totals.prs_merged;
    const dailyAverage = velocityScore / days;

    return {
      period,
      issues_closed: totals.issues_closed,
      prs_merged: totals.prs_merged,
      velocity_score: velocityScore,
      daily_average: Math.round(dailyAverage * 100) / 100
    };
  }

  private generateDailySummary(opened: number, closed: number, merged: number): string {
    const parts: string[] = [];
    if (closed > 0) parts.push(`${closed} issue(s) closed`);
    if (merged > 0) parts.push(`${merged} PR(s) merged`);
    if (opened > 0) parts.push(`${opened} new issue(s)`);
    return parts.length > 0 ? parts.join(', ') : 'No significant activity';
  }

  private generateWeeklySummary(
    totals: { issues_opened: number; issues_closed: number; prs_opened: number; prs_merged: number },
    trend: 'up' | 'down' | 'stable'
  ): string {
    const trendEmoji = trend === 'up' ? 'improving' : trend === 'down' ? 'declining' : 'stable';
    return `Week summary: ${totals.issues_closed} issues closed, ${totals.prs_merged} PRs merged. Velocity is ${trendEmoji}.`;
  }
}
