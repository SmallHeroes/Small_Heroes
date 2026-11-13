import { describe, expect, it } from 'vitest';
import { NATIVE_BOOK_FRAMES } from '@/lib/personal-wizard/native-page-proof';
import { trialPageRenderEvidence } from '@/lib/personal-wizard/native-page-render-evidence';
import { selectSupportedNativePages } from '../native-recipe';

async function savedFrames() {
  const saved: Record<string, unknown> = {};
  const render = trialPageRenderEvidence(async step => ({
    imageName: step + '.png', imageSha: 'a'.repeat(64),
  }), (name, value) => { saved[name] = value; });
  for (const pageNumber of [...NATIVE_BOOK_FRAMES].reverse()) {
    const candidate = await render(`page_${pageNumber}_0`, '', [], 'book_identity');
    saved[`page_${pageNumber}`] = { pageNumber, status: 'qa_supported', chosen: { candidate } };
  }
  return saved;
}

describe('native full-book frame assembly', () => {
  it('retains draw evidence while assembling only the reviewed pages in reading order', async () => {
    const saved = await savedFrames();
    expect(Object.keys(saved)).toHaveLength(18);
    const pages = selectSupportedNativePages(saved);
    expect(pages.map(page => page.pageNumber)).toEqual(NATIVE_BOOK_FRAMES);
    expect(pages[0]).toBe(saved.page_0);
    expect(saved.drawn_page_0).toMatchObject({ version: 'native-page-render-evidence/v1', pageNumber: 0 });
  });

  it.each([undefined, { pageNumber: 4, status: 'held', chosen: { candidate: {} } },
    { pageNumber: 5, status: 'qa_supported', chosen: { candidate: {} } },
    { pageNumber: 4, status: 'qa_supported', chosen: null }])('holds a missing or invalid selected frame even when its drawing exists', async replacement => {
    const saved = await savedFrames();
    saved.page_4 = replacement;
    expect(() => selectSupportedNativePages(saved)).toThrow('engine_native_book_held');
  });
});
