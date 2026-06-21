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
