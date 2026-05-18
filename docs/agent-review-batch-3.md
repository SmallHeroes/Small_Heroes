# Agent Review — Batch 3 (27 stories across SELF_CONFIDENCE, ANGER_FRUSTRATION, SENSITIVITY_OVERWHELM)

Reviewer: senior Hebrew children's-book editor pass (Datia Ben-Dor / Yehonatan Geffen tradition)
Date: 2026-05-17
Source dir: `C:\GNart\Work\Small_Heroes\story-bank\v5-fixed-v2\`

═══════════════════════════════════════
FILE: ant_harutza_bedtime.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- Companion is named "טִיטִי" (feminine form) but YAML `gender: male`. The prose then writes "טִיטִי עומדת", "היא שׁולפת", "מתכווצת" — all feminine. This is internally consistent (feminine companion) but mismatches the gender field. The bigger issue: the companion key is `ant_harutza` ("חֲרוּצָה") so feminine is correct; YAML `gender: male` describes the **child**, but the prose has no child gender markers, so this is fine. Flag: title and protagonist gender mismatch — author should resolve which "gender" the field refers to.
- p3: "סליחה, אני רק... לא שׁאני גדולה, אבל..." — incomplete clause, garbled syntax. A 4-year-old listening will lose the thread. fix: "סליחה. אני קטנה, אבל אני מנסה."
- p10: "היא נוגעת בעלה שׁעל הגב — שׁלושׁ פעמים. שׁלי. שׁלי. שׁלי." — "שׁלי" written three times reads as the snail's name (the OTHER companion in the bank). Confusing pun. fix: rename the three-tap ritual word (e.g., "אֲנִי. אֲנִי. אֲנִי.") or move ritual offstage.

POV CONSISTENCY
- Clean third-person throughout (טִיטִי + הילד). No shifts.

READ-ALOUD RHYTHM
- p1: "היא שׁולפת סרט מדידה קטן ומותחת אותו מהאדמה למעלה, למעלה, למעלה" — fine.
- p3: incomplete clause as above breaks rhythm.
- Generally short and breathable.

AGE-APPROPRIATE VOCABULARY (4–7)
- p1: "סרט מדידה" — borderline; a 4yo doesn't know "measuring tape" but the visual rescue makes it fine.
- p2: "סדק" — borderline complex, but it's a key story word with image support. OK.
- "מתכווצת" (p4) — slightly clinical. replace with: "מקטינה את עצמה" or "מקופלת".

HEART LINE LANDING
- heartLine: p5 — טִיטִי stretches tape on a leaf, retracts it, folds inward. Page reads: "מקפלת, שׁמה בכיס. הכתפיים שׁלה יורדות." Visually strong, emotionally readable. STRONG.

RESILIENCE MESSAGE
- Self-doubt does not disappear from being told you're useful; you discover you matter by doing the thing only you can do. Mostly implicit; the bracelet ritual (שׁלי שׁלי שׁלי) needs parent gloss because of the homonym with the snail-friend's name.

OVERALL GRADE: B

TOP RECOMMENDATION: Rename the closing ritual word — three repetitions of "שׁלי" collide with the snail companion's name and turn a tender beat into a confusing one; replace with "אֲנִי. אֲנִי. אֲנִי." or "כָּאן. כָּאן. כָּאן."

═══════════════════════════════════════
FILE: ant_harutza_adventure.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- p1: "היא כותבת במחברת קטנה: האבן יותר גדולה ממני. העלה יותר רחב ממני." — heavy academic note-taking for a bedtime/adventure story. The motif "כותבת במחברת" repeated across pages (1, 3, 4, 5, 8) is **stage business for adults**, not a 5-year-old gesture. The book teaches the child to *measure and journal her inferiority*. Therapeutically wrong direction.
- p5: "אולי את תעזרי לי?" — the child speaks to a beetle with feminine "את" — fine, but feels grammatically inconsistent with later "אולי נמלה תוכל" (p7, future-feminine, OK).
- p9: "רק נמלה יכולה להיכנס" — fine grammar, but it lands as cold tasking, not warmth. Compare to the bedtime version's "טִיטִי, רק את יכולה" — much warmer.
- p11: "טִיטִי מקפלת את סרט המדידה." — fine. But the heart-line beat is reduced to a single physical gesture with no inner texture.

POV CONSISTENCY
- Clean third-person. No shifts.

READ-ALOUD RHYTHM
- Mostly short. Some pages (p1, p3, p5, p8) feel like a list of measurements — flat, not lyrical. Read-aloud feels like a Form 1040, not a bedtime story.

AGE-APPROPRIATE VOCABULARY (4–7)
- p1: "מחברת" — fine.
- p3: "מתכווצת" — same as bedtime; replace with: "מתכופפת" or "מקופלת".
- p13: "טִיטִי עומדת לידו. זקופה." — "זקופה" is age-OK but stiff.
- p15: "יש רווח ביניהם" — abstract; a child won't picture this. replace with: "טִיטִי עומדת קצת רחוק".

HEART LINE LANDING
- heartLine YAML says p8 (measures fingertip then self, folds inward). Page reads dryly: "היא כותבת: אני יותר קטנה ממנו." That is THE problem — the heart-line is a *journal entry of self-diminution*. WEAK. fix: drop the notebook; show body and breath. Suggestion: "טִיטִי מסתכלת על אצבע הילד. אחר כך על עצמה. היא נושמת מאוד לאט, כאילו רוצה להיעלם."

RESILIENCE MESSAGE
- Same message as bedtime, but iced over by the notebook conceit. Needs parent explanation of why she keeps measuring.

OVERALL GRADE: C

TOP RECOMMENDATION: Cut the notebook / measurement journaling motif on pages 1, 3, 4, 5, 8 — replace each "כותבת" with an interior body gesture (folding, looking down, holding breath). Right now the story models obsessive self-quantification, the opposite of the resilience goal.

═══════════════════════════════════════
FILE: ant_harutza_fantasy.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- p10: "הילד מסתובב לחֲרוּצָה" — uses חֲרוּצָה (the breed/species name) instead of the companion's name טִיטִי. Inconsistent naming inside the same story.
- p6 emotionalMistake YAML: "הילד מנופף לחֲרוּצָה" — same naming inconsistency between YAML and prose.
- p2: "הגבעול מתנשֵׂא מעליה" — "מתנשֵׂא" is **clinical/literary** register (haughty, towering). A 5-year-old will not parse. replace with: "הגבעול גבוה ממנה" or "הגבעול מתרומם גבוה".
- p19: "טִיטִי מתרחקת צעד אחד. היא נוֹגעת בעלה על הגב שׁלה. פעם. פעמיים. שׁלושׁ. 'שׁלי. שׁלי. שׁלי,' היא לוחשׁת." — same שׁלי = snail-name collision as bedtime version.
- p3: "ילד מתקרב, כורע על הארץ" — "כורע" is OK, slightly biblical register; "מתכופף" reads warmer for 5yo.
- Spelling: "ושׂוֹמה" (p11 of YAML) is biblical spelling — use "ושׂמה" or simply "ומכניסה אותו".

POV CONSISTENCY
- Clean third-person throughout.

READ-ALOUD RHYTHM
- p1: 4 short sentences in 38 words — fine for read-aloud, but page 1 carries the heaviest setup. Some sentences are choppy. The "shifting size" world-rule is hard to convey to a 4yo without visual support; relies heavily on illustrator.
- p20: "העולם סביבו מתנועע קלות. דברים משׁנים גודל." — abstract magical realism — fine, but feels like an adult coda.

AGE-APPROPRIATE VOCABULARY (4–7)
- p2: "מתנשֵׂא" — too high register. Replace.
- p13: "האור בפנים כהה" — abstract; OK with illustration.
- p17: "האור בחוץ חזק" — fine.

HEART LINE LANDING
- heartLine: p11 — "טִיטִי מקפלת את סרט המדידה ושׂוֹמה אותו בכיס." This is the *quietest* page (2 lines, just folding) — and that's its strength. STRONG visual beat, but the emotion isn't explicit; relies entirely on the illustrator and on the listener's reading of the gesture. OK.

RESILIENCE MESSAGE
- "Only you can do what only you can do; size is in the eye of the beholder." Beautiful idea but delivered through magical-realism world that a 4-year-old won't fully understand. Needs parental scaffolding.

OVERALL GRADE: B-

TOP RECOMMENDATION: Fix the naming inconsistency (חֲרוּצָה vs טִיטִי), kill the "מתנשֵׂא" register, and resolve the שׁלי-as-name-collision in p19. Then the magical-realism delivery is strong.

═══════════════════════════════════════
FILE: butterfly_zohar_bedtime.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- p2: "סְלִיחָה" — over-nikud on the most common Hebrew word. Heeb v5.4 says **partial nikud** (helping marks only). Strip.
- p7: "זֹהַר מעבירה מחוש אחד על השני" — "מחוש" is the technical word for antenna; for 4-7yo readers, "אנטנה" or "קרניים קטנות" or just "המחושים" (which has a strong butterfly association). The plural "מחושים" appears in p10 — fine. Use plural consistently.
- p5: "הקליפה המחוספסת" — "מחוספסת" is clinical/textural; replace with: "המחוספסת" → "הגסה" or simpler still "הקליפה הקשה".
- p8: "את זוהרת" — feminine "את" addressing זֹהַר from the child. Story marks gender: male in YAML. The child should be either neutral or male — "אַתָּה זוהרת" would be wrong but "את זוהרת" addresses the butterfly (feminine), which is correct. OK on rereading.

POV CONSISTENCY
- Clean third-person throughout. No shifts.

READ-ALOUD RHYTHM
- Short, breathable. Good for bedtime.
- p6 is only 13 words across 3 micro-lines — feels rushed; the "no path forward" beat lands too fast.

AGE-APPROPRIATE VOCABULARY (4–7)
- "המחוספסת" — replace as above.
- "מנצנצות" (p2) — fine.

HEART LINE LANDING
- heartLine: p5 — wings pressed against bark, trying to force them open, leaving dust. Page reads: "היא לוחצת את הכנפיים על הקליפה המחוספסת. מנסה לפתוח. הכנפיים לא זזות." Physical, visible, emotionally readable. STRONG.

RESILIENCE MESSAGE
- "Your light leaks out anyway; you do not have to perform it." Lands cleanly because the child sees the leak before the wings open.

OVERALL GRADE: B+

TOP RECOMMENDATION: Strip the unnecessary nikud (most "סְלִיחָה"-type marks), swap "מחוספסת" for "קשה", and the story is publication-ready.

═══════════════════════════════════════
FILE: butterfly_zohar_adventure.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- p1: "חולדה עוברת. 'איזה עלה יפה,' אומרת זֹהַר." — wait, this is a butterfly speaking to a rat about a leaf? The "compliments diverted away from self" motif works, but the pairing is jarring (חולדה = rat). Consider "סנאי" or "ציפור".
- p3: "סליחה" — over-nikud rejected from earlier note; consistent here (no nikud) — good.
- p15: "אבק זֹהַר" — clever wordplay (Zohar = both the name and "glow") — but a 5-year-old won't catch it on first read, and a reader might trip on whether it's "shining dust" or "Zohar's dust". Acceptable.

POV CONSISTENCY
- Clean third-person. No shifts.

READ-ALOUD RHYTHM
- Short and breathable.
- p8: "זֹהַר משפשפת קצת את הכנפיים על עלה. היא מקפלת אותן חזק, חזק. האוֹר כמעט נעלם." — strong rhythm.

AGE-APPROPRIATE VOCABULARY (4–7)
- p12: "כמו זֹהַר עם המחושים" — child-imitation moment is lovely.
- p15: "אבק זֹהַר" — clever but potentially confusing.

HEART LINE LANDING
- heartLine: p8 — rubbing wings on a leaf to erase the light. Page reads: "מנסה למחוק את האוֹר" beat — physical, visible, emotionally clear. STRONG.

RESILIENCE MESSAGE
- "You cannot fully erase what you are." Implicit, lands well.

OVERALL GRADE: B+

TOP RECOMMENDATION: Swap "חולדה" (rat) for a friendlier creature on p1 ("סנאי" or "ציפור") — the pairing currently snags the read-aloud.

═══════════════════════════════════════
FILE: butterfly_zohar_fantasy.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- **EXTREMELY heavy nikud**: every dialogue line is fully marked (e.g., p1: "אַתֶּם כָּל כָּךְ יָפִים הַיּוֹם"). This violates the v5.4 partial-nikud rule. Strip 80% of these marks; keep them only where ambiguity demands.
- p7: "טִפּוֹת טַל עַל הָעָלִים, הֵן מַחֲזִירוֹת אוֹר" — "מַחֲזִירוֹת" (reflecting) — too abstract for 4-7yo. fix: "טִפּוֹת טַל. הֵן נוֹצְצוֹת."
- p14: "הוּא לֹא אוֹמֵר כְּלוּם. רַק מְחַכֶּה. זֹהַר מְרַחֶפֶת קָרוֹב, רַגְלַיִם קְטַנּוֹת מוּרָמוֹת. נוֹחֶתֶת עַל קְצֵה הָאֶצְבַּע שֶׁלּוֹ. רִאשׁוֹנָה רֶגֶל אַחַת. עוֹד אַחַת. וְעַד שֵׁשׁ." — "וְעַד שֵׁשׁ" is awkward Hebrew; the count of six legs is ankward and counts-the-anatomy in a way that breaks immersion. fix: omit "ועד שש" — just "רֶגֶל אַחַת. עוֹד אַחַת. עוֹד וְעוֹד."
- p14: "הוּא לֹא אוֹמֵר כְּלוּם" — the pronoun הוּא refers to the child (gender: male in YAML), good. But the line "עָלָיו" at the end is touching — gender consistent. OK.
- p2: "הַשָּׁמַיִם מִתְכַּהִים מֶעַט" — "מִתְכַּהִים" is high register / abstract. replace with: "הַשָּׁמַיִם נֶהֱפָכִים כֵּהִים" or "מַחְשִׁיכִים".
- p15: extremely short (12 words) — fine as the quiet page.

POV CONSISTENCY
- Clean third-person. No shifts.

READ-ALOUD RHYTHM
- p1: 38 words. p3: 39 words. p4: 34 words. p5: 35 words. p7: 39 words. These pages are LONG for a fantasy bedtime. Several sentences >15 words.
- p14 in particular has 8 lines that read like a screenplay's stage direction.

AGE-APPROPRIATE VOCABULARY (4–7)
- "מַחֲזִירוֹת אוֹר" (p7) — replace.
- "מִתְכַּהִים" (p2) — replace.
- "הִשְׁתַּקְּפֻיּוֹת" (p8) — "הִשְׁתַּקְּפֻיּוֹת" (reflections) — too long / abstract; replace with: "הִיא רוֹאָה אֶת עַצְמָהּ בַּטַּל".

HEART LINE LANDING
- heartLine: p10 — secretly shaking dust trail while turned away. Page reads strongly: "הִיא מְנַעֲנַעַת אֶת הַכְּנָפַיִם פַּעַם אַחַת, זָהִיר. אָבָק דָּק נוֹשֵׁר, זֹהַר בְּקוֹשִׁי." This is the most "Datia Ben-Dor" beat in the entire batch — vulnerable, deniable, illustrative. STRONG.

RESILIENCE MESSAGE
- "You leak who you are even when you try not to; another can love what you cannot show on purpose." Strong message. Implicit.

OVERALL GRADE: B (would be A- without the nikud burden and the long p1/p3/p4/p7)

TOP RECOMMENDATION: Strip 80% of the nikud (keep only on ambiguous Hebrew words), and cut p1, p3, p4, p7 down to ≤25 words each — the heart of this story is its quietness, currently buried under volume.

═══════════════════════════════════════
FILE: lion_shaket_bedtime.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- **YAML category: COURAGE_BRAVERY** — but the review task assigns this story to SELF_CONFIDENCE. Either taxonomy mismatch in the bank or this story is mis-categorized. Flag.
- p6: "התנוחה מושלמת. הפה פתוח. שום קול לא יוצא." — "מושלמת" is fine but conceptually adult ("the pose is perfect"); a 5-year-old reads this as "he's doing everything right but it's empty" — that's the right beat. OK.
- p10: "השמיים נעשים חמימים" — odd; sky is usually "warm-colored" not "warm". fix: "השמיים נצבעים חם" or "אור חם בשמיים".

POV CONSISTENCY
- Clean third-person. No shifts.

READ-ALOUD RHYTHM
- Very short pages. Bedtime-friendly.

AGE-APPROPRIATE VOCABULARY (4–7)
- All clear. No clinical words.

HEART LINE LANDING
- heartLine: p5 — Leo sits low, tail tucked, head down, child watches silently. Page reads exactly: "הזנב מתכרבל לבטן. הראש יורד. הילד מסתכל בלי לדבר." STRONG. The silence is doing real emotional work.

RESILIENCE MESSAGE
- "A small true voice does what a big fake voice cannot." Clean message; the world-rule (whispers settle low, roars fly up) is conveyed mostly through image-direction; on prose alone it's underexplained for a 5yo without parent scaffolding.

OVERALL GRADE: A-

TOP RECOMMENDATION: Resolve the category mismatch (this story files under COURAGE_BRAVERY but is being reviewed as SELF_CONFIDENCE) — and add one sentence on p3 or p7 making the "whispers stay low, roars fly up" world-rule explicit in prose, not only in image direction.

═══════════════════════════════════════
FILE: lion_shaket_adventure.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- **CRITICAL POV BUG**: this story switches between third-person ("לֵיוֹ עומד") and second-person ("אתה מגיע", "אתה שׁוֹאֵל", "אתה קורא") starting p2. The narrator addresses the listener as "אתה" (you, masculine). All other Lion stories and this category use third-person. Hard to recover from in publication.
- p2: "אתה מגיע לאבנים ורואה את לֵיוֹ. 'שָׁאַגְתָּ?' אתה שׁוֹאֵל." — direct second-person.
- p5: "אתה עומד לידו ופותח את הפה חזק חזק. 'שָׁאָגָה!' אתה קורא למעלה לשׁמַיִם." — second person continues; the *child* is now the one shouting "roar" while Leo is silent. This is the **emotionalMistake** beat — second-person works *only* if all 15 pages stay in it.
- p10: "אתה רץ לאבן גבוהה יותר ומטפס." — continues.
- p13: "אתה מושיט יד, והוא מגיע אלייך." — "אלייך" is **feminine** ("to you"), but the rest is masculine "אתה". Internal gender mismatch.
- p15: "הסרט האדום מונח על האבן ליד הנוצה. לֵיוֹ עומד צעד אחד ממך. שניכם מסתכלים החוצה." — back to mixed.
- p14: "היצור מרים את הכנפיים ועף הרחק, אל האופק." — "הרחק" is wrong word ("far away" adverb is usually "רחוק"); the "ה" form is biblical/literary. fix: "עף רחוק, אל האופק".
- Category YAML: COURAGE_BRAVERY again — same flag as bedtime.

POV CONSISTENCY
- **MIXED.** Third-person on Leo, second-person (masculine) on child, with one feminine slip on p13. List of POV-shift pages: pages 2, 5, 9, 10, 13, 15 all use אתה; pages 1, 3, 4, 6, 7, 8, 11, 12, 14 are third-person. Pick one. Recommend rewriting all "אתה" to "הילד" / "הילדה" or to the {{childName}} placeholder.

READ-ALOUD RHYTHM
- Short pages. Rhythm itself OK, but the POV instability *destroys* read-aloud — the parent has to switch voice register every page.

AGE-APPROPRIATE VOCABULARY (4–7)
- p9: "מתכרבל פנימה" — fine.
- "אופק" (p14) — too abstract for some 4-year-olds; OK for 6-7.

HEART LINE LANDING
- heartLine: p8 — Shaket curls slightly, presses paw to ribbon three times. Page reads: "הוא נוגע בסרט האדום על הכף שלו — פעם אחת. עוד פעם. ועוד. עיניים עצומות." STRONG image, but undermined by the POV instability around it.

RESILIENCE MESSAGE
- Same as bedtime, but the message arrives muffled because the reader is too busy tracking who's "you" vs who's "Leo".

OVERALL GRADE: D (would be B+ if POV fixed)

TOP RECOMMENDATION: Rewrite all "אתה / אתה / אלייך" references on pp 2, 5, 9, 10, 13, 15 to third-person ("הילד" or the {{childName}} placeholder) — POV instability is the single biggest defect in this batch.

═══════════════════════════════════════
FILE: lion_shaket_fantasy.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- **CRITICAL POV BUG**: uses **first-person אני** throughout for the child. ("אני מגיע לקצה הגבעה", p2.) None of the other stories in this batch use first-person — this is a one-off.
- This conflicts with the loader's child-name personalization model (the loader expects to substitute {{childName}} into third-person "הילד" slots; a first-person story has nothing to personalize).
- p2: "'שׁאגת?' אני שׁואל." — "שׁאגת" with no nikud is ambiguous (could be "you roared" masc. or just the noun "roar"). With personalization the listener IS the child, so first-person is defensible; but the bank convention is third-person.
- p4: "אני לוחשׁ משׁהו קטן." — "לוחשׁ" masculine. If the child is female, this breaks.
- p6: "אני אומר" / p9: "אני מנסה לקרוא חזק" / p17: "אני מרים" — all masculine. Will fail gender swap.
- Category YAML: COURAGE_BRAVERY again.
- p4: "המילה נופלת על הדשׁא ליד הרגליים שׁלי. היא נוחתת כמו אבן קטנה." — beautiful. Keep.
- p13: "יוצאת מילה אחת. 'כאן.'" — strong beat.

POV CONSISTENCY
- First-person throughout for child, third-person for Leo. **Internally consistent** but **bank-inconsistent** AND gender-locked masculine. Risk: will read wrong if child is female.

READ-ALOUD RHYTHM
- Short, breathable. The world-rule (sounds have weight) lands more clearly here than in bedtime — you can hear the words falling.

AGE-APPROPRIATE VOCABULARY (4–7)
- "מילה נוחתת כמו אבן קטנה" — perfect imagery for the age.
- "האוֹר משׁתנה קצת" (p12) — fine.

HEART LINE LANDING
- heartLine: p11 — paw resting on the fallen sound. Page reads: "לֵיוֹ מניח את הכף על הקול שׁנפל. הכף מונחת עליו בשׁקט. הוא לא זז." Beautiful. STRONG.

RESILIENCE MESSAGE
- "Your small voice has weight; it lands where it needs to." Strongest in the trilogy if POV is fixed.

OVERALL GRADE: C+ (would be A if POV fixed and gender-neutralized)

TOP RECOMMENDATION: Rewrite all "אני" passages in third-person (or as `{{childName}}` placeholders) so the story works for both genders and matches the bank convention.

═══════════════════════════════════════
FILE: bear_cub_gahal_bedtime.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- p1: "הוא שׁואג חזק על דברים לא הוגנים שׁהוא מדמיין" — "מדמיין" is fine but the phrase "דברים לא הוגנים" is **adult/abstract language**. A 5-year-old will not know what "unfair things" means in the abstract. fix: "הוא שואג על משהו שכואב לו" or "על דברים שהרגיזו אותו".
- p10: "הציפורניים זוהרות זהב חם" — "זוהרות זהב" is missing a preposition; should be "זוהרות בזהב חם" or "זוהבות חם".
- p8: "הוּם... הוּם..." — onomatopoeia repeats. Fine.

POV CONSISTENCY
- Clean third-person. No shifts.

READ-ALOUD RHYTHM
- Short pages. Bedtime-appropriate.

AGE-APPROPRIATE VOCABULARY (4–7)
- "דברים לא הוגנים שׁהוא מדמיין" — replace as above.
- "מתעופפים" (image direction only) — fine.

HEART LINE LANDING
- heartLine: p5 — Dovi fixes his slipping bandana with shaking paws while lying on the floor. Page reads: "נושׁם מהר מהר מהר. מתקן את הבנדנה בכפות רועדות." STRONG sensory detail. Lands.

RESILIENCE MESSAGE
- "Roaring drains you; humming together holds you." Implicit and clear. Light parent gloss helpful.

OVERALL GRADE: B+

TOP RECOMMENDATION: Replace "דברים לא הוגנים שהוא מדמיין" (p1) with something concretely childlike ("דברים שהרגיזו אותו").

═══════════════════════════════════════
FILE: bear_cub_gahal_adventure.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- p2: "ילדה" + p5: "הילדה" — **gender: female** for the child throughout, but YAML says `gender: male`. **Direct YAML/prose mismatch.** Will break gender swap.
- p5: "'די,' היא נושמת" — gendered feminine.
- p7: "החתיכה השׁבורה ביד של הילדה" — feminine.
- p3: "שׁאגי!" — feminine imperative. Will be wrong for boys.
- p1: "הציפורניים זוֹהֲרוֹת אדום" — same preposition issue ("זוהרות [ב]אדום").
- p13: "יצור קטן מחוטים דקים עף למעלה" — "מחוטים דקים" is unusual; this is the magical-thread-bird payload, OK with illustrator support, but a child won't parse "creature made of thin threads" cleanly.

POV CONSISTENCY
- Third-person throughout. No shifts in *narrative person*, but **gender mismatch** between YAML and prose.

READ-ALOUD RHYTHM
- Short pages. OK.
- p13 ("יצור קטן מחוטים דקים") is the only line that stumbles.

AGE-APPROPRIATE VOCABULARY (4–7)
- "מחוטים דקים" — replace with: "מחוטים זוהרים" or "כמו ציפור של חוטים".

HEART LINE LANDING
- heartLine: p8 — Gahal quietly fixes his slipping bandana with shaking paws while exhausted. Page reads: "הוא מרים כפות רועדות ומכניס את הבנדנה למקום. אט אט." STRONG.

RESILIENCE MESSAGE
- "Yelling matches don't fix; presence does." Lands.

OVERALL GRADE: C+ (gender swap is the blocker)

TOP RECOMMENDATION: Fix the gender mismatch — either change YAML `gender: male` → `gender: female`, or rewrite every "הילדה / שׁאגי / היא" to masculine. Until fixed, this story is unusable for boys.

═══════════════════════════════════════
FILE: bear_cub_gahal_fantasy.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- p3: "סביבו מהבהב צבע חד" — "מהבהב צבע" — odd syntax; "מהבהב" is the verb. Should be "צבע חד מהבהב סביבו". Fix.
- p7: "הגלים באוויר מתפצלים לחתיכות קטנות" — "מתפצלים" is on the flagged-clinical word list. replace with: "נשברים לחתיכות קטנות".
- p9: "הקול שלו מתחיל להישבר" — fine.
- p13: "הצבע החד סביבו לא השתנה. השאָגות וההוּם לא תיקנו אותו." — strong line. Keep.
- p17: "מתעגל קצת" — fine, accessible.

POV CONSISTENCY
- Clean third-person. No shifts.

READ-ALOUD RHYTHM
- Pages mostly under 26 words. Good.
- p15 is just 8 words ("הילד מהמהם. חרש חרש.") — perfect quiet page.

AGE-APPROPRIATE VOCABULARY (4–7)
- "מתפצלים" — replace as above.
- "מתעגל" (p17) — fine.

HEART LINE LANDING
- heartLine: p10 — paw on chest, gentle hum begins. Page reads: "הוא שם כַּף על החזה. מהחזה יוצא הוּם חרישי. הוּם... הוּם... הוּם..." STRONG.

RESILIENCE MESSAGE
- Same as the other two — and this one delivers it with the cleanest payoff because the uncomfortable truth ("the broken thing is still broken") sits in p13 and is not erased.

OVERALL GRADE: B+

TOP RECOMMENDATION: Replace "מתפצלים" with "נשברים" (p7), and fix the syntax of "סביבו מהבהב צבע חד" (p3).

═══════════════════════════════════════
FILE: octopus_seara_bedtime.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- **CRITICAL POV BUG**: uses **second-person feminine** ("את") for the child. ("את אומרת" p3, "את מתרחקת" p3, "את ניגשת" p8.) YAML `gender: male`. **Gender mismatch + POV inconsistency.**
- p3: "'אני לא יודעת איפה לעמוד!' את אומרת." — the child speaks in feminine.
- p3, p8, p9, p10: continuous second-person feminine.
- p4: "'למה אתן לא שׁומעות?!'" — Seara speaks to "his" tentacles in **feminine plural** ("אתן" instead of "אתם"). זרוע is grammatically feminine in Hebrew, so this is **grammatically correct** but disorienting because it sounds like he's yelling at women. Adults will read it fine; children will not pick up the gendered-noun mechanic.
- p4: "הצבע של זוּזִי משתנה לאדום-סגול" — "אדום-סגול" hyphenated color is fine.
- The shifts back to third-person for Seara himself create a jarring split: child = "את" (you, feminine), octopus = "הוא" (he, third-person). This is *playable* only if you commit to second-person for the child throughout. Currently it's half-applied.
- p1: "Seara" → companion called "זוּזִי" in prose. YAML companionId is `octopus_seara`. Inconsistent (similar to ant — the file name says one name, the prose another).

POV CONSISTENCY
- **MIXED.** Child is "את" (2nd person feminine). Seara is "הוא" (3rd person). YAML gender says male. Three different signals.

READ-ALOUD RHYTHM
- Pages reasonable length. p2 ("צדף אחד מחליק מהמדף") works.
- The rhythm breaks where POV breaks.

AGE-APPROPRIATE VOCABULARY (4–7)
- p8: "מסלסלת" (curling) — fine.
- "ענן דיו" (p6) — fine.

HEART LINE LANDING
- heartLine: p5 — Zuzi gathers wild tentacles close one by one, slipping. Page reads: "זרוע אחת מתכרבלת פנימה. הוא מחזיק אותה. זרוע שנייה מתחילה להתקרב — אבל אז הראשונה חומקת החוצה." STRONG when isolated. Lands.

RESILIENCE MESSAGE
- "Big feelings can't be forced into place; gentle curl by curl works." Strong message. Buried under POV mess.

OVERALL GRADE: D+ (POV/gender bug is critical)

TOP RECOMMENDATION: Rewrite all "את" (2nd person feminine) addressed to the child as third-person "הילד" or `{{childName}}` — currently the YAML says male child but the prose addresses a female you. Story is **unusable as written**.

═══════════════════════════════════════
FILE: octopus_seara_adventure.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- **CRITICAL POV BUG**: first-person **אני** narration throughout for the child. But mixed gender — p1: "אני קוֹראת" (feminine), p3: "אני לא בטוּחה" (feminine), p4: "אני מצטערת" (would be feminine), p5: "אני לא מצליחה" (feminine), p6: "זוּזִי, אני לא מצליחה להחזיק" + later p6 "אני מתרחקת" + p7: "אני רוֹאה" — **feminine first-person**.
- YAML `gender: male`. Same systemic mismatch as bedtime.
- p3: "אני לא בטוּחה" — feminine.
- p13: "הזרועות שלו מסוּלסלות בשקט" — "מסוּלסלות" is a fine adjective ("curled").
- Companion named זוּזִי in prose, octopus_seara in filename — same naming inconsistency.

POV CONSISTENCY
- First-person feminine for child throughout. YAML says male. **BROKEN** for boys.

READ-ALOUD RHYTHM
- Short. Fine.

AGE-APPROPRIATE VOCABULARY (4–7)
- p15: "האוֹר של היצור רחוֹק רחוק" — fine.

HEART LINE LANDING
- heartLine: p8 — Zuzi hides creature in one soft tentacle, freezes others. Page reads: "אז הוא עוטף את היצור בזרוע אחת בעדינות. רק זרוע אחת. כשאני מסתכלת, הוא קופא." Visually striking. STRONG when not blocked by POV/gender confusion.

RESILIENCE MESSAGE
- "Loosening helps more than gripping." Solid. Implicit.

OVERALL GRADE: D+ (POV/gender blocker)

TOP RECOMMENDATION: Convert first-person feminine "אני" narrator to third-person "הילד" / `{{childName}}` throughout. Same as bedtime.

═══════════════════════════════════════
FILE: octopus_seara_fantasy.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- **CRITICAL POV BUG**: first-person **אני** narration — but here **masculine** ("אני צָף לידו" p3, "אני צוֹעק" p6, "אני מתרחק", "אני אוֹחז" p14). So *this* file's "אני" is male, while the bedtime and adventure are female. **Internally inconsistent across the trilogy.**
- p6: "'רגע, חכה!' אני צוֹעק פתאום." — "אני צוֹעק" masculine.
- Heavy use of unnecessary mater lectionis: "שׁמוֹנה", "שׁוֹמעת", "צוֹעק", "צף", "סוֹפר" — these "ו" insertions are technically valid Hebrew spelling (מלא) but feel **archaic/literary** when piled on. The mix of marked nikud + ktiv male creates an over-decorated read.
- p7: "חוֹמק" appears twice (p7, p12) — typo for "חומק" or just maleh spelling. Consistent in story.
- p15: "צָפָה במים" — Wave / float (feminine fits "זרוע" feminine) — fine.

POV CONSISTENCY
- First-person masculine for child throughout. Different from bedtime + adventure (feminine). Trilogy is incoherent.

READ-ALOUD RHYTHM
- Short. Fine when POV is granted.

AGE-APPROPRIATE VOCABULARY (4–7)
- p13: "דיוֹ שׁחור מתפוֹצץ" — "מתפוֹצץ" appears on the v5.4 anti-list (clinical/physical). replace with: "דיוֹ שׁחור פוֹרץ" or "ענן דיוֹ יוצא".

HEART LINE LANDING
- heartLine: p10 — Zuzi curls one tentacle around shaking orb and hides his trembling. Page reads: "זוּזִי מסלסל זרוֹעַ אחת סביב הכדור. הזרוֹעַ רועדת, אבל הוא מסתיר אותה מתחת לשׁאר." STRONG. Hides his vulnerability — emotionally precise.

RESILIENCE MESSAGE
- Same as the other two; weighted with a more mature "you can let go and still care" reading.

OVERALL GRADE: C (POV chaos across trilogy lowers all three)

TOP RECOMMENDATION: Pick ONE POV for all three Octopus stories and apply consistently. Recommend third-person "הילד" / `{{childName}}` to match the rest of the bank.

═══════════════════════════════════════
FILE: salamander_lahav_bedtime.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- **NAMING INCONSISTENCY**: companion is called "רוּמִי" in the prose but companionId is `salamander_lahav` (לַהַב). This is critical — the loader binds visuals/voice to lahav. The text title uses רוּמִי. **The bank's first agent-pass should have flagged this; this batch has the same systemic bug repeated.**
- **CRITICAL POV BUG**: first-person masculine ("אני מתקרב", "אני קופץ", "אני נשען") throughout. Will break for female child.
- p4: "רוּמִי אומר: 'בסדר.' עוד ניצוץ עולה. הוא בולע." — "אומר" masculine; rest of bedtime says רוּמִי is male. fantasy version (below) flips to feminine. Trilogy disagrees on lahav's gender.

POV CONSISTENCY
- First-person masculine for child. Same problem as octopus.

READ-ALOUD RHYTHM
- Short. Fine.

AGE-APPROPRIATE VOCABULARY (4–7)
- All clear.

HEART LINE LANDING
- heartLine: p5 — Lahav presses jaw shut, glowing patterns fade to grey. Page reads: "הקווים שלו הפכו אפורים. הראש שלו למטה. הוא לא נושם כמעט." STRONG.

RESILIENCE MESSAGE
- "Anger swallowed dims you; let one spark out and your color returns." Beautiful. Lands.

OVERALL GRADE: C (naming bug + POV gender lock)

TOP RECOMMENDATION: Rename the companion from "רוּמִי" to "לַהַב" everywhere; convert first-person to third-person.

═══════════════════════════════════════
FILE: salamander_lahav_adventure.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- **NAMING INCONSISTENCY**: again "רוֹמִי" instead of "לַהַב". Different spelling than bedtime ("רוּמִי" vs "רוֹמִי"). Trilogy-internal spelling drift.
- **CRITICAL POV BUG**: first-person ("אני הולך", "אני ניגש", "אני מצחקק", "אני מתחיל"). Masculine throughout.
- p5: "אני מצחקק. זה כיף!" — "כיף" is fine for kids; informal register works.
- p9: "אני מבין משהו — זה לא רק בגללי. הוא תמיד עושה ככה." — strong, age-appropriate insight.
- p15: "האש קטנה, אבל היא שם." — strong closing.

POV CONSISTENCY
- First-person masculine.

READ-ALOUD RHYTHM
- Short. Good.

AGE-APPROPRIATE VOCABULARY (4–7)
- p3: "אני דופק בידיים על האבן. ניצוֹצוֹת קטנים קופצים באוויר." — perfect physical/visual.

HEART LINE LANDING
- heartLine: p8 — spark reaches lips, jaw clenches, spark goes back in, patterns fade. Page reads: "ניצוֹץ אחד מגיע לפה שלו. הוא לוֹחץ את הלסת חזק חזק. הניצוֹץ נכנס פנימה. כל הגוף שלו מתקשה." STRONG.

RESILIENCE MESSAGE
- Same as bedtime; this is the strongest delivery in the salamander trilogy. The "I realize it's not just because of me" beat (p9) is the most emotionally precise moment in the entire batch.

OVERALL GRADE: B- (would be A- with names/POV fixed)

TOP RECOMMENDATION: Fix naming (רוֹמִי → לַהַב) and POV (first-person → third-person).

═══════════════════════════════════════
FILE: salamander_lahav_fantasy.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- **CRITICAL CHARACTER BUG**: the companion is called "רוּמִי" AND treated as **feminine** ("הסלמנדרה", "היא יושׁבת", "כפות לחות", "רוּמִי בולעת" p7, "היא אומרת", "רוּמִי נושׁפת"). YAML `gender: male` (the lava-salamander Lahav is meant to be male). Both naming and gender are wrong. **This file is unusable as written.**
- p2: "סלמנדרה אפורה. קווים דהויים על הגוף שלה" — feminine.
- p4: "אומרת הסלמנדרה. קולה איטי." — feminine.
- p7: "רוּמִי בולעת משהו. הלשון הקצרה שלה מהבזיקה לרגע" — feminine.
- This goes on for all 20 pages.
- **CRITICAL POV BUG**: also first-person ("אני עומד", "אני מתקרב", "אני מועד", "אני בועט", "אני מבין"). Masculine.
- So this story has BOTH the wrong companion gender AND the wrong narrator POV.
- p7: "מהבזיקה" — "מַבְזִיקָה" (flashing) — abstract verb for 5yo. replace with: "יוצאת רגע ונעלמת".
- p17: "אבל היא מתרחקת ממני" — fine emotional beat.

POV CONSISTENCY
- First-person masculine narrator + feminine companion. Massively inconsistent with bedtime/adventure (which also use first-person but treat Lahav as male).

READ-ALOUD RHYTHM
- Short pages. OK.

AGE-APPROPRIATE VOCABULARY (4–7)
- "מהבזיקה" — replace.

HEART LINE LANDING
- heartLine: p10 — Lahav presses body to rock to hide fading patterns. Page reads: "רוּמִי מצמידה את הגוף שלה לסלע... היא מחביאה את הצד שכבר לא זוהר." STRONG visually, but reads wrong because Lahav has been re-gendered.

RESILIENCE MESSAGE
- "Hidden anger burns you; small sparks released ease the burn." Strong message — but cannot land while the character is the wrong gender.

OVERALL GRADE: D- (multiple critical bugs)

TOP RECOMMENDATION: This is the worst file in the batch. Full rewrite needed: companion gender → masculine, name → לַהַב (consistent spelling), narrator → third-person.

═══════════════════════════════════════
FILE: fawn_tzvi_bedtime.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- **POV BUG**: first-person masculine for child ("אני מוחא כפיים", "אני שׂם יד", "אני יושׁב", "אני מקיש", "אני מטפטף"). YAML `gender: male`. Internally consistent for boys but breaks gender swap. Same systemic pattern as other batch.
- p10: "אחר כך את הקדמיות, ושוקע ליד הברך שלי — דרך הצבי לשכב." — "דרך הצבי לשכב" is awkward construction. Means "the way a deer lies down" but reads stilted. fix: "כמו שצבי נשכב" or just drop the phrase.
- p4: "האוזניים שׁטוּחות לצדדים" — flat-eared body language is precise; image-direction friendly. Keep.
- p4: "הפרח כָּבָה" — "כָּבָה" (extinguished) — biblical/strong word, perfect for the dimming-flower image. OK for 5yo with image support.
- p10: "מתחת לכוכבים" — fine.

POV CONSISTENCY
- First-person masculine narrator. Breaks for girls.

READ-ALOUD RHYTHM
- p1: 31 words — long for a first page. Could trim. "אוזן אחת קדימה, אוזן אחת הצידה. הוא מקשׁיב. האף הקטן שלו נשלח לכיוון הרוח, ריחרוח קל פעמיים." — "האף הקטן שלו נשלח לכיוון הרוח" reads awkward; "נשלח" is passive ("is sent"). fix: "האף הקטן שלו פונה לרוּחַ".
- Other pages short, breathable.

AGE-APPROPRIATE VOCABULARY (4–7)
- "ריחרוח" (p1) — fine, kids like the onomatopoeia.
- "האף שלו נשלח" — replace.

HEART LINE LANDING
- heartLine: p5 — Tzvi taps hoof twice, listens, flower stays wilted, doesn't move. Page reads: "הוא מקיש פעמיים על האדמה עם הפרסה. שׁקט. הפרח לא זז. צבִי לא זז." STRONG.

RESILIENCE MESSAGE
- "Some sounds you cannot predict; sitting still beside someone who is frozen is enough." Beautiful and accurate to the SENSITIVITY_OVERWHELM goal. Implicit, lands.

OVERALL GRADE: B (would be A- with POV fixed)

TOP RECOMMENDATION: Convert first-person to third-person; tidy "האף שלו נשלח לכיוון הרוח" and "דרך הצבי לשכב".

═══════════════════════════════════════
FILE: fawn_tzvi_adventure.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- **POV BUG**: first-person masculine throughout ("אני נכנס", "אני שׁואל", "אני מוֹחֵא כף", "אני עומד", "אני עוֹשׂה צעד", "אני מקשיב").
- p13: "כנפיים כמעט שׁקוּפוֹת. גוף ארוך ודק." — beautiful, image-direction-friendly.
- p14: "הוא לא ניסה לדעת מה יקרה. פשׁוט הקשׁיב." — perfect. Crystalizes the message.
- p1: "אני נכנס לשׂדה והדשא גבוה" — "ו" connecting two independent clauses; fine.
- p4: "כל צליל בא בדיוק כמו שׁהוא אמר." — strong rhythm.
- p2: "'איך אתה יודע?' אני שׁואל. 'אני שׁומע את מה שׁבא אחרי,' הוא עונה." — wonderful dialogue. Keep.

POV CONSISTENCY
- First-person masculine. Same problem.

READ-ALOUD RHYTHM
- Long pages — p1 (48 words), p2 (42 words), p4 (41 words). These are above the 5yo read-aloud comfort zone. Several pages need trimming.
- p10: 12 words — perfect quiet beat.

AGE-APPROPRIATE VOCABULARY (4–7)
- All accessible.

HEART LINE LANDING
- heartLine: p8 — Tzvi flattens ears, lets flower wilt, freezes completely even when child calls softly. Page reads: "צבִי לא זז. האוזניים שׁטוּחוֹת לחלוטין. העיניים עצוּמוֹת. הרגליים קפואות כמו עץ. הפרח מתכווץ ונובל." STRONG. The strongest heart-line image in the batch.

RESILIENCE MESSAGE
- Same as bedtime, more developed. Lands.

OVERALL GRADE: B+ (would be A with POV + trimmed pages)

TOP RECOMMENDATION: Trim pages 1, 2, 4, 6 to ≤30 words; convert first-person to third.

═══════════════════════════════════════
FILE: fawn_tzvi_fantasy.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- **POV BUG**: first-person masculine again ("אני הולך", "אני אומר חזק" p7, "אני עומד", "אני טופף").
- p1: "אני הולך בשדה שמשמיע צלילים. כל צעד עושה צליל אחר. העשב עושה 'טַשׁ'. האבנים עושות 'טוֹק'. הפרחים עושים 'טִינְג' קטן" — beautiful onomatopoeia. Pages of sounds. The world-rule lands cleanly.
- p3: "עכשיו טפיפה. טפיפה קטנה נשמעת מהעשב." — fine.
- p7: "'בוא, זה בסדר,' אני אומר. צבי עומד. הוא מקשיב למשהו. 'אני לא יודע לחכות יותר,' אני אומר חזק. הוא מסתכל עלי. לא זז. אני הולך קדימה בלי לחכות לו." — this is the **emotionalMistake** beat and it works dramatically. Strong.
- p10: "אף צליל לא חוזר. הפרח שלו קמל. נופל קצת הצידה." — image precise.
- p20: "צבי הולך מאחורי. לא קרוב." — accepts that some children stay behind. Strong "distance" ending.

POV CONSISTENCY
- First-person masculine.

READ-ALOUD RHYTHM
- Mostly short. p1 (37 words) is busy but the onomatopoeia carries it. p3 (34 words) OK.

AGE-APPROPRIATE VOCABULARY (4–7)
- All accessible. The onomatopoeia is age-perfect.

HEART LINE LANDING
- heartLine: p10 — Tzvi taps twice, waits, no echo returns, flower wilts. Page reads: "הוא מחכה. אף צליל לא חוזר. הפרח שלו קמל. נופל קצת הצידה." STRONG. The "no echo returns" image is exactly the sensitivity-overwhelm collapse.

RESILIENCE MESSAGE
- "I cannot fix you; I can offer you my rhythm." This is the cleanest resilience-message delivery in the entire batch. The mom-led explanation needed is minimal.

OVERALL GRADE: A- (would be A with POV fixed)

TOP RECOMMENDATION: Convert first-person to third. Otherwise this is the best-written story in the batch.

═══════════════════════════════════════
FILE: kitten_mishi_bedtime.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- **EXTREMELY heavy nikud**: every line fully marked. This violates v5.4 partial-nikud policy harder than any other file in the batch. Strip down to helping marks.
- p3 dialogue: "'אֲנִי לֹא רוֹצֶה עַכְשָׁו.'" — over-nikud + the line itself is fine.
- The "פרכום" world-rule: "פרכומים שהופכים לחפצים רכים" — "פרכום" / "פִּרְכּוּם" is an unusual word; most Hebrew speakers use "גרגור". Mixing both ("גרגור" in prose, "פרכום" in YAML) is fine but the **filename + heart line use פרכום / פרכומים** while the prose uses **גרגור** — inconsistent. fix: pick one; "גרגור" is much more readable for 5yo.
- p1: "הַגַּרְגּוּר הוֹפֵךְ אֶת הָאוֹר לִכְרִיּוֹת רַכּוֹת. הַכְּרִיּוֹת מִתְנַדְנְדוֹת בָּאֲוִיר." — strong image. Keep.

POV CONSISTENCY
- Third-person. Clean.

READ-ALOUD RHYTHM
- Short pages. p4–p6 have a nice escalation. Bedtime-appropriate length.

AGE-APPROPRIATE VOCABULARY (4–7)
- "פִּרְכּוּם" — likely unknown to most kids. Replace with "גִּרְגּוּר".
- "מִתְנַדְנְדוֹת" — fine, accessible.

HEART LINE LANDING
- heartLine: p5 — Mishi presses paws on his whiskers, tries to purr harder. Page reads: "מִשִׁי לוֹחֵץ בְּכַפּוֹתָיו עַל הַשְּׂפָמִים. הוּא מְנַסֶּה לְגַרְגֵּר עוֹד יוֹתֵר חָזָק. הַגּוּף שֶׁלּוֹ רוֹעֵד." STRONG.

RESILIENCE MESSAGE
- "Even your most reliable comfort tool sometimes can't fix; silent presence is its own gift." Implicit, lands.

OVERALL GRADE: B+ (would be A with nikud trimmed)

TOP RECOMMENDATION: Strip 70-80% of the nikud (keep only on actually-ambiguous words), and harmonize "פרכום" / "גרגור" to "גרגור" throughout.

═══════════════════════════════════════
FILE: kitten_mishi_adventure.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- p2: "ילדה" + p3-p10 "הילדה" — **gender: female** for child throughout. YAML says `gender: male`. **YAML/prose gender mismatch.**
- p2: "ילדה נכנסת במהירוּת. בידיה חוט ריק." — feminine.
- p5: "הילדה מזיזה את מִשִׁי קצת הצידה" — feminine.
- p10: "הילדה מטפסת על העץ מהר" — feminine.
- p15: "הילדה ליד" — feminine.
- Same systemic gender bug as bear_cub_gahal_adventure.
- p3: "'מ-מ-מיאוּ...' הוא אומר" — cat sound is great, kid-appropriate.
- p1: low nikud, fine.

POV CONSISTENCY
- Third-person.

READ-ALOUD RHYTHM
- Short. OK.

AGE-APPROPRIATE VOCABULARY (4–7)
- All clear.

HEART LINE LANDING
- heartLine: p8 — Mishi presses shaking whiskers flat against a stone, hiding while purring harder. Page reads: "מִשִׁי לוחץ את השפמים אל אבן. הוא מגרגר חזק יותר, אבל השפמים רועדים. הפעמון רוטט בצוואר." STRONG.

RESILIENCE MESSAGE
- "Letting go of trying to soothe is sometimes how you sit with someone." Implicit, lands.

OVERALL GRADE: C+ (gender swap is the blocker)

TOP RECOMMENDATION: Fix the gender mismatch — same pattern as bear_cub_gahal_adventure.

═══════════════════════════════════════
FILE: kitten_mishi_fantasy.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- **EXTREMELY heavy nikud**: every page fully marked. Same v5.4 violation. Worse than bedtime.
- p11-p12: "הַבַּעֲיָה" (the problem) appears many times — abstract noun. For a 5-year-old "הבעיה" is intellectualized. **Use a concrete word**: "הַדָּבָר הַקָּשֶׁה" (the hard thing) or describe it ("הַחֵפֶץ הַכָּבֵד").
- p20: "חֵפֶץ קָטָן מִתְרַכֵּךְ שָׁם, רָחוֹק. הַיֶּלֶד מַחְזִיק אֶת הַבַּעֲיָה. הִיא עוֹד קָשָׁה בַּיָּדַיִם." — strong closing image.
- p2: "צוּרָה כֵּהָה" (dark shape) — fine, vague-by-design.
- p14: "הוּא מוֹרִיד אֶת הַפַּעֲמוֹן מֵהַצַּוָּארוֹן" — "צַוָּארוֹן" (collar) — fine word but the prose accents (over-nikud) make it feel grammatically labored.

POV CONSISTENCY
- Third-person throughout. Clean.

READ-ALOUD RHYTHM
- Pages 20-26 words mostly. OK. Heavy nikud slows the parent's reading.

AGE-APPROPRIATE VOCABULARY (4–7)
- "בעיה" — concrete swap recommended.
- "מתרכך" — fine.

HEART LINE LANDING
- heartLine: p10 — Mishi presses whiskers to floor, purrs harder. Page reads: "מִשִׁי לוֹחֵץ אֶת הַשְּׁפָמִים שֶׁלּוֹ אֶל הָרִצְפָּה. הַגּוּף הַקָּטָן כֻּלּוֹ רוֹעֵד. הוּא מְגַרְגֵּר עוֹד יוֹתֵר חָזָק, כְּדֵי לְכַסּוֹת אֶת הָרֶעַד." STRONG.

RESILIENCE MESSAGE
- "Your soothing tool cannot solve every problem; sitting beside the hard thing is its own answer." Strong message. Lands.

OVERALL GRADE: B (would be A- with nikud trimmed + "בעיה" concretized)

TOP RECOMMENDATION: Strip 80% of the nikud, replace abstract "הבעיה" with concrete "הדבר הכבד" / "החפץ הקשה".

═══════════════════════════════════════
FILE: snail_sheli_bedtime.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- p1: "שֶׁלִּי בפנים. הקונכייה שלו סגורה." — naming: "שֶׁלִּי" reads as "mine" — homophone. Companion's name spoken in context "שלי בפנים" can be misheard as "mine is inside". Suggests illustrator and parent both need to disambiguate. Not a fix-needed but a flag.
- p1: "בחוּץ יש פרחים גדולים, ודבורה עפה מעל. הכול רועשׁ." — strong setup.
- p3: "האוֹר שבפנים נעשה קטן יותר" — image-friendly.
- p8: "האנטנות שלו נוגעות זו בזו, שלושׁ פעמים" — gendered "זו בזו" feminine because "אנטנות" is feminine plural. Correct grammar.
- p10: "האנטנות נוגעות, נוגעות, נוגעות — לאט." — beautiful rhythm. Read-aloud gold.

POV CONSISTENCY
- Third-person. Clean.

READ-ALOUD RHYTHM
- Short. Excellent for bedtime.

AGE-APPROPRIATE VOCABULARY (4–7)
- "קונכייה" — age-OK, kids learn it from beach.
- "מחושים" — story uses "אנטנות" instead (p3, p8) which is more accessible — good choice.

HEART LINE LANDING
- heartLine: p5 — Sheli pulls a shiny decoration close, turns it away from opening, his joy dims. Page reads: "שֶׁלִּי מושך אליו קישׁוט קטן שזוהר, ומסובב אותו הצידה. האוֹר שבפנים נעשה קטן יותר." STRONG. The "turning his joy away" gesture is precise.

RESILIENCE MESSAGE
- "Some children stay half-inside; that's a real meeting too." Lands beautifully.

OVERALL GRADE: A-

TOP RECOMMENDATION: Maybe flag the "שלי = mine" homophone in the marketing/preview, but no rewrite needed. This is the cleanest story in the batch.

═══════════════════════════════════════
FILE: snail_sheli_adventure.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- p1: "שֶׁלִּי כבר בפנים. כל הגוף שלו בתוך הקונכייה." — same שלי-homophone. OK.
- p4: "פתאום — כנפיים גדולות עפות מעל. צללים קופצים על הקונכייה. רעשׁ." — short and dense, beautiful pacing.
- p8: "בתוך הקונכייה, בחוֹשֶׁך, שֶׁלִּי לוחץ את שתי האנטנות שלו זו לזו. הוא לא יוצא." — STRONG heart-line beat. Use of "בחוֹשֶׁך" is perfect.
- p13: "יֵשׁ עכשיו שׁובל קטן מאחורי הקונכייה." — "שׁובל" (trail) — fine, helped by illustrator.
- p15: "על האבן יֵשׁ שׁובל מבריק. הוא מוביל עד לקונכייה של שֶׁלִּי." — closing residue, strong.

POV CONSISTENCY
- Third-person. Clean.

READ-ALOUD RHYTHM
- Short, breathable. Good.

AGE-APPROPRIATE VOCABULARY (4–7)
- All accessible. "שׁובל" might need a one-time explanation but is image-supported.

HEART LINE LANDING
- heartLine: p8 — Sheli presses antennae together in the dark while butterfly lands outside. Page reads exactly that, masterfully. STRONG.

RESILIENCE MESSAGE
- "You can stay safe AND still leave a trail of your presence." Beautiful. Implicit.

OVERALL GRADE: A-

TOP RECOMMENDATION: No major changes needed. Maybe lengthen p11 from 10 words to 14-16 — currently feels rushed at the quiet-page mark.

═══════════════════════════════════════
FILE: snail_sheli_fantasy.md
═══════════════════════════════════════

HEBREW GRAMMAR & STYLE
- p2: "ילדה" + p5 "'אתה שם?'" — child is **feminine** ("הילדה", "היא יושבת", "היא מנסה" p6, "היא נוגעת" p5). YAML `gender: male`. **YAML/prose gender mismatch.** Third file in the batch with this exact bug.
- p13: "הילדה מביטה בשֶׁלִּי, ואז בפרח הזוהר, ואז חזרה בשֶׁלִּי. גם אם יהיה יפה, הוא עדיין יכול לחזור פנימה. זה מה שהוא." — beautiful line, age-appropriate "this is who he is" acceptance.
- p11: "שביל לחלוחית קטן נמתח על האדמה מתחתיו." — "לחלוחית" (moisture) — accessible.
- p20: "הם לא ביחד, אבל גם לא לבד." — strong distance-ending. STRONG.

POV CONSISTENCY
- Third-person. **Gender mismatch** between YAML and prose.

READ-ALOUD RHYTHM
- Pages mostly 24-30 words. p1 (36 words) is busy. p15 (12 words) is the quiet beat — perfect.

AGE-APPROPRIATE VOCABULARY (4–7)
- "לחלוחית" — accessible with illustration.
- "מתעצב" doesn't appear, good.

HEART LINE LANDING
- heartLine: p10 — Sheli stays fully inside while glowing flower blooms beside; his shell dims as if he feels it but cannot join. Page reads: "פרח קטן ליד הקונכייה פותח עלים מאירים... אבל שֶׁלִּי לא יוצא. הקונכייה שלו מאירה רגע, חלשה יותר, ואז חוזרת לחושך." STRONG. "Feels it but cannot join" — exact representation of overwhelm.

RESILIENCE MESSAGE
- "You can love someone who stays partly inside; presence is not the same as participation." The most therapeutically precise story in the batch. Implicit, lands cleanly.

OVERALL GRADE: B+ (would be A with gender fixed)

TOP RECOMMENDATION: Fix the YAML/prose gender mismatch (either change YAML to `gender: female` or rewrite "הילדה / היא" → masculine).

═══════════════════════════════════════
SUMMARY (END-OF-REPORT)
═══════════════════════════════════════

TOP 3 SYSTEMIC HEBREW ISSUES

1. **POV / gender chaos** — at least 8 of 27 stories use first-person ("אני") or second-person ("את" / "אתה") narrators that **lock** gender. Combined with YAML `gender: male` declarations contradicted by feminine ("ילדה / הילדה / היא") prose in 3 stories (bear_cub_gahal_adventure, kitten_mishi_adventure, snail_sheli_fantasy), the gender-swap pipeline will produce broken text. The lion_shaket_adventure mixes second-person masculine + one feminine slip ("אלייך") — completely unrecoverable as-is.

2. **Companion-name drift** — three files name the protagonist incorrectly relative to YAML companionId. salamander_lahav_* trilogy calls the companion "רוּמִי" / "רוֹמִי" instead of "לַהַב" (and bedtime spells it רוּמִי, adventure spells it רוֹמִי — inconsistent inside the trilogy). ant_harutza_fantasy mixes "טִיטִי" with "חֲרוּצָה". octopus_seara_* uses "זוּזִי" while file is `octopus_seara`. The loader uses companionId to bind visuals — any name drift in the prose creates a mismatch the reader can hear.

3. **Over-nikud** — three files (butterfly_zohar_fantasy, kitten_mishi_bedtime, kitten_mishi_fantasy) ignore the v5.4 partial-nikud rule and fully-mark almost every word. This violates a documented style policy AND slows parent read-aloud. Mishi fantasy is the worst offender — 20 pages of full marking.

TOP 5 INDIVIDUAL STORIES NEEDING REWRITE

1. **salamander_lahav_fantasy.md** — wrong companion name (רוּמִי), wrong companion gender (feminine when male expected), wrong child POV (first-person). Triple-bug. **Full rewrite.**
2. **octopus_seara_bedtime.md** — child is "את" (second-person feminine) while YAML says male; companion called "זוּזִי" not "Seara". Unusable as written.
3. **octopus_seara_adventure.md** — first-person feminine narrator vs male YAML. Same trilogy issue.
4. **lion_shaket_adventure.md** — POV switches between second-person masc, second-person fem, and third-person across 15 pages. Worst POV instability in batch.
5. **ant_harutza_adventure.md** — the notebook/measurement-journal motif teaches a 5yo to quantify her inferiority. Re-author with body gesture instead of journaling.

GRADE DISTRIBUTION

- A / A-: 4 stories (snail_sheli_bedtime A-, snail_sheli_adventure A-, lion_shaket_bedtime A-, fawn_tzvi_fantasy A-)
- B+ / B: 9 stories (butterfly_zohar_bedtime B+, butterfly_zohar_adventure B+, butterfly_zohar_fantasy B, fawn_tzvi_bedtime B, fawn_tzvi_adventure B+, bear_cub_gahal_bedtime B+, bear_cub_gahal_fantasy B+, kitten_mishi_bedtime B+, kitten_mishi_fantasy B, snail_sheli_fantasy B+)
- B-: 1 (ant_harutza_fantasy B-, salamander_lahav_adventure B-)
- C+ / C: 5 (ant_harutza_bedtime B, ant_harutza_adventure C, lion_shaket_fantasy C+, bear_cub_gahal_adventure C+, kitten_mishi_adventure C+, salamander_lahav_bedtime C, octopus_seara_fantasy C)
- D / D+: 4 (lion_shaket_adventure D, octopus_seara_bedtime D+, octopus_seara_adventure D+, salamander_lahav_fantasy D-)

(Aggregating duplicates: most fall into B / B+ range; the bottom quartile is dominated by POV/gender/naming bugs not by Hebrew style.)

FOUR-HOUR PRIORITY PASS

Spend the first 90 minutes on the POV/gender/naming bugs that block production: rewrite all first-person ("אני") and second-person ("את"/"אתה") narrators in the lion, octopus, salamander, and fawn trilogies to third-person `{{childName}}` placeholders so the loader's gender-swap works; in the same pass fix the salamander naming bug (רוּמִי/רוֹמִי → לַהַב), the octopus naming bug (זוּזִי → Seara per companionId), and the three "הילדה vs gender: male" YAML mismatches (bear_cub_gahal_adventure, kitten_mishi_adventure, snail_sheli_fantasy). Spend the next 60 minutes stripping nikud out of butterfly_zohar_fantasy and the two kitten_mishi files down to v5.4 helping-marks only — these are mechanical edits but they meaningfully change read-aloud quality. Spend 45 minutes on the ant_harutza_adventure rewrite — replace the notebook-journaling motif with body-gesture lines so the story stops modeling obsessive self-quantification. Reserve the final 45 minutes for targeted line-level fixes flagged above: "שלי שלי שלי" homophone in ant_harutza_bedtime, "מתנשֵׂא" / "מַחֲזִירוֹת" / "מתפצלים" / "מהבזיקה" register problems, "דברים לא הוגנים שהוא מדמיין" in bear_cub_gahal_bedtime, and trimming the over-long pages in butterfly_zohar_fantasy and fawn_tzvi_adventure. After this 4-hour pass, the bottom-quartile stories move to B-/B and the batch is publication-ready except for two true rewrites (salamander_lahav_fantasy, lion_shaket_adventure) that need a fresh second-pass.
