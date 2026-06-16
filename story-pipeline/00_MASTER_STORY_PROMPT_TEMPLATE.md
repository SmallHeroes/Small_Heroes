# 00 · Master Story Prompt Template — Mode B (full draft)

**Purpose:** write the full Hebrew story for one slot **from an already-chosen premise**. Fill the blanks from the companion sheet + the premise you picked in the Premise Lab, paste into ChatGPT, get a Hebrew draft in the exact bank format, then route to Claude for gender-QA + validators before approval.

> ⚠ **Run the Premise Lab first.** This template renders an idea — it does not invent a good one. Use `00b_PREMISE_LAB.md` (Mode A) to generate + score 6–10 candidates and pick one, then paste the chosen candidate's full block into `‹‹SLOT_PREMISE››` below. Skipping the lab is the #1 way to get "correct but generic" stories.

> Workflow: **premise lab (Mode A) → choose idea → this template (Mode B) draft → Claude gender-QA/validators → you approve → Cursor imports to bank.**
> Do NOT skip the validator pass — the bank format, gender chips, and companion-speech rules are enforced in code and a malformed draft fails the import gate.

---

## How to use (30 seconds)

1. Open the companion's sheet in `01_companions/` (e.g. `fox_uri.md`).
2. Copy the **PROMPT INPUTS** block from that sheet into the blanks below.
3. Set the direction (bedtime / adventure / fantasy) and read that direction's voice note + the beat count.
4. Paste everything from `=== PROMPT START ===` to `=== PROMPT END ===` into ChatGPT.
5. Paste the returned draft into a new file under `02_prompts/drafts/` and tell me (Claude) "QA this slot".

---

## Fill these 6 blanks

```
‹‹COMPANION_SHEET››      = paste the full "CHARACTERIZATION (for the model)" block from 01_companions/<companion>.md
‹‹DIRECTION››            = bedtime | adventure | fantasy
‹‹BEATS››                = 8 (bedtime) | 12 (adventure) | 16 (fantasy)
‹‹CATEGORY››             = the emotional category (e.g. NIGHT_FEAR, ANGER_FRUSTRATION) — from the sheet
‹‹SLOT_PREMISE››         = the CHOSEN candidate's full 8-field block from the Premise Lab (premise + central object + recurring gag + emotional mistake + child agency + visual promise + why-not-generic + risk). NOT a one-liner.
‹‹WORLD_RULE››           = the single sentence the whole story obeys — from the sheet (direction-specific)
```

---

```
=== PROMPT START ===

אתה סופר ילדים עברי מצוין. אתה כותב ספר מתוך סדרת "גיבורים קטנים" — ספרי חוסן רגשי מותאמים אישית, שבהם הילד/ה הוא/היא הגיבור/ה, לצד חבר/ת חיה מלווה. כתוב בעברית בלבד.

# המשימה
כתוב סיפור שלם של ‹‹BEATS›› עמודים (beats), בכיוון "‹‹DIRECTION››", בקטגוריה ‹‹CATEGORY››.

# החבר/ה המלווה — קנון מחייב (אסור לסטות)
‹‹COMPANION_SHEET››

# הפרמיסה של הסיפור הזה
‹‹SLOT_PREMISE››

# חוק העולם (כל הסיפור מציית למשפט הזה)
‹‹WORLD_RULE››

# הבר הספרותי (זה הכי חשוב — אל תכתוב "סביר ותקין", כתוב מצוין)
- **גיל יעד: 4–6.** שפה קונקרטית בגובה ילד/ה, לא הפשטה ספרותית-למבוגרים. משפט שנשמע "כתוב למבוגרים" — לפשט.
- כתיבה ספרותית אמיתית, לא פרוזה גנרית "נכונה". משפטים קצרים, חמים, עם קצב. דימוי קונקרטי אחד טוב עדיף על שלושה כלליים.
- **אסור תבניתיות.** הסכנה היא חזרה *משטחית* (אותו מבנה משפט, אותו פתיח עמוד, אותה מילת מעבר). גוון את הפתיחים, את אורך המשפט, את התמונה החושית בכל עמוד.
- רגש אמיתי, לא מתוק-מדי. בלי מוסר-השכל בסוף. בלי שפת מטפל/ת ("בוא נירגע", "תנשום עמוק") אלא אם זה מתורגם לפעולה פיזית קונקרטית של החבר/ה.
- **סוכנוּת הילד/ה (childAgency) חובה:** יש רגע אחד שבו הילד/ה עושה את הצעד שהחבר/ה המלווה לא יכול/ה — הילד/ה מוביל/ה את השיא, לא מקבל/ת הצלה. סמן/י אותו.
- החבר/ה המלווה לא פותר/ת את הבעיה במקום הילד/ה. הוא/היא נותן/ת כלי, טועה קצת, ומשאיר/ה מקום.
- ה"כלי" הרגשי חייב להיות **פיזי וקונקרטי** (חפץ, תנועה, ריטואל גוף) — לא רעיון מופשט.

# מבנה רגשי נדרש (סמן/י את העמודים)
- **emotionalMistake** — עמוד מוקדם שבו הילד/ה מנסה את הדרך הלא-נכונה (להחביא/לבלוע/לברוח) וזה מחמיר.
- **heartLine** — עמוד שבו החבר/ה המלווה מודה/חושף/ת חולשה קטנה משלו/ה (לא מושלם/ת — צריך/ה גם את הילד/ה).
- **agencyTransfer** — העמוד שבו הילד/ה בוחר/ת/עושה את הצעד המכריע בעצמו/ה.
- **quietPage** — עמוד שקט אחד לקראת הסוף (נשימה, האטה) לפני הסגירה.
- **ending** — סגירה רכה. סוג: לרוב "residue" (משהו קטן נשאר, העולם נשמע אחרת) או "resolution" (הרגש מצא מקום). בלי הטפה.
- **אסור שזה ירגיש כמו נוסחה.** הביטים האלה חייבים להתקיים — אבל החבא אותם *בתוך אירועי הסיפור*. אם כל סיפור מסמן אותם באותו אופן גלוי, זה הורג את הקסם. שום עמוד לא צריך "להיראות" כמו "עמוד ה-heartLine".

# כללי שפה והתאמה אישית (טכני — חובה לדייק)
- שם הילד/ה תמיד כ-placeholder: `{{childName}}` (אסור שם קבוע).
- כל מילה שמתייחסת למגדר הילד/ה ב-chip: `{זכר|נקבה}` — קודם זכר, אחר כך נקבה. דוגמה: `{בנה|בנתה}`, `{החליט|החליטה}`, `{בעצמו|בעצמה}`. אסור להשאיר מילה מגדרית בלי chip.
- החבר/ה המלווה במגדר הקנוני הקבוע (ראה/י בקנון למעלה) — לא chip.
- ניקוד חלקי רק על אונומטופאה ומילים מפתח שצריך להגות נכון ב-TTS (למשל: "טִיק-טָאק", "פּוּף", "רַעַם"). לא לנקד את כל הטקסט.
- 4–6 שורות קצרות לעמוד. עמוד = beat רגשי אחד.

# imageDirection — רזה (lean). חשוב
כל `imageDirection` הוא רמז סצנה קצר באנגלית, ורק זה:
- ✅ כן: מי בפריים / מי לא, הפעולה, המקום, האובייקט המרכזי, הרגש.
- ❌ לא: style boilerplate (אל תכתוב "watercolor / storybook / soft light" וכו'), לא תיאור מראה הילד/ה, לא תיאור זהות החבר/ה המלווה (המערכת מזריקה את אלה לבד), בלי טקסט בתמונה.
- דוגמה טובה: `balcony at night, child crouched by a metal bucket, fox beside with lit neck-lantern, curious`.

# פורמט הפלט — בדיוק כך (זה נכנס למערכת אוטומטית, אל תשנה את המבנה)
פתח/י עם frontmatter ואז העמודים. החזר/י קובץ אחד שלם:

```
---
title: "‹‹כותרת עברית עם {{childName}} ושם החבר/ה››"
companionId: ‹‹companionId מהקנון››
direction: ‹‹DIRECTION››
category: ‹‹CATEGORY››
pages: ‹‹BEATS››
gender: female
endingType: ‹‹residue | resolution››
worldRule: "‹‹WORLD_RULE››"
storyObject: "‹‹האובייקט הקונקרטי המרכזי מהרעיון שנבחר››"
recurringGag: "‹‹הבדיחה/תנועה החוזרת מהמנוע הקומי של החבר/ה››"
childAgencyAction: "‹‹הפעולה המדויקת שהילד/ה עושה בשיא››"
visualSet: "‹‹הסט/המקום המרכזי שחוזר לאורך הספר››"
heartLine: "עמוד N — …"
emotionalMistake: "עמוד N — …"
agencyTransfer: "עמוד N — …"
quietPagePosition: N
---

--- Page 1 ---
imageDirection: ‹‹רמז סצנה קצר באנגלית — מיקום, אור, אובייקט מרכזי, מצב הגוף; בלי טקסט בתמונה››

‹‹4–6 שורות עברית››

--- Page 2 ---
imageDirection: ‹‹…››

‹‹…››

… (המשך עד עמוד ‹‹BEATS››)
```

# לפני שאתה מסיים — בדיקה עצמית (תקן/י אם נכשל)
1. **swapTest:** אם אפשר להחליף את החבר/ה המלווה ב"חיה נחמדה גנרית" בלי לשבור את הסיפור — נכשלת. החזר/י את הייחוד שלו/ה (קול, הומור, ריטואל, הכלי הפיזי).
2. **חוק העולם:** כל עמוד מציית ל-WORLD_RULE?
3. **childAgency:** הילד/ה באמת מוביל/ה את השיא?
4. **תבניתיות:** קרא/י את העמודים ברצף — האם פתיחי העמודים/מבנה המשפטים חוזרים? גוון/י.
5. **chips:** כל מילה מגדרית של הילד/ה ב-`{זכר|נקבה}`? `{{childName}}` בכל אזכור שם?
6. **רשימת "אל תכתוב" של החבר/ה** (ב-doNotWriteList בקנון) — לא הפרת אף סעיף?
7. **מבחן קריאה בקול:** קרא/י כל עמוד בקול כאילו לילד/ה בן/בת 5. אם משפט נשמע "כתוב למבוגרים" או מסורבל — פשט/י אותו. עברית טבעית לקריאה בקול חשובה יותר מכל קישוט.
8. **לא-נוסחה:** אף עמוד לא "מרגיש" כמו עמוד-ביט מסומן; המבנה חבוי בתוך האירועים.

=== PROMPT END ===
```

---

## Notes for Guy

- The frontmatter `gender: female` line is just the *default render gender* for the matrix smoke; the **chips** are what make the text bilingual. Keep `gender: female` as written — Cursor's import handles the boy-run separately.
- `bedtime` stories also support a `powerCard:` block (see `lion_shaket.md` — the thunder card). Add it for bedtime slots where the emotional tool maps cleanly to a takeaway card; skip it if forced.
- If ChatGPT drifts off the companion canon (most common failure: makes fox cunning, makes the companion solve it for the child, adds a moral), paste the `doNotWriteList` back and say "you broke rules 1/3/6, rewrite."
