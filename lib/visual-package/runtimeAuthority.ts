import {
  APPROVED_RUNTIME_AUTHORITY_VERSION,
  type ApprovedRuntimeAuthorityBinding,
  type BookVisualContractTemplate,
  type ResolvedBookVisualContract,
} from '@/lib/visual-contract-compiler/contractTemplateTypes';
import type { BookVisualContract } from '@/lib/visual-contract-compiler/types';

import { canonicalJsonDigest } from './integrity';
import type {
  VisualPackageIssue,
  VisualPackageManifest,
  WorldRealityMode,
} from './types';

function issue(
  code: VisualPackageIssue['code'],
  message: string,
  extra: Omit<VisualPackageIssue, 'code' | 'message'> = {},
): VisualPackageIssue {
  return { code, message, ...extra };
}

/**
 * Runtime-only completeness layered on the existing shared Template validator. Legacy templates remain readable,
 * while an approved/render-qualified Style01 package must name the exact cover/page zone, cast, and transition.
 * `worldMode` is accepted only as reviewer metadata; this function never infers it from worldType/story/direction.
 */
export function runtimeWorldAuthorityIssues(
  template: BookVisualContractTemplate,
  worldMode: WorldRealityMode | null | undefined,
): VisualPackageIssue[] {
  const issues: VisualPackageIssue[] = [];
  if (!worldMode) {
    issues.push(issue('world_authority_incomplete', 'reviewer-owned worldMode is missing', {
      field: 'review.worldMode',
    }));
  }

  const locationById = new Map(template.locations.map((location) => [location.id, location]));
  const zoneById = new Map(template.zones.map((zone) => [zone.id, zone]));
  const allCastIds = new Set([
    template.cast.child.id,
    ...(template.cast.companion ? [template.cast.companion.id] : []),
    ...template.humanCast.map((member) => member.id),
  ]);
  const referencedLocationIds = new Set([
    template.coverContract.locationId,
    ...template.pageContracts.map((page) => page.locationId),
  ]);
  const allowedTimes = new Set(['day', 'night', 'dusk', 'dawn', 'mixed']);
  for (const locationId of referencedLocationIds) {
    const location = locationById.get(locationId);
    if (!location) continue; // the shared validator/page checks report the unresolved id
    if (!location.environmentClass) {
      issues.push(issue('world_authority_incomplete', `location ${locationId} has no explicit environmentClass`, {
        field: `template.locations.${locationId}.environmentClass`,
      }));
    }
    if (!location.timeOfDay?.trim()) {
      issues.push(issue('world_authority_incomplete', `location ${locationId} has no explicit timeOfDay`, {
        field: `template.locations.${locationId}.timeOfDay`,
      }));
    } else if (!allowedTimes.has(location.timeOfDay.trim().toLowerCase())) {
      issues.push(issue('world_authority_contradictory', `location ${locationId} has unsupported timeOfDay authority`, {
        field: `template.locations.${locationId}.timeOfDay`,
        expected: [...allowedTimes],
        actual: location.timeOfDay,
      }));
    }
    if (!location.lighting?.trim()) {
      issues.push(issue('world_authority_incomplete', `location ${locationId} has no explicit lighting`, {
        field: `template.locations.${locationId}.lighting`,
      }));
    }
  }

  const cover = template.coverContract;
  if (!cover.zoneId) {
    issues.push(issue('world_authority_incomplete', 'coverContract.zoneId is required on the render-qualified path', {
      field: 'template.coverContract.zoneId',
    }));
  } else {
    const zone = zoneById.get(cover.zoneId);
    if (!zone || zone.locationId !== cover.locationId) {
      issues.push(issue('world_authority_contradictory', 'cover zone does not belong to the authoritative cover location', {
        field: 'template.coverContract.zoneId',
        expected: cover.locationId,
        actual: zone?.locationId ?? null,
      }));
    }
  }
  if (!Array.isArray(cover.castIds) || cover.castIds.length === 0) {
    issues.push(issue('world_authority_incomplete', 'coverContract.castIds is required on the render-qualified path', {
      field: 'template.coverContract.castIds',
    }));
  } else if (cover.castIds.some((castId) => !allCastIds.has(castId))) {
    issues.push(issue('world_authority_contradictory', 'coverContract.castIds contains an undeclared cast identity', {
      field: 'template.coverContract.castIds',
      actual: cover.castIds,
    }));
  }
  if (cover.worldType !== template.worldType) {
    issues.push(issue('world_authority_contradictory', 'cover worldType disagrees with the book worldType', {
      field: 'template.coverContract.worldType',
      expected: template.worldType,
      actual: cover.worldType,
    }));
  }

  for (const page of template.pageContracts) {
    const field = `template.pageContracts.${page.pageNumber}`;
    if (!locationById.has(page.locationId)) {
      issues.push(issue('world_authority_contradictory', `page ${page.pageNumber} has no declared location`, {
        field: `${field}.locationId`,
        actual: page.locationId,
      }));
    }
    if (!page.zoneId) {
      issues.push(issue('world_authority_incomplete', `page ${page.pageNumber} has no explicit zoneId`, {
        field: `${field}.zoneId`,
      }));
    } else {
      const zone = zoneById.get(page.zoneId);
      if (!zone || zone.locationId !== page.locationId) {
        issues.push(issue('world_authority_contradictory', `page ${page.pageNumber} zone is outside its location`, {
          field: `${field}.zoneId`,
          expected: page.locationId,
          actual: zone?.locationId ?? null,
        }));
      }
    }
    if (!Array.isArray(page.castIds) || page.castIds.length === 0) {
      issues.push(issue('world_authority_incomplete', `page ${page.pageNumber} has no explicit castIds`, {
        field: `${field}.castIds`,
      }));
    } else if (page.castIds.some((castId) => !allCastIds.has(castId))) {
      issues.push(issue('world_authority_contradictory', `page ${page.pageNumber} contains undeclared castIds`, {
        field: `${field}.castIds`,
        actual: page.castIds,
      }));
    }
    if (!page.transition) {
      issues.push(issue('world_authority_incomplete', `page ${page.pageNumber} has no explicit transition authority`, {
        field: `${field}.transition`,
      }));
    }
  }

  return issues;
}

/** Exact reviewer/package identity that becomes part of the resolved contract and therefore its frozen hash. */
export function buildApprovedRuntimeAuthorityBinding(
  manifest: VisualPackageManifest,
): ApprovedRuntimeAuthorityBinding {
  const worldMode = manifest.review.worldMode;
  if (!worldMode) throw new Error('approved runtime authority requires reviewer-owned worldMode');
  return {
    version: APPROVED_RUNTIME_AUTHORITY_VERSION,
    manifestVersion: manifest.manifestVersion,
    storyKey: manifest.storyKey,
    styleId: manifest.styleId,
    sourcePath: manifest.source.path,
    sourceDigest: manifest.source.digest,
    templatePath: manifest.template.artifactPath,
    templateDigest: manifest.template.digest,
    coverageDigest: canonicalJsonDigest(manifest.coverage),
    requiredBoardsDigest: canonicalJsonDigest(manifest.requiredBoards),
    requiredPropReferencesDigest: canonicalJsonDigest(manifest.requiredPropReferences),
    worldMode,
  };
}

export function bindApprovedRuntimeAuthority(
  contract: ResolvedBookVisualContract,
  manifest: VisualPackageManifest,
): ResolvedBookVisualContract {
  return {
    ...contract,
    approvedRuntimeAuthority: buildApprovedRuntimeAuthorityBinding(manifest),
  };
}

/** Digest of the physical/narrative authority that must survive Template -> Resolved materialization unchanged. */
export function runtimeWorldProjectionDigest(
  contract: Omit<
    Pick<
      BookVisualContract,
      | 'storyKey'
      | 'worldType'
      | 'locations'
      | 'zones'
      | 'cast'
      | 'recurringProps'
      | 'forbiddenGlobalElements'
      | 'coverContract'
      | 'pageContracts'
    >,
    never
  > & {
    humanCast?: Array<{
      id: string;
      role: string;
      aliases: string[];
      gender: string;
      forbiddenAppearance: string[];
      pagesPresent: number[];
      textEvidence: string;
    }>;
  },
): string {
  return canonicalJsonDigest({
    storyKey: contract.storyKey,
    worldType: contract.worldType,
    locations: contract.locations,
    zones: contract.zones,
    cast: contract.cast,
    humanCast: (contract.humanCast ?? []).map((member) => ({
      id: member.id,
      role: member.role,
      aliases: member.aliases,
      gender: member.gender,
      forbiddenAppearance: member.forbiddenAppearance,
      pagesPresent: member.pagesPresent,
      textEvidence: member.textEvidence,
    })),
    recurringProps: contract.recurringProps,
    forbiddenGlobalElements: contract.forbiddenGlobalElements,
    coverContract: contract.coverContract,
    pageContracts: contract.pageContracts,
  });
}
