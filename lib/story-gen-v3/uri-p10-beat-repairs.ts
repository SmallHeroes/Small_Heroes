/**
 * Guy-approved structure-gate beat repairs for uri_premise_10 (drip-tick arc).
 * Applied before prose — keeps LLM beats aligned with causality validation.
 */

import type { PageBeatV3 } from './types';

export function applyUriP10StructureGateBeatRepairs(beats: PageBeatV3[]): PageBeatV3[] {
  return beats.map((b) => {
    if (b.page === 4) {
      return {
        ...b,
        whatGetsFunnierOrHarder:
          'הדפיקה על המעקה היבש מחזירה הד תופעי — הקצב מתבלבל בלי שום מים',
        pageTurnReason: 'הם רוצים להבין למה ההד נשמע כמו שיחה מסתורית',
        visualAnchor: 'dry metal balcony railing, finger tap echo, no water splash yet',
      };
    }
    if (b.page === 8) {
      return {
        ...b,
        event:
          'הקצב נהיה מהיר יותר — הם משחקים בכוונה "כאילו מישהו עונה" (כבר יודעים שזה טפטוף)',
        whatChanges: 'משחק העמדת-פנים מודע — לא אמונה אמיתית שיש מישהו שם',
        companionDoes:
          "אורי מתופף באצבעות ומשחק 'שיחה' בקול מוגזם — יודע שזה רק מים בדלי",
      };
    }
    return b;
  });
}

export const URI_P10_PROSE_MANDATES = `## Structure-gate prose mandates (Guy approved — MANDATORY)
1. CAUSALITY: No water splash/spray/wet mishap until the bucket is discovered (page 5+). Page 4 = dry finger tap on railing only — echo confuses rhythm, NO bucket water yet.
2. Page 7 = discovery drip is real. Page 8+ "someone answering" = conscious pretend play ("כאילו"), NOT renewed fear or belief in a hidden creature.
3. Comic bit dosage: select 3–5 bits from bank for the whole story; max 1 bit per page; spread Uri lantern/scout tics (כמעט / אולי / רשמית / ידעתי) — never two on the same page.`.trim();
