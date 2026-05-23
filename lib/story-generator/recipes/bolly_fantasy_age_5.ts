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
    'morning reluctance → journey with imagination gently rising → clinic → imaginative reframe of the fear object → body resists → Bolly closes (imagined as a small warm place) → child mirrors → procedure → sticker → cooldown → the imagination settles → sleep',

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
  },

  // ─────────────────────────────────────────────────────────────────────
  // PAGE CARDS — 20 pages. Age tier 5-6: 2-3 sentences / 18-32 words.
  // ─────────────────────────────────────────────────────────────────────
  pageCards: [
    // ─── ACT 1: HOME + JOURNEY (pages 1-5) — imagination begins ───
    {
      page: 1,
      dramaticRole: 'opening_state',
      requiredEvent: 'הבוקר נכנס לחדר; הילד/ה לא רוצה לקום; היום יש בדיקה.',
      childBodyState: 'מסתובב/ת לצד השני, מתחבא/ת מעט במיטה',
      companionAction: 'בּוֹלִי שוכב קרוב לכרית, לוח קטן אחד פתוח, מביט/ה בשקט.',
      requiredExactLine: 'בּוֹלִי שכב ליד הכרית. טוּמְפּ קטן נשמע.',
      mustInclude: ['בּוֹלִי'],
      mustNotInclude: ['קסם', 'הציל', 'אל תפחד'],
      targetWords: 24,
      maxWords: 32,
      maxSentences: 3,
      imageIntent: 'wide shot bedroom, soft morning light, child curled under blanket, Bolly visible near pillow',
    },
    {
      page: 2,
      dramaticRole: 'companion_introduction',
      requiredEvent: 'הילד/ה מתארגן/ת; בּוֹלִי מתגלגל אל התרמיל.',
      childBodyState: 'מתכופף/ת לחפש דבר, ידיים עסוקות',
      companionAction: 'בּוֹלִי מתגלגל החוצה ונעצר ליד התרמיל. נשמע טוּמְפּ קטן.',
      requiredObjectSlot: 'waitingObject',
      mustInclude: ['בּוֹלִי', 'טוּמְפּ'],
      mustNotInclude: ['קסם', 'הבהב'],
      targetWords: 24,
      maxWords: 32,
      maxSentences: 3,
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
      mustInclude: ['בּוֹלִי'],
      mustNotInclude: ['קסם', 'עולם אחר', 'פורטל', 'בתוך הראש', 'תמונה בראש'],
      targetWords: 22,
      maxWords: 30,
      maxSentences: 3,
      imageIntent: 'moving shot on sidewalk, child looking at one real thing on the ground, Bolly rolling alongside',
    },
    {
      page: 4,
      dramaticRole: 'journey_step',
      requiredEvent:
        'ממשיכים ללכת; הילד/ה ממשיך/ה להביט בדברים אמיתיים בדרך בעין רכה — הדרך נשארת דרך אמיתית.',
      childBodyState: 'צעד קל, מבט שקט שעובר על מה שיש בדרך',
      companionAction: 'בּוֹלִי נפתח לאט, לוח אחר לוח, ומתגלגל לצידה.',
      mustInclude: ['בּוֹלִי'],
      mustNotInclude: ['קסם', 'נמוג', 'בתוך הראש', 'ציור מתחלף'],
      targetWords: 22,
      maxWords: 30,
      maxSentences: 3,
      imageIntent: 'moving shot on sidewalk, child and Bolly walking together',
    },
    {
      page: 5,
      dramaticRole: 'arrival_at_setting',
      requiredEvent:
        'מגיעים למרפאה; הרופאה במעיל לבן; הילד/ה מדמיין/ת את החדר כמקום שקט ובטוח — אבל זו עדיין המרפאה.',
      childBodyState: 'נכנס/ת, מטפס/ת על כיסא הבדיקה ברגליים קטנות',
      companionAction: 'בּוֹלִי נח בכיס התרמיל ולא משמיע קול.',
      requiredObjectSlot: 'clinicSetting',
      mustInclude: ['בּוֹלִי', 'רופאה'],
      mustNotInclude: ['הסבירה', 'עולם קסום', 'קסם'],
      targetWords: 26,
      maxWords: 34,
      maxSentences: 3,
      imageIntent: 'interior clinic, child climbing onto exam chair, doctor in white coat in soft focus',
    },

    // ─── ACT 2: CLINIC + IMAGINATION BUILDS (pages 6-10) ───
    {
      page: 6,
      dramaticRole: 'environment_sensing',
      requiredEvent:
        'הילד/ה קולט/ת פרט חושי קונקרטי במרפאה; הגוף מתחיל בשקט להתכונן.',
      childBodyState: 'גוף עוד שקט, כתפיים מעט מורמות, נשימה רדודה יותר',
      companionAction: 'בּוֹלִי מניע לוח קלות בתוך הכיס.',
      requiredObjectSlot: 'sensoryDetail',
      mustInclude: ['בּוֹלִי'],
      mustNotInclude: ['לב התמלא', 'שקט שרר', 'קסם'],
      targetWords: 22,
      maxWords: 30,
      maxSentences: 3,
      imageIntent: 'close-up clinic detail — white paper edge, soap, light — child seated, Bolly in pocket',
    },
    {
      page: 7,
      dramaticRole: 'environment_sensing',
      requiredEvent: 'הילד/ה מחכה בחדר; בּוֹלִי קרוב בכיס.',
      childBodyState: 'יושב/ת על קצה הכיסא, ידיים בחיק',
      companionAction: 'בּוֹלִי שקט בכיס, לוח קטן זז קלות.',
      mustInclude: ['בּוֹלִי'],
      mustNotInclude: ['קסם'],
      targetWords: 22,
      maxWords: 30,
      maxSentences: 3,
      imageIntent: 'medium shot child waiting on the exam chair, Bolly pocket visible',
    },
    {
      page: 8,
      dramaticRole: 'imaginative_reframe',
      // v0.5.0-d: PERCEPTION, not internal imagining. The child looks at a
      // REAL thing already in the room (the light on the wall, the paper,
      // a shape) and notices it can look calm/cozy. The room stays the
      // exam room. No "picture in her head", no "place in her mind".
      requiredEvent:
        'הילד/ה מביט/ה בדבר אמיתי בחדר — אור על הקיר, נייר, צורה — ורואה שהוא יכול להיראות רגוע ונעים. החדר נשאר חדר הבדיקה.',
      childBodyState: 'מבט מתעכב רגע על דבר אמיתי בחדר; מבט רך יותר',
      companionAction: 'בּוֹלִי נשען קרוב בכיס.',
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
      maxSentences: 3,
      imageIntent: 'close-up child looking at one real thing in the room — light on wall — with a softer gaze, clinic room real around',
    },
    {
      page: 9,
      dramaticRole: 'fear_object_appears',
      requiredEvent: 'הרופאה מוציאה מדחום קטן עם קצה כסוף.',
      childBodyState: 'עיניים נעולות באובייקט, בלי לזוז',
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
      dramaticRole: 'imaginative_reframe',
      // The KEY fantasy beat. v0.5.0-d: the child LOOKS AT the real
      // thermometer and notices it can look like a small, calm, concrete
      // thing — a perception, not an internal picture. The thermometer
      // stays a thermometer: it does not change, vanish, or get "wrapped".
      requiredEvent:
        'הילד/ה מביט/ה במדחום ורואה שהוא יכול להיראות כמו דבר קטן ורגוע — אבל הוא נשאר מדחום.',
      childBodyState: 'מבט על המדחום; הילד/ה רואה אותו בעין רכה יותר, הגוף עוד ער',
      companionAction: 'בּוֹלִי נע קלות בכיס ליד הילד/ה.',
      requiredObjectSlot: 'medicalObject',
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
      maxSentences: 3,
      imageIntent: 'close-up child looking at the real thermometer with a softer gaze, still the real object',
    },

    // ─── ACT 3: THE RESILIENCE CORE — through the imagination lens (11-16) ───
    {
      page: 11,
      dramaticRole: 'child_body_resists',
      // v0.5.0-c: requiredEvent + childBodyState sharpened to give the
      // Author a CONCRETE BODY way to convey the tension — so it does not
      // reach for adult atmosphere ("הרגע קופא ונמוג"). Tension is shown
      // through the body (breath, hand, shoulders), never through mood.
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
      dramaticRole: 'companion_closes',
      // v0.5.0-d: the child SEES the closed ball look like a real cozy
      // object (the requiredObject slot value) — perception, not an
      // internal picture. Bolly stays Bolly; the ball stays a ball.
      requiredEvent:
        'בּוֹלִי נסגר לכדור; הילד/ה מביט/ה בכדור ורואה אותו דומה לדבר קטן וחם.',
      childBodyState: 'מרגיש/ה את ההתגלגלות בכיס; מבט רך על הכדור',
      companionAction:
        'בּוֹלִי מתגלגל ונסגר לכדור חם ושקט. נשמע טוּמְפּ.',
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
      dramaticRole: 'child_mirrors',
      requiredEvent:
        'הילד/ה מבצע/ת את המנגנון בגוף — אגרוף ואז פתיחה אצבע אחר אצבע — עם התמונה הדמיונית בראש.',
      childBodyState:
        'יד נסגרת לאגרוף קטן ומחזיקה רגע, ואז נפתחת לאט, אצבע אחר אצבע',
      companionAction: 'בּוֹלִי לא מופיע במפורש (הילד/ה הוא/היא המראָה).',
      mustInclude: ['יד', 'אצבע'],
      mustNotInclude: ['בּוֹלִי אמר', 'נזכרה ש', 'קסם'],
      targetWords: 24,
      maxWords: 32,
      maxSentences: 3,
      imageIntent: 'close-up small hand opening slowly, finger by finger',
      critical: true,
    },
    {
      page: 14,
      dramaticRole: 'procedure_happens',
      requiredEvent: 'המדחום נוגע ביד; קצר וקונקרטי; הדמיון הוא עדשת ההתמודדות.',
      childBodyState: 'נשאר/ת על הכיסא, גוף שקט',
      companionAction: 'בּוֹלִי שקט בכיס.',
      requiredObjectSlot: 'medicalObject',
      mustInclude: ['מדחום'],
      mustNotInclude: ['כאב נורא', 'דקירה חזקה', 'בכתה', 'צרחה', 'ברחה', 'קסם'],
      targetWords: 20,
      maxWords: 28,
      maxSentences: 3,
      imageIntent: 'close-up hand and thermometer tip, brief contact',
      critical: true,
    },
    {
      page: 15,
      dramaticRole: 'residue_appears',
      requiredEvent: 'הרופאה מדביקה מדבקה; בּוֹלִי פותח לוחית אחת ומציץ.',
      childBodyState: 'מסתכל/ת על המדבקה ביד, ראש מעט מורם',
      companionAction: 'בּוֹלִי פותח לוחית אחת ומציץ. נשמע טוּמְפּ רך.',
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
        'בּוֹלִי נפתח לגמרי; הילד/ה רגוע/ה יותר, התמונה הדמיונית מתרככת.',
      childBodyState: 'כתפיים יורדות לאט, נשימה איטית יותר',
      companionAction: 'בּוֹלִי נפתח לאט, לוח אחר לוח.',
      mustInclude: ['בּוֹלִי'],
      mustNotInclude: ['קסם', 'גאה בעצמה'],
      targetWords: 22,
      maxWords: 30,
      maxSentences: 3,
      imageIntent: 'close-up Bolly opening plate by plate, child calmer on the chair',
    },

    // ─── ACT 4: COOLDOWN + IMAGINATION SETTLES + SLEEP (17-20) ───
    {
      page: 17,
      dramaticRole: 'cooldown_journey',
      requiredEvent: 'יוצאים מהמרפאה; הולכים הביתה; המדבקה על היד.',
      childBodyState: 'הולך/ת לאט, מסתכל/ת על המדבקה',
      companionAction: 'בּוֹלִי נח בכיס התרמיל ולא זז.',
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
      maxSentences: 3,
      imageIntent: 'street shot child walking home, sticker visible on hand, Bolly tucked in bag',
    },
    {
      page: 18,
      dramaticRole: 'cooldown_journey',
      requiredEvent: 'בדרך הביתה; הילד/ה מביט/ה במדבקה; הדמיון מתרכך לזיכרון חמים.',
      childBodyState: 'צעד רגוע, מבט שקט על המדבקה',
      companionAction: 'בּוֹלִי שקט בתרמיל.',
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
      maxSentences: 3,
      imageIntent: 'street shot nearing home, child glancing at the sticker',
    },
    {
      page: 19,
      dramaticRole: 'home_inspection',
      // The fantasy spark beat — same shape as adventure p14.
      requiredEvent:
        'בבית — הילד/ה בודק/ת את המדבקה; בּוֹלִי עושה תנועה קטנה ומשחקית והילד/ה מחייך/ת.',
      childBodyState:
        'יד מורמת, אצבע נוגעת בקצה המדבקה; חיוך קטן ושקט אחרי תנועת בּוֹלִי',
      companionAction:
        'בּוֹלִי מתגלגל חצי סיבוב לידה, והמדבקה כמעט נדבקת לשריון שלו.',
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
      dramaticRole: 'sleep_or_calm',
      requiredEvent: 'הילד/ה שוכב/ת; הגוף רך; בּוֹלִי לידה.',
      childBodyState: 'שכיבה, יד שמורה לצד, נשימה רגועה',
      companionAction: 'בּוֹלִי נרדם לידה, ובפנים חם.',
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
      maxSentences: 3,
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
    // (v0.5.0-c: restored "נמוג" — earlier removal was wrong; unlike the
    //  "הכר " typo-guard, "נמוג" has no legitimate child-Hebrew use.)
    'נמוג',
    'תפוגג',
    'הרגע קופא',
    'הרגע קפא',
    // ── Anti-internal-metaphor guards (v0.5.0-d) ──
    // The fantasy is PERCEPTION — the child looks at a real thing and sees
    // it can look cozy. It is NOT generating pictures inside the mind.
    // These phrases mark internal-metaphor drift and are blocked.
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
    'Bolly cannot be replaced by a generic teddy bear — the closing-into-ball mechanic must carry the resilience moment.',
  ],

  qualityTarget: {
    // No fantasy Gold yet — anchor quality against the sealed Adventure Gold.
    goldCandidateId: 'bolly_adventure_v0.5.0-f_gold',
    minBookScore: 4.7,
    minResilienceScore: 4.8,
    maxTechnicalRetries: 2,
    maxAuthorRerolls: 1,
  },

  meta: {
    version: '0.5.0-e',
    derivedFrom: 'authored fresh — fantasy "guided imagery resilience" pattern',
    authoredAt: '2026-05-22',
    authoredBy: 'CTO + ChatGPT consult',
    notes: [
      'Third v0.5 Production Recipe, and the riskiest direction.',
      'Concept: "Guided Imagery Resilience" — the procedure is REAL; the fantasy is imagination used as a coping tool, anchored to body + Bolly\'s shell. NOT a magic world.',
      '4-act structure approved by user 2026-05-22: Act1 home+journey (p1-5), Act2 clinic+imagination builds (p6-10), Act3 resilience core through imagination lens (p11-16), Act4 cooldown+settle+sleep (p17-20).',
      'Resilience core p11-14 is IDENTICAL to the adventure recipe — body resists → Bolly closes → child mirrors → procedure. Pages 11-14 tagged critical=true.',
      'Two imaginative_reframe pages: p8 (room-level, gentle — establishes the technique) and p10 (THE key beat — imagination applied to the thermometer).',
      'forbiddenPatterns has heavy anti-magic guards (קסם, פורטל, עולם אחר, בּוֹלִי הפך, etc.) — fantasy must stay imagination, never magic.',
      '20 pages → pacing risk. Caps kept tight; pageLengthSpike validator stays strict.',
      'p19 is the spark beat — same shape as adventure p14 (Bolly half-rolls, sticker almost sticks to shell, quiet smile).',
      'v0.5.0-c: anti-abstraction guards. First smoke had the Author write "הרגע קופא קצר ונמוג בנשימה קצרה" on p11 — adult/poetic, non-physical. recipeContract correctly BLOCKED "נמוג". Kept "נמוג" (no legitimate child-Hebrew use — unlike the "הכר " typo-guard) and added "תפוגג" / "הרגע קופא" / "הרגע קפא". Fantasy must stay body-mechanics, never atmosphere.',
      'v0.5.0-d: ROOT FIX for the abstraction drift. Smoke on דניאל scored book=4.17 — the Author built INTERNAL metaphors ("קן רך וקטן בתוך הראש", "ציור מתחלף", "עטוף בפינה שקטה"). Root cause was the recipe ITSELF: requiredEvent fields said "לדמיין תמונה" / "מקום נעים בראש". Reframed the whole fantasy as PERCEPTION, not internal imagining — the child LOOKS AT a real object and SEES it can look cozy. Rewrote p3/p4/p8/p10/p12 to "מביט/ה ב<real thing> ורואה ש...". imaginativeImage values changed from abstract ("קן רך וקטן") to physical scene objects ("כרית קטנה ורכה", "גבעה קטנה של שמיכה"). Added anti-internal-metaphor guards (בתוך הראש / תמונה בראש / ציור מתחלף ...).',
      'v0.5.0-e: removed two book-class variation hazards. waitingObject held "מדף נמוך עם ספרים" and homeRoomDetail held "הספר הפתוח על הרצפה" — both feed book objects to the Author. On דניאל the Author turned "shelf with books" into "מחברת" on p2, a Bolly-forbidden object; the forbiddenObjects validator BLOCKED it correctly. Root cause was the recipe feeding a taboo input, not the validator. No new guards added — "מחברת" is already caught by forbiddenObjects, and bare "ספר" would false-positive on מספר / לספר. The unrelated foreignChars "resting" leak on p10 (English code-switch) is NOT fixable by recipe edits — it needs #172 page-level reroll.',
    ],
  },
};

export default bollyFantasyAge5Recipe;
