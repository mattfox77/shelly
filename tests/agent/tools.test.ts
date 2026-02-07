/**
 * Tool Handlers Tests
 *
 * Tests for the GitHub tool handler implementations.
 */

import { tools, createToolHandlers } from '../../src/agent/tools';
import { GitHubClient } from '../../src/github/client';
import { ShellyDataStore } from '../../src/data/store';

// Create mock instances
const mockGitHubClient = {
  listIssues: jest.fn(),
  getIssue: jest.fn(),
  createIssue: jest.fn(),
  updateIssue: jest.fn(),
  addComment: jest.fn(),
  listPullRequests: jest.fn(),
  getPullRequest: jest.fn(),
  listReviews: jest.fn(),
  requestReviewers: jest.fn(),
  searchIssues: jest.fn(),
  listMilestones: jest.fn(),
  getRepository: jest.fn()
} as unknown as GitHubClient;

const mockDataStore = {
  getProject: jest.fn(),
  logActivity: jest.fn()
} as unknown as ShellyDataStore;

describe('tools', () => {
  it('should export 12 tools', () => {
    expect(tools).toHaveLength(12);
  });

  it('should have list_issues tool', () => {
    const tool = tools.find(t => t.name === 'list_issues');
    expect(tool).toBeDefined();
    expect(tool?.input_schema.required).toContain('repo');
  });

  it('should have get_issue tool', () => {
    const tool = tools.find(t => t.name === 'get_issue');
    expect(tool).toBeDefined();
    expect(tool?.input_schema.required).toContain('issue_number');
  });

  it('should have create_issue tool', () => {
    const tool = tools.find(t => t.name === 'create_issue');
    expect(tool).toBeDefined();
    expect(tool?.input_schema.required).toContain('title');
    expect(tool?.input_schema.required).toContain('body');
  });

  it('should have update_issue tool', () => {
    const tool = tools.find(t => t.name === 'update_issue');
    expect(tool).toBeDefined();
    expect(tool?.input_schema.properties?.state).toBeDefined();
  });

  it('should have add_comment tool', () => {
    const tool = tools.find(t => t.name === 'add_comment');
    expect(tool).toBeDefined();
    expect(tool?.input_schema.required).toContain('body');
  });

  it('should have list_pull_requests tool', () => {
    const tool = tools.find(t => t.name === 'list_pull_requests');
    expect(tool).toBeDefined();
  });

  it('should have get_pull_request tool', () => {
    const tool = tools.find(t => t.name === 'get_pull_request');
    expect(tool).toBeDefined();
    expect(tool?.input_schema.required).toContain('pr_number');
  });

  it('should have list_pr_reviews tool', () => {
    const tool = tools.find(t => t.name === 'list_pr_reviews');
    expect(tool).toBeDefined();
  });

  it('should have request_reviewers tool', () => {
    const tool = tools.find(t => t.name === 'request_reviewers');
    expect(tool).toBeDefined();
    expect(tool?.input_schema.required).toContain('reviewers');
  });

  it('should have search_issues tool', () => {
    const tool = tools.find(t => t.name === 'search_issues');
    expect(tool).toBeDefined();
    expect(tool?.input_schema.required).toContain('query');
  });

  it('should have list_milestones tool', () => {
    const tool = tools.find(t => t.name === 'list_milestones');
    expect(tool).toBeDefined();
  });

  it('should have get_repository_info tool', () => {
    const tool = tools.find(t => t.name === 'get_repository_info');
    expect(tool).toBeDefined();
  });
});

describe('createToolHandlers', () => {
  let handlers: ReturnType<typeof createToolHandlers>;

  beforeEach(() => {
    handlers = createToolHandlers(mockGitHubClient, mockDataStore);
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
        },
        {
          number: 2,
          title: 'Feature request',
          state: 'open',
          labels: [],
          assignees: [],
          created_at: '2024-01-02T00:00:00Z',
          html_url: 'https://github.com/owner/repo/issues/2'
        }
      ]);

      const result = await handlers.list_issues({ repo: 'owner/repo' });

      expect(mockGitHubClient.listIssues).toHaveBeenCalledWith('owner/repo', {
        state: undefined,
        labels: undefined,
        assignee: undefined,
        milestone: undefined
      });
      expect(result).toHaveLength(2);
      expect((result as any[])[0].labels).toContain('bug');
    });

    it('should pass filter options', async () => {
      (mockGitHubClient.listIssues as jest.Mock).mockResolvedValue([]);

      await handlers.list_issues({
        repo: 'owner/repo',
        state: 'closed',
        labels: 'bug,critical'
      });

      expect(mockGitHubClient.listIssues).toHaveBeenCalledWith('owner/repo', {
        state: 'closed',
        labels: 'bug,critical',
        assignee: undefined,
        milestone: undefined
      });
    });
  });

  describe('get_issue', () => {
    it('should get a single issue', async () => {
      (mockGitHubClient.getIssue as jest.Mock).mockResolvedValue({
        number: 42,
        title: 'Test Issue',
        body: 'Description'
      });

      const result = await handlers.get_issue({ repo: 'owner/repo', issue_number: 42 });

      expect(mockGitHubClient.getIssue).toHaveBeenCalledWith('owner/repo', 42);
      expect(result).toHaveProperty('number', 42);
    });
  });

  describe('create_issue', () => {
    it('should create an issue and log activity', async () => {
      (mockGitHubClient.createIssue as jest.Mock).mockResolvedValue({
        number: 123,
        html_url: 'https://github.com/owner/repo/issues/123'
      });

      (mockDataStore.getProject as jest.Mock).mockResolvedValue({
        id: 1,
        github_repo: 'owner/repo'
      });

      const result = await handlers.create_issue({
        repo: 'owner/repo',
        title: 'New Issue',
        body: 'Description',
        labels: ['enhancement']
      });

      expect(mockGitHubClient.createIssue).toHaveBeenCalledWith(
        'owner/repo',
        'New Issue',
        'Description',
        { labels: ['enhancement'], assignees: undefined }
      );
      expect(mockDataStore.logActivity).toHaveBeenCalledWith(
        1,
        'issue_created',
        '#123',
        { title: 'New Issue' }
      );
      expect(result).toEqual({
        number: 123,
        url: 'https://github.com/owner/repo/issues/123'
      });
    });

    it('should not log activity if project not found', async () => {
      (mockGitHubClient.createIssue as jest.Mock).mockResolvedValue({
        number: 123,
        html_url: 'url'
      });

      (mockDataStore.getProject as jest.Mock).mockResolvedValue(null);

      await handlers.create_issue({
        repo: 'owner/repo',
        title: 'Issue',
        body: 'Body'
      });

      expect(mockDataStore.logActivity).not.toHaveBeenCalled();
    });
  });

  describe('update_issue', () => {
    it('should update an issue and log activity', async () => {
      (mockGitHubClient.updateIssue as jest.Mock).mockResolvedValue({
        number: 42,
        state: 'closed'
      });

      (mockDataStore.getProject as jest.Mock).mockResolvedValue({
        id: 1,
        github_repo: 'owner/repo'
      });

      const result = await handlers.update_issue({
        repo: 'owner/repo',
        issue_number: 42,
        state: 'closed'
      });

      expect(mockGitHubClient.updateIssue).toHaveBeenCalledWith(
        'owner/repo',
        42,
        { state: 'closed' }
      );
      expect(mockDataStore.logActivity).toHaveBeenCalledWith(
        1,
        'issue_updated',
        '#42',
        { state: 'closed' }
      );
      expect(result).toEqual({ number: 42, state: 'closed' });
    });
  });

  describe('add_comment', () => {
    it('should add a comment', async () => {
      (mockGitHubClient.addComment as jest.Mock).mockResolvedValue(undefined);

      const result = await handlers.add_comment({
        repo: 'owner/repo',
        issue_number: 42,
        body: 'This is a comment'
      });

      expect(mockGitHubClient.addComment).toHaveBeenCalledWith(
        'owner/repo',
        42,
        'This is a comment'
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('list_pull_requests', () => {
    it('should list pull requests with formatted output', async () => {
      (mockGitHubClient.listPullRequests as jest.Mock).mockResolvedValue([
        {
          number: 1,
          title: 'Feature PR',
          state: 'open',
          user: { login: 'john' },
          base: { ref: 'main' },
          head: { ref: 'feature' },
          draft: false,
          additions: 100,
          deletions: 50,
          html_url: 'https://github.com/owner/repo/pull/1'
        }
      ]);

      const result = await handlers.list_pull_requests({ repo: 'owner/repo' });

      expect(result).toHaveLength(1);
      expect((result as any[])[0]).toEqual({
        number: 1,
        title: 'Feature PR',
        state: 'open',
        author: 'john',
        base: 'main',
        head: 'feature',
        draft: false,
        additions: 100,
        deletions: 50,
        url: 'https://github.com/owner/repo/pull/1'
      });
    });
  });

  describe('get_pull_request', () => {
    it('should get a pull request', async () => {
      (mockGitHubClient.getPullRequest as jest.Mock).mockResolvedValue({
        number: 42,
        title: 'PR Title',
        state: 'open'
      });

      const result = await handlers.get_pull_request({ repo: 'owner/repo', pr_number: 42 });

      expect(mockGitHubClient.getPullRequest).toHaveBeenCalledWith('owner/repo', 42);
      expect(result).toHaveProperty('number', 42);
    });
  });

  describe('list_pr_reviews', () => {
    it('should list reviews with formatted output', async () => {
      (mockGitHubClient.listReviews as jest.Mock).mockResolvedValue([
        {
          user: { login: 'reviewer1' },
          state: 'APPROVED',
          submitted_at: '2024-01-01T00:00:00Z'
        },
        {
          user: { login: 'reviewer2' },
          state: 'CHANGES_REQUESTED',
          submitted_at: '2024-01-02T00:00:00Z'
        }
      ]);

      const result = await handlers.list_pr_reviews({ repo: 'owner/repo', pr_number: 42 });

      expect(result).toHaveLength(2);
      expect((result as any[])[0]).toEqual({
        user: 'reviewer1',
        state: 'APPROVED',
        submitted_at: '2024-01-01T00:00:00Z'
      });
    });
  });

  describe('request_reviewers', () => {
    it('should request reviewers', async () => {
      (mockGitHubClient.requestReviewers as jest.Mock).mockResolvedValue(undefined);

      const result = await handlers.request_reviewers({
        repo: 'owner/repo',
        pr_number: 42,
        reviewers: ['jane', 'john']
      });

      expect(mockGitHubClient.requestReviewers).toHaveBeenCalledWith(
        'owner/repo',
        42,
        ['jane', 'john']
      );
      expect(result).toEqual({ success: true, reviewers: ['jane', 'john'] });
    });
  });

  describe('search_issues', () => {
    it('should search issues with formatted output', async () => {
      (mockGitHubClient.searchIssues as jest.Mock).mockResolvedValue([
        {
          number: 1,
          title: 'Bug: something broken',
          state: 'open',
          html_url: 'https://github.com/owner/repo/issues/1'
        }
      ]);

      const result = await handlers.search_issues({
        query: 'bug',
        repo: 'owner/repo',
        type: 'issue',
        state: 'open'
      });

      expect(mockGitHubClient.searchIssues).toHaveBeenCalledWith('bug', {
        repo: 'owner/repo',
        type: 'issue',
        state: 'open'
      });
      expect(result).toHaveLength(1);
    });
  });

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

      expect(result).toHaveLength(1);
      expect((result as any[])[0]).toEqual({
        number: 1,
        title: 'v1.0',
        state: 'open',
        due_on: '2024-03-01T00:00:00Z',
        open_issues: 5,
        closed_issues: 15,
        progress: 75 // 15 / (5 + 15) * 100
      });
    });

    it('should handle empty milestones', async () => {
      (mockGitHubClient.listMilestones as jest.Mock).mockResolvedValue([
        {
          number: 1,
          title: 'Empty Milestone',
          state: 'open',
          open_issues: 0,
          closed_issues: 0
        }
      ]);

      const result = await handlers.list_milestones({ repo: 'owner/repo' });

      expect((result as any[])[0].progress).toBe(0);
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

      expect(mockGitHubClient.getRepository).toHaveBeenCalledWith('owner/repo');
      expect(result).toHaveProperty('full_name', 'owner/repo');
      expect(result).toHaveProperty('language', 'TypeScript');
    });
  });
});
