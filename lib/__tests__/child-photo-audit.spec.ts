import { describe, it, expect } from 'vitest';
import {
  isExposedChildSourcePhotoKey, isCharacterAnchorKey, classifyExposedChildPhotos, summarizeExposure,
  residueKeys, collectPublicUrlsDeep, orderReferencedChildPhotoKeys,
} from '@/lib/child-photo-audit';

const BUCKET = 'book-images';
// The ACTUAL prod format (verified 2026-07-19) — an EXTRA path segment the old ^orders/[^/]+/references/ regex missed.
const OLD_FORMAT = 'orders/OLD/draft-abc123/references/main-child-xyz.jpg';
const NEW_FORMAT = 'orders/ord_1/references/stage0-child-photo-2.png';
const WIZARD = 'wizard/char-photos/1700000000000-abcdef0123.jpg';
const ANCHOR = 'orders/ord_1/character-anchors/child-canonical.png';
const PAGE = 'orders/ord_1/pages/page-3.png';

describe('audit matchers (Track-4 Unit 1a)', () => {
  it('isExposedChildSourcePhotoKey matches the real deep prod path + new + wizard, excludes anchors/pages', () => {
    expect(isExposedChildSourcePhotoKey(OLD_FORMAT)).toBe(true); // the residue the old regex missed
    expect(isExposedChildSourcePhotoKey(NEW_FORMAT)).toBe(true);
    expect(isExposedChildSourcePhotoKey(WIZARD)).toBe(true);
    expect(isExposedChildSourcePhotoKey(ANCHOR)).toBe(false);
    expect(isExposedChildSourcePhotoKey(PAGE)).toBe(false);
  });
  it('isCharacterAnchorKey identifies AI illustrations (never remediated) and never a photo', () => {
    expect(isCharacterAnchorKey(ANCHOR)).toBe(true);
    expect(isCharacterAnchorKey(OLD_FORMAT)).toBe(false);
    expect(isCharacterAnchorKey(WIZARD)).toBe(false);
  });
});

describe('classifyExposedChildPhotos', () => {
  it('a residue photo (not referenced by an in-flight order) is remediable; an in-flight photo is KEEP', () => {
    const inflight = new Set([NEW_FORMAT]); // an active render still needs this one
    const objs = classifyExposedChildPhotos([OLD_FORMAT, NEW_FORMAT, WIZARD, ANCHOR, PAGE], inflight);
    // anchors + pages are filtered out (not source photos)
    expect(objs.map((o) => o.key).sort()).toEqual([NEW_FORMAT, OLD_FORMAT, WIZARD].sort());
    expect(objs.find((o) => o.key === NEW_FORMAT)?.disposition).toBe('in_flight_keep');
    expect(objs.find((o) => o.key === OLD_FORMAT)?.disposition).toBe('delivered_or_orphan_residue');
    expect(objs.find((o) => o.key === WIZARD)?.disposition).toBe('delivered_or_orphan_residue');
  });

  it('summary separates real photos from character-anchors; residue excludes in-flight', () => {
    const inflight = new Set([NEW_FORMAT]);
    const allKeys = [OLD_FORMAT, NEW_FORMAT, WIZARD, ANCHOR, PAGE];
    const objs = classifyExposedChildPhotos(allKeys, inflight);
    expect(summarizeExposure(objs, allKeys)).toEqual({ realPhotos: 3, characterAnchors: 1, in_flight_keep: 1, residue: 2 });
    const res = residueKeys(objs);
    expect(res).toEqual(expect.arrayContaining([OLD_FORMAT, WIZARD]));
    expect(res).not.toContain(NEW_FORMAT); // an in-flight order's photo is NEVER deleted
  });
});

describe('orderReferencedChildPhotoKeys (builds the in-flight protected set)', () => {
  it('extracts the key from childImageUrl AND a URL nested deep in characterAnchors', () => {
    const url = (k: string) => `https://p.supabase.co/storage/v1/object/public/${BUCKET}/${k}`;
    const keys = orderReferencedChildPhotoKeys(
      { childImageUrl: url(OLD_FORMAT), characterAnchors: { _privacy: { originalChildPhotoUrl: url(WIZARD) }, child: { sourceImageUrl: url(NEW_FORMAT) } } },
      BUCKET,
    );
    expect(keys.sort()).toEqual([OLD_FORMAT, NEW_FORMAT, WIZARD].sort());
  });
  it('collectPublicUrlsDeep finds only public-object URLs, at any depth', () => {
    const found = collectPublicUrlsDeep({ a: 'https://x/storage/v1/object/public/b/k.jpg', b: ['nope', { c: 'https://y/storage/v1/object/public/b/k2.jpg' }], d: 'data:image/png;base64,AAA' });
    expect(found).toHaveLength(2);
  });
});
