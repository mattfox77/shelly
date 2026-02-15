/**
 * Saga API Routes
 *
 * REST API for interacting with saga-orchestrator and launching
 * Shelly oversight workflows. Includes SSE event streaming via Redis pub/sub.
 */

import { Router, Request, Response } from 'express';
import { createClient } from 'redis';
import { SagaService } from '../../saga/service';
import { ShellyDataStore } from '../../data/store';
import { TemporalClient } from '../../temporal/client';
import { loggers } from 'the-machina';
import { v4 as uuid } from 'uuid';

export function createSagaRouter(
  sagaService: SagaService,
  dataStore: ShellyDataStore,
  temporalClient?: TemporalClient
): Router {
  const router = Router();

  /**
   * POST /api/saga/start
   * Start a saga with Shelly oversight (launches sagaOversightWorkflow)
   */
  router.post('/start', async (req: Request, res: Response) => {
    try {
      const {
        sagaId,
        config,
        autoHandleReviews,
        pollIntervalMs,
        maxReviewAttempts,
        notifyChannel,
        notifyRecipient,
      } = req.body || {};

      if (!sagaId) {
        return res.status(400).json({ error: 'sagaId is required' });
      }

      if (temporalClient) {
        const client = temporalClient.getClient();
        const workflowId = `saga-oversight-${sagaId}-${uuid().slice(0, 8)}`;

        const handle = await client.workflow.start('sagaOversightWorkflow', {
          taskQueue: temporalClient.getTaskQueue(),
          workflowId,
          args: [{
            sagaId,
            config,
            autoHandleReviews: autoHandleReviews ?? true,
            pollIntervalMs: pollIntervalMs ?? 30_000,
            maxReviewAttempts: maxReviewAttempts ?? 3,
            notifyChannel,
            notifyRecipient,
          }],
        });

        loggers.app.info('Started saga oversight workflow', { workflowId, sagaId });
        res.status(202).json({
          sagaId,
          workflowId: handle.workflowId,
          runId: handle.firstExecutionRunId,
          status: 'oversight_started',
        });
      } else {
        // Fallback: start saga directly without oversight
        const result = await sagaService.startSaga(sagaId, config);
        res.status(202).json(result);
      }
    } catch (error) {
      loggers.app.error('Failed to start saga', { error });
      res.status(500).json({ error: 'Failed to start saga' });
    }
  });

  /**
   * GET /api/saga/status/:sagaId
   * Get saga status (proxied from saga-orchestrator)
   */
  router.get('/status/:sagaId', async (req: Request, res: Response) => {
    try {
      const detail = await sagaService.getSagaStatus(req.params.sagaId);
      res.json(detail);
    } catch (error) {
      loggers.app.error('Failed to get saga status', { error, sagaId: req.params.sagaId });
      res.status(500).json({ error: 'Failed to get saga status' });
    }
  });

  /**
   * GET /api/saga/list
   * List all sagas (proxied from saga-orchestrator)
   */
  router.get('/list', async (_req: Request, res: Response) => {
    try {
      const sagas = await sagaService.listSagas();
      res.json({ sagas });
    } catch (error) {
      loggers.app.error('Failed to list sagas', { error });
      res.status(500).json({ error: 'Failed to list sagas' });
    }
  });

  /**
   * POST /api/saga/signal/:sagaId
   * Send a signal to a saga workflow
   */
  router.post('/signal/:sagaId', async (req: Request, res: Response) => {
    try {
      const { signal_type, decision, data } = req.body || {};
      if (!signal_type || !decision) {
        return res.status(400).json({ error: 'signal_type and decision are required' });
      }

      const result = await sagaService.sendSignal(
        req.params.sagaId,
        signal_type,
        decision,
        data
      );

      await dataStore.logActivity(null, 'saga_signal_sent', req.params.sagaId, {
        signal_type,
        decision,
      });

      res.json(result);
    } catch (error) {
      loggers.app.error('Failed to send saga signal', { error, sagaId: req.params.sagaId });
      res.status(500).json({ error: 'Failed to send signal' });
    }
  });

  /**
   * GET /api/saga/events/:sagaId
   * SSE stream of saga events via Redis pub/sub
   */
  router.get('/events/:sagaId', async (req: Request, res: Response) => {
    const { sagaId } = req.params;
    const redisUrl = process.env.SAGA_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6380';

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const subscriber = createClient({ url: redisUrl });
    let closed = false;

    try {
      await subscriber.connect();
      const channel = `saga:${sagaId}`;

      await subscriber.subscribe(channel, (message: string) => {
        if (closed) return;
        try {
          const event = JSON.parse(message);
          res.write(`event: ${event.type || 'message'}\ndata: ${message}\n\n`);
        } catch {
          res.write(`event: message\ndata: ${message}\n\n`);
        }
      });

      loggers.app.info('SSE saga event stream started', { sagaId, channel });
      res.write(`event: connected\ndata: ${JSON.stringify({ sagaId })}\n\n`);

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        if (closed) return;
        res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
      }, 30_000);

      req.on('close', async () => {
        closed = true;
        clearInterval(heartbeat);
        await subscriber.unsubscribe(channel).catch(() => {});
        await subscriber.quit().catch(() => {});
        loggers.app.info('SSE saga event stream closed', { sagaId });
      });
    } catch (error) {
      loggers.app.error('Failed to start saga event stream', { error, sagaId });
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Stream setup failed' })}\n\n`);
      res.end();
      await subscriber.quit().catch(() => {});
    }
  });

  /**
   * GET /api/saga/dimensions/:sagaId
   * Get dimensions for a saga (proxied from saga-orchestrator)
   */
  router.get('/dimensions/:sagaId', async (req: Request, res: Response) => {
    try {
      const dimensions = await sagaService.getSagaDimensions(req.params.sagaId);
      res.json({ dimensions });
    } catch (error) {
      loggers.app.error('Failed to get saga dimensions', { error, sagaId: req.params.sagaId });
      res.status(500).json({ error: 'Failed to get saga dimensions' });
    }
  });

  /**
   * GET /api/saga/oversight
   * List saga oversight records from Shelly's database
   */
  router.get('/oversight', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const records = await dataStore.listSagaOversight(limit);
      res.json({ records });
    } catch (error) {
      loggers.app.error('Failed to list saga oversight records', { error });
      res.status(500).json({ error: 'Failed to list oversight records' });
    }
  });

  /**
   * GET /api/saga/oversight/:sagaId
   * Get a specific saga oversight record
   */
  router.get('/oversight/:sagaId', async (req: Request, res: Response) => {
    try {
      const record = await dataStore.getSagaOversight(req.params.sagaId);
      if (!record) {
        return res.status(404).json({ error: 'Oversight record not found' });
      }
      res.json(record);
    } catch (error) {
      loggers.app.error('Failed to get saga oversight record', { error, sagaId: req.params.sagaId });
      res.status(500).json({ error: 'Failed to get oversight record' });
    }
  });

  return router;
}
