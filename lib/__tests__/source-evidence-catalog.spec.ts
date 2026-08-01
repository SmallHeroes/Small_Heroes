import { describe, expect, it } from 'vitest';

import {
  SOURCE_EVIDENCE_CATALOG_VERSION,
  assertValidSourceEvidenceCatalog,
  buildSourceEvidenceCatalog,
  resolveSourceEvidenceId,
  sourceEvidenceCatalogIssues,
} from '@/lib/visual-contract-compiler/sourceEvidenceCatalog';
import {
  relevantSourceEvidenceCatalogEntries,
  type SourceEvidenceIdRepairAffectedRecord,
} from '@/lib/visual-contract-compiler/sourceEvidenceIdRepair';

function identity(digest = '1'.repeat(64)) {
  return {
    version: 'normalized-story-source/v1',
    path: 'stories/unicode-story.md',
    digestAlgorithm: 'sha256',
    digest,
    pageCount: 2,
    pageNumbers: [1, 2],
  };
}

const pages = [
  {
    pageNumber: 1,
    text: '  שלום, גיבור! “Go 🚀.”\nחוזר. חוזר.  ',
  },
  {
    pageNumber: 2,
    text: 'חוזר.\r\nEnglish—עברית? סוף…',
  },
];

describe('Source Evidence Catalog', () => {
  it('derives stable IDs and exact Unicode/punctuation excerpts with byte offsets', () => {
    const first = buildSourceEvidenceCatalog({
      storyKey: 'unicode-story',
      sourceIdentity: identity(),
      pages,
    });
    const second = buildSourceEvidenceCatalog({
      storyKey: 'unicode-story',
      sourceIdentity: identity(),
      pages: [...pages].reverse(),
    });

    expect(first).toEqual(second);
    expect(first.version).toBe(SOURCE_EVIDENCE_CATALOG_VERSION);
    expect(first.entries.map((entry) => entry.excerpt)).toEqual([
      'שלום, גיבור!',
      '“Go 🚀.”',
      'חוזר.',
      'חוזר.',
      'חוזר.',
      'English—עברית?',
      'סוף…',
    ]);
    expect(new Set(first.entries.map((entry) => entry.sourceEvidenceId)).size)
      .toBe(first.entries.length);

    for (const entry of first.entries) {
      const page = pages.find(
        (candidate) => candidate.pageNumber === entry.pageNumber,
      )!;
      expect(
        page.text.slice(entry.startOffsetUtf16, entry.endOffsetUtf16),
      ).toBe(entry.excerpt);
      expect(
        Buffer.byteLength(
          page.text.slice(0, entry.startOffsetUtf16),
          'utf8',
        ),
      ).toBe(entry.startOffsetUtf8);
      expect(
        entry.endOffsetUtf8 - entry.startOffsetUtf8,
      ).toBe(Buffer.byteLength(entry.excerpt, 'utf8'));
    }
    expect(() =>
      assertValidSourceEvidenceCatalog({
        catalog: first,
        storyKey: 'unicode-story',
        sourceIdentity: identity(),
        pages,
      }),
    ).not.toThrow();
  });

  it('disambiguates duplicate excerpts by page, ordinal, and exact offsets', () => {
    const catalog = buildSourceEvidenceCatalog({
      storyKey: 'unicode-story',
      sourceIdentity: identity(),
      pages,
    });
    const duplicates = catalog.entries.filter(
      (entry) => entry.excerpt === 'חוזר.',
    );

    expect(duplicates).toHaveLength(3);
    expect(duplicates.map((entry) => entry.pageNumber)).toEqual([1, 1, 2]);
    expect(duplicates.map((entry) => entry.excerptOrdinal)).toEqual([3, 4, 1]);
    expect(new Set(duplicates.map((entry) => entry.sourceEvidenceId)).size)
      .toBe(3);
    const affectedRecord = {
      pageNumber: 1,
    } as SourceEvidenceIdRepairAffectedRecord;
    expect(
      relevantSourceEvidenceCatalogEntries({
        catalog,
        affectedRecords: [affectedRecord],
      })
        .filter((entry) => entry.excerpt === 'חוזר.')
        .map((entry) => ({
          ordinal: entry.excerptOrdinal,
          start: entry.startOffsetUtf8,
          end: entry.endOffsetUtf8,
        })),
    ).toEqual([
      expect.objectContaining({ ordinal: 3 }),
      expect.objectContaining({ ordinal: 4 }),
    ]);
  });

  it('fails closed for malformed, unknown, wrong-page, cross-source, and stale IDs', () => {
    const catalog = buildSourceEvidenceCatalog({
      storyKey: 'unicode-story',
      sourceIdentity: identity(),
      pages,
    });
    const pageOneId = catalog.entries.find(
      (entry) => entry.pageNumber === 1,
    )!.sourceEvidenceId;
    const otherSource = buildSourceEvidenceCatalog({
      storyKey: 'other-story',
      sourceIdentity: identity('2'.repeat(64)),
      pages,
    });

    expect(
      resolveSourceEvidenceId({
        catalog,
        sourceEvidenceId: 'copied phrase',
        pageNumber: 1,
      }),
    ).toEqual({ ok: false, code: 'source_evidence_id_malformed' });
    expect(
      resolveSourceEvidenceId({
        catalog,
        sourceEvidenceId: `se1_${'f'.repeat(64)}`,
        pageNumber: 1,
      }),
    ).toEqual({ ok: false, code: 'source_evidence_id_unknown' });
    expect(
      resolveSourceEvidenceId({
        catalog,
        sourceEvidenceId: pageOneId,
        pageNumber: 2,
      }),
    ).toEqual({ ok: false, code: 'source_evidence_id_wrong_page' });
    expect(
      resolveSourceEvidenceId({
        catalog,
        sourceEvidenceId: otherSource.entries[0]!.sourceEvidenceId,
        pageNumber: 1,
      }),
    ).toEqual({ ok: false, code: 'source_evidence_id_unknown' });

    expect(
      sourceEvidenceCatalogIssues({
        catalog,
        storyKey: 'unicode-story',
        sourceIdentity: identity('3'.repeat(64)),
        pages,
      }),
    ).toContain('source_evidence_catalog_stale_or_malformed');
  });
});
