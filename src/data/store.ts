/**
 * Shelly Data Store
 *
 * Database operations for projects, reports, and GitHub data caching.
 * Uses PostgreSQL and Redis directly (not multi-tenant like machina).
 */

import { Pool, QueryResult, QueryResultRow } from 'pg';
import { createClient, RedisClientType } from 'redis';
import { loggers } from 'the-machina';

export interface DataConfig {
  db: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  redis: {
    url: string;
  };
}

export interface Project {
  id: number;
  github_repo: string;
  owner: string;
  name: string;
  description?: string;
  default_branch: string;
  is_active: boolean;
  settings: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface IssueSnapshot {
  id: number;
  project_id: number;
  github_issue_number: number;
  title: string;
  state: 'open' | 'closed';
  labels: string[];
  assignees: string[];
  milestone?: string;
  author: string;
  created_at: Date;
  updated_at: Date;
  closed_at?: Date;
  snapshot_at: Date;
}

export interface PRSnapshot {
  id: number;
  project_id: number;
  github_pr_number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  base_branch: string;
  head_branch: string;
  author: string;
  reviewers: string[];
  review_state?: string;
  additions: number;
  deletions: number;
  changed_files: number;
  created_at: Date;
  updated_at: Date;
  merged_at?: Date;
  closed_at?: Date;
  snapshot_at: Date;
}

export interface DailyReport {
  id: number;
  project_id: number;
  report_date: Date;
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
  raw_data: Record<string, unknown>;
  created_at: Date;
}

export interface WeeklyReport {
  id: number;
  project_id: number;
  week_start: Date;
  week_end: Date;
  issues_opened: number;
  issues_closed: number;
  prs_opened: number;
  prs_merged: number;
  velocity_score?: number;
  health_score?: number;
  summary?: string;
  trends: Record<string, unknown>;
  recommendations: string[];
  raw_data: Record<string, unknown>;
  created_at: Date;
}

export interface SagaOversightRecord {
  id: number;
  saga_id: string;
  status: string;
  started_at: Date;
  completed_at?: Date;
  decisions_made: Array<{ decision: string; reasoning: string; timestamp: string }>;
  summary?: string;
  total_dimensions: number;
  completed_dimensions: number;
  collapsed_dimensions: number;
  duration_ms?: number;
  created_at: Date;
  updated_at: Date;
}

export class ShellyDataStore {
  private pool!: Pool;
  private redis!: RedisClientType;

  async connect(config: DataConfig): Promise<void> {
    // PostgreSQL connection
    this.pool = new Pool({
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
    });

    // Redis connection
    this.redis = createClient({
      url: config.redis.url,
      socket: {
        reconnectStrategy: (retries: number) => {
          if (retries > 20) {
            loggers.data.error('Redis max reconnect attempts reached');
            return new Error('Redis max reconnect attempts reached');
          }
          return Math.min(retries * 500, 30000);
        },
      },
    });

    this.redis.on('error', (err) => {
      loggers.data.error('Redis client error', { error: err.message });
    });

    await this.redis.connect();
    loggers.data.info('ShellyDataStore connected');
  }

  async query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, params);
  }

  async cache(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.redis.setEx(key, ttlSeconds, value);
  }

  async getCached(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async close(): Promise<void> {
    await this.pool.end();
    await this.redis.quit();
    loggers.data.info('ShellyDataStore connections closed');
  }

  // ==================== Projects ====================

  async createProject(repo: string, description?: string): Promise<Project> {
    const [owner, name] = repo.split('/');
    const result = await this.query<Project>(
      `INSERT INTO projects (github_repo, owner, name, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [repo, owner, name, description]
    );
    return result.rows[0];
  }

  async getProject(repo: string): Promise<Project | null> {
    const result = await this.query<Project>(
      'SELECT * FROM projects WHERE github_repo = $1',
      [repo]
    );
    return result.rows[0] || null;
  }

  async getProjectById(id: number): Promise<Project | null> {
    const result = await this.query<Project>(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async listActiveProjects(): Promise<Project[]> {
    const result = await this.query<Project>(
      'SELECT * FROM projects WHERE is_active = true ORDER BY name'
    );
    return result.rows;
  }

  async updateProjectSettings(repo: string, settings: Record<string, unknown>): Promise<void> {
    await this.query(
      `UPDATE projects SET settings = settings || $1 WHERE github_repo = $2`,
      [JSON.stringify(settings), repo]
    );
  }

  // ==================== Issue Snapshots ====================

  async saveIssueSnapshot(projectId: number, issue: Omit<IssueSnapshot, 'id' | 'project_id' | 'snapshot_at'>): Promise<void> {
    await this.query(
      `INSERT INTO issue_snapshots
       (project_id, github_issue_number, title, state, labels, assignees, milestone, author, created_at, updated_at, closed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        projectId,
        issue.github_issue_number,
        issue.title,
        issue.state,
        JSON.stringify(issue.labels),
        JSON.stringify(issue.assignees),
        issue.milestone,
        issue.author,
        issue.created_at,
        issue.updated_at,
        issue.closed_at
      ]
    );
  }

  async getLatestIssueSnapshot(projectId: number, issueNumber: number): Promise<IssueSnapshot | null> {
    const result = await this.query<IssueSnapshot>(
      `SELECT * FROM issue_snapshots
       WHERE project_id = $1 AND github_issue_number = $2
       ORDER BY snapshot_at DESC LIMIT 1`,
      [projectId, issueNumber]
    );
    return result.rows[0] || null;
  }

  async getOpenIssues(projectId: number): Promise<IssueSnapshot[]> {
    const result = await this.query<IssueSnapshot>(
      `SELECT DISTINCT ON (github_issue_number) *
       FROM issue_snapshots
       WHERE project_id = $1
       ORDER BY github_issue_number, snapshot_at DESC`,
      [projectId]
    );
    return result.rows.filter((i: IssueSnapshot) => i.state === 'open');
  }

  // ==================== PR Snapshots ====================

  async savePRSnapshot(projectId: number, pr: Omit<PRSnapshot, 'id' | 'project_id' | 'snapshot_at'>): Promise<void> {
    await this.query(
      `INSERT INTO pr_snapshots
       (project_id, github_pr_number, title, state, base_branch, head_branch, author, reviewers, review_state, additions, deletions, changed_files, created_at, updated_at, merged_at, closed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        projectId,
        pr.github_pr_number,
        pr.title,
        pr.state,
        pr.base_branch,
        pr.head_branch,
        pr.author,
        JSON.stringify(pr.reviewers),
        pr.review_state,
        pr.additions,
        pr.deletions,
        pr.changed_files,
        pr.created_at,
        pr.updated_at,
        pr.merged_at,
        pr.closed_at
      ]
    );
  }

  async getOpenPRs(projectId: number): Promise<PRSnapshot[]> {
    const result = await this.query<PRSnapshot>(
      `SELECT DISTINCT ON (github_pr_number) *
       FROM pr_snapshots
       WHERE project_id = $1
       ORDER BY github_pr_number, snapshot_at DESC`,
      [projectId]
    );
    return result.rows.filter((pr: PRSnapshot) => pr.state === 'open');
  }

  async getStalePRs(projectId: number, daysStale: number = 3): Promise<PRSnapshot[]> {
    const result = await this.query<PRSnapshot>(
      `SELECT DISTINCT ON (github_pr_number) *
       FROM pr_snapshots
       WHERE project_id = $1
       ORDER BY github_pr_number, snapshot_at DESC`,
      [projectId]
    );

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysStale);

    return result.rows.filter((pr: PRSnapshot) =>
      pr.state === 'open' && new Date(pr.updated_at) < cutoff
    );
  }

  // ==================== Reports ====================

  async saveDailyReport(report: Omit<DailyReport, 'id' | 'created_at'>): Promise<DailyReport> {
    const result = await this.query<DailyReport>(
      `INSERT INTO daily_reports
       (project_id, report_date, issues_opened, issues_closed, prs_opened, prs_merged, prs_closed, commits_count, active_contributors, summary, highlights, blockers, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (project_id, report_date) DO UPDATE SET
         issues_opened = EXCLUDED.issues_opened,
         issues_closed = EXCLUDED.issues_closed,
         prs_opened = EXCLUDED.prs_opened,
         prs_merged = EXCLUDED.prs_merged,
         prs_closed = EXCLUDED.prs_closed,
         commits_count = EXCLUDED.commits_count,
         active_contributors = EXCLUDED.active_contributors,
         summary = EXCLUDED.summary,
         highlights = EXCLUDED.highlights,
         blockers = EXCLUDED.blockers,
         raw_data = EXCLUDED.raw_data
       RETURNING *`,
      [
        report.project_id,
        report.report_date,
        report.issues_opened,
        report.issues_closed,
        report.prs_opened,
        report.prs_merged,
        report.prs_closed,
        report.commits_count,
        report.active_contributors,
        report.summary,
        JSON.stringify(report.highlights),
        JSON.stringify(report.blockers),
        JSON.stringify(report.raw_data)
      ]
    );
    return result.rows[0];
  }

  async getDailyReport(projectId: number, date: Date): Promise<DailyReport | null> {
    const result = await this.query<DailyReport>(
      'SELECT * FROM daily_reports WHERE project_id = $1 AND report_date = $2',
      [projectId, date]
    );
    return result.rows[0] || null;
  }

  async getRecentDailyReports(projectId: number, limit: number = 7): Promise<DailyReport[]> {
    const result = await this.query<DailyReport>(
      `SELECT * FROM daily_reports
       WHERE project_id = $1
       ORDER BY report_date DESC
       LIMIT $2`,
      [projectId, limit]
    );
    return result.rows;
  }

  async saveWeeklyReport(report: Omit<WeeklyReport, 'id' | 'created_at'>): Promise<WeeklyReport> {
    const result = await this.query<WeeklyReport>(
      `INSERT INTO weekly_reports
       (project_id, week_start, week_end, issues_opened, issues_closed, prs_opened, prs_merged, velocity_score, health_score, summary, trends, recommendations, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (project_id, week_start) DO UPDATE SET
         week_end = EXCLUDED.week_end,
         issues_opened = EXCLUDED.issues_opened,
         issues_closed = EXCLUDED.issues_closed,
         prs_opened = EXCLUDED.prs_opened,
         prs_merged = EXCLUDED.prs_merged,
         velocity_score = EXCLUDED.velocity_score,
         health_score = EXCLUDED.health_score,
         summary = EXCLUDED.summary,
         trends = EXCLUDED.trends,
         recommendations = EXCLUDED.recommendations,
         raw_data = EXCLUDED.raw_data
       RETURNING *`,
      [
        report.project_id,
        report.week_start,
        report.week_end,
        report.issues_opened,
        report.issues_closed,
        report.prs_opened,
        report.prs_merged,
        report.velocity_score,
        report.health_score,
        report.summary,
        JSON.stringify(report.trends),
        JSON.stringify(report.recommendations),
        JSON.stringify(report.raw_data)
      ]
    );
    return result.rows[0];
  }

  // ==================== Activity Logging ====================

  async logActivity(
    projectId: number | null,
    actionType: string,
    actionTarget: string,
    details: Record<string, unknown> = {}
  ): Promise<void> {
    await this.query(
      `INSERT INTO activity_log (project_id, action_type, action_target, action_details)
       VALUES ($1, $2, $3, $4)`,
      [projectId, actionType, actionTarget, JSON.stringify(details)]
    );
  }

  async getRecentActivity(projectId: number, limit: number = 50): Promise<Array<{
    id: number;
    action_type: string;
    action_target: string;
    action_details: Record<string, unknown>;
    created_at: Date;
  }>> {
    const result = await this.query(
      `SELECT * FROM activity_log
       WHERE project_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [projectId, limit]
    );
    return result.rows as Array<{
      id: number;
      action_type: string;
      action_target: string;
      action_details: Record<string, unknown>;
      created_at: Date;
    }>;
  }

  // ==================== Saga Oversight ====================

  async saveSagaOversight(record: {
    sagaId: string;
    status: string;
    decisionsMade?: Array<{ decision: string; reasoning: string; timestamp: string }>;
    summary?: string;
    totalDimensions?: number;
    completedDimensions?: number;
    collapsedDimensions?: number;
    durationMs?: number;
  }): Promise<SagaOversightRecord> {
    const isTerminal = ['complete', 'failed', 'collapsed', 'partial'].includes(record.status);

    if (isTerminal) {
      // Update the most recent running record for this saga
      const result = await this.query<SagaOversightRecord>(
        `UPDATE saga_oversight SET
           status = $2,
           decisions_made = $3,
           summary = $4,
           total_dimensions = $5,
           completed_dimensions = $6,
           collapsed_dimensions = $7,
           duration_ms = $8,
           completed_at = NOW()
         WHERE id = (
           SELECT id FROM saga_oversight
           WHERE saga_id = $1 AND status = 'running'
           ORDER BY created_at DESC LIMIT 1
         )
         RETURNING *`,
        [
          record.sagaId,
          record.status,
          JSON.stringify(record.decisionsMade ?? []),
          record.summary ?? null,
          record.totalDimensions ?? 0,
          record.completedDimensions ?? 0,
          record.collapsedDimensions ?? 0,
          record.durationMs ?? null,
        ]
      );

      // Fallback to INSERT if no running record found (e.g. direct completion)
      if (result.rows.length > 0) return result.rows[0];
    }

    // INSERT a new record (for 'running' status or fallback)
    const result = await this.query<SagaOversightRecord>(
      `INSERT INTO saga_oversight
       (saga_id, status, decisions_made, summary, total_dimensions, completed_dimensions, collapsed_dimensions, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        record.sagaId,
        record.status,
        JSON.stringify(record.decisionsMade ?? []),
        record.summary ?? null,
        record.totalDimensions ?? 0,
        record.completedDimensions ?? 0,
        record.collapsedDimensions ?? 0,
        record.durationMs ?? null,
      ]
    );
    return result.rows[0];
  }

  async getSagaOversight(sagaId: string): Promise<SagaOversightRecord | null> {
    const result = await this.query<SagaOversightRecord>(
      'SELECT * FROM saga_oversight WHERE saga_id = $1 ORDER BY created_at DESC LIMIT 1',
      [sagaId]
    );
    return result.rows[0] || null;
  }

  async listSagaOversight(limit: number = 50): Promise<SagaOversightRecord[]> {
    const result = await this.query<SagaOversightRecord>(
      `SELECT * FROM saga_oversight
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }
}
