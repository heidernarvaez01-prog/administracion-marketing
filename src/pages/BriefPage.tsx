import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Save, Check, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

type Brief = Record<string, any>;

const SECTIONS: { title: string; fields: { key: string; label: string; hint?: string; type?: 'input' | 'textarea' | 'number' | 'url'; rows?: number }[] }[] = [
  {
    title: 'Identificación',
    fields: [
      { key: 'marca', label: 'Marca' },
      { key: 'sitio_web', label: 'Sitio web', type: 'url' },
      { key: 'mercado_objetivo', label: 'País o mercado objetivo', hint: 'Solo áreas geográficas' },
      { key: 'presupuesto_campana', label: 'Presupuesto de campaña', type: 'number' },
    ],
  },
  {
    title: 'Estrategia',
    fields: [
      { key: 'necesidad_principal', label: 'Necesidad principal', hint: 'El problema a enfrentar y resolver con marketing', type: 'textarea', rows: 3 },
      { key: 'descripcion_proyecto', label: 'Descripción del proyecto', hint: 'Qué ofrece la empresa, beneficios, audiencia y diferenciadores', type: 'textarea', rows: 5 },
      { key: 'publico_objetivo', label: 'Público objetivo y buyer persona', hint: 'Tipos de personas y descripciones situacionales', type: 'textarea', rows: 5 },
      { key: 'fundamentos_marca', label: 'Fundamentos de marca', hint: 'Productos, servicios y elementos obligatorios de marca', type: 'textarea', rows: 4 },
    ],
  },
  {
    title: 'Identidad verbal',
    fields: [
      { key: 'palabras_marca', label: '30 palabras que representan la marca', hint: 'Separadas por comas', type: 'textarea', rows: 3 },
      { key: 'frases_marca', label: '10 frases que describen la marca', hint: 'Una por línea', type: 'textarea', rows: 5 },
      { key: 'valores_marca', label: 'Valores de marca', hint: 'Con una explicación para cada uno', type: 'textarea', rows: 4 },
      { key: 'promesa_marca', label: 'Promesa de marca', hint: 'Promesas racionales y emocionales alcanzables', type: 'textarea', rows: 3 },
      { key: 'reasons_why', label: 'Reasons Why / Razones para creer', hint: 'Razones concretas para creer la promesa', type: 'textarea', rows: 3 },
    ],
  },
  {
    title: 'Personalidad',
    fields: [
      { key: 'personalidad_marca', label: 'Personalidad de marca', hint: 'Arquetipo si aplica', type: 'textarea', rows: 3 },
      { key: 'estilo_tono', label: 'Estilo y tono', hint: 'Cómo habla la marca según cliente y canal', type: 'textarea', rows: 3 },
      { key: 'diferenciador', label: 'Diferenciador principal', hint: 'Lo que nadie más tiene en el mercado local', type: 'textarea', rows: 3 },
    ],
  },
  {
    title: 'Creatividad y referencias',
    fields: [
      { key: 'insights', label: 'Hallazgos o insights útiles', hint: 'Conceptos, campañas, slogans y aprendizajes previos', type: 'textarea', rows: 4 },
      { key: 'elementos_marca', label: 'Elementos de marca', hint: 'Colores, tipografía, lineamientos gráficos y manuales', type: 'textarea', rows: 4 },
      { key: 'benchmark', label: 'Benchmark / Referencias', hint: 'Competidores relevantes a analizar', type: 'textarea', rows: 4 },
    ],
  },
];

export default function BriefPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [brief, setBrief] = useState<Brief>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const debounceRef = useRef<number | null>(null);

  // Load the client and its brief — one brief per client, linked to the same
  // client as the real-time audit and the projection clusters
  useEffect(() => {
    if (!clientId) return;
    (async () => {
      const { data: c, error } = await supabase.from('audit_clients').select('id, name').eq('id', clientId).maybeSingle();
      if (error || !c) {
        toast.error('Cliente no encontrado');
        navigate('/app/brief', { replace: true });
        return;
      }
      setClient(c);
      const { data } = await supabase.from('brand_briefs').select('*').eq('client_id', clientId).maybeSingle();
      setBrief(data || { client_id: clientId });
      setSavedAt(null);
    })();
  }, [clientId, navigate]);

  const persist = useCallback(async (next: Brief) => {
    if (!clientId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Debes iniciar sesión para guardar');
      return;
    }
    setSaving(true);
    const payload = { ...next, client_id: clientId, user_id: user.id };
    const { error } = await supabase.from('brand_briefs').upsert(payload, { onConflict: 'client_id' });
    setSaving(false);
    if (error) {
      toast.error('Error al guardar el brief');
    } else {
      setSavedAt(Date.now());
    }
  }, [clientId]);

  const update = (key: string, value: any) => {
    const next = { ...brief, [key]: value, client_id: clientId };
    setBrief(next);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => persist(next), 1200);
  };

  const saveNow = () => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    persist({ ...brief, client_id: clientId });
  };

  // Completion across all brief fields (for the progress + badge)
  const allKeys = SECTIONS.flatMap(s => s.fields.map(f => f.key));
  const filledCount = allKeys.filter(k => {
    const v = brief[k];
    return v !== null && v !== undefined && String(v).trim() !== '';
  }).length;
  const pct = Math.round((filledCount / allKeys.length) * 100);

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex items-center gap-2">
          <Button variant="ghost" size="sm" className="shrink-0 -ml-2" onClick={() => navigate('/app/brief')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Clientes
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">
              {client ? `${client.name} — Brief de marca` : 'Brief de marca'}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cuéntanos sobre esta marca. Entre más completo, más precisas serán las estrategias de IA.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {saving ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Save className="h-3 w-3 animate-pulse" /> Guardando...
            </span>
          ) : savedAt ? (
            <span className="text-xs text-success flex items-center gap-1.5">
              <Check className="h-3 w-3" /> Guardado
            </span>
          ) : null}
          <Button size="sm" onClick={saveNow} disabled={saving}>
            <Save className="h-3.5 w-3.5 mr-1.5" /> Guardar brief
          </Button>
        </div>
      </div>

      {/* Completion progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-success' : pct >= 40 ? 'bg-warning' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {filledCount}/{allKeys.length} campos · {pct >= 80 ? 'Completo' : pct >= 40 ? 'En progreso' : 'Recién empezado'}
        </span>
      </div>

      {SECTIONS.map((section, idx) => (
        <Collapsible key={section.title} defaultOpen={idx === 0}>
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors group">
              <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 pt-1 space-y-4">
                {section.fields.map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <Label htmlFor={f.key} className="text-xs">{f.label}</Label>
                    {f.hint && <p className="text-[11px] text-muted-foreground -mt-0.5">{f.hint}</p>}
                    {f.type === 'textarea' ? (
                      <Textarea
                        id={f.key}
                        value={brief[f.key] ?? ''}
                        onChange={e => update(f.key, e.target.value)}
                        rows={f.rows || 3}
                        maxLength={4000}
                      />
                    ) : f.type === 'number' ? (
                      <Input
                        id={f.key}
                        type="number"
                        min={0}
                        step="0.01"
                        value={brief[f.key] ?? ''}
                        onChange={e => update(f.key, e.target.value === '' ? null : Number(e.target.value))}
                      />
                    ) : (
                      <Input
                        id={f.key}
                        type={f.type === 'url' ? 'url' : 'text'}
                        value={brief[f.key] ?? ''}
                        onChange={e => update(f.key, e.target.value)}
                        maxLength={500}
                      />
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      ))}
    </div>
  );
}
