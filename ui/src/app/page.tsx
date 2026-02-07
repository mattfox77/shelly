'use client';

import { useState, useEffect } from 'react';
import { useShelly, Project, ProjectStats, DailyReport, Activity, VelocityData, Contributor } from '@/hooks/useShelly';
import { RepositoryStats } from '@/components/dashboard/RepositoryStats';
import { VelocityChart } from '@/components/dashboard/VelocityChart';
import { DailyReportCard } from '@/components/dashboard/DailyReportCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { ContributorStats } from '@/components/dashboard/ContributorStats';
import { LoadingPage } from '@/components/ui/Loading';

export default function DashboardPage() {
  const { getProjects, getProjectStats, getDailyReports, getActivity, getVelocity, getContributors } = useShelly();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [velocity, setVelocity] = useState<VelocityData[]>([]);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load projects on mount
  useEffect(() => {
    async function loadProjects() {
      try {
        const data = await getProjects();
        setProjects(data.projects);
        if (data.projects.length > 0) {
          setSelectedProject(data.projects[0]);
        }
      } catch (err) {
        setError('Failed to load projects');
      } finally {
        setLoading(false);
      }
    }
    loadProjects();
  }, [getProjects]);

  // Load project data when selected project changes
  useEffect(() => {
    if (!selectedProject) return;

    async function loadProjectData() {
      setLoading(true);
      setError(null);

      const [owner, repo] = selectedProject.github_repo.split('/');

      try {
        const [statsData, reportsData, activityData, velocityData, contributorsData] = await Promise.all([
          getProjectStats(owner, repo),
          getDailyReports(owner, repo),
          getActivity(owner, repo),
          getVelocity(owner, repo),
          getContributors(owner, repo),
        ]);

        setStats(statsData);
        setReports(reportsData.reports);
        setActivity(activityData.activity);
        setVelocity(velocityData.velocity);
        setContributors(contributorsData.contributors);
      } catch (err) {
        setError('Failed to load project data');
      } finally {
        setLoading(false);
      }
    }

    loadProjectData();
  }, [selectedProject, getProjectStats, getDailyReports, getActivity, getVelocity, getContributors]);

  if (loading && !stats) {
    return <LoadingPage />;
  }

  if (error && !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn btn-primary"
        >
          Retry
        </button>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          No Projects
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Add a project in the Admin panel to get started.
        </p>
        <a href="/admin" className="btn btn-primary">
          Go to Admin
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with project selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        {projects.length > 1 && (
          <select
            value={selectedProject?.github_repo || ''}
            onChange={(e) => {
              const project = projects.find(p => p.github_repo === e.target.value);
              if (project) setSelectedProject(project);
            }}
            className="input w-64"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.github_repo}>
                {project.github_repo}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Stats */}
      {stats && <RepositoryStats stats={stats} />}

      {/* Charts and Reports Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {velocity.length > 0 && <VelocityChart data={velocity} />}
        <DailyReportCard reports={reports} />
      </div>

      {/* Activity and Contributors Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivityFeed activities={activity} />
        <ContributorStats contributors={contributors} />
      </div>
    </div>
  );
}
