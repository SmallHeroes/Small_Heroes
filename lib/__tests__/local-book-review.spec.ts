import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { loadLocalBookReview, loadLocalBookImage } from '../local-book-review';
import { GET } from '../../app/api/dev/local-book-image/route';

const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]);
const sha = createHash('sha256').update(bytes).digest('hex');
let root: string;
function manifest() {
  return { pages: [0, 1].map(pageNumber => ({
    pageNumber, imageName: `page-0${pageNumber}.png`, imageSha: sha,
    text: pageNumber ? 'טקסט מדויק\n\nללא שינוי' : 'כריכה',
    automatedPassed: pageNumber === 0, reason: pageNumber ? 'safety_failed' : 'ok',
    score: pageNumber ? null : 0.8,
  })) };
}
async function save(value: unknown, file = 'manifest.json') {
  await writeFile(path.join(root, file), JSON.stringify(value));
}
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'local-book-review-'));
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('VERCEL', ''); vi.stubEnv('VERCEL_ENV', '');
  vi.stubEnv('LOCAL_BOOK_REVIEW_DIR', root);
  await save(manifest());
  await Promise.all([0, 1].map(i => writeFile(path.join(root, `page-0${i}.png`), bytes)));
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(root, { recursive: true, force: true }); });

describe('local book reader: exact data and no release authority', () => {
  it('uses exact manifest text, cover and hash-bound local image URLs', async () => {
    const result = await loadLocalBookReview();
    expect(result.payload.book?.pages[1].text).toBe(manifest().pages[1].text);
    expect(result.payload.book?.pages[0].isCover).toBe(true);
    expect(result.payload.book?.pages[1].imageUrl).toContain(`page=1&sha=${sha}`);
    expect(result.payload.status).toBe('QA_FIXTURE_READY');
    expect(result.owner).toBeNull();
  });
  it('keeps owner visual acceptance separate from failed automation and missing score', async () => {
    await save({ reviewer: 'Guy', pages: [{ pageNumber: 1, imageSha: sha, decision: 'visually_accepted' }] }, 'owner-review.json');
    const result = await loadLocalBookReview();
    expect(result.owner?.pages[0].decision).toBe('visually_accepted');
    expect(result.automated[1]).toMatchObject({ automatedPassed: false, reason: 'safety_failed', score: null });
  });
  it.each(['production', 'test'])('denies NODE_ENV=%s even with directory configured', async env => {
    vi.stubEnv('NODE_ENV', env);
    await expect(loadLocalBookReview()).rejects.toThrow('disabled');
    expect((await GET(new Request(`http://localhost/api/dev/local-book-image?page=0&sha=${sha}`))).status).toBe(404);
  });
  it.each(['VERCEL', 'VERCEL_ENV'])('denies hosted environment %s', async key => {
    vi.stubEnv(key, 'preview');
    await expect(loadLocalBookReview()).rejects.toThrow('disabled');
  });
  it('denies missing opt-in and relative directories', async () => {
    vi.stubEnv('LOCAL_BOOK_REVIEW_DIR', '');
    await expect(loadLocalBookReview()).rejects.toThrow('disabled');
    vi.stubEnv('LOCAL_BOOK_REVIEW_DIR', 'outputs/review');
    await expect(loadLocalBookReview()).rejects.toThrow('Absolute');
  });
  it('denies tampered image bytes in page load and asset load', async () => {
    await writeFile(path.join(root, 'page-01.png'), 'tampered');
    await expect(loadLocalBookReview()).rejects.toThrow('digest mismatch');
    await expect(loadLocalBookImage(1, sha)).rejects.toThrow('digest mismatch');
  });
  it('denies a filename traversal even if supplied by manifest', async () => {
    const value = manifest(); value.pages[1].imageName = '../page-01.png'; await save(value);
    await expect(loadLocalBookReview()).rejects.toThrow();
  });
  it('denies duplicate, missing or reordered page numbers', async () => {
    const value = manifest(); value.pages[1].pageNumber = 0; await save(value);
    await expect(loadLocalBookReview()).rejects.toThrow('contiguous');
  });
  it('denies stale owner approval rather than applying it to replacement bytes', async () => {
    await save({ reviewer: 'Guy', pages: [{ pageNumber: 1, imageSha: 'a'.repeat(64), decision: 'visually_accepted' }] }, 'owner-review.json');
    await expect(loadLocalBookReview()).rejects.toThrow('Owner approval image mismatch');
  });
  it('serves original bytes without caching and rejects unknown asset bindings', async () => {
    const response = await GET(new Request(`http://localhost/api/dev/local-book-image?page=1&sha=${sha}`));
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    expect(response.headers.get('cache-control')).toBe('no-store');
    for (const query of [`page=2&sha=${sha}`, `page=1&sha=${'a'.repeat(64)}`, `page=../1&sha=${sha}`, `page=01&sha=${sha}`]) {
      expect((await GET(new Request(`http://localhost/api/dev/local-book-image?${query}`))).status).toBe(404);
    }
  });
});
