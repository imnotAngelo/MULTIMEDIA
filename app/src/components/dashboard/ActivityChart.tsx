import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { cn } from '@/lib/utils';
import type { WeeklyActivity } from '@/types';

interface ActivityChartProps {
  data: WeeklyActivity[];
  className?: string;
}

type ChartType = 'xp' | 'lessons';

function ActivityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
        <p className="text-slate-300 text-sm font-medium mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-violet-400 text-sm">
            {entry.name === 'xp' ? 'XP Earned' : 'Lessons'}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export function ActivityChart({ data, className }: ActivityChartProps) {
  const [chartType, setChartType] = useState<ChartType>('xp');

  const chartData = data.map((item) => ({
    day: item.day,
    xp: item.xp,
    lessons: item.lessons,
  }));

  return (
    <div className={cn('bg-slate-900/60 border border-slate-800 rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-200">Weekly Activity</h3>
          <p className="text-sm text-slate-500">Your learning activity over the past week</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setChartType('xp')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
              chartType === 'xp'
                ? 'bg-violet-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            )}
          >
            XP
          </button>
          <button
            onClick={() => setChartType('lessons')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
              chartType === 'lessons'
                ? 'bg-violet-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            )}
          >
            Lessons
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'xp' ? (
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="xpGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <Tooltip content={<ActivityTooltip />} />
              <Area
                type="monotone"
                dataKey="xp"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#xpGradient)"
                name="xp"
              />
            </AreaChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <Tooltip content={<ActivityTooltip />} />
              <Bar
                dataKey="lessons"
                fill="#8b5cf6"
                radius={[4, 4, 0, 0]}
                name="lessons"
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
