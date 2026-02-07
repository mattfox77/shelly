'use client';

import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Activity } from '@/hooks/useShelly';
import { formatRelativeTime, cn } from '@/lib/utils';

interface ActivityFeedProps {
  activities: Activity[];
  loading?: boolean;
}

export function ActivityFeed({ activities, loading }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        <div className="max-h-96 overflow-y-auto scrollbar-thin">
          {activities.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No activity yet
            </p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {activities.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </ul>
          )}
          {loading && (
            <div className="p-4 text-center text-gray-500">Loading more...</div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

interface ActivityItemProps {
  activity: Activity;
}

function ActivityItem({ activity }: ActivityItemProps) {
  const { icon, color, label } = getActivityDisplay(activity.action_type);

  return (
    <li className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="flex items-start gap-3">
        <div className={cn('p-1.5 rounded-full', color)}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {label}
            </p>
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {formatRelativeTime(activity.created_at)}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
            {activity.action_target}
          </p>
          {activity.action_details && Object.keys(activity.action_details).length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {Object.entries(activity.action_details).slice(0, 3).map(([key, value]) => (
                <span
                  key={key}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                >
                  {key}: {String(value).slice(0, 20)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function getActivityDisplay(actionType: string): {
  icon: React.ReactNode;
  color: string;
  label: string;
} {
  switch (actionType) {
    case 'issue_created':
      return {
        icon: <IssueIcon className="h-4 w-4 text-yellow-600" />,
        color: 'bg-yellow-100 dark:bg-yellow-900/30',
        label: 'Issue Created',
      };
    case 'issue_closed':
      return {
        icon: <CheckIcon className="h-4 w-4 text-green-600" />,
        color: 'bg-green-100 dark:bg-green-900/30',
        label: 'Issue Closed',
      };
    case 'pr_opened':
      return {
        icon: <PRIcon className="h-4 w-4 text-blue-600" />,
        color: 'bg-blue-100 dark:bg-blue-900/30',
        label: 'PR Opened',
      };
    case 'pr_merged':
      return {
        icon: <MergeIcon className="h-4 w-4 text-purple-600" />,
        color: 'bg-purple-100 dark:bg-purple-900/30',
        label: 'PR Merged',
      };
    case 'comment_added':
      return {
        icon: <CommentIcon className="h-4 w-4 text-gray-600" />,
        color: 'bg-gray-100 dark:bg-gray-700',
        label: 'Comment Added',
      };
    case 'notification_sent':
      return {
        icon: <BellIcon className="h-4 w-4 text-pink-600" />,
        color: 'bg-pink-100 dark:bg-pink-900/30',
        label: 'Notification Sent',
      };
    case 'report_generated':
      return {
        icon: <ReportIcon className="h-4 w-4 text-indigo-600" />,
        color: 'bg-indigo-100 dark:bg-indigo-900/30',
        label: 'Report Generated',
      };
    default:
      return {
        icon: <ActivityIcon className="h-4 w-4 text-gray-600" />,
        color: 'bg-gray-100 dark:bg-gray-700',
        label: actionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      };
  }
}

function IssueIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
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

function MergeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function CommentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
    </svg>
  );
}

function ReportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 10-2 0v7a1 1 0 102 0V8z" clipRule="evenodd" />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
    </svg>
  );
}
