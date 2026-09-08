import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ChevronsLeft, ChevronsRight, LogOut, Moon, Sun, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/apache-studio-logo.png.asset.json';

/** Accent for the item's circular icon chip — mirrors the "Aside" template's
 *  colored nav icons (b-danger/b-success/b-info/b-default). */
type ChipAccent = 'primary' | 'info' | 'secondary' | 'warning' | 'success' | 'danger' | 'neutral';

interface NavLeaf { to: string; label: string; ionIcon: string; accent: ChipAccent }

const CHIP_CLASS: Record<ChipAccent, string> = {
  primary: 'bg-primary text-primary-foreground',
  info: 'bg-info text-info-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  warning: 'bg-warning text-warning-foreground',
  success: 'bg-success text-success-foreground',
  danger: 'bg-danger text-danger-foreground',
  neutral: 'bg-sidebar-hover text-sidebar-foreground',
};

// Main action menu — order requested by the team. Icons are Ionicons (ported
// from the "Aside" template) to match its sidebar look literally.
const mainNav: NavLeaf[] = [
  { to: '/app', label: 'Auditoría de monitoreo', ionIcon: 'ion-clipboard', accent: 'primary' },
  { to: '/app/weekly-report', label: 'Reporte semanal de rendimiento', ionIcon: 'ion-calendar', accent: 'info' },
  { to: '/app/clusters', label: 'Clusters de proyección', ionIcon: 'ion-network', accent: 'secondary' },
  { to: '/app/alerts', label: 'Alertas', ionIcon: 'ion-android-notifications', accent: 'warning' },
  { to: '/app/ask', label: 'Preguntar a la IA', ionIcon: 'ion-flash', accent: 'success' },
  { to: '/app/brief', label: 'Brief de marca', ionIcon: 'ion-document-text', accent: 'neutral' },
  { to: '/app/calendar', label: 'Calendario', ionIcon: 'ion-ios-calendar-outline', accent: 'danger' },
];

interface AppSidebarProps {
  forceExpanded?: boolean;
  hideToggle?: boolean;
}

export default function AppSidebar({ forceExpanded = false, hideToggle = false }: AppSidebarProps = {}) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [isAdmin, setIsAdmin] = useState(false);
  const [pinned, setPinned] = useState(false); // arrow keeps it open

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  // "Open" = always wide (mobile sheet or pinned). Otherwise it's a rail that
  // expands on hover via pure CSS (group-hover) — reliable, no layout shift.
  const open = forceExpanded || pinned;
  const RAIL = 60;
  const FULL = 240;
  // label/header visibility: shown when open, OR on hover when it's a rail
  const labelCls = open
    ? 'opacity-100'
    : 'opacity-0 group-hover/side:opacity-100';

  const isActive = (to: string) =>
    to === '/app'
      ? location.pathname === '/app' || location.pathname.startsWith('/app/client/') || location.pathname.startsWith('/app/audit/')
      : location.pathname === to || location.pathname.startsWith(`${to}/`);

  const NavRow = ({ to, label, ionIcon, accent }: NavLeaf) => {
    const active = isActive(to);
    return (
      <NavLink
        to={to}
        className={`group relative flex items-center gap-3 rounded-md px-2 h-11 text-sm font-normal
          transition-coreui overflow-hidden
          ${active
            ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
            : 'text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-hover'}`}
        title={!open ? label : undefined}
      >
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full
          transition-transform duration-200 group-hover:scale-110 ${CHIP_CLASS[accent]}`}>
          <i className={`${ionIcon} text-[15px] leading-none`} aria-hidden />
        </span>
        <span className={`whitespace-nowrap transition-opacity duration-200 ${labelCls}`}>
          {label}
        </span>
        {active && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-sidebar-primary" />}
      </NavLink>
    );
  };

  const ActionRow = ({
    icon: Icon, label, onClick, danger,
  }: { icon: LucideIcon; label: string; onClick: () => void; danger?: boolean }) => (
    <button
      onClick={onClick}
      title={!open ? label : undefined}
      className={`w-full flex items-center gap-3 rounded-lg px-3 h-10 text-sm font-medium
        transition-all duration-200 overflow-hidden hover:scale-[1.02] active:scale-[0.98]
        ${danger
          ? 'text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10'
          : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/30'}`}
    >
      <Icon className="h-[18px] w-[18px] shrink-0 transition-transform duration-200 hover:rotate-12" />
      <span className={`whitespace-nowrap transition-opacity duration-200 ${labelCls}`}>
        {label}
      </span>
    </button>
  );

  return (
    // Outer reserves only the rail width; the panel overlays on hover so the
    // page content never shifts (that was the "feels like a bug" part).
    <div className="group/side relative shrink-0" style={{ width: open ? FULL : RAIL }}>
      <aside
        className={`absolute inset-y-0 left-0 z-40 min-h-screen flex flex-col
          bg-sidebar border-r border-sidebar-border shadow-sm
          transition-[width] duration-200 ease-out
          ${open ? 'w-[240px]' : 'w-[60px] hover:w-[240px]'}`}
      >
        {/* Header */}
        <div className="h-20 flex items-center gap-3 px-3 border-b border-sidebar-border shrink-0 bg-sidebar-background">
          <div className="h-12 w-12 shrink-0 rounded-xl bg-sidebar-primary/10 ring-1 ring-sidebar-primary/20 flex items-center justify-center overflow-hidden shadow-sm">
            <img src={logo.url} alt="Apache Studio" className="h-10 w-10 object-contain" />
          </div>
          <div className={`min-w-0 transition-opacity duration-200 ${labelCls}`}>
            <h1 className="text-sm font-semibold tracking-tight truncate text-sidebar-accent-foreground">Apache Studio</h1>
            <p className="text-[11px] text-sidebar-foreground/70 truncate">Auditoría de anuncios</p>
          </div>
          {!hideToggle && (
            <button
              onClick={() => setPinned(p => !p)}
              className={`ml-auto p-1.5 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground
                hover:bg-sidebar-accent transition-opacity shrink-0 ${labelCls}`}
              title={pinned ? 'Desanclar menú' : 'Mantener menú abierto'}
            >
              {pinned ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Main navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden">
          {mainNav.map(item => <NavRow key={item.to} {...item} />)}
        </nav>

        {/* Settings group (bottom): Dark mode · How it works · Admin · account · Sign out */}
        <div className="border-t border-sidebar-border p-2 space-y-1 shrink-0">
          <ActionRow
            icon={theme === 'dark' ? Sun : Moon}
            label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            onClick={toggle}
          />
          <NavRow to="/app/how-it-works" label="Cómo funciona" ionIcon="ion-help-circled" accent="neutral" />
          {isAdmin && <NavRow to="/app/admin" label="Administración" ionIcon="ion-locked" accent="neutral" />}

          {user && (
            <>
              <div className={`px-3 pt-1.5 pb-0.5 transition-opacity duration-200 ${labelCls}`}>
                <p className="text-[11px] text-sidebar-foreground/50 truncate" title={user.email ?? ''}>
                  {user.email}
                </p>
              </div>
              <ActionRow icon={LogOut} label="Cerrar sesión" onClick={() => signOut()} danger />
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
