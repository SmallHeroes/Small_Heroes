<!--
SMOKE / RECIPE CANDIDATE — bolly_armadillo / adventure / age 5 (child: דניאל)
Source batch: 2026-05-22_1779458307646
Generator: v0.5a (STORY_RECIPE_MODE=on, DRAFT_MODE=structured, EDITORIAL_MODE=y-lite)
Recipe:    lib/story-generator/recipes/bolly_adventure_age_5.ts (v0.5.0-d)
Verdict:   tech=PASS | editorial=READY | book=4.83 | resilience=5.00
Cost:      $0.060 (Y-lite $0.0226)
Repairs:   0 tech + 0 editorial
recipeContract: PASS (0 forbiddenPatterns, 0 mustNotInclude — #177 validator active)

WHY THIS IS SAVED:
  Second clean READY under v0.5a Recipe Mode, AFTER #177 (recipeContract
  validator) went live. Confirms the architecture is stable, not luck:
    - Recipe routing works, Plan LLM skipped
    - Structured draft + PageCard prompt
    - recipeContract validator enforced forbiddenPatterns + mustInclude /
      mustNotInclude — clean pass
    - Y-lite both reviewers PASS, no editorial repair
  Marks bolly_adventure_age_5 as a STABLE Recipe Candidate.

KNOWN MINOR ISSUES (3 MINOR from Y-lite editorial-qa.json — none blocking):
  - p0 (whole story) — childWouldAskAgain weak: "הסיפור שקט ומעודן ללא רגע
    של צחוק או הפתעה בולטת... חסר רגע זיכרון חזק". This is the SYSTEMATIC
    weak dimension across all smoke runs — the recipe produces an honest,
    calm resilience arc but no spark of delight. Recipe-level fix needed
    (a memorability beat), tracked separately.
  - p3 — broken_hebrew: "היא נשמה קצר" → should be "נשמה נשימה קצרה".
  - p4 — read_aloud_stumble: "לוח אחר לוח... לצידה" — slightly heavy rhythm.

USE AS:
  - Stable-recipe reference for v0.5a
  - Baseline for measuring whether #172 (reroll) + a memorability beat
    lift childWouldAskAgain from 4 to 5
-->

---
title: "בּוֹלִי והמדחום הקטן"
companionId: "bolly_armadillo"
canonicalName: "בּוֹלִי"
direction: "adventure"
childGender: "girl"
pages: 15
---

--- Page 1 ---
דניאל התעוררה כשהאור החליק פנימה מהחלון.
היא הסתובבה לצד השני והתחבאה מתחת לשמיכה.
בּוֹלִי שכב קרוב לכרית, פתוח קצת, מביט בה בשקט.

imageDirection: wide shot bedroom, soft morning light, child curled under blanket, Bolly visible near pillow

--- Page 2 ---
היא התכופפה לחפש גרב על המדף הנמוך עם הספרים.
בּוֹלִי התגלגל החוצה מן המיטה ונעצר ליד התרמיל, טוּמְפּ קטן נשמע.
דניאל חייכה קצת והכניסה אותו פנימה.

imageDirection: medium shot floor near bed and backpack, Bolly mid-roll

--- Page 3 ---
בדרך למרפאה דניאל עצרה על המדרכה והסתכלה למטה.
בּוֹלִי נסגר לכדור שקט, הלוחות שלו נצמדו זה לזה.
היא נשמה קצר.

imageDirection: street level, foot of child and small ball of Bolly on sidewalk

--- Page 4 ---
אחר כך היא החלה לפסוע שוב, התרמיל מתנדנד על גבה.
בּוֹלִי נפתח לאט, לוח אחר לוח, והתגלגל לצידה בנקישה קטנה.
הרוח נגעה בקצה השרוול שלה.

imageDirection: moving shot on sidewalk, child walking, Bolly rolling alongside

--- Page 5 ---
במרפאה המשפחתית עמדו כיסאות צבעוניים ורופאה בחלוק לבן.
דניאל טיפסה ברגליים קטנות וישבה על קצה כיסא הבדיקה.
בּוֹלִי נח בכיס התרמיל ולא השמיע קול.

imageDirection: interior clinic, child climbing onto exam chair, doctor in white coat in soft focus

--- Page 6 ---
הנייר הקר שעל המיטה רשרש מתחת לרגליים שלה.
הכתפיים של דניאל עלו קצת, והיא הביטה בברק הקטן שעל הקיר.
בּוֹלִי מניע לוח קלות בתוך הכיס.

imageDirection: close-up clinic detail that primes contraction — white paper edge, soap dispenser, thermometer case, NOT a wide pretty interior

--- Page 7 ---
הרופאה שלפה מדחום קטן מהקופסה.
דניאל ישבה בלי לזוז, עיניה נעולות עליו.

imageDirection: close-up doctor hand holding small thermometer with silver tip

--- Page 8 ---
היד של דניאל נמשכה מעט לאחור כשהרופאה קרבה את היד.
הכתפיים עלו, ועיניה ברחו אל הקיר.
הנשימה שלה נעצרה לרגע קצר.

imageDirection: medium shot child's shoulders rising, hand pulling back slightly

--- Page 9 ---
בתוך הכיס, בּוֹלִי התגלגל ונסגר לכדור חם ושקט.
נשמע טוּמְפּ עדין שהיד שלה הרגישה.
החולצה של דניאל רעדה קלות.

imageDirection: close-up pocket lump, small ball-shape visible through fabric

--- Page 10 ---
היד שלה נסגרה לאגרוף קטן והחזיקה כך רגע.
אצבע אחר אצבע נפתחה לאט, כמו פתיחה של עלים.
הנשימה שבה אליה.

imageDirection: close-up small hand opening slowly, finger by finger

--- Page 11 ---
המדחום נגע ביד לרגע קצר.
דניאל נשארה על הכיסא בשקט והביטה בנקודה אחת על הרצפה.

imageDirection: close-up hand and thermometer tip, brief contact

--- Page 12 ---
הרופאה הדביקה מדבקה עגולה עם פנים מרצדים על היד שלה.
דניאל הביטה בה בסקרנות.
בּוֹלִי פתח לוחית אחת והציץ, טוּמְפּ רך נשמע.

imageDirection: medium shot sticker on child's hand, Bolly's plate slightly open

--- Page 13 ---
בחוץ היה אור בוקר רך.
דניאל הלכה לאט הביתה והביטה במדבקה שעל היד.
בּוֹלִי נח בכיס התרמיל ולא זז.

imageDirection: street shot child walking home, sticker visible on hand, Bolly tucked in bag

--- Page 14 ---
בבית דניאל הרימה את היד ונגעה בקצה המדבקה בעדינות.
היא חייכה לעצמה.
בּוֹלִי התכווץ ליד הכרית ונשם בשקט.

imageDirection: bedtime close-up of hand with sticker, Bolly curled near pillow

--- Page 15 ---
דניאל שכבה על המיטה, ידה לצידה ונשימתה רגועה.
בּוֹלִי נרדם לידה, ובפנים חם.
הכרית רכה מתחת ללחי שלה.

imageDirection: close-up bedside warm light, hand resting, Bolly snug nearby
