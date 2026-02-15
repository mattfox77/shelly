/**
 * Saga Orchestrator Types
 *
 * TypeScript interfaces matching the saga-orchestrator REST API responses.
 */

export interface SagaDimension {
  id: string;
  name: string;
  type: string;
  status: string;
  total_adventures: number;
  completed_adventures: number;
  failed_adventures: number;
  requires: string[];
  branch: string;
}

export interface SagaSummary {
  codename: string;
  name: string;
  repo_url: string;
  total_dimensions: number;
  completed_dimensions: number;
  collapsed_dimensions: number;
  running_dimensions: number;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface SagaDetail {
  saga: Record<string, unknown>;
  status: string;
  total_dimensions: number;
  completed_dimensions: number;
  collapsed_dimensions: number;
  running_dimensions: number;
  pending_dimensions: number;
  needs_human_review: boolean;
  pending_interrupt: unknown | null;
  messages: Array<Record<string, unknown>>;
  created_at: string | null;
  updated_at: string | null;
}

export interface StartSagaResponse {
  saga_id: string;
  status: string;
  message: string;
}

export interface SignalResponse {
  saga_id: string;
  signal_sent: boolean;
  message: string;
}

export interface SagaConfig {
  name: string;
  codename: string;
  repo_url: string;
  base_branch: string;
  slack_channel?: string;
  dimensions: Array<{
    id: string;
    name: string;
    type: string;
    requires?: string[];
    adventures?: Array<{
      name: string;
      prompt: string;
    }>;
  }>;
}