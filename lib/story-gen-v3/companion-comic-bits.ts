/**
 * Generator-v3 companion comic bits bank.
 */

import type {
  CompanionComicBit,
  ComicBitPlacement,
} from '../story-gen-v2/companion-comic-bits';

export type { CompanionComicBit, ComicBitPlacement };

/** Forbidden near-golden — fox_uri bedtime golden (v5). */
export const FOX_URI_FORBIDDEN_NEAR_GOLDEN: string[] = [
  'מפלצת-המעיל',
  'חולצה עם דמיון מפותח',
  'גחלילית ביישנית',
  'מאירים טיפונת — לא את כל החושך',
  'לא חייבים להאיר את כל החושך',
  'אני מתקרב אבל לא בהגזמה',
  'כרטיס הפנס',
  'ענף קטן עם קול של ענק',
  'האוזניים שלך בדקו מצוין',
  'ידעתי. כמעט',
];

/**
 * fox_uri comic bank — Sprint 11 prereq.
 * Guy approved 2026-06-11.
 * Uri = brave-but-overconfident night scout; lantern = courage meter; NOT wise helper.
 * Dosage: prose picks 3–5 bits per story (see V3_COMIC_BIT_DOSAGE_INSTRUCTION) — never the full bank.
 */
export const FOX_URI_COMIC_BITS: CompanionComicBit[] = [
  {
    id: 'uri_coat_monster_proud_scout',
    companionId: 'fox_uri',
    kind: 'misread',
    situationTags: ['shadow', 'night', 'fear_misunderstanding'],
    actionHe: 'אוּרי מאיר את הצל ומכריז שהוא "חיה לילית חשודה" — לפני שהאור מגיע לכפתור.',
    lineHe: '"חשוד מאוד," לחש. "ידעתי מרגע ראשון. כמעט."',
    placementHint: 'early_support',
    reusePolicy: 'adapt_required',
    usageNote: 'Wrong shadow reading + proud-scout mistake; child-visible humor.',
  },
  {
    id: 'uri_lantern_ember_brave_words',
    companionId: 'fox_uri',
    kind: 'body_before_mind',
    situationTags: ['lantern', 'scared', 'tap_sound'],
    actionHe: 'כשנשמע תקתוק, הפנס של אוּרי מתכווץ לגחלילית קטנה.',
    lineHe: '"זה בסדר גמור," אמר בקול אמיץ מדי. "אני בודק את זה. רשמית."',
    placementHint: 'middle_complication',
    reusePolicy: 'adapt_required',
    usageNote: 'Lantern form 1 — shrinks while voice overclaims control.',
  },
  {
    id: 'uri_tail_hides_before_words',
    companionId: 'fox_uri',
    kind: 'physical_gag',
    situationTags: ['tail', 'body_language', 'fear_leak'],
    actionHe: 'קצה הזנב הלבן של אוּרי מתחבא מאחורי רגל לפני שהוא מודה שמשהו מפחיד.',
    lineHe: '"אני לא מפחד," אמר. הזנב לא הסכים.',
    placementHint: 'companion_vulnerability',
    reusePolicy: 'adapt_required',
    usageNote: 'Tail betrays fear before words — signature Uri leak.',
  },
  {
    id: 'uri_night_path_paw_marks',
    companionId: 'fox_uri',
    kind: 'tiny_ritual',
    situationTags: ['path', 'yard', 'scout_pride'],
    actionHe: 'אוּרי מסמן שביל לילה בטביעות קטנות — כאילו זה מפת גילוי רשמית.',
    lineHe: '"שביל מאומת," לחש בגאווה. "עברתי כאן קודם. פעמיים."',
    placementHint: 'early_support',
    reusePolicy: 'adapt_required',
    usageNote: 'Night-path pride — scout energy, not wizard guide.',
  },
  {
    id: 'uri_child_ears_correct',
    companionId: 'fox_uri',
    kind: 'misread',
    situationTags: ['sound', 'child_agency', 'correction'],
    actionHe: 'אוּרי מצביע מתחת למיטה — ומי שמקשיב מטה את האוזניים לחלון.',
    lineHe: '"נכון," אמר אוּרי, מופתע. "האוזניים שלך הגיעו לשם לפני."',
    placementHint: 'child_discovery',
    reusePolicy: 'adapt_required',
    usageNote: 'Child corrects Uri — agency transfer beat.',
  },
  {
    id: 'uri_quiet_glow_one_step',
    companionId: 'fox_uri',
    kind: 'vulnerable_admission',
    situationTags: ['quiet_courage', 'small_step', 'no_bravado'],
    actionHe: 'בלי מילים גדולות, אוּרי מאיר עיגול קטן אחד על הרצפה — ומחכה.',
    lineHe: '"רק כזה," לחש. "מספיק לצעד אחד."',
    placementHint: 'brave_action',
    reusePolicy: 'adapt_required',
    usageNote: 'Quiet courage — light without hero speech.',
  },
  {
    id: 'uri_lantern_swells_wrong_id',
    companionId: 'fox_uri',
    kind: 'physical_gag',
    situationTags: ['lantern', 'wrong_guess', 'overconfidence'],
    actionHe: 'אחרי זיהוי שגוי, הפנס של אוּרי נתפח בגאווה — ואז נכבה חצי כשהאמת נחשפת.',
    lineHe: '"ראית?" אמר. "זה בדיוק מה שחשבתי. אולי."',
    placementHint: 'first_try_fail',
    reusePolicy: 'adapt_required',
    usageNote: 'Lantern form 2 — swells on false pride, dims on truth.',
  },
  {
    id: 'uri_jump_scare_sock',
    companionId: 'fox_uri',
    kind: 'physical_gag',
    situationTags: ['jump_scare', 'tiny', 'laundry'],
    actionHe: 'אוּרי קופץ אחורה מגרב אחת — ואז מנסה להיראות כאילו זה היה חלק מהתוכנית.',
    lineHe: '"בדיקת הפתעה," אמר. "עברה. כמעט."',
    placementHint: 'first_try_fail',
    reusePolicy: 'adapt_required',
    usageNote: 'Tiny jump-scare; child-visible, not horror.',
  },
  {
    id: 'uri_scout_clipboard_voice',
    companionId: 'fox_uri',
    kind: 'overliteral_line',
    situationTags: ['official_voice', 'scout', 'avoid'],
    actionHe:
      'אוּרי שולף פנקס קטן כאילו הוא פקח לילה, ומסמן ליד הצל סימון חשוב מאוד.',
    lineHe: '"לפי תקנון הסיור הלילי," הכריז אוּרי, "הצל הזה דורש בדיקה מסודרת."',
    placementHint: 'middle_complication',
    reusePolicy: 'adapt_required',
    usageNote: 'Bureaucrat-scout slip — then undercut with physical fear leak.',
  },
  {
    id: 'uri_lantern_flicker_too_close',
    companionId: 'fox_uri',
    kind: 'body_before_mind',
    situationTags: ['lantern', 'overconfident', 'too_fast'],
    actionHe: 'אוּרי מתקרב מהר מדי — והפנס מהבהב כמו שואל "בטוח?"',
    lineHe: '"אני מתקרב," אמר. הפנס עשה הבהוב קטן.',
    placementHint: 'middle_complication',
    reusePolicy: 'adapt_required',
    usageNote: 'Lantern form 3 — flickers when Uri overreaches.',
  },
  {
    id: 'uri_boot_shadow_dramatic_name',
    companionId: 'fox_uri',
    kind: 'misread',
    situationTags: ['shadow', 'wrong_reading', 'humor'],
    actionHe: 'אוּרי נותן לצל של נעל שם דרמטי — לפני שהאור חושף סתם שרוך ארוך.',
    lineHe: '"מפלצת-הנעל!" לחש. "רגע. זה רק שרוך."',
    placementHint: 'child_discovery',
    reusePolicy: 'adapt_required',
    usageNote: 'Fear-misunderstanding + dramatic naming + downgrade.',
  },
  {
    id: 'uri_lantern_steady_after_child',
    companionId: 'fox_uri',
    kind: 'residue_callback',
    situationTags: ['lantern', 'child_led', 'payoff'],
    actionHe: 'אחרי שמי שמוביל כבר בדרך, הפנס של אוּרי נשאר יציב וחם — בלי להתפאר.',
    lineHe: '"עכשיו אני רק מאיר," לחש. "מי שבודק — כבר כאן."',
    placementHint: 'payoff',
    reusePolicy: 'adapt_required',
    usageNote: 'Lantern form 4 — steady glow; Uri follows child agency.',
  },
];

/** Forbidden near-golden phrases — chameleon_koko adventure/bedtime/fantasy. */
export const CHAMELEON_KOKO_FORBIDDEN_NEAR_GOLDEN: string[] = [
  'זנב-עוגן',
  'זְנַב־עוגן',
  'אפשר להיות קצת כמו המקום',
  'לא להפוך למקום',
  'התאמתי לארגז קצת יותר מדי',
  'חצי ירוקה, חצי קרטון',
  'נבלעת בקיר',
  'פסים לבנים',
  'כרטיס הזנב',
  'בית חדש מרגיש לבן מדי',
  'פששש',
  'צעיף',
];

export const CHAMELEON_KOKO_COMIC_BITS: CompanionComicBit[] = [
  {
    id: 'koko_panic_orange_calm_words',
    companionId: 'chameleon_koko',
    kind: 'misread',
    situationTags: ['new_place', 'nervous', 'moving'],
    lineHe: '"אני רגועה לגמרי," אמרה קוֹקוֹ, בזמן שהיא מהבהבת כתום-פאניקה.',
    placementHint: 'early_support',
    reusePolicy: 'adapt_required',
    usageNote: 'Color betrays feeling before words — not therapy talk.',
  },
  {
    id: 'koko_striped_wall_only',
    companionId: 'chameleon_koko',
    kind: 'physical_gag',
    situationTags: ['camouflage_fail', 'hallway', 'new_room'],
    actionHe: 'קוֹקוֹ נדבקה לקיר — ובחרה דווקא את הקיר עם פסים.',
    lineHe: '"מצוין," לחשה. "עכשיו אף אחד לא יראה אותי. חוץ מכל הפסים."',
    placementHint: 'first_try_fail',
    reusePolicy: 'adapt_required',
    usageNote: 'Over-camouflage at worst moment.',
  },
  {
    id: 'koko_backpack_eyes',
    companionId: 'chameleon_koko',
    kind: 'physical_gag',
    situationTags: ['backpack', 'hide', 'transition'],
    actionHe: 'קוֹקוֹ התחבאה על התיק — והפכה לצבע התיק, חוץ מהעיניים.',
    lineHe: '"זה מסתווה מושלם," אמרה. "רק העיניים שלי לא קיבלו הודעה."',
    placementHint: 'middle_complication',
    reusePolicy: 'adapt_required',
  },
  {
    id: 'koko_new_place_gray',
    companionId: 'chameleon_koko',
    kind: 'vulnerable_admission',
    situationTags: ['new_place', 'doorway', 'hesitation'],
    actionHe: 'קוֹקוֹ הפכה לאפור-מקום-חדש לפני שאמרה מילה.',
    lineHe: '"זה הצבע שלי כשמקום חדש עדיין לא מכיר אותי," לחשה.',
    placementHint: 'companion_vulnerability',
    reusePolicy: 'adapt_required',
  },
  {
    id: 'koko_confetti_too_early',
    companionId: 'chameleon_koko',
    kind: 'body_before_mind',
    situationTags: ['celebration', 'premature', 'unpacking'],
    actionHe: 'קוֹקוֹ קפצה לפני שהארגז נפתח — והפכה לצבע קונפטי.',
    lineHe: '"ניצחון!" צעקה. "רגע, עוד לא ניצחנו כלום."',
    placementHint: 'payoff',
    reusePolicy: 'adapt_required',
    usageNote: 'Only if child action succeeded first — comic release.',
  },
  {
    id: 'koko_thought_color_leak',
    companionId: 'chameleon_koko',
    kind: 'misread',
    situationTags: ['misread', 'child_want', 'label', 'sticker'],
    lineHe: '"אני לא חושבת על זה," אמרה קוֹקוֹ — והזנב שלה כבר ירוק-שקט.',
    placementHint: 'child_discovery',
    reusePolicy: 'adapt_required',
    usageNote: 'Koko denies worry while color leaks the truth.',
  },
];

/** Forbidden near-golden — lion_shaket fantasy (sound-weight world). */
export const LION_SHAKET_FORBIDDEN_NEAR_GOLDEN: string[] = [
  'שאגות עפות גבוה',
  'הלחישות נחות נמוכ',
  'עולם של קולות שיש להם משקל',
  'השאגה שבתוך הלב',
  'ליאו',
  'Leo quietly presses his paw',
  'whisper fell',
];

export const LION_SHAKET_COMIC_BITS: CompanionComicBit[] = [
  {
    id: 'lion_very_quiet_rattle',
    companionId: 'lion_shaket',
    kind: 'misread',
    situationTags: ['volume', 'anger', 'try_calm'],
    lineHe: '"אני אהיה מאוד שקט," הכריז ליאו — בקול שרעיד את המדף.',
    placementHint: 'early_support',
    reusePolicy: 'adapt_required',
    usageNote: 'Announces quiet in a loud voice — sound has weight.',
  },
  {
    id: 'lion_roar_fish_measure',
    companionId: 'lion_shaket',
    kind: 'physical_gag',
    situationTags: ['roar', 'measure', 'control'],
    actionHe: 'ליאו מודד את השאגה בכפות הרגליים כמו דג.',
    lineHe: '"זה קטן, אני מבטיח," אמר. "זה רק שאגה קטנה."',
    placementHint: 'first_try_fail',
    reusePolicy: 'adapt_required',
  },
  {
    id: 'lion_whisper_squeak_proud',
    companionId: 'lion_shaket',
    kind: 'vulnerable_admission',
    situationTags: ['whisper', 'small_sound', 'pride'],
    actionHe: 'ליאו מחזיק לחישה בזהירות — והיא יוצאת כציוץ קטן.',
    lineHe: '"ראית?" לחש. "זה הציוץ שלי. אני גאה בו."',
    placementHint: 'child_discovery',
    reusePolicy: 'adapt_required',
  },
  {
    id: 'lion_tail_thump_words',
    companionId: 'lion_shaket',
    kind: 'body_before_mind',
    situationTags: ['tail', 'calm_attempt', 'leak'],
    actionHe: 'הזנב של ליאו מכה ברצפה על כל מילה שהוא מנסה לומר בשקט.',
    lineHe: '"אני רגוע," אמר — והזנב הכה שוב.',
    placementHint: 'middle_complication',
    reusePolicy: 'adapt_required',
  },
  {
    id: 'lion_gentle_roar_leaf',
    companionId: 'lion_shaket',
    kind: 'physical_gag',
    situationTags: ['practice', 'gentle', 'fail'],
    actionHe: 'ליאו מתרגל "שאגה עדינה" — ועלה עדיין עף מהשולחן.',
    lineHe: '"זה היה עדין," אמר. "לעלה זה לא חשב."',
    placementHint: 'first_try_fail',
    reusePolicy: 'adapt_required',
  },
];

/** Forbidden near-golden — bunny_ometz bedtime. */
export const BUNNY_OMETZ_FORBIDDEN_NEAR_GOLDEN: string[] = [
  'ואולי גם',
  'הסיפור שגדל יותר מדי',
  'עולם של תרחישים שמתממשים בקטן',
  'בוּנִי',
  'האוזניים שטוחות',
  'המדליה מחליקה',
];

export const BUNNY_OMETZ_COMIC_BITS: CompanionComicBit[] = [
  {
    id: 'bunny_ears_not_nervous',
    companionId: 'bunny_ometz',
    kind: 'body_before_mind',
    situationTags: ['denial', 'nervous', 'ears'],
    actionHe: 'האוזניים של בוּנִי זקפו ברגע שהוא אמר "אני בכלל לא לחוץ."',
    lineHe: '"ראית?" אמר. "רגוע לגמרי."',
    placementHint: 'early_support',
    reusePolicy: 'adapt_required',
  },
  {
    id: 'bunny_brave_sentence_backwards',
    companionId: 'bunny_ometz',
    kind: 'physical_gag',
    situationTags: ['rehearse', 'brave', 'stumble'],
    actionHe: 'בוּנִי מתרגל משפט אמיץ שלוש פעמים — ובפעם השלישית הוא יוצא הפוך.',
    lineHe: '"א... א... אמיץ אני," לחש. "לא, רגע."',
    placementHint: 'first_try_fail',
    reusePolicy: 'adapt_required',
  },
  {
    id: 'bunny_ear_flop_hold',
    companionId: 'bunny_ometz',
    kind: 'misread',
    situationTags: ['scared', 'hide', 'ear'],
    actionHe: 'אוזן אחת נשמטה כשהוא מפחד — והוא מחזיק אותה בכף הרגל כאילו כלום לא קרה.',
    lineHe: '"זה תמיד ככה," אמר. "אין מה לדאוג."',
    placementHint: 'middle_complication',
    reusePolicy: 'adapt_required',
  },
  {
    id: 'bunny_whisper_true_lands',
    companionId: 'bunny_ometz',
    kind: 'vulnerable_admission',
    situationTags: ['quiet_truth', 'small_sentence'],
    lineHe: 'בוּנִי לוחש את הדבר הכי אמיתי — קטן מאוד — ועדיין הוא נשמע גדול מהצעקה.',
    placementHint: 'child_discovery',
    reusePolicy: 'adapt_required',
    usageNote: 'Quiet true courage — not “be brave”.',
  },
  {
    id: 'bunny_chest_hiccup',
    companionId: 'bunny_ometz',
    kind: 'physical_gag',
    situationTags: ['brave_pose', 'hiccup'],
    actionHe: 'בוּנִי נופח חזה כדי להיראות אמיץ — ושיהוק קטן הורס את זה.',
    lineHe: '"זה היה אמיץ," אמר. "השיהוק לא נספר."',
    placementHint: 'payoff',
    reusePolicy: 'adapt_required',
  },
];

/** Forbidden near-golden — turtle_beiti adventure (homesickness). */
export const TURTLE_BEITI_FORBIDDEN_NEAR_GOLDEN: string[] = [
  'האור פה אחר',
  'עולם של בתים-שזזים',
  'טוֹלִי',
  'Beiti slowly presses her nose to the shawl',
  'הבית בלב',
  'הבית תמיד איתך',
];

export const TURTLE_BEITI_COMIC_BITS: CompanionComicBit[] = [
  {
    id: 'turtle_shell_guest_house',
    companionId: 'turtle_beiti',
    kind: 'misread',
    situationTags: ['shell', 'home', 'offer'],
    lineHe: '"יש לי בית אורחים," אמרה טוֹלִי. "שתי חדרים, חלון אחד, מאוד נוח."',
    placementHint: 'early_support',
    reusePolicy: 'adapt_required',
  },
  {
    id: 'turtle_shell_wrong_moment',
    companionId: 'turtle_beiti',
    kind: 'physical_gag',
    situationTags: ['retreat', 'shell', 'timing'],
    actionHe: 'טוֹלִי נמשכת לתוך הקונכייה ברגע הלא נכון — ומדברת מבפנים מעומעם.',
    lineHe: '"אני כאן," אמרה. "פשוט... מבפנים."',
    placementHint: 'first_try_fail',
    reusePolicy: 'adapt_required',
  },
  {
    id: 'turtle_pack_on_shell',
    companionId: 'turtle_beiti',
    kind: 'physical_gag',
    situationTags: ['pack', 'travel', 'overload'],
    actionHe: 'טוֹלִי "אורזת לנסיעה" — שמה דברים על הקונכייה עד שלא רואים כלום.',
    lineHe: '"הכול בבית," אמרה. "פשוט על הגב."',
    placementHint: 'middle_complication',
    reusePolicy: 'adapt_required',
  },
  {
    id: 'turtle_already_home',
    companionId: 'turtle_beiti',
    kind: 'misread',
    situationTags: ['denial', 'homesick', 'anywhere'],
    lineHe: '"אני כבר בבית," אמרה טוֹלִי — לא משנה איפה היא עומדת.',
    placementHint: 'companion_vulnerability',
    reusePolicy: 'adapt_required',
  },
  {
    id: 'turtle_shell_under_table',
    companionId: 'turtle_beiti',
    kind: 'physical_gag',
    situationTags: ['measure', 'new_place', 'fit'],
    actionHe: 'טוֹלִי בודקת מקום חדש לפי אם הקונכייה נכנסת מתחת לשולחן.',
    lineHe: '"כאן יש מקום," אמרה. "מתחת לשולחן — זה סלון."',
    placementHint: 'child_discovery',
    reusePolicy: 'adapt_required',
  },
];

export function getV3ComicBitsForCompanion(companionId: string): CompanionComicBit[] {
  if (companionId === 'fox_uri') return FOX_URI_COMIC_BITS;
  if (companionId === 'chameleon_koko') return CHAMELEON_KOKO_COMIC_BITS;
  if (companionId === 'lion_shaket') return LION_SHAKET_COMIC_BITS;
  if (companionId === 'bunny_ometz') return BUNNY_OMETZ_COMIC_BITS;
  if (companionId === 'turtle_beiti') return TURTLE_BEITI_COMIC_BITS;
  return [];
}

export function getV3ForbiddenNearGolden(companionId: string): string[] {
  if (companionId === 'fox_uri') return FOX_URI_FORBIDDEN_NEAR_GOLDEN;
  if (companionId === 'chameleon_koko') return CHAMELEON_KOKO_FORBIDDEN_NEAR_GOLDEN;
  if (companionId === 'lion_shaket') return LION_SHAKET_FORBIDDEN_NEAR_GOLDEN;
  if (companionId === 'bunny_ometz') return BUNNY_OMETZ_FORBIDDEN_NEAR_GOLDEN;
  if (companionId === 'turtle_beiti') return TURTLE_BEITI_FORBIDDEN_NEAR_GOLDEN;
  return [];
}

/** Wired into prose-gen-v3 — select subset per story; never dump full bank. */
export const V3_COMIC_BIT_DOSAGE_INSTRUCTION = `## Comic bit dosage (MANDATORY)
From the bank below, SELECT 3–5 bits whose placementHint fits this story's rhythm and page beats.
NEVER weave all bank bits into one story.
Max 1 adapted bank bit per page.
Do NOT cluster Uri proud-scout tics (כמעט / אולי / רשמית / ידעתי) on the same page — spread across the arc.
Adapt lines into natural Hebrew; never emit bit ids or [snake_case] tokens.`.trim();

export function formatV3ComicBitsForPrompt(bits: CompanionComicBit[]): string {
  if (bits.length === 0) return '';
  const catalog = bits
    .map(
      (b) =>
        `- bit id=${b.id} (INTERNAL — never emit [${b.id}] or any [snake_case] token in prose)\n  kind: ${b.kind} | placement: ${b.placementHint}\n  line: ${b.lineHe ?? ''}\n  action: ${b.actionHe ?? ''}\n  note: ${b.usageNote ?? ''}`
    )
    .join('\n');
  return `${V3_COMIC_BIT_DOSAGE_INSTRUCTION}\n\n${catalog}`;
}

export function buildV3ComicBitBankPromptBlock(companionId: string): string {
  const bits = getV3ComicBitsForCompanion(companionId);
  return bits.length ? formatV3ComicBitsForPrompt(bits) : '';
}
