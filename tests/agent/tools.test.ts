/**
 * Tool Handlers Tests
 *
 * Tests for the GitHub tool handler implementations.
 */

import { tools, createToolHandlers } from '../../src/agent/tools';
import { GitHubClient } from '../../src/github/client';
import { ShellyDataStore } from '../../src/data/store';
import { ReportingService } from '../../src/skills/reporting';
import { NotificationService } from '../../src/channels/notifications';

// Create mock instances
const mockGitHubClient = {
  listIssues: jest.fn(),
  getIssue: jest.fn(),
  createIssue: jest.fn(),
  updateIssue: jest.fn(),
  addComment: jest.fn(),
  addLabels: jest.fn(),
  listLabels: jest.fn(),
  listPullRequests: jest.fn(),
  getPullRequest: jest.fn(),
  listReviews: jest.fn(),
  requestReviewers: jest.fn(),
  listCommits: jest.fn(),
  listPRCommits: jest.fn(),
  searchIssues: jest.fn(),
  searchCode: jest.fn(),
  getFileContents: jest.fn(),
  listMilestones: jest.fn(),
  getMilestone: jest.fn(),
  getRepository: jest.fn(),
  getContributorStats: jest.fn()
} as unknown as GitHubClient;

const mockDataStore = {
  getProject: jest.fn(),
  logActivity: jest.fn(),
  getRecentActivity: jest.fn(),
  getRecentDailyReports: jest.fn()
} as unknown as ShellyDataStore;

const mockReportingService = {
  generateDailyReport: jest.fn(),
  generateWeeklyReport: jest.fn(),
  getVelocityMetrics: jest.fn()
} as unknown as ReportingService;

const mockNotificationService = {
  send: jest.fn(),
  getChannel: jest.fn().mockReturnValue(null)
} as unknown as NotificationService;

describe('tools', () => {
  it('should export 25 tools', () => {
    expect(tools).toHaveLength(25);
  });

  it('should have list_issues tool', () => {
    const tool = tools.find(t => t.name === 'list_issues');
    expect(tool).toBeDefined();
    expect(tool?.input_schema.required).toContain('repo');
  });

  it('should have list_labels tool', () => {
    const tool = tools.find(t => t.name === 'list_labels');
    expect(tool).toBeDefined();
  });

  it('should have add_labels tool', () => {
    const tool = tools.find(t => t.name === 'add_labels');
    expect(tool).toBeDefined();
    expect(tool?.input_schema.required).toContain('labels');
  });

  it('should have list_commits tool', () => {
    const tool = tools.find(t => t.name === 'list_commits');
    expect(tool).toBeDefined();
  });

  it('should have search_code tool', () => {
    const tool = tools.find(t => t.name === 'search_code');
    expect(tool).toBeDefined();
    expect(tool?.input_schema.required).toContain('query');
  });

  it('should have get_file_contents tool', () => {
    const tool = tools.find(t => t.name === 'get_file_contents');
    expect(tool).toBeDefined();
    expect(tool?.input_schema.required).toContain('path');
  });

  it('should have get_milestone_progress tool', () => {
    const tool = tools.find(t => t.name === 'get_milestone_progress');
    expect(tool).toBeDefined();
  });

  it('should have get_contributor_stats tool', () => {
    const tool = tools.find(t => t.name === 'get_contributor_stats');
    expect(tool).toBeDefined();
  });

  it('should have generate_daily_report tool', () => {
    const tool = tools.find(t => t.name === 'generate_daily_report');
    expect(tool).toBeDefined();
  });

  it('should have generate_weekly_report tool', () => {
    const tool = tools.find(t => t.name === 'generate_weekly_report');
    expect(tool).toBeDefined();
  });

  it('should have get_velocity_metrics tool', () => {
    const tool = tools.find(t => t.name === 'get_velocity_metrics');
    expect(tool).toBeDefined();
    expect(tool?.input_schema.required).toContain('period');
  });

  it('should have send_notification tool', () => {
    const tool = tools.find(t => t.name === 'send_notification');
    expect(tool).toBeDefined();
    expect(tool?.input_schema.properties?.channel).toBeDefined();
  });

  it('should have log_activity tool', () => {
    const tool = tools.find(t => t.name === 'log_activity');
    expect(tool).toBeDefined();
  });

  it('should have get_recent_activity tool', () => {
    const tool = tools.find(t => t.name === 'get_recent_activity');
    expect(tool).toBeDefined();
  });
});

describe('createToolHandlers', () => {
  let handlers: ReturnType<typeof createToolHandlers>;

  beforeEach(() => {
    handlers = createToolHandlers(mockGitHubClient, mockDataStore, {
      reporting: mockReportingService,
      notifications: mockNotificationService
    });
    jest.clearAllMocks();
  });

  describe('list_issues', () => {
    it('should list issues and format results', async () => {
      (mockGitHubClient.listIssues as jest.Mock).mockResolvedValue([
        {
          number: 1,
          title: 'Bug report',
          state: 'open',
          labels: [{ name: 'bug' }],
          assignees: [{ login: 'john' }],
          created_at: '2024-01-01T00:00:00Z',
          html_url: 'https://github.com/owner/repo/issues/1'
        }
      ]);

      const result = await handlers.list_issues({ repo: 'owner/repo' });

      expect(mockGitHubClient.listIssues).toHaveBeenCalledWith('owner/repo', expect.any(Object));
      expect(result).toHaveLength(1);
      expect((result as any[])[0].labels).toContain('bug');
    });
  });

  describe('list_labels', () => {
    it('should list repository labels', async () => {
      (mockGitHubClient.listLabels as jest.Mock).mockResolvedValue([
        { name: 'bug', color: 'ff0000', description: 'Bug report' },
        { name: 'feature', color: '00ff00', description: 'New feature' }
      ]);

      const result = await handlers.list_labels({ repo: 'owner/repo' });

      expect(mockGitHubClient.listLabels).toHaveBeenCalledWith('owner/repo');
      expect(result).toHaveLength(2);
    });
  });

  describe('add_labels', () => {
    it('should add labels to an issue', async () => {
      (mockGitHubClient.addLabels as jest.Mock).mockResolvedValue(undefined);

      const result = await handlers.add_labels({
        repo: 'owner/repo',
        issue_number: 42,
        labels: ['bug', 'critical']
      });

      expect(mockGitHubClient.addLabels).toHaveBeenCalledWith('owner/repo', 42, ['bug', 'critical']);
      expect(result).toEqual({ success: true, labels: ['bug', 'critical'] });
    });
  });

  describe('list_commits', () => {
    it('should list repository commits', async () => {
      (mockGitHubClient.listCommits as jest.Mock).mockResolvedValue([
        {
          sha: 'abc1234567890',
          commit: { message: 'Fix bug\n\nDetails', author: { name: 'John', date: '2024-01-01' } },
          author: { login: 'john' }
        }
      ]);

      const result = await handlers.list_commits({ repo: 'owner/repo' });

      expect(mockGitHubClient.listCommits).toHaveBeenCalledWith('owner/repo', expect.any(Object));
      expect((result as any[])[0].sha).toBe('abc1234');
      expect((result as any[])[0].message).toBe('Fix bug');
    });

    it('should list PR commits when pr_number provided', async () => {
      (mockGitHubClient.listPRCommits as jest.Mock).mockResolvedValue([
        {
          sha: 'def7890123456',
          commit: { message: 'PR commit', author: { name: 'Jane', date: '2024-01-02' } },
          author: { login: 'jane' }
        }
      ]);

      const result = await handlers.list_commits({ repo: 'owner/repo', pr_number: 42 });

      expect(mockGitHubClient.listPRCommits).toHaveBeenCalledWith('owner/repo', 42);
      expect((result as any[])[0].author).toBe('jane');
    });
  });

  describe('search_code', () => {
    it('should search for code', async () => {
      (mockGitHubClient.searchCode as jest.Mock).mockResolvedValue([
        { path: 'src/index.ts', repository: { full_name: 'owner/repo' }, html_url: 'url' }
      ]);

      const result = await handlers.search_code({ query: 'function', repo: 'owner/repo' });

      expect(mockGitHubClient.searchCode).toHaveBeenCalledWith('function', expect.objectContaining({ repo: 'owner/repo' }));
      expect((result as any[])[0].path).toBe('src/index.ts');
    });
  });

  describe('get_file_contents', () => {
    it('should get file contents', async () => {
      (mockGitHubClient.getFileContents as jest.Mock).mockResolvedValue({
        name: 'README.md',
        path: 'README.md',
        content: '# Hello World',
        sha: 'abc123',
        size: 13
      });

      const result = await handlers.get_file_contents({ repo: 'owner/repo', path: 'README.md' });

      expect(mockGitHubClient.getFileContents).toHaveBeenCalledWith('owner/repo', 'README.md', undefined);
      expect((result as any).content).toBe('# Hello World');
    });

    it('should truncate large files', async () => {
      const largeContent = 'x'.repeat(15000);
      (mockGitHubClient.getFileContents as jest.Mock).mockResolvedValue({
        name: 'large.txt',
        path: 'large.txt',
        content: largeContent,
        sha: 'abc123',
        size: 15000
      });

      const result = await handlers.get_file_contents({ repo: 'owner/repo', path: 'large.txt' });

      expect((result as any).content).toContain('... (truncated)');
      expect((result as any).content.length).toBeLessThan(largeContent.length);
    });
  });

  describe('get_milestone_progress', () => {
    it('should get milestone progress', async () => {
      (mockGitHubClient.getMilestone as jest.Mock).mockResolvedValue({
        number: 1,
        title: 'v1.0',
        description: 'First release',
        state: 'open',
        due_on: null,
        open_issues: 5,
        closed_issues: 15
      });

      const result = await handlers.get_milestone_progress({ repo: 'owner/repo', milestone_number: 1 });

      expect((result as any).progress).toBe(75);
      expect((result as any).total_issues).toBe(20);
    });
  });

  describe('get_contributor_stats', () => {
    it('should get contributor stats', async () => {
      (mockGitHubClient.getContributorStats as jest.Mock).mockResolvedValue([
        { author: { login: 'john' }, total: 100, weeks: [{ c: 5 }, { c: 3 }, { c: 2 }, { c: 1 }] },
        { author: { login: 'jane' }, total: 50, weeks: [{ c: 2 }, { c: 1 }, { c: 1 }, { c: 0 }] }
      ]);

      const result = await handlers.get_contributor_stats({ repo: 'owner/repo' });

      expect((result as any[])[0].username).toBe('john');
      expect((result as any[])[0].total_commits).toBe(100);
      expect((result as any[])[0].recent_commits).toBe(11);
    });
  });

  describe('generate_daily_report', () => {
    it('should generate daily report', async () => {
      (mockReportingService.generateDailyReport as jest.Mock).mockResolvedValue({
        date: new Date('2024-01-15'),
        issues: { opened: [{ number: 1 }], closed: [], total_open: 10 },
        pullRequests: { opened: [], merged: [{ number: 5 }], closed: [], total_open: 3 },
        commits: 5,
        contributors: ['john', 'jane'],
        highlights: ['1 PR merged'],
        blockers: []
      });

      const result = await handlers.generate_daily_report({ repo: 'owner/repo' });

      expect((result as any).summary.issues_opened).toBe(1);
      expect((result as any).summary.prs_merged).toBe(1);
      expect((result as any).contributors).toContain('john');
    });
  });

  describe('generate_weekly_report', () => {
    it('should generate weekly report', async () => {
      (mockReportingService.generateWeeklyReport as jest.Mock).mockResolvedValue({
        weekStart: new Date('2024-01-15'),
        weekEnd: new Date('2024-01-21'),
        dailyReports: [],
        totals: { issues_opened: 10, issues_closed: 8, prs_opened: 5, prs_merged: 4 },
        velocity: { score: 1.7, trend: 'up', change: 15 },
        health: { score: 75, factors: {} },
        topContributors: [{ username: 'john', contributions: 50 }],
        recommendations: []
      });

      const result = await handlers.generate_weekly_report({ repo: 'owner/repo' });

      expect((result as any).velocity.trend).toBe('up');
      expect((result as any).health.rating).toBe('good');
    });
  });

  describe('get_velocity_metrics', () => {
    it('should get velocity metrics', async () => {
      (mockReportingService.getVelocityMetrics as jest.Mock).mockResolvedValue({
        period: 'week',
        issues_closed: 12,
        prs_merged: 8,
        velocity_score: 20,
        daily_average: 2.86
      });

      const result = await handlers.get_velocity_metrics({ repo: 'owner/repo', period: 'week' });

      expect((result as any).velocity_score).toBe(20);
      expect((result as any).daily_average).toBe(2.86);
    });
  });

  describe('send_notification', () => {
    it('should send notification', async () => {
      (mockNotificationService.send as jest.Mock).mockResolvedValue({
        success: true,
        channel: 'email',
        recipient: 'test@example.com',
        messageId: 'msg-123'
      });

      const result = await handlers.send_notification({
        channel: 'email',
        recipient: 'test@example.com',
        subject: 'Update',
        body: 'Project status update'
      });

      expect(mockNotificationService.send).toHaveBeenCalledWith(
        'email',
        'test@example.com',
        expect.objectContaining({ body: 'Project status update' })
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe('log_activity', () => {
    it('should log activity', async () => {
      (mockDataStore.getProject as jest.Mock).mockResolvedValue({ id: 1 });
      (mockDataStore.logActivity as jest.Mock).mockResolvedValue(undefined);

      const result = await handlers.log_activity({
        repo: 'owner/repo',
        action: 'issue_triaged',
        target: 'issue #42',
        details: { priority: 'high' }
      });

      expect(mockDataStore.logActivity).toHaveBeenCalledWith(1, 'issue_triaged', 'issue #42', { priority: 'high' });
      expect((result as any).success).toBe(true);
    });

    it('should fail if project not found', async () => {
      (mockDataStore.getProject as jest.Mock).mockResolvedValue(null);

      const result = await handlers.log_activity({
        repo: 'nonexistent/repo',
        action: 'test',
        target: 'test'
      });

      expect((result as any).success).toBe(false);
      expect((result as any).error).toContain('not found');
    });
  });

  describe('get_recent_activity', () => {
    it('should get recent activity', async () => {
      (mockDataStore.getProject as jest.Mock).mockResolvedValue({ id: 1 });
      (mockDataStore.getRecentActivity as jest.Mock).mockResolvedValue([
        { action_type: 'issue_created', action_target: '#1', action_details: {}, created_at: new Date() }
      ]);

      const result = await handlers.get_recent_activity({ repo: 'owner/repo' });

      expect((result as any[])[0].action).toBe('issue_created');
    });
  });

  // Original tests for existing handlers
  describe('list_milestones', () => {
    it('should list milestones with progress', async () => {
      (mockGitHubClient.listMilestones as jest.Mock).mockResolvedValue([
        {
          number: 1,
          title: 'v1.0',
          state: 'open',
          due_on: '2024-03-01T00:00:00Z',
          open_issues: 5,
          closed_issues: 15
        }
      ]);

      const result = await handlers.list_milestones({ repo: 'owner/repo' });

      expect((result as any[])[0].progress).toBe(75);
    });
  });

  describe('get_repository_info', () => {
    it('should get repository info', async () => {
      (mockGitHubClient.getRepository as jest.Mock).mockResolvedValue({
        full_name: 'owner/repo',
        description: 'A test repository',
        default_branch: 'main',
        open_issues_count: 15,
        language: 'TypeScript',
        topics: ['testing']
      });

      const result = await handlers.get_repository_info({ repo: 'owner/repo' });

      expect((result as any).language).toBe('TypeScript');
    });
  });
});
