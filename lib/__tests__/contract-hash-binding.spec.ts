import { describe, expect, it } from 'vitest';
import {
  contractHashKeySuffix,
  coverAssetOperationKey,
  pageAssetOperationKey,
  contractHashPayloadFragment,
} from '@/lib/generation-pipeline/contract-hash-binding';

// (P1-4) The asset write-barrier receipt KEY + PAYLOAD must bind the render-time contract hash, so a same-URL redrive
// under a NEW frozen contract is a NEW fenced operation that re-runs the binding (not a stale ON CONFLICT DO NOTHING
// replay). These exercise the EXACT builders chunk-runner uses at the cover + page seams. Real fence behavior (a new
// op actually re-running the callback) is staging-confirmable.
describe('(P1-4) asset write-barrier contract-hash binding', () => {
  it('freeze-off (null hash) → operationKey + payload byte-identical to pre-P1-4 (no suffix, no contractHash)', () => {
    expect(coverAssetOperationKey('o1', 'cover-x.png', null)).toBe('delivery_input:o1:cover:cover-x.png');
    expect(pageAssetOperationKey('o1', 3, 'p3.webp', null)).toBe('delivery_input:o1:page:3:p3.webp');
    expect(contractHashKeySuffix(null)).toBe('');
    expect(contractHashPayloadFragment(null)).toEqual({});
    expect('contractHash' in contractHashPayloadFragment(null)).toBe(false); // spread adds nothing
  });

  it('freeze-on (a hash) → operationKey binds `:${hash}` and payload carries contractHash (cover AND page)', () => {
    expect(coverAssetOperationKey('o1', 'cover-x.png', 'v2')).toBe('delivery_input:o1:cover:cover-x.png:v2');
    expect(pageAssetOperationKey('o1', 3, 'p3.webp', 'v2')).toBe('delivery_input:o1:page:3:p3.webp:v2');
    expect(contractHashKeySuffix('v2')).toBe(':v2');
    expect(contractHashPayloadFragment('v2')).toEqual({ contractHash: 'v2' });
  });

  it('same URL, NEW hash → DIFFERENT operationKey → a new fenced op RUNS the binding (not a stale replay) — cover AND page', () => {
    expect(coverAssetOperationKey('o1', 'cover-x.png', 'v1')).not.toBe(coverAssetOperationKey('o1', 'cover-x.png', 'v2'));
    expect(pageAssetOperationKey('o1', 3, 'p3.webp', 'v1')).not.toBe(pageAssetOperationKey('o1', 3, 'p3.webp', 'v2'));
  });

  it('same URL, SAME hash → SAME operationKey (replay, no needless re-write) — cover AND page', () => {
    expect(coverAssetOperationKey('o1', 'cover-x.png', 'v1')).toBe(coverAssetOperationKey('o1', 'cover-x.png', 'v1'));
    expect(pageAssetOperationKey('o1', 3, 'p3.webp', 'v1')).toBe(pageAssetOperationKey('o1', 3, 'p3.webp', 'v1'));
  });
});
