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
];

export function stripHebrewNiqqud(s: string): string {
  return s.normalize('NFKD').replace(/[\u0591-\u05C7]/g, '');
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
