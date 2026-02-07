/**
 * Shelly Agent Tools
 *
 * Tool definitions for the AI agent to interact with GitHub
 * and other services.
 */

import { Tool } from './core';
import { GitHubClient } from '../github/client';
import { ShellyDataStore } from '../data/store';

export const tools: Tool[] = [
  // Issue Management
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

  // Pull Request Management
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

  // Search
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

  // Milestones
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

  // Repository Info
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
  }
];

/**
 * Create tool handlers that connect to GitHub and database
 */
export function createToolHandlers(
  github: GitHubClient,
  dataStore: ShellyDataStore
): Record<string, (input: unknown) => Promise<unknown>> {
  return {
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

      // Log activity
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

      // Log activity
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

    get_repository_info: async (input: unknown) => {
      const { repo } = input as { repo: string };
      return github.getRepository(repo);
    }
  };
}
