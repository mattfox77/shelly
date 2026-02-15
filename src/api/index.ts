/**
 * Shelly API Router
 *
 * Main router that combines all API routes.
 */

import { Router } from 'express';
import { ShellyDataStore } from '../data/store';
import { GitHubClient } from '../github';
import { NotificationService } from '../channels/notifications';
import { SandboxService } from '../sandbox';

import { createDashboardRouter } from './routes/dashboard';
import { createChatRouter } from './routes/chat';
import { createAdminRouter } from './routes/admin';
import { createSandboxRouter } from './routes/sandbox';
import { createWorkflowRouter } from './routes/workflows';
import { createSagaRouter } from './routes/saga';
import { TemporalClient } from '../temporal/client';
import { SagaService } from '../saga/service';

export interface ApiDependencies {
  dataStore: ShellyDataStore;
  github: GitHubClient;
  workspacePath: string;
  notificationService: NotificationService;
  sandboxService: SandboxService;
  temporalClient?: TemporalClient;
  sagaService?: SagaService;
}

/**
 * Create the main API router with all sub-routes mounted
 */
export function createApiRouter(deps: ApiDependencies): Router {
  const router = Router();

  // Mount dashboard routes
  router.use('/', createDashboardRouter(deps.dataStore, deps.github, deps.temporalClient));

  // Mount chat routes - uses Claude CLI instead of API
  router.use('/chat', createChatRouter(deps.dataStore, deps.github, deps.workspacePath));

  // Mount admin routes
  router.use('/admin', createAdminRouter(deps.dataStore, deps.notificationService, deps.temporalClient));

  // Mount sandbox routes
  router.use('/sandbox', createSandboxRouter(deps.dataStore, deps.sandboxService));

  // Mount workflow routes (only if Temporal is available)
  if (deps.temporalClient) {
    router.use('/workflows', createWorkflowRouter(deps.temporalClient, deps.dataStore));
  }

  // Mount saga routes (only if SagaService is available)
  if (deps.sagaService) {
    router.use('/saga', createSagaRouter(deps.sagaService, deps.dataStore, deps.temporalClient));
  }

  // API info endpoint
  router.get('/', (req, res) => {
    res.json({
      name: 'Shelly API',
      version: '1.0.0',
      endpoints: {
        dashboard: {
          'GET /api/projects': 'List tracked projects',
          'GET /api/projects/:owner/:repo/stats': 'Live repository stats',
          'GET /api/projects/:owner/:repo/reports/daily': 'Daily reports',
          'GET /api/projects/:owner/:repo/activity': 'Activity log',
          'GET /api/projects/:owner/:repo/velocity': 'Velocity metrics',
          'GET /api/projects/:owner/:repo/contributors': 'Contributor stats'
        },
        chat: {
          'GET /api/chat/sessions': 'List chat sessions',
          'POST /api/chat/sessions': 'Create chat session',
          'GET /api/chat/sessions/:id': 'Get session with messages',
          'POST /api/chat/sessions/:id/messages': 'Send message (SSE response)',
          'DELETE /api/chat/sessions/:id': 'Delete session'
        },
        admin: {
          'GET /api/admin/settings': 'Get global settings',
          'PUT /api/admin/settings': 'Update global settings',
          'GET /api/admin/notifications/channels': 'List notification channels',
          'PUT /api/admin/notifications/channels/:channel': 'Configure channel',
          'POST /api/admin/notifications/test': 'Send test notification',
          'POST /api/admin/projects': 'Add project to track',
          'PUT /api/admin/projects/:owner/:repo/settings': 'Update project settings',
          'DELETE /api/admin/projects/:owner/:repo': 'Remove project'
        },
        sandbox: {
          'GET /api/sandbox/agents': 'List available agents',
          'GET /api/sandbox/sessions': 'List sandbox sessions',
          'POST /api/sandbox/sessions': 'Create sandbox session',
          'GET /api/sandbox/sessions/:id': 'Get session details',
          'POST /api/sandbox/sessions/:id/messages': 'Send message to agent',
          'POST /api/sandbox/sessions/:id/permissions': 'Respond to permission',
          'POST /api/sandbox/sessions/:id/questions': 'Answer agent question',
          'GET /api/sandbox/sessions/:id/events/stream': 'SSE event stream',
          'DELETE /api/sandbox/sessions/:id': 'Terminate session'
        },
        workflows: {
          'GET /api/workflows': 'List recent workflow executions',
          'GET /api/workflows/:workflowId': 'Get workflow status',
          'GET /api/workflows/:workflowId/result': 'Get workflow result',
          'POST /api/workflows/trigger/daily-report': 'Trigger daily report workflow',
          'POST /api/workflows/trigger/weekly-report': 'Trigger weekly report workflow',
          'POST /api/workflows/trigger/stale-detection': 'Trigger stale detection workflow',
          'POST /api/workflows/trigger/notification': 'Trigger notification workflow',
          'POST /api/workflows/schedules/daily-report': 'Create/update daily report schedule',
          'POST /api/workflows/schedules/weekly-report': 'Create/update weekly report schedule',
          'POST /api/workflows/schedules/stale-detection': 'Create/update stale detection schedule',
          'GET /api/workflows/schedules': 'List all schedules',
          'DELETE /api/workflows/schedules/:scheduleId': 'Delete a schedule',
          'POST /api/workflows/:workflowId/cancel': 'Cancel running workflow'
        },
        saga: {
          'POST /api/saga/start': 'Start saga with Shelly oversight',
          'GET /api/saga/status/:sagaId': 'Get saga status',
          'GET /api/saga/list': 'List all sagas',
          'POST /api/saga/signal/:sagaId': 'Send signal to saga workflow',
          'GET /api/saga/events/:sagaId': 'SSE stream of saga events',
          'GET /api/saga/dimensions/:sagaId': 'Get saga dimensions',
          'GET /api/saga/oversight': 'List saga oversight records',
          'GET /api/saga/oversight/:sagaId': 'Get specific oversight record'
        }
      }
    });
  });

  return router;
}

// Re-export individual route creators for testing
export { createDashboardRouter } from './routes/dashboard';
export { createChatRouter } from './routes/chat';
export { createAdminRouter } from './routes/admin';
export { createSandboxRouter } from './routes/sandbox';
export { createWorkflowRouter } from './routes/workflows';
export { createSagaRouter } from './routes/saga';
