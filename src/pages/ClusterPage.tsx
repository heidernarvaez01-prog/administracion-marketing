import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Sparkles, Loader2, Download, Trash2, Eye, X, FileText, Network, Lock } from 'lucide-react';
import { buildFormulaHtml, parseFormulaStream, CLUSTER_CATALOG, getClusterDef } from '@/lib/formula-template';
import { toast } from 'sonner';

interface RunRow {
  id: string;
  title: string;
  cluster_key: string;
  status: string;
  created_at: string;
  model: string | null;
}

export default function ClusterPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [client, setClient] = useState<{ id: string; name: string; description: string | null } | null>(null);
  const [hasBrief, setHasBrief] = useState<boolean | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);

  // Generation state (which cluster is currently running)
  const [runningKey, setRunningKey] = useState<string | null>(null);
  const [progress, setProgress] = useState({ section: 0, chars: 0 });
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Viewer state
  const [viewerHtml, setViewerHtml] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<RunRow | null>(null);

  const loadAll = useCallback(async () => {
    if (!clientId) return;
    const { data: c, error } = await supabase.from('audit_clients').select('id, name, description').eq('id', clientId).maybeSingle();
    if (error || !c) {
      toast.error('Cliente no encontrado');
      navigate('/app/clusters', { replace: true });
      return;
    }
    setClient(c);

    const { data: brief } = await supabase.from('brand_briefs').select('*').eq('client_id', clientId).maybeSingle();
    const filled = brief
      ? Object.entries(brief).filter(([k, v]) =>
          !['id', 'user_id', 'client_id', 'account_id', 'account_name', 'created_at', 'updated_at'].includes(k) &&
          v !== null && v !== '').length
      : 0;
    setHasBrief(filled >= 3);

    const { data: runRows } = await supabase
      .from('cluster_runs')
      .select('id, title, cluster_key, status, created_at, model')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    setRuns((runRows || []) as RunRow[]);
  }, [clientId, navigate]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => () => { if (timerRef.current) window.clearInterval(timerRef.current); }, []);

  // A cluster is monthly-locked if it already ran this calendar month
  const runThisMonth = (clusterKey: string): RunRow | undefined => {
    const now = new Date();
    return runs.find(r =>
      r.cluster_key === clusterKey &&
      (() => { const d = new Date(r.created_at); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); })()
    );
  };

  const runCluster = async (clusterKey: string) => {
    if (!clientId || !user || runningKey) return;
    const def = getClusterDef(clusterKey);
    const total = def.navLabels.length;
    setRunningKey(clusterKey);
    setProgress({ section: 0, chars: 0 });
    setElapsed(0);
    timerRef.current = window.setInterval(() => setElapsed(e => e + 1), 1000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sesión expirada — vuelve a iniciar sesión');

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/projection-cluster`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ clientId, clusterKey }),
      });

      if (!res.ok) {
        let msg = `Falló el cluster (${res.status})`;
        try { msg = (await res.json()).error || msg; } catch { /* not json */ }
        throw new Error(msg);
      }
      if (!res.body) throw new Error('Sin stream de respuesta');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let raw = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const evt = JSON.parse(payload);
            // The edge function emits Anthropic-shaped deltas (content_block_delta)
            if (evt.type === 'content_block_delta' && evt.delta?.text) raw += evt.delta.text;
            else if (evt.choices?.[0]?.delta?.content) raw += evt.choices[0].delta.content; // OpenAI passthrough fallback
            else if (evt.type === 'error' || evt.error) throw new Error(evt.error?.message || 'AI stream error');
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
        const parsed = parseFormulaStream(raw);
        setProgress({ section: parsed.currentSection, chars: raw.length });
      }

      const parsed = parseFormulaStream(raw);
      if (!parsed.hero || parsed.sections.length < total) {
        throw new Error(`Generación incompleta (${parsed.sections.length}/${total} secciones) — intenta de nuevo`);
      }
      const html = buildFormulaHtml(parsed.hero, parsed.sections.slice(0, total), def.navLabels);
      const title = `${def.title} — ${client?.name ?? 'Cliente'}`;

      const { error: insertErr } = await supabase.from('cluster_runs').insert({
        user_id: user.id,
        client_id: clientId,
        cluster_key: clusterKey,
        title,
        status: 'done',
        output_html: html,
        model: 'claude-sonnet-4-6',
      });
      if (insertErr) { console.error(insertErr); toast.error('Generado, pero falló al guardar la corrida'); }

      setViewerHtml(html);
      setViewerTitle(title);
      toast.success('Cluster completado');
      loadAll();
    } catch (e: any) {
      toast.error(e.message || 'Falló el cluster');
    } finally {
      if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
      setRunningKey(null);
    }
  };

  const viewRun = async (run: RunRow) => {
    const { data } = await supabase.from('cluster_runs').select('output_html').eq('id', run.id).maybeSingle();
    if (!data?.output_html) { toast.error('Esta corrida no tiene resultado'); return; }
    setViewerHtml(data.output_html);
    setViewerTitle(run.title);
  };

  const downloadHtml = (html: string, title: string) => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('cluster_runs').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    if (error) { toast.error('Error al eliminar la corrida'); return; }
    toast.success('Corrida eliminada');
    loadAll();
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('es-CO', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const nextMonthLabel = () => {
    const d = new Date(); d.setMonth(d.getMonth() + 1, 1);
    return d.toLocaleDateString('es-CO', { month: 'long', day: 'numeric' });
  };

  // Full-screen viewer
  if (viewerHtml) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="h-12 px-3 flex items-center justify-between border-b border-border bg-background shrink-0">
          <span className="text-sm font-semibold text-foreground truncate">{viewerTitle}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => downloadHtml(viewerHtml, viewerTitle)}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Descargar HTML
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setViewerHtml(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <iframe title={viewerTitle} srcDoc={viewerHtml} sandbox="allow-scripts" className="flex-1 w-full border-0 bg-white" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="shrink-0 -ml-2" onClick={() => navigate('/app/clusters')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Clientes
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground truncate">
            {client ? `${client.name} — Clusters de proyección` : 'Clusters de proyección'}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Genera estrategias completas de IA para este cliente, listas para presentar. Una corrida por cluster cada mes.
          </p>
        </div>
      </div>

      {/* Brief prerequisite notice */}
      {hasBrief === false && (
        <div className="border border-warning/40 bg-warning/5 rounded-lg p-4 flex items-start gap-3">
          <FileText className="h-4 w-4 text-warning mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-foreground">El Brief de marca de este cliente está vacío</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Los clusters se construyen A PARTIR del brief — complétalo primero para desbloquear las corridas.
            </p>
            <Button size="sm" variant="outline" className="mt-2" asChild>
              <Link to={`/app/brief/${clientId}`}>Completar el Brief de marca</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Cluster catalog — one card per cluster */}
      <div className="space-y-3">
        {CLUSTER_CATALOG.map(def => {
          const locked = !!runThisMonth(def.key);
          const isRunning = runningKey === def.key;
          const total = def.navLabels.length;
          return (
            <Card key={def.key} className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Network className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-foreground">{def.title}</h2>
                      <Badge variant="secondary" className="text-[10px]">{def.badge}</Badge>
                      {locked && (
                        <Badge variant="outline" className="text-[10px] gap-1"><Lock className="h-2.5 w-2.5" /> Usado este mes</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{def.description}</p>
                  </div>
                </div>
                <Button
                  onClick={() => runCluster(def.key)}
                  disabled={!!runningKey || hasBrief !== true || locked}
                  className="shrink-0"
                  title={locked ? `Disponible de nuevo el ${nextMonthLabel()}` : undefined}
                >
                  {isRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : locked ? <Lock className="h-4 w-4 mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  {isRunning ? 'Generando...' : locked ? 'Próximo mes' : 'Correr cluster'}
                </Button>
              </div>

              {/* Live progress for the running cluster */}
              {isRunning && (
                <div className="mt-4 pt-4 border-t border-border space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {progress.section === 0
                        ? 'Analizando brief y datos de campaña...'
                        : `Escribiendo ${def.navLabels[Math.min(progress.section - 1, total - 1)]} — sección ${Math.min(progress.section, total)} de ${total}`}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all duration-700"
                      style={{ width: `${Math.max(4, (progress.section / total) * 100)}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Esto toma unos minutos — mantén esta pestaña abierta mientras la IA lo construye.
                  </p>
                </div>
              )}

              {locked && !isRunning && (
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Ya se generó este mes. Disponible de nuevo el {nextMonthLabel()}.
                </p>
              )}
            </Card>
          );
        })}
      </div>

      {/* Run history */}
      <Card className="p-5">
        <h2 className="font-semibold mb-3">Corridas ({runs.length})</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Aún no hay corridas. Corre un cluster para generar la primera estrategia de este cliente.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {runs.map(run => (
              <div key={run.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{run.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDate(run.created_at)}{run.model ? ` · ${run.model}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => viewRun(run)} title="Ver">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(run)} title="Eliminar">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta corrida?</AlertDialogTitle>
            <AlertDialogDescription>
              El documento de estrategia generado se eliminará permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
