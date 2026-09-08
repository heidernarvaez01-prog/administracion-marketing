interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  stroke?: string;
  fill?: string;
}

/**
 * Tiny inline SVG sparkline. No deps.
 * Designed to live inside summary cards.
 */
export function Sparkline({
  data,
  width = 100,
  height = 28,
  className,
  stroke = 'currentColor',
  fill = 'currentColor',
}: SparklineProps) {
  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} className={className}>
        <line x1={0} y1={height - 1} x2={width} y2={height - 1} stroke={stroke} strokeOpacity={0.2} />
      </svg>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / span) * (height - 2) - 1;
    return [x, y] as const;
  });
  const path = points.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
  const area = `${path} L${width},${height} L0,${height} Z`;

  return (
    <svg width={width} height={height} className={className} preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
      <path d={area} fill={fill} fillOpacity={0.12} />
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {points.length > 0 && (
        <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={1.8} fill={stroke} />
      )}
    </svg>
  );
}
