import { describe, expect, it, vi } from 'vitest';

import {
  PRODUCING_PIPELINE_CACHE_KEYS,
  persistOrdinaryPipelineCache,
  withoutProducingPipelineCacheKeys,
} from '../pipeline-cache-store';
import type { PipelineCache } from '../types';

/**
 * The ordinary cache store is the structural half of the producing-provenance
 * invariant: whatever an in-memory snapshot claims for the producing keys,
 * persistence overlays the DATABASE row's own values for them, so only the
 * freeze's barrier mutation can ever create/replace/delete them.
 */
describe('persistOrdinaryPipelineCache (producing-key immutability)', () => {
  const cacheWithProducingKeys = {
    textFinalized: true,
    storyKey: 'chameleon_koko_bedtime',
    visualContract: { schemaVersion: 'hostile-in-memory-contract/v1' },
    visualPackageAuthority: { version: 'hostile-in-memory-authority' },
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

  it('strips the producing keys from the payload and overlays the DB row values in SQL', async () => {
    const { db, calls } = capture();
    await persistOrdinaryPipelineCache(db as never, 'o1', cacheWithProducingKeys);
    expect(calls).toHaveLength(1);
    const sql = calls[0]!.strings.join('?');
    const payload = calls[0]!.values[0] as string;
    // The caller's in-memory producing values never reach the payload…
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    for (const key of PRODUCING_PIPELINE_CACHE_KEYS) {
      expect(parsed).not.toHaveProperty(key);
    }
    expect(parsed.textFinalized).toBe(true);
    // …and the SQL overlays the EXISTING row's producing keys on top of the
    // replacement payload (old-row values win inside SET), update-only.
    expect(sql).toContain('UPDATE "GenerationJob"');
    expect(sql).toContain(`'visualContract', "pipelineCache" -> 'visualContract'`);
    expect(sql).toContain(
      `'visualPackageAuthority', "pipelineCache" -> 'visualPackageAuthority'`,
    );
    expect(sql).toContain('jsonb_strip_nulls');
    expect(sql).not.toContain('INSERT');
    expect(calls[0]!.values[1]).toBe('o1');
  });

  it('keeps replacement semantics for ordinary keys (a removed key stays removed)', async () => {
    const { db, calls } = capture();
    const cache = { storyKey: 'k' } as unknown as PipelineCache;
    await persistOrdinaryPipelineCache(db as never, 'o1', cache);
    const parsed = JSON.parse(calls[0]!.values[0] as string) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(['storyKey']);
  });

  it('withoutProducingPipelineCacheKeys strips exactly the producing keys from a creation seed', () => {
    const seed = withoutProducingPipelineCacheKeys(
      cacheWithProducingKeys,
    ) as Record<string, unknown>;
    for (const key of PRODUCING_PIPELINE_CACHE_KEYS) {
      expect(seed).not.toHaveProperty(key);
    }
    expect(seed.textFinalized).toBe(true);
    expect(seed.storyKey).toBe('chameleon_koko_bedtime');
  });
});
