import { describe, it, expect } from 'vitest';
import {
  isExposedChildSourcePhotoKey, isCharacterAnchorKey, classifyExposedChildPhotos, buildKeyOwnerMap,
  summarizeExposure, residueObjects, orderReferencedChildPhotoKeys, collectPublicUrlsDeep,
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

describe('classifyExposedChildPhotos — status + GenerationJob.retryable (Finding 1, corrected)', () => {
  it('renderable → KEEP; ready/partial → RESIDUE; failed depends on retryable (false=terminal, true=ambivalent)', () => {
    const cases: Array<{ status: string; retryable?: boolean; keep: boolean }> = [
      { status: 'draft', keep: true }, { status: 'pending_payment', keep: true }, { status: 'paid', keep: true },
      { status: 'generating', keep: true }, { status: 'needs_human_qa', keep: true },
      { status: 'ready', keep: false }, { status: 'partial', keep: false },
      { status: 'failed', retryable: false, keep: false }, // TERMINAL hard-fail → residue
      { status: 'failed', retryable: true, keep: true },   // chain-worker sets retryable=true → ambivalent → keep
    ];
    const orders = cases.map((c, i) => ({ id: `o${i}`, status: c.status, retryable: c.retryable, updatedAt: new Date(), childImageUrl: url(`orders/o${i}/references/main-child-${i}.jpg`), characterAnchors: null }));
    const keys = cases.map((_, i) => `orders/o${i}/references/main-child-${i}.jpg`);
    const classified = classifyExposedChildPhotos(keys, buildKeyOwnerMap(orders, BUCKET));
    cases.forEach((c, i) => expect(classified[i].disposition).toBe(c.keep ? 'in_flight_keep' : 'residue'));
  });

  it('an object whose owning order cannot be resolved → RESIDUE (orphan)', () => {
    const c = classifyExposedChildPhotos(['wizard/char-photos/1-a.jpg'], new Map());
    expect(c[0].disposition).toBe('residue');
    expect(c[0].orderStatus).toBe('(orphan)');
  });

  it('buildKeyOwnerMap: on a shared key a KEEP owner (renderable OR failed+retryable) beats a residue owner', () => {
    const key = 'orders/x/references/main-child-1.jpg';
    const map = buildKeyOwnerMap([
      { id: 'a', status: 'ready', childImageUrl: url(key), characterAnchors: null },
      { id: 'b', status: 'failed', retryable: true, childImageUrl: url(key), characterAnchors: null },
    ], BUCKET);
    expect(map.get(key)?.orderId).toBe('b'); // ambivalent-failed (keep) wins over ready (residue)
  });

  it('CORRECTED ground truth: 15 objects → 5 RESIDUE (only failed+retryable=false), not 13', () => {
    const owners = [
      ...Array.from({ length: 5 }, (_, i) => ({ id: `ft${i}`, status: 'failed', retryable: false, key: `orders/ft${i}/references/main-child-${i}.jpg` })), // terminal → residue
      ...Array.from({ length: 8 }, (_, i) => ({ id: `fr${i}`, status: 'failed', retryable: true, key: `orders/fr${i}/references/main-child-r${i}.jpg` })), // ambivalent → keep
      { id: 'paid1', status: 'paid', key: 'orders/paid1/references/main-child-p.jpg' },
      { id: 'gen1', status: 'generating', key: 'orders/gen1/references/main-child-g.jpg' },
    ];
    const orders = owners.map((o) => ({ id: o.id, status: o.status, retryable: (o as { retryable?: boolean }).retryable, updatedAt: new Date(), childImageUrl: url(o.key), characterAnchors: null }));
    const classified = classifyExposedChildPhotos(owners.map((o) => o.key), buildKeyOwnerMap(orders, BUCKET));
    const s = summarizeExposure(classified, owners.map((o) => o.key));
    expect(s.realPhotos).toBe(15);
    expect(s.residue).toBe(5); // ← corrected ground-truth: 5, not 13
    expect(s.in_flight_keep).toBe(10);
  });

  it('the age-gated escape hatch reclassifies a long-abandoned failed+retryable=true as residue', () => {
    const key = 'orders/stale/references/main-child-1.jpg';
    const map = buildKeyOwnerMap([{ id: 'stale', status: 'failed', retryable: true, updatedAt: new Date('2026-01-01'), childImageUrl: url(key), characterAnchors: null }], BUCKET);
    expect(classifyExposedChildPhotos([key], map)[0].disposition).toBe('in_flight_keep'); // default → keep
    expect(classifyExposedChildPhotos([key], map, { staleRetryableFailedCutoff: new Date('2026-06-01') })[0].disposition).toBe('residue');
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
