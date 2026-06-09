import type { PremiseExperimentSpecV3 } from './types';

export const KOKO_SCENARIO_2: PremiseExperimentSpecV3 = {
  id: 'koko_scenario_2_transition',
  companionId: 'chameleon_koko',
  direction: 'adventure',
  resilienceTheme: 'TRANSITION — stepping into unfamiliar place while carrying something familiar',
  childAgeMin: 5,
  childAgeMax: 8,
  candidateCount: 12,
  calibrationGoldenIds: [
    'chameleon_koko_adventure',
    'chameleon_koko_bedtime',
    'panda_anat_adventure',
    'fox_uri_adventure',
  ],
  forbidPlotCopy: [
    'זנב-עוגן / tail-anchor on moving box',
    'ארגז צעצועים כפורטל / orange hills portal',
    'קוֹקוֹ מתאימה לארגז יותר מדי / half-green half-cardboard',
    'פופקורן / kernel אש / popcorn safety nest',
    'דיני כנף כבדה / wing roof / towel sail wind tunnel',
    'companion over-wraps object → child finds air-gap gentler way (popcorn collapse)',
    'generic nervous → reassured → new place is okay fable',
    'therapy vocabulary headline',
  ],
};

export const DINI_PREMISE_SPRINT_A: PremiseExperimentSpecV3 = {
  id: 'dini_premise_sprint_a',
  companionId: 'dragon_dini',
  direction: 'fantasy',
  resilienceTheme: 'overprotection / letting a smaller creature try',
  childAgeMin: 5,
  childAgeMax: 7,
  candidateCount: 12,
  calibrationGoldenIds: [
    'panda_anat_adventure',
    'dragon_dini_fantasy',
    'fox_uri_adventure',
    'dragon_dini_bedtime',
    'octopus_seara_adventure',
  ],
  forbidPlotCopy: [
    'ביצה ירוקה בנקודודים / שמירה על ביצה שלא בקעה',
    'עטיפת ביצה / כרטיס החיבוק מהגולדן',
    'אבן ניצוץ / אור שדורש כף פתוחה (v2 Exp2 plot)',
    'מסלול ניצוץ מעל בריכת אדים',
    'גבעות כתומות / ארגז צעצועים כפורטל',
    'הילד מלמד דיני "לשחרר" במשפט מטיפי',
    'דרקון מגן אפי / קסם גנרי של אומץ פנימי',
  ],
};
