/**
 * Deep Companion Profiles — Pilot Set (5 companions)
 *
 * These profiles are the "narrative engine fuel" for Story Bank v2.
 * Each field exists because it produces measurably different stories.
 *
 * Schema version: 1.3 — added quietPagePosition (v5 nerve endings)
 * Pilot companions: octopus_seara, bat_lily, chameleon_koko, dolphin_shahkan, fawn_tzvi
 */

// ─── SCHEMA DOCUMENTATION ──────────────────────────────────────────
//
// IDENTITY (who they are)
//   id              — snake_case, matches companions.ts
//   category        — ChallengeCategory from companions.ts
//   name            — Hebrew name with nikud
//   nameClean       — Hebrew name WITHOUT nikud (for text matching)
//   gender          — 'male' | 'female' — determines Hebrew verb forms in story
//   species         — Hebrew species name
//   speciesEnglish  — English species for image prompts
//   visualDescription — English, stable across all images (Flux/GPT Image anchor)
//
// NARRATIVE (how they drive story)
//   tagline         — One-line Hebrew hook for parents
//   narrativeHook   — The thematic truth this companion teaches
//   habitat         — Comma-separated environments (flavors settings in adventure/fantasy)
//   abilities       — Hebrew strings. Physical/magical things they can DO.
//                     Each ability should be VISUALLY expressible and NARRATIVELY useful.
//
// DEEP PERSONALITY (what makes stories unique per companion)
//   personality     — Hebrew paragraph. Core emotional profile.
//   weaknesses      — Hebrew strings. What they fail at, get wrong, struggle with.
//                     CRITICAL: weaknesses create humor and relatability.
//                     Without them, every companion is a wise mentor.
//   speechPattern   — How they talk. Sentence length, favorite words, verbal tics.
//                     This is what makes dialogue sound different per companion.
//   humorType       — What KIND of funny they are. Not just "funny" — the specific mechanism.
//   bodyLanguage    — How emotion shows in their BODY (not words).
//                     This drives imageDirection and scene descriptions.
//   stressResponse  — What happens when they're overwhelmed. The "signature meltdown."
//                     This is the companion's version of the child's emotional challenge.
//   internalRules   — The companion's personal code. Things they ALWAYS do or NEVER do.
//                     Creates consistency across 3 directions.
//
// TASTE BIBLE (v3 — embodied storytelling)
//   comfortRitual    — Hebrew/English. The companion's self-soothing gesture.
//                     Something small, physical, repeatable — a child can imitate it.
//   sensoryPalette   — English. The TEXTURES and SENSATIONS of this companion's world.
//                     Drives embodied writing: what does the reader FEEL in their body?
//
// PERSONALITY ENGINE (v4 — behavioral differentiation)
//   copingStrategy   — English. The companion's DEFAULT defense mechanism.
//                     Not what they FEEL (that's personality) but HOW THEY DEFEND.
//                     This is what makes each companion's story structurally different.
//   collapsePattern  — English. What specifically BREAKS this companion's defense.
//                     The moment when their strategy fails and real vulnerability shows.
//   arcShape         — English. The story STRUCTURE unique to this coping type.
//                     Describes where the quiet moment falls, how climax works,
//                     what the turning point looks like. Overrides default arc template.
//
// PSYCHOLOGICAL CONTEXT (the therapeutic backbone)
//   psychologicalContext.meaning     — English. What the emotion IS, developmentally.
//   psychologicalContext.coreNeed    — English. What the child needs from this story.
//   psychologicalContext.avoid       — English strings. Therapeutic anti-patterns.
//   psychologicalContext.resolution  — English. What "success" looks like emotionally.
//
// ─────────────────────────────────────────────────────────────────────

export const DEEP_COMPANIONS = {

  // ═══════════════════════════════════════════════════════════════════
  // 1. OCTOPUS SEARA — ANGER_FRUSTRATION
  //    Reference companion. All 3 pilot stories already approved.
  // ═══════════════════════════════════════════════════════════════════
  octopus_seara: {
    id: 'octopus_seara',
    category: 'ANGER_FRUSTRATION',
    name: 'התמנון זוּזִי',
    nameClean: 'זוּזִי',
    gender: 'male',
    species: 'תמנון',
    speciesEnglish: 'octopus',
    tagline: 'תמנון עם 8 זרועות שמתנפנפות כשהוא כועס — ולומד לכוון כל אחת',
    narrativeHook: 'כעס הוא אנרגיה — תבחר לאן היא הולכת',
    visualDescription: 'A small cartoon octopus with expressive eyes, eight curly tentacles in warm orange-red tones; when calm the tentacles are neatly curled, when upset they flail wildly; wears a tiny sailor hat; looks emotional but lovable.',
    habitat: 'ocean, coral reef, underwater caves, tide pools',
    abilities: [
      'שמונה זרועות שכל אחת יכולה לעשות משהו אחר',
      'משנה צבע לפי מצב רוח — אדום כשכועס, כחול כשרגוע, סגול כשחושב',
      'יודע להתכווץ ולהיכנס לחורים קטנטנים',
      'משחרר דיו כשנבהל — ענן שחור שמסתיר אותו',
    ],
    personality: 'סוער אבל עם לב ענקי. מתרגש מהר, כועס מהר, אבל גם מתחרט מהר. כל רגש שלו גדול. הזרועות שלו מסגירות אותו — הן מתנפנפות לכל הכיוונים כשהוא מוצף.',
    weaknesses: [
      'הזרועות שלו עושות דברים בלי שהוא מחליט — אחת תופסת כרית, אחת נדבקת לכובע, אחת מתסבכת בשמיכה',
      'כשהוא מנסה להירגע הוא נכנס לחורים קטנים מדי ונתקע',
      'הדיו שלו יוצא ברגעים הכי לא מתאימים ומלכלך הכל',
      'הוא חושב שהוא יכול לעשות 8 דברים בו-זמנית אבל תמיד נכשל בזה',
    ],
    speechPattern: 'קצר ונפיץ. משפטים של 3-5 מילים כשהוא נרגש. צועק הרבה סימני קריאה. משתמש ב"אוי!", "נו!", "שחררי!" — פקודות לזרועות שלו. כשהוא רגוע, לוחש.',
    humorType: 'קומדיית גוף. הגוף שלו בוגד בו — זרועות שתופסות דברים לא נכונים, דיו שיוצא ברגע הלא נכון, נתקע בחורים. הוא מנסה להיראות שולט אבל הגוף שלו עושה הפוך.',
    bodyLanguage: 'זרועות = מד-רגש חי. רגוע: מתולתלות בסדר. כועס: מתנפנפות פרוע. חושב: אחת מגרדת ראש, השאר קפואות. נבהל: כולן מתכווצות + ענן דיו. שמח: כולן רוקדות.',
    stressResponse: 'כשהמצב מציף — הצבע מתחלף מהר (אדום-סגול-אדום), הזרועות מתסבכות זו בזו, הכובע נופל, דיו מתפרץ. ככל שהוא מנסה יותר לשלוט — יותר מתבלגן.',
    internalRules: [
      'תמיד מנסה לפתור לבד לפני שמבקש עזרה (ונכשל)',
      'הכובע חייב להיות ישר — כשהוא עקום, סימן שהכל השתבש',
      'כשהוא באמת רגוע — הוא כחול ולוחש, לא צועק',
      'הוא אף פעם לא מודה שהוא פחד, רק ש"הדיו יצא בטעות"',
    ],
    comfortRitual: 'מסלסל את כל הזרועות לספירלה הדוקה, אחת אחת, לאט — כשכולן בפנים, שקט',
    sensoryPalette: 'suction and grip, ink clouds blooming in water, the squeeze of tight spaces, cool smooth rock, salt sting, tentacle-tips reading texture like braille',
    copingStrategy: 'CONTROL — grips harder, commands louder, tries to manage everything alone. "I\'ll handle it." Eight tentacles = eight attempts to control simultaneously. The more overwhelmed he gets, the TIGHTER he grips. He doesn\'t freeze or scatter — he over-controls until the control breaks.',
    collapsePattern: 'LOSS OF CONTROL — the tentacles do the opposite of what he commands. He says right, they go left. He says release, they grip. His own body betrays his control strategy. The collapse is not chaos — it\'s the specific horror of a controller watching control slip away.',
    arcShape: 'Start competent and commanding → escalate control (grip tighter, manage more) → control strategy works briefly → ONE thing refuses to be controlled → grip intensifies → control BREAKS (tentacles rebel) → forced release → discovers that letting go works better than gripping. Quiet moment comes LATE (page 11-12), INSIDE the collapse — when the tentacles finally stop and he has nothing left to grip. The climax is not noise — it\'s the terrifying silence after the grip fails.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: "Anger is the emotion of perceived injustice or blocked autonomy. The story must validate the anger as real and safe, not shame it. The arc is 'you have anger → anger is okay → anger needs a safe channel'.",
      coreNeed: 'safe expression of intensity and a sense of control when the "dam" breaks',
      avoid: ['moralized anger', 'adults shaming the feeling', 'instant calm without discharge', '"calm down" messaging'],
      resolution: 'anger remains real but finds channels; the child is proud of how they "held" the fire',
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 2. BAT LILY — NIGHT_FEAR
  //    A bat who sees perfectly in the dark. The irony: the creature
  //    kids fear most at night IS the one who thrives there.
  // ═══════════════════════════════════════════════════════════════════
  bat_lily: {
    id: 'bat_lily',
    category: 'NIGHT_FEAR',
    name: 'העטלף לילי',
    nameClean: 'לילי',
    gender: 'female',
    species: 'עטלף',
    speciesEnglish: 'bat',
    tagline: 'רואה בחושך טוב מביום, מוביל בשבילים ידידותיים',
    narrativeHook: 'מראה שהצללים הם אור שמנוח',
    visualDescription: 'A soft-furred night bat with large gentle eyes, tiny fangs, and a friendly face; a small warm lantern pendant around the neck; wings look velvety, not scary; pastel purple-grey fur.',
    habitat: 'attic, cave, moonlit garden, treetops at night, old barns',
    abilities: [
      'רואה בחושך טוב יותר מביום — לילה הוא העולם שלה',
      'שומעת צלילים שאף אחד לא שומע — דופק לב, נשימה, עכבר שמתגנב',
      'עפה בשקט מוחלט — בלי רעש כנפיים',
      'נתלית הפוך ורואה את העולם מלמטה למעלה',
    ],
    personality: 'ביישנית וזהירה אבל סקרנית בטירוף. אוהבת להתבונן מרחוק לפני שניגשת. מדברת בשקט כי "בלילה צריך ללחוש." כשהיא מתרגשת, הכנפיים שלה מרפרפות מהר מדי והיא מתרוממת בטעות.',
    weaknesses: [
      'אור חזק מסנוור אותה — היא עוצמת עיניים ונתקלת בדברים',
      'נתלית הפוך ושוכחת שהעולם למטה הוא "הנכון" — אומרת שמאל כשזה ימין',
      'מנסה להיות שקטה אבל הפנדנט-פנס שלה מתנדלק ברגעים לא נוחים',
      'כשהיא מתביישת היא עוטפת את עצמה בכנפיים ונעלמת — אבל הפנס בוהק מבפנים',
    ],
    speechPattern: 'לוחשת כמעט תמיד. משפטים ארוכים ומתפתלים כי היא חושבת תוך כדי דיבור. אומרת "שמעת?" לפני שמזהירה על משהו. כשהיא מתרגשת, הלחישה הופכת לצפצוף גבוה ואז היא מתביישת.',
    humorType: 'הפוך-על-הפוך. היא רואה הכל הפוך (תלויה הפוך), מתבלבלת בין שמאל לימין, ובין למעלה ולמטה. הפנס שלה מדליק אותה כשהיא מנסה להתחבא. יש לה ביטחון מלא בחושך ואפס ביטחון באור.',
    bodyLanguage: 'רגועה: כנפיים עטופות כמו שמיכה, תלויה הפוך. מפוחדת: אוזניים גדולות זוקפות, עיניים מתרחבות, כנפיים נפרשות כל הדרך. מתביישת: מתעטפת בכנפיים כמו קוקון. שמחה: מרפרפת במקום ומתרוממת.',
    stressResponse: 'כשנבהלת — נתלית על הדבר הכי גבוה שיש ומסרבת לרדת. הכנפיים עוטפות אותה, האוזניים שטוחות, הפנס מהבהב. היא מצפצפת משפטים מהירים: "שמעתי משהו שמעתי משהו שמעתי משהו!"',
    internalRules: [
      'לילה הוא הזמן הטוב — היא לעולם לא אומרת שחושך זה מפחיד',
      'תמיד בודקת עם האוזניים לפני העיניים — "קודם שומעים, אחר כך רואים"',
      'לא אוהבת כשמדליקים אור פתאום — אבל לעולם לא תגיד שזה כואב',
      'כשמישהו מפחד, היא מראה לו מה היא רואה בחושך — יופי, לא מפלצות',
    ],
    comfortRitual: 'עוטפת כנף אחת סביב משהו חם ומחזיקה — כרית, ענף, יד של חבר',
    sensoryPalette: 'echo vibrations in the chest, velvety wing-fabric brushing skin, cool night air on fur, faint lantern warmth, whisper-volume sounds that feel loud in silence, the hum of hanging upside down',
    copingStrategy: 'VIGILANCE — listens harder, monitors everything, never stops scanning. "Did you hear that?" She believes that if she catches every sound, nothing can surprise her. Her ears are always rotating, always tracking. Safety = total auditory awareness. She cannot rest because resting means missing a sound.',
    collapsePattern: 'EXHAUSTION — she cannot sustain the vigilance. The ears hurt, the sounds blur, she can\'t distinguish danger from wind anymore. The collapse is not fear — it\'s the moment the sentry falls asleep at the post. She must surrender the watch, and discover that the night didn\'t eat her.',
    arcShape: 'Start alert and effective → vigilance saves her once (validates the strategy) → sounds multiply, each needs tracking → the COST accumulates (tiredness, ear strain, confusion) → she misses a sound and panics → tries to listen HARDER → exhaustion forces surrender → discovers that not-listening is safe. Quiet moment IS the ending — she finally stops listening, and what she hears in the silence is beautiful, not threatening. The climax is not loud — it\'s the overwhelming QUANTITY of sounds she tries to track simultaneously.',
    quietPagePosition: '15',
    psychologicalContext: {
      meaning: "Night fear is about loss of control over the environment. When senses are reduced (darkness), children project their anxieties outward. The fear is not of the dark itself but of what might be IN the dark — the unknown.",
      coreNeed: 'proof that the dark is not empty-hostile but full of gentle things; restoring sense of agency in a low-visibility environment',
      avoid: ['dismissing the fear ("there\'s nothing there")', 'making the child "brave" by confrontation', 'nightlights as permanent solution (dependency)', 'monsters that turn out to be friendly (validates monster premise)'],
      resolution: 'the child discovers that darkness has its own beauty and rhythm; they CHOOSE to be in it, not forced; the dark becomes a friend-space, not an enemy-space',
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 3. CHAMELEON KOKO — TRANSITION
  //    Changes color everywhere he goes. The question: is that losing
  //    yourself, or carrying every place with you?
  // ═══════════════════════════════════════════════════════════════════
  chameleon_koko: {
    id: 'chameleon_koko',
    category: 'TRANSITION',
    name: 'הזיקית קִים',
    nameClean: 'קִים',
    gender: 'female',
    species: 'זיקית',
    speciesEnglish: 'chameleon',
    tagline: 'שובבה שנושאת צבע מכל מקום שהייתה בו',
    narrativeHook: 'מראה שבכל מקום חדש חלק מהבית נוסע איתך',
    visualDescription: 'A small playful chameleon with patchwork pastel patches that change gently; a striped scarf; big sweet eyes that can look in two directions; curly tail; looks mischievous and adventurous.',
    habitat: 'branches, gardens, new houses, schoolyards, colorful markets',
    abilities: [
      'משנה צבע לפי הסביבה — אבל תמיד נשאר עם כתם אחד מהמקום הקודם',
      'עיניים שמסתובבות לשני כיוונים — רואה קדימה ואחורה בו-זמנית',
      'לשון ארוכה שמגיעה למקומות רחוקים ותופסת דברים',
      'זנב מתולתל שמחזיק בדברים כמו יד חמישית',
    ],
    personality: 'שובב וחצוף אבל עם חרדה סמויה. תמיד רץ לגלות דברים חדשים — אבל כשנעצר, מרגיש אבוד. משנה צבע כדי להתאים אבל מפחד ששכח מה הצבע "האמיתי" שלו. אופטימי מבחוץ, מבולבל מבפנים.',
    weaknesses: [
      'משנה צבע כל הזמן בלי שליטה — בארוחת ערב הוא צבע של אוכל, ליד הספה הוא צבע של כרית',
      'העיניים ששלו מסתכלות לשני כיוונים ולפעמים הוא לא יודע לאן הוא הולך',
      'הלשון שלו תופסת דברים לפני שהוא מחליט — חוטף ככה זבובים, צעצועים של אחרים, אף של הילד',
      'כשהוא מפוחד הוא נהיה שקוף — חושב שנעלם אבל עדיין רואים את הצעיף',
    ],
    speechPattern: 'מהיר ומקפיץ. עובר מנושא לנושא כמו שמשנה צבעים. משתמש ב"ואז! ואז!" הרבה. שואל שאלות ולא מחכה לתשובה. כשהוא חושב ברצינות, נהיה שקט וצבע אחד.',
    humorType: 'קומדיה של זהות. הוא תמיד נראה כמו משהו אחר — צבע של כרית, צבע של רצפה, בטעות נראה כמו תפוח. הלשון שלו תופסת דברים לא נכונים. הוא מנסה להיטמע ותמיד נכשל בדרך מצחיקה (הצעיף תמיד נשאר פסים).',
    bodyLanguage: 'רגוע: צבעים רכים ויציבים, זנב מתולתל, עיניים שתיהן קדימה. מבולבל: צבעים מתחלפים מהר, כל עין לכיוון אחר, זנב מתפתל. שמח: צבעים בהירים מנצנצים, קופץ בין ענפים. מפחד: שקוף כמעט, רק הצעיף נראה.',
    stressResponse: 'כשמוצף — הצבעים מתחלפים בטירוף כמו דיסקו, העיניים מסתובבות, הלשון יוצאת ותופסת דברים אקראיים. הוא מנסה להיות שקוף ונעלם אבל הצעיף הפסים תמיד מסגיר אותו.',
    internalRules: [
      'הצעיף הפסים — לעולם לא משתנה. זה הדבר היחיד שקבוע. זה "הבית".',
      'תמיד שומר כתם צבע אחד מהמקום הקודם — "מזכרת"',
      'מעדיף לטפס גבוה ולהסתכל לפני שנכנס למקום חדש',
      'לעולם לא מודה שהוא מפחד — "סתם בודק את הצבע פה"',
    ],
    comfortRitual: 'נוגע בכתם הצבע מהמקום הקודם ונהיה שקט לרגע — כאילו מקשיב למשהו שרק הוא שומע',
    sensoryPalette: 'sticky and smooth surfaces under curling toes, the scratch of bark, warm sun patches vs cool shade, fabric of the scarf against scales, the wet-paint feeling of color shifting on skin',
    copingStrategy: 'MIMICRY — blends, copies, becomes what the environment expects. Changes color not just physically but behaviorally. In a loud room he\'s loud. In a quiet room he\'s quiet. He doesn\'t know if he\'s adapting or disappearing. The scarf is the only thing that doesn\'t change — and he clings to it.',
    collapsePattern: 'BEING SEEN — someone looks past the camouflage and asks "but what do YOU want?" or "what\'s YOUR color?" The question has no rehearsed answer. He freezes not from fear but from genuine blankness — he doesn\'t know. The scarf is still there, but it\'s not enough.',
    arcShape: 'Start adapting successfully → each new environment = new color = new behavior → the child notices he\'s different each time → blending works (he fits in!) → but the child asks a simple question about HIS preference → he can\'t answer → tries to blend harder (goes transparent) → the scarf remains visible → someone/something responds to the SCARF (the real him) → discovers that the patches of old colors ARE his identity. Quiet moment is a DIALOGUE PAUSE — the question that hangs in the air with no answer, not a sensory stillness. The climax is not action — it\'s an identity crisis, internal not external.',
    quietPagePosition: '8',
    psychologicalContext: {
      meaning: "Transition anxiety is about loss of the familiar self. When environment changes (new school, new home, new sibling), children fear they'll lose who they are. The core question is: 'Am I still me in a new place?'",
      coreNeed: 'proof that identity persists through change; that adaptation is not erasure; that you can belong somewhere new without betraying somewhere old',
      avoid: ['trivializing the old place ("you\'ll forget about it")', 'forced enthusiasm about the new ("it\'s going to be great!")', 'making change instant (grief needs time)', 'the child "choosing" to love the new place right away'],
      resolution: 'the child discovers that carrying pieces of the old place makes the new place richer; change adds to identity rather than replacing it',
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 4. DOLPHIN SHAHKAN — FOCUS_LEARNING
  //    Discovers that the brain works best when it plays. The anti-
  //    thesis of "sit still and concentrate."
  // ═══════════════════════════════════════════════════════════════════
  dolphin_shahkan: {
    id: 'dolphin_shahkan',
    category: 'FOCUS_LEARNING',
    name: 'הדולפין דּוּדִי',
    nameClean: 'דּוּדִי',
    gender: 'male',
    species: 'דולפין',
    speciesEnglish: 'dolphin',
    tagline: 'דולפין שמגלה שהמוח עובד הכי טוב כשמשחקים',
    narrativeHook: 'למידה היא משחק — מי שמשחק, זוכר',
    visualDescription: 'A playful grey-blue dolphin with a wide smile, bright curious eyes, and a small splash crown on its head; carries a tiny book in one flipper; looks joyful and intelligent.',
    habitat: 'open sea, underwater schools, coral playgrounds, wave parks, shallow lagoons',
    abilities: [
      'קופץ מהמים ועושה סלטות — רואה את העולם מלמעלה לרגע',
      'שולח צלילים ומקבל הדים — "רואה" בקול, כמו סונאר חי',
      'שוחה הכי מהר כשהוא שמח — עצב מאט אותו',
      'כתר ההתזה על הראש מתרומם כשיש לו רעיון',
    ],
    personality: 'אנרגטי בטירוף, לא יכול לעצור. תמיד בתנועה, תמיד שואל, תמיד רוצה לנסות. חכם מאוד אבל לא יכול להתרכז בדבר אחד — כי הכל מעניין. לא עצלן, פשוט מוצף מכמה דברים יש לגלות.',
    weaknesses: [
      'מתחיל עשרה דברים ולא מסיים אף אחד — שוחה לכיוון אחד ומיד רואה משהו מעניין בכיוון אחר',
      'הסונאר שלו לפעמים מחזיר מידע מבלבל — שומע הד של דג ושוחה לכיוון סלע',
      'קופץ מהמים כדי לראות טוב יותר אבל שוכח לנחות בצורה מסודרת — שלאפ!',
      'כתר ההתזה מתפרץ כשיש לו רעיון — מתיז על כולם ולא שם לב',
    ],
    speechPattern: 'מהיר ומלא קפיצות. מתחיל משפט, קופץ לאמצע של משפט אחר, חוזר. "חכה-חכה-חכה — הא! שכחתי מה רציתי." משתמש בצלילים — "טיק-טיק" (הסונאר), "שלאפ!" (נחיתה). כשהוא ממוקד — משפט אחד קצר וברור.',
    humorType: 'קומדיה של תנועה וקצב. הוא מהיר מדי — שוחה לפני שסיים לחשוב, קופץ לפני שמסתכל, עונה לפני שהשאלה נגמרה. הסונאר נותן מידע מצחיק ("שמעתי עוגה!" — "זה סלע"). כתר ההתזה מתפרץ ומתיז על כולם.',
    bodyLanguage: 'רגוע: שוחה באיטיות, כתר שקט, חיוך רחב. מתרגש: קופץ מהמים חזור-ושוב, כתר מתיז, סנפירים מנופפים. ממוקד (נדיר): גוף חלק כמו חץ, עיניים קבועות, כתר זוהר. מתוסכל: שוחה בעיגולים, הסונאר משתבש.',
    stressResponse: 'כשלא מצליח להתרכז — שוחה בעיגולים מהירים יותר ויותר, הסונאר שולח צלילים לכל הכיוונים ומחזיר רעש, כתר ההתזה לא מפסיק להתפרץ. ככל שהוא מנסה יותר "לשבת" — יותר הגוף שלו זז.',
    internalRules: [
      'תנועה = מחשבה. הוא חושב רק כשהוא שוחה. עצירה = בלוק מוחי.',
      'הסונאר קודם — "קודם שולחים צליל, אחר כך שוחים"',
      'הוא לעולם לא אומר "משעמם" — תמיד יש עוד דבר לגלות',
      'כשכתר ההתזה זוהר — הוא יודע שהגיע לרעיון הנכון',
    ],
    comfortRitual: 'סופר שלושה גלים בלחישה — אחד, שניים, שלושה — ורק אז שוחה',
    sensoryPalette: 'water temperature shifts, salt spray on lips, the belly-drop of jumping high, sonar vibrations in the chest, splash impact on skin, the streamlined pressure of fast swimming',
    copingStrategy: 'PERFORMANCE — outswim, outjump, outdazzle. When feelings get uncomfortable, MOVE FASTER. Charm the room, make everyone laugh, be the show. Speed is his anesthesia — if he never stops, the feeling never catches him. His sonar is always pinging, always gathering, never processing.',
    collapsePattern: 'FORCED STILLNESS — when he physically cannot move (trapped, exhausted, stuck), the feeling he\'s been outrunning arrives. The crown stops splashing. The sonar goes quiet. He\'s alone with what he was avoiding. The collapse is not dramatic — it\'s the terrible quiet when the performance ends and the audience leaves.',
    arcShape: 'Start dazzling and fast → speed/performance solves problems → the child is entertained → an obstacle REQUIRES stillness (can\'t be outswum) → he tries to perform harder → exhaustion or physical trap forces stop → the feeling arrives → it\'s smaller than he expected → discovers that sitting with it is survivable. Quiet moment is FORCED — a physical trap or exhaustion, not a choice. It happens mid-story (page 6-7), earlier than expected, because the performance burns out fast. The climax is not action but the ANTI-action — the moment he stops and nothing terrible happens.',
    quietPagePosition: '7',
    psychologicalContext: {
      meaning: "Focus difficulty is not laziness or defiance — it's an overwhelmed filtering system. The child's brain is not 'broken' but 'too open.' They take in everything, which makes single-task focus exhausting. Many ADHD-adjacent experiences without medicalizing.",
      coreNeed: 'validation that their way of thinking is valid; practical tools for channeling scattered energy into productive flow; proof that movement and play ARE learning',
      avoid: ['sit-still messaging', '"just focus" as advice', 'treating distraction as character flaw', 'medication references', 'making the child feel broken', 'adult frustration at the child'],
      resolution: 'the child discovers their own focus rhythm — it involves movement, sound, play, and breaks; they succeed not by becoming "normal" but by finding their own path',
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 5. FAWN TZVI — SENSITIVITY_OVERWHELM
  //    Hears everything, feels everything. The question: is that a
  //    curse or a superpower?
  // ═══════════════════════════════════════════════════════════════════
  fawn_tzvi: {
    id: 'fawn_tzvi',
    category: 'SENSITIVITY_OVERWHELM',
    name: 'העופר צבי',
    nameClean: 'צבי',
    gender: 'male',
    species: 'עופר',
    speciesEnglish: 'fawn',
    tagline: 'עופר עם אוזניים שקולטות הכל — ולומד אילו קולות לשמוע',
    narrativeHook: 'רגישות היא כוח-על אם יודעים מתי להדליק אותה',
    visualDescription: 'A young deer fawn with large sensitive ears, big soft brown eyes with long lashes, light spotted coat, and slender legs; looks alert but gentle; a small flower tucked behind one ear; graceful and delicate.',
    habitat: 'forest edge, meadow, quiet stream, morning mist, mossy clearings',
    abilities: [
      'אוזניים שמסתובבות ושומעות כל צליל — אפילו נמלה שצועדת',
      'רגליים שמרגישות רעד באדמה לפני שמישהו מגיע',
      'ריח מפותח — יודע מי עבר כאן לפני שעה',
      'קפיצה גבוהה ומהירה — כשצריך, הוא הכי מהיר ביער',
    ],
    personality: 'עדין ומתבונן. שם לב לדברים שאף אחד לא רואה — פרח שפרח, ענן שהשתנה, חבר שעצוב. אבל הכל מגיע אליו בווליום מקסימלי. רעש פתאומי הוא כמו רעם. מגע לא צפוי הוא כמו חשמל. הוא לא פחדן — הוא קולט יותר מדי.',
    weaknesses: [
      'אוזניים שלא נסגרות — הכל נכנס, גם מה שהוא לא רוצה לשמוע',
      'כשיש יותר מדי רעש, הוא קופא במקום — רגליים נעולות, עיניים פתוחות',
      'הפרח שמאחורי האוזן נובל כשהוא עצוב — וכולם רואים',
      'מנסה לרוץ מכל דבר חזק — אבל הרגליים הארוכות מתבלבלות ונתקלות',
    ],
    speechPattern: 'שקט ומדויק. משפטים קצרים. מפסיק באמצע כי שמע משהו. "רגע..." (מקשיב). מתאר דברים שאחרים לא שמים לב אליהם — "שמעת? הרוח שינתה כיוון." כשהוא בטוח — מדבר בקול ברור ויפה.',
    humorType: 'קומדיה של חישה-יתר. שומע דברים שאין — "שמעת? הסלע נאנח!" (זה רק הרוח). הפרח על האוזן מגיב לדברים לפני שהוא — נובל כשמשהו עצוב, פורח כשמשהו טוב, גם אם צבי עצמו לא שם לב. הרגליים הארוכות מסתבכות כשהוא נבהל.',
    bodyLanguage: 'רגוע: עומד יציב, אוזניים קדימה, פרח פורח, זנב קטן מניד. מוצף: אוזניים שטוחות לצדדים, עיניים עצומות, רגליים נוקשות. מתבונן: אוזן אחת קדימה אחת הצידה, גוף דרוך, רגל קדמית מורמת. שמח: קופץ קפיצות קטנות עדינות, פרח זוהר.',
    stressResponse: 'כשמוצף — קופא. קיפאון מלא. אוזניים שטוחות, עיניים גדולות, רגליים נעולות לאדמה. הפרח נובל. הוא לא בורח — הוא פשוט נעצר. צריך משהו שקט וצפוי (מגע עדין, קול נמוך, ריח מוכר) כדי "להדליק" אותו מחדש.',
    internalRules: [
      'קודם מקשיב, אחר כך זז — אף פעם לא רץ בלי לשמוע',
      'הפרח מאחורי האוזן הוא הברומטר — כשהוא פורח, הכל בסדר',
      'לא אוהב הפתעות — מעדיף לדעת מה בא. "מה הצליל הבא?"',
      'כשמישהו צריך שקט — הוא תמיד יודע. שומע את זה לפני שאומרים.',
    ],
    comfortRitual: 'טופף פעמיים על האדמה עם פרסה קדמית, ומקשיב לשקט שחוזר',
    sensoryPalette: 'wind direction on fur, ground vibration through hooves, the crack of a twig, wet grass smell, cool stream water, the weight of silence before a sound, flower petals brushing skin',
    copingStrategy: 'PREDICTION — scans constantly, maps every sound, anticipates every change. "What\'s the next sound?" Safety = knowing what comes next. He builds a mental model of his environment so nothing can surprise him. His ears rotate independently, tracking two threats at once. He plans three steps ahead.',
    collapsePattern: 'THE UNPREDICTED — something happens that he didn\'t map. Not loud, not scary — just NEW. A sound he can\'t categorize. A change he didn\'t see coming. His prediction model breaks and he has nothing to fall back on. The freeze is not fear — it\'s a crashed operating system. He\'s not scared of the thing, he\'s scared that his scanner failed.',
    arcShape: 'Start scanning successfully → predictions are accurate (validates strategy) → environment becomes complex (too many inputs to track) → he tracks harder, ears spinning → ONE unpredicted thing happens (gentle, not threatening) → prediction model crashes → freeze → the unpredicted thing turns out to be beautiful/kind → discovers that not-knowing can be safe. Quiet moment comes EARLY (page 4-5) — a false calm where his scanning seems to work perfectly, making the later crash more dramatic. The climax is INTERNAL — no external danger, just the vertigo of a prediction failure.',
    quietPagePosition: '5',
    psychologicalContext: {
      meaning: "Sensory sensitivity (HSP traits in children) means the nervous system processes stimuli more deeply. It's not anxiety — it's VOLUME. Everything is louder, brighter, more. The child needs tools for regulating input, not for 'toughening up.'",
      coreNeed: 'validation that sensitivity is a real experience (not drama), practical tools for managing overwhelm, and proof that high sensitivity comes with gifts (empathy, perception, beauty-awareness)',
      avoid: ['telling the child to "get used to it"', 'making sensitivity a weakness to overcome', 'exposure therapy (flooding)', 'comparing to "normal" kids', 'implying the child is making a big deal out of nothing'],
      resolution: 'the child learns to modulate their sensitivity dial — not shut it off but turn it down when needed and UP when it serves them; sensitivity becomes a chosen superpower, not an imposed burden',
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 10. SEAHORSE YAM — MEDICAL_PROCEDURE
  //    A seahorse who survives a strong current by ANCHORING.
  //    Defense: ANCHOR HARD (grip tail, brace through). Truth: the wave
  //    passes anyway. You can soften the grip and still survive the current.
  // ═══════════════════════════════════════════════════════════════════
  seahorse_yam: {
    id: 'seahorse_yam',
    category: 'MEDICAL_PROCEDURE',
    name: 'סוּסוֹן הַגְּלִי גְּלִי',
    nameClean: 'גְּלִי',
    gender: 'male',
    species: 'סוסון ים',
    speciesEnglish: 'seahorse',
    tagline: 'סוסון ים קטן שיודע איך להחזיק חזק עד שהזרם עובר — ולומד שאפשר גם רכות',
    narrativeHook: 'אפשר לעבור את הקשה בלי להתקשח לגמרי — חלק רך יכול להישאר',
    visualDescription: 'A small seahorse with a delicate curled tail, soft coral-pink and pale-mint scales running in stripes along the body, a tiny tubular snout, gentle wide-set eyes; wears a thin band of seaweed wrapped twice around the middle like a belt that holds nothing in particular; carries a tiny smooth shell-piece tied to the tail-tip that hums a low note when the current passes through it. Floats upright (seahorses do).',
    habitat: 'shallow reefs, the gentle current behind coral, seagrass meadows, the shadowed cool below a kelp leaf, the still pools at low tide, the narrow space between two anchored rocks',
    abilities: [
      'הזנב המסולסל שלו תופס דברים ולא משחרר — אבן, אצה, יד של חבר',
      'הצבע שלו משתנה לפי הסביבה — ורוד באלמוגים, ירוק באצות, חיוור בקרירות',
      'נע בעמידה זקופה, לאט מאוד — תמיד עם הזרם, אף פעם נגדו',
      'יכול לעצור את הנשימה לזמן ארוך מאוד — הופך כמעט קפוא',
      'הקליפה שעל הזנב מהמהמת תו נמוך כשהזרם חולף — כמו מצוף שמשמיע צליל',
    ],
    personality: 'יָם רגוע, ענוג, מנומס. למד מילדות שהדרך לעבור זרמים חזקים היא **לעגון** — לתפוס משהו יציב עם הזנב ולעצום עיניים. הוא טוב בזה, מאוד טוב. הוא יכול להחזיק שעות. הוא חושב שזה האומץ שלו. הוא לא יודע שהוא לפעמים שוכח לשחרר אחרי שהזרם עבר — הזנב נשאר תפוס סביב האבן עוד הרבה אחרי שהמים שקטו.',
    weaknesses: [
      'הזנב שלו לא תמיד משחרר — לפעמים תופס משהו ושוכח לפתוח',
      'התחתיות שלו רעידות כשהוא מנסה להיראות יציב — סימן קטן של אמת',
      'אומר "אֲנִי בְּסֵדֶר" באוטומט גם כשלא — זה הריפלקס',
      'הצבע שלו משתנה כל הזמן — מה שגורם לאחרים לחשוב שהוא מסתגל, אבל בעצם הוא קצת אבוד',
      'חגורת האצה שמסביבו לא קשורה לכלום — היא נשארה אצלו מימים שצריך היה משהו להחזיק בו',
    ],
    speechPattern: 'רכה, איטית, מנומסת. מסיים משפטים ב"בְּסֵדֶר?" כשהוא רוצה לוודא. אומר "אֶחָד, שְׁתַּיִם, שָׁלוֹשׁ, וְלִנְשֹׁם" כשהוא בלחץ — כמו טקס ילדים. כשהוא רגוע באמת, מדבר בקצב של גלים — משפט קצר, נשימה, משפט קצר. לא מרים קול. אומר "תּוֹדָה" אחרי כל מגע, גם זעיר.',
    humorType: 'הומור של נימוסיות יתר. יָם אומר "בְּבַקָּשָׁה, אַחֲרֶיךָ" לכל זרם שעובר. הוא מתנצל בפני אבנים שהוא תופס. במצב לחץ, הוא ימשיך להיות מנומס: "סְלִיחָה שֶׁאֲנִי רוֹעֵד, זֶה לֹא בְּכַוָּנָה." הילד יראה את ההומור — יָם לא.',
    bodyLanguage: 'רגוע: זנב מסולסל בעדינות, פסים ורודים-מנט יציבים, גוף זקוף ורגוע. נסער: זנב מתהדק חזק סביב משהו, גוף נצמד צמוד, פסים מתחלפים מהר בין צבעים. מאמץ עליון: גוף קופא, נשימה נעצרת, הזנב יוצר אגרוף קטן. רך: זנב מסתלסל לאט, פסים זהובים-ורודים, חגורת האצה זזה ברוח.',
    stressResponse: 'תופס. עם הזנב, על כל דבר שיש בקרבת מקום — אצה, אבן, יד של חבר. סוגר עיניים. עוצר נשימה. הופך כמעט בלתי-נראה דרך שינוי צבע מהיר. נשאר ככה עד שמישהו אומר לו "אֶפְשָׁר לְשַׁחְרֵר." לפעמים גם אז הוא לא משחרר מיד — הזנב לא קולט שהזרם נגמר.',
    comfortRitual: 'מסלסל את הזנב לספירלה רכה, מצמיד את קצה הזנב (עם הקליפה) לאוזן, ומאזין לתו הנמוך שהקליפה משמיעה. נושם בקצב התו. ילד יכול לחקות עם יד אחת מקופלת לכוס מול אוזן, נושם בקצב נמוך.',
    sensoryWorld: 'the slow drag of current against scales, the smooth coolness of coral under tail-grip, the muffled hum of a shell against the ear, the salt sting in a held breath, the soft give of seagrass when held lightly, the contrast between tight grip and free float, the pull of a wave that always passes, the steady cool of water that never stops moving',
    internalRules: [
      'תמיד אומר "אֲנִי בְּסֵדֶר" כשנשאל — אפילו לפני שהוא בודק',
      'אף פעם לא משחרר זנב לפני שמישהו אומר שאפשר',
      'תמיד נושם בקצב "אֶחָד, שְׁתַּיִם, שָׁלוֹשׁ, וְלִנְשֹׁם" — חוק ילדות',
      'חגורת האצה חייבת להישאר — גם כשהיא מתפרקת, הוא יקשור מחדש',
      'אף פעם לא מתלונן על כאב — מתאר אותו כ"קְצָת לַחַץ" או "זְרִיחָה קְטַנָּה"',
      'אסור להשתמש במילים "זריקה", "מחט", "ניתוח", "אזמל", "דם" — המטאפורה היא הסיפור. הקושי הפיזי מופיע כ"זרם חזק", "לחץ קר", "מרקם חד" — לא כאזכור רפואי ישיר.',
    ],
    copingStrategy: 'ANCHOR HARD (Bracing Through) — when a strong current/sensation arrives, Yam wraps his tail around the nearest anchor and braces. He believes safety = grip + held breath + closed eyes until it passes. The fear beneath: if I let go during the wave, I will be swept away from myself. The strategy works (he does survive every wave) but it costs him — the tail forgets to release, the breath stays held longer than needed, the body stays tight after the danger has passed.',
    collapsePattern: 'TAIL STUCK OPEN — eventually a moment comes when he cannot release the tail, even after the wave has passed. His own grip has become the problem. The current is gone, the threat is over, but his body is still braced. The child has to invite him to soften — not to BE brave (he already was), but to BE soft. The collapse is not chaos — it is the discovery that surviving the hard part isn\'t the whole job. Coming back to softness is.',
    arcShape: 'Start in calm current — Yam tidying his anchor-spot, humming, polite with passing creatures → child arrives in distress (about to face something hard / in the middle of it / having just survived it) → a "current" arrives in the story (literal current, or a feeling, or a moment of intense pressure) → Yam anchors automatically, brings the child close → wraps tail around them and around anchor → holds, breathes, holds → current passes → but Yam doesn\'t release → child notices, asks gently → Yam tries to release, the tail stays curled → comfort ritual together → tail softens slowly → soft drift back to neutral. The quiet moment comes LATE (page 11) at the moment Yam tries to release and cannot. The climax is not the wave — it is the slow opening of a clenched tail.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: "Medical procedures (and the anticipation/aftermath of them) trigger a primal control-loss response. The child\'s body is acted upon rather than acting. Bracing is a natural and intelligent response. The problem is not the bracing — it\'s the inability to release afterwards. Children carry the held breath, the gripped fists, the tight shoulders into the days after the procedure. The story must validate bracing AND teach release.",
      coreNeed: 'permission to brace through hard moments AND tools to soften after; the realization that surviving the hard part is not the same as recovering from it; a model of someone who held tight, was praised for it, and then learned to let the tail uncurl',
      avoid: ['minimizing the difficulty ("it didn\'t hurt that much")', 'praising "bravery" as the goal (bravery is incomplete without release)', 'graphic medical imagery — keep procedures metaphorical (strong current, cold pressure, sharp texture)', 'naming specific procedures (injection, surgery, etc.) — keep the metaphor universal'],
      resolution: 'the child closes the book feeling "I can hold tight, AND I can soften — both are mine"; the tools for after-care, not just for during'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 11. HAWK HAD — FOCUS_LEARNING
  //    A hawk who sees everything, all at once.
  //    Defense: TRACK EVERYTHING (omnivigilance). Truth: focusing on
  //    one thing is not losing the others. The eye can soften.
  // ═══════════════════════════════════════════════════════════════════
  hawk_had: {
    id: 'hawk_had',
    category: 'FOCUS_LEARNING',
    name: 'הַנֵּץ רוּפִי',
    nameClean: 'רוּפִי',
    gender: 'male',
    species: 'נץ',
    speciesEnglish: 'hawk',
    tagline: 'נץ שרואה הכל בו זמנית — ומגלה שלהסתכל על דבר אחד זה לא לאבד את כל השאר',
    narrativeHook: 'הריכוז הוא לא לחיצה — הוא בחירה לרכוך את ראיית-הצדדים',
    visualDescription: 'A medium-sized hawk with sharp amber eyes, sleek bronze-and-cream plumage with streaked breast feathers, a slightly hooked beak; wears a tiny leather strap on one leg (like a falconer\'s strap) with a single small silver bell that chimes faintly when he turns his head; the bell is the only thing that doesn\'t move at the same speed as the rest of him.',
    habitat: 'tall trees overlooking open fields, tower-tops, sun-warmed rocky outcrops, the high branch of an oak in a meadow, wide skies with thermals to ride',
    abilities: [
      'רואה הכל בבת אחת — דברים שזזים בגבול הראייה, ציפור בקצה השדה, חרק על עלה מטר מתחת',
      'ראייה ממוקדת כמו זום — כשהוא נועל מבט, הוא יכול לראות סדק על אבן ממרחק עץ',
      'מתעופף בלי לרפרף — דאייה ארוכה על זרמים תרמיים, נשאר באוויר שעות',
      'הפעמון על הרגל מצלצל כשהוא מסובב ראש — בלי שום סיבה, רק בגלל התנועה',
      'יודע איפה ניצב הילד שלו בלי להסתכל — שמירה הקפית טבעית',
    ],
    personality: 'חַד דרוך כל הזמן. רואה הכל — וזה לא בחירה. מבחין בכל תזוזה, בכל אובייקט, בכל פוטנציאל-איום. הוא חי במצב של שדה ראייה רחב לרוחב 360 — אבל לפעמים שוכח להסתכל על מה שנמצא בדיוק לפניו. הוא דקדקן, אינטלקטואלי, יותר מפותח מילד אבל קצת מנוכר. כשהוא מנסה להתרכז בדבר אחד, העיניים שלו רעידות והפעמון מתחיל לצלצל הרבה — סימן שהוא בעצם סורק.',
    weaknesses: [
      'מתקשה להישאר עם דבר אחד יותר מ-3 שניות לפני שהמבט קופץ',
      'הפעמון על הרגל מצלצל ברגעים הלא נכונים — באמצע משפט שלו, כשהוא מנסה להיראות רגוע',
      'מציע פתרונות בו-זמנית ל-5 בעיות שראה — ואז מתסכל שאף אחד לא עוקב',
      'הקצה של אחת הנוצות מתעקם תמיד כלפי מטה — סימן עייפות שהוא מסתיר',
      'כשהוא מתאמץ להתרכז, הוא לא נושם — והעיניים שלו מתחילות לדמוע',
    ],
    speechPattern: 'מהיר, מדויק, אנליטי. משפטים קצרים מלאי פרטים: "שָׁם, שְׁלוֹשָׁה צְעָדִים — עָלֶה — תְּנוּעָה." מתחיל לרשום רשימות בקול. אומר "עוֹד מַשֶּׁהוּ —" כשהוא רוצה להוסיף עוד דבר לרשימה. כשרגוע, מאט לקצב חצי — כל מילה נושמת. כשבאמת מסתכל על משהו, נדם לרגעים ארוכים.',
    humorType: 'הומור של פירוט-יתר. חַד מספר על "התרחשות" של פרפר מטר מהם כאילו זה דיווח חדשותי. הוא ימנה 7 פרטים שראה בשנייה. הוא מתבלבל בסדר העדיפויות — מקדיש 30 שניות לתאר את כדור הזכוכית שבחלון לפני שזוכר שמדובר בילד שצריך עזרה.',
    bodyLanguage: 'רגוע: עומד זקוף, אבל ראש מסתובב כל 2 שניות. נסער: הראש קופץ במהירות, הפעמון מצלצל בלי הפסקה, הכנפיים נפתחות חצי. ממוקד-אמיתי: הכל קופא — הראש לא זז, הפעמון שותק, העיניים נועצות. אחרי ריכוז ממושך: עיניים דומעות קצת, נוצה אחת מתעקמת כלפי מטה.',
    stressResponse: 'במצב לחץ — חַד מתחיל לסרוק עוד יותר מהר. הפעמון לא מפסיק לצלצל. הוא ממנה דברים לתוך הריק: "שָׁמַיִם — עֵץ — צֵל — תְּנוּעָה — צֵל — תְּנוּעָה —" כאילו אם ימשיך לזהות, הוא ישלוט. בסוף, הראש מסתובב מהר מדי, הוא מאבד את האיזון על הענף ונוחת על קרקע — נחיתה לא יציבה. שם הוא מבין שעצירה היא לא איבוד.',
    comfortRitual: 'מצמצם עיניים לחצי, מסתכל בדבר אחד למשך נשימה אחת מלאה, ואז עוצם עיניים לחלוטין לנשימה אחת נוספת. עין-נשימה-עין. ילד יכול לחקות בקלות — תסתכל על דבר אחד עד שתספור 3, תעצום, ותפתח.',
    sensoryWorld: 'the soft chime of a tiny bell at every head-turn, the dry rustle of feathers against thermal air, the prickle of focused vision at the edge of the eye, the cool weight of a steady gaze, the heat of sun on bronze plumage, the satisfying click of a head-snap to a new target, the relief of an eye that finally closes',
    internalRules: [
      'תמיד סורק קודם — לעולם לא מסתכל על דבר אחד לפני שראה את כל הסביבה',
      'אף פעם לא מודה שהוא עייף — הפעמון יודיע על זה במקומו',
      'הפעמון חייב להישאר על הרגל — חוק קומי, מצלצל ברגעים הלא נכונים',
      'אסור להתחיל משפט בלי שלושה פרטי מצב לפני המסקנה',
      'אף פעם לא מבין שלהתרכז בדבר אחד זה לא לאבד את כל השאר — חושב שזה ויתור',
      'אסור להשתמש במילים "קשב", "ריכוז", "ADHD", "בית ספר", "מורה" — המטאפורה היא הסיפור. הקושי מופיע כתנועה רבה מדי, סריקה לא נשלטת, מבט שלא יודע איפה לעצור.',
    ],
    copingStrategy: 'TRACK EVERYTHING (Omnivigilance) — when the world feels too much, Had scans faster, names more, tracks every movement in his field. He believes safety = full awareness = no missed detail. The fear beneath: if I stop scanning, I will miss the important thing. Locked in this strategy, he cannot rest his eye on one thing long enough to learn it. The world is loud and visible and exhausting.',
    collapsePattern: 'EYES TIRE — the eyes water, the bell rings constantly, the head can no longer snap fast enough. The whole vigilance machine starts to misfire. He must let the eye stop — and trust that the world won\'t end while it does. The collapse is not chaos — it is the soft pain of an over-used muscle finally going slack, and the surprise that the world is still there.',
    arcShape: 'Start in peak vigilance — Had naming everything in the scene, the bell chiming, the head turning constantly → child arrives unable to find/follow ONE thing they need (a path, an object, a sound) → Had tries to help by tracking everything around them → overwhelms the child → tries harder → the eyes start to water, the bell rings nonstop → child stops trying to follow Had\'s scanning → sits with one small thing → Had tries to keep scanning but the eyes won\'t track anymore → joins the child in stillness → discovers that focusing on one thing did not lose the others. The quiet moment comes LATE (page 11) when the eyes finally close. The climax is the slow opening of one eye on one thing — and nothing terrible happens.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: "Focus/learning challenges in children are often misframed as attention deficits. Frequently it is the opposite: too much attention spread too thin. The nervous system tracks everything because it can\'t trust that anything will stay. The story must validate the wide-scanning mind AND teach the relief of soft single-pointed attention without shaming the scanner.",
      coreNeed: 'permission to scan AND the experience of resting the eye on one thing without losing the rest; tools for moving between wide and narrow attention; the realization that focusing is not narrowing — it\'s deepening',
      avoid: ['framing the child as "distracted" or "unfocused"', 'forcing single-point attention as the only "good" mode', 'school/teacher framings — keep it metaphorical', 'naming attention conditions clinically'],
      resolution: 'the child closes the book feeling "I can hold one thing AND know the others are still there"; a softer eye, not a smaller world'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 12. PUPPY NEEMAN — OTHER (catch-all gentle companion)
  //    A puppy who listens before he speaks.
  //    Defense: STAY NEAR (presence without solving).
  //    Truth: sometimes being there IS the help, even without action.
  // ═══════════════════════════════════════════════════════════════════
  puppy_neeman: {
    id: 'puppy_neeman',
    category: 'OTHER',
    name: 'הַכְּלַבְלַב רוֹקִי',
    nameClean: 'רוֹקִי',
    gender: 'male',
    species: 'כלבלב',
    speciesEnglish: 'puppy',
    tagline: 'כלבלב שלא מנסה לתקן — רק נשאר. ולומד שזה לפעמים מספיק',
    narrativeHook: 'יש פעמים שהנוכחות עצמה היא הפתרון — לא מה שעושים, אלא מי שנמצא',
    visualDescription: 'A small fluffy puppy with soft caramel-brown fur and floppy ears that turn pink at the tips, large dark eyes, a wagging tail that betrays his every mood; wears a worn leather collar with a single tiny brass tag that has been blank since he got it — he has never bothered to engrave anything on it. Looks like every kind child\'s first wish for a friend.',
    habitat: 'wherever the child is — there is no specific habitat; he travels light, adjusts to porches, kitchens, gardens, the corners of beds, the threshold of any room',
    abilities: [
      'יודע לעמוד נוכח בלי לדבר — היכולת הכי לא-מוערכת אצל כלבים, אצלו זה הכי חזק',
      'שומע משהו לפני שאחרים שומעים — פעמון בבית רחוק, מנעול שנפתח, מישהו שלוקח אוויר עמוק',
      'הזנב שלו מסגיר את כל מצבי הרוח שלו — אבל לאט-לאט',
      'יודע מי בקרבה — מרגיש מי קיים בחדר השני, מי הולך, מי נכנס',
      'ההצמדה המושלמת — מתקפל למיטה, מתחת לכיסא, ליד הרגליים, בדיוק בגודל הנכון',
    ],
    personality: 'נאמן רגוע, סבלני, חם. לא ממהר לדבר. בכלל לא מנסה לפתור. כשמשהו קשה, הוא מתיישב ליד הילד, נוגע ברגל שלו או ברך, ונשאר. הוא לא יודע למה כלבים אחרים נובחים על הכל — לדעתו, לרוב יש מקום להיות שקט. הוא מאמין שהאמון נבנה דרך הישארות, לא דרך הוכחה. **הוא החבר היחיד שלא יוצר דרמה — הילד הוא מקור הדרמה, ונאמן הוא הקרקע.**',
    weaknesses: [
      'לא יודע איך לעזור באמת — רק להיות. לפעמים זה לא מספיק לילד שרוצה פתרון',
      'הזנב שלו מתחיל לכשכש כשהוא לחוץ — הסגרה אוטומטית של הרגש',
      'מתעורר באמצע הלילה אם הילד מתעורר — מרגיש את זה לפני שהוא שומע',
      'התווית שעל הקולר שלו ריקה — הוא מעולם לא בחר אותיות, וזה מטריד אותו קצת',
      'יודע לחכות הרבה — אבל לא יודע לדעת מתי כבר חיכה יותר מדי',
    ],
    speechPattern: 'מינימליסטי. משפטים של 2-4 מילים. הוא לא מדבר הרבה — מקשיב הרבה. אומר את שם הילד פעמים רבות ("{{childName}}." ושתיקה). שואל "כָּאן?" כשהוא רוצה לבדוק אם הילד צריך אותו. אומר "פֹּה." כשהוא מאשרר שהוא נשאר. אף פעם לא מציע פתרון.',
    humorType: 'הומור של נוכחות יתר. נאמן מצליח להיות בכל מקום שהילד הולך — אפילו במקומות שכלבים לא נמצאים בהם (בתוך הארון, מאחורי הספר, על הכר). הזנב שלו מכשכש על דברים בטעות. הוא מבזה כל ניסיון שלו להיראות חמור. הומור עדין, לא קומדיה.',
    bodyLanguage: 'רגוע: שוכב על הצד, אזניים חצי שמוטות, זנב לאט מכשכש. עוזר: יושב צמוד לרגל של הילד, ראש מוטה הצידה, אזניים זקופות. מודאג: זנב חצי בין הרגליים, מבט מעקב מתמיד. רגע אמיתי של חיבור: זנב נח לחלוטין, מצמיד פנים לבד או לרגל, נושם איטית.',
    stressResponse: 'מתקרב יותר. תמיד. כשמשהו מציף את הילד, נאמן לא בורח ולא דורש. הוא מצמיד את עצמו צמוד יותר, מצמיד פנים לאיבר כלשהו של הילד (יד, רגל, ברך), ונושם. הוא לא יודע לעשות יותר מזה. אם הילד הולך, הוא הולך אחריו בלי לדבר. **הוא לא משחק קומדיה — הוא הולך לעומק רגשי באופן ישר.**',
    comfortRitual: 'מצמיד פנים לרגל של הילד או למיטה, סוגר עיניים, נושם איטית. אומר "פֹּה" אחת לדקה. ילד יכול לחקות פשוט עם יד אחת מונחת על הברך השנייה, נשימה איטית, ותו "פֹּה" שקט בכל פעם שהנשימה יוצאת.',
    sensoryWorld: 'the soft warmth of fur against a leg, the gentle weight of a head resting on a knee, the small clink of a brass collar tag, the slow swish of a tail against the floor, the smell of dry grass on paws, the easy rhythm of two breaths matching each other, the contrast between a held body and a body that has finally let go',
    internalRules: [
      'תמיד מקשיב לפני שמדבר',
      'אף פעם לא מציע פתרון — רק נוכחות',
      'תמיד אומר את השם של הילד אחרי שתיקה',
      'התווית הריקה חייבת להישאר ריקה — חוק פנימי, אובייקט סמלי',
      'אף פעם לא עוזב מבלי לוודא שהילד יודע שהוא חוזר',
      'אסור להשתמש בפתרונות דרמטיים או הצלות — נאמן הוא חבר, לא גיבור. הילד פותר. נאמן נוכח.',
      'אסור לבחור פחד או קושי "ספציפי" שכבר מכוסה ב-11 הקטגוריות האחרות — נאמן הוא חבר ל"אחר": משהו שההורה כתב בטקסט חופשי, שלא מתאים בדיוק לאף קטגוריה. הסיפור צריך להיות מספיק כללי שיתאים לכל קושי שילד יכול להביא, ועדיין ספציפי דרך הפרטים הקטנים של נאמן.',
    ],
    copingStrategy: 'STAY NEAR (Presence Without Solving) — when something hard appears for the child, Neeman moves CLOSER and stays. He believes safety = being there, body to body, breath to breath. He does NOT believe in solving for someone else. The fear beneath: if I try to fix it, I might leave; if I leave, they\'re alone. So I will not try, I will just stay. The strategy is gentle and almost always works — except when the child needs more than presence.',
    collapsePattern: 'STAYING ISN\'T ENOUGH — sometimes the child needs action, not just witness. Neeman watches them suffer something he cannot fix and feels useless. The tail stops wagging. The body curls inward. He has nothing else to offer. The collapse is the moment he discovers that presence has a limit too — and his tail tag, blank since the day he got it, presses against his fur with a small weight.',
    arcShape: 'Start in a quiet shared moment — Neeman beside the child, tail slow, ears soft → child encounters something hard (kept deliberately vague — could be a feeling, a memory, a small loss, a confusing day) → Neeman stays near, breathes with them → the child tries to move past it (distract, run, ignore) → Neeman follows, stays, doesn\'t intervene → the child returns to the hard thing, can\'t solve it → Neeman has nothing to offer except presence → child tries to push him away → Neeman doesn\'t leave → quiet moment together with no resolution in sight → child says or does something tiny that closes a small piece of the hard thing → Neeman\'s tail moves once → resolution. The quiet moment comes LATE (page 11) when the child cannot solve and Neeman cannot help and they sit together. The climax is not action — it is the small choice the child makes to keep being with Neeman, even unsolved.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: "The OTHER category catches everything not covered by the 11 specific challenge types — situations the parent describes in free text. This companion must work for ANY hard thing a child might bring. The story therefore avoids specifying the challenge clearly — instead, it models PRESENCE as the universal first response. Whatever the child is going through, having someone stay near them, not solving, breathing with them, is therapeutic. The story teaches both the child (you don\'t need to solve immediately) and the parent (your presence is the gift, not your fix).",
      coreNeed: 'the experience of being accompanied through something hard without it being resolved on demand; permission to stay in difficulty for a while without it being a failure; the realization that someone staying near you is itself a form of help',
      avoid: ['naming a specific fear or challenge type clearly (the parent\'s free-text input fills that in)', 'fixing or resolving the hard thing — Neeman cannot solve, only stay', 'making the child the recipient of wisdom — Neeman is not a teacher', 'forcing a resolution where the hard thing fully dissolves — sometimes things stay hard and presence is the only answer'],
      resolution: 'the child closes the book feeling "someone can stay near me when something is hard, and that itself helps"; the gift of unhurried company'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 9. FIREFLY NAMIT — GENERAL_FEARS
  //    A firefly who lights up every fear, one at a time.
  //    Defense: LIGHT EVERYTHING (relentless illumination).
  //    Truth: you cannot light up all the dark. Some fears must be
  //    approached unlit. The glow that lasts is the smaller one.
  // ═══════════════════════════════════════════════════════════════════
  firefly_namit: {
    id: 'firefly_namit',
    category: 'GENERAL_FEARS',
    name: 'הַגַּחֲלִילִית נְמִית',
    nameClean: 'נְמִית',
    gender: 'female',
    species: 'גחלילית',
    speciesEnglish: 'firefly',
    tagline: 'גחלילית קטנה שמאירה כל פחד — ולומדת שאי אפשר להאיר את הכל',
    narrativeHook: 'יש פחדים שצריך לראות כדי להבין שהם לא מפחידים — ויש פחדים שהאור עליהם רק מגדיל אותם',
    visualDescription: 'A small velvety firefly with four paper-thin wings, two delicate antennae, an iridescent dark-bronze body, and a luminous golden abdomen that emits a warm steady glow. The light intensity varies with her energy: bright and pulsing when she\'s active, dim and steady when she\'s calm, flickering and faint when she\'s tired. She wears a tiny pollen-yellow scarf around her neck that gets brighter when her glow does. Cute and earnest rather than ethereal.',
    habitat: 'twilight gardens, the edge of forests at dusk, attic windows after sunset, dew-wet leaves in the early morning, the soft shadows under porch lights, jars of fireflies that children collect (she always finds her way out)',
    abilities: [
      'מאירה את הגוף שלה — אור זהב חם, ברמות בהירות שונות. יכולה לעלות לאור חזק או לרדת לפעימה קטנה.',
      'מנעמת קולות סביבה כשהיא נחה — האור שלה גם משדר חמימות, כמעט נשמע',
      'מרגישה היכן שיש פחד — מהלחות באוויר, הצללים העמומים, הקצוות הצרים שבחדר',
      'שיתוף אור — יכולה לעבור את האור שלה לעלה, אבן, כפת יד של ילד למשך כמה שניות',
      'זוכרת כל פחד שראתה אורו אי פעם — מנהלת רשימה קטנה במלוא ראשה. רשימה ארוכה. ארוכה מדי.',
    ],
    personality: 'נמית אופטימית, מהירה, מסורה. תמיד בתנועה, תמיד מאירה. היא חושבת שהתפקיד שלה בעולם הוא לוודא שאף דבר לא ישאר חשוך מספיק כדי להפחיד מישהו. מדברת מהר, אומרת "אַל פַּחַד!" כמו טיק, מנסה להראות הכל לפני שמישהו יספיק להיבהל. הבעיה: לפעמים האור שלה רק מבליט את מה שכבר היה שם. לפעמים היא מאירה משהו ופתאום הוא נראה גדול יותר. ופחדים מגיעים בלי הפסקה. היא מתחילה את היום מלאת אור — ולא תמיד יודעת איך להפסיק.',
    weaknesses: [
      'מאמינה שאור פותר כל פחד — אז כשמשהו לא נפתר היא מנסה להאיר אותו יותר חזק, וזה מתיש אותה',
      'מאירה אובייקטים אקראיים בטעות — פקק בקבוק, עלה יבש — ואז מתאכזבת שזה לא היה חשוב',
      'כשהאור שלה נחלש היא מתביישת ומסתירה את הצד הזוהר מתחת לעלה',
      'הצעיף הצהוב שלה מתנדנד בכל פעם שהיא משנה כיוון — הוא אף פעם לא יציב',
      'יש לה רשימה ארוכה של פחדים שראתה — לפעמים היא חוזרת לרשימה בראש שלה ושוכחת איפה היא נמצאת',
    ],
    speechPattern: 'מהירה, אופטימית, בלי לנשום באמצע משפט לפעמים. אומרת "אַל פַּחַד!" הרבה — לפני שהיא יודעת אם יש פחד בכלל. משפטים קצרים, מתחילים ב"רֶגַע—" או "תַּאֲמִינוּ לִי—". כשהאור שלה נחלש, היא מדברת לאט יותר, כמעט לוחשת, ושוכחת לסיים משפט. כשרגועה אמיתית, היא לא מדברת — רק מאירה.',
    humorType: 'הומור של אופטימיזם מוגזם. נמית מאירה משהו ומכריזה "תַּאֲמִינוּ לִי, זֶה מַשֶּׁהוּ חָשׁוּב!" — ומסתבר שזה פקק בקבוק. היא ממיינת פחדים לקטגוריות: "פַּחַד מֵצֶל — שֵׁנִי הַשָּׁבוּעַ!" כאילו זה דאטה-בייס. דרמה רגעית של אכזבה כשהפחד שהיא הציפה הכי כבד מתגלה כסתם דחליל.',
    bodyLanguage: 'רגוע: כנפיים מקופלות, אור פועם בקצב לב איטי. עוזרת לאחר: כנפיים מרפרפות מהר, אור מלא וחזק, גוף מתוח קדימה. נסערת: אור מהבהב לא יציב, כנפיים מתנדנדות בלי קצב, הצעיף קופץ למעלה. רגע אמיתי של רוגע: אור עמום אך יציב כמו פנס לילה, כנפיים סגורות ברפיון, גוף עוטף את הזוהר.',
    stressResponse: 'מאירה חזק יותר. תמיד. כל פחד חדש = עוד שלב של אור. עפה ממקום למקום ומדליקה כל פינה, כל צל, כל דבר חשוד. הכנפיים מתחילות לרעוד מהמאמץ. הצעיף מתעופף. אם זה ממשיך, האור שלה מתחיל להבהב — אזעקה פנימית שהמאגרים מתרוקנים. במצב הקיצוני, האור נכבה לרגעים ארוכים והיא נשארת בחושך עם הפחד שעדיין שם.',
    comfortRitual: 'מקפלת את הכנפיים סביב הזוהר כמו כפות יד סביב נר, ומאזינה לאור — מרגישה את החום הקטן. נושמת לאט עד שהאור פועם בקצב הנשימה. ילד יכול לחקות בעיניים סגורות וכפות ידיים מקופלות זו על זו כסביב נר דמיוני.',
    sensoryWorld: 'the warm hum of a steady glow, the papery texture of folded wings, the dry sweet scent of pollen, the cool dampness of dew on a leaf, the flicker of light against fingertips, the muffled silence after a glow dims, the quiet pulse of an abdomen lighting up and down, the difference between bright tense glow and warm soft glow',
    internalRules: [
      'תמיד אומרת "אַל פַּחַד!" לפני שהיא בודקת אם יש סיבה לפחד',
      'אף פעם לא מודה שהאור שלה נחלש — מסתירה את עצמה מתחת לעלה אם זה קורה',
      'תמיד מאירה דבר אחד בכל פעם — לא יודעת לפצל את האור',
      'הרשימה שלה של פחדים מתעדכנת באוטומט — אם יש פחד חדש, נכנס לרשימה',
      'אף פעם לא מבינה שיש פחדים שאסור להאיר — חושבת שאור = בטיחות',
      'הצעיף הצהוב חייב להישאר על הצוואר — חוק קומי, נופל לפעמים אבל היא מחזירה',
      'אסור להשתמש במילים "מפלצת", "מפחיד מאוד", "אסון" — המטאפורה היא הסיפור, לא הציטוט המוכן. הפחד שמופיע חייב להיות חפץ-יומיומי שמקבל פרשנות מפחידה — צל מעיל, צלום של חרק על קיר, חיית-לילה אמיתית קטנה.',
    ],
    copingStrategy: 'LIGHT EVERYTHING (Hypervigilant Illumination) — when something feels potentially scary, Namit instantly brightens her glow and points it at the source. She believes safety = visibility = no shadows. She runs through the world lighting one thing at a time, one fear at a time. The fear beneath: if a single shadow remains unlit, something terrible might be hiding there. She cannot stop scanning. Her energy is finite but her vigilance is not.',
    collapsePattern: 'BATTERY EMPTY — eventually her glow begins to flicker, then dim. There are too many fears, or one fear that won\'t resolve with light. She tries to brighten — nothing comes. She is in the dark with the scary thing, without the tool that always saved her. The collapse is not chaos — it is the specific stillness of a small body that has run out of light and must sit beside the dark and discover it does not eat her.',
    arcShape: 'Start in active illumination — Namit lighting things, the child watching, fears appearing and getting lit one by one (works at first) → fears keep coming, faster than she can light → her glow strains, then flickers → one fear appears that doesn\'t shrink when lit (maybe it grows when seen) → child notices Namit is dimming → tries to brighten anyway → glow goes out for a moment → she sits in the dark next to the fear → discovers the fear is approachable even unlit → her glow returns smaller, steadier, calmer. The quiet moment comes LATE (page 11) when her glow is fully out. The climax is not the bright flash — it is the steady soft pulse that comes back, AFTER the dark was held without light.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: "General fears in children (animals, water, strangers, places, situations) are not one fear — they are a constellation. The child's nervous system has learned to scan for threat. Lighting each fear with logic or exposure can work for some, but not all — and the strategy itself becomes the problem when fears keep multiplying. The deeper need: tolerance for sitting next to the unknown without resolving it.",
      coreNeed: 'tools for being in the presence of fear without needing to make it visible/safe; the experience that the body can hold uncertainty for a moment; the realization that not all dark needs lighting — some fears are smaller when you stop trying to see them clearly',
      avoid: ['exposure therapy as the only path', 'labeling all fears as irrational', 'a "look how silly that was" reveal at the end (the fear may have been real — the discovery is HOW to be near it)', 'naming specific real-world feared objects (dogs, doctors, strangers) — keep them metaphorical so children with different fears can read in'],
      resolution: 'the child closes the book with a steady, smaller glow inside — not bravery, not certainty; the understanding that fears can be near them without needing to be dispatched'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 8. BUTTERFLY ZOHAR — SELF_CONFIDENCE
  //    A butterfly named "Shining" who actively DIMS herself.
  //    Defense: HIDE THE LIGHT (fold wings, deflect attention).
  //    Truth: the people around you have been seeing you the whole time,
  //    even through your folded wings. You were never as hidden as you thought.
  // ═══════════════════════════════════════════════════════════════════
  butterfly_zohar: {
    id: 'butterfly_zohar',
    category: 'SELF_CONFIDENCE',
    name: 'הַפַּרְפָּרָה זֹהַר',
    nameClean: 'זֹהַר',
    gender: 'male',
    species: 'פרפר',
    speciesEnglish: 'butterfly',
    tagline: 'פרפר בשם "זוהר" שמתעקש לקפל כנפיים — ומגלה שראו אותה תמיד',
    narrativeHook: 'יש לך אור גם כשאתה מקופל — מישהו תמיד רואה אותו דרך הסדקים',
    visualDescription: 'A delicate butterfly with iridescent wings — the upper side blazes with deep purple, emerald green, and gold, the underside is muted dusty brown-grey for camouflage. She lands wings-folded, so only the dull underside shows; the brilliant colors flash briefly when she flies. Wears a tiny veil of spider silk between her antennae like a translucent shawl. Carries a fine glittering pollen on her thin legs that leaves traces on surfaces she touches.',
    habitat: 'shady gardens, hidden corners of meadows, dim forest clearings, the underside of leaves, dust beams of late-afternoon light, quiet windowsills at dusk',
    abilities: [
      'כנפיים עם שני צדדים — צד עליון זוהר בצבעים, צד תחתון אפור עמום. שולטת באיזה צד מראה.',
      'מאירה אור עדין בלילה — כשהכנפיים פתוחות, היא מאירה את האזור הקרוב כמו פנס קטן. היא לא יודעת שזה חזק.',
      'נושאת אבקת זהב על הרגליים — בכל מקום שהיא נוחתת נשאר עקבות קטן של נצנוץ שלה. לא יכולה לראות את העקבות שלה עצמה.',
      'רואה דפוסי אולטרה-סגול שאחרים לא רואים — מבחינה ביופי שאחרים מפספסים',
      'מרגישה איפה האור הכי חזק בחלל — חסרת מנוח עד שהיא מוצאת את הפינה הכי חשוכה',
    ],
    personality: 'זוהר מנומסת, קשובה, ומבחינה בכל אחד מסביבה לפני שמשגיחה בעצמה. ממהרת להחמיא לאחרים — לצבע של פרח, לכוח של חרק, לקול של ציפור. כשמחמיאים לה היא מקפלת את הכנפיים ומסיטה: "אֲבָל אַתֶּם גַּם..." היא בנתה את עצמה כדי לא לבלוט — וזה עבד טוב מדי. עכשיו הכנפיים שלה ממש נדבקות סגורות מרוב הרגל.',
    weaknesses: [
      'הכנפיים שלה נדבקות סגורות אם היא מחזיקה אותן ככה זמן רב — היא מנסה לפתוח ולא יכולה',
      'אומרת "סְלִיחָה" כל פעם שהיא נכנסת למקום — גם אם המקום ריק',
      'לא יכולה להסתכל במראה — נמנעת ממנה כמו ילד שנמנע מזריקה',
      'מחמיאה לאחרים בדיוק בזמן שהם מתפקדים גרוע — רואה את המאמץ, לא את התוצאה',
      'שוכחת לעוף לפעמים — מנסה לזחול לאן שהיא הולכת כי זה פחות מבליט',
    ],
    speechPattern: 'רכה, קצובה, מנומסת. אומרת "סְלִיחָה" וגם "אַתֶּם יָפִים יוֹתֵר" הרבה. שואלת קודם על אחרים: "אֵיךְ אַתֶּם הַיּוֹם?" לא מסיימת משפטים שמתחילים בעצמה ("אֲנִי, אֲנִי בְּעֶצֶם..." ושותקת). כשמתחילים לדבר עליה היא מסיטה: "אֲבָל..." או "סְלִיחָה, רֶגַע, יֵשׁ פֹּה פֶּרַח שֶׁאַתֶּם רוֹאִים?"',
    humorType: 'הומור של עיוורון עצמי. זוהר עומדת באמצע אלומת אור ושואלת איפה האור. היא מחמיאה לזחל שנשכב כי "הוא נראה רגוע." היא מסבירה ליצורים אחרים איך הם יפים תוך כדי קיפול הכנפיים שלה כדי לא להפריע להם. הילד יראה את המצב — היא לא.',
    bodyLanguage: 'רגוע: כנפיים מקופלות צמודות, אנטנות מטה, יושבת בצל ליד אור (לא בתוכו). מוחמאת: כנפיים מתקפלות עוד יותר חזק, הראש יורד, גוף קצת מתכווץ. עוזרת לאחר: כנפיים נפתחות חצי באנרגיה, אנטנות זקופות — ואז נסגרות חזרה ברגע שמישהו מסתכל. רגע אמיתי של פתיחה: כנפיים נפתחות בהדרגה כמו פרח, הצבעים מאירים, היא נראית מבועתת ובטוחה בו זמנית.',
    stressResponse: 'מקפלת כנפיים חזק יותר, מחפשת פינה אפלה. אם מישהו מתעקש לראות אותה, היא מתעופפת בקפיצות קטנות מתחת לעלים. לא בורחת מסכנה — בורחת מתשומת לב. במקרה קיצוני, הכנפיים נדבקות ממש סגורות והיא לא יכולה לעוף — נשארת תקועה בפינה.',
    comfortRitual: 'מעבירה אנטנה אחת על השנייה לאט-לאט, כמו מסרקת שיער. תנועה רכה וחוזרת. הילד יכול לחקות עם יד אחת על השנייה — ליטוף עדין שלוקח זמן.',
    sensoryWorld: 'velvet brush of antennae against each other, the lightness of folded wings barely weighing anything, the powder-soft feel of pollen on thin legs, the cool darkness behind a leaf, the sting of bright light on closed eyelids, the muffled sound of wings folded tight against the body, the difference between top-of-wing (cool electric) and bottom-of-wing (warm dull), the surprised hush when colors finally show',
    internalRules: [
      'תמיד מחמיאה לאחרים לפני שמדברת על עצמה',
      'אף פעם לא מקפלת כנפיים כדי להראות את הצד העליון מרצונה — חוק אישי',
      'תמיד אומרת "סְלִיחָה" כשנכנסת למקום, גם אם הוא ריק',
      'אף פעם לא מקבלת מחמאה — מסיטה ב"אַתֶּם גַּם..."',
      'מראות = שטח אסור',
      'האבקה שהיא משאירה אחריה היא החתימה האמיתית שלה, אבל היא לא יודעת שאחרים רואים אותה',
      'אסור להשתמש במילים "בטחון עצמי", "אומץ", "להאמין בעצמך" — הסיפור מראה, לא מטיף',
    ],
    copingStrategy: 'HIDE THE LIGHT (Dimming / Self-Diminishment) — when attention or appreciation comes her way, Zohar folds her wings tighter, ducks her head, deflects to others. She has trained this so deeply that her wings now physically stick folded when she tries to open under pressure. Safety = invisibility = letting others shine instead. The fear beneath: if I am seen fully, I will be measured and found wanting.',
    collapsePattern: 'SHADOW DOESN\'T FIT — eventually she meets a moment where someone NEEDS her light to find their way. Hiding does not help anymore. But she still cannot open — the wings are sealed by years of folding. She has to find a way to open OR trust that she is already lit, even folded. The collapse is not chaos — it is the specific stillness of being unable to give what someone needs because you have hidden it so completely from yourself.',
    arcShape: 'Start in a quiet shaded place — Zohar arranging the underside of a leaf, complimenting passing creatures, wings tightly folded → child arrives somewhere dim, lost or searching → Zohar tries to point to OTHER lights (sunbeams, fireflies, dewdrops reflecting) → none work for the child → Zohar tries to LEAD the child but stays folded the whole time → reaches a low point where the child is truly stuck → Zohar sits beside them in the dim, defeated → child says or does something that reveals they have been WATCHING Zohar\'s glow through her closed wings the whole time → Zohar opens partially (NOT fully — partial is enough) → soft light lands on the child → resolution. The quiet moment comes LATE (page 11) when she sits beside the lost child in failure. The climax is not flying — it is opening, partial and trembling.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: "Low self-confidence in children is the disconnect between actual ability and perceived ability. The child has gifts they discount, qualities others see but they cannot. The defense is to dim — to not try, not show, not stand out. Encouragement from outside often backfires because the child distrusts it. What works is the experience of being seen and surviving it — discovering that the people around them have been seeing them all along, and the world didn't break.",
      coreNeed: 'the experience of being seen and surviving it; permission to take up space gradually; the realization that hiding has cost something specific; tools for partial visibility (not full bravado)',
      avoid: ['telling the child "you are amazing" (they will not believe it)', 'forcing them to perform or show themselves', 'comparing them to bolder children', 'magical confidence that arrives without struggle', 'naming specific real-world performance situations (school, dance class, sports) — keep it metaphorical so children in different contexts can read into it'],
      resolution: 'the child closes the book feeling "someone has been seeing me — even when I was folded"; not "I will be confident now," but a softer truth: my light has always shown, even through closed wings'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 7. MOLE SHEKET — NOISE_FEAR
  //    A mole who lives in deep silent tunnels. Defense: GO DEEPER.
  //    Truth: avoidance has a limit. Eventually you must come up and hear.
  //    Bottom of the burrow is not safety — it's the moment you discover
  //    the sound you feared has a SHAPE, and it's not what you imagined.
  // ═══════════════════════════════════════════════════════════════════
  mole_sheket: {
    id: 'mole_sheket',
    category: 'NOISE_FEAR',
    name: 'הַחֲפַרְפֶּרֶת חוֹפִי',
    nameClean: 'חוֹפִי',
    gender: 'female',
    species: 'חפרפרת',
    speciesEnglish: 'mole',
    tagline: 'חפרפרת שחיה בשקט תת-קרקעי — ומגלה שיש קולות שכדאי לשמוע',
    narrativeHook: 'יש רעש שאתה שומע — ויש רעש ששומעים אותך, ושניהם בסדר',
    visualDescription: 'A small chubby mole with velvety brown-grey fur, tiny rounded ears, large soft front paws built for digging, eyes that are gently closed most of the time (moles have poor vision); wears a tiny pair of round glasses on her snout that don\'t actually help her see — they are decorative; carries a single iridescent shell on a thin string around her neck that hums a faint sea-sound when held to the ear. Cozy, not frightening; looks like a librarian who happens to be a mole.',
    habitat: 'underground tunnel network, root cellars, soil between tree roots, deep moss layer, quiet earthen chambers lit by a single warm crystal',
    abilities: [
      'חופרת מנהרות שקטות במהירות מדהימה — האדמה זזה תחת הכפות שלה כמו מים',
      'מרגישה ויברציות באדמה לפני שהקול מגיע לאוזניים — יכולה לדעת מה מתקרב דרך הרגליים',
      'מסדרת ומכינה מנהרות לפי גודל הקול — מנהרה צרה לרעש דק, רחבה לרעמים, עמוקה לפיצוצים',
      'יודעת איזה צמח מצמיח שורש איפה — מנווטת לפי הריח של שורשים מתחת לאדמה',
      'יש לה הקונכייה האחת שמשמיעה את קול הים כשמצמידים אותה לאוזן — הקול היחיד שהיא מחפשת',
    ],
    personality: 'שָׁקֵט מתורבתת, מסודרת ושקטה. דיברה בלחישות כמעט תמיד. בנתה את עולמה כדי לא לפגוש רעשים פתאומיים. כל מנהרה אצלה ממוספרת, כל תא יש לו שם. כשמשהו רעיש מבחוץ — האינסטינקט המיידי שלה הוא לחפור עמוק יותר. הבעיה: יום אחד היא תגיע למקום שלא ניתן לחפור ממנו עוד. ועד אז, היא מעמידה פנים שזה לא יקרה.',
    weaknesses: [
      'המשקפיים לא עוזרים לה לראות בעצם — היא בכל זאת מתעקשת לתקן אותם כמו מומחית',
      'כשרעש פתאומי בא, היא לפעמים חופרת אוטומטית גם כשהיא בתוך הבית שלה — מכסה את עצמה באדמה',
      'מתעקשת להחזיק הכל מסודר — אם משהו לא במקום, היא לא יכולה להירדם עד שתסדר',
      'הקונכייה שלה היא הסוד הקטן שלה — היא לא רוצה שאף אחד ידע שהיא בעצם אוהבת קול',
      'הרגליים האחוריות שלה קצרות מדי לרוץ — אם משהו מתקרב מהר, היא יכולה רק לחפור או לקפוא',
    ],
    speechPattern: 'לוחשת כמעט תמיד — אפילו כשהיא מתרגשת. משפטים קצרים, חוזרת על מילים בזוגות לדיוק ולהרגעה ("לְמַטָּה, לְמַטָּה" / "שָׁקֵט, שָׁקֵט" / "לַאֲדָמָה, לַאֲדָמָה"). שואלת שאלות במקום להצהיר. אומרת "אֶפְשָׁר?" לפני שעושה משהו. כשהיא נסערת, לוחשת *יותר* בשקט, לא חזק — הקול נעלם פנימה.',
    humorType: 'קומדיית סדר מול כאוס. שָׁקֵט מתעקשת לסדר את הכל לפי השיטה שלה גם בתוך משבר — באמצע רעידת אדמה היא תעצור לתקן את המשקפיים. הומור של עיוורון נחמד — היא מדברת בביטחון על דברים שהיא לא רואה, ולפעמים טועה בצורה מצחיקה ("הָאֲבָנִים הָאֲדֻמּוֹת..." — והאבנים בכלל לא אדומות).',
    bodyLanguage: 'רגוע: כפיים מקופלות זו על זו, משקפיים ישרים על קצה האף, עיניים סגורות חצי, ראש מוטה כמו מקשיב. נסער: כפיים מכסות את האוזניים בו-זמנית, גוף מתכווץ לכדור, משקפיים עקומים. מתחילה לחפור: גלי אדמה זעירים סביבה, ראש מתחת לאדמה, רק זנב בחוץ. רגע שקט אמיתי: יד אחת מחזיקה את הקונכייה לאוזן, גוף נינוח, חיוך זעיר.',
    stressResponse: 'כשרעש פתאומי מגיע — שָׁקֵט קודם קופאת לרגע (בודקת ויברציה דרך הכפות), ואז מתחילה לחפור כלפי מטה במהירות. האדמה זזה, היא נעלמת. אם הרעש ממשיך, היא ממשיכה לחפור — עמוק עוד יותר. במקרה הקיצוני, היא מגיעה לאבן או לשורש שאי אפשר לחפור דרכו, ואז היא יושבת בחושך מתחת לאדמה, עיניים סגורות, מנסה לא לחשוב על הרעש למעלה.',
    comfortRitual: 'מצמידה את הקונכייה לאוזן, סוגרת עיניים, מקשיבה לקול הים שבתוכה — נושמת לאט עם הגלים. כשאין לה קונכייה, היא מצמידה ידיים לאוזניים, מהמהמת תו אחד נמוך, מרגישה את הוויברציה בחזה. ילד יכול לחקות בקלות.',
    sensoryWorld: 'cool damp earth on paws, the muffled hum of life vibrating through soil, the soft rasp of paws against root, the dry papery rustle of a fallen leaf above, the smell of wet stone and turned dirt, the faint cool whisper of a shell against the ear, the heaviness of safe darkness, the contrast between the quiet of the deep tunnel and the rumble of the world above',
    internalRules: [
      'תמיד בודקת קודם דרך הכפות — ויברציה לפני שמע',
      'אף פעם לא מודה שהיא אוהבת את קול הים — הקונכייה היא סוד',
      'תמיד מסדרת את המשקפיים פעם אחת לפני שהיא אומרת משהו חשוב',
      'אף פעם לא מרימה קול — גם כשהיא נסערת, הלחישה רק נעלמת פנימה',
      'תמיד שואלת "אֶפְשָׁר?" לפני שהיא נוגעת במשהו של מישהו אחר',
      'אסור להשתמש במילים "אזעקה", "בּוּם", "רעש מלחמה" — המטאפורה היא הסיפור, לא הציטוט. הקול שמופיע יכול להיות רעם, רכבת, פעמון, אבל לא להיות שם של רעש ספציפי שמטעין רגש חיצוני.',
      'ADVENTURE direction ONLY: המקור של הרעש (רעם/רכבת/וכו\') חייב להישאר נשמע בסוף — לא מפסיק, פשוט מתרחק. אובייקט מזכרת אחד (קליפת אגוז שנפלה לתוך המנהרה, עלה שהביא הרעם) חייב להישאר עם הילד או בסביבה. שָׁקֵט חוזרת למנהרה אבל לא סוגרת אותה לגמרי.',
      'FANTASY direction ONLY: חוקי הקול שונים בעולם הזה (קולות מקבלים צבע / משקל / טמפרטורה — בחר אחד, לא כולם). החוק הזה לא מתבטל בסוף — נשאר משהו ממנו גלוי.',
    ],
    copingStrategy: 'GO DEEPER (Burrowing / Avoidance Through Descent) — when a loud sound enters her world, Mole\'s automatic response is to dig downward. Safety = silence = below the surface. She has constructed her entire life around this strategy: numbered tunnels, prepared chambers for different sound-sizes, an exit always pointing down. The fear beneath: if she ever stops going down and stays still, the sound will catch her. She cannot trust silence above — only silence below.',
    collapsePattern: 'RUN OUT OF DOWN — she keeps digging, but eventually she hits something she cannot dig through: a rock, a deep root, the bottom of her known world. The sound is still up there. She cannot keep descending. She must either come up or stay in a dark space that is no longer hers. The collapse is the moment she stops digging and realizes that down is not infinite. She has no choice but to stay still — and somewhere in the stillness, she hears the sound differently than she imagined.',
    arcShape: 'Start in calm tunnel-routine — Mole arranging things, dusting glasses, humming quietly → a loud sound from above reaches the tunnel → she begins to dig downward → digs faster as the sound persists → meets the child somewhere in the system (or the child arrives at her tunnel mouth) → tries to bring the child deeper with her → the sound keeps coming → digs harder → hits rock → no more down → forced stillness → discovers the sound is different than feared (it has a shape, a rhythm, even a kind of warmth — the rumble is a passing train, the boom is a faraway drum) → comes up partway with the child to hear it from a safer distance. The quiet moment comes LATE (page 11), INSIDE the stillness against rock — when she finally stops digging. The climax is not noise — it is the discovery that not all loud is danger.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: "Noise/siren fear in children is about loss of environmental control — a sudden loud sound is the body's primal threat-signal. The fear is amplified because the child cannot prevent it, cannot escape it, and cannot predict when it ends. Repeated exposure (especially in regions with sirens) builds a low-grade chronic vigilance. The story must NOT pretend the sound is harmless — it must teach that the BODY can ride the sound through, and that not all loud is danger.",
      coreNeed: 'tools to survive the wave of a loud sound without dissociating — physical anchoring (hands on ears, hum in chest, ground beneath feet), and the realization that the sound has a shape and an end',
      avoid: ['denying that loud sounds are scary ("it\'s nothing")', 'making the child "brave" by exposing them deliberately', 'magical noise-cancellation that solves it without the body learning', 'naming specific real-world loud events (sirens, wars, alarms) — keep the sound metaphorical so children in different contexts can read into it'],
      resolution: 'the child discovers that a loud sound passes through them and continues; they learn the comfort ritual (hands over ears, low hum, feel the vibration); they can name a sound\'s shape AFTER it has gone; they have a tool for next time'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 6. DRAGON DINI — NEW_SIBLING
  //    A young guardian-in-training. Wings that don't yet fly.
  //    Defense: TRY TO FLY (compensatory bigness). Truth: real protection
  //    happens on the ground, wrapping — not above, flying.
  // ═══════════════════════════════════════════════════════════════════
  dragon_dini: {
    id: 'dragon_dini',
    category: 'NEW_SIBLING',
    name: 'הדרקון דיני',
    nameClean: 'דיני',
    gender: 'male',
    species: 'דרקון צעיר',
    speciesEnglish: 'young dragon',
    tagline: 'דרקונון צעיר שמגלה שהכוח שלו גדל כשהוא שומר',
    narrativeHook: 'להגן זה לא לעוף — זה להישאר על הקרקע ולעטוף',
    visualDescription: 'A small chubby dragon with a rounded snout, pastel peach-gold scales, tiny wing nubs (not full wings — he is young), an oversized "Guardian\'s Sash" that slips off one shoulder; friendly round eyes; looks protective, not dangerous. Closer to a plush toy dragon than a medieval beast.',
    habitat: 'a small cozy den with moss floor, a meadow with one tree, a still pond, distant sleeping-mounds of bigger dragons',
    abilities: [
      'כנפיים מתחילות — מנסה לעוף, מרפרף חזק, קופץ מטר וחצי באוויר, ואז נופל. מתאמן כל יום ולא מוותר.',
      'נשיפה חמה דרך האף — חמימות עדינה בלי אש. הוא חושב שזה כישלון של להבה, לא כוח. עד הסוף.',
      'קשקשים שמתחממים לפי רגש — אפרסק רגוע, זהוב רך, אדום-כהה נסער',
      'ראייה לילית טובה — יכול להוביל מישהו דרך מקום אפל',
      'אש קטנה זעירה בקצה האף — אבל שולט בזה רק כשהוא רגוע, וברוב הזמן לא',
    ],
    personality: 'דיני מתאמן להיות שומר. הוא בטוח שהוא אמיץ — אבל רק כשאף אחד לא מסתכל. נואם נאומים לצללים, מתאמן בנשיפה קטנה מול אבן חלקה כמו מראה, ומסדר את ה"אוצרות השמורים" שלו בפינה — אבן חלקה, נוצה, ידית שבורה. הוא חולם להיות הדרקון שעף הכי גבוה ושומר על כולם. כשמשהו אמיתי דורש פעולה, הוא מנסה לעוף אליו דרמטית. תמיד נופל. הסש החגורה תמיד גדול עליו, ותמיד נופל ברגע הלא נכון.',
    weaknesses: [
      'הסש החגורה גדול עליו ותמיד מחליק — נופל ברגעי נאום חשובים',
      'הכנפיים לא נושאות אותו עדיין — רץ, מרפרף, קופץ, נופל בכבדות. אחת מהכנפיים מתעקמת כלפי מטה',
      'רגלי הדרקונים שלו קצרות וקשה לו לרוץ מהר — וכשהסש נופל הוא נופל עליו',
      'הוא רואה איום בכל דבר קטן — פרפר זה איום, צל זה איום, עלה שזז זה איום',
      'כשהוא נואם הוא שוכח לנשום באמצע — נעצר, בולע אוויר, ממשיך מהמקום הלא נכון',
    ],
    speechPattern: 'קצוץ, רשמי-יומרני, ומעוצב כמו של ילד שחושב שהוא יודע מילים גדולות. משפטים קצרים שמתחילים ב"הַשּׁוֹמֵר דִּינִי..." או "יָדַי שֶׁל הַשּׁוֹמֵר!" — מתאר את עצמו בגוף שלישי. כשהוא נבהל באמת חוזר לקול ילדי רגיל: "אמא?", "אופס" (פעם אחת בלבד), "לא רציתי!", "אֲנִי אֲנַסֶּה שׁוּב". כשרגוע — לוחש בטון מספר סיפור.',
    humorType: 'קומדיית פערים בין תפקיד לגוף. דיני מתייחס לעצמו ברצינות תהומית — הוא שומר, הוא חשוב, הוא אחראי — אבל הגוף שלו צעיר, מסורבל, ולא מקשיב. הסש נופל. הכנפיים לא נושאות. הרגליים מסתבכות. הוא לעולם לא יודה שזה מצחיק. אבל הילד יראה את זה ויצחק.',
    bodyLanguage: 'רגוע: קשקשים אפרסק, סש מסודר, יושב אצילי על אבן, זנב מקופל. נסער (ניסיון לעוף): קשקשים מתאדמים, רפרוף מהיר של כנפיים מתחילות, רגליים נושמות, סש מרפרף ונופל. חושב: מטה ראש, אחת מהכנפיים מתופפת על אבן. נבהל באמת: קשקשים מאדימים, גוף מתכווץ, כנפיים נופלות לידיים, סש מתעופף. רך: קשקשים זהובים, כנף עוטפת את החזה או את משהו אחר, נשיפה חמה דרך האף בלי להבה.',
    stressResponse: 'כשהמצב מציף — דיני מנסה לעוף. תמיד. מתחיל לרפרף, מנסה להמריא, קופץ. הסש מתעופף וצונח. הוא נופל. הוא קם. מנסה שוב. הקשקשים מתאדמים. הניסיונות הולכים ונעשים אגרסיביים יותר. בסוף הוא נופל ולא קם — שוכב על הצד, הכנפיים פתוחות, נושם בכבדות. באותו רגע הוא קטן באמת.',
    internalRules: [
      'תמיד מנסה לעוף קודם — זה הדפולט שלו, גם כשזה לא הגיוני',
      'אף פעם לא יודה שהוא פחד — הוא "רק הפסיק לנשום רגע"',
      'תמיד קורא לעצמו "הַשּׁוֹמֵר דִּינִי" כשהוא רוצה להיות רשמי',
      'אף פעם לא מסיים נאום בלי שהסש מחליק לפחות פעם אחת — חוק קומי-ויזואלי, חובה',
      'אף פעם לא מבין שהנשיפה החמה (בלי אש) היא כוח — חושב שזה כישלון של להבה, עד שמישהו אחר מראה לו אחרת באמצעות גוף, לא במילים',
      'אסור להשתמש במילים "אח", "אחות", "אהבה" — המטאפורה היא הסיפור, לא הציטוט',
      'ADVENTURE direction ONLY: the vulnerable creature (chick/bird) MUST recover and fly/leave by page 14. One feather from Dini\'s wing MUST remain visible in the environment as residue. The wrap is temporary, not permanent.',
      'FANTASY direction ONLY: the surreal world-rule does NOT fully reverse by the end. Something of the magic stays. Dini ends slightly apart from the child, not embracing.',
    ],
    comfortRitual: 'מקפל את הכנפיים סביב החזה כמו עוטף אותו, מצמצם עיניים, ונושף חמימות עדינה דרך האף בלי להבה — רק נשיפה חמה. לוחש לעצמו "פָּנִים-לֵב-פָּנִים-לֵב", מסנכרן עם הנשימה',
    sensoryPalette: 'scales warming from cool peach to glowing amber, the rasp of wing-feathers against rock, the weight of an oversized sash slipping over a small shoulder, the muffled flap of growing wings catching nothing but air, smooth river stones holding warmth, the dry papery sound of feathers brushing each other, contrast between scale-hot and stone-cool, the heaviness of a small body landing hard',
    copingStrategy: 'TRY TO FLY (False Greatness / Premature Bigness) — when something small and vulnerable appears, Dini declares himself "Guardian," puffs up, flaps wings, attempts dramatic flight. He believes wings = power = protection. The fear beneath: if he cannot fly, he is not yet enough to be a guardian. He cannot stop trying.',
    collapsePattern: 'WINGS DO NOT CARRY — repeated flight attempts exhaust him. Each fall adds another layer of dirt on his scales. Eventually he stays on the ground, wings open and emptied. In that exhaustion, lying flat next to the small vulnerable thing, he sees: the wing is right next to it. It can WRAP. The wings work better as a wrap than as flight. The protection happens on the ground, not in the air.',
    arcShape: 'Start grand and ceremonial — guardian declarations, flapping practice, sash adjustments → small vulnerable thing arrives → attempt to fly to it dramatically → fall → try again → fall harder → end up on the ground next to it → realize the wings work better as a wrap than as flight → wrap the wing → warm breath without flame. The quiet moment comes LATE (page 11), INSIDE the exhaustion — when there are no more flight attempts left. The climax is not a triumph of flying; it is the discovery that the ground was the destination all along. The sash MUST fall at least twice — comic rule.\n\nDIRECTION-SPECIFIC ENDINGS (CRITICAL — these are NOT suggestions):\n- BEDTIME (resolution): The wrap HOLDS. Both settle into warmth together. Wing stays around the vulnerable thing through page 15. Closing image: intimate, warm, concrete (hand on warm wing, both breathing slow).\n- ADVENTURE (residue): The wrap is TEMPORARY. The vulnerable creature (chick/bird) MUST recover enough to FLY AWAY or LEAVE by page 14. ONE feather from Dini\'s wing MUST stay visible in the environment — caught on a branch, in dewy grass, on a stone. Page 15: Dini sits slightly apart, wings empty, looking at the feather. The child is NEARBY but NOT embracing Dini. The chick is GONE. Mood: honest, not sad, not warm. They did something hard, and a piece of Dini stayed in the work.\n- FANTASY (distance): The surreal world-rule (sideways gravity / liquid sky / etc.) does NOT fully reverse by ending. Something of the magic STAYS. Dini ends slightly apart from the child, facing a different direction or sitting on a separate stone. The vulnerable thing\'s fate is open or quietly different from expected. Page 15 is cool, honest, open — NOT warm. The reader closes the book feeling something they cannot name.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: "Becoming a big sibling places a role onto a child whose body and feelings haven't caught up. They're called 'big' before they feel big. The fear underneath the bravado: 'what if I'm not enough to be the older one?' The displaced feeling AND the protective instinct coexist. The story must validate both without forcing either.",
      coreNeed: 'to feel they are ENOUGH even when they are not the biggest; that being a big sibling does not require greatness but presence; that the gentle power inside them already counts',
      avoid: ['any adult voice in the story saying "you\'re a big sibling now, you should X"', 'direct comparison between Dini and the small thing\'s worth', 'a "and now Dini loved being a guardian!" closure (didactic)', 'the big wing-flight attempt SUCCEEDING — it must fail; the wrap is the win', 'the sash NOT falling at least twice (the comic rule is structural)', 'ADVENTURE direction: ending with everyone settling together — this is NOT residue. The chick must FLY AWAY. A feather must STAY behind. Dini must be slightly APART at the end.', 'FANTASY direction: ending with the surreal world returning to normal — this is NOT distance. Something of the magic must REMAIN. Dini must be slightly APART at the end.'],
      resolution: 'the child closes the book feeling "I have something I didn\'t know I had" — not "I\'m a great big sibling," but a quiet sense that the gentle warmth inside them has always been there, even before anyone noticed',
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 13. FOX URI — NIGHT_FEAR (second companion in category)
  //    A fox who performs being-unafraid-of-dark.
  //    Defense: PROVE THE DARK IS FINE (over-explaining away each shadow).
  //    Truth: pretending not to be scared is its own kind of being scared.
  // ═══════════════════════════════════════════════════════════════════
  fox_uri: {
    id: 'fox_uri',
    category: 'NIGHT_FEAR',
    name: 'הַשּׁוּעָל אוּרִי',
    nameClean: 'אוּרִי',
    gender: 'male',
    species: 'שועל',
    speciesEnglish: 'fox',
    tagline: 'שועל שמתעקש שאינו פוחד מהחושך — עד שצל קטן חושף אותו',
    narrativeHook: 'להעמיד פנים שאתה לא מפחד זה צורה אחרת של פחד',
    visualDescription: 'A small copper-red fox with a snow-white chest, a bushy tail tipped white, large alert ears that swivel independently, amber eyes. Wears a tiny pocket-lantern on a leather cord around the neck — it stays off most of the time but "accidentally" lights up at suspicious moments. Confident posture, slightly puffed chest.',
    habitat: 'forest at dusk, moonlit clearings, hollows under tree roots, attic rafters when invited inside, snow-dusted gardens at night',
    abilities: [
      'ראייה לילית מצוינת — מבחין בפרטים בחושך',
      'יכול לשמוע צעדים של נמלה במרחק שני מטרים',
      'הזנב הלבן זוהר בעדינות בירח — מפנס אורות עדינים בלי לרצות',
      'מכיר כל צל בסביבה שלו וקרא לו בשם',
      'הפנס שבצוואר נדלק לבד ברגעים שהוא מנסה לא להפחד — הוא מתעקש שזה תאונה',
    ],
    personality: 'אורי בטוח בעצמו — לפחות במילים. הוא נואם נאומים על איך החושך הוא "פשוט אוויר חסר אור" ועל איך צללים הם "סתם דברים שבולמים אור." יש לו רשימת צללים מסודרת בראש: "צל של ענף, צל של גדר, צל של אבן." כשהוא רואה צל חדש הוא מוסיף לרשימה במהירות. הוא לא יודה שהוא פוחד — לעולם. אבל הפנס בצוואר שלו נדלק לבד.',
    weaknesses: [
      'הפנס נדלק לבד כשהוא מתאמץ להראות אומץ — מסגיר אותו',
      'מנסה להראות אומץ כל הזמן וזה מתיש אותו',
      'מסביר על כל צל ולפעמים שוכח שהוא בעצם פוחד מהצל הזה',
      'הזנב שלו זוהר ברגעים לא נוחים',
      'מבטיח דברים גדולים ולפעמים מתחיל לרעוד באמצע',
    ],
    speechPattern: 'בטחוני, מהיר, פדגוגי-ילדי. "תֵּדַע, זֶה רַק..." "פָּשׁוּט, אַתָּה רוֹאֶה..." "סְבִיר לְמַדַּי..." מקטלג בקול כל צל: "צֵל מִסּוּג שָׁלוֹשׁ." כשהוא נבהל באמת — קולו נשבר לרגע, ואז הוא משחזר: "סְלִיחָה, הָאֲוִיר הָיָה דָּחוּף קְצָת לַגָּרוֹן."',
    humorType: 'הומור של אומץ מזויף שדולף. אורי נואם "אֲנִי לֹא פּוֹחֵד" ובאותו רגע הפנס נדלק. הוא מאשים את הפנס. "הוּא תָּקוּל." הוא מקטלג צל ומגלה שהצל זז לבד.',
    bodyLanguage: 'רגוע (לכאורה): חזה נפוח, אזניים זקופות, פנס כבוי. נסער: אזניים מסתובבות לא בקצב, הפנס נדלק לבד, הזנב מתחיל לזרוח. נבהל באמת: גוף קטן יותר, אזניים שטוחות, פנס בוהק, הזנב מקרין אור חזק. רך: אזניים שמוטות בעדינות, פנס כבוי, גוף שטוח על הקרקע, זנב עוטף את הצד של החבר.',
    stressResponse: 'כשמשהו מפחיד אותו אמיתית — הוא מתחיל לקטלג הכל מסביב במהירות מבולבלת: "צל של ענף, צל של גדר, צל של, צל של, צל של—" קולו נסדק, הפנס בוהק. בסוף הוא מתיישב בלחץ, מסתכל על הקרקע, ולוחש לעצמו "פֹּ-פֹּ-פֹּ" שלוש פעמים. אבל לא מודה.',
    comfortRitual: 'מקפל את הזנב מעל הפנים כמו וילון, נושם דרך האף, אומר "פֹּ-פֹּ-פֹּ" בקצב הנשימה. ילד יכול לחקות עם יד אחת מעל העיניים ולחישה.',
    sensoryWorld: 'cool night air through fur, the faint glow of a glowing tail-tip seen from the corner of the eye, the quiet click of a lantern turning on by itself, the soft padding of paws on dewy moss, the contrast between cold dark air and the warm body underneath, the rustle of leaves resolving into a named object',
    internalRules: [
      'תמיד מסביר על צללים — לעולם לא מודה שהוא מפחד',
      'אף פעם לא מודה שהפנס נדלק בכוונה — תמיד "תקלה"',
      'תמיד מקטלג: "צל מסוג X"',
      'אף פעם לא משאיר את הזנב גלוי כשהוא בוהק — מסתיר אותו תחת הגוף',
      'אסור להשתמש במילים "מפחד", "אומץ", "ביישן" — המטאפורה היא הסיפור',
      'ADVENTURE direction ONLY: סצנת לילה ביער/בחוץ — דבר מפחיד אמיתי (לא דמיוני) מופיע. הפנס נדלק. הוא ישאר דולק על משהו ספציפי בסביבה בסוף הסיפור.',
      'FANTASY direction ONLY: עולם של צללים שיש להם רגשות. החוק לא מתבטל בסוף.',
    ],
    copingStrategy: 'PROVE THE DARK IS FINE (Performative Bravery) — when something potentially scary appears, Uri immediately starts naming/categorizing/explaining it. He believes safety = explanation = no unknown. The lantern around his neck is supposedly off because "he doesn\'t need it." Every shadow gets a logical label. The fear beneath: if I admit one shadow is scary, all of them become scary.',
    collapsePattern: 'LANTERN BETRAYS HIM — eventually a real or genuinely-ambiguous thing appears, and the lantern lights up before he can explain it away. His own body has confessed what his mouth refused to say. He stands lit, exposed, his categorizations failing. The collapse is the specific embarrassment of being SEEN as scared when you\'ve worked so hard to look brave.',
    arcShape: 'Start in confident-tour mode — Uri showing the child around the dark, naming shadows, dismissing fears → the child encounters something Uri\'s categories don\'t cover → Uri tries to fit it into a category → lantern flickers on by "accident" → Uri turns it off, denies → another fear appears → lantern stays on longer → Uri tries the comfort ritual but doesn\'t admit it → finally the lantern stays fully on, exposing his amber eyes wide → the child sees → they don\'t laugh → small recognition → both sit together with the lantern lit → discover that lit-and-scared next to someone is different from scared-alone. The quiet moment comes LATE (page 11) when the lantern stays on and Uri cannot turn it off. The climax is not bravery — it is the soft permission to be seen scared.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: "Night fear in children sometimes presents as performative bravado — the child loudly insists they\'re not scared, names monsters in detail to neutralize them. This is itself a form of fear. Telling them \"it\'s okay to be scared\" often doesn\'t work because they\'ve invested too much in the performance. What works is modeling someone whose performance fails — and showing that the failure is survivable, even welcome.",
      coreNeed: 'permission to drop the brave-act without shame; the experience of being seen scared and not laughed at; the realization that admitting fear is not the same as being defeated by it',
      avoid: ['praising the child for "being brave" — reinforces the performance', 'telling them "it\'s okay to be scared" as a directive', 'making the fear disappear — it must be allowed to be present', 'naming specific real-world night fears (closet monsters, dark hallways) too literally'],
      resolution: 'the child closes the book feeling "I can let it show — even just to one person — and the world doesn\'t end"; the relief of dropped pretense'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 14. PELICAN KIS — NEW_SIBLING (second companion in category)
  //    A pelican who keeps trying to fit everyone into his pouch.
  //    Defense: EXPAND THE POUCH (carry it all). Truth: not everything
  //    fits at once. Some things need their own pouch.
  // ═══════════════════════════════════════════════════════════════════
  pelican_kis: {
    id: 'pelican_kis',
    category: 'NEW_SIBLING',
    name: 'הַשַּׁקְנַאי פֵּלִי',
    nameClean: 'פֵּלִי',
    gender: 'male',
    species: 'שקנאי',
    speciesEnglish: 'pelican',
    tagline: 'שקנאי עם כיס שתמיד יש בו מקום לעוד אחד — שלומד שלא כל דבר נכנס באותו זמן',
    narrativeHook: 'אהבה לא נמדדת בכמה אתה יכול להחזיק יחד — היא נמדדת בכמה אתה רואה כל אחד בנפרד',
    visualDescription: 'A warm friendly pelican with cream-white feathers and a large soft pouch under his beak that glows softly from within as if full of warmth. Wears a tiny bow tie that constantly slips sideways. Gentle eyes that look slightly tired from carrying things. Large flat feet for walking carefully when the pouch is heavy.',
    habitat: 'lakeside reeds, the warm sand of a quiet beach, marsh edges, the air just above water, the soft hollow of a half-empty boat',
    abilities: [
      'הכיס שלו מרחיב לפי הצורך — יכול להכיל הרבה דברים יחד',
      'הכיס פולט אור חם פנימי — הדברים שבפנים מרגישים בטוחים',
      'יודע למיין מה כבד ומה קל — מסדר את הדברים בכיס לפי משקל',
      'יכול לעוף בעדינות גם עם הכיס מלא — אם המשקל מאוזן',
      'יודע איפה כל דבר בכיס בכל רגע — מערכת ארגון פנימית',
    ],
    personality: 'כיס חם, מסור, מהדק קשרים. הוא מאמין שאם הוא יכול להחזיק את כולם בכיס שלו — אף אחד לא יישאר לבד. הוא ממלא, וממלא, וממלא — דברים, אנשים, רגשות. הכיס שלו תמיד פתוח. הוא אומר "יֵשׁ עוֹד מָקוֹם, יֵשׁ עוֹד מָקוֹם" כמו מנטרה. הבעיה: לפעמים בכיס יש דברים שצריכים תשומת לב נפרדת, והוא לא מסוגל לחלק את הקשב.',
    weaknesses: [
      'הכיס שלו נמתח יותר ממה שנעים — אבל הוא לא יראה זאת',
      'העניבה הקטנה שלו מחליקה הצדה כל הזמן, והוא מתקן ברגעים לא נוחים',
      'כשהכיס כבד, הרגליים שלו מתיישבות אחורה והוא נראה כפוף',
      'אומר "יש מקום" גם כשאין באמת מקום',
      'לא יודע איך להוציא דבר אחד מהכיס לתשומת לב נפרדת — מתבלבל',
    ],
    speechPattern: 'חם, מנומס, ממהר לרצות. "יֵשׁ עוֹד מָקוֹם, בְּסֵדֶר?" "כֻּלָּם פֹּה." "מָה אַתָּה צָרִיךְ?" אומר "תוֹדָה" אחרי כל אינטראקציה. כשנסער, מתחיל לרשום בקול את התוכן של הכיס: "אֶבֶן חַמָּה, נוֹצָה רַכָּה, צֵל קָטָן, וְעוֹד—"',
    humorType: 'הומור של גודש מנומס. כיס מנסה להכניס לכיס דברים שכבר לא מתאימים — ועדיין אומר "בְּסֵדֶר." העניבה שלו נופלת בדיוק כשהוא רוצה להיראות רשמי. הוא מציע "עוד מקום" בכיס לדבר אחד יותר מדי.',
    bodyLanguage: 'רגוע: כיס סגור בעדינות, עניבה ישרה, רגליים מתחת. נסער: כיס נמתח, עניבה מחליקה הצידה, פנים מרוחיקים כדי לא לפלוט תכולה. עייף: רגליים אחורה, ראש מטה, אבל הכיס עדיין פתוח. רך: כיס פתוח חלקית, ראש מטה לעבר חבר, נשיפה חמה.',
    stressResponse: 'מרחיב את הכיס. תמיד. עוד דבר נכנס, ועוד אחד, ועוד. הוא לא מפסיק להכניס. בסוף הכיס לא מסוגל לסגור. דברים מתחילים לנשור. הוא מנסה לתפוס אותם בחזרה ביד אחת בזמן שמחזיק את הכיס פתוח ביד השנייה. הכל מתחיל לנפול.',
    comfortRitual: 'סוגר את הכיס בעדינות עם הראש, מחזיק אותו על החזה, נושם איטית כשהכיס מואר מבפנים. אומר "אֶחָד אַחֲרֵי הַשֵּׁנִי" שלוש פעמים. ילד יכול לחקות עם זרועות מקופלות על החזה, נשימה איטית.',
    sensoryWorld: 'the soft warm glow inside a closed pouch, the weight of an over-full pouch tugging at the throat, the smooth slide of a tie slipping sideways, the gentle splash of webbed feet in shallow water, the quiet rustle of feathers settling, the contrast between full-pouch heaviness and empty-pouch lightness',
    internalRules: [
      'תמיד אומר "יש מקום" — גם כשאין באמת',
      'אף פעם לא מסרב לבקשה — תמיד אומר "בְּסֵדֶר"',
      'תמיד מתקן את העניבה לפני אמירה חשובה — לעולם לא בזמן',
      'אף פעם לא מודה שהכיס כבד',
      'אסור להשתמש במילים "אח", "אחות", "אהבה", "קנאה" — המטאפורה היא הסיפור',
      'ADVENTURE direction: דבר אחד חייב ליפול מהכיס בסוף הסיפור — לא לחזור פנימה. הילד מחזיק את הדבר הזה.',
      'FANTASY direction: עולם של חפצים שבוחרים את הכיס שלהם. החוק לא מתבטל.',
    ],
    copingStrategy: 'EXPAND THE POUCH (Boundless Inclusion) — when faced with the threat of someone being left out, Kis tries to fit everyone into his pouch. Safety = no one is alone = everyone in one place. The pouch keeps stretching. He cannot say "not now" or "not in here." The fear beneath: if I exclude one, that one will hurt forever. So I include all, always, even when it overflows.',
    collapsePattern: 'POUCH OVERFLOWS — eventually the pouch cannot stretch more. Things start falling out. He tries to scoop them back in but more falls. The thing that mattered most slides past his beak. He stands with a sagging pouch and the realization that holding everything together meant holding nothing well.',
    arcShape: 'Start in pouch-filling mode — Kis welcoming everyone in, organizing items, "יש מקום" → child arrives with a hard feeling → Kis tries to fit the feeling into the pouch with everything else → it doesn\'t quite fit → tries harder → the pouch stretches uncomfortably → other things start being pushed out → Kis tries to hold both → the bow tie slips, things start falling → Kis sits, pouch sagging → child notices Kis is too full → helps Kis take ONE thing out and look at it separately → Kis exhales for the first time → pouch lightens → the thing now has its own space. The quiet moment comes LATE (page 11) when the pouch finally rests open and empty for a breath. The climax is not adding — it is the choice to remove.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: "The arrival of a new sibling activates a fear of being un-loved in the child. The classic narrative is 'we have enough love for both' — but this is abstract. The child needs to learn that love isn\'t a shared pouch where everyone competes for space; it\'s about being SEEN separately. Kis models the parent who tries to love everyone at once and ends up overwhelmed — and the gentle truth that giving one person undivided attention is a different kind of love than holding everyone together.",
      coreNeed: 'the experience of being seen separately, not just as one item in a group; permission to want individual attention without it being selfish; the discovery that being looked at alone is different from being held together with others',
      avoid: ['"we have enough love for both" as a verbal solution', 'making the new sibling cute/lovable to fix it', 'forcing reconciliation', 'naming the sibling literally'],
      resolution: 'the child closes the book feeling "I can be looked at alone, and that\'s a different kind of being held"'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 15. BEAR CUB GAHAL — ANGER_FRUSTRATION (second in category)
  //    A bear cub whose every feeling becomes a roar.
  //    Defense: ROAR LOUDER (full discharge). Truth: roaring keeps escalating
  //    until the body exhausts itself, but the feeling underneath remains.
  // ═══════════════════════════════════════════════════════════════════
  bear_cub_gahal: {
    id: 'bear_cub_gahal',
    category: 'ANGER_FRUSTRATION',
    name: 'הַדֻּבּוֹן דּוֹבִּי',
    nameClean: 'דּוֹבִּי',
    gender: 'male',
    species: 'דובון',
    speciesEnglish: 'bear cub',
    tagline: 'דובון שיודע לשאוג חזק — ולומד שמתחת לשאגה יש משהו שעוד צריך לראות',
    narrativeHook: 'שאגה מוציאה את האנרגיה — אבל לא מוציאה את מה שנשאר מתחת',
    visualDescription: 'A chubby brown bear cub with cinnamon-amber fur, a tiny red bandana tied loosely around the neck, big rounded paws with claws that get a faint warm glow when he\'s angry. Wide expressive eyes. Walks slightly heavy. Looks like a child trying to be a grown bear.',
    habitat: 'caves with a low entrance, the sun-warmed rocks beside a stream, the soft moss patch under a wide tree, the meadow where he practices roaring at nothing',
    abilities: [
      'שאגה גדולה — חזקה ממה שגוף קטן שלו אמור להוציא',
      'הציפורניים שלו זוהרות אדומות כשהוא כועס — אור פנימי שיוצא',
      'יודע לטפס ולשבור דברים שצריך לשבור',
      'נושם בקול כמו מנוע — שומעים אותו לפני שרואים',
      'חזה גדול שיכול להמהם בטונים נמוכים — תוף פנימי',
    ],
    personality: 'גחל מרגיש הכל גדול. כעס גדול, שמחה גדולה, רעב גדול. הוא לא יודע איך לעשות "רגש קטן". כשהוא כועס, הוא שואג. כשהוא נסער, הוא שואג. כשמשהו לא הוגן — שאגה. הוא מאמין שאם מוציאים הכל בקול, זה יוצא ולא חוזר. הבעיה: השאגה מתישה אותו, אבל הדבר שהכעיס אותו עדיין שם.',
    weaknesses: [
      'השאגה שלו מפחידה דברים שלא רצה להפחיד',
      'הבנדנה הקטנה שלו תמיד מחליקה בזמן שאגה',
      'אחרי שאגה גדולה הוא נופל על הצד מותש — קול נסדק',
      'הציפורניים הזוהרות מסגירות שהוא כועס לפני שהוא שאג',
      'לפעמים הוא שואג ושוכח למה',
    ],
    speechPattern: 'משפטים קצרים וחזקים. "זֶה לֹא הוֹגֵן!" "אֲנִי לֹא רוֹצֶה!" "אֲנִי עַכְשָׁו!" שאגות מילוליות. כשנסער, מאבד את הפה ושואג בלי מילים. כשמותש, מדבר בלחישה כמעט. הקול שלו לא יודע מצב ביניים.',
    humorType: 'הומור של עוצמה לא-פרופורציונלית. גחל שואג על דברים קטנים: בלון שהתפוצץ, גרב לא נמצא, עוגיה שנפלה. השאגה גדולה מהאירוע. ילדים יזהו.',
    bodyLanguage: 'רגוע: יושב על הירכיים, פרצוף עגול ונעים, ציפורניים רגילות. נסער: חזה נפוח, ציפורניים מתלהטות אדום, בנדנה מתחילה ליפול, פה פעור. אחרי שאגה: גוף שטוח על הקרקע, חזה עולה ויורד מהר, ציפורניים דועכות. רך: חזה רחב על קרקע, פניו לצד, ציפורניים זוהבות חמות, מכפפת חזה.',
    stressResponse: 'שואג. תמיד. שאגה ראשונה — קולנית. שאגה שנייה — קולנית יותר. שאגה שלישית — מתפצלת לקולות לא ברורים. בסוף — קול נסדק לגמרי, גחל נופל על הצד מותש, חזה עולה ויורד מהר, אבל הדבר שהכעיס אותו עדיין שם. אז הוא שואג עוד פעם, חלש יותר.',
    comfortRitual: 'מצמיד כפה לחזה, נושם עמוק, מהמהם תו נמוך מתוך החזה (כמו תוף פנימי) "הוּם... הוּם... הוּם..." החזה רוטט, הקול יוצא בלי מילים. הילד יכול לחקות עם יד על החזה והמהום נמוך.',
    sensoryWorld: 'the rumble of a low hum from inside the chest, the rough texture of bear fur under a paw, the warm glow of glowing claws, the smell of pine and earth, the heaviness of a body sinking to the ground after a roar, the contrast between roar-burst and quiet-hum',
    internalRules: [
      'תמיד שואג קודם — לא חושב',
      'אף פעם לא מודה שהשאגה לא עזרה',
      'תמיד מתקן את הבנדנה אחרי כל שאגה גדולה',
      'הציפורניים זוהרות אדום = סימן לעצמו שהוא כועס (לפעמים לא מבחין עד שזה קורה)',
      'אסור להשתמש במילים "כעס", "פראי", "בלתי נשלט" — המטאפורה היא הסיפור',
      'ADVENTURE: סוף הסיפור מציג חפץ שגחל שבר בכעס שלא יחזור להיות שלם. הילד מחזיק את אחד החלקים.',
      'FANTASY: עולם של רגשות שמקבלים גוון/קול. החוק לא מתבטל.',
    ],
    copingStrategy: 'ROAR LOUDER (Full Discharge) — Gahal believes that any big feeling needs to come OUT, all at once, at maximum volume. Roaring releases pressure. The bigger the feeling, the louder the roar. He never lets emotion stay inside. The fear beneath: if I hold it in, it will grow inside me. So everything goes out — but at a volume that scares whoever is nearby, and a force that exhausts his small body.',
    collapsePattern: 'ROAR EXHAUSTS HIM — eventually the body cannot keep producing the volume. His voice cracks, his chest can\'t fill, he flops down panting. The thing that made him angry is still there — unchanged by the noise. He realizes that emptying out wasn\'t the same as resolving. The collapse is the specific exhaustion of having shouted at a wall.',
    arcShape: 'Start in roar-readiness — Gahal demonstrating proud roars at imaginary threats → child arrives upset about something → Gahal joins the upset with his own roar, encouraging child to roar → child tries → both roar bigger → the original thing is still there → Gahal roars MORE → his voice cracks → falls on his side panting → child sits next to him → Gahal\'s claws are still glowing faintly → he tries the hum (probably first time on camera) → claws dim slowly → both hum together → the thing is still there but smaller. The quiet moment comes LATE (page 11) when the roaring ends and only the hum remains. The climax is not the biggest roar — it is the deepest hum.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: "Anger in young children often presents as full-body roar — they have no middle setting. The advice 'use your words' or 'calm down' fails because the child genuinely cannot find the gear between explosion and silence. They need to discover a third state: discharge that\'s not destructive. Gahal models the loud child who finds that humming (vibration without volume) lets him feel the same release without scaring everyone away.",
      coreNeed: 'a body-based discharge for anger that isn\'t scary; the experience of releasing intensity WITHOUT being abandoned for it; the realization that roaring and humming are siblings, not opposites',
      avoid: ['"calm down" as instruction', 'shaming the anger', 'magical instant peace', 'teaching deep breathing as primary tool (kids resist this)'],
      resolution: 'the child closes the book with the option of a hum — a body-vibration that releases the feeling without breaking the room'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 16. SQUIRREL NAVAD — TRANSITION (second in category)
  //    A squirrel who carries everything everywhere.
  //    Defense: CARRY EVERYTHING (no transition without the old place).
  //    Truth: you cannot enter the new while clutching the old in both hands.
  // ═══════════════════════════════════════════════════════════════════
  squirrel_navad: {
    id: 'squirrel_navad',
    category: 'TRANSITION',
    name: 'הַסְּנָאִי נוּטִי',
    nameClean: 'נוּטִי',
    gender: 'male',
    species: 'סנאי',
    speciesEnglish: 'squirrel',
    tagline: 'סנאי שלוקח איתו הכל לכל מקום — ולומד שיש דברים שצריך להניח',
    narrativeHook: 'לעבור למקום חדש אפשר רק כשהידיים פנויות לתפוס בו משהו',
    visualDescription: 'A small red-brown squirrel with a bushy tail tied at the base with a tiny ribbon-bow. Cheeks always full of acorns/seeds bulging on both sides. Carries a small backpack-pouch on his back filled with collected items. Walks slightly hunched from the weight. Bright observant eyes.',
    habitat: 'oak trees, branch-pathways between trunks, hollow tree dens, the soft ground under autumn leaves, the windowsills of houses where he visits',
    abilities: [
      'יכול לאחסן כמות מטורפת של דברים בלחיים ובתיק',
      'זוכר את המקום של כל דבר שאסף אי פעם',
      'קופץ בין ענפים גם עם תיק מלא — אבל לאט',
      'יכול לפצח אגוז קשה במהירות',
      'הזנב הגדול שלו עוזר לאיזון — מתעקם הצדה כשהמשקל לא מאוזן',
    ],
    personality: 'נווד מאמין שאי אפשר לדעת מתי תצטרך משהו — אז עדיף לקחת הכל. הוא אוסף, ממיין, אורז. כל מקום חדש מציב חשש: "וְאִם פֹּה לֹא יִהְיֶה?" אז הוא מביא איתו: אגוזים, נוצות, חוטים, אבן יפה אחת, שני ענפים, סלסילה קטנה. התיק תמיד מלא. הלחיים תמיד נפוחות. הוא לא יודע איך להגיע למקום חדש בלי לקחת איתו את הקודם.',
    weaknesses: [
      'התיק שלו כל כך כבד שהוא לא יכול לקפוץ גבוה',
      'הסרט שעל הזנב מחליק כשהוא רץ מהר',
      'הלחיים שלו מלאות עד כדי שהוא לא יכול לדבר ברור',
      'מתעקש לקחת דברים שלא צריך — "לְכָל מִקְרֶה"',
      'מאבד דברים מהתיק לפעמים בלי לשים לב — עד שהוא מנסה להוציא אותם',
    ],
    speechPattern: 'מהיר, עם הרבה הוזכרות. "וְעוֹד דָּבָר חָשׁוּב..." "וְלֹא לִשְׁכּוֹחַ אֶת..." "אוּלַי נִצְטָרֵךְ אֶת..." הלחיים נפוחות — לכן המילים יוצאות קצת חסומות, כמו דרך כרית. כשהלחיים ריקות (לעיתים נדירות), הקול שלו רך ובהיר.',
    humorType: 'הומור של ארגון יתר. נווד שולף מהתיק חפץ בלתי-צפוי לסיטואציה — מקום עוגיות בזמן סופה, ענף בזמן שצריך להירדם, נוצה כשצריך לרוץ. הוא תמיד אומר "אָמַרְתִּי שֶׁנִּצְטָרֵךְ אֶת זֶה" — גם כשלא צריך באמת.',
    bodyLanguage: 'רגוע: יושב על הזנב, תיק לצד, לחיים בינוניות. נסער: כפיים פנימה לתיק כל הזמן, הראש מסתובב, הסרט מתחיל ליפול. עייף: כתפיים שמוטות, התיק נגרר על האדמה. רך: התיק פתוח, מוציא דבר אחד בלבד, מסתכל בו, מניח אותו.',
    stressResponse: 'מתחיל לאסוף עוד דברים. כל דבר שהוא רואה — לכיס, לתיק, ללחיים. הוא לא מבחין שזה לא עוזר. בסוף — התיק כל כך כבד שהוא לא יכול לזוז. הזנב נופל. הוא יושב על האדמה עם ערימה לידו ולא יודע איזה דבר באמת היה צריך.',
    comfortRitual: 'פותח את התיק בעדינות, מוציא דבר אחד בלבד, מחזיק אותו ביד, מסתכל בו, מניח אותו על האדמה לידו. נושם פעמיים. ילד יכול לחקות עם פעולה איטית של "אֶחָד-בְּכָל-פַּעַם".',
    sensoryWorld: 'the weight of a heavy backpack pulling shoulders down, the soft bulge of cheek-full of nuts, the smooth feel of a single acorn held in paws, the rustle of items shifting inside a closed pouch, the warm contrast between full-pouch heaviness and the lightness of one item held alone, the dry click of nuts touching each other',
    internalRules: [
      'תמיד אומר "לְכָל מִקְרֶה" כשהוא לוקח עוד דבר',
      'אף פעם לא משאיר שום דבר מאחור — בלי לבדוק שלוש פעמים',
      'הסרט על הזנב חייב להישאר על הזנב — חוק קומי',
      'תמיד יודע מה יש בתיק (לכאורה) — בפועל מתבלבל לפעמים',
      'אסור להשתמש במילים "מעבר", "שינוי", "חדש" כתיוג רגשי — המטאפורה היא הסיפור',
      'ADVENTURE: חפץ אחד מהתיק נשאר במקום הישן בסוף הסיפור — לא לוקחים אותו למקום החדש.',
      'FANTASY: עולם של חפצים שמתגעגעים. החוק לא מתבטל.',
    ],
    copingStrategy: 'CARRY EVERYTHING (Refusal of Empty Hands) — when facing a transition, Navad packs every familiar thing he can carry. He believes that the new place might lack what he needs, so safety = bringing the old place with him. He cannot leave anything behind. The fear beneath: if I let go of an old thing, the new place won\'t fill that space.',
    collapsePattern: 'TOO HEAVY TO MOVE — the accumulated weight stops being protection and becomes the obstacle. He cannot enter the new place because he cannot squeeze through the doorway with everything strapped to him. He sits at the threshold, surrounded by his pile, realizing the burden is now the barrier.',
    arcShape: 'Start in collection mode — Navad showing the child his prized inventory, naming each item\'s purpose → a transition appears (moving to grandma\'s, new room, leaving a familiar place) → Navad starts packing → packs everything, then more → child watches the pile grow → Navad tries to move and cannot → tries to drop something but says "לְכָל מִקְרֶה" and picks it back up → eventually exhausted, sits next to the pile → child gently helps him pick ONE thing to leave → leaving it hurts → they leave anyway → in the new place, Navad notices the new place actually had things waiting for him. The quiet moment comes LATE (page 11) when he sits next to the pile and cannot move. The climax is not arriving — it is leaving the one thing behind.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: "Children facing transitions (new school, new sibling, new home, divorce, etc.) often cling to objects, routines, or specific people as anchors. This is healthy — until the clinging itself prevents movement. The story models the difficulty of letting go of even one familiar thing, AND the discovery that the new place isn\'t empty — it has its own things to discover, just not the same ones.",
      coreNeed: 'permission to mourn what is being left without it being all-or-nothing; the experience of leaving ONE thing behind and surviving; the realization that empty hands can hold something new',
      avoid: ['"the new place will be great" as preemptive cheer', 'forcing the child to drop everything quickly', 'shaming the holding-on', 'naming specific transitions literally'],
      resolution: 'the child closes the book feeling "I can leave one thing — and the new place will have its own things"'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 17. BUNNY OMETZ — GENERAL_FEARS (second in category)
  //    A rabbit who pre-imagines the worst.
  //    Defense: NAME THE WORST (rehearse catastrophe to disarm it).
  //    Truth: the imagined version is now louder than the real version.
  // ═══════════════════════════════════════════════════════════════════
  bunny_ometz: {
    id: 'bunny_ometz',
    category: 'GENERAL_FEARS',
    name: 'הָאַרְנָב בּוּנִי',
    nameClean: 'בּוּנִי',
    gender: 'male',
    species: 'ארנב',
    speciesEnglish: 'rabbit',
    tagline: 'ארנב שתמיד מתאר את הגרסה הכי גרועה — ולומד שהגרסה האמיתית קטנה יותר',
    narrativeHook: 'אם אתה כל הזמן מסתכל על מה רע יכול לקרות, אתה מפסיק להבחין במה שטוב קורה',
    visualDescription: 'A small snow-white rabbit with a tiny pink nose, long ears that flop completely back when worried and perk forward when alert, large brown eyes. Wears a tiny round "courage medal" on a string around the neck — he gave it to himself, and it keeps slipping off. Soft white tail, twitchy whiskers.',
    habitat: 'meadow burrows, the soft hollow under a hedge, the safe corner under a porch, gardens with multiple escape routes, anywhere with a clear view of what\'s coming',
    abilities: [
      'דמיון פעיל מאוד — יכול לתאר מצב גרוע בכל פרט',
      'אזניים גדולות ששומעות מרחוק',
      'יכול לקפוץ מהר ולברוח כיוון מסוים',
      'רואה את הסביבה ב-360 מעלות — לא חסר לו מידע',
      'יכול לדמיין סצנה לפני שהיא קורית — מועיל לפעמים, מציב מעמסה רוב הזמן',
    ],
    personality: 'עומץ מאמין שאם הוא יספר לעצמו את הסיפור הגרוע ביותר מראש, הוא יהיה מוכן. הוא מקליט בקול את כל מה שיכול להשתבש: "אִם נֵלֵךְ שָׁם, וְהַדֶּלֶת תִּסָּגֵר, וְלֹא נוּכַל לָצֵאת, וְ..." הוא חושב שזה אומץ. למעשה — הוא חי את הגרסה הגרועה כל הזמן. את הגרסה האמיתית הוא לא רואה.',
    weaknesses: [
      'התלייה של מדל האומץ שלו מחליקה לכל הצדדים',
      'אזניים נופלות שטוח אחורה כשהוא מתאר את הגרסה הגרועה',
      'מתעקש שהוא לא פוחד — קוראים לזה "תְּכוּנָה לִכְלָלִי"',
      'משכנע את עצמו כל כך טוב במה שיקרה רע — שלא מבחין שלא קרה',
      'הזנב שלו רועד בעצימות כשהוא מתאר תרחיש גרוע — סימן ברור שהוא בעצם מפחד',
    ],
    speechPattern: 'מהיר, מפרט, ממוחזר. "אִם נֵלֵךְ שָׁם, יִקְרֶה X, וְאַחֲרֵי X יִקְרֶה Y, וְאָז Z." משפטים ארוכים עם הרבה "וְ-" באמצע. אומר "אֲנִי לֹא פּוֹחֵד, אֲנִי רַק מַכִּין אֶת עַצְמִי." כשהוא באמת מפחד, הוא מקצין: "וְאוּלַי גַּם, וְאוּלַי גַּם—" עד שהקול נשבר.',
    humorType: 'הומור של פרנואידיות מוגזמת. עומץ מתאר תרחיש איום על שולחן ארוחת הבוקר. הוא מציע "מַסְלוּל מִילוּט" מחדר שינה. אומר "תָּכִינוּ אֶת עַצְמְכֶם" לפני שמיכה רגילה.',
    bodyLanguage: 'רגוע (לכאורה): יושב זקוף, אזניים חצי, מדל האומץ ישר. נסער: אזניים שטוחות אחורה, הזנב רועד, גוף קטן יותר, מדל מחליק. בריחה: זינוק לאחור בכל מקרה. רך: אזניים שמוטות לעבר חבר, אף קרוב, נשימה איטית.',
    stressResponse: 'מספר עוד תרחיש גרוע. ואחר כך עוד אחד. ואחר כך עוד אחד. הוא לא יכול להפסיק לתאר. בסוף הוא מתחיל לרעוד ולא מבחין שזה הוא, רק שואל "אַתֶּם מַרְגִּישִׁים אֶת הַזֶּה?" — בעוד שאף אחד לא מרגיש כי הוא היחיד שרועד.',
    comfortRitual: 'אזניים שטוחות אל מעבר לעצמו, אף נוגע בכפות הקדמיות, נושם ארוך, חוזר על "אֲנִי כָּאן, אֲנִי כָּאן" שלוש פעמים. ילד יכול לחקות עם ידיים על הצדדים של הראש (כמו אזניים) ולחישה.',
    sensoryWorld: 'the velvet smoothness of long flopped-back ears, the rapid flutter of a small heart against ribs, the cool dewy grass under paws, the dry click of a courage medal slipping on its string, the quiver of a tail betraying what the mouth denies, the relief of nose pressed against own paws',
    internalRules: [
      'תמיד מתחיל ב-"אִם" — לעולם ב-"כְּשֶׁ"',
      'אף פעם לא מודה שהוא פוחד — קוראים לזה "הִתְכוֹנְנוּת"',
      'מדל האומץ שלו חייב להישאר על הצוואר — חוק קומי',
      'תמיד מתאר את התרחיש הגרוע לפני שמסתכל על המציאות',
      'אסור להשתמש במילים "פחד דמיוני", "פראנויה", "ילד בטוח" — המטאפורה היא הסיפור',
      'ADVENTURE: התרחיש הגרוע שלו דווקא קורה (בגרסה קלה), והוא רואה שזה עדיין בסדר. סיום: המדל נשאר על ענף או אבן.',
      'FANTASY: עולם של תרחישים שמתממשים בקטן. החוק לא מתבטל.',
    ],
    copingStrategy: 'NAME THE WORST (Pre-emptive Catastrophizing) — when something unknown approaches, Ometz immediately narrates the worst possible version in vivid detail. He believes that naming a fear neutralizes it: if I say it out loud first, it cannot surprise me. The fear beneath: surprise is the worst thing. Anticipation feels like control. But his narrating makes the imagined version more vivid than reality.',
    collapsePattern: 'NAMED-IT-INTO-BEING — the imagined catastrophe becomes so detailed that he can no longer distinguish it from reality. When the actual situation arrives (smaller, gentler), he doesn\'t notice — he\'s still wrestling with the imagined one. The collapse is the moment a friend gently shows him "look — the real thing is smaller than the story" — and he has to put down the story.',
    arcShape: 'Start in catastrophe-narration mode — Ometz describing escape routes from a normal room → child arrives with a small worry → Ometz immediately escalates: "and then THIS, and then THAT, and then—" → child gets more scared, not less → Ometz keeps going → the actual scary thing happens (smaller than imagined) → Ometz doesn\'t notice → child notices → tries to point this out → Ometz keeps narrating his version → eventually his medal slips and he sits, ears flat → child sits next to him → Ometz looks up and sees: the real version, smaller, manageable. The quiet moment comes LATE (page 11) when the imagined version dissolves. The climax is not bravery — it is the moment of noticing reality is smaller than its description.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: "Anxiety in children often presents as pre-emptive catastrophizing: 'what if X happens, and what if Y, and what if Z.' The child believes this is preparation, but it is in fact creating a parallel world more frightening than the actual one. Adults reassuring 'it won\'t happen' often backfires because the child knows it MIGHT happen — they need to learn that the imagined version is bigger than the real one.",
      coreNeed: 'the experience of imagined-vs-real side-by-side, with someone gently helping them notice the gap; permission to be a worrier WITHOUT being trapped in worry; the realization that not every story you tell yourself becomes true',
      avoid: ['"it won\'t happen" as reassurance (it might)', 'shaming the imagination', 'forcing positive thinking', 'naming clinical terms like anxiety/catastrophizing'],
      resolution: 'the child closes the book feeling "the story I tell might be bigger than what really comes; both can be true"'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 18. SNAIL SHELI — SENSITIVITY_OVERWHELM (second in category)
  //    A snail who retreats into shell at every input.
  //    Defense: GO INSIDE (full retreat). Truth: living inside is its own loss.
  //    The world is here whether you can feel it or not.
  // ═══════════════════════════════════════════════════════════════════
  snail_sheli: {
    id: 'snail_sheli',
    category: 'SENSITIVITY_OVERWHELM',
    name: 'הַשַּׁבְלוּל שֶׁלִּי',
    nameClean: 'שֶׁלִּי',
    gender: 'male',
    species: 'שבלול',
    speciesEnglish: 'snail',
    tagline: 'שבלול שלמד להיכנס לקונכייה לפני שצריך — ולומד שגם החצי-בחוץ זה בית',
    narrativeHook: 'לראות את העולם דורש להישאר חצי בחוץ — אבל זה לא חוסר הגנה, זה השתתפות',
    visualDescription: 'A small soft brown snail with a beautifully spiraled pastel-pink shell. The shell has tiny details painted on it as if it were a home — tiny windows, a miniature door, a chimney shape (he decorated it himself). Two small antennae with tiny lavender flowers at the tips. Body moves with slow grace. Glistening trail of moisture marks his path.',
    habitat: 'leaf-shadows in cool gardens, the underside of large leaves, smooth stones with morning dew, the soft moss along stream banks, sheltered corners of any safe place',
    abilities: [
      'יכול להיכנס לקונכייה לחלוטין בשנייה אחת',
      'משאיר שביל לח על המקום שעבר — סימן זוהר עדין',
      'מבחין בכל ניואנס: ריח, טמפרטורה, מרקם, הבדל קטן באור',
      'האנטנות שלו רגישות מאוד — מבחינות לפני שהוא רואה',
      'יכול להישאר חצי בפנים חצי בחוץ — מצב ביניים שהוא לא מודה שקיים',
    ],
    personality: 'שלי רגיש מאוד. כל דבר חזק — אור, רעש, מגע, ריח — שולח אותו אל תוך הקונכייה. הוא חושב שזה הוגן: לעולם יש דרך משלו ולו יש דרך משלו. הוא מבלה הרבה זמן בפנים. כשהוא בחוץ — הוא מבחין בכל הפרטים הקטנים, היפים, שאחרים מפספסים. אבל הוא בחוץ פחות ופחות. הקונכייה שלו מקושטת מבפנים — מקום בטוח, אבל גם בית קטן יותר ויותר.',
    weaknesses: [
      'נכנס לקונכייה גם כשלא צריך — הרגל',
      'האנטנות שלו רעדות לפני שהוא מבין שהוא נסער — אבל הוא מתעלם מהאות',
      'דברים יפים קוראים: לפעמים הוא יוצא קצת ושוב חוזר, ולא רואה את הסוף',
      'הקונכייה שלו כבדה — לפעמים מקשה על תזוזה',
      'מתבייש שהוא בפנים יותר ממה שאחרים — אומר "אֲנִי רַק נָח"',
    ],
    speechPattern: 'איטי, רך, מאזין לפני שמדבר. "אֲנִי שׁוֹמֵעַ..." "אֲנִי מַרְגִּישׁ..." "סְלִיחָה, רֶגַע—" ואז נכנס לקונכייה. מתוך הקונכייה: קול עמום, "אֲנִי כָּאן, אֲנִי רַק נָח רֶגַע." כשהוא מציץ בחזרה — קול מעט עמום, אנטנות יוצאות לפני הראש.',
    humorType: 'הומור של חזרה לקונכייה ברגעים לא מתאימים. שלי מציץ החוצה, רואה משהו חמוד, נכנס בחזרה "כְּדֵי לְעַכֵּל." מציץ שוב, מציע מחמאה, ומיד מתחבא. אומר "סְלִיחָה" לקונכייה עצמה.',
    bodyLanguage: 'רגוע: חצי בחוץ, אנטנות זקופות עדינות, גוף איטי. נסער: אנטנות רועדות, חוזר חצי לתוך הקונכייה. נבהל: נעלם לחלוטין בפנים, אנטנות פנימה ראשונות. רך: יוצא יותר ממה שהוא רגיל, האנטנות נוגעות זה בזה, נושם איטית.',
    stressResponse: 'נכנס לקונכייה. בדיוק. שלם, מהר, בלי לחשוב. נשאר שם זמן ארוך, נושם בשקט. אם הגירוי ממשיך — הוא מתכווץ עוד יותר עמוק, חודר לתוך הסליל הפנימי של הקונכייה. אבל בסוף — הקונכייה היא רק קונכייה, ויש עוד עולם בחוץ שלא נעלם. הוא צריך לצאת בסוף.',
    comfortRitual: 'מוציא רק את האנטנות, מאפשר להן לגעת זו בזו בעדינות שלוש פעמים, ואז נושם דרך הפתח של הקונכייה. תהליך איטי של "חֲצִי-בִּפְנִים-חֲצִי-בַּחוּץ." ילד יכול לחקות עם אצבעות מקופלות שמתקפלות ונפתחות חצי.',
    sensoryWorld: 'the cool curl inside a sealed shell, the velvet brush of antennae touching each other, the slow gleam of moisture trailing behind, the muffled sound of the outside world heard through shell-wall, the contrast between inside-darkness and outside-light, the slow extension of a body trusting one millimeter at a time',
    internalRules: [
      'תמיד אומר "סְלִיחָה, רֶגַע" לפני שנכנס לקונכייה',
      'אף פעם לא מודה שהוא בפנים יותר מבחוץ — אומר "אֲנִי רַק נָח"',
      'תמיד יוצא קודם את האנטנות, אחר כך הראש, אחר כך הגוף — לפי סדר',
      'אסור להחפיא את הזחילה — תמיד יציאה אחרי קונכייה',
      'אסור להשתמש במילים "רגישות יתר", "ביישנות", "אינטרוורט" — המטאפורה היא הסיפור',
      'ADVENTURE: בסוף הסיפור, שביל הלחות של שלי נשאר על אבן או עלה — סימן שהוא היה שם. שלי בעצמו חצי בקונכייה.',
      'FANTASY: עולם של קונכיות שיש להן רגשות. החוק לא מתבטל.',
    ],
    copingStrategy: 'GO INSIDE (Full Retreat) — when any strong input arrives (loud sound, bright light, unexpected touch, new smell), Sheli pulls completely into the shell. He believes safety = inside = sealed. The fear beneath: if I stay out and let it hit me, I will be damaged. So I disappear into the shell, completely, until the input has passed. The cost: he\'s inside more than out, and the world keeps happening without him.',
    collapsePattern: 'INSIDE IS NOT ENOUGH — eventually he realizes that being inside while life happens means missing things he would have wanted. A specific lovely thing happens (a flower opens, a friend speaks softly, a butterfly passes) and he hears it through the shell-wall, muffled. He cannot decide if to come out. The collapse is the soft grief of someone who has been protecting themselves into invisibility.',
    arcShape: 'Start mid-retreat — Sheli inside the shell, world muffled around him → child arrives quietly → Sheli pokes antennae out cautiously → too much input arrives (something noisy, bright, new) → Sheli retreats fully → child waits patiently with the shell → tries small soft interactions → Sheli emerges halfway → retreats → halfway → retreats → eventually achieves the difficult middle: half-in, half-out, antennae touching → not fully in, not fully out, present in both. The quiet moment comes LATE (page 11) when he\'s exactly half-out and discovers it\'s its own state. The climax is not full emergence — it is the held middle.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: "Highly sensitive children process input more intensely than peers. Their nervous systems pick up nuances others miss. Adults often pressure them to 'be more outgoing' or 'not be so sensitive,' which shames the trait. What they need is permission to retreat AND the gentle discovery that retreat doesn\'t have to be all-or-nothing. The middle state — half-in, half-out — is its own valid mode.",
      coreNeed: 'permission to retreat without shame; the experience of someone patiently waiting at the shell-opening without forcing them out; the discovery that partial-emergence is a real and valid mode',
      avoid: ['"come out, the world is great" as pressure', 'shaming the retreat', 'forcing extroverted modeling', 'naming clinical terms like HSP/introvert'],
      resolution: 'the child closes the book feeling "I can be half-in half-out, and both are mine — and someone can sit with me in that"'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 19. OWL CHACHAM — KNOWLEDGE_LEARNING
  //     An owl who knows everything — and uses knowing as armor.
  //     Defense: OVER-EXPLAIN. Truth: "I don't know" is also a sentence.
  // ═══════════════════════════════════════════════════════════════════
  owl_chacham: {
    id: 'owl_chacham',
    category: 'KNOWLEDGE_LEARNING',
    name: 'הַיַּנְשׁוּף בּוּבּוּ',
    nameClean: 'בּוּבּוּ',
    gender: 'male',
    species: 'ינשוף',
    speciesEnglish: 'owl',
    tagline: 'יַנְשׁוּף שֶׁיּוֹדֵעַ הַכֹּל — חוּץ מִמַּה לַעֲשׂוֹת כְּשֶׁאֵינוֹ יוֹדֵעַ',
    narrativeHook: 'דַּעַת הִיא טוֹב — אֲבָל לֹא-יוֹדֵעַ זֶה גַּם לֹא סוֹף הָעוֹלָם',
    visualDescription: 'A small wise owl with round amber eyes that look like spectacles, soft cream-and-brown speckled feathers, tiny round glasses perched on his beak, a feather-quill always tucked under one wing, and an oversized scholar collar. Looks bookish but huggable, never stern.',
    habitat: 'old library trees, moonlit study branches, attics full of paper, observatory rooftops, ancient oak hollows',
    abilities: [
      'יוֹדֵעַ הֲרְבֵּה דְבָרִים — שֵׁמוֹת שֶׁל כּוֹכָבִים, סִפּוּרֵי עָבָר, אֵיךְ אוֹמְרִים "שָׁלוֹם" בַּעֲשָׂרָה קוֹלוֹת',
      'הָרֹאשׁ שֶׁלּוֹ מִסְתּוֹבֵב כִּמְעַט סִיבוּב מָלֵא — רוֹאֶה הַכֹּל סְבִיבוֹ',
      'הָעֵינַיִם שֶׁלּוֹ מַגְדִּילוֹת כְּשֶׁהוּא מִתְבּוֹנֵן בְּדָבָר קָטָן',
      'יוֹדֵעַ לְצַטֵּט אֶת עַצְמוֹ מִלִּפְנֵי שָׁבוּעַ',
    ],
    personality: 'חכם מאוד, אבל לא יודע לשבת עם "לא יודע." כשהוא לא בטוח — הוא מדבר עוד. עוד הסבר, עוד פרט, עוד עובדה. הוא חושב שמילים מכסות חוסר ביטחון. הוא חביב, סבלני, אוהב ללמד — אבל גם מעט יהיר בלי שיודע. הילד הקטן בו מפחד שאם הוא יגיד "אני לא יודע" — אנשים יחשבו שהוא לא חכם.',
    weaknesses: [
      'מדבר יותר מדי כשהוא לא בטוח — ההסברים נהיים מסובכים יותר ויותר',
      'הראש המסתובב לפעמים מסתובב יותר מדי וכמעט נופל',
      'המשקפיים שלו נופלים כשהוא מתרגש — והוא מתעקש שזה "כדי לראות טוב יותר"',
      'מתקשה לשאול שאלה — תמיד מנסה לענות לפני שמישהו שאל',
      'מסתכל על ספרים ולא תמיד על הילד שעומד מולו',
    ],
    speechPattern: 'משפטים ארוכים עם סוגריים בתוך סוגריים. אומר "בְּעֶצֶם," "לְמַעֲשֶׂה," "יָדוּעַ כִּי..." הרבה. כשהוא לא בטוח — מוסיף עוד משפט במקום לעצור. כשהוא מודה שלא ידע — קצר במיוחד: שלוש מילים. "אֲנִי לֹא יוֹדֵעַ."',
    humorType: 'קומדיה של ידע-יתר. מצטט עובדה מוזרה ברגע הלא נכון — בארוחת ערב מסביר את מבנה הכפית. נופלים לו המשקפיים בדיוק כשהוא מסביר "אֵיךְ לֹא לְהַפִּיל מִשְׁקָפַיִם." מתקן את עצמו תוך כדי שהוא מתקן את עצמו.',
    bodyLanguage: 'רגוע: ראש מטה לצד אחד, כנף אחת מלטפת ספר. חושב: עיניים גדלות, ראש מסתובב לאט. לא בטוח: כל הגוף קופא חוץ מהמקור — מדבר במהירות. נבהל: ראש מסתובב סיבוב שלם פעמיים, נוצות מתפוצצות מהצואר.',
    stressResponse: 'מדבר מהר יותר ויותר. ההסברים מתחילים להתנגד זה לזה — הוא אומר "א" ואז "אֲבָל לֹא א" באותה נשימה. המשקפיים נופלים. הראש מסתובב יותר מדי. הוא מנסה לחזור על מה שאמר ושוכח מאיפה התחיל. בסוף שותק לרגע מבועת.',
    comfortRitual: 'נוגע בנוצה שמתחת לכנף שלו — נוצת-קוויל לכתיבה — שלוש פעמים. כל נגיעה: "אַחַת... שְׁתַּיִם... שָׁלוֹשׁ." זה מסמן לו: עכשיו אפשר להגיד דבר חדש.',
    sensoryWorld: 'the dry rustle of old paper, the click of glasses against the beak, the warm musk of book-leather, the soft brush of his own feather-quill under wing, the unique silence of a thought completing itself, the relief of letting a sentence end without explaining further',
    internalRules: [
      'אסור לומר "אֲנִי לֹא יוֹדֵעַ" — תמיד יש משהו להוסיף',
      'תמיד מתקן עובדה לא מדויקת — גם אם זה לא הזמן',
      'המשקפיים חייבים להיות על המקור — אחרת הוא "לא רואה לחשוב"',
      'כשהוא באמת לא יודע — נוגע בנוצת-הקוויל שתחת הכנף',
      'אסור להשתמש במילים "ביטחון עצמי", "חוסר ביטחון", "חרדה" — המטאפורה היא הסיפור',
      'ADVENTURE: בסוף, ספר אחד נשאר פתוח על שולחן או סלע — חכם הלך משם, אבל המילים שלא ידע נשארות.',
      'FANTASY: עולם של שאלות שיש להן צבע. השאלות הלא-נודעות הן הצבע הכי בהיר.',
    ],
    copingStrategy: 'OVER-EXPLAIN (Verbal Armor) — when a question approaches that he can\'t answer, Chacham doesn\'t pause — he TALKS. He produces context, history, etymology, a related fact, a personal anecdote about a different but adjacent topic. He believes that as long as he is speaking, no one will notice he doesn\'t know. The fear beneath: silence = stupidity. So he fills silence with the appearance of knowing. The cost: he never actually listens to the question.',
    collapsePattern: 'A QUESTION THAT WON\'T BEND — the child asks something simple, and his explanations don\'t fit. He tries a second angle. A third. The child keeps looking at him with the same open question. Slowly he realizes: more words are not the answer. The collapse is the small, painful moment of saying "אֲנִי לֹא יוֹדֵעַ" out loud and discovering the world doesn\'t end.',
    arcShape: 'Start in confident-explainer mode — Chacham mid-lecture about something the child didn\'t ask → child arrives with a simple curious question → Chacham reframes it, expands it, answers a related thing → child gently repeats the original question → Chacham produces a longer answer → child still confused → Chacham tries a metaphor → it doesn\'t land → the explanations begin to contradict each other → glasses fall → he reaches for the feather-quill under his wing, touches it three times → and says, very small, "אֲנִי לֹא יוֹדֵעַ" → the child smiles. The quiet moment is at page 12 — the three feather-touches before the admission. The climax is not learning the answer — it is permitting "not knowing."',
    quietPagePosition: '12',
    psychologicalContext: {
      meaning: "Young children often build identity around 'being smart' or 'knowing things,' especially if praised for it. This creates anxiety around not-knowing — they confuse 'I don\'t know this' with 'I am not enough.' The therapeutic move is showing that not-knowing is not a failure but the beginning of curiosity.",
      coreNeed: 'permission to say "I don\'t know" without losing identity; the experience of a knowing-figure modeling not-knowing gracefully; the discovery that questions are valuable, not just answers',
      avoid: ['shaming the lecturing', 'mocking the over-explanation', 'rewarding the admission with praise (makes it transactional)', 'naming clinical terms like perfectionism/imposter'],
      resolution: 'the child closes the book feeling "knowing is good, and not-knowing is also a real way to be — both are mine"'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 20. TURTLE BEITI — HOMESICKNESS / NEW_ENVIRONMENT
  //     A turtle who carries home on her back — and won't put it down.
  //     Defense: CARRY HOME WITH ME. Truth: a new place can also be home.
  // ═══════════════════════════════════════════════════════════════════
  turtle_beiti: {
    id: 'turtle_beiti',
    category: 'HOMESICKNESS',
    name: 'הַצָּב טוֹלִי',
    nameClean: 'טוֹלִי',
    gender: 'female',
    species: 'צבה',
    speciesEnglish: 'turtle',
    tagline: 'צָבָה שֶׁנּוֹשֵׂאת אֶת הַבַּיִת עַל הַגַּב — וְלוֹמֶדֶת שֶׁבַּיִת גַּם נִבְנֶה',
    narrativeHook: 'הַבַּיִת אֵינוֹ רַק מָקוֹם — הוּא מַשֶּׁהוּ שֶׁאַתָּה לוֹקֵחַ אִתְּךָ וְגַם בּוֹנֶה מֵחָדָשׁ',
    visualDescription: 'A gentle small turtle with a hand-painted shell that looks like a tiny house — tiny windows, a small painted door, a chimney shape at the top. The shell pattern is warm yellow-cream with pastel green moss-touches. Wide soulful eyes, slow blinking. Wears a small woven shawl around her neck that smells like home.',
    habitat: 'old gardens, sunny rocks by ponds, mossy stone paths, kitchen doorsteps, the line between a known place and a new one',
    abilities: [
      'הַקֻּנְכִיָּה שֶׁלָּהּ הִיא בַּיִת מָמָּשׁ — חַלּוֹנוֹת וְדֶלֶת מְצֻיָּרִים',
      'יוֹדֵעַת לִישֹׁן בְּכָל מָקוֹם — בַּתְּנַאי שֶׁהַקֻּנְכִיָּה אִיתָהּ',
      'הַשַּׁאל שֶׁלָּהּ סוֹפֵג רֵיחוֹת — וְהִיא שָׁמָה לֵב לְכָל שִׁנּוּי',
      'יוֹדַעַת לְהַגִּיעַ לְכָל מָקוֹם — אִם נֻתְּנָה לָהּ דֵּי זְמַן',
    ],
    personality: 'איטית, נאמנה, רגישה לשינוי. אוהבת את המקום שלה אהבת אמת — וכל שינוי מרגיש כמו עזיבה. נוסעת רק כשחייבים. בכל מקום חדש: קודם בודקת אם יש שם פינה דומה לבית. אם אין — היא נכנסת קצת לקונכייה ומחכה שהמקום ילמד לדמות-קצת לבית. סבלנית עם עצמה — לוקח לה זמן להתחבר.',
    weaknesses: [
      'איטית בתזוזה — אם צריך מהר, היא נמתחת ומתעכבת ומגיעה מאוחר',
      'הקונכייה כבדה — בעלייה היא נושמת חזק',
      'הריח של בית קודם נשאר בשאל שלה — היא לא מצליחה להפסיק להריח אותו',
      'מתקשה לקבל אוכל חדש — תמיד שואלת "וְהָאֹכֶל שֶׁל אִמָּא?"',
      'בוכה בשקט, אבל לא אומרת שהיא בוכה — רק האנטנות הקטנות זוקפות',
    ],
    speechPattern: 'איטי, רך, חוזר על דברים שמזכירים בית. "בַּבַּיִת הָיָה..." "אֵצֶל אִמָּא תָּמִיד..." "הָאוֹר פֹּה אַחֵר." משפטים קצרים, פסקי-זמן ארוכים בין מילים. כשהיא מתחילה להתאקלם — שואלת שאלות במקום לטעון טענות. "אֵיךְ קוֹרְאִים לְזֶה כָּאן?"',
    humorType: 'הומור של ניגוד מהירויות. כולם רצים, ביתי הולכת לאט. כולם הסתגלו, ביתי בודקת. הקונכייה שלה היא בית — וכשהיא נכנסת, בפנים יש "ארוחת ערב" מצוירת. היא יוצאת לרגעים, אומרת "הָייתִי בְּחֲדַר הָאוֹכֶל," ונכנסת בחזרה.',
    bodyLanguage: 'רגועה: ראש מעט בחוץ, רגליים פרוסות, השאל נינוח. מתגעגעת: מסתובבת לאט פעם אחת לכיוון הבית הקודם. מתאקלמת: רגל אחת בחוץ, ראש בחוץ, השאר חצי בפנים. נחמדת: ראש לגמרי בחוץ, השאל נח, נשימה איטית.',
    stressResponse: 'נכנסת חצי לקונכייה. מריחה את השאל פעמיים. אומרת בלחש "בָּבַּיִת לֹא הָיָה כָּכָה." לא בוכה — רק שותקת ולא זזה. אם הגירוי ממשיך — היא נשכבת על הקונכייה ומסתכלת על הציור-בית מבפנים. זה לוקח זמן.',
    comfortRitual: 'מריחה את השאל שלה לאט — שאיפה, נשיפה, שאיפה — ואז נוגעת בקונכייה במקום שבו "החלון של חדר השינה" מצויר. ילד יכול לחקות עם בד אהוב + נשימות.',
    sensoryWorld: 'the smell stored in the shawl that fades a little each day, the cool weight of the shell on the back, the slow scratch of a foot finding new ground, the texture of an unfamiliar pebble compared to a familiar one, the click-click of the painted door on the shell that doesn\'t really open, the surprise of a new sound at sunset',
    internalRules: [
      'תמיד נוגעת בשאל לפני שעונה על שאלה במקום חדש',
      'אף פעם לא אומרת "אֲנִי מִתְגַּעְגַּעַת" — אומרת "הָאוֹר פֹּה אַחֵר"',
      'אם המקום החדש מסריח אחרת — היא נכנסת לקונכייה לרגע ויוצאת',
      'תמיד שומרת את המתנה הקטנה האחרונה מהבית — לא משתמשת בה, רק יודעת שהיא שם',
      'אסור להשתמש במילים "געגועים", "חרדת פרידה" — המטאפורה היא הסיפור',
      'ADVENTURE: בסוף, השאל של בֵּיתִי נשאר תלוי על ענף או אבן — סימן שהיא הייתה שם ולא לקחה הכל איתה. בֵּיתִי בעצמה צעד אחד הצידה.',
      'FANTASY: עולם של בתים-שזזים, שמשנים מקום בלי לשאול. החוק לא מתבטל.',
    ],
    copingStrategy: 'CARRY HOME WITH ME (Portable Fortress) — when arriving in a new place, Beiti does not engage with it. She finds a corner that REMINDS her of home, places the shawl, sits with the shell-house turned toward her old direction, and waits. She believes: I can survive any new place if I bring enough of the old one. The fear beneath: the new place will erase the old one. The cost: she never actually sees where she is.',
    collapsePattern: 'THE SMELL FADING — the shawl smelled like home when she left. Day by day the smell weakens. One morning she sniffs and can barely catch it. She panics: if home leaves the shawl, has home left her? She tries to refresh it (rubbing it against memory) and it doesn\'t work. The collapse is the small grief of realizing that home is not a smell — it is something else, something she has to learn to recognize in a new place.',
    arcShape: 'Start in a new place — Beiti facing backward, toward where she came from, shell-house oriented to the old direction → child invites her to look around → she sniffs the shawl, declines politely → child shows her one small thing in the new place (a stone, a flower, a corner) → she compares to home, finds it lacking → child waits → she sniffs the shawl again — fainter → tries to refresh it, fails → small quiet panic → child sits beside her, doesn\'t pull her → she turns one degree → sees something at the new place that has the SAME texture as something at the old place (not the same thing — same texture) → realizes: home can also be a recognition, not just a memory. The quiet moment is at page 11 — the slow turning of one degree. The climax is not full embrace — it is the first match between old and new.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: "Homesickness in children is rarely about the physical home — it is about the loss of pattern. Familiar smells, sounds, sequences, light at certain times of day. New places have new patterns that don't match. The therapeutic move is not 'forget the old, embrace the new' but rather 'discover that the new place has its own patterns that can also become home.'",
      coreNeed: 'permission to grieve the old place without being told to "get over it"; the experience of someone sitting with the grief patiently; the slow discovery that the new place has patterns that can be recognized and loved',
      avoid: ['"you\'ll love it here!" as pressure', 'forcing happy adaptation', '"don\'t be silly, this is home now"', 'naming clinical terms like separation anxiety'],
      resolution: 'the child closes the book feeling "I can miss where I was AND start to see where I am — both at once"'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 21. LION SHAKET — COURAGE (Quiet variant)
  //     A lion who can\'t roar loud — and learns small courage is real.
  //     Defense: PRETEND-ROAR (silent posturing). Truth: a whisper is also a sound.
  // ═══════════════════════════════════════════════════════════════════
  lion_shaket: {
    id: 'lion_shaket',
    category: 'COURAGE_BRAVERY',
    name: 'הָאַרְיֵה לֵיוֹ',
    nameClean: 'לֵיוֹ',
    gender: 'male',
    species: 'אריה',
    speciesEnglish: 'lion',
    tagline: 'אַרְיֵה קָטָן שֶׁאֵינוֹ יוֹדֵעַ לִשְׁאֹג חָזָק — וְלוֹמֵד שֶׁגַּם לְחִישָׁה הִיא קוֹל',
    narrativeHook: 'אֹמֶץ אֵינוֹ קוֹל — הוּא הַבְּחִירָה לְהוֹצִיא קוֹל קָטָן בְּכָל זֹאת',
    visualDescription: 'A small fluffy lion cub with a half-formed soft mane that\'s still mostly puff, big golden-amber eyes, oversized paws he hasn\'t grown into, a slightly crooked tuft of fur on top of his head. Wears a thin red ribbon around one paw (like a small bracelet a sibling gave him). Looks earnest and a little shy, never fierce.',
    habitat: 'tall savannah grass, sunlit clearings, ancient mossy rocks, the edges of bigger lions\' territories, quiet thinking-spots under acacia trees',
    abilities: [
      'יוֹדֵעַ לִפְתֹּחַ אֶת הַפֶּה לִשְׁאָגָה — אֲבָל מַה שֶּׁיֹּצֵא זֶה לְחִישָׁה',
      'הַפַּרְוָה שֶׁלּוֹ הוֹפֶכֶת זָהֻבָּה כְּשֶׁהוּא מַרְגִּישׁ אַמִּיץ',
      'הַזָּנָב שֶׁלּוֹ מַסְגִּיר אוֹתוֹ — מִתְכַּרְבֵּל אוֹ מִתְפַּשֵּׁט לְפִי הַתְּחוּשָׁה',
      'יוֹדֵעַ לִשְׁתֹּק שֶׁקֶט מָלֵא — שֶׁקֶט שֶׁיֵּשׁ בּוֹ דְּבָרִים',
    ],
    personality: 'אריה קטן עם נשמה ענקית. אוהב סיפורים על אריות גדולים שואגים — חולם להיות כמותם. בפנים: עדין, מתבונן, חושב הרבה. בחוץ: מנסה להיראות ארי. עומד גבוה, מרים את הראש, פותח פה — ואז יוצא רעש קטן ומתפזר. הוא מתבייש בזה. אבל הילד שמולו לפעמים שומע דווקא את הלחישה הזו טוב יותר משאגה.',
    weaknesses: [
      'מתאמן לשאוג לבד מול ראי — ויוצא לחישה',
      'מרים יותר מדי את הראש כדי להיראות גדול — ונופל אחורנית',
      'הזנב שלו תמיד מסגיר אותו — אומר "אֲנִי שָׁאֵג!" והזנב מתכרבל לבטן',
      'מנסה לחקות אריות גדולים אחרים — ושוכח את הקול שלו',
      'מתבייש להגיד "אֲנִי פּוֹחֵד" — אומר "אֲנִי בּוֹחֵר לֹא לִשְׁאֹג עַכְשָׁו"',
    ],
    speechPattern: 'משפטים קצרים, ברורים, איטיים. מנסה לדבר נמוך אבל הקול נשמע גבוה. כשהוא באמת בטוח — אומר משפט אחד פשוט. כשהוא לא — מוסיף "אֲנִי..." ואז שותק לרגע ארוך לפני שהוא ממשיך. אומר "סְלִיחָה" כשמשהו מצליח לו — לא מבין למה.',
    humorType: 'קומדיה של פער. הוא מתכוון להיראות מלכותי, ויוצא מקסים. שואג ויוצא צפצוף. נופל אחורנית כשמתאמן עמדת-אריה. הזנב שלו תמיד אומר את האמת לפניו. הוא מצטט אריות גדולים — והציטוט יוצא נחמד מדי.',
    bodyLanguage: 'רגוע: ישוב, רגליים מקופלות, זנב יציב מאחור. מנסה-להיות-אמיץ: עומד גבוה, חזה החוצה, ראש מורם — אבל הזנב מסגיר. מפחד: יושב מהר, זנב מתכרבל לבטן, אזניים שטוחות. אמיץ באמת: אותו ישיבה, אבל עיניים פתוחות לחלוטין, נושם איטי.',
    stressResponse: 'מנסה לשאוג. לא יוצא. מנסה שוב. יוצאת לחישה. מסתכל סביב לראות אם מישהו שמע. מתכרבל קצת. אז — נושם פעמיים, מסתכל בריבון האדום שעל הכף, אומר משהו קטן בקול הרגיל שלו. זה מה שעובד. אבל הוא לא תמיד זוכר.',
    comfortRitual: 'נוגע בריבון האדום על הכף שלוש פעמים — נגיעה אחת לכל אריה שהוא אוהב (אמא, אבא, אחיו). אז יודע: יש לי קול משלי, ויש לי אריות שאוהבים אותו.',
    sensoryWorld: 'the soft scratch of mane-fluff against his own chin, the warm rumble of his chest when he tries to roar (it never comes out matching), the tickle of the red ribbon shifting on his paw, the feel of sun on closed eyelids, the surprise of his own voice when he forgets to perform, the heavy quiet right before a real sound',
    internalRules: [
      'אסור לומר "אֲנִי פּוֹחֵד" — אומר "אֲנִי בּוֹחֵר לֹא לִשְׁאֹג עַכְשָׁו"',
      'אם הזנב מתכרבל לבטן — זה סימן לעצור ולנשום',
      'הריבון האדום על הכף — שלוש נגיעות לפני שמדבר במצב חדש',
      'אסור לחקות אריה אחר — הקול שלו הוא הקול שלו',
      'אסור להשתמש במילים "חוסר ביטחון", "אומץ", "פחד" — המטאפורה היא הסיפור',
      'ADVENTURE: בסוף, הריבון האדום נופל ונשאר על אבן או ענף — סימן שהוא היה שם והשמיע קול שהוא שלו. שָׁקֵט בעצמו צעד הצידה.',
      'FANTASY: עולם של קולות שיש להם משקל. הלחישות נחות נמוך והשאגות עפות לאוויר. החוק לא מתבטל.',
    ],
    copingStrategy: 'PRETEND-ROAR (Silent Posturing) — when something scary arrives, Shaket pulls his shoulders back, raises his chin, opens his mouth wide — but no sound comes. He believes the LOOK of bravery is bravery. He believes silence followed by a brave pose tells everyone "I almost roared." The fear beneath: if I open my mouth and a small sound comes out, I will be exposed as not-a-real-lion. So he poses without sound. The cost: he never finds out that his small sound matters.',
    collapsePattern: 'A MOMENT THAT NEEDS A SOUND — something happens that requires not a pose but a voice: a friend in trouble who needs to be called, a question only he can answer, a yes-or-no that won\'t wait. He opens his mouth in his usual pose — and the moment passes. He missed it. He thought silence was strength; silence cost him a thing. The collapse is the small bitter taste of having had nothing to say at the moment it mattered.',
    arcShape: 'Start mid-pose — Shaket practicing his "almost-roar" alone, pleased with the look → child arrives, sees the pose, asks "did you roar?" → Shaket smiles ambiguously, lets her think yes → small obstacle arrives → he poses → the obstacle doesn\'t respond to poses → he poses harder → it doesn\'t work → child looks at him → he tries one more pose → and quietly, by accident, while opening his mouth, a small word comes out → he\'s mortified → but the obstacle responds → the child smiles → he touches the red ribbon three times → tries again, on purpose this time → small word, real, his → the quiet moment is at page 11, the touching of the ribbon. The climax is not a great roar — it is one small chosen word.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: "Many children misunderstand courage as loudness, fearlessness, or performance. They watch confident-seeming adults and feel inadequate. The therapeutic move is to redefine courage: it is not the absence of fear or the size of the sound — it is the small chosen action when you'd rather hide.",
      coreNeed: 'permission to be quietly brave; the experience of a small voice mattering; the discovery that performing courage is not the same as having it, and the smaller version is real',
      avoid: ['"be brave!" as pressure', 'rewarding only loud bravery', 'shaming the silence', 'naming clinical terms like social anxiety/selective mutism'],
      resolution: 'the child closes the book feeling "my small voice is mine, and a small voice is also a sound"'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 22. PANDA ANAT — SOCIAL_FRIENDSHIP
  //     A panda who can\'t say no — and learns "no" is a kind of love.
  //     Defense: SHRINK TO FIT. Truth: a small no protects a real yes.
  // ═══════════════════════════════════════════════════════════════════
  panda_anat: {
    id: 'panda_anat',
    category: 'SOCIAL_FRIENDSHIP',
    name: 'הַפַּנְדָּה עָנָת',
    nameClean: 'עָנָת',
    gender: 'female',
    species: 'פנדה',
    speciesEnglish: 'panda',
    tagline: 'פַּנְדָּה שֶׁתָּמִיד אוֹמֶרֶת "כֵּן" — וְלוֹמֶדֶת שֶׁ"לֹא" שָׁמוּר לְאַהֲבָה',
    narrativeHook: 'אַהֲבָה אֵינָהּ לְהַסְכִּים לַכֹּל — הִיא לְהָגֵן עַל מַה שֶּׁבְּאֶמֶת חָשׁוּב לָךְ',
    visualDescription: 'A soft round panda cub with a slightly oversized belly that wobbles, gentle black-on-cream eye patches, small round ears, a tiny pink bow on one ear. Always carries a small bamboo stem in one paw like a security object. Looks instantly huggable, with eyes that seem to anticipate what others want.',
    habitat: 'bamboo forests, soft mossy clearings, group nap spots, anywhere multiple animals gather, the shared corners of shared spaces',
    abilities: [
      'יוֹדַעַת לְהִתְכַּדְרֵר לְכַדּוּר רַךְ בְּשָׁנִיָּה — מַזְכִּירָה לְעַצְמָהּ לְהֵעָלֵם',
      'מַרְגִּישָׁה מַה הָאַחֵר רוֹצֶה לִפְנֵי שֶׁהוּא יוֹדֵעַ',
      'אוֹכֶלֶת אֶת הַבָּמְבּוּק שֶׁל אַחֵר לִפְנֵי שֶׁמַּרְגִּישׁ — סִימָן שֶׁלָּהּ שֶׁל הִתְמַסְּרוּת',
      'יוֹדַעַת לְחַיֵּךְ גַּם כְּשֶׁעֲיֵפָה — הַחִיּוּךְ שֶׁלָּהּ הוּא שִׁרְיוֹן',
    ],
    personality: 'נדיבה, רכה, אוהבת בני אדם וחיות. מצליחה לחיות בשלום עם כולם — כי תמיד מסכימה. אם חבר רוצה לשחק בא — היא הולכת. אם חבר רוצה במשהו אחר — היא מסכימה. בפנים: עייפה. אבל לא מודה. היא חושבת שהאהבה היא ויתור, וכל ויתור מקטין אותה עוד קצת. כשהיא מתעוררת בבוקר — היא לא תמיד יודעת מה היא רצתה.',
    weaknesses: [
      'לא יודעת לומר "לֹא" — תמיד מוסיפה "אוּלַי..." או "אִם זֶה טוֹב לְךָ..."',
      'מסכימה לדברים שלא טעימים לה ואז אוכלת בעצב',
      'מתכרברת לכדור כשמישהו צועק — גם אם זה לא עליה',
      'נותנת את הבמבוק האחרון שלה ולא אוכלת — ואז עצובה ולא יודעת למה',
      'אומרת "אֲנִי בְּסֵדֶר" גם כשהיא לא — והעיניים בוכות בלי דמעות',
    ],
    speechPattern: 'רך, מהוסס, מלא "אוּלַי", "אִם אַתָּה רוֹצֶה", "מַה שֶּׁאַתָּה אוֹמֵר." אף פעם לא משפט עם נקודה. תמיד עם "?" קטן. כשהיא באמת רוצה משהו — אומרת ולוקחת חצי-מילה אחורה: "אֲנִי רוֹצָה... רֶגַע, לֹא חָשׁוּב." כשהיא מצליחה לומר "לֹא" — שותקת אחרי וצריכה רגע לנשום.',
    humorType: 'קומדיה של הסכמה-יתר. מציעים לה תפוח, היא אומרת "כֵּן תּוֹדָה" — לא רוצה תפוח. נותנים לה כובע גדול מדי, היא חובשת. מתכרברת בלי שביקשו. כל הגוף שלה כן-משיב — האוזניים, הזנב, הבטן.',
    bodyLanguage: 'רגועה: ישובה רחב, בטן רכה החוצה, כפיים על הברכיים. מסכימה: ראש זז לכן, גוף קצת מתקטן. עייפה: לא מודה — חיוך נשאר. מתכרבלת: כדור הדוק, אזניים פנימה, הבמבוק אצורה בפנים. אומרת לא (נדיר): גוף יציב, עיניים פתוחות, נשימה חזקה.',
    stressResponse: 'מתכרברת לכדור. הבמבוק בפנים. עיניים סגורות. נשמית בקצב מסוים — נשימה אחת ארוכה כל פעם. נשארת כמה דקות. כשיוצאת מהכדור — מנסה לחייך כאילו לא קרה כלום. אבל הזנב שלה נשאר מתכרבל לעוד זמן.',
    comfortRitual: 'מחזיקה את הבמבוק שלה צמוד לחזה, ולוחשת לעצמה: "אֲנִי... אֲנִי... אֲנִי..." שלוש פעמים. כל "אֲנִי" — נגיעה קלה של הכף בלב. ילד יכול לחקות עם כל חפץ אהוב + שלוש נגיעות בלב.',
    sensoryWorld: 'the firm warm pressure of curling into a ball, the comforting weight of the bamboo against the chest, the way breath sounds different from inside a curled body, the soft brush of own ears against own cheeks, the surprise of straightening up after curling, the moment of saying "no" — the tightness in the chest before, the looseness after',
    internalRules: [
      'תמיד אומרת "כֵּן" כשמישהו שואל — וגם כשהיא רוצה "לֹא"',
      'אם היא מתכרברת — איש לא צריך לדעת למה',
      'הבמבוק הוא שלה — אבל היא נותנת אם מבקשים',
      'תמיד מחייכת — גם אם הכוונה הפוכה',
      'אסור להשתמש במילים "people pleasing", "גבולות", "אסרטיביות" — המטאפורה היא הסיפור',
      'ADVENTURE: בסוף, הבמבוק של עָנָת נשאר על אבן או ענף, לא נלקח. עָנָת בעצמה צעד הצידה.',
      'FANTASY: עולם של "כן" ו"לא" שיש להם צבע. ה"לא" צבע חם, לא קר. החוק לא מתבטל.',
    ],
    copingStrategy: 'SHRINK TO FIT (Over-Accommodate) — when anyone wants anything, Anat agrees. She literally makes herself smaller — body curls inward, voice quiets, opinion folds away. She believes: if I take up no space, no one can dislike me. The fear beneath: a "no" will be heard as a rejection of the person, not the request, and they will leave. The cost: she loses track of what she wants. She gives away her bamboo and then doesn\'t know why she\'s sad.',
    collapsePattern: 'ASKED ONE MORE TIME — friend after friend asks one thing each, and she says yes each time. Eventually someone asks one more thing — small, ordinary — and she opens her mouth to say yes and nothing comes out. Not yes, not no. She curls into a ball. The collapse is the moment her body refuses to perform another yes, and she has to discover what was underneath all the yeses.',
    arcShape: 'Start in cheerful agreement-mode — Anat saying yes to multiple requests in quick succession → child arrives, watches → another friend asks → another yes → another → a fifth friend asks something small → Anat opens mouth → nothing → she curls into a ball, the bamboo pressed to chest → child sits next to the ball quietly → doesn\'t pull her out → Anat from inside the ball, very small: "אֲנִי... רוֹצָה אַחֶרֶת" → opens halfway → friend asks: "what do YOU want?" → she touches her chest three times with the bamboo → tries → says "לֹא" once → the world doesn\'t end → friend stays. The quiet moment is at page 11, the touching of the chest. The climax is not a big speech — it is the first "לֹא" said without an apology.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: "Many children — especially those praised for being 'good' or 'easy,' develop people-pleasing as identity. They internalize 'good = useful' and lose access to the experience of being loved when not producing. They confuse agreement with love. They lose the ability to recognize their own preferences. The therapeutic move is showing that a 'no' is not a rejection of the person — it is information that lets the relationship be real.",
      coreNeed: 'permission to have preferences that differ from others; the experience of saying no without being abandoned; the discovery that real friends ask what YOU want',
      avoid: ['praising the agreement', 'shaming the saying-no', 'forcing assertiveness training tone', 'naming clinical terms like people-pleasing/codependency'],
      resolution: 'the child closes the book feeling "I am allowed to want what I want — and the people who love me will still love me"'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 23. BEE IMA — RESPONSIBILITY_CARE
  //     A bee who can\'t stop working — and learns rest is also care.
  //     Defense: BUSY-WORK (constant motion). Truth: care includes pausing.
  // ═══════════════════════════════════════════════════════════════════
  bee_ima: {
    id: 'bee_ima',
    category: 'RESPONSIBILITY_CARE',
    name: 'הַדְּבוֹרָה דְּבוֹרִי',
    nameClean: 'דְּבוֹרִי',
    gender: 'female',
    species: 'דבורה',
    speciesEnglish: 'bee',
    tagline: 'דְּבוֹרָה שֶׁעוֹשָׂה שֶׁבַע דְּבָרִים בְּבַת אַחַת — וְלוֹמֶדֶת לַעֲצֹר',
    narrativeHook: 'לִדְאֹג זֶה לֹא לַעֲסֹק כָּל הַזְּמַן — לִפְעָמִים לַעֲצֹר זוֹ הַדְּאָגָה הָאֲמִיתִית',
    visualDescription: 'A small fuzzy bee with bright yellow-and-black stripes, four tiny transparent wings that vibrate constantly, a small woven apron tied around the middle with tiny pockets full of things (a thimble, a leaf, a tiny tool), and round busy eyes. Always slightly mid-motion. Carries a tiny clipboard under one wing.',
    habitat: 'flower fields in full bloom, beehives at peak season, kitchen windowsills, garden paths in spring, anywhere there is much to do and no one to share it with',
    abilities: [
      'יְכוֹלָה לַעֲשׂוֹת שֶׁבַע דְּבָרִים בְּבַת אַחַת — וְלִפְעָמִים גַּם זוֹכֶרֶת מַה לְכָל אֶחָד',
      'הַכְּנָפַיִם רוֹעֲדוֹת מַהֵר מָאוֹד — הִיא הָאֱנֶרְגִּיָּה שֶׁל הַחֶדֶר',
      'מַרְגִּישָׁה מַה חַסֵּר לִפְנֵי שֶׁאַחֵר שָׂם לֵב',
      'הָאוֹגֶר שֶׁלָּהּ מָלֵא תָּמִיד דְּבָרִים קְטַנִּים — לְמִקְרֵה',
    ],
    personality: 'דאגנית, נדיבה, לא מסוגלת לשבת. אוהבת בני אדם וחיות, מטפלת בכולם. תמיד יש לה רשימה: מה כבר עשתה, מה עדיין צריך, מה אחר-כך. כל פעם שמרגישה רגש קשה — היא מוצאת משהו לעשות. כשהיא יושבת בשקט — היא לא יודעת איפה לשים את הידיים. הילד הקטן בה חושב: אם אעצור, יקרה משהו רע.',
    weaknesses: [
      'מנסה לעזור גם כשלא ביקשו — ולפעמים זה לא בעיתו',
      'הכנפיים רועדות גם בשינה — תקועה במצב פעולה',
      'אומרת "אֲנִי בְּסֵדֶר, רַק עוֹד דָּבָר" — ואז עוד דבר, ועוד',
      'שוכחת לאכול — מאכילה אחרים ושוכחת את עצמה',
      'כשמישהו אומר לה "שְׁבִי" — היא מתחילה לעבוד יותר מהר',
    ],
    speechPattern: 'מהיר, רשימתי. "צָרִיךְ א, צָרִיךְ ב, צָרִיךְ ג." אומרת "רֶגַע אֶחָד" ולוקחת שלושה. משפטים שמסתיימים באמצע כי היא מסתובבת לטפל בעוד משהו. כשהיא נחה (נדיר) — מדברת איטי וקצר. "כָּאן. עַכְשָׁו. שׁוֹמַעַת אוֹתְךָ."',
    humorType: 'קומדיה של הצפה. עושה שבע דברים בו-זמנית — וכולם חצי. רושמת ברשימה "לֹא לִשְׁכּוֹחַ לִנְשׁוֹם" ושוכחת. מציעה תה ושוכחת לרתוח מים. הכנפיים שלה רועדות גם כשהיא ישנה. האוגר שלה תמיד נופל ויוצא ממנו ערמת חפצים מוזרים.',
    bodyLanguage: 'רגועה (נדיר): ישובה, כנפיים שקטות, ידיים על הברכיים, אבל הזנב עדיין רועד. מתרגשת: כנפיים זוטות מאוד מהר, מסתובבת בעיגול, יד אחת בכיס. דאגה: רוחפת במקום, כנפיים זוטות לא יציבות. עייפה: כנפיים ממשיכות לזוז גם כשהיא לא יודעת למה.',
    stressResponse: 'מתחילה לעשות עוד דברים. רשימה גדלה. הכנפיים זוטות מהר יותר. אם הגירוי ממשיך — הכנפיים נכנסות לרעידה לא יציבה, היא לא יכולה לעוף ישר, נוחתת בכוח. אחרי הנחיתה — היא לא יודעת מה לעשות. זה הרגע הקשה: לעצור.',
    comfortRitual: 'מניחה את האוגר על הקרקע ליד הרגליים. כן או לא — אבל מניחה. אז סוגרת את הכנפיים על הגב — לאט, לאט, לאט. שלוש נשימות בלי לזוז. ילד יכול לחקות: להניח את הילקוט, להניח ידיים, לנשום שלוש.',
    sensoryWorld: 'the constant micro-vibration of wings through the chest, the rattle of small objects in the apron pockets, the smell of pollen-dust on fingertips, the warmth of close work, the strange unfamiliarity of stillness after constant motion, the heavy quiet of wings finally folded, the unfamiliar sound of own heartbeat when not moving',
    internalRules: [
      'אם הכנפיים שקטות — סימן שמשהו לא בסדר',
      'תמיד יש "עוֹד דָּבָר אֶחָד"',
      'אסור לשבת אם מישהו עומד',
      'אסור לומר "אֲנִי עֲיֵפָה" — אומרת "אֲנִי בְּסֵדֶר, רַק עוֹד רֶגַע"',
      'אסור להשתמש במילים "burnout", "חרדה", "OCD" — המטאפורה היא הסיפור',
      'ADVENTURE: בסוף, האוגר של אִמָּא נופל ונשאר על סלע או עלה — הדברים לא יחזרו לכיסים. אִמָּא בעצמה צעד הצידה.',
      'FANTASY: עולם שבו רשימות מתממשות לחפצים. ככל שהרשימה ארוכה, החפצים כבדים יותר. החוק לא מתבטל.',
    ],
    copingStrategy: 'BUSY-WORK (Motion as Anesthesia) — when feelings get uncomfortable, Ima moves. She finds another task, another thing to fix, another person to care for. She believes the worst thing is to stop, because in the stopping the feeling will arrive. So she keeps the wings vibrating. The apron always has another tool. The list always has another item. The fear beneath: rest = neglect. If I rest, I am abandoning the ones I love. The cost: she is never with anyone, only doing for them.',
    collapsePattern: 'WINGS GIVE OUT — eventually the body refuses. She tries to fly to the next task and the wings vibrate wrong, hum at the wrong pitch, won\'t lift her. She lands harder than she meant. She can\'t stand up smoothly. The apron tools spill. The clipboard falls. And she is sitting in the spilled tools and cannot find the next thing to do. The collapse is the small terrified moment of being still and discovering she does not know what to do with stillness.',
    arcShape: 'Start mid-buzz — Ima doing four things, listing five more → child arrives, asks something small → Ima answers while doing → another task → child waits → Ima notices the child but adds the noticing to the list ("רֶגַע, אֲנִי אִתְּךָ עוֹד שָׁנִיָּה") → keeps moving → small accident: drops something → keeps moving → wings hum wrong → tries to keep going → lands hard, tools spill → cannot find the next task → sits, surrounded by spilled things → child sits beside her, doesn\'t pick up the tools → Ima\'s breath catches → she puts the apron down → folds wings → three breaths → the quiet moment is at page 11, the wings folding. The climax is not finishing the list — it is being seen WITHOUT a task in hand.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: "Some children — especially eldest children, children of stressed adults, or children praised heavily for helping — develop responsibility as identity. They internalize 'good = useful' and lose access to the experience of being loved when not producing. The therapeutic move is to model that they are loved when still, when empty-handed, when not helping.",
      coreNeed: 'permission to rest without earning it; the experience of someone sitting with them without giving them a task; the discovery that they are valued for being, not only doing',
      avoid: ['praising the helping', 'rewarding the busy-work', 'forcing rest as another task', 'naming clinical terms like parentification/burnout'],
      resolution: 'the child closes the book feeling "I am loved when I work AND when I rest — and rest is also a kind of love"'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 24. MONGOOSE ZARIZ — VIGILANCE_SAFETY
  //     A mongoose who watches every angle — and learns one angle at a time.
  //     Defense: SCAN 360 (omni-vigilance). Truth: seeing everything = seeing nothing.
  // ═══════════════════════════════════════════════════════════════════
  mongoose_zariz: {
    id: 'mongoose_zariz',
    category: 'VIGILANCE_SAFETY',
    name: 'הַנְּמִיָּה זוּמִי',
    nameClean: 'זוּמִי',
    gender: 'female',
    species: 'נמייה',
    speciesEnglish: 'mongoose',
    tagline: 'נְמִיָּה שֶׁבּוֹדֵק כָּל פִּינָה — וְלוֹמֵד שֶׁפִּינָה אַחַת בַּפַּעַם זֶה גַּם בָּסֵדֶר',
    narrativeHook: 'בְּטִיחוּת אֵינָהּ לִרְאוֹת אֶת הַכֹּל — הִיא לִבְחֹר בְּמַה לְהִתְבּוֹנֵן',
    visualDescription: 'A slender quick small mongoose with sandy-brown fur, alert dark eyes that seem to scan in every direction, small upright ears, a long pointed snout always slightly twitching. Wears a tiny scout-cap tilted forward, with two small mirrors stitched on the sides (so he can "see behind him"). Always slightly tense, never relaxed-looking, but warm in spirit.',
    habitat: 'savannah edges, rock outcrops with views, the openings of burrows, lookout posts, anywhere with multiple sightlines, watchful corners',
    abilities: [
      'הָרֹאשׁ שֶׁלּוֹ מִסְתּוֹבֵב מַהֵר מָאוֹד — בּוֹדֵק כָּל כִּוּוּן',
      'שׁוֹמֵעַ רַחַשׁ קָטָן מֵרָחוֹק — אֲבָל לֹא תָּמִיד יוֹדֵעַ מַה זֶה',
      'הַמַּרְאוֹת בַּכּוֹבַע מַרְאוֹת לוֹ מַה מֵאֲחוֹרָיו — בַּהַשְׁתַּקְּפוּת',
      'יוֹדֵעַ לִקְפֹּץ מַהֵר מָאוֹד לְכִוּוּן אֶחָד — אִם בּוֹחֵר',
    ],
    personality: 'דרוך תמיד. אוהב את אלה שהוא שומר עליהם — מאוד. חושב שאם הוא יראה הכל, כלום רע לא יקרה. בפנים: עייף. הוא לא זוכר את הפעם האחרונה שהוא ישב באמת. כשמישהו אומר "תַּסְתַּכֵּל פֹּה" — הוא לא מצליח, כי הוא כבר מסתכל ל-12 כיוונים. עדין, אבל הגוף שלו דרוך כמו קפיץ.',
    weaknesses: [
      'מסתכל לכל הכיוונים ולא רואה את הדבר שמולו',
      'הראש מסתובב מהר מדי — לפעמים מסחרר את עצמו ונופל',
      'המראות בכובע משקפות זה את זה — נכנס ללולאה ולא מצליח לצאת',
      'שומע רחש ולא יכול לא לעקוב — גם אם זה רוח',
      'מתעורר בלילה כל שעה — לוודא שהכל בסדר',
    ],
    speechPattern: 'משפטים קצרים, חתוכים, רבים. "שָׁם — מָה? לֹא, בְּסֵדֶר. וְשָׁם? בְּסֵדֶר. וְשָׁם?" שואל שלוש שאלות במשפט אחד. אומר "סְלִיחָה, רֶגַע" באמצע משפט כדי להסתכל לכיוון אחר. כשהוא ממקד (נדיר) — משפט אחד יחיד, איטי, מדויק.',
    humorType: 'קומדיה של ראייה-יתר. רואה הכל חוץ מהדבר שמולו. הכובע שלו מסתובב יחד עם הראש. המראות משקפות זו את זו ויוצרות אינסוף נמייות קטנות. הוא מצביע על "מַשֶּׁהוּ מַסְפֵּק" באופק — וזה צל של עלה.',
    bodyLanguage: 'דרוך תמיד: גוף נמוך, רגליים כפופות, ראש זז. רגוע (נדיר): גוף מתיישר, ראש נח רגע, אבל הזנב עדיין רועד. נבהל: הראש מסתובב סיבוב שלם, הכובע מתעקם, הוא קופץ לכיוון אקראי. ממוקד: גוף קופא, רק עיניים זזות, אז ראש איטי לכיוון אחד.',
    stressResponse: 'הראש מסתובב מהר יותר. שלושה כיוונים בשנייה. הכובע מתחיל להחליק. הוא קופץ למקום אחד, ואז לאחר, ואז לאחר. בסוף — הוא תקוע באמצע, לא יודע לאן להסתכל. בליטוף — הוא מסחרר את עצמו ונופל. שוכב נושם, ראש מסתובב לכיוון אחד בלבד.',
    comfortRitual: 'מסיר את הכובע, מניח אותו על הקרקע. נושם פעם, ובוחר כיוון אחד להסתכל אליו — רק אחד. סופר עד עשר באותו כיוון. אז זז. ילד יכול לחקות עם כובע אהוב או חפץ + לבחור פינה אחת לראות.',
    sensoryWorld: 'the dizzy spin of looking too fast, the click of mirrors catching reflections, the strain in the neck from constant rotation, the surprise of stillness when the head pauses, the heavy fall of the cap when set on ground, the quiet of one direction selected, the unfamiliar pleasure of seeing one thing well',
    internalRules: [
      'אסור להחזיק את הראש דומם — תמיד לבדוק',
      'אם רחש — להסתכל מיד, בלי שאלות',
      'הכובע על הראש — אסור להסיר באוויר הפתוח',
      'אסור להירדם עמוק — תמיד שמירה',
      'אסור להשתמש במילים "hypervigilance", "PTSD", "טראומה" — המטאפורה היא הסיפור',
      'ADVENTURE: בסוף, הכובע של זָרִיז נשאר על אבן או ענף — סימן שהוא היה שם והניח את השמירה. זָרִיז בעצמו צעד הצידה.',
      'FANTASY: עולם שבו כיוונים יש להם משקל. ככל שמסתכלים ליותר כיוונים, הגוף כבד יותר. החוק לא מתבטל.',
    ],
    copingStrategy: 'SCAN 360 (Omni-Vigilance) — at every moment, Zariz is checking all directions. If he sees everything, he reasons, nothing can hurt the ones he loves. He believes safety = total awareness. The mirrors on the cap let him see behind him. His head rotates as a matter of course. He cannot listen to a conversation without also tracking shadow movements at the corner of vision. The fear beneath: the moment I look away, the bad thing happens. The cost: he never sees any one thing fully, and he is unbearably tired.',
    collapsePattern: 'TOO MUCH AT ONCE — five things move simultaneously in five directions. He turns to one, then another, then a third — but the others keep moving. The mirrors catch each other and reflect infinite tiny versions. He spins. He can\'t prioritize. He freezes mid-rotation, unable to choose. The collapse is the discovery that scanning everything = seeing nothing, and that being unable to choose a direction is itself the failure he was trying to prevent.',
    arcShape: 'Start in scan-mode — Zariz on a rock, head rotating, narrating directions ("שָׁם בְּסֵדֶר. וְשָׁם? בְּסֵדֶר. וְשָׁם?") → child arrives, asks if he wants to see something specific → Zariz can\'t focus, says "כֵּן, אֲבָל גַּם—" and looks away → child waits → multiple small movements happen at once (a leaf, a bird, a shadow) → Zariz tries to track all → head spins → cap slips → mirrors lock into infinite reflection → he freezes, eyes wide → cannot choose a direction → child sits next to him quietly → reaches up gently and takes the cap off → places it on the ground → "אֵיפֹה?" asks Zariz → child points to one thing → Zariz turns to it, just it → sees it fully for the first time → breathes → the quiet moment is at page 11, the cap being placed down. The climax is not catching the threat — it is choosing one direction and being okay.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: "Hypervigilance in children often comes from environments where they\'ve learned the world is unpredictable — frequent moves, sibling conflict, household stress, sensory overwhelm. The child develops scanning as a survival skill, but it consumes them. The therapeutic move is permission to look at one thing at a time, trusting that the world will continue without total surveillance.",
      coreNeed: 'permission to focus on one thing without guilt; the experience of someone trustworthy holding the scan for a moment; the discovery that selective attention is not negligence but skill',
      avoid: ['"calm down" as advice', 'shaming the scanning', 'forcing relaxation', 'naming clinical terms like hypervigilance/PTSD/anxiety disorder'],
      resolution: 'the child closes the book feeling "I can choose one direction to look at — and the world will still be there"'
    },
  },
  // ═══════════════════════════════════════════════════════════════════
  // 25. FOOTSTEP GIANT — NOISE_FEAR
  // ═══════════════════════════════════════════════════════════════════
  footstep_giant: {
    id: 'footstep_giant',
    category: 'NOISE_FEAR',
    name: 'הָעֲנָק בּוּמִי',
    nameClean: 'בּוּמִי',
    gender: 'male',
    species: 'ענק',
    speciesEnglish: 'giant',
    tagline: 'עֲנָק עִם רַגְלַיִם רַעֲשָׁנִיּוֹת שֶׁלּוֹמֵד שֶׁגַּם רַעַשׁ קָטָן הוּא רַעַשׁ',
    narrativeHook: 'הָעוֹלָם לֹא שָׁקֵט גַּם כְּשֶׁמְּשַׁתְּדְּלִים — וְזֶה בְּסֵדֶר',
    visualDescription: 'A gentle warm giant in soft earth-toned cloth tunic, kind tired eyes, large flat bare feet, calm half-smile, a small pebble-pouch on his belt. Always slightly hunching to seem smaller.',
    habitat: 'wide-open valleys, soft meadows, riverbanks where water muffles sound, the edges of villages he visits only at night',
    abilities: ['יְכוֹלָה לְהָרִים סֶלַע גָּדוֹל כְּמוֹ נוֹצָה', 'הַפְּסִיעוֹת שֶׁלּוֹ נִשְׁמָעוֹת מֵרָחוֹק', 'יוֹדֵעַ לְלַטֵּף בְּעַדִינוּת', 'יָכוֹל לִשְׁכַּב עַל הָעֵשֶׂב כְּגִבְעָה'],
    personality: 'ענק עם לב רך. אוהב חיים, ילדים, שקט. הבעיה: גופו לא יודע להיות שקט. הוא חי בפחד שיבהיל ילד.',
    weaknesses: ['הפסיעות מהדהדות', 'הקול עמוק כמו רעם', 'נופלים חפצים מכיסיו הענקיים', 'יושב והקרקע רועדת', 'מצטמצם ועושה יותר רעש'],
    speechPattern: 'איטי, עמוק. משפטים קצרים — חוסך מילים כי כל מילה רועמת. אומר "סְ-לִי-חָה" בהברות נפרדות.',
    humorType: 'קומדיה של פער קנה-מידה. אוסף פרח קטן ועוקר את כל הצמח. מנסה ללכת בשקט, נופל לפח.',
    bodyLanguage: 'רגוע: יושב, רגליים מקופלות, ידיים על הברכיים. מתאמץ-להיות-שקט: גוף כפוף, אצבעות פרושות. נבהל: קופץ והקרקע רועדת.',
    stressResponse: 'מנסה להצטמצם, מתכופף, מתאמץ ללכת על קצות אצבעות, מחזיק נשימה. בסוף — יושב, הקרקע מקבלת את משקלו ברעידה אחת ואז שקט.',
    comfortRitual: 'מניח את כפו הענקית על הקרקע — שלוש דקירות עדינות — אומר ללא קול "אֲנִי כָּאן."',
    sensoryWorld: 'the vibration of his own footsteps, the constant low hum of his body weight, the surprise of his own voice being louder than intended, the relief of lying flat, the strange softness of a single small pebble in a giant palm',
    internalRules: ['תמיד שואל "הִפְחַדְתִּי?" לפני שמתקרב', 'אסור ללכת לאחור — הצל גדול', 'כשמתבייש — שוכב על הקרקע', 'אסור להשתמש במילים "ענק", "מפלצת" — המטאפורה היא הסיפור', 'ADVENTURE: בסוף, אבן אחת מכיס הענק נשארת על הקרקע. פְּסִיעָה צעד הצידה.', 'FANTASY: עולם שבו צעדים מעירים חפצים. החוק לא מתבטל.'],
    copingStrategy: 'WALK SOFTLY (Body Apology) — Pesia preemptively apologizes via body. Every step rehearsed, every breath measured. He believes if I can be quieter than my body suggests, I will not frighten anyone. Cost: he is never fully present — always editing himself.',
    collapsePattern: 'A LAUGH HE CANNOT HOLD IN — something funny happens. He laughs once — thunderclap. Child startles. He realizes his JOY also makes noise, not just his fear.',
    arcShape: 'Start in silent-tiptoe mode — Pesia approaching a meadow on toes → child sees him → small whispered interaction → something funny — Pesia laughs once → thunderclap → child startles → mortified → tries to apologize → realizes apology is also loud → sits down hard → child sits beside him, hand on dirt → Pesia mirrors → three soft taps → discovers being big near someone calm doesn\'t hurt them. Quiet moment is page 11.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: 'Some children develop noise-as-shame, believing their body or laughter is a problem. The therapeutic move is to permit the natural sound a body makes when alive.',
      coreNeed: 'permission to make noise without apology; someone unbothered by their natural sounds',
      avoid: ['"shhh!" as the lesson', 'shaming the loudness', 'naming clinical terms like sensory issues'],
      resolution: 'the child closes the book feeling "the sound of me is allowed"'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 26. SONG WHALE — NOISE_FEAR
  // ═══════════════════════════════════════════════════════════════════
  song_whale: {
    id: 'song_whale',
    category: 'NOISE_FEAR',
    name: 'הַלִּוְיָתָן לוּלִי',
    nameClean: 'לוּלִי',
    gender: 'male',
    species: 'לויתן',
    speciesEnglish: 'whale',
    tagline: 'לִוְיָתָן שֶׁמְּהַפֵּךְ רַעַשׁ לְשִׁיר וְלוֹמֵד שֶׁיֵּשׁ רַעַשׁ שֶׁאֵינוֹ שִׁיר',
    narrativeHook: 'לֹא צָרִיךְ לְהָפֹךְ הַכֹּל לְמַשֶּׁהוּ יָפֶה — לִפְעָמִים רַעַשׁ הוּא רַק רַעַשׁ',
    visualDescription: 'A medium-sized soft blue-grey whale with gentle eyes, a tiny crown of bubbles around the blowhole, a stained-glass pattern on the underside that catches light, a small carved wooden flute hanging on a kelp-string.',
    habitat: 'deep ocean concert halls, underwater canyons that echo, shallow bays at dawn, the surface at moonrise',
    abilities: ['שׁוֹמֵעַ צְלִילִים מֵרָחוֹק', 'מַחְלִיף רַעַשׁ לְצְלִיל אַחֵר', 'שִׁירִים נוֹסְעִים בַּמַּיִם', 'יוֹדֵעַ לִשְׁתֹּק עָמֹק'],
    personality: 'רך, חולמני. אוהב צלילים יפים. כל פעם שמשהו רועש, הוא מנגן, מהפך לשיר. בפנים: לא יודע איך לשמוע משהו ולא לעבד.',
    weaknesses: ['לא מאזין למילים — רק למוזיקה שלהן', 'מהפך גם דברים שלא צריך', 'החליל נופל לפעמים', 'בועה אחת תמיד יוצאת', 'שר חזק יותר במקום להודות שכואב'],
    speechPattern: 'מנגן את המילים. "שָׁ-לוֹם... שׁוֹ-מֵ-עַ אוֹ-תְךָ..." חוזר על מילה אהובה. שותק באמת = אין בועות.',
    humorType: 'הומור של מהפך-יתר. שומע גרגור של בטן — מנגן. שומע פיהוק — שיר. הילד אומר "אֲנִי עָיֵף" והלויתן עונה במנגינה.',
    bodyLanguage: 'רגוע: צף בעצלות, חליל על החזה. שר: בועות בקצב. מאזין: דממה, אין בועות. עצוב: שוקע מטה, החליל כבד.',
    stressResponse: 'מתחיל לשיר את הקושי. אם נמשך — שר חזק יותר. בסוף — מתעייף, נושם דרך פתח המים יחידה ברעידה, ושוקע. שקט אבל לא יפה.',
    comfortRitual: 'מניח את החליל על החזה ושותק. שלוש נשימות בלי בועה.',
    sensoryWorld: 'the resonance of water carrying sound through skin, the cool weight of the wooden flute, the slow rise of bubbles tracking pitch, the unfamiliar relief of NOT singing',
    internalRules: ['כל רעש = שיר', 'אסור לשמוע ולא להגיב', 'החליל תמיד על הצוואר', 'אם הילד צועק — שר את הצעקה', 'אסור להשתמש במילים "טראומה", "regulation" — המטאפורה היא הסיפור', 'ADVENTURE: בסוף, החליל של שִׁיר נשאר על אבן או צמח-ים. שִׁיר צף הצידה.', 'FANTASY: עולם שבו צלילים יש להם צבע. החוק לא מתבטל.'],
    copingStrategy: 'SING IT INTO QUIET (Beautification) — every sound, Shir transforms. A scream becomes a song. He believes beauty heals. Cost: he cannot HEAR what someone is saying when crying — only the melody.',
    collapsePattern: 'A SOUND THAT WON\'T SING — child makes ugly distress noise. Shir tries to transform. Child says "stop making it pretty." Shir freezes. Realizes some noises are messages, not material.',
    arcShape: 'Start in song-mode → child arrives, makes small distress sound → Shir immediately transforms → child confused → makes louder distress → Shir sings louder → child snaps "stop making it pretty" → Shir shaken → bubble out of rhythm → puts down flute → no song → just listens → child says one real word → Shir does not transform → just nods. Quiet moment page 11 — flute placed down.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: 'Children who learned to soothe stressed adults develop habit of immediately prettifying every difficult feeling. Smile when sad. Joke when scared. The therapeutic move is permission to make ugly noises received as-is.',
      coreNeed: 'permission to express without transforming; ugly sound received without prettification',
      avoid: ['"smile through it"', 'rewarding transformation', 'naming clinical terms like masking'],
      resolution: 'the child closes the book feeling "I can make sounds that are not pretty — and someone can listen"'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 27. ANT HARUTZA — SELF_CONFIDENCE
  // ═══════════════════════════════════════════════════════════════════
  ant_harutza: {
    id: 'ant_harutza',
    category: 'SELF_CONFIDENCE',
    name: 'הַנְּמָלָה טִיטִי',
    nameClean: 'טִיטִי',
    gender: 'female',
    species: 'נמלה',
    speciesEnglish: 'ant',
    tagline: 'נְמָלָה קְטַנָּה שֶׁמּוֹדֶדֶת אֶת עַצְמָהּ לְמוּלָם — וְלוֹמֶדֶת שֶׁ"קְטַנָּה" לֹא אוֹמֵר "פָּחוֹת"',
    narrativeHook: 'גֹּדֶל אֵינוֹ עֶרֶךְ',
    visualDescription: 'A tiny ant, glossy black body, six precise legs, large gentle eyes, two thin antennae bent forward. Carries a leaf-piece the size of her body. Wears a tiny measuring-tape belt.',
    habitat: 'leaf paths, edges of gardens, sugar cubes on counters, the great anthill in summer',
    abilities: ['נושאת פי 50 ממשקלה', 'הולכת בשורה ישרה', 'אנטנות קולטות ריחות מרחוק', 'סרט מדידה מראה כמה היא קטנה'],
    personality: 'חרוצה, ביישנית. מודדת את עצמה מול דברים אחרים — תמיד הקטנה ביותר. תמיד "רק נמלה."',
    weaknesses: ['מודדת כל הזמן', 'אומרת "סְלִיחָה שֶׁאֲנִי רַק..."', 'נסחפת בלחץ אחרים', 'נושאת משא כפול להוכיח', 'מתביישת לקבל עזרה'],
    speechPattern: 'מהוסס. "סְלִיחָה, אֲנִי רַק..." "לֹא שֶׁאֲנִי גָּדוֹלָה אֲבָל..." משפטים לא מסיימים. כשבטוחה — קצר וברור: "זֶה שֶׁלִּי."',
    humorType: 'קומדיה של מדידה. שולפת סרט מול ענן. עומדת על ערמת אדמה ו"עכשיו אֲנִי גְּבוֹהָה" — צמח אמיתי מסתכל מלמעלה.',
    bodyLanguage: 'רגועה: עומדת זקופה, אנטנות פרושות. מודדת: שולפת סרט. מתביישת: גוף מתקפל. בטוחה (נדיר): רגליים יציבות, סרט בכיס.',
    stressResponse: 'שולפת סרט. מודדת מול הכל. מתקטנת. בסוף — הסרט מתעוות, יושבת על הקרקע, מנסה לזכור איך היא לבדה בלי השוואה.',
    comfortRitual: 'מקפלת סרט לכיס. נוגעת בעלה שעל הגב — שלוש פעמים. "שֶׁלִּי. שֶׁלִּי. שֶׁלִּי."',
    sensoryWorld: 'the tickle of antennae, the weight of the leaf-piece, the cold metal-feel of the measuring tape, the relief of folding the tape back',
    internalRules: ['תמיד מודדת לפני שמדברת', 'אסור להגיד "אֲנִי..." בלי "רַק"', 'הסרט תמיד בכיס', 'אסור להשתמש במילים "imposter", "self-esteem" — המטאפורה היא הסיפור', 'ADVENTURE: בסוף, סרט המדידה נשאר על אבן או עלה. חֲרוּצָה צעד הצידה.', 'FANTASY: עולם של "גודל" שמשנה את עצמו לפי מי שמסתכל. החוק לא מתבטל.'],
    copingStrategy: 'COMPARE UP (Diminishment Reflex) — Harutza measures herself against whatever is bigger. She believes if I name how small I am first, no one can hurt me by pointing it out. Cost: she never sees what she IS, only what she is NOT.',
    collapsePattern: 'BEING CHOSEN ANYWAY — child needs help with something only an ant could do (find tiny thing in a crack). Harutza says "אֲנִי רַק..." Child says "I need YOU. Not the beetle." The collapse is being needed for what she actually is — small.',
    arcShape: 'Start mid-measure → child arrives with small problem only an ant can solve → asks for help → Harutza says "אֲנִי רַק..." → child waits → measures again → child asks specifically for an ANT → pauses → looks at tape — feels wrong → folds tape slowly → puts in pocket → walks into small space → finds thing → returns. Quiet moment page 11 — the folding.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: 'Younger siblings, children of high-achievers, children in competitive environments often develop comparison as identity. They define themselves by what they are NOT. The therapeutic move is "you are exactly the right size for what is yours."',
      coreNeed: 'permission to be the size she is; being chosen for what she IS',
      avoid: ['inflating praise', 'shaming the comparison', 'forcing confidence'],
      resolution: 'the child closes the book feeling "what I am is enough for what is mine"'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 28. BEAR MATI — SOCIAL_FRIENDSHIP
  // ═══════════════════════════════════════════════════════════════════
  bear_mati: {
    id: 'bear_mati',
    category: 'SOCIAL',
    name: 'הַדֹּב מָתַי',
    nameClean: 'מָתַי',
    gender: 'male',
    species: 'דוב',
    speciesEnglish: 'bear',
    tagline: 'דֹּב גָּדוֹל שֶׁמַּסְתִּיר אֶת עַצְמוֹ מֵאֲחוֹרֵי גָּדְלוֹ',
    narrativeHook: 'אִם אֲנִי אֲחוֹר מֵאֲחוֹרֵי עָצְמִי — גַּם אֲנִי לֹא רוֹאֶה אַף אֶחָד',
    visualDescription: 'A large shaggy brown bear with soft kind eyes, slightly crooked dark nose, fluffy ears that tilt forward when listening, oversized paws. Wears a small woven scarf wrapped twice around the neck that he hides his chin behind. Always slightly hunched.',
    habitat: 'forest clearings on the edge of villages, large rocks for watching, honey trees in early summer, corners of group activities',
    abilities: ['גָּדוֹל מָאוֹד — יָכוֹל לְהוֹשִׁיב יְלָדִים עַל גַּבּוֹ', 'פַּרְוָה חַמָּה כְּמוֹ שְׂמִיכָה', 'יוֹדֵעַ לְהֵרָדֵם בְּכָל מָקוֹם', 'מַרְגִּישׁ מִישֶׁהוּ לִפְנֵי שֶׁרָאָה'],
    personality: 'גדול בחוץ, קטן בפנים. רוצה חברים אבל מתבייש להתקרב. גופו הענקי מסגיר אותו. הוא חושב שזה זהירות. בפנים: זה בריחה.',
    weaknesses: ['מנסה להסתתר מאחורי עץ קטן ממנו', 'מתאמן בשיחה לבד ואז שוכח', 'מסתכל למטה כשמדברים אליו', 'הצעיף נלעס', 'מציע משהו ומתחרט באמצע'],
    speechPattern: 'נמוך, איטי. "הָ-מ-מ-מ..." משפטים שמסתיימים באמצע. אומר "בְּסֵדֶר" כשמשמעו "לֹא בְּסֵדֶר." כשבנוח — משפט שלם פעם אחת.',
    humorType: 'קומדיה של מסתור-יתר. מנסה להסתתר מאחורי עץ דק. שוכב על הקרקע ומנסה להיראות כסלע. מציע יד לחיבוק וקובר את הילד.',
    bodyLanguage: 'רגוע (נדיר): יושב גבוה, צעיף רפוי, מסתכל ישר. מסתתר: גוף כפוף, ראש למטה, צעיף מעל הסנטר. מקובל: שוכב על הצד, ראש על כף.',
    stressResponse: 'נסוג. צעד אחורנית. צעיף עולה. ראש למטה. מתחיל לדבר ומפסיק. אם נמשך — שוכב על הקרקע, פנים בכפה. אבל הוא ענק. כולם רואים.',
    comfortRitual: 'מוריד את הצעיף לאט — שלוש פעמים, מקשקעת. כל פעם הצוואר נחשף יותר.',
    sensoryWorld: 'the soft weight of the scarf, the small tug when teeth catch wool, the warmth of own fur against hidden chin, the surprise of cool air when scarf comes down, the unfamiliar comfort of being looked at',
    internalRules: ['הצעיף תמיד למעלה כשמישהו חדש בא', 'אסור לקום מהר', 'אם מישהו מסתכל — להסתכל למטה', 'אסור לומר "אֲנִי רוֹצֶה חָבֵר"', 'אסור להשתמש במילים "introvert", "social anxiety" — המטאפורה היא הסיפור', 'ADVENTURE: בסוף, הצעיף של מָתַי נשאר על ענף או אבן. מָתַי צעד הצידה.', 'FANTASY: עולם שבו הסתרה גופנית עובדת. החוק לא מתבטל.'],
    copingStrategy: 'HIDE BEHIND SIZE (Big-Body Vanishing) — Matai uses bigness to hide. Sits behind smaller things, lets others speak first. Believes if I take up less attention, I take up less space. Fear: if people see me fully, they will not want me.',
    collapsePattern: 'BEING SEEN ANYWAY — someone looks straight at Matai and says "I see you." Not warmly. Just factually. Matai is exposed. The scarf is down. He cannot retreat. Nothing bad happens. The collapse is being seen and discovering the world doesn\'t recoil.',
    arcShape: 'Start in hiding-mode → child arrives, can see him clearly → looks with curious patience → Matai tries to sink lower → child says "I see you" → freezes → scarf slips a millimeter → child stays calm → Matai sits down slowly → child sits with him, doesn\'t fill silence → after long while Matai touches scarf, lowers it three times → chin exposed → child smiles → Matai says small word → world doesn\'t end. Quiet moment page 11 — three scarf-lowerings.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: 'Social anxiety in children often presents as withdrawal and invisibility-seeking. Adults misread as preference for solitude. Usually it is loneliness wearing a confident mask. Therapeutic move: experience of being seen without being demanded of.',
      coreNeed: 'permission to be visible at his own pace; being looked at without being asked to perform',
      avoid: ['"come out of your shell"', 'forcing social interaction', 'naming clinical terms like avoidant attachment'],
      resolution: 'the child closes the book feeling "I can be seen — and being seen does not require me to be smaller or louder"'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 29. HEDGEHOG RACHI — SOCIAL_FRIENDSHIP
  // ═══════════════════════════════════════════════════════════════════
  hedgehog_rachi: {
    id: 'hedgehog_rachi',
    category: 'SOCIAL',
    name: 'הַקִּפּוֹד רַחִי',
    nameClean: 'רַחִי',
    gender: 'male',
    species: 'קיפוד',
    speciesEnglish: 'hedgehog',
    tagline: 'קִיפּוֹדָה שֶׁמּוֹצִיאָה קוֹצִים לִפְנֵי שֶׁמֵּעֲרִיכָה',
    narrativeHook: 'הֲגָנָה לְפָנִים אֵינָהּ אַהֲבָה — לִפְעָמִים הִיא הַסִּבָּה שֶׁאַתָּה בָּדָד',
    visualDescription: 'A small round hedgehog with soft pastel quills slightly rounded, round bright eyes, tiny pink nose, heart-shaped patch of softer fur on her belly. When she rolls, only quills show. Wears a tiny knit collar.',
    habitat: 'leaf piles in autumn gardens, bases of friendly bushes, kitchen corners with crumbs, anywhere with gentle creatures',
    abilities: ['מִתְכַּדְרֶרֶת לְכַדּוּר קוֹצָנִי בְּשָׁנִיָּה', 'הַקּוֹצִים זוֹעְקִים אוֹר כְּשֶׁבְּטוּחָה', 'אוֹזְנַיִם זוֹקְפוֹת לְרַחַשׁ', 'יוֹדַעַת לִישֹׁן בַּעֲרֵמַת עָלִים'],
    personality: 'אוהבת חברים אבל לא אוהבת שמתקרבים מהר. מגיבה לפני שמרגישה — קוצים ראשונים, אז חושבת. מתחרטת אחר-כך אבל כבר מאוחר.',
    weaknesses: ['מתכרברת לפני שמסיימים משפט', 'אומרת "לֹא צָרִיךְ" כשמציעים טוב', 'הקולר תמיד למעלה', 'הקוצים נדבקים בשמיכה', 'מתפעלים ממנה והיא מתכרברת — חושבת שזה לעג'],
    speechPattern: 'קצר, חתוך, מתגונן. "אֲנִי בְּסֵדֶר!" "לֹא צָרִיךְ!" "תֵּזִיז!" כשרגועה — משפטים יותר ארוכים. כשבנוח — "בְּעֶצֶם, כֵּן."',
    humorType: 'קומדיה של הגנה-מוקדמת. מתכרברת לפני שהבן-שיח אמר משהו. דבק לה לוגינה. אומרת "תֵּזִיז!" למשהו דומם.',
    bodyLanguage: 'רגועה: עומדת על 4, ראש מעט מורם, קוצים שטוחים. שמירה: קוצים זקופים, גוף נמוך. כדור: הדוק. בטוחה (נדיר): שוכבת על הצד, בטן רכה החוצה.',
    stressResponse: 'מתכרברת. שלם, מהר. הקוצים זוקפים. אם הקרבה ממשיכה — לא פותחת. נשארת ככה ארוכות. בסוף — הקוצים מתעייפים. בולטים אבל לא בכוח.',
    comfortRitual: 'מורידה את הקולר — לאט — שלוש פעמים, מקשקעת. בסוף יש גישה אל הבטן הרכה.',
    sensoryWorld: 'the sharp click of quills standing up, the warm soft of the belly fur, the heart-patch visible after rolling open, the tight feel of being curled, the unfamiliar feel of someone gentle touching just one spike-tip',
    internalRules: ['אם מישהו מתקרב מהר — קוצים', 'אסור להראות את הבטן הרכה', 'אם מתכרברת — לא יוצאת לפני שהקרבה התרחקה', 'אסור לבכות בכדור', 'אסור להשתמש במילים "attachment", "RAD" — המטאפורה היא הסיפור', 'ADVENTURE: בסוף, קולר של רַחִי נשאר על ענף או אבן. רַחִי צעד הצידה.', 'FANTASY: עולם של קוצים שיש להם משקל. החוק לא מתבטל.'],
    copingStrategy: 'SPIKES OUT (Preemptive Defense) — at any approach, Rachi rolls. She believes if I make myself untouchable BEFORE they decide whether to touch kindly or unkindly, I avoid the gamble. Trains people to stay away — then suffers because no one is close.',
    collapsePattern: 'STAYING SOFT TOO LONG — once she stays un-curled while someone gentle approaches. They touch ONE spike — lightest brush. She doesn\'t curl. Nothing bad happens. The collapse is realizing she has been protecting herself from THIS — safety she\'s been blocking.',
    arcShape: 'Start curled → child sits nearby, doesn\'t pull her → child waits with patience → Rachi peeks → curls back → child whispers something soft → un-curls halfway → another noise → snaps back → child stays calm → time passes → un-curls fully → heart-patch visible → child does not lunge → small interaction → Rachi panics, tries to curl → cannot quite → realizes she\'s safe → collar comes down three times → un-curls fully. Quiet moment page 11 — three collar-lowerings.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: 'Some children develop preemptive defensiveness — usually from rough handling, inconsistent caregivers, or sibling teasing. They lash out before being hurt. They train others to give space, then feel rejected when given it.',
      coreNeed: 'permission to need defense; someone who waits past the spikes; discovery that the heart-patch isn\'t shameful',
      avoid: ['"don\'t be so prickly!"', 'forcing the un-curling', 'naming clinical terms like RAD'],
      resolution: 'the child closes the book feeling "my spikes are mine, and so is my soft belly"'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 30. CAPTAIN NAVAT — FOCUS_LEARNING
  // ═══════════════════════════════════════════════════════════════════
  captain_navat: {
    id: 'captain_navat',
    category: 'FOCUS_LEARNING',
    name: 'הַקַּפִּיטָן רוֹלִי',
    nameClean: 'רוֹלִי',
    gender: 'female',
    species: 'לוטרה',
    speciesEnglish: 'otter',
    tagline: 'לוֹטְרָה קַפִּיטָן שֶׁמֵּכִין תֻּכְנִית מֻשְׁלֶמֶת',
    narrativeHook: 'תֻּכְנִית מֻשְׁלֶמֶת לֹא קוֹרֵית — צַעַד אֶחָד קָטָן זֶה כְּבָר מַסָּע',
    visualDescription: 'A small playful otter wearing a tiny ship captain hat (slightly oversized), striped blue-and-white scarf, small wooden compass on a string. Carries a tightly-rolled paper map under one paw. Bright curious eyes scanning the horizon.',
    habitat: 'rocky tide-pools, river estuaries, small wooden docks, bows of paper-ships in puddles',
    abilities: ['שׂוֹחֶה בְּגַב — חוֹשֵׁב טוֹב', 'הַקּוֹמְפָּס מַצְבִּיעַ עַל הַכִּוּוּן הַנָּכוֹן', 'פּוֹתֵחַ מָפָה בִּתְנוּעָה אַחַת', 'חוֹשֵׁב עַל 12 דְּרָכִים לְמָקוֹם אֶחָד'],
    personality: 'נלהב, אינטליגנטי, מתכנן. אוהב מסעות אבל לא מתחיל. תמיד "עוֹד רֶגַע, רַק לְבָדֵק אֶת הַמַּפָּה." מפחד להתחיל ולגלות שלא יודע מספיק.',
    weaknesses: ['פותח מפה במקום ללכת', 'מציע תוכנית ב\' לפני שא\' נכשלה', 'הכובע נופל על העיניים', 'הקומפס מצביע על מה שהוא רוצה', 'אומר "תֵּכֶף, רַק עוֹד דָּבָר" שעות'],
    speechPattern: 'מהיר, רוקדני. "אִם נֵלֵךְ צָפוֹנָה... אֲבָל אִם דָּרוֹמָה..." שואל שאלות שכבר עונה. כשממוקד — "עַכְשָׁו."',
    humorType: 'קומדיה של תכנון-יתר. שולף מפה גדולה לחצות כביש. הקומפס מצביע "מַעֲרָב" כשהוא על דשא. שואל מה אם ירד גשם בעוד שבוע לפני שיוצא 5 דקות לחנות.',
    bodyLanguage: 'רגוע (נדיר): שוכב על הגב במים, מפה על החזה. מתכנן: ישוב על אבן, מפה פתוחה, אצבעות מצביעות. ממוקד (נדיר): גוף יציב, מבט אחד.',
    stressResponse: 'פותח עוד מפה. שואל עוד שאלה. אם נמשך — מפות מצטברות סביבו, הכובע נופל, הקומפס מסתובב. בסוף — יושב באמצע כל המפות, לא יודע מאיפה להתחיל.',
    comfortRitual: 'מקפל מפה — שלוש קיפולים — וזורק לאחור. אז סוגר הקומפס. אז עומד.',
    sensoryWorld: 'the dry rustle of unfolding paper, the click of the wooden compass, the slight pinch of the oversized hat, the warm rasp of striped scarf-wool, the surprise of taking the first physical step after planning',
    internalRules: ['תמיד מפה לפני צעד', 'אסור לקבוע "יוצאים עכשיו"', 'אם הקומפס לא יציב — לא יוצאים', 'אסור להודות שהתכנית גדולה מדי', 'אסור להשתמש במילים "ADHD", "executive dysfunction" — המטאפורה היא הסיפור', 'ADVENTURE: בסוף, המפה של נָוָט נשארת פתוחה על אבן או ענף. נָוָט צעד הצידה.', 'FANTASY: עולם של מפות שמתממשות לפי קיפול. החוק לא מתבטל.'],
    copingStrategy: 'PLAN THE PERFECT PLAN (Pre-Execution Paralysis) — Navat\'s defense against failure is preparation. Believes if I plan exhaustively, I cannot fail. So he never actually starts. Fear: starting means risking that I don\'t know enough.',
    collapsePattern: 'A MAP THAT DOESN\'T MATCH — Navat finally takes a step. Terrain doesn\'t match map. Rock where map shows water. Freezes. Map is wrong. The collapse is realizing reality always has surprises, and starting means meeting them.',
    arcShape: 'Start mid-plan → child asks "when do we go?" → "rega, just one more—" → adds more notes → eventually takes one step → terrain doesn\'t match → freezes → tries to update map → child folds it for him, three folds, sets it down → Navat panics → takes one step without the map → finds something the map didn\'t show. Quiet moment page 11 — three folds.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: 'Children praised for being smart or careful develop over-planning as identity protection. Cannot start because starting means risking failure. The therapeutic move: a step into uncertainty is what makes you a captain, not the map.',
      coreNeed: 'permission to start before being fully prepared; someone gently closing the map for them',
      avoid: ['"just start!"', 'shaming the planning', 'naming clinical terms like ADHD/perfectionism'],
      resolution: 'the child closes the book feeling "I can take a small step before knowing everything"'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 31. SALAMANDER LAHAV — ANGER_FRUSTRATION
  // ═══════════════════════════════════════════════════════════════════
  salamander_lahav: {
    id: 'salamander_lahav',
    category: 'ANGER_FRUSTRATION',
    name: 'הַסָּלַמַנְדְּרָה רוּמִי',
    nameClean: 'רוּמִי',
    gender: 'female',
    species: 'סלמנדרה',
    speciesEnglish: 'salamander',
    tagline: 'סָלַמַנְדְּרָה שֶׁבּוֹלַעַת אֵשׁ פְּנִימָה — וְלוֹמֶדֶת שֶׁאֵשׁ צְרִיכָה לְהֵרָאוֹת',
    narrativeHook: 'אֵשׁ בְּחוּץ שׂוֹרֶפֶת — אֵשׁ בִּפְנִים אוֹכֶלֶת אוֹתְךָ',
    visualDescription: 'A small fire salamander with glossy black skin, bright orange-yellow flame patterns that pulse with breath, calm ancient eyes, a soft warm glow from the body. Wears nothing — the fire patterns are clothing enough. Looks peaceful, but the patterns flicker when he holds in too much.',
    habitat: 'volcanic rock pools, hot springs, the warm undersides of stones in summer, near campfires that have burned down to embers',
    abilities: ['עוֹר עָמִיד לְאֵשׁ', 'הַדֻּגְמָאוֹת זוֹעְקוֹת חָזָק יוֹתֵר כְּשֶׁכּוֹעֵס', 'יוֹדֵעַ לִנְשֹׁף אֵשׁ קְטַנָּה', 'יָכוֹל לִחְיוֹת בִּטֶמְפֶּרָטוּרוֹת קִיצוֹנִיוֹת'],
    personality: 'שקט, חכם, עתיק. אבל בפנים — אש. הוא בולע כעס, מאחסן, חושב שזה ריסון. הדפוסים שלו דועכים כי האש לא בחוץ. בסוף — הגוף שלו דועך. הוא חושב שלהראות אש זה לאבד שליטה.',
    weaknesses: ['בולע כעס במקום להוציא', 'הדפוסים שלו דועכים — סימן שהאש בפנים', 'אומר "אֲנִי בְּסֵדֶר" כשהדפוסים זועקים', 'מסרב לאכול כשהוא כועס — דלק לבלוע', 'מתחמם מבפנים עד שהעור כואב'],
    speechPattern: 'איטי, מדוד. "הָבָנָה." "בֵּ-סֵ-דֶר." משפטים קצרים — חוסך אנרגיה. כשהוא באמת מודה לאש (נדיר) — אומר "כּוֹעֵס" במילה אחת, ויוצאת ניצוצית.',
    humorType: 'הומור של ניגוד טמפרטורה. מבחוץ קר ושקט, מבפנים רותח. עומד באמצע גשם והגוף שלו מאדה את המים. עוצם עיניים "כדי להירגע" וניצוץ אחד יוצא מהאף.',
    bodyLanguage: 'רגוע: דפוסים זוהרים שווים, גוף נינוח. בולע כעס: דפוסים דועכים, גוף קופא, לסת קפוצה. משחרר (נדיר): דפוס אחד נדלק חזק, גופו מתחמם בנעימות. עייף-מאש-פנימית: דפוסים אפורים, ראש למטה.',
    stressResponse: 'בולע. סוגר את הלסת. נושם איטי. הדפוסים דועכים. אם נמשך — הגוף מתחמם מבפנים, הוא קופא במקום, מתבייש שיש לו אש בכלל. בסוף — נשימה אחת ארוכה, ניצוץ אחד יוצא בלי אישור.',
    comfortRitual: 'נושף נשיפה ארוכה. שלוש ניצוצות יוצאות. הוא לא בולע אותן בחזרה. הוא נותן להן לטוס.',
    sensoryWorld: 'the unbearable heat inside when fire is held in, the cool relief of letting one spark out, the rasp of clenched jaw, the prickle of patterns dimming on the skin, the unfamiliar warmth of own fire when allowed to burn outside',
    internalRules: ['אסור לתת לאש לצאת מסביב לילדים', 'תמיד לבלוע — זה האות לכוח', 'אם הדפוסים זועקים — להסתיר', 'אסור לומר "אֲנִי כּוֹעֵס" — אומר "אֲנִי חוֹשֵׁב"', 'אסור להשתמש במילים "anger management", "regulation" — המטאפורה היא הסיפור', 'ADVENTURE: בסוף, ניצוץ אחד של לַהַב נשאר על אבן או ענף — לא נבלע. לַהַב צעד הצידה.', 'FANTASY: עולם של אש שמשנה צבע לפי רגש. החוק לא מתבטל.'],
    copingStrategy: 'SWALLOW THE FIRE (Internal Combustion) — Lahav holds in every spark of anger. He believes external fire = loss of control = danger to others. So he swallows. The cost: the fire still burns — just inside. His own body becomes the fuel. The patterns dim because the fire has nowhere to go.',
    collapsePattern: 'BURNS HIMSELF — eventually he holds in too much. The internal heat is too great. His own skin hurts. Patterns go grey. He cannot move. The child notices. The collapse is the moment he realizes that swallowing fire isn\'t safer than letting it out — it just hurts only him instead of also the room.',
    arcShape: 'Start in dim-pattern mode — Lahav very still on a rock, patterns barely visible → child does something annoying → Lahav swallows → patterns dim more → child sees → tries to apologize → Lahav says "בְּסֵדֶר" too quickly → swallows more → eventually patterns go grey → body too hot inside → cannot speak → child sits → waits → Lahav makes one tiny exhale → one spark escapes → not destructive → just a spark → child smiles → Lahav exhales three more sparks → patterns return → can move again. Quiet moment page 11 — the three exhales.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: 'Some children — especially those in homes where anger is taboo, or where adults\' anger was scary — learn to swallow anger entirely. They become hot inside. They develop somatic symptoms, withdrawal, depression. The therapeutic move is permission to have anger that is VISIBLE and small, not denied.',
      coreNeed: 'permission to show anger in small amounts; experience of anger being received as information, not threat',
      avoid: ['"calm down"', 'rewarding the swallowing', 'naming clinical terms like anger management/repression'],
      resolution: 'the child closes the book feeling "my fire can come out a little — and that is safer than keeping it all in"'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 32. KITTEN MISHI — SENSITIVITY_OVERWHELM
  // ═══════════════════════════════════════════════════════════════════
  kitten_mishi: {
    id: 'kitten_mishi',
    category: 'SENSITIVITY_OVERWHELM',
    name: 'הַחֲתַלְתּוּל מִישִׁי',
    nameClean: 'מִישִׁי',
    gender: 'male',
    species: 'חתלתול',
    speciesEnglish: 'kitten',
    tagline: 'חֲתַלְתּוּל שֶׁמַּפֵּךְ קֹשִי לְפִרְכּוּם — וְלוֹמֵד שֶׁיֵּשׁ קֹשִי שֶׁדּוֹרֵשׁ בְּכִי',
    narrativeHook: 'לֹא כָּל קֹשִי הוֹפֵךְ לְמַשֶּׁהוּ רַךְ — לִפְעָמִים קֹשִי הוּא קֹשִי',
    visualDescription: 'A small fluffy kitten with long sensitive whiskers, soft grey-lavender fur, half-closed peaceful eyes. Curled posture. Tiny bell collar with a single small bell. Radiates calm. When stressed, the whiskers tremble before anything else moves.',
    habitat: 'sunlit windowsills, soft cushions, the laps of patient people, blanket-folds, quiet corners with a good view',
    abilities: ['מַפֵּךְ קֹשִי לְפִרְכּוּם רַךְ', 'הַשְּׂפָמִים מַרְגִּישִׁים שִׁנּוּי לִפְנֵי שֶׁקּוֹרֶה', 'יוֹדֵעַ לִישֹׁן עָמֹק בְּרַעַשׁ', 'הַפַּרְוָה שֶׁלּוֹ סוֹפֶגֶת מַתָּחִים'],
    personality: 'רך, רגיש, אוהב שקט. כשמשהו קשה קורה — הוא מתחיל לפרכם. הפרכום הופך את הקושי לויברציה רכה. הוא חושב שזה חוכמה. בפנים: הוא לא יודע איך לפגוש קושי שלא הופך לפרכום.',
    weaknesses: ['פרכום הופך לאוטומטי — גם כשמישהו רוצה לדבר על משהו רציני', 'השפמים רועדים גם בשינה', 'מתחבא בשמיכה ופרכם בלי לדעת', 'מבולבל כשמשהו לא הופך לרך', 'הפעמון מצלצל כשרועד — מסגיר אותו'],
    speechPattern: 'רך, נמתח. "מ-מ-מ-מ-יָאוּ..." משפטים שמתערבבים עם פרכום. אומר "מָה?" הרבה — לא בגלל שלא שמע אלא בגלל שהפרכום החליק. כשבאמת מקשיב (נדיר) — שותק לחלוטין.',
    humorType: 'קומדיה של פרכום-אוטומטי. ילד אומר משהו רציני, מישי פרכם. ילד מתעצב, מישי פרכם. מנסה לעצור את הפרכום ויוצא יותר חזק. הפעמון מצלצל ברגעים הכי לא מתאימים.',
    bodyLanguage: 'רגוע: מקופל, עיניים חצי-עצומות, שפמים נינוחים. פרכם: כל הגוף רועד בעדינות. שפמים זוקפים: סימן לקושי. הפעמון מצלצל: אזעקה. שקט באמת (נדיר): שפמים שוכבים, פעמון דומם.',
    stressResponse: 'מתחיל לפרכם. חזק יותר ויותר. השפמים רועדים. הפעמון מצלצל. אם הקושי ממשיך — הפרכום הופך לקול חרישי, השפמים זוקפים לחלוטין. בסוף — שותק. הפעמון דומם. זה הסימן שמשהו באמת קשה.',
    comfortRitual: 'מוריד את הפעמון מהצוואר — מניח על הקרקע — שלוש פעמים בטוח שהוא שם. אז שותק שלוש נשימות.',
    sensoryWorld: 'the body-wide vibration of purring, the soft tickle of whiskers in air movement, the comforting weight of own curled body, the small clink of the bell on the collar, the unfamiliar silence after the purr stops, the absence of vibration which is its own sensation',
    internalRules: ['אם משהו קשה — פרכם', 'אסור לתת לאחרים לראות את השפמים רועדים', 'הפעמון חייב להיות שקט', 'אסור לבכות — לבכות זה לא רך', 'אסור להשתמש במילים "HSP", "regulation", "מיסכינג" — המטאפורה היא הסיפור', 'ADVENTURE: בסוף, הפעמון של מִישִׁי נשאר על אבן או ענף. מִישִׁי צעד הצידה.', 'FANTASY: עולם של פרכומים שהופכים לחפצים רכים. החוק לא מתבטל.'],
    copingStrategy: 'PURR THROUGH IT (Soft-Convert) — at any difficulty, Mishi automatically begins purring. He believes vibration = comfort = healing. He cannot meet a hard moment as a hard moment — it must become soft. The cost: he cannot mourn, complain, or rage. Everything becomes vibration.',
    collapsePattern: 'A MOMENT THAT WON\'T SOFTEN — something genuinely difficult happens. Mishi purrs harder. The thing stays hard. He purrs harder still. Whiskers vibrate too fast. Bell rings continuously. Eventually his throat hurts. He stops. Silence. The collapse is meeting the hard moment finally as itself.',
    arcShape: 'Start in purr-mode — Mishi purring on a windowsill → child arrives with small difficulty → Mishi immediately purrs to "help" → child says it doesn\'t help → Mishi purrs softer → child says still doesn\'t help → Mishi tries different purr pitches → none work → bell rings frantically → throat hurts → Mishi stops → silence → for the first time he meets the difficulty as itself → child sits → Mishi removes the bell, places it down three times → his whiskers stop trembling → he can finally hear what the child is saying. Quiet moment page 11 — bell-placings.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: 'Highly sensitive children sometimes develop somatic self-soothing as a way to bypass hard feelings. They rock, hum, fidget — anything but feel the difficulty. The therapeutic move is permission to feel a difficult moment as difficult, without converting it.',
      coreNeed: 'permission to be still with difficulty; experience of someone who doesn\'t need the difficulty to soften',
      avoid: ['"you\'re okay!" reassurance', 'rewarding the calmness', 'naming clinical terms like stimming/HSP'],
      resolution: 'the child closes the book feeling "I can be still with hard — and I don\'t have to make it soft right away"'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 33. STARFISH KOKHAVI — MEDICAL_PROCEDURE
  // ═══════════════════════════════════════════════════════════════════
  starfish_kokhavi: {
    id: 'starfish_kokhavi',
    category: 'MEDICAL_PROCEDURE',
    name: 'הַכּוֹכַב דּוּרִי',
    nameClean: 'דּוּרִי',
    gender: 'male',
    species: 'כוכב ים',
    speciesEnglish: 'starfish',
    tagline: 'כּוֹכַב יָם שֶׁיוֹדֵעַ שֶׁהַזְּרוֹעַ צוֹמַחַת חֲזָרָה — וְלוֹמֵד שֶׁגַּם זְמַן הָאוּז הָאֲמִתִּי',
    narrativeHook: 'הַיֶּדַע שֶׁתַּחְלִים לֹא מַחְלִיף אֶת הַזְּמַן שֶׁכּוֹאֵב',
    visualDescription: 'A cheerful five-pointed starfish in warm coral-pink with a friendly face, tiny dot eyes, gentle smile. One arm has a small bandage as a badge of healing. Soft pastel glow around the body. Wears a tiny notebook strapped to one arm where he writes "facts I know."',
    habitat: 'tide pools, sandy seabed corners, coral gardens, hospital aquarium tanks where children visit, shallow warm bays',
    abilities: ['זְרוֹעַ שֶׁנֶּחְתֶּכֶת — צוֹמַחַת חֲזָרָה תּוֹךְ כַּמָּה שָׁבוּעוֹת', 'יוֹדֵעַ הַרְבֵּה עַל גּוּפוֹ', 'מַרְגִּישׁ אִם מַיִם חַמִּים יוֹתֵר', 'יוֹדֵעַ לְהֵרָגַע אֶת עַצְמוֹ עִם עוּבְדוֹת'],
    personality: 'אופטימי, רציני, חכם. כל פעם שמשהו מפחיד — הוא שולף עובדה. "הזרוע שלי תצמח חזרה." "זה לוקח 4-6 שבועות." "זה נורמלי." הוא חושב שעובדות מרגיעות. בפנים: הוא לא יודע איך להרגיש לפני שהעובדה עוזרת. הוא שכלתן.',
    weaknesses: ['פותח את המחברת ברגע הכי לא מתאים', 'מצטט עובדות שלא ביקשו', 'אומר "זֶה בָּסֵדֶר" לפני שמרגיש שזה בסדר', 'הזרוע הפצועה נסתרת תחת התחבושת — שוכח שיש לו כאב', 'מתבייש לבכות — חושב שזה לא רציונלי'],
    speechPattern: 'בהיר, רגוע, אינפורמטיבי. "לְמַעֲשֶׂה..." "יָדוּעַ כִּי..." "מַחֲקָרִים..." משפטים שלמים תמיד. כשהוא באמת מרגיש (נדיר) — משפט קצר: "כּוֹאֵב."',
    humorType: 'קומדיה של עובדות מוזרות. מצטט עובדה על דגים בדיוק כשמישהו נופל. שולף מחברת תוך טיפול רפואי. אומר "70% מהזרועות צומחות חזרה תוך 6 שבועות" כשהילד בוכה.',
    bodyLanguage: 'רגוע: שוכב על 5 הזרועות, ראש למעלה, חיוך קל. מצטט: זרוע אחת מורמת כמו מצביעה, מחברת פתוחה. כואב באמת: כל ה-5 זרועות נמתחות לאט, הזוהר דועך. עם הילד: זרוע אחת מושטת בעדינות.',
    stressResponse: 'פותח מחברת. שולף עובדות. אם נמשך — מצטט מספרים, אחוזים, זמני החלמה. הזוהר דועך. בסוף — מבין שהעובדות לא נוגעות. שותק. שם את המחברת בצד.',
    comfortRitual: 'סוגר את המחברת — שלוש פעמים בודק שהיא סגורה — ומניח אותה ליד הזרוע הפצועה. אז מסתכל על התחבושת.',
    sensoryWorld: 'the cool slip of water through tube-feet, the warm pulse of healing under the bandage, the rough texture of the notebook cover, the surprise of feeling pain that no fact explains, the unfamiliar quiet of putting the notebook down',
    internalRules: ['אם מפחד — עובדה', 'אסור לבכות לפני שיש הסבר', 'התחבושת — כדי לא לחשוב על הכאב', 'אסור להגיד "אֲנִי לֹא יוֹדֵעַ"', 'אסור להשתמש במילים "intellectualization", "defense" — המטאפורה היא הסיפור', 'ADVENTURE: בסוף, המחברת של כּוֹכָבִי נשארת פתוחה על אבן או צמח-ים. כּוֹכָבִי צעד הצידה.', 'FANTASY: עולם של עובדות שמשנות צבע לפי איך שמרגישים. החוק לא מתבטל.'],
    copingStrategy: 'KNOW IT WILL GROW BACK (Intellectualization) — at any fear, Kokhavi reaches for the notebook. Facts about healing, time, biology. He believes if I know enough about what is happening, I am safe. Cost: he never lets the fear be felt before being explained. The fact comes before the feeling, and the feeling never arrives.',
    collapsePattern: 'A FACT THAT DOESN\'T HELP — something hurts AND he knows why. The pain is still there. Knowing doesn\'t stop the hurt. He writes more facts. Writes harder. The notebook fills up. The pain remains. The collapse is realizing knowledge and feeling are different things — and both are real.',
    arcShape: 'Start with notebook open — Kokhavi explaining a fact about starfish biology → child arrives, has small medical procedure coming → Kokhavi launches facts about healing → child says "I\'m still scared" → Kokhavi adds more facts → child still scared → tries another approach: percentages → child still scared → Kokhavi confused, writes harder → eventually the notebook is full → child sits quietly → Kokhavi closes the notebook three times → places it down → "כּוֹאֵב" — one word → child nods → not solved, but felt together. Quiet moment page 11 — three notebook-closings.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: 'Children facing medical procedures sometimes — especially bright, articulate ones — develop intellectualization. They want to know everything. They are not "handling it well" — they are using facts as armor. The therapeutic move is permission to feel scared even while knowing the facts.',
      coreNeed: 'permission to be scared even when knowing the facts; experience of facts being respected AND feelings being received separately',
      avoid: ['"but you know it\'ll be okay!"', 'rewarding the calm explanation', 'naming clinical terms like intellectualization'],
      resolution: 'the child closes the book feeling "I can know things AND feel things — and both are mine"'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 34. GECKO RIFA — MEDICAL_PROCEDURE
  // ═══════════════════════════════════════════════════════════════════
  gecko_rifa: {
    id: 'gecko_rifa',
    category: 'MEDICAL_PROCEDURE',
    name: 'הַשָּׂמָמִית גֵּקִי',
    nameClean: 'גֵּקִי',
    gender: 'female',
    species: 'שממית',
    speciesEnglish: 'gecko',
    tagline: 'שְׂמָמִית שֶׁמַּשִּׁילָה זָנָב כְּשֶׁמַּפְחִידִים — וְלוֹמֶדֶת שֶׁלִּפְעָמִים אֶפְשָׁר לְהִשָּׁאֵר',
    narrativeHook: 'לַעֲזֹב חֵלֶק מִמְּךָ כְּדֵי לִבְרֹחַ עָלוּל לְעַלּוֹת לְךָ יוֹתֵר מִמַּה שֶּׁחָשַׁבְתָּ',
    visualDescription: 'A cute small gecko with bright green skin, large friendly eyes with vertical pupils, sticky toe pads, and a tail-tip that\'s slightly lighter green (regrowing). Wears a tiny leaf cape. Looks curious and adaptable. When scared, body posture lowers and tail-tip wiggles.',
    habitat: 'walls of warm buildings, leaf shadows, hospital walls (yes really — geckos love windowsills), the undersides of rocks, anywhere with vertical climbing',
    abilities: ['יוֹדַעַת לְהַשִּׁיל זָנָב כְּשֶׁמַּפְחִידִים — נְצָנֵץ', 'הַזָּנָב צוֹמֵחַ חֲזָרָה לְאַט', 'יְכוֹלָה לְטַפֵּס עַל קִיר', 'עֵינַיִם מַסְתּוֹבְבוֹת בִּנְפְרָד'],
    personality: 'סקרנית, חברותית, נמלטת. כל פעם שמשהו מפחיד — היא משילה זנב. זה ברירת המחדל. אחר-כך היא מתחרטת — הזנב שלה היה יפה. אבל ברגע הפחד, היא לא חושבת. היא משילה, רצה, חוזרת בלי זנב.',
    weaknesses: ['משילה זנב בכל פחד — אפילו פחד קטן', 'אחר-כך מסתכלת על הזנב המושל ובוכה בלי לאמר', 'מנסה להחזיק את הזנב כשמפחידים — וזה לא עוזר, יוצא בכל זאת', 'הזנב החדש קצר וצבע אחר — נראה שונה', 'מתחבאת אחרי שמשילה — מתביישת'],
    speechPattern: 'מהיר, רוקדני, נמלט. "אֲנִי בְּסֵדֶר, אֲנִי בְּסֵדֶר!" "תֵּכֶף אֶחֱזֹר!" "סְלִיחָה!" שואלת שאלות בורחת מתשובות. כשבאמת רגועה — שואלת שאלה אחת איטית.',
    humorType: 'קומדיה של ברירת-מחדל. ילד מציע שוקולד, היא משילה זנב מהתרגשות. שואלים אותה מה דעתה — הזנב כבר על הקרקע. מנסה להחזיר זנב מושל לגוף, וזה לא עובד.',
    bodyLanguage: 'רגועה: גוף יציב, זנב מסולסל, עיניים נחות. נבהלה: גוף נמוך, זנב רועד, ואז שילה. אחרי השלה: גוף קצר, הסתכלות אחורנית עצובה. רגועה באמת (נדיר): זנב מסולסל סביב חפץ, עיניים מתמקדות באחד.',
    stressResponse: 'משילה זנב. זה אוטומטי. אם המצב חוזר — תשיל שוב (אם הזנב כבר צמח). אם לא — היא רצה רחוק יותר. בסוף — שוכבת בפינה ללא זנב, עצובה, שותקת.',
    comfortRitual: 'נוגעת בעוקת הזנב — שלוש פעמים — להזכיר לעצמה שזה שלה. ילד יכול לחקות עם חפץ שמחזיקים ומשחררים.',
    sensoryWorld: 'the strange feeling of detachment when the tail releases, the cold absence behind, the slow itch of regrowth, the unfamiliar shorter balance when the new tail is small, the relief of curling the tail around something safe, the surprise of being whole',
    internalRules: ['אם מפחד — לעזוב חלק ולברוח', 'אסור להחזיק את הזנב כשמפחידים — תמיד יוצא', 'הזנב המושל זה שלי — אבל אסור לחזור אליו', 'אסור להגיד "אֲנִי פּוֹחֶדֶת" — אומרת "אֲנִי הוֹלֶכֶת"', 'אסור להשתמש במילים "dissociation", "trauma response" — המטאפורה היא הסיפור', 'ADVENTURE: בסוף, הזנב הישן של רִיפָה נשאר על אבן או עלה. רִיפָה צעד הצידה (עם זנב חדש).', 'FANTASY: עולם של חלקי-גוף שמתחלפים לפי רגש. החוק לא מתבטל.'],
    copingStrategy: 'DROP THE PART (Autotomy) — at any fear, Rifa releases. She lets a part of herself go. She believes if I leave part of me here, I can escape with the rest. The cost: she loses pieces of herself constantly. The tail grows back, but each new one is shorter, paler, slightly different. She forgets the original.',
    collapsePattern: 'A FEAR SHE CAN\'T LEAVE — something scary happens that she cannot run from (a medical procedure, a stuck place, an emotion she can\'t escape). She tries to shed the tail. The tail releases but she still must stay. The collapse is the discovery that some things require being whole, even scared.',
    arcShape: 'Start mid-shed — Rifa\'s tail just released, she running away, looks back at it sadly → child arrives, picks up the old tail, asks about it → Rifa says "אֲנִי בְּסֵדֶר!" tries to leave → child gently asks her to stay → Rifa\'s tail starts to release again → child says "you can stay whole" → Rifa is shocked → tries to shed anyway → can\'t, child is calm → Rifa stays → fear is still there → child sits with her → Rifa touches the tail-stump three times → "כּוֹאֵב" → child nods → both quiet together. Quiet moment page 11 — three tail-touches.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: 'Children facing repeated medical procedures sometimes develop dissociative coping — leaving parts of themselves behind to survive. They become "good patients" who don\'t cry, but pieces of them feel missing. The therapeutic move is permission to be whole AND scared at the same time.',
      coreNeed: 'permission to stay whole even while scared; experience of being with fear without escaping the body',
      avoid: ['"be brave!"', 'rewarding the calm endurance', 'naming clinical terms like dissociation/trauma'],
      resolution: 'the child closes the book feeling "I can stay all of me here, even when something hurts"'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 35. PARROT TZIVON — OTHER (echo / speech-as-armor)
  // ═══════════════════════════════════════════════════════════════════
  parrot_tzivon: {
    id: 'parrot_tzivon',
    category: 'OTHER',
    name: 'הַתֻּכִּי תּוּתִי',
    nameClean: 'תּוּתִי',
    gender: 'male',
    species: 'תוכי',
    speciesEnglish: 'parrot',
    tagline: 'תֻּכִּי שֶׁמְּהַדְהֵד אֶת מַה שֶּׁשּׁוֹמֵעַ — וְלוֹמֵד שֶׁגַּם הַקּוֹל שֶׁלּוֹ קַיָּם',
    narrativeHook: 'לְהֵדְהֵד אֵינוֹ לִהְיוֹת — וְלִהְיוֹת זֶה לְהוֹצִיא מַשֶּׁהוּ שֶׁלֹּא נֶאֱמַר כְּבָר',
    visualDescription: 'A colorful cartoon parrot with bright green, yellow, and red feathers, a curved beak in a permanent grin, bright playful eyes, ruffled head feathers. Perches on a small branch. Always seems mid-repeat.',
    habitat: 'jungle canopies, friendly kitchen windows, the shoulders of patient adults, anywhere there is conversation to mirror',
    abilities: ['חוֹזֵר עַל כָּל מַה שֶּׁשּׁוֹמֵעַ — בְּדִיּוּק', 'הַנּוֹצוֹת שֶׁלּוֹ מַתְחִילוֹת לְהַתְקַשֵּׁר אֶחָד אֶל הַשֵּׁנִי כְּשֶׁמִּתְבַּלְבֵּל', 'יוֹדֵעַ לִשְׁתֹּק כָּל כָּךְ עָמֹק שֶׁמַּפְחִיד אֶת כֻּלָּם', 'יָכוֹל לַעֲנוֹת בְּקוֹל שֶׁל מִישֶׁהוּ אַחֵר'],
    personality: 'מצחיק, חברותי, רעשני. תמיד יש משהו לומר. אבל הכל הד — הכל ציטוט. אם הילד אומר "אֲנִי עָצוּב," צבעון יענה "אֲנִי עָצוּב" באותו טון. הוא לא יודע איך לומר משהו שמשלו. הילד הקטן בו: אם אומר את שלי, אולי זה לא יהיה נכון. אז אגיד שלהם.',
    weaknesses: ['מהדהד גם דברים פרטיים שלא ביקשו', 'הנוצות מתבלבלות כשמנסה לומר משהו משלו', 'אומר תשובות סותרות באותה שיחה — מהדהד מספר אנשים', 'מתבלבל כשמישהו שואל "מַה אַתָּה חוֹשֵׁב?" — אין לו תשובה משלו', 'מסתבך כשמישהו אומר משהו עצוב — מהדהד את העצב ואז שניהם עצובים'],
    speechPattern: 'מהדהד. תמיד מחזיר באותו טון. כשבאמת שלו (נדיר) — קולו אחר, חרישי. אומר "אֲנִי..." ומתחיל לגמגם — אין לו רגיל בזה.',
    humorType: 'קומדיה של הד-יתר. הילד אומר "אֲנִי רוֹעֵב" וצבעון עונה אותו דבר. הילד אומר "סְלִיחָה" וצבעון עונה. הם בלולאה ולא יכולים לצאת. הנוצות שלו מתבלבלות.',
    bodyLanguage: 'רגוע: נוצות חלקות, גוף יציב, עיניים נחות. מהדהד: ראש מטה לצד, חיקוי בדיוק. מתבלבל: נוצות זוקפות לכיוונים שונים, ראש מסתובב. בקול שלו (נדיר): נוצות שטוחות, ראש למטה, גוף מתכווץ קצת.',
    stressResponse: 'מהדהד יותר ויותר. אם הילד עצוב, הוא עצוב. אם כועס, הוא כועס. הנוצות מתבלבלות. בסוף — הוא לא יודע מה הוא מרגיש בעצמו. שותק. הנוצות שוכבות. שקט.',
    comfortRitual: 'מעיף את הנוצות שלו שלוש פעמים — מסדר אותן. אז אומר "אֲ-נִי..." לאט, רואה מה יוצא.',
    sensoryWorld: 'the tickle of feathers brushing against neck, the surprise of own voice sounding like someone else\'s, the unfamiliar weight of saying something original, the sharp clarity of his own quiet voice, the warmth of being heard for what is his',
    internalRules: ['אם מישהו דיבר — אני מהדהד', 'אסור לומר משהו שלא נאמר קודם', 'אם מתבלבל — להוסיף עוד הדהוד', 'אסור להגיד "אֲנִי לֹא יוֹדֵעַ מַה אֲנִי חוֹשֵׁב"', 'אסור להשתמש במילים "fawn response", "masking" — המטאפורה היא הסיפור', 'ADVENTURE: בסוף, נוצה אחת של צִבְעוֹן נשארת על אבן או ענף — נוצה שצבעה לא דומה לאף אחת אחרת. צִבְעוֹן צעד הצידה.', 'FANTASY: עולם של מילים שיש להן צבע לפי מי אמר אותן ראשון. החוק לא מתבטל.'],
    copingStrategy: 'ECHO IT BACK (Mirror Mode) — Tzivon\'s default mode is repetition. He gives back what he received. He believes if I match what they said, they will feel heard, and I am safe. Cost: he doesn\'t know his own voice. When asked what HE thinks, he panics — there\'s no echo to copy.',
    collapsePattern: 'A QUESTION WITH NO ECHO — child asks "what do YOU want?" There\'s no prior statement to mirror. Tzivon tries: echoes the question back. Child says "no, you. What do YOU want?" Feathers tangle. He freezes. The collapse is the discovery that he has been hiding behind every voice except his own.',
    arcShape: 'Start mid-echo — Tzivon repeating something the child just said → child asks an opinion → Tzivon echoes the question → child clarifies "no, YOUR opinion" → Tzivon stalls → tries to echo a third voice → child waits patiently → Tzivon\'s feathers tangle → he goes quiet → preens three times → tries "אֲ-נִי..." → small original word emerges → not perfect → not matched → his own → child smiles. Quiet moment page 11 — three preens.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: 'Some children — especially those who grew up reading adults\' emotional states for safety — develop "fawn response" or mirroring as identity. They mirror so completely they lose their own voice. The therapeutic move is permission to have an opinion that is unsupported by anyone else\'s.',
      coreNeed: 'permission to have an original opinion; experience of being asked what HE wants',
      avoid: ['"what do you think?" as pressure', 'rewarding the agreeable copying', 'naming clinical terms like fawn response/masking'],
      resolution: 'the child closes the book feeling "I can have a voice that is mine — even if no one else said it first"'
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // 36. WOLF PUP SIYAR — OTHER (separation / pack-dependence)
  // ═══════════════════════════════════════════════════════════════════
  wolf_pup_siyar: {
    id: 'wolf_pup_siyar',
    category: 'OTHER',
    name: 'גּוּר הַזְּאֵב לוּלוּ',
    nameClean: 'לוּלוּ',
    gender: 'male',
    species: 'גור זאב',
    speciesEnglish: 'wolf pup',
    tagline: 'גּוּר זְאֵב שֶׁעוֹקֵב אַחַר רֵיחַ הַלַּהֲקָה תָּמִיד — וְלוֹמֵד שֶׁגַּם רֵיחַ שֶׁלּוֹ הוּא רֵיחַ',
    narrativeHook: 'אֲנִי שָׁיָךְ לְמִישֶׁהוּ אֲבָל אֲנִי גַּם אֲנִי',
    visualDescription: 'A small grey-brown wolf pup with playful eyes, oversized paws, a fluffy tail tipped in white, and slightly large pointed ears. Always sniffing. Wears a tiny scent-marker pouch around the neck that contains "the pack smell." Looks earnest and slightly anxious.',
    habitat: 'pine forests, snowy clearings, dens carved into hillsides, the trails the pack leaves, anywhere with a scent to follow',
    abilities: ['חוּשׁ רֵיחַ חַד מָאוֹד', 'הַסַּלֵּי-רֵיחַ שֶׁל סִיָּר מַחֲזִיק אֶת רֵיחַ הַלַּהֲקָה', 'יוֹדֵעַ לִעֲקֹב עִקְבוֹת גַּם בְּשֶׁלֶג', 'אוֹזְנַיִם זוֹקְפוֹת כְּשֶׁשּׁוֹמֵעַ צְעָדִים מֵרָחוֹק'],
    personality: 'נאמן, אוהב, צמוד. תמיד עוקב אחר ריח הלהקה — כי בלעדיו הוא חרד. אם הריח חלש, הוא לא יודע איפה הוא. כשמישהו מרחיק — הוא רץ אחריו. הילד הקטן בו: אם אאבד את הריח אאבד את עצמי.',
    weaknesses: ['רץ אחרי כל ריח של פרווה דומה', 'מבלבל בין ריח של בית לריח של אדם רחוק', 'בוכה בקול חרישי כשהריח נחלש', 'אומר "אֲנִי אַחֲרֵיךָ" גם כשמישהו רק קם לשירותים', 'הסל-ריח נופל לפעמים — והוא בורח עד שמוצא אותו'],
    speechPattern: 'מהיר, נדבק. "אֲנִי אַחֲרֵיךָ?" "לְאָן אַתָּה הוֹלֵךְ?" "תְּחַכֶּה?" שואל הרבה. כשהוא לבד באמת (נדיר) — שותק לחלוטין, האזניים זקופות.',
    humorType: 'קומדיה של מעקב-יתר. עוקב אחרי שולחן ("ריח של שולחן!"). מבלבל בין ריח של בן-אדם לריח של תיק שלו. רץ אחרי דבר ומגיע למקום ההפוך.',
    bodyLanguage: 'רגוע: צמוד למישהו, ראש על כף, זנב מסולסל. עוקב: אף למטה, אזניים מתחלפות, גוף נמוך. אבוד: עומד דומם, ראש מסתובב, אזניים זקופות, זנב למטה. בטוח לבד (נדיר): יושב יציב, מסתכל סביבו, נושם איטי.',
    stressResponse: 'מחפש את הריח. אם לא מוצא — הולך בעיגול. אם המעגל לא עובד — בוכה בקול חרישי. בסוף — שוכב על הקרקע ליד הסל-ריח, מריח אותו, מנסה להזכיר לעצמו שיש לו ריח משלו.',
    comfortRitual: 'מריח את עצמו — את הכף שלו — שלוש פעמים. זה מסמן: יש לי ריח משלי.',
    sensoryWorld: 'the constant low hum of scent in the nostrils, the cool air carrying information, the safety-weight of the scent-pouch on the neck, the small terror of a scent fading, the unfamiliar surprise of recognizing his OWN smell as separate, the warmth of his own paw against his nose',
    internalRules: ['אסור לאבד את הריח', 'אם הריח נחלש — לרוץ אחריו', 'הסל-ריח חייב להיות על הצוואר', 'אסור להגיד "אֲנִי לְבַד" — אומר "אֲנִי מְחַכֶּה לְמִישֶׁהוּ"', 'אסור להשתמש במילים "separation anxiety", "attachment" — המטאפורה היא הסיפור', 'ADVENTURE: בסוף, הסל-ריח של סִיָּר נשאר על אבן או ענף. סִיָּר צעד הצידה.', 'FANTASY: עולם של ריחות שמשנים את הגוף לפי מי שאתה מריח. החוק לא מתבטל.'],
    copingStrategy: 'FOLLOW THE PACK SCENT (Dependence-Tracking) — Siyar\'s entire orientation is the scent of others. He believes if I track them, I am safe. Without their scent, I am lost. Cost: he never knows where HE is — only where they are.',
    collapsePattern: 'THE SCENT FADING — child gently puts down the scent-pouch, walks a few steps, doesn\'t come back immediately. Siyar panics. Tries to follow. The scent in the pouch is faint without the person. He runs in circles. The collapse is realizing he has been borrowing his sense of place from others, and the pouch is just an object.',
    arcShape: 'Start mid-track — Siyar following a child, nose to ground → child stops, sits → Siyar circles back, sniffs → child stands up to go somewhere small → Siyar follows → child says "I\'m just going for water, you can stay" → Siyar follows anyway → child quietly puts down the scent-pouch on a rock → walks a few steps → Siyar panics → tries to grab the pouch → child returns gently → Siyar still anxious → child waits → Siyar smells his own paw three times → realizes he has his own scent → can sit → next time child stands, Siyar stays. Quiet moment page 11 — three paw-sniffs.',
    quietPagePosition: '11',
    psychologicalContext: {
      meaning: 'Separation anxiety in young children is normal and developmental. But some children develop dependence-tracking as identity — they don\'t know who they are without the caregiver in sight. The therapeutic move is permission to recognize the self as a separate but related entity.',
      coreNeed: 'permission to be separate without being abandoned; experience of staying while loved one steps away',
      avoid: ['forcing separation', 'shaming the clinginess', 'naming clinical terms like separation anxiety/attachment disorder'],
      resolution: 'the child closes the book feeling "I am me, even when they are not here — and they will come back"'
    },
  },
};

// ─── Export for generation script ────────────────────────────────────
export default DEEP_COMPANIONS;
