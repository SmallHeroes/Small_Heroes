import { describe, it, expect } from 'vitest';
import { classifyExposedChildPhotos, summarizeExposure, deletableResidueKeys, type OrderRef } from '@/lib/child-photo-audit';

const WIZARD = 'wizard/char-photos/1700000000000-abcdef0123.jpg';
const REF_INFLIGHT = 'orders/ord_inflight/references/main-child-1.jpg';
const REF_DELIVERED = 'orders/ord_done/references/stage0-child-photo-1.jpg';
const PAGE = 'orders/ord_done/pages/page-3.png'; // a rendered page — NOT a child photo, must be ignored

const orders: OrderRef[] = [
  { id: 'ord_inflight', status: 'generating', packageStatus: 'pending', keys: [REF_INFLIGHT] },
  { id: 'ord_done', status: 'ready', packageStatus: 'done', keys: [REF_DELIVERED] },
];

describe('classifyExposedChildPhotos (Track-4 Unit 1 audit)', () => {
  it('finds a deliberately planted ORPHAN public object (no owning order) as residue', () => {
    const objs = classifyExposedChildPhotos([WIZARD], orders);
    expect(objs).toEqual([{ key: WIZARD, disposition: 'orphan_residue' }]);
  });

  it('keeps an in-flight order photo, flags a delivered order photo as residue', () => {
    const objs = classifyExposedChildPhotos([REF_INFLIGHT, REF_DELIVERED], orders);
    expect(objs.find((o) => o.key === REF_INFLIGHT)?.disposition).toBe('in_flight_keep');
    expect(objs.find((o) => o.key === REF_DELIVERED)?.disposition).toBe('completed_residue');
  });

  it('ignores rendered pages/covers (only source photos are in scope)', () => {
    expect(classifyExposedChildPhotos([PAGE], orders)).toEqual([]);
  });

  it('summary + deletable residue exclude in-flight photos', () => {
    const objs = classifyExposedChildPhotos([WIZARD, REF_INFLIGHT, REF_DELIVERED, PAGE], orders);
    const s = summarizeExposure(objs);
    expect(s).toMatchObject({ total: 3, in_flight_keep: 1, completed_residue: 1, orphan_residue: 1, deletable: 2 });
    const del = deletableResidueKeys(objs);
    expect(del).toContain(WIZARD);
    expect(del).toContain(REF_DELIVERED);
    expect(del).not.toContain(REF_INFLIGHT); // an in-flight order's photo is NEVER deleted by the audit
  });
});
