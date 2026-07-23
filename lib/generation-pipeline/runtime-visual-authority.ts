import type { ShotVisualDirection } from '@/backend/providers/pipeline';
import type { PageEntityPresenceContract } from '@/lib/image-entity-presence';
import type { StoryTimeOfDay } from '@/lib/story-time-of-day';
import { STYLE_IDS, normalizeStyleId } from '@/lib/styles';
import { buildVisualContractPromptBlock } from '@/lib/visual-contract-compiler/buildVisualContractPromptBlock';
import { computeVisualContractHash } from '@/lib/visual-contract-compiler/contractHash';
import { isVisualContractEnforcementEnabled } from '@/lib/visual-contract-compiler/contractRenderGuards';
import {
  contractPageEnvironmentClass,
  contractPageSupportingCharacters,
  contractToLocationPlanBundle,
} from '@/lib/visual-contract-compiler/adapters';
import {
  deriveCoverVisualContract,
  derivePageVisualContracts,
} from '@/lib/visual-contract-compiler/derivePageVisualContracts';
import type { ResolvedPageContract } from '@/lib/visual-contract-compiler/derivePageVisualContracts';
import { effectivePropVisibility } from '@/lib/visual-contract-compiler/propLifecycle';
import { resolvePageLocationPlan } from '@/lib/story-location-bible';
import {
  type ReferenceAsset,
} from '@/lib/set-identity-board/referenceTransport';
import { canonicalJsonDigest } from '@/lib/visual-package/integrity';
import {
  buildApprovedRuntimeAuthorityBinding,
  runtimeWorldAuthorityIssues,
  runtimeWorldProjectionDigest,
} from '@/lib/visual-package/runtimeAuthority';

import type { Style01RuntimeAuthority } from './render-qualification-preflight';
import { resolvePageReferenceAssets } from './page-reference-authority';

export type RuntimeVisualAuthorityErrorCode =
  | 'runtime_authority_missing'
  | 'runtime_authority_invalid'
  | 'runtime_authority_page_missing'
  | 'runtime_authority_board_missing';

export class RuntimeVisualAuthorityBoundaryError extends Error {
  readonly isRuntimeVisualAuthorityBoundaryError = true as const;

  constructor(readonly code: RuntimeVisualAuthorityErrorCode, message: string, readonly pageNumber?: number) {
    super(`[runtime_world_authority:${code}] ${message}`);
    this.name = 'RuntimeVisualAuthorityBoundaryError';
  }
}

export interface RuntimePageAuthorityProjection {
  contractPromptBlock: string;
  contractStyleRefEnvironment: 'indoor' | 'outdoor' | 'neutral';
  locationBible: ReturnType<typeof contractToLocationPlanBundle>['bible'];
  pageLocationPlan: NonNullable<ReturnType<typeof resolvePageLocationPlan>>;
  expectedCharacterIds: string[];
  supportingCharacters: ReturnType<typeof contractPageSupportingCharacters>;
  entityPresence: PageEntityPresenceContract;
  setIdentityBoardRefs?: ReferenceAsset[];
  visualDirection: ShotVisualDirection;
  safeScenePrompt: string;
  page: ResolvedPageContract;
  childCast: Style01RuntimeAuthority['contract']['cast']['child'];
  companionCast?: NonNullable<Style01RuntimeAuthority['contract']['cast']['companion']>;
  expectedCharacterNames: string[];
  timeOfDay: StoryTimeOfDay;
}

function invalid(message: string, pageNumber?: number): never {
  throw new RuntimeVisualAuthorityBoundaryError('runtime_authority_invalid', message, pageNumber);
}

/** Structural second fence at the shared provider seam; the filesystem preflight remains the freshness authority. */
export function assertStyle01RuntimeAuthorityForPage(args: {
  illustrationStyle?: string | null;
  authority?: Style01RuntimeAuthority | null;
  pageNumber: number;
}): Style01RuntimeAuthority | null {
  if (!isVisualContractEnforcementEnabled()) return null;
  if (normalizeStyleId(args.illustrationStyle) !== STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK) return null;

  const authority = args.authority;
  if (!authority || authority.version !== 'style01-runtime-authority/v3') {
    throw new RuntimeVisualAuthorityBoundaryError(
      'runtime_authority_missing',
      'enforced Style01 provider call has no preflight-issued authority context',
      args.pageNumber,
    );
  }
  const { qualification, contract, packageBinding } = authority;
  if (
    !qualification.renderQualified ||
    !qualification.manifest ||
    !qualification.template ||
    qualification.reasons.length > 0
  ) {
    invalid('authority context does not contain a clean qualified package', args.pageNumber);
  }
  if (computeVisualContractHash(contract) !== authority.contractHash) {
    invalid('authority contract hash changed after preflight', args.pageNumber);
  }
  const expectedBinding = buildApprovedRuntimeAuthorityBinding(qualification.manifest);
  if (
    canonicalJsonDigest(packageBinding) !== canonicalJsonDigest(expectedBinding) ||
    canonicalJsonDigest(contract.approvedRuntimeAuthority) !== canonicalJsonDigest(expectedBinding)
  ) {
    invalid('authority context is not bound to its exact approved package', args.pageNumber);
  }
  if (runtimeWorldProjectionDigest(contract) !== runtimeWorldProjectionDigest(qualification.template)) {
    invalid('resolved physical-world projection differs from the approved template', args.pageNumber);
  }
  const worldIssues = runtimeWorldAuthorityIssues(qualification.template, packageBinding.worldMode);
  if (worldIssues.length > 0) {
    invalid(`approved world authority is incomplete: ${worldIssues.map((entry) => entry.code).join(', ')}`, args.pageNumber);
  }
  const approvedBoards = qualification.manifest.requiredBoards;
  if (approvedBoards.length > 0) {
    const boardContext = authority.boardBindings;
    if (!boardContext || boardContext.frozenContractHash !== authority.contractHash) {
      invalid('required Set Identity Board context is missing or pinned to another contract', args.pageNumber);
    }
    const approvedIds = new Set(approvedBoards.map((entry) => entry.setIdentityId));
    const boundIds = Object.keys(boardContext.bindings);
    if (boundIds.length !== approvedIds.size || boundIds.some((id) => !approvedIds.has(id))) {
      invalid('runtime Set Identity Board identity set differs from the approved package', args.pageNumber);
    }
    for (const approved of approvedBoards) {
      const bound = boardContext.bindings[approved.setIdentityId];
      if (
        !bound ||
        bound.setIdentityId !== approved.setIdentityId ||
        bound.setDefinitionHash !== approved.setDefinitionHash ||
        bound.styleId !== approved.styleId ||
        bound.storageKey !== approved.storageKey ||
        bound.assetSha256 !== approved.assetSha256 ||
        bound.boardVersion !== approved.boardVersion ||
        bound.contentPolicyDigest !== approved.contentPolicyDigest ||
        canonicalJsonDigest(bound.declaredPropIds) !== canonicalJsonDigest(approved.declaredPropIds) ||
        bound.approvedAt !== approved.approvedAt ||
        !bound.resolvedUrl?.trim()
      ) {
        invalid(`runtime Set Identity Board binding differs for ${approved.setIdentityId}`, args.pageNumber);
      }
    }
  }
  return authority;
}

function presentationToken(text: string | null | undefined, allowed: readonly string[], fallback: string): string {
  const normalized = (text ?? '').toLowerCase();
  return allowed.find((token) => normalized.includes(token.replace(/_/g, ' '))) ?? fallback;
}

/**
 * Operator notes share the same presentation-only boundary as Director output. Preserve only a closed vocabulary
 * of pose/spacing/framing instructions; nouns, locations, cast, props, and free-form reality prose never survive.
 */
export function constrainRuntimePresentationNote(note: string | null | undefined): string | null {
  const normalized = (note ?? '').toLowerCase();
  if (!normalized.trim()) return null;
  const allowed = [
    'foreground', 'midground', 'background', 'left', 'right', 'center',
    'wide', 'medium', 'close', 'diagonal', 'asymmetric', 'over shoulder',
    'standing', 'seated', 'kneeling', 'reaching', 'leaning', 'walking', 'running',
    'crouching', 'turning', 'apart', 'together', 'near', 'far', 'away',
  ] as const;
  const tokens = [...new Set(allowed.filter((token) => normalized.includes(token)))];
  return tokens.length > 0
    ? `Presentation only: ${tokens.join(', ')}. Keep every contract-authorized world and content fact unchanged.`
    : null;
}

function coverSupportingCharacters(
  authority: Style01RuntimeAuthority,
  castIds: string[],
): RuntimePageAuthorityProjection['supportingCharacters'] {
  return authority.contract.humanCast
    .filter((member) => castIds.includes(member.id))
    .map((member) => ({
      name: member.role,
      relationship: member.role,
      description: [
        member.gender === 'unspecified' ? '' : member.gender,
        member.coarseAppearance,
        member.wardrobe.description,
        member.forbiddenAppearance.length > 0
          ? `must never appear: ${member.forbiddenAppearance.join(', ')}`
          : '',
      ].filter(Boolean).join('; '),
    }));
}

export function buildRuntimePageAuthorityProjection(args: {
  illustrationStyle?: string | null;
  authority?: Style01RuntimeAuthority | null;
  pageNumber: number;
  requestedVisualDirection?: Partial<ShotVisualDirection> | null;
}): RuntimePageAuthorityProjection | null {
  const authority = assertStyle01RuntimeAuthorityForPage(args);
  if (!authority) return null;

  const contract = authority.contract;
  const page = args.pageNumber === 0
    ? deriveCoverVisualContract(contract)
    : derivePageVisualContracts(contract).find((entry) => entry.pageNumber === args.pageNumber);
  if (!page || !page.zoneId || !page.castIds?.length || (args.pageNumber !== 0 && !page.transition)) {
    throw new RuntimeVisualAuthorityBoundaryError(
      'runtime_authority_page_missing',
      'cover/page lacks explicit zone, cast, or transition authority',
      args.pageNumber,
    );
  }
  const location = contract.locations.find((entry) => entry.id === page.locationId);
  const zone = contract.zones.find((entry) => entry.id === page.zoneId && entry.locationId === page.locationId);
  if (!location || !zone) {
    throw new RuntimeVisualAuthorityBoundaryError(
      'runtime_authority_page_missing',
      'cover/page location-zone binding is unresolved',
      args.pageNumber,
    );
  }
  const normalizedTime = location.timeOfDay?.trim().toLowerCase();
  if (!normalizedTime || !['day', 'night', 'dusk', 'dawn', 'mixed'].includes(normalizedTime)) {
    invalid('contract location has no supported explicit time-of-day authority', args.pageNumber);
  }

  const bundle = contractToLocationPlanBundle(contract);
  const pageLocationPlan = resolvePageLocationPlan(bundle, args.pageNumber);
  const environment = contractPageEnvironmentClass(contract, args.pageNumber);
  if (!pageLocationPlan || !environment || pageLocationPlan.zoneId !== page.zoneId) {
    invalid('contract location projection is missing or contradictory', args.pageNumber);
  }

  const requiredBoard = location.setIdentityId ?? location.id;
  const approvedBoard = authority.qualification.manifest?.requiredBoards.find(
    (entry) => entry.setIdentityId === requiredBoard,
  );
  const referenceAssets = resolvePageReferenceAssets({
    repoRoot: authority.repoRoot,
    contract,
    pageNumber: args.pageNumber,
    boardBindings: authority.boardBindings,
    propArtifacts: authority.qualification.manifest?.requiredPropReferences ?? [],
  });
  const boardRef = referenceAssets.find((reference) => reference.kind === 'set');
  if (approvedBoard && !boardRef) {
    throw new RuntimeVisualAuthorityBoundaryError(
      'runtime_authority_board_missing',
      `approved set identity ${requiredBoard} has no exact runtime binding`,
      args.pageNumber,
    );
  }

  const castIds = [...page.castIds];
  const childPresent = castIds.includes(contract.cast.child.id);
  const companionPresent = contract.cast.companion
    ? castIds.includes(contract.cast.companion.id)
    : false;
  const recurringObjects = (page.propState ?? [])
    .filter(
      (state) =>
        effectivePropVisibility(contract, args.pageNumber, state.propId) !== 'forbidden',
    )
    .map((state) =>
      contract.recurringProps.find((prop) => prop.id === state.propId)?.name ?? state.propId
    );
  const recurringEntities = contract.humanCast
    .filter((member) => castIds.includes(member.id))
    .map((member) => member.role);
  const requested = args.requestedVisualDirection;
  const expectedCharacterNames = castIds.map((castId) => {
    if (castId === contract.cast.child.id) return contract.cast.child.name ?? 'the child';
    if (castId === contract.cast.companion?.id) return contract.cast.companion.name ?? 'the companion';
    return contract.humanCast.find((member) => member.id === castId)?.role ?? castId;
  });
  const visualDirection: ShotVisualDirection = {
    locationZone: `${location.name} / ${zone.name}`,
    mainAction: page.camera,
    visibleObjects: [...(page.mustShow ?? []), ...recurringObjects],
    characterPose: presentationToken(requested?.characterPose, ['standing', 'seated', 'kneeling', 'reaching', 'leaning', 'walking', 'running', 'crouching', 'turning'], 'natural staging'),
    emotionVisual: presentationToken(requested?.emotionVisual, ['calm', 'curious', 'joyful', 'brave', 'tender', 'hopeful', 'focused', 'worried', 'surprised'], 'calm'),
    lightingSource: [location.timeOfDay, location.lighting].filter(Boolean).join('; '),
    environmentDetail: zone.description,
    mustInclude: [...(page.mustShow ?? [])],
    mustNotInclude: [...(page.mustNotShow ?? [])],
    camera: page.camera,
    composition: presentationToken(requested?.composition, ['wide', 'medium', 'close', 'diagonal', 'asymmetric', 'over shoulder'], 'contract camera composition'),
  };

  return {
    contractPromptBlock: buildVisualContractPromptBlock(page, contract),
    contractStyleRefEnvironment: environment,
    locationBible: bundle.bible,
    pageLocationPlan,
    expectedCharacterIds: castIds,
    supportingCharacters: args.pageNumber === 0
      ? coverSupportingCharacters(authority, castIds)
      : contractPageSupportingCharacters(contract, args.pageNumber),
    entityPresence: {
      childPresence: childPresent ? 'present' : 'absent',
      companionPresence: companionPresent ? 'present' : 'absent',
      recurringObjects,
      recurringEntities,
      forbiddenEntities: [...new Set([...(page.mustNotShow ?? []), ...contract.forbiddenGlobalElements])],
    },
    ...(referenceAssets.length > 0 ? { setIdentityBoardRefs: referenceAssets } : {}),
    visualDirection,
    safeScenePrompt:
      `Render only the contract-authorized scene and content. ` +
      `Presentation: ${page.camera}. Stage only the contract-authorized cast within the required composition.`,
    page,
    childCast: contract.cast.child,
    ...(contract.cast.companion ? { companionCast: contract.cast.companion } : {}),
    expectedCharacterNames,
    timeOfDay: normalizedTime as StoryTimeOfDay,
  };
}
