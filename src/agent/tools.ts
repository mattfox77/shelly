/**
 * Shelly Agent Tools
 *
 * Tool definitions for the AI agent to interact with GitHub
 * and other services.
 */

import { Tool } from './core';
import { GitHubClient } from '../github/client';
import { ShellyDataStore } from '../data/store';
import { ReportingService } from '../skills/reporting';
import { NotificationService } from '../channels/notifications';
import { TemporalClient } from '../temporal/client';
import { formatDate, parseDate } from '../utils/dates';
import { v4 as uuid } from 'uuid';

export const tools: Tool[] = [
  // ==================== Issue Management ====================
  {
    name: 'list_issues',
    description: 'List issues from a GitHub repository with optional filters',
    input_schema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository in "owner/repo" format'
        },
        state: {
          type: 'string',
          enum: ['open', 'closed', 'all'],
          description: 'Filter by issue state'
        },
        labels: {
          type: 'string',
          description: 'Comma-separated list of label names'
        },
        assignee: {
          type: 'string',
          description: 'Filter by assignee username'
        },
        milestone: {
          type: 'string',
          description: 'Filter by milestone number or "none"'
        }
      },
      required: ['repo']
    }
  },
  {
    name: 'get_issue',
    description: 'Get detailed information about a specific issue',
    input_schema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository in "owner/repo" format'
        },
        issue_number: {
          type: 'number',
          description: 'The issue number'
        }
      },
      required: ['repo', 'issue_number']
    }
  },
  {
    name: 'create_issue',
    description: 'Create a new issue in a repository',
    input_schema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository in "owner/repo" format'
        },
        title: {
          type: 'string',
          description: 'Issue title'
        },
        body: {
          type: 'string',
          description: 'Issue body/description'
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Labels to apply'
        },
        assignees: {
          type: 'array',
          items: { type: 'string' },
          description: 'Usernames to assign'
        }
      },
      required: ['repo', 'title', 'body']
    }
  },
  {
    name: 'update_issue',
    description: 'Update an existing issue (title, body, state, labels, assignees)',
    input_schema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository in "owner/repo" format'
        },
        issue_number: {
          type: 'number',
          description: 'The issue number'
        },
        title: { type: 'string' },
        body: { type: 'string' },
        state: {
          type: 'string',
          enum: ['open', 'closed']
        },
        labels: {
          type: 'array',
          items: { type: 'string' }
        },
        assignees: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['repo', 'issue_number']
    }
  },
  {
    name: 'add_comment',
    description: 'Add a comment to an issue or pull request',
    input_schema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository in "owner/repo" format'
        },
        issue_number: {
          type: 'number',
          description: 'The issue or PR number'
        },
        body: {
          type: 'string',
          description: 'Comment body'
        }
      },
      required: ['repo', 'issue_number', 'body']
    }
  },

  // ==================== Labels ====================
  {
    name: 'list_labels',
    description: 'List all labels in a repository',
    input_schema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository in "owner/repo" format'
        }
      },
      required: ['repo']
    }
  },
  {
    name: 'add_labels',
    description: 'Add labels to an issue or pull request',
    input_schema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository in "owner/repo" format'
        },
        issue_number: {
          type: 'number',
          description: 'The issue or PR number'
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Labels to add'
        }
      },
      required: ['repo', 'issue_number', 'labels']
    }
  },

  // ==================== Pull Request Management ====================
  {
    name: 'list_pull_requests',
    description: 'List pull requests from a repository',
    input_schema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository in "owner/repo" format'
        },
        state: {
          type: 'string',
          enum: ['open', 'closed', 'all']
        },
        base: {
          type: 'string',
          description: 'Filter by base branch'
        }
      },
      required: ['repo']
    }
  },
  {
    name: 'get_pull_request',
    description: 'Get detailed information about a pull request',
    input_schema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository in "owner/repo" format'
        },
        pr_number: {
          type: 'number',
          description: 'The pull request number'
        }
      },
      required: ['repo', 'pr_number']
    }
  },
  {
    name: 'list_pr_reviews',
    description: 'List reviews on a pull request',
    input_schema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository in "owner/repo" format'
        },
        pr_number: {
          type: 'number',
          description: 'The pull request number'
        }
      },
      required: ['repo', 'pr_number']
    }
  },
  {
    name: 'request_reviewers',
    description: 'Request reviewers for a pull request',
    input_schema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository in "owner/repo" format'
        },
        pr_number: {
          type: 'number',
          description: 'The pull request number'
        },
        reviewers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Usernames to request as reviewers'
        }
      },
      required: ['repo', 'pr_number', 'reviewers']
    }
  },

  // ==================== Commits ====================
  {
    name: 'list_commits',
    description: 'List commits in a repository or pull request',
    input_schema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository in "owner/repo" format'
        },
        sha: {
          type: 'string',
          description: 'SHA or branch to start listing from'
        },
        path: {
          type: 'string',
          description: 'Only show commits for this file path'
        },
        since: {
          type: 'string',
          description: 'Only show commits after this date (ISO 8601)'
        },
        pr_number: {
          type: 'number',
          description: 'List commits for this PR instead'
        }
      },
      required: ['repo']
    }
  },

  // ==================== Search ====================
  {
    name: 'search_issues',
    description: 'Search for issues and pull requests across repositories',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query'
        },
        repo: {
          type: 'string',
          description: 'Limit search to a specific repository'
        },
        type: {
          type: 'string',
          enum: ['issue', 'pr'],
          description: 'Filter by type'
        },
        state: {
          type: 'string',
          enum: ['open', 'closed']
        }
      },
      required: ['query']
    }
  },
  {
    name: 'search_code',
    description: 'Search for code across repositories',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query'
        },
        repo: {
          type: 'string',
          description: 'Limit search to a specific repository'
        },
        language: {
          type: 'string',
          description: 'Filter by programming language'
        },
        path: {
          type: 'string',
          description: 'Filter by file path'
        }
      },
      required: ['query']
    }
  },

  // ==================== File Contents ====================
  {
    name: 'get_file_contents',
    description: 'Get the contents of a file from a repository',
    input_schema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository in "owner/repo" format'
        },
        path: {
          type: 'string',
          description: 'Path to the file'
        },
        ref: {
          type: 'string',
          description: 'Branch, tag, or commit SHA (defaults to default branch)'
        }
      },
      required: ['repo', 'path']
    }
  },

  // ==================== Milestones ====================
  {
    name: 'list_milestones',
    description: 'List milestones in a repository',
    input_schema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository in "owner/repo" format'
        },
        state: {
          type: 'string',
          enum: ['open', 'closed', 'all']
        }
      },
      required: ['repo']
    }
  },
  {
    name: 'get_milestone_progress',
    description: 'Get detailed progress for a milestone',
    input_schema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository in "owner/repo" format'
        },
        milestone_number: {
          type: 'number',
          description: 'The milestone number'
        }
      },
      required: ['repo', 'milestone_number']
    }
  },

  // ==================== Repository Info ====================
  {
    name: 'get_repository_info',
    description: 'Get information about a repository',
    input_schema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository in "owner/repo" format'
        }
      },
      required: ['repo']
    }
  },
  {
    name: 'get_contributor_stats',
    description: 'Get contribution statistics for a repository',
    input_schema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository in "owner/repo" format'
        }
      },
      required: ['repo']
    }
  },

  // ==================== Reporting ====================
  {
    name: 'generate_daily_report',
    description: 'Generate a daily summary report for a repository',
    input_schema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository in "owner/repo" format'
        },
        date: {
          type: 'string',
          description: 'Date for the report (ISO format, defaults to today)'
        }
      },
      required: ['repo']
    }
  },
  {
    name: 'generate_weekly_report',
    description: 'Generate a weekly summary report for a repository',
    input_schema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository in "owner/repo" format'
        },
        week_start: {
          type: 'string',
          description: 'Start of the week (ISO format, defaults to current week)'
        }
      },
      required: ['repo']
    }
  },
  {
    name: 'get_velocity_metrics',
    description: 'Get velocity metrics (issues closed, PRs merged) for a time period',
    input_schema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository in "owner/repo" format'
        },
        period: {
          type: 'string',
          enum: ['day', 'week', 'month'],
          description: 'Time period for metrics'
        }
      },
      required: ['repo', 'period']
    }
  },

  // ==================== Notifications ====================
  {
    name: 'send_notification',
    description: 'Send a notification via email, Slack, or GitHub comment',
    input_schema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          enum: ['email', 'slack', 'github_comment'],
          description: 'Notification channel'
        },
        recipient: {
          type: 'string',
          description: 'Recipient address (email, Slack channel, or "owner/repo#123" for GitHub)'
        },
        subject: {
          type: 'string',
          description: 'Message subject'
        },
        body: {
          type: 'string',
          description: 'Message body'
        },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high'],
          description: 'Message priority'
        }
      },
      required: ['channel', 'recipient', 'body']
    }
  },

  // ==================== Activity Logging ====================
  {
    name: 'log_activity',
    description: 'Log an activity for the audit trail',
    input_schema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository in "owner/repo" format'
        },
        action: {
          type: 'string',
          description: 'Type of action performed'
        },
        target: {
          type: 'string',
          description: 'Target of the action (e.g., "issue #123")'
        },
        details: {
          type: 'object',
          description: 'Additional details about the action'
        }
      },
      required: ['repo', 'action', 'target']
    }
  },
  {
    name: 'get_recent_activity',
    description: 'Get recent activity log for a repository',
    input_schema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository in "owner/repo" format'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of activities to return (default: 50)'
        }
      },
      required: ['repo']
    }
  }
];

/**
 * Extended dependencies for tool handlers
 */
export interface ToolHandlerDependencies {
  github: GitHubClient;
  dataStore: ShellyDataStore;
  reporting?: ReportingService;
  notifications?: NotificationService;
  temporalClient?: TemporalClient;
}

/**
 * Create tool handlers that connect to GitHub and database
 */
export function createToolHandlers(
  github: GitHubClient,
  dataStore: ShellyDataStore,
  deps?: { reporting?: ReportingService; notifications?: NotificationService; temporalClient?: TemporalClient }
): Record<string, (input: unknown) => Promise<unknown>> {
  const reporting = deps?.reporting || new ReportingService({ github, dataStore });
  const notifications = deps?.notifications || new NotificationService();
  const temporalClient = deps?.temporalClient;

  // Configure GitHub comment channel
  const githubCommentChannel = notifications.getChannel('github_comment');
  if (githubCommentChannel && 'configure' in githubCommentChannel) {
    (githubCommentChannel as any).configure(
      (repo: string, issueNumber: number, body: string) => github.addComment(repo, issueNumber, body)
    );
  }

  return {
    // ==================== Issue Management ====================
    list_issues: async (input: unknown) => {
      const { repo, state, labels, assignee, milestone } = input as {
        repo: string;
        state?: 'open' | 'closed' | 'all';
        labels?: string;
        assignee?: string;
        milestone?: string;
      };
      const issues = await github.listIssues(repo, { state, labels, assignee, milestone });
      return issues.map(i => ({
        number: i.number,
        title: i.title,
        state: i.state,
        labels: i.labels.map(l => l.name),
        assignees: i.assignees.map(a => a.login),
        created_at: i.created_at,
        url: i.html_url
      }));
    },

    get_issue: async (input: unknown) => {
      const { repo, issue_number } = input as { repo: string; issue_number: number };
      return github.getIssue(repo, issue_number);
    },

    create_issue: async (input: unknown) => {
      const { repo, title, body, labels, assignees } = input as {
        repo: string;
        title: string;
        body: string;
        labels?: string[];
        assignees?: string[];
      };
      const issue = await github.createIssue(repo, title, body, { labels, assignees });

      const project = await dataStore.getProject(repo);
      if (project) {
        await dataStore.logActivity(project.id, 'issue_created', `#${issue.number}`, { title });
      }

      return { number: issue.number, url: issue.html_url };
    },

    update_issue: async (input: unknown) => {
      const { repo, issue_number, ...updates } = input as {
        repo: string;
        issue_number: number;
        title?: string;
        body?: string;
        state?: 'open' | 'closed';
        labels?: string[];
        assignees?: string[];
      };
      const issue = await github.updateIssue(repo, issue_number, updates);

      const project = await dataStore.getProject(repo);
      if (project) {
        await dataStore.logActivity(project.id, 'issue_updated', `#${issue_number}`, updates);
      }

      return { number: issue.number, state: issue.state };
    },

    add_comment: async (input: unknown) => {
      const { repo, issue_number, body } = input as {
        repo: string;
        issue_number: number;
        body: string;
      };
      await github.addComment(repo, issue_number, body);
      return { success: true };
    },

    // ==================== Labels ====================
    list_labels: async (input: unknown) => {
      const { repo } = input as { repo: string };
      return github.listLabels(repo);
    },

    add_labels: async (input: unknown) => {
      const { repo, issue_number, labels } = input as {
        repo: string;
        issue_number: number;
        labels: string[];
      };
      await github.addLabels(repo, issue_number, labels);
      return { success: true, labels };
    },

    // ==================== Pull Request Management ====================
    list_pull_requests: async (input: unknown) => {
      const { repo, state, base } = input as {
        repo: string;
        state?: 'open' | 'closed' | 'all';
        base?: string;
      };
      const prs = await github.listPullRequests(repo, { state, base });
      return prs.map(pr => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        author: pr.user?.login,
        base: pr.base.ref,
        head: pr.head.ref,
        draft: pr.draft,
        additions: pr.additions,
        deletions: pr.deletions,
        url: pr.html_url
      }));
    },

    get_pull_request: async (input: unknown) => {
      const { repo, pr_number } = input as { repo: string; pr_number: number };
      return github.getPullRequest(repo, pr_number);
    },

    list_pr_reviews: async (input: unknown) => {
      const { repo, pr_number } = input as { repo: string; pr_number: number };
      const reviews = await github.listReviews(repo, pr_number);
      return reviews.map(r => ({
        user: r.user?.login,
        state: r.state,
        submitted_at: r.submitted_at
      }));
    },

    request_reviewers: async (input: unknown) => {
      const { repo, pr_number, reviewers } = input as {
        repo: string;
        pr_number: number;
        reviewers: string[];
      };
      await github.requestReviewers(repo, pr_number, reviewers);
      return { success: true, reviewers };
    },

    // ==================== Commits ====================
    list_commits: async (input: unknown) => {
      const { repo, sha, path, since, pr_number } = input as {
        repo: string;
        sha?: string;
        path?: string;
        since?: string;
        pr_number?: number;
      };

      if (pr_number) {
        const commits = await github.listPRCommits(repo, pr_number);
        return commits.map(c => ({
          sha: c.sha.substring(0, 7),
          message: c.commit.message.split('\n')[0],
          author: c.author?.login || c.commit.author?.name,
          date: c.commit.author?.date
        }));
      }

      const commits = await github.listCommits(repo, { sha, path, since });
      return commits.map(c => ({
        sha: c.sha.substring(0, 7),
        message: c.commit.message.split('\n')[0],
        author: c.author?.login || c.commit.author?.name,
        date: c.commit.author?.date
      }));
    },

    // ==================== Search ====================
    search_issues: async (input: unknown) => {
      const { query, repo, type, state } = input as {
        query: string;
        repo?: string;
        type?: 'issue' | 'pr';
        state?: 'open' | 'closed';
      };
      const results = await github.searchIssues(query, { repo, type, state });
      return results.map(i => ({
        number: i.number,
        title: i.title,
        state: i.state,
        url: i.html_url
      }));
    },

    search_code: async (input: unknown) => {
      const { query, repo, language, path } = input as {
        query: string;
        repo?: string;
        language?: string;
        path?: string;
      };
      const results = await github.searchCode(query, { repo, language, path });
      return results.map(r => ({
        path: r.path,
        repository: r.repository.full_name,
        url: r.html_url
      }));
    },

    // ==================== File Contents ====================
    get_file_contents: async (input: unknown) => {
      const { repo, path, ref } = input as {
        repo: string;
        path: string;
        ref?: string;
      };
      const file = await github.getFileContents(repo, path, ref);
      return {
        name: file.name,
        path: file.path,
        content: file.content.length > 10000
          ? file.content.substring(0, 10000) + '\n... (truncated)'
          : file.content,
        size: file.size
      };
    },

    // ==================== Milestones ====================
    list_milestones: async (input: unknown) => {
      const { repo, state } = input as { repo: string; state?: 'open' | 'closed' | 'all' };
      const milestones = await github.listMilestones(repo, state);
      return milestones.map(m => ({
        number: m.number,
        title: m.title,
        state: m.state,
        due_on: m.due_on,
        open_issues: m.open_issues,
        closed_issues: m.closed_issues,
        progress: m.open_issues + m.closed_issues > 0
          ? Math.round((m.closed_issues / (m.open_issues + m.closed_issues)) * 100)
          : 0
      }));
    },

    get_milestone_progress: async (input: unknown) => {
      const { repo, milestone_number } = input as { repo: string; milestone_number: number };
      const milestone = await github.getMilestone(repo, milestone_number);
      const total = milestone.open_issues + milestone.closed_issues;
      const progress = total > 0 ? (milestone.closed_issues / total) * 100 : 0;

      // Calculate estimated completion if there's a due date
      let estimatedCompletion: string | null = null;
      if (milestone.due_on && progress < 100) {
        const dueDate = new Date(milestone.due_on);
        const now = new Date();
        const daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const issuesPerDay = milestone.closed_issues > 0
          ? milestone.closed_issues / 7 // Assume 7-day average
          : 1;
        const daysNeeded = Math.ceil(milestone.open_issues / issuesPerDay);

        if (daysNeeded > daysRemaining) {
          estimatedCompletion = `At risk: ${daysNeeded - daysRemaining} days behind schedule`;
        } else {
          estimatedCompletion = `On track: ${daysRemaining - daysNeeded} days buffer`;
        }
      }

      return {
        number: milestone.number,
        title: milestone.title,
        description: milestone.description,
        state: milestone.state,
        due_on: milestone.due_on,
        open_issues: milestone.open_issues,
        closed_issues: milestone.closed_issues,
        total_issues: total,
        progress: Math.round(progress),
        estimated_completion: estimatedCompletion
      };
    },

    // ==================== Repository Info ====================
    get_repository_info: async (input: unknown) => {
      const { repo } = input as { repo: string };
      return github.getRepository(repo);
    },

    get_contributor_stats: async (input: unknown) => {
      const { repo } = input as { repo: string };
      const stats = await github.getContributorStats(repo);
      return stats
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map(s => ({
          username: s.author?.login || 'unknown',
          total_commits: s.total,
          recent_commits: s.weeks.slice(-4).reduce((sum, w) => sum + (w.c || 0), 0)
        }));
    },

    // ==================== Reporting ====================
    generate_daily_report: async (input: unknown) => {
      const { repo, date } = input as { repo: string; date?: string };

      if (temporalClient) {
        const client = temporalClient.getClient();
        const workflowId = `daily-report-tool-${uuid()}`;
        const handle = await client.workflow.start('dailyReportWorkflow', {
          taskQueue: temporalClient.getTaskQueue(),
          workflowId,
          args: [{ repos: [repo], date }],
        });
        const result = await handle.result();
        return result;
      }

      const reportDate = parseDate(date);
      const report = await reporting.generateDailyReport(repo, reportDate);

      return {
        date: formatDate(report.date),
        summary: {
          issues_opened: report.issues.opened.length,
          issues_closed: report.issues.closed.length,
          total_open_issues: report.issues.total_open,
          prs_opened: report.pullRequests.opened.length,
          prs_merged: report.pullRequests.merged.length,
          total_open_prs: report.pullRequests.total_open,
          commits: report.commits,
          active_contributors: report.contributors.length
        },
        highlights: report.highlights,
        blockers: report.blockers,
        contributors: report.contributors
      };
    },

    generate_weekly_report: async (input: unknown) => {
      const { repo, week_start } = input as { repo: string; week_start?: string };

      if (temporalClient) {
        const client = temporalClient.getClient();
        const workflowId = `weekly-report-tool-${uuid()}`;
        const handle = await client.workflow.start('weeklyReportWorkflow', {
          taskQueue: temporalClient.getTaskQueue(),
          workflowId,
          args: [{ repos: [repo], weekStart: week_start }],
        });
        const result = await handle.result();
        return result;
      }

      const startDate = week_start ? parseDate(week_start) : undefined;
      const report = await reporting.generateWeeklyReport(repo, startDate);

      return {
        week: `${formatDate(report.weekStart)} to ${formatDate(report.weekEnd)}`,
        summary: report.totals,
        velocity: {
          score: Math.round(report.velocity.score * 100) / 100,
          trend: report.velocity.trend,
          change: `${Math.round(report.velocity.change)}%`
        },
        health: {
          score: Math.round(report.health.score),
          rating: report.health.score >= 80 ? 'excellent' :
                  report.health.score >= 60 ? 'good' :
                  report.health.score >= 40 ? 'fair' : 'needs attention'
        },
        top_contributors: report.topContributors,
        recommendations: report.recommendations
      };
    },

    get_velocity_metrics: async (input: unknown) => {
      const { repo, period } = input as { repo: string; period: 'day' | 'week' | 'month' };
      return reporting.getVelocityMetrics(repo, period);
    },

    // ==================== Notifications ====================
    send_notification: async (input: unknown) => {
      const { channel, recipient, subject, body, priority } = input as {
        channel: 'email' | 'slack' | 'github_comment';
        recipient: string;
        subject?: string;
        body: string;
        priority?: 'low' | 'normal' | 'high';
      };

      if (temporalClient) {
        const client = temporalClient.getClient();
        const workflowId = `notification-tool-${uuid()}`;
        const handle = await client.workflow.start('notificationDeliveryWorkflow', {
          taskQueue: temporalClient.getTaskQueue(),
          workflowId,
          args: [{ channel, recipient, subject: subject || '', body, priority: priority ?? 'normal' }],
        });
        const result = await handle.result();
        return {
          success: result.success,
          channel: result.channel,
          recipient: result.recipient,
          message_id: result.messageId,
          error: result.error,
        };
      }

      const result = await notifications.send(channel, recipient, {
        subject: subject || '',
        body,
        priority
      });

      return {
        success: result.success,
        channel: result.channel,
        recipient: result.recipient,
        message_id: result.messageId,
        error: result.error
      };
    },

    // ==================== Activity Logging ====================
    log_activity: async (input: unknown) => {
      const { repo, action, target, details } = input as {
        repo: string;
        action: string;
        target: string;
        details?: Record<string, unknown>;
      };

      const project = await dataStore.getProject(repo);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      await dataStore.logActivity(project.id, action, target, details || {});
      return { success: true };
    },

    get_recent_activity: async (input: unknown) => {
      const { repo, limit } = input as { repo: string; limit?: number };

      const project = await dataStore.getProject(repo);
      if (!project) {
        return { error: 'Project not found', activities: [] };
      }

      const activities = await dataStore.getRecentActivity(project.id, limit || 50);
      return activities.map(a => ({
        action: a.action_type,
        target: a.action_target,
        details: a.action_details,
        timestamp: a.created_at
      }));
    }
  };
}
