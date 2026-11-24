import React, { ReactNode } from 'react';
import { Card } from '../ui/Card';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  color?: 'brand' | 'emerald' | 'amber' | 'rose' | 'slate';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'brand',
}) => {
  const iconColors = {
    brand: 'bg-brand-50 text-brand-700 border-brand-200/80',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    amber: 'bg-amber-50 text-amber-700 border-amber-200/80',
    rose: 'bg-rose-50 text-rose-700 border-rose-200/80',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  }[color];

  return (
    <Card className="hover:border-slate-300 transition-all duration-200">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</span>
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${iconColors}`}>
          {icon}
        </div>
      </div>
      <div className="mt-3">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">{value}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        {trend && (
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            <span
              className={`font-semibold ${
                trend.isPositive ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {trend.value}
            </span>
            {trend.label && <span className="text-slate-400">{trend.label}</span>}
          </div>
        )}
      </div>
    </Card>
  );
};
