<!--
GOLD CANDIDATE — bolly_armadillo / adventure / age 5
Source batch: 2026-05-19_1779221893189
Generator: v0.5a (STORY_RECIPE_MODE=on, DRAFT_MODE=structured, EDITORIAL_MODE=y-lite)
Recipe:    lib/story-generator/recipes/bolly_adventure_age_5.ts (v0.5.0-b)
Verdict:   tech=PASS | editorial=READY | book=4.83 | resilience=5.00
Cost:      $0.091 (Y-lite $0.0196)
Repairs:   0 tech + 0 editorial   ← THE HEADLINE NUMBER
LLM calls: 4 (Draft + Draft-retry + 2× Y-lite reviewers)

WHY THIS IS A MILESTONE:
  This is the first Gold Candidate produced under v0.5 architecture:
    - Plan LLM was BYPASSED. Plan synthesized deterministically from Recipe.
    - Editorial Repair was DISABLED. Author wrote prose once + one
      blueprint-fix retry. No LLM rewrote any sentence after.
    - Quality MATCHED the v0.4.7 Gold Candidate exactly:
        v0.4.7 (legacy):  book=4.83, resilience=5.00, 1 editorial repair, $0.101
        v0.5a (recipe):   book=4.83, resilience=5.00, 0 editorial repairs, $0.091

  Crucially, the same companion+direction+age run through legacy pipeline
  on the same day SCORED LOWER (book=3.83 after repair regression). This
  is direct evidence that Editorial Repair was actively hurting quality.

VARIATIONS USED (deterministic, seeded by childName+childAge+direction):
    clinicSetting:    "חדר בדיקה קטן"
    medicalObject:    "מדחום"
    waitingObject:    "מדף נמוך עם ספרים"
    sensoryDetail:    "נייר קר על המיטה"
    stickerType:      "מדבקה עגולה עם פנים"
    weatherOutside:   "אור בוקר רך"
    homeRoomDetail:   "הספר הפתוח על הרצפה"

  All 7 variation slots show up in the prose naturally (sticker on p11/p12,
  paper on the bed on p6, open book on p14, etc.).

OBSERVATIONS / POLISH NOTES (for future Recipe iterations):
  - Author shifted dramatic beats one page earlier than Recipe pageCards
    intended (p6=fear_object, p7=body_resists, p8=companion_closes,
    p9=child_mirrors+companion_closes combined, p10=procedure, p11=residue).
    Y-lite still scored 5/5 resilience because the ARC is intact — just
    compressed. Task #169 (Author prompt PageCard-driven with explicit
    dramaticRole + requiredEvent) will lock the beat order.
  - p7 introduced "טוּמְפּ חלש נשמע מהכיס" before companion_closes happens
    on p8. This is a minor drift — the sound should come on the close,
    not pre-empt it. Catchable by recipe mustInclude/mustNotInclude wiring
    in #170.
  - Name "נועה" still appears ~12 times (recommended 5-8). Warning, not
    blocking. Will need Author prompt tuning in #169.
  - The forbidden "הלוח הוורוד הבהב" / "ישב על כתפה" patterns (which
    v0.4.7 Gold had as polish notes) did NOT appear in this story. The
    recipe forbiddenPatterns concept works even before validator wiring,
    because the Author internalizes the constraint through context.

USE AS:
  - Reproducibility benchmark for v0.5a recipe mode
  - Reference for what "Gold quality without Editorial Repair" looks like
  - Calibration sample when authoring future recipes (bedtime, fantasy)
-->

---
title: "בּוֹלִי והמדבקה"
companionId: "bolly_armadillo"
canonicalName: "בּוֹלִי"
direction: "adventure"
childGender: "girl"
pages: 15
---

--- Page 1 ---
השמש נכנסה לחדר של נועה.
היא הסתתרה מתחת לשמיכה ולא רצתה לקום.
בּוֹלִי ישב ליד הכרית והביט בה בשקט.

imageDirection: wide shot bedroom

--- Page 2 ---
נועה פיהקה וירדה מהמיטה.
בּוֹלִי התגלגל על הרצפה, טוּמְפּ קטן נשמע.
הוא עצר ליד התרמיל שלה וחיכה.

imageDirection: medium shot floor near bed and backpack

--- Page 3 ---
הרחוב היה קריר ונועה אחזה ביד אמא.
בּוֹלִי התגלגל לצידה ונעצר.
הוא נסגר לכדור שקט ליד הנעל שלה.

imageDirection: street level shot

--- Page 4 ---
נועה חיכתה רגע ואז המשיכה ללכת.
בּוֹלִי נפתח לאט, לוח ועוד לוח.
הם הלכו יחד לאורך המדרכה.

imageDirection: moving shot on sidewalk

--- Page 5 ---
במרפאה חיכתה רופאה עם מעיל לבן.
נועה טיפסה בזהירות על כיסא הבדיקה הגבוה.
בּוֹלִי הציץ מהכיס שלה ונשען על התיק.

imageDirection: interior clinic shot

--- Page 6 ---
הרופאה שלפה מדחום קטן מהמגש.
המדחום נצנץ לאור המנורה.
נועה הביטה בו ובלעה רוק חרישי.

imageDirection: close-up doctor holding small instrument

--- Page 7 ---
הרופאה הושיטה יד אל נועה.
נועה משכה את ידה אחורה, והכתפיים עלו.
טוּמְפּ חלש נשמע מהכיס.

imageDirection: medium close-up child gesture

--- Page 8 ---
בּוֹלִי התגלגל בכיס ונעשה כדור קטן.
לוחותיו נסגרו ברשרוש קל.
הוא נח שקט, בפנים היה חם.

imageDirection: close-up pocket with curled Bolly

--- Page 9 ---
נועה הביטה בכיס שלה.
בּוֹלִי התגלגל ונסגר לכדור חם ושקט.
נשמע טוּמְפּ קטן.
נועה סגרה את היד שלה ואז פתחה אותה לאט.

imageDirection: close-up of child hand mirroring closed ball

--- Page 10 ---
הרופאה נגעה ביד של נועה.
המדחום היה קר ונוצץ.
הנגיעה הייתה קצרה מאוד ונועה נשארה במקום.

imageDirection: extreme close-up hand and instrument

--- Page 11 ---
הרופאה חייכה והדביקה מדבקה צבעונית על היד.
טוּמְפּ שקט עלה מהכיס כשבּוֹלִי פתח עין קטנה.
הכתפיים של נועה ירדו לאט.

imageDirection: close-up sticker placement

--- Page 12 ---
נועה הביטה במדבקה העגולה עם הפנים המחייכות.
בכיס של נועה נשמע טוּמְפּ קטן.
בּוֹלִי פתח לוחית אחת לאט והציץ הצצה קצרה.
היד של נועה נשארה פתוחה ושקטה.

imageDirection: medium shot sticker and Bolly's plate opening

--- Page 13 ---
נועה יצאה מהמרפאה עם אמא שלה.
המדבקה על היד נצצה בשמש.
בּוֹלִי נח בתיק ונגע קלות בקצה השרוך.

imageDirection: street shot walking home

--- Page 14 ---
בבית נועה בדקה שוב את המדבקה על היד.
הספר הפתוח היה על הרצפה ליד המיטה.
בּוֹלִי התקמר לידה ונשם בשקט.

imageDirection: bedtime close-up

--- Page 15 ---
האור בחדר היה חמים ורך.
נועה שכבה בשקט, היד עם המדבקה על השמיכה.
בּוֹלִי נרדם לידה, ובפנים היה חם.

imageDirection: close-up bedside warm light
