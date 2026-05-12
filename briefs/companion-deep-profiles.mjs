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
    name: 'התמנון סערה',
    nameClean: 'סערה',
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
    name: 'הקמליון קוקו',
    nameClean: 'קוקו',
    gender: 'male',
    species: 'זיקית',
    speciesEnglish: 'chameleon',
    tagline: 'שובב שנושא צבע מכל מקום שהיה בו',
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
    name: 'הדולפין שחקן',
    nameClean: 'שחקן',
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

};

// ─── Export for generation script ────────────────────────────────────
export default DEEP_COMPANIONS;
