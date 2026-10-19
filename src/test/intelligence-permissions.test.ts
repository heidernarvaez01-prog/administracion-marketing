import { describe, expect, it } from 'vitest';
import { intelligenceOperationAllowed } from '../../supabase/functions/_shared/intelligence-policy';
import { validAccessChange } from '../../supabase/functions/admin-users/access-actions';

describe('viewer intelligence permissions', () => {
  it('allows viewers to ask questions', () => expect(intelligenceOperationAllowed(false, 'ask')).toBe(true));
  it('allows viewers to preview without saving', () => expect(intelligenceOperationAllowed(false, 'preview')).toBe(true));
  it('denies viewer editing', () => expect(intelligenceOperationAllowed(false, 'edit')).toBe(false));
  it('denies viewer report delivery', () => expect(intelligenceOperationAllowed(false, 'send')).toBe(false));
  it('denies viewer saving', () => expect(intelligenceOperationAllowed(false, 'save')).toBe(false));
  it('allows administrator report delivery', () => expect(intelligenceOperationAllowed(true, 'send')).toBe(true));
});
describe('membership changes cannot grant admin', () => {
  const change = { userId: '11111111-1111-4111-8111-111111111111', scopeId: '22222222-2222-4222-8222-222222222222', operation: 'grant' };
  it('rejects admin as an access role', () => expect(validAccessChange({ ...change, accessRole: 'admin' })).toBe(false));
  it('allows client viewer membership', () => expect(validAccessChange({ ...change, accessRole: 'viewer' })).toBe(true));
  it('allows agency manager membership', () => expect(validAccessChange({ ...change, accessRole: 'manager' })).toBe(true));
});