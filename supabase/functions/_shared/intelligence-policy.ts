export function intelligenceOperationAllowed(admin: boolean, operation: string): boolean {
  return admin || ['read', 'preview', 'ask'].includes(operation);
}