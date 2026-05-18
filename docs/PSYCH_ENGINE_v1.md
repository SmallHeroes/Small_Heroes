# Small Heroes — Psych Engine v1

> **Status:** v1.0 — Architecture defined, deepening pending
> **Purpose:** Translates wizard input → therapeutic prescription that drives the Story Engine.
> **Sister docs:** `STORY_ENGINE_v1.md`, `COMPANION_BIBLE_v1.md`

---

## הקדמה — מי המסמך הזה ולמה

Story Engine עונה: **"איך כותבים סיפור?"**
Companion Bible עונה: **"מי הדמות?"**
Psych Engine עונה: **"מה הסיפור צריך לפתור — ואיך מתרגמים מה שההורה מילא בוויזרד למרשם טיפולי?"**

### הגילוי המכאיב

הסקירה הארכיטקטונית גילתה אבחנה אכזרית:

> **הוויזרד אוסף 8 שדות פסיכולוגיים עשירים. ה-LLM שמייצר את הסיפור רואה 3 מהם.**

| מה הוויזרד אוסף | מה מגיע ל-LLM |
|---|---|
| ✅ קטגוריית קושי | ✅ |
| ✅ 4-5 תשובות לשאלות המשך | ❌ נשמרות בלבד, לא משפיעות |
| ✅ טראיטים של הילד | ❌ |
| ✅ סופר-פאוור של הילד | ❌ |
| ✅ מטרות ההורה | ❌ |
| ✅ מערכת תמיכה | ❌ |
| ✅ מה להימנע | ❌ |
| ✅ צילום | ⚠️ רק לזיהוי פנים — לא לתוכן |

**זו לא בעיית קוד. זו ארכיטקטורה חסרה.**

Psych Engine בא לסגור את הפער הזה.

---

# PART 1 — 11 הקטגוריות הקיימות (מה יש, מה חסר)

### מקור הנתונים

קובץ קיים: `lib/categoryBranching.ts`

מבנה לכל קטגוריה:
```typescript
{
  hebrewLabel
  emotionalDomain
  psychologicalMeaning   // English brief
  treatmentStrategy: {
    coreNeed
    approach
    avoid: string[]
    resolutionType
    narrativeConstraint
  }
  typicalParentIntent: string[]
  followUpQuestions: string[]   // 4-5 שאלות לשלב 3 של הוויזרד
  storyDirections: [bedtime, adventure, fantasy]  // עם realWorldAnchor + promptHint
  storyTone: { narrativeRegister, illustrationMood }
}
```

**זה עשיר. זה לא רדוד.** ⭐ הבעיה אינה במידע — הבעיה היא ש**אף-אחת מהשדות האלה לא מוזרקת לפרומפט של ה-LLM ביצור הסיפור**.

### 11 הקטגוריות (סטטוס)

| # | Category | Hebrew | מצב נתונים | פערים |
|---|---|---|---|---|
| 1 | NIGHT_FEAR | פחדים בלילה | מלא ✅ | אין שימוש בייצור |
| 2 | NOISE_FEAR | קולות ואזעקות | מלא ✅ | אין שימוש |
| 3 | GENERAL_FEARS | פחדים שונים | מלא ✅ | אין שימוש |
| 4 | ANGER_FRUSTRATION | כעס ותסכול | מלא ✅ | אין שימוש |
| 5 | SENSITIVITY_OVERWHELM | רגישות יתר | מלא ✅ | אין שימוש |
| 6 | SOCIAL | קושי חברתי | מלא ✅ | אין שימוש |
| 7 | TRANSITION | מעברים | מלא ✅ | אין שימוש |
| 8 | NEW_SIBLING | אח/אחות חדשים | מלא ✅ | אין שימוש |
| 9 | FOCUS_LEARNING | קשיי למידה/קשב | מלא ✅ | אין שימוש |
| 10 | SELF_CONFIDENCE | ביטחון עצמי | מלא ✅ | אין שימוש |
| 11 | MEDICAL_PROCEDURE | פעולה רפואית | מלא ✅ | אין שימוש |
| OTHER | אחר | פתוח | חסר | צריך טיפול נפרד |

**מסקנה לרכזת:** המפתח אינו "להגדיר 11 קטגוריות חדשות". הוא **לחבר** את מה שכבר קיים.

---

# PART 2 — Wizard Input Inventory

לפני שאפשר לתרגם — צריך לדעת מה מתורגם.

### השדות שהוויזרד אוסף

```yaml
# Child Profile
childName: string
childAge: number          # 2-10
childGender: 'boy' | 'girl' | 'other'
childTraits: string[]     # [רגיש, שובב, חולם, ביישן, סקרן, אמיץ, פעלתן, יצירתי]
photo: file               # אופציונלי

# Emotional Brief
challengeCategory: ChallengeCategory   # 1 מתוך 11
categoryAnswers: Array<{
  questionId: string,
  selectedQuickAnswers?: string[],
  freeText?: string,
}>
childSuperpower: string[]
childSuperpowerExtra: string             # freeform
difficulties: string[]                   # 8 chips multi-select
s4extra: string                          # freeform on difficulties
goals: string[]                          # 9 chips
helpers: string[]                        # 10 chips
s6extra: string                          # freeform
avoid: string[]                          # 9 chips — what to keep OUT
s7extra: string                          # freeform

# Product Choice
companionCharacterId: string
storyDirection: 'bedtime' | 'adventure' | 'fantasy'
style: string
```

### תובנה חשובה

ההורה שמתחיל בקטגוריה NIGHT_FEAR וממלא ברצינות 4 שאלות-המשך + טראיטים + מטרות + מה-להימנע — מספק **רוחב גדול מאוד** של מידע. כרגע אנחנו זורקים 80% ממנו.

---

# PART 3 — Story Response Style Detection (מהתשובות → סגנון התמודדות)

### הרעיון

מתוך הפרופילים העמוקים של 5 הדמויות, זיהינו 5 **סגנונות התמודדות בסיסיים**:

1. **CONTROL** (זוּזִי) — שולט בעוצמה גוברת עד שהשליטה נשברת
2. **VIGILANCE** (לִילִי) — סורק ועוקב עד לתשישות
3. **MIMICRY** (קִים) — מתאים את עצמו עד שאיבד את זהותו
4. **PERFORMANCE** (דּוּדִי) — נע מהר עד שמשהו מאלץ עצירה
5. **PREDICTION** (צְבִי) — חוזה הכל עד שדבר לא צפוי מקריס

יש עוד שניים שאפשר להוסיף בעתיד:
6. **WITHDRAWAL** — נסיגה לתוך עצמו, התרחקות
7. **PLEASING** — מנסה לרצות את כולם, מאבד את עצמו

### תרגום מטראיטים+תשובות → סגנון

זה לא 1-ל-1. זה אומדן הסתברותי.

```yaml
# CONTROL signals
indicators:
  - childTraits contains: [פעלתן, אמיץ]
  - difficulties contains: "מתעקש לעשות לבד"
  - s4extra mentions: "מתפרץ", "כעס פתאומי"
  - parentIntent: "צריך לכוון את האנרגיה"

# VIGILANCE signals
indicators:
  - childTraits contains: [רגיש, סקרן]
  - difficulties contains: "מתעורר באמצע הלילה"
  - followUp answer: "לבד עם כל הראש"
  - parentIntent: "חרדה כללית"

# MIMICRY signals
indicators:
  - childTraits contains: [רגיש, יצירתי]
  - challenge: TRANSITION, SOCIAL
  - difficulties contains: "מתאים את עצמו לכולם"
  - parentIntent: "מאבד את עצמו ברעש"

# PERFORMANCE signals
indicators:
  - childTraits contains: [פעלתן, שובב]
  - challenge: FOCUS_LEARNING, ANGER_FRUSTRATION
  - difficulties contains: "לא יכול לעצור"
  - parentIntent: "עייף את עצמו"

# PREDICTION signals
indicators:
  - childTraits contains: [רגיש, סקרן]
  - challenge: SENSITIVITY_OVERWHELM, GENERAL_FEARS
  - followUp: "מבקש לדעת מראש מה יקרה"
  - parentIntent: "שואל שאלות בלי סוף"
```

### זרימה

```
wizard answers
    ↓
[LLM call: classify_coping_style]
    ↓
{primary: CONTROL, secondary: PERFORMANCE, confidence: 0.78}
    ↓
feed into Prescription
```

זו קריאת LLM נפרדת. עלות זניחה (gpt-4o-mini ~$0.001).

---

# PART 4 — Severity Scoring

ההורה שכותב "מתעקש לישון עם אור" מספר על משהו אחר מההורה שכותב "מתעורר בוכה כל לילה ולא נרגע 30 דקות."

### Severity Tiers

```
TIER 1 — MILD (~50% מהמקרים)
  Indicators: low s4extra, single difficulty, mild language
  Treatment: gentle, story focuses on prevention/comfort

TIER 2 — MODERATE (~35%)
  Indicators: multiple difficulties chips, time-bound complaint
  Treatment: standard depth, full Moment Contract

TIER 3 — HEAVY (~15%)
  Indicators: long s4extra, "תקופה ארוכה", multiple s-extras filled,
              avoid list contains specific concrete triggers
  Treatment: extra gentle pacing, longer regulation arcs, NO confrontation
```

### Severity-Aware Adjustments

| Tier | Pacing | Moment Type | Closure |
|---|---|---|---|
| 1 | Standard | Discovery / touch | Sensory residue |
| 2 | Slower escalation | Touch / transformation | Strong residue + return to safety |
| 3 | Slower throughout | TOUCH only (no transformation) | Heavy sensory closure + ritual element 3x |

---

# PART 5 — Companion-Coping-Style Fit Matrix

כיום: כל companion קשור לקטגוריה אחת ויחידה. אין "התאמה דקה".

### המטריצה החדשה (proposal)

| Story Response Style | Best Fit Companions (primary) | Secondary | Avoid |
|---|---|---|---|
| CONTROL | זוּזִי (תמנון) | seahorse_yam (מי שעוגן חזק) | פסיביים מדי |
| VIGILANCE | לִילִי (עטלף) | hawk_had (נץ) | זריזים מדי |
| MIMICRY | קִים (זיקית) | gecko_rifa (גקו) | יציבים מדי |
| PERFORMANCE | דּוּדִי (דולפין) | mongoose_zariz (מנגוס) | איטיים מדי |
| PREDICTION | צְבִי (עופר) | mole_sheket (חפרפרת) | תזזיתיים מדי |
| WITHDRAWAL | turtle_beiti (צב) | snail_sheli (חילזון) | חברותיים מדי |
| PLEASING | bunny_ometz (ארנב) | puppy_neeman (כלבלב) | שמתעקשים על עצמם |

**שים לב:** המטריצה צריכה refinement בלי-להפסיק. החיבור הזה הוא **המלצה לוויזרד**, לא דטרמיניזם.

### איך זה משפיע על הוויזרד

```
היום:
  user picks NIGHT_FEAR → shown 3 bat companions (hardcoded)

מחר:
  user picks NIGHT_FEAR + traits=[רגיש, סקרן] + answers indicate VIGILANCE
  → show 3 companions WHERE coping fit is best:
     - לִילִי (perfect fit, VIGILANCE)
     - mole_sheket (good fit, WITHDRAWAL-adjacent)
     - bat_lily variant (B)  ← future when we have multiple stories per companion
```

זה יידחה לאחר שיש לנו Companion Bible לכל 36 הדמויות (כיום רק 5).

---

# PART 6 — The Prescription (Interface ל-Story Engine)

זה ה-deliverable. ה-Psych Engine מחזיר את ה-YAML הזה. ה-Story Engine מקבל אותו ב-Stage 2.

### Schema

```yaml
# 1. Identification
orderId: string
childProfile:
  name: string
  age: number
  gender: 'boy' | 'girl' | 'other'
  traits: string[]
  superpower: string

# 2. Emotional Situation (the WHAT)
emotionalSituation: |
  One sentence describing what the child is experiencing.
  Use the parent's words from s4extra where possible.

childBehavior:
  observable: |
    What the parent sees the child DO (not feel).
  bodyResponse:
    Physical clues from the parent's description.

# 3. Wrong-Strategy (the parent's instinct that's making it worse — optional)
wrongStrategy: |
  If the parent's helpers/avoid lists suggest they've tried
  rationalizing / forcing / shaming, name it kindly here.

# 4. Story Response Style (from Stage 3)
copingStyle:
  primary: CONTROL | VIGILANCE | MIMICRY | PERFORMANCE | PREDICTION | WITHDRAWAL | PLEASING
  secondary: string | null
  confidence: number  # 0-1

# 5. Severity (from Stage 4)
severity: MILD | MODERATE | HEAVY

# 6. The Therapeutic Aim
desiredBodyShift: |
  Concrete physical/sensory change the story should rehearse.
  Examples: "shoulders drop, breath slows" / "back settles into mattress"
  NEVER an emotion ("feels safer") — always a BODY change.

# 7. Physical Mechanic Suggestion (THE CORE)
physicalMechanicSuggestion: |
  ONE sentence. How does the difficulty become an ACTION in the story?
  NEVER use the word "metaphor."
  Examples:
    - "Companion lives in the dark and brings a tiny light from within"
    - "Companion folds into a shell; outside hard, inside warm"
    - "Companion absorbs loud sound into wool-cloud body and lowers it to a hum"

# 8. Constraints (BLOCKING for Story Engine)
tabooDirectWords: string[]
  # Words the story must NEVER say.
  # Examples: [trauma, brave, conquer, "everything will be fine", monster]

narrativeConstraint: |
  From categoryBranching.treatmentStrategy.narrativeConstraint.
  e.g., "anchored in real home; shadows can be characters but no portal world"

avoid: string[]
  # From categoryBranching.treatmentStrategy.avoid + parent's avoid list
  # Examples: ["rationalizing the fear", "instant calm", "moralization"]

# 9. Tone (from categoryBranching.storyTone)
narrativeRegister: string
illustrationMood: string

# 10. Companion Affinity (for the Story Engine to know WHY this companion)
companionFitNotes: |
  One sentence explaining why this companion suits this child this time.
  Used in the prompt for companion-specific framing.
```

---

# PART 7 — End-to-End Flow

```
┌─────────────────────────────────────────────────────────────┐
│  WIZARD (15 steps)                                          │
│  collects: name, age, gender, traits, photo, category,      │
│            categoryAnswers, superpower, difficulties,        │
│            goals, helpers, avoid, companion, direction       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  PSYCH ENGINE                                               │
│                                                             │
│  Stage A: Story Response Style Classification (LLM call)            │
│     in: childTraits + categoryAnswers + difficulties        │
│     out: { primary, secondary, confidence }                 │
│                                                             │
│  Stage B: Severity Scoring                                  │
│     in: s4extra length + difficulty count + concrete signs  │
│     out: MILD | MODERATE | HEAVY                            │
│                                                             │
│  Stage C: Physical Mechanic Translation (LLM call)          │
│     in: category + copingStyle + severity                   │
│     out: physicalMechanicSuggestion sentence                │
│                                                             │
│  Stage D: Prescription Assembly                             │
│     out: Prescription YAML (see PART 6)                     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  STORY ENGINE (Stages 1-9 from STORY_ENGINE_v1.md)          │
│                                                             │
│  Stage 1: Parse Request                                     │
│  Stage 2: Load Prescription ← arrives here                  │
│  Stage 3: Load Companion Bible                              │
│  Stage 4: Build Beat Map                                    │
│  Stage 5: Define Moment Contract                            │
│  Stage 6: Define Hook Contract                              │
│  Stage 7: Draft                                             │
│  Stage 8: Self-QA                                           │
│  Stage 9: Repair + Cleanup                                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
                       FINAL STORY
                       + QA log
                       + reused prescription stored
```

---

# PART 8 — מה חסר היום (Implementation Gaps)

### בלתי-קיים בקוד (חובה לבנות)

```
□ classify_coping_style — LLM call עם prompt טוב
□ score_severity — function שמחשבת tier מההיוזריסטיקות
□ translate_physical_mechanic — LLM call עם examples
□ assemble_prescription — מרכיב את ה-YAML
□ פאסה ב-/api/generate שמזריקה את ה-Prescription לפרומפט
□ ספריית examples של physicalMechanic (10+ דוגמאות לקטגוריה)
□ Companion-Coping-Fit matrix כקובץ JSON/TS
□ ולידציה של ה-Prescription לפני שהוא הולך ל-Story Engine
```

### חצי-קיים (לחזק/לחבר)

```
□ categoryBranching.ts — קיים אבל לא מוזרק
   → לחבר ל-prompt assembly של Story Engine
□ Wizard collects all data → DB → never reaches LLM
   → לוודא שה-Prescription משתמשת בכל השדות
□ Photo analysis result → exists in code → not in story
   → לבדוק האם זה רלוונטי (probably not for Psych)
```

### קיים ולא צריך לגעת

```
✓ Wizard wizardry — אוסף נכון
✓ categoryBranching content depth — מעולה
✓ Deep companion profiles (5/36) — בסיס טוב להמשך
```

---

# PART 9 — Coverage Matrix (ה-engine מכסה הכל?)

לפני release, נריץ את ה-matrix הזה:

```
For each {category, coping, severity, age_tier, direction}:
  □ Has the Prescription template been validated?
  □ Has at least one example story been generated?
  □ Has the example passed all Story Engine QA?
  □ Has it passed Companion Swap Test?
  □ Has it received a manual review pass?
```

11 categories × 5 coping styles × 3 severity × 3 age × 3 directions = **1485 combinations**

❌ אנחנו לא הולכים לכתוב 1485 דוגמאות. ה-engine אמור להכליל.

✅ **המינימום:** דוגמת זהב אחת לכל categoryDirection (33), עם variants שמדגימות את ה-coping styles הקיצוניים.

זה הקובץ הבא ב-roadmap: `docs/GOLD_STORIES/coverage.md`.

---

# PART 10 — איך זה משתלב בסדר עדיפויות

לפי המוצר היום, סדר הבנייה הנכון:

### Phase A: Foundation (כבר נכתב)
- [x] `STORY_ENGINE_v1.md`
- [x] `COMPANION_BIBLE_v1.md` (5 דמויות עם בייבל מלא)
- [x] `PSYCH_ENGINE_v1.md` (זה המסמך)

### Phase B: Build the Engine (~2 שבועות)
- [ ] LLM prompts: classify_coping, translate_mechanic
- [ ] Prescription assembler (TypeScript)
- [ ] Wire Prescription into `/api/generate` flow
- [ ] Companion Bibles for the remaining 31 (or 36 after v2)
- [ ] 3 Gold Stories — one per direction with annotations

### Phase C: Production Validation (~1 שבוע)
- [ ] Generate 10 stories via the new pipeline
- [ ] Blind test vs. story-bank stories (you + 1 other parent)
- [ ] Iterate on prompts based on QA logs
- [ ] Decide: Is the engine ready to be the DEFAULT, or fallback-only?

### Phase D: Bank → Gold Library (~1 week)
- [ ] Identify the 12-18 best stories from v5-fixed-v2
- [ ] Annotate each with "why this works"
- [ ] Retire the rest from production (keep in repo for taste reference)

---

# Self-QA — האם ה-Prescription איכותי?

לפני שה-Prescription יוצא ל-Story Engine, ה-Psych Engine רץ על עצמו:

```
□ Does the prescription have a concrete physicalMechanicSuggestion?
□ Is the desiredBodyShift a BODY change (not an emotion)?
□ Does the tabooDirectWords list include the parent's avoid items?
□ Does the narrativeConstraint match the category's existing rule?
□ Is the coping style classification confidence > 0.6?
   If lower — flag for manual review.
□ Does the severity tier match observable wizard signals?
   If MILD but s4extra is 200+ chars — likely under-classified.
□ Is companionFitNotes specific to this companion (not generic)?
```

אם משהו לא עובר — הצוות מקבל התראה. הסיפור לא נחסם — אבל הוא נכנס לרבע של "lower confidence."

---

*Sister documents: `STORY_ENGINE_v1.md`, `COMPANION_BIBLE_v1.md`*
*To follow: `docs/GOLD_STORIES/` (one story per direction with annotations)*
