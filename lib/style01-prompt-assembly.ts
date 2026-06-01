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
  buildStyle01BookPagePrompt,
  buildStyle01ChildVisualLock,
  buildStyle01ChildAnatomicalLock,
  buildStyle01CompanionTextLock,
  buildStyle01CompositionBlock,
  buildStyle01EntityPresenceBlock,
  buildStyle01RecurringEntityLocks,
  buildStyle01RecurringObjectLocks,
  buildStyle01WardrobeLock,
  classifyStyle01SceneClass,
  resolveStyle01StoryLocks,
  type Style01SceneClass,
} from './style01-gptimage';

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
};

export type Style01PromptAssemblyResult = {
  prompt: string;
  sceneDescription: string;
  sceneClass: Style01SceneClass;
  entityPresence: PageEntityPresenceContract;
  pageStoryState: PageStoryState | null;
  compositionBlock: string;
};

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
  const storyLocks = resolveStyle01StoryLocks(input.companion?.id);
  const pageStoryState =
    input.pageStoryState ??
    resolveDefaultPageStoryState(input.companion?.id, input.pageNumber);

  const imageDirection = resolveStyle01SceneDescription({
    rawScenePrompt: input.rawScenePrompt,
    pagePrompt: input.pagePrompt,
    mechanicalScene: input.mechanicalScene,
  });

  const entityPresence = derivePageEntityPresence({
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
        childStructured: input.childStructured,
      })
    : undefined;

  const childAnatomicalLock = childPresenceAllowsVisualLock(entityPresence.childPresence)
    ? buildStyle01ChildAnatomicalLock({
        companionId: input.companion?.id,
        childAge: input.childAge ?? undefined,
      })
    : undefined;

  const companionTextLock =
    entityPresence.companionPresence === 'present'
      ? buildStyle01CompanionTextLock({
          companionName: input.companion?.name,
          companionStructured: input.companionStructured,
          companionVisualDescription: input.companion?.visualDescription,
          storyCompanionLock: storyLocks.companionLock,
        })
      : undefined;

  const environmentLock = storyLocks.pageEnvironmentLock?.(input.pageNumber);
  const storyStateForbiddenBlock = pageStoryState
    ? buildStoryStateForbiddenBlock(pageStoryState)
    : '';

  const compositionSpec = storyLocks.compositionByPage?.[input.pageNumber];
  const compositionBlock = buildStyle01CompositionBlock({
    pageNumber: input.pageNumber,
    imageDirection,
    compositionByPage: storyLocks.compositionByPage,
  });

  const entityPresenceBlock = buildStyle01EntityPresenceBlock({
    childPresence: entityPresence.childPresence,
    companionPresence: entityPresence.companionPresence,
    forbiddenEntities: forbiddenMerged,
  });

  // Story-bank imageDirection may still mention obsolete clothing; composition staging + wardrobe lock win.
  const sceneDescription =
    input.companion?.id === 'dragon_dini' && compositionSpec?.staging?.trim()
      ? compositionSpec.staging.trim()
      : imageDirection;

  const prompt = buildStyle01BookPagePrompt({
    sceneDescription,
    childVisualLock,
    wardrobeLock,
    childAnatomicalLock,
    companionTextLock,
    recurringObjectLocks: objectLocks || undefined,
    recurringEntityLocks: entityLocks || undefined,
    environmentLock: [environmentLock, storyStateForbiddenBlock].filter(Boolean).join('\n\n') || undefined,
    compositionBlock,
    entityPresenceBlock,
  });

  const sceneClass = classifyStyle01SceneClass({
    imagePrompt: input.pagePrompt ?? undefined,
    bookPageText: input.bookPageText ?? undefined,
    rawScenePrompt: imageDirection,
  });

  return {
    prompt,
    sceneDescription,
    sceneClass,
    entityPresence,
    pageStoryState,
    compositionBlock,
  };
}

/** Regression helpers for prompt assertion suite */
export function assertStyle01PromptInvariants(
  prompt: string,
  imageDirection: string,
  pageNumber?: number
): void {
  if (!prompt.includes('FRAMING RULE — BREATHE')) {
    throw new Error(
      `Page ${pageNumber ?? '?'} prompt missing FRAMING RULE — BREATHE`
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
