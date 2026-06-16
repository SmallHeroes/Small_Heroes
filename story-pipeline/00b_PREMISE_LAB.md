# 00b · Premise Lab (Mode A — ideation, run BEFORE the draft)

**Why this exists:** the Master Prompt (Mode B) writes a full story from a premise. If you hand the model a one-line premise, it commits to its *first* idea — and a model's first idea is usually the generic one. The Premise Lab forces 6–10 candidates, scores them honestly, and you pick the one with the most life. **This is the single biggest quality lever in the pipeline.**

> Two modes:
> **Mode A (this file)** — generate + score premise candidates → choose 1.
> **Mode B (`00_MASTER_STORY_PROMPT_TEMPLATE.md`)** — write the full Hebrew story from the chosen premise.

---

## How to use

1. Open the companion sheet (`01_companions/<companion>.md`) and the slot row.
2. Fill the 4 blanks below, paste `=== PROMPT START ===` → `=== PROMPT END ===` into ChatGPT.
3. Read the 8 candidates. Score them brutally (the prompt asks ChatGPT to self-score, but **you** make the call). Kill anything generic.
4. Pick one. Paste the chosen candidate's full block into Mode B's `‹‹SLOT_PREMISE››` (it's richer than a one-liner — that's the point).

## Fill these 4 blanks

```
‹‹COMPANION_SHEET››   = the "CHARACTERIZATION (for the model)" block from the companion sheet
‹‹DIRECTION››         = bedtime | adventure | fantasy
‹‹CATEGORY››          = e.g. NIGHT_FEAR
‹‹SLOT_SEED››         = the premise seed + any per-companion concrete requirement from the sheet's MISSING SLOTS row
                        (e.g. fox-fantasy: "one central night mystery with accumulating clues, not unrelated shadow checks")
```

---

```
=== PROMPT START ===

אתה עורך ספרותי של סדרת ספרי ילדים עברית "גיבורים קטנים" (חוסן רגשי, הילד/ה הגיבור/ה + חיה מלווה, גיל יעד 4–6). אנחנו בשלב לפני כתיבה: אני רוצה *רעיונות*, לא סיפור. כתוב בעברית.

# ההקשר
כיוון: ‹‹DIRECTION›› · קטגוריה: ‹‹CATEGORY›› · גיל יעד: 4–6.

# החבר/ה המלווה — קנון מחייב
‹‹COMPANION_SHEET››

# נקודת הזינוק לסלוט
‹‹SLOT_SEED››

# המשימה
הצע 8 רעיונות *שונים מהותית* זה מזה לסיפור הזה. לא 8 וריאציות של אותו רעיון — 8 זוויות אמיתיות שונות.
לכל רעיון, החזר בדיוק את 8 השדות האלה:

1. premise — משפט-שניים: מה קורה רגשית ועלילתית.
2. central story object — האובייקט הקונקרטי האחד שהסיפור סובב סביבו (חייב להיות פיזי ולמשוך גם איור).
3. recurring gag — הבדיחה/התנועה החוזרת שמגיעה מהמנוע הקומי של החבר/ה (לא גנרית — מהקנון שלו/ה).
4. emotional mistake — הדרך הלא-נכונה שהילד/ה מנסה קודם (להחביא/לבלוע/לברוח), ולמה היא מחמירה.
5. child agency moment — הרגע המדויק שבו הילד/ה עושה את הצעד שהחבר/ה לא יכול/ה (הילד/ה מוביל/ה את השיא).
6. visual promise — מה הופך את זה למרהיב לאיור: סט, אור, תנועה.
7. why this is NOT generic — משפט אחד: למה הרעיון הזה לא יכול להיכתב עם "חיה נחמדה כללית" (קשר ישיר לקנון/swapTest).
8. risk of failure — איך הרעיון הזה עלול להתקלקל / להפוך לקלישאה, ומה צריך להיזהר ממנו.

# כללי איכות לרעיונות
- גיל 4–6: רעיון קונקרטי, לא מופשט-ספרותי-למבוגרים.
- כל רעיון חייב לכבד את ה-doNotWriteList ולעבור את ה-swapTest של החבר/ה.
- אם כיוון הסלוט הוא חלש לחבר/ה (ראה weak-direction note בקנון) — הרעיונות חייבים להתמודד עם הסכנה הזו, לא להתעלם ממנה.
- העדף רעיונות שיש בהם mystery/התפתחות אחת מרכזית על פני "רשימת אירועים".

# אחרי 8 הרעיונות — ניקוד
דרג כל רעיון 1–10 בשלושה צירים, וציין ציון משוקלל:
- freshness (כמה הוא לא-צפוי)
- emotional truth (כמה הרגש אמיתי ולא מתוק-מדי)
- companion fit (כמה רק החבר/ה הזה/הזו יכול/ה לשאת אותו)
ואז המלץ על 2 המובילים, ונמק במשפט מה חזק בכל אחד.

# חשוב
אל תכתוב סיפור. אל תכתוב עמודים. רק 8 רעיונות + ניקוד + 2 מומלצים.

=== PROMPT END ===
```

---

## After the lab: pick + hand off

Choose **one** candidate. **The score is an input, not a verdict** — *you* pick. The model usually scores its most *tidy/orderly* idea highest, not its most *alive* one; don't default to its top pick if a lower-ranked candidate has more life. Then in `00_MASTER_STORY_PROMPT_TEMPLATE.md`, paste the chosen candidate's full 8-field block into `‹‹SLOT_PREMISE››`. The Master Prompt now has a *strong, specific* idea to render instead of inventing one on the spot.

> ### MANDATORY spine step for fantasy / weak-direction slots
> For these five slots — **fox·fantasy, dragon·adventure, bunny·fantasy, chameleon·fantasy, lion·fantasy** — do NOT go straight to prose. After choosing the premise, ask ChatGPT for a **story spine + page beats** first ("תן לי שדרה + ראשי-פרקים לכל עמוד, בלי פרוזה מלאה"), eyeball that the arc holds, *then* run Mode B. These are exactly the slots where a good idea breaks in the structure. For the other (easier) slots the spine step is optional but recommended.
