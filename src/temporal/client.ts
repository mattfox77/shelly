/**
 * Temporal Client
 *
 * Manages the Temporal client connection for triggering workflows
 * and querying workflow state.
 */

import { Client, Connection } from '@temporalio/client';
import { loggers } from 'the-machina';

const TASK_QUEUE = 'shelly-workflows';

export class TemporalClient {
  private connection: Connection | null = null;
  private client: Client | null = null;
  private address: string;
  private namespace: string;

  constructor(address: string = 'localhost:7233', namespace: string = 'default') {
    this.address = address;
    this.namespace = namespace;
  }

  async connect(): Promise<void> {
    this.connection = await Connection.connect({ address: this.address });
    this.client = new Client({ connection: this.connection, namespace: this.namespace });
    loggers.app.info('Temporal client connected', { address: this.address, namespace: this.namespace });
  }

  getClient(): Client {
    if (!this.client) {
      throw new Error('Temporal client not connected. Call connect() first.');
    }
    return this.client;
  }

  getTaskQueue(): string {
    return TASK_QUEUE;
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
      this.client = null;
      loggers.app.info('Temporal client closed');
    }
  }

  async isHealthy(): Promise<boolean> {
    if (!this.connection) return false;
    try {
      await this.connection.healthService.check({});
      return true;
    } catch {
      return false;
    }
  }
}
