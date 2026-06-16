import path from 'path';

import type { PageLocationPlan } from '../story-location-bible/types';
import type { SceneMemory } from '../scene-memory/types';
import {
  isBlanketFact,
  isFortFormPrimaryFact,
  pageHasStatefulExpectation,
} from '../scene-memory/fact-compare';
import { pageAllowsIsolatedObjectRef } from '../story-location-bible/zone-sheets';

export function isStateCriticalIsolatedRefPath(refPath: string): boolean {
  const base = path.basename(refPath).toLowerCase();
  return /pillow-cave|pillow\.cave|blanket-fold|blanket\.fold/.test(base);
}

export function filterStateCriticalIsolatedPaths(paths: string[]): string[] {
  return paths.filter(isStateCriticalIsolatedRefPath);
}

/** State page → child + companion + state-object-ref + style (board yields its slot). */
export function pageNeedsStateObjectRef(args: {
  pageNumber?: number | null;
  pageLocationPlan?: PageLocationPlan | null;
  sceneMemory?: SceneMemory | null;
  isolatedObjectPaths?: string[];
}): boolean {
  const page = args.pageNumber ?? args.pageLocationPlan?.page ?? 0;
  const statePaths = filterStateCriticalIsolatedPaths(args.isolatedObjectPaths ?? []);
  if (
    statePaths.length > 0 &&
    args.pageLocationPlan &&
    pageAllowsIsolatedObjectRef(args.pageLocationPlan)
  ) {
    return true;
  }

  const memory = args.sceneMemory;
  if (!memory || page <= 0) return false;

  for (const factId of Object.keys(memory.statefulObjects)) {
    if (!pageHasStatefulExpectation(memory, factId, page)) continue;
    if (isFortFormPrimaryFact(factId) || isBlanketFact(factId)) return true;
  }
  return false;
}
