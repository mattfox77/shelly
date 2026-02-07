/**
 * Shelly Agent Core
 *
 * The main AI agent that processes requests and uses tools
 * to manage GitHub projects.
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import { loggers } from 'the-machina';

export interface AgentConfig {
  model: string;
  apiKey: string;
  workspacePath: string;
  maxTokens?: number;
}

export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface AgentResponse {
  content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
  stop_reason: string | null;
  usage: { input_tokens: number; output_tokens: number };
}

export class Agent {
  private client!: Anthropic;
  private config!: AgentConfig;
  private identity!: string;
  private soul!: string;
  private toolsDoc!: string;
  private conversationHistory: Array<{ role: 'user' | 'assistant'; content: unknown }> = [];

  async init(config: AgentConfig): Promise<void> {
    this.config = config;

    this.client = new Anthropic({
      apiKey: config.apiKey
    });

    // Load identity files
    await this.loadIdentity();

    loggers.app.info('Shelly agent initialized', {
      model: config.model,
      workspacePath: config.workspacePath
    });
  }

  private async loadIdentity(): Promise<void> {
    const workspacePath = this.config.workspacePath;

    try {
      this.identity = fs.readFileSync(
        path.join(workspacePath, 'IDENTITY.md'),
        'utf-8'
      );
    } catch {
      this.identity = 'You are Shelly, a GitHub project manager AI.';
    }

    try {
      this.soul = fs.readFileSync(
        path.join(workspacePath, 'SOUL.md'),
        'utf-8'
      );
    } catch {
      this.soul = 'Be helpful, organized, and proactive.';
    }

    try {
      this.toolsDoc = fs.readFileSync(
        path.join(workspacePath, 'TOOLS.md'),
        'utf-8'
      );
    } catch {
      this.toolsDoc = '';
    }

    loggers.app.debug('Loaded identity files', {
      identityLength: this.identity.length,
      soulLength: this.soul.length,
      toolsLength: this.toolsDoc.length
    });
  }

  private buildSystemPrompt(): string {
    return `${this.identity}

## Personality & Communication Style
${this.soul}

## Available Tools
${this.toolsDoc}

## Current Date
${new Date().toISOString().split('T')[0]}

## Guidelines
- Be direct and actionable in your responses
- When providing status updates, use bullet points
- Always suggest next steps when appropriate
- If you need to use a tool, explain why briefly
- Surface potential issues proactively`;
  }

  async process(
    userMessage: string,
    tools: Tool[] = [],
    toolHandlers?: Record<string, (input: unknown) => Promise<unknown>>
  ): Promise<AgentResponse> {
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    loggers.app.debug('Processing message', {
      messageLength: userMessage.length,
      toolCount: tools.length
    });

    let response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens || 4096,
      system: this.buildSystemPrompt(),
      messages: this.conversationHistory as Anthropic.MessageParam[],
      tools: tools.length > 0 ? tools as Anthropic.Tool[] : undefined
    });

    // Handle tool use loop
    while (response.stop_reason === 'tool_use' && toolHandlers) {
      const toolUseBlocks = response.content.filter(
        block => block.type === 'tool_use'
      );

      const toolResults: ToolResult[] = [];

      for (const block of toolUseBlocks) {
        if (block.type !== 'tool_use') continue;

        const handler = toolHandlers[block.name];
        if (!handler) {
          toolResults.push({
            tool_use_id: block.id,
            content: `Error: Unknown tool "${block.name}"`,
            is_error: true
          });
          continue;
        }

        try {
          loggers.app.debug('Executing tool', { tool: block.name });
          const result = await handler(block.input);
          toolResults.push({
            tool_use_id: block.id,
            content: typeof result === 'string' ? result : JSON.stringify(result)
          });
        } catch (error) {
          loggers.app.error('Tool execution failed', { tool: block.name, error });
          toolResults.push({
            tool_use_id: block.id,
            content: `Error: ${(error as Error).message}`,
            is_error: true
          });
        }
      }

      // Add assistant response and tool results to history
      this.conversationHistory.push({
        role: 'assistant',
        content: response.content
      });

      this.conversationHistory.push({
        role: 'user',
        content: toolResults.map(r => ({
          type: 'tool_result' as const,
          tool_use_id: r.tool_use_id,
          content: r.content,
          is_error: r.is_error
        }))
      });

      // Get next response
      response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens || 4096,
        system: this.buildSystemPrompt(),
        messages: this.conversationHistory as Anthropic.MessageParam[],
        tools: tools as Anthropic.Tool[]
      });
    }

    // Add final response to history
    this.conversationHistory.push({
      role: 'assistant',
      content: response.content
    });

    loggers.app.debug('Response generated', {
      stopReason: response.stop_reason,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens
    });

    return {
      content: response.content,
      stop_reason: response.stop_reason,
      usage: response.usage
    };
  }

  getConversationHistory(): Array<{ role: string; content: unknown }> {
    return [...this.conversationHistory];
  }

  clearConversationHistory(): void {
    this.conversationHistory = [];
    loggers.app.debug('Conversation history cleared');
  }

  async reloadIdentity(): Promise<void> {
    await this.loadIdentity();
    loggers.app.info('Identity reloaded');
  }
}
