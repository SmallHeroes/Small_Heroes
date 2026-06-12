import { PAGE_COUNT_BY_DIRECTION, type PremiseExperimentSpecV3 } from './types';

/** Sprint 11 slot #1 — NIGHT_FEAR · adventure · fox_uri · 12 beats */
export const SPRINT_11_SLOT_01_FOX_NIGHT_FEAR_ADVENTURE: PremiseExperimentSpecV3 = {
  id: 'sprint11_slot01_night_fear_fox_adventure',
  companionId: 'fox_uri',
  direction: 'adventure',
  category: 'NIGHT_FEAR',
  pageCount: PAGE_COUNT_BY_DIRECTION.adventure,
  resilienceTheme:
    'NIGHT_FEAR — fear becomes inspectable in child-scale night steps; lantern tip, not all dark',
  childAgeMin: 5,
  childAgeMax: 8,
  candidateCount: 12,
  calibrationGoldenIds: [
    'fox_uri_bedtime',
    'fox_uri_adventure',
    'panda_anat_adventure',
    'bunny_ometz_bedtime',
  ],
  forbidPlotCopy: [
    'מפת הצללים / shadow-map garden plot verbatim',
    'צנור גינה כחיה ארוכה / garden hose as snake creature',
    'שביל נמלים כאוצר / ant-line treasure payoff',
    'copy fox_uri_bedtime bedroom chair-shadow / branch tap window beats',
    'מפלצת-המעיל / shirt-on-chair monster',
    'wise fox guide who solves fear',
    'whole plot as official night-inspector bureaucracy',
  ],
  mustAvoid: [
    'horror escalation or true jump-scare terror',
    'Uri erases fear or solves climax alone',
    'light entire darkness — must stay tip-of-light',
    'therapy fear vocabulary headline',
    'generic backyard treasure hunt without inspectable-fear engine',
  ],
  mustInclude: [
    'child-scale night adventure (porch edge / backyard path)',
    'lantern as courage meter — inspectable fear',
    'Uri wrong shadow or sound read + proud-scout slip',
    'child agency — corrects Uri or steps closer',
    'small light / small step payoff — not hero conquers dark',
  ],
  premiseCreativeBrief: [
    'Seed uri_premise_10 (hidden_pattern): night sound Uri misreads as threat — child discovers ordinary-but-magical truth (drip on bucket, wind chime, moth wing, branch tap).',
    'Add 2–3 more hidden_pattern variants with different night sounds/objects in the same spirit.',
    'All companionComicEngineUsed lines must reflect Uri lantern/scout engine — zero Dini/dragon/wrap/popcorn language.',
  ].join(' '),
};

export const SPRINT_11_SPECS: PremiseExperimentSpecV3[] = [
  SPRINT_11_SLOT_01_FOX_NIGHT_FEAR_ADVENTURE,
];

export function sprint11SpecForSlot(slot: number): PremiseExperimentSpecV3 | undefined {
  return SPRINT_11_SPECS[slot - 1];
}
