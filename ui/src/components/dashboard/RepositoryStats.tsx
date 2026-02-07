'use client';

import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { ProjectStats } from '@/hooks/useShelly';

interface RepositoryStatsProps {
  stats: ProjectStats;
}

export function RepositoryStats({ stats }: RepositoryStatsProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{stats.repository.name}</CardTitle>
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <StarIcon className="h-4 w-4" />
              {stats.repository.stars}
            </span>
            <span className="flex items-center gap-1">
              <ForkIcon className="h-4 w-4" />
              {stats.repository.forks}
            </span>
          </div>
        </div>
        {stats.repository.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {stats.repository.description}
          </p>
        )}
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Open Issues"
            value={stats.issues.open}
            icon={<IssueIcon className="h-5 w-5 text-yellow-500" />}
          />
          <StatCard
            label="Open PRs"
            value={stats.pullRequests.open}
            icon={<PRIcon className="h-5 w-5 text-green-500" />}
          />
          <StatCard
            label="Commits Today"
            value={stats.today.commits}
            icon={<CommitIcon className="h-5 w-5 text-blue-500" />}
          />
          <StatCard
            label="Contributors Today"
            value={stats.today.contributors}
            icon={<UserIcon className="h-5 w-5 text-purple-500" />}
          />
        </div>

        {Object.keys(stats.issues.labels).length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Issues by Label
            </h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.issues.labels)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 8)
                .map(([label, count]) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    {label}
                    <span className="text-gray-500">{count}</span>
                  </span>
                ))}
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              PRs awaiting review: {stats.pullRequests.reviewPending}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              PRs with reviewers: {stats.pullRequests.withReviewers}
            </span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      {icon}
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </div>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function ForkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m-8 5h8m-4-10v20M5 5a2 2 0 012-2h10a2 2 0 012 2v0a2 2 0 01-2 2H7a2 2 0 01-2-2v0z" />
    </svg>
  );
}

function IssueIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
}

function PRIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  );
}

function CommitIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
