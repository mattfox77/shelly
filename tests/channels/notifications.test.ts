/**
 * Notification Channels Tests
 */

import {
  EmailChannel,
  SlackChannel,
  GitHubCommentChannel,
  NotificationService
} from '../../src/channels/notifications';

describe('EmailChannel', () => {
  let channel: EmailChannel;

  beforeEach(() => {
    channel = new EmailChannel();
  });

  describe('isConfigured', () => {
    it('should return false when not configured', () => {
      expect(channel.isConfigured()).toBe(false);
    });

    it('should return true when configured', () => {
      channel.configure({
        host: 'smtp.example.com',
        port: 587,
        user: 'test',
        pass: 'password',
        from: 'shelly@example.com'
      });

      expect(channel.isConfigured()).toBe(true);
    });
  });

  describe('send', () => {
    it('should fail when not configured', async () => {
      const result = await channel.send('test@example.com', {
        subject: 'Test',
        body: 'Test message'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('should send when configured', async () => {
      channel.configure({
        host: 'smtp.example.com',
        port: 587,
        user: 'test',
        pass: 'password',
        from: 'shelly@example.com'
      });

      const result = await channel.send('test@example.com', {
        subject: 'Test',
        body: 'Test message'
      });

      expect(result.success).toBe(true);
      expect(result.channel).toBe('email');
      expect(result.recipient).toBe('test@example.com');
      expect(result.messageId).toBeDefined();
    });
  });
});

describe('SlackChannel', () => {
  let channel: SlackChannel;

  beforeEach(() => {
    channel = new SlackChannel();
  });

  describe('isConfigured', () => {
    it('should return false when not configured', () => {
      expect(channel.isConfigured()).toBe(false);
    });

    it('should return true when webhook is configured', () => {
      channel.configure({ webhookUrl: 'https://hooks.slack.com/test' });
      expect(channel.isConfigured()).toBe(true);
    });

    it('should return true when bot token is configured', () => {
      channel.configure({ botToken: 'xoxb-test-token' });
      expect(channel.isConfigured()).toBe(true);
    });
  });

  describe('send', () => {
    it('should fail when not configured', async () => {
      const result = await channel.send('#general', {
        subject: 'Test',
        body: 'Test message'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('should send when configured', async () => {
      channel.configure({ webhookUrl: 'https://hooks.slack.com/test' });

      const result = await channel.send('#general', {
        subject: 'Test',
        body: 'Test message',
        priority: 'high'
      });

      expect(result.success).toBe(true);
      expect(result.channel).toBe('slack');
      expect(result.recipient).toBe('#general');
    });
  });
});

describe('GitHubCommentChannel', () => {
  let channel: GitHubCommentChannel;
  let mockAddComment: jest.Mock;

  beforeEach(() => {
    channel = new GitHubCommentChannel();
    mockAddComment = jest.fn().mockResolvedValue(undefined);
  });

  describe('isConfigured', () => {
    it('should return false when not configured', () => {
      expect(channel.isConfigured()).toBe(false);
    });

    it('should return true when configured', () => {
      channel.configure(mockAddComment);
      expect(channel.isConfigured()).toBe(true);
    });
  });

  describe('send', () => {
    it('should fail when not configured', async () => {
      const result = await channel.send('owner/repo#123', {
        subject: 'Update',
        body: 'Status update'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('should post comment when configured', async () => {
      channel.configure(mockAddComment);

      const result = await channel.send('owner/repo#123', {
        subject: 'Update',
        body: 'Status update'
      });

      expect(result.success).toBe(true);
      expect(mockAddComment).toHaveBeenCalledWith(
        'owner/repo',
        123,
        expect.stringContaining('Status update')
      );
    });

    it('should fail with invalid recipient format', async () => {
      channel.configure(mockAddComment);

      const result = await channel.send('invalid-format', {
        subject: 'Test',
        body: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid recipient format');
    });

    it('should include subject in body', async () => {
      channel.configure(mockAddComment);

      await channel.send('owner/repo#456', {
        subject: 'Important Update',
        body: 'Details here'
      });

      expect(mockAddComment).toHaveBeenCalledWith(
        'owner/repo',
        456,
        expect.stringContaining('**Important Update**')
      );
    });
  });
});

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    service = new NotificationService();
  });

  describe('registerChannel', () => {
    it('should register custom channels', () => {
      const customChannel = {
        name: 'custom',
        isConfigured: () => true,
        send: jest.fn().mockResolvedValue({ success: true, channel: 'custom', recipient: 'test' })
      };

      service.registerChannel(customChannel);

      expect(service.getChannel('custom')).toBe(customChannel);
    });
  });

  describe('getAvailableChannels', () => {
    it('should return empty array when no channels configured', () => {
      const available = service.getAvailableChannels();
      expect(available).toEqual([]);
    });

    it('should return configured channels', () => {
      const emailChannel = service.getChannel('email') as EmailChannel;
      emailChannel.configure({
        host: 'smtp.example.com',
        port: 587,
        user: 'test',
        pass: 'password',
        from: 'test@example.com'
      });

      const available = service.getAvailableChannels();
      expect(available).toContain('email');
    });
  });

  describe('send', () => {
    it('should fail for unknown channel', async () => {
      const result = await service.send('unknown', 'recipient', {
        subject: 'Test',
        body: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown channel');
    });

    it('should fail for unconfigured channel', async () => {
      const result = await service.send('email', 'test@example.com', {
        subject: 'Test',
        body: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('should send via configured channel', async () => {
      const emailChannel = service.getChannel('email') as EmailChannel;
      emailChannel.configure({
        host: 'smtp.example.com',
        port: 587,
        user: 'test',
        pass: 'password',
        from: 'test@example.com'
      });

      const result = await service.send('email', 'recipient@example.com', {
        subject: 'Test',
        body: 'Test message'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('broadcast', () => {
    it('should send to multiple recipients', async () => {
      const emailChannel = service.getChannel('email') as EmailChannel;
      emailChannel.configure({
        host: 'smtp.example.com',
        port: 587,
        user: 'test',
        pass: 'password',
        from: 'test@example.com'
      });

      const results = await service.broadcast(
        [
          { channel: 'email', address: 'user1@example.com' },
          { channel: 'email', address: 'user2@example.com' }
        ],
        { subject: 'Broadcast', body: 'Message to all' }
      );

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });
  });
});
