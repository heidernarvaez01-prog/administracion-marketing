import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

type Period = 'day' | 'month' | 'year';

const generateData = (period: Period) => {
  const dayData = [
    { name: 'Mon', visits: 2400, unique: 1398, pageviews: 3200, newUsers: 800 },
    { name: 'Tue', visits: 1398, unique: 2210, pageviews: 2800, newUsers: 967 },
    { name: 'Wed', visits: 9800, unique: 2290, pageviews: 4200, newUsers: 1200 },
    { name: 'Thu', visits: 3908, unique: 2000, pageviews: 3800, newUsers: 1108 },
    { name: 'Fri', visits: 4800, unique: 2181, pageviews: 4500, newUsers: 1400 },
    { name: 'Sat', visits: 3800, unique: 2500, pageviews: 3900, newUsers: 1000 },
    { name: 'Sun', visits: 4300, unique: 2100, pageviews: 4100, newUsers: 1210 },
  ];

  const monthData = [
    { name: 'Jan', visits: 65000, unique: 42000, pageviews: 89000, newUsers: 28000 },
    { name: 'Feb', visits: 59000, unique: 39000, pageviews: 82000, newUsers: 25000 },
    { name: 'Mar', visits: 80000, unique: 52000, pageviews: 105000, newUsers: 35000 },
    { name: 'Apr', visits: 81000, unique: 56000, pageviews: 112000, newUsers: 38000 },
    { name: 'May', visits: 56000, unique: 38000, pageviews: 76000, newUsers: 24000 },
    { name: 'Jun', visits: 55000, unique: 40000, pageviews: 78000, newUsers: 26000 },
    { name: 'Jul', visits: 40000, unique: 30000, pageviews: 58000, newUsers: 18000 },
  ];

  const yearData = [
    { name: '2020', visits: 450000, unique: 320000, pageviews: 680000, newUsers: 185000 },
    { name: '2021', visits: 520000, unique: 380000, pageviews: 750000, newUsers: 220000 },
    { name: '2022', visits: 680000, unique: 480000, pageviews: 920000, newUsers: 285000 },
    { name: '2023', visits: 780000, unique: 560000, pageviews: 1050000, newUsers: 340000 },
    { name: '2024', visits: 890000, unique: 640000, pageviews: 1180000, newUsers: 395000 },
    { name: '2025', visits: 950000, unique: 710000, pageviews: 1280000, newUsers: 425000 },
    { name: '2026', visits: 620000, unique: 450000, pageviews: 820000, newUsers: 275000 },
  ];

  return period === 'day' ? dayData : period === 'month' ? monthData : yearData;
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3">
      <p className="text-sm font-semibold mb-2">{payload[0].payload.name}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-xs">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold">{entry.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

export function TrafficChart() {
  const [period, setPeriod] = useState<Period>('month');
  const data = generateData(period);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.4 }}
    >
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">Traffic</h3>
            <p className="text-sm text-muted-foreground">Website analytics overview</p>
          </div>
          <div className="flex gap-2">
            {(['day', 'month', 'year'] as Period[]).map((p) => (
              <Button
                key={p}
                variant={period === p ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod(p)}
                className="capitalize transition-all"
              >
                {p}
              </Button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#5856d6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#5856d6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorUnique" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2eb85c" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#2eb85c" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorPageviews" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f9b115" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f9b115" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorNewUsers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#e55353" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#e55353" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis
              dataKey="name"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              wrapperStyle={{ paddingTop: '20px', fontSize: '14px' }}
            />
            <Area
              type="monotone"
              dataKey="visits"
              stroke="#5856d6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorVisits)"
              name="Visits"
              isAnimationActive={true}
              animationDuration={1000}
            />
            <Area
              type="monotone"
              dataKey="unique"
              stroke="#2eb85c"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorUnique)"
              name="Unique"
              isAnimationActive={true}
              animationDuration={1000}
            />
            <Area
              type="monotone"
              dataKey="pageviews"
              stroke="#f9b115"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorPageviews)"
              name="Pageviews"
              isAnimationActive={true}
              animationDuration={1000}
            />
            <Area
              type="monotone"
              dataKey="newUsers"
              stroke="#e55353"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorNewUsers)"
              name="New Users"
              isAnimationActive={true}
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </motion.div>
  );
}
