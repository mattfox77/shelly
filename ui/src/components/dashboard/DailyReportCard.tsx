'use client';

import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { DailyReport } from '@/hooks/useShelly';
import { formatDate } from '@/lib/utils';

interface DailyReportCardProps {
  reports: DailyReport[];
}

export function DailyReportCard({ reports }: DailyReportCardProps) {
  if (reports.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Daily Reports</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            No reports available yet
          </p>
        </CardBody>
      </Card>
    );
  }

  const latestReport = reports[0];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Daily Report</CardTitle>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {formatDate(latestReport.report_date)}
          </span>
        </div>
      </CardHeader>
      <CardBody>
        {/* Summary */}
        {latestReport.summary && (
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            {latestReport.summary}
          </p>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <MiniStat
            label="Issues Opened"
            value={latestReport.issues_opened}
            trend="up"
          />
          <MiniStat
            label="Issues Closed"
            value={latestReport.issues_closed}
            trend="down"
          />
          <MiniStat
            label="PRs Merged"
            value={latestReport.prs_merged}
          />
          <MiniStat
            label="Commits"
            value={latestReport.commits_count}
          />
        </div>

        {/* Highlights */}
        {latestReport.highlights && latestReport.highlights.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <CheckIcon className="h-4 w-4 text-green-500" />
              Highlights
            </h4>
            <ul className="space-y-1">
              {latestReport.highlights.map((highlight, i) => (
                <li
                  key={i}
                  className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2"
                >
                  <span className="text-green-500 mt-1">•</span>
                  {highlight}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Blockers */}
        {latestReport.blockers && latestReport.blockers.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <AlertIcon className="h-4 w-4 text-red-500" />
              Blockers
            </h4>
            <ul className="space-y-1">
              {latestReport.blockers.map((blocker, i) => (
                <li
                  key={i}
                  className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2"
                >
                  <span className="text-red-500 mt-1">•</span>
                  {blocker}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Previous Reports */}
        {reports.length > 1 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Previous Reports
            </h4>
            <div className="space-y-2">
              {reports.slice(1, 4).map(report => (
                <div
                  key={report.id}
                  className="flex items-center justify-between text-sm p-2 rounded bg-gray-50 dark:bg-gray-800/50"
                >
                  <span className="text-gray-600 dark:text-gray-400">
                    {formatDate(report.report_date)}
                  </span>
                  <div className="flex items-center gap-3 text-gray-500">
                    <span>{report.issues_closed} issues</span>
                    <span>{report.prs_merged} PRs</span>
                    <span>{report.commits_count} commits</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

interface MiniStatProps {
  label: string;
  value: number;
  trend?: 'up' | 'down';
}

function MiniStat({ label, value, trend }: MiniStatProps) {
  return (
    <div className="text-center p-2 rounded bg-gray-50 dark:bg-gray-800/50">
      <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
        {label}
        {trend === 'up' && <ArrowUpIcon className="h-3 w-3 text-yellow-500" />}
        {trend === 'down' && <ArrowDownIcon className="h-3 w-3 text-green-500" />}
      </p>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
}

function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function ArrowDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}
