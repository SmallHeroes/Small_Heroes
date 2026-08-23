/**
 * Style 01 phase-2 prompt assembly — single source of truth for tests + image provider.
 */
import {
  assertCompanionPresenceConsistency,
  childPresenceAllowsReferencePhoto,
  childPresenceAllowsVisualLock,
  derivePageEntityPresence,
  type PageEntityPresenceContract,
} from './image-entity-presence';
import {
  buildStoryTimeOfDayLockBlock,
  resolveEffectivePageTimeOfDay,
  resolveStoryTimeOfDay,
  type StoryTimeOfDay,
} from './story-time-of-day';
import {
  buildStoryStateForbiddenBlock,
  buildStoryStateLockBlocks,
  mergeStoryStateForbidden,
  type PageStoryState,
} from './story-page-state';
import {
  resolveDefaultPageStoryState,
  resolveStoryStateLockBundle,
} from './story-page-state-catalog';
import {
  buildRecurringLocksFromDeclarations,
  type StoryRecurringEntityDeclaration,
} from './story-bank/recurring-entities';
import { buildStructuredObjectCompositionAddendum } from './structured-object-composition';
import { buildResolvedLocationEnvironmentBlock } from './story-location-bible';
import {
  buildIsolatedObjectReferencePromptBlock,
  buildPageActionPromptBlock,
} from './story-location-bible/zone-sheets';
import {
  applyFamilyCoherenceToEntityLocks,
  buildFamilyCoherencePromptBlock,
  type FamilyCoherenceBundle,
} from './family-coherence';
import { buildCompanionAccessoryLockBlock } from './companion-accessory';
import { assertIdentityLockFreeOfClothingWhenWardrobeApplies } from './child-photo-dna-sanitize';
import { resolveStyle01StoryWardrobeLock } from './style01-story-wardrobe';
import {
  assertOverShoulderAllowed,
  resolveStyle01FramingRuleForPageShot,
  shotPlanToCompositionSpec,
  type PageShot,
} from './book-shot-plan';
import {
  buildStyle01BookPagePrompt,
  buildStyle01ChildVisualLock,
  buildStyle01ChildAnatomicalLock,
  buildStyle01CompanionSilhouetteLock,
  buildStyle01CompanionTextLock,
  buildStyle01CompositionBlock,
  compositionAssumesChildPresent,
  buildStyle01EntityPresenceBlock,
  buildStyle01RecurringEntityLocks,
  buildStyle01RecurringObjectLocks,
  buildStyle01WardrobeLock,
  classifyStyle01SceneClass,
  contractEnvironmentToSceneClass,
  isNightEffectiveTime,
  resolveStyle01StoryLocks,
  STYLE_01_FRAMING_RULE,
  type Style01SceneClass,
} from './style01-gptimage';
import {
  buildCompanionSizeVsChildLock,
  buildMentionedCharacterPresenceLock,
  buildMutualGazeInteractionLock,
  buildPageExpressionLock,
  buildReflectionRuleLock,
  buildSmallFrameChildFidelityLock,
  buildStyle01AnatomyIntegrityLock,
  buildStyle01CoverCompositionBlock,
  buildStyle01CoverSceneDescription,
  resolvePageSceneFidelityAddendum,
} from './style01-visual-polish';
import type { RuntimeBlueprintFrameProjection } from './generation-pipeline/runtime-blueprint-projection';
import { canonicalize } from './canonical-json';

const SPATIAL_RELATION_RENDER_RULES = {
  toward:
    'The visible movement must finish closer to the target than it starts.',
  away_from:
    'The visible movement must finish farther from the target than it starts.',
  onto:
    'The visible movement must terminate on top of and visibly overlap the target surface.',
  into:
    'The visible movement path must terminate inside the target region. When the target is a container, entry must pass through its visible opening; never depict the path landing beside or beyond it.',
  beside:
    'The visible movement must terminate beside the target without overlapping it.',
  under:
    'The visible movement must terminate below the target.',
  over:
    'The visible movement must terminate above the target.',
} as const;

function placementRegionForEntity(
  frame: RuntimeBlueprintFrameProjection,
  target: { kind: string; id: string },
) {
  const placement = frame.placements.find((entry) => {
    if (target.kind === 'cast') {
      return entry.subject.kind === 'cast' && entry.subject.castId === target.id;
    }
    if (target.kind === 'prop') {
      return entry.subject.kind === 'prop' && entry.subject.propId === target.id;
    }
    return false;
  });
  return placement?.region ?? null;
}

/**
 * Deterministic provider-facing projection of already validated Blueprint action geometry.
 * It never parses Story Source prose and never invents a target or placement.
 */
export function buildPvbTypedActionGeometryBlock(
  frame: RuntimeBlueprintFrameProjection,
): string {
  const actions: Array<Record<string, unknown>> = [];
  for (const action of frame.contractPage.actionRequirements ?? []) {
      if (!action.spatialEffect) continue;
      const origin = frame.placements.find(
        (entry) =>
          entry.subject.kind === 'action' &&
          entry.subject.checkId === action.checkId,
      );
      const destination = frame.placements.find(
        (entry) =>
          entry.subject.kind === 'action_destination' &&
          entry.subject.checkId === action.checkId,
      );
      if (!origin || !destination) continue;

      if (action.spatialEffect.kind === 'directional') {
        actions.push({
            checkId: action.checkId,
            subject: action.subject,
            predicate: action.predicate,
            spatialEffect: action.spatialEffect,
            originRegion: origin.region,
            destinationRegion: destination.region,
            renderRule: `The visible movement must travel ${action.spatialEffect.direction} from the exact origin region to the exact destination region.`,
          });
        continue;
      }

      const target = action.spatialEffect.target;
      const actionSpace = frame.affordances.find(
        (entry) =>
          entry.kind === 'action_space' &&
          entry.consumers.some(
            (consumer) =>
              consumer.kind === 'action' &&
              consumer.pageNumber === frame.pageNumber &&
              consumer.checkId === action.checkId,
          ),
      );
      const targetRegion =
        placementRegionForEntity(frame, target) ??
        (actionSpace?.kind === 'action_space'
          ? actionSpace.spatialTargetRegions.find(
              (entry) =>
                entry.target.kind === target.kind && entry.target.id === target.id,
            )?.region ?? null
          : null);
      if (!targetRegion) continue;

      actions.push({
          checkId: action.checkId,
          subject: action.subject,
          predicate: action.predicate,
          spatialEffect: action.spatialEffect,
          originRegion: origin.region,
          destinationRegion: destination.region,
          targetRegion,
          renderRule:
            SPATIAL_RELATION_RENDER_RULES[action.spatialEffect.relation],
        });
  }
  if (actions.length === 0) return '';
  return [
    '[PVB TYPED ACTION GEOMETRY — STRUCTURAL AUTHORITY]',
    JSON.stringify(
      canonicalize({
        version: 'pvb-typed-action-geometry/v1',
        coordinateSpace: frame.layoutPlan.coordinateSpace,
        actions,
      }),
    ),
    'These coordinates and relation rules are mandatory. Render one coherent physical event; do not add a contradictory duplicate path, destination, splash, impact, or target.',
  ].join('\n');
}

export type Style01PromptAssemblyInput = {
  pageNumber: number;
  pagePrompt?: string | null;
  rawScenePrompt?: string | null;
  mechanicalScene?: string | null;
  bookPageText?: string | null;
  childFirstName?: string | null;
  childAge?: number | null;
  childGender?: string | null;
  childDescription?: string;
  childStructured?: { face: string; hair: string; body: string; clothing: string; signature: string };
  companion?: { id: string; name: string; visualDescription?: string; image?: string } | null;
  companionStructured?: { species: string; size: string; coloring: string; feature: string };
  /** R1C exact contract presence. When supplied, no story/direction classifier or default state may replace it. */
  authoritativeEntityPresence?: PageEntityPresenceContract;
  /** R1C exact contract wardrobe. Bypasses story-, direction-, companion-, and generic wardrobe fallbacks. */
  authoritativeChildWardrobe?: { description: string; forbidden?: string[] };
  /** R1C exact location time; bypasses text/direction/category time inference. */
  authoritativeTimeOfDay?: StoryTimeOfDay;
  /** PVB-C exact frame. When present, the dedicated branch bypasses every story/page/companion planner and lock. */
  authoritativeBlueprintFrame?: RuntimeBlueprintFrameProjection;
  pageStoryState?: PageStoryState | null;
  useCanonicalChildAnchorRef?: boolean;
  storyRecurringEntityDeclarations?: StoryRecurringEntityDeclaration[];
  compositionStrictRetry?: boolean;
  totalPages?: number;
  /** Once per order — human family visual coherence (parents, newborn sibling). */
  familyCoherence?: FamilyCoherenceBundle | null;
  /** (WS0b e4b) Recurring HUMAN supporting cast present on this page — frozen gender/appearance/wardrobe/drift
   *  guards from the visual contract. Populated only under VISUAL_CONTRACT_STEERING; absent → no block (byte-identical). */
  supportingCharacters?: Array<{ name: string; relationship?: string; description: string }>;
  storyTimeOfDay?: import('./story-time-of-day').StoryTimeOfDay;
  pageTimeOfDayOverrides?: Partial<Record<number, import('./story-time-of-day').StoryTimeOfDay>>;
  timeOfDayStrictRetry?: boolean;
  /** (WS0b location authority) The resolved contract's coarse per-page environment lock (indoor|outdoor|neutral).
   *  PRIMARY authority for sceneClass — preferred over the regex classifier so an indoor/clinic page can NEVER
   *  fall through to the outdoor-nature default. neutral / absent (null/undefined) keeps the regex sceneClass.
   *  Populated only under VISUAL_CONTRACT_STEERING; absent → byte-identical legacy behavior. */
  contractEnvironmentClass?: 'indoor' | 'outdoor' | 'neutral' | null;
  /** Wizard challenge category — drives the story-level SCENARIO SETTING LOCK. */
  challengeCategory?: string | null;
  /** True ONLY when the storyboard explicitly chose a close_up shot; otherwise close-up wording is sanitized out of the scene. */
  explicitCloseUp?: boolean;
  /** Per-book cinematography slot from BookShotPlan (derived or override). */
  pageShot?: PageShot | null;
  /** Per-book location continuity (derived or sidecar). */
  locationBible?: import('./story-location-bible').BookLocationBible | null;
  pageLocationPlan?: import('./story-location-bible').PageLocationPlan | null;
  sceneMemory?: import('./scene-memory/types').SceneMemory | null;
  sceneAppearance?: import('./set-appearance/types').SceneAppearanceMemory | null;
  storyWorldOverride?: string | null;
  /** Path or basename of story bank file (e.g. lion_shaket_bedtime) — drives story-aware wardrobe lock. */
  storyFile?: string | null;
  /** Reserved for future generic night→pajamas routing. */
  direction?: string | null;
  /** Reserved for future generic night→pajamas routing. */
  timeOfDay?: string | null;
  assetType?: 'page' | 'cover';
  storyTitle?: string | null;
  coverText?: string | null;
  topicLabel?: string | null;
  coverSceneHint?: string | null;
};

export type Style01PromptAssemblyResult = {
  prompt: string;
  sceneDescription: string;
  sceneClass: Style01SceneClass;
  entityPresence: PageEntityPresenceContract;
  pageStoryState: PageStoryState | null;
  compositionBlock: string;
  storyTimeOfDay: import('./story-time-of-day').StoryTimeOfDay;
  effectivePageTimeOfDay: import('./story-time-of-day').StoryTimeOfDay;
};

/**
 * Strip close-up language from a scene direction unless the storyboard explicitly
 * chose close_up. v3 imageDirections often say "close-up of ..." decoratively and
 * the model obeys the words over the framing rules — giant cropped faces.
 * Handles ASCII and unicode hyphens (e.g. "close‑up").
 */
const CLOSE_UP_OF_RE = /\b(?:soft\s+|tight\s+|extreme\s+)?close[\s\-\u2010-\u2015]?up\s+(?:of|on)\s+/gi;
const CLOSE_UP_STANDALONE_RE = /\b(?:soft\s+|tight\s+|extreme\s+)?close[\s\-\u2010-\u2015]?up\b/gi;

export function sanitizeCloseUpLanguage(scene: string, explicitCloseUp?: boolean): string {
  if (explicitCloseUp) return scene;
  return scene
    .replace(CLOSE_UP_OF_RE, 'view of ')
    .replace(CLOSE_UP_STANDALONE_RE, 'medium view')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Story-bank imageDirection is authoritative — never collapse on temporal connectors. */
export function resolveStyle01SceneDescription(input: {
  rawScenePrompt?: string | null;
  pagePrompt?: string | null;
  mechanicalScene?: string | null;
}): string {
  const mechanical = (input.mechanicalScene ?? '').trim();
  if (mechanical.length > 0) return mechanical;
  const raw = (input.rawScenePrompt ?? '').trim();
  if (raw.length > 0) return raw;
  return (input.pagePrompt ?? '').trim();
}

export function assembleStyle01Phase2Prompt(
  input: Style01PromptAssemblyInput
): Style01PromptAssemblyResult {
  if (input.authoritativeBlueprintFrame) {
    const frame = input.authoritativeBlueprintFrame;
    const safeNarrativeSummary =
      frame.narrative.summary.trim() || 'Render the exact approved Blueprint frame.';
    const entityPresence = structuredClone(frame.entityPresence);
    const childPresent =
      entityPresence.childPresence === 'present' ||
      entityPresence.childPresence === 'partial' ||
      entityPresence.childPresence === 'background';
    const childVisualLock = childPresent
      ? [
          'PER-ORDER CHILD IDENTITY (identity only; Blueprint owns composition):',
          buildStyle01ChildVisualLock({
            companionId: input.companion?.id,
            childName: input.childFirstName,
            childDescription: input.childDescription,
            childStructured: input.childStructured,
            childAge: input.childAge,
            childGender: input.childGender,
          }),
        ].join('\n')
      : undefined;
    const wardrobeLock = childPresent
      ? [
          'PER-ORDER CHILD WARDROBE (resolved Visual Contract):',
          input.authoritativeChildWardrobe?.description ?? '',
          input.authoritativeChildWardrobe?.forbidden?.length
            ? `NEVER: ${input.authoritativeChildWardrobe.forbidden.join('; ')}`
            : '',
        ].filter(Boolean).join('\n')
      : undefined;
    const canonicalCompanionLock = buildStyle01CompanionTextLock({
      companionId: input.companion?.id,
      companionName: input.companion?.name,
      companionStructured: input.companionStructured,
      companionVisualDescription: input.companion?.visualDescription,
    });
    const canonicalAccessoryLock = buildCompanionAccessoryLockBlock({
      companionId: input.companion?.id,
      companionName: input.companion?.name,
      companionPresence: entityPresence.companionPresence,
    });
    const companionTextLock =
      entityPresence.companionPresence === 'present'
        ? [
            'PER-ORDER COMPANION APPEARANCE (resolved Visual Contract; appearance only):',
            `${input.companion?.name ?? 'the companion'} — ${
              input.companion?.visualDescription ??
              'match the exact resolved companion appearance'
            }.`,
            canonicalCompanionLock,
            canonicalAccessoryLock,
            'Do not add, remove, restyle, resize, substitute, or omit a required canonical accessory.',
          ]
            .filter(Boolean)
            .join('\n\n')
        : entityPresence.companionPresence === 'partial' ||
            entityPresence.companionPresence === 'offscreen_hint'
          ? canonicalAccessoryLock
          : undefined;
    const supportingCharacterLock = frame.supportingCharacters.length
      ? frame.supportingCharacters
          .map(
            (member) =>
              `PER-ORDER HUMAN APPEARANCE — ${member.name}: ${member.description}.`,
          )
          .join('\n')
      : undefined;
    const entityPresenceBlock = buildStyle01EntityPresenceBlock({
      childPresence: entityPresence.childPresence,
      companionPresence: entityPresence.companionPresence,
      forbiddenEntities: entityPresence.forbiddenEntities,
    });
    const typedActionGeometryBlock = buildPvbTypedActionGeometryBlock(frame);
    const compositionBlock = [
      frame.blueprintPromptBlock,
      typedActionGeometryBlock,
    ]
      .filter(Boolean)
      .join('\n\n');
    const framingRule = [
      'PVB FRAMING RULE — immutable approved frame:',
      `Frame ${frame.frameId} (${frame.frameDigest}); camera ${frame.camera.shot}/${frame.camera.angle}.`,
      `Exact normalized placements: ${JSON.stringify(frame.placements)}.`,
      `Text-safe ${frame.layoutPlan.textZone}: ${JSON.stringify(frame.layoutPlan.textSafeRegion)}.`,
      'Do not crop, remap, quantize, or replan this frame.',
    ].join('\n');
    const effectivePageTimeOfDay =
      input.authoritativeTimeOfDay ?? frame.timeOfDay;
    const pageExpressionLock = childPresent
      ? buildPageExpressionLock({
          pageNumber: input.pageNumber,
          companionId: input.companion?.id,
          childPresence: entityPresence.childPresence,
          narrativeSummary: frame.narrative.summary,
          bookPageText: input.bookPageText,
          imageDirection: safeNarrativeSummary,
        })
      : undefined;
    const smallFrameChildFidelityLock = childPresent
      ? buildSmallFrameChildFidelityLock({
          cameraShot: frame.camera.shot,
          childCastId: frame.resolvedAppearance.child.id,
          placements: frame.placements,
        })
      : undefined;
    const prompt = buildStyle01BookPagePrompt({
      sceneDescription: safeNarrativeSummary,
      childVisualLock,
      wardrobeLock,
      companionTextLock,
      supportingCharacterLock,
      environmentLock: [
        `EXACT LOCATION/ZONE: ${frame.locationId} / ${frame.zoneId}.`,
        `EXACT TIME: ${effectivePageTimeOfDay}.`,
        `CONTINUITY: ${JSON.stringify(frame.continuity)}.`,
        `SUPPORTING GEOMETRY: ${JSON.stringify(frame.worldGeometry)}.`,
        `AFFORDANCES: ${JSON.stringify(frame.affordances)}.`,
        `CONNECTIONS: ${JSON.stringify(frame.connections)}.`,
        buildStyle01AnatomyIntegrityLock(),
      ].join('\n\n'),
      compositionBlock,
      entityPresenceBlock,
      useCanonicalChildAnchorRef: input.useCanonicalChildAnchorRef,
      isCover: frame.kind === 'cover',
      framingRule: frame.kind === 'cover' ? undefined : framingRule,
      pageExpressionLock,
      smallFrameChildFidelityLock,
      companionSizeLock: buildCompanionSizeVsChildLock({
        childPresence: entityPresence.childPresence,
        companionPresence: entityPresence.companionPresence,
      }),
    });
    const contractSceneClass =
      input.contractEnvironmentClass != null
        ? contractEnvironmentToSceneClass(
            input.contractEnvironmentClass,
            isNightEffectiveTime(effectivePageTimeOfDay),
          )
        : null;
    const sceneClass =
      contractSceneClass ??
      classifyStyle01SceneClass({
        imagePrompt: frame.safeScenePrompt,
        rawScenePrompt: frame.safeScenePrompt,
        effectivePageTimeOfDay,
      });
    return {
      prompt,
      sceneDescription: safeNarrativeSummary,
      sceneClass,
      entityPresence,
      pageStoryState: null,
      compositionBlock,
      storyTimeOfDay: effectivePageTimeOfDay,
      effectivePageTimeOfDay,
    };
  }
  const storyLocks = resolveStyle01StoryLocks(
    input.companion?.id,
    input.storyRecurringEntityDeclarations
  );
  const pageStoryState = input.authoritativeEntityPresence
    ? null
    : input.pageStoryState ?? resolveDefaultPageStoryState(input.companion?.id, input.pageNumber);

  if (input.pageShot) assertOverShoulderAllowed(input.pageShot);
  const shotPlanSpec = input.pageShot ? shotPlanToCompositionSpec(input.pageShot) : undefined;
  const compositionSpec =
    shotPlanSpec ?? storyLocks.compositionByPage?.[input.pageNumber];
  const explicitCloseUp =
    input.explicitCloseUp === true || input.pageShot?.shot === 'close_up';

  const imageDirection = sanitizeCloseUpLanguage(
    resolveStyle01SceneDescription({
      rawScenePrompt: input.rawScenePrompt,
      pagePrompt: input.pagePrompt,
      mechanicalScene: input.mechanicalScene,
    }),
    explicitCloseUp
  );

  let entityPresence = input.authoritativeEntityPresence
    ? structuredClone(input.authoritativeEntityPresence)
    : derivePageEntityPresence({
        bookPageText: input.bookPageText,
        imageDirection,
        rawScenePrompt: input.rawScenePrompt,
        pagePrompt: input.pagePrompt,
        childFirstName: input.childFirstName,
        companionName: input.companion?.name,
        companionId: input.companion?.id,
        recurringObjectCatalog: storyLocks.recurringObjectCatalog,
        recurringEntityCatalog: storyLocks.recurringEntityCatalog,
      });

  const isCover = input.assetType === 'cover';
  if (
    !input.authoritativeEntityPresence &&
    isCover &&
    (input.childStructured?.face?.trim() || input.childDescription?.trim())
  ) {
    if (entityPresence.childPresence === 'absent') {
      entityPresence = {
        ...entityPresence,
        childPresence: 'present',
        forbiddenEntities: entityPresence.forbiddenEntities.filter(
          (key) =>
            ![
              'human child',
              'young boy',
              'young girl',
              'kid',
              'toddler',
              'human protagonist',
              'realistic child portrait',
            ].includes(key)
        ),
      };
    }
  }

  if (!input.authoritativeEntityPresence && compositionSpec && compositionAssumesChildPresent(compositionSpec)) {
    if (entityPresence.childPresence === 'absent') {
      entityPresence = {
        ...entityPresence,
        childPresence: 'present',
        forbiddenEntities: entityPresence.forbiddenEntities.filter(
          (key) =>
            ![
              'human child',
              'young boy',
              'young girl',
              'kid',
              'toddler',
              'human protagonist',
              'realistic child portrait',
            ].includes(key)
        ),
      };
    }
  }

  assertCompanionPresenceConsistency({
    pageNumber: input.pageNumber,
    imageDirection,
    companionPresence: entityPresence.companionPresence,
    companionName: input.companion?.name,
    companionId: input.companion?.id,
  });

  const stateLockBundle = resolveStoryStateLockBundle(input.companion?.id);
  let objectLocks = '';
  let entityLocks = '';

  if (pageStoryState && stateLockBundle) {
    const stateBlocks = buildStoryStateLockBlocks(pageStoryState, stateLockBundle);
    objectLocks = stateBlocks.objectLocks;
    entityLocks = stateBlocks.entityLocks;
  } else {
    if (entityPresence.recurringObjects.length > 0) {
      objectLocks = buildStyle01RecurringObjectLocks(
        entityPresence.recurringObjects,
        storyLocks.recurringObjectLocks
      );
    }
    if (entityPresence.recurringEntities.length > 0) {
      entityLocks = buildStyle01RecurringEntityLocks(
        entityPresence.recurringEntities,
        storyLocks.recurringEntityLocks
      );
    }
  }

  if (input.storyRecurringEntityDeclarations?.length) {
    const { locks } = buildRecurringLocksFromDeclarations(input.storyRecurringEntityDeclarations);
    const declKeys = [
      ...entityPresence.recurringEntities,
      ...entityPresence.recurringObjects,
    ].filter((k) => locks[k]);
    if (declKeys.length) {
      entityLocks = [entityLocks, buildStyle01RecurringEntityLocks(declKeys, locks)]
        .filter(Boolean)
        .join('\n\n');
    }
  }

  const forbiddenMerged = mergeStoryStateForbidden(
    entityPresence.forbiddenEntities,
    pageStoryState
  );

  const childVisualLock = childPresenceAllowsVisualLock(entityPresence.childPresence)
    ? buildStyle01ChildVisualLock({
        companionId: input.companion?.id,
        childName: input.childFirstName,
        childDescription: input.childDescription,
        childStructured: input.childStructured,
        childAge: input.childAge,
        childGender: input.childGender,
      })
    : undefined;

  // Scene-time-aware wardrobe: resolve THIS page's effective time-of-day (scene-graph override wins)
  // so a daytime flashback page in a bedtime story gets day clothes while night pages get pajamas.
  const storyTimeOfDay: StoryTimeOfDay =
    input.authoritativeTimeOfDay ?? input.storyTimeOfDay ??
    resolveStoryTimeOfDay({
      category: null,
      pages: [{ text: input.bookPageText ?? undefined, imagePrompt: imageDirection }],
    });
  const effectivePageTimeOfDay = input.authoritativeTimeOfDay ?? resolveEffectivePageTimeOfDay({
      storyTimeOfDay,
      pageNumber: input.pageNumber,
      pageTimeOfDayOverrides: input.pageTimeOfDayOverrides,
      imageDirection,
      bookPageText: input.bookPageText,
    });

  const wardrobeLock = childPresenceAllowsVisualLock(entityPresence.childPresence)
    ? input.authoritativeChildWardrobe
      ? [
          'BOOK WARDROBE LOCK (visual-contract authority — never drift):',
          input.authoritativeChildWardrobe.description,
          input.authoritativeChildWardrobe.forbidden?.length
            ? `NEVER: ${input.authoritativeChildWardrobe.forbidden.join('; ')}`
            : '',
        ].filter(Boolean).join('\n')
      : buildStyle01WardrobeLock({
          companionId: input.companion?.id,
          storyFile: input.storyFile,
          direction: input.direction,
          timeOfDay: input.timeOfDay ?? effectivePageTimeOfDay,
          challengeCategory: input.challengeCategory,
          childStructured: input.childStructured,
        })
    : undefined;

  const storyWardrobeLock = input.authoritativeChildWardrobe
    ? null
    : resolveStyle01StoryWardrobeLock(input.companion?.id, input.storyFile, {
        storyTimeOfDay: input.timeOfDay ?? effectivePageTimeOfDay,
        category: input.challengeCategory,
      });
  if (storyWardrobeLock && childVisualLock) {
    assertIdentityLockFreeOfClothingWhenWardrobeApplies({
      identityLockText: [childVisualLock, input.childDescription].filter(Boolean).join('\n'),
      wardrobeLock: storyWardrobeLock,
      childStructured: input.childStructured,
    });
  }

  const childAnatomicalLock = childPresenceAllowsVisualLock(entityPresence.childPresence)
    ? buildStyle01ChildAnatomicalLock({
        companionId: input.companion?.id,
        childAge: input.childAge ?? undefined,
      })
    : undefined;

  const accessoryLock = input.authoritativeEntityPresence
    ? ''
    : buildCompanionAccessoryLockBlock({
        companionId: input.companion?.id,
        companionName: input.companion?.name,
        companionPresence: entityPresence.companionPresence,
      });

  const companionTextLock =
    entityPresence.companionPresence === 'present'
      ? input.authoritativeEntityPresence
        ? [
            `COMPANION LOCK (visual-contract authority): ${input.companion?.name ?? 'the companion'} — ${input.companion?.visualDescription ?? 'exactly as specified by the visual contract'}.`,
            'Do not add, remove, restyle, resize, or substitute this companion.',
          ].join('\n')
        : [
          buildStyle01CompanionTextLock({
            companionId: input.companion?.id,
            companionName: input.companion?.name,
            companionStructured: input.companionStructured,
            companionVisualDescription: input.companion?.visualDescription,
            storyCompanionLock: storyLocks.companionLock,
          }),
          buildStyle01CompanionSilhouetteLock({
            companionId: input.companion?.id,
            companionStructured: input.companionStructured,
            companionVisualDescription: input.companion?.visualDescription,
          }),
          accessoryLock,
        ]
          .filter(Boolean)
          .join('\n\n')
      : entityPresence.companionPresence === 'partial' ||
          entityPresence.companionPresence === 'offscreen_hint'
        ? accessoryLock
        : undefined;

  // (WS0b e4b) Recurring HUMAN supporting-cast lock — frozen gender/appearance/wardrobe from the visual contract,
  // so the contract OUTRANKS a vague imageDirection at render. Populated only under steering (the caller sets the
  // field only when steering is on); absent/empty → no block, so the prompt is byte-identical when off.
  const supportingCharacterLock = input.supportingCharacters?.length
    ? input.supportingCharacters
        .map((sc) =>
          `SUPPORTING CHARACTER LOCK — ${sc.name}${sc.relationship ? ` (${sc.relationship})` : ''}: ${sc.description}. ` +
          `Render this recurring character with protagonist-level consistency: keep gender, facial features, and ` +
          `wardrobe exactly as specified on every page; do not restyle or re-gender.`,
        )
        .join('\n\n')
    : undefined;

  const timeOfDayLock = buildStoryTimeOfDayLockBlock({
    effectiveTimeOfDay: effectivePageTimeOfDay,
    imageDirection,
    strictRetry: input.timeOfDayStrictRetry,
  });
  // Location continuity absorbs scenario-setting-lock — one resolved location truth only.
  const locationEnvironmentBlock = buildResolvedLocationEnvironmentBlock({
    challengeCategory: input.challengeCategory,
    storyWorldOverride: input.storyWorldOverride,
    locationBible: input.locationBible,
    pageLocationPlan: input.pageLocationPlan,
    pageShot: input.pageShot,
    isCover,
    sceneMemory: input.sceneMemory,
    sceneAppearance: input.sceneAppearance,
    imageDirection,
  });
  const pageActionBlock = buildPageActionPromptBlock(input.pageLocationPlan);
  const isolatedObjectRefBlock = buildIsolatedObjectReferencePromptBlock(
    input.pageLocationPlan,
    input.locationBible
  );

  const environmentLock = input.authoritativeEntityPresence
    ? undefined
    : storyLocks.pageEnvironmentLock?.(input.pageNumber);
  const familyRoleDetectInput = {
    bookPageText: input.bookPageText,
    imageDirection,
    rawScenePrompt: input.rawScenePrompt,
    pagePrompt: input.pagePrompt,
    staging: compositionSpec?.staging,
    presentEntityIds: pageStoryState?.presentEntities,
  };
  if (input.familyCoherence) {
    entityLocks = applyFamilyCoherenceToEntityLocks(
      entityLocks,
      input.familyCoherence,
      familyRoleDetectInput
    );
  }
  const familyCoherenceBlock = buildFamilyCoherencePromptBlock(
    input.familyCoherence,
    familyRoleDetectInput
  );
  const structuredObjectBlock = buildStructuredObjectCompositionAddendum({
    imagePrompt: input.pagePrompt ?? undefined,
    bookPageText: input.bookPageText,
    rawScenePrompt: imageDirection,
    staging: compositionSpec?.staging,
    pageNumber: input.pageNumber,
    totalPages: input.totalPages,
    pagePurpose: compositionSpec?.pagePurpose,
    strictRetry: input.compositionStrictRetry,
  });
  const storyStateForbiddenBlock = pageStoryState
    ? buildStoryStateForbiddenBlock(pageStoryState)
    : '';

  const childOnPage =
    entityPresence.childPresence === 'present' ||
    entityPresence.childPresence === 'partial' ||
    entityPresence.childPresence === 'background';

  const compositionBlock = isCover
    ? buildStyle01CoverCompositionBlock()
    : buildStyle01CompositionBlock({
        pageNumber: input.pageNumber,
        imageDirection,
        compositionOverride: shotPlanSpec,
        compositionByPage: input.authoritativeEntityPresence || shotPlanSpec
          ? undefined
          : storyLocks.compositionByPage,
        childOnPage,
      });

  const entityPresenceBlock = buildStyle01EntityPresenceBlock({
    childPresence: entityPresence.childPresence,
    companionPresence: entityPresence.companionPresence,
    forbiddenEntities: forbiddenMerged,
  });

  const pageExpressionLock = isCover
    ? undefined
    : buildPageExpressionLock({
        pageNumber: input.pageNumber,
        companionId: input.companion?.id,
        childPresence: entityPresence.childPresence,
        bookPageText: input.bookPageText,
        imageDirection,
      });
  const mutualGazeLock = isCover
    ? undefined
    : buildMutualGazeInteractionLock({
        bookPageText: input.bookPageText,
        imageDirection,
        childPresence: entityPresence.childPresence,
      });
  const companionSizeLock = buildCompanionSizeVsChildLock({
    childPresence: entityPresence.childPresence,
    companionPresence: entityPresence.companionPresence,
  });
  const anatomyIntegrityLock = buildStyle01AnatomyIntegrityLock();
  const mentionedCharacterLock = isCover
    ? ''
    : buildMentionedCharacterPresenceLock(input.bookPageText);
  const reflectionRuleLock = isCover
    ? ''
    : buildReflectionRuleLock({
        bookPageText: input.bookPageText,
        imageDirection,
      });
  const sceneFidelityAddendum = isCover || input.authoritativeEntityPresence
    ? ''
    : resolvePageSceneFidelityAddendum({
        companionId: input.companion?.id,
        pageNumber: input.pageNumber,
      });

  // Story-bank imageDirection may still mention obsolete clothing; composition staging + wardrobe lock win.
  let sceneDescription = isCover
    ? buildStyle01CoverSceneDescription({
        storyTitle: input.storyTitle,
        coverText: input.coverText,
        topicLabel: input.topicLabel,
        coverSceneHint: input.coverSceneHint ?? imageDirection,
      })
    : input.companion?.id === 'dragon_dini' && compositionSpec?.staging?.trim()
      ? compositionSpec.staging.trim()
      : imageDirection;
  if (sceneFidelityAddendum) {
    sceneDescription = `${sceneFidelityAddendum}\n\n${sceneDescription}`;
  }

  const prompt = buildStyle01BookPagePrompt({
    sceneDescription,
    childVisualLock,
    wardrobeLock,
    childAnatomicalLock,
    companionTextLock,
    supportingCharacterLock,
    recurringObjectLocks: objectLocks || undefined,
    recurringEntityLocks: entityLocks || undefined,
    environmentLock:
      [
        locationEnvironmentBlock,
        environmentLock,
        familyCoherenceBlock,
        structuredObjectBlock,
        storyStateForbiddenBlock,
        timeOfDayLock,
        anatomyIntegrityLock,
        mentionedCharacterLock,
        reflectionRuleLock,
      ]
        .filter(Boolean)
        .join('\n\n') || undefined,
    compositionBlock,
    entityPresenceBlock,
    useCanonicalChildAnchorRef: input.useCanonicalChildAnchorRef,
    pageActionBlock: pageActionBlock ?? undefined,
    isolatedObjectRefBlock: isolatedObjectRefBlock ?? undefined,
    isCover,
    framingRule: isCover
      ? undefined
      : resolveStyle01FramingRuleForPageShot(input.pageShot ?? undefined) ??
        STYLE_01_FRAMING_RULE,
    pageExpressionLock,
    mutualGazeLock,
    companionSizeLock,
  });

  const regexSceneClass = classifyStyle01SceneClass({
    imagePrompt: input.pagePrompt ?? undefined,
    bookPageText: input.bookPageText ?? undefined,
    rawScenePrompt: imageDirection,
    effectivePageTimeOfDay,
  });
  // (WS0b location authority) The resolved contract's environment lock is the PRIMARY authority for sceneClass —
  // an indoor/clinic page must NEVER fall through to the regex's outdoor-nature default. When the contract locks
  // indoor/outdoor we take its (night-aware) class; neutral / absent (null) keeps the regex class (neutral refs
  // are separately zeroed downstream). Flag-gated upstream: without a contract this is null → regex path unchanged.
  const contractSceneClass =
    input.contractEnvironmentClass != null
      ? contractEnvironmentToSceneClass(
          input.contractEnvironmentClass,
          isNightEffectiveTime(effectivePageTimeOfDay),
        )
      : null;
  const sceneClass = contractSceneClass ?? regexSceneClass;

  return {
    prompt,
    sceneDescription,
    sceneClass,
    entityPresence,
    pageStoryState,
    compositionBlock,
    storyTimeOfDay,
    effectivePageTimeOfDay,
  };
}

/** Regression helpers for prompt assertion suite */
export function assertStyle01PromptInvariants(
  prompt: string,
  imageDirection: string,
  pageNumber?: number
): void {
  if (!/FRAMING RULE —/.test(prompt)) {
    throw new Error(
      `Page ${pageNumber ?? '?'} prompt missing FRAMING RULE block`
    );
  }
  if (!/SUBJECT SCALE:\s*(small|medium|large)/.test(prompt)) {
    throw new Error(`Page ${pageNumber ?? '?'} prompt missing SUBJECT SCALE line`);
  }
  const prefix = imageDirection.slice(0, Math.min(50, imageDirection.length)).trim();
  if (prefix.length >= 10 && !prompt.includes(prefix)) {
    throw new Error(
      `Page ${pageNumber ?? '?'} prompt missing imageDirection prefix: "${prefix}"`
    );
  }
}

export { childPresenceAllowsReferencePhoto };
