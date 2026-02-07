/**
 * Shelly - GitHub Project Manager AI Agent
 *
 * Main entry point for the Shelly application.
 */

import 'dotenv/config';
import * as path from 'path';
import { loggers, BaseHealthServer } from 'the-machina';
import { ClaudeCLIAgent } from './agent';
import { GitHubClient } from './github';
import { ShellyDataStore } from './data/store';
import { NotificationService } from './channels/notifications';
import { SandboxService } from './sandbox';
import { createApiRouter } from './api';

// Configuration
const config = {
  github: {
    token: process.env.GITHUB_TOKEN || ''
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'shelly',
    user: process.env.DB_USER || 'shelly',
    password: process.env.DB_PASSWORD || ''
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  server: {
    port: parseInt(process.env.PORT || '8081')
  },
  sandbox: {
    url: process.env.SANDBOX_AGENT_URL || 'http://localhost:2468'
  },
  workspace: {
    path: path.join(__dirname, '..', 'workspace')
  }
};

// Validate required configuration
function validateConfig(): void {
  const missing: string[] = [];

  if (!config.github.token) missing.push('GITHUB_TOKEN');

  if (missing.length > 0) {
    loggers.app.error('Missing required environment variables', { missing });
    process.exit(1);
  }
}

// Main application
async function main(): Promise<void> {
  loggers.app.info('Starting Shelly - GitHub Project Manager');

  validateConfig();

  // Initialize data store
  const dataStore = new ShellyDataStore();
  await dataStore.connect({
    db: config.database,
    redis: { url: config.redis.url }
  });
  loggers.app.info('Connected to database');

  // Initialize GitHub client
  const github = new GitHubClient({
    token: config.github.token
  });
  loggers.app.info('GitHub client initialized');

  // Check Claude CLI availability (for chat)
  const cliAgent = new ClaudeCLIAgent({ workspacePath: config.workspace.path });
  const cliAvailable = await cliAgent.isAvailable();
  loggers.app.info('Claude CLI status', { available: cliAvailable });
  if (!cliAvailable) {
    loggers.app.warn('Claude CLI not available - install with: npm install -g @anthropic-ai/claude-code');
  }

  // Initialize notification service
  const notificationService = new NotificationService();
  loggers.app.info('Notification service initialized');

  // Initialize sandbox service
  const sandboxService = new SandboxService({ baseUrl: config.sandbox.url });
  const sandboxAvailable = await sandboxService.isAvailable();
  loggers.app.info('Sandbox service initialized', { available: sandboxAvailable });

  // Create API router
  const apiRouter = createApiRouter({
    dataStore,
    github,
    workspacePath: config.workspace.path,
    notificationService,
    sandboxService
  });

  // Start health check server
  const healthServer = new ShellyHealthServer({ dataStore });

  // Mount API routes
  healthServer.use('/api', apiRouter);
  loggers.app.info('API routes mounted');

  await healthServer.start(config.server.port);
  loggers.app.info('Health server started', { port: config.server.port });

  // Example: Process a test message (remove in production)
  if (process.env.NODE_ENV === 'development') {
    loggers.app.info('Running in development mode');

    // Test the agent with a simple query
    const testRepo = process.env.TEST_REPO;
    if (testRepo) {
      loggers.app.info('Testing with repository', { repo: testRepo });
      const response = await agent.process(
        `Give me a quick status of the ${testRepo} repository - how many open issues and PRs are there?`,
        tools,
        toolHandlers
      );

      const textContent = response.content.find(c => c.type === 'text');
      if (textContent && 'text' in textContent) {
        loggers.app.info('Agent response', { text: textContent.text });
      }
    }
  }

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    loggers.app.info('Shutting down...');
    await healthServer.stop();
    await dataStore.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    loggers.app.info('Shutting down...');
    await healthServer.stop();
    await dataStore.close();
    process.exit(0);
  });
}

// Health server extending BaseHealthServer
class ShellyHealthServer extends BaseHealthServer {
  private dataStore: ShellyDataStore;

  constructor(deps: { dataStore: ShellyDataStore }) {
    super({
      port: 8081,
      enableMetrics: true,
      serviceName: 'shelly',
      version: '1.0.0'
    });
    this.dataStore = deps.dataStore;
  }

  protected async checkDependencies(): Promise<Record<string, { name: string; status: 'up' | 'down'; message?: string; responseTime?: number }>> {
    const checks: Record<string, { name: string; status: 'up' | 'down'; message?: string; responseTime?: number }> = {};

    // Check database
    try {
      const start = Date.now();
      await this.dataStore.query('SELECT 1 as health_check');
      checks.database = {
        name: 'database',
        status: 'up',
        responseTime: Date.now() - start
      };
    } catch (error) {
      checks.database = {
        name: 'database',
        status: 'down',
        message: (error as Error).message
      };
    }

    // Check Redis
    try {
      const start = Date.now();
      await this.dataStore.cache('health_check', 'ok', 1);
      checks.redis = {
        name: 'redis',
        status: 'up',
        responseTime: Date.now() - start
      };
    } catch (error) {
      checks.redis = {
        name: 'redis',
        status: 'down',
        message: (error as Error).message
      };
    }

    return checks;
  }
}

// Run the application
main().catch(error => {
  loggers.app.error('Failed to start Shelly', { error });
  process.exit(1);
});

// Export for testing
export { Agent, GitHubClient, ShellyDataStore, tools, createToolHandlers };
export { createApiRouter } from './api';
export { SandboxService } from './sandbox';
export { NotificationService } from './channels/notifications';
