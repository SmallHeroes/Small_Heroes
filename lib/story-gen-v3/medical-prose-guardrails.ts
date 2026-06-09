/**
 * Bunny MEDICAL_PROCEDURE — extra prose risk scan (STOP 3).
 * Gates only; human aloud read is still required for PASS.
 */

import { scanChildCompanionBodyPartLeak } from './companion-body-part-guard';

export interface MedicalProseRiskHit {
  code: string;
  message: string;
  excerpt?: string;
}

const FORBIDDEN_PHRASES =
  /זה לא יכאב|אין מה לפחד|תהיה אמיץ|הרופא נחמד|האחות נחמד|אם תירגע|הכול יעבור|הכול בסדר|לא כואב|nothing to fear|won't hurt|be brave/i;

const PUBLIC_MOCKERY_RE =
  /(?:כולם מסתכלים|החדר כולו|כולם צוחקים על|צוחקים עליו|צוחקים עליה|נועג|לעג)/i;

const PUNCHLINE_TRUTH_LINE_RE =
  /גם שלי רוצות לזוז[^.\n]{0,30}(?:!|והחדר|כולם|צחק)/i;

const CLINIC_WARM_PRIVATE_RE =
  /חדר קטן|חדר בדיקה|קליניקה|מסדרון שקט|חדר שקט|ליד המיטה|חדר הבדיקה|אחות[^.\n]{0,80}(?:שולחן|מדחום|בדיקה)/i;

export function scanMedicalProseRisks(prose: string): MedicalProseRiskHit[] {
  const hits: MedicalProseRiskHit[] = [];

  if (FORBIDDEN_PHRASES.test(prose)) {
    hits.push({
      code: 'medical_forbidden_phrase',
      message: 'Forbidden medical reassurance / outcome promise',
    });
  }

  for (const leak of scanChildCompanionBodyPartLeak(prose, 'ears')) {
    hits.push({
      code: leak.code,
      message: leak.message,
      excerpt: leak.line,
    });
  }

  if (PUBLIC_MOCKERY_RE.test(prose)) {
    hits.push({
      code: 'public_mockery',
      message: 'Avoid embarrassing public laughing-at-child moment',
    });
  }

  if (PUNCHLINE_TRUTH_LINE_RE.test(prose)) {
    hits.push({
      code: 'truth_line_punchline',
      message: 'Truth line must land as small quiet sentence, not punchline',
    });
  }

  if (!CLINIC_WARM_PRIVATE_RE.test(prose)) {
    hits.push({
      code: 'clinic_not_warm_private',
      message: 'Setting should read as small warm private clinic/wait — not public stage',
    });
  }

  return hits;
}

export const BUNNY_MEDICAL_PROSE_BLOCK = `## BUNNY MEDICAL — mandatory prose guardrails
- Clinic: SMALL, warm, PRIVATE — not a public stage. No crowd laughing at child.
- Bunny = ears that pop up. Child = HANDS that tremble. Ear-statue = GAME with hands held up "as if ears".
- Truth line (Guy LOCKED): "גם הידיים שלי קצת רועדות." — small quiet truth, NOT punchline.
- ONLY בוּנִי has bunny ears. {{childName}} is human — NO rabbit ears on child except "כאילו/במשחק/דמיוניות".
- NEVER: "זה לא יכאב", "אין מה לפחד", "תהיה אמיץ", medical outcome promises.
- Comfort without lying. Child agency: one true sentence, where to look, familiar object, small pause.`;
