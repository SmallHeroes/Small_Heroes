export const STORY_SOURCE_GENDER_MODES = [
  'female',
  'male',
  'neutral',
] as const;

export type StorySourceGenderMode =
  (typeof STORY_SOURCE_GENDER_MODES)[number];

export const GENDER_FLEXIBLE_COMPILER_PROMPT_VALUE =
  'gender-flexible source (boy/girl resolved at runtime)' as const;

export function storySourceGenderModeIsValid(
  value: unknown,
): value is StorySourceGenderMode {
  return (
    typeof value === 'string' &&
    (STORY_SOURCE_GENDER_MODES as readonly string[]).includes(value)
  );
}

export function normalizedStorySourceGenderMode(
  value: string | null | undefined,
): StorySourceGenderMode | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'girl') return 'female';
  if (normalized === 'boy') return 'male';
  return storySourceGenderModeIsValid(normalized) ? normalized : null;
}

export function storySourceGenderCompilerPromptValue(
  mode: StorySourceGenderMode,
): string {
  return mode === 'neutral'
    ? GENDER_FLEXIBLE_COMPILER_PROMPT_VALUE
    : mode;
}

export function storySourceFixedGender(
  mode: StorySourceGenderMode,
): 'female' | 'male' | null {
  return mode === 'neutral' ? null : mode;
}
