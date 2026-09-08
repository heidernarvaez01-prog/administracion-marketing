import { useCallback, useEffect, useState } from 'react';
import { Bell, AlertCircle, AlertTriangle, Info, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface NotificationRow {
  id: string;
  severity: string;
  campaign_name: string;
  alert_type: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

const severityIcon = (s: string) =>
  s === 'critical' ? <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
  : s === 'warning' ? <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
  : <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'justo ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

/**
 * Floating in-app notification bell — one of the alert delivery channels
 * (alongside email, Slack, generic webhook; see notification_channels /
 * supabase/functions/_shared/notify.ts). Polls on open + every 60s so a
 * cron-triggered alert-dispatch run shows up without a page reload.
 */
export default function NotificationCenter() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    const rows = (data || []) as NotificationRow[];
    setItems(rows);
    setUnreadCount(rows.filter(r => !r.read_at).length);
  }, [user]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  const markRead = async (id: string) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, read_at: new Date().toISOString() } : i)));
    setUnreadCount(c => Math.max(0, c - 1));
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  };

  const markAllRead = async () => {
    const unreadIds = items.filter(i => !i.read_at).map(i => i.id);
    if (unreadIds.length === 0) return;
    setItems(prev => prev.map(i => (i.read_at ? i : { ...i, read_at: new Date().toISOString() })));
    setUnreadCount(0);
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unreadIds);
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) load(); }}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="fixed top-3 right-3 z-50 h-10 w-10 rounded-full shadow-md"
          aria-label="Notificaciones"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center text-[10px] rounded-full bg-destructive text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 max-h-[70vh] overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold">Notificaciones</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={markAllRead}>
              <CheckCheck className="h-3.5 w-3.5" /> Marcar todas como leídas
            </Button>
          )}
        </div>
        <div className="overflow-y-auto divide-y divide-border">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Aún no hay notificaciones.</p>
          ) : items.map((n) => (
            <button
              key={n.id}
              onClick={() => markRead(n.id)}
              className={`w-full text-left px-4 py-3 flex items-start gap-2.5 hover:bg-muted/40 transition-colors ${n.read_at ? 'opacity-60' : ''}`}
            >
              {severityIcon(n.severity)}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-foreground truncate">{n.campaign_name}</div>
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</div>
              </div>
              {!n.read_at && <span className="h-2 w-2 rounded-full bg-primary mt-1 shrink-0" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
