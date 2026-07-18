import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * (Human-QA Slice 1, re-gate P0-B) The scheduled reconciler cron: CRON_SECRET-gated, flag-INDEPENDENT (runs even
 * with HUMAN_QA_NOTIFY_ENABLED off — the SENDER being off must not stop case CREATION), idempotent, and it emits an
 * SLA metric (alerting when a case landed past the SLA).
 */

const errorSpy = vi.fn();
const warnSpy = vi.fn();
const infoSpy = vi.fn();
const SILENT = { createLogger: () => ({ info: infoSpy, warn: warnSpy, error: errorSpy }) };

const reconcileSpy = vi.fn();
const reqWith = (auth: string | null) =>
  ({ headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? auth : null) } }) as never;

async function loadCron(summary: Record<string, unknown>) {
  reconcileSpy.mockResolvedValue(summary);
  vi.doMock('@/lib/prisma', () => ({ prisma: {} }));
  vi.doMock('@/lib/logger', () => SILENT);
  vi.doMock('@/lib/human-qa/reconcile-core', () => ({ reconcileHumanQaHolds: reconcileSpy }));
  const mod = await import('@/app/api/generate/cron/human-qa-reconcile/route');
  return mod.GET;
}

const okSummary = (over: Record<string, unknown> = {}) => ({
  scanned: 0, created: 0, idempotent: 0, wouldCreate: 0, skipped: {}, legacyUnknown: [],
  errors: [], oldestMissingCaseAgeMs: 0, dryRun: false, includeUnknown: false, ...over,
});

beforeEach(() => {
  vi.resetModules();
  reconcileSpy.mockReset();
  errorSpy.mockReset(); warnSpy.mockReset(); infoSpy.mockReset();
  process.env.CRON_SECRET = 'sek';
  delete process.env.HUMAN_QA_NOTIFY_ENABLED; // the cron must run regardless of the SENDER flag
});
afterEach(() => { vi.restoreAllMocks(); delete process.env.CRON_SECRET; });

describe('human-qa-reconcile cron', () => {
  it('503 when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;
    const GET = await loadCron(okSummary());
    const res = await GET(reqWith('Bearer whatever'));
    expect(res.status).toBe(503);
    expect(reconcileSpy).not.toHaveBeenCalled();
  });

  it('401 on a wrong/absent bearer token', async () => {
    const GET = await loadCron(okSummary());
    expect((await GET(reqWith('Bearer nope'))).status).toBe(401);
    expect((await GET(reqWith(null))).status).toBe(401);
    expect(reconcileSpy).not.toHaveBeenCalled();
  });

  it('runs the reconcile core with a valid secret — even with HUMAN_QA_NOTIFY_ENABLED off (flag-independent)', async () => {
    const GET = await loadCron(okSummary({ scanned: 3 }));
    const res = await GET(reqWith('Bearer sek'));
    expect(res.status).toBe(200);
    expect(reconcileSpy).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, scanned: 3 });
  });

  it('a healthy tick (nothing created) logs info, not an alert', async () => {
    const GET = await loadCron(okSummary());
    await GET(reqWith('Bearer sek'));
    expect(errorSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalled();
  });

  it('created within SLA → warn (post-commit missed it), not an alert', async () => {
    const GET = await loadCron(okSummary({ created: 1, oldestMissingCaseAgeMs: 30_000 }));
    await GET(reqWith('Bearer sek'));
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('SLA breach (created past 5 min) → ERROR-level alert metric', async () => {
    const GET = await loadCron(okSummary({ created: 1, oldestMissingCaseAgeMs: 6 * 60 * 1000 }));
    await GET(reqWith('Bearer sek'));
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/SLA breach/i),
      undefined,
      expect.objectContaining({ slaBreached: true, metric: 'human_qa.reconciler' }),
    );
  });

  it('per-order errors → ERROR-level alert even without an SLA breach', async () => {
    const GET = await loadCron(okSummary({ errors: [{ orderId: 'o1', message: 'boom' }] }));
    await GET(reqWith('Bearer sek'));
    expect(errorSpy).toHaveBeenCalled();
  });
});
