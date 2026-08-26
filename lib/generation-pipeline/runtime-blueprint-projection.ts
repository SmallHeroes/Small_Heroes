import type { ShotVisualDirection } from '@/backend/providers/pipeline';
import type { PageEntityPresenceContract } from '@/lib/image-entity-presence';
import type { StoryTimeOfDay } from '@/lib/story-time-of-day';
import {
  contractPageEnvironmentClass,
  contractPageSupportingCharacters,
  contractToLocationPlanBundle,
} from '@/lib/visual-contract-compiler/adapters';
import { buildPvbVisualContractFactsPromptBlock } from '@/lib/visual-contract-compiler/buildVisualContractPromptBlock';
import {
  assertProviderPromptHasNoInternalSpatialMarkers,
  projectPageProviderPromptProse,
  projectProviderSafeSpatialProse,
} from '@/lib/visual-contract-compiler/projectContractProse';
import type {
  ApprovedPvbRuntimeAuthorityBinding,
  ResolvedBookVisualContract,
} from '@/lib/visual-contract-compiler/contractTemplateTypes';
import {
  deriveCoverVisualContract,
  derivePageVisualContracts,
  type ResolvedPageContract,
} from '@/lib/visual-contract-compiler/derivePageVisualContracts';
import { effectivePropVisibility } from '@/lib/visual-contract-compiler/propLifecycle';
import { computeVisualContractHash } from '@/lib/visual-contract-compiler/contractHash';
import { resolvePageLocationPlan } from '@/lib/story-location-bible/resolvePageLocationPlan';
import { canonicalJsonDigest } from '@/lib/visual-package/integrity';
import type { PortraitBlueprintFrame } from '@/lib/visual-package/preRenderBlueprintTypes';
import type {
  FrozenVisualPackageAuthority,
  VisualPackageV4,
} from '@/lib/visual-package/visualPackageV4';
import {
  buildApprovedPvbRuntimeAuthorityBinding,
  runtimeWorldProjectionDigest,
} from '@/lib/visual-package/runtimeAuthority';

export const RUNTIME_BLUEPRINT_BOOK_PROJECTION_VERSION =
  'runtime-blueprint-book-projection/v5' as const;
export const RUNTIME_BLUEPRINT_FRAME_PROJECTION_VERSION =
  'runtime-blueprint-frame-projection/v5' as const;
export const RUNTIME_BLUEPRINT_FRAME_EVIDENCE_VERSION =
  'runtime-blueprint-frame-evidence/v5' as const;

export interface RuntimeBlueprintReferenceIdentities {
  boards: VisualPackageV4['requiredBoards'];
  props: VisualPackageV4['requiredPropReferences'];
}

export interface RuntimeBlueprintFrameProjection {
  version: typeof RUNTIME_BLUEPRINT_FRAME_PROJECTION_VERSION;
  packageRevisionDigest: string;
  packagePath: string;
  sourcePath: string;
  sourceDigest: string;
  sourceRawDigest: string;
  blueprintDigest: string;
  authoringAuthorityDigest: string;
  planningApprovalDigest: string;
  styleAuthorityDigest: string;
  frameId: string;
  frameDigest: string;
  pageNumber: number;
  kind: PortraitBlueprintFrame['kind'];
  locationId: string;
  zoneId: string;
  castIds: string[];
  requiredPropIds: string[];
  forbiddenPropIds: string[];
  narrative: PortraitBlueprintFrame['narrative'];
  camera: PortraitBlueprintFrame['camera'];
  placements: PortraitBlueprintFrame['placements'];
  worldGeometry: VisualPackageV4['blueprint']['content']['worldPlan']['revealSafeSupportingGeometry'];
  affordances: VisualPackageV4['blueprint']['content']['worldPlan']['affordances'];
  connections: VisualPackageV4['blueprint']['content']['worldPlan']['connections'];
  continuity: PortraitBlueprintFrame['continuity'];
  layoutPlan: {
    aspectRatio: '2:3';
    coordinateSpace: 'portrait-normalized-1000';
    textZone: 'top_clear' | 'bottom_clear';
    textSafeRegion: PortraitBlueprintFrame['textSafeRegion'];
    remapPolicy: 'reject';
  };
  references: RuntimeBlueprintReferenceIdentities;
  resolvedAppearanceDigest: string;
  resolvedAppearance: {
    child: ResolvedBookVisualContract['cast']['child'];
    companion: ResolvedBookVisualContract['cast']['companion'];
    humans: ResolvedBookVisualContract['humanCast'];
  };
  /** Exact page-resolved child wardrobe, including an explicit page override when authored. */
  resolvedChildWardrobe: ResolvedPageContract['childWardrobe'];
  /** Exact carried-forward typed companion state; absent for legacy/non-visible companions. */
  resolvedCompanionState?: NonNullable<
    ResolvedPageContract['resolvedCompanionState']
  >;
  contractPage: ResolvedPageContract;
  contractPromptBlock: string;
  blueprintPromptBlock: string;
  safeScenePrompt: string;
  visualDirection: ShotVisualDirection;
  entityPresence: PageEntityPresenceContract;
  supportingCharacters: ReturnType<typeof contractPageSupportingCharacters>;
  expectedCharacterNames: string[];
  contractStyleRefEnvironment: 'indoor' | 'outdoor' | 'neutral';
  locationBible: ReturnType<typeof contractToLocationPlanBundle>['bible'];
  pageLocationPlan: NonNullable<ReturnType<typeof resolvePageLocationPlan>>;
  timeOfDay: StoryTimeOfDay;
  digestAlgorithm: 'canonical-json-sha256';
  projectionDigest: string;
}

export interface RuntimeBlueprintBookProjection {
  version: typeof RUNTIME_BLUEPRINT_BOOK_PROJECTION_VERSION;
  packageRevisionDigest: string;
  packagePath: string;
  sourceDigest: string;
  sourceRawDigest: string;
  blueprintDigest: string;
  planningApprovalDigest: string;
  styleAuthorityDigest: string;
  resolvedContractHash: string;
  resolvedAppearanceDigest: string;
  frames: RuntimeBlueprintFrameProjection[];
  digestAlgorithm: 'canonical-json-sha256';
  projectionDigest: string;
}

/**
 * Compact, immutable render evidence that can be copied into receipts, QA evidence,
 * and provider results without duplicating the full projection/prompt payload.
 */
export interface RuntimeBlueprintFrameEvidence {
  version: typeof RUNTIME_BLUEPRINT_FRAME_EVIDENCE_VERSION;
  packagePath: string;
  packageRevisionDigest: string;
  sourcePath: string;
  sourceDigest: string;
  sourceRawDigest: string;
  blueprintDigest: string;
  authoringAuthorityDigest: string;
  planningApprovalDigest: string;
  styleAuthorityDigest: string;
  resolvedContractHash: string;
  resolvedAppearanceDigest: string;
  bookProjectionDigest: string;
  frameId: string;
  frameDigest: string;
  frameProjectionDigest: string;
  pageNumber: number;
  layoutPolicy: {
    aspectRatio: '2:3';
    textZone: 'top_clear' | 'bottom_clear';
    remapPolicy: 'reject';
  };
}

function invalid(message: string): never {
  throw new Error(`[runtime_blueprint_projection] ${message}`);
}

function framePageNumber(frame: PortraitBlueprintFrame): number {
  return frame.kind === 'cover' ? 0 : frame.pageNumber;
}

function projectWithoutDigest(
  value: Omit<
    RuntimeBlueprintFrameProjection,
    'digestAlgorithm' | 'projectionDigest'
  >,
): RuntimeBlueprintFrameProjection {
  return {
    ...value,
    digestAlgorithm: 'canonical-json-sha256',
    projectionDigest: canonicalJsonDigest(value),
  };
}

function supportingCharactersFor(
  contract: ResolvedBookVisualContract,
  castIds: readonly string[],
): RuntimeBlueprintFrameProjection['supportingCharacters'] {
  return contract.humanCast
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
      ]
        .filter(Boolean)
        .join('; '),
    }));
}

function expectedNames(
  contract: ResolvedBookVisualContract,
  castIds: readonly string[],
): string[] {
  return castIds.map((castId) => {
    if (castId === contract.cast.child.id) {
      return contract.cast.child.name ?? 'the child';
    }
    if (castId === contract.cast.companion?.id) {
      return contract.cast.companion.name ?? 'the companion';
    }
    return (
      contract.humanCast.find((member) => member.id === castId)?.role ?? castId
    );
  });
}

function relevantReferences(args: {
  packageValue: VisualPackageV4;
  locationId: string;
  requiredPropIds: readonly string[];
}): RuntimeBlueprintReferenceIdentities {
  const location = args.packageValue.visualContractTemplate.content.locations.find(
    (entry) => entry.id === args.locationId,
  );
  const setIdentityId = location?.setIdentityId ?? location?.id;
  return {
    boards: setIdentityId
      ? args.packageValue.requiredBoards.filter(
          (entry) => entry.setIdentityId === setIdentityId,
        )
      : [],
    props: args.packageValue.requiredPropReferences.filter((entry) =>
      args.requiredPropIds.includes(entry.propId),
    ),
  };
}

function buildBlueprintPromptBlock(args: {
  packageValue: VisualPackageV4;
  frame: PortraitBlueprintFrame;
  providerNarrative: PortraitBlueprintFrame['narrative'];
  contract: ResolvedBookVisualContract;
  contractPage: ResolvedPageContract;
  resolvedAppearanceDigest: string;
}): string {
  const { packageValue, frame, contract } = args;
  const placements = frame.placements.map((placement) => ({
    id: placement.id,
    subject: placement.subject,
    region: placement.region,
    depth: placement.depth,
    importance: placement.importance,
  }));
  const payload = {
    authority: RUNTIME_BLUEPRINT_FRAME_PROJECTION_VERSION,
    packageRevisionDigest: packageValue.revisionDigest,
    blueprintDigest: packageValue.blueprint.digest,
    frameId: frame.id,
    frameDigest: canonicalJsonDigest(frame),
    planningApprovalDigest: packageValue.planningApproval.content.digest,
    styleAuthorityDigest: packageValue.styleAuthority.digest,
    narrative: args.providerNarrative,
    locationId: frame.locationId,
    zoneId: frame.zoneId,
    castIds: frame.castIds,
    requiredPropIds: frame.propLifecycle.requiredPropIds,
    forbiddenPropIds: frame.propLifecycle.forbiddenPropIds,
    actionRequirements: args.contractPage.actionRequirements ?? [],
    camera: frame.camera,
    placements,
    affordanceIds: frame.affordanceIds,
    continuity: frame.continuity,
    textSafeRegion: frame.textSafeRegion,
    resolvedAppearanceDigest: args.resolvedAppearanceDigest,
    childWardrobe: args.contractPage.childWardrobe,
    companionWardrobe: contract.cast.companion?.wardrobe ?? null,
    companionAppearanceState:
      args.contractPage.resolvedCompanionState ?? null,
    humanAppearance: contract.humanCast.map((member) => ({
      id: member.id,
      appearance: member.appearance,
      garments: member.garments,
      forbiddenAppearance: member.forbiddenAppearance,
    })),
  };
  return [
    '[PVB RUNTIME FRAME — SOLE WORLD/COMPOSITION AUTHORITY]',
    JSON.stringify(payload),
    'Render exactly this approved frame. Do not infer or replan camera, placement, action, cast, props, world, transition, or text-safe geometry from any other input.',
  ].join('\n');
}

export function buildRuntimeBlueprintBookProjection(args: {
  packageValue: VisualPackageV4;
  frozenAuthority: FrozenVisualPackageAuthority;
  contract: ResolvedBookVisualContract;
}): RuntimeBlueprintBookProjection {
  const { packageValue, frozenAuthority, contract } = args;
  if (
    packageValue.revisionDigest !== frozenAuthority.packageRevisionDigest ||
    packageValue.blueprint.digest !== frozenAuthority.blueprintDigest
  ) {
    invalid('package and frozen authority disagree');
  }
  const expectedBinding = buildApprovedPvbRuntimeAuthorityBinding({
    packageValue,
    frozen: frozenAuthority,
  });
  if (
    canonicalJsonDigest(contract.approvedRuntimeAuthority) !==
    canonicalJsonDigest(expectedBinding)
  ) {
    invalid('resolved contract is not bound to the exact immutable package');
  }
  if (
    runtimeWorldProjectionDigest(contract) !==
    runtimeWorldProjectionDigest(packageValue.blueprint.content.visualContract)
  ) {
    invalid('resolved contract world projection differs from Blueprint authority');
  }

  const resolvedAppearance = {
    child: contract.cast.child,
    companion: contract.cast.companion,
    humans: contract.humanCast,
  };
  const resolvedAppearanceDigest = canonicalJsonDigest(resolvedAppearance);
  const contractHash = computeVisualContractHash(contract);
  const bundle = contractToLocationPlanBundle(contract);
  const derivedPages = derivePageVisualContracts(contract);

  const frames = packageValue.blueprint.content.frames.map((frame) => {
    const pageNumber = framePageNumber(frame);
    const contractPage =
      pageNumber === 0
        ? deriveCoverVisualContract(contract)
        : derivedPages.find((entry) => entry.pageNumber === pageNumber);
    if (!contractPage) invalid(`frame ${frame.id} has no resolved contract page`);
    if (
      contractPage.locationId !== frame.locationId ||
      contractPage.zoneId !== frame.zoneId ||
      canonicalJsonDigest(contractPage.castIds) !==
        canonicalJsonDigest(frame.castIds)
    ) {
      invalid(`frame ${frame.id} location/zone/cast differs from resolved contract`);
    }
    const location = contract.locations.find(
      (entry) => entry.id === frame.locationId,
    );
    const zone = contract.zones.find(
      (entry) =>
        entry.id === frame.zoneId && entry.locationId === frame.locationId,
    );
    if (!location || !zone) {
      invalid(`frame ${frame.id} location-zone binding is unresolved`);
    }
    const normalizedTime = location.timeOfDay?.trim().toLowerCase();
    if (
      !normalizedTime ||
      !['day', 'night', 'dusk', 'dawn', 'mixed'].includes(normalizedTime)
    ) {
      invalid(`frame ${frame.id} has no supported exact time-of-day`);
    }
    const pageLocationPlan = resolvePageLocationPlan(bundle, pageNumber);
    const environment = contractPageEnvironmentClass(contract, pageNumber);
    if (
      !pageLocationPlan ||
      pageLocationPlan.zoneId !== frame.zoneId ||
      !environment
    ) {
      invalid(`frame ${frame.id} has no exact contract location projection`);
    }
    const requiredPropIds = [...frame.propLifecycle.requiredPropIds];
    const forbiddenPropIds = [...frame.propLifecycle.forbiddenPropIds];
    const recurringObjects = requiredPropIds
      .filter(
        (propId) =>
          effectivePropVisibility(contract, pageNumber, propId) !== 'forbidden',
      )
      .map(
        (propId) =>
          contract.recurringProps.find((prop) => prop.id === propId)?.name ??
          propId,
      );
    const recurringEntities = contract.humanCast
      .filter((member) => frame.castIds.includes(member.id))
      .map((member) => member.role);
    const supportingCharacters =
      pageNumber === 0
        ? supportingCharactersFor(contract, frame.castIds)
        : contractPageSupportingCharacters(contract, pageNumber);
    const geometryIds = new Set(
      frame.placements.flatMap((placement) =>
        placement.subject.kind === 'supporting_geometry'
          ? [placement.subject.geometryId]
          : [],
      ),
    );
    const connectionIds = new Set(
      frame.continuity.connectionId
        ? [frame.continuity.connectionId]
        : [],
    );
    const providerNarrative: PortraitBlueprintFrame['narrative'] = {
      ...frame.narrative,
      summary: projectProviderSafeSpatialProse(
        frame.narrative.summary,
        contractPage,
        contract,
      ),
    };
    const providerProse = projectPageProviderPromptProse(
      contractPage,
      contract,
    );
    const blueprintPromptBlock =
      assertProviderPromptHasNoInternalSpatialMarkers(
        buildBlueprintPromptBlock({
          packageValue,
          frame,
          providerNarrative,
          contract,
          contractPage,
          resolvedAppearanceDigest,
        }),
        'runtime Blueprint prompt block',
      );
    const visualDirection: ShotVisualDirection = {
      locationZone: `${location.name} / ${zone.name}`,
      mainAction: providerNarrative.summary,
      visibleObjects: recurringObjects,
      characterPose: 'exactly as placed by the approved Blueprint frame',
      emotionVisual: frame.narrative.purpose,
      lightingSource: [location.timeOfDay, location.lighting]
        .filter(Boolean)
        .join('; '),
      environmentDetail: zone.description,
      mustInclude: [
        ...requiredPropIds,
        ...frame.castIds,
        ...frame.placements
          .filter((placement) => placement.subject.kind === 'action')
          .map((placement) =>
            placement.subject.kind === 'action'
              ? placement.subject.checkId
              : '',
          ),
      ],
      mustNotInclude: [
        ...forbiddenPropIds,
        ...providerProse.forbiddenGlobalElements,
      ],
      camera: `${frame.camera.shot} ${frame.camera.angle}`,
      composition: `exact normalized placements ${JSON.stringify(
        frame.placements,
      )}`,
    };
    return projectWithoutDigest({
      version: RUNTIME_BLUEPRINT_FRAME_PROJECTION_VERSION,
      packageRevisionDigest: packageValue.revisionDigest,
      packagePath: frozenAuthority.packagePath,
      sourcePath: packageValue.sourceSnapshot.identity.path,
      sourceDigest: packageValue.sourceSnapshot.identity.digest,
      sourceRawDigest: packageValue.sourceSnapshot.rawDigest,
      blueprintDigest: packageValue.blueprint.digest,
      authoringAuthorityDigest:
        packageValue.blueprint.content.identity.authoringAuthority.digest,
      planningApprovalDigest: packageValue.planningApproval.content.digest,
      styleAuthorityDigest: packageValue.styleAuthority.digest,
      frameId: frame.id,
      frameDigest: canonicalJsonDigest(frame),
      pageNumber,
      kind: frame.kind,
      locationId: frame.locationId,
      zoneId: frame.zoneId,
      castIds: [...frame.castIds],
      requiredPropIds,
      forbiddenPropIds,
      narrative: providerNarrative,
      camera: frame.camera,
      placements: frame.placements,
      worldGeometry:
        packageValue.blueprint.content.worldPlan.revealSafeSupportingGeometry.filter(
          (entry) => geometryIds.has(entry.id),
        ),
      affordances:
        packageValue.blueprint.content.worldPlan.affordances.filter((entry) =>
          frame.affordanceIds.includes(entry.id),
        ),
      connections:
        packageValue.blueprint.content.worldPlan.connections.filter((entry) =>
          connectionIds.has(entry.id),
        ),
      continuity: frame.continuity,
      layoutPlan: {
        aspectRatio: '2:3',
        coordinateSpace: 'portrait-normalized-1000',
        textZone: frame.kind === 'cover' ? 'top_clear' : 'bottom_clear',
        textSafeRegion: frame.textSafeRegion,
        remapPolicy: 'reject',
      },
      references: relevantReferences({
        packageValue,
        locationId: frame.locationId,
        requiredPropIds,
      }),
      resolvedAppearanceDigest,
      resolvedAppearance,
      resolvedChildWardrobe: contractPage.childWardrobe,
      ...(contractPage.resolvedCompanionState
        ? {
            resolvedCompanionState: structuredClone(
              contractPage.resolvedCompanionState,
            ),
          }
        : {}),
      contractPage,
      contractPromptBlock: buildPvbVisualContractFactsPromptBlock(
        contractPage,
        contract,
      ),
      blueprintPromptBlock,
      safeScenePrompt: blueprintPromptBlock,
      visualDirection,
      entityPresence: {
        childPresence: frame.castIds.includes(contract.cast.child.id)
          ? 'present'
          : 'absent',
        companionPresence:
          contract.cast.companion &&
          frame.castIds.includes(contract.cast.companion.id)
            ? 'present'
            : 'absent',
        recurringObjects,
        recurringEntities,
        forbiddenEntities: [
          ...new Set([
            ...forbiddenPropIds,
            ...pageLocationPlan.forbiddenDrift,
            ...providerProse.forbiddenGlobalElements,
          ]),
        ],
      },
      supportingCharacters,
      expectedCharacterNames: expectedNames(contract, frame.castIds),
      contractStyleRefEnvironment: environment,
      locationBible: bundle.bible,
      pageLocationPlan,
      timeOfDay: normalizedTime as StoryTimeOfDay,
    });
  });

  const payload = {
    version: RUNTIME_BLUEPRINT_BOOK_PROJECTION_VERSION,
    packageRevisionDigest: packageValue.revisionDigest,
    packagePath: frozenAuthority.packagePath,
    sourceDigest: packageValue.sourceSnapshot.identity.digest,
    sourceRawDigest: packageValue.sourceSnapshot.rawDigest,
    blueprintDigest: packageValue.blueprint.digest,
    planningApprovalDigest: packageValue.planningApproval.content.digest,
    styleAuthorityDigest: packageValue.styleAuthority.digest,
    resolvedContractHash: contractHash,
    resolvedAppearanceDigest,
    frames,
  };
  return {
    ...payload,
    digestAlgorithm: 'canonical-json-sha256',
    projectionDigest: canonicalJsonDigest(payload),
  };
}

export function requireRuntimeBlueprintFrame(
  book: RuntimeBlueprintBookProjection,
  pageNumber: number,
): RuntimeBlueprintFrameProjection {
  const frame = book.frames.find((entry) => entry.pageNumber === pageNumber);
  if (!frame) invalid(`no approved Blueprint frame for page ${pageNumber}`);
  const {
    digestAlgorithm: _digestAlgorithm,
    projectionDigest: _projectionDigest,
    ...payload
  } = frame;
  if (canonicalJsonDigest(payload) !== frame.projectionDigest) {
    invalid(`runtime frame projection changed for page ${pageNumber}`);
  }
  return frame;
}

export function buildRuntimeBlueprintFrameEvidence(
  book: RuntimeBlueprintBookProjection,
  pageNumber: number,
): RuntimeBlueprintFrameEvidence {
  const frame = requireRuntimeBlueprintFrame(book, pageNumber);
  return {
    version: RUNTIME_BLUEPRINT_FRAME_EVIDENCE_VERSION,
    packagePath: frame.packagePath,
    packageRevisionDigest: frame.packageRevisionDigest,
    sourcePath: frame.sourcePath,
    sourceDigest: frame.sourceDigest,
    sourceRawDigest: frame.sourceRawDigest,
    blueprintDigest: frame.blueprintDigest,
    authoringAuthorityDigest: frame.authoringAuthorityDigest,
    planningApprovalDigest: frame.planningApprovalDigest,
    styleAuthorityDigest: frame.styleAuthorityDigest,
    resolvedContractHash: book.resolvedContractHash,
    resolvedAppearanceDigest: frame.resolvedAppearanceDigest,
    bookProjectionDigest: book.projectionDigest,
    frameId: frame.frameId,
    frameDigest: frame.frameDigest,
    frameProjectionDigest: frame.projectionDigest,
    pageNumber: frame.pageNumber,
    layoutPolicy: {
      aspectRatio: frame.layoutPlan.aspectRatio,
      textZone: frame.layoutPlan.textZone,
      remapPolicy: frame.layoutPlan.remapPolicy,
    },
  };
}

export function runtimeBlueprintPackageBinding(
  projection: RuntimeBlueprintBookProjection,
): Pick<
  ApprovedPvbRuntimeAuthorityBinding,
  | 'packageRevisionDigest'
  | 'sourceDigest'
  | 'sourceRawDigest'
  | 'blueprintDigest'
  | 'planningApprovalDigest'
  | 'styleAuthorityDigest'
> {
  return {
    packageRevisionDigest: projection.packageRevisionDigest,
    sourceDigest: projection.sourceDigest,
    sourceRawDigest: projection.sourceRawDigest,
    blueprintDigest: projection.blueprintDigest,
    planningApprovalDigest: projection.planningApprovalDigest,
    styleAuthorityDigest: projection.styleAuthorityDigest,
  };
}
