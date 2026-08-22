import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  createRepositorySourceInventory,
  STRUCTURAL_REPOSITORY_SCAN_TIMEOUT_MS,
} from './helpers/repository-source-inventory';

/**
 * GUARD (Codex P0): direct provider-email calls are limited to the Outbox worker and the deliberate
 * human-QA break-glass endpoint. The flag-off compatibility path lives in package-delivery behind the explicit
 * readiness flag boundary and invokes an injected/local alias; chunk-runner itself can never send.
 */
describe('sendBookReadyEmail reachability', () => {
  const ROOT = process.cwd();
  const SCAN_DIRS = ['app', 'lib', 'backend'];
  const DEFINITION_FILE = path.join('backend', 'lib', 'email.ts'); // export def, not a call

  // The ONLY allowed call sites (repo-relative, posix).
  const ALLOWED_CALL_SITES = new Set([
    'app/api/admin/anchor-hold-release/route.ts', // human-QA release of a delivery hold (break-glass)
    'app/api/generate/cron/outbox/route.ts', // Phase-1 Outbox worker (effectively-once delivery)
    // Exception reconciliation may replay only the exact payload + key inside Resend's dedupe window
    // to recover a lost provider message id; its state-machine tests pin that it never blind-resends.
    'lib/generation-chunked/exception-processor.ts',
  ]);
  const repositorySources = createRepositorySourceInventory({
    root: ROOT,
    roots: SCAN_DIRS,
    extensions: ['.ts', '.tsx'],
    excludedEntryNames: ['node_modules', '__tests__'],
    excludeDotEntries: true,
  });

  it('is called only from the gated package stage and the human-QA release endpoint', () => {
    const callSites: string[] = [];
    for (const { relative, text } of repositorySources()) {
      if (relative === DEFINITION_FILE.split(path.sep).join('/')) continue; // skip the definition
      // A call is `sendBookReadyEmail(` NOT preceded by `function ` (the definition).
      for (const line of text.split('\n')) {
        if (/\bsendBookReadyEmail\s*\(/.test(line) && !/function\s+sendBookReadyEmail/.test(line)) {
          callSites.push(relative);
          break;
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
    const packageDelivery = readFileSync(
      path.join(ROOT, 'lib', 'generation-pipeline', 'package-delivery.ts'),
      'utf8',
    );
    expect(packageDelivery).toContain('deps.send ?? sendBookReadyEmail');
    expect(packageDelivery.indexOf('if (readinessEnabled())')).toBeLessThan(
      packageDelivery.indexOf('deps.send ?? sendBookReadyEmail'),
    );
  }, STRUCTURAL_REPOSITORY_SCAN_TIMEOUT_MS);
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
    const mod = await import('@/app/api/generate/trigger');

    await mod.triggerGeneration('o1', 'payme_webhook_payment_paid');
    expect(startChunkedGeneration).toHaveBeenCalledWith('o1', 'payme_webhook_payment_paid');
  });
});
