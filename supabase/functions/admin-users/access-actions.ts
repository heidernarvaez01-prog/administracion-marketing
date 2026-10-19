export function validAccessChange(body: Record<string, unknown>): boolean {
  return typeof body.userId === 'string' && /^[0-9a-f-]{36}$/i.test(body.userId)
    && typeof body.scopeId === 'string' && /^[0-9a-f-]{36}$/i.test(body.scopeId)
    && ['viewer', 'manager'].includes(String(body.accessRole))
    && ['grant', 'remove'].includes(String(body.operation));
}
