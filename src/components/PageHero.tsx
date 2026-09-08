import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeroProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** @deprecated Vestigio del theme original ("Aside"/CoreUI) de
   *  Ad-Audit-Platform, que pintaba este header como un banner con
   *  gradiente. Eclan usa headers planos (ver public/eclan/xhtml/*.html,
   *  `.form-head`/`.page-titles`) — este prop ya no se usa para nada,
   *  se deja tipado sólo para no romper los call-sites existentes. */
  gradient?: string;
  actions?: ReactNode;
  /** Decorative element rendered on the right (hidden on mobile). */
  decoration?: ReactNode;
}

/**
 * Encabezado de sección, estilo Eclan: título + subtítulo en texto plano
 * sobre el fondo de la página (sin banner de color), con un ícono chico
 * en una insignia con tinte de --primary — el mismo lenguaje que usan
 * los íconos de "Total Campaign"/"Total Audience" en
 * public/eclan/xhtml/analytics.html (`.widget-stat` + `span.bg-primary`).
 */
export default function PageHero({
  icon: Icon,
  title,
  subtitle,
  actions,
  decoration,
}: PageHeroProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="shrink-0 h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {(actions || decoration) && (
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap sm:shrink-0">
          {decoration && <div className="hidden sm:block">{decoration}</div>}
          {actions}
        </div>
      )}
    </div>
  );
}
