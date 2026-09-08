import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, CalendarClock, Loader2, Plus, X as XIcon, Send, Eye, Download, Trash2, X, Mail } from 'lucide-react';
import { toast } from 'sonner';

interface ReportRow {
  id: string;
  week_start: string;
  week_end: string;
  sent_at: string | null;
  sent_to: string[];
  created_at: string;
}

export default function WeeklyReportPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [client, setClient] = useState<{ id: string; name: string; report_recipients: string[] } | null>(null);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [savingRecipients, setSavingRecipients] = useState(false);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [generating, setGenerating] = useState<'preview' | 'send' | null>(null);
  const [includeMonthly, setIncludeMonthly] = useState(true);
  const [viewerHtml, setViewerHtml] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState('');

  const loadAll = useCallback(async () => {
    if (!clientId) return;
    const { data: c, error } = await supabase
      .from('audit_clients')
      .select('id, name, report_recipients')
      .eq('id', clientId)
      .maybeSingle();
    if (error || !c) {
      toast.error('Cliente no encontrado');
      navigate('/app/weekly-report', { replace: true });
      return;
    }
    setClient(c as any);
    setRecipients((c as any).report_recipients || []);

    const { data: reps } = await supabase
      .from('weekly_reports')
      .select('id, week_start, week_end, sent_at, sent_to, created_at')
      .eq('client_id', clientId)
      .order('week_start', { ascending: false });
    setReports((reps || []) as ReportRow[]);
  }, [clientId, navigate]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const addEmail = () => {
    const e = emailInput.trim();
    if (!e) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { toast.error('Correo inválido'); return; }
    if (recipients.includes(e)) return;
    setRecipients([...recipients, e]);
    setEmailInput('');
  };

  const saveRecipients = async () => {
    if (!clientId) return;
    setSavingRecipients(true);
    const { error } = await supabase.from('audit_clients').update({ report_recipients: recipients }).eq('id', clientId);
    setSavingRecipients(false);
    if (error) { toast.error('Error al guardar los destinatarios'); return; }
    toast.success('Destinatarios guardados');
  };

  const generate = async (send: boolean) => {
    if (!clientId || generating) return;
    if (send && recipients.length === 0) {
      toast.error('Agrega destinatarios antes de enviar');
      return;
    }
    setGenerating(send ? 'send' : 'preview');
    try {
      const { data, error } = await supabase.functions.invoke('weekly-report', {
        body: { clientId, send, includeMonthly },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(send ? `Reporte enviado a ${recipients.length} destinatario(s)` : 'Reporte generado');
      if (data?.html) {
        setViewerHtml(data.html);
        setViewerTitle(`Reporte semanal — ${client?.name} (${data.week_start} → ${data.week_end})`);
      }
      loadAll();
    } catch (e: any) {
      toast.error(e.message || 'Falló la generación del reporte');
    } finally {
      setGenerating(null);
    }
  };

  const viewReport = async (r: ReportRow) => {
    const { data } = await supabase.from('weekly_reports').select('html').eq('id', r.id).maybeSingle();
    if (!data?.html) { toast.error('Este reporte no tiene contenido'); return; }
    setViewerHtml(data.html);
    setViewerTitle(`Reporte semanal — ${client?.name} (${r.week_start} → ${r.week_end})`);
  };

  const deleteReport = async (r: ReportRow) => {
    const { error } = await supabase.from('weekly_reports').delete().eq('id', r.id);
    if (error) { toast.error('Error al eliminar el reporte'); return; }
    toast.success('Reporte eliminado');
    loadAll();
  };

  const downloadHtml = () => {
    if (!viewerHtml) return;
    const blob = new Blob([viewerHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${viewerTitle.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (viewerHtml) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="h-12 px-3 flex items-center justify-between border-b border-border bg-background shrink-0">
          <span className="text-sm font-semibold text-foreground truncate">{viewerTitle}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={downloadHtml}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Descargar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setViewerHtml(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <iframe title={viewerTitle} srcDoc={viewerHtml} sandbox="" className="flex-1 w-full border-0 bg-white" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <Button variant="ghost" size="sm" className="shrink-0 -ml-2" onClick={() => navigate('/app/weekly-report')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Clientes
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">
              {client ? `${client.name} — Reporte semanal` : 'Reporte semanal'}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Los resultados de esta semana por campaña, listos para compartir con el cliente cada lunes.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Switch checked={includeMonthly} onCheckedChange={setIncludeMonthly} />
            Comparación mensual
          </label>
          <Button variant="outline" size="sm" onClick={() => generate(false)} disabled={!!generating}>
            {generating === 'preview' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Eye className="h-3.5 w-3.5 mr-1.5" />}
            Generar vista previa
          </Button>
          <Button size="sm" onClick={() => generate(true)} disabled={!!generating}>
            {generating === 'send' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
            Generar y enviar
          </Button>
        </div>
      </div>

      {/* Recipients */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Destinatarios de este cliente</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Estas direcciones reciben el reporte automático de los lunes y cualquier envío manual.
        </p>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="cliente@empresa.com"
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
          />
          <Button type="button" variant="secondary" onClick={addEmail}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {recipients.map(e => (
            <Badge key={e} variant="secondary" className="gap-1.5 pr-1">
              {e}
              <button onClick={() => setRecipients(recipients.filter(x => x !== e))} className="hover:bg-background rounded p-0.5">
                <XIcon className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {recipients.length === 0 && (
            <p className="text-xs text-muted-foreground">Aún no hay destinatarios — el correo de los lunes se omite para este cliente.</p>
          )}
        </div>
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={saveRecipients} disabled={savingRecipients}>
            {savingRecipients && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Guardar destinatarios
          </Button>
        </div>
      </Card>

      {/* History */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <CalendarClock className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Reportes ({reports.length})</h2>
        </div>
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Aún no hay reportes. Genera una vista previa para ver el rendimiento de esta semana.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {reports.map(r => (
              <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">
                    {r.week_start} → {r.week_end}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.sent_at
                      ? `Enviado ${new Date(r.sent_at).toLocaleString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} a ${r.sent_to.length} destinatario(s)`
                      : 'No enviado'}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {r.sent_at && <Badge variant="secondary" className="text-[10px] mr-1">Enviado</Badge>}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => viewReport(r)} title="Ver">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteReport(r)} title="Eliminar">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
