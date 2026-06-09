/**
 * Hebrew editorial precedents — v0 calibration + v1 learning surface.
 */

import type {
  HebrewReadAloudActionMode,
  HebrewReadAloudIssueType,
} from './hebrew-read-aloud-types';

export interface HebrewEditorialPrecedent {
  id: string;
  badPattern: string;
  badRegex?: RegExp;
  whyBad: string;
  approvedPattern?: string;
  approvedPatterns?: string[];
  /** Multi-line local swap — lines to find and replace as a block. */
  replaceLines?: string[];
  approvedBlock?: string[];
  issueType: HebrewReadAloudIssueType;
  allowedActionMode: HebrewReadAloudActionMode;
  confidence: number;
  severity: 'low' | 'medium' | 'high';
  alternateReplacements?: string[];
  recommendation?: string;
  notes?: string;
  /** Guy approved KEEP — do not flag in diagnosis. */
  guyDecision?: 'KEEP';
  skipDiagnosis?: boolean;
}

/** Dini popcorn — do not auto-edit. */
export const DINI_POPCORN_PROTECTED_LINES: string[] = [
  'אַאש!',
  'למרות שהוא היה בעיקר חמאה וקצת דרמה.',
  'מי קרא אש?',
  'הזנב שלי פשוט עושה תרגילי חימום.',
  'גור אש קטן!',
  'גרעין במצוקה!',
  'רגע — לא גג. מפרש.',
  'זו בעיה של ילד, לא בעיה שצריך לצלות.',
  'רק נשיפה קטנה בלי דרמה.',
  '"אש," הוא לחש.',
  'דיני לא קמה.',
  'היא רק קרצה ל{{childName}}.',
  '"אחרי הסרט."',
];

export const HEBREW_EDITORIAL_PRECEDENTS: HebrewEditorialPrecedent[] = [
  {
    id: 'pose_hands_open_catch',
    badPattern: 'ידיים פתוחות לתפוס',
    badRegex: /\{מתכופף\|מתכופפת\}\s+לבדוק,\s*ידיים פתוחות לתפוס/,
    whyBad: 'Static image-prompt pose — no narrated action or result.',
    approvedPattern:
      '{{childName}} {שלח|שלחה} שתי ידיים קדימה —\nאבל הגרעין כבר קפץ הצידה.',
    issueType: 'image_prompt_residue',
    allowedActionMode: 'SAFE_FIX',
    confidence: 0.97,
    severity: 'high',
  },
  {
    id: 'therapeutic_warm_courage',
    badPattern: 'מספיק לחמם אומץ',
    badRegex: /מספיק לחמם אומץ/,
    whyBad: 'Adult therapeutic metaphor — fails read-aloud for ages 5–8.',
    approvedPattern: 'אנשוף נשיפה קטנה.',
    issueType: 'too_abstract',
    allowedActionMode: 'HIGH_CONFIDENCE_EDITORIAL_FIX',
    confidence: 0.95,
    severity: 'high',
  },
  {
    id: 'hebrew_verb_adjective_naturalness',
    badPattern: 'אני אנשוף קטן',
    badRegex: /אני אנשוף קטן/,
    whyBad:
      'In Hebrew, adjectives like קטן should not attach directly to verbs — use noun phrase or adverbial construction.',
    approvedPatterns: [
      'אנשוף נשיפה קטנה',
      'אנשוף רק מעט',
      'אנשוף בעדינות',
      'רק נשיפה קטנה',
    ],
    approvedPattern: 'אנשוף נשיפה קטנה.',
    issueType: 'unnatural_hebrew',
    allowedActionMode: 'HIGH_CONFIDENCE_EDITORIAL_FIX',
    confidence: 0.94,
    severity: 'high',
  },
  {
    id: 'pride_heavy_full_shela_block',
    badPattern: 'היא הייתה כבדה. מלאה. {שלו|שלה}.',
    replaceLines: ['היא הייתה כבדה.', 'מלאה.', '{שלו|שלה}.'],
    whyBad: 'Ambiguous "היא" + fragmented pride beat reads unnatural aloud.',
    approvedBlock: ['הקערה הייתה כבדה ומלאה.'],
    issueType: 'emotion_worded_awkwardly',
    allowedActionMode: 'HIGH_CONFIDENCE_EDITORIAL_FIX',
    confidence: 0.92,
    severity: 'medium',
    notes: 'Local block swap — same pride beat, natural Hebrew.',
  },
  {
    id: 'guy_keep_dini_child_problem_roast',
    badPattern: 'זו בעיה של ילד, לא בעיה שצריך לצלות',
    badRegex: /זו בעיה של ילד, לא בעיה שצריך לצלות/,
    whyBad: 'Guy KEEP — good Dini dragon-logic joke after read-aloud.',
    issueType: 'unclear_joke',
    allowedActionMode: 'PROTECTED_LINE_SUGGEST_ONLY',
    confidence: 1,
    severity: 'low',
    guyDecision: 'KEEP',
    skipDiagnosis: true,
    notes: 'Subjective line approved by Guy; do not flag as blocking.',
  },
  {
    id: 'guy_replace_version_two_with_physical_escalation',
    badPattern: 'גרסה שתיים',
    badRegex: /קן פופקורן בטוח — גרסה שתיים/,
    whyBad: '"גרסה שתיים" is technical/product-like — not child-native.',
    approvedPattern: '"קן פופקורן בטוח — עכשיו עם כנף!"',
    issueType: 'adult_or_technical_wording',
    allowedActionMode: 'HIGH_CONFIDENCE_EDITORIAL_FIX',
    confidence: 0.93,
    severity: 'medium',
    notes: 'Guy approved — physical escalation connects to wing/mפרש beat.',
  },
  {
    id: 'guy_replace_tea_cup_safety_logic',
    badPattern: 'לא לאש — לחום קטן, כמו ספל תה',
    badRegex: /לא לאש — לחום קטן, כמו ספל תה/,
    whyBad: 'Translated safety logic — not natural read-aloud Hebrew.',
    approvedPattern: 'לא לאש, רק נשיפה קטנה בלי דרמה.',
    issueType: 'translated_sounding',
    allowedActionMode: 'HIGH_CONFIDENCE_EDITORIAL_FIX',
    confidence: 0.92,
    severity: 'medium',
    notes: 'Guy approved — callbacks to p1 drama joke.',
  },
];

export function isProtectedLine(line: string, protectedLines: string[]): boolean {
  const norm = (s: string) => s.replace(/[\u0591-\u05C7]/g, '').trim();
  const n = norm(line);
  return protectedLines.some((p) => n.includes(norm(p)) || norm(p).includes(n));
}
