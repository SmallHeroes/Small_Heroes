/**
 * Production Recipe — Bolly the Armadillo / Medical Procedure / Adventure / Age 5-6.
 *
 * SOURCE OF TRUTH: gold-candidates/bolly_adventure_v0.4.7.md
 * (tech=PASS, Y-lite book=4.83, resilience=5.00, $0.101, 1 editorial repair)
 *
 * This recipe is the first v0.5 Production Recipe. It encodes the 15-beat
 * structure that produced the Gold Candidate, with absolute boundaries
 * (mustInclude / mustNotInclude / forbiddenPatterns) and conservative
 * variation slots.
 *
 * GOLD CANDIDATE POLISH NOTES (encoded as forbidden patterns below):
 *   - "הלוח X הבהב מבפנים" / "לוח X זרח ממנו"  → AI/poetic. Killed.
 *   - "בּוֹלִי ישב על כתפה והתנדנד"             → Physically wrong for armadillo. Killed.
 *   - "ליד הכר" (without ית)                    → Typo. Locked anchor "הכרית".
 *
 * The Author LLM does NOT invent structure. It writes prose that satisfies
 * each Page Card. If a Page Card cannot be satisfied within caps, the
 * Composer rerolls that page — it does NOT call Editorial Repair on prose.
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
    'הילד/ה חווה/ה רגע רפואי קטן עם פחד אמיתי, פוגש/ת מנגנון התמודדות של בּוֹלִי, ויוצא/ת מהסיפור עם גוף רך יותר וזיכרון של ניצחון קטן.',

  emotionalArc:
    'reluctance → leaving → arrival → fear-object → body-resists → companion-closes → child-mirrors → procedure → residue → cooldown → soft-sleep',

  resiliencePattern:
    'PROCEDURE_BODY_RESISTANCE_THEN_MIRROR — child physically resists before procedure (יד נמשכת/כתפיים עולות/עיניים ברחו), companion closes into ball (Bolly mechanic), child mirrors with own body (אגרוף → פתיחה אצבע אחר אצבע), procedure is short and concrete, residue (sticker) closes the loop.',

  // ─────────────────────────────────────────────────────────────────────
  // VARIATION SLOTS — conservative MVP scope.
  // medicalObject is locked to מדחום for v0.5a. Other objects need their
  // own beats (e.g., a syringe requires a stronger child-resists page).
  // ─────────────────────────────────────────────────────────────────────
  variationSlots: {
    clinicSetting: [
      'מרפאת ילדים',
      'חדר בדיקה קטן',
      'מרפאה משפחתית',
    ],
    medicalObject: [
      'מדחום',
      // 'סטטוסקופ' — locked until we author a sound-based resists beat
      // 'מקל לבדיקת גרון' — locked until we author a mouth-opening beat
    ],
    waitingObject: [
      'כיסא קטן',
      'תרמיל',
      'מדף נמוך עם ספרים',
    ],
    sensoryDetail: [
      'ריח של סבון',
      'אור לבן וחזק',
      'נייר קר על המיטה',
      'שעון קטן שתקתק',
    ],
    stickerType: [
      'מדבקה צבעונית',
      'מדבקה עגולה עם פנים',
      'מדבקה עם פס קטן',
    ],
    weatherOutside: [
      'אור בוקר רך',
      'שמיים אפורים',
      'רוח קלה',
    ],
    homeRoomDetail: [
      'הכרית',
      'השמיכה',
      'הספר הפתוח על הרצפה',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  // PAGE CARDS — 15 pages, each a hard contract.
  // Age tier 5-6 base caps: 2-3 sentences / 18-32 words. Some pages
  // (companion-strict) bumped to maxSentences=4 to give Author room.
  // ─────────────────────────────────────────────────────────────────────
  pageCards: [
    // ─── ACT 1: HOME → JOURNEY (pages 1-4) ───
    {
      page: 1,
      dramaticRole: 'opening_state',
      requiredEvent: 'הבוקר נכנס לחדר; הילד/ה לא רוצה לקום.',
      childBodyState: 'מסתובב/ת לצד השני, מתחבא/ת מעט במיטה',
      companionAction: 'בּוֹלִי שוכב קרוב לכרית, פס שריון קטן אחד פתוח, מביט/ה בילד/ה בשקט.',
      // v0.5.0-c: foundation-beat lock. Smoke runs hit HARD GATE on p1
      // because the Author occasionally skipped Bolly entirely.
      //
      // v0.5.0-d (#170 polish): naturalized from the earlier short clinical
      // form "בּוֹלִי שוכב ליד הכרית בשקט." to a two-beat sentence with the
      // signature sound. The new version reads like a real children's
      // book opening — sets the scene, gives Bolly a body action, and
      // introduces טוּמְפּ as the recurring auditory motif from page 1.
      requiredExactLine: 'בּוֹלִי שכב ליד הכרית. טוּמְפּ קטן נשמע.',
      mustInclude: ['בּוֹלִי'],
      mustNotInclude: [
        'הציל',         // no action-hero mode
        'אמיץ',         // labeling, not showing
        'אל תפחד',      // adult voice
      ],
      targetWords: 24,
      maxWords: 32,
      maxSentences: 3,
      imageIntent: 'wide shot bedroom, soft morning light, child curled under blanket, Bolly visible near pillow',
    },
    {
      page: 2,
      dramaticRole: 'companion_introduction',
      requiredEvent: 'הילד/ה מתחיל/ה להתארגן; בּוֹלִי מגיע/ה אל התרמיל.',
      childBodyState: 'מתכופף/ת לחפש דבר, ידיים עסוקות',
      companionAction: 'בּוֹלִי מתגלגל החוצה ונעצר ליד התרמיל. נשמע טוּמְפּ קטן.',
      requiredObjectSlot: 'waitingObject',
      mustInclude: ['בּוֹלִי', 'טוּמְפּ'],
      mustNotInclude: [
        'הלוח',          // killed — leads to "הלוח הוורוד שלו הבהב מבפנים"
        'הבהב',          // AI-poetic
        'זרח מבפנים',    // AI-poetic
      ],
      targetWords: 26,
      maxWords: 32,
      maxSentences: 3,
      imageIntent: 'medium shot floor near bed and backpack, Bolly mid-roll',
    },
    {
      page: 3,
      dramaticRole: 'journey_step',
      requiredEvent: 'הילד/ה והמלווה בדרך למרפאה; עצירה קצרה.',
      childBodyState: 'עומד/ת, מסתכל/ת למטה',
      companionAction: 'בּוֹלִי נסגר לכדור שקט, פסי השריון נוגעים זה בזה.',
      mustInclude: ['בּוֹלִי'],
      mustNotInclude: [
        'הציל',
        'גיבור',
      ],
      targetWords: 22,
      maxWords: 32,
      maxSentences: 3,
      imageIntent: 'street level, foot of child and small ball of Bolly on sidewalk',
    },
    {
      page: 4,
      dramaticRole: 'journey_step',
      requiredEvent: 'תנועה הלאה; בּוֹלִי נפתח שוב; הולכים יחד.',
      childBodyState: 'צעד ריצה קטן, התרמיל מתנדנד',
      companionAction: 'בּוֹלִי נפתח לאט, פס אחרי פס, ומתגלגל לצידה בנקישה קטנה.',
      mustInclude: ['בּוֹלִי'],
      mustNotInclude: [
        'הבהב',
        'זרח',
      ],
      targetWords: 24,
      maxWords: 32,
      maxSentences: 3,
      imageIntent: 'moving shot on sidewalk, child walking, Bolly rolling alongside',
    },

    // ─── ACT 2: CLINIC SETUP (pages 5-7) ───
    {
      page: 5,
      dramaticRole: 'arrival_at_setting',
      requiredEvent: 'הגעה למרפאה; רופאה עם מעיל לבן; טיפוס על כיסא הבדיקה.',
      childBodyState: 'מטפס/ת ברגליים קטנות, יושב/ת על הקצה',
      companionAction: 'בּוֹלִי התכרבל בכיס התרמיל, חמים ושקט.',
      requiredObjectSlot: 'clinicSetting',
      mustInclude: ['בּוֹלִי', 'רופאה'],
      mustNotInclude: [
        'הסבירה',        // doctor should not lecture
        'אמרה לה ש',     // doctor monologue is forbidden
      ],
      targetWords: 26,
      maxWords: 34,
      maxSentences: 3,
      imageIntent: 'interior clinic, child climbing onto exam chair, doctor in white coat in soft focus',
    },
    {
      page: 6,
      dramaticRole: 'environment_sensing',
      // CHANGED v0.5.0-b (ChatGPT review): page 6 was at risk of becoming
      // filler atmosphere. Reframed to PRIME THE BODY for the upcoming
      // contraction on p8 — the sensory detail must serve the fear, not
      // decorate the room.
      requiredEvent:
        'הילד/ה קולט/ת פרט חושי קונקרטי במרפאה שמתחיל להכין את הגוף לכיווץ הקרוב.',
      childBodyState:
        'גוף עוד שקט, אבל הכתפיים מעט מורמות; נשימה רדודה יותר; מבט נצמד לפרט אחד',
      companionAction: 'בּוֹלִי מניע פס שריון קלות בתוך הכיס.',
      requiredObjectSlot: 'sensoryDetail',
      mustInclude: ['בּוֹלִי'],
      mustNotInclude: [
        'לב התמלא',          // cliché
        'שקט שרר',           // cliché
        'האור ליטף',         // cliché poetic
        'יפה מאוד',          // decorative, not preparatory
        'נחמד שם',           // contradicts pre-fear function
        'הרגישה רגועה',      // contradicts function — body must NOT be calm
        'הסתכלה סביב סביב',  // wandering observation = filler
      ],
      targetWords: 22,
      maxWords: 28,
      maxSentences: 3,
      imageIntent:
        'close-up clinic detail that primes contraction — white paper edge, soap dispenser, thermometer case, NOT a wide pretty interior',
    },
    {
      page: 7,
      dramaticRole: 'fear_object_appears',
      requiredEvent: 'הרופאה מוציאה את המדחום.',
      childBodyState: 'עומד/ת או יושב/ת בלי לזוז, עיניים נעולות באובייקט',
      companionAction: 'בּוֹלִי בכיס, שקט, לא זז.',
      requiredObjectSlot: 'medicalObject',
      mustInclude: ['מדחום'],
      mustNotInclude: [
        'דקרני',         // no scary tool language
        'מפחיד',         // labeling fear
      ],
      targetWords: 18,
      maxWords: 28,
      maxSentences: 2,
      imageIntent: 'close-up doctor hand holding small thermometer with silver tip',
    },

    // ─── ACT 3: THE CORE BEATS (pages 8-12) ───
    // These pages carry the entire resilience pattern.
    // They must be tight, physical, and in this exact order.
    {
      page: 8,
      dramaticRole: 'child_body_resists',
      requiredEvent: 'הרופאה קרבה את היד; הילד/ה גוף נסוג.',
      childBodyState:
        'יד נמשכת מעט לאחור, כתפיים עולות, עיניים בורחות אל הקיר',
      companionAction: 'בּוֹלִי לא מופיע בעמוד הזה (בכיס, שקט).',
      mustInclude: ['יד'],
      mustNotInclude: [
        'בכתה',          // not crying — this is resistance, not collapse
        'צרחה',
        'אבל אז',        // no narrative cheat-resolve
      ],
      targetWords: 24,
      maxWords: 32,
      maxSentences: 3,
      imageIntent: "medium shot child's shoulders rising, hand pulling back slightly",
      critical: true,
    },
    {
      page: 9,
      dramaticRole: 'companion_closes',
      requiredEvent: 'בּוֹלִי מבצע את המנגנון המרכזי שלו — נסגר לכדור.',
      childBodyState: 'מרגיש/ה את ההתגלגלות בכיס',
      companionAction:
        'בּוֹלִי מתגלגל ונסגר לכדור חם ושקט. נשמע טוּמְפּ.',
      mustInclude: ['בּוֹלִי', 'טוּמְפּ', 'כדור'],
      mustNotInclude: [
        'הציל',
        'הגן עליה',      // no defender-hero framing
      ],
      targetWords: 22,
      maxWords: 30,
      maxSentences: 3,
      imageIntent: 'close-up pocket lump, small ball-shape visible through fabric',
      critical: true,
    },
    {
      page: 10,
      dramaticRole: 'child_mirrors',
      requiredEvent: 'הילד/ה מבצע/ת את המנגנון בגוף שלו/ה — אגרוף ואז פתיחה אצבע אחר אצבע.',
      childBodyState:
        'יד נסגרת לאגרוף קטן ומחזיקה רגע, ואז נפתחת לאט, אצבע אחר אצבע',
      companionAction: 'בּוֹלִי לא מופיע במפורש (הילד/ה הוא/היא המראה).',
      mustInclude: ['יד', 'אצבע'],
      mustNotInclude: [
        'בּוֹלִי אמר ש',  // companion does not speak instruction
        'נזכרה ש',       // no narrator-cheat memory
      ],
      targetWords: 24,
      maxWords: 32,
      maxSentences: 3,
      imageIntent: 'close-up small hand opening slowly, finger by finger',
      critical: true,
    },
    {
      page: 11,
      dramaticRole: 'procedure_happens',
      requiredEvent: 'המדחום נוגע ביד; קצר וקונקרטי.',
      childBodyState: 'נשאר/ת על הכיסא, גוף שקט',
      companionAction: 'בּוֹלִי שקט בכיס.',
      requiredObjectSlot: 'medicalObject',
      mustInclude: ['מדחום'],
      mustNotInclude: [
        'כאב נורא',      // procedure must NOT be dramatized
        'דקירה חזקה',
        'בכתה',
        'צרחה',          // v0.5.0-b (ChatGPT review): no escalation
        'ברחה',          // v0.5.0-b: no flight response post-mirror
        'התחבאה',        // v0.5.0-b: child has already mirrored — must stay
      ],
      targetWords: 18,
      maxWords: 26,
      maxSentences: 3,
      imageIntent: 'close-up hand and thermometer tip, brief contact',
      critical: true,
    },
    {
      page: 12,
      dramaticRole: 'residue_appears',
      requiredEvent: 'הרופאה מדביקה מדבקה; בּוֹלִי פותח פס שריון אחד.',
      childBodyState: 'מסתכל/ת על המדבקה ביד, ראש מעט מורם',
      companionAction:
        'בּוֹלִי פותח פס שריון אחד ומציץ. נשמע טוּמְפּ רך.',
      requiredObjectSlot: 'stickerType',
      mustInclude: ['בּוֹלִי', 'מדבקה'],
      mustNotInclude: [
        'לוח ורוד זרח',   // killed (Gold Candidate polish note p12)
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
      // explicit fix for Gold Candidate p13 polish note (armadillo on shoulder
      // is physically wrong — Bolly stays in the bag).
      requiredObjectSlot: 'weatherOutside',
      mustInclude: ['בּוֹלִי'],
      mustNotInclude: [
        'ישב על כתפה',       // killed — armadillo doesn't perch
        'התנדנד על',         // killed
        'רכב על',
        // v0.5.0-b: moral-summary guards (was only on p15 — extended here)
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
      maxSentences: 3,
      imageIntent: 'street shot child walking home, sticker visible on hand, Bolly tucked in bag',
    },
    {
      page: 14,
      dramaticRole: 'home_inspection',
      // v0.5.0-e (#spark-beat): the ONE memorability beat of the book.
      // Y-lite Book Editor consistently scored childWouldAskAgain at 4 —
      // the arc is emotionally true but flat, no spark of delight. This
      // page now carries a single small, warm, PHYSICAL moment: Bolly
      // half-rolls and the sticker almost sticks to his shell; the child
      // smiles. NOT a joke, NOT dialogue, NOT magic — one bright note in
      // the cooldown. The resilience core (p8-12) is untouched.
      requiredEvent:
        'בבית — הילד/ה בודק/ת את המדבקה; בּוֹלִי עושה תנועה קטנה ומשחקית והילד/ה מחייך/ת.',
      childBodyState:
        'יד מורמת, אצבע נוגעת בקצה המדבקה; חיוך קטן ושקט אחרי תנועת בּוֹלִי',
      companionAction:
        'בּוֹלִי מתגלגל חצי סיבוב לידה, והמדבקה כמעט נדבקת לשריון שלו.',
      requiredObjectSlot: 'homeRoomDetail',
      mustInclude: ['בּוֹלִי', 'מדבקה'],
      mustNotInclude: [
        'הכר ',              // typo guard (without ית) — killed
        'הכר.',              // typo guard
        // v0.5.0-b: moral-summary guards (was only on p15 — extended here)
        'הבינה ש',
        'יודעת ש',
        'למדה ש',
        'גילתה ש',
        'אומץ',              // labeling, not showing
        'הצליחה',            // moral-summary energy
        'גאה בעצמה',
        // v0.5.0-e: keep the spark physical — the sticker stays a sticker.
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
      dramaticRole: 'sleep_or_calm',
      requiredEvent: 'הילד/ה שוכב/ת; הגוף רך; בּוֹלִי לידה.',
      childBodyState: 'שכיבה, יד שמורה לצד, נשימה רגועה',
      companionAction: 'בּוֹלִי נרדם לידה, ובפנים חם.',
      mustInclude: ['בּוֹלִי', 'הכרית'],
      mustNotInclude: [
        'הכר ',          // typo guard — must be "הכרית"
        'הכר.',
        'למדה ש',        // NO moral
        'הבינה ש',       // NO moral
        'מעכשיו',        // NO moral
        'תמיד תזכור',    // NO moral
      ],
      targetWords: 24,
      maxWords: 32,
      maxSentences: 3,
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
    // v0.5.0-f — mechanical phrasing that leaked from the recipe's own
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
    // Caught in first smoke test on p2: "בולי התגלגל אל הרצפה ואמר טומפ".
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
  ],

  qualityTarget: {
    goldCandidateId: 'bolly_adventure_v0.4.7',
    minBookScore: 4.7,
    minResilienceScore: 4.8,
    maxTechnicalRetries: 2,
    maxAuthorRerolls: 1,
  },

  meta: {
    version: '0.5.0-g',
    derivedFrom: 'gold-candidates/bolly_adventure_v0.4.7.md',
    authoredAt: '2026-05-22',
    authoredBy: 'CTO + ChatGPT consult',
    notes: [
      'First Production Recipe authored under v0.5 design.',
      'medicalObject locked to מדחום until syringe/stethoscope/gargle beats are authored.',
      'Page 8 deliberately marks Bolly as NOT present in prose — the mechanic appears in page 9.',
      'Page 12 maxSentences=4 to give Author room (sticker appears + Bolly opens + sound).',
      'All forbiddenPatterns reflect actual past failures, not speculation.',
      // v0.5.0-b changes (post ChatGPT review):
      'v0.5.0-b: p6 reframed from atmosphere to fear-priming — sensory detail must prepare body contraction, not decorate room.',
      'v0.5.0-b: moral-summary guards (הבינה ש / יודעת ש / למדה ש / מעכשיו) extended from p15-only to p13+p14+p15.',
      'v0.5.0-b: p11 mustNotInclude extended with escalation guards (צרחה / ברחה / התחבאה) — child has mirrored on p10, must stay on chair.',
      'v0.5.0-b: pages 8-11 tagged critical=true — load-bearing for resilience arc, reroll priority + Y-lite anchoring.',
      // v0.5.0-c → 0.5.0-e:
      'v0.5.0-c: p1 requiredExactLine added — foundation-beat companion lock.',
      'v0.5.0-d: p1 requiredExactLine naturalized + 7 adult-poetic patterns added to forbiddenPatterns.',
      'v0.5.0-e: SPARK BEAT on p14 — single small physical delight (Bolly half-rolls, sticker almost sticks to his shell, child smiles). Targets the systematic childWouldAskAgain weakness (Y-lite Book Editor scored it 4 — arc true but flat). Resilience core p8-12 untouched. p14 caps bumped to 4 sentences / 34 words for the extra beat.',
      'v0.5.0-f: p1 companionAction "פתוח חלקית" → "לוח קטן אחד פתוח" — the old phrasing was mechanical and leaked into prose as broken_hebrew (Y-lite MAJOR). Added "פתוח חלקית" to forbiddenPatterns as a backstop.',
      'v0.5.0-g (Phase A — Storybook Standard vocab cleanup): Bolly\'s shell word "לוח/לוחית" — a child hears "board/tablet", a technical word — replaced with "פס שריון" / "פסי השריון" in every companionAction. Companion-as-object phrasing "בּוֹלִי נח בכיס" (treats him as cargo) replaced with the living "בּוֹלִי התכרבל בכיס". The recipe was feeding the Author unclear and lifeless words; fixed at the source. See STORYBOOK_STANDARD.md.',
    ],
  },
};

export default bollyAdventureAge5Recipe;
