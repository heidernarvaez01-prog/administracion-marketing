import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync('public/eclan/xhtml/js/dashboard/windsor-client.js', 'utf8');
const ok = () => ({ status: 200, ok: true, json: async () => ({ error: false, campaigns: [] }) });
const unauthorized = () => ({ status: 401, ok: false, json: async () => ({ error: true, status: 401, mensaje: 'Sesión requerida.' }) });

function setup(fetch: ReturnType<typeof vi.fn>, refreshSession = vi.fn().mockResolvedValue({ data: { session: { access_token: 'renewed' } }, error: null }), token: string | null = 'old') {
  const window = {
    AuditClient: {
      getSession: vi.fn().mockResolvedValue(token ? { access_token: token } : null),
      supabase: { auth: { refreshSession } },
    },
    WindsorClient: undefined as undefined | { fetchMetrics: (options?: object) => Promise<unknown> },
  };
  runInNewContext(source, { window, fetch });
  const client = window.WindsorClient;
  if (!client) throw new Error('Client not initialized');
  return { client, refreshSession };
}

describe('Windsor session recovery', () => {
  it('renews a rejected token and retries the same scoped query once', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(ok());
    const { client, refreshSession } = setup(fetch);
    await expect(client.fetchMetrics({ datePreset: 'last_90d', clientId: 'ginecea' })).resolves.toMatchObject({ error: false });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toBe(fetch.mock.calls[0][0]);
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer renewed');
    expect(fetch.mock.calls[1][0]).toContain('client_id=ginecea');
  });
  it('never retries a second 401', async () => {
    const fetch = vi.fn().mockResolvedValue(unauthorized());
    const { client, refreshSession } = setup(fetch);
    await expect(client.fetchMetrics()).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });
  it('does not send requests or refresh when there is no session', async () => {
    const fetch = vi.fn();
    const { client, refreshSession } = setup(fetch, undefined, null);
    await expect(client.fetchMetrics()).rejects.toMatchObject({ status: 401 });
    expect(fetch).not.toHaveBeenCalled();
    expect(refreshSession).not.toHaveBeenCalled();
  });
  it('does not retry when renewal fails', async () => {
    const fetch = vi.fn().mockResolvedValue(unauthorized());
    const refresh = vi.fn().mockResolvedValue({ data: { session: null }, error: new Error('invalid refresh token') });
    const { client } = setup(fetch, refresh);
    await expect(client.fetchMetrics()).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('shares one renewal across simultaneous rejected requests', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(unauthorized()).mockResolvedValue(ok());
    const { client, refreshSession } = setup(fetch);
    await Promise.all([client.fetchMetrics(), client.fetchMetrics()]);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(4);
  });
  it('does not refresh successful requests or other server errors', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(ok()).mockResolvedValueOnce({ status: 500, ok: false, json: async () => ({ error: true, status: 500 }) });
    const { client, refreshSession } = setup(fetch);
    await client.fetchMetrics();
    await expect(client.fetchMetrics()).rejects.toMatchObject({ status: 500 });
    expect(refreshSession).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});