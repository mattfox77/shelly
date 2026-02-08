/**
 * Temporal Worker
 *
 * Sets up and runs the Temporal worker in-process.
 * Registers workflows (via bundled path) and activities.
 */

import { NativeConnection, Worker } from '@temporalio/worker';
import { createActivities, ActivityDependencies } from './activities';
import { loggers } from 'the-machina';

const TASK_QUEUE = 'shelly-workflows';

export interface WorkerConfig {
  address?: string;
  taskQueue?: string;
}

/**
 * Start the Temporal worker. Returns the Worker instance for shutdown.
 * The worker runs non-blocking via worker.run() (returns a Promise that
 * resolves on shutdown).
 */
export async function startWorker(
  deps: ActivityDependencies,
  config: WorkerConfig = {}
): Promise<Worker> {
  const address = config.address || 'localhost:7233';
  const taskQueue = config.taskQueue || TASK_QUEUE;

  const connection = await NativeConnection.connect({ address });
  const activities = createActivities(deps);

  const worker = await Worker.create({
    connection,
    taskQueue,
    workflowsPath: require.resolve('./workflows'),
    activities,
  });

  loggers.app.info('Temporal worker started', { taskQueue, address });

  // Run in background — the returned promise resolves when the worker shuts down
  worker.run().catch(err => {
    loggers.app.error('Temporal worker error', { error: (err as Error).message });
  });

  return worker;
}
