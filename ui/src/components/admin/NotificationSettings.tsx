'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { NotificationChannel, NotificationResult } from '@/hooks/useShelly';
import { cn } from '@/lib/utils';

interface NotificationSettingsProps {
  channels: NotificationChannel[];
  onConfigure: (channel: string, config: Record<string, unknown>) => Promise<void>;
  onTest: (channel: string, recipient: string) => Promise<NotificationResult>;
}

export function NotificationSettings({
  channels,
  onConfigure,
  onTest,
}: NotificationSettingsProps) {
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<NotificationResult | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Channels</CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {channels.map((channel) => (
            <div key={channel.name} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <ChannelIcon channel={channel.name} />
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white capitalize">
                      {channel.name.replace('_', ' ')}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {channel.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      channel.configured
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    )}
                  >
                    {channel.configured ? 'Configured' : 'Not configured'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveChannel(
                      activeChannel === channel.name ? null : channel.name
                    )}
                  >
                    {activeChannel === channel.name ? 'Close' : 'Configure'}
                  </Button>
                </div>
              </div>

              {activeChannel === channel.name && (
                <ChannelConfiguration
                  channel={channel.name}
                  onConfigure={onConfigure}
                  onTest={async (recipient) => {
                    const result = await onTest(channel.name, recipient);
                    setTestResult(result);
                    return result;
                  }}
                  testResult={testResult?.channel === channel.name ? testResult : null}
                />
              )}
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

interface ChannelConfigurationProps {
  channel: string;
  onConfigure: (channel: string, config: Record<string, unknown>) => Promise<void>;
  onTest: (recipient: string) => Promise<NotificationResult>;
  testResult: NotificationResult | null;
}

function ChannelConfiguration({
  channel,
  onConfigure,
  onTest,
  testResult,
}: ChannelConfigurationProps) {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [testRecipient, setTestRecipient] = useState('');

  const handleSave = async () => {
    setLoading(true);
    try {
      await onConfigure(channel, config);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!testRecipient) return;
    setTesting(true);
    try {
      await onTest(testRecipient);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      {channel === 'email' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">SMTP Host</label>
            <input
              type="text"
              value={config.host || ''}
              onChange={(e) => setConfig({ ...config, host: e.target.value })}
              placeholder="smtp.example.com"
              className="input mt-1"
            />
          </div>
          <div>
            <label className="label">Port</label>
            <input
              type="number"
              value={config.port || ''}
              onChange={(e) => setConfig({ ...config, port: e.target.value })}
              placeholder="587"
              className="input mt-1"
            />
          </div>
          <div>
            <label className="label">Username</label>
            <input
              type="text"
              value={config.user || ''}
              onChange={(e) => setConfig({ ...config, user: e.target.value })}
              className="input mt-1"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              value={config.pass || ''}
              onChange={(e) => setConfig({ ...config, pass: e.target.value })}
              className="input mt-1"
            />
          </div>
          <div className="col-span-2">
            <label className="label">From Address</label>
            <input
              type="email"
              value={config.from || ''}
              onChange={(e) => setConfig({ ...config, from: e.target.value })}
              placeholder="shelly@example.com"
              className="input mt-1"
            />
          </div>
        </div>
      )}

      {channel === 'slack' && (
        <div className="space-y-4">
          <div>
            <label className="label">Webhook URL</label>
            <input
              type="url"
              value={config.webhookUrl || ''}
              onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
              placeholder="https://hooks.slack.com/services/..."
              className="input mt-1"
            />
          </div>
          <div className="text-center text-gray-400 text-sm">- or -</div>
          <div>
            <label className="label">Bot Token</label>
            <input
              type="password"
              value={config.botToken || ''}
              onChange={(e) => setConfig({ ...config, botToken: e.target.value })}
              placeholder="xoxb-..."
              className="input mt-1"
            />
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="mt-4 flex items-center justify-between">
        <Button onClick={handleSave} loading={loading}>
          Save Configuration
        </Button>
      </div>

      {/* Test Section */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Test Notification
        </h5>
        <div className="flex gap-2">
          <input
            type="text"
            value={testRecipient}
            onChange={(e) => setTestRecipient(e.target.value)}
            placeholder={channel === 'email' ? 'test@example.com' : '#channel'}
            className="input flex-1"
          />
          <Button
            variant="secondary"
            onClick={handleTest}
            loading={testing}
            disabled={!testRecipient}
          >
            Send Test
          </Button>
        </div>

        {testResult && (
          <div
            className={cn(
              'mt-2 p-2 rounded text-sm',
              testResult.success
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            )}
          >
            {testResult.success
              ? `Test sent successfully! (ID: ${testResult.messageId})`
              : `Failed: ${testResult.error}`}
          </div>
        )}
      </div>
    </div>
  );
}

function ChannelIcon({ channel }: { channel: string }) {
  const className = 'h-8 w-8';

  switch (channel) {
    case 'email':
      return (
        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
          <svg className={cn(className, 'text-blue-600')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
      );
    case 'slack':
      return (
        <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
          <svg className={cn(className, 'text-purple-600')} fill="currentColor" viewBox="0 0 24 24">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
          </svg>
        </div>
      );
    case 'github_comment':
      return (
        <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
          <svg className={cn(className, 'text-gray-700 dark:text-gray-300')} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
        </div>
      );
    default:
      return null;
  }
}
