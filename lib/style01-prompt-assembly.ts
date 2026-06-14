/**
 * Style 01 phase-2 prompt assembly — single source of truth for tests + image provider.
 */
import {
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
  buildStyle01AnatomyIntegrityLock,
  buildStyle01CoverCompositionBlock,
  buildStyle01CoverSceneDescription,
  resolvePageSceneFidelityAddendum,
} from './style01-visual-polish';

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
  pageStoryState?: PageStoryState | null;
  useCanonicalChildAnchorRef?: boolean;
  storyRecurringEntityDeclarations?: StoryRecurringEntityDeclaration[];
  compositionStrictRetry?: boolean;
  totalPages?: number;
  /** Once per order — human family visual coherence (parents, newborn sibling). */
  familyCoherence?: FamilyCoherenceBundle | null;
  storyTimeOfDay?: import('./story-time-of-day').StoryTimeOfDay;
  pageTimeOfDayOverrides?: Partial<Record<number, import('./story-time-of-day').StoryTimeOfDay>>;
  timeOfDayStrictRetry?: boolean;
  /** Wizard challenge category — drives the story-level SCENARIO SETTING LOCK. */
  challengeCategory?: string | null;
  /** True ONLY when the storyboard explicitly chose a close_up shot; otherwise close-up wording is sanitized out of the scene. */
  explicitCloseUp?: boolean;
  /** Per-book cinematography slot from BookShotPlan (derived or override). */
  pageShot?: PageShot | null;
  /** Per-book location continuity (derived or sidecar). */
  locationBible?: import('./story-location-bible').BookLocationBible | null;
  pageLocationPlan?: import('./story-location-bible').PageLocationPlan | null;
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
  const storyLocks = resolveStyle01StoryLocks(
    input.companion?.id,
    input.storyRecurringEntityDeclarations
  );
  const pageStoryState =
    input.pageStoryState ??
    resolveDefaultPageStoryState(input.companion?.id, input.pageNumber);

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

  let entityPresence = derivePageEntityPresence({
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

  if (compositionSpec && compositionAssumesChildPresent(compositionSpec)) {
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

  const wardrobeLock = childPresenceAllowsVisualLock(entityPresence.childPresence)
    ? buildStyle01WardrobeLock({
        companionId: input.companion?.id,
        storyFile: input.storyFile,
        direction: input.direction,
        timeOfDay: input.timeOfDay ?? input.storyTimeOfDay,
        childStructured: input.childStructured,
      })
    : undefined;

  const childAnatomicalLock = childPresenceAllowsVisualLock(entityPresence.childPresence)
    ? buildStyle01ChildAnatomicalLock({
        companionId: input.companion?.id,
        childAge: input.childAge ?? undefined,
      })
    : undefined;

  const accessoryLock = buildCompanionAccessoryLockBlock({
    companionId: input.companion?.id,
    companionName: input.companion?.name,
    companionPresence: entityPresence.companionPresence,
  });

  const companionTextLock =
    entityPresence.companionPresence === 'present'
      ? [
          buildStyle01CompanionTextLock({
            companionId: input.companion?.id,
            companionName: input.companion?.name,
            companionStructured: input.companionStructured,
            companionVisualDescription: input.companion?.visualDescription,
            storyCompanionLock: storyLocks.companionLock,
          }),
          buildStyle01CompanionSilhouetteLock(),
          accessoryLock,
        ]
          .filter(Boolean)
          .join('\n\n')
      : entityPresence.companionPresence === 'partial' ||
          entityPresence.companionPresence === 'offscreen_hint'
        ? accessoryLock
        : undefined;

  const storyTimeOfDay: StoryTimeOfDay =
    input.storyTimeOfDay ??
    resolveStoryTimeOfDay({
      category: null,
      pages: [{ text: input.bookPageText ?? undefined, imagePrompt: imageDirection }],
    });
  const effectivePageTimeOfDay = resolveEffectivePageTimeOfDay({
    storyTimeOfDay,
    pageNumber: input.pageNumber,
    pageTimeOfDayOverrides: input.pageTimeOfDayOverrides,
    imageDirection,
    bookPageText: input.bookPageText,
  });
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
  });
  const pageActionBlock = buildPageActionPromptBlock(input.pageLocationPlan);
  const isolatedObjectRefBlock = buildIsolatedObjectReferencePromptBlock(
    input.pageLocationPlan,
    input.locationBible
  );

  const environmentLock = storyLocks.pageEnvironmentLock?.(input.pageNumber);
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
        compositionByPage: shotPlanSpec ? undefined : storyLocks.compositionByPage,
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
  const sceneFidelityAddendum = isCover
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

  const sceneClass = classifyStyle01SceneClass({
    imagePrompt: input.pagePrompt ?? undefined,
    bookPageText: input.bookPageText ?? undefined,
    rawScenePrompt: imageDirection,
    effectivePageTimeOfDay,
  });

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
