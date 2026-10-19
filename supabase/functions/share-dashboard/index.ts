// Datos públicos de un enlace compartido (share_links). Sin sesión: el token
// largo es la única llave. Solo lectura, solo el cliente del token.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const days = [7, 30, 90].includes(Number(url.searchParams.get("days"))) ? Number(url.searchParams.get("days")) : 30;
  if (!/^[a-f0-9]{48}$/.test(token)) return json({ error: "Enlace no válido" }, 404);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: link } = await db.from("share_links").select("client_id, active").eq("token", token).maybeSingle();
  if (!link || !link.active) return json({ error: "Este enlace no existe o fue desactivado" }, 404);
  const c = link.client_id;

  const { data: client } = await db.from("audit_clients").select("name").eq("id", c).single();
  const rpc = (fn: string, args: Record<string, unknown>) =>
    db.rpc(fn, args).then((r) => { if (r.error) throw r.error; return r.data ?? []; });
  try {
    const [daily, campaigns, ads, platform, gender, age, region] = await Promise.all([
      rpc("meta_daily_totals", { _days: days, _client_id: c }),
      rpc("meta_campaign_totals", { _days: days, _client_id: c }),
      rpc("meta_ad_totals", { _days: days, _client_id: c }),
      rpc("meta_breakdown_totals", { _kind: "platform", _days: days, _client_id: c }),
      rpc("meta_breakdown_totals", { _kind: "gender", _days: days, _client_id: c }),
      rpc("meta_breakdown_totals", { _kind: "age", _days: days, _client_id: c }),
      rpc("meta_breakdown_totals", { _kind: "region", _days: days, _client_id: c }),
    ]);
    const strip = (rows: any[]) => rows.map(({ client_id, account_id, ...r }) => r);
    return json({
      client: client?.name ?? "", days, daily,
      campaigns: strip(campaigns), ads: strip(ads).slice(0, 10),
      platform, gender, age, region: region.slice(0, 10),
    });
  } catch (e) {
    console.error(e);
    return json({ error: "No se pudieron cargar los datos" }, 500);
  }
});
