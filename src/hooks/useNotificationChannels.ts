import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type ChannelType = 'email' | 'slack_webhook' | 'generic_webhook' | 'in_app';
// 'whatsapp' will join this union once a provider (Twilio / Meta Cloud API)
// is chosen — the table/dispatcher already support arbitrary channel_type +
// config, so adding it later is additive, not a migration.

export interface NotificationChannel {
  id?: string;
  channel_type: ChannelType;
  config: Record<string, unknown>;
  enabled: boolean;
}

/** Loads/saves this user's notification_channels (email, Slack, webhook, in-app). */
export function useNotificationChannels() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from('notification_channels').select('*').eq('user_id', user.id);
    let rows = (data || []) as unknown as NotificationChannel[];

    // Self-heal: every user should have an 'in_app' channel so the bell
    // icon has somewhere to write to, even if they signed up after the
    // one-time migration backfill. Auto-provision it on first load.
    if (!rows.some(c => c.channel_type === 'in_app')) {
      const { data: created } = await supabase
        .from('notification_channels')
        .upsert({ user_id: user.id, channel_type: 'in_app', config: {}, enabled: true }, { onConflict: 'user_id,channel_type' })
        .select();
      if (created?.length) rows = [...rows, created[0] as unknown as NotificationChannel];
    }

    setChannels(rows);
    setLoading(false);
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  const getChannel = (type: ChannelType): NotificationChannel =>
    channels.find(c => c.channel_type === type) ?? { channel_type: type, config: {}, enabled: false };

  const saveChannel = async (channel: NotificationChannel) => {
    if (!user) return { error: new Error('No has iniciado sesión') };
    const { error } = await supabase.from('notification_channels').upsert(
      { user_id: user.id, channel_type: channel.channel_type, config: channel.config as any, enabled: channel.enabled },
      { onConflict: 'user_id,channel_type' },
    );
    if (!error) await reload();
    return { error };
  };

  return { channels, loading, getChannel, saveChannel, reload };
}
