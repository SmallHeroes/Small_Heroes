import path from 'path';

import { STORY_BANK_V3_DIR_NAME } from '@/backend/providers/story-bank-index';
import type { PipelineCache } from './types';

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
  'devStoryBankFile' | 'storyFilePath' | 'storyDir' | 'selectionFilename'
>;

/**
 * Resolve the absolute story `.md` path from cache. Handles, in order:
 *  - a stored ref (`devStoryBankFile` / `storyFilePath`), relative (new) or absolute (legacy in-flight);
 *  - reconstruction from `{ storyDir, selectionFilename }`.
 * Returns undefined when the cache carries no story reference yet (e.g. before the text stage).
 */
export function resolveCachedStoryFilePath(cache: StoryRefCache): string | undefined {
  const ref = cache.devStoryBankFile ?? cache.storyFilePath;
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
): {
  storyFilePath: string;
  storyFileRef: string;
  storyDir: string;
  selectionFilename: string;
} | null {
  const relative = String(selectionFilename ?? '')
    .trim()
    .replace(/\\/g, '/');
  const parts = relative.split('/');
  if (
    parts.length !== 3 ||
    parts[0] !== 'story-bank' ||
    !parts[1] ||
    !parts[2] ||
    !parts[2].endsWith('.md') ||
    parts.some((part) => part === '.' || part === '..')
  ) {
    return null;
  }
  const root = path.resolve(process.cwd());
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
    storyDir: parts[1],
    selectionFilename: parts[2],
  };
}
