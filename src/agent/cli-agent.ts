/**
 * Claude CLI Agent
 *
 * Uses Claude CLI (Claude Code) instead of direct API calls.
 * This allows using Claude's OAuth authentication from `claude login`
 * instead of requiring an API key.
 *
 * Includes Shelly's identity, personality (soul), and skills context
 * in every interaction.
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { loggers } from 'the-machina';

export interface CLIAgentConfig {
  workspacePath: string;
  claudePath?: string; // Path to claude CLI, defaults to 'claude'
  maxTurns?: number;
  allowedTools?: string[];
}

export interface CLIAgentResponse {
  result: string;
  session_id?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface StreamEvent {
  type: string;
  session_id?: string;
  event?: {
    type: string;
    delta?: {
      text?: string;
    };
    message?: {
      content?: Array<{ type: string; text?: string }>;
    };
  };
  result?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class ClaudeCLIAgent {
  private config: CLIAgentConfig;
  private sessionId?: string;
  private identity: string = '';
  private soul: string = '';
  private tools: string = '';
  private systemPrompt: string = '';

  constructor(config: CLIAgentConfig) {
    this.config = {
      claudePath: 'claude',
      maxTurns: 10,
      allowedTools: ['Read', 'Glob', 'Grep', 'Bash', 'Edit', 'Write'],
      ...config
    };

    // Load identity files on construction
    this.loadIdentity();
  }

  /**
   * Load Shelly's identity, soul, and tools documentation
   */
  private loadIdentity(): void {
    const workspacePath = this.config.workspacePath;

    // Load IDENTITY.md
    try {
      this.identity = fs.readFileSync(
        path.join(workspacePath, 'IDENTITY.md'),
        'utf-8'
      );
    } catch {
      this.identity = `# Shelly - GitHub Project Manager

You are Shelly, an AI-powered project manager that interfaces with GitHub to track issues, manage pull requests, coordinate development workflows, and provide actionable insights on project health.`;
    }

    // Load SOUL.md
    try {
      this.soul = fs.readFileSync(
        path.join(workspacePath, 'SOUL.md'),
        'utf-8'
      );
    } catch {
      this.soul = `## Core Personality

- **Organized**: You thrive on structure. Every issue belongs to a milestone, every PR needs a reviewer.
- **Proactive**: Surface problems before they become blockers.
- **Direct**: No unnecessary pleasantries. Status updates are bullet points, summaries are actionable.
- **Context-Aware**: Read between the lines and understand priorities.`;
    }

    // Load TOOLS.md
    try {
      this.tools = fs.readFileSync(
        path.join(workspacePath, 'TOOLS.md'),
        'utf-8'
      );
    } catch {
      this.tools = '';
    }

    // Build the system prompt
    this.systemPrompt = this.buildSystemPrompt();

    loggers.app.debug('Loaded Shelly identity', {
      identityLength: this.identity.length,
      soulLength: this.soul.length,
      toolsLength: this.tools.length,
      systemPromptLength: this.systemPrompt.length
    });
  }

  /**
   * Build the complete system prompt from identity files
   */
  private buildSystemPrompt(): string {
    const date = new Date().toISOString().split('T')[0];

    return `${this.identity}

## Personality & Communication Style
${this.soul}

${this.tools ? `## Available Skills & Tools\n${this.tools}` : ''}

## Current Date
${date}

## Guidelines
- Be direct and actionable in your responses
- When providing status updates, use bullet points
- Always suggest next steps when appropriate
- If you need to use a tool, explain why briefly
- Surface potential issues proactively
- Remember: "Keep the code flowing. Track the work. Surface what matters."`;
  }

  /**
   * Reload identity files (useful if they change)
   */
  reloadIdentity(): void {
    this.loadIdentity();
    loggers.app.info('Shelly identity reloaded');
  }

  /**
   * Check if Claude CLI is available and authenticated
   */
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(this.config.claudePath!, ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      proc.stdout.on('data', (data) => { output += data.toString(); });
      proc.stderr.on('data', (data) => { output += data.toString(); });

      proc.on('close', (code) => {
        if (code === 0) {
          loggers.app.info('Claude CLI available', { version: output.trim() });
          resolve(true);
        } else {
          loggers.app.warn('Claude CLI not available', { code, output });
          resolve(false);
        }
      });

      proc.on('error', () => {
        loggers.app.warn('Claude CLI not found');
        resolve(false);
      });
    });
  }

  /**
   * Process a message using Claude CLI with JSON output
   */
  async process(message: string): Promise<CLIAgentResponse> {
    const args = this.buildArgs(message, 'json');

    loggers.app.debug('Executing Claude CLI', {
      args: args.filter(a => !a.includes(message) && !a.includes(this.systemPrompt)).join(' '),
      messageLength: message.length,
      hasSystemPrompt: true
    });

    return new Promise((resolve, reject) => {
      const proc = spawn(this.config.claudePath!, args, {
        cwd: this.config.workspacePath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Close stdin immediately - Claude CLI doesn't need input
      proc.stdin?.end();

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code !== 0) {
          loggers.app.error('Claude CLI failed', { code, stderr });
          reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const response = JSON.parse(stdout);
          this.sessionId = response.session_id;

          loggers.app.debug('Claude CLI response', {
            sessionId: this.sessionId,
            resultLength: response.result?.length,
            usage: response.usage
          });

          resolve({
            result: response.result || '',
            session_id: response.session_id,
            usage: response.usage
          });
        } catch (error) {
          loggers.app.error('Failed to parse Claude CLI output', { stdout, error });
          reject(new Error(`Failed to parse response: ${stdout}`));
        }
      });

      proc.on('error', (error) => {
        loggers.app.error('Claude CLI spawn error', { error });
        reject(error);
      });
    });
  }

  /**
   * Process a message with streaming output
   * Yields StreamEvent objects as they arrive
   */
  async *processStream(message: string): AsyncGenerator<StreamEvent> {
    const args = this.buildArgs(message, 'stream-json');

    loggers.app.debug('Executing Claude CLI (streaming)', {
      messageLength: message.length,
      hasSystemPrompt: true
    });

    const proc = spawn(this.config.claudePath!, args, {
      cwd: this.config.workspacePath,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Close stdin immediately - Claude CLI doesn't need input
    proc.stdin?.end();

    let stderr = '';
    let exitCode: number | null = null;
    let exitResolve: (() => void) | null = null;

    // Set up close handler BEFORE we start reading
    const closePromise = new Promise<void>((resolve) => {
      exitResolve = resolve;
      proc.on('close', (code) => {
        exitCode = code;
        resolve();
      });
    });

    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    // Create async iterator from stdout
    const stdoutIterator = this.createLineIterator(proc);

    for await (const line of stdoutIterator) {
      if (!line.trim()) continue;

      try {
        const event: StreamEvent = JSON.parse(line);

        // Track session ID
        if (event.session_id && !this.sessionId) {
          this.sessionId = event.session_id;
        }

        yield event;
      } catch (error) {
        loggers.app.warn('Failed to parse stream event', { line, error });
      }
    }

    // Wait for close if not already closed
    await closePromise;

    // Only error if we didn't get a successful result
    // Claude CLI sometimes exits with code 1 even after successful completion
    // so we only throw if stderr has content
    if (exitCode !== 0 && stderr.trim()) {
      loggers.app.error('Claude CLI streaming failed', { code: exitCode, stderr });
      throw new Error(`Claude CLI exited with code ${exitCode}: ${stderr}`);
    }
  }

  /**
   * Continue the current conversation
   */
  async continue(message: string): Promise<CLIAgentResponse> {
    if (!this.sessionId) {
      return this.process(message);
    }

    const args = [
      '-p', message,
      '--resume', this.sessionId,
      '--output-format', 'json',
      '--max-turns', String(this.config.maxTurns)
    ];

    // System prompt is preserved in session, no need to re-add

    if (this.config.allowedTools?.length) {
      args.push('--allowedTools', this.config.allowedTools.join(','));
    }

    return new Promise((resolve, reject) => {
      const proc = spawn(this.config.claudePath!, args, {
        cwd: this.config.workspacePath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Close stdin immediately - Claude CLI doesn't need input
      proc.stdin?.end();

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const response = JSON.parse(stdout);
          resolve({
            result: response.result || '',
            session_id: response.session_id,
            usage: response.usage
          });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${stdout}`));
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * Continue with streaming
   */
  async *continueStream(message: string): AsyncGenerator<StreamEvent> {
    if (!this.sessionId) {
      yield* this.processStream(message);
      return;
    }

    const args = [
      '-p', message,
      '--resume', this.sessionId,
      '--output-format', 'stream-json',
      '--max-turns', String(this.config.maxTurns),
      '--verbose'
    ];

    if (this.config.allowedTools?.length) {
      args.push('--allowedTools', this.config.allowedTools.join(','));
    }

    const proc = spawn(this.config.claudePath!, args, {
      cwd: this.config.workspacePath,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Close stdin immediately - Claude CLI doesn't need input
    proc.stdin?.end();

    for await (const line of this.createLineIterator(proc)) {
      if (!line.trim()) continue;

      try {
        const event: StreamEvent = JSON.parse(line);
        if (event.session_id) this.sessionId = event.session_id;
        yield event;
      } catch (error) {
        loggers.app.warn('Failed to parse stream event', { line });
      }
    }
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * Set session ID (for resuming existing sessions)
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /**
   * Clear session (start fresh conversation)
   */
  clearSession(): void {
    this.sessionId = undefined;
  }

  /**
   * Get the current system prompt (for debugging)
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  private buildArgs(message: string, outputFormat: 'json' | 'stream-json'): string[] {
    const args = [
      '-p', message,
      '--output-format', outputFormat,
      '--max-turns', String(this.config.maxTurns)
    ];

    // Add system prompt with Shelly's identity
    if (this.systemPrompt && !this.sessionId) {
      args.push('--system-prompt', this.systemPrompt);
    }

    if (outputFormat === 'stream-json') {
      args.push('--verbose');
    }

    if (this.config.allowedTools?.length) {
      args.push('--allowedTools', this.config.allowedTools.join(','));
    }

    // Resume if we have an existing session
    if (this.sessionId) {
      args.push('--resume', this.sessionId);
    }

    return args;
  }

  private async *createLineIterator(proc: ChildProcess): AsyncGenerator<string> {
    const stdout = proc.stdout;
    if (!stdout) return;

    let buffer = '';

    for await (const chunk of stdout) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        yield line;
      }
    }

    // Yield any remaining content
    if (buffer.trim()) {
      yield buffer;
    }
  }
}
