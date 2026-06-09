import type { PremiseExperimentSpecV3 } from './types';

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
