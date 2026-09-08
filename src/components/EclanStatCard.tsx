import type { LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export type StatAccent = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';

const ACCENT_CLASS: Record<StatAccent, string> = {
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  success: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
  danger: 'bg-destructive text-destructive-foreground',
  info: 'bg-info text-info-foreground',
};

interface EclanStatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  /** Color de la insignia del ícono. Default 'primary'. */
  accent?: StatAccent;
  /** Punto animado junto al label (para alertas activas, etc.) */
  pulse?: boolean;
  /** Tooltip explicativo, opcional */
  hint?: string;
  className?: string;
}

/**
 * Tarjeta de KPI estilo Eclan (`.card.widget-stat` en
 * public/eclan/xhtml/analytics.html): tarjeta blanca lisa, label + número
 * grande a la izquierda, insignia chica de color con ícono a la derecha.
 * Reemplaza los tiles de fondo sólido tipo "CoreUI" (GradientStat en
 * ClientsPage, SummaryCard en AuditPage, etc.) para que todas las
 * páginas de /app compartan el mismo lenguaje visual.
 */
export default function EclanStatCard({
  icon: Icon,
  label,
  value,
  accent = 'primary',
  pulse,
  hint,
  className = '',
}: EclanStatCardProps) {
  const card = (
    <div
      className={`relative overflow-hidden rounded-lg border border-border bg-card p-4
        shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5
        ${hint ? 'cursor-help' : ''} ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground truncate">
            {pulse && (
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${ACCENT_CLASS[accent].split(' ')[0]}`} />
                <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${ACCENT_CLASS[accent].split(' ')[0]}`} />
              </span>
            )}
            {label}
          </p>
          <p className="text-2xl font-bold font-mono-data text-foreground mt-1 truncate">{value}</p>
        </div>
        <span className={`shrink-0 h-11 w-11 rounded-lg flex items-center justify-center ${ACCENT_CLASS[accent]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );

  if (!hint) return card;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs">{hint}</TooltipContent>
    </Tooltip>
  );
}
