import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface MetricCardProps {
  title: string;
  value: number;
  unit?: string;
  trend: 'up' | 'down';
  trendValue: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accentColor: string;
  index: number;
  sparklineData?: number[];
}

export function MetricCard({
  title,
  value,
  unit = '',
  trend,
  trendValue,
  icon: Icon,
  accentColor,
  index,
  sparklineData = [],
}: MetricCardProps) {
  const [displayValue, setDisplayValue] = useState(0);

  // CountUp animation
  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 1000;
    const increment = end / (duration / 16);

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value]);

  const TrendIcon = trend === 'up' ? TrendingUp : TrendingDown;
  const trendColor = trend === 'up' ? 'text-success' : 'text-danger';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
    >
      <Card className="relative overflow-hidden border shadow-none hover:bg-muted/40 transition-colors rounded-md">
        <div className="p-5 sm:p-6 flex flex-col items-center text-center">
          {/* Top row: icon + trend marker */}
          <div className="w-full flex items-center justify-between mb-3">
            <Icon className="h-5 w-5 text-muted-foreground" style={{ color: accentColor }} />
            <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
              <TrendIcon className="h-3.5 w-3.5" />
              <span>{trendValue}</span>
            </div>
          </div>

          <div className="flex items-baseline gap-1">
            {unit === '$' && <span className="text-xl font-semibold">$</span>}
            <span className="text-4xl font-bold tracking-tight font-mono-data">
              {displayValue.toLocaleString()}
            </span>
            {unit && unit !== '$' && (
              <span className="text-lg text-muted-foreground">{unit}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{title}</p>

          {sparklineData.length > 0 && (
            <div className="mt-4 w-full flex items-end justify-center gap-1 h-8">
              {sparklineData.map((height, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(height, 6)}%` }}
                  transition={{ delay: index * 0.06 + i * 0.03, duration: 0.3 }}
                  className="flex-1 max-w-[8px] rounded-sm"
                  style={{ backgroundColor: accentColor, opacity: 0.25 }}
                />
              ))}
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

interface MetricCardsProps {
  className?: string;
}

export function MetricCards({ className = '' }: MetricCardsProps) {
  const metrics = [
    {
      title: 'Total Users',
      value: 26500,
      trend: 'up' as const,
      trendValue: '+12.5%',
      icon: ({ className }: { className?: string }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      accentColor: '#5856d6',
      sparklineData: [40, 60, 45, 70, 55, 80, 75, 90],
    },
    {
      title: 'Revenue',
      value: 52340,
      unit: '$',
      trend: 'up' as const,
      trendValue: '+8.2%',
      icon: ({ className }: { className?: string }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
      accentColor: '#2eb85c',
      sparklineData: [30, 45, 55, 50, 65, 70, 85, 95],
    },
    {
      title: 'Conversion Rate',
      value: 3.65,
      unit: '%',
      trend: 'up' as const,
      trendValue: '+2.1%',
      icon: ({ className }: { className?: string }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
      accentColor: '#f9b115',
      sparklineData: [50, 45, 60, 55, 70, 65, 75, 80],
    },
    {
      title: 'Sessions',
      value: 157820,
      trend: 'down' as const,
      trendValue: '-2.5%',
      icon: ({ className }: { className?: string }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        </svg>
      ),
      accentColor: '#39f',
      sparklineData: [80, 75, 70, 65, 60, 55, 50, 45],
    },
  ];

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {metrics.map((metric, index) => (
        <MetricCard key={metric.title} {...metric} index={index} />
      ))}
    </div>
  );
}
