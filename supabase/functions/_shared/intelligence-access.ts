import { createClient } from 'npm:@supabase/supabase-js@2';
export function intelligenceOperationAllowed(admin: boolean, operation: string): boolean {
  return admin || ['read', 'preview', 'ask'].includes(operation);
}
export async function clientAccess(authorization: string, clientId: string) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !key) throw new Error('Auth configuration unavailable');
  const scoped = createClient(url, key, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error } = await scoped.auth.getUser();
  if (error || !user) return null;
  const [clientRes, roleRes, accountsRes] = await Promise.all([
    scoped.from('audit_clients').select('id,name,description,user_id,report_recipients').eq('id', clientId).maybeSingle(),
    scoped.rpc('has_role', { _user_id: user.id, _role: 'admin' }),
    scoped.from('client_accounts').select('account_id').eq('client_id', clientId),
  ]);
  if (clientRes.error || accountsRes.error) throw clientRes.error || accountsRes.error;
  if (!clientRes.data) return null;
  return { scoped, user, client: clientRes.data, admin: roleRes.data === true,
    accountIds: (accountsRes.data || []).map((a) => a.account_id) };
}

export async function clientMetricRows(service: any, accountIds: string[]) {
  if (!accountIds.length) return [];
  const from = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const rows: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await service.from('meta_datos').select('*').in('account_id', accountIds)
      .gte('fecha', from).order('id').range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}
