import { describe, expect, it, vi } from 'vitest';
import { isAdminRole, manualAccountAction } from '../../supabase/functions/admin-users/manual-accounts';

const id = '11111111-1111-4111-8111-111111111111';
function client(confirmed = false) {
  return { auth: { admin: {
    createUser: vi.fn().mockResolvedValue({ data: { user: { id } }, error: null }),
    getUserById: vi.fn().mockResolvedValue({ data: { user: { id, email_confirmed_at: confirmed ? '2026-10-19' : null } }, error: null }),
    updateUserById: vi.fn().mockResolvedValue({ data: { user: { id } }, error: null }),
  } } };
}
const credentials = { password: 'Test-Only-Strong-123', passwordConfirmation: 'Test-Only-Strong-123' };

describe('manual administrator account management', () => {
  it('only recognizes the administrator role, never viewer, manager, user or absent role', () => {
    expect(isAdminRole({ role: 'admin' })).toBe(true);
    for (const role of ['viewer', 'manager', 'user']) expect(isAdminRole({ role })).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });
  it('creates a confirmed account without an invitation or any requested admin privileges', async () => {
    const admin = client();
    const result = await manualAccountAction(admin, { action: 'create_user', email: ' Person@Example.com ', role: 'admin', ...credentials });
    expect(result.status).toBe(200);
    expect(admin.auth.admin.createUser).toHaveBeenCalledExactlyOnceWith({ email: 'person@example.com', password: credentials.password, email_confirm: true });
    expect(result.body).toEqual({ ok: true, userId: id });
  });
  it('resets an existing invited account and makes it usable without email', async () => {
    const admin = client();
    const result = await manualAccountAction(admin, { action: 'set_password', userId: id, ...credentials });
    expect(result.status).toBe(200);
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledExactlyOnceWith(id, { password: credentials.password, email_confirm: true });
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
  });
  it('leaves confirmation unchanged for confirmed accounts', async () => {
    const admin = client(true);
    await manualAccountAction(admin, { action: 'set_password', userId: id, ...credentials });
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledExactlyOnceWith(id, { password: credentials.password });
  });
  it('rejects different confirmation before making any credential change', async () => {
    const admin = client();
    const result = await manualAccountAction(admin, { action: 'set_password', userId: id, ...credentials, passwordConfirmation: 'different' });
    expect(result.status).toBe(400);
    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
  it('rejects weak or oversized input before creating accounts', async () => {
    for (const password of ['1234567', 'a'.repeat(129)]) {
      const admin = client();
      expect((await manualAccountAction(admin, { action: 'create_user', email: 'test@example.com', password, passwordConfirmation: password })).status).toBe(400);
      expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
    }
  });
  it('rejects a nonexistent account without updating credentials', async () => {
    const admin = client();
    admin.auth.admin.getUserById.mockResolvedValue({ data: { user: null }, error: null });
    expect((await manualAccountAction(admin, { action: 'set_password', userId: id, ...credentials })).status).toBe(404);
    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
});