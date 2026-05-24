/**
 * Production Recipe — Bolly the Armadillo / Fantasy / Age 5-6.
 *
 * THIRD v0.5 recipe. The riskiest direction — "fantasy" invites abstract
 * worlds, magic, page-length spikes, and world-mechanics replacing
 * body-mechanics. This recipe is deliberately built to PREVENT all of that.
 *
 * THE CONCEPT — "Guided Imagery Resilience":
 *   The medical procedure HAPPENS for real (a thermometer, like the
 *   adventure recipe). The "fantasy" is a LAYER, not a plot: the child
 *   uses IMAGINATION as a coping tool — short, concrete, body-anchored
 *   mental pictures. This is a real guided-imagery technique used with
 *   children facing medical procedures.
 *
 * WHAT FANTASY IS NOT HERE:
 *   - NOT a magic world, a portal, another realm
 *   - NOT "קסם" solving the fear
 *   - NOT Bolly transforming or casting spells
 *   - NOT world-mechanics instead of body-mechanics
 *   - NOT abstract imagery dumps
 *
 * WHAT FANTASY IS:
 *   - The child pictures small concrete images anchored to their body and
 *     to Bolly's shell. Bolly's closed ball gets an imaginative NAME the
 *     child gives it ("a small warm cave") — but Bolly stays Bolly, the
 *     shell stays a shell, the thermometer stays a thermometer.
 *
 * The resilience core (pages 11-14: body resists → Bolly closes → child
 * mirrors → procedure) is IDENTICAL to the adventure recipe. The fantasy
 * wraps it; it never replaces it.
 *
 * v0.5.2 — Phase B.3: every page (except the two deliberately-solo beats)
 * carries a relationshipLoop — the page modeled as ONE exchange between
 * the child and Bolly, not two parallel actors.
 *
 * v0.5.4 — Phase B.4: every loop now carries a `loopType`. Earlier every
 * loop ended in a calming `shift`, so all 18 loop pages were the same
 * mini-arc (feel → answer → calm) and the book read as a regulation
 * machine. loopType breaks the formula: relief is WITHHELD through the
 * rising/peak stretch (p3-p8) and DELIVERED, accumulating, in the back
 * half — co-regulation that spans pages instead of resetting on each one.
 *
 * 20 pages (Pricing v2: fantasy = 20p / ₪99).
 */

import type { ProductionRecipe } from './recipe-types';

export const bollyFantasyAge5Recipe: ProductionRecipe = {
  id: 'bolly_fantasy_age_5',
  companionId: 'bolly_armadillo',
  category: 'MEDICAL_PROCEDURE',
  direction: 'fantasy',
  ageTier: '5-6',
  pageCount: 20,

  storyPromise:
    'הילד/ה עובר/ת בדיקה רפואית אמיתית ומשתמש/ת בדמיון ככלי התמודדות מעוגן-גוף — נשאר/ת קרוב/ה לגוף שלו/ה ולשריון של בּוֹלִי — ויוצא/ת עם גוף רך יותר וזיכרון של ניצחון קטן.',

  emotionalArc:
    'morning reluctance → journey, worry quietly building with Bolly close → clinic → imaginative reframe of the fear object → body resists → Bolly closes (imagined as a small warm place) → child mirrors → procedure → sticker → relief arrives and accumulates → sleep',

  resiliencePattern:
    'FANTASY_GUIDED_IMAGERY — a real medical procedure (thermometer). The child uses IMAGINATION as a coping tool: short, concrete, body-anchored mental pictures. Bolly\'s closed ball is imagined as a small warm place; the imagination WRAPS the resilience core (body resists → Bolly closes → child mirrors → procedure → residue) but never replaces it and never becomes a magic world.',

  // ─────────────────────────────────────────────────────────────────────
  // VARIATION SLOTS — conservative. medicalObject locked to מדחום.
  // imaginativeImage is the concrete comforting picture the child gives
  // Bolly's closed ball — NEVER magic.
  // ─────────────────────────────────────────────────────────────────────
  variationSlots: {
    clinicSetting: ['מרפאת ילדים', 'חדר בדיקה קטן', 'מרפאה משפחתית'],
    medicalObject: ['מדחום'],
    // v0.5.0-e: removed 'מדף נמוך עם ספרים' — feeding a book-class object
    // led the Author to write 'מחברת' on p2, a Bolly-forbidden object (the
    // forbiddenObjects validator BLOCKED it correctly). Replaced with safe,
    // non-book, non-companion-substitute room objects.
    waitingObject: ['כיסא קטן', 'וילון קל', 'שטיח רך'],
    sensoryDetail: ['ריח של סבון', 'אור לבן', 'נייר קר על המיטה'],
    stickerType: [
      'מדבקה צבעונית',
      'מדבקה עגולה עם פנים',
      'מדבקה עם פס קטן',
    ],
    weatherOutside: ['אור בוקר רך', 'שמיים אפורים', 'רוח קלה'],
    // v0.5.0-e: removed 'הספר הפתוח על הרצפה' — second latent book-class
    // hazard (same failure mode as waitingObject above). Replaced with a
    // safe room detail.
    homeRoomDetail: ['הכרית', 'השמיכה', 'השטיח הרך'],
    // v0.5.0-d: physical scene objects only. The earlier values
    // ("מערה קטנה וחמה" / "קן רך וקטן") were not things the child can SEE
    // and TOUCH in the room — they invited internal-metaphor drift ("a nest
    // inside her head", "a changing picture"). The fantasy is the child
    // SEEING the real ball look like a real cozy object — never imagining
    // an internal image.
    imaginativeImage: [
      'כרית קטנה ורכה',
      'גבעה קטנה של שמיכה',
      'קפל שמיכה חמים',
    ],
    // v0.5.0-f: the calming simile for the thermometer's silver tip on the
    // p10 imaginative-reframe beat. CLOSED set, inanimate objects only — a
    // drop, a stone, a button. Replaces Author improvisation, which once
    // produced the nonstandard word "דגיק". The thermometer stays a
    // thermometer; the simile only makes it look calmer, never alive.
    calmSimile: ['טיפת מים', 'אבן חלקה', 'כפתור קטן'],
  },

  // ─────────────────────────────────────────────────────────────────────
  // PAGE CARDS — 20 pages. Age tier 5-6: 2-3 sentences / 18-32 words.
  // v0.5.2 (Phase B.3): most pages carry a relationshipLoop — the page IS
  // an exchange (childFeels → companionAnswers → childNotices → shift).
  // p9 + p11 stay solo (pure fear-object beat / child-resists beat).
  // v0.5.4 (Phase B.4): each loop carries a loopType. Distribution —
  //   p1 relief · p2 spark · p3 hold · p4 no-relief · p5 hold ·
  //   p6 no-relief · p7 no-relief · p8 hold · p9 SOLO · p10 relief (turn) ·
  //   p11 SOLO · p12 relief · p13 spark · p14 hold · p15-18 relief ·
  //   p19 spark · p20 relief.
  // Relief is withheld through the rising/peak stretch and delivered,
  // accumulating, in the back half. Never more than 2 consecutive
  // no-relief pages; Bolly is present and close on EVERY page.
  // ─────────────────────────────────────────────────────────────────────
  pageCards: [
    // ─── ACT 1: HOME + JOURNEY (pages 1-5) — imagination begins ───
    {
      page: 1,
      nameAnchor: true,
      dramaticRole: 'opening_state',
      requiredEvent: 'הבוקר נכנס לחדר; הילד/ה לא רוצה לקום; היום יש בדיקה.',
      childBodyState: 'מסתובב/ת לצד השני, מתחבא/ת מעט במיטה',
      companionAction: 'בּוֹלִי שוכב קרוב לכרית, פס שריון קטן אחד פתוח, מביט/ה בשקט.',
      relationshipLoop: {
        loopType: 'relief',
        childFeels: 'הבוקר נכנס לחדר, והילד/ה מתכווצ/ת מתחת לשמיכה — היום יש בדיקה.',
        companionAnswers: 'בּוֹלִי, ליד הכרית, מזיז פס שריון קטן ומשמיע טוּמְפּ חרישי.',
        childNotices: 'הטוּמְפּ הקטן נשמע קרוב — בּוֹלִי ער.',
        shift: 'הגוף עדיין מכווץ, אבל קצת פחות לבד.',
      },
      mustInclude: ['בּוֹלִי'],
      mustNotInclude: ['קסם', 'הציל', 'אל תפחד'],
      // v0.5.2: opening page carries the most setup (morning + child +
      // exam-today + the companion exchange) — caps bumped so a 4-beat
      // relationshipLoop fits without a retry.
      targetWords: 28,
      maxWords: 38,
      maxSentences: 4,
      imageIntent: 'wide shot bedroom, soft morning light, child curled under blanket, Bolly visible near pillow',
    },
    {
      page: 2,
      nameAnchor: true,
      dramaticRole: 'companion_introduction',
      requiredEvent: 'הילד/ה מתארגן/ת; בּוֹלִי מתגלגל אל התרמיל.',
      childBodyState: 'מתכופף/ת לחפש דבר, ידיים עסוקות',
      companionAction: 'בּוֹלִי מתגלגל החוצה ונעצר ליד התרמיל. נשמע טוּמְפּ קטן.',
      relationshipLoop: {
        loopType: 'spark',
        childFeels: 'הבוקר כבד. הילד/ה מציצ/ה אל בּוֹלִי ולוחש/ת אליו: "אתה בא איתי?"',
        companionAnswers: 'בּוֹלִי עונה בלי מילים — מתגלגל אל התרמיל ומשמיע טוּמְפּ קטן.',
        childNotices: 'הטוּמְפּ הקטן נשמע — בּוֹלִי מוכן, ממש ליד התרמיל.',
        shift: 'בּוֹלִי בא יחד — לא יוצאים לבד.',
      },
      requiredObjectSlot: 'waitingObject',
      mustInclude: ['בּוֹלִי', 'טוּמְפּ'],
      mustNotInclude: ['קסם', 'הבהב'],
      targetWords: 24,
      maxWords: 32,
      maxSentences: 4,
      imageIntent: 'medium shot floor near bed and backpack, Bolly mid-roll',
    },
    {
      page: 3,
      dramaticRole: 'journey_step',
      // v0.5.0-d: the "fantasy" here is PERCEPTION, not internal imagining.
      // The child LOOKS AT a real thing on the way and notices it can look
      // like another concrete thing. Never "a picture forms in her head".
      requiredEvent:
        'בדרך; הילד/ה מביט/ה בדבר אמיתי אחד על המדרכה — סדק, עלה, אבן — ורואה שהוא נראה כמו דבר קטן וידידותי.',
      childBodyState: 'הולך/ת, מבט מתעכב רגע על דבר אמיתי בדרך',
      companionAction: 'בּוֹלִי מתגלגל לצידה בנקישה קטנה.',
      relationshipLoop: {
        loopType: 'hold',
        childFeels: 'בדרך למרפאה הצעדים מתקצרים; המבט נופל על דבר אחד על המדרכה — סדק, עלה, אבן.',
        companionAnswers: 'בּוֹלִי מתגלגל חצי סיבוב ונעצר ממש צמוד אליו/ה.',
        childNotices: 'הילד/ה מרגיש/ה אותו צמוד לרגל, ומביט/ה בדבר הקטן בעין רכה יותר.',
        shift: 'אף אחד לא ממהר — הם פשוט הולכים יחד, צעד ליד צעד.',
      },
      mustInclude: ['בּוֹלִי'],
      mustNotInclude: ['קסם', 'עולם אחר', 'פורטל', 'בתוך הראש', 'תמונה בראש'],
      targetWords: 22,
      maxWords: 30,
      maxSentences: 4,
      imageIntent: 'moving shot on sidewalk, child looking at one real thing on the ground, Bolly rolling alongside',
    },
    {
      page: 4,
      dramaticRole: 'journey_step',
      // v0.5.0-f: a LIGHT connective breather — p3 already does the
      // perceptual reframe. One movement, one companion action.
      requiredEvent:
        'ממשיכים ללכת עוד קצת; הדרך נשארת דרך רגילה ושקטה.',
      childBodyState: 'צעד קל, כתפיים עוד מעט מורמות',
      companionAction: 'בּוֹלִי מתגלגל לידו/ה בטוּמְפּ רך.',
      relationshipLoop: {
        loopType: 'no-relief',
        childFeels: 'הדרך עוד ארוכה, והכתפיים נשארות מעט מורמות.',
        companionAnswers: 'בּוֹלִי מתגלגל לצד הילד/ה ומתאים את הקצב שלו לקצב הצעדים — טוּמְפּ רך.',
        childNotices: 'הילד/ה שומע/ת את הטוּמְפּ ויודע/ת שהוא שם.',
        shift: 'הכתפיים עדיין מעט מורמות — אבל בּוֹלִי נשאר ממש צמוד.',
      },
      mustInclude: ['בּוֹלִי'],
      mustNotInclude: ['קסם', 'נמוג', 'בתוך הראש', 'ציור מתחלף'],
      targetWords: 18,
      maxWords: 26,
      maxSentences: 4,
      imageIntent: 'moving shot on sidewalk, child and Bolly walking together',
    },
    {
      page: 5,
      nameAnchor: true,
      dramaticRole: 'arrival_at_setting',
      requiredEvent:
        'מגיעים למרפאה; הרופאה במעיל לבן; הילד/ה מטפס/ת על כיסא הבדיקה — וזו עדיין המרפאה.',
      childBodyState: 'נכנס/ת, מטפס/ת על כיסא הבדיקה ברגליים קטנות',
      companionAction: 'בּוֹלִי התכרבל בכיס התרמיל, חמים ושקט.',
      relationshipLoop: {
        loopType: 'hold',
        childFeels: 'דלת המרפאה נפתחת; הרופאה במעיל לבן מחכה, והילד/ה מטפס/ת על כיסא הבדיקה, קטנ/ה ודרוכ/ה.',
        companionAnswers: 'בּוֹלִי מתכרבל בכיס התרמיל, חמים וצמוד אל הגוף.',
        childNotices: 'הילד/ה מרגיש/ה את החום הקטן שלו דרך הבד.',
        shift: 'הם נשארים ככה רגע — גוף דרוך, וחום קטן צמוד אליו.',
      },
      requiredObjectSlot: 'clinicSetting',
      mustInclude: ['בּוֹלִי', 'רופאה'],
      mustNotInclude: ['הסבירה', 'עולם קסום', 'קסם'],
      targetWords: 26,
      maxWords: 34,
      maxSentences: 4,
      imageIntent: 'interior clinic, child climbing onto exam chair, doctor in white coat in soft focus',
    },

    // ─── ACT 2: CLINIC + IMAGINATION BUILDS (pages 6-10) ───
    {
      page: 6,
      dramaticRole: 'environment_sensing',
      requiredEvent:
        'הילד/ה קולט/ת פרט חושי קונקרטי במרפאה; הגוף מתחיל בשקט להתכונן.',
      childBodyState: 'גוף עוד שקט, כתפיים מעט מורמות, נשימה רדודה יותר',
      companionAction: 'בּוֹלִי מניע פס שריון קלות בתוך הכיס.',
      relationshipLoop: {
        loopType: 'no-relief',
        childFeels: 'פרט חושי קטן במרפאה נקלט; הכתפיים עולות, והנשימה נעשית רדודה.',
        companionAnswers: 'בּוֹלִי מזיז פס שריון קטן — נפתח לרגע ונסגר — ממש כנגד הגוף.',
        childNotices: 'הילד/ה מרגיש/ה את התזוזה הקטנה.',
        shift: 'הכתפיים נשארות גבוהות — אבל התזוזה הקטנה של בּוֹלִי לא נפסקת.',
      },
      requiredObjectSlot: 'sensoryDetail',
      mustInclude: ['בּוֹלִי'],
      mustNotInclude: ['לב התמלא', 'שקט שרר', 'קסם'],
      targetWords: 22,
      maxWords: 30,
      maxSentences: 4,
      imageIntent: 'close-up clinic detail — white paper edge, soap, light — child seated, Bolly in pocket',
    },
    {
      page: 7,
      dramaticRole: 'environment_sensing',
      requiredEvent: 'הילד/ה מחכה בחדר; בּוֹלִי קרוב בכיס.',
      childBodyState: 'יושב/ת על קצה הכיסא, ידיים בחיק',
      companionAction: 'בּוֹלִי שקט בכיס, פס שריון קטן זז קלות.',
      relationshipLoop: {
        loopType: 'no-relief',
        childFeels: 'הרצפה הקרה נוגעת ברגל; הרגליים נאספות פנימה.',
        companionAnswers: 'בּוֹלִי, בכיס, מרגיש את התנועה ומשמיע טוּמְפּ — חלש קודם, ואז ברור.',
        childNotices: 'הילד/ה מרגיש/ה את התזוזה ויודע/ת שהוא שם.',
        shift: 'הרגליים עוד אסופות — אבל בּוֹלִי נשאר ממש קרוב ולא זז משם.',
      },
      mustInclude: ['בּוֹלִי'],
      mustNotInclude: ['קסם'],
      targetWords: 22,
      maxWords: 30,
      maxSentences: 4,
      imageIntent: 'medium shot child waiting on the exam chair, Bolly pocket visible',
    },
    {
      page: 8,
      dramaticRole: 'imaginative_reframe',
      // v0.5.0-d: PERCEPTION, not internal imagining. The child looks at a
      // REAL thing already in the room and notices it can look calm/cozy.
      requiredEvent:
        'הילד/ה מביט/ה באור שעל הקיר; האור נשאר אמיתי, אבל נראה רך.',
      childBodyState: 'מבט מתעכב רגע על דבר אמיתי בחדר; מבט רך יותר',
      companionAction: 'בּוֹלִי נשען קרוב בכיס.',
      relationshipLoop: {
        loopType: 'hold',
        childFeels: 'המבט נח על האור שעל הקיר; הגוף עוד דרוך.',
        companionAnswers: 'בּוֹלִי נשען בכיס אל הגוף, חם ושקט.',
        childNotices: 'הילד/ה מרגיש/ה אותו שם, והאור נראה רך.',
        shift: 'הם נשארים ככה רגע, בשקט.',
      },
      mustInclude: ['בּוֹלִי'],
      mustNotInclude: [
        'קסם',
        'עולם אחר',
        'נעלם',
        'בתוך הראש',
        'בראש שלה',
        'בראש שלו',
        'תמונה בראש',
      ],
      targetWords: 24,
      maxWords: 32,
      maxSentences: 4,
      imageIntent: 'close-up child looking at one real thing in the room — light on wall — with a softer gaze, clinic room real around',
    },
    {
      page: 9,
      nameAnchor: true,
      dramaticRole: 'fear_object_appears',
      // SOLO BEAT — no relationshipLoop. The feared object appears; the
      // child freezes on it; Bolly stays silent in the pocket. His answer
      // is deliberately HELD for the resilience core. Render requiredEvent
      // + childBodyState directly — short and concrete.
      requiredEvent: 'הרופאה מוציאה מדחום קטן עם קצה כסוף.',
      childBodyState: 'לא מצליח/ה להוריד את העיניים מהמדחום, בלי לזוז',
      companionAction: 'בּוֹלִי שקט בכיס.',
      requiredObjectSlot: 'medicalObject',
      mustInclude: ['מדחום'],
      mustNotInclude: ['מפחיד', 'דקרני', 'קסם'],
      targetWords: 18,
      maxWords: 28,
      maxSentences: 2,
      imageIntent: 'close-up doctor hand holding small thermometer with silver tip',
    },
    {
      page: 10,
      nameAnchor: true,
      dramaticRole: 'imaginative_reframe',
      // The KEY fantasy beat. v0.5.0-f: the calming simile is the CLOSED
      // calmSimile slot — inanimate objects only (water drop / smooth
      // stone / small button). The thermometer stays a thermometer.
      // v0.5.4: the turning point — first real relief after the rising
      // stretch p3-p8. loopType 'relief'.
      requiredEvent:
        'הילד/ה מביט/ה במדחום ורואה שהקצה הכסוף שלו דומה לדבר קטן ופשוט — אבל הוא נשאר אמיתי.',
      childBodyState: 'מבט על המדחום; הילד/ה רואה אותו בעין רכה יותר, הגוף עוד ער',
      companionAction: 'בּוֹלִי נע קלות בכיס ליד הילד/ה.',
      relationshipLoop: {
        loopType: 'relief',
        childFeels: 'המדחום מנצנץ ביד הרופאה. הילד/ה מסתכל/ת עליו ולוחש/ת אל בּוֹלִי: "זה קר?"',
        companionAnswers: 'בּוֹלִי עונה בתנועה קטנה בכיס, ממש ליד היד.',
        childNotices: 'הילד/ה מרגיש/ה אותו צמוד, ורואה שהקצה הכסוף דומה לדבר קטן ופשוט.',
        shift: 'המבט עליו מתרכך — אבל הוא נשאר מדחום.',
      },
      requiredObjectSlot: 'calmSimile',
      mustInclude: ['מדחום', 'בּוֹלִי'],
      mustNotInclude: [
        'קסם',
        'הפך ל',
        'הפכה ל',
        'נעלם',
        'מטה קסם',
        'בתוך הראש',
        'תמונה בראש',
        'עטוף',
      ],
      targetWords: 24,
      maxWords: 32,
      maxSentences: 4,
      imageIntent: 'close-up child looking at the real thermometer with a softer gaze, still the real object',
    },

    // ─── ACT 3: THE RESILIENCE CORE — through the imagination lens (11-16) ───
    {
      page: 11,
      dramaticRole: 'child_body_resists',
      // SOLO BEAT — no relationshipLoop. The child's body resists; Bolly
      // is intentionally SILENT (his answer is held for p12). Giving p11 a
      // loop would make Bolly answer too early and rob p12 of its power.
      // Render childBodyState directly — tension shown only through the body.
      requiredEvent:
        'הרופאה קרבה את היד; הילד/ה גוף נסוג — מתח שמסופר רק דרך הגוף, לא דרך אווירה.',
      childBodyState:
        'יד נמשכת מעט לאחור, כתפיים עולות, עיניים בורחות אל הקיר, נשימה מתקצרת',
      companionAction: 'בּוֹלִי לא מופיע בעמוד הזה (בכיס, שקט).',
      mustInclude: ['יד'],
      mustNotInclude: ['בכתה', 'צרחה', 'אבל אז', 'קסם', 'נמוג', 'הרגע קופא'],
      targetWords: 24,
      maxWords: 32,
      maxSentences: 3,
      imageIntent: "medium shot child's shoulders rising, hand pulling back slightly",
      critical: true,
    },
    {
      page: 12,
      nameAnchor: true,
      dramaticRole: 'companion_closes',
      requiredEvent:
        'בּוֹלִי נסגר לכדור; הילד/ה מביט/ה בכדור ורואה אותו דומה לדבר קטן וחם.',
      childBodyState: 'מרגיש/ה את ההתגלגלות בכיס; מבט רך על הכדור',
      companionAction:
        'בּוֹלִי מתגלגל ונסגר לכדור חם ושקט. נשמע טוּמְפּ.',
      relationshipLoop: {
        loopType: 'relief',
        childFeels: 'אחרי שהיד התקרבה, הגוף עוד מכווץ.',
        companionAnswers: 'בּוֹלִי מרגיש את הדריכות ונסגר לכדור קטן וחם — טוּמְפּ.',
        childNotices: 'הילד/ה מרגיש/ה את הכדור החם, ולוחש/ת: "גם אתה?"',
        shift: 'בּוֹלִי נשאר עגול וחם, ויד קטנה מונחת עליו.',
      },
      requiredObjectSlot: 'imaginativeImage',
      mustInclude: ['בּוֹלִי', 'טוּמְפּ', 'כדור'],
      mustNotInclude: ['קסם', 'הציל', 'הגן עליה', 'בתוך הראש', 'תמונה בראש'],
      targetWords: 26,
      maxWords: 34,
      maxSentences: 4,
      imageIntent: 'close-up pocket lump, small round ball-shape, gentle warmth, the real object',
      critical: true,
    },
    {
      page: 13,
      nameAnchor: true,
      dramaticRole: 'child_mirrors',
      requiredEvent:
        'הילד/ה מבצע/ת את המנגנון בגוף — אגרוף ואז פתיחה אצבע אחר אצבע — בדיוק כמו שבּוֹלִי נסגר ואז נפתח.',
      childBodyState:
        'יד נסגרת לאגרוף קטן ומחזיקה רגע, ואז נפתחת לאט, אצבע אחר אצבע',
      companionAction:
        'בּוֹלִי הוא כדור קטן וחם בכיס; הוא אינו מבצע פעולה חדשה — הילד/ה מחקה את ההיסגרות והפתיחה שלו.',
      relationshipLoop: {
        loopType: 'spark',
        childFeels: 'הילד/ה מניח/ה יד על הכיס, על בּוֹלִי הסגור והחם, ולוחש/ת: "ככה?"',
        companionAnswers: 'בּוֹלִי נשאר עגול וחם, קרוב ליד.',
        childNotices: 'גם היד הקטנה נאספת לאגרוף, כמוהו.',
        shift: 'ואז, לאט לאט, אצבע אחר אצבע, היד נפתחת.',
      },
      mustInclude: ['יד', 'אצבע'],
      mustNotInclude: ['בּוֹלִי אמר', 'נזכרה ש', 'קסם'],
      // v0.5.4: caps aligned with p12 — p13 is also a direct-communication
      // critical page (a quoted line "ככה?" + the full fist→hold→open
      // mirror); 4 beats genuinely need 4 sentences, same as p12.
      targetWords: 26,
      maxWords: 34,
      maxSentences: 4,
      imageIntent: 'close-up small hand opening slowly, finger by finger',
      critical: true,
    },
    {
      page: 14,
      dramaticRole: 'procedure_happens',
      requiredEvent: 'המדחום נוגע ביד; קצר וקונקרטי; הדמיון הוא עדשת ההתמודדות.',
      childBodyState: 'נשאר/ת על הכיסא, גוף שקט',
      companionAction: 'בּוֹלִי שקט בכיס.',
      relationshipLoop: {
        loopType: 'hold',
        childFeels: 'המדחום נוגע ביד; הגוף נשאר על הכיסא, דרוך ושקט.',
        companionAnswers: 'בּוֹלִי נשאר כדור חם וצמוד בכיס לאורך כל הרגע.',
        childNotices: 'הילד/ה מרגיש/ה את החום הקטן שלו דרך הבד.',
        shift: 'הרגע עובר ככה — מדחום על היד, ובּוֹלִי חם וצמוד, ולא זז.',
      },
      requiredObjectSlot: 'medicalObject',
      mustInclude: ['מדחום'],
      mustNotInclude: ['כאב נורא', 'דקירה חזקה', 'בכתה', 'צרחה', 'ברחה', 'קסם'],
      targetWords: 20,
      maxWords: 28,
      maxSentences: 4,
      imageIntent: 'close-up hand and thermometer tip, brief contact',
      critical: true,
    },
    {
      page: 15,
      nameAnchor: true,
      dramaticRole: 'residue_appears',
      requiredEvent: 'הרופאה מדביקה מדבקה; בּוֹלִי פותח פס שריון אחד ומציץ.',
      childBodyState: 'מסתכל/ת על המדבקה ביד, ראש מעט מורם',
      companionAction: 'בּוֹלִי פותח פס שריון אחד ומציץ. נשמע טוּמְפּ רך.',
      relationshipLoop: {
        loopType: 'relief',
        childFeels: 'הרופאה מדביקה מדבקה על היד; הראש מתרומם קצת.',
        companionAnswers: 'בּוֹלִי פותח פס שריון אחד ומציץ — טוּמְפּ רך.',
        childNotices: 'הילד/ה מבחין/ה בהצצה הקטנה שלו.',
        shift: 'חיוך קטן עולה.',
      },
      requiredObjectSlot: 'stickerType',
      mustInclude: ['בּוֹלִי', 'מדבקה'],
      mustNotInclude: ['לוח ורוד זרח', 'זרח ממנו', 'קסם'],
      targetWords: 26,
      maxWords: 34,
      maxSentences: 4,
      imageIntent: "medium shot sticker on child's hand, Bolly's plate slightly open",
    },
    {
      page: 16,
      dramaticRole: 'companion_opens',
      requiredEvent:
        'בּוֹלִי נפתח לגמרי; הילד/ה רגוע/ה יותר, הגוף מתרכך.',
      childBodyState: 'כתפיים יורדות לאט, נשימה איטית יותר',
      companionAction: 'בּוֹלִי נפתח לאט, פס אחרי פס.',
      relationshipLoop: {
        loopType: 'relief',
        childFeels: 'המדחום כבר לא נוגע ביד; הגוף מתחיל להתרכך.',
        companionAnswers: 'בּוֹלִי נפתח לאט, פס שריון אחרי פס שריון.',
        childNotices: 'הילד/ה מרגיש/ה את ההיפתחות האיטית שלו בכיס.',
        shift: 'הכתפיים יורדות, והנשימה נעשית ארוכה יותר.',
      },
      mustInclude: ['בּוֹלִי'],
      mustNotInclude: ['קסם', 'גאה בעצמה'],
      targetWords: 22,
      maxWords: 30,
      maxSentences: 4,
      imageIntent: 'close-up Bolly opening plate by plate, child calmer on the chair',
    },

    // ─── ACT 4: COOLDOWN + RELIEF ACCUMULATES + SLEEP (17-20) ───
    {
      page: 17,
      dramaticRole: 'cooldown_journey',
      requiredEvent: 'יוצאים מהמרפאה; הולכים הביתה; המדבקה על היד.',
      childBodyState: 'הולך/ת לאט, מסתכל/ת על המדבקה',
      companionAction: 'בּוֹלִי התכרבל בכיס התרמיל, רגוע ושקט.',
      relationshipLoop: {
        loopType: 'relief',
        childFeels: 'דלת המרפאה נסגרת מאחור; הצעדים יוצאים לדרך הביתה, והמבט על המדבקה.',
        companionAnswers: 'בּוֹלִי מתכרבל בכיס התרמיל, רגוע וצמוד.',
        childNotices: 'הילד/ה מרגיש/ה אותו נע קלות עם כל צעד.',
        shift: 'הצעדים נעשים שקטים יותר.',
      },
      requiredObjectSlot: 'weatherOutside',
      mustInclude: ['בּוֹלִי'],
      mustNotInclude: [
        'ישב על כתפה',
        'התנדנד על',
        'הבינה ש',
        'למדה ש',
        'קסם',
      ],
      targetWords: 22,
      maxWords: 30,
      maxSentences: 4,
      imageIntent: 'street shot child walking home, sticker visible on hand, Bolly tucked in bag',
    },
    {
      page: 18,
      dramaticRole: 'cooldown_journey',
      requiredEvent: 'בדרך הביתה; הילד/ה מביט/ה במדבקה; הצעד רגוע.',
      childBodyState: 'צעד רגוע, מבט שקט על המדבקה',
      companionAction: 'בּוֹלִי שקט בתרמיל.',
      relationshipLoop: {
        loopType: 'relief',
        childFeels: 'בדרך הביתה אצבע נוגעת במדבקה שעל היד.',
        companionAnswers: 'בּוֹלִי שקט בתרמיל, ונע קלות עם הצעדים.',
        childNotices: 'הילד/ה מרגיש/ה את התזוזה הקטנה שלו לצד הגוף.',
        shift: 'הצעד שקט ורגוע.',
      },
      mustInclude: ['בּוֹלִי', 'מדבקה'],
      mustNotInclude: [
        'מעכשיו',
        'גאה בעצמה',
        'הבינה ש',
        'למדה ש',
        'קסם',
      ],
      targetWords: 22,
      maxWords: 30,
      maxSentences: 4,
      imageIntent: 'street shot nearing home, child glancing at the sticker',
    },
    {
      page: 19,
      nameAnchor: true,
      dramaticRole: 'home_inspection',
      // The fantasy spark beat — same shape as adventure p14.
      requiredEvent:
        'בבית — הילד/ה בודק/ת את המדבקה; בּוֹלִי עושה תנועה קטנה ומשחקית והילד/ה מחייך/ת.',
      childBodyState:
        'יד מורמת, אצבע נוגעת בקצה המדבקה; חיוך קטן ושקט אחרי תנועת בּוֹלִי',
      companionAction:
        'בּוֹלִי מתגלגל חצי סיבוב לידו/ה, והמדבקה כמעט נדבקת לשריון שלו.',
      relationshipLoop: {
        loopType: 'spark',
        childFeels: 'בבית, אצבע בודקת את קצה המדבקה שעל היד.',
        companionAnswers: 'בּוֹלִי מתגלגל חצי סיבוב לידו/ה, והמדבקה כמעט נדבקת לשריון שלו.',
        childNotices: 'הילד/ה רואה את זה ולוחש/ת אל בּוֹלִי: "כמעט נדבקת אליך."',
        shift: 'חיוך קטן ושקט עולה.',
      },
      requiredObjectSlot: 'homeRoomDetail',
      mustInclude: ['בּוֹלִי', 'מדבקה'],
      mustNotInclude: [
        'הכר ',
        'הכר.',
        'הבינה ש',
        'יודעת ש',
        'למדה ש',
        'גילתה ש',
        'אומץ',
        'הצליחה',
        'גאה בעצמה',
        'קסם',
      ],
      targetWords: 26,
      maxWords: 34,
      maxSentences: 4,
      imageIntent:
        "close-up of hand with colorful sticker, Bolly mid half-roll right beside it, the sticker almost touching his shell, child's small quiet smile",
    },
    {
      page: 20,
      nameAnchor: true,
      dramaticRole: 'sleep_or_calm',
      requiredEvent: 'הילד/ה שוכב/ת; הגוף רך; בּוֹלִי לידו/ה.',
      childBodyState: 'שכיבה, יד שמורה לצד, נשימה רגועה',
      companionAction: 'בּוֹלִי נרדם לידו/ה, ובפנים חם.',
      relationshipLoop: {
        loopType: 'relief',
        childFeels: 'הראש שוקע בכרית, היד שמורה לצד, הגוף רך.',
        companionAnswers: 'בּוֹלִי מתכרבל ממש ליד הילד/ה, ובפנים חם.',
        childNotices: 'הילד/ה מרגיש/ה את החום הקטן שלו לצד הגוף.',
        shift: 'הנשימה נרגעת, ואחר כך העיניים נעצמות.',
      },
      mustInclude: ['בּוֹלִי', 'הכרית'],
      mustNotInclude: [
        'הכר ',
        'הכר.',
        'למדה ש',
        'הבינה ש',
        'מעכשיו',
        'תמיד תזכור',
        'קסם',
      ],
      targetWords: 24,
      maxWords: 32,
      maxSentences: 4,
      imageIntent: 'close-up bedside warm light, hand resting, Bolly snug nearby',
    },
  ],

  // ─────────────────────────────────────────────────────────────────────
  // FORBIDDEN PATTERNS — global. Validator rejects on any match (BLOCKING).
  // ─────────────────────────────────────────────────────────────────────
  forbiddenPatterns: [
    // ── Anti-magic guards — the fantasy is imagination, NOT magic ──
    'קסם',
    'קוסם',
    'כישוף',
    'מטה קסם',
    'עולם אחר',
    'עולם קסום',
    'שער קסום',
    'פורטל',
    'נעלמה המרפאה',
    'המרפאה נעלמה',
    'בּוֹלִי הפך',
    'בולי הפך',
    'בּוֹלִי הפכה',
    'בולי הפכה',
    'לחש קסם',
    'נעלם הכול',
    // ── Anti-abstraction guards ──
    // Fantasy tempts the Author into adult/poetic, non-physical,
    // non-child-Hebrew language ("הרגע קופא ונמוג"). These words describe
    // ATMOSPHERE, not a body action a child can see/feel/re-enact. Blocked
    // on purpose — the fantasy must stay body-mechanics, not mood.
    'נמוג',
    'תפוגג',
    'הרגע קופא',
    'הרגע קפא',
    // ── Anti-internal-metaphor guards (v0.5.0-d) ──
    // The fantasy is PERCEPTION — the child looks at a real thing and sees
    // it can look cozy. It is NOT generating pictures inside the mind.
    'בתוך הראש',
    'בראש שלה',
    'בראש שלו',
    'תמונה בראש',
    'ציור בראש',
    'ציור מתחלף',
    'בתוך הדמיון',
    // ── AI-smell / poetic clichés ──
    'לב התמלא',
    'שקט שרר',
    'האור ליטף',
    'ריח ילדות',
    'האוויר נהיה דק',
    'שקט לבן',
    'נהיה דק ושקט',
    'פתוח חלקית',
    // ── Moral / lesson endings ──
    'למדה ש',
    'למד ש',
    'הבינה ש',
    'הבין ש',
    'מעכשיו והלאה',
    'תמיד תזכור',
    'גאה בעצמה',
    'גאה בעצמו',
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
    // ── Bolly-specific physical wrongness ──
    'ישב על כתפה והתנדנד',
    'רכב על כתף',
    'טיפס על הראש',
  ],

  // ─────────────────────────────────────────────────────────────────────
  // ACCEPTANCE CRITERIA — Y-lite reviewers anchor on these.
  // ─────────────────────────────────────────────────────────────────────
  acceptanceCriteria: [
    'The medical procedure HAPPENS for real — the thermometer touches the child\'s hand on page 14. The fantasy never replaces the real medical event.',
    'The "fantasy" is imagination used as a coping tool — short, concrete mental pictures anchored to the body and to Bolly\'s shell. NEVER a magic world, a portal, or magic solving the fear.',
    'Bolly stays Bolly — he never transforms, never casts anything, never speaks. His mechanic (closing into a ball, טוּמְפּ) is unchanged.',
    'The imaginative reframe on page 10 applies imagination TO the thermometer, but the thermometer stays a thermometer — it does not change, vanish, or become magic.',
    'Resilience core pages 11-14: child body resists → Bolly closes → child mirrors → procedure. Identical to a non-fantasy procedure story.',
    'Bolly\'s closed ball, when imagined on page 12, becomes a concrete comforting image (a small warm cave / nest) — never magic.',
    'Sticker appears only after the procedure (page 15).',
    'Final page (20) shows body state — soft, calm, warm — not a moral lesson.',
    'Every page is an EXCHANGE between the child and Bolly — Bolly registers something in the child and answers it; the child registers his answer and shifts. Not two characters acting in parallel.',
    'Not every page resolves into calm. By design, several middle pages (the rising/peak stretch) end with the child still tense while Bolly stays close, or simply quiet together. Relief is EARNED and ACCUMULATES toward the back half — co-regulation that spans pages. An unresolved or quiet middle page is correct, not a flaw.',
  ],

  qualityTarget: {
    // No fantasy Gold yet — anchor quality against the sealed Adventure Gold.
    goldCandidateId: 'bolly_fantasy_v0.5.5g_gold',
    minBookScore: 4.7,
    minResilienceScore: 4.8,
    maxTechnicalRetries: 2,
    maxAuthorRerolls: 1,
  },

  meta: {
    version: '0.5.5g',
    derivedFrom: 'authored fresh — fantasy "guided imagery resilience" pattern',
    authoredAt: '2026-05-22',
    authoredBy: 'CTO + ChatGPT consult',
    notes: [
      'Third v0.5 Production Recipe, and the riskiest direction.',
      'Concept: "Guided Imagery Resilience" — the procedure is REAL; the fantasy is imagination used as a coping tool, anchored to body + Bolly\'s shell. NOT a magic world.',
      '4-act structure: Act1 home+journey (p1-5), Act2 clinic+imagination builds (p6-10), Act3 resilience core through imagination lens (p11-16), Act4 cooldown+settle+sleep (p17-20).',
      'Resilience core p11-14 is IDENTICAL to the adventure recipe — body resists then Bolly closes then child mirrors then procedure. Pages 11-14 tagged critical=true.',
      'forbiddenPatterns has heavy anti-magic guards (קסם, פורטל, עולם אחר, בּוֹלִי הפך, etc.) — fantasy must stay imagination, never magic.',
      'v0.5.0-c..g: anti-abstraction + anti-internal-metaphor guards; the perception reframe (child LOOKS AT a real thing); calmSimile + imaginativeImage closed slots; book-class variation hazards removed; vocab cleanup; resting verb changed to curls-up.',
      'v0.5.1-pilot / -pilot-b (Phase B): added relationshipBeat (free text) to 6 pages, then rewrote them as cause-response loops. Smoke read: cleaner, but the prose still felt PARALLEL on most pages — relationshipBeat was a third field bolted onto a two-track skeleton.',
      'v0.5.2-pilot (Phase B.3 — page modeled as an INTERACTION): root cause of the sequence-of-actions feel was the PageCard structure itself — childBodyState + companionAction are two parallel-actor fields. FIX: relationshipBeat became relationshipLoop, a 4-beat structured exchange (childFeels, companionAnswers, childNotices, shift). 18 of 20 pages carry a loop; p9 and p11 stay solo. The Author prompt is reworked so the loop IS the page.',
      'v0.5.4-pilot (Phase B.4 — interaction variety): a human read of v0.5.3 found the book had become a single repeated formula — feel, Bolly answers, child calms — on all 18 loop pages, because the loop schema FORCED every page to end in a calming shift. FIX: loopType on every loop (relief / no-relief / hold / spark). Relief is WITHHELD through p3-p8 and DELIVERED, accumulating, from p10 on. Never more than 2 consecutive no-relief pages; Bolly present on every page. p13 caps aligned with p12. p10 simile adjective fixed. The therapeutic arc is unchanged — co-regulation that spans pages is a STRONGER model of regulation.',
      'v0.5.5-pilot (Phase B.5 — name economy rebalance): v0.5.4 overcorrected — the child name fell to 2 uses and parts of the book read as body parts instead of the child. FIX: nameAnchor flag on 9 arc-spread pages (p1,p2,p5,p9,p10,p13,p15,p19,p20); RULE 4 retargeted to 8-12 name uses; 4 recipe-text language fixes (p1 childFeels name-led, p2 childNotices de-explained, p9 childBodyState, p17 shift). loopType, the hold/no-relief curve and direct communication are untouched.',
      'v0.5.5g — SEALED 2026-05-24. 3/3 READY across both genders — נועה + מיכל (girls), דניאל (boy) — tech PASS, Y-lite READY, no Editorial Repair, no Plan LLM. Validated: B.3 relationshipLoop interaction model, B.4 loopType variety, B.5 name economy + nameAnchor + direct-speech attribution, splice-safe retry, gender-neutral placeholders + SMOKE_CHILD_GENDER boy path, maxSentences 4 on loop pages, p8/p10 cap+hook trims, p13 de-didacticized. Gold: gold-candidates/bolly_fantasy_v0.5.5g_gold.md.',
    ],
  },
};

export default bollyFantasyAge5Recipe;
