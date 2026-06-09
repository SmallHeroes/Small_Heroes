import { PAGE_COUNT_BY_DIRECTION, type PremiseExperimentSpecV3 } from './types';

const POPCORN_KOKO_FORBID = [
  'פופקורן / kernel אש / popcorn safety nest / Dini wing roof / towel sail',
  'Koko color camouflage / striped wall / paint river (Scenario 2)',
  'companion over-wraps → child finds air-gap (popcorn collapse)',
  'generic reassurance fable without physical event',
];

export const LION_SHAKET_ANGER: PremiseExperimentSpecV3 = {
  id: 'confidence_lion_shaket_anger',
  companionId: 'lion_shaket',
  direction: 'fantasy',
  category: 'ANGER_FRUSTRATION',
  pageCount: PAGE_COUNT_BY_DIRECTION.fantasy,
  resilienceTheme: 'ANGER_FRUSTRATION — energy becomes movement, not “anger is bad”',
  childAgeMin: 5,
  childAgeMax: 8,
  candidateCount: 12,
  calibrationGoldenIds: ['lion_shaket_fantasy', 'lion_shaket_adventure', 'panda_anat_adventure'],
  forbidPlotCopy: [...POPCORN_KOKO_FORBID, 'copy lion_shaket_fantasy whisper-on-grass plot verbatim'],
  mustAvoid: ['anger is bad lesson', 'count to ten therapy', 'calm down lecture', 'popcorn/koko reskin'],
  mustInclude: [
    'sound/roar has physical weight',
    'child-led discovery of smaller true sound',
    'mid-story turn (not 20 pages of escalation only)',
    'energy → movement payoff',
  ],
};

export const BUNNY_OMETZ_MEDICAL: PremiseExperimentSpecV3 = {
  id: 'confidence_bunny_ometz_medical',
  companionId: 'bunny_ometz',
  direction: 'bedtime',
  category: 'MEDICAL_PROCEDURE',
  pageCount: PAGE_COUNT_BY_DIRECTION.bedtime,
  resilienceTheme: 'MEDICAL_PROCEDURE — quiet true courage, small truthful sentence',
  childAgeMin: 5,
  childAgeMax: 8,
  candidateCount: 12,
  calibrationGoldenIds: ['bunny_ometz_bedtime', 'bunny_ometz_adventure', 'panda_anat_adventure'],
  forbidPlotCopy: [...POPCORN_KOKO_FORBID],
  mustAvoid: [
    'זה לא יכאב',
    'אין מה לפחד',
    'תהיה אמיץ',
    'הרופא נחמד אז הכול בסדר',
    'אם תירגע הכול יעבור',
    'promise medical outcomes',
  ],
  mustInclude: [
    'child agency inside uncontrollable situation',
    'one true quiet sentence or small choice',
    'ears/body signal comedy from bunny',
    'comfort without lying',
  ],
};

export const TURTLE_BEITI_HOMESICK: PremiseExperimentSpecV3 = {
  id: 'confidence_turtle_beiti_homesick',
  companionId: 'turtle_beiti',
  direction: 'adventure',
  category: 'HOMESICKNESS',
  pageCount: PAGE_COUNT_BY_DIRECTION.adventure,
  resilienceTheme: 'HOMESICKNESS — home comes with you via physical object/ritual, not slogan',
  childAgeMin: 5,
  childAgeMax: 8,
  candidateCount: 12,
  calibrationGoldenIds: ['turtle_beiti_adventure', 'turtle_beiti_bedtime', 'chameleon_koko_adventure'],
  forbidPlotCopy: [...POPCORN_KOKO_FORBID, 'copy turtle_beiti_adventure shawl plot verbatim'],
  mustAvoid: [
    'הבית בלב (unearned)',
    'הבית תמיד איתך (slogan only)',
    'גם מקום חדש יכול להיות בית (lesson headline)',
  ],
  mustInclude: [
    'physical home object/route/ritual/shell-space',
    'child makes or notices something that carries home',
    'moving house/shell comedy',
    'payoff earned by concrete action',
  ],
};

export const CONFIDENCE_BATCH_SPECS: PremiseExperimentSpecV3[] = [
  LION_SHAKET_ANGER,
  BUNNY_OMETZ_MEDICAL,
  TURTLE_BEITI_HOMESICK,
];

export function specById(id: string): PremiseExperimentSpecV3 | undefined {
  return CONFIDENCE_BATCH_SPECS.find((s) => s.id === id);
}

export function pageCountForSpec(spec: PremiseExperimentSpecV3): number {
  return spec.pageCount ?? PAGE_COUNT_BY_DIRECTION[spec.direction];
}
