/**
 * ShellyDataStore Tests
 *
 * Tests for the PostgreSQL and Redis data store.
 */

import { ShellyDataStore } from '../../src/data/store';
import { mockPool, mockRedisClient } from '../setup';

describe('ShellyDataStore', () => {
  let store: ShellyDataStore;

  const testConfig = {
    db: {
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      user: 'test_user',
      password: 'test_pass'
    },
    redis: {
      url: 'redis://localhost:6379'
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    store = new ShellyDataStore();
    await store.connect(testConfig);
  });

  afterEach(async () => {
    await store.close();
  });

  describe('connect', () => {
    it('should connect to PostgreSQL and Redis', async () => {
      expect(mockRedisClient.connect).toHaveBeenCalled();
    });
  });

  describe('query', () => {
    it('should execute SQL queries', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await store.query('SELECT * FROM test WHERE id = $1', [1]);

      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM test WHERE id = $1', [1]);
      expect(result.rows).toHaveLength(1);
    });
  });

  describe('cache', () => {
    it('should cache values in Redis', async () => {
      await store.cache('test-key', 'test-value', 3600);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith('test-key', 3600, 'test-value');
    });
  });

  describe('getCached', () => {
    it('should retrieve cached values', async () => {
      mockRedisClient.get.mockResolvedValueOnce('cached-value');

      const value = await store.getCached('test-key');

      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
      expect(value).toBe('cached-value');
    });

    it('should return null for missing keys', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const value = await store.getCached('nonexistent');

      expect(value).toBeNull();
    });
  });

  describe('close', () => {
    it('should close both connections', async () => {
      await store.close();

      expect(mockPool.end).toHaveBeenCalled();
      expect(mockRedisClient.quit).toHaveBeenCalled();
    });
  });

  describe('Projects', () => {
    describe('createProject', () => {
      it('should create a new project', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{
            id: 1,
            github_repo: 'owner/repo',
            owner: 'owner',
            name: 'repo',
            description: 'Test project'
          }]
        });

        const project = await store.createProject('owner/repo', 'Test project');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO projects'),
          ['owner/repo', 'owner', 'repo', 'Test project']
        );
        expect(project.id).toBe(1);
      });
    });

    describe('getProject', () => {
      it('should get project by repo name', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{
            id: 1,
            github_repo: 'owner/repo',
            is_active: true
          }]
        });

        const project = await store.getProject('owner/repo');

        expect(mockPool.query).toHaveBeenCalledWith(
          'SELECT * FROM projects WHERE github_repo = $1',
          ['owner/repo']
        );
        expect(project?.id).toBe(1);
      });

      it('should return null if project not found', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        const project = await store.getProject('nonexistent/repo');

        expect(project).toBeNull();
      });
    });

    describe('getProjectById', () => {
      it('should get project by ID', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{ id: 1, github_repo: 'owner/repo' }]
        });

        const project = await store.getProjectById(1);

        expect(mockPool.query).toHaveBeenCalledWith(
          'SELECT * FROM projects WHERE id = $1',
          [1]
        );
        expect(project?.github_repo).toBe('owner/repo');
      });
    });

    describe('listActiveProjects', () => {
      it('should list all active projects', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'repo1', is_active: true },
            { id: 2, name: 'repo2', is_active: true }
          ]
        });

        const projects = await store.listActiveProjects();

        expect(mockPool.query).toHaveBeenCalledWith(
          'SELECT * FROM projects WHERE is_active = true ORDER BY name',
          []
        );
        expect(projects).toHaveLength(2);
      });
    });

    describe('updateProjectSettings', () => {
      it('should merge new settings', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        await store.updateProjectSettings('owner/repo', { notifications: true });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE projects SET settings = settings ||'),
          [JSON.stringify({ notifications: true }), 'owner/repo']
        );
      });
    });
  });

  describe('Issue Snapshots', () => {
    describe('saveIssueSnapshot', () => {
      it('should save an issue snapshot', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        await store.saveIssueSnapshot(1, {
          github_issue_number: 42,
          title: 'Test Issue',
          state: 'open',
          labels: ['bug'],
          assignees: ['john'],
          author: 'jane',
          created_at: new Date(),
          updated_at: new Date()
        });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO issue_snapshots'),
          expect.arrayContaining([1, 42, 'Test Issue', 'open'])
        );
      });
    });

    describe('getLatestIssueSnapshot', () => {
      it('should get the latest snapshot for an issue', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{
            id: 1,
            github_issue_number: 42,
            title: 'Test Issue'
          }]
        });

        const snapshot = await store.getLatestIssueSnapshot(1, 42);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY snapshot_at DESC LIMIT 1'),
          [1, 42]
        );
        expect(snapshot?.github_issue_number).toBe(42);
      });
    });

    describe('getOpenIssues', () => {
      it('should return only open issues', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [
            { github_issue_number: 1, state: 'open' },
            { github_issue_number: 2, state: 'closed' },
            { github_issue_number: 3, state: 'open' }
          ]
        });

        const issues = await store.getOpenIssues(1);

        expect(issues).toHaveLength(2);
        expect(issues.every(i => i.state === 'open')).toBe(true);
      });
    });
  });

  describe('PR Snapshots', () => {
    describe('savePRSnapshot', () => {
      it('should save a PR snapshot', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        await store.savePRSnapshot(1, {
          github_pr_number: 42,
          title: 'Test PR',
          state: 'open',
          base_branch: 'main',
          head_branch: 'feature',
          author: 'jane',
          reviewers: ['john'],
          additions: 100,
          deletions: 50,
          changed_files: 5,
          created_at: new Date(),
          updated_at: new Date()
        });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO pr_snapshots'),
          expect.arrayContaining([1, 42, 'Test PR', 'open'])
        );
      });
    });

    describe('getOpenPRs', () => {
      it('should return only open PRs', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [
            { github_pr_number: 1, state: 'open' },
            { github_pr_number: 2, state: 'merged' },
            { github_pr_number: 3, state: 'open' }
          ]
        });

        const prs = await store.getOpenPRs(1);

        expect(prs).toHaveLength(2);
        expect(prs.every(p => p.state === 'open')).toBe(true);
      });
    });

    describe('getStalePRs', () => {
      it('should return PRs not updated in specified days', async () => {
        const staleDate = new Date();
        staleDate.setDate(staleDate.getDate() - 5);

        mockPool.query.mockResolvedValueOnce({
          rows: [
            { github_pr_number: 1, state: 'open', updated_at: staleDate },
            { github_pr_number: 2, state: 'open', updated_at: new Date() }
          ]
        });

        const prs = await store.getStalePRs(1, 3);

        expect(prs).toHaveLength(1);
        expect(prs[0].github_pr_number).toBe(1);
      });
    });
  });

  describe('Reports', () => {
    describe('saveDailyReport', () => {
      it('should save or update a daily report', async () => {
        const reportDate = new Date();
        mockPool.query.mockResolvedValueOnce({
          rows: [{
            id: 1,
            project_id: 1,
            report_date: reportDate,
            issues_opened: 5
          }]
        });

        const report = await store.saveDailyReport({
          project_id: 1,
          report_date: reportDate,
          issues_opened: 5,
          issues_closed: 3,
          prs_opened: 2,
          prs_merged: 1,
          prs_closed: 0,
          commits_count: 10,
          active_contributors: 3,
          highlights: ['Feature completed'],
          blockers: [],
          raw_data: {}
        });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO daily_reports'),
          expect.any(Array)
        );
        expect(report.issues_opened).toBe(5);
      });
    });

    describe('getDailyReport', () => {
      it('should get a daily report for a specific date', async () => {
        const reportDate = new Date('2024-01-15');
        mockPool.query.mockResolvedValueOnce({
          rows: [{ id: 1, report_date: reportDate }]
        });

        const report = await store.getDailyReport(1, reportDate);

        expect(mockPool.query).toHaveBeenCalledWith(
          'SELECT * FROM daily_reports WHERE project_id = $1 AND report_date = $2',
          [1, reportDate]
        );
        expect(report).toBeDefined();
      });
    });

    describe('getRecentDailyReports', () => {
      it('should get recent daily reports', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [
            { id: 1, report_date: new Date() },
            { id: 2, report_date: new Date() }
          ]
        });

        const reports = await store.getRecentDailyReports(1, 7);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY report_date DESC'),
          [1, 7]
        );
        expect(reports).toHaveLength(2);
      });
    });

    describe('saveWeeklyReport', () => {
      it('should save or update a weekly report', async () => {
        const weekStart = new Date('2024-01-15');
        const weekEnd = new Date('2024-01-21');

        mockPool.query.mockResolvedValueOnce({
          rows: [{
            id: 1,
            week_start: weekStart,
            velocity_score: 85
          }]
        });

        const report = await store.saveWeeklyReport({
          project_id: 1,
          week_start: weekStart,
          week_end: weekEnd,
          issues_opened: 15,
          issues_closed: 12,
          prs_opened: 8,
          prs_merged: 6,
          velocity_score: 85,
          health_score: 90,
          trends: { velocity: 'up' },
          recommendations: ['Keep up the pace'],
          raw_data: {}
        });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO weekly_reports'),
          expect.any(Array)
        );
        expect(report.velocity_score).toBe(85);
      });
    });
  });

  describe('Activity Logging', () => {
    describe('logActivity', () => {
      it('should log an activity', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        await store.logActivity(1, 'issue_created', '#42', { title: 'New Issue' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO activity_log'),
          [1, 'issue_created', '#42', JSON.stringify({ title: 'New Issue' })]
        );
      });

      it('should allow null project_id for global activities', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        await store.logActivity(null, 'system_started', 'shelly');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO activity_log'),
          [null, 'system_started', 'shelly', '{}']
        );
      });
    });

    describe('getRecentActivity', () => {
      it('should get recent activities for a project', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [
            { id: 1, action_type: 'issue_created', action_target: '#1' },
            { id: 2, action_type: 'pr_merged', action_target: '#5' }
          ]
        });

        const activities = await store.getRecentActivity(1, 50);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY created_at DESC'),
          [1, 50]
        );
        expect(activities).toHaveLength(2);
      });
    });
  });
});
