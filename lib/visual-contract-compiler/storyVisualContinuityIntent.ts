export const STORY_VISUAL_CONTINUITY_INTENT_VERSION =
  'small-heroes-story-visual-continuity-intent/v1' as const;

export interface StoryVisualContinuityIntent {
  version: typeof STORY_VISUAL_CONTINUITY_INTENT_VERSION;
  childWardrobeAuthority: 'frozen_visual_contract';
  childWardrobeTransitionPages: number[];
  companionAccessoryAuthority: 'canonical_companion_profile';
  companionAppearanceAuthority: 'frozen_companion_state';
  companionStateTransitionPages: number[];
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return (
    JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...keys].sort())
  );
}

function orderedPageSetIsValid(
  value: unknown,
  pageNumbers?: readonly number[],
): value is number[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (pageNumber) =>
        !Number.isSafeInteger(pageNumber) || pageNumber < 1,
    )
  ) {
    return false;
  }
  const unique = [...new Set(value as number[])];
  if (
    unique.length !== value.length ||
    JSON.stringify(unique.slice().sort((left, right) => left - right)) !==
      JSON.stringify(value)
  ) {
    return false;
  }
  return (
    pageNumbers === undefined ||
    unique.every((pageNumber) => pageNumbers.includes(pageNumber))
  );
}

export function storyVisualContinuityIntentIssues(
  value: unknown,
  pageNumbers?: readonly number[],
): string[] {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return ['continuity_intent_not_object'];
  }
  const record = value as Record<string, unknown>;
  const issues: string[] = [];
  if (
    !exactKeys(record, [
      'childWardrobeAuthority',
      'childWardrobeTransitionPages',
      'companionAccessoryAuthority',
      'companionAppearanceAuthority',
      'companionStateTransitionPages',
      'version',
    ])
  ) {
    issues.push('continuity_intent_keys_invalid');
  }
  if (record.version !== STORY_VISUAL_CONTINUITY_INTENT_VERSION) {
    issues.push('continuity_intent_version_invalid');
  }
  if (record.childWardrobeAuthority !== 'frozen_visual_contract') {
    issues.push('continuity_intent_child_wardrobe_authority_invalid');
  }
  if (
    !orderedPageSetIsValid(
      record.childWardrobeTransitionPages,
      pageNumbers,
    )
  ) {
    issues.push('continuity_intent_child_wardrobe_pages_invalid');
  }
  if (
    record.companionAccessoryAuthority !==
    'canonical_companion_profile'
  ) {
    issues.push('continuity_intent_companion_accessory_authority_invalid');
  }
  if (
    record.companionAppearanceAuthority !==
    'frozen_companion_state'
  ) {
    issues.push('continuity_intent_companion_appearance_authority_invalid');
  }
  if (
    !orderedPageSetIsValid(
      record.companionStateTransitionPages,
      pageNumbers,
    )
  ) {
    issues.push('continuity_intent_companion_state_pages_invalid');
  }
  return issues;
}

export function assertValidStoryVisualContinuityIntent(
  value: unknown,
  pageNumbers?: readonly number[],
): asserts value is StoryVisualContinuityIntent {
  const issues = storyVisualContinuityIntentIssues(value, pageNumbers);
  if (issues.length > 0) {
    throw new Error(
      `story_visual_continuity_intent_invalid:${issues.join(',')}`,
    );
  }
}
