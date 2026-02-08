/**
 * Workflow API Routes
 *
 * REST API for managing Temporal workflow executions, triggers, and schedules.
 */

import { Router, Request, Response } from 'express';
import { TemporalClient } from '../../temporal/client';
import { ShellyDataStore } from '../../data/store';
import { loggers } from 'the-machina';
import { v4 as uuid } from 'uuid';

export function createWorkflowRouter(
  temporalClient: TemporalClient,
  dataStore: ShellyDataStore
): Router {
  const router = Router();

  function getClient() {
    return temporalClient.getClient();
  }

  /**
   * GET /api/workflows
   * List recent workflow executions
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const client = getClient();
      const workflows: Array<{
        workflowId: string;
        runId: string;
        type: string;
        status: string;
        startTime: Date | undefined;
      }> = [];

      const iterator = client.workflow.list({
        query: 'TaskQueue = "shelly-workflows" ORDER BY StartTime DESC',
      });

      let count = 0;
      const limit = parseInt(req.query.limit as string) || 50;
      for await (const workflow of iterator) {
        if (count >= limit) break;
        workflows.push({
          workflowId: workflow.workflowId,
          runId: workflow.runId,
          type: workflow.type,
          status: workflow.status.name,
          startTime: workflow.startTime,
        });
        count++;
      }

      res.json({ workflows });
    } catch (error) {
      loggers.app.error('Failed to list workflows', { error });
      res.status(500).json({ error: 'Failed to list workflows' });
    }
  });

  /**
   * GET /api/workflows/:workflowId
   * Get workflow execution status
   */
  router.get('/:workflowId', async (req: Request, res: Response) => {
    try {
      const client = getClient();
      const handle = client.workflow.getHandle(req.params.workflowId);
      const description = await handle.describe();

      res.json({
        workflowId: description.workflowId,
        runId: description.runId,
        type: description.type,
        status: description.status.name,
        startTime: description.startTime,
        closeTime: description.closeTime,
        executionTime: description.executionTime,
      });
    } catch (error) {
      loggers.app.error('Failed to get workflow', { error, workflowId: req.params.workflowId });
      res.status(500).json({ error: 'Failed to get workflow status' });
    }
  });

  /**
   * GET /api/workflows/:workflowId/result
   * Get completed workflow result
   */
  router.get('/:workflowId/result', async (req: Request, res: Response) => {
    try {
      const client = getClient();
      const handle = client.workflow.getHandle(req.params.workflowId);
      const result = await handle.result();

      res.json({ workflowId: req.params.workflowId, result });
    } catch (error) {
      loggers.app.error('Failed to get workflow result', { error, workflowId: req.params.workflowId });
      res.status(500).json({ error: 'Failed to get workflow result' });
    }
  });

  /**
   * POST /api/workflows/trigger/daily-report
   * Trigger daily report workflow
   */
  router.post('/trigger/daily-report', async (req: Request, res: Response) => {
    try {
      const { repos, date } = req.body || {};
      const client = getClient();
      const workflowId = `daily-report-${uuid()}`;

      const handle = await client.workflow.start('dailyReportWorkflow', {
        taskQueue: temporalClient.getTaskQueue(),
        workflowId,
        args: [{ repos, date }],
      });

      loggers.app.info('Triggered daily report workflow', { workflowId });
      res.status(202).json({
        workflowId: handle.workflowId,
        runId: handle.firstExecutionRunId,
      });
    } catch (error) {
      loggers.app.error('Failed to trigger daily report workflow', { error });
      res.status(500).json({ error: 'Failed to trigger workflow' });
    }
  });

  /**
   * POST /api/workflows/trigger/weekly-report
   * Trigger weekly report workflow
   */
  router.post('/trigger/weekly-report', async (req: Request, res: Response) => {
    try {
      const { repos, weekStart } = req.body || {};
      const client = getClient();
      const workflowId = `weekly-report-${uuid()}`;

      const handle = await client.workflow.start('weeklyReportWorkflow', {
        taskQueue: temporalClient.getTaskQueue(),
        workflowId,
        args: [{ repos, weekStart }],
      });

      loggers.app.info('Triggered weekly report workflow', { workflowId });
      res.status(202).json({
        workflowId: handle.workflowId,
        runId: handle.firstExecutionRunId,
      });
    } catch (error) {
      loggers.app.error('Failed to trigger weekly report workflow', { error });
      res.status(500).json({ error: 'Failed to trigger workflow' });
    }
  });

  /**
   * POST /api/workflows/trigger/stale-detection
   * Trigger stale detection workflow
   */
  router.post('/trigger/stale-detection', async (req: Request, res: Response) => {
    try {
      const { repos, staleDays, notifyChannel, notifyRecipient } = req.body || {};
      const client = getClient();
      const workflowId = `stale-detection-${uuid()}`;

      const handle = await client.workflow.start('staleDetectionWorkflow', {
        taskQueue: temporalClient.getTaskQueue(),
        workflowId,
        args: [{ repos, staleDays, notifyChannel, notifyRecipient }],
      });

      loggers.app.info('Triggered stale detection workflow', { workflowId });
      res.status(202).json({
        workflowId: handle.workflowId,
        runId: handle.firstExecutionRunId,
      });
    } catch (error) {
      loggers.app.error('Failed to trigger stale detection workflow', { error });
      res.status(500).json({ error: 'Failed to trigger workflow' });
    }
  });

  /**
   * POST /api/workflows/trigger/notification
   * Trigger durable notification workflow
   */
  router.post('/trigger/notification', async (req: Request, res: Response) => {
    try {
      const { channel, recipient, subject, body, priority } = req.body || {};

      if (!channel || !recipient || !subject || !body) {
        return res.status(400).json({ error: 'channel, recipient, subject, and body are required' });
      }

      const client = getClient();
      const workflowId = `notification-${uuid()}`;

      const handle = await client.workflow.start('notificationDeliveryWorkflow', {
        taskQueue: temporalClient.getTaskQueue(),
        workflowId,
        args: [{ channel, recipient, subject, body, priority }],
      });

      loggers.app.info('Triggered notification workflow', { workflowId });
      res.status(202).json({
        workflowId: handle.workflowId,
        runId: handle.firstExecutionRunId,
      });
    } catch (error) {
      loggers.app.error('Failed to trigger notification workflow', { error });
      res.status(500).json({ error: 'Failed to trigger workflow' });
    }
  });

  /**
   * POST /api/workflows/schedules/daily-report
   * Create or update a daily report schedule
   */
  router.post('/schedules/daily-report', async (req: Request, res: Response) => {
    try {
      const { cronExpression, repos, scheduleId: customId } = req.body || {};
      const cron = cronExpression || '0 9 * * *'; // Default: 9 AM daily
      const scheduleId = customId || 'daily-report-schedule';
      const client = getClient();

      const handle = client.schedule.getHandle(scheduleId);
      try {
        await handle.describe();
        // Schedule exists — update it
        await handle.update((prev) => ({
          ...prev,
          spec: { cronExpressions: [cron] },
          action: {
            type: 'startWorkflow' as const,
            workflowType: 'dailyReportWorkflow',
            taskQueue: temporalClient.getTaskQueue(),
            args: [{ repos }],
          },
        }));
        loggers.app.info('Updated daily report schedule', { scheduleId, cron });
        res.json({ scheduleId, cron, action: 'updated' });
      } catch {
        // Schedule doesn't exist — create it
        await client.schedule.create({
          scheduleId,
          spec: { cronExpressions: [cron] },
          action: {
            type: 'startWorkflow' as const,
            workflowType: 'dailyReportWorkflow',
            taskQueue: temporalClient.getTaskQueue(),
            args: [{ repos }],
          },
        });
        loggers.app.info('Created daily report schedule', { scheduleId, cron });
        res.status(201).json({ scheduleId, cron, action: 'created' });
      }
    } catch (error) {
      loggers.app.error('Failed to manage daily report schedule', { error });
      res.status(500).json({ error: 'Failed to manage schedule' });
    }
  });

  /**
   * POST /api/workflows/schedules/weekly-report
   * Create or update a weekly report schedule
   */
  router.post('/schedules/weekly-report', async (req: Request, res: Response) => {
    try {
      const { cronExpression, repos, scheduleId: customId } = req.body || {};
      const cron = cronExpression || '0 9 * * 1'; // Default: Monday 9 AM
      const scheduleId = customId || 'weekly-report-schedule';
      const client = getClient();

      const handle = client.schedule.getHandle(scheduleId);
      try {
        await handle.describe();
        await handle.update((prev) => ({
          ...prev,
          spec: { cronExpressions: [cron] },
          action: {
            type: 'startWorkflow' as const,
            workflowType: 'weeklyReportWorkflow',
            taskQueue: temporalClient.getTaskQueue(),
            args: [{ repos }],
          },
        }));
        loggers.app.info('Updated weekly report schedule', { scheduleId, cron });
        res.json({ scheduleId, cron, action: 'updated' });
      } catch {
        await client.schedule.create({
          scheduleId,
          spec: { cronExpressions: [cron] },
          action: {
            type: 'startWorkflow' as const,
            workflowType: 'weeklyReportWorkflow',
            taskQueue: temporalClient.getTaskQueue(),
            args: [{ repos }],
          },
        });
        loggers.app.info('Created weekly report schedule', { scheduleId, cron });
        res.status(201).json({ scheduleId, cron, action: 'created' });
      }
    } catch (error) {
      loggers.app.error('Failed to manage weekly report schedule', { error });
      res.status(500).json({ error: 'Failed to manage schedule' });
    }
  });

  /**
   * POST /api/workflows/schedules/stale-detection
   * Create or update a stale detection schedule
   */
  router.post('/schedules/stale-detection', async (req: Request, res: Response) => {
    try {
      const { cronExpression, repos, staleDays, notifyChannel, notifyRecipient, scheduleId: customId } = req.body || {};
      const cron = cronExpression || '0 10 * * *'; // Default: 10 AM daily
      const scheduleId = customId || 'stale-detection-schedule';
      const client = getClient();

      const handle = client.schedule.getHandle(scheduleId);
      try {
        await handle.describe();
        await handle.update((prev) => ({
          ...prev,
          spec: { cronExpressions: [cron] },
          action: {
            type: 'startWorkflow' as const,
            workflowType: 'staleDetectionWorkflow',
            taskQueue: temporalClient.getTaskQueue(),
            args: [{ repos, staleDays, notifyChannel, notifyRecipient }],
          },
        }));
        loggers.app.info('Updated stale detection schedule', { scheduleId, cron });
        res.json({ scheduleId, cron, action: 'updated' });
      } catch {
        await client.schedule.create({
          scheduleId,
          spec: { cronExpressions: [cron] },
          action: {
            type: 'startWorkflow' as const,
            workflowType: 'staleDetectionWorkflow',
            taskQueue: temporalClient.getTaskQueue(),
            args: [{ repos, staleDays, notifyChannel, notifyRecipient }],
          },
        });
        loggers.app.info('Created stale detection schedule', { scheduleId, cron });
        res.status(201).json({ scheduleId, cron, action: 'created' });
      }
    } catch (error) {
      loggers.app.error('Failed to manage stale detection schedule', { error });
      res.status(500).json({ error: 'Failed to manage schedule' });
    }
  });

  /**
   * GET /api/workflows/schedules
   * List all schedules
   */
  router.get('/schedules', async (req: Request, res: Response) => {
    try {
      const client = getClient();
      const schedules: Array<{
        scheduleId: string;
        info: unknown;
      }> = [];

      for await (const schedule of client.schedule.list()) {
        schedules.push({
          scheduleId: schedule.scheduleId,
          info: schedule,
        });
      }

      res.json({ schedules });
    } catch (error) {
      loggers.app.error('Failed to list schedules', { error });
      res.status(500).json({ error: 'Failed to list schedules' });
    }
  });

  /**
   * DELETE /api/workflows/schedules/:scheduleId
   * Delete a schedule
   */
  router.delete('/schedules/:scheduleId', async (req: Request, res: Response) => {
    try {
      const client = getClient();
      const handle = client.schedule.getHandle(req.params.scheduleId);
      await handle.delete();

      loggers.app.info('Deleted schedule', { scheduleId: req.params.scheduleId });
      res.status(204).send();
    } catch (error) {
      loggers.app.error('Failed to delete schedule', { error, scheduleId: req.params.scheduleId });
      res.status(500).json({ error: 'Failed to delete schedule' });
    }
  });

  /**
   * POST /api/workflows/:workflowId/cancel
   * Cancel a running workflow
   */
  router.post('/:workflowId/cancel', async (req: Request, res: Response) => {
    try {
      const client = getClient();
      const handle = client.workflow.getHandle(req.params.workflowId);
      await handle.cancel();

      loggers.app.info('Cancelled workflow', { workflowId: req.params.workflowId });
      res.json({ workflowId: req.params.workflowId, status: 'cancelled' });
    } catch (error) {
      loggers.app.error('Failed to cancel workflow', { error, workflowId: req.params.workflowId });
      res.status(500).json({ error: 'Failed to cancel workflow' });
    }
  });

  return router;
}
