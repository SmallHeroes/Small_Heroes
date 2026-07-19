import { describe, it, expect } from 'vitest';
import {
  isExposedChildSourcePhotoKey, isCharacterAnchorKey, classifyExposedChildPhotos, buildKeyOwnerMap,
  summarizeExposure, residueObjects, RENDERABLE_STATUSES, orderReferencedChildPhotoKeys, collectPublicUrlsDeep,
} from '@/lib/child-photo-audit';

const BUCKET = 'book-images';
const url = (k: string) => `https://p.supabase.co/storage/v1/object/public/${BUCKET}/${k}`;

describe('audit matchers (Track-4 Unit 1a)', () => {
  it('matches the real deep prod path + new + wizard; excludes anchors/pages', () => {
    expect(isExposedChildSourcePhotoKey('orders/OLD/draft-abc/references/main-child-x.jpg')).toBe(true);
    expect(isExposedChildSourcePhotoKey('orders/o1/references/stage0-child-photo-2.png')).toBe(true);
    expect(isExposedChildSourcePhotoKey('wizard/char-photos/1-a.jpg')).toBe(true);
    expect(isExposedChildSourcePhotoKey('orders/o1/character-anchors/child.png')).toBe(false);
    expect(isExposedChildSourcePhotoKey('orders/o1/pages/page-3.png')).toBe(false);
  });
  it('isCharacterAnchorKey identifies AI illustrations, never a photo', () => {
    expect(isCharacterAnchorKey('orders/o1/character-anchors/child.png')).toBe(true);
    expect(isCharacterAnchorKey('orders/OLD/draft-abc/references/main-child-x.jpg')).toBe(false);
  });
});

describe('classifyExposedChildPhotos — BY ORDER STATUS (Finding 1)', () => {
  it('renderable statuses → KEEP; ready/partial/failed → RESIDUE', () => {
    const statuses = ['draft', 'pending_payment', 'paid', 'generating', 'needs_human_qa', 'ready', 'partial', 'failed'];
    const orders = statuses.map((s, i) => ({ id: `o_${s}`, status: s, childImageUrl: url(`orders/o_${s}/references/main-child-${i}.jpg`), characterAnchors: null }));
    const keys = statuses.map((s, i) => `orders/o_${s}/references/main-child-${i}.jpg`);
    const classified = classifyExposedChildPhotos(keys, buildKeyOwnerMap(orders, BUCKET));
    for (const c of classified) {
      expect(c.disposition).toBe(RENDERABLE_STATUSES.has(c.orderStatus ?? '') ? 'in_flight_keep' : 'residue');
    }
    expect(classified.filter((c) => c.disposition === 'in_flight_keep')).toHaveLength(5); // the 5 renderable
    expect(classified.filter((c) => c.disposition === 'residue')).toHaveLength(3); // ready/partial/failed
  });

  it('an object whose owning order cannot be resolved → RESIDUE (orphan)', () => {
    const c = classifyExposedChildPhotos(['wizard/char-photos/1-a.jpg'], new Map());
    expect(c[0].disposition).toBe('residue');
    expect(c[0].orderStatus).toBe('(orphan)');
  });

  it('buildKeyOwnerMap: on a shared key, a RENDERABLE owner wins (never delete a needed photo)', () => {
    const key = 'orders/x/references/main-child-1.jpg';
    const map = buildKeyOwnerMap([
      { id: 'a', status: 'ready', childImageUrl: url(key), characterAnchors: null },
      { id: 'b', status: 'paid', childImageUrl: url(key), characterAnchors: null },
    ], BUCKET);
    expect(map.get(key)?.status).toBe('paid');
  });

  it('ground-truth shape: 15 objects, only the paid + generating owners are KEEP (≤2)', () => {
    // 13 residue owners (failed/ready) + 2 renderable (paid/generating) — mirrors staging.
    const owners = [
      ...Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, status: 'failed', key: `orders/f${i}/references/main-child-${i}.jpg` })),
      ...Array.from({ length: 3 }, (_, i) => ({ id: `r${i}`, status: 'ready', key: `orders/r${i}/references/main-child-r${i}.jpg` })),
      { id: 'paid1', status: 'paid', key: 'orders/paid1/references/main-child-p.jpg' },
      { id: 'gen1', status: 'generating', key: 'orders/gen1/references/main-child-g.jpg' },
    ];
    const orders = owners.map((o) => ({ id: o.id, status: o.status, childImageUrl: url(o.key), characterAnchors: null }));
    const classified = classifyExposedChildPhotos(owners.map((o) => o.key), buildKeyOwnerMap(orders, BUCKET));
    const s = summarizeExposure(classified, owners.map((o) => o.key));
    expect(s.realPhotos).toBe(15);
    expect(s.in_flight_keep).toBe(2); // ← the ground-truth check: at most 2 KEEP on staging
    expect(residueObjects(classified)).toHaveLength(13);
  });
});

describe('orderReferencedChildPhotoKeys / collectPublicUrlsDeep', () => {
  it('extracts keys from childImageUrl AND URLs nested deep in characterAnchors', () => {
    const keys = orderReferencedChildPhotoKeys(
      { childImageUrl: url('orders/o/references/main-child-1.jpg'), characterAnchors: { _privacy: { originalChildPhotoUrl: url('wizard/char-photos/w.jpg') }, child: { sourceImageUrl: url('orders/o/references/stage0-child-photo-2.png') } } },
      BUCKET,
    );
    expect(keys.sort()).toEqual(['orders/o/references/main-child-1.jpg', 'orders/o/references/stage0-child-photo-2.png', 'wizard/char-photos/w.jpg'].sort());
  });
  it('collectPublicUrlsDeep finds only public-object URLs, at any depth', () => {
    expect(collectPublicUrlsDeep({ a: url('b/k.jpg'), b: ['nope', { c: url('b/k2.jpg') }], d: 'data:image/png;base64,AAA' })).toHaveLength(2);
  });
});
