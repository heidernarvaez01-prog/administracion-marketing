type AuthUser = { id: string; email_confirmed_at?: string | null };
type AuthResult = { data: { user: AuthUser | null }; error: { message: string } | null };
export interface ManualAccountClient {
  auth: { admin: {
    createUser: (attributes: { email: string; password: string; email_confirm: boolean }) => Promise<AuthResult>;
    getUserById: (id: string) => Promise<AuthResult>;
    updateUserById: (id: string, attributes: { password: string; email_confirm?: boolean }) => Promise<AuthResult>;
  } };
}

export function isAdminRole(role: { role: string } | null): boolean {
  return role?.role === 'admin';
}

export async function manualAccountAction(
  admin: ManualAccountClient,
  body: Record<string, unknown>,
) {
  const fail = (error: string, status = 400) => ({ status, body: { error } });
  const password = body.password;
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return fail('La contraseña debe tener entre 8 y 128 caracteres.');
  }
  if (password !== body.passwordConfirmation) return fail('Las contraseñas no coinciden.');

  if (body.action === 'create_user') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return fail('Correo inválido.');
    // No roles or memberships are accepted here. Access is assigned separately.
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) return fail(error.message);
    if (!data.user) return fail('No se pudo crear la cuenta.', 500);
    return { status: 200, body: { ok: true, userId: data.user.id } };
  }

  if (body.action !== 'set_password') return fail('Acción inválida.');
  const userId = typeof body.userId === 'string' ? body.userId : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return fail('Cuenta inválida.');
  }
  const target = await admin.auth.admin.getUserById(userId);
  if (target.error || !target.data.user) return fail('Cuenta no encontrada.', 404);
  // An invited account needs confirmation to sign in without its invitation.
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
    ...(target.data.user.email_confirmed_at ? {} : { email_confirm: true }),
  });
  if (error) return fail(error.message);
  return { status: 200, body: { ok: true, userId } };
}