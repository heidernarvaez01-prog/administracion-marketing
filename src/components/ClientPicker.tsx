import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Loader2, FolderOpen, ArrowRight, Briefcase, Search, type LucideIcon } from 'lucide-react';
import PageHero from '@/components/PageHero';
import { toast } from 'sonner';

interface ClientRow {
  id: string;
  name: string;
  description: string | null;
}

interface Props {
  title: string;
  subtitle: string;
  basePath: string;          // e.g. '/brief' or '/clusters'
  icon: LucideIcon;
  mode: 'brief' | 'clusters' | 'weekly'; // which per-client badge to show
}

/**
 * Shared "pick a client" landing used by Brand Brief and Projection Clusters.
 * Same clients as Monitoring Audit (audit_clients) so brief + audit + clusters
 * of each client stay linked together.
 */
export default function ClientPicker({ title, subtitle, basePath, icon: Icon, mode }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [badges, setBadges] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [migrationPending, setMigrationPending] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q));
  }, [clients, search]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('audit_clients').select('id, name, description').order('created_at', { ascending: true });
    if (error) { setMigrationPending(true); setLoading(false); return; }
    setMigrationPending(false);
    setClients((data || []) as ClientRow[]);

    // Per-client badge depending on the section
    const map: Record<string, string> = {};
    if (mode === 'brief') {
      const briefKeys = ['marca','sitio_web','mercado_objetivo','presupuesto_campana','necesidad_principal','descripcion_proyecto','publico_objetivo','fundamentos_marca','palabras_marca','frases_marca','valores_marca','promesa_marca','reasons_why','personalidad_marca','estilo_tono','diferenciador','insights','elementos_marca','benchmark'];
      const { data: briefs } = await supabase.from('brand_briefs').select('*').not('client_id', 'is', null);
      for (const b of briefs || []) {
        if (!b.client_id) continue;
        const filled = briefKeys.filter(k => b[k] !== null && b[k] !== undefined && String(b[k]).trim() !== '').length;
        const pct = Math.round((filled / briefKeys.length) * 100);
        map[b.client_id] = pct >= 80 ? 'Completo' : `${pct}% completado`;
      }
    } else if (mode === 'clusters') {
      const { data: runs } = await supabase.from('cluster_runs').select('client_id');
      for (const r of runs || []) {
        const n = (map[r.client_id] ? parseInt(map[r.client_id]) : 0) + 1;
        map[r.client_id] = `${n}`;
      }
      for (const k of Object.keys(map)) map[k] = `${map[k]} corrida${map[k] === '1' ? '' : 's'}`;
    } else if (mode === 'weekly') {
      const { data: reports } = await supabase
        .from('weekly_reports').select('client_id, week_end')
        .order('week_end', { ascending: false });
      for (const r of reports || []) {
        if (!map[r.client_id]) map[r.client_id] = `Último: ${r.week_end}`;
      }
    }
    setBadges(map);
    setLoading(false);
  }, [mode]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleCreate = async () => {
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed) { toast.error('El nombre del cliente es obligatorio'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('audit_clients')
      .insert({ user_id: user.id, name: trimmed, description: description.trim() || null })
      .select().single();
    setSaving(false);
    if (error || !data) { toast.error('Error al crear el cliente'); return; }
    toast.success('Cliente creado');
    setDialogOpen(false);
    navigate(`${basePath}/${data.id}`);
  };

  if (migrationPending) {
    return (
      <div className="max-w-2xl mx-auto mt-16 border border-dashed border-border rounded-lg p-8 text-center space-y-3">
        <Briefcase className="h-8 w-8 text-muted-foreground mx-auto" />
        <h2 className="font-semibold text-foreground">Se requiere actualizar la base de datos</h2>
        <p className="text-sm text-muted-foreground">
          Corre las migraciones SQL pendientes en el editor SQL de Supabase, luego recarga esta página.
        </p>
        <Button variant="outline" size="sm" onClick={loadAll}>Reintentar</Button>
      </div>
    );
  }

  // Color theme per section — semantic tokens only (mirrors AppSidebar's
  // per-feature accent so the same section reads the same color everywhere).
  type Accent = 'warning' | 'secondary' | 'info';
  const ACCENT_TILE: Record<Accent, string> = {
    warning: 'bg-gradient-to-br from-warning to-warning/80 text-warning-foreground',
    secondary: 'bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground',
    info: 'bg-gradient-to-br from-info to-info/80 text-info-foreground',
  };
  const ACCENT_BAR: Record<Accent, string> = {
    warning: 'bg-gradient-to-r from-warning to-warning/80',
    secondary: 'bg-gradient-to-r from-secondary to-secondary/80',
    info: 'bg-gradient-to-r from-info to-info/80',
  };
  const ACCENT_BADGE: Record<Accent, string> = {
    warning: 'bg-warning/10 text-warning border-warning/20',
    secondary: 'bg-secondary/10 text-secondary border-secondary/20',
    info: 'bg-info/10 text-info border-info/20',
  };
  const modeTheme: Record<typeof mode, { accent: Accent }> = {
    brief: { accent: 'warning' },
    clusters: { accent: 'secondary' },
    weekly: { accent: 'info' },
  };
  const theme = modeTheme[mode];
  const tileCls = ACCENT_TILE[theme.accent];
  const barCls = ACCENT_BAR[theme.accent];
  const badgeCls = ACCENT_BADGE[theme.accent];

  return (
    <div className="space-y-5 w-full min-w-0">
      <PageHero
        icon={Icon}
        title={title}
        subtitle={subtitle}
        actions={
          <Button
            size="sm"
            className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-sm"
            onClick={() => { setName(''); setDescription(''); setDialogOpen(true); }}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Nuevo cliente
          </Button>
        }
      />

      {/* Search */}
      {clients.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar clientes..."
            className="pl-9 h-9"
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : clients.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center text-muted-foreground space-y-2 bg-muted/20">
          <FolderOpen className="h-8 w-8 mx-auto" />
          <p className="text-sm">Aún no hay clientes.</p>
          <p className="text-xs">Los clientes se comparten con Auditoría de monitoreo — crea uno para empezar.</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => { setName(''); setDescription(''); setDialogOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Nuevo cliente
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-10 text-center text-muted-foreground bg-muted/20">
          <p className="text-sm">Ningún cliente coincide con "{search}".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => navigate(`${basePath}/${c.id}`)}
              className="text-left relative overflow-hidden rounded-xl border border-border bg-card p-5 cursor-pointer group
                transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-transparent
                focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {/* Accent bar */}
              <div className={`absolute inset-x-0 top-0 h-1 ${barCls}`} />
              {/* Decorative blob */}
              <div
                aria-hidden
                className={`pointer-events-none absolute -right-10 -bottom-10 h-28 w-28 rounded-full ${tileCls} opacity-[0.08] group-hover:opacity-[0.18] transition-opacity blur-xl`}
              />

              <div className="relative flex items-start gap-3">
                <div className={`shrink-0 h-10 w-10 rounded-lg ${tileCls} flex items-center justify-center shadow-sm`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-foreground truncate">{c.name}</h3>
                  {c.description ? (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{c.description}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic mt-0.5">Sin descripción</p>
                  )}
                </div>
                {badges[c.id] && (
                  <span className={`text-[10px] font-medium shrink-0 px-2 py-0.5 rounded-full border ${badgeCls}`}>
                    {badges[c.id]}
                  </span>
                )}
              </div>

              <div className="relative flex items-center justify-between mt-4 pt-3 border-t border-border">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Espacio de trabajo</span>
                <span className="text-[11px] font-medium text-foreground flex items-center gap-1 group-hover:gap-2 transition-all">
                  Abrir <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}


      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Nuevo cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs text-muted-foreground">Nombre del cliente / marca</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="ej. Acme Corp" maxLength={120}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }} autoFocus />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Descripción (opcional)</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="ej. E-commerce — Meta + Google" maxLength={200}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }} />
            </div>
            <Button onClick={handleCreate} disabled={saving} className="w-full">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Crear cliente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
