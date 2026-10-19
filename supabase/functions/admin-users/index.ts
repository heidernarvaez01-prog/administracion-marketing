import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { sendEmail, sharedCorsHeaders as corsHeaders } from '../_shared/email.ts';
import { buildInviteEmail, buildPasswordResetEmail } from './_templates.ts';
import { isAdminRole, manualAccountAction } from './manual-accounts.ts';
import { validAccessChange } from './access-actions.ts';

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
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !serviceKey || !anonKey) throw new Error('Auth configuration unavailable');
  return {
    url, serviceKey, anonKey,
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
  if (!isAdminRole(role)) return { ok: false, response: json({ error: 'Forbidden: admin only' }, 403) };

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

  return json({ ok: true, userId: data?.user?.id, email: emailResult });
}

async function handleDeleteUser(admin: SupabaseClient, body: any, callerId: string) {
  const targetId = String(body?.userId ?? '').trim();
  if (!targetId) return json({ error: 'userId required' }, 400);
  if (targetId === callerId) return json({ error: "You can't delete your own account" }, 400);

  // Clean up app-level rows first; foreign keys may not cascade.
  await admin.from('account_assignments').delete().eq('user_id', targetId);
  await admin.from('user_roles').delete().eq('user_id', targetId);
  await admin.from('client_members').delete().eq('user_id', targetId);
  await admin.from('agency_members').delete().eq('user_id', targetId);
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

  return json({ ok: true, email: emailResult });
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
  const results = await Promise.all([
    admin.from('agency_members').select('agency_id,user_id,role'),
    admin.from('client_members').select('client_id,user_id,role'),
    admin.from('agencies').select('id,name'),
    admin.from('audit_clients').select('id,name,agency_id'),
    admin.from('client_accounts').select('client_id,account_id'),
    admin.from('ad_accounts').select('account_id,account_name'),
  ]);
  for (const result of results) if (result.error) throw result.error;
  return json({ users, agencyMembers: results[0].data, clientMembers: results[1].data,
    agencies: results[2].data, clients: results[3].data,
    clientAccounts: results[4].data, accounts: results[5].data });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action = (body?.action as string) || 'list';

    switch (action) {
      case 'change_access': {
        if (!validAccessChange(body)) return json({ error: 'Acceso inválido. Solo viewer o manager.' }, 400);
        const { data: targetRole, error: roleError } = await auth.admin.from('user_roles').select('role').eq('user_id', body.userId).eq('role', 'admin').maybeSingle();
        if (roleError) throw roleError;
        if (targetRole || body.userId === auth.userId) return json({ error: 'No se modifica el acceso del administrador.' }, 403);
        const { data: target, error: targetError } = await auth.admin.auth.admin.getUserById(body.userId);
        if (targetError || !target.user) return json({ error: 'Usuario no encontrado.' }, 404);
        const manager = body.accessRole === 'manager';
        const table = manager ? 'agency_members' : 'client_members';
        const scope = manager ? 'agency_id' : 'client_id';
        const { data: resource } = await auth.admin.from(manager ? 'agencies' : 'audit_clients').select('id').eq('id', body.scopeId).maybeSingle();
        if (!resource) return json({ error: 'Agencia o cliente no encontrado.' }, 404);
        const result = body.operation === 'remove'
          ? await auth.admin.from(table).delete().eq('user_id', body.userId).eq(scope, body.scopeId)
          : await auth.admin.from(table).upsert({ user_id: body.userId, [scope]: body.scopeId, role: body.accessRole });
        if (result.error) throw result.error;
        return json({ ok: true });
      }
      case 'create_user':
      case 'set_password': {
        const result = await manualAccountAction(auth.admin, body);
        return json(result.body, result.status);
      }
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
