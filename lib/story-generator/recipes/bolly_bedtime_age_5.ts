/**
 * Production Recipe — Bolly the Armadillo / Bedtime Anticipation / Age 5-6.
 *
 * Bedtime = ANTICIPATION, not procedure. The exam is TOMORROW. Nothing
 * medical happens tonight — the thermometer stays on the shelf, observed,
 * never used. No doctor, no clinic, no sticker. The child's body tightens
 * from the THOUGHT of tomorrow; the resilience work is done in the body,
 * at night, in bed: Bolly closes → the child mirrors → a small warm
 * contact → the worry object becomes lookable → the body softens → sleep.
 * Residue: the worry object is still on the shelf, but the body no longer
 * fights it.
 *
 * v0.5.6 — converted to the SEALED Fantasy/Adventure standard (B.3/B.4/B.5):
 *   - B.3: 9 of 10 pages are a 4-beat relationshipLoop (childFeels →
 *     companionAnswers → childNotices → shift). Only p4 (anticipation-
 *     resists) is SOLO — and even there Bolly is present in the scene,
 *     still, his answer held for the p5 turn. Bolly is never absent.
 *   - B.4: loopType per loop (relief / no-relief / hold / spark). Relief
 *     is WITHHELD through p3-p4 and ACCUMULATES toward sleep; p8 'hold'
 *     keeps the back half from being relief-on-every-page.
 *   - B.5: nameAnchor on 4 arc-spread pages (deliberately fewer than
 *     Adventure's 8 — a direct fix for the name-count debt); 2 soft
 *     whispered direct-communication beats (p5, p6). Gender-neutral /ה
 *     placeholders. maxSentences 4 on loop pages; word caps pre-sized
 *     for 4-beat loops.
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
  // PAGE CARDS — 10 pages. Age tier 5-6.
  // v0.5.6 (B.3): 9 pages carry a 4-beat relationshipLoop; p4 stays SOLO.
  // v0.5.6 (B.4): loopType distribution —
  //   p1 relief · p2 relief · p3 no-relief · p4 SOLO · p5 relief (TURN) ·
  //   p6 spark · p7 relief · p8 hold · p9 spark · p10 relief.
  // Relief is withheld through p3-p4 and accumulates toward sleep. Bolly
  // is present in the prose on every page, including the p4 solo beat.
  // ─────────────────────────────────────────────────────────────────────
  pageCards: [
    // ─── ACT 1: EVENING + THE WORRY OBJECT (pages 1-3) ───
    {
      page: 1,
      nameAnchor: true,
      dramaticRole: 'opening_state',
      requiredEvent:
        'ערב; הילד/ה בחדר לפני השינה; המדחום הקטן נמצא על המדף; מחר יש בדיקה.',
      childBodyState: 'בחדר לפני השינה, מבט נינוח אך ער',
      companionAction: 'בּוֹלִי שוכב קרוב לכרית, פס שריון קטן אחד פתוח.',
      relationshipLoop: {
        loopType: 'relief',
        childFeels: 'ערב יורד על החדר; הילד/ה במיטה, והמדחום הקטן על המדף מזכיר שמחר יש בדיקה.',
        companionAnswers: 'בּוֹלִי, ליד הכרית, מזיז פס שריון קטן ומשמיע טוּמְפּ חרישי.',
        childNotices: 'הטוּמְפּ הקטן נשמע קרוב — בּוֹלִי ער.',
        shift: 'הכתפיים עוד קצת דרוכות, אבל לא לבד.',
      },
      requiredObjectSlot: 'bedroomLight',
      mustInclude: ['בּוֹלִי', 'מדחום', 'מחר'],
      mustNotInclude: ['רופאה', 'מרפאה', 'אל תפחד'],
      targetWords: 28,
      maxWords: 38,
      maxSentences: 4,
      imageIntent:
        'evening bedroom, soft night light, small thermometer resting on a shelf by the bed, child near the bed, Bolly by the pillow',
    },
    {
      page: 2,
      dramaticRole: 'companion_introduction',
      requiredEvent: 'הילד/ה מתארגן/ת לשינה; בּוֹלִי זז ליד הכרית.',
      childBodyState: 'מתארגן/ת במיטה, תנועות שקטות',
      companionAction: 'בּוֹלִי מתגלגל קצת ליד הכרית; נשמע טוּמְפּ קטן.',
      relationshipLoop: {
        loopType: 'relief',
        childFeels: 'הילד/ה מתארגן/ת במיטה לקראת השינה, בתנועות קטנות ושקטות.',
        companionAnswers: 'בּוֹלִי מתגלגל קצת ליד הכרית, ונשמע טוּמְפּ קטן.',
        childNotices: 'הטוּמְפּ נשמע קרוב — בּוֹלִי ממש פה, ליד הראש.',
        shift: 'החדר נעשה שקט, ובּוֹלִי קרוב.',
      },
      requiredObjectSlot: 'comfortObject',
      mustInclude: ['בּוֹלִי', 'טוּמְפּ'],
      mustNotInclude: ['הציל', 'הבהב'],
      targetWords: 24,
      maxWords: 32,
      maxSentences: 4,
      imageIntent: 'close-up bed and pillow, Bolly mid small roll, blanket detail',
    },
    {
      page: 3,
      dramaticRole: 'fear_object_revisited',
      requiredEvent:
        'עיני הילד/ה חוזרות אל המדחום שעל המדף; הוא/היא מסיט/ה מבט.',
      childBodyState: 'מבט נמשך אל המדף ואז נסוג; שקט בחוץ, אי-שקט קטן בפנים',
      companionAction: 'בּוֹלִי שקט ליד הכרית.',
      relationshipLoop: {
        loopType: 'no-relief',
        childFeels: 'המבט חוזר אל המדחום שעל המדף, ומשהו קטן נלחץ בפנים.',
        companionAnswers: 'בּוֹלִי שקט ליד הכרית, ופס שריון קטן זז קצת.',
        childNotices: 'התנועה הקטנה שלו קרובה, ממש ליד הראש.',
        shift: 'הילד/ה מסיט/ה מבט מהמדף — אבל אי-השקט הקטן עוד כאן.',
      },
      requiredObjectSlot: 'worryObject',
      mustInclude: ['מדחום'],
      mustNotInclude: ['נגע', 'מדדה', 'בדקה'],
      targetWords: 24,
      maxWords: 32,
      maxSentences: 4,
      imageIntent: 'child in bed, eyes drifting toward the small thermometer on the shelf, then away',
    },

    // ─── ACT 2: THE ANTICIPATION CORE (pages 4-7) ───
    {
      page: 4,
      dramaticRole: 'anticipation_body_resists',
      // SOLO BEAT — no relationshipLoop. The body tightens from the THOUGHT
      // of tomorrow (nothing touches the child). Bolly is present in the
      // scene but still — his answer is deliberately held for the p5 turn.
      // A loop here would make Bolly answer too early and rob p5 of power.
      requiredEvent:
        'המחשבה על מחר גורמת לגוף להתכווץ — כתפיים, יד, נשימה. שום הליך לא קורה.',
      childBodyState:
        'כתפיים עולות מעט, יד נסגרת קצת, נשימה מתקצרת — מהמחשבה על מחר, לא ממגע',
      companionAction: 'בּוֹלִי קרוב, שקט — אינו פועל בעמוד הזה.',
      mustInclude: ['יד'],
      mustNotInclude: ['בכתה', 'צרחה', 'נגע', 'אבל אז'],
      targetWords: 22,
      maxWords: 30,
      maxSentences: 3,
      imageIntent: "close-up child's shoulders rising slightly, hand half-closing, in bed",
      critical: true,
    },
    {
      page: 5,
      nameAnchor: true,
      dramaticRole: 'companion_closes',
      // THE TURN — first real relief after the p3-p4 anticipation dip.
      requiredEvent: 'בּוֹלִי מבצע את המנגנון שלו — נסגר לכדור קטן.',
      childBodyState: 'מרגיש/ה את בּוֹלִי נע לידו/ה',
      companionAction: 'בּוֹלִי נסגר לכדור קטן וחם; נשמע טוּמְפּ רך.',
      relationshipLoop: {
        loopType: 'relief',
        childFeels: 'המחשבה על מחר עוד לוחצת, והגוף לא נרגע.',
        companionAnswers: 'בּוֹלִי נסגר לכדור קטן וחם — טוּמְפּ רך.',
        childNotices: 'יד קטנה מרגישה את הכדור החם, והילד/ה לוחש/ת: "גם אתה?"',
        shift: 'בּוֹלִי נשאר עגול וחם, ויד קטנה מונחת עליו.',
      },
      mustInclude: ['בּוֹלִי', 'טוּמְפּ', 'כדור'],
      mustNotInclude: ['הציל', 'הגן עליה'],
      targetWords: 24,
      maxWords: 34,
      maxSentences: 4,
      imageIntent: 'close-up Bolly curled into a small ball on the blanket beside the child',
      critical: true,
    },
    {
      page: 6,
      nameAnchor: true,
      dramaticRole: 'child_mirrors',
      requiredEvent:
        'הילד/ה מבצע/ת את המנגנון בגוף שלו/ה — סוגר/ת ופותח/ת יד, או מתכרבל/ת ואז משחרר/ת.',
      childBodyState:
        'יד נסגרת לאגרוף קטן ואז נפתחת לאט; או גוף מתכרבל ואז מתרכך מעט',
      companionAction:
        'בּוֹלִי הוא כדור קטן וחם ליד הילד/ה; הוא אינו מבצע פעולה חדשה — הילד/ה מחקה את ההיסגרות והפתיחה שלו.',
      relationshipLoop: {
        loopType: 'spark',
        childFeels: 'הילד/ה מניח/ה יד על בּוֹלִי הסגור והחם, ולוחש/ת: "ככה?"',
        companionAnswers: 'בּוֹלִי נשאר עגול וחם, קרוב ליד.',
        childNotices: 'גם היד הקטנה נאספת לאגרוף, כמוהו.',
        shift: 'ואז, לאט לאט, אצבע אחר אצבע, היד נפתחת.',
      },
      mustInclude: ['יד'],
      mustNotInclude: ['בּוֹלִי אמר', 'נזכרה ש'],
      targetWords: 26,
      maxWords: 34,
      maxSentences: 4,
      imageIntent: 'close-up small hand closing to a fist then opening slowly, on the blanket',
      critical: true,
    },
    {
      page: 7,
      dramaticRole: 'companion_contact',
      requiredEvent:
        'מגע קטן בבּוֹלִי — לא חיבוק גדול, לא על הכתף. פס שריון קטן נפתח, ובפנים חם.',
      childBodyState: 'יד מושטת, אצבע נוגעת בבּוֹלִי בעדינות',
      companionAction: 'בּוֹלִי קרוב; פס שריון קטן נפתח; בפנים חם.',
      relationshipLoop: {
        loopType: 'relief',
        childFeels: 'יד קטנה נמשכת, ואצבע נוגעת בבּוֹלִי בעדינות.',
        companionAnswers: 'פס שריון קטן נפתח, ובפנים חם.',
        childNotices: 'החום הקטן הזה עובר אל קצה האצבע.',
        shift: 'הנשימה נעשית קצת ארוכה יותר.',
      },
      mustInclude: ['בּוֹלִי'],
      mustNotInclude: ['חיבוק', 'חיבקה', 'חיבק', 'על הכתף', 'ישב על כתפה'],
      targetWords: 24,
      maxWords: 32,
      maxSentences: 4,
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
      relationshipLoop: {
        loopType: 'hold',
        childFeels: 'המבט חוזר אל המדחום שעל המדף.',
        companionAnswers: 'בּוֹלִי נשאר שקט וקרוב, צמוד לצד.',
        childNotices: 'הפעם הגוף לא נסוג.',
        shift: 'המדחום נשאר על המדף — והם פשוט נשארים שם רגע, בשקט.',
      },
      requiredObjectSlot: 'worryObject',
      mustInclude: ['מדחום'],
      mustNotInclude: ['נגע', 'מדדה', 'בדקה', 'נעלם', 'כבר לא פחד'],
      targetWords: 24,
      maxWords: 32,
      maxSentences: 4,
      imageIntent: 'child looking calmly at the thermometer still resting on the shelf, body relaxed',
    },
    {
      page: 9,
      dramaticRole: 'quiet_spark_settling',
      // The bedtime spark beat — a QUIET spark (pillow nudge + small toomp +
      // quiet smile), never loud comedy.
      requiredEvent:
        'spark שקט: בּוֹלִי מזיז את הכרית טיפ-טיפה, נשמע טוּמְפּ קטן, והילד/ה מחייך/ת בשקט; הגוף מתרכך.',
      childBodyState: 'חיוך קטן ושקט; הגוף מתרכך, נשימה איטית',
      companionAction: 'בּוֹלִי מזיז את הכרית טיפ-טיפה; נשמע טוּמְפּ קטן.',
      relationshipLoop: {
        loopType: 'spark',
        childFeels: 'הגוף כבר רך יותר, והנשימה איטית.',
        companionAnswers: 'בּוֹלִי מזיז את הכרית טיפ-טיפה, ונשמע טוּמְפּ קטן.',
        childNotices: 'הילד/ה קולט/ת את התנועה הקטנה והמשחקית שלו.',
        shift: 'חיוך קטן ושקט עולה.',
      },
      requiredObjectSlot: 'comfortObject',
      // mustInclude holds only gender-neutral anchors — 'חייך' is a
      // gender-inflected verb; the smile lives in requiredEvent + the loop,
      // where the Author inflects it for the child's gender.
      mustInclude: ['בּוֹלִי', 'טוּמְפּ'],
      mustNotInclude: ['קסם', 'מצחיק מאוד', 'צחקה בקול', 'גאה בעצמה'],
      targetWords: 26,
      maxWords: 34,
      maxSentences: 4,
      imageIntent: "close-up Bolly nudging the pillow a touch, child's small quiet smile, body soft in bed",
    },
    {
      page: 10,
      nameAnchor: true,
      dramaticRole: 'sleep_with_residue',
      requiredEvent:
        'הילד/ה נרדם/ת; המדחום עדיין על המדף למחר; בּוֹלִי ליד היד; הגוף רגוע.',
      childBodyState: 'שכיבה, נשימה רגועה, יד שמורה לצד',
      companionAction: 'בּוֹלִי נרדם ליד היד, ובפנים חם.',
      relationshipLoop: {
        loopType: 'relief',
        childFeels: 'הראש שוקע בכרית, והגוף רך.',
        companionAnswers: 'בּוֹלִי מתכרבל ממש ליד היד, ובפנים חם.',
        childNotices: 'החום הקטן שלו נשאר שם, ליד היד.',
        shift: 'המדחום עדיין על המדף למחר — והנשימה נרגעת, ואחר כך העיניים נעצמות.',
      },
      requiredObjectSlot: 'worryObject',
      mustInclude: ['בּוֹלִי', 'מדחום'],
      mustNotInclude: [
        'בוקר',
        'מחר כבר',
        'קם',
        'הלכו לבדיקה',
        'למדה ש',
        'הבינה ש',
        'עכשיו אמיץ',
        'כבר לא פחד',
      ],
      targetWords: 24,
      maxWords: 34,
      maxSentences: 4,
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
    'Not every page resolves into calm. By design, the anticipation stretch (pages 3-4) ends with the body still tight and the worry unresolved. Relief is EARNED and ACCUMULATES toward sleep — it is not delivered on every page. An unresolved or quiet middle page is correct, not a flaw.',
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
    version: '0.5.6-pilot',
    derivedFrom: 'authored fresh — bedtime anticipation pattern (no Gold to reverse-engineer)',
    authoredAt: '2026-05-22',
    authoredBy: 'CTO + ChatGPT consult',
    notes: [
      'Second v0.5 Production Recipe. Bedtime = ANTICIPATION, not procedure.',
      'The exam is tomorrow; nothing medical happens tonight. Thermometer stays on the shelf — observed, never used.',
      'Residue is NOT a sticker — it is "the worry object is still on the shelf, but the body no longer fights it".',
      'pages 4-7 tagged critical=true — the anticipation resilience core.',
      'forbiddenPatterns includes anticipation-frame breakers (no procedure, no doctor, no sticker) and time-frame breakers (story ends at sleep, not morning).',
      'v0.5.0-b: removed "חייך" from p9 mustInclude — gender-inflected verb; mustInclude holds only gender-neutral anchors.',
      'v0.5.0-c: vocab cleanup — Bolly shell word "לוח" replaced with "פס שריון".',
      // ── v0.5.6 — conversion to the SEALED Fantasy/Adventure standard ──
      'v0.5.6 (B.3): 9 of 10 pages carry a 4-beat relationshipLoop (childFeels → companionAnswers → childNotices → shift). Only p4 (anticipation-resists) is SOLO — and even there Bolly is present in the scene, still, his answer held for the p5 turn. Bolly is never absent from the prose.',
      'v0.5.6 (B.4): loopType per loop — p1 relief, p2 relief, p3 no-relief, p4 SOLO, p5 relief (turn), p6 spark, p7 relief, p8 hold, p9 spark, p10 relief. Relief is withheld through p3-p4 and accumulates toward sleep; p8 hold keeps the back half from being relief-on-every-page.',
      'v0.5.6 (B.5): nameAnchor on 4 arc-spread pages (p1,p5,p6,p10) — deliberately fewer than Adventure (8), a direct fix for the Adventure name-count debt; loop beats lead with body/object/Bolly, not the child-name placeholder. 2 soft whispered direct-communication beats (p5 "גם אתה?", p6 "ככה?").',
      'v0.5.6: p1 requiredExactLine removed (the relationshipLoop carries the opening). maxSentences 4 on loop pages, 3 on the p4 SOLO. Word caps pre-sized for 4-beat loops (loop pages max 32-34, p1 38, p4 SOLO 30) — applies the Adventure cap-calibration lesson up front.',
      'v0.5.6: acceptanceCriteria gained a 10th item — "not every page resolves into calm".',
      'PENDING SEAL: requires 2 girl runs + 1 boy run (SMOKE_CHILD_GENDER=boy), all 3/3 READY. Classified as a Structural Candidate (like Adventure) until the Voice QA layer exists.',
    ],
  },
};

export default bollyBedtimeAge5Recipe;
