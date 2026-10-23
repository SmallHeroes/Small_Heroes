import { describe, expect, it } from 'vitest';
import { localReaderAsset, localReaderByteRange, localReaderId, localReaderPayload, localReaderPreviewSchema } from '../local-reader-preview';

const fixture = () => ({ version: 'local-narrated-reader/v1', id: 'synthetic-book', title: 'כותרת', childName: 'דוגמה',
  sourceManifestSha256: 'a'.repeat(64), sourceQa: 'incomplete', productAccepted: false, productionQualified: false,
  voice: { id: 'mom', label: 'אמא', provider: 'elevenlabs', model: 'eleven_v3' },
  pages: [0, 1, 2].map(pageNumber => ({ pageNumber, text: pageNumber ? 'מקור מדויק ' + pageNumber : 'כותרת',
    imageSha256: 'b'.repeat(64), audioSha256: 'c'.repeat(64) })) });

describe('local narrated reader uses existing fixture contract without delivery authority', () => {
  it('builds every image/clip and exact text with separate cover; no DB order or whole-book fallback', () => {
    const p = localReaderPreviewSchema.parse(fixture()), payload = localReaderPayload(p);
    expect(payload.status).toBe('LOCAL_DIAGNOSTIC_PREVIEW'); expect(payload.powerCard).toBeNull();
    expect(payload.book?.audioUrl).toBeNull(); expect(payload.book?.pages).toHaveLength(3);
    payload.book?.pages.forEach((row, index) => {
      expect(row.text).toBe(p.pages[index].text); expect(row.narrationText).toBe(row.text);
      expect(row.isCover).toBe(index === 0); expect(row.audioUrl).toContain(`asset=page-${index}.mp3`);
      expect(row.imageUrl).toContain(`asset=page-${index}.png`);
    });
  });
  it.each(['../secret', 'a/b', 'a\\b', '%2e%2e', '', 'A-b', 'book?x=1'])('rejects untrusted book id %s', id => {
    expect(() => localReaderId(id)).toThrow();
  });
  it.each(['manifest.json', '../page-0.mp3', 'page-01.mp3', 'page-99.png', 'page-0.svg', 'page-0.mp3?key=x'])('refuses nonmanifest asset %s', file => {
    expect(() => localReaderAsset(localReaderPreviewSchema.parse(fixture()), file)).toThrow();
  });
  it('binds mime/hash per asset kind', () => {
    const p = localReaderPreviewSchema.parse(fixture());
    expect(localReaderAsset(p, 'page-1.mp3')).toEqual({ sha256: 'c'.repeat(64), contentType: 'audio/mpeg' });
    expect(localReaderAsset(p, 'page-0.png').sha256).toBe('b'.repeat(64));
  });
  it.each(['sourceQa', 'productAccepted', 'productionQualified'] as const)('cannot turn diagnostic state into acceptance: %s', key => {
    const f: any = fixture(); f[key] = key === 'sourceQa' ? 'passed' : true;
    expect(localReaderPreviewSchema.safeParse(f).success).toBe(false);
  });
  it('rejects missing/duplicate/out-of-order pages, wrong cover and unknown authority fields', () => {
    const f = fixture();
    for (const pages of [[f.pages[1]], [f.pages[0], f.pages[2]], [f.pages[0], f.pages[1], f.pages[1]]])
      expect(localReaderPreviewSchema.safeParse({ ...f, pages }).success).toBe(false);
    expect(localReaderPreviewSchema.safeParse({ ...f, title: 'wrong' }).success).toBe(false);
    expect(localReaderPreviewSchema.safeParse({ ...f, accessKey: 'not-an-order' }).success).toBe(false);
  });
});

describe('bounded audio byte ranges', () => {
  it('supports full, prefix, suffix and open ranges', () => {
    expect(localReaderByteRange(null, 10)).toBeNull();
    expect(localReaderByteRange('bytes=0-3', 10)).toEqual({ start: 0, end: 3 });
    expect(localReaderByteRange('bytes=5-', 10)).toEqual({ start: 5, end: 9 });
    expect(localReaderByteRange('bytes=-3', 10)).toEqual({ start: 7, end: 9 });
    expect(localReaderByteRange('bytes=0-999', 10)).toEqual({ start: 0, end: 9 });
    expect(localReaderByteRange('bytes=-999', 10)).toEqual({ start: 0, end: 9 });
  });
  it.each(['bytes=10-', 'bytes=9-2', 'bytes=-0', 'bytes=-', 'bytes=0-2,4-6', 'items=0-1', 'bytes=999999999999999999-'])('refuses invalid range %s', header => {
    expect(localReaderByteRange(header, 10)).toBe('unsatisfiable');
  });
});
