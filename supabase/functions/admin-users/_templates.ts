// HTML/text builders for admin-users emails. Kept separate so index.ts only
// handles auth, routing and Resend wiring.

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

const REPLY_FALLBACK = "soporte@apachestudio.mx";

function replyAddress(): string {
  return Deno.env.get("RESEND_REPLY_TO") || REPLY_FALLBACK;
}

function shell(inner: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Apache Studio</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:10px;border:1px solid #e5e7eb">
        <tr><td style="padding:28px 32px">${inner}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function ctaButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 22px">
    <tr><td align="center" bgcolor="#1e40af" style="border-radius:6px">
      <a href="${href}" target="_blank" rel="noopener" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">${label}</a>
    </td></tr>
  </table>`;
}

function fallbackLink(href: string): string {
  return `<p style="margin:0 0 8px;font-size:13px;color:#475569">If the button does not work, copy and paste this URL into your browser:</p>
  <p style="margin:0 0 22px;font-size:13px;color:#1e40af;word-break:break-all"><a href="${href}" target="_blank" rel="noopener" style="color:#1e40af">${href}</a></p>`;
}

export function buildInviteEmail(actionLink: string, inviterEmail?: string) {
  const safe = escapeHtml(actionLink);
  const inviter = inviterEmail ? ` by ${inviterEmail}` : "";
  const text = `Hi,

You have been added${inviter} to the Apache Studio workspace.

Set your password and access the workspace here:
${actionLink}

This link expires in 24 hours. If you did not expect this email, you can safely ignore it.

— Apache Studio`;

  const inviterHtml = inviterEmail ? ` by <strong>${escapeHtml(inviterEmail)}</strong>` : "";
  const html = shell(`
    <p style="margin:0 0 14px;font-size:15px;line-height:1.55">Hi,</p>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.55">You have been added${inviterHtml} to the Apache Studio workspace. Use the button below to set your password and sign in.</p>
    ${ctaButton(safe, "Set your password")}
    ${fallbackLink(safe)}
    <p style="margin:0;font-size:12px;color:#64748b">This link expires in 24 hours. If you did not expect this email, you can safely ignore it.</p>
    <p style="margin:18px 0 0;font-size:12px;color:#94a3b8">Apache Studio · ${replyAddress()}</p>
  `);

  return {
    subject: "Your Apache Studio account is ready",
    html,
    text,
    tags: [{ name: "category", value: "invite" }],
    headers: { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

export function buildPasswordResetEmail(actionLink: string) {
  const safe = escapeHtml(actionLink);
  const text = `Hi,

A password reset was requested for your Apache Studio account. Open this link to set a new password (expires in 1 hour):

${actionLink}

If you did not request this, you can ignore this email.

— Apache Studio`;

  const html = shell(`
    <p style="margin:0 0 14px;font-size:15px;line-height:1.55">Hi,</p>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.55">A password reset was requested for your Apache Studio account.</p>
    ${ctaButton(safe, "Reset password")}
    ${fallbackLink(safe)}
    <p style="margin:0;font-size:12px;color:#64748b">This link expires in 1 hour. If you did not request it, you can ignore this email.</p>
  `);

  return {
    subject: "Reset your Apache Studio password",
    html,
    text,
    tags: [{ name: "category", value: "password_reset" }],
  };
}
