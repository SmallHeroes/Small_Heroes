/**
 * Phase-1 base_book_integrity — the deterministic integrity gate. Given a book's assets + text and the
 * order's FROZEN product-truth, runs 6 checks and returns passed|blocked + per-check evidence + an
 * inputsHash (the exact assets+text observed; the readiness layer uses it to decide current vs stale).
 *
 * PURE given (input, inspect-results): no DB, no clock, no env. `inspect` is injectable so tests run
 * without network. Zero image renders — compute is decode/hash over assets that already exist.
 */
import { createHash } from 'crypto';
import { inspectAsset, type AssetInspection } from './asset-integrity';

export const BASE_BOOK_SCOPE = 'base_book';

export interface IntegrityFrozenTruth {
  expectedPageCount: number | null;
  storySourceHash: string | null;
  selectionFilename: string | null;
  frozenProductVersion: string | null;
}
export interface IntegrityPageInput {
  pageNumber: number;
  imageUrl: string | null;
  text: string;
}
export interface IntegrityInput {
  scope: string; // BASE_BOOK_SCOPE
  orderId: string;
  readUrl: string | null;
  frozen: IntegrityFrozenTruth;
  cover: { imageUrl: string | null };
  pages: IntegrityPageInput[];
}
export interface IntegrityResult {
  status: 'passed' | 'blocked';
  reason: string | null; // primary blocker (null when passed)
  blockers: string[];
  inputsHash: string;
  evidence: Record<string, unknown>;
}

// Leftover template artifacts that should have been resolved before render: {{mustache}}, {chip|chip}, [[patch]].
const UNRESOLVED_MARKER_RE = /\{\{|\}\}|\{[^}{]*\|[^}{]*\}|\[\[[^\]]*\]\]/;

export async function evaluateBaseBookIntegrity(
  input: IntegrityInput,
  inspect: (url: string | null | undefined) => Promise<AssetInspection> = inspectAsset,
): Promise<IntegrityResult> {
  const blockers: string[] = [];
  const sortedPages = [...input.pages].sort((a, b) => a.pageNumber - b.pageNumber);

  // (1) ALL required frozen product-truth must be present (fail-closed; no live fallback). (B4)
  const expected = input.frozen.expectedPageCount;
  if (expected == null || expected <= 0) blockers.push('frozen_expected_page_count_missing');
  if (!input.frozen.storySourceHash) blockers.push('frozen_story_source_hash_missing');
  if (!input.frozen.selectionFilename) blockers.push('frozen_selection_filename_missing');
  if (!input.frozen.frozenProductVersion) blockers.push('frozen_product_version_missing');

  // (2) pages contiguous 1..N + unique.
  const nums = sortedPages.map((p) => p.pageNumber);
  const contiguous = nums.length > 0 && new Set(nums).size === nums.length && nums.every((n, i) => n === i + 1);
  if (!contiguous) blockers.push('pages_not_contiguous_or_duplicate');
  if (expected != null && expected > 0 && input.pages.length !== expected) {
    blockers.push(`page_count_mismatch(expected=${expected},rendered=${input.pages.length})`);
  }

  // (3) cover present + decodable.
  const coverInspect = await inspect(input.cover.imageUrl);
  if (!coverInspect.ok) blockers.push(`cover_invalid:${coverInspect.error ?? 'unknown'}`);

  // (4) every page: valid url + decodable + bytes>0 + image MIME (computed now, stored in evidence).
  const pageEvidence: Array<Record<string, unknown>> = [];
  for (const p of sortedPages) {
    const ins = await inspect(p.imageUrl);
    pageEvidence.push({ pageNumber: p.pageNumber, url: p.imageUrl, ...ins });
    if (!ins.ok) blockers.push(`page${p.pageNumber}_image_invalid:${ins.error ?? 'unknown'}`);
  }

  // (5) no unresolved placeholders/chips/patches + a text snapshot hash (write-barrier/diff is phase-2).
  const unresolved = sortedPages.filter((p) => UNRESOLVED_MARKER_RE.test(p.text)).map((p) => p.pageNumber);
  if (unresolved.length) blockers.push(`unresolved_markers_on_pages:[${unresolved.join(',')}]`);
  const textHash = createHash('sha256')
    .update(JSON.stringify(sortedPages.map((p) => [p.pageNumber, p.text])))
    .digest('hex');

  // (6) readUrl present, well-formed, and pointing at THIS order's reader route (never ship a broken link). (B5)
  const readUrl = (input.readUrl ?? '').trim();
  let readUrlOk = false;
  try {
    const u = new URL(readUrl);
    readUrlOk = (u.protocol === 'https:' || u.protocol === 'http:') && readUrl.includes(input.orderId);
  } catch {
    readUrlOk = false;
  }
  if (!readUrlOk) blockers.push('read_url_missing_or_mismatched');

  // inputsHash — the exact FROZEN-truth + readUrl + assets + text observed; the manifest is "current" only
  // while it matches, so a story-version / asset / link change invalidates the old manifest. (B4)
  const inputsHash = createHash('sha256')
    .update(JSON.stringify({
      scope: input.scope,
      frozen: {
        expected: expected ?? null,
        storySourceHash: input.frozen.storySourceHash,
        selectionFilename: input.frozen.selectionFilename,
        frozenProductVersion: input.frozen.frozenProductVersion,
      },
      readUrl: readUrl || null,
      cover: coverInspect.sha256,
      pages: pageEvidence.map((e) => [e.pageNumber, e.sha256]),
      textHash,
    }))
    .digest('hex');

  const status: IntegrityResult['status'] = blockers.length === 0 ? 'passed' : 'blocked';
  return {
    status,
    reason: blockers[0] ?? null,
    blockers,
    inputsHash,
    evidence: {
      scope: input.scope,
      frozen: input.frozen,
      renderedPageCount: input.pages.length,
      pageNumbers: nums,
      cover: { url: input.cover.imageUrl, ...coverInspect },
      pages: pageEvidence,
      textHash,
      readUrl: readUrl || null,
      readUrlOk,
      unresolvedMarkerPages: unresolved,
    },
  };
}
