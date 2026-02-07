/**
 * GitHub Client
 *
 * Wrapper around Octokit providing typed access to GitHub API
 * with retry logic and rate limiting awareness.
 */

import { Octokit } from '@octokit/rest';
import { withRetry, RetryConfigs, loggers } from 'the-machina';

export interface GitHubConfig {
  token: string;
  baseUrl?: string;  // For GitHub Enterprise
}

export interface Issue {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  labels: Array<{ name: string }>;
  assignees: Array<{ login: string }>;
  milestone: { title: string; number: number } | null;
  user: { login: string } | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  html_url: string;
}

export interface PullRequest {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  base: { ref: string };
  head: { ref: string };
  user: { login: string } | null;
  requested_reviewers: Array<{ login: string }>;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  merged?: boolean;
  merged_at: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  html_url: string;
  draft?: boolean;
}

export interface Review {
  id: number;
  user: { login: string } | null;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'PENDING' | 'DISMISSED';
  body: string | null;
  submitted_at: string | null;
}

export interface Commit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string } | null;
  };
  author: { login: string } | null;
  html_url: string;
}

export interface Milestone {
  number: number;
  title: string;
  description: string | null;
  state: 'open' | 'closed';
  due_on: string | null;
  open_issues: number;
  closed_issues: number;
}

export class GitHubClient {
  private octokit: Octokit;
  private retryConfig = {
    ...RetryConfigs.externalApi('GitHub API'),
    maxAttempts: 3,
    baseDelayMs: 1000
  };

  constructor(config: GitHubConfig) {
    this.octokit = new Octokit({
      auth: config.token,
      baseUrl: config.baseUrl
    });
  }

  private parseRepo(repo: string): { owner: string; repo: string } {
    const [owner, repoName] = repo.split('/');
    if (!owner || !repoName) {
      throw new Error(`Invalid repository format: ${repo}. Expected "owner/repo"`);
    }
    return { owner, repo: repoName };
  }

  // ==================== Issues ====================

  async listIssues(repo: string, options: {
    state?: 'open' | 'closed' | 'all';
    labels?: string;
    assignee?: string;
    milestone?: string;
    since?: string;
    per_page?: number;
    page?: number;
  } = {}): Promise<Issue[]> {
    const { owner, repo: repoName } = this.parseRepo(repo);

    const result = await withRetry(
      () => this.octokit.issues.listForRepo({
        owner,
        repo: repoName,
        state: options.state || 'open',
        labels: options.labels,
        assignee: options.assignee,
        milestone: options.milestone,
        since: options.since,
        per_page: options.per_page || 100,
        page: options.page || 1
      }),
      this.retryConfig
    );

    // Filter out pull requests (GitHub API returns PRs as issues)
    return result.data.filter(issue => !issue.pull_request) as Issue[];
  }

  async getIssue(repo: string, issueNumber: number): Promise<Issue> {
    const { owner, repo: repoName } = this.parseRepo(repo);

    const result = await withRetry(
      () => this.octokit.issues.get({
        owner,
        repo: repoName,
        issue_number: issueNumber
      }),
      this.retryConfig
    );

    return result.data as Issue;
  }

  async createIssue(repo: string, title: string, body: string, options: {
    labels?: string[];
    assignees?: string[];
    milestone?: number;
  } = {}): Promise<Issue> {
    const { owner, repo: repoName } = this.parseRepo(repo);

    const result = await withRetry(
      () => this.octokit.issues.create({
        owner,
        repo: repoName,
        title,
        body,
        labels: options.labels,
        assignees: options.assignees,
        milestone: options.milestone
      }),
      this.retryConfig
    );

    loggers.channels.info('Created issue', { repo, number: result.data.number, title });
    return result.data as Issue;
  }

  async updateIssue(repo: string, issueNumber: number, updates: {
    title?: string;
    body?: string;
    state?: 'open' | 'closed';
    labels?: string[];
    assignees?: string[];
    milestone?: number | null;
  }): Promise<Issue> {
    const { owner, repo: repoName } = this.parseRepo(repo);

    const result = await withRetry(
      () => this.octokit.issues.update({
        owner,
        repo: repoName,
        issue_number: issueNumber,
        ...updates
      }),
      this.retryConfig
    );

    loggers.channels.info('Updated issue', { repo, number: issueNumber, updates: Object.keys(updates) });
    return result.data as Issue;
  }

  async addComment(repo: string, issueNumber: number, body: string): Promise<void> {
    const { owner, repo: repoName } = this.parseRepo(repo);

    await withRetry(
      () => this.octokit.issues.createComment({
        owner,
        repo: repoName,
        issue_number: issueNumber,
        body
      }),
      this.retryConfig
    );

    loggers.channels.info('Added comment', { repo, number: issueNumber });
  }

  async addLabels(repo: string, issueNumber: number, labels: string[]): Promise<void> {
    const { owner, repo: repoName } = this.parseRepo(repo);

    await withRetry(
      () => this.octokit.issues.addLabels({
        owner,
        repo: repoName,
        issue_number: issueNumber,
        labels
      }),
      this.retryConfig
    );

    loggers.channels.info('Added labels', { repo, number: issueNumber, labels });
  }

  // ==================== Pull Requests ====================

  async listPullRequests(repo: string, options: {
    state?: 'open' | 'closed' | 'all';
    base?: string;
    head?: string;
    sort?: 'created' | 'updated' | 'popularity' | 'long-running';
    direction?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
  } = {}): Promise<PullRequest[]> {
    const { owner, repo: repoName } = this.parseRepo(repo);

    const result = await withRetry(
      () => this.octokit.pulls.list({
        owner,
        repo: repoName,
        state: options.state || 'open',
        base: options.base,
        head: options.head,
        sort: options.sort || 'updated',
        direction: options.direction || 'desc',
        per_page: options.per_page || 100,
        page: options.page || 1
      }),
      this.retryConfig
    );

    return result.data as PullRequest[];
  }

  async getPullRequest(repo: string, prNumber: number): Promise<PullRequest> {
    const { owner, repo: repoName } = this.parseRepo(repo);

    const result = await withRetry(
      () => this.octokit.pulls.get({
        owner,
        repo: repoName,
        pull_number: prNumber
      }),
      this.retryConfig
    );

    return result.data as PullRequest;
  }

  async listReviews(repo: string, prNumber: number): Promise<Review[]> {
    const { owner, repo: repoName } = this.parseRepo(repo);

    const result = await withRetry(
      () => this.octokit.pulls.listReviews({
        owner,
        repo: repoName,
        pull_number: prNumber
      }),
      this.retryConfig
    );

    return result.data as Review[];
  }

  async requestReviewers(repo: string, prNumber: number, reviewers: string[]): Promise<void> {
    const { owner, repo: repoName } = this.parseRepo(repo);

    await withRetry(
      () => this.octokit.pulls.requestReviewers({
        owner,
        repo: repoName,
        pull_number: prNumber,
        reviewers
      }),
      this.retryConfig
    );

    loggers.channels.info('Requested reviewers', { repo, number: prNumber, reviewers });
  }

  // ==================== Commits ====================

  async listCommits(repo: string, options: {
    sha?: string;
    path?: string;
    since?: string;
    until?: string;
    per_page?: number;
    page?: number;
  } = {}): Promise<Commit[]> {
    const { owner, repo: repoName } = this.parseRepo(repo);

    const result = await withRetry(
      () => this.octokit.repos.listCommits({
        owner,
        repo: repoName,
        sha: options.sha,
        path: options.path,
        since: options.since,
        until: options.until,
        per_page: options.per_page || 100,
        page: options.page || 1
      }),
      this.retryConfig
    );

    return result.data as Commit[];
  }

  async listPRCommits(repo: string, prNumber: number): Promise<Commit[]> {
    const { owner, repo: repoName } = this.parseRepo(repo);

    const result = await withRetry(
      () => this.octokit.pulls.listCommits({
        owner,
        repo: repoName,
        pull_number: prNumber,
        per_page: 100
      }),
      this.retryConfig
    );

    return result.data as Commit[];
  }

  // ==================== Milestones ====================

  async listMilestones(repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<Milestone[]> {
    const { owner, repo: repoName } = this.parseRepo(repo);

    const result = await withRetry(
      () => this.octokit.issues.listMilestones({
        owner,
        repo: repoName,
        state,
        per_page: 100
      }),
      this.retryConfig
    );

    return result.data as Milestone[];
  }

  async getMilestone(repo: string, milestoneNumber: number): Promise<Milestone> {
    const { owner, repo: repoName } = this.parseRepo(repo);

    const result = await withRetry(
      () => this.octokit.issues.getMilestone({
        owner,
        repo: repoName,
        milestone_number: milestoneNumber
      }),
      this.retryConfig
    );

    return result.data as Milestone;
  }

  // ==================== Search ====================

  async searchIssues(query: string, options: {
    repo?: string;
    type?: 'issue' | 'pr';
    state?: 'open' | 'closed';
    per_page?: number;
    page?: number;
  } = {}): Promise<Issue[]> {
    let q = query;
    if (options.repo) q += ` repo:${options.repo}`;
    if (options.type === 'issue') q += ' is:issue';
    if (options.type === 'pr') q += ' is:pr';
    if (options.state) q += ` is:${options.state}`;

    const result = await withRetry(
      () => this.octokit.search.issuesAndPullRequests({
        q,
        per_page: options.per_page || 30,
        page: options.page || 1
      }),
      this.retryConfig
    );

    return result.data.items as Issue[];
  }

  async searchCode(query: string, options: {
    repo?: string;
    language?: string;
    path?: string;
    per_page?: number;
    page?: number;
  } = {}): Promise<Array<{ path: string; repository: { full_name: string }; html_url: string }>> {
    let q = query;
    if (options.repo) q += ` repo:${options.repo}`;
    if (options.language) q += ` language:${options.language}`;
    if (options.path) q += ` path:${options.path}`;

    const result = await withRetry(
      () => this.octokit.search.code({
        q,
        per_page: options.per_page || 30,
        page: options.page || 1
      }),
      this.retryConfig
    );

    return result.data.items;
  }

  // ==================== Repository Info ====================

  async getRepository(repo: string): Promise<{
    name: string;
    full_name: string;
    description: string | null;
    default_branch: string;
    open_issues_count: number;
    stargazers_count: number;
    forks_count: number;
    language: string | null;
    topics: string[];
  }> {
    const { owner, repo: repoName } = this.parseRepo(repo);

    const result = await withRetry(
      () => this.octokit.repos.get({
        owner,
        repo: repoName
      }),
      this.retryConfig
    );

    return {
      name: result.data.name,
      full_name: result.data.full_name,
      description: result.data.description,
      default_branch: result.data.default_branch,
      open_issues_count: result.data.open_issues_count,
      stargazers_count: result.data.stargazers_count,
      forks_count: result.data.forks_count,
      language: result.data.language,
      topics: result.data.topics || []
    };
  }

  async getContributorStats(repo: string): Promise<Array<{
    author: { login: string } | null;
    total: number;
    weeks: Array<{ w?: number; a?: number; d?: number; c?: number }>;
  }>> {
    const { owner, repo: repoName } = this.parseRepo(repo);

    const result = await withRetry(
      () => this.octokit.repos.getContributorsStats({
        owner,
        repo: repoName
      }),
      this.retryConfig
    );

    // GitHub may return 202 while computing stats
    if (!result.data || !Array.isArray(result.data)) {
      return [];
    }

    return result.data;
  }

  // ==================== Labels ====================

  async listLabels(repo: string): Promise<Array<{
    name: string;
    color: string;
    description: string | null;
  }>> {
    const { owner, repo: repoName } = this.parseRepo(repo);

    const result = await withRetry(
      () => this.octokit.issues.listLabelsForRepo({
        owner,
        repo: repoName,
        per_page: 100
      }),
      this.retryConfig
    );

    return result.data.map(l => ({
      name: l.name,
      color: l.color,
      description: l.description
    }));
  }

  // ==================== File Contents ====================

  async getFileContents(repo: string, path: string, ref?: string): Promise<{
    name: string;
    path: string;
    content: string;
    sha: string;
    size: number;
  }> {
    const { owner, repo: repoName } = this.parseRepo(repo);

    const result = await withRetry(
      () => this.octokit.repos.getContent({
        owner,
        repo: repoName,
        path,
        ref
      }),
      this.retryConfig
    );

    const data = result.data as {
      name: string;
      path: string;
      content?: string;
      sha: string;
      size: number;
      encoding?: string;
    };

    if (!data.content) {
      throw new Error(`${path} is a directory, not a file`);
    }

    // Decode base64 content
    const content = data.encoding === 'base64'
      ? Buffer.from(data.content, 'base64').toString('utf-8')
      : data.content;

    return {
      name: data.name,
      path: data.path,
      content,
      sha: data.sha,
      size: data.size
    };
  }

  // ==================== Commit Activity ====================

  async getCommitActivity(repo: string): Promise<Array<{
    week: number;
    total: number;
    days: number[];
  }>> {
    const { owner, repo: repoName } = this.parseRepo(repo);

    const result = await withRetry(
      () => this.octokit.repos.getCommitActivityStats({
        owner,
        repo: repoName
      }),
      this.retryConfig
    );

    if (!result.data || !Array.isArray(result.data)) {
      return [];
    }

    return result.data;
  }
}
