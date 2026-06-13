import type { EditorialReason } from './schemas';

export interface KnownBadPhrase {
  phrase: string;
  reason: EditorialReason;
  severity: 'BLOCKING' | 'MAJOR' | 'MINOR';
  suggestion: string;
  explanation: string;
}

export const KNOWN_BAD_PHRASES: KnownBadPhrase[] = [
  {
    phrase: 'קרירות בברכה',
    reason: 'semantic_nonsense',
    severity: 'BLOCKING',
    suggestion: 'הקור בברכיים',
    explanation: 'Singular "ברכה" with "קרירות" is semantically broken; need plural ברכיים',
  },
  {
    phrase: 'צל הדיבור',
    reason: 'semantic_nonsense',
    severity: 'BLOCKING',
    suggestion: 'הצליל האחרון',
    explanation: '"Shadow of speech" has no clear meaning',
  },
  {
    phrase: 'מפנה הקודם',
    reason: 'broken_hebrew',
    severity: 'BLOCKING',
    suggestion: 'מהמקום הקודם',
    explanation: 'Likely typo for מהמקום הקודם',
  },
  {
    phrase: 'משתתרת',
    reason: 'broken_hebrew',
    severity: 'BLOCKING',
    suggestion: 'מסתתרת',
    explanation: 'Likely typo for מסתתרת (hiding)',
  },
  {
    phrase: 'מחוש הביטחון',
    reason: 'broken_hebrew',
    severity: 'BLOCKING',
    suggestion: 'תחושת הביטחון',
    explanation: '"מחוש" is not a noun here; likely meant תחושה',
  },
  {
    phrase: 'צורח פיהוק',
    reason: 'broken_hebrew',
    severity: 'BLOCKING',
    suggestion: 'מפהק חרישית',
    explanation: 'Yawn does not shout (צורח); semantic mismatch',
  },
  {
    phrase: 'קטם המדבקה',
    reason: 'broken_hebrew',
    severity: 'BLOCKING',
    suggestion: 'קצה המדבקה',
    explanation: 'Likely typo for קצה',
  },
  {
    phrase: 'נוזפת עין מסתובבת',
    reason: 'broken_hebrew',
    severity: 'MAJOR',
    suggestion: 'נוצצת עין מסתובבת',
    explanation: 'Likely typo for נוצצת',
  },
  // v0.2.6 — Invented words / malformed Hebrew identified in batch v0.2.5.1 manual review
  {
    phrase: 'קווזא',
    reason: 'broken_hebrew',
    severity: 'BLOCKING',
    suggestion: 'קשת',
    explanation: 'Invented word — not standard Hebrew',
  },
  {
    phrase: 'בחופף החלום',
    reason: 'broken_hebrew',
    severity: 'BLOCKING',
    suggestion: 'בתוך החלום',
    explanation: '"חופף" doesn\'t pair with "החלום" in standard Hebrew',
  },
  {
    phrase: 'מתגגל',
    reason: 'broken_hebrew',
    severity: 'BLOCKING',
    suggestion: 'מתגלגל',
    explanation: 'Typo for מתגלגל',
  },
  {
    phrase: 'בוושרה',
    reason: 'broken_hebrew',
    severity: 'BLOCKING',
    suggestion: 'בעורה',
    explanation: 'Invented word — likely meant בעורה / בשערה / באורה',
  },
  {
    phrase: 'נדפפת',
    reason: 'broken_hebrew',
    severity: 'BLOCKING',
    suggestion: 'מרפרפת',
    explanation: 'Invented word for bat motion',
  },
  {
    phrase: 'תלה באוויר',
    reason: 'broken_hebrew',
    severity: 'BLOCKING',
    suggestion: 'תלויה באוויר',
    explanation: 'Verb form mismatch — should be feminine for לִילִי',
  },
  {
    phrase: 'גדמי הצבע',
    reason: 'broken_hebrew',
    severity: 'MAJOR',
    suggestion: 'שאריות הצבע',
    explanation: '"גדמי" sounds unnatural with צבע — meant remnants/leftovers',
  },
  {
    phrase: 'צעדים שומעים',
    reason: 'semantic_nonsense',
    severity: 'BLOCKING',
    suggestion: 'צעדיה משמיעים',
    explanation: 'Footsteps don\'t hear — semantic inversion',
  },
  {
    phrase: 'שתיהן מאשרות בלב פועם',
    reason: 'too_abstract_for_age',
    severity: 'MAJOR',
    suggestion: 'שתיהן נרגעות יחד',
    explanation: 'Too abstract — "approving with a beating heart" doesn\'t parse for a 5-year-old',
  },
  {
    phrase: 'שני הקולות מציירים ריח',
    reason: 'too_abstract_for_age',
    severity: 'MAJOR',
    suggestion: 'הצלילים מתערבבים עם הריח',
    explanation: 'Multi-sensory mix that loses meaning when read aloud',
  },
  {
    phrase: 'האוויר עצמו מצרצר מתרגשות',
    reason: 'broken_hebrew',
    severity: 'BLOCKING',
    suggestion: 'האוויר רועד מהתרגשות שקטה',
    explanation: 'Gender disagreement: אוויר (m) with מתרגשות (f.pl)',
  },
];

export function stripHebrewNiqqud(s: string): string {
  return s.normalize('NFKD').replace(/[\u0591-\u05C7]/g, '');
}

/**
 * v0.2.6 \u2014 Cross-companion motif contamination.
 *
 * Each companion has signature motifs (sound + object + behavior). If a story
 * about Lily mentions "\u05D1\u05D8\u05DF \u05D5\u05E8\u05D5\u05D3\u05D4" (Bolly's signature), the brand is confused
 * and the story arguably belongs to a different companion.
 *
 * Returns motifs FROM OTHER companions that appear in this companion's story.
 * Niqqud-insensitive matching.
 */
/**
 * v0.2.8 \u2014 Cross-companion motif list calibrated after batch review.
 *
 * REMOVED as too generic (false-positives flagged correct Hebrew):
 *   - '\u05E9\u05E9\u05E9' from bat_lily \u2014 universal Hebrew shushing sound, ANY character can say it
 *   - '\u05D4\u05DE\u05D3\u05D1\u05E7\u05D4' from bolly_armadillo \u2014 "the sticker" is too generic, stickers appear elsewhere
 *   - '\u05DE\u05E9\u05E0\u05D4 \u05E6\u05D1\u05E2' from chameleon_koko \u2014 color-change is generic in fantasy stories
 *
 * KEPT as truly distinctive (BLOCKING when in foreign story):
 *   - Bolly: "\u05D1\u05D8\u05DF \u05D5\u05E8\u05D5\u05D3\u05D4" (pink belly, armadillo-specific), "\u05D8\u05D5\u05DE\u05E4"/"\u05D8\u05D5\u05BC\u05DE\u05B0\u05E4\u05BC" (his signature sound),
 *     "\u05DE\u05EA\u05E7\u05E4\u05DC \u05DC\u05DB\u05D3\u05D5\u05E8" (his core behavior), "\u05D1\u05E4\u05E0\u05D9\u05DD \u05D4\u05D9\u05D4 \u05D7\u05DD" (his repeatable phrase)
 *   - Lily: "\u05DB\u05E0\u05E3 \u05E2\u05D5\u05D8\u05E4\u05EA" (winged embrace), "\u05D1\u05DC\u05D9\u05DC\u05D4 \u05E8\u05D5\u05D0\u05D9\u05DD \u05D0\u05D7\u05E8\u05EA" (her phrase), "\u05EA\u05DC\u05D9\u05D5\u05DF \u05D0\u05D5\u05E8" (her pendant)
 *   - Kim (v3): "\u05EA\u05D9\u05E7 \u05D1\u05DB\u05EA\u05E3" (mustard shoulder satchel), "\u05E4\u05E9\u05E9\u05E9" (her sound), "\u05D7\u05EA\u05D9\u05DB\u05D4 \u05DE\u05D4\u05D1\u05D9\u05EA"
 *     Legacy scarf "\u05E6\u05E2\u05D9\u05E3 \u05DE\u05E4\u05D5\u05E1\u05E4\u05E1" is documented anti-pattern only — not a v3 signature motif.
 */
const COMPANION_SIGNATURE_MOTIFS: Record<string, string[]> = {
  bolly_armadillo: ['\u05D1\u05D8\u05DF \u05D5\u05E8\u05D5\u05D3\u05D4', '\u05D8\u05D5\u05DE\u05E4', '\u05D8\u05D5\u05BC\u05DE\u05B0\u05E4\u05BC', '\u05DE\u05EA\u05E7\u05E4\u05DC \u05DC\u05DB\u05D3\u05D5\u05E8', '\u05D1\u05E4\u05E0\u05D9\u05DD \u05D4\u05D9\u05D4 \u05D7\u05DD'],
  bat_lily: ['\u05DB\u05E0\u05E3 \u05E2\u05D5\u05D8\u05E4\u05EA', '\u05D1\u05DC\u05D9\u05DC\u05D4 \u05E8\u05D5\u05D0\u05D9\u05DD \u05D0\u05D7\u05E8\u05EA', '\u05EA\u05DC\u05D9\u05D5\u05DF \u05D0\u05D5\u05E8'],
  chameleon_koko: ['\u05EA\u05D9\u05E7 \u05D1\u05DB\u05EA\u05E3', '\u05E4\u05E9\u05E9\u05E9', '\u05D7\u05EA\u05D9\u05DB\u05D4 \u05DE\u05D4\u05D1\u05D9\u05EA'],
};

export interface ForeignMotifMatch {
  ownerCompanionId: string;
  motif: string;
  pageNumber?: number;
}

export function detectForeignMotifs(
  storyText: string,
  myCompanionId: string
): ForeignMotifMatch[] {
  const matches: ForeignMotifMatch[] = [];
  const haystack = stripHebrewNiqqud(storyText);
  for (const [owner, motifs] of Object.entries(COMPANION_SIGNATURE_MOTIFS)) {
    if (owner === myCompanionId) continue;
    for (const motif of motifs) {
      const needle = stripHebrewNiqqud(motif);
      if (haystack.includes(needle)) {
        matches.push({ ownerCompanionId: owner, motif });
      }
    }
  }
  return matches;
}

/** Companion name twice in same clause (niqqud-insensitive). */
export function detectCompanionRepeats(text: string, canonicalName: string): boolean {
  const normalizedText = stripHebrewNiqqud(text);
  const normalizedName = stripHebrewNiqqud(canonicalName);
  if (!normalizedName || normalizedName.length < 2) return false;

  const escaped = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const clauses = normalizedText.split(/[.!?,:;\n—-]/);
  for (const clause of clauses) {
    const occurrences = (clause.match(new RegExp(escaped, 'g')) ?? []).length;
    if (occurrences >= 2) return true;
  }
  return false;
}
