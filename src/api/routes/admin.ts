/**
 * Admin API Routes
 *
 * Settings, notifications, and project management.
 */

import { Router, Request, Response } from 'express';
import { ShellyDataStore } from '../../data/store';
import { NotificationService, EmailChannel, SlackChannel } from '../../channels/notifications';
import { loggers } from 'the-machina';

export function createAdminRouter(
  dataStore: ShellyDataStore,
  notificationService: NotificationService
): Router {
  const router = Router();

  /**
   * GET /api/admin/notifications/channels
   * Get notification channel configurations
   */
  router.get('/notifications/channels', async (req: Request, res: Response) => {
    try {
      const channels = [
        {
          name: 'email',
          configured: notificationService.getChannel('email')?.isConfigured() ?? false,
          description: 'Email notifications via SMTP'
        },
        {
          name: 'slack',
          configured: notificationService.getChannel('slack')?.isConfigured() ?? false,
          description: 'Slack notifications via webhook or bot'
        },
        {
          name: 'github_comment',
          configured: notificationService.getChannel('github_comment')?.isConfigured() ?? false,
          description: 'Post comments on GitHub issues/PRs'
        }
      ];

      res.json({ channels });
    } catch (error) {
      loggers.app.error('Failed to get notification channels', { error });
      res.status(500).json({ error: 'Failed to get notification channels' });
    }
  });

  /**
   * PUT /api/admin/notifications/channels/:channel
   * Configure a notification channel
   */
  router.put('/notifications/channels/:channel', async (req: Request, res: Response) => {
    try {
      const { channel } = req.params;
      const config = req.body;

      switch (channel) {
        case 'email': {
          const emailChannel = notificationService.getChannel('email') as EmailChannel;
          if (!emailChannel) {
            return res.status(404).json({ error: 'Email channel not found' });
          }
          emailChannel.configure({
            host: config.host,
            port: config.port,
            user: config.user,
            pass: config.pass,
            from: config.from
          });
          break;
        }

        case 'slack': {
          const slackChannel = notificationService.getChannel('slack') as SlackChannel;
          if (!slackChannel) {
            return res.status(404).json({ error: 'Slack channel not found' });
          }
          slackChannel.configure({
            webhookUrl: config.webhookUrl,
            botToken: config.botToken
          });
          break;
        }

        default:
          return res.status(400).json({ error: `Unknown channel: ${channel}` });
      }

      loggers.app.info('Configured notification channel', { channel });
      res.json({ success: true, channel });
    } catch (error) {
      loggers.app.error('Failed to configure notification channel', { error });
      res.status(500).json({ error: 'Failed to configure channel' });
    }
  });

  /**
   * POST /api/admin/notifications/test
   * Send a test notification
   */
  router.post('/notifications/test', async (req: Request, res: Response) => {
    try {
      const { channel, recipient } = req.body;

      if (!channel || !recipient) {
        return res.status(400).json({ error: 'Channel and recipient required' });
      }

      const result = await notificationService.send(channel, recipient, {
        subject: 'Shelly Test Notification',
        body: 'This is a test notification from Shelly. If you received this, your notification channel is configured correctly!',
        priority: 'normal'
      });

      res.json({ result });
    } catch (error) {
      loggers.app.error('Failed to send test notification', { error });
      res.status(500).json({ error: 'Failed to send test notification' });
    }
  });

  /**
   * POST /api/admin/projects
   * Add a new project to track
   */
  router.post('/projects', async (req: Request, res: Response) => {
    try {
      const { repo, description } = req.body;

      if (!repo || !repo.match(/^[\w-]+\/[\w.-]+$/)) {
        return res.status(400).json({ error: 'Valid repository (owner/name) required' });
      }

      // Check if project already exists
      const existing = await dataStore.getProject(repo);
      if (existing) {
        return res.status(409).json({ error: 'Project already exists' });
      }

      const project = await dataStore.createProject(repo, description);

      loggers.app.info('Created project', { repo });
      res.status(201).json({ project });
    } catch (error) {
      loggers.app.error('Failed to create project', { error });
      res.status(500).json({ error: 'Failed to create project' });
    }
  });

  /**
   * PUT /api/admin/projects/:owner/:repo/settings
   * Update project settings
   */
  router.put('/projects/:owner/:repo/settings', async (req: Request, res: Response) => {
    try {
      const repo = `${req.params.owner}/${req.params.repo}`;
      const settings = req.body;

      const project = await dataStore.getProject(repo);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      await dataStore.updateProjectSettings(repo, settings);

      loggers.app.info('Updated project settings', { repo });
      res.json({ success: true });
    } catch (error) {
      loggers.app.error('Failed to update project settings', { error });
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  /**
   * DELETE /api/admin/projects/:owner/:repo
   * Remove a project (soft delete by setting is_active = false)
   */
  router.delete('/projects/:owner/:repo', async (req: Request, res: Response) => {
    try {
      const repo = `${req.params.owner}/${req.params.repo}`;

      const project = await dataStore.getProject(repo);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      await dataStore.query(
        'UPDATE projects SET is_active = false, updated_at = NOW() WHERE github_repo = $1',
        [repo]
      );

      loggers.app.info('Deactivated project', { repo });
      res.status(204).send();
    } catch (error) {
      loggers.app.error('Failed to delete project', { error });
      res.status(500).json({ error: 'Failed to delete project' });
    }
  });

  /**
   * GET /api/admin/settings
   * Get global settings
   */
  router.get('/settings', async (req: Request, res: Response) => {
    try {
      // Read settings from cache or defaults
      const cached = await dataStore.getCached('shelly:settings');
      const settings = cached ? JSON.parse(cached) : {
        dailyReportTime: '09:00',
        weeklyReportDay: 'monday',
        defaultStalePRDays: 3,
        notificationDefaults: {
          channel: 'slack',
          priority: 'normal'
        }
      };

      res.json({ settings });
    } catch (error) {
      loggers.app.error('Failed to get settings', { error });
      res.status(500).json({ error: 'Failed to get settings' });
    }
  });

  /**
   * PUT /api/admin/settings
   * Update global settings
   */
  router.put('/settings', async (req: Request, res: Response) => {
    try {
      const settings = req.body;

      // Cache settings (24 hour TTL, but this is just for fast access)
      await dataStore.cache('shelly:settings', JSON.stringify(settings), 86400);

      loggers.app.info('Updated global settings');
      res.json({ success: true, settings });
    } catch (error) {
      loggers.app.error('Failed to update settings', { error });
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  return router;
}
