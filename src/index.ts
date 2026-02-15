/**
 * Shelly - GitHub Project Manager AI Agent
 *
 * Main entry point for the Shelly application.
 */

import 'dotenv/config';
import * as path from 'path';
import { loggers, BaseHealthServer } from 'the-machina';
import { ClaudeCLIAgent, Agent, tools, createToolHandlers } from './agent';
import { GitHubClient } from './github';
import { ShellyDataStore } from './data/store';
import { NotificationService } from './channels/notifications';
import { SandboxService } from './sandbox';
import { ReportingService } from './skills/reporting';
import { createApiRouter } from './api';
import { TemporalClient, startWorker } from './temporal';
import { SagaService } from './saga';
import type { Worker } from '@temporalio/worker';

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
  temporal: {
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    namespace: process.env.TEMPORAL_NAMESPACE || 'default'
  },
  saga: {
    baseUrl: process.env.SAGA_ORCHESTRATOR_URL || 'http://localhost:8002'
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

  // Initialize saga-orchestrator client (optional — graceful fallback if unavailable)
  let sagaService: SagaService | undefined;
  try {
    sagaService = new SagaService(config.saga.baseUrl);
    const sagaHealthy = await sagaService.isHealthy();
    loggers.app.info('Saga orchestrator client initialized', {
      baseUrl: config.saga.baseUrl,
      healthy: sagaHealthy,
    });
    if (!sagaHealthy) {
      loggers.app.warn('Saga orchestrator not reachable — saga features will use lazy connection');
    }
  } catch (error) {
    loggers.app.warn('Saga orchestrator unavailable — running without saga support', {
      error: (error as Error).message,
    });
    sagaService = undefined;
  }

  // Initialize Temporal (optional — graceful fallback if unavailable)
  let temporalClient: TemporalClient | undefined;
  let temporalWorker: Worker | undefined;
  try {
    temporalClient = new TemporalClient(config.temporal.address, config.temporal.namespace);
    await temporalClient.connect();
    loggers.app.info('Temporal client connected');

    const reportingService = new ReportingService({ github, dataStore });
    temporalWorker = await startWorker(
      { reportingService, dataStore, github, notificationService, sagaService },
      { address: config.temporal.address, namespace: config.temporal.namespace }
    );
    loggers.app.info('Temporal worker started');
  } catch (error) {
    loggers.app.warn('Temporal unavailable — running without workflow support', {
      error: (error as Error).message,
    });
    temporalClient = undefined;
    temporalWorker = undefined;
  }

  // Create API router
  const apiRouter = createApiRouter({
    dataStore,
    github,
    workspacePath: config.workspace.path,
    notificationService,
    sandboxService,
    temporalClient,
    sagaService,
  });

  // Start health check server
  const healthServer = new ShellyHealthServer({ dataStore, temporalClient, sagaService });

  // Mount API routes
  healthServer.use('/api', apiRouter);
  loggers.app.info('API routes mounted');

  await healthServer.start(config.server.port);
  loggers.app.info('Health server started', { port: config.server.port });

  if (process.env.NODE_ENV === 'development') {
    loggers.app.info('Running in development mode');
  }

  // Handle graceful shutdown
  const shutdown = async () => {
    loggers.app.info('Shutting down...');
    if (temporalWorker) {
      temporalWorker.shutdown();
      loggers.app.info('Temporal worker stopped');
    }
    if (temporalClient) {
      await temporalClient.close();
    }
    await healthServer.stop();
    await dataStore.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Health server extending BaseHealthServer
class ShellyHealthServer extends BaseHealthServer {
  private dataStore: ShellyDataStore;
  private temporalClient?: TemporalClient;
  private sagaService?: SagaService;

  constructor(deps: { dataStore: ShellyDataStore; temporalClient?: TemporalClient; sagaService?: SagaService }) {
    super({
      port: 8081,
      enableMetrics: true,
      serviceName: 'shelly',
      version: '1.0.0'
    });
    this.dataStore = deps.dataStore;
    this.temporalClient = deps.temporalClient;
    this.sagaService = deps.sagaService;
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

    // Check Temporal
    if (this.temporalClient) {
      try {
        const start = Date.now();
        const healthy = await this.temporalClient.isHealthy();
        checks.temporal = {
          name: 'temporal',
          status: healthy ? 'up' : 'down',
          responseTime: Date.now() - start,
          message: healthy ? undefined : 'Health check failed'
        };
      } catch (error) {
        checks.temporal = {
          name: 'temporal',
          status: 'down',
          message: (error as Error).message
        };
      }
    }

    // Check saga-orchestrator
    if (this.sagaService) {
      try {
        const start = Date.now();
        const healthy = await this.sagaService.isHealthy();
        checks.sagaOrchestrator = {
          name: 'saga-orchestrator',
          status: healthy ? 'up' : 'down',
          responseTime: Date.now() - start,
          message: healthy ? undefined : 'Health check failed'
        };
      } catch (error) {
        checks.sagaOrchestrator = {
          name: 'saga-orchestrator',
          status: 'down',
          message: (error as Error).message
        };
      }
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
export { TemporalClient } from './temporal';
export { SagaService } from './saga';
