import { useEffect, useMemo, useState } from 'react';
import {
  Shield, UserPlus, Trash2, Loader2, Users, Link2, ShieldCheck, ShieldOff, Mail, KeyRound,
  Send, Ban, Building2, UserX, Sparkles,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import PageHero from '@/components/PageHero';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface UserRow { id: string; email: string | null; last_sign_in_at: string | null; confirmed?: boolean; }
interface Assignment { id: string; user_id: string; account_id: string; account_name: string | null; platform: string | null; }
interface AccountOpt { account_id: string; account_name: string | null; platform: string | null; }
interface RoleRow { user_id: string; role: 'admin' | 'user'; }

const NO_ACCOUNT = '__none__';

export default function AdminPage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [search, setSearch] = useState('');

  // Unified "add / update member" form — account is optional.
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<'user' | 'admin'>('user');
  const [formAccount, setFormAccount] = useState<string>(NO_ACCOUNT);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    const [usersRes, accountsRes, assignmentsRes, rolesRes] = await Promise.all([
      supabase.functions.invoke('admin-users'),
      supabase.from('meta_datos').select('account_id, account_name, plataforma').not('account_id', 'is', null),
      supabase.from('account_assignments').select('*').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('user_id, role'),
    ]);
    if (usersRes.data?.users) setUsers(usersRes.data.users);
    if (assignmentsRes.data) setAssignments(assignmentsRes.data as Assignment[]);
    if (rolesRes.data) setRoles(rolesRes.data as RoleRow[]);

    const seen = new Set<string>();
    const opts: AccountOpt[] = [];
    for (const r of accountsRes.data ?? []) {
      const key = `${r.account_id}|${r.plataforma ?? ''}`;
      if (seen.has(key) || !r.account_id) continue;
      seen.add(key);
      opts.push({ account_id: r.account_id, account_name: r.account_name, platform: r.plataforma });
    }
    opts.sort((a, b) => (a.account_name ?? '').localeCompare(b.account_name ?? ''));
    setAccounts(opts);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: roleRow } = await supabase
        .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
      const admin = !!roleRow;
      setIsAdmin(admin);
      if (admin) await loadData();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const userById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const adminIds = useMemo(() => new Set(roles.filter((r) => r.role === 'admin').map((r) => r.user_id)), [roles]);

  const filteredAssignments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter((a) => {
      const email = userById[a.user_id]?.email ?? '';
      return email.toLowerCase().includes(q) || (a.account_name ?? '').toLowerCase().includes(q) || a.account_id.includes(q);
    });
  }, [assignments, search, userById]);

  const assignmentsByUser = useMemo(() => {
    const map: Record<string, Assignment[]> = {};
    for (const a of assignments) (map[a.user_id] ||= []).push(a);
    return map;
  }, [assignments]);

  // Ensure role row: admin ⇒ insert admin row (keep 'user' if exists); user ⇒ upsert baseline 'user'.
  const ensureRole = async (uid: string, role: 'user' | 'admin') => {
    if (role === 'admin' && !adminIds.has(uid)) {
      const { error } = await supabase.from('user_roles').insert({ user_id: uid, role: 'admin' });
      if (!error) setRoles((r) => [...r, { user_id: uid, role: 'admin' }]);
    } else if (role === 'user') {
      await supabase.from('user_roles').upsert({ user_id: uid, role: 'user' }, { onConflict: 'user_id,role' });
      setRoles((r) => (r.some((x) => x.user_id === uid && x.role === 'user') ? r : [...r, { user_id: uid, role: 'user' }]));
    }
  };

  const assignAccountTo = async (uid: string, accountKey: string) => {
    if (!accountKey || accountKey === NO_ACCOUNT) return null;
    const acc = accounts.find((a) => `${a.account_id}|${a.platform ?? ''}` === accountKey);
    if (!acc) return null;
    // Skip duplicate.
    if (assignments.some((a) => a.user_id === uid && a.account_id === acc.account_id && (a.platform ?? '') === (acc.platform ?? ''))) {
      return null;
    }
    const { data, error } = await supabase.from('account_assignments').insert({
      user_id: uid, account_id: acc.account_id, account_name: acc.account_name, platform: acc.platform, created_by: user!.id,
    }).select().single();
    if (error) throw error;
    setAssignments((prev) => [data as Assignment, ...prev]);
    return data as Assignment;
  };

  const submitForm = async () => {
    const email = formEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: 'Correo inválido', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const existing = users.find((u) => u.email?.toLowerCase() === email);
      let uid = existing?.id ?? null;
      let invited = false;

      if (!uid) {
        // Invite new user.
        const { data, error } = await supabase.functions.invoke('admin-users', {
          body: { action: 'invite', email, redirectTo: `${window.location.origin}/app/auth` },
        });
        if (error || (data as any)?.error) {
          throw new Error(error?.message || (data as any)?.error || 'No se pudo enviar la invitación');
        }
        uid = (data as any)?.userId ?? null;
        invited = !((data as any)?.alreadyMember);
        // Refresh users list to get the new row.
        await loadData();
        if (!uid) {
          // alreadyMember flow — look up in the fresh list.
          const { data: refreshed } = await supabase.functions.invoke('admin-users');
          const found = (refreshed?.users as UserRow[] | undefined)?.find((u) => u.email?.toLowerCase() === email);
          uid = found?.id ?? null;
        }
      }

      if (!uid) throw new Error('No se pudo identificar al miembro después de invitarlo');

      await ensureRole(uid, formRole);
      let assignedAccount: Assignment | null = null;
      if (formAccount !== NO_ACCOUNT) {
        assignedAccount = await assignAccountTo(uid, formAccount);
      }

      const parts = [
        invited ? 'Invitación enviada' : (existing ? 'Miembro actualizado' : 'Miembro listo'),
        formRole === 'admin' ? 'rol admin' : 'rol miembro',
        assignedAccount ? `cuenta ${assignedAccount.account_name ?? assignedAccount.account_id}` : 'sin cuenta aún',
      ];
      toast({ title: parts.join(' · '), description: email });
      setFormEmail('');
      setFormAccount(NO_ACCOUNT);
      setFormRole('user');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message ?? String(e), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const sendReset = async (email: string) => {
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: { action: 'reset_password', email, redirectTo: `${window.location.origin}/app/auth` },
    });
    if (error || (data as any)?.error) {
      toast({ title: 'No se pudo enviar el link', description: error?.message || (data as any)?.error, variant: 'destructive' });
      return;
    }
    toast({ title: `Link de reseteo enviado a ${email}` });
  };

  const resendInvite = async (email: string) => {
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: { action: 'invite', email, redirectTo: `${window.location.origin}/app/auth` },
    });
    if (error || (data as any)?.error) {
      toast({ title: 'No se pudo reenviar', description: error?.message || (data as any)?.error, variant: 'destructive' });
      return;
    }
    toast({ title: `Invitación reenviada a ${email}` });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('account_assignments').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setAssignments(assignments.filter((a) => a.id !== id));
  };

  const revokeAccess = async (uid: string, email: string | null) => {
    const target = users.find((u) => u.id === uid);
    if (target?.confirmed === false) { await deleteUser(uid, email); return; }
    const [a, r] = await Promise.all([
      supabase.from('account_assignments').delete().eq('user_id', uid),
      supabase.from('user_roles').delete().eq('user_id', uid),
    ]);
    if (a.error || r.error) {
      toast({ title: 'Error', description: a.error?.message || r.error?.message, variant: 'destructive' });
      return;
    }
    setAssignments((prev) => prev.filter((x) => x.user_id !== uid));
    setRoles((prev) => prev.filter((x) => x.user_id !== uid));
    toast({ title: `Acceso revocado a ${email ?? 'miembro'}` });
  };

  const toggleAdmin = async (uid: string) => {
    const isAdminUser = adminIds.has(uid);
    if (isAdminUser) {
      const { error } = await supabase.from('user_roles').delete().eq('user_id', uid).eq('role', 'admin');
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      setRoles(roles.filter((r) => !(r.user_id === uid && r.role === 'admin')));
    } else {
      const { error } = await supabase.from('user_roles').insert({ user_id: uid, role: 'admin' });
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      setRoles([...roles, { user_id: uid, role: 'admin' }]);
    }
  };

  const deleteUser = async (uid: string, email: string | null) => {
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: { action: 'delete_user', userId: uid },
    });
    if (error || (data as any)?.error) {
      toast({ title: 'Error', description: error?.message || (data as any)?.error, variant: 'destructive' });
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== uid));
    setAssignments((prev) => prev.filter((a) => a.user_id !== uid));
    setRoles((prev) => prev.filter((r) => r.user_id !== uid));
    toast({ title: `Miembro eliminado`, description: email ?? uid });
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando...</div>;
  }
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <Card className="p-6 text-center space-y-2">
          <Shield className="h-8 w-8 text-muted-foreground mx-auto" />
          <h2 className="font-semibold">Acceso restringido</h2>
          <p className="text-sm text-muted-foreground">Solo los administradores pueden entrar a este módulo.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHero
        icon={Shield}
        title="Equipo"
        subtitle="Invita miembros por correo, asigna un rol y — cuando quieras — dales acceso a cuentas específicas."
        gradient="from-sidebar-background via-sidebar-background to-primary"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <AdminStat icon={Users} label="Miembros" value={users.length} accent="primary" />
        <AdminStat icon={ShieldCheck} label="Admins" value={adminIds.size} accent="secondary" />
        <AdminStat icon={Link2} label="Asignaciones" value={assignments.length} accent="info" />
        <AdminStat icon={Building2} label="Cuentas" value={accounts.length} accent="success" />
      </div>

      {/* Añadir / actualizar miembro — flujo único, cuenta opcional */}
      <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <div>
              <h2 className="font-semibold">Añadir miembro</h2>
              <p className="text-xs text-muted-foreground">
                Enviamos un correo con el link para que active su cuenta y elija contraseña. La cuenta publicitaria es opcional — puedes asignarla ahora o después.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1.4fr_auto]">
          <div className="space-y-1.5">
            <Label>Correo del miembro</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="email"
                placeholder="persona@empresa.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitForm(); }}
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <Select value={formRole} onValueChange={(v) => setFormRole(v as 'user' | 'admin')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Miembro</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              Cuenta publicitaria
              <span className="text-[10px] text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Select value={formAccount} onValueChange={setFormAccount}>
              <SelectTrigger><SelectValue placeholder="Sin cuenta por ahora" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ACCOUNT}>Sin cuenta por ahora</SelectItem>
                {accounts.map((a) => {
                  const key = `${a.account_id}|${a.platform ?? ''}`;
                  return (
                    <SelectItem key={key} value={key}>
                      {a.account_name ?? a.account_id} · {a.platform ?? '—'}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={submitForm} disabled={submitting} className="w-full sm:w-auto">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {formAccount === NO_ACCOUNT ? 'Invitar' : 'Invitar y asignar'}
            </Button>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          Si el correo ya es miembro, solo actualizamos su rol y añadimos la cuenta seleccionada.
        </p>
      </Card>

      {/* Miembros del equipo con asignación inline de cuentas */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Miembros del equipo ({users.length})</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-2 mb-4">
          Los administradores ven todo. Los miembros solo ven las cuentas que les asignes aquí.
        </p>
        <div className="space-y-3">
          {users.map((u) => {
            const isA = adminIds.has(u.id);
            const isSelf = u.id === user!.id;
            const userAssignments = assignmentsByUser[u.id] ?? [];
            return (
              <div key={u.id} className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{u.email}</span>
                    {isA && <Badge variant="secondary" className="text-xs">admin</Badge>}
                    {u.confirmed === false && <Badge variant="outline" className="text-[10px] text-warning">invitado — pendiente</Badge>}
                    {isSelf && <Badge variant="outline" className="text-[10px]">tú</Badge>}
                    <span className="text-[11px] text-muted-foreground">
                      {userAssignments.length} cuenta{userAssignments.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {u.confirmed === false && u.email && (
                      <Button variant="ghost" size="sm" onClick={() => resendInvite(u.email!)} title="Reenviar invitación">
                        <Send className="h-3.5 w-3.5 mr-1.5" /> Reenviar
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => u.email && sendReset(u.email)} title="Enviar link para restablecer contraseña">
                      <KeyRound className="h-3.5 w-3.5 mr-1.5" /> Contraseña
                    </Button>
                    <Button
                      variant={isA ? 'outline' : 'secondary'}
                      size="sm"
                      onClick={() => toggleAdmin(u.id)}
                      disabled={isSelf}
                      title={isSelf ? 'No puedes cambiar tu propio rol' : ''}
                    >
                      {isA ? <><ShieldOff className="h-3.5 w-3.5 mr-1.5" />Quitar admin</> : <><ShieldCheck className="h-3.5 w-3.5 mr-1.5" />Hacer admin</>}
                    </Button>
                    {!isSelf && (
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                        onClick={() => revokeAccess(u.id, u.email)} title="Quitar acceso a todas las cuentas y rol admin">
                        <Ban className="h-3.5 w-3.5 mr-1.5" /> Revocar
                      </Button>
                    )}
                    {!isSelf && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" title="Eliminar miembro">
                            <UserX className="h-3.5 w-3.5 mr-1.5" /> Eliminar
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar este miembro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se borrará permanentemente <strong>{u.email}</strong>, su login, rol y todas sus cuentas asignadas. No se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteUser(u.id, u.email)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>

                {/* Chips de cuentas + selector inline para añadir otra */}
                <div className="flex items-center gap-2 flex-wrap">
                  {userAssignments.length === 0 ? (
                    <span className="text-[11px] text-muted-foreground italic">Sin cuentas asignadas todavía.</span>
                  ) : (
                    userAssignments.map((a) => (
                      <Badge key={a.id} variant="outline" className="gap-1.5 pr-1 font-normal">
                        {a.account_name ?? a.account_id} <span className="text-muted-foreground">· {a.platform ?? '—'}</span>
                        <button
                          onClick={() => remove(a.id)}
                          className="hover:bg-destructive/10 rounded p-0.5 text-destructive"
                          title="Quitar esta cuenta"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                  <InlineAssign
                    accounts={accounts}
                    existing={userAssignments}
                    onPick={async (key) => {
                      try { await assignAccountTo(u.id, key); toast({ title: 'Cuenta asignada' }); }
                      catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Auditoría de asignaciones */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Registro de asignaciones ({assignments.length})</h2>
          </div>
          <Input
            placeholder="Buscar por correo, cuenta o ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
        {filteredAssignments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Aún no hay asignaciones.</p>
        ) : (
          <div className="divide-y divide-border">
            {filteredAssignments.map((a) => (
              <div key={a.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{userById[a.user_id]?.email ?? a.user_id}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {a.account_name ?? a.account_id} · {a.platform ?? '—'} <span className="font-mono-data">({a.account_id})</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(a.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function InlineAssign({
  accounts, existing, onPick,
}: {
  accounts: AccountOpt[];
  existing: Assignment[];
  onPick: (key: string) => void | Promise<void>;
}) {
  const [val, setVal] = useState<string>('');
  const available = accounts.filter(
    (a) => !existing.some((e) => e.account_id === a.account_id && (e.platform ?? '') === (a.platform ?? '')),
  );
  if (available.length === 0) return null;
  return (
    <Select
      value={val}
      onValueChange={async (v) => { setVal(''); await onPick(v); }}
    >
      <SelectTrigger className="h-7 text-xs w-auto min-w-[160px] gap-1.5 border-dashed">
        <UserPlus className="h-3 w-3" />
        <SelectValue placeholder="Añadir cuenta" />
      </SelectTrigger>
      <SelectContent>
        {available.map((a) => {
          const key = `${a.account_id}|${a.platform ?? ''}`;
          return (
            <SelectItem key={key} value={key}>
              {a.account_name ?? a.account_id} · {a.platform ?? '—'}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

const ADMIN_STAT_ACCENT_CLASS: Record<'primary' | 'secondary' | 'info' | 'success', string> = {
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  info: 'bg-info text-info-foreground',
  success: 'bg-success text-success-foreground',
};

function AdminStat({
  icon: Icon, label, value, accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: keyof typeof ADMIN_STAT_ACCENT_CLASS;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg p-4 shadow-sm
        ${ADMIN_STAT_ACCENT_CLASS[accent]} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md animate-fade-in`}
    >
      <div aria-hidden className="absolute -right-3 -bottom-3 opacity-20">
        <Icon className="h-16 w-16" />
      </div>
      <p className="relative text-[10px] uppercase tracking-wider opacity-85">{label}</p>
      <p className="relative mt-1 text-3xl font-bold font-mono leading-none">{value}</p>
    </div>
  );
}
