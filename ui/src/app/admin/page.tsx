'use client';

import { useState, useEffect } from 'react';
import { useShelly, Project, NotificationChannel, Settings } from '@/hooks/useShelly';
import { RepositoryManager } from '@/components/admin/RepositoryManager';
import { NotificationSettings } from '@/components/admin/NotificationSettings';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingPage } from '@/components/ui/Loading';

export default function AdminPage() {
  const {
    getProjects,
    getNotificationChannels,
    getSettings,
    updateSettings,
    configureChannel,
    testNotification,
    addProject,
    removeProject,
  } = useShelly();

  const [projects, setProjects] = useState<Project[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        const [projectsData, channelsData, settingsData] = await Promise.all([
          getProjects(),
          getNotificationChannels(),
          getSettings(),
        ]);

        setProjects(projectsData.projects);
        setChannels(channelsData.channels);
        setSettings(settingsData.settings);
      } catch {
        setError('Failed to load admin data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [getProjects, getNotificationChannels, getSettings]);

  const handleAddProject = async (repo: string, description?: string) => {
    const result = await addProject(repo, description);
    setProjects((prev) => [...prev, result.project]);
  };

  const handleRemoveProject = async (owner: string, repo: string) => {
    await removeProject(owner, repo);
    setProjects((prev) => prev.filter((p) => p.github_repo !== `${owner}/${repo}`));
  };

  const handleConfigureChannel = async (channel: string, config: Record<string, unknown>) => {
    await configureChannel(channel, config);
    // Refresh channels
    const channelsData = await getNotificationChannels();
    setChannels(channelsData.channels);
  };

  const handleTestNotification = async (channel: string, recipient: string) => {
    const result = await testNotification(channel, recipient);
    return result.result;
  };

  const handleUpdateSettings = async (newSettings: Partial<Settings>) => {
    if (!settings) return;

    setSaving(true);
    try {
      const merged = { ...settings, ...newSettings };
      const result = await updateSettings(merged);
      setSettings(result.settings);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingPage />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Admin Settings
      </h1>

      {/* Repository Manager */}
      <RepositoryManager
        projects={projects}
        onAdd={handleAddProject}
        onRemove={handleRemoveProject}
      />

      {/* Notification Settings */}
      <NotificationSettings
        channels={channels}
        onConfigure={handleConfigureChannel}
        onTest={handleTestNotification}
      />

      {/* Global Settings */}
      {settings && (
        <Card>
          <CardHeader>
            <CardTitle>Global Settings</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="label">Daily Report Time</label>
                <input
                  type="time"
                  value={settings.dailyReportTime}
                  onChange={(e) =>
                    handleUpdateSettings({ dailyReportTime: e.target.value })
                  }
                  className="input mt-1"
                />
              </div>

              <div>
                <label className="label">Weekly Report Day</label>
                <select
                  value={settings.weeklyReportDay}
                  onChange={(e) =>
                    handleUpdateSettings({ weeklyReportDay: e.target.value })
                  }
                  className="input mt-1"
                >
                  <option value="monday">Monday</option>
                  <option value="tuesday">Tuesday</option>
                  <option value="wednesday">Wednesday</option>
                  <option value="thursday">Thursday</option>
                  <option value="friday">Friday</option>
                </select>
              </div>

              <div>
                <label className="label">Stale PR Threshold (days)</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={settings.defaultStalePRDays}
                  onChange={(e) =>
                    handleUpdateSettings({
                      defaultStalePRDays: parseInt(e.target.value) || 3,
                    })
                  }
                  className="input mt-1"
                />
              </div>

              <div>
                <label className="label">Default Notification Channel</label>
                <select
                  value={settings.notificationDefaults.channel}
                  onChange={(e) =>
                    handleUpdateSettings({
                      notificationDefaults: {
                        ...settings.notificationDefaults,
                        channel: e.target.value,
                      },
                    })
                  }
                  className="input mt-1"
                >
                  {channels.map((ch) => (
                    <option key={ch.name} value={ch.name} disabled={!ch.configured}>
                      {ch.name.replace('_', ' ')} {!ch.configured && '(not configured)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {saving && (
              <p className="mt-4 text-sm text-gray-500">Saving...</p>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
