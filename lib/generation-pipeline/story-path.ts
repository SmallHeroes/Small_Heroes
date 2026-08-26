import path from 'path';
import fs from 'fs';

import { STORY_BANK_V3_DIR_NAME } from '@/backend/providers/story-bank-index';
import type {
  PipelineCache,
  RuntimeStorySourceAuthorityKind,
} from './types';

/**
 * Story-path helpers for pipelineCache (roundtable 0095 P0)
 * ========================================================
 * pipelineCache must NEVER store an absolute / machine-local path: it is carried across serverless
 * invocations, and an absolute `process.cwd()`-based story path becomes `/var/task/story-bank/...`
 * on Vercel — which the cross-chunk cache-invariant guard would (correctly) treat as a local path.
 * So we store the story reference RELATIVE (repo-relative, posix) and resolve it back to absolute at
 * the point of use (read time). The committed story bundle exists in every invocation, so this is a
 * stable round-trip.
 */

/** Repo-relative (posix, forward-slash) form for safe storage in pipelineCache. */
export function toRepoRelativeStoryPath(p: string): string {
  if (!p) return p;
  const rel = path.isAbsolute(p) ? path.relative(process.cwd(), p) : p;
  return rel.split(path.sep).join('/');
}

type StoryRefCache = Pick<
  PipelineCache,
  | 'devStoryBankFile'
  | 'storyFilePath'
  | 'storyDir'
  | 'selectionFilename'
  | 'storyKey'
  | 'storySourceAuthorityKind'
>;

export interface FrozenOrderStorySelection {
  storyFilePath: string;
  storyFileRef: string;
  storyDir: string | null;
  storyKey: string;
  storySourceAuthorityKind: RuntimeStorySourceAuthorityKind;
  selectionFilename: string;
  revisionDigest: string | null;
}

const STORY_SEGMENT = /^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/;
const REVISION_DIGEST = /^[0-9a-f]{64}$/;

export const ACCEPTED_REVISION_NAMESPACE_PREFIX =
  'story-pipeline/04_approved_story_sources/accepted/';

/**
 * Hostile accepted-namespace detector. A reference CLAIMS the accepted product
 * namespace when any plausible filesystem interpretation of it reaches into
 * that tree: surrounding whitespace is trimmed, backslashes fold to `/`,
 * duplicate separators collapse, self (`.`) segments drop, and the comparison
 * is case-insensitive (a case-aliased spelling resolves on Windows dev
 * filesystems). This function decides only namespace OWNERSHIP — it grants no
 * authority. Every caller must fail closed when a claiming reference does not
 * ALSO parse as the exact canonical byte spelling; classifying a noncanonical
 * claiming spelling as "legacy" is the path-authority bypass this closes.
 */
export function storyRefClaimsAcceptedRevisionNamespace(
  value: unknown,
): boolean {
  const segments = String(value ?? '')
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.');
  if (segments.length === 0) return false;
  return `${segments.join('/').toLowerCase()}/`.startsWith(
    ACCEPTED_REVISION_NAMESPACE_PREFIX,
  );
}

function safeSegment(value: string): boolean {
  return STORY_SEGMENT.test(value) && value !== '.' && value !== '..';
}

/**
 * Resolve the absolute story `.md` path from cache. Handles, in order:
 *  - a stored ref (`devStoryBankFile` / `storyFilePath`), relative (new) or absolute (legacy in-flight);
 *  - reconstruction from `{ storyDir, selectionFilename }`.
 * Returns undefined when the cache carries no story reference yet (e.g. before the text stage).
 */
export function resolveCachedStoryFilePath(cache: StoryRefCache): string | undefined {
  const ref = cache.devStoryBankFile ?? cache.storyFilePath;
  if (cache.storySourceAuthorityKind === 'product_accepted_revision') {
    if (!ref || path.isAbsolute(ref)) return undefined;
    const accepted = resolveFrozenOrderStorySelection(ref);
    if (
      accepted?.storySourceAuthorityKind !== 'product_accepted_revision' ||
      (cache.storyKey != null && cache.storyKey !== accepted.storyKey)
    ) {
      return undefined;
    }
    return accepted.storyFilePath;
  }
  if (ref) return path.isAbsolute(ref) ? ref : path.join(process.cwd(), ref);
  if (cache.selectionFilename) {
    const dir = cache.storyDir ?? STORY_BANK_V3_DIR_NAME;
    return path.join(process.cwd(), 'story-bank', dir, cache.selectionFilename);
  }
  return undefined;
}

/**
 * Rehydrate the exact repo-relative Story Source frozen on the Order. Current
 * orders persist `story-bank/<bank>/<story>.md`; older basename-only orders
 * return null and retain the legacy companion selector.
 */
export function resolveFrozenOrderStorySelection(
  selectionFilename: string | null | undefined,
  options: { repoRoot?: string } = {},
): FrozenOrderStorySelection | null {
  const supplied = String(selectionFilename ?? '');
  const relative = supplied
    .trim()
    .replace(/\\/g, '/');
  const parts = relative.split('/');
  const legacyStoryBank =
    parts.length === 3 &&
    parts[0] === 'story-bank' &&
    safeSegment(parts[1]) &&
    parts[2].endsWith('.md') &&
    safeSegment(parts[2].slice(0, -3));
  const acceptedRevision =
    parts.length === 7 &&
    parts[0] === 'story-pipeline' &&
    parts[1] === '04_approved_story_sources' &&
    parts[2] === 'accepted' &&
    safeSegment(parts[3]) &&
    parts[4] === 'revisions' &&
    REVISION_DIGEST.test(parts[5]) &&
    parts[6] === 'integrated.md' &&
    supplied === relative;
  if (!legacyStoryBank && !acceptedRevision) {
    return null;
  }
  const root = path.resolve(options.repoRoot ?? process.cwd());
  const storyFilePath = path.resolve(root, ...parts);
  const contained = path.relative(root, storyFilePath);
  if (
    !contained ||
    contained.startsWith(`..${path.sep}`) ||
    path.isAbsolute(contained)
  ) {
    return null;
  }
  return {
    storyFilePath,
    storyFileRef: relative,
    storyDir: legacyStoryBank ? parts[1] : null,
    storyKey: legacyStoryBank ? parts[2].slice(0, -3) : parts[3],
    storySourceAuthorityKind: legacyStoryBank
      ? 'legacy_story_bank'
      : 'product_accepted_revision',
    selectionFilename: legacyStoryBank ? parts[2] : parts[6],
    revisionDigest: acceptedRevision ? parts[5] : null,
  };
}

/**
 * Reject link-based authority substitution before reading frozen Story Source
 * bytes. The deployment asset must be one ordinary file whose real path stays
 * inside the same repository root; a hard link is also rejected because its
 * bytes can be mutated through a second filesystem name.
 */
export function assertFrozenOrderStorySourceFile(
  selection: FrozenOrderStorySelection,
  options: { repoRoot?: string } = {},
): void {
  try {
    const root = path.resolve(options.repoRoot ?? process.cwd());
    const storyPathParts = selection.storyFileRef.split('/');
    const expected = path.resolve(root, ...storyPathParts);
    if (path.resolve(selection.storyFilePath) !== expected) {
      throw new Error('frozen_story_source_path_mismatch');
    }
    const realRoot = fs.realpathSync.native(root);
    let current = root;
    for (let index = 0; index < storyPathParts.length; index += 1) {
      current = path.join(current, storyPathParts[index]);
      const component = fs.lstatSync(current);
      if (component.isSymbolicLink()) {
        throw new Error('frozen_story_source_path_alias_invalid');
      }
      if (index < storyPathParts.length - 1 && !component.isDirectory()) {
        throw new Error('frozen_story_source_path_component_invalid');
      }
      const realComponent = fs.realpathSync.native(current);
      const expectedRealComponent = path.resolve(
        realRoot,
        ...storyPathParts.slice(0, index + 1),
      );
      if (path.resolve(realComponent) !== expectedRealComponent) {
        throw new Error('frozen_story_source_path_alias_invalid');
      }
    }
    const local = fs.lstatSync(expected);
    if (!local.isFile() || local.isSymbolicLink()) {
      throw new Error('frozen_story_source_not_regular_file');
    }
    const stat = fs.statSync(expected);
    if (stat.nlink !== 1) {
      throw new Error('frozen_story_source_link_count_invalid');
    }
    const realFile = fs.realpathSync.native(expected);
    const relative = path.relative(realRoot, realFile);
    if (
      !relative ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    ) {
      throw new Error('frozen_story_source_realpath_escape');
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('frozen_story_source_')
    ) {
      throw error;
    }
    throw new Error('frozen_story_source_file_unreadable');
  }
}

/**
 * Resolve the package identity carried through the durable pipeline cache.
 * New accepted-revision orders always persist an explicit key. Historical
 * caches retain the basename fallback for backwards-compatible resumes.
 */
export function runtimeStoryKey(cache: StoryRefCache): string | null {
  const explicit = cache.storyKey?.trim();
  const exactRef = cache.storyFilePath ?? cache.devStoryBankFile;
  const parsedRef =
    exactRef && !path.isAbsolute(exactRef)
      ? resolveFrozenOrderStorySelection(exactRef)
      : null;
  const claimsAcceptedRevision =
    storyRefClaimsAcceptedRevisionNamespace(exactRef);

  if (explicit) {
    if (!safeSegment(explicit)) return null;
    if (claimsAcceptedRevision && !parsedRef) return null;
    if (
      cache.selectionFilename?.trim() === 'integrated.md' &&
      parsedRef?.storySourceAuthorityKind !== 'product_accepted_revision'
    ) {
      return null;
    }
    if (parsedRef && parsedRef.storyKey !== explicit) return null;
    if (
      cache.storySourceAuthorityKind &&
      parsedRef &&
      parsedRef.storySourceAuthorityKind !== cache.storySourceAuthorityKind
    ) {
      return null;
    }
    if (
      cache.storySourceAuthorityKind === 'product_accepted_revision' &&
      parsedRef?.storySourceAuthorityKind !== 'product_accepted_revision'
    ) {
      return null;
    }
    return explicit;
  }

  if (exactRef && !path.isAbsolute(exactRef)) {
    if (parsedRef) return parsedRef.storyKey;
  }

  const name = cache.selectionFilename?.trim();
  if (!name || name.includes('/') || name.includes('\\')) return null;
  const key = name.replace(/\.md$/i, '');
  if (key === 'integrated') return null;
  return safeSegment(key) ? key : null;
}
