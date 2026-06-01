import type { Style01CompositionSpec, Style01SubjectScale } from './style01-gptimage';
import {
  BEAR_CUB_DOBI_COMPOSITION_BY_PAGE,
  compositionAssumesChildPresent,
} from './style01-gptimage';
import { DRAGON_DINI_COMPOSITION_BY_PAGE } from './dragon-dini-style01-blocks';

export type ChildScaleCatalogEntry = {
  companionId: string;
  pageNumber: number;
  subjectScale: Style01SubjectScale;
  shotType: string;
  allowSmallChildForEstablishing?: boolean;
  childAssumedPresent: boolean;
};

export type ChildScaleViolation = ChildScaleCatalogEntry & {
  reason: string;
};

export function findChildScaleViolations(
  entries: ChildScaleCatalogEntry[]
): ChildScaleViolation[] {
  const violations: ChildScaleViolation[] = [];
  for (const entry of entries) {
    if (!entry.childAssumedPresent) continue;
    if (entry.subjectScale !== 'small') continue;
    if (entry.allowSmallChildForEstablishing) continue;
    violations.push({
      ...entry,
      reason:
        'Child assumed present but subjectScale=small without allowSmallChildForEstablishing — identity drift risk',
    });
  }
  return violations;
}

export function listAllStyle01CompositionCatalogEntries(): ChildScaleCatalogEntry[] {
  const out: ChildScaleCatalogEntry[] = [];

  const addCatalog = (companionId: string, byPage: Record<number, Style01CompositionSpec>) => {
    for (const [pageStr, spec] of Object.entries(byPage)) {
      const pageNumber = Number.parseInt(pageStr, 10);
      out.push({
        companionId,
        pageNumber,
        subjectScale: spec.subjectScale ?? 'medium',
        shotType: spec.shotType,
        allowSmallChildForEstablishing: spec.allowSmallChildForEstablishing,
        childAssumedPresent: compositionAssumesChildPresent(spec),
      });
    }
  };

  addCatalog('dragon_dini', DRAGON_DINI_COMPOSITION_BY_PAGE);
  addCatalog('bear_cub_gahal', BEAR_CUB_DOBI_COMPOSITION_BY_PAGE);

  return out;
}

/** Dev report — logs violations; does not throw unless `strict` is true. */
export function reportStyle01ChildScaleViolations(options?: {
  strict?: boolean;
  log?: (line: string) => void;
}): ChildScaleViolation[] {
  const log = options?.log ?? console.warn;
  const violations = findChildScaleViolations(listAllStyle01CompositionCatalogEntries());
  if (violations.length === 0) {
    log('[style01-child-scale] OK — no small-scale child-present pages without establishing flag');
    return [];
  }
  log(
    `[style01-child-scale] ${violations.length} page(s) may drift child identity (small scale, child present):`
  );
  for (const v of violations) {
    log(`  - ${v.companionId} p${v.pageNumber}: ${v.shotType} (${v.reason})`);
  }
  if (options?.strict) {
    throw new Error(
      `Style 01 child-scale violations: ${violations.map((v) => `${v.companionId}:p${v.pageNumber}`).join(', ')}`
    );
  }
  return violations;
}
