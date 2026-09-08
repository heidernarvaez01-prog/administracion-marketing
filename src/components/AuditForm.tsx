import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ChevronsUpDown, Check, Search, X, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ApiCampaignRow } from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  apiData: ApiCampaignRow[];
  clientId: string;
  editRecord?: {
    id: string;
    account_id: string;
    campaign_name: string;
    presupuesto_total: number;
    fecha_inicio: string;
    fecha_fin: string;
    tipo_calendario: string;
    platform?: string;
  } | null;
}

// Per-campaign config in bulk mode — each campaign keeps its own values
interface BulkCfg { presupuesto: string; inicio: string; fin: string; cal: string; expanded: boolean }

const SCHEDULE_LABEL: Record<string, string> = {
  corridos: 'Todos los días', lun_vie: 'Lun–Vie', lun_sab: 'Lun–Sáb',
};

export default function AuditForm({ open, onClose, onSaved, apiData, clientId, editRecord }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'single' | 'bulk'>('single');

  const [platform, setPlatform] = useState(editRecord?.platform || '');
  const [accountName, setAccountName] = useState(editRecord?.account_id || '');
  const [campaignName, setCampaignName] = useState(editRecord?.campaign_name || '');
  const [presupuesto, setPresupuesto] = useState(editRecord?.presupuesto_total?.toString() || '');
  const [fechaInicio, setFechaInicio] = useState(editRecord?.fecha_inicio || '');
  const [fechaFin, setFechaFin] = useState(editRecord?.fecha_fin || '');
  const [tipoCalendario, setTipoCalendario] = useState(editRecord?.tipo_calendario || 'corridos');
  const [comboOpen, setComboOpen] = useState(false);

  // Bulk mode
  const [configs, setConfigs] = useState<Record<string, BulkCfg>>({});
  const [bulkSearch, setBulkSearch] = useState('');
  // "Apply to all" shared values
  const [applyBudget, setApplyBudget] = useState('');
  const [applyStart, setApplyStart] = useState('');
  const [applyEnd, setApplyEnd] = useState('');
  const [applyCal, setApplyCal] = useState('corridos');

  useEffect(() => {
    if (editRecord) {
      setMode('single');
      setPlatform(editRecord.platform || '');
      setAccountName(editRecord.account_id);
      setCampaignName(editRecord.campaign_name);
      setPresupuesto(editRecord.presupuesto_total.toString());
      setFechaInicio(editRecord.fecha_inicio);
      setFechaFin(editRecord.fecha_fin);
      setTipoCalendario(editRecord.tipo_calendario);
    }
  }, [editRecord]);

  const platforms = useMemo(() =>
    [...new Set(apiData.map(r => r.platform).filter(Boolean))].sort(), [apiData]);

  const accountNames = useMemo(() => {
    const filtered = platform ? apiData.filter(r => r.platform === platform) : apiData;
    return [...new Set(filtered.map(r => r.account_name).filter(Boolean))].sort();
  }, [apiData, platform]);

  const filteredCampaigns = useMemo(() => {
    if (!accountName) return [];
    let filtered = apiData.filter(r => r.account_name === accountName);
    if (platform) filtered = filtered.filter(r => r.platform === platform);
    return [...new Set(filtered.map(r => r.campaign_name).filter(Boolean))].sort();
  }, [apiData, platform, accountName]);

  const campaignDates = (name: string): { start: string; end: string } | null => {
    const rows = apiData.filter(r => r.campaign_name === name && (!platform || r.platform === platform));
    const dates = rows.map(r => r.date).filter(Boolean).sort();
    if (!dates.length) return null;
    return { start: dates[0].slice(0, 10), end: dates[dates.length - 1].slice(0, 10) };
  };

  // ── Single mode ──
  const handleCampaignSelect = (name: string) => {
    setCampaignName(name);
    setComboOpen(false);
    const d = campaignDates(name);
    if (d && !editRecord) { setFechaInicio(d.start); setFechaFin(d.end); }
    const rows = apiData.filter(r => r.campaign_name === name && (!platform || r.platform === platform));
    if (!platform) {
      const plats = [...new Set(rows.map(r => r.platform).filter(Boolean))];
      if (plats.length === 1) setPlatform(plats[0]);
    }
  };

  const resetAccount = (v: string) => {
    setAccountName(v); setCampaignName(''); setConfigs({});
  };

  const handleSaveSingle = async () => {
    if (!user || !campaignName || !presupuesto || !fechaInicio || !fechaFin) {
      toast.error('Completa todos los campos');
      return;
    }
    setLoading(true);
    const record = {
      user_id: user.id, client_id: clientId, account_id: accountName, campaign_name: campaignName,
      presupuesto_total: parseFloat(presupuesto), fecha_inicio: fechaInicio, fecha_fin: fechaFin,
      tipo_calendario: tipoCalendario, platform: platform || null,
    };
    let error;
    if (editRecord) ({ error } = await supabase.from('audit_records').update(record).eq('id', editRecord.id));
    else ({ error } = await supabase.from('audit_records').insert(record));
    if (error) toast.error('Error al guardar el registro');
    else { toast.success(editRecord ? 'Registro actualizado' : 'Registro creado'); onSaved(); }
    setLoading(false);
  };

  // ── Bulk mode ──
  const bulkVisible = useMemo(() => {
    const q = bulkSearch.trim().toLowerCase();
    return q ? filteredCampaigns.filter(c => c.toLowerCase().includes(q)) : filteredCampaigns;
  }, [filteredCampaigns, bulkSearch]);

  const selectedNames = Object.keys(configs);

  const toggleCampaign = (name: string) => {
    setConfigs(prev => {
      const next = { ...prev };
      if (next[name]) { delete next[name]; return next; }
      const d = campaignDates(name);
      next[name] = { presupuesto: applyBudget, inicio: d?.start || applyStart, fin: d?.end || applyEnd, cal: applyCal, expanded: false };
      return next;
    });
  };
  const allSelected = bulkVisible.length > 0 && bulkVisible.every(c => configs[c]);
  const toggleAll = () => {
    setConfigs(prev => {
      const next = { ...prev };
      if (allSelected) { bulkVisible.forEach(c => delete next[c]); return next; }
      bulkVisible.forEach(c => {
        if (!next[c]) { const d = campaignDates(c); next[c] = { presupuesto: applyBudget, inicio: d?.start || applyStart, fin: d?.end || applyEnd, cal: applyCal, expanded: false }; }
      });
      return next;
    });
  };

  const setCfg = (name: string, patch: Partial<BulkCfg>) =>
    setConfigs(prev => ({ ...prev, [name]: { ...prev[name], ...patch } }));

  const applyToAll = () => {
    setConfigs(prev => {
      const next = { ...prev };
      for (const name of Object.keys(next)) {
        next[name] = {
          ...next[name],
          ...(applyBudget !== '' ? { presupuesto: applyBudget } : {}),
          ...(applyStart !== '' ? { inicio: applyStart } : {}),
          ...(applyEnd !== '' ? { fin: applyEnd } : {}),
          cal: applyCal,
        };
      }
      return next;
    });
    toast.success('Aplicado a todas las seleccionadas');
  };

  const handleSaveBulk = async () => {
    if (!user || !accountName) { toast.error('Selecciona una cuenta'); return; }
    if (selectedNames.length === 0) { toast.error('Selecciona al menos una campaña'); return; }
    const missing = selectedNames.filter(n => {
      const c = configs[n];
      return !c.presupuesto || !c.inicio || !c.fin;
    });
    if (missing.length) {
      toast.error(`${missing.length} campaña(s) sin presupuesto o fechas`);
      // auto-expand the first incomplete one
      setCfg(missing[0], { expanded: true });
      return;
    }
    setLoading(true);
    const records = selectedNames.map(name => ({
      user_id: user.id, client_id: clientId, account_id: accountName, campaign_name: name,
      presupuesto_total: parseFloat(configs[name].presupuesto),
      fecha_inicio: configs[name].inicio, fecha_fin: configs[name].fin,
      tipo_calendario: configs[name].cal, platform: platform || null,
    }));
    const { error } = await supabase.from('audit_records').insert(records);
    if (error) toast.error('Error al crear las campañas');
    else { toast.success(`${records.length} campaña${records.length === 1 ? '' : 's'} agregada${records.length === 1 ? '' : 's'}`); onSaved(); }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {editRecord ? 'Editar registro de auditoría' : 'Agregar campañas'}
          </DialogTitle>
        </DialogHeader>

        {/* Mode toggle — segmented control */}
        {!editRecord && (
          <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg">
            {(['single', 'bulk'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'text-xs font-medium py-1.5 rounded-md transition-colors',
                  mode === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m === 'single' ? 'Una campaña' : 'Masivo (varias)'}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-4 mt-2">
          {/* Platform + Account (both modes) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Plataforma</Label>
              <Select value={platform} onValueChange={(v) => { setPlatform(v); resetAccount(''); }}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  {platforms.map(p => <SelectItem key={p} value={p}><span className="capitalize">{p}</span></SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Cuenta</Label>
              <Select value={accountName} onValueChange={resetAccount}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  {accountNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {mode === 'single' ? (
            <>
              <div>
                <Label className="text-xs text-muted-foreground">Campaña</Label>
                <Popover open={comboOpen} onOpenChange={setComboOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={comboOpen} disabled={!accountName}
                      className="w-full justify-between font-normal text-sm h-9">
                      <span className="truncate">
                        {campaignName || (accountName ? 'Buscar campaña...' : 'Primero selecciona una cuenta')}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar campaña..." />
                      <CommandList>
                        <CommandEmpty>No se encontraron campañas.</CommandEmpty>
                        <CommandGroup className="max-h-60 overflow-auto">
                          {filteredCampaigns.map(c => (
                            <CommandItem key={c} value={c} onSelect={() => handleCampaignSelect(c)}>
                              <Check className={cn("mr-2 h-4 w-4", campaignName === c ? "opacity-100" : "opacity-0")} />
                              <span className="truncate text-xs">{c}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Presupuesto total aprobado</Label>
                <Input type="number" value={presupuesto} onChange={e => setPresupuesto(e.target.value)} placeholder="0.00" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Fecha de inicio</Label>
                  <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Fecha de fin</Label>
                  <Input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tipo de cronograma</Label>
                <Select value={tipoCalendario} onValueChange={setTipoCalendario}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corridos">Todos los días</SelectItem>
                    <SelectItem value="lun_vie">Lunes a viernes</SelectItem>
                    <SelectItem value="lun_sab">Lunes a sábado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSaveSingle} disabled={loading} className="w-full">
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editRecord ? 'Guardar cambios' : 'Crear registro'}
              </Button>
            </>
          ) : (
            <>
              {/* Campaign multi-select */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Campañas {selectedNames.length > 0 && <span className="text-primary font-medium">· {selectedNames.length} seleccionadas</span>}
                  </Label>
                  {filteredCampaigns.length > 0 && (
                    <button type="button" onClick={toggleAll} className="text-[11px] text-primary hover:underline">
                      {allSelected ? 'Quitar todas' : 'Seleccionar todas'}
                    </button>
                  )}
                </div>
                {!accountName ? (
                  <p className="text-xs text-muted-foreground border border-dashed border-border rounded-md p-4 text-center">
                    Selecciona una cuenta para listar sus campañas.
                  </p>
                ) : filteredCampaigns.length === 0 ? (
                  <p className="text-xs text-muted-foreground border border-dashed border-border rounded-md p-4 text-center">
                    No se encontraron campañas para esta cuenta.
                  </p>
                ) : (
                  <div className="border border-border rounded-md">
                    <div className="relative p-2 border-b border-border">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input value={bulkSearch} onChange={e => setBulkSearch(e.target.value)} placeholder="Filtrar campañas..." className="pl-8 h-8 text-xs" />
                    </div>
                    <div className="max-h-40 overflow-y-auto p-1">
                      {bulkVisible.map(c => (
                        <button key={c} type="button" onClick={() => toggleCampaign(c)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-muted/60 transition-colors">
                          <span className={cn('h-4 w-4 shrink-0 rounded border flex items-center justify-center',
                            configs[c] ? 'bg-primary border-primary text-primary-foreground' : 'border-input')}>
                            {configs[c] && <Check className="h-3 w-3" />}
                          </span>
                          <span className="truncate text-xs text-foreground">{c}</span>
                        </button>
                      ))}
                      {bulkVisible.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Sin coincidencias.</p>}
                    </div>
                  </div>
                )}
              </div>

              {selectedNames.length > 0 && (
                <>
                  {/* Apply to all — quick fill */}
                  <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                    <p className="text-[11px] font-medium text-foreground">Llenado rápido — aplicar a todas las seleccionadas</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="number" value={applyBudget} onChange={e => setApplyBudget(e.target.value)} placeholder="Presupuesto" className="h-8 text-xs" />
                      <Select value={applyCal} onValueChange={setApplyCal}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="corridos" className="text-xs">Todos los días</SelectItem>
                          <SelectItem value="lun_vie" className="text-xs">Lun–Vie</SelectItem>
                          <SelectItem value="lun_sab" className="text-xs">Lun–Sáb</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="date" value={applyStart} onChange={e => setApplyStart(e.target.value)} className="h-8 text-xs" />
                      <Input type="date" value={applyEnd} onChange={e => setApplyEnd(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <Button type="button" size="sm" variant="secondary" className="w-full h-8 text-xs" onClick={applyToAll}>
                      Aplicar a las {selectedNames.length}
                    </Button>
                  </div>

                  {/* Per-campaign editable rows */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-muted-foreground">Cada campaña conserva sus propios valores — expande para ajustar.</p>
                    {selectedNames.map(name => {
                      const c = configs[name];
                      const incomplete = !c.presupuesto || !c.inicio || !c.fin;
                      return (
                        <div key={name} className="border border-border rounded-md">
                          <button type="button" onClick={() => setCfg(name, { expanded: !c.expanded })}
                            className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-muted/40 transition-colors">
                            <span className="truncate text-xs font-medium text-foreground flex items-center gap-1.5">
                              {incomplete && <span className="h-1.5 w-1.5 rounded-full bg-warning shrink-0" />}
                              {name}
                            </span>
                            <span className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {c.presupuesto ? `$${c.presupuesto}` : '—'}
                              </span>
                              <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', c.expanded && 'rotate-180')} />
                            </span>
                          </button>
                          {c.expanded && (
                            <div className="px-2.5 pb-2.5 pt-1 grid grid-cols-2 gap-2 border-t border-border">
                              <div className="col-span-2">
                                <Label className="text-[10px] text-muted-foreground">Presupuesto</Label>
                                <Input type="number" value={c.presupuesto} onChange={e => setCfg(name, { presupuesto: e.target.value })} placeholder="0.00" className="h-8 text-xs" />
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">Inicio</Label>
                                <Input type="date" value={c.inicio} onChange={e => setCfg(name, { inicio: e.target.value })} className="h-8 text-xs" />
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">Fin</Label>
                                <Input type="date" value={c.fin} onChange={e => setCfg(name, { fin: e.target.value })} className="h-8 text-xs" />
                              </div>
                              <div className="col-span-2">
                                <Label className="text-[10px] text-muted-foreground">Cronograma</Label>
                                <Select value={c.cal} onValueChange={v => setCfg(name, { cal: v })}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="corridos" className="text-xs">Todos los días</SelectItem>
                                    <SelectItem value="lun_vie" className="text-xs">Lun–Vie</SelectItem>
                                    <SelectItem value="lun_sab" className="text-xs">Lun–Sáb</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <button type="button" onClick={() => toggleCampaign(name)}
                                className="col-span-2 text-[11px] text-destructive hover:underline flex items-center gap-1 justify-center pt-0.5">
                                <X className="h-3 w-3" /> Quitar
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <Button onClick={handleSaveBulk} disabled={loading} className="w-full">
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Agregar {selectedNames.length > 0 ? selectedNames.length : ''} campaña{selectedNames.length === 1 ? '' : 's'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
