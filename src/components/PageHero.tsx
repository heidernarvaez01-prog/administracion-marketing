import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeroProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** Tailwind `from-* to-*` gradient. Default = indigo. */
  gradient?: string;
  actions?: ReactNode;
  /** Decorative element rendered on the right (hidden on mobile). */
  decoration?: ReactNode;
}

/**
 * Section hero banner inspired by CoreUI dashboards.
 * Vibrant gradient backdrop with subtle pattern, leading icon and headline.
 * Stacks vertically on mobile; actions wrap below.
 */
export default function PageHero({
  icon: Icon,
  title,
  subtitle,
  gradient = 'from-primary via-primary to-secondary',
  actions,
  decoration,
}: PageHeroProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-gradient-to-br ${gradient}
        p-5 sm:p-7 text-primary-foreground shadow-sm animate-fade-in`}
    >
      {/* Decorative blobs */}
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-primary-foreground/10 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-foreground/10 blur-2xl" />
      {/* Subtle grid overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(var(--primary-foreground) / .6) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary-foreground) / .6) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <div className="shrink-0 h-12 w-12 sm:h-14 sm:w-14 rounded-lg bg-primary-foreground/15 backdrop-blur-sm ring-1 ring-primary-foreground/20 flex items-center justify-center">
            <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-primary-foreground truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-primary-foreground/85 mt-1 max-w-2xl">
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
    </div>
  );
}
