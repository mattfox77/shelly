/**
 * Notification Channels
 *
 * Infrastructure for sending notifications via various channels.
 */

import { loggers } from 'the-machina';

export interface NotificationMessage {
  subject: string;
  body: string;
  priority?: 'low' | 'normal' | 'high';
  metadata?: Record<string, unknown>;
}

export interface NotificationResult {
  success: boolean;
  channel: string;
  recipient: string;
  messageId?: string;
  error?: string;
}

export interface NotificationChannel {
  name: string;
  send(recipient: string, message: NotificationMessage): Promise<NotificationResult>;
  isConfigured(): boolean;
}

/**
 * Email notification channel
 */
export class EmailChannel implements NotificationChannel {
  name = 'email';
  private smtpConfig?: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
  };

  configure(config: { host: string; port: number; user: string; pass: string; from: string }): void {
    this.smtpConfig = config;
  }

  isConfigured(): boolean {
    return !!this.smtpConfig;
  }

  async send(recipient: string, message: NotificationMessage): Promise<NotificationResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        channel: this.name,
        recipient,
        error: 'Email channel not configured'
      };
    }

    try {
      // In a real implementation, this would use nodemailer
      loggers.channels.info('Sending email notification', {
        to: recipient,
        subject: message.subject
      });

      // Simulate sending email
      const messageId = `<${Date.now()}@shelly.local>`;

      return {
        success: true,
        channel: this.name,
        recipient,
        messageId
      };
    } catch (error) {
      loggers.channels.error('Failed to send email', { error, recipient });
      return {
        success: false,
        channel: this.name,
        recipient,
        error: (error as Error).message
      };
    }
  }
}

/**
 * Slack notification channel
 */
export class SlackChannel implements NotificationChannel {
  name = 'slack';
  private webhookUrl?: string;
  private botToken?: string;

  configure(config: { webhookUrl?: string; botToken?: string }): void {
    this.webhookUrl = config.webhookUrl;
    this.botToken = config.botToken;
  }

  isConfigured(): boolean {
    return !!(this.webhookUrl || this.botToken);
  }

  async send(recipient: string, message: NotificationMessage): Promise<NotificationResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        channel: this.name,
        recipient,
        error: 'Slack channel not configured'
      };
    }

    try {
      loggers.channels.info('Sending Slack notification', {
        to: recipient,
        subject: message.subject
      });

      // Format message for Slack
      const slackMessage = {
        channel: recipient,
        text: `*${message.subject}*\n${message.body}`,
        attachments: message.priority === 'high' ? [{
          color: 'danger',
          text: 'High Priority'
        }] : undefined
      };

      // In a real implementation, this would use the Slack API
      const messageId = `slack-${Date.now()}`;

      return {
        success: true,
        channel: this.name,
        recipient,
        messageId
      };
    } catch (error) {
      loggers.channels.error('Failed to send Slack message', { error, recipient });
      return {
        success: false,
        channel: this.name,
        recipient,
        error: (error as Error).message
      };
    }
  }
}

/**
 * GitHub comment notification channel
 */
export class GitHubCommentChannel implements NotificationChannel {
  name = 'github_comment';
  private addCommentFn?: (repo: string, issueNumber: number, body: string) => Promise<void>;

  configure(addCommentFn: (repo: string, issueNumber: number, body: string) => Promise<void>): void {
    this.addCommentFn = addCommentFn;
  }

  isConfigured(): boolean {
    return !!this.addCommentFn;
  }

  async send(recipient: string, message: NotificationMessage): Promise<NotificationResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        channel: this.name,
        recipient,
        error: 'GitHub comment channel not configured'
      };
    }

    try {
      // recipient format: "owner/repo#123"
      const match = recipient.match(/^(.+\/.+)#(\d+)$/);
      if (!match) {
        throw new Error('Invalid recipient format. Expected "owner/repo#123"');
      }

      const [, repo, issueNumber] = match;

      const body = message.subject
        ? `**${message.subject}**\n\n${message.body}`
        : message.body;

      await this.addCommentFn!(repo, parseInt(issueNumber), body);

      loggers.channels.info('Posted GitHub comment', { repo, issueNumber });

      return {
        success: true,
        channel: this.name,
        recipient,
        messageId: `github-${repo}-${issueNumber}-${Date.now()}`
      };
    } catch (error) {
      loggers.channels.error('Failed to post GitHub comment', { error, recipient });
      return {
        success: false,
        channel: this.name,
        recipient,
        error: (error as Error).message
      };
    }
  }
}

/**
 * Notification service that manages all channels
 */
export class NotificationService {
  private channels: Map<string, NotificationChannel> = new Map();

  constructor() {
    // Register default channels
    this.registerChannel(new EmailChannel());
    this.registerChannel(new SlackChannel());
    this.registerChannel(new GitHubCommentChannel());
  }

  registerChannel(channel: NotificationChannel): void {
    this.channels.set(channel.name, channel);
  }

  getChannel(name: string): NotificationChannel | undefined {
    return this.channels.get(name);
  }

  getAvailableChannels(): string[] {
    return Array.from(this.channels.entries())
      .filter(([, channel]) => channel.isConfigured())
      .map(([name]) => name);
  }

  async send(
    channelName: string,
    recipient: string,
    message: NotificationMessage
  ): Promise<NotificationResult> {
    const channel = this.channels.get(channelName);

    if (!channel) {
      return {
        success: false,
        channel: channelName,
        recipient,
        error: `Unknown channel: ${channelName}`
      };
    }

    if (!channel.isConfigured()) {
      return {
        success: false,
        channel: channelName,
        recipient,
        error: `Channel not configured: ${channelName}`
      };
    }

    return channel.send(recipient, message);
  }

  async broadcast(
    recipients: Array<{ channel: string; address: string }>,
    message: NotificationMessage
  ): Promise<NotificationResult[]> {
    const results = await Promise.all(
      recipients.map(r => this.send(r.channel, r.address, message))
    );
    return results;
  }
}
