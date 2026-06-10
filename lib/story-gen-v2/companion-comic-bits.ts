/**
 * Human-authored companion comic / physical beats for Generator-v2 prose assembly.
 * Isolated R&D — not production story bank.
 */

export type ComicBitKind =
  | 'physical_gag'
  | 'overliteral_line'
  | 'vulnerable_admission'
  | 'body_before_mind'
  | 'misread'
  | 'tiny_ritual'
  | 'residue_callback'
  | 'protective_overreaction';

export type ComicBitPlacement =
  | 'early_support'
  | 'first_try_fail'
  | 'companion_vulnerability'
  | 'child_discovery'
  | 'brave_action'
  | 'payoff'
  | 'residue'
  | 'middle_complication';

export interface CompanionComicBit {
  id: string;
  companionId: string;
  kind: ComicBitKind;
  situationTags: string[];
  lineHe?: string;
  actionHe?: string;
  placementHint: ComicBitPlacement;
  reusePolicy: 'exact_ok' | 'adapt_required' | 'do_not_repeat_within_story';
  usageNote?: string;
  forbiddenNearCopies?: string[];
}

/** Lines/phrases forbidden in Panda v2 reruns (golden copy guard). */
export const PANDA_ANAT_FORBIDDEN_NEAR_GOLDEN: string[] = [
  'כף הרגל השמאלית כבר השתכנעה',
  'הרגליים רצו פנימה',
  'הבטן ביקשה לחכות',
  'אבן השהייה',
  'אבן קטנה, חלקה מאוד',
  'רכבת כיסאות',
  'אחראי על הגלגלים',
  'לא צריך לרוץ כדי להצטרף',
  'פלופ',
  'עד הקו הצהוב',
];

export const PANDA_ANAT_COMIC_BITS: CompanionComicBit[] = [
  {
    id: 'anat_sand_sit_too_low',
    companionId: 'panda_anat',
    kind: 'physical_gag',
    situationTags: ['sandbox', 'hesitation', 'waiting'],
    actionHe: 'עֲנָת ניסתה להתיישב "רק רגע קטן" ושקעה בחול עד הבטן.',
    lineHe: '"טוב," היא אמרה משם, "זה רגע קצת יותר עמוק ממה שתכננתי."',
    placementHint: 'early_support',
    reusePolicy: 'adapt_required',
    usageNote: 'Anat tries to model calm but her body makes the moment funny.',
  },
  {
    id: 'anat_talks_to_bucket',
    companionId: 'panda_anat',
    kind: 'overliteral_line',
    situationTags: ['bucket', 'try_fail', 'social_hesitation'],
    actionHe: 'עֲנָת רכנה אל הדלי כאילו הוא ילד ביישן.',
    lineHe: '"דלי יקר," לחשה, "גם אתה מחכה לתור שלך?"',
    placementHint: 'first_try_fail',
    reusePolicy: 'adapt_required',
    usageNote: 'After child is blocked from joining; gentle physical humor.',
  },
  {
    id: 'anat_knees_voting',
    companionId: 'panda_anat',
    kind: 'body_before_mind',
    situationTags: ['brave_action', 'standing_up', 'joining'],
    actionHe: 'עֲנָת התחילה לקום, ואז הברכיים שלה עצרו באמצע.',
    lineHe: '"הברכיים שלי ביקשו עוד הצבעה אחת," היא הודתה.',
    placementHint: 'companion_vulnerability',
    reusePolicy: 'adapt_required',
    usageNote: 'Shows Anat is also hesitant — not therapist-like.',
  },
  {
    id: 'anat_leaf_landing_school',
    companionId: 'panda_anat',
    kind: 'overliteral_line',
    situationTags: ['leaf', 'child_discovery'],
    actionHe: 'עֲנָת הניחה כפה רחבה מתחת לעלה, כאילו הוא מתאמן בנחיתה.',
    lineHe: '"עלה כזה," אמרה, "לא ממהר. הוא עושה שיעור נחיתה."',
    placementHint: 'child_discovery',
    reusePolicy: 'adapt_required',
    usageNote: 'Near leaf discovery — concrete, not poetic.',
  },
  {
    id: 'anat_paw_whisper',
    companionId: 'panda_anat',
    kind: 'vulnerable_admission',
    situationTags: ['speaking_up', 'brave_action'],
    actionHe: 'עֲנָת הצמידה כפה לחזה ואז הורידה אותה מהר, כאילו הכפה אמרה משהו לפניה.',
    lineHe: '"הכפה שלי כבר רוצה לעזור," לחשה, "אני עוד מתעדכנת."',
    placementHint: 'brave_action',
    reusePolicy: 'adapt_required',
    forbiddenNearCopies: ['כף הרגל השמאלית כבר השתכנעה'],
    usageNote: 'Fresh replacement for too-near-golden foot line.',
  },
];

/** Forbidden near-golden phrases for Dini v2 fantasy reruns. */
export const DRAGON_DINI_FORBIDDEN_NEAR_GOLDEN: string[] = [
  'ביצה ירוקה',
  'שמירה על הביצה',
  'עטיפת ביצה',
  'כרטיס החיבוק',
  'חיבוק עם פתח',
  'גבול טוב משאיר מקום',
  'ארגז הצעצועים',
  'סרט כסף',
  'גבעות כתומות',
];

export const DRAGON_DINI_COMIC_BITS: CompanionComicBit[] = [
  {
    id: 'dini_tail_tells_truth',
    companionId: 'dragon_dini',
    kind: 'body_before_mind',
    situationTags: ['worry', 'trying_to_be_brave', 'child_hesitation'],
    actionHe: 'דִּינִי אמרה שהיא רגועה לגמרי, אבל הזנב שלה התלפף סביב עצמו כמו בייגלה.',
    lineHe: '"אני רגועה," אמרה דִּינִי. "הזנב שלי פשוט עושה תרגילי חימום."',
    placementHint: 'early_support',
    reusePolicy: 'adapt_required',
    usageNote: 'Dini tries to appear confident but her body reveals worry.',
  },
  {
    id: 'dini_tiny_fire_big_problem',
    companionId: 'dragon_dini',
    kind: 'protective_overreaction',
    situationTags: ['small_problem', 'dragon_scale_misread'],
    actionHe: 'דִּינִי שאפה נשימה גדולה מדי, ואז עצרה מהר וכיסתה את הפה בכנף.',
    lineHe: '"רגע," לחשה, "זו בעיה של ילד, לא בעיה שצריך לצלות."',
    placementHint: 'first_try_fail',
    reusePolicy: 'adapt_required',
    usageNote: 'Dini almost solves a small human problem with too much dragon energy.',
  },
  {
    id: 'dini_nest_logic',
    companionId: 'dragon_dini',
    kind: 'misread',
    situationTags: ['comfort', 'overprotective', 'social_or_fear'],
    actionHe: 'דִּינִי התחילה לאסוף מסביבה דברים רכים: עלה, גרב, כרית קטנה, ועוד עלה.',
    lineHe: '"אם לא יודעים מה לעשות," אמרה, "בונים קן קטן וחושבים משם."',
    placementHint: 'companion_vulnerability',
    reusePolicy: 'adapt_required',
    usageNote: 'Dini comforts through dragon nesting logic.',
  },
  {
    id: 'dini_wing_too_big',
    companionId: 'dragon_dini',
    kind: 'physical_gag',
    situationTags: ['helping', 'careful_body', 'small_space'],
    actionHe: 'דִּינִי ניסתה לזוז בעדינות, אבל כנף אחת סידרה מחדש שלושה עלים ושבלול מבולבל.',
    lineHe: '"סליחה," לחשה לשבלול. "כנף גדולה, כוונה קטנה."',
    placementHint: 'middle_complication',
    reusePolicy: 'adapt_required',
    usageNote: 'Physical comedy — wing moves something the child can notice.',
  },
  {
    id: 'dini_warmth_not_fire',
    companionId: 'dragon_dini',
    kind: 'tiny_ritual',
    situationTags: ['child_discovery', 'gentle_courage'],
    actionHe: 'דִּינִי פתחה את הפה רק קצת, לא לאש — לחום קטן, כמו ספל תה.',
    lineHe: '"לפעמים," אמרה, "לא צריך להבעיר. מספיק לחמם אומץ."',
    placementHint: 'child_discovery',
    reusePolicy: 'adapt_required',
    usageNote: 'Supports child discovery only — Dini does not solve.',
  },
  {
    id: 'dini_egg_protocol',
    companionId: 'dragon_dini',
    kind: 'overliteral_line',
    situationTags: ['waiting', 'patience', 'care'],
    actionHe: 'דִּינִי ספרה על הטפרים: אחת, שתיים, שלוש — ואז שכחה אם דרקונים סופרים גם זנב.',
    lineHe: '"בביצים מחכים," אמרה, "אבל ילדים כנראה בוקעים תוך כדי הליכה."',
    placementHint: 'brave_action',
    reusePolicy: 'adapt_required',
    usageNote: 'When child begins acting before feeling fully ready.',
  },
  {
    id: 'dini_who_called_fire',
    companionId: 'dragon_dini',
    kind: 'overliteral_line',
    situationTags: ['popcorn', 'fire_misread', 'kitchen'],
    lineHe: '"מי קרא אש?"',
    placementHint: 'early_support',
    reusePolicy: 'adapt_required',
    usageNote: 'Dini hears popcorn drama and takes it literally.',
  },
  {
    id: 'dini_kernel_in_distress',
    companionId: 'dragon_dini',
    kind: 'protective_overreaction',
    situationTags: ['popcorn', 'rescue', 'tiny_creature'],
    lineHe: '"גרעין במצוקה!"',
    placementHint: 'first_try_fail',
    reusePolicy: 'adapt_required',
    usageNote: 'Dini treats a popping kernel like an emergency.',
  },
  {
    id: 'dini_popcorn_nest_expert',
    companionId: 'dragon_dini',
    kind: 'misread',
    situationTags: ['popcorn', 'nest', 'overprotective'],
    lineHe: '"אני מומחית לקיני פופקורן."',
    placementHint: 'companion_vulnerability',
    reusePolicy: 'adapt_required',
    usageNote: 'Dini announces expertise while building absurd nest.',
  },
  {
    id: 'dini_not_panic_wings',
    companionId: 'dragon_dini',
    kind: 'vulnerable_admission',
    situationTags: ['overprotective', 'wing', 'denial'],
    lineHe: '"זו לא פאניקה. זו שמירה עם כנפיים."',
    placementHint: 'middle_complication',
    reusePolicy: 'adapt_required',
    usageNote: 'Dini insists she is calm while wings block everything.',
  },
];

const BY_COMPANION: Record<string, CompanionComicBit[]> = {
  panda_anat: PANDA_ANAT_COMIC_BITS,
  dragon_dini: DRAGON_DINI_COMIC_BITS,
};

export function getComicBitsForCompanion(companionId: string): CompanionComicBit[] {
  return BY_COMPANION[companionId] ?? [];
}

export function formatComicBitsForPrompt(bits: CompanionComicBit[]): string {
  if (!bits.length) return '(no comic bits bank for this companion yet)';
  return bits
    .map((b) => {
      const parts = [
        `- id=${b.id} kind=${b.kind} placement=${b.placementHint} reuse=${b.reusePolicy}`,
        b.actionHe ? `  action: ${b.actionHe}` : '',
        b.lineHe ? `  line: ${b.lineHe}` : '',
        b.usageNote ? `  note: ${b.usageNote}` : '',
        b.forbiddenNearCopies?.length
          ? `  do NOT near-copy: ${b.forbiddenNearCopies.join('; ')}`
          : '',
      ];
      return parts.filter(Boolean).join('\n');
    })
    .join('\n\n');
}
