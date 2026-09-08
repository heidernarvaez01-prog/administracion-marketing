// Direct Resend send — no Lovable gateway dependency.
// `from` and `replyTo` come from RESEND_FROM / RESEND_REPLY_TO secrets and
// default to the verified apachestudio.mx sender. Override per call only when
// the sender is also a verified domain.

export interface SendEmailOptions {
  to: string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  from?: string;
  tags?: Array<{ name: string; value: string }>;
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  status?: number;
  error?: unknown;
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, error: "RESEND_API_KEY not configured" };

  const from = opts.from || Deno.env.get("RESEND_FROM") || "Apache Studio <alertas@apachestudio.mx>";
  const replyTo = opts.replyTo || Deno.env.get("RESEND_REPLY_TO") || "soporte@apachestudio.mx";

  const headers: Record<string, string> = {
    "List-Unsubscribe": `<mailto:${replyTo}?subject=unsubscribe>`,
    ...(opts.headers ?? {}),
  };

  const payload: Record<string, unknown> = {
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    reply_to: replyTo,
    headers,
  };
  if (opts.text) payload.text = opts.text;
  if (opts.tags?.length) payload.tags = opts.tags;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Resend send failed", res.status, JSON.stringify(data));
    return { ok: false, status: res.status, error: data };
  }
  return { ok: true, id: (data as { id?: string }).id };
}

export const sharedCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
