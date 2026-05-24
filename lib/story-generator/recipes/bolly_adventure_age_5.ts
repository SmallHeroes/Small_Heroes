/**
 * Production Recipe — Bolly the Armadillo / Medical Procedure / Adventure / Age 5-6.
 *
 * The straight medical-procedure direction: the child goes to a clinic and
 * a real thermometer check happens — no fantasy layer, no guided imagery.
 * Bolly is a friend who answers in body; the resilience pattern is
 * body-resists → companion closes → child mirrors → procedure → residue.
 *
 * v0.5.6 — converted to the SEALED Fantasy standard (B.3 / B.4 / B.5):
 *   - B.3: every page (except the two solo beats p7 + p8) is a 4-beat
 *     relationshipLoop (childFeels → companionAnswers → childNotices →
 *     shift) — a page is ONE exchange, not two parallel actors.
 *   - B.4: each loop carries a loopType (relief / no-relief / hold /
 *     spark). Relief is WITHHELD through the clinic approach (p3-p8) and
 *     DELIVERED, accumulating, from p9 (the turn) on.
 *   - B.5: nameAnchor on 8 arc-spread pages; 4 direct-communication beats
 *     (p2, p9, p10, p14). Fully gender-neutral — every child-referencing
 *     word uses /ה placeholders. maxSentences 4 on loop pages.
 *
 * 15 pages (Pricing v2: adventure = 15p / ₪79).
 */

import type { ProductionRecipe } from './recipe-types';

export const bollyAdventureAge5Recipe: ProductionRecipe = {
  id: 'bolly_adventure_age_5',
  companionId: 'bolly_armadillo',
  category: 'MEDICAL_PROCEDURE',
  direction: 'adventure',
  ageTier: '5-6',
  pageCount: 15,

  storyPromise:
    'הילד/ה עובר/ת בדיקה רפואית קטנה עם פחד אמיתי, פוגש/ת את מנגנון ההתמודדות של בּוֹלִי, ויוצא/ת עם גוף רך יותר וזיכרון של ניצחון קטן.',

  emotionalArc:
    'morning reluctance → journey with Bolly close → clinic → fear-object → body resists → Bolly closes → child mirrors → procedure → sticker → relief accumulates → soft sleep',

  resiliencePattern:
    'PROCEDURE_BODY_RESISTANCE_THEN_MIRROR — the child physically resists before the procedure (hand pulling back, shoulders rising, eyes escaping), the companion closes into a ball (Bolly mechanic), the child mirrors with its own body (fist then opening finger by finger), the procedure is short and concrete, the sticker residue closes the loop.',

  // ─────────────────────────────────────────────────────────────────────
  // VARIATION SLOTS — conservative MVP scope. medicalObject locked to מדחום.
  // v0.5.6: book-class hazards removed from waitingObject + homeRoomDetail —
  // a book-class object can lead the Author to a Bolly-forbidden object.
  // ─────────────────────────────────────────────────────────────────────
  variationSlots: {
    clinicSetting: ['מרפאת ילדים', 'חדר בדיקה קטן', 'מרפאה משפחתית'],
    medicalObject: ['מדחום'],
    waitingObject: ['כיסא קטן', 'וילון קל', 'שטיח רך'],
    sensoryDetail: [
      'ריח של סבון',
      'אור לבן וחזק',
      'נייר קר על המיטה',
      'שעון קטן שמתקתק',
    ],
    stickerType: [
      'מדבקה צבעונית',
      'מדבקה עגולה עם פנים',
      'מדבקה עם פס קטן',
    ],
    weatherOutside: ['אור בוקר רך', 'שמיים אפורים', 'רוח קלה'],
    homeRoomDetail: ['הכרית', 'השמיכה', 'השטיח הרך'],
  },

  // ─────────────────────────────────────────────────────────────────────
  // PAGE CARDS — 15 pages. Age tier 5-6: 2-3 sentences / 18-32 words base.
  // v0.5.6 (Phase B.3): each loop page carries a relationshipLoop — the
  // page IS an exchange (childFeels → companionAnswers → childNotices →
  // shift). p7 + p8 stay SOLO (fear-object beat / child-resists beat).
  // v0.5.6 (Phase B.4): each loop carries a loopType. Distribution —
  //   p1 relief · p2 spark · p3 hold · p4 no-relief · p5 hold ·
  //   p6 no-relief · p7 SOLO · p8 SOLO · p9 relief (THE TURN) ·
  //   p10 spark · p11 hold · p12 relief · p13 relief · p14 spark ·
  //   p15 relief.
  // Relief is withheld through the rising stretch (p3-p8) and delivered,
  // accumulating, from p9 on. Bolly is present and close on every page
  // except p8, where his answer is deliberately held for the p9 turn.
  // ─────────────────────────────────────────────────────────────────────
  pageCards: [
    // ─── ACT 1: HOME → JOURNEY (pages 1-4) ───
    {
      page: 1,
      nameAnchor: true,
      dramaticRole: 'opening_state',
      requiredEvent: 'הבוקר נכנס לחדר; הילד/ה לא רוצה לקום; היום יש בדיקה.',
      childBodyState: 'מסתובב/ת לצד השני, מתחבא/ת מעט במיטה',
      companionAction: 'בּוֹלִי שוכב קרוב לכרית, פס שריון קטן אחד פתוח, מביט/ה בילד/ה בשקט.',
      relationshipLoop: {
        loopType: 'relief',
        childFeels: 'הבוקר נכנס לחדר, והילד/ה מתכווצ/ת מתחת לשמיכה — היום יש בדיקה.',
        companionAnswers: 'בּוֹלִי, ליד הכרית, מזיז פס שריון קטן ומשמיע טוּמְפּ חרישי.',
        childNotices: 'הטוּמְפּ הקטן נשמע קרוב — בּוֹלִי ער.',
        shift: 'הגוף עדיין מכווץ, אבל קצת פחות לבד.',
      },
      mustInclude: ['בּוֹלִי'],
      mustNotInclude: ['הציל', 'אמיץ', 'אל תפחד'],
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
      mustNotInclude: ['הלוח', 'הבהב', 'זרח מבפנים'],
      targetWords: 26,
      maxWords: 32,
      maxSentences: 4,
      imageIntent: 'medium shot floor near bed and backpack, Bolly mid-roll',
    },
    {
      page: 3,
      dramaticRole: 'journey_step',
      // v0.5.6: companionAction was a full close-to-ball — moved to a gentle
      // half-roll. The full close is reserved for p9 (THE TURN) so the
      // mechanic lands once, with weight.
      requiredEvent: 'הילד/ה והמלווה בדרך למרפאה; עצירה קצרה.',
      childBodyState: 'עומד/ת, מסתכל/ת למטה',
      companionAction: 'בּוֹלִי מתגלגל חצי סיבוב ונעצר צמוד אליו/ה.',
      relationshipLoop: {
        loopType: 'hold',
        childFeels: 'בדרך למרפאה הצעדים מתקצרים; המבט יורד אל המדרכה.',
        companionAnswers: 'בּוֹלִי מתגלגל חצי סיבוב ונעצר ממש צמוד אליו/ה.',
        childNotices: 'הילד/ה מרגיש/ה אותו צמוד לרגל.',
        shift: 'אף אחד לא ממהר — הם פשוט הולכים יחד, צעד ליד צעד.',
      },
      mustInclude: ['בּוֹלִי'],
      mustNotInclude: ['הציל', 'גיבור'],
      targetWords: 22,
      maxWords: 32,
      maxSentences: 4,
      imageIntent: 'street level, child walking, Bolly rolling close alongside on the sidewalk',
    },
    {
      page: 4,
      dramaticRole: 'journey_step',
      requiredEvent: 'ממשיכים ללכת עוד קצת; הולכים יחד אל המרפאה.',
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
      mustNotInclude: ['הבהב', 'זרח'],
      targetWords: 24,
      maxWords: 32,
      maxSentences: 4,
      imageIntent: 'moving shot on sidewalk, child walking, Bolly rolling alongside',
    },

    // ─── ACT 2: CLINIC SETUP (pages 5-7) ───
    {
      page: 5,
      nameAnchor: true,
      dramaticRole: 'arrival_at_setting',
      requiredEvent: 'הגעה למרפאה; רופאה עם מעיל לבן; טיפוס על כיסא הבדיקה.',
      childBodyState: 'מטפס/ת ברגליים קטנות, יושב/ת על הקצה',
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
      mustNotInclude: ['הסבירה', 'אמרה לה ש'],
      targetWords: 26,
      maxWords: 34,
      maxSentences: 4,
      imageIntent: 'interior clinic, child climbing onto exam chair, doctor in white coat in soft focus',
    },
    {
      page: 6,
      dramaticRole: 'environment_sensing',
      requiredEvent:
        'הילד/ה קולט/ת פרט חושי קונקרטי במרפאה; הגוף מתחיל בשקט להתכונן לכיווץ הקרוב.',
      childBodyState:
        'גוף עוד שקט, אבל הכתפיים מעט מורמות; נשימה רדודה יותר; מבט נצמד לפרט אחד',
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
      mustNotInclude: [
        'לב התמלא',
        'שקט שרר',
        'האור ליטף',
        'יפה מאוד',
        'נחמד שם',
        'הרגישה רגועה',
        'הסתכלה סביב סביב',
      ],
      targetWords: 22,
      maxWords: 32,
      maxSentences: 4,
      imageIntent:
        'close-up clinic detail that primes contraction — white paper edge, soap dispenser, thermometer case, NOT a wide pretty interior',
    },
    {
      page: 7,
      nameAnchor: true,
      dramaticRole: 'fear_object_appears',
      // SOLO BEAT — no relationshipLoop. The feared object appears; the
      // child freezes on it; Bolly stays silent in the pocket. His answer
      // is deliberately HELD for the resilience core (p9). Render
      // requiredEvent + childBodyState directly — short and concrete.
      requiredEvent: 'הרופאה מוציאה מדחום קטן עם קצה כסוף.',
      childBodyState: 'לא מצליח/ה להוריד את העיניים מהמדחום, בלי לזוז',
      companionAction: 'בּוֹלִי שקט בכיס.',
      requiredObjectSlot: 'medicalObject',
      mustInclude: ['מדחום'],
      mustNotInclude: ['דקרני', 'מפחיד'],
      targetWords: 18,
      maxWords: 28,
      maxSentences: 2,
      imageIntent: 'close-up doctor hand holding small thermometer with silver tip',
    },

    // ─── ACT 3: THE CORE BEATS (pages 8-12) ───
    // These pages carry the entire resilience pattern. Tight, physical,
    // in this exact order.
    {
      page: 8,
      dramaticRole: 'child_body_resists',
      // SOLO BEAT — no relationshipLoop. The child's body resists; Bolly is
      // intentionally ABSENT from the prose (his answer is held for the p9
      // turn). Giving p8 a loop would make Bolly answer too early and rob
      // p9 of its power. Render childBodyState directly.
      requiredEvent:
        'הרופאה קרבה את היד; הגוף נסוג מעט — המתח מסופר דרך הגוף, לא דרך אווירה.',
      childBodyState:
        'יד נמשכת מעט לאחור, כתפיים עולות, עיניים בורחות אל הקיר, נשימה מתקצרת',
      companionAction: 'בּוֹלִי לא מופיע בעמוד הזה (בכיס, שקט).',
      mustInclude: ['יד'],
      mustNotInclude: ['בכתה', 'צרחה', 'אבל אז'],
      targetWords: 24,
      maxWords: 32,
      maxSentences: 3,
      imageIntent: "medium shot child's shoulders rising, hand pulling back slightly",
      critical: true,
    },
    {
      page: 9,
      nameAnchor: true,
      dramaticRole: 'companion_closes',
      // THE TURN — first real relief after the p3-p8 rising stretch. Bolly
      // performs his core mechanic: the full close into a ball.
      requiredEvent: 'בּוֹלִי מבצע את המנגנון המרכזי שלו — נסגר לכדור.',
      childBodyState: 'מרגיש/ה את ההתגלגלות בכיס',
      companionAction: 'בּוֹלִי מתגלגל ונסגר לכדור חם ושקט. נשמע טוּמְפּ.',
      relationshipLoop: {
        loopType: 'relief',
        childFeels: 'אחרי שהיד התקרבה, הגוף עוד מכווץ.',
        companionAnswers: 'בּוֹלִי מרגיש את הדריכות ונסגר לכדור קטן וחם — טוּמְפּ.',
        childNotices: 'הילד/ה מרגיש/ה את הכדור החם, ולוחש/ת: "גם אתה?"',
        shift: 'בּוֹלִי נשאר עגול וחם, ויד קטנה מונחת עליו.',
      },
      mustInclude: ['בּוֹלִי', 'טוּמְפּ', 'כדור'],
      mustNotInclude: ['הציל', 'הגן עליה'],
      targetWords: 26,
      maxWords: 34,
      maxSentences: 4,
      imageIntent: 'close-up pocket lump, small ball-shape visible through fabric',
      critical: true,
    },
    {
      page: 10,
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
      mustNotInclude: ['בּוֹלִי אמר ש', 'נזכרה ש'],
      targetWords: 26,
      maxWords: 34,
      maxSentences: 4,
      imageIntent: 'close-up small hand opening slowly, finger by finger',
      critical: true,
    },
    {
      page: 11,
      dramaticRole: 'procedure_happens',
      requiredEvent: 'המדחום נוגע ביד; קצר וקונקרטי.',
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
      mustNotInclude: [
        'כאב נורא',
        'דקירה חזקה',
        'בכתה',
        'צרחה',
        'ברחה',
        'התחבאה',
      ],
      targetWords: 26,
      maxWords: 34,
      maxSentences: 4,
      imageIntent: 'close-up hand and thermometer tip, brief contact',
      critical: true,
    },
    {
      page: 12,
      dramaticRole: 'residue_appears',
      requiredEvent: 'הרופאה מדביקה מדבקה; בּוֹלִי פותח פס שריון אחד.',
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
      mustNotInclude: [
        'לוח ורוד זרח',
        'הלוח זרח',
        'זרח ממנו',
        'הבהב מבפנים',
      ],
      targetWords: 26,
      maxWords: 34,
      maxSentences: 4,
      imageIntent: "medium shot sticker on child's hand, Bolly's plate slightly open",
    },

    // ─── ACT 4: COOLDOWN (pages 13-15) ───
    {
      page: 13,
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
        'רכב על',
        'הבינה ש',
        'יודעת ש',
        'למדה ש',
        'גילתה ש',
        'מעכשיו',
        'גאה בעצמה',
        'הכל בסדר',
      ],
      targetWords: 22,
      maxWords: 30,
      maxSentences: 4,
      imageIntent: 'street shot child walking home, sticker visible on hand, Bolly tucked in bag',
    },
    {
      page: 14,
      nameAnchor: true,
      dramaticRole: 'home_inspection',
      // The SPARK beat — the one small physical delight of the book. Bolly
      // half-rolls and the sticker almost sticks to his shell; the child
      // smiles. NOT a joke, NOT dialogue, NOT magic — one bright note.
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
      page: 15,
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
      ],
      targetWords: 24,
      maxWords: 32,
      maxSentences: 4,
      imageIntent: 'close-up bedside warm light, hand resting, Bolly snug nearby',
    },
  ],

  // ─────────────────────────────────────────────────────────────────────
  // FORBIDDEN PATTERNS — global, applied to every page.
  // Validator rejects on substring or regex match → BLOCKING → reroll.
  // ─────────────────────────────────────────────────────────────────────
  forbiddenPatterns: [
    // AI-smell / poetic clichés
    'לב התמלא',
    'שקט שרר',
    'האור ליטף',
    'נשמת הסיפור',
    'בליבה ידעה',
    'בעיניה ראתה את כל',
    'בכל פעם מחדש',
    // v0.5.0-d (#170 polish) — adult-poetic patterns observed in smoke runs:
    'ריח ילדות',
    'האוויר נהיה דק',
    'שקט לבן',
    'טומפ בזיכרון',
    'האוויר התמלא',
    'ריח של חמימות',
    'נהיה דק ושקט',
    // v0.5.0-f — mechanical phrasing that leaked from the recipe own
    // companionAction text and was flagged broken_hebrew by Y-lite:
    'פתוח חלקית',

    // Bolly-specific AI-poetic (Gold Candidate polish notes)
    'הלוח הוורוד שלו הבהב',
    'לוח ורוד זרח',
    'זרח ממנו',
    'הבהב מבפנים',

    // Bolly-specific physical wrongness
    'ישב על כתפה והתנדנד',
    'רכב על כתף',
    'טיפס על הראש',

    // Action-hero / rescuer framing
    'בּוֹלִי הציל',
    'בּוֹלִי הגן',
    'בּוֹלִי לחם',

    // Companion-speech guards. Bolly is a body, not a voice.
    'בּוֹלִי אמר',
    'בּוֹלִי אומר',
    'בּוֹלִי לחש',
    'בולי אמר',
    'בולי אומר',
    'בולי לחש',
    'אמר בּוֹלִי',
    'אמר בולי',
    'לחש בּוֹלִי',
    'לחש בולי',

    // Moral / lesson endings
    'למדה ש',
    'הבינה ש',
    'מעכשיו והלאה',
    'תמיד תזכור',
    'הסיפור הזה לימד אותה',

    // Meta leakage (from editorial repair history)
    'פשטי את',
    'כתיבה פשוטה',
    'סיים בשינה רכה',
    'עמוד 1:',
    'Page 1:',

    // Adult voice in narration
    'אל תפחדי',
    'אל תדאגי',
    'הכל יהיה בסדר',

    // v0.5.6 — malformed word caught in מיכל smoke. Leading space keeps it a
    // standalone-token guard (won't false-match מדוקדק). Temp local guard;
    // the class fix is the deterministic Hebrew lexicon validator (backlog #183).
    ' דוקדק',
  ],

  // ─────────────────────────────────────────────────────────────────────
  // ACCEPTANCE CRITERIA — Y-lite reviewers anchor on these.
  // If any criterion fails, Resilience Reviewer must score that
  // dimension as FAIL (not WEAK).
  // ─────────────────────────────────────────────────────────────────────
  acceptanceCriteria: [
    'Child physically resists BEFORE the procedure (pages 7-8) — pulling back, shoulders rising, or eyes escaping. At least two of these signals.',
    'Bolly performs its core mechanic (closing into a ball with טוּמְפּ) AFTER child resistance and BEFORE child mirroring (page 9 exactly).',
    'Child mirrors Bolly with own body — hand closing to fist and opening finger by finger — on page 10, not earlier and not later.',
    'Procedure is short and concrete: one or two sentences, no dramatization of pain (page 11).',
    'Sticker appears ONLY after procedure (page 12), never before.',
    'Final page shows body state (soft hand, even breath, warmth), NOT a moral lesson or narrator wisdom.',
    'Bolly cannot be replaced by a generic teddy bear — the closing-into-ball mechanic must be load-bearing for the resilience moment.',
    'Story never has Bolly speak to instruct the child. The mirroring is bodily, not verbal.',
    'Doctor never lectures. Doctor speaks at most one short sentence across the entire book.',
    'Not every page resolves into calm. By design, several middle pages (the rising stretch p3-p8) end with the child still tense while Bolly stays close, or simply quiet together. Relief is EARNED and ACCUMULATES toward the back half — co-regulation that spans pages. An unresolved or quiet middle page is correct, not a flaw.',
  ],

  qualityTarget: {
    goldCandidateId: 'bolly_adventure_v0.4.7',
    minBookScore: 4.7,
    minResilienceScore: 4.8,
    maxTechnicalRetries: 2,
    maxAuthorRerolls: 1,
  },

  meta: {
    version: '0.5.6-pilot',
    derivedFrom: 'gold-candidates/bolly_adventure_v0.4.7.md',
    authoredAt: '2026-05-22',
    authoredBy: 'CTO + ChatGPT consult',
    notes: [
      'First Production Recipe authored under v0.5 design.',
      'medicalObject locked to מדחום until syringe/stethoscope/gargle beats are authored.',
      'Page 8 deliberately marks Bolly as NOT present in prose — the mechanic appears in page 9.',
      'All forbiddenPatterns reflect actual past failures, not speculation.',
      'v0.5.0-b: p6 reframed from atmosphere to fear-priming; moral-summary guards extended to p13+p14+p15; p11 escalation guards added; pages 8-11 tagged critical.',
      'v0.5.0-c..g: p1 companion lock; adult-poetic patterns added to forbiddenPatterns; SPARK beat on p14; vocab cleanup (לוח → פס שריון, נח בכיס → התכרבל בכיס).',
      // ── v0.5.6 — conversion to the SEALED Fantasy standard (B.3/B.4/B.5) ──
      'v0.5.6 (Phase B.3): every page except the two solo beats (p7 fear-object, p8 child-resists) carries a 4-beat relationshipLoop — the page modeled as ONE exchange (childFeels → companionAnswers → childNotices → shift), not two parallel actors.',
      'v0.5.6 (Phase B.4): each loop carries a loopType. Relief is WITHHELD through the rising stretch (p3-p8) and DELIVERED, accumulating, from p9 (the turn). Distribution: p1 relief, p2 spark, p3 hold, p4 no-relief, p5 hold, p6 no-relief, p7+p8 SOLO, p9 relief, p10 spark, p11 hold, p12 relief, p13 relief, p14 spark, p15 relief. Never more than one no-relief page in a row; Bolly close on every page except p8.',
      'v0.5.6 (Phase B.5): nameAnchor on 8 arc-spread pages (p1,p2,p5,p7,p9,p10,p14,p15); 4 direct-communication beats (p2 atah ba iti, p9 gam atah, p10 kacha, p14 kimat nidbakt elecha); maxSentences bumped to 4 on every loop page — a 4-beat loop needs 4 short sentences. Word caps unchanged from v0.5.0-g.',
      'v0.5.6: p3 companionAction changed from a full close-to-ball to a gentle half-roll — the full close is reserved for p9 (the turn) so the mechanic lands once, with weight.',
      'v0.5.6: gender fixes — p4/p14/p15 hardcoded feminine child-references (לצידה / לידה) converted to /ה placeholder forms. p1 requiredExactLine removed — the relationshipLoop now carries the opening.',
      'v0.5.6: acceptanceCriteria gained a 10th item ("not every page resolves into calm") so Y-lite does not score an unresolved middle page as failed regulation.',
      'v0.5.6: book-class hazards removed from waitingObject (מדף נמוך עם ספרים) and homeRoomDetail (הספר הפתוח על הרצפה).',
      'v0.5.6 pre-smoke cleanup: p8 requiredEvent regrammared (הילד/ה גוף נסוג → הגוף נסוג מעט); p11 maxWords 26 → 28 — a 4-beat procedure loop needs the room, pre-empting the likeliest cap failure.',
      'v0.5.6 cap calibration (post נועה smoke #1): the run hit a HARD GATE — p6 could not fit a 4-beat loop in maxWords 28. Root cause: the conversion bumped maxSentences 3→4 but kept v0.5.0-g word caps. Fix: loop-page word caps aligned to the proven Fantasy reference (raise-only) — p1 32→38, p6 28→32, p9 30→34, p10 32→34. p6 set to 32 (2 above Fantasy 30) per observed Author output 34/36/38.',
      'v0.5.6 cap calibration #2 (post מיכל smoke): p11 maxWords 28→34, targetWords 18→26. p11 consumed the full 2-round retry budget twice (first-pass 39, then 36) and the retry-compressed prose came out clipped — a 4-beat procedure loop needs a procedure-sized word budget. +6 over Fantasy p14, evidence-based, same logic as p6.',
      'PENDING SEAL: requires 2 girl runs + 1 boy run (SMOKE_CHILD_GENDER=boy), all 3/3 READY, before sealing.',
    ],
  },
};

export default bollyAdventureAge5Recipe;
