import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Wiring test for the Outbox cron (P1-f). The route is where the worker deps compose for real, and a regression
 * here would pass every lib-level unit test. It pins: (1) the `cas` dep is present and delegates to
 * casClaimSendSlot forwarding (row, token, leaseExpiresAt) — the single atomic send-time CAS; (2) the flag-OFF
 * and auth short-circuits. prisma + the readiness/outbox/email modules are mocked so no env validation runs.
 */
describe('cron/outbox route — worker wiring (P1-f CAS)', () => {
  let savedSecret: string | undefined;
  beforeEach(() => { vi.resetModules(); savedSecret = process.env.CRON_SECRET; });
  afterEach(() => { if (savedSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = savedSecret; });

  const loadRoute = async (readinessOver: Record<string, unknown> = {}) => {
    const casClaimSendSlot = vi.fn(async () => 'ok'); // a real CasResult
    const isReadinessManifestEnabled = vi.fn(() => true);
    let capturedDeps: { cas: (...a: unknown[]) => unknown } | undefined;
    const drainOutbox = vi.fn(async (_p: unknown, _o: unknown, deps: typeof capturedDeps) => { capturedDeps = deps; return { claimed: 0, sent: 0, superseded: 0, failed: 0, retry: 0, lost_lease: 0 }; });
    const sendBookReadyEmail = vi.fn(async () => ({}));
    vi.doMock('@/lib/prisma', () => ({ prisma: { __tag: 'prisma' } }));
    vi.doMock('@/lib/generation-pipeline/readiness-manifest', () => ({ casClaimSendSlot, isReadinessManifestEnabled, ...readinessOver }));
    vi.doMock('@/lib/generation-chunked/delivery-outbox', () => ({ drainOutbox }));
    vi.doMock('@/backend/lib/email', () => ({ sendBookReadyEmail }));
    const mod = await import('@/app/api/generate/cron/outbox/route');
    return { GET: mod.GET, getDeps: () => capturedDeps, casClaimSendSlot, drainOutbox };
  };
  const req = (auth: string | null) => ({ headers: { get: (h: string) => (h === 'authorization' ? auth : null) } }) as never;

  it('the `cas` dep is present and delegates to casClaimSendSlot, forwarding (row, token, leaseExpiresAt)', async () => {
    process.env.CRON_SECRET = 'secret';
    const t = await loadRoute();
    await t.GET(req('Bearer secret'));
    expect(t.drainOutbox).toHaveBeenCalled();
    const deps = t.getDeps()!;
    expect(typeof deps.cas).toBe('function');
    const rowArg = { id: 'ob1', orderId: 'o1', scope: 'base_book', manifestId: 'm1', inputVersion: 0, payloadHash: 'ph' };
    const lease = new Date('2026-06-29T10:10:00Z');
    const cres = await deps.cas(rowArg, 3, lease);
    expect(t.casClaimSendSlot).toHaveBeenCalledWith(expect.anything(), rowArg, 3, lease);
    expect(cres).toBe('ok'); // the route closure passes the CasResult straight through to the worker
  });

  it('short-circuits (no drain) when READINESS_MANIFEST_ENABLED is off', async () => {
    process.env.CRON_SECRET = 'secret';
    const t = await loadRoute({ isReadinessManifestEnabled: () => false });
    const res = await t.GET(req('Bearer secret'));
    expect(t.drainOutbox).not.toHaveBeenCalled();
    expect((await res.json()).skipped).toBeDefined();
  });

  it('401 on bad auth, 503 without CRON_SECRET — never drains', async () => {
    process.env.CRON_SECRET = 'secret';
    const t = await loadRoute();
    const res401 = await t.GET(req('Bearer wrong'));
    expect(res401.status).toBe(401);
    delete process.env.CRON_SECRET;
    const res503 = await t.GET(req('Bearer secret'));
    expect(res503.status).toBe(503);
    expect(t.drainOutbox).not.toHaveBeenCalled();
  });
});
