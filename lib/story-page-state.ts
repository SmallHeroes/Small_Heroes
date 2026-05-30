/**
 * Per-page story state — which recurring objects/entities may appear and in what form.
 * Reusable across companions; companion catalogs live in story-page-state-catalog.ts.
 */

export type ObjectState =
  | 'absent'
  | 'intact'
  | 'transitioning'
  | 'fragments'
  | 'transformed'
  | 'present'
  | 'emerging';

export type PageStoryState = {
  /** Lock / entity ids allowed in the scene for this page */
  presentEntities: string[];
  /** Explicit do-not-depict list for prompt injection */
  forbiddenEntities: string[];
  /** Per lock id — drives which lock variant is injected */
  objectStates: Record<string, ObjectState>;
};

export type StoryStateLockBundle = {
  objectLockLabels: Record<string, string>;
  entityLockLabels: Record<string, string>;
  formatObjectLock: (lockId: string, state: ObjectState) => string;
  formatEntityLock: (lockId: string, state: ObjectState) => string;
};

export function buildStoryStateForbiddenBlock(state: PageStoryState): string {
  if (state.forbiddenEntities.length === 0) return '';
  return [
    'STORY STATE — FORBIDDEN this page (do NOT depict):',
    state.forbiddenEntities.join(', '),
  ].join('\n');
}

export function buildStoryStateLockBlocks(
  state: PageStoryState,
  bundle: StoryStateLockBundle
): { objectLocks: string; entityLocks: string } {
  const objectParts: string[] = [];
  const entityParts: string[] = [];

  for (const id of state.presentEntities) {
    const objState = state.objectStates[id] ?? 'present';
    if (objState === 'absent') continue;

    if (bundle.objectLockLabels[id]) {
      const text = bundle.formatObjectLock(id, objState);
      if (text.trim()) objectParts.push(text);
      continue;
    }
    if (bundle.entityLockLabels[id]) {
      const text = bundle.formatEntityLock(id, objState);
      if (text.trim()) entityParts.push(text);
    }
  }

  return {
    objectLocks: objectParts.join('\n\n'),
    entityLocks: entityParts.join('\n\n'),
  };
}

export function mergeStoryStateForbidden(
  entityForbidden: string[],
  storyState?: PageStoryState | null
): string[] {
  if (!storyState?.forbiddenEntities.length) return entityForbidden;
  const merged = new Set([...entityForbidden, ...storyState.forbiddenEntities]);
  return [...merged];
}
