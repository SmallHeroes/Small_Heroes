export const CRAFT_DIMENSIONS = [
  'childDelight',
  'humor',
  'pageTurnValue',
  'visualRichness',
  'emotionalTruth',
  'childAgency',
  'companionMemorability',
  'hebrewOrality',
  'ageFit',
  'rereadability',
  'commercialQuality',
  'imageReadiness',
] as const;

export type CraftDimension = (typeof CRAFT_DIMENSIONS)[number];

export const CRAFT_HARD_FAIL_IDS = [
  'moralizingEnding',
  'childPassiveThroughStory',
  'adultTherapeuticExplanation',
  'fearSanitizedOrDismissed',
  'genericCompanionSubstitutable',
] as const;

export type CraftHardFailId = (typeof CRAFT_HARD_FAIL_IDS)[number];

export type CraftVerdict = 'strong' | 'acceptable' | 'weak' | 'fail';

export const CRAFT_FLAG_THRESHOLD = 5;
