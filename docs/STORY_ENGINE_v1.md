# Small Heroes — Story Engine v1

> **Status:** v1.0 — Full architecture, ready for first build
> **Owner:** Guy + Claude (CTO) + ChatGPT (QA advisor)
> **Updated:** 2026-05-18
> **Companion docs:** `COMPANION_BIBLE_v1.md`, `PSYCH_ENGINE_v1.md`, `docs/GOLD_STORIES/`

---

## ⚠ קריטי — לקרוא לפני שמשתמשים במסמך

> **This is not a writing prompt. This is a production engine.**
>
> Every rule in this document must do at least one of four things:
> 1. **Generate** better story structure
> 2. **Protect** companion identity
> 3. **Prevent** known failure modes
> 4. **Enable** automatic QA or repair
>
> If a rule does none of these — delete it.

> **Do not ask GPT to be a great writer. Ask GPT to obey a great story machine.**

---

# PART 0 — Product North Star (Kid-First)

## Meta-Rule (קודם לכל)

> **Rules are scaffolding, not visible bones.**
> **אם הילד מרגיש את הצ'קליסט — הסיפור נכשל.**

המנוע הזה עמוס בחוקים. זה בכוונה. אבל **המטרה היא מבנה פנימי, לא שלד חיצוני**. אם תקרא סיפור ותרגיש שזה "ספר שעקב אחר כללים" — לא ניצחנו. אם תרגיש "ספר שהילד אוהב" — ניצחנו, גם אם הכללים שם, מוסתרים בעבודה הטובה.

ה-LLM חייב לפעול לפי החוקים אבל לכתוב כאילו הם לא קיימים.

---

## החוק העליון

> **A Small Heroes story is not a lesson wrapped in fantasy.**
> **It is a child-sized fantasy that creates a bodily rehearsal for a hard emotional moment.**
>
> The child should remember:
> a sound, a movement, a creature, an object, a tiny scene.
> **Not the lesson.**

---

## העמוד-שדרה הכפול

לספר שלנו שני עמודי שדרה. אסור לבלבל ביניהם:

1. **עמוד שדרה ילדי-קסום** — הילד הוא הקהל. הוא רוצה לשמוע שוב.
2. **עמוד שדרה רגשי-טיפולי** — הקושי נפתר. בעקיפין. דרך פעולה.

**הילדי קודם.** אם הסיפור טיפולית מושלם והילד לא חוזר אליו — נכשלנו.

> **The child is the audience. The parent is only the speaker.**

---

## חמשת המבחנים של "ניצחנו" (5 Tests)

לפני שסיפור עוזב את ה-engine, הוא חייב לעבור את חמשת המבחנים. הם **קודמים לכל בדיקה אחרת**.

### Test 1 — Kid Voice (שפת ילדים)
האם ילד יכול **להרגיש את המשפט בגוף** בלי שמבוגר יסביר?

❌ "באותו רגע הוא הבין שהאומץ נמצא בלב שלו"
✅ "הוא חיבק חזק את תּוּקי. **הידיים שלו הפסיקו ללחוץ.**"

המבחן הוא לא "האם זה נשמע כמו ילד מדבר". המבחן הוא "האם זה נגיש לילד בלי תיווך של מבוגר?"

### Test 2 — Repeatable Hook (חוזרים על זה)
האם יש לפחות **שתי שורות / קול / פעולה שילד יחקה אחרי הקראה אחת**?

חובה לכל סיפור:
```
- צליל חוזר (טוּמְפּ, פףף, ששש)
- שורה חוזרת ("הכחול עוד פה", "צעד צעד")
- פעולה שאפשר לחקות (להתקפל לכדור, להתעטף בשמיכה)
```

זה לא קישוט. זה ה-engine.

### Test 3 — The Unforgettable Moment (הרגע)
האם יש **רגע מרכזי אחד** שאם תשאל את הילד מחר "מה היה בסיפור?" — הוא יזכור ראשון?

**מיקום הרגע (חובה):**
- 10 עמודים: עמוד 6-7
- 15 עמודים: עמוד 9-11
- 20 עמודים: עמוד 12-15

**הרגע יכול להיות קטן.** במיוחד אצל דמויות כמו טולי, קים, בולי — הרגע הכי חזק הוא **micro-action ספציפית לדמות**:
- יד שנוגעת בבטן הוורודה של בולי
- קים שמוציאה עין אחת ואז את השנייה מהקופסה
- טולי שמכניסה ראש חזרה חצי מילימטר

**The unforgettable moment may be tiny. It must be unforgettable because it is character-specific, not because it is big.**

### Test 4 — Pace & Music (קצב ומוזיקה)
האם יש **לפחות שני קצבים שונים** בספר — אזורים שקטים ואזורים אנרגטיים?

ספר ילדים זו מוזיקה. לא כל המשפטים באותו אורך, לא כל העמודים באותה דחיסות. עמוד שיש בו רק 3 מילים יכול להיות הרגע הכי חזק בספר.

### Test 5 — Ritual Element (טקס)
האם יש **אלמנט שחוזר לפחות פעמיים** — צליל, תנועה, חפץ, או משפט שהילד יכול לצפות לו?

**ילדים חוזרים לספר בגלל הטקס, לא בגלל ה-arc.**

- בולי = טוּמְפּ
- קים = הכחול עוד פה
- טולי = צעד צעד / חצי מילימטר
- עננה = פףף
- דיני = שמירה קטנה

---

## חוקי הזהב המוחלטים

### Body Before Meaning
> **Every emotional shift must first appear in the body or environment.**
> **Only afterward — if at all — may the narration soften.**

המותר (פיזי):
- כתף יורדת
- יד נפתחת
- שמיכה מפסיקה לזוז
- נשימה איטית
- חפץ נח ליד המיטה
- ריח שנשאר באוויר
- קול שהתרחק
- גוף שנשכב ישר

האסור (משמעות ישירה):
- "הוא הרגיש מוגן"
- "הפחד נעלם"
- "הוא הבין ש..."
- "ידע עתה ש..."
- "כבר לא פחד יותר"

**Meaning must be a consequence of physical action. Never write the meaning first.**

### Companion Swap Test
> **If the story still works after replacing the companion with another animal — the story failed.**

בולי בלי טוּמְפּ/שריון/בטן ורודה = נכשל. קים בלי צבעים מתערבבים = נכשל. **זה QA BLOCKING.**

### No Quote-Card Rule
> **If a sentence sounds like something a parent would post on Instagram — delete it.**

זה החוק שיציל אותנו מ-LLM שמתחיל לכתוב משפטי השראה.

---

## רשימת Kill Phrases (איסור מוחלט בעברית)

ה-LLM ייצר את אלה אם לא נדכא אותן במפורש. דוגמאות שראינו בפרודקשן:

```
אסור לכתוב:
□ "באותו רגע הוא הבין ש..."
□ "ידע עתה ש..."
□ "ירא בלבו ש..."
□ "הוא למד ש..."
□ "היא הבינה ש..."
□ "הפחד נעלם"
□ "האומץ נמצא בליבו"
□ "הבית נמצא בפנים"
□ "השקט ידע"
□ "האור לחש"
□ "הלב זכר"
□ "חשוב לזכור ש..."
□ "לפעמים צריך..."
□ "הכול יהיה בסדר"
□ "הרופא לא יכול לגעת בילד שבפנים"
□ "הוא הרגיש בליבו ש..."
□ "אז הוא הבין..."
□ "מאז הוא לא פחד יותר"
```

**החלפה (פיזי):**

| במקום | כתוב |
|---|---|
| "הוא לא פחד יותר" | "הידיים שלו הפסיקו ללחוץ" |
| "החדר כבר לא היה זר" | "הכרית הרגישה רכה יותר" |
| "הוא הרגיש בטוח" | "הגב שלו שקע במזרן" |
| "הפחד נעלם" | "השמיכה הפסיקה לזוז" |
| "אז הוא הבין" | (לחתוך — פשוט להראות את הפעולה הבאה) |

---

## Self-QA — שאלות PART 0 (gate ראשון לפני כל בדיקה אחרת)

```
□ Q0.1 — האם משפט אחד לפחות נגיש לילד בן {age} בלי תיווך מבוגר?
□ Q0.2 — האם יש Repeatable Hook (צליל/שורה/פעולה) שמופיע לפחות פעמיים?
□ Q0.3 — האם יש Unforgettable Moment במיקום הנכון לפי אורך הספר?
□ Q0.4 — האם הרגע הוא פעולה פיזית ולא הסבר?
□ Q0.5 — האם השינוי הרגשי המרכזי הופיע בגוף לפני שהוסבר במילים?
□ Q0.6 — האם הסיפור יעבוד אם נחליף את הדמות בחיה אחרת? (אם כן — נכשל)
□ Q0.7 — האם יש לפחות שני קצבים שונים (עמוד שקט + עמוד אנרגטי)?
□ Q0.8 — האם יש Ritual Element שחוזר?
□ Q0.9 — האם הסוף משאיר residue חושי (לא מסר)?
□ Q0.10 — האם אין משפט שנשמע כמו פוסט להורים?
□ Q0.11 — האם אין אחת מ-Kill Phrases?
```

**אם אחת מהתשובות "לא" — חוזרים. לא ממשיכים.**

---

# PART 1 — Story Operating System (Generation Pipeline)

**9 שלבים. אסור לדלג. אסור לערב.**

### Stage 1 — Parse Request
קלט: bookOrder (מהוויזרד אחרי Psych Engine translation)

תצרוכת מינימלית:
```yaml
companionId: bat_lily
direction: bedtime          # bedtime | adventure | fantasy
pageCount: 10               # 10 | 15 | 20
childName: noa
childAge: 5
childGender: girl
childTraits: [sensitive, curious]
endingType: sleep_close     # sleep_close | discovery_close | sensory_close
```

### Stage 2 — Load Psych Prescription
מ-`PSYCH_ENGINE_v1.md`, ב-interface YAML:

```yaml
emotionalSituation: child fears the dark and refuses to sleep alone
childBehavior: clutches blanket, calls parent repeatedly, body stiff
wrongStrategy: rationalizing ("nothing is there")
desiredBodyShift: shoulders drop, breath slows, eyes close softly
physicalMechanicSuggestion: companion lives IN the dark and brings light from within
tabooDirectWords: [trauma, brave, scary monster, conquer fear]
narrativeConstraint: darkness reframed as rest, not as obstacle
```

**שים לב:** אין פה "metaphor". יש physicalMechanic.

### Stage 3 — Load Companion Bible
מ-`COMPANION_BIBLE_v1.md`, השדות שמשפיעים על הסיפור:

```yaml
coreMechanic
signatureSound
signatureObject
signatureMicroAction
overloadBehavior
regulationBehavior
humorMode
bodyVocabulary
forbiddenAnatomy
forbiddenObjects
forbiddenTone
repeatablePhrase
visualCameraLanguage
```

### Stage 4 — Build Beat Map
לפי Direction DNA (PART 2). לכל עמוד:

```yaml
page: 5
location: bedroom_window
childAction: stares at dark corner
companionAction: bat unfolds wings, tiny stars in the shadow
emotionalRead: curiosity replacing fear
visualPotential: high
wordCountTarget: 30
```

### Stage 5 — Define Unforgettable Moment Contract
**חובה. לפני draft.**

```yaml
unforgettableMoment:
  page: 7
  type: discovery      # touch | transformation | discovery | comic failure | sacrifice | naming
  setup: child watches Lily fly into the dark hallway
  pause: silence, only the rustle of wings
  physicalAction: Lily returns with a small star caught in her wing-fold
  companionSignature: wings open like a fan with one dim star inside
  childBodyResponse: hand uncurls from the blanket edge
  echo: same star reappears in dream-sequence on page 9
  residue: the star is still visible on the windowsill on the final page
```

### Stage 6 — Define Repeatable Hook Contract
**חובה. לפני draft.**

```yaml
repeatableHook:
  sound: ששש... (Lily's wing whisper)
  phrase: "הכוכב עוד פה"
  microAction: Lily folds one wing and opens it again
  appearsOnPages: [3, 7, 9, 10]
```

### Stage 7 — Draft Story
עמוד אחר עמוד. לפי Beat Map. לפי Companion Bible. תוך הקפדה על:
- כל page חייב להיות **ניתן לאיור** (visual scene ברורה)
- כל page חייב להחזיק **עמדה ויזואלית של הילד והמלווה**
- כל פעולה רגשית קיימת **בגוף**

### Stage 8 — Self-QA (חמש קטגוריות)
ראה PART 8.

### Stage 9 — Repair Pass + Technical Cleanup
Repair רק את האזורים שנכשלו. לא לכתוב מחדש.
טכני: regex על תווים זרים, מספרי עמודים, מגדר.

---

# PART 2 — Direction DNA (Page Beats)

## Bedtime — 10 Pages

```
Page 1   הקדמה ביתית: חדר/מיטה/רגע יומיומי קטן.
Page 2   Companion Reveal — איך הדמות מופיעה. שקט. סקרנות.
Page 3   הילד מראה את הקושי דרך פעולה (לא הסבר).
Page 4   ניסיון של הילד לשלוט/לפתור — לא עובד. רכך.
Page 5   Companion Signature Behavior ראשון.
Page 6   ⭐ MOMENT — micro-action פיזית של הדמות + תגובת גוף של הילד.
Page 7   הסביבה מתרככת. עמוד שקט מאוד (אפשר 3-5 מילים בלבד).
Page 8   החזרה השנייה של ה-Repeatable Hook.
Page 9   Sensory Residue (חפץ/ריח/קול שנשאר).
Page 10  שינה. סגירה רכה.
```

**Location rule:** Bedtime נשאר **בבית** לאורך כל הסיפור. אסור לצאת לעולם חיצוני.
**Ending type:** sleep_close — הילד נרדם או קרוב לשינה.

---

## Adventure — 15 Pages

```
Page 1-2  מצב יומיומי + טריגר (משהו קורא לצאת).
Page 3    Companion Reveal.
Page 4    יציאה — סף הבית/החצר/השער.
Page 5    Companion Signature Behavior ראשון.
Page 6    אתגר ראשון (חיצוני). הילד מנסה. חלקית.
Page 7    Companion humor / failure / רגע צחוק קטן.
Page 8    טעות רגשית — הילד מנסה גישה לא נכונה.
Page 9    ⭐ MOMENT — Heart-line. רגע גילוי או מגע מרכזי.
Page 10   הילד מנסה גישה חדשה — עובד.
Page 11   החזרה השנייה של ה-Repeatable Hook.
Page 12   הצלחה רגעית — לא ניצחון גדול.
Page 13   דרך חזרה הביתה.
Page 14   Residue Object — חפץ שנשאר מהמסע.
Page 15   סגירה שקטה — שובו של הילד למקום מוכר, שונה רק במשהו קטן.
```

**Location rule:** Adventure **חייב להיות בחוץ** (חצר/יער/חוף/רחוב) או להתחיל בפנים ולצאת מהר מאוד (לא יאוחר מעמוד 4).
**Ending type:** discovery_close — הילד חוזר משונה, עם residue.

---

## Fantasy — 20 Pages

```
Page 1-3   Setup ביתי + Fear Object (חפץ/מקום/קול שמסמן את הקושי).
Page 4     מעבר — דלת/שמיכה/חלום/הרהור — לעולם הפנטזיה.
Page 5-6   World Transformation — הבית/החדר/החצר נהפכים למשהו אחר.
Page 7-8   Exploration — חוקי העולם מתגלים. הילד פוגש את החוקים האלה.
Page 9     Companion Reveal (אם לא קרה מוקדם) או Companion Signature Behavior משמעותי.
Page 10    טעות רגשית — הילד מנסה משהו שבעולם הזה לא עובד.
Page 11    Escalation — דבר שאי אפשר עוד להתעלם ממנו.
Page 12    Companion Active Protection — הדמות עומדת בין הילד למשהו.
Page 13    ⭐ MOMENT — Pause + Heart-line. רגע של גילוי / מגע / שינוי קסום.
Page 14    ההד של הרגע — Repeatable Hook חוזר במקום מפתיע.
Page 15    Small Relapse — לא הכל פתור. רגע של אי-וודאות.
Page 16    Companion Settles — הדמות מראה איך היא חיה עם זה.
Page 17    World Returns — מעבר חזרה לעולם הילד (לא חייב להיות חד).
Page 18    Residue Object — חפץ אחד מהעולם הפנטסטי שנשאר.
Page 19    תגובת גוף סופית של הילד (לא הסבר!).
Page 20    סגירה חושית — צליל/אור/ריח אחרון.
```

**Location rule:** Fantasy יכול לקרות **בכל מקום** אם החוקים של המקום שונים מחוקי המציאות.
**Ending type:** sensory_close — סגירה ב-Residue, לא ב-resolution מילולית.

---

## חוקי-על לכל הכיוונים

- **כל עמוד חייב להיות illustratable** — אם אין סצנה חזותית ברורה, חזור על העמוד.
- **כל עמוד חייב להציב את הילד והמלווה במרחב** — לא "הם הלכו". כן "בולי גלגל את עצמו לפינת המזרן והניח את הראש שם".
- **לא יאוחר מהעמוד השלישי — הקושי נראה בפעולה.** לא בהסבר.
- **לא יותר מאחד-שניים עמודים ברצף בלי הופעה של ה-Companion.**

---

# PART 3 — Physical Mechanic Engine

## העיקרון

> **המנוע לא כותב מטאפורות. הוא כותב פעולות פיזיות שגוררות משמעות.**

המודלים החזקים (GPT-5.x, Claude) נופלים אם נותנים להם "metaphor". הם מתחילים לכתוב ספרותי, חכם, מסביר.

תן להם **mechanic** — והמטאפורה תתגלה אצל הקורא.

## פורמט ה-Translation

מ-Psych Brief למנוע:

```
emotion: fear of medical procedure
↓
psych says: child needs to feel protected
↓
ENGINE TRANSLATES TO:
physicalMechanic: "Medical objects become large protective walls;
                    Bolly blocks them with shell."
```

**שים לב:** ה-engine **לא מקבל** את ה-"needs to feel protected". הוא מקבל את ה-mechanic. אם ה-Psych Engine שלח גם משמעות — היא נחתכת ב-translation step.

## ספריית Mechanics (Starter)

| Emotion | ❌ Don't say | ✅ Say |
|---|---|---|
| Fear of dark | "darkness becomes safe" | "Lily's wings open and one star is folded inside" |
| Anger | "anger is okay" | "Seara's tentacles each hold a different object; one releases" |
| Overwhelm (noise) | "find calm inside" | "Anana's wool body absorbs the loud sound and lowers it to a hum" |
| New sibling | "you are still loved" | "Bobo splits one big nut into two identical halves" |
| Transition (kindergarten) | "change is okay" | "Koko's colors shift one stripe at a time; the scarf stays" |
| Medical procedure | "doctor won't hurt you" | "Bolly folds around the child; outside hard, inside warm" |
| Social rejection | "find your people" | "Tzvi steps backwards one half-step; one other deer steps forward one" |
| Focus difficulty | "concentrate harder" | "Chacham closes one eye then the other, the world narrows to one shape" |

## חוק זהב

> **The metaphor is a consequence — not a goal.**
> If the writer can name the metaphor, the writer wrote it. Cut it.

---

# PART 4 — Kid Delight Layer

## Repeatable Hook Contract

**שדה חובה לפני draft.** ה-LLM חייב להחזיר:

```yaml
repeatableHook:
  sound: טוּמְפּ
  phrase: בפנים היה חם
  microAction: מתקפל לכדור
  appearsOnPages: [3, 9, 11, 19]
```

**כללים:**
- חייב להופיע **לפחות פעמיים** בסיפור
- חייב להיות **ייחודי לדמות** — לא כללי ("היה שקט")
- חייב להיות **ניתן לחיקוי פיזי** (טוּמְפּ שילד יכול לחקות בקול)
- אם הסיפור 15-20 עמודים — חייב להופיע **3+ פעמים**

## Moment Contract

**שדה חובה לפני draft.** מלא:

```yaml
unforgettableMoment:
  page: 14
  type: touch | transformation | discovery | comic_failure | sacrifice | naming
  setup: מה קורה לפני
  pause: רגע השקט
  physicalAction: מה הדמות עושה (לא מה היא חושבת)
  companionSignature: איך הפעולה מזהה את הדמות באופן ייחודי
  childBodyResponse: שינוי בגוף הילד (לא ברגש)
  echo: איפה זה חוזר מאוחר יותר בסיפור
  residue: מה נשאר בסוף (חפץ/קול/ריח)
```

## טיפוסי "רגעים" לפי כיוון

| כיוון | טיפוס אופייני | דוגמה |
|---|---|---|
| Bedtime | רגע של נגיעה / micro-action | בולי פותח חלק אחד של השריון ומסתכל החוצה |
| Adventure | רגע של גילוי / סמליות פיזית | הילד מקבל עלה / טביעה / אבן מהדמות |
| Fantasy | רגע של הפיכה / שיר / שם | קים משנה צבע לצבע של הילד; לחישה: "עכשיו אנחנו אותו דבר" |

## Humor by Age Tier

**לא כל סיפור חייב להצחיק.** במיוחד Bedtime עם MEDICAL_PROCEDURE — יכול להיות עדין בלי בדיחה.

אבל כשיש הומור — הוא חייב להיות **של הילד**, לא של ההורה:

| Tier | סוג הומור | דוגמה |
|---|---|---|
| 3-5 | פיזי, אבסורד פשוט, חזרתיות | בולי מתגלגל ועוצר בנעל. שוב. שוב. שוב. |
| 5-7 | משחקי מילים פשוטים, הפתעה, פעולה לא צפויה | "תוקי, איפה אתה?" "כאן." "איפה?" "**כאן**." (היא על הראש שלו) |
| 7-9 | אירוניה קלילה, סיטואציה שגויה, דיאלוג | "הדרקון אמר שיהיה בסדר." "הדרקון אמר את זה לפני שאכל את הסלסילה." |

**אסור:** הומור שצריך הסבר. הומור של הורה ("הוא דובר חמש שפות אבל לא יודע לסגור מעיל"). הומור ציני.

## Pacing Map

לכל סיפור, ה-LLM יחזיר לפני draft:

```yaml
paceMap:
  quietPages: [1, 6, 10]     # פחות מ-20 מילים, אטמוספרה
  activePages: [3, 5, 8]      # 40+ מילים, פעולה
  heartPage: 7                # ⭐ MOMENT
  humorPage: 4                # (אופציונלי)
```

**כלל:** סיפור **חייב להכיל** לפחות עמוד שקט אחד ועמוד אנרגטי אחד. ספר שכל עמודיו באותו טון — נכשל גם אם כל משפט עומד בפני עצמו.

---

# PART 5 — Age Tier Modifiers

## הגיל משפיע על **שפה ועומק** — לא על אורך הספר.

האורך נקבע על-ידי הכיוון (Bedtime=10, Adventure=15, Fantasy=20). הגיל מעצב **איך** הסיפור נכתב באורך הזה.

## מטריצת מילים-לעמוד

| | Tier A (3-5) | Tier B (5-7) | Tier C (7-9) |
|---|---|---|---|
| **Bedtime 10p** | 15-25 | 25-40 | 40-55 |
| **Adventure 15p** | 20-30 | 30-45 | 45-65 |
| **Fantasy 20p** | 25-35 | 35-50 | 50-70 |

## Tier A (גיל 3-5)

- **משפטים:** 4-8 מילים. פסיק לכל היותר אחד.
- **אוצר מילים:** קונקרטי בלבד. שם של חפץ, פעולה, מקום.
- **רגש:** רגש **אחד** בכל עמוד. לא "פחד וגם בלבול".
- **חזרתיות:** רצויה ומבורכת. אם הילד יכול לצפות לשורה הבאה — ניצחנו.
- **מטאפורה:** אסורה כמעט לחלוטין. רק אם היא חזותית-ישירה.
- **דיאלוג:** קצר. "כן." "לא." "פה." "אני רואה."
- **הומור:** פיזי. אבסורד. חזרתיות מצחיקה.

## Tier B (גיל 5-7) — ה-Sweet Spot

- **משפטים:** 6-12 מילים. אפשרות לפסיקים.
- **אוצר מילים:** פיגורטיבי קל. "השמיים נפלו עליו". "הלב שלה רץ מהר."
- **רגש:** רגש מוביל + רגש משני אפשרי.
- **מטאפורה:** אפשרית, אבל **מבוססת על גוף/חוש**.
- **דיאלוג:** פעיל. דמות עם קול ייחודי.
- **הומור:** משחקי מילים, הפתעה, פעולה לא צפויה.

## Tier C (גיל 7-9)

- **משפטים:** 8-15 מילים. מורכבים יותר. רעיון לכל פסיק.
- **אוצר מילים:** עשיר. "התעקש", "צמרמורת", "עיגול קטן של אור".
- **רגש:** קונפליקט פנימי. "הוא רצה לקרוא אבל גם לא רצה שיראו אותו פוחד."
- **מטאפורה:** מותרת. אך תמיד דרך פעולה/גוף.
- **דיאלוג:** דיאלוג ספרותי. דמות שמדברת אחרת מהילד.
- **הומור:** אירוניה קלה, סיטואציה שגויה.

## Tone Per Direction × Age

זה לא 9 פרופילים נפרדים. זה מטריצה רכה:

```
Bedtime × A:   רך, חוזר, "אמא/אבא", צלילים קטנים
Bedtime × B:   רך, מעט יותר עומק רגשי
Bedtime × C:   הרהור פנימי, רגע שקט מעמיק

Adventure × A: צ׳ה צ׳ה צ׳ה, סוויפט, פיזי
Adventure × B: מסע + הפתעה + רגע גילוי
Adventure × C: מסע פנימי תוך מסע חיצוני

Fantasy × A:   קסם פשוט - גודל, צבע, גובה
Fantasy × B:   קסם עם חוקים - העולם מגיב לרגשות
Fantasy × C:   קסם סמלי - העולם משקף את הפנימי
```

---

# PART 6 — Hebrew Production Rules

## חוקי מגדר (BLOCKING)

- מגדר הילד **חייב להישמר לאורך כל הסיפור**.
- צורת הפועל, הכינוי, ההטיות — כולן חייבות להתאים.
- שם הילד מופיע **5-7 פעמים** בסיפור (לא יותר, לא פחות).
- שם הילד **חייב להופיע כסובייקט** של פעולה לפחות 3 פעמים.

## חוקי גוף

- **גוף שלישי בלבד.** אסור גוף ראשון.
- אסור POV switches באמצע הסיפור.
- הקריינות עומדת **מחוץ** לראש הילד אבל **קרובה** לחוויה שלו.

## פיסוק

- פסיקים: רק לפי הצורך התחבירי. לא לרצף משפטים.
- שאלות: "?" — שימוש מתון. לא יותר משאלה אחת בעמוד.
- קריאות: "!" — נדיר. שני סימני קריאה בכל הסיפור זה המקסימום.
- מקפים: "—" לעצירות עמוקות. לא להחליף פסיקים.

## ניקוד (Helping Marks)

**אסור ניקוד מלא.** מותר ניקוד **עזר** רק במקרים אלה:
- מילה שניתן להבין שגוי בלי ניקוד (תֵּל לעומת תַּל)
- שם פרטי לא רגיל
- מילה חדשה שהילד פוגש לראשונה

**אסור:** לנקד 50% מהמילים. זה הופך את הסיפור לקריאה איטית.

## Tech QA Blockers (Reject if found)

ה-LLM (או reviewer) חייב לדחות את הסיפור אם הוא מכיל:

```
□ אותיות לטיניות באמצע טקסט עברי
□ אותיות ערביות / תאיות / סיניות / שום שפה זרה אחרת
□ Unicode escape sequences (א וכו')
□ "(טעות:" / "(תיקון:" / כל הערה של המודל
□ מספרי עמודים כפולים
□ מספרי עמודים חסרים
□ מספר עמודים שונה מהיעד (10/15/20)
□ שם דמות שגוי (בולי הופך לבובו)
□ אנטומיה אסורה לדמות (נוצות על עננה, שריון על קים)
□ תגית מגדר שגויה ב-frontmatter
□ אנגלית בתוך טקסט עברי (חוץ משמות לועזיים מותרים)
```

**זו לא בעיית כתיבה. זו בעיית מוצר.** היא חוסמת shipping.

---

# PART 7 — Forbidden Patterns

## Anti-Literary Rules

### האיסור על "סיפור מבוגרים מסווה"

המודלים החזקים נופלים לפטרנים אלה כל הזמן:

1. **משפט-סיכום-של-הבנה** ("הוא הבין ש...", "ידע עתה ש...")
2. **משפט-מסר-עצמאי** ("חשוב לזכור ש...", "לפעמים צריך...")
3. **פסקת-הסבר-של-עבר** ("זה הזכיר לו את הפעם ש...")
4. **שאלה-רטורית-של-מבוגר** ("האם אי פעם הרגשת ש...?")
5. **מטאפורה-שמסבירה-את-עצמה** ("הפחד היה כמו ענן שחור — חשוך וכבד")
6. **סיום-עם-מסר-מוסר** ("ומאז הוא ידע ש...", "ככה הוא למד ש...")

## פטרנים שמותרים-אך-נדירים

- מחשבה ישירה של הילד: מותרת רק אם **קצרה** (משפט אחד) ו**פיזית** ("איפה היא הולכת?", "זה רך").
- דיאלוג פנימי: עדיף להימנע. אם בכל זאת — חייב להיות מעוגן בחוש (לא "הוא חשב שזה לא הוגן" אלא "*זה לא הוגן*, הוא רצה לצעוק").

## איסורי טון לפי דמות

ראה `COMPANION_BIBLE_v1.md` — `forbiddenTone` per companion.

דוגמה:
- **בולי:** אסור bravery speech, אסור הסבר רפואי, אסור משפטי השראה.
- **קים:** אסור פילוסופיית הסוואה, אסור "הזהות הישנה נשארת בפנים".
- **עננה:** אסור "השלווה כמסר", אסור "חוכמת השמיים".

## Generic Magic Ban

ב-Fantasy, אסור לכתוב קסם כללי:
- ❌ "האור הופיע פתאום והכל היה אחרת"
- ✅ "האור יצא מתוך כף ידה של זוהר, נטף ירוק על הרצפה והפך כל אבן לעץ קטן"

הקסם חייב להיות **חושי, ספציפי, נראה**.

## No Adult Voice Bleed

אם משפט שמסתובב בראש המבוגר (ההורה) נכנס לסיפור — חתוך אותו. דוגמאות:

- "פחד הוא חלק טבעי מהגדילה."
- "כל הילדים מרגישים ככה לפעמים."
- "ההורים מבינים את זה."
- "כל אחד צריך מקום משלו."

אלה מבוגרים מדברים אל הורים. לא ילדים.

---

# PART 8 — Self-QA + Repair Library

## מבנה ה-Self-QA

ה-LLM (או reviewer model נפרד) מריץ **7 קטגוריות בדיקה** על הסיפור. כל אחת מחזירה רשימה של ממצאים ברמת:

- 🔴 **BLOCKING** — לא יוצא בלי תיקון.
- 🟡 **WARNING** — חוזר עם feedback ל-repair, יכול לעבור אם תיקון לא אפשרי.
- 🟢 **NOTE** — מתועד ב-QA log, לא חוסם.

### Category 1: Kid Delight (PART 0)

```
□ Test 1 Kid Voice — נכשל אם יש משפט-סיכום-של-הבנה
□ Test 2 Repeatable Hook — נכשל אם hook לא הוצהר או מופיע פחות מפעמיים
□ Test 3 Moment — נכשל אם moment חסר/לא במיקום הנכון/הסבר ולא פעולה
□ Test 4 Pace — נכשל אם אין שני קצבים שונים
□ Test 5 Ritual — נכשל אם אין אלמנט חוזר
```

### Category 2: Narrative Structure

```
□ Beat Map תואם ל-Direction DNA?
□ Companion Reveal במיקום הנכון?
□ Setup-Challenge-Heart-Closure קיים?
□ עמוד שקט קיים?
□ Residue Object קיים בסוף?
□ אורך הסיפור = יעד? (10/15/20)
```

### Category 3: Companion Identity

```
□ Companion Swap Test — האם הסיפור עובד עם חיה אחרת? (אם כן — נכשל)
□ Signature behavior מופיע לפחות פעמיים?
□ Forbidden objects לא הופיעו?
□ Forbidden anatomy לא הופיעה?
□ Forbidden tone לא הופיע?
□ Body vocabulary רלוונטית לדמות?
```

### Category 4: Hebrew Quality

```
□ מגדר עקבי לאורך הסיפור?
□ POV עקבי (גוף שלישי)?
□ אין Kill Phrases?
□ ניקוד מתון (לא over-marking)?
□ פיסוק תקין?
□ שם הילד מופיע 5-7 פעמים?
```

### Category 5: Age Fit

```
□ אורך משפטים תואם לטיר?
□ אוצר מילים תואם לטיר?
□ מורכבות רגש תואמת?
□ הומור (אם יש) תואם לטיר?
```

### Category 6: Therapeutic Subtlety

```
□ הקושי נפתר דרך פעולה ולא דרך הסבר?
□ אין הטפה ישירה?
□ אין מסר-מוסר בסוף?
□ Physical Mechanic ברורה ומופיעה?
□ Body Before Meaning נשמר?
```

### Category 7: Visual Compatibility

```
□ כל עמוד מכיל סצנה חזותית ברורה?
□ עמדת הילד והדמות במרחב מוגדרת?
□ פעולה ניתנת לאיור (לא רק מחשבה/רגש)?
□ Variation חזותי בין עמודים (לא 10 עמודים של "ילד יושב על מיטה")?
```

### Category 8: Technical

```
□ אין תווים זרים?
□ אין "(טעות:" / unicode escape?
□ מספרי עמודים רציפים ונכונים?
□ Frontmatter תקין (gender, coverScene, title)?
□ אין שמות דמויות שגויים?
```

---

## QA Log Format (קובץ פר-סיפור)

```
story-qa-logs/{YYYY-MM-DD}_{order-id-short}/
├── story.md                ← הסיפור הסופי
├── story-draft.md          ← הגרסה הראשונה לפני repair
├── qa-report.json          ← מובנה
├── qa-report.md            ← קריא
├── prompt-snapshot.txt     ← הפרומפט המלא ששלחנו
└── repair-log.md           ← מה תוקן בכל pass
```

### qa-report.md format

```markdown
# QA Report — {childName} × {companion} × {direction}

## Pass Summary
- BLOCKING: {n}
- WARNING: {n}
- NOTE: {n}
- Final verdict: {PASS / FAIL / REPAIRED}

## Category 1 — Kid Delight
{findings}

## Category 2 — Narrative Structure
{findings}

...

## Repair Summary
{what was fixed in pass 2/3}

## Self-Score
{score}/100
```

---

## Repair Prompt Library

לכל קטגוריית כשל יש Repair Prompt קבוע. דוגמאות:

### Repair: Kid Delight (Repeatable Hook missing)

```
The story you wrote lacks a repeatable hook. A repeatable hook is a sound,
phrase, or micro-action that appears at least twice and is unique to the
companion. It is what makes a child want to hear the story again.

Look at the companion's signature elements (Bolly = טוּמְפּ + folding into ball).
Insert this element naturally into pages {X, Y, Z}. Do NOT add new content —
weave it into existing scenes.
```

### Repair: Anti-Literary (Kill Phrase detected)

```
You wrote: "{phrase}"

This is forbidden. It tells the meaning instead of showing it.
Replace it with a physical action or sensory detail that shows the same
emotional shift.

Pattern: "He no longer felt afraid" → "His hands stopped pressing the sheet"
```

### Repair: Companion Identity (Swap Test failed)

```
This story could be told with any animal. The companion is a decoration,
not a mechanic.

Reread the Companion Bible for {companionName}. Find at least 3 places
to insert signature behaviors, sounds, or objects. The story must REQUIRE
this companion, not just feature it.
```

### Repair: Visual Compatibility (mental-only page)

```
Page {N} is internal (thoughts/feelings) without a visible scene.
Each page must be illustratable — there must be a clear location,
character positions, and an action that can be drawn.

Rewrite page {N}: keep the emotional content, but anchor it in a
physical action and a visible setting.
```

---

# PART 8.5 — Hard Validators (Code-Level)

> **Validators Before Generator.** No story may ship without passing these.
> **Detailed spec:** `CURSOR_BRIEF_validators.md`

19 בדיקות שיוצאות לקוד **לפני** ה-generator. אם validator BLOCKING נכשל — אין shipping. רשימה מקוצרת:

```
BLOCKING (must pass):
  □ foreignChars         — Latin/Arabic/Thai/etc. forbidden in body
  □ unicodeEscapes       — no \u0xxx
  □ errorNotes           — no "(טעות:" / "(תיקון:"
  □ pageCount            — exact match to direction
  □ pageSequence         — 1,2,3,...,N no gaps no duplicates
  □ genderConsistency    — child + companion gender stable
  □ companionName        — canonical only, no hallucinations (Bobo→Bolly)
  □ forbiddenAnatomy     — per companion bible
  □ forbiddenObjects     — per companion bible
  □ killPhrases          — from PART 0 list
  □ hookAppearances      — declared hook actually appears
  □ momentPageWindow     — moment in declared window
  □ companionPresence    — companion present per minimumPresence
  □ repairRegression     — repair mode: declared good stuff preserved
  □ modeCompliance       — repair mode: only changeOnly pages differ

WARNING (review, can pass):
  ⚠ forbiddenTone        — pattern-based, false positives possible
  ⚠ namePersonalization  — range per direction
  ⚠ visualVariety        — image direction diversity
  ⚠ directTherapyLanguage — therapy words in story body
```

---

# PART 9 — Output Schema + Prompt Assembly

## Story Output Format

```markdown
---
title: "..."
companionId: bat_lily
direction: bedtime
pageCount: 10
childName: noa
childGender: girl
childAge: 5
coverScene: "small girl looking up at bat in moonlight, peaceful"
companionLetter:
  insertAfterPage: 4
  imageDirection: "soft handwritten note, moonlight, simple"
unforgettableMoment:
  page: 7
  type: discovery
repeatableHook:
  sound: ששש
  phrase: "הכוכב עוד פה"
  appearsOnPages: [3, 7, 9, 10]
---

--- Page 1 ---
imageDirection: "small bedroom at dusk, bed unmade, soft toy at floor"

נועה ישבה על המיטה.
האור היה רך.
מחוץ לחלון, משהו זז.

--- Page 2 ---
...
```

## Prompt Assembly Architecture

**לא לתת ל-GPT מסמך אחד ענק.** הרכבה לפי שכבות:

### SYSTEM (קצר, קבוע)
```
You are the Story Engine for Small Heroes.
Read the Direction DNA, Companion Bible, and Age Tier provided.
Output: Beat Map → Moment Contract → Hook Contract → Story → Self-QA.
Follow the Core Rules: Body Before Meaning. Companion Swap Test. No Kill Phrases.
```

### DEVELOPER (constraints layer)
- Kill phrases list (PART 7)
- Hebrew QA blockers (PART 6)
- Forbidden patterns (PART 7)

### CONTEXT (assembled per-order)
- Direction DNA card (PART 2 — only the relevant direction)
- Companion Bible card (only the chosen companion)
- Age Tier card (only the matching tier)
- Psych Brief (from PSYCH_ENGINE — the YAML interface)
- 1-2 few-shot examples from GOLD_STORIES (matching direction)

### USER (the order)
```yaml
companionId: bat_lily
direction: bedtime
pageCount: 10
childName: noa
childAge: 5
childGender: girl
childTraits: [sensitive, curious]
psychBrief: {from Psych Engine}
```

### Output expected (multi-stage)
The model returns:
1. Beat Map (JSON)
2. Moment Contract (YAML)
3. Hook Contract (YAML)
4. Story (Markdown)
5. Self-QA Report (JSON)

If any of 1-3 fail validation — fail fast, do not write the story.

---

## Engine Modes (DRAFT / PRODUCTION / REPAIR)

המנוע פועל באחד משלושה modes. ה-mode קובע התנהגות, לא רק קלט.

### DRAFT MODE
- מטרה: חופש יצירתי, אקספלורציה
- ה-LLM כותב את הסיפור מאפס
- מותר לחרוג קל מהמבנה אם זה משרת
- כל ה-validators רצים אבל BLOCKING רק על השלד הקשיח (תווים זרים, מספרי עמודים, מגדר)

### PRODUCTION MODE
- מטרה: סיפור לשליחה ללקוח
- כל ה-validators רצים במלוא העוצמה
- BLOCKING על הכל
- נדרש Moment Contract + Hook Contract מולאים לפני draft
- חייב לעבור גם Self-QA וגם code-level Validators

### REPAIR MODE (קריטי — זה ה-fix של הרגרסיות שראינו)
- מטרה: לתקן באג ספציפי. **לא לכתוב מחדש.**
- קלט נוסף: `preserveList` + `changeOnly` (אילו עמודים מותר לשנות)
- חוקים מוחלטים:
  - **אסור** לשכתב עמודים שלא ב-changeOnly
  - **אסור** לשפר סגנון של עמודים שעוברים
  - **אסור** להוסיף או להסיר plot elements
  - **אסור** לשנות את הסיום (אלא אם בעמודי changeOnly)
  - **חובה** לשמור את ה-Moment המוצהר
  - **חובה** לשמור את ה-Hook המוצהר
  - **חובה** לשמור את escalation/protection/residue
- ולידציה: `repairRegression` + `modeCompliance` BLOCKING

**הסיבה ש-REPAIR MODE קיים:** ראינו שביקשנו תיקון קטן ל-בולי וה-LLM מחק את כל ה-fantasy escalation. בלי מצב הצהרתי שאומר "תיקון בלבד" — זה יקרה שוב.

```yaml
# Format for Repair input
mode: REPAIR
previousVersion: {full story markdown}
preserveList:
  - "Moment on page 13 — Bolly's belly touch"
  - "Hook 'טוּמְפּ' on pages [3, 9, 11]"
  - "Fantasy escalation from page 11 onwards"
  - "Residue object: sticker on rug"
changeOnly: [4, 7]  # only these pages may differ
failureToFix: ["foreignChars on page 4: \"m\" leaked", "page 7: kill phrase \"באותו רגע הבין\""]
```

---

## Repair Loop (after Self-QA)

```
DRAFT → Self-QA → repair_needed?
                    ↓ yes
                  REPAIR PROMPT (specific to failure category)
                    ↓
                  Self-QA again
                    ↓ pass?
                    → output
                    ↓ fail 3 times?
                    → fallback to Gold Story for {companion}_{direction}
                    → log to qa-logs with FALLBACK flag
                    → alert
```

---

# סיכום — מבחני הקבלה של ה-Engine

לפני שה-engine נכנס לפרודקשן, הוא חייב לעבור על **12 מבחני קבלה**:

```
□ 1. ייצר סיפור 10/15/20 עמודים בהתאמה לכיוון
□ 2. שמר על מגדר עקבי
□ 3. שילב שם הילד 5-7 פעמים
□ 4. הצהיר Moment Contract לפני draft
□ 5. הצהיר Repeatable Hook Contract לפני draft
□ 6. הראה הקושי בפעולה לא יאוחר מעמוד 3
□ 7. עבר Companion Swap Test
□ 8. עבר Kid Voice Test (אין Kill Phrases)
□ 9. עבר Hebrew Tech QA (אין תווים זרים, מספרי עמודים תקינים)
□ 10. ייצר QA log קריא
□ 11. שיפר את עצמו בסבב repair (אם נכשל בסבב 1)
□ 12. נפל ל-Gold Story אם נכשל 3 פעמים
```

**אם 12 המבחנים עוברים על 9 מתוך 10 סיפורי-מבחן — ה-engine מוכן לפרודקשן.**

---

*המסמך הזה הוא חי. כל סיפור שמייצר את עצמו ומכשל ב-QA ילמד אותנו איך לחדד אותו.*

*Sister documents: `COMPANION_BIBLE_v1.md`, `PSYCH_ENGINE_v1.md`*
