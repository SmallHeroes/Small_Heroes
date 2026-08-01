import type { ShotVisualDirection } from '@/backend/providers/pipeline';
import type { PageEntityPresenceContract } from '@/lib/image-entity-presence';
import type { StoryTimeOfDay } from '@/lib/story-time-of-day';
import { STYLE_IDS, normalizeStyleId } from '@/lib/styles';
import type { ReferenceAsset } from '@/lib/set-identity-board/referenceTransport';
import { computeVisualContractHash } from '@/lib/visual-contract-compiler/contractHash';
import { isVisualContractEnforcementEnabled } from '@/lib/visual-contract-compiler/contractRenderGuards';
import type { ResolvedPageContract } from '@/lib/visual-contract-compiler/derivePageVisualContracts';
import { canonicalJsonDigest } from '@/lib/visual-package/integrity';
import {
  assertValidVisualPackageV4,
} from '@/lib/visual-package/visualPackageV4';
import {
  buildApprovedPvbRuntimeAuthorityBinding,
} from '@/lib/visual-package/runtimeAuthority';

import type { Style01RuntimeAuthority } from './render-qualification-preflight';
import {
  buildRuntimeBlueprintBookProjection,
  requireRuntimeBlueprintFrame,
  type RuntimeBlueprintFrameProjection,
} from './runtime-blueprint-projection';
import { resolvePageReferenceAssets } from './page-reference-authority';

export type RuntimeVisualAuthorityErrorCode =
  | 'runtime_authority_missing'
  | 'runtime_authority_invalid'
  | 'runtime_authority_page_missing'
  | 'runtime_authority_board_missing';

export class RuntimeVisualAuthorityBoundaryError extends Error {
  readonly isRuntimeVisualAuthorityBoundaryError = true as const;

  constructor(
    readonly code: RuntimeVisualAuthorityErrorCode,
    message: string,
    readonly pageNumber?: number,
  ) {
    super(`[runtime_world_authority:${code}] ${message}`);
    this.name = 'RuntimeVisualAuthorityBoundaryError';
  }
}

export interface RuntimePageAuthorityProjection {
  contractPromptBlock: string;
  blueprintPromptBlock: string;
  contractStyleRefEnvironment: 'indoor' | 'outdoor' | 'neutral';
  locationBible: RuntimeBlueprintFrameProjection['locationBible'];
  pageLocationPlan: RuntimeBlueprintFrameProjection['pageLocationPlan'];
  expectedCharacterIds: string[];
  supportingCharacters: RuntimeBlueprintFrameProjection['supportingCharacters'];
  entityPresence: PageEntityPresenceContract;
  setIdentityBoardRefs?: ReferenceAsset[];
  visualDirection: ShotVisualDirection;
  safeScenePrompt: string;
  page: ResolvedPageContract;
  blueprintFrame: RuntimeBlueprintFrameProjection;
  childCast: Style01RuntimeAuthority['contract']['cast']['child'];
  companionCast?: NonNullable<
    Style01RuntimeAuthority['contract']['cast']['companion']
  >;
  expectedCharacterNames: string[];
  timeOfDay: StoryTimeOfDay;
}

function invalid(message: string, pageNumber?: number): never {
  throw new RuntimeVisualAuthorityBoundaryError(
    'runtime_authority_invalid',
    message,
    pageNumber,
  );
}

/** Structural second fence at the shared provider seam. */
export function assertStyle01RuntimeAuthorityForPage(args: {
  illustrationStyle?: string | null;
  authority?: Style01RuntimeAuthority | null;
  pageNumber: number;
}): Style01RuntimeAuthority | null {
  if (!isVisualContractEnforcementEnabled()) return null;
  if (
    normalizeStyleId(args.illustrationStyle) !==
    STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK
  ) {
    return null;
  }
  const authority = args.authority;
  if (!authority || authority.version !== 'style01-runtime-authority/v5') {
    throw new RuntimeVisualAuthorityBoundaryError(
      'runtime_authority_missing',
      'enforced Style01 provider call has no style01-runtime-authority/v5 preflight-issued authority',
      args.pageNumber,
    );
  }
  try {
    assertValidVisualPackageV4(authority.packageValue);
  } catch (error) {
    invalid(
      `immutable package is invalid: ${
        error instanceof Error ? error.message : String(error)
      }`,
      args.pageNumber,
    );
  }
  if (
    !authority.qualification.renderQualified ||
    authority.qualification.reasons.length > 0 ||
    authority.qualification.packageValue?.revisionDigest !==
      authority.packageValue.revisionDigest ||
    authority.frozenAuthority.packageRevisionDigest !==
      authority.packageValue.revisionDigest
  ) {
    invalid(
      'authority context does not contain one clean immutable package revision',
      args.pageNumber,
    );
  }
  if (
    computeVisualContractHash(authority.contract) !== authority.contractHash
  ) {
    invalid('resolved contract hash changed after preflight', args.pageNumber);
  }
  const expectedBinding = buildApprovedPvbRuntimeAuthorityBinding({
    packageValue: authority.packageValue,
    frozen: authority.frozenAuthority,
  });
  if (
    canonicalJsonDigest(authority.packageBinding) !==
      canonicalJsonDigest(expectedBinding) ||
    canonicalJsonDigest(authority.contract.approvedRuntimeAuthority) !==
      canonicalJsonDigest(expectedBinding)
  ) {
    invalid(
      'resolved contract is not bound to its exact package/Blueprint/approval/style identities',
      args.pageNumber,
    );
  }
  const expectedProjection = buildRuntimeBlueprintBookProjection({
    packageValue: authority.packageValue,
    frozenAuthority: authority.frozenAuthority,
    contract: authority.contract,
  });
  if (
    canonicalJsonDigest(authority.bookProjection) !==
    canonicalJsonDigest(expectedProjection)
  ) {
    invalid('runtime book projection changed after preflight', args.pageNumber);
  }
  try {
    requireRuntimeBlueprintFrame(authority.bookProjection, args.pageNumber);
  } catch (error) {
    invalid(
      error instanceof Error ? error.message : String(error),
      args.pageNumber,
    );
  }
  return authority;
}

/**
 * Retained for enforcement-off development callers. Enforced PVB rendering discards operator/free text entirely.
 */
export function constrainRuntimePresentationNote(
  note: string | null | undefined,
): string | null {
  const normalized = (note ?? '').toLowerCase();
  if (!normalized.trim()) return null;
  const allowed = [
    'foreground',
    'midground',
    'background',
    'left',
    'right',
    'center',
    'wide',
    'medium',
    'close',
    'diagonal',
    'asymmetric',
    'over shoulder',
    'standing',
    'seated',
    'kneeling',
    'reaching',
    'leaning',
    'walking',
    'running',
    'crouching',
    'turning',
    'apart',
    'together',
    'near',
    'far',
    'away',
  ] as const;
  const tokens = [
    ...new Set(allowed.filter((token) => normalized.includes(token))),
  ];
  return tokens.length > 0
    ? `Presentation only: ${tokens.join(', ')}.`
    : null;
}

export function buildRuntimePageAuthorityProjection(args: {
  illustrationStyle?: string | null;
  authority?: Style01RuntimeAuthority | null;
  pageNumber: number;
  requestedVisualDirection?: Partial<ShotVisualDirection> | null;
}): RuntimePageAuthorityProjection | null {
  const authority = assertStyle01RuntimeAuthorityForPage(args);
  if (!authority) return null;
  const frame = requireRuntimeBlueprintFrame(
    authority.bookProjection,
    args.pageNumber,
  );
  const referenceAssets = resolvePageReferenceAssets({
    repoRoot: authority.repoRoot,
    contract: authority.contract,
    pageNumber: args.pageNumber,
    boardBindings: authority.boardBindings,
    propArtifacts: authority.packageValue.requiredPropReferences,
  });
  for (const board of frame.references.boards) {
    if (
      !referenceAssets.some(
        (reference) =>
          reference.kind === 'set' &&
          reference.identityId === board.setIdentityId,
      )
    ) {
      throw new RuntimeVisualAuthorityBoundaryError(
        'runtime_authority_board_missing',
        `approved set identity ${board.setIdentityId} has no exact runtime binding`,
        args.pageNumber,
      );
    }
  }
  return {
    contractPromptBlock: frame.contractPromptBlock,
    blueprintPromptBlock: frame.blueprintPromptBlock,
    contractStyleRefEnvironment: frame.contractStyleRefEnvironment,
    locationBible: frame.locationBible,
    pageLocationPlan: frame.pageLocationPlan,
    expectedCharacterIds: frame.castIds,
    supportingCharacters: frame.supportingCharacters,
    entityPresence: frame.entityPresence,
    ...(referenceAssets.length > 0
      ? { setIdentityBoardRefs: referenceAssets }
      : {}),
    visualDirection: frame.visualDirection,
    safeScenePrompt: frame.safeScenePrompt,
    page: frame.contractPage,
    blueprintFrame: frame,
    childCast: authority.contract.cast.child,
    ...(authority.contract.cast.companion
      ? { companionCast: authority.contract.cast.companion }
      : {}),
    expectedCharacterNames: frame.expectedCharacterNames,
    timeOfDay: frame.timeOfDay,
  };
}
