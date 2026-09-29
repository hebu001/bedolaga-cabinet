// Original per-page statistics cards from codex/cabinet-ux-performance-20260906.
import type { ReactNode } from 'react';

interface AdminDashboardStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  color: 'accent' | 'success' | 'warning' | 'error' | 'info';
  trend?: {
    value: number;
    label: string;
  };
}

export function AdminDashboardStatCard({
  title,
  value,
  subtitle,
  icon,
  color,
  trend,
}: AdminDashboardStatCardProps) {
  const colorClasses = {
    accent: 'bg-[#F97315]/15 text-[#F97315]',
    success: 'bg-apple-green/15 text-apple-green',
    warning: 'bg-apple-amber/15 text-apple-amber',
    error: 'bg-apple-red/15 text-apple-red',
    info: 'bg-apple-blue/15 text-apple-blue',
  };

  return (
    <div className="apple-card-grad rounded-2xl bg-apple-card p-5 transition-colors">
      <div className="mb-3 flex items-start justify-between">
        <div className={`rounded-lg p-2.5 ${colorClasses[color]}`}>{icon}</div>
        {trend && (
          <div
            className={`rounded-full px-2 py-1 text-xs ${trend.value >= 0 ? 'bg-apple-green/15 text-apple-green' : 'bg-apple-red/15 text-apple-red'}`}
          >
            {trend.value >= 0 ? '+' : ''}
            {trend.value}% {trend.label}
          </div>
        )}
      </div>
      <div className="mb-1 text-2xl font-bold text-apple-ink">{value}</div>
      <div className="text-sm text-apple-mute">{title}</div>
      {subtitle && <div className="mt-1 text-xs text-apple-faint">{subtitle}</div>}
    </div>
  );
}

interface AdminPaymentsStatCardProps {
  label: string;
  value: number;
  color: 'blue' | 'amber' | 'green' | 'red';
  isActive: boolean;
  onClick: () => void;
}

export function AdminPaymentsStatCard({
  label,
  value,
  color,
  isActive,
  onClick,
}: AdminPaymentsStatCardProps) {
  const colors: Record<string, string> = {
    blue: 'bg-apple-blue/15 text-apple-blue',
    amber: 'bg-apple-amber/15 text-apple-amber',
    green: 'bg-apple-green/15 text-apple-green',
    red: 'bg-apple-red/15 text-apple-red',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl p-4 text-left transition-all ${
        isActive ? colors[color] : 'bg-apple-card text-apple-mute hover:bg-apple-elevated'
      }`}
    >
      <div className={`text-2xl font-bold ${isActive ? '' : 'text-apple-ink'}`}>{value}</div>
      <div className="text-sm opacity-80">{label}</div>
    </button>
  );
}
