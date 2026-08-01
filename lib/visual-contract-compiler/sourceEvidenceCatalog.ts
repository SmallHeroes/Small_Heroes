import { canonicalHash } from '@/lib/canonical-json';

export const SOURCE_EVIDENCE_CATALOG_VERSION =
  'source-evidence-catalog/v1' as const;

export const SOURCE_EVIDENCE_ID_PATTERN = /^se1_[a-f0-9]{64}$/;

export interface SourceEvidenceStoryIdentity {
  version: string;
  path: string;
  digestAlgorithm: string;
  digest: string;
  pageCount: number;
  pageNumbers: number[];
}

export interface SourceEvidenceCatalogPage {
  pageNumber: number;
  text: string;
}

export interface SourceEvidenceCatalogEntry {
  sourceEvidenceId: string;
  pageNumber: number;
  excerptOrdinal: number;
  startOffsetUtf16: number;
  endOffsetUtf16: number;
  startOffsetUtf8: number;
  endOffsetUtf8: number;
  excerpt: string;
}

export interface SourceEvidenceCatalog {
  version: typeof SOURCE_EVIDENCE_CATALOG_VERSION;
  sourceAuthority: {
    storyKey: string;
    sourceIdentityDigest: string;
    normalizedSourceDigest: string;
    pageCount: number;
    pageNumbers: number[];
  };
  entries: SourceEvidenceCatalogEntry[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export type SourceEvidenceIdResolution =
  | {
      ok: true;
      entry: SourceEvidenceCatalogEntry;
    }
  | {
      ok: false;
      code:
        | 'source_evidence_id_malformed'
        | 'source_evidence_id_unknown'
        | 'source_evidence_id_wrong_page';
    };

const TERMINATORS = new Set(['.', '!', '?', '…']);
const TRAILING_CLOSERS = new Set([
  '"',
  "'",
  '”',
  '’',
  '״',
  ')',
  ']',
  '}',
]);

function isWhitespace(value: string): boolean {
  return /^\s$/u.test(value);
}

function trimmedSpan(
  text: string,
  rawStart: number,
  rawEnd: number,
): { start: number; end: number } | null {
  let start = rawStart;
  let end = rawEnd;
  while (start < end && isWhitespace(text[start])) start += 1;
  while (end > start && isWhitespace(text[end - 1])) end -= 1;
  return start < end ? { start, end } : null;
}

/**
 * Deterministic sentence/line segmentation that preserves exact source bytes.
 * It deliberately avoids locale/ICU sentence heuristics so catalog identity is
 * stable across machines. Boundaries are line breaks or terminal punctuation
 * followed by whitespace/end; punctuation and closing quotes stay in the
 * excerpt.
 */
export function sourceEvidenceExcerptSpans(
  text: string,
): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = [];
  let segmentStart = 0;
  const push = (rawStart: number, rawEnd: number): void => {
    const span = trimmedSpan(text, rawStart, rawEnd);
    if (span) spans.push(span);
  };

  for (let index = 0; index < text.length; index += 1) {
    const value = text[index];
    if (value === '\r' || value === '\n') {
      push(segmentStart, index);
      if (value === '\r' && text[index + 1] === '\n') index += 1;
      segmentStart = index + 1;
      continue;
    }
    if (!TERMINATORS.has(value)) continue;

    let end = index + 1;
    while (
      end < text.length &&
      (TERMINATORS.has(text[end]) || TRAILING_CLOSERS.has(text[end]))
    ) {
      end += 1;
    }
    if (end === text.length || isWhitespace(text[end])) {
      push(segmentStart, end);
      segmentStart = end;
      index = end - 1;
    }
  }
  push(segmentStart, text.length);
  return spans;
}

function catalogPayload(
  catalog: Omit<SourceEvidenceCatalog, 'digestAlgorithm' | 'digest'>,
): unknown {
  return catalog;
}

function sourceEvidenceId(args: {
  sourceIdentityDigest: string;
  normalizedSourceDigest: string;
  pageNumber: number;
  excerptOrdinal: number;
  startOffsetUtf8: number;
  endOffsetUtf8: number;
  excerpt: string;
}): string {
  return `se1_${canonicalHash({
    version: SOURCE_EVIDENCE_CATALOG_VERSION,
    ...args,
  })}`;
}

export function buildSourceEvidenceCatalog(args: {
  storyKey: string;
  sourceIdentity: SourceEvidenceStoryIdentity;
  pages: readonly SourceEvidenceCatalogPage[];
}): SourceEvidenceCatalog {
  const sourceIdentityDigest = canonicalHash(args.sourceIdentity);
  const orderedPages = [...args.pages].sort(
    (left, right) => left.pageNumber - right.pageNumber,
  );
  const entries: SourceEvidenceCatalogEntry[] = [];

  for (const page of orderedPages) {
    const spans = sourceEvidenceExcerptSpans(page.text);
    for (const [index, span] of spans.entries()) {
      const excerpt = page.text.slice(span.start, span.end);
      const startOffsetUtf8 = Buffer.byteLength(
        page.text.slice(0, span.start),
        'utf8',
      );
      const endOffsetUtf8 =
        startOffsetUtf8 + Buffer.byteLength(excerpt, 'utf8');
      const excerptOrdinal = index + 1;
      entries.push({
        sourceEvidenceId: sourceEvidenceId({
          sourceIdentityDigest,
          normalizedSourceDigest: args.sourceIdentity.digest,
          pageNumber: page.pageNumber,
          excerptOrdinal,
          startOffsetUtf8,
          endOffsetUtf8,
          excerpt,
        }),
        pageNumber: page.pageNumber,
        excerptOrdinal,
        startOffsetUtf16: span.start,
        endOffsetUtf16: span.end,
        startOffsetUtf8,
        endOffsetUtf8,
        excerpt,
      });
    }
  }

  const withoutDigest = {
    version: SOURCE_EVIDENCE_CATALOG_VERSION,
    sourceAuthority: {
      storyKey: args.storyKey,
      sourceIdentityDigest,
      normalizedSourceDigest: args.sourceIdentity.digest,
      pageCount: args.sourceIdentity.pageCount,
      pageNumbers: [...args.sourceIdentity.pageNumbers],
    },
    entries,
  };
  return {
    ...withoutDigest,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalHash(catalogPayload(withoutDigest)),
  };
}

export function sourceEvidenceCatalogIssues(args: {
  catalog: SourceEvidenceCatalog;
  storyKey: string;
  sourceIdentity: SourceEvidenceStoryIdentity;
  pages: readonly SourceEvidenceCatalogPage[];
}): string[] {
  let expected: SourceEvidenceCatalog;
  try {
    expected = buildSourceEvidenceCatalog(args);
  } catch {
    return ['source_evidence_catalog_rebuild_failed'];
  }
  const issues: string[] = [];
  if (args.catalog.version !== SOURCE_EVIDENCE_CATALOG_VERSION) {
    issues.push('source_evidence_catalog_version_invalid');
  }
  if (
    args.catalog.digestAlgorithm !== 'canonical-json-sha256' ||
    !/^[a-f0-9]{64}$/.test(args.catalog.digest)
  ) {
    issues.push('source_evidence_catalog_digest_invalid');
  }
  if (canonicalHash(args.catalog) !== canonicalHash(expected)) {
    issues.push('source_evidence_catalog_stale_or_malformed');
  }
  return issues;
}

export function assertValidSourceEvidenceCatalog(args: {
  catalog: SourceEvidenceCatalog;
  storyKey: string;
  sourceIdentity: SourceEvidenceStoryIdentity;
  pages: readonly SourceEvidenceCatalogPage[];
}): void {
  const issues = sourceEvidenceCatalogIssues(args);
  if (issues.length > 0) {
    throw new Error(
      `Invalid Source Evidence Catalog:\n- ${issues.join('\n- ')}`,
    );
  }
}

export function resolveSourceEvidenceId(args: {
  catalog: SourceEvidenceCatalog;
  sourceEvidenceId: unknown;
  pageNumber: number;
}): SourceEvidenceIdResolution {
  if (
    typeof args.sourceEvidenceId !== 'string' ||
    !SOURCE_EVIDENCE_ID_PATTERN.test(args.sourceEvidenceId)
  ) {
    return { ok: false, code: 'source_evidence_id_malformed' };
  }
  const entry = args.catalog.entries.find(
    (candidate) =>
      candidate.sourceEvidenceId === args.sourceEvidenceId,
  );
  if (!entry) {
    return { ok: false, code: 'source_evidence_id_unknown' };
  }
  if (entry.pageNumber !== args.pageNumber) {
    return { ok: false, code: 'source_evidence_id_wrong_page' };
  }
  return { ok: true, entry };
}
