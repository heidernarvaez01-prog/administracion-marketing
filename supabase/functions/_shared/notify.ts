// Channel dispatcher: reads a user's notification_channels and delivers a
// batch of alerts through every enabled one. Add a new channel by adding a
// case here + a row shape in `config` — no changes needed anywhere else
// (alert-dispatch, AlertsPage) since callers just pass alerts + userId.
//
// Planned next channel: 'whatsapp' (Twilio or Meta Cloud API — provider
// not chosen yet). Add it as another case below, config = { phone, ... }.
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';
import { sendEmail } from './email.ts';

export type NotifySeverity = 'critical' | 'warning' | 'ok';

export interface NotifyAlert {
  campaign: string;
  account: string;
  platform: string | null;
  level: NotifySeverity;
  spend: number;
  budget: number;
  spendPct: number;
  timePct: number;
  deviation: number;
  message: string;
  alertType: string;
}

export interface DispatchResult {
  channel: string;
  ok: boolean;
  error?: string;
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function renderEmailHtml(alerts: NotifyAlert[], criticalCount: number, warningCount: number, summary?: string) {
  const rows = alerts
    .map((a) => {
      const color = a.level === 'critical' ? '#dc2626' : a.level === 'warning' ? '#d97706' : '#059669';
      const tag = a.level === 'critical' ? 'CRÍTICA' : a.level === 'warning' ? 'ADVERTENCIA' : 'EN LÍNEA';
      return `
        <tr>
          <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
            <div style="font-weight:600;color:#111827;font-size:14px;">${escapeHtml(a.campaign)}</div>
            <div style="color:#6b7280;font-size:12px;margin-top:2px;">${escapeHtml(a.account)}${a.platform ? ' · ' + escapeHtml(a.platform) : ''}</div>
            <div style="margin-top:6px;font-size:12px;color:#374151;">${escapeHtml(a.message)}</div>
          </td>
          <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;text-align:right;vertical-align:top;font-size:12px;color:#374151;white-space:nowrap;">
            <span style="display:inline-block;background:${color};color:#fff;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;letter-spacing:0.3px;">${tag}</span>
            <div style="margin-top:6px;font-family:'JetBrains Mono',monospace;">${fmtMoney(a.spend)} / ${fmtMoney(a.budget)}</div>
            <div style="margin-top:2px;color:#6b7280;">${a.spendPct}% gasto · ${a.timePct}% tiempo</div>
          </td>
        </tr>`;
    })
    .join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Alertas de pacing</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Inter,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="padding:24px 28px;border-bottom:1px solid #e5e7eb;">
          <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Apache Studio · Ad Audit</div>
          <h1 style="margin:6px 0 0;font-size:20px;color:#111827;">Alertas de pacing activas</h1>
        </td></tr>
        ${summary ? `<tr><td style="padding:18px 28px 0;"><p style="margin:0;font-size:13px;line-height:1.6;color:#374151;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;">${escapeHtml(summary)}</p></td></tr>` : ''}
        <tr><td style="padding:18px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:12px;background:#fef2f2;border-radius:8px;text-align:center;">
                <div style="font-size:24px;font-weight:700;color:#dc2626;">${criticalCount}</div>
                <div style="font-size:11px;color:#7f1d1d;text-transform:uppercase;letter-spacing:0.5px;">Críticas</div>
              </td>
              <td style="width:12px;"></td>
              <td style="padding:12px;background:#fffbeb;border-radius:8px;text-align:center;">
                <div style="font-size:24px;font-weight:700;color:#d97706;">${warningCount}</div>
                <div style="font-size:11px;color:#78350f;text-transform:uppercase;letter-spacing:0.5px;">Advertencias</div>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 28px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            ${rows || '<tr><td style="padding:24px;text-align:center;color:#6b7280;font-size:13px;">No hay alertas para mostrar.</td></tr>'}
          </table>
          <p style="margin-top:18px;font-size:12px;color:#6b7280;">Este reporte se generó automáticamente desde tu panel de auditoría.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function renderSlackPayload(alerts: NotifyAlert[], criticalCount: number, warningCount: number, summary?: string) {
  const blocks: unknown[] = [
    { type: 'header', text: { type: 'plain_text', text: `Pacing alerts: ${criticalCount} critical · ${warningCount} warnings` } },
  ];
  if (summary) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: summary } });
  for (const a of alerts.slice(0, 50)) {
    const emoji = a.level === 'critical' ? '🔴' : a.level === 'warning' ? '🟡' : '🟢';
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *${a.campaign}* (${a.account}${a.platform ? ' · ' + a.platform : ''})\n${a.message}\n${fmtMoney(a.spend)} / ${fmtMoney(a.budget)} · ${a.spendPct}% spend · ${a.timePct}% time`,
      },
    });
  }
  return {
    text: `Pacing alerts: ${criticalCount} critical, ${warningCount} warnings`,
    blocks,
  };
}

export async function dispatchAlerts(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  userId: string;
  alerts: NotifyAlert[];
  summary?: string;
}): Promise<DispatchResult[]> {
  const { supabaseUrl, serviceRoleKey, userId, alerts, summary } = params;
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const results: DispatchResult[] = [];

  if (alerts.length === 0) return results;

  const criticalCount = alerts.filter((a) => a.level === 'critical').length;
  const warningCount = alerts.filter((a) => a.level === 'warning').length;

  const { data: channels } = await supabase
    .from('notification_channels')
    .select('*')
    .eq('user_id', userId)
    .eq('enabled', true);

  for (const channel of channels || []) {
    try {
      switch (channel.channel_type) {
        case 'email': {
          const recipients: string[] = (channel.config as any)?.recipients ?? [];
          if (recipients.length === 0) { results.push({ channel: 'email', ok: false, error: 'no recipients' }); break; }
          const html = renderEmailHtml(alerts, criticalCount, warningCount, summary);
          const sent = await sendEmail({
            to: recipients,
            subject: `Pacing alerts: ${criticalCount} critical · ${warningCount} warnings`,
            html,
          });
          results.push({ channel: 'email', ok: sent.ok, error: sent.ok ? undefined : String(sent.error) });
          break;
        }
        case 'slack_webhook':
        case 'generic_webhook': {
          const webhookUrl: string | undefined = (channel.config as any)?.webhook_url;
          if (!webhookUrl) { results.push({ channel: channel.channel_type, ok: false, error: 'no webhook_url' }); break; }
          const body = channel.channel_type === 'slack_webhook'
            ? renderSlackPayload(alerts, criticalCount, warningCount, summary)
            : { alerts, criticalCount, warningCount, summary: summary ?? null, sentAt: new Date().toISOString() };
          const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          results.push({ channel: channel.channel_type, ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` });
          break;
        }
        case 'in_app': {
          const rows = alerts.map((a) => ({
            user_id: userId,
            severity: a.level,
            campaign_name: a.campaign,
            alert_type: a.alertType,
            message: a.message,
          }));
          const { error } = await supabase.from('notifications').insert(rows);
          results.push({ channel: 'in_app', ok: !error, error: error?.message });
          break;
        }
        default:
          results.push({ channel: channel.channel_type, ok: false, error: 'unknown channel_type' });
      }
    } catch (e) {
      results.push({ channel: channel.channel_type, ok: false, error: (e as Error).message });
    }
  }

  return results;
}
