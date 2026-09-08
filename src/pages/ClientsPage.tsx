import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAlertThresholds } from '@/hooks/useAlertThresholds';
import { fetchCampaignData } from '@/lib/api';
import { buildAuditRows } from '@/lib/audit-helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Loader2, FolderOpen, Briefcase, ArrowRight, Search, Users, Megaphone, Wallet, TrendingUp, AlertTriangle, AlertCircle, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import dashboardIllustration from '@/assets/template/dashboard.png';
import type { ApiCampaignRow } from '@/lib/api';
import type { AuditRowData } from '@/components/AuditTable';
import { toast } from 'sonner';

interface ClientRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface ClientSummary {
  campaigns: number;
  budget: number;
  spent: number;
  ok: number;
  under: number;
  over: number;
}

function fmt(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ClientsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [apiData, setApiData] = useState<ApiCampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationPending, setMigrationPending] = useState(false);

  // Create/edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClientRow | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<ClientRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const { thresholds, enabledTypes } = useAlertThresholds();
  const [aiInsightsToday, setAiInsightsToday] = useState(0);

  useEffect(() => {
    if (!user) return;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    supabase.from('campaign_ai_insights').select('id', { count: 'exact', head: true })
      .gte('created_at', startOfToday.toISOString())
      .then(({ count }) => setAiInsightsToday(count ?? 0));
  }, [user]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q));
  }, [clients, search]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [clientsRes, recordsRes] = await Promise.all([
      supabase.from('audit_clients').select('*').order('created_at', { ascending: true }),
      supabase.from('audit_records').select('*'),
    ]);
    if (clientsRes.error) {
      // Table not created yet — the SQL migration hasn't been applied
      setMigrationPending(true);
      setLoading(false);
      return;
    }
    setMigrationPending(false);
    setClients((clientsRes.data || []) as ClientRow[]);
    setRecords(recordsRes.data || []);
    setLoading(false);
    try {
      const data = await fetchCampaignData();
      setApiData(data);
    } catch {
      toast.error('Error al conectar con la API de campañas');
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Same pacing + alert computation as the audit matrix, shared by the
  // per-client summary cards and the attention banner below.
  const auditRows = useMemo(
    () => buildAuditRows(records, apiData, thresholds, enabledTypes),
    [records, apiData, thresholds, enabledTypes],
  );

  const summaries = useMemo(() => {
    const map = new Map<string, ClientSummary>();
    for (const c of clients) {
      map.set(c.id, { campaigns: 0, budget: 0, spent: 0, ok: 0, under: 0, over: 0 });
    }
    for (const row of auditRows) {
      const s = map.get((row as any).client_id);
      if (!s) continue;
      s.campaigns += 1;
      s.budget += row.presupuesto_total;
      s.spent += row.metrics.gastoActual;
      if (row.metrics.pacingStatus === 'OK') s.ok += 1;
      else if (row.metrics.pacingStatus === 'SUBGASTANDO') s.under += 1;
      else s.over += 1;
    }
    return map;
  }, [clients, auditRows]);

  const criticalAlertCount = useMemo(
    () => auditRows.reduce((n, row) => n + row.alerts.filter(a => a.severity === 'danger').length, 0),
    [auditRows],
  );

  const totals = useMemo(() => {
    let budget = 0, spent = 0, campaigns = 0, over = 0, under = 0, ok = 0;
    for (const s of summaries.values()) {
      budget += s.budget; spent += s.spent; campaigns += s.campaigns;
      over += s.over; under += s.under; ok += s.ok;
    }
    return { budget, spent, campaigns, over, under, ok };
  }, [summaries]);

  const openCreate = () => { setEditClient(null); setName(''); setDescription(''); setDialogOpen(true); };
  const openEdit = (c: ClientRow) => { setEditClient(c); setName(c.name); setDescription(c.description || ''); setDialogOpen(true); };

  const handleSave = async () => {
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed) { toast.error('El nombre del cliente es obligatorio'); return; }
    setSaving(true);
    if (editClient) {
      const { error } = await supabase.from('audit_clients')
        .update({ name: trimmed, description: description.trim() || null })
        .eq('id', editClient.id);
      setSaving(false);
      if (error) { toast.error('Error al guardar el cliente'); return; }
      toast.success('Cliente actualizado');
      setDialogOpen(false);
      loadAll();
    } else {
      const { data, error } = await supabase.from('audit_clients')
        .insert({ user_id: user.id, name: trimmed, description: description.trim() || null })
        .select().single();
      setSaving(false);
      if (error || !data) { toast.error('Error al crear el cliente'); return; }
      toast.success('Cliente creado');
      setDialogOpen(false);
      navigate(`/app/client/${data.id}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('audit_clients').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    if (error) { toast.error('Error al eliminar el cliente'); return; }
    toast.success('Cliente eliminado');
    loadAll();
  };

  if (migrationPending) {
    return (
      <div className="max-w-2xl mx-auto mt-16 border border-dashed border-border rounded-lg p-8 text-center space-y-3">
        <Briefcase className="h-8 w-8 text-muted-foreground mx-auto" />
        <h2 className="font-semibold text-foreground">Se requiere actualizar la base de datos</h2>
        <p className="text-sm text-muted-foreground">
          La tabla de clientes aún no existe. Corre la migración SQL
          <span className="font-mono text-xs"> supabase/migrations/20260611000000_audit_clients.sql </span>
          en el editor SQL de Supabase, luego recarga esta página.
        </p>
        <Button variant="outline" size="sm" onClick={loadAll}>Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full min-w-0">
      <PageHero
        icon={Users}
        title="Clientes"
        subtitle="Cada cliente tiene su propio espacio. Abre uno para dar seguimiento a sus campañas, presupuestos y resultados en tiempo real."
        decoration={
          <img src={dashboardIllustration} alt="" aria-hidden className="h-24 w-auto rounded-md opacity-90 object-cover" />
        }
        actions={
          <Button
            size="sm"
            className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-sm"
            onClick={openCreate}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Nuevo cliente
          </Button>
        }
      />

      {/* Attention banner — critical alerts + new AI findings, one click away */}
      {(criticalAlertCount > 0 || aiInsightsToday > 0) && (
        <Link
          to="/app/alerts"
          className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-destructive/30 bg-destructive/5
            px-4 py-3 text-sm hover:bg-destructive/10 transition-colors group"
        >
          {criticalAlertCount > 0 && (
            <span className="flex items-center gap-1.5 font-medium text-destructive">
              <AlertCircle className="h-4 w-4" />
              {criticalAlertCount} alerta{criticalAlertCount === 1 ? '' : 's'} crítica{criticalAlertCount === 1 ? '' : 's'}
            </span>
          )}
          {aiInsightsToday > 0 && (
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              {aiInsightsToday} insight{aiInsightsToday === 1 ? '' : 's'} nuevo{aiInsightsToday === 1 ? '' : 's'} de IA hoy
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
            Ver alertas <ArrowRight className="h-3 w-3" />
          </span>
        </Link>
      )}

      {/* Global summary across all clients */}
      {clients.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <GradientStat icon={Users} label="Clientes" value={clients.length.toString()} accent="primary" />
          <GradientStat icon={Megaphone} label="Campañas" value={totals.campaigns.toString()} accent="info" />
          <GradientStat icon={Wallet} label="Presupuesto total" value={fmt(totals.budget)} accent="secondary" />
          <GradientStat icon={TrendingUp} label="Gasto total" value={fmt(totals.spent)} accent="success" />
          <GradientStat
            icon={AlertTriangle}
            label="En riesgo"
            value={(totals.over + totals.under).toString()}
            accent={totals.over + totals.under > 0 ? 'warning' : 'success'}
            pulse={totals.over + totals.under > 0}
            hint="Campañas sobregastando o subgastando entre todos los clientes."
          />
        </div>
      )}

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

      {/* Client cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : clients.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center text-muted-foreground space-y-2 bg-muted/20">
          <FolderOpen className="h-8 w-8 mx-auto" />
          <p className="text-sm">Aún no hay clientes.</p>
          <p className="text-xs">Crea tu primer cliente para empezar a auditar sus campañas.</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Nuevo cliente
          </Button>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-10 text-center text-muted-foreground bg-muted/20">
          <p className="text-sm">Ningún cliente coincide con "{search}".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((c, idx) => {
            const s = summaries.get(c.id) || { campaigns: 0, budget: 0, spent: 0, ok: 0, under: 0, over: 0 };
            // Rotate accent palette across cards — driven by semantic tokens
            const palettes = [
              { grad: 'from-primary to-primary/80', fg: 'text-primary-foreground' },
              { grad: 'from-info to-info/80', fg: 'text-info-foreground' },
              { grad: 'from-success to-success/80', fg: 'text-success-foreground' },
              { grad: 'from-secondary to-secondary/80', fg: 'text-secondary-foreground' },
              { grad: 'from-warning to-warning/80', fg: 'text-warning-foreground' },
              { grad: 'from-destructive to-destructive/80', fg: 'text-destructive-foreground' },
            ];
            const { grad: accent, fg: accentFg } = palettes[idx % palettes.length];
            const initials = c.name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '·';
            return (
              <div
                key={c.id}
                onClick={() => navigate(`/app/client/${c.id}`)}
                className="relative overflow-hidden rounded-xl border border-border bg-card p-5 cursor-pointer group
                  transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-transparent"
              >
                {/* Top gradient accent bar */}
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} />
                {/* Decorative blob */}
                <div aria-hidden className={`pointer-events-none absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-gradient-to-br ${accent} opacity-[0.08] group-hover:opacity-[0.18] transition-opacity blur-xl`} />

                <div className="relative flex items-start gap-3">
                  <div className={`shrink-0 h-11 w-11 rounded-lg bg-gradient-to-br ${accent} ${accentFg} flex items-center justify-center font-bold text-sm shadow-sm`}>
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-foreground truncate">{c.name}</h3>
                    {c.description ? (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{c.description}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground/60 italic mt-0.5">Sin descripción</p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setDeleteTarget(c)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="relative grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-border">
                  <Mini label="Campañas" value={s.campaigns.toString()} />
                  <Mini label="Presupuesto" value={fmt(s.budget)} />
                  <Mini label="Gasto" value={fmt(s.spent)} />
                </div>

                <div className="relative flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2 text-[10px]">
                    <StatusDot count={s.ok} color="bg-emerald-500" label="en ritmo" />
                    <StatusDot count={s.under} color="bg-amber-500" label="subgastando" />
                    <StatusDot count={s.over} color="bg-rose-500" label="sobregastando" />
                  </div>
                  <span className="text-[11px] font-medium text-foreground flex items-center gap-1 group-hover:gap-2 transition-all">
                    Abrir auditoría <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editClient ? 'Editar cliente' : 'Nuevo cliente'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs text-muted-foreground">Nombre del cliente / marca</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="ej. Acme Corp"
                maxLength={120}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Descripción (opcional)</Label>
              <Input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="ej. E-commerce — Meta + Google"
                maxLength={200}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editClient ? 'Guardar cambios' : 'Crear cliente'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto elimina el cliente y todas sus campañas auditadas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xs font-semibold font-mono text-foreground truncate">{value}</p>
    </div>
  );
}

function StatusDot({ count, color, label }: { count: number; color: string; label: string }) {
  if (count === 0) return null;
  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {count} {label}
    </span>
  );
}

const GRADIENT_STAT_ACCENT_CLASS: Record<'primary' | 'info' | 'secondary' | 'success' | 'warning' | 'destructive', string> = {
  primary: 'bg-primary text-primary-foreground',
  info: 'bg-info text-info-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  success: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
};

function GradientStat({
  icon: Icon, label, value, accent, hint, pulse,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: keyof typeof GRADIENT_STAT_ACCENT_CLASS;
  hint?: string;
  pulse?: boolean;
}) {
  const card = (
    <div
      className={`relative overflow-hidden rounded-lg p-4 shadow-sm cursor-help
        ${GRADIENT_STAT_ACCENT_CLASS[accent]} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md animate-fade-in`}
    >
      <div aria-hidden className="absolute -right-3 -bottom-3 opacity-20">
        <Icon className="h-16 w-16" />
      </div>
      <div className="relative flex items-center gap-1.5">
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 bg-current" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
          </span>
        )}
        <p className="text-[10px] uppercase tracking-wider opacity-85">{label}</p>
      </div>
      <p className="relative mt-1 text-2xl font-bold font-mono leading-none">{value}</p>
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

