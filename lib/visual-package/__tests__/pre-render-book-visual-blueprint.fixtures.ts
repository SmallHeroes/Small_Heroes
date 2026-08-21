import {
  PRE_RENDER_BLUEPRINT_COORDINATE_SPACE,
  PRE_RENDER_BLUEPRINT_PORTRAIT_ASPECT_RATIO,
  PRE_RENDER_BOOK_VISUAL_BLUEPRINT_VERSION,
  VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION,
  buildPreRenderBlueprintAuthoringAuthority,
  buildPreRenderBlueprintIdentity,
  finalizePreRenderBookVisualBlueprint,
  type BlueprintAffordanceConsumer,
  type BlueprintFramePlacement,
  type BlueprintSpatialAffordance,
  type BlueprintWorldConnection,
  type PortraitBlueprintFrame,
  type PreRenderBlueprintStyleAuthority,
  type PreRenderBlueprintValidationContext,
  type PreRenderBookVisualBlueprint,
  type VisualContractCandidateArtifact,
  type RevealSafeSupportingGeometry,
} from '@/lib/visual-package';
import {
  VISUAL_CONTRACT_SCHEMA_VERSION,
  projectCoverMustNotShow,
  projectPageMustNotShow,
  projectPageMustShow,
  projectZoneStableGeometry,
  type BookVisualContractTemplate,
} from '@/lib/visual-contract-compiler';
import {
  ACTION_SEMANTIC_COVERAGE_VERSION,
  type ActionSemanticCoverageRecord,
} from '@/lib/visual-contract-compiler/actionSemanticCoverage';
import type {
  BookVisualContract,
  PageTransition,
  PageVisualContract,
  VisualLocation,
  VisualZone,
} from '@/lib/visual-contract-compiler/types';
import {
  parseStorySourceContent,
  type ParsedStorySourceContent,
} from '@/lib/visual-contract-compiler/storySourceContent';
import {
  canonicalJsonDigest,
  normalizedTextDigest,
} from '@/lib/visual-package/integrity';
import {
  STORY_SOURCE_IDENTITY_VERSION,
  type StorySourceIdentity,
  type VisualPackageTemplateIdentity,
} from '@/lib/visual-package/types';
import {
  buildSourcePromptReconciliationDraft,
  type SourcePromptReconciliation,
} from '@/lib/visual-package/sourcePromptReconciliation';

export type BlueprintFixtureShape =
  | 'single_location'
  | 'multi_zone_transition'
  | 'journey_fantastical'
  | 'no_companion'
  | 'reveal_timeline'
  | 'wizard_runtime_qualification';

export interface BlueprintFixtureOptions {
  storyKey?: string;
  /** Override the synthetic source/page count while preserving the selected fixture shape. */
  pageCount?: number;
  mutateTemplate?: (template: BookVisualContractTemplate) => void;
  mutateReconciliation?: (
    reconciliation: SourcePromptReconciliation,
    template: BookVisualContractTemplate,
  ) => void;
  mutateWorld?: (args: {
    template: BookVisualContractTemplate;
    connections: BlueprintWorldConnection[];
    affordances: BlueprintSpatialAffordance[];
    revealSafeSupportingGeometry: RevealSafeSupportingGeometry[];
    frames: PortraitBlueprintFrame[];
  }) => void;
  rawStorySource?: string;
  sourcePath?: string;
  styleId?: string;
  styleContent?: unknown;
}

export interface BlueprintFixture {
  blueprint: PreRenderBookVisualBlueprint;
  context: PreRenderBlueprintValidationContext;
}

export function buildVisualContractCandidateFixture(args: {
  fixture: BlueprintFixture;
  sourceSnapshotDigest: string;
}): VisualContractCandidateArtifact {
  const coverage = structuredClone(
    args.fixture.context.actionSemanticCoverage,
  );
  const payload = {
    version: VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION,
    sourceSnapshotDigest: args.sourceSnapshotDigest,
    authoringRequestDigest: '1'.repeat(64),
    authoringReceiptDigest: '2'.repeat(64),
    templateDigest: canonicalJsonDigest(args.fixture.context.template),
    actionSemanticCatalogVersion: 'fixture-catalog',
    actionSemanticCatalogDigest: '3'.repeat(64),
    actionSemanticCoverageVersion: ACTION_SEMANTIC_COVERAGE_VERSION,
    actionSemanticCoverageDigest: canonicalJsonDigest(coverage),
    sourceEvidenceCatalogVersion: 'fixture-source-evidence',
    sourceEvidenceCatalogDigest: '4'.repeat(64),
    template: structuredClone(args.fixture.context.template),
    actionSemanticCoverage: coverage,
    status: 'candidate',
    doesNotAuthorize: ['fixture-only'],
  } as unknown as Omit<
    VisualContractCandidateArtifact,
    'digestAlgorithm' | 'digest'
  >;
  return {
    ...payload,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(payload),
  };
}

interface ShapePlan {
  storyKey: string;
  worldType: string;
  zoneIds: string[];
  locationIds: string[];
  pageZoneIds: string[];
  companion: boolean;
  revealPage?: number;
}

const shapePlans: Record<BlueprintFixtureShape, ShapePlan> = {
  single_location: {
    storyKey: 'fixture_single_location',
    worldType: 'grounded_home',
    zoneIds: ['zone:home'],
    locationIds: ['location:home'],
    pageZoneIds: ['zone:home'],
    companion: true,
  },
  multi_zone_transition: {
    storyKey: 'fixture_multi_zone',
    worldType: 'grounded_school',
    zoneIds: ['zone:hall', 'zone:room'],
    locationIds: ['location:school', 'location:school'],
    pageZoneIds: ['zone:hall', 'zone:room'],
    companion: true,
  },
  journey_fantastical: {
    storyKey: 'fixture_fantastical_journey',
    worldType: 'fantastical_journey',
    zoneIds: ['zone:forest', 'zone:bridge', 'zone:castle'],
    locationIds: ['location:forest', 'location:bridge', 'location:castle'],
    pageZoneIds: ['zone:forest', 'zone:bridge', 'zone:castle'],
    companion: true,
  },
  no_companion: {
    storyKey: 'fixture_no_companion',
    worldType: 'grounded_garden',
    zoneIds: ['zone:garden'],
    locationIds: ['location:garden'],
    pageZoneIds: ['zone:garden', 'zone:garden'],
    companion: false,
  },
  reveal_timeline: {
    storyKey: 'fixture_reveal_timeline',
    worldType: 'grounded_workshop',
    zoneIds: ['zone:workshop'],
    locationIds: ['location:workshop'],
    pageZoneIds: ['zone:workshop', 'zone:workshop', 'zone:workshop'],
    companion: true,
    revealPage: 2,
  },
  wizard_runtime_qualification: {
    storyKey: 'bunny_ometz_adventure',
    worldType: 'grounded_medical_clinic',
    zoneIds: ['zone:clinic'],
    locationIds: ['location:clinic'],
    pageZoneIds: Array.from({ length: 12 }, () => 'zone:clinic'),
    companion: true,
  },
};

function transitionForPage(plan: ShapePlan, pageIndex: number): PageTransition {
  const currentZone = plan.pageZoneIds[pageIndex];
  const previousZone = pageIndex > 0 ? plan.pageZoneIds[pageIndex - 1] : null;
  if (!previousZone || previousZone === currentZone) return { kind: 'steady' };
  return {
    kind: 'after_transition',
    fromZoneId: previousZone,
    toZoneId: currentZone,
    cue: `the journey moves from ${previousZone} to ${currentZone}`,
  };
}

function makeLocations(plan: ShapePlan): VisualLocation[] {
  const unique = [...new Set(plan.locationIds)];
  return unique.map((locationId) => ({
    id: locationId,
    name: `Location ${locationId}`,
    description: `Stable authored setting for ${locationId}`,
    environmentClass: locationId.includes('forest') || locationId.includes('bridge')
      ? 'outdoor'
      : 'indoor',
    timeOfDay: 'day',
    lighting: 'stable authored daylight',
    anchors: [
      { id: 'anchor:focus', description: 'the stable focal point' },
      { id: 'anchor:support', description: 'the stable support surface' },
      { id: 'anchor:boundary', description: 'the authored safe boundary' },
    ],
  }));
}

function makeZones(plan: ShapePlan): VisualZone[] {
  return plan.zoneIds.map((zoneId, index) => {
    const zone: VisualZone = {
      id: zoneId,
      locationId: plan.locationIds[index],
      name: `Zone ${zoneId}`,
      description: `Stable authored zone ${zoneId}`,
      spatialNodes: [
        { id: 'floor', kind: 'floor', description: 'a stable clear floor plane' },
        { id: 'boundary', kind: 'railing', description: 'a stable child-safe boundary' },
        ...(plan.revealPage
          ? [
              {
                id: 'future_support',
                kind: 'furniture' as const,
                description: 'a plain fixed low platform integrated into the set',
              },
            ]
          : []),
      ],
    };
    zone.stableGeometry = projectZoneStableGeometry(zone);
    return zone;
  });
}

function makeTemplate(plan: ShapePlan): BookVisualContractTemplate {
  const childId = 'child:hero';
  const companionId = 'companion:guide';
  const template: BookVisualContractTemplate = {
    contractKind: 'template',
    schemaVersion: VISUAL_CONTRACT_SCHEMA_VERSION,
    version: 1,
    storyKey: plan.storyKey,
    worldType: plan.worldType,
    locations: makeLocations(plan),
    zones: makeZones(plan),
    cast: {
      child: {
        id: childId,
        role: 'child',
        wardrobe: { description: 'the same practical story outfit on every page' },
      },
      ...(plan.companion
        ? {
            companion: {
              id: companionId,
              role: 'companion' as const,
              wardrobe: { description: 'the same simple companion accessory on every page' },
            },
          }
        : {}),
    },
    humanCast: [],
    recurringProps: plan.revealPage
      ? [
          {
            id: 'prop:hidden_keepsake',
            name: 'Hidden keepsake',
            description: 'one small keepsake with a stable shape',
            firstRevealPage: plan.revealPage,
          },
        ]
      : [],
    forbiddenGlobalElements: [],
    coverContract: {
      worldType: plan.worldType,
      locationId: plan.locationIds[0],
      zoneId: plan.pageZoneIds[0],
      castIds: [childId, ...(plan.companion ? [companionId] : [])],
      mustShow: ['the opening promise of the exact story world'],
      mustNotShow: [],
    },
    pageContracts: [],
  };

  template.pageContracts = plan.pageZoneIds.map((zoneId, pageIndex) => {
    const pageNumber = pageIndex + 1;
    const requiredProp = plan.revealPage !== undefined && pageNumber === plan.revealPage;
    const forbiddenProp = plan.revealPage !== undefined && pageNumber < plan.revealPage;
    const page: PageVisualContract = {
      pageNumber,
      locationId: template.zones.find((zone) => zone.id === zoneId)!.locationId,
      zoneId,
      mustShow: [`authored narrative beat ${pageNumber}`],
      mustNotShow: [],
      characterPresence: { child: true, companion: plan.companion },
      castIds: [childId, ...(plan.companion ? [companionId] : [])],
      propState: [],
      camera: 'wide authored story frame',
      transition: transitionForPage(plan, pageIndex),
      ...(requiredProp || forbiddenProp
        ? {
            propConstraints: [
              {
                propId: 'prop:hidden_keepsake',
                visibility: requiredProp ? 'required' as const : 'forbidden' as const,
                ...(requiredProp ? { anchorId: 'anchor:support' } : {}),
              },
            ],
          }
        : {}),
      actionRequirements: [
        {
          checkId: `action:page_${pageNumber}_look`,
          subject: {
            kind: 'entity',
            entity: { kind: 'cast', id: childId },
          },
          predicate: 'looks_at',
          object: { kind: 'anchor', id: 'anchor:focus' },
          polarity: 'must',
        },
      ],
      safetyConstraints: [
        {
          subjectId: childId,
          relation: 'must_not_pass_beyond',
          target: { kind: 'anchor', id: 'anchor:boundary' },
          origin: {
            kind: 'policy_default',
            policyId: 'fixture-child-safe-boundary',
            version: 'v1',
          },
        },
      ],
    };
    return page;
  });

  const projectionContract = template as unknown as BookVisualContract;
  template.coverContract.mustNotShow.push(...projectCoverMustNotShow(projectionContract));
  for (const page of template.pageContracts) {
    page.mustShow.push(...projectPageMustShow(page, projectionContract));
    page.mustNotShow.push(...projectPageMustNotShow(page, projectionContract));
  }
  return template;
}

function makeRawStorySource(plan: ShapePlan): string {
  return [
    '---',
    `title: "${plan.storyKey}"`,
    `pages: ${plan.pageZoneIds.length}`,
    '---',
    '',
    ...plan.pageZoneIds.flatMap((_, index) => [
      `--- Page ${index + 1} ---`,
      `authored source page ${index + 1} contains enough narrative detail for deterministic authority testing`,
      '',
    ]),
  ].join('\n');
}

function makeSource(
  plan: ShapePlan,
  rawStorySource: string,
  sourcePath?: string,
): StorySourceIdentity {
  const pageNumbers = plan.pageZoneIds.map((_, index) => index + 1);
  return {
    version: STORY_SOURCE_IDENTITY_VERSION,
    path: sourcePath ?? `fixtures/${plan.storyKey}.md`,
    digestAlgorithm: 'sha256-normalized-utf8',
    digest: normalizedTextDigest(rawStorySource),
    pageCount: pageNumbers.length,
    pageNumbers,
  };
}

function makeReconciliation(
  plan: ShapePlan,
  source: StorySourceIdentity,
  template: BookVisualContractTemplate,
  sourceContent?: ParsedStorySourceContent,
): SourcePromptReconciliation {
  const pages = sourceContent?.pages ?? source.pageNumbers.map((pageNumber) => ({
      pageNumber,
      text: `authored source page ${pageNumber}`,
    }));
  const reconciliation = buildSourcePromptReconciliationDraft(
    {
      storyKey: plan.storyKey,
      sourceIdentity: source,
      pages,
      ...(sourceContent?.pageImageDirections
        ? { pageImageDirections: sourceContent.pageImageDirections }
        : {}),
      actionSemanticCoverage: makeActionSemanticCoverage(template),
    },
    template,
  );
  reconciliation.review = {
    status: 'approved',
    reviewedBy: 'Fixture Reviewer',
    reviewedAt: '2026-07-25T10:00:00.000Z',
  };
  for (const frame of reconciliation.frames) {
    const pageIndex =
      frame.frameKind === 'page'
        ? template.pageContracts.findIndex(
            (page) => page.pageNumber === frame.pageNumber,
          )
        : -1;
    for (const [requirementIndex, requirement] of frame.sourceRequirements.entries()) {
      const isHistoricalDirection =
        requirement.sourceKind === 'historical_image_direction';
      const path = isHistoricalDirection
        ? `/pageContracts/${pageIndex}/camera`
        : frame.frameKind === 'cover'
          ? '/coverContract/mustShow/0'
          : `/pageContracts/${pageIndex}/mustShow/0`;
      const value = isHistoricalDirection
        ? template.pageContracts[pageIndex].camera
        : frame.frameKind === 'cover'
          ? template.coverContract.mustShow[0]
          : template.pageContracts[pageIndex].mustShow[0];
      requirement.visualBeats = [
        {
          id: `beat:${frame.frameKind}:${frame.pageNumber}:${requirementIndex}`,
          description: `Reviewed visual meaning for ${frame.frameKind} ${frame.pageNumber}`,
          aspects: isHistoricalDirection ? ['camera'] : ['narrative_meaning'],
          disposition: 'preserved',
          contractEvidence: [{ path, value }],
          justification: null,
          supersessionReview: null,
        },
      ];
    }
  }
  return reconciliation;
}

function makeActionSemanticCoverage(
  template: BookVisualContractTemplate,
): ActionSemanticCoverageRecord[] {
  return template.pageContracts.flatMap<ActionSemanticCoverageRecord>((page) => {
    const actions = page.actionRequirements ?? [];
    if (actions.length === 0) {
      return [{
        version: ACTION_SEMANTIC_COVERAGE_VERSION,
        pageNumber: page.pageNumber,
        beatId: `beat:p${page.pageNumber}:fixture_non_visual`,
        sourceEvidenceId: `se1_${String(page.pageNumber).padStart(64, '0')}`,
        sourcePhrase: `fixture source evidence for page ${page.pageNumber}`,
        disposition: {
          kind: 'non_visual' as const,
          rationale: 'narrative_context' as const,
        },
        reviewState: 'unreviewed' as const,
      }];
    }
    return actions.map((action, actionIndex) => {
      const subject = action.subject as unknown as Record<string, unknown>;
      const sourceEvidenceId =
        subject.kind === 'source_phenomenon' &&
        typeof subject.sourceEvidenceId === 'string'
          ? subject.sourceEvidenceId
          : `se1_${String(page.pageNumber * 100 + actionIndex).padStart(64, '0')}`;
      const sourcePhrase =
        subject.kind === 'source_phenomenon' &&
        typeof subject.sourcePhrase === 'string'
          ? subject.sourcePhrase
          : `fixture source evidence for page ${page.pageNumber} action ${actionIndex}`;
      return {
        version: ACTION_SEMANTIC_COVERAGE_VERSION,
        pageNumber: page.pageNumber,
        beatId: `beat:p${page.pageNumber}:fixture_action_${actionIndex}`,
        sourceEvidenceId,
        sourcePhrase,
        disposition: {
          kind: 'action_requirement' as const,
          checkId: action.checkId,
        },
        reviewState: 'unreviewed' as const,
      };
    });
  });
}

function cameraAffordance(frameId: string, zoneId: string): BlueprintSpatialAffordance {
  return {
    id: `affordance:camera:${frameId}`,
    kind: 'camera_access',
    zoneId,
    footprint: { x: 0, y: 850, width: 120, height: 120 },
    visibleRegion: { x: 0, y: 250, width: 1000, height: 750 },
    consumers: [{ kind: 'frame', frameId }],
  };
}

function framePlacements(castIds: string[], pageNumber: number | null, requiredProp: boolean): BlueprintFramePlacement[] {
  const placements: BlueprintFramePlacement[] = castIds.map((castId, index) => ({
    id: `placement:${pageNumber ?? 'cover'}:cast:${index}`,
    subject: { kind: 'cast', castId },
    region: { x: 100 + index * 190, y: 420, width: 150, height: 220 },
    depth: index === 0 ? 'midground' : 'foreground',
    importance: 'key',
  }));
  if (pageNumber !== null) {
    placements.push({
      id: `placement:${pageNumber}:action`,
      subject: { kind: 'action', checkId: `action:page_${pageNumber}_look` },
      region: { x: 80, y: 360, width: 430, height: 320 },
      depth: 'midground',
      importance: 'key',
    });
  }
  if (requiredProp && pageNumber !== null) {
    placements.push({
      id: `placement:${pageNumber}:required-prop`,
      subject: { kind: 'prop', propId: 'prop:hidden_keepsake' },
      region: { x: 560, y: 580, width: 110, height: 100 },
      depth: 'foreground',
      importance: 'key',
    });
  }
  return placements;
}

function makeWorldAndFrames(
  plan: ShapePlan,
  template: BookVisualContractTemplate,
): {
  connections: BlueprintWorldConnection[];
  affordances: BlueprintSpatialAffordance[];
  revealSafeSupportingGeometry: RevealSafeSupportingGeometry[];
  frames: PortraitBlueprintFrame[];
} {
  const connections: BlueprintWorldConnection[] = [];
  const affordances: BlueprintSpatialAffordance[] = [];
  const revealSafeSupportingGeometry: RevealSafeSupportingGeometry[] = plan.revealPage
    ? [
        {
          id: 'geometry:future-support',
          zoneId: plan.pageZoneIds[0],
          spatialNodeId: 'future_support',
          supportsPropIds: ['prop:hidden_keepsake'],
          spoilerNeutral: true,
        },
      ]
    : [];
  const castIds = [
    template.cast.child.id,
    ...(template.cast.companion ? [template.cast.companion.id] : []),
  ];

  const coverId = 'frame:cover';
  affordances.push(cameraAffordance(coverId, plan.pageZoneIds[0]));
  const coverPlacements = framePlacements(castIds, null, false);
  if (plan.revealPage) {
    coverPlacements.push({
      id: 'placement:cover:neutral-support',
      subject: { kind: 'supporting_geometry', geometryId: 'geometry:future-support' },
      region: { x: 560, y: 580, width: 110, height: 100 },
      depth: 'background',
      importance: 'supporting',
    });
  }
  const frames: PortraitBlueprintFrame[] = [
    {
      id: coverId,
      kind: 'cover',
      aspectRatio: { ...PRE_RENDER_BLUEPRINT_PORTRAIT_ASPECT_RATIO },
      coordinateSpace: PRE_RENDER_BLUEPRINT_COORDINATE_SPACE,
      narrative: { purpose: 'cover_promise', summary: 'A spoiler-free promise of the story world' },
      locationId: template.coverContract.locationId,
      zoneId: template.coverContract.zoneId!,
      castIds,
      propLifecycle: {
        requiredPropIds: [],
        forbiddenPropIds: plan.revealPage ? ['prop:hidden_keepsake'] : [],
      },
      placements: coverPlacements,
      camera: {
        shot: 'wide',
        angle: 'eye_level',
        affordanceId: `affordance:camera:${coverId}`,
      },
      textSafeRegion: { x: 0, y: 0, width: 1000, height: 250 },
      affordanceIds: [`affordance:camera:${coverId}`],
      continuity: {
        previousFrameId: null,
        transitionKind: 'steady',
        carryoverRefs: castIds.map((id) => ({ kind: 'cast' as const, id })),
      },
    },
  ];

  template.pageContracts.forEach((page, pageIndex) => {
    const frameId = `frame:page:${page.pageNumber}`;
    const requiredProp =
      page.propConstraints?.some(
        (constraint) =>
          constraint.propId === 'prop:hidden_keepsake' && constraint.visibility === 'required',
      ) ?? false;
    const forbiddenProp =
      page.propConstraints?.some(
        (constraint) =>
          constraint.propId === 'prop:hidden_keepsake' && constraint.visibility === 'forbidden',
      ) ?? false;
    const placements = framePlacements(castIds, page.pageNumber, requiredProp);
    if (forbiddenProp) {
      placements.push({
        id: `placement:${page.pageNumber}:neutral-support`,
        subject: { kind: 'supporting_geometry', geometryId: 'geometry:future-support' },
        region: { x: 560, y: 580, width: 110, height: 100 },
        depth: 'background',
        importance: 'supporting',
      });
    }

    const camera = cameraAffordance(frameId, page.zoneId!);
    const actionId = `affordance:action:${page.pageNumber}`;
    const safetyId = `affordance:safety:${page.pageNumber}`;
    const actionConsumer: BlueprintAffordanceConsumer = {
      kind: 'action',
      pageNumber: page.pageNumber,
      checkId: `action:page_${page.pageNumber}_look`,
    };
    const safetyConsumer: BlueprintAffordanceConsumer = {
      kind: 'safety',
      pageNumber: page.pageNumber,
      subjectId: 'child:hero',
      relation: 'must_not_pass_beyond',
      target: { kind: 'anchor', id: 'anchor:boundary' },
    };
    affordances.push(
      camera,
      {
        id: actionId,
        kind: 'action_space',
        zoneId: page.zoneId!,
        footprint: { x: 40, y: 320, width: 520, height: 420 },
        supportedPredicates: ['looks_at'],
        supportedSubjectKinds: ['cast'],
        supportedEntities: [
          { kind: 'cast', id: 'child:hero' },
          { kind: 'anchor', id: 'anchor:focus' },
        ],
        supportedSpatialDirections: [],
        supportedSpatialRelations: [],
        supportedSpatialConstraintRelations: [],
        spatialTargetRegions: [],
        maximumActors: 2,
        consumers: [actionConsumer],
      },
      {
        id: safetyId,
        kind: 'safe_boundary',
        zoneId: page.zoneId!,
        footprint: { x: 800, y: 250, width: 80, height: 700 },
        target: { kind: 'anchor', id: 'anchor:boundary' },
        permittedRegion: { x: 0, y: 250, width: 800, height: 750 },
        consumers: [safetyConsumer],
      },
    );

    const frameAffordanceIds = [camera.id, actionId, safetyId];
    if (requiredProp) {
      const supportId = `affordance:placement:${page.pageNumber}:hidden-keepsake`;
      affordances.push({
        id: supportId,
        kind: 'placement_support',
        zoneId: page.zoneId!,
        footprint: { x: 520, y: 530, width: 220, height: 220 },
        support: { kind: 'anchor', id: 'anchor:support' },
        supportedEntities: [{ kind: 'prop', id: 'prop:hidden_keepsake' }],
        maximumOccupants: 1,
        consumers: [
          {
            kind: 'placement',
            pageNumber: page.pageNumber,
            propId: 'prop:hidden_keepsake',
          },
        ],
      });
      frameAffordanceIds.push(supportId);
    }

    let connectionId: string | undefined;
    if (page.transition?.kind !== 'steady') {
      connectionId = `connection:${page.transition!.fromZoneId}:${page.transition!.toZoneId}`;
      const traversalId = `affordance:traversal:${page.pageNumber}`;
      const openingId = `affordance:opening:${page.pageNumber}`;
      const transitionConsumer: BlueprintAffordanceConsumer = {
        kind: 'transition',
        pageNumber: page.pageNumber,
      };
      affordances.push(
        {
          id: traversalId,
          kind: 'traversal',
          zoneId: page.zoneId!,
          footprint: { x: 60, y: 340, width: 520, height: 430 },
          connectionId,
          direction: 'forward',
          minimumClearance: 180,
          consumers: [transitionConsumer],
        },
        {
          id: openingId,
          kind: 'opening_clearance',
          zoneId: page.zoneId!,
          footprint: { x: 760, y: 300, width: 180, height: 500 },
          clearanceRegion: { x: 760, y: 300, width: 180, height: 500 },
          connectionId,
          consumers: [transitionConsumer],
        },
      );
      connections.push({
        id: connectionId,
        kind: 'threshold',
        from: { zoneId: page.transition!.fromZoneId! },
        to: { zoneId: page.transition!.toZoneId! },
        bidirectional: false,
        traversalAffordanceIds: [traversalId],
        openingClearanceAffordanceIds: [openingId],
        safeBoundaryAffordanceIds: [safetyId],
      });
      frameAffordanceIds.push(traversalId, openingId);
    }

    frames.push({
      id: frameId,
      kind: 'page',
      pageNumber: page.pageNumber,
      aspectRatio: { ...PRE_RENDER_BLUEPRINT_PORTRAIT_ASPECT_RATIO },
      coordinateSpace: PRE_RENDER_BLUEPRINT_COORDINATE_SPACE,
      narrative: {
        purpose: requiredProp ? 'reveal' : connectionId ? 'transition' : 'advance_action',
        summary: requiredProp
          ? 'The keepsake is now revealed through the child’s deliberate action'
          : `The child advances authored beat ${page.pageNumber} without revealing future objects`,
      },
      locationId: page.locationId,
      zoneId: page.zoneId!,
      castIds,
      propLifecycle: {
        requiredPropIds: requiredProp ? ['prop:hidden_keepsake'] : [],
        forbiddenPropIds: forbiddenProp ? ['prop:hidden_keepsake'] : [],
      },
      placements,
      camera: {
        shot: connectionId ? 'tracking' : 'wide',
        angle: 'eye_level',
        affordanceId: camera.id,
      },
      textSafeRegion: { x: 0, y: 750, width: 1000, height: 250 },
      affordanceIds: frameAffordanceIds,
      continuity: {
        previousFrameId: pageIndex === 0 ? 'frame:cover' : `frame:page:${page.pageNumber - 1}`,
        transitionKind: page.transition?.kind ?? 'steady',
        ...(connectionId ? { connectionId } : {}),
        carryoverRefs: [
          ...castIds.map((id) => ({ kind: 'cast' as const, id })),
          ...(requiredProp ? [{ kind: 'prop' as const, id: 'prop:hidden_keepsake' }] : []),
        ],
      },
    });
  });

  return { connections, affordances, revealSafeSupportingGeometry, frames };
}

export function buildBlueprintFixture(
  shape: BlueprintFixtureShape,
  options?: BlueprintFixtureOptions,
): BlueprintFixture {
  const selectedPlan = options?.storyKey
    ? { ...shapePlans[shape], storyKey: options.storyKey }
    : shapePlans[shape];
  const requestedPageCount = options?.pageCount ?? selectedPlan.pageZoneIds.length;
  if (!Number.isInteger(requestedPageCount) || requestedPageCount < 1) {
    throw new Error('Blueprint fixture pageCount must be a positive integer');
  }
  const fallbackZoneId = selectedPlan.pageZoneIds[selectedPlan.pageZoneIds.length - 1]!;
  const plan: ShapePlan = {
    ...selectedPlan,
    pageZoneIds: Array.from(
      { length: requestedPageCount },
      (_, index) => selectedPlan.pageZoneIds[index] ?? fallbackZoneId,
    ),
  };
  const template = makeTemplate(plan);
  options?.mutateTemplate?.(template);
  const rawStorySource = options?.rawStorySource ?? makeRawStorySource(plan);
  const parsedStorySource = parseStorySourceContent(rawStorySource);
  const source = makeSource(plan, rawStorySource, options?.sourcePath);
  const templateIdentity: VisualPackageTemplateIdentity = {
    artifactPath: `fixtures/${plan.storyKey}.visual-contract-template.json`,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(template),
    schemaVersion: template.schemaVersion,
  };
  const reconciliation = makeReconciliation(
    plan,
    source,
    template,
    parsedStorySource,
  );
  options?.mutateReconciliation?.(reconciliation, template);
  const reconciliationArtifactPath =
    `fixtures/${plan.storyKey}.visual-contract-reconciliation.json`;
  const styleId = options?.styleId ?? 'fixture_storybook_style';
  const styleContent = options?.styleContent ?? {
    styleId,
    renderingContract: 'stable fixture storybook rendering contract',
  };
  const style: PreRenderBlueprintStyleAuthority = {
    styleId,
    artifactPath: `fixtures/styles/${styleId}.json`,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(styleContent),
  };
  const authoringAuthority = buildPreRenderBlueprintAuthoringAuthority({
    storyKey: plan.storyKey,
    source,
    template: templateIdentity,
    reconciliation,
    reconciliationArtifactPath,
    style,
  });
  const world = makeWorldAndFrames(plan, template);
  options?.mutateWorld?.({ template, ...world });
  const blueprint = finalizePreRenderBookVisualBlueprint({
    version: PRE_RENDER_BOOK_VISUAL_BLUEPRINT_VERSION,
    identity: buildPreRenderBlueprintIdentity({ authority: authoringAuthority }),
    visualContract: template,
    worldPlan: {
      connections: world.connections,
      affordances: world.affordances,
      revealSafeSupportingGeometry: world.revealSafeSupportingGeometry,
    },
    frames: world.frames,
  });
  return {
    blueprint,
    context: {
      source,
      rawStorySource,
      template,
      templateIdentity,
      reconciliation,
      reconciliationArtifactPath,
      actionSemanticCoverage:
        reconciliation.actionSemanticCoverageAuthority.records,
      style,
      styleContent,
    },
  };
}
