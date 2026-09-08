import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email.ts";
import { chatCompletion } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Last full Sunday→Sunday window (week_end = most recent Sunday)
function lastWeekWindow(): { start: string; end: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() - ((today.getDay() + 7) % 7 || 7) + 0); // most recent Sunday (today if Sunday)
  if (today.getDay() !== 0) end.setDate(today.getDate() - today.getDay());
  const start = new Date(end);
  start.setDate(end.getDate() - 7);
  return { start: iso(start), end: iso(end) };
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const fmtMoney = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtNum = (n: number) => n.toLocaleString("en-US");

function delta(cur: number, prev: number): string {
  if (prev <= 0) return cur > 0 ? '<span style="color:#059669;">new</span>' : "—";
  const pct = ((cur - prev) / prev) * 100;
  const up = pct >= 0;
  const color = up ? "#059669" : "#dc2626";
  return `<span style="color:${color};font-weight:600;">${up ? "▲" : "▼"} ${Math.abs(pct).toFixed(0)}%</span>`;
}

interface CampaignWeek {
  campaign: string;
  platform: string | null;
  budget: number;
  totalSpend: number;
  spendPct: number;
  timePct: number;
  week: Record<string, number>;
  prev: Record<string, number>;
}

function aggregate(rows: any[], from: string, to: string): Record<string, number> {
  const w = { spend: 0, impressions: 0, clicks: 0, conversions: 0, reach: 0, interactions: 0 };
  for (const r of rows) {
    const d = String(r.fecha ?? "").slice(0, 10);
    if (d < from || d >= to) continue;
    w.spend += Number(r.total_cost ?? 0);
    w.impressions += Number(r.impressions ?? 0);
    w.clicks += Number(r.clicks ?? 0);
    w.conversions += Number(r.conversions ?? 0);
    w.reach += Number(r.reach ?? 0);
    w.interactions += Number(r.interactions ?? 0);
  }
  return {
    ...w,
    ctr: w.impressions > 0 ? (w.clicks / w.impressions) * 100 : 0,
    cpc: w.clicks > 0 ? w.spend / w.clicks : 0,
    cpm: w.impressions > 0 ? (w.spend / w.impressions) * 1000 : 0,
  };
}

interface MonthlyBlock {
  curLabel: string;
  prevLabel: string;
  cur: Record<string, number>;
  prev: Record<string, number>;
}

function renderHtml(
  clientName: string,
  weekStart: string,
  weekEnd: string,
  campaigns: CampaignWeek[],
  aiSummary: string,
  monthly: MonthlyBlock | null = null,
): string {
  const totals = campaigns.reduce(
    (t, c) => ({
      spend: t.spend + c.week.spend,
      impressions: t.impressions + c.week.impressions,
      clicks: t.clicks + c.week.clicks,
      conversions: t.conversions + c.week.conversions,
      pSpend: t.pSpend + c.prev.spend,
      pImpressions: t.pImpressions + c.prev.impressions,
      pClicks: t.pClicks + c.prev.clicks,
      pConversions: t.pConversions + c.prev.conversions,
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, pSpend: 0, pImpressions: 0, pClicks: 0, pConversions: 0 },
  );

  const statCard = (label: string, value: string, d: string) => `
    <td style="padding:14px;background:#f9fafb;border-radius:8px;text-align:center;">
      <div style="font-size:20px;font-weight:700;color:#111827;">${value}</div>
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">${label}</div>
      <div style="font-size:11px;margin-top:4px;">${d} vs prev. week</div>
    </td><td style="width:10px;"></td>`;

  const campaignRows = campaigns.map(c => {
    const pace = c.spendPct - c.timePct;
    const paceColor = Math.abs(pace) <= 10 ? "#059669" : pace < 0 ? "#d97706" : "#dc2626";
    const paceLabel = Math.abs(pace) <= 10 ? "On track" : pace < 0 ? "Under" : "Over";
    return `
      <tr>
        <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
          <div style="font-weight:600;color:#111827;font-size:13px;">${esc(c.campaign)}</div>
          <div style="color:#6b7280;font-size:11px;margin-top:2px;">${c.platform ? esc(c.platform.toUpperCase()) : ""} · Budget ${fmtMoney(c.budget)}</div>
          <div style="margin-top:4px;font-size:11px;">
            <span style="display:inline-block;background:${paceColor};color:#fff;border-radius:4px;padding:1px 7px;font-size:10px;font-weight:600;">${paceLabel}</span>
            <span style="color:#6b7280;margin-left:6px;">${c.spendPct.toFixed(0)}% spent · ${c.timePct.toFixed(0)}% time</span>
          </div>
        </td>
        <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;white-space:nowrap;font-family:monospace;">
          ${fmtMoney(c.week.spend)}<br><span style="font-size:10px;">${delta(c.week.spend, c.prev.spend)}</span>
        </td>
        <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;white-space:nowrap;font-family:monospace;">
          ${fmtNum(c.week.impressions)}<br><span style="font-size:10px;">${delta(c.week.impressions, c.prev.impressions)}</span>
        </td>
        <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;white-space:nowrap;font-family:monospace;">
          ${fmtNum(c.week.clicks)}<br><span style="font-size:10px;">${delta(c.week.clicks, c.prev.clicks)}</span>
        </td>
        <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;white-space:nowrap;font-family:monospace;">
          ${c.week.ctr.toFixed(2)}%<br><span style="font-size:10px;">${delta(c.week.ctr, c.prev.ctr)}</span>
        </td>
        <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;white-space:nowrap;font-family:monospace;">
          ${fmtMoney(c.week.cpc)}<br><span style="font-size:10px;">${delta(c.week.cpc, c.prev.cpc)}</span>
        </td>
        <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;white-space:nowrap;font-family:monospace;">
          ${fmtNum(c.week.conversions)}<br><span style="font-size:10px;">${delta(c.week.conversions, c.prev.conversions)}</span>
        </td>
      </tr>`;
  }).join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Weekly Performance Report</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Inter,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="720" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="padding:26px 30px;border-bottom:1px solid #e5e7eb;background:#111827;">
          <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;">Apache Studio · Weekly Performance Report</div>
          <h1 style="margin:8px 0 0;font-size:22px;color:#ffffff;">${esc(clientName)}</h1>
          <div style="font-size:12px;color:#9ca3af;margin-top:4px;">Week ${weekStart} → ${weekEnd} (Sunday to Sunday)</div>
        </td></tr>
        <tr><td style="padding:20px 30px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            ${statCard("Spend", fmtMoney(totals.spend), delta(totals.spend, totals.pSpend))}
            ${statCard("Impressions", fmtNum(totals.impressions), delta(totals.impressions, totals.pImpressions))}
            ${statCard("Clicks", fmtNum(totals.clicks), delta(totals.clicks, totals.pClicks))}
            <td style="padding:14px;background:#f9fafb;border-radius:8px;text-align:center;">
              <div style="font-size:20px;font-weight:700;color:#111827;">${fmtNum(totals.conversions)}</div>
              <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">Conversions</div>
              <div style="font-size:11px;margin-top:4px;">${delta(totals.conversions, totals.pConversions)} vs prev. week</div>
            </td>
          </tr></table>
        </td></tr>
        ${aiSummary ? `
        <tr><td style="padding:0 30px 8px;">
          <div style="background:#f0f6ff;border-left:3px solid #2563eb;border-radius:6px;padding:16px 18px;">
            <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#2563eb;font-weight:600;margin-bottom:6px;">✦ AI Executive Summary</div>
            <div style="font-size:13px;line-height:1.65;color:#1f2937;white-space:pre-line;">${esc(aiSummary)}</div>
          </div>
        </td></tr>` : ""}
        ${monthly ? `
        <tr><td style="padding:8px 30px 4px;">
          <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6b7280;font-weight:600;margin-bottom:8px;">
            Monthly comparison · ${esc(monthly.curLabel)} vs ${esc(monthly.prevLabel)}
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <tr style="background:#f9fafb;">
              <th style="text-align:left;padding:9px 12px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#6b7280;">Metric</th>
              <th style="text-align:right;padding:9px 12px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#6b7280;">${esc(monthly.curLabel)}</th>
              <th style="text-align:right;padding:9px 12px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#6b7280;">${esc(monthly.prevLabel)}</th>
              <th style="text-align:right;padding:9px 12px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#6b7280;">Change</th>
            </tr>
            ${[
              ['Spend', monthly.cur.spend, monthly.prev.spend, true],
              ['Impressions', monthly.cur.impressions, monthly.prev.impressions, false],
              ['Clicks', monthly.cur.clicks, monthly.prev.clicks, false],
              ['Conversions', monthly.cur.conversions, monthly.prev.conversions, false],
              ['CTR', monthly.cur.ctr, monthly.prev.ctr, false],
              ['CPC', monthly.cur.cpc, monthly.prev.cpc, true],
            ].map(([label, cur, prev, money]) => `
              <tr>
                <td style="padding:8px 12px;border-top:1px solid #f3f4f6;font-size:12px;color:#111827;">${label}</td>
                <td style="padding:8px 12px;border-top:1px solid #f3f4f6;text-align:right;font-size:12px;font-family:monospace;color:#111827;">${money ? fmtMoney(cur as number) : (label === 'CTR' ? (cur as number).toFixed(2) + '%' : fmtNum(cur as number))}</td>
                <td style="padding:8px 12px;border-top:1px solid #f3f4f6;text-align:right;font-size:12px;font-family:monospace;color:#6b7280;">${money ? fmtMoney(prev as number) : (label === 'CTR' ? (prev as number).toFixed(2) + '%' : fmtNum(prev as number))}</td>
                <td style="padding:8px 12px;border-top:1px solid #f3f4f6;text-align:right;font-size:11px;">${delta(cur as number, prev as number)}</td>
              </tr>`).join('')}
          </table>
        </td></tr>` : ""}
        <tr><td style="padding:14px 30px 26px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;border-collapse:separate;">
            <tr style="background:#f9fafb;">
              <th style="text-align:left;padding:10px 14px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#6b7280;">Campaign</th>
              <th style="text-align:right;padding:10px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#6b7280;">Spend</th>
              <th style="text-align:right;padding:10px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#6b7280;">Impr.</th>
              <th style="text-align:right;padding:10px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#6b7280;">Clicks</th>
              <th style="text-align:right;padding:10px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#6b7280;">CTR</th>
              <th style="text-align:right;padding:10px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#6b7280;">CPC</th>
              <th style="text-align:right;padding:10px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#6b7280;">Conv.</th>
            </tr>
            ${campaignRows || '<tr><td colspan="7" style="padding:24px;text-align:center;color:#6b7280;font-size:13px;">No campaign activity this week.</td></tr>'}
          </table>
          <div style="margin-top:18px;font-size:11px;color:#9ca3af;text-align:center;">
            Generated automatically by Apache Studio · Real-time data synced from ad platforms
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// Business-day helpers (mirror of the app's pacing math)
function countDays(from: string, to: string, schedule: string): number {
  let count = 0;
  const d = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (d <= end) {
    const day = d.getDay();
    const ok = schedule === "lun_vie" ? day >= 1 && day <= 5
      : schedule === "lun_sab" ? day >= 1 && day <= 6
      : true;
    if (ok) count++;
    d.setDate(d.getDate() + 1);
  }
  return Math.max(count, 1);
}

// Current and previous calendar-month windows [start, endExclusive)
function monthWindows(): { curStart: string; curEnd: string; prevStart: string; prevEnd: string; curLabel: string; prevLabel: string } {
  const now = new Date();
  const curStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const fmtL = (d: Date) => d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return {
    curStart: iso(curStart), curEnd: iso(nextStart),
    prevStart: iso(prevStart), prevEnd: iso(curStart),
    curLabel: fmtL(curStart), prevLabel: fmtL(prevStart),
  };
}

async function generateForClient(
  supabase: any,
  client: { id: string; name: string; user_id: string; report_recipients: string[] },
  send: boolean,
  anthropicKey: string | undefined,
  includeMonthly = false,
): Promise<{ html: string; week_start: string; week_end: string; sent: boolean }> {
  const { start, end } = lastWeekWindow();

  const { data: audits } = await supabase
    .from("audit_records")
    .select("campaign_name, platform, presupuesto_total, fecha_inicio, fecha_fin, tipo_calendario")
    .eq("client_id", client.id);

  const campaignNames = Array.from(new Set((audits ?? []).map((a: any) => a.campaign_name).filter(Boolean)));
  let metrics: any[] = [];
  if (campaignNames.length) {
    const { data } = await supabase
      .from("meta_datos")
      .select("campaign_name, fecha, total_cost, impressions, clicks, reach, conversions, interactions")
      .in("campaign_name", campaignNames);
    metrics = data ?? [];
  }

  const prevStart = iso(new Date(new Date(start + "T00:00:00").getTime() - 7 * 86400000));
  const today = iso(new Date());

  const campaigns: CampaignWeek[] = (audits ?? []).map((a: any) => {
    const rows = metrics.filter((m) => m.campaign_name === a.campaign_name);
    const week = aggregate(rows, start, end);
    const prev = aggregate(rows, prevStart, start);
    const budget = Number(a.presupuesto_total ?? 0);
    const allSpend = rows
      .filter((m) => String(m.fecha ?? "").slice(0, 10) >= a.fecha_inicio)
      .reduce((s: number, m: any) => s + Number(m.total_cost ?? 0), 0);
    const totalDays = countDays(a.fecha_inicio, a.fecha_fin, a.tipo_calendario);
    const elapsedEnd = today < a.fecha_fin ? today : a.fecha_fin;
    const elapsedDays = a.fecha_inicio <= elapsedEnd ? countDays(a.fecha_inicio, elapsedEnd, a.tipo_calendario) : 0;
    return {
      campaign: a.campaign_name,
      platform: a.platform,
      budget,
      totalSpend: allSpend,
      spendPct: budget > 0 ? (allSpend / budget) * 100 : 0,
      timePct: totalDays > 0 ? (elapsedDays / totalDays) * 100 : 0,
      week,
      prev,
    };
  });

  // AI executive summary — strategist-grade, goes beyond the raw metrics
  let aiSummary = "";
  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
  if (OPENAI_KEY && campaigns.length > 0) {
    const result = await chatCompletion({
      model: "gpt-4o",
      maxTokens: 900,
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content:
            "You are a senior paid media strategist writing the weekly executive summary a client actually wants to read. The client can already see raw numbers in Meta/Google Ads — your value is INTERPRETATION, not repetition. " +
            "Explain WHY performance moved week over week, what it means for the client's goals, and where things are heading if the trend holds (a concrete projection). Be confident and specific, cite a few key numbers only to support the story. " +
            "Structure as short labeled paragraphs:\n" +
            "1) Headline — the single most important takeaway of the week.\n" +
            "2) What's working — and the reason behind it.\n" +
            "3) What needs attention — the issue, the likely cause, and the risk if ignored.\n" +
            "4) Projection — where spend/results are trending and what to expect next week if nothing changes.\n" +
            "5) Recommendations — 2-3 prioritized, specific actions (what to do, on which campaign, expected effect).\n" +
            "Professional, plain-spoken, client-friendly. No fluff, no generic advice. ~200-260 words. Plain text, no markdown symbols.",
        },
        {
          role: "user",
          content: `Client: ${client.name}. Week ${start} to ${end}.\nPer-campaign data (week = this week, prev = previous week, budget/spendPct/timePct describe full-campaign pacing):\n${JSON.stringify(campaigns, null, 1)}`,
        },
      ],
    });
    if (result.ok) {
      aiSummary = result.content;
    } else {
      console.error("AI summary failed", result.error);
    }
  }

  // Optional monthly comparison (this calendar month vs the previous one)
  let monthly: MonthlyBlock | null = null;
  if (includeMonthly) {
    const mw = monthWindows();
    const cur = aggregate(metrics, mw.curStart, mw.curEnd);
    const prev = aggregate(metrics, mw.prevStart, mw.prevEnd);
    monthly = { curLabel: mw.curLabel, prevLabel: mw.prevLabel, cur, prev };
  }

  const html = renderHtml(client.name, start, end, campaigns, aiSummary, monthly);

  // Send via direct Resend API when requested and recipients exist
  let sent = false;
  const recipients = client.report_recipients ?? [];
  if (send && recipients.length > 0) {
    const result = await sendEmail({
      to: recipients,
      subject: `Weekly Performance Report — ${client.name} (${start} → ${end})`,
      html,
    });
    sent = result.ok;
    if (!result.ok) console.error("Resend send failed", result.status, JSON.stringify(result.error));
  }

  // Upsert the report for this week (one per client+week)
  const { data: existing } = await supabase
    .from("weekly_reports")
    .select("id")
    .eq("client_id", client.id)
    .eq("week_start", start)
    .maybeSingle();

  const payload = {
    user_id: client.user_id,
    client_id: client.id,
    week_start: start,
    week_end: end,
    html,
    ...(sent ? { sent_at: new Date().toISOString(), sent_to: recipients } : {}),
  };
  if (existing?.id) {
    await supabase.from("weekly_reports").update(payload).eq("id", existing.id);
  } else {
    await supabase.from("weekly_reports").insert(payload);
  }

  return { html, week_start: start, week_end: end, sent };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANTHROPIC_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const CRON_SECRET = Deno.env.get("CRON_SECRET");
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.replace("Bearer ", "");
    const cronSecret = req.headers.get("x-cron-secret");

    // ── Cron mode: runs every Monday for ALL clients with recipients ──
    const isCron = bearer === SERVICE_KEY || (CRON_SECRET && cronSecret === CRON_SECRET);
    if (isCron) {
      const { data: clients } = await supabase
        .from("audit_clients")
        .select("id, name, user_id, report_recipients")
        .neq("report_recipients", "{}");
      let generated = 0, sentCount = 0;
      for (const c of clients ?? []) {
        if (!c.report_recipients?.length) continue;
        try {
          const r = await generateForClient(supabase, c, true, ANTHROPIC_API_KEY, true);
          generated++;
          if (r.sent) sentCount++;
        } catch (e) {
          console.error(`weekly-report failed for client ${c.id}`, e);
        }
      }
      return jsonRes({ mode: "cron", generated, sent: sentCount });
    }

    // ── User mode: manual generate/preview from the app ──
    if (!bearer) return jsonRes({ error: "Unauthorized" }, 401);
    const { data: userData, error: userErr } = await supabase.auth.getUser(bearer);
    if (userErr || !userData.user) return jsonRes({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const { clientId, send, includeMonthly } = await req.json();
    if (!clientId) return jsonRes({ error: "clientId is required" }, 400);

    const { data: client } = await supabase
      .from("audit_clients")
      .select("id, name, user_id, report_recipients")
      .eq("id", clientId)
      .maybeSingle();
    if (!client || client.user_id !== userId) return jsonRes({ error: "Client not found" }, 404);

    const result = await generateForClient(supabase, client, !!send, ANTHROPIC_API_KEY, !!includeMonthly);
    return jsonRes(result);
  } catch (e) {
    console.error(e);
    return jsonRes({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
