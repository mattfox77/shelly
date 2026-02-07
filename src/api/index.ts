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

export interface ApiDependencies {
  dataStore: ShellyDataStore;
  github: GitHubClient;
  workspacePath: string;
  notificationService: NotificationService;
  sandboxService: SandboxService;
}

/**
 * Create the main API router with all sub-routes mounted
 */
export function createApiRouter(deps: ApiDependencies): Router {
  const router = Router();

  // Mount dashboard routes
  router.use('/', createDashboardRouter(deps.dataStore, deps.github));

  // Mount chat routes - uses Claude CLI instead of API
  router.use('/chat', createChatRouter(deps.dataStore, deps.github, deps.workspacePath));

  // Mount admin routes
  router.use('/admin', createAdminRouter(deps.dataStore, deps.notificationService));

  // Mount sandbox routes
  router.use('/sandbox', createSandboxRouter(deps.dataStore, deps.sandboxService));

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
