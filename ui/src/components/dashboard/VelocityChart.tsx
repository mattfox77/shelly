'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { VelocityData } from '@/hooks/useShelly';
import { formatDate } from '@/lib/utils';

interface VelocityChartProps {
  data: VelocityData[];
}

export function VelocityChart({ data }: VelocityChartProps) {
  const chartData = data.map(d => ({
    ...d,
    date: formatDate(d.date),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Development Velocity</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                className="text-gray-500"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                className="text-gray-500"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgb(31, 41, 55)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="issuesClosed"
                name="Issues Closed"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="prsMerged"
                name="PRs Merged"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="commits"
                name="Commits"
                stroke="#a855f7"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <SummaryItem
            label="Avg Issues/Day"
            value={average(data.map(d => d.issuesClosed))}
            color="text-green-500"
          />
          <SummaryItem
            label="Avg PRs/Day"
            value={average(data.map(d => d.prsMerged))}
            color="text-blue-500"
          />
          <SummaryItem
            label="Avg Commits/Day"
            value={average(data.map(d => d.commits))}
            color="text-purple-500"
          />
        </div>
      </CardBody>
    </Card>
  );
}

interface SummaryItemProps {
  label: string;
  value: number;
  color: string;
}

function SummaryItem({ label, value, color }: SummaryItemProps) {
  return (
    <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <p className={`text-xl font-bold ${color}`}>{value.toFixed(1)}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
