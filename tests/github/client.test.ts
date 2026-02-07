/**
 * GitHubClient Tests
 *
 * Tests for the GitHub API client wrapper.
 */

import { GitHubClient } from '../../src/github/client';
import { mockOctokit } from '../setup';

describe('GitHubClient', () => {
  let client: GitHubClient;

  beforeEach(() => {
    client = new GitHubClient({ token: 'test-token' });
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with token', () => {
      expect(client).toBeDefined();
    });

    it('should support custom baseUrl for GitHub Enterprise', () => {
      const enterpriseClient = new GitHubClient({
        token: 'test-token',
        baseUrl: 'https://github.mycompany.com/api/v3'
      });
      expect(enterpriseClient).toBeDefined();
    });
  });

  describe('parseRepo', () => {
    it('should throw for invalid repo format', async () => {
      await expect(client.listIssues('invalid'))
        .rejects.toThrow('Invalid repository format');
    });

    it('should throw for missing repo name', async () => {
      await expect(client.listIssues('owner/'))
        .rejects.toThrow('Invalid repository format');
    });
  });

  describe('Issues', () => {
    describe('listIssues', () => {
      it('should list issues from a repository', async () => {
        mockOctokit.issues.listForRepo.mockResolvedValueOnce({
          data: [
            { number: 1, title: 'Issue 1', state: 'open', labels: [], assignees: [] },
            { number: 2, title: 'Issue 2', state: 'closed', labels: [], assignees: [] }
          ]
        });

        const issues = await client.listIssues('owner/repo');

        expect(mockOctokit.issues.listForRepo).toHaveBeenCalledWith(
          expect.objectContaining({
            owner: 'owner',
            repo: 'repo',
            state: 'open'
          })
        );
        expect(issues).toHaveLength(2);
      });

      it('should filter out pull requests', async () => {
        mockOctokit.issues.listForRepo.mockResolvedValueOnce({
          data: [
            { number: 1, title: 'Issue 1', state: 'open', labels: [], assignees: [] },
            { number: 2, title: 'PR 1', state: 'open', pull_request: {}, labels: [], assignees: [] }
          ]
        });

        const issues = await client.listIssues('owner/repo');

        expect(issues).toHaveLength(1);
        expect(issues[0].number).toBe(1);
      });

      it('should pass filter options', async () => {
        mockOctokit.issues.listForRepo.mockResolvedValueOnce({ data: [] });

        await client.listIssues('owner/repo', {
          state: 'closed',
          labels: 'bug,critical',
          assignee: 'john'
        });

        expect(mockOctokit.issues.listForRepo).toHaveBeenCalledWith(
          expect.objectContaining({
            state: 'closed',
            labels: 'bug,critical',
            assignee: 'john'
          })
        );
      });
    });

    describe('getIssue', () => {
      it('should get a single issue', async () => {
        mockOctokit.issues.get.mockResolvedValueOnce({
          data: {
            number: 42,
            title: 'Test Issue',
            body: 'Description',
            state: 'open',
            labels: [{ name: 'bug' }],
            assignees: [{ login: 'john' }],
            html_url: 'https://github.com/owner/repo/issues/42'
          }
        });

        const issue = await client.getIssue('owner/repo', 42);

        expect(mockOctokit.issues.get).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
          issue_number: 42
        });
        expect(issue.number).toBe(42);
        expect(issue.title).toBe('Test Issue');
      });
    });

    describe('createIssue', () => {
      it('should create a new issue', async () => {
        mockOctokit.issues.create.mockResolvedValueOnce({
          data: {
            number: 123,
            title: 'New Issue',
            html_url: 'https://github.com/owner/repo/issues/123'
          }
        });

        const issue = await client.createIssue(
          'owner/repo',
          'New Issue',
          'Issue description',
          { labels: ['enhancement'], assignees: ['jane'] }
        );

        expect(mockOctokit.issues.create).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
          title: 'New Issue',
          body: 'Issue description',
          labels: ['enhancement'],
          assignees: ['jane'],
          milestone: undefined
        });
        expect(issue.number).toBe(123);
      });
    });

    describe('updateIssue', () => {
      it('should update an existing issue', async () => {
        mockOctokit.issues.update.mockResolvedValueOnce({
          data: {
            number: 42,
            state: 'closed'
          }
        });

        const issue = await client.updateIssue('owner/repo', 42, {
          state: 'closed',
          labels: ['resolved']
        });

        expect(mockOctokit.issues.update).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
          issue_number: 42,
          state: 'closed',
          labels: ['resolved']
        });
        expect(issue.state).toBe('closed');
      });
    });

    describe('addComment', () => {
      it('should add a comment to an issue', async () => {
        mockOctokit.issues.createComment.mockResolvedValueOnce({
          data: { id: 1 }
        });

        await client.addComment('owner/repo', 42, 'This is a comment');

        expect(mockOctokit.issues.createComment).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
          issue_number: 42,
          body: 'This is a comment'
        });
      });
    });

    describe('addLabels', () => {
      it('should add labels to an issue', async () => {
        mockOctokit.issues.addLabels.mockResolvedValueOnce({
          data: []
        });

        await client.addLabels('owner/repo', 42, ['bug', 'critical']);

        expect(mockOctokit.issues.addLabels).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
          issue_number: 42,
          labels: ['bug', 'critical']
        });
      });
    });
  });

  describe('Pull Requests', () => {
    describe('listPullRequests', () => {
      it('should list pull requests', async () => {
        mockOctokit.pulls.list.mockResolvedValueOnce({
          data: [
            { number: 1, title: 'PR 1', state: 'open', base: { ref: 'main' }, head: { ref: 'feature' } },
            { number: 2, title: 'PR 2', state: 'open', base: { ref: 'main' }, head: { ref: 'fix' } }
          ]
        });

        const prs = await client.listPullRequests('owner/repo');

        expect(mockOctokit.pulls.list).toHaveBeenCalledWith(
          expect.objectContaining({
            owner: 'owner',
            repo: 'repo',
            state: 'open'
          })
        );
        expect(prs).toHaveLength(2);
      });

      it('should filter by base branch', async () => {
        mockOctokit.pulls.list.mockResolvedValueOnce({ data: [] });

        await client.listPullRequests('owner/repo', { base: 'develop' });

        expect(mockOctokit.pulls.list).toHaveBeenCalledWith(
          expect.objectContaining({ base: 'develop' })
        );
      });
    });

    describe('getPullRequest', () => {
      it('should get a single pull request', async () => {
        mockOctokit.pulls.get.mockResolvedValueOnce({
          data: {
            number: 42,
            title: 'Feature PR',
            state: 'open',
            additions: 100,
            deletions: 50,
            changed_files: 5
          }
        });

        const pr = await client.getPullRequest('owner/repo', 42);

        expect(mockOctokit.pulls.get).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
          pull_number: 42
        });
        expect(pr.number).toBe(42);
        expect(pr.additions).toBe(100);
      });
    });

    describe('listReviews', () => {
      it('should list reviews on a PR', async () => {
        mockOctokit.pulls.listReviews.mockResolvedValueOnce({
          data: [
            { id: 1, user: { login: 'reviewer1' }, state: 'APPROVED' },
            { id: 2, user: { login: 'reviewer2' }, state: 'CHANGES_REQUESTED' }
          ]
        });

        const reviews = await client.listReviews('owner/repo', 42);

        expect(mockOctokit.pulls.listReviews).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
          pull_number: 42
        });
        expect(reviews).toHaveLength(2);
      });
    });

    describe('requestReviewers', () => {
      it('should request reviewers for a PR', async () => {
        mockOctokit.pulls.requestReviewers.mockResolvedValueOnce({
          data: {}
        });

        await client.requestReviewers('owner/repo', 42, ['jane', 'john']);

        expect(mockOctokit.pulls.requestReviewers).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
          pull_number: 42,
          reviewers: ['jane', 'john']
        });
      });
    });
  });

  describe('Commits', () => {
    describe('listCommits', () => {
      it('should list commits', async () => {
        mockOctokit.repos.listCommits.mockResolvedValueOnce({
          data: [
            { sha: 'abc123', commit: { message: 'Commit 1' } },
            { sha: 'def456', commit: { message: 'Commit 2' } }
          ]
        });

        const commits = await client.listCommits('owner/repo');

        expect(mockOctokit.repos.listCommits).toHaveBeenCalledWith(
          expect.objectContaining({
            owner: 'owner',
            repo: 'repo'
          })
        );
        expect(commits).toHaveLength(2);
      });
    });

    describe('listPRCommits', () => {
      it('should list commits on a PR', async () => {
        mockOctokit.pulls.listCommits.mockResolvedValueOnce({
          data: [
            { sha: 'abc123', commit: { message: 'PR Commit' } }
          ]
        });

        const commits = await client.listPRCommits('owner/repo', 42);

        expect(mockOctokit.pulls.listCommits).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
          pull_number: 42,
          per_page: 100
        });
        expect(commits).toHaveLength(1);
      });
    });
  });

  describe('Milestones', () => {
    describe('listMilestones', () => {
      it('should list milestones', async () => {
        mockOctokit.issues.listMilestones.mockResolvedValueOnce({
          data: [
            { number: 1, title: 'v1.0', state: 'open', open_issues: 5, closed_issues: 10 },
            { number: 2, title: 'v2.0', state: 'open', open_issues: 20, closed_issues: 0 }
          ]
        });

        const milestones = await client.listMilestones('owner/repo');

        expect(mockOctokit.issues.listMilestones).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
          state: 'open',
          per_page: 100
        });
        expect(milestones).toHaveLength(2);
      });
    });

    describe('getMilestone', () => {
      it('should get a single milestone', async () => {
        mockOctokit.issues.getMilestone.mockResolvedValueOnce({
          data: {
            number: 1,
            title: 'v1.0',
            open_issues: 5,
            closed_issues: 10
          }
        });

        const milestone = await client.getMilestone('owner/repo', 1);

        expect(milestone.title).toBe('v1.0');
      });
    });
  });

  describe('Search', () => {
    describe('searchIssues', () => {
      it('should search for issues', async () => {
        mockOctokit.search.issuesAndPullRequests.mockResolvedValueOnce({
          data: {
            items: [
              { number: 1, title: 'Bug report', state: 'open' }
            ]
          }
        });

        const results = await client.searchIssues('bug', { repo: 'owner/repo' });

        expect(mockOctokit.search.issuesAndPullRequests).toHaveBeenCalledWith({
          q: 'bug repo:owner/repo',
          per_page: 30,
          page: 1
        });
        expect(results).toHaveLength(1);
      });

      it('should filter by type and state', async () => {
        mockOctokit.search.issuesAndPullRequests.mockResolvedValueOnce({
          data: { items: [] }
        });

        await client.searchIssues('fix', { type: 'pr', state: 'closed' });

        expect(mockOctokit.search.issuesAndPullRequests).toHaveBeenCalledWith({
          q: 'fix is:pr is:closed',
          per_page: 30,
          page: 1
        });
      });
    });

    describe('searchCode', () => {
      it('should search for code', async () => {
        mockOctokit.search.code.mockResolvedValueOnce({
          data: {
            items: [
              { path: 'src/index.ts', repository: { full_name: 'owner/repo' }, html_url: 'url' }
            ]
          }
        });

        const results = await client.searchCode('function', { repo: 'owner/repo' });

        expect(mockOctokit.search.code).toHaveBeenCalledWith({
          q: 'function repo:owner/repo',
          per_page: 30,
          page: 1
        });
        expect(results).toHaveLength(1);
      });
    });
  });

  describe('Repository Info', () => {
    describe('getRepository', () => {
      it('should get repository info', async () => {
        mockOctokit.repos.get.mockResolvedValueOnce({
          data: {
            full_name: 'owner/repo',
            description: 'A test repository',
            default_branch: 'main',
            open_issues_count: 15,
            language: 'TypeScript',
            topics: ['testing', 'typescript']
          }
        });

        const repo = await client.getRepository('owner/repo');

        expect(repo.full_name).toBe('owner/repo');
        expect(repo.language).toBe('TypeScript');
        expect(repo.topics).toContain('typescript');
      });
    });

    describe('getContributorStats', () => {
      it('should get contributor stats', async () => {
        mockOctokit.repos.getContributorsStats.mockResolvedValueOnce({
          data: [
            { author: { login: 'john' }, total: 100, weeks: [] },
            { author: { login: 'jane' }, total: 50, weeks: [] }
          ]
        });

        const stats = await client.getContributorStats('owner/repo');

        expect(stats).toHaveLength(2);
        expect(stats[0].total).toBe(100);
      });

      it('should handle 202 response (computing stats)', async () => {
        mockOctokit.repos.getContributorsStats.mockResolvedValueOnce({
          data: null
        });

        const stats = await client.getContributorStats('owner/repo');

        expect(stats).toEqual([]);
      });
    });
  });
});
