import { describe, expect, it, vi } from 'vitest';

import {
  BARRIER_OWNED_PIPELINE_CACHE_KEYS,
  PRODUCING_PIPELINE_CACHE_KEYS,
  READY_FROZEN_PIPELINE_CACHE_KEYS,
  persistOrdinaryPipelineCache,
  withoutBarrierOwnedPipelineCacheKeys,
} from '../pipeline-cache-store';
import type { PipelineCache } from '../types';

/**
 * The ordinary cache store is the structural half of the barrier-owned-key
 * invariant: whatever an in-memory snapshot claims for the barrier-owned keys
 * (producing provenance + Board bindings), persistence overlays the DATABASE
 * row's own values for them, key-existence-gated and value-verbatim, so only
 * a barrier mutation can ever create/replace/delete them. This unit spec pins
 * the statement SHAPE and payload stripping; the real-Postgres spec
 * (pipeline-cache-store.pg.spec.ts) executes the exact statement and proves
 * the value-verbatim semantics (nested nulls included) byte-for-byte.
 */
describe('persistOrdinaryPipelineCache (barrier-owned-key immutability)', () => {
  const cacheWithBarrierKeys = {
    textFinalized: true,
    storyKey: 'chameleon_koko_bedtime',
    visualContract: { schemaVersion: 'hostile-in-memory-contract/v1' },
    visualPackageAuthority: { version: 'hostile-in-memory-authority' },
    setIdentityBoards: { mode: 'hostile-in-memory-board' },
  } as unknown as PipelineCache;

  function capture() {
    const calls: Array<{ strings: readonly string[]; values: unknown[] }> = [];
    const db = {
      $executeRaw: vi.fn(
        async (strings: TemplateStringsArray, ...values: unknown[]) => {
          calls.push({ strings: [...strings], values });
          return 1;
        },
      ),
    };
    return { db, calls };
  }

  it('the producing keys are a subset of the barrier-owned keys', () => {
    for (const key of PRODUCING_PIPELINE_CACHE_KEYS) {
      expect(BARRIER_OWNED_PIPELINE_CACHE_KEYS).toContain(key);
    }
    expect(BARRIER_OWNED_PIPELINE_CACHE_KEYS).toContain('setIdentityBoards');
    expect(READY_FROZEN_PIPELINE_CACHE_KEYS).toEqual(['characterAnchorStore']);
  });

  it('strips every barrier-owned key from the payload and overlays the DB row values key-existence-gated', async () => {
    const { db, calls } = capture();
    await persistOrdinaryPipelineCache(db as never, 'o1', cacheWithBarrierKeys);
    expect(calls).toHaveLength(1);
    const sql = calls[0]!.strings.join('?');
    const payload = calls[0]!.values[0] as string;
    // The caller's in-memory barrier-owned values never reach the payload…
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    for (const key of BARRIER_OWNED_PIPELINE_CACHE_KEYS) {
      expect(parsed).not.toHaveProperty(key);
    }
    expect(parsed.textFinalized).toBe(true);
    // …and the SQL overlays the EXISTING row's keys on top of the replacement
    // payload, gated on key EXISTENCE (`?`) so an absent key is never created
    // and a present key (even an explicit JSON null) is copied verbatim.
    // No normalizing function may appear: jsonb_strip_nulls recurses and
    // would rewrite frozen contract bytes (Codex round-4 MAJOR 1).
    expect(sql).toContain('UPDATE "GenerationJob"');
    for (const key of BARRIER_OWNED_PIPELINE_CACHE_KEYS) {
      expect(sql).toContain(`"pipelineCache" ? '${key}'`);
      expect(sql).toContain(`jsonb_build_object('${key}', "pipelineCache" -> '${key}')`);
    }
    expect(sql).not.toContain('jsonb_strip_nulls');
    expect(sql).not.toContain('INSERT');
    expect(sql).toContain('FROM "Order"');
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain("locked_order.status = 'ready'");
    expect(sql).toContain("incoming.value - 'characterAnchorStore'");
    expect(sql).toContain(
      "jsonb_build_object('characterAnchorStore', \"pipelineCache\" -> 'characterAnchorStore')",
    );
    expect(calls[0]!.values[1]).toBe('o1');
  });

  it('keeps replacement semantics for ordinary keys (a removed key stays removed)', async () => {
    const { db, calls } = capture();
    const cache = { storyKey: 'k' } as unknown as PipelineCache;
    await persistOrdinaryPipelineCache(db as never, 'o1', cache);
    const parsed = JSON.parse(calls[0]!.values[0] as string) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(['storyKey']);
  });

  it('withoutBarrierOwnedPipelineCacheKeys strips exactly the barrier-owned keys from a creation seed', () => {
    const seed = withoutBarrierOwnedPipelineCacheKeys(
      cacheWithBarrierKeys,
    ) as Record<string, unknown>;
    for (const key of BARRIER_OWNED_PIPELINE_CACHE_KEYS) {
      expect(seed).not.toHaveProperty(key);
    }
    expect(seed.textFinalized).toBe(true);
    expect(seed.storyKey).toBe('chameleon_koko_bedtime');
  });
});
