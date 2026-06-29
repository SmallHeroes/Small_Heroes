import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

/**
 * GUARD (Codex P0): the customer "book ready" email must be reachable ONLY from the gated
 * chunked package stage (which applies resolveAnchorDeliveryGate and withholds the email for a
 * low-confidence anchor) and the deliberate human-QA release endpoint. No automatic/payment/
 * legacy path may call sendBookReadyEmail — that was the monolith-bypass Codex blocked.
 */
describe('sendBookReadyEmail reachability', () => {
  const ROOT = process.cwd();
  const SCAN_DIRS = ['app', 'lib', 'backend'];
  const DEFINITION_FILE = path.join('backend', 'lib', 'email.ts'); // export def, not a call

  // The ONLY allowed call sites (repo-relative, posix).
  const ALLOWED_CALL_SITES = new Set([
    'lib/generation-pipeline/chunk-runner.ts', // gated package stage (flag-off path)
    'app/api/admin/anchor-hold-release/route.ts', // human-QA release of a delivery hold (break-glass)
    'app/api/generate/cron/outbox/route.ts', // Phase-1 Outbox worker (effectively-once delivery)
  ]);

  function walk(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '__tests__' || entry.startsWith('.')) continue;
      const full = path.join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full, acc);
      else if (/\.(ts|tsx)$/.test(entry)) acc.push(full);
    }
    return acc;
  }

  it('is called only from the gated package stage and the human-QA release endpoint', () => {
    const callSites: string[] = [];
    for (const d of SCAN_DIRS) {
      for (const file of walk(path.join(ROOT, d))) {
        const rel = path.relative(ROOT, file).split(path.sep).join('/');
        if (rel === DEFINITION_FILE.split(path.sep).join('/')) continue; // skip the definition
        const src = readFileSync(file, 'utf8');
        // A call is `sendBookReadyEmail(` NOT preceded by `function ` (the definition).
        for (const line of src.split('\n')) {
          if (/\bsendBookReadyEmail\s*\(/.test(line) && !/function\s+sendBookReadyEmail/.test(line)) {
            callSites.push(rel);
            break;
          }
        }
      }
    }
    // No call site outside the allowlist (this is what catches a reintroduced bypass).
    const unexpected = callSites.filter((c) => !ALLOWED_CALL_SITES.has(c));
    expect(unexpected).toEqual([]);
    // And both expected gated callers are present (so the guard can't silently pass on a typo).
    for (const allowed of ALLOWED_CALL_SITES) {
      expect(callSites).toContain(allowed);
    }
  });
});

/**
 * Codex P0 #1: every payment/dev trigger must go through the chunked (gated) path. triggerGeneration
 * delegates to startChunkedGeneration — the legacy monolith (ungated ready + email) was removed.
 */
describe('triggerGeneration delegates to the chunked path', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('calls startChunkedGeneration and never the removed monolith', async () => {
    const startChunkedGeneration = vi.fn(async () => ({ started: true, orderId: 'o1' }));
    vi.doMock('@/lib/generation-chunked/start', () => ({ startChunkedGeneration }));
    vi.doMock('@/lib/generation-chunked/env-separation-guard', () => ({
      assertEnvSeparation: vi.fn(),
      assertProdGenerationAllowed: vi.fn(),
      isProdGenerationDisabled: vi.fn(() => false),
    }));
    // Break the prisma→env validation import chain (route imports prisma at module load).
    vi.doMock('@/lib/prisma', () => ({ prisma: {} }));

    const mod = await import('@/app/api/generate/route');
    // The legacy monolith export must be gone.
    expect((mod as Record<string, unknown>).runMonolithicGeneration).toBeUndefined();

    await mod.triggerGeneration('o1', 'payme_webhook_payment_paid');
    expect(startChunkedGeneration).toHaveBeenCalledWith('o1', 'payme_webhook_payment_paid');
  });
});
