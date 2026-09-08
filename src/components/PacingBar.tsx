import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  porcentajeTiempo: number;  // 0-100
  porcentajeGasto: number;   // 0-100+
  status: 'OK' | 'SUBGASTANDO' | 'SOBREGASTANDO';
}

export default function PacingBar({ porcentajeTiempo, porcentajeGasto, status }: Props) {
  const clampedTime = Math.min(100, Math.max(0, porcentajeTiempo));
  const clampedSpend = Math.min(120, Math.max(0, porcentajeGasto));
  const displaySpend = Math.min(100, clampedSpend);

  const barColor =
    status === 'SOBREGASTANDO'
      ? 'bg-destructive'
      : status === 'SUBGASTANDO'
        ? 'bg-warning'
        : 'bg-success';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative w-full h-5 rounded-sm bg-secondary overflow-hidden cursor-default">
          {/* Time elapsed marker */}
          <div
            className="absolute top-0 bottom-0 border-r-2 border-foreground/30 z-10"
            style={{ left: `${clampedTime}%` }}
          />
          <div
            className="absolute top-0 left-0 text-[8px] font-mono text-foreground/50 leading-5 pl-0.5 z-10"
            style={{ left: `${Math.min(clampedTime, 85)}%` }}
          >
            {clampedTime.toFixed(0)}%t
          </div>
          {/* Spend bar */}
          <div
            className={`absolute top-0 left-0 h-full ${barColor} transition-all duration-500 rounded-sm`}
            style={{ width: `${displaySpend}%` }}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p>Tiempo transcurrido: {porcentajeTiempo.toFixed(1)}%</p>
        <p>Presupuesto gastado: {porcentajeGasto.toFixed(1)}%</p>
      </TooltipContent>
    </Tooltip>
  );
}
