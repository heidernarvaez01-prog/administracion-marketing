// "Charla con tus datos" — agentic rewrite. Was context-stuffing: aggregate
// up to 800 rows in JS, dump the JSON into one prompt, one OpenAI call. That
// caps out fast (no arbitrary date range, no drill-down below what was
// pre-aggregated) and doesn't scale past one platform. Now the model gets a
// menu of tools over the shared semantic layer (_shared/metrics.ts +
// _shared/meta-datos-query.ts) and pulls exactly the data it needs via
// runToolLoop (_shared/openai.ts, Fase 3) — same math the UI charts use,
// same request/response contract AskAIPage.tsx already calls.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { runToolLoop, type ToolHandlerDefinition } from "../_shared/openai.ts";
import { queryMetaDatos } from "../_shared/meta-datos-query.ts";
import { aggregateTotals, getTopCampaigns, getFunnelBreakdown, getAdLeaderboard, compareToPreviousPeriod, type TopCampaignMetric } from "../_shared/metrics.ts";
import { calculateAuditMetrics } from "../_shared/audit-calculations.ts";
import { generateAlerts, ALERT_TYPE_LABELS } from "../_shared/alert-engine.ts";
import { loadUserThresholds } from "../_shared/alert-thresholds.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AuditRecord {
  account_id: string | null;
  campaign_name: string;
  platform: string | null;
  presupuesto_total: number;
  fecha_inicio: string;
  fecha_fin: string;
  tipo_calendario: "corridos" | "lun_vie" | "lun_sab";
  client_id: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const { question, clientId, campaignName } = await req.json();
    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "question is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resolve the user's own campaign universe ONCE, scoped by userId (and
    // narrowed further if the chat UI already fixed a client/campaign) —
    // every tool below stays inside this set. This is the same
    // security-sensitive audit_records join the old implementation did,
    // just centralized instead of re-queried per tool call.
    let auditQuery = supabase
      .from("audit_records")
      .select("account_id, campaign_name, platform, presupuesto_total, fecha_inicio, fecha_fin, tipo_calendario, client_id")
      .eq("user_id", userId);
    if (clientId && typeof clientId === "string") auditQuery = auditQuery.eq("client_id", clientId);
    if (campaignName && typeof campaignName === "string") auditQuery = auditQuery.eq("campaign_name", campaignName);
    const { data: auditsRaw } = await auditQuery;
    const audits = (auditsRaw ?? []) as AuditRecord[];
    const allowedCampaigns = new Set(audits.map((a) => a.campaign_name).filter(Boolean));

    if (allowedCampaigns.size === 0) {
      return new Response(
        JSON.stringify({ answer: "No tienes campañas configuradas en el alcance seleccionado todavía — crea una auditoría primero.", stats: { toolCalls: 0, iterations: 0 } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { thresholds, enabledTypes } = await loadUserThresholds(supabase, userId);

    const inScope = (name: unknown): name is string => typeof name === "string" && allowedCampaigns.has(name);
    const asStr = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
    const asNum = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);

    const tools: ToolHandlerDefinition[] = [
      {
        name: "list_campaigns",
        description: "List the campaigns available to analyze, with their client, platform, budget and date range.",
        parameters: {
          type: "object",
          properties: {
            clientId: { type: "string", description: "Optional: only list campaigns for this client id." },
          },
        },
        handler: (args) => {
          const filterClient = asStr(args.clientId);
          return audits
            .filter((a) => !filterClient || a.client_id === filterClient)
            .map((a) => ({
              campaign: a.campaign_name,
              client_id: a.client_id,
              platform: a.platform,
              budget: a.presupuesto_total,
              start_date: a.fecha_inicio,
              end_date: a.fecha_fin,
            }));
        },
      },
      {
        name: "get_campaign_metrics",
        description: "Get aggregated spend/clicks/impressions/CTR/CPC/CPM/ROAS for one campaign over a date range.",
        parameters: {
          type: "object",
          properties: {
            campaignName: { type: "string", description: "Exact campaign name, from list_campaigns." },
            dateFrom: { type: "string", description: "Inclusive start date, YYYY-MM-DD." },
            dateTo: { type: "string", description: "Inclusive end date, YYYY-MM-DD." },
          },
          required: ["campaignName", "dateFrom", "dateTo"],
        },
        handler: async (args) => {
          const campaign = asStr(args.campaignName);
          if (!inScope(campaign)) return { error: "Unknown campaign, call list_campaigns first." };
          const rows = await queryMetaDatos(supabase, { campaignNames: [campaign], dateFrom: asStr(args.dateFrom), dateTo: asStr(args.dateTo) });
          return { campaign, rows: rows.length, ...aggregateTotals(rows) };
        },
      },
      {
        name: "get_top_campaigns",
        description: "Rank the campaigns in scope by a metric over a date range.",
        parameters: {
          type: "object",
          properties: {
            metric: { type: "string", enum: ["cost", "clicks", "impressions", "purchaseValue", "roas", "ctr"], description: "Metric to rank by. Defaults to cost." },
            limit: { type: "number", description: "Max campaigns to return. Defaults to 10." },
            dateFrom: { type: "string", description: "Inclusive start date, YYYY-MM-DD." },
            dateTo: { type: "string", description: "Inclusive end date, YYYY-MM-DD." },
          },
          required: ["dateFrom", "dateTo"],
        },
        handler: async (args) => {
          const rows = await queryMetaDatos(supabase, { campaignNames: Array.from(allowedCampaigns), dateFrom: asStr(args.dateFrom), dateTo: asStr(args.dateTo) });
          const metric = (asStr(args.metric) as TopCampaignMetric | undefined) ?? "cost";
          return getTopCampaigns(rows, metric, asNum(args.limit) ?? 10);
        },
      },
      {
        name: "compare_periods",
        description: "Compare one campaign's metrics between two date ranges (e.g. this week vs last week) and get the percent change for each metric.",
        parameters: {
          type: "object",
          properties: {
            campaignName: { type: "string", description: "Exact campaign name, from list_campaigns." },
            currentFrom: { type: "string", description: "Inclusive start date of the current period, YYYY-MM-DD." },
            currentTo: { type: "string", description: "Inclusive end date of the current period, YYYY-MM-DD." },
            previousFrom: { type: "string", description: "Inclusive start date of the comparison period, YYYY-MM-DD." },
            previousTo: { type: "string", description: "Inclusive end date of the comparison period, YYYY-MM-DD." },
          },
          required: ["campaignName", "currentFrom", "currentTo", "previousFrom", "previousTo"],
        },
        handler: async (args) => {
          const campaign = asStr(args.campaignName);
          if (!inScope(campaign)) return { error: "Unknown campaign, call list_campaigns first." };
          const [currentRows, previousRows] = await Promise.all([
            queryMetaDatos(supabase, { campaignNames: [campaign], dateFrom: asStr(args.currentFrom), dateTo: asStr(args.currentTo) }),
            queryMetaDatos(supabase, { campaignNames: [campaign], dateFrom: asStr(args.previousFrom), dateTo: asStr(args.previousTo) }),
          ]);
          return compareToPreviousPeriod(currentRows, previousRows);
        },
      },
      {
        name: "get_funnel",
        description: "Get the conversion funnel (impressions -> clicks -> landing page views -> add to cart -> checkout -> purchases) for one campaign over a date range.",
        parameters: {
          type: "object",
          properties: {
            campaignName: { type: "string", description: "Exact campaign name, from list_campaigns." },
            dateFrom: { type: "string", description: "Inclusive start date, YYYY-MM-DD." },
            dateTo: { type: "string", description: "Inclusive end date, YYYY-MM-DD." },
          },
          required: ["campaignName", "dateFrom", "dateTo"],
        },
        handler: async (args) => {
          const campaign = asStr(args.campaignName);
          if (!inScope(campaign)) return { error: "Unknown campaign, call list_campaigns first." };
          const rows = await queryMetaDatos(supabase, { campaignNames: [campaign], dateFrom: asStr(args.dateFrom), dateTo: asStr(args.dateTo) });
          return getFunnelBreakdown(rows);
        },
      },
      {
        name: "get_ad_leaderboard",
        description: "Get the top individual ads (creatives) within one campaign, ranked by spend, with CTR/ROAS/quality ranking per ad.",
        parameters: {
          type: "object",
          properties: {
            campaignName: { type: "string", description: "Exact campaign name, from list_campaigns." },
            limit: { type: "number", description: "Max ads to return. Defaults to 10." },
          },
          required: ["campaignName"],
        },
        handler: async (args) => {
          const campaign = asStr(args.campaignName);
          if (!inScope(campaign)) return { error: "Unknown campaign, call list_campaigns first." };
          const rows = await queryMetaDatos(supabase, { campaignNames: [campaign] });
          return getAdLeaderboard(rows, asNum(args.limit) ?? 10);
        },
      },
      {
        name: "get_active_alerts",
        description: "Get the currently active pacing/delivery alerts (overspend, not spending, ending soon, cost spikes, budget mismatch, creative fatigue) for campaigns in scope.",
        parameters: {
          type: "object",
          properties: {
            clientId: { type: "string", description: "Optional: only check campaigns for this client id." },
            campaignName: { type: "string", description: "Optional: only check this one campaign." },
          },
        },
        handler: async (args) => {
          const filterClient = asStr(args.clientId);
          const filterCampaign = asStr(args.campaignName);
          const targets = audits.filter(
            (a) => (!filterClient || a.client_id === filterClient) && (!filterCampaign || a.campaign_name === filterCampaign),
          );
          const out: Array<{ campaign: string; alerts: string[] }> = [];
          for (const rec of targets) {
            const rows = await queryMetaDatos(supabase, { campaignNames: [rec.campaign_name], dateFrom: rec.fecha_inicio, dateTo: rec.fecha_fin });
            const cost = aggregateTotals(rows).cost;
            const metrics = calculateAuditMetrics(Number(rec.presupuesto_total), rec.fecha_inicio, rec.fecha_fin, rec.tipo_calendario, cost);
            const alerts = generateAlerts(metrics, rows, thresholds, enabledTypes);
            if (alerts.length > 0) out.push({ campaign: rec.campaign_name, alerts: alerts.map((a) => `${ALERT_TYPE_LABELS[a.type]}: ${a.message}`) });
          }
          return out.length > 0 ? out : { message: "No active alerts in scope." };
        },
      },
    ];

    const today = new Date().toISOString().slice(0, 10);
    const scopeNote = campaignName
      ? `The user has this chat scoped to one campaign: "${campaignName}".`
      : clientId
        ? "The user has this chat scoped to one client (multiple campaigns may be in scope)."
        : "The user has not scoped this chat — all their campaigns are in scope.";

    const systemPrompt = `You are a senior performance marketing analyst answering questions about the user's ad campaigns. ` +
      `Today's date is ${today}. ${scopeNote}\n` +
      `Rules:\n` +
      `- Use the tools to fetch real data before answering. Never invent numbers.\n` +
      `- Call list_campaigns first if you don't already know the exact campaign name(s) to query — campaign names must match exactly.\n` +
      `- If the user doesn't specify a date range, default to the last 30 days ending today.\n` +
      `- Answer in the same language the user asks in (default Spanish).\n` +
      `- Be concrete: cite the actual numbers you fetched (spend, CTR, CPC, CPM, ROAS, conversions) and campaign names.\n` +
      `- Structure your answer with markdown: key findings, diagnosis, actionable recommendations.\n` +
      `- Be brief and direct (max 350 words).`;

    const result = await runToolLoop({
      model: "gpt-4o-mini",
      systemPrompt,
      messages: [{ role: "user", content: question }],
      tools,
      maxIterations: 5,
      maxTokens: 1500,
    });

    if (!result.ok) {
      if (result.rateLimited) {
        return new Response(JSON.stringify({ error: "Límite de uso alcanzado. Intenta de nuevo en unos segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.error("OpenAI error", result.error);
      return new Response(JSON.stringify({ error: "Error del servicio de IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(
      JSON.stringify({ answer: result.content || "Sin respuesta.", stats: { toolCalls: result.toolCalls, iterations: result.iterations } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
