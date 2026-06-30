import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';

export const STORY_PRODUCT_CONTRACT_VERSION = 'story-product/v1';

export interface FrozenStoryProductTruth {
  expectedPageCount: number;
  storySourceHash: string;
  selectionFilename: string;
  frozenProductVersion: string;
}

function repoRelativeStoryRef(storyFilePath: string): string {
  const root = path.resolve(process.cwd());
  const absolute = path.resolve(storyFilePath);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`story_source_outside_repo:${storyFilePath}`);
  }
  return relative.split(path.sep).join('/');
}

/**
 * Freeze the exact story source selected for this order. The hash is over the source file bytes, while the
 * personalized page text is independently bound by the readiness Manifest. No package-stage live resolver exists.
 */
export function buildFrozenStoryProductTruth(args: {
  storyFilePath: string;
  expectedPageCount: number;
  storyDirection: string;
}): FrozenStoryProductTruth {
  if (!Number.isInteger(args.expectedPageCount) || args.expectedPageCount <= 0) {
    throw new Error(`invalid_frozen_expected_page_count:${args.expectedPageCount}`);
  }
  const direction = args.storyDirection.trim().toLowerCase();
  if (!direction) throw new Error('frozen_story_direction_missing');

  const source = readFileSync(path.resolve(args.storyFilePath));
  return {
    expectedPageCount: args.expectedPageCount,
    storySourceHash: createHash('sha256').update(source).digest('hex'),
    selectionFilename: repoRelativeStoryRef(args.storyFilePath),
    frozenProductVersion: `${STORY_PRODUCT_CONTRACT_VERSION}:${direction}`,
  };
}
