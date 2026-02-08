/**
 * Dashboard API Routes
 *
 * Stats, reports, and activity endpoints for the dashboard.
 */

import { Router, Request, Response } from 'express';
import { ShellyDataStore } from '../../data/store';
import { GitHubClient } from '../../github';
import { TemporalClient } from '../../temporal/client';
import { loggers } from 'the-machina';
import { v4 as uuid } from 'uuid';

export function createDashboardRouter(
  dataStore: ShellyDataStore,
  github: GitHubClient,
  temporalClient?: TemporalClient
): Router {
  const router = Router();

  /**
   * GET /api/projects/:owner/:repo/stats
   * Live repository statistics
   */
  router.get('/projects/:owner/:repo/stats', async (req: Request, res: Response) => {
    try {
      const repo = `${req.params.owner}/${req.params.repo}`;

      // Get project from database
      const project = await dataStore.getProject(repo);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Use Temporal workflow if available, otherwise direct GitHub calls
      if (temporalClient) {
        const client = temporalClient.getClient();
        const workflowId = `repo-stats-${repo.replace('/', '-')}-${uuid()}`;
        const handle = await client.workflow.start('repoStatsWorkflow', {
          taskQueue: temporalClient.getTaskQueue(),
          workflowId,
          args: [{ repo }],
        });
        const stats = await handle.result();
        res.json(stats);
      } else {
        // Fallback: direct GitHub calls
        const [issues, prs, repoInfo] = await Promise.all([
          github.listIssues(repo, { state: 'open' }),
          github.listPullRequests(repo, { state: 'open' }),
          github.getRepository(repo)
        ]);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const commits = await github.listCommits(repo, {
          since: today.toISOString()
        });

        const stats = {
          repository: {
            name: repoInfo.name,
            full_name: repoInfo.full_name,
            description: repoInfo.description,
            stars: repoInfo.stargazers_count,
            forks: repoInfo.forks_count,
            default_branch: repoInfo.default_branch
          },
          issues: {
            open: issues.length,
            labels: groupByLabel(issues)
          },
          pullRequests: {
            open: prs.length,
            reviewPending: prs.filter(pr => !pr.requested_reviewers?.length).length,
            withReviewers: prs.filter(pr => pr.requested_reviewers?.length).length
          },
          today: {
            commits: commits.length,
            contributors: [...new Set(commits.map(c => c.author?.login).filter(Boolean))].length
          },
          lastUpdated: new Date().toISOString()
        };

        res.json(stats);
      }
    } catch (error) {
      loggers.app.error('Failed to get project stats', { error });
      res.status(500).json({ error: 'Failed to get project stats' });
    }
  });

  /**
   * GET /api/projects/:owner/:repo/reports/daily
   * Recent daily reports
   */
  router.get('/projects/:owner/:repo/reports/daily', async (req: Request, res: Response) => {
    try {
      const repo = `${req.params.owner}/${req.params.repo}`;
      const limit = Math.min(parseInt(req.query.limit as string) || 7, 30);

      const project = await dataStore.getProject(repo);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const reports = await dataStore.getRecentDailyReports(project.id, limit);
      res.json({ reports });
    } catch (error) {
      loggers.app.error('Failed to get daily reports', { error });
      res.status(500).json({ error: 'Failed to get daily reports' });
    }
  });

  /**
   * GET /api/projects/:owner/:repo/activity
   * Activity log with pagination
   */
  router.get('/projects/:owner/:repo/activity', async (req: Request, res: Response) => {
    try {
      const repo = `${req.params.owner}/${req.params.repo}`;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

      const project = await dataStore.getProject(repo);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const activity = await dataStore.getRecentActivity(project.id, limit);
      res.json({ activity });
    } catch (error) {
      loggers.app.error('Failed to get activity', { error });
      res.status(500).json({ error: 'Failed to get activity' });
    }
  });

  /**
   * GET /api/projects/:owner/:repo/velocity
   * Velocity metrics over time
   */
  router.get('/projects/:owner/:repo/velocity', async (req: Request, res: Response) => {
    try {
      const repo = `${req.params.owner}/${req.params.repo}`;
      const days = Math.min(parseInt(req.query.days as string) || 14, 90);

      const project = await dataStore.getProject(repo);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Get daily reports for velocity calculation
      const reports = await dataStore.getRecentDailyReports(project.id, days);

      const velocity = reports.map(report => ({
        date: report.report_date,
        issuesClosed: report.issues_closed,
        prsMerged: report.prs_merged,
        commits: report.commits_count,
        contributors: report.active_contributors
      })).reverse();

      res.json({ velocity });
    } catch (error) {
      loggers.app.error('Failed to get velocity metrics', { error });
      res.status(500).json({ error: 'Failed to get velocity metrics' });
    }
  });

  /**
   * GET /api/projects/:owner/:repo/contributors
   * Contributor statistics
   */
  router.get('/projects/:owner/:repo/contributors', async (req: Request, res: Response) => {
    try {
      const repo = `${req.params.owner}/${req.params.repo}`;

      const contributors = await github.getContributorStats(repo);

      res.json({ contributors });
    } catch (error) {
      loggers.app.error('Failed to get contributors', { error });
      res.status(500).json({ error: 'Failed to get contributors' });
    }
  });

  /**
   * GET /api/projects
   * List all tracked projects
   */
  router.get('/projects', async (req: Request, res: Response) => {
    try {
      const projects = await dataStore.listActiveProjects();
      res.json({ projects });
    } catch (error) {
      loggers.app.error('Failed to list projects', { error });
      res.status(500).json({ error: 'Failed to list projects' });
    }
  });

  return router;
}

// Helper to group issues by label
function groupByLabel(issues: Array<{ labels: Array<{ name: string }> }>): Record<string, number> {
  const labelCounts: Record<string, number> = {};
  for (const issue of issues) {
    for (const label of issue.labels || []) {
      labelCounts[label.name] = (labelCounts[label.name] || 0) + 1;
    }
  }
  return labelCounts;
}
