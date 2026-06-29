import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { evaluateBaseBookIntegrity, BASE_BOOK_SCOPE, type IntegrityInput } from '@/lib/generation-pipeline/integrity-gate';
import type { AssetInspection } from '@/lib/generation-pipeline/asset-integrity';

// Deterministic stub: any url containing "bad" is undecodable; null/"" is invalid; else a valid image whose
// sha is derived from the url (so changing a url changes the inputsHash).
const stubInspect = async (url: string | null | undefined): Promise<AssetInspection> => {
  const u = (url ?? '').trim();
  if (!u) return { ok: false, bytes: 0, format: null, mime: null, width: null, height: null, sha256: null, error: 'url_not_allowlisted' };
  if (u.includes('bad')) return { ok: false, bytes: 10, format: null, mime: null, width: null, height: null, sha256: createHash('sha256').update(u).digest('hex'), error: 'not_decodable' };
  return { ok: true, bytes: 2048, format: 'png', mime: 'image/png', width: 800, height: 1200, sha256: createHash('sha256').update(u).digest('hex') };
};

const good = (over: Partial<IntegrityInput> = {}): IntegrityInput => ({
  scope: BASE_BOOK_SCOPE,
  frozen: { expectedPageCount: 3, storySourceHash: 'src-hash' },
  cover: { imageUrl: 'https://h/storage/v1/object/public/book-images/o/cover.png' },
  pages: [
    { pageNumber: 1, imageUrl: 'https://h/.../p1.png', text: 'עמוד ראשון' },
    { pageNumber: 2, imageUrl: 'https://h/.../p2.png', text: 'עמוד שני' },
    { pageNumber: 3, imageUrl: 'https://h/.../p3.png', text: 'עמוד שלישי' },
  ],
  ...over,
});

describe('evaluateBaseBookIntegrity — 6 checks', () => {
  it('passes a complete, contiguous, decodable book', async () => {
    const r = await evaluateBaseBookIntegrity(good(), stubInspect);
    expect(r.status).toBe('passed');
    expect(r.blockers).toEqual([]);
    expect(r.inputsHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('blocks when frozen expectedPageCount is missing (no live fallback)', async () => {
    const r = await evaluateBaseBookIntegrity(good({ frozen: { expectedPageCount: null, storySourceHash: null } }), stubInspect);
    expect(r.status).toBe('blocked');
    expect(r.blockers).toContain('frozen_expected_page_count_missing');
  });

  it('blocks on rendered/expected page-count mismatch', async () => {
    const r = await evaluateBaseBookIntegrity(good({ frozen: { expectedPageCount: 5, storySourceHash: 's' } }), stubInspect);
    expect(r.status).toBe('blocked');
    expect(r.blockers.some((b) => b.startsWith('page_count_mismatch'))).toBe(true);
  });

  it('blocks on a gap (non-contiguous pages)', async () => {
    const inp = good();
    inp.pages[2].pageNumber = 4; // [1,2,4]
    inp.frozen.expectedPageCount = 3;
    const r = await evaluateBaseBookIntegrity(inp, stubInspect);
    expect(r.status).toBe('blocked');
    expect(r.blockers).toContain('pages_not_contiguous_or_duplicate');
  });

  it('blocks on duplicate page numbers', async () => {
    const inp = good();
    inp.pages[2].pageNumber = 2; // [1,2,2]
    const r = await evaluateBaseBookIntegrity(inp, stubInspect);
    expect(r.status).toBe('blocked');
    expect(r.blockers).toContain('pages_not_contiguous_or_duplicate');
  });

  it('blocks when the cover is undecodable', async () => {
    const r = await evaluateBaseBookIntegrity(good({ cover: { imageUrl: 'https://h/.../cover-bad.png' } }), stubInspect);
    expect(r.status).toBe('blocked');
    expect(r.blockers.some((b) => b.startsWith('cover_invalid'))).toBe(true);
  });

  it('blocks when any page image is undecodable / missing', async () => {
    const inp = good();
    inp.pages[1].imageUrl = 'https://h/.../p2-bad.png';
    const r = await evaluateBaseBookIntegrity(inp, stubInspect);
    expect(r.status).toBe('blocked');
    expect(r.blockers.some((b) => b.startsWith('page2_image_invalid'))).toBe(true);
  });

  it('blocks a page with a missing image url', async () => {
    const inp = good();
    inp.pages[0].imageUrl = null;
    const r = await evaluateBaseBookIntegrity(inp, stubInspect);
    expect(r.status).toBe('blocked');
    expect(r.blockers.some((b) => b.startsWith('page1_image_invalid'))).toBe(true);
  });

  it('blocks on unresolved placeholders/chips/patches', async () => {
    const inp = good();
    inp.pages[1].text = 'שלום {{childName}}, בוא נשחק';
    const r = await evaluateBaseBookIntegrity(inp, stubInspect);
    expect(r.status).toBe('blocked');
    expect(r.blockers.some((b) => b.startsWith('unresolved_markers_on_pages'))).toBe(true);
  });

  it('inputsHash is stable for identical inputs and changes when an asset changes', async () => {
    const a = await evaluateBaseBookIntegrity(good(), stubInspect);
    const b = await evaluateBaseBookIntegrity(good(), stubInspect);
    expect(a.inputsHash).toBe(b.inputsHash); // deterministic
    const changed = good();
    changed.pages[0].imageUrl = 'https://h/.../p1-v2.png'; // new asset → new sha → new inputsHash
    const c = await evaluateBaseBookIntegrity(changed, stubInspect);
    expect(c.inputsHash).not.toBe(a.inputsHash);
  });

  it('records per-asset evidence (bytes/mime/sha) for the immutable Manifest', async () => {
    const r = await evaluateBaseBookIntegrity(good(), stubInspect);
    const pages = r.evidence.pages as Array<Record<string, unknown>>;
    expect(pages).toHaveLength(3);
    expect(pages[0]).toMatchObject({ pageNumber: 1, mime: 'image/png', ok: true });
    expect(pages[0].sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
