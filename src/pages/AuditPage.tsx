import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAlertThresholds } from '@/hooks/useAlertThresholds';
import { fetchCampaignData, getCampaignCost, clearCampaignDataCache } from '@/lib/api';
import { buildAuditRows } from '@/lib/audit-helpers';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, LayoutGrid, Layers, ArrowLeft, ClipboardCheck, Wallet, TrendingUp, CheckCircle2, TrendingDown, AlertTriangle } from 'lucide-react';
import AuditForm from '@/components/AuditForm';
import AuditTable, { type AuditRowData } from '@/components/AuditTable';
import AdSetTable from '@/components/AdSetTable';
import PageHero from '@/components/PageHero';
import EclanStatCard from '@/components/EclanStatCard';
import type { ApiCampaignRow } from '@/lib/api';
import { toast } from 'sonner';

export default function AuditPage() {
  const { user } = useAuth();
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<{ id: string; name: string; description: string | null } | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [apiData, setApiData] = useState<ApiCampaignRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('general');
  const [viewMode, setViewMode] = useState<'campaigns' | 'adsets'>('campaigns');
  const [hasLoaded, setHasLoaded] = useState(false);
  const { thresholds, enabledTypes } = useAlertThresholds();

  // Load the client this audit belongs to — audits are isolated per client
  useEffect(() => {
    if (!clientId) return;
    (async () => {
      const { data, error } = await supabase.from('audit_clients').select('id, name, description').eq('id', clientId).maybeSingle();
      if (error || !data) {
        toast.error('Cliente no encontrado');
        navigate('/app', { replace: true });
        return;
      }
      setClient(data);
    })();
  }, [clientId, navigate]);

  const loadRecords = useCallback(async () => {
    if (!clientId) return;
    const { data } = await supabase
      .from('audit_records')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    setRecords(data || []);
  }, [clientId]);

  const loadApiData = useCallback(async () => {
    try {
      const data = await fetchCampaignData();
      setApiData(data);
    } catch {
      toast.error('Error al conectar con la API de campañas');
    }
  }, []);

  // Auto-load on mount
  useEffect(() => {
    loadRecords();
    (async () => {
      try {
        await loadApiData();
        setHasLoaded(true);
      } catch {
        /* handled in loadApiData */
      }
    })();
  }, [loadRecords, loadApiData]);

  // Optimistic inline update for editable cells (dates, calendar, budget)
  const handleUpdateRecord = useCallback(
    async (id: string, patch: Partial<{ fecha_inicio: string; fecha_fin: string; tipo_calendario: string; presupuesto_total: number }>) => {
      setRecords(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
      const { error } = await supabase.from('audit_records').update(patch).eq('id', id);
      if (error) {
        toast.error('Error al guardar los cambios');
        loadRecords();
      }
    },
    [loadRecords],
  );
  const handleDelete = async (id: string) => {
    await supabase.from('audit_records').delete().eq('id', id);
    loadRecords();
    toast.success('Registro eliminado');
  };

  // Build audit rows with metrics + alerts
  const auditRows: AuditRowData[] = useMemo(
    () => buildAuditRows(records, apiData, thresholds, enabledTypes),
    [records, apiData, thresholds, enabledTypes],
  );

  // Dynamic platform tabs from user's audit records
  const platformTabs = useMemo(() => {
    const platforms = [...new Set(auditRows.map(r => r.platform).filter(Boolean))] as string[];
    return platforms.sort();
  }, [auditRows]);

  // Filter rows by tab
  const filteredRows = useMemo(() => {
    if (activeTab === 'general') return auditRows;
    return auditRows.filter(r => r.platform === activeTab);
  }, [auditRows, activeTab]);

  // Summary + sparkline series
  const summary = useMemo(() => {
    const total = auditRows.reduce((s, r) => s + r.presupuesto_total, 0);
    const spent = auditRows.reduce((s, r) => s + r.metrics.gastoActual, 0);
    const over = auditRows.filter(r => r.metrics.pacingStatus === 'SOBREGASTANDO').length;
    const under = auditRows.filter(r => r.metrics.pacingStatus === 'SUBGASTANDO').length;
    const ok = auditRows.filter(r => r.metrics.pacingStatus === 'OK').length;

    // Daily aggregated spend across all audited campaigns (sorted ASC, cumulative)
    const dailyMap = new Map<string, number>();
    for (const row of auditRows) {
      for (const api of row.campaignApiData) {
        const cost = isNaN(api.metrics.cost) ? 0 : api.metrics.cost;
        dailyMap.set(api.date, (dailyMap.get(api.date) || 0) + cost);
      }
    }
    const dailyKeys = [...dailyMap.keys()].sort();
    const dailySpend = dailyKeys.map(k => dailyMap.get(k) || 0);
    let cum = 0;
    const cumulativeSpend = dailySpend.map(v => (cum += v));

    return { total, spent, over, under, ok, dailySpend, cumulativeSpend };
  }, [auditRows]);

  // No full-page loader — show empty state instead when not loaded

  return (
    <div className="space-y-5 w-full min-w-0">
      {/* Hero header */}
      <PageHero
        icon={ClipboardCheck}
        title={client ? client.name : 'Auditoría de monitoreo'}
        subtitle={
          client?.description ||
          'Da seguimiento en tiempo real a si cada campaña gasta bien y rinde bien.'
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/app')}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Clientes
            </Button>
            <Button size="sm" onClick={() => { setEditRecord(null); setShowForm(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Nueva auditoría
            </Button>
          </>
        }
      />


      {/* Summary cards */}
      {auditRows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <EclanStatCard
            icon={Wallet}
            label="Presupuesto total"
            value={`$${summary.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            hint="Suma del presupuesto aprobado en todas las campañas auditadas."
            accent="primary"
          />
          <EclanStatCard
            icon={TrendingUp}
            label="Gasto total"
            value={`$${summary.spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            hint="Suma del gasto real consolidado (excluye hoy y ayer)."
            accent="info"
          />
          <EclanStatCard
            icon={CheckCircle2}
            label="En ritmo"
            value={summary.ok.toString()}
            hint="Campañas dentro de ±10% del ritmo ideal."
            pulse={summary.ok > 0}
            accent="success"
          />
          <EclanStatCard
            icon={TrendingDown}
            label="Subgastando"
            value={summary.under.toString()}
            hint="Campañas gastando menos del 90% de lo ideal — riesgo de no usar todo el presupuesto."
            accent="warning"
          />
          <EclanStatCard
            icon={AlertTriangle}
            label="Sobregastando"
            value={summary.over.toString()}
            hint="Campañas gastando más del 110% de lo ideal — riesgo de agotar el presupuesto antes de tiempo."
            accent="danger"
          />
        </div>
      )}

      {/* Audit table is always visible — even when API data hasn't loaded yet */}
      {(
        /* Top-level view mode tabs */
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'campaigns' | 'adsets')}>
          <TabsList className="w-full sm:w-auto flex">
            <TabsTrigger value="campaigns" className="text-xs gap-1.5 flex-1 sm:flex-none">
              <LayoutGrid className="h-3.5 w-3.5" />
              Campañas
            </TabsTrigger>
            <TabsTrigger value="adsets" className="text-xs gap-1.5 flex-1 sm:flex-none">
              <Layers className="h-3.5 w-3.5" />
              Conjuntos de anuncios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns" className="mt-3">
            {/* Platform filter tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="overflow-x-auto">
                <TabsList>
                  <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
                  {platformTabs.map(p => (
                    <TabsTrigger key={p} value={p} className="text-xs capitalize">{p}</TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <TabsContent value={activeTab} className="mt-3 space-y-3">
                <AuditTable
                  rows={filteredRows}
                  onEdit={(row) => { setEditRecord(row); setShowForm(true); }}
                  onDelete={handleDelete}
                  onUpdateRecord={handleUpdateRecord}
                />
                <Button
                  variant="outline"
                  className="w-full border-dashed text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => { setEditRecord(null); setShowForm(true); }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Agregar campaña
                </Button>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="adsets" className="mt-3">
            <AdSetTable auditRows={auditRows} apiData={apiData} />
          </TabsContent>
        </Tabs>
      )}

      {showForm && clientId && (
        <AuditForm
          open={showForm}
          onClose={() => { setShowForm(false); setEditRecord(null); }}
          onSaved={() => { setShowForm(false); setEditRecord(null); loadRecords(); }}
          editRecord={editRecord}
          apiData={apiData}
          clientId={clientId}
        />
      )}
    </div>
  );
}

