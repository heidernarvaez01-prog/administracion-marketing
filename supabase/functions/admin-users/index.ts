import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { sendEmail, sharedCorsHeaders as corsHeaders } from '../_shared/email.ts';
import { buildInviteEmail, buildPasswordResetEmail } from './_templates.ts';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Env {
  url: string;
  serviceKey: string;
  anonKey: string;
}

function env(): Env {
  return {
    url: Deno.env.get('SUPABASE_URL')!,
    serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    anonKey: Deno.env.get('SUPABASE_ANON_KEY')!,
  };
}

async function requireAdmin(req: Request): Promise<
  | { ok: true; admin: SupabaseClient; userId: string; userEmail: string | null }
  | { ok: false; response: Response }
> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return { ok: false, response: json({ error: 'Missing authorization' }, 401) };

  const { url, serviceKey, anonKey } = env();
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return { ok: false, response: json({ error: 'Unauthorized' }, 401) };

  const admin = createClient(url, serviceKey);
  const { data: role } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();
  if (!role) return { ok: false, response: json({ error: 'Forbidden: admin only' }, 403) };

  return { ok: true, admin, userId: user.id, userEmail: user.email ?? null };
}

async function generateAuthLink(
  admin: SupabaseClient,
  type: 'invite' | 'recovery',
  email: string,
  redirectTo?: string,
) {
  return admin.auth.admin.generateLink({
    type,
    email,
    options: redirectTo ? { redirectTo } : undefined,
  });
}

async function handleInvite(admin: SupabaseClient, body: any, inviterEmail: string | null) {
  const email = String(body?.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ error: 'Invalid email' }, 400);
  const redirectTo = body?.redirectTo ? String(body.redirectTo) : undefined;

  const { data, error } = await generateAuthLink(admin, 'invite', email, redirectTo);
  if (error) {
    if (String(error.message).toLowerCase().includes('already')) {
      return json({ ok: true, alreadyMember: true });
    }
    return json({ error: error.message }, 400);
  }

  const actionLink = data?.properties?.action_link;
  let emailResult: { sent: boolean; reason?: string; id?: string } = { sent: false, reason: 'no_link' };

  if (actionLink) {
    const tpl = buildInviteEmail(actionLink, inviterEmail ?? undefined);
    const result = await sendEmail({ to: [email], ...tpl });
    emailResult = result.ok
      ? { sent: true, id: result.id }
      : { sent: false, reason: `resend_${result.status ?? 'error'}` };
  }

  return json({ ok: true, userId: data?.user?.id, actionLink, email: emailResult });
}

async function handleDeleteUser(admin: SupabaseClient, body: any, callerId: string) {
  const targetId = String(body?.userId ?? '').trim();
  if (!targetId) return json({ error: 'userId required' }, 400);
  if (targetId === callerId) return json({ error: "You can't delete your own account" }, 400);

  // Clean up app-level rows first; foreign keys may not cascade.
  await admin.from('account_assignments').delete().eq('user_id', targetId);
  await admin.from('user_roles').delete().eq('user_id', targetId);
  const { error } = await admin.auth.admin.deleteUser(targetId);
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
}

async function handleResetPassword(admin: SupabaseClient, body: any) {
  const email = String(body?.email ?? '').trim().toLowerCase();
  if (!email) return json({ error: 'email required' }, 400);
  const redirectTo = body?.redirectTo ? String(body.redirectTo) : undefined;

  const { data, error } = await generateAuthLink(admin, 'recovery', email, redirectTo);
  if (error) return json({ error: error.message }, 400);

  const actionLink = data?.properties?.action_link;
  let emailResult: { sent: boolean; reason?: string; id?: string } = { sent: false, reason: 'no_link' };

  if (actionLink) {
    const tpl = buildPasswordResetEmail(actionLink);
    const result = await sendEmail({ to: [email], ...tpl });
    emailResult = result.ok
      ? { sent: true, id: result.id }
      : { sent: false, reason: `resend_${result.status ?? 'error'}` };
  }

  return json({ ok: true, actionLink, email: emailResult });
}

async function handleList(admin: SupabaseClient) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const users = data.users
    .filter((u) => !!u.email)
    .map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      confirmed: !!u.email_confirmed_at || !!u.confirmed_at,
    }));
  return json({ users });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action = (body?.action as string) || 'list';

    switch (action) {
      case 'invite':
        return await handleInvite(auth.admin, body, auth.userEmail);
      case 'delete_user':
        return await handleDeleteUser(auth.admin, body, auth.userId);
      case 'reset_password':
        return await handleResetPassword(auth.admin, body);
      case 'list':
        return await handleList(auth.admin);
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
