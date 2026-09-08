import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Send, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHero from '@/components/PageHero';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

interface Msg { role: 'user' | 'assistant'; content: string }
interface ClientOpt { id: string; name: string }

const SUGGESTIONS = [
  '¿Cómo va esta campaña esta semana?',
  '¿El ritmo de gasto va bien?',
  'Dame 3 optimizaciones accionables',
  '¿Hay alguna alerta de costo o entrega?',
  '¿Qué campañas tienen el peor CTR y por qué?',
  'Resume el rendimiento general de esta semana',
];

const ALL_CLIENTS = '__all_clients__';
const ALL_CAMPAIGNS = '__all_campaigns__';

/**
 * Single "ask about your campaigns" surface — replaces the old floating
 * AIChatWidget bubble and the unlisted /metrics-ai page (both hit the same
 * metrics-ai-analysis function; having two entry points for one job was
 * redundant). Client/campaign scope is optional: leave on "All" for a
 * cross-account question, narrow it down for a specific answer.
 */
export default function AskAIPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [clientId, setClientId] = useState<string>(ALL_CLIENTS);
  const [campaignName, setCampaignName] = useState<string>(ALL_CAMPAIGNS);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('audit_clients').select('id, name').order('name')
      .then(({ data }) => setClients((data || []) as ClientOpt[]));
  }, [user]);

  useEffect(() => {
    if (clientId === ALL_CLIENTS) { setCampaigns([]); setCampaignName(ALL_CAMPAIGNS); return; }
    supabase.from('audit_records').select('campaign_name').eq('client_id', clientId)
      .then(({ data }) => {
        setCampaigns([...new Set((data || []).map(r => r.campaign_name).filter(Boolean))].sort());
        setCampaignName(ALL_CAMPAIGNS);
      });
  }, [clientId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const scopeLabel = useMemo(() => {
    if (clientId === ALL_CLIENTS) return 'Todos los clientes';
    const c = clients.find(c => c.id === clientId)?.name ?? '—';
    return campaignName === ALL_CAMPAIGNS ? c : `${c} · ${campaignName}`;
  }, [clientId, campaignName, clients]);

  const ask = async (q: string) => {
    if (!q.trim() || loading) return;
    setMessages(m => [...m, { role: 'user', content: q }]);
    setQuestion('');
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('metrics-ai-analysis', {
        body: {
          question: q,
          clientId: clientId === ALL_CLIENTS ? undefined : clientId,
          campaignName: campaignName === ALL_CAMPAIGNS ? undefined : campaignName,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessages(m => [...m, { role: 'assistant', content: data.answer }]);
    } catch (e: any) {
      toast.error(e.message ?? 'Falló el análisis');
      setMessages(m => m.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => setMessages([]);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHero
        icon={Sparkles}
        title="Preguntar a la IA"
        subtitle="Pregunta cualquier cosa sobre tus campañas — rendimiento, ritmo, alertas, optimizaciones. Acótalo a un cliente y campaña para una respuesta más precisa, o déjalo abierto para comparar entre cuentas."
        gradient="from-cyan-600 via-sky-500 to-indigo-600"
      />

      <Card className="p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Cliente</span>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CLIENTS}>Todos los clientes</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Campaña</span>
          <Select value={campaignName} onValueChange={setCampaignName} disabled={clientId === ALL_CLIENTS}>
            <SelectTrigger className="w-56 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CAMPAIGNS}>Todas las campañas</SelectItem>
              {campaigns.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" className="ml-auto h-8 text-xs gap-1.5" onClick={clearChat}>
            <X className="h-3.5 w-3.5" /> Limpiar chat
          </Button>
        )}
      </Card>

      <div ref={scrollRef} className="space-y-3 max-h-[55vh] overflow-y-auto">
        {messages.length === 0 && (
          <div className="grid sm:grid-cols-2 gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="text-left p-3 rounded-lg border border-border hover:bg-accent text-sm transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <Card key={i} className={`p-4 ${m.role === 'user' ? 'bg-muted' : ''}`}>
            <div className="text-xs font-medium text-muted-foreground mb-2">
              {m.role === 'user' ? 'Tú' : 'Análisis de IA'}
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
          </Card>
        ))}
        {loading && (
          <Card className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Analizando {scopeLabel}...
          </Card>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); ask(question); }}
        className="sticky bottom-0 bg-background pt-2 flex gap-2"
      >
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={`Pregunta sobre ${scopeLabel.toLowerCase()}...`}
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(question); }
          }}
        />
        <Button type="submit" disabled={loading || !question.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
