/**
 * Saga Service
 *
 * HTTP client for the saga-orchestrator REST API and Redis event subscriber.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const yaml = require('js-yaml');
import type {
  SagaSummary,
  SagaDetail,
  SagaDimension,
  StartSagaResponse,
  SignalResponse,
  SagaConfig,
} from './types';

export class SagaService {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.SAGA_ORCHESTRATOR_URL || 'http://localhost:8002';
  }

  async startSaga(sagaId: string, config?: SagaConfig): Promise<StartSagaResponse> {
    const body = config ? { config } : undefined;
    const res = await fetch(`${this.baseUrl}/api/sagas/${sagaId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      throw new Error(`Failed to start saga ${sagaId}: ${res.status} ${await res.text()}`);
    }
    return res.json() as Promise<StartSagaResponse>;
  }

  async getSagaStatus(sagaId: string): Promise<SagaDetail> {
    const res = await fetch(`${this.baseUrl}/api/sagas/${sagaId}`);
    if (!res.ok) {
      throw new Error(`Failed to get saga ${sagaId}: ${res.status} ${await res.text()}`);
    }
    return res.json() as Promise<SagaDetail>;
  }

  async listSagas(): Promise<SagaSummary[]> {
    const res = await fetch(`${this.baseUrl}/api/sagas`);
    if (!res.ok) {
      throw new Error(`Failed to list sagas: ${res.status} ${await res.text()}`);
    }
    return res.json() as Promise<SagaSummary[]>;
  }

  async getSagaDimensions(sagaId: string): Promise<SagaDimension[]> {
    const res = await fetch(`${this.baseUrl}/api/sagas/${sagaId}/dimensions`);
    if (!res.ok) {
      throw new Error(`Failed to get dimensions for saga ${sagaId}: ${res.status} ${await res.text()}`);
    }
    return res.json() as Promise<SagaDimension[]>;
  }

  async sendSignal(
    sagaId: string,
    signalType: string,
    decision: string,
    data?: Record<string, unknown>
  ): Promise<SignalResponse> {
    const res = await fetch(`${this.baseUrl}/api/sagas/${sagaId}/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signal_type: signalType,
        decision,
        data: data || {},
      }),
    });
    if (!res.ok) {
      throw new Error(`Failed to send signal to saga ${sagaId}: ${res.status} ${await res.text()}`);
    }
    return res.json() as Promise<SignalResponse>;
  }

  composeSagaConfig(analysis: {
    repo: string;
    name: string;
    codename: string;
    baseBranch?: string;
    slackChannel?: string;
    dimensions: Array<{
      id: string;
      name: string;
      type: string;
      requires?: string[];
      adventures?: Array<{ name: string; prompt: string }>;
    }>;
  }): string {
    const config: Record<string, unknown> = {
      saga: {
        name: analysis.name,
        codename: analysis.codename,
        repo_url: analysis.repo,
        base_branch: analysis.baseBranch || 'main',
        ...(analysis.slackChannel && { slack_channel: analysis.slackChannel }),
      },
      dimensions: analysis.dimensions.map(d => ({
        id: d.id,
        name: d.name,
        type: d.type,
        ...(d.requires?.length && { requires: d.requires }),
        ...(d.adventures?.length && { adventures: d.adventures }),
      })),
    };

    return yaml.dump(config, { lineWidth: 120, noRefs: true });
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }
}
