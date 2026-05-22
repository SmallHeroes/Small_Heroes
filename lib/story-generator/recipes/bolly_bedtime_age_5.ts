/**
 * Production Recipe — Bolly the Armadillo / Bedtime Anticipation / Age 5-6.
 *
 * SECOND v0.5 recipe. Authored fresh (no Gold Candidate to reverse-engineer)
 * after bolly_adventure_age_5 was sealed at 3/3 READY, book=5.00.
 *
 * THE CORE DISTINCTION FROM ADVENTURE:
 *   Adventure = PROCEDURE. The medical thing actually happens.
 *   Bedtime   = ANTICIPATION. The exam is TOMORROW. Nothing medical happens
 *               tonight. The thermometer stays on the shelf — observed, never
 *               used. No doctor. No clinic. No sticker. No mother measuring.
 *
 * The child's body tightens not from a procedure but from the THOUGHT of
 * tomorrow. The resilience work is done in the body, at night, in bed:
 * Bolly closes → the child mirrors the close-then-release → a small warm
 * contact → the thermometer becomes lookable → the body softens → sleep.
 *
 * The residue is NOT a sticker. It is: the worry object is still on the
 * shelf, but the body no longer fights it.
 *
 * 10 pages (Pricing v2: bedtime = 10p / ₪59).
 */

import type { ProductionRecipe } from './recipe-types';

export const bollyBedtimeAge5Recipe: ProductionRecipe = {
  id: 'bolly_bedtime_age_5',
  companionId: 'bolly_armadillo',
  category: 'BEDTIME_ANTICIPATION',
  direction: 'bedtime',
  ageTier: '5-6',
  pageCount: 10,

  storyPromise:
    'הילד/ה מתמודד/ת בלילה עם הציפייה לבדיקה של מחר — לא עם ההליך עצמו — ונרדם/ת עם גוף רגוע יותר וקשר חם עם בּוֹלִי.',

  emotionalArc:
    'anticipation → body tightens at the thought of tomorrow → companion closes → child mirrors → small warm contact → the worry object becomes lookable → quiet softening → sleep, the worry smaller',

  resiliencePattern:
    'BEDTIME_ANTICIPATION_BODY_SOFTENING — the child\'s body tightens from the THOUGHT of tomorrow\'s exam, not from a procedure. Bolly closes into a ball; the child mirrors the close-then-release with their own body; a small warm contact with Bolly; the thermometer stays on the shelf, observed not used; the body softens into sleep. Residue: the worry object is still there, but the body no longer fights it.',

  // ─────────────────────────────────────────────────────────────────────
  // VARIATION SLOTS — conservative. worryObject locked to מדחום (the
  // anticipation object is always the thermometer for this category).
  // ─────────────────────────────────────────────────────────────────────
  variationSlots: {
    worryObject: ['מדחום'],
    bedroomLight: [
      'אור לילה רך',
      'מנורה קטנה דולקת',
      'אור עמום מהמסדרון',
    ],
    comfortObject: [
      'השמיכה',
      'הכרית',
      'שמיכה מנומרת',
    ],
    homeRoomDetail: [
      'המדף ליד המיטה',
      'השידה הקטנה',
      'מדף הספרים הנמוך',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  // PAGE CARDS — 10 pages. Age tier 5-6: 2-3 sentences / 18-32 words.
  // ─────────────────────────────────────────────────────────────────────
  pageCards: [
    // ─── ACT 1: EVENING + THE WORRY OBJECT (pages 1-3) ───
    {
      page: 1,
      dramaticRole: 'opening_state',
      requiredEvent:
        'ערב; הילד/ה בחדר לפני השינה; המדחום הקטן נמצא על המדף; מחר יש בדיקה.',
      childBodyState: 'בחדר לפני השינה, מבט נינוח אך ער',
      companionAction: 'בּוֹלִי שוכב קרוב לכרית, לוח קטן אחד פתוח.',
      // Foundation-beat lock — guarantees companion presence on page 1.
      requiredExactLine: 'בּוֹלִי שכב ליד הכרית. טוּמְפּ קטן נשמע.',
      requiredObjectSlot: 'bedroomLight',
      mustInclude: ['בּוֹלִי', 'מדחום', 'מחר'],
      mustNotInclude: [
        'רופאה',
        'מרפאה',
        'אל תפחד',
      ],
      targetWords: 26,
      maxWords: 34,
      maxSentences: 3,
      imageIntent:
        'evening bedroom, soft night light, small thermometer resting on a shelf by the bed, child near the bed, Bolly by the pillow',
    },
    {
      page: 2,
      dramaticRole: 'companion_introduction',
      requiredEvent: 'הילד/ה מתארגן/ת לשינה; בּוֹלִי זז ליד הכרית.',
      childBodyState: 'מתארגן/ת במיטה, תנועות שקטות',
      companionAction: 'בּוֹלִי מתגלגל קצת ליד הכרית; נשמע טוּמְפּ קטן.',
      requiredObjectSlot: 'comfortObject',
      mustInclude: ['בּוֹלִי', 'טוּמְפּ'],
      mustNotInclude: [
        'הציל',
        'הבהב',
      ],
      targetWords: 22,
      maxWords: 30,
      maxSentences: 3,
      imageIntent: 'close-up bed and pillow, Bolly mid small roll, blanket detail',
    },
    {
      page: 3,
      dramaticRole: 'fear_object_revisited',
      requiredEvent:
        'עיני הילד/ה חוזרות אל המדחום שעל המדף; הוא/היא מסיט/ה מבט.',
      childBodyState: 'מבט נמשך אל המדף ואז נסוג; שקט בחוץ, אי-שקט קטן בפנים',
      companionAction: 'בּוֹלִי שקט ליד הכרית.',
      requiredObjectSlot: 'worryObject',
      mustInclude: ['מדחום'],
      mustNotInclude: [
        'נגע',           // the thermometer must NOT touch the child
        'מדדה',
        'בדקה',
      ],
      targetWords: 22,
      maxWords: 30,
      maxSentences: 3,
      imageIntent: 'child in bed, eyes drifting toward the small thermometer on the shelf, then away',
    },

    // ─── ACT 2: THE ANTICIPATION CORE (pages 4-7) ───
    {
      page: 4,
      dramaticRole: 'anticipation_body_resists',
      requiredEvent:
        'המחשבה על מחר גורמת לגוף להתכווץ — כתפיים, יד, נשימה. שום הליך לא קורה.',
      childBodyState:
        'כתפיים עולות מעט, יד נסגרת קצת, נשימה מתקצרת — מהמחשבה על מחר, לא ממגע',
      companionAction: 'בּוֹלִי קרוב, שקט.',
      mustInclude: ['יד'],
      mustNotInclude: [
        'בכתה',          // not crying — quiet anticipation, not collapse
        'צרחה',
        'נגע',           // nothing touches the child tonight
        'אבל אז',        // no narrative cheat-resolve
      ],
      targetWords: 24,
      maxWords: 32,
      maxSentences: 3,
      imageIntent: "close-up child's shoulders rising slightly, hand half-closing, in bed",
      critical: true,
    },
    {
      page: 5,
      dramaticRole: 'companion_closes',
      requiredEvent: 'בּוֹלִי מבצע את המנגנון שלו — נסגר לכדור קטן.',
      childBodyState: 'מרגיש/ה את בּוֹלִי נע לידו/ה',
      companionAction: 'בּוֹלִי נסגר לכדור קטן וחם; נשמע טוּמְפּ רך.',
      mustInclude: ['בּוֹלִי', 'טוּמְפּ', 'כדור'],
      mustNotInclude: [
        'הציל',
        'הגן עליה',
      ],
      targetWords: 22,
      maxWords: 30,
      maxSentences: 3,
      imageIntent: 'close-up Bolly curled into a small ball on the blanket beside the child',
      critical: true,
    },
    {
      page: 6,
      dramaticRole: 'child_mirrors',
      requiredEvent:
        'הילד/ה מבצע/ת את המנגנון בגוף שלו/ה — סוגר/ת ופותח/ת יד, או מתכרבל/ת ואז משחרר/ת.',
      childBodyState:
        'יד נסגרת לאגרוף קטן ואז נפתחת לאט; או גוף מתכרבל ואז מתרכך מעט',
      companionAction: 'בּוֹלִי לא מופיע במפורש (הילד/ה הוא/היא המראָה).',
      mustInclude: ['יד'],
      mustNotInclude: [
        'בּוֹלִי אמר',   // companion does not speak instruction
        'נזכרה ש',       // no narrator-cheat memory
      ],
      targetWords: 24,
      maxWords: 32,
      maxSentences: 3,
      imageIntent: 'close-up small hand closing to a fist then opening slowly, on the blanket',
      critical: true,
    },
    {
      page: 7,
      dramaticRole: 'companion_contact',
      requiredEvent:
        'מגע קטן בבּוֹלִי — לא חיבוק גדול, לא על הכתף. לוח קטן נפתח, ובפנים חם.',
      childBodyState: 'יד מושטת, אצבע נוגעת בבּוֹלִי בעדינות',
      companionAction: 'בּוֹלִי קרוב; לוח קטן נפתח; בפנים חם.',
      mustInclude: ['בּוֹלִי'],
      mustNotInclude: [
        'חיבוק',         // not a big hug — a small contact
        'חיבקה',
        'חיבק',
        'על הכתף',       // armadillo doesn't perch
        'ישב על כתפה',
      ],
      targetWords: 22,
      maxWords: 30,
      maxSentences: 3,
      imageIntent: "close-up child's finger gently touching Bolly, one small plate open, warm glow inside",
      critical: true,
    },

    // ─── ACT 3: SOFTENING + SLEEP (pages 8-10) ───
    {
      page: 8,
      dramaticRole: 'object_revisited_safely',
      requiredEvent:
        'המדחום עדיין על המדף — אבל עכשיו אפשר להביט בו רגע, בלי שהגוף נסוג.',
      childBodyState: 'מבט נח על המדחום; הגוף לא מתכווץ הפעם',
      companionAction: 'בּוֹלִי שקט, קרוב.',
      requiredObjectSlot: 'worryObject',
      mustInclude: ['מדחום'],
      mustNotInclude: [
        'נגע',
        'מדדה',
        'בדקה',
        'נעלם',          // the worry object does NOT disappear — it stays
        'כבר לא פחד',    // no "fear gone" — anticipation is softened, not erased
      ],
      targetWords: 22,
      maxWords: 30,
      maxSentences: 3,
      imageIntent: 'child looking calmly at the thermometer still resting on the shelf, body relaxed',
    },
    {
      page: 9,
      dramaticRole: 'quiet_spark_settling',
      // The bedtime memorability beat — a SOFT spark, not a joke. Quiet.
      requiredEvent:
        'spark שקט: בּוֹלִי מזיז את הכרית טיפ-טיפה, נשמע טוּמְפּ קטן, והילד/ה מחייך/ת בשקט; הגוף מתרכך.',
      childBodyState: 'חיוך קטן ושקט; הגוף מתרכך, נשימה איטית',
      companionAction: 'בּוֹלִי מזיז את הכרית טיפ-טיפה; נשמע טוּמְפּ קטן.',
      requiredObjectSlot: 'comfortObject',
      // v0.5.0-b: dropped 'חייך' from mustInclude. It is a GENDER-INFLECTED
      // verb (masculine) — forcing the literal token produced "נועה חייך"
      // (a girl) instead of "חייכה". mustInclude must only ever hold
      // gender-neutral anchors (names, sounds, objects, body parts).
      // The smile still lives in requiredEvent + childBodyState, where the
      // Author inflects it correctly for the child's gender.
      mustInclude: ['בּוֹלִי', 'טוּמְפּ'],
      mustNotInclude: [
        'קסם',           // keep it physical — no magic
        'מצחיק מאוד',    // a QUIET spark, not loud comedy
        'צחקה בקול',
        'גאה בעצמה',
      ],
      targetWords: 26,
      maxWords: 34,
      maxSentences: 4,
      imageIntent: "close-up Bolly nudging the pillow a touch, child's small quiet smile, body soft in bed",
    },
    {
      page: 10,
      dramaticRole: 'sleep_with_residue',
      requiredEvent:
        'הילד/ה נרדם/ת; המדחום עדיין על המדף למחר; בּוֹלִי ליד היד; הגוף רגוע.',
      childBodyState: 'שכיבה, נשימה רגועה, יד שמורה לצד',
      companionAction: 'בּוֹלִי נרדם ליד היד, ובפנים חם.',
      requiredObjectSlot: 'worryObject',
      mustInclude: ['בּוֹלִי', 'מדחום'],
      mustNotInclude: [
        'בוקר',          // ending is sleep — NOT morning
        'מחר כבר',       // do not jump past tomorrow
        'קם',
        'הלכו לבדיקה',
        'למדה ש',        // NO moral
        'הבינה ש',
        'עכשיו אמיץ',
        'כבר לא פחד',
      ],
      targetWords: 24,
      maxWords: 32,
      maxSentences: 3,
      imageIntent: 'close-up bedside warm light, child asleep, thermometer still small on the shelf, Bolly snug by the hand',
    },
  ],

  // ─────────────────────────────────────────────────────────────────────
  // FORBIDDEN PATTERNS — global. Validator rejects on any match (BLOCKING).
  // ─────────────────────────────────────────────────────────────────────
  forbiddenPatterns: [
    // ── Anticipation-frame breakers — the procedure must NOT happen ──
    'אמא מדדה',
    'מדדה את החום',
    'מדדה חום',
    'בדקה חום',
    'בדקה את החום',
    'לקחה את המדחום',
    'המדחום נגע',
    'הכניסה את המדחום',
    'רופאה',
    'מרפאה',
    'מדבקה',
    'הלכו לבדיקה',
    'הלכה לבדיקה',
    // ── Time-frame breakers — the story ends at sleep, not morning ──
    'מחר כבר עבר',
    'בבוקר קם',
    'בבוקר קמה',
    'למחרת בבוקר',
    'כשהשמש עלתה',
    // ── Moral / lesson endings ──
    'הבינה ש',
    'הבין ש',
    'למדה ש',
    'למד ש',
    'עכשיו אמיץ',
    'עכשיו אמיצה',
    'כבר לא פחד',
    'כבר לא פחדה',
    'מעכשיו והלאה',
    'גאה בעצמה',
    'גאה בעצמו',
    // ── AI-smell / poetic clichés ──
    'לב התמלא',
    'שקט שרר',
    'האור ליטף',
    'שקט לבן',
    'ריח ילדות',
    'האוויר נהיה דק',
    'נהיה דק ושקט',
    'פתוח חלקית',
    // ── Companion-speech guards. Bolly is a body, not a voice. ──
    'בּוֹלִי אמר',
    'בּוֹלִי אומר',
    'בּוֹלִי לחש',
    'בולי אמר',
    'בולי אומר',
    'בולי לחש',
    'אמר בּוֹלִי',
    'אמר בולי',
    // ── Action-hero / rescuer framing ──
    'בּוֹלִי הציל',
    'בּוֹלִי הגן',
    'בּוֹלִי לחם',
  ],

  // ─────────────────────────────────────────────────────────────────────
  // ACCEPTANCE CRITERIA — Y-lite reviewers anchor on these.
  // ─────────────────────────────────────────────────────────────────────
  acceptanceCriteria: [
    'NO procedure happens tonight. The exam is tomorrow. The thermometer stays on the shelf — observed, never used. No doctor, no clinic, no sticker, no mother measuring temperature.',
    'The child\'s body tightens (pages 3-4) from the THOUGHT of tomorrow, not from anything touching them.',
    'Bolly performs its core mechanic (closing into a ball with טוּמְפּ) on page 5, AFTER the anticipation-resist and BEFORE the child mirrors.',
    'The child mirrors Bolly with their own body — hand closing and opening, or curling and releasing — on page 6.',
    'The contact with Bolly on page 7 is SMALL — a finger touch, a panel opening — never a big hug, never on the shoulder.',
    'On page 8 the thermometer is still on the shelf, and the child can look at it without the body recoiling. It does NOT disappear.',
    'The ending (page 10) is SLEEP, with the body calm. NOT morning, NOT going to the exam, NOT a moral. The thermometer is still present — the worry is smaller, not erased.',
    'Bolly cannot be replaced by a generic teddy bear — the closing-into-ball mechanic must carry the resilience moment.',
    'Bolly never speaks to instruct the child. The mirroring is bodily, not verbal.',
  ],

  qualityTarget: {
    // No bedtime Gold yet — anchor quality against the sealed Adventure Gold.
    goldCandidateId: 'bolly_adventure_v0.5.0-f_gold',
    minBookScore: 4.7,
    minResilienceScore: 4.8,
    maxTechnicalRetries: 2,
    maxAuthorRerolls: 1,
  },

  meta: {
    version: '0.5.0-b',
    derivedFrom: 'authored fresh — bedtime anticipation pattern (no Gold to reverse-engineer)',
    authoredAt: '2026-05-22',
    authoredBy: 'CTO + ChatGPT consult',
    notes: [
      'Second v0.5 Production Recipe. Bedtime = ANTICIPATION, not procedure.',
      'The exam is tomorrow; nothing medical happens tonight. Thermometer stays on the shelf — observed, never used.',
      '10-beat structure approved by user 2026-05-22: opening → companion-intro → fear-object-revisited → anticipation-body-resists → companion-closes → child-mirrors → companion-contact → object-revisited-safely → quiet-spark-settling → sleep-with-residue.',
      'Residue is NOT a sticker — it is "the worry object is still on the shelf, but the body no longer fights it".',
      'p9 is the bedtime spark beat — a QUIET spark (pillow nudge + small toomp + quiet smile), never loud comedy. Caps bumped to 4 sentences / 34 words.',
      'pages 4-7 tagged critical=true — the anticipation resilience core.',
      'forbiddenPatterns includes anticipation-frame breakers (no procedure, no doctor, no sticker) and time-frame breakers (story ends at sleep, not morning).',
      'v0.5.0-b: removed "חייך" from p9 mustInclude — it is a gender-inflected verb and forcing the literal token produced "נועה חייך" (wrong gender for a girl). RULE: mustInclude holds only gender-neutral anchors.',
    ],
  },
};

export default bollyBedtimeAge5Recipe;
