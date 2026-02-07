'use client';

import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Contributor } from '@/hooks/useShelly';

interface ContributorStatsProps {
  contributors: Contributor[];
}

export function ContributorStats({ contributors }: ContributorStatsProps) {
  // Sort by total commits and take top 10
  const topContributors = [...contributors]
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const maxCommits = topContributors[0]?.total || 1;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Top Contributors</CardTitle>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {contributors.length} total
          </span>
        </div>
      </CardHeader>
      <CardBody>
        {topContributors.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            No contributor data available
          </p>
        ) : (
          <div className="space-y-3">
            {topContributors.map((contributor, index) => (
              <ContributorRow
                key={contributor.author?.login || index}
                contributor={contributor}
                rank={index + 1}
                maxCommits={maxCommits}
              />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

interface ContributorRowProps {
  contributor: Contributor;
  rank: number;
  maxCommits: number;
}

function ContributorRow({ contributor, rank, maxCommits }: ContributorRowProps) {
  const login = contributor.author?.login || 'Unknown';
  const percentage = (contributor.total / maxCommits) * 100;

  // Calculate recent activity from weeks data
  const recentWeeks = contributor.weeks.slice(-4);
  const recentCommits = recentWeeks.reduce((sum, w) => sum + (w.c || 0), 0);
  const recentAdditions = recentWeeks.reduce((sum, w) => sum + (w.a || 0), 0);
  const recentDeletions = recentWeeks.reduce((sum, w) => sum + (w.d || 0), 0);

  return (
    <div className="flex items-center gap-3">
      {/* Rank */}
      <div className="w-6 text-center">
        <span className={`text-sm font-medium ${
          rank <= 3 ? 'text-primary-600' : 'text-gray-400'
        }`}>
          {rank}
        </span>
      </div>

      {/* Avatar */}
      <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-300">
        {login[0].toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {login}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {contributor.total} commits
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Recent stats */}
        <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span title="Recent commits (last 4 weeks)">
            {recentCommits} recent
          </span>
          <span className="text-green-600 dark:text-green-400" title="Lines added">
            +{formatNumber(recentAdditions)}
          </span>
          <span className="text-red-600 dark:text-red-400" title="Lines deleted">
            -{formatNumber(recentDeletions)}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}
