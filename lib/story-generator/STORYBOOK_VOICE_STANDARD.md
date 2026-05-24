# Storybook Voice Standard

**Purpose:** defines what a *real children's-book voice* is — the single source
of truth for story-language quality.
**Consumed by:** (1) the Author prompt, (2) the Phase C Voice Reviewer, (3) the
one-time recipe voice-calibration pass.
**Status:** v1, Hebrew. Multilingual-ready (see section 8).
**Date:** 2026-05-24 (rev 3 — Family F reframed: semantic misuse, not spelling).
**Related:** `docs/PHASE_C_SPEC.md`.

## 1. The measure

> Would a parent read this aloud to their child at night — after dozens of
> good children's books — and not feel that it was written by an AI?

Everything below serves that one question.

## 2. Core principles

1. **Natural children's-book Hebrew — not therapeutic Hebrew.** The story is a
   story, not an emotional report disguised as one. This principle belongs in
   the **Author prompt** too, not only in QA.
2. **Show emotion, do not explain it.** A tight fist, raised shoulders — not
   "the body felt anxious".
3. **Concrete body / action over abstract therapy terms.**
   "נועה מכווצת קצת" — not "הגוף נמצא במצב של כיווץ".
4. **Relationship over mechanism.** The companion is a friend who answers in
   body — not a tool that performs a calming function. If the companion feels
   like a calming device, the story failed even if the resilience arc is intact.
5. **Read-aloud first.** Every line must flow in a parent's mouth. Every page
   ends on a small concrete moment.
6. **Age-fit.** The voice matches the child's age (section 6).
7. **No AI-smell.** No poetic abstraction, no translated-sounding syntax, no
   repeated sentence skeletons.

## 3. The BAD / GOOD library — the core of this document

This is not a vague rubric. It is paired examples. The Voice Reviewer and the
Author prompt both anchor on these.

Read the labels precisely:
- **BAD** — the failure. What must not ship.
- **GOOD** — the *safe, correct* replacement: the floor a reroll must at
  minimum reach. Correct Hebrew, right register — not necessarily the literary
  ceiling.
- **STORYBOOK** — the bar we actually want: simple children's-book prose that
  carries a small image. Not every pair has one yet; where it does, that is
  the target.

Each family carries a `family` id — used by the Phase C finding schema. The
library grows from lines really flagged in calibration; every new member is a
line that actually appeared.

### Family A — Therapeutic / abstract prose · `therapeutic_abstract`
The story slips into a clinical or self-help register.

- BAD:       `הגוף השקט שאפשר ללמוד ממנו.`
  GOOD:      `בּוֹלִי נשאר עגול וחם, קרוב ליד.`
- BAD:       `אי-השקט הקטן עוד כאן.`
  GOOD:      `היא עוד קצת דרוכה.`
  STORYBOOK: `נועה עוד דרוכה קצת, והיד מחזיקה את השמיכה.`
  *Why:* "אי-שקט" is an adult, formal noun. A 5-year-old's book names the
  feeling through the body, not through a clinical term.

### Family B — Body / abstract noun as the main character · `body_as_character`
Flag only when a body part or abstraction **replaces the child as the agent**
— it acts, decides, or carries the narrative while the child disappears — or
when the line reads as therapeutic/clinical prose, not a story.

**OK — somatic body-state (on-brand in calm/medical/anxiety stories):**
- OK: `הגוף עוד דרוך` · `הכתפיים עולות` · `הנשימה מתקצרת`
- OK: `הגוף שלה לא מתכווץ הפעם` · `הגוף מתחיל להתרכך` · `הגוף לא נסוג`

**FLAG — body/abstraction as agent or clinical register:**
- FLAG: `הגוף יודע` · `הגוף מחליט` · `הגוף זוכר` · `הצעדים נושאים מבט` · `השקט עונה`
- BAD:  `הצעדים נושאים מבט אל המדבקה.`
  GOOD: `בדרך הביתה היא מסתכלת שוב ושוב על המדבקה.`
  STORYBOOK: `נועה עוד מחזיקה את השמיכה חזק. בּוֹלִי נשאר ממש ליד היד.`
  *Why:* steps do not carry a gaze; "the body knows/decides" is not children's
  book prose — keep the child the subject.

### Family C — AI-poetic phrasing · `ai_poetic`
Pretty, lyrical, but not how anyone speaks to a child.

- BAD:  `החום עובר אל קצה האצבע.`
  GOOD: `האצבע נשארת רגע על בּוֹלִי החם.`
- BAD:  `האור דוקר את העיניים.`
  GOOD: `האור הלבן חזק בעיניים.`

### Family D — Emotion explained instead of shown · `emotion_explained`
- BAD:  `נועה הרגישה חרדה גדולה לפני הבדיקה.`
  GOOD: `היד של נועה נמשכת לאחור, והכתפיים עולות.`

### Family E — Vague / elliptical motif overuse · `motif_overuse`
A motif repeated until it is wallpaper, or stated so elliptically it loses
meaning.

- BAD:  `ובפנים חם.`  (standing alone, repeated across pages)
  GOOD: `בּוֹלִי מתכרבל ליד היד, חמים ושקט.`
  *Why:* the warmth-inside-Bolly motif is good — but it must be grounded each
  time, not dropped as a two-word fragment.

### Family F — Semantic misuse / real word, wrong context · `semantic_misuse`
A sentence where every word is **valid Hebrew** but the meaning is wrong. Two
shapes: (a) a real word used with the wrong meaning; (b) an impossible
subject-verb pair (all words valid, the sentence still wrong). A spell-checker
catches neither.

**NOT semantic_misuse:** a body **feeling** a sensation (`הגוף מרגיש` is fine).
Reserve type (b) for impossible cognitive/intentional acts (`הצעדים שומעים`,
`האור דוקדק`). Borderline body-lines → `body_as_character` or no finding.

- BAD:  `האור הלבן בחדר דוקדק ונוגע בעיניים.`
  GOOD: `האור הלבן בחדר חזק בעיניים.`
  *Why:* `דוקדק` is a real word but light is not "scrutinised" — wrong meaning.
- BAD:  `הצעדים שומעים את הטוּמְפּ.`
  GOOD: `היא שומעת את הטוּמְפּ.`
  *Why:* steps do not hear — impossible subject-verb.

### Family G — Read-aloud stumbles · `read_aloud_stumble`
Dense, clause-heavy, or awkward-to-say sentences.

- BAD:  `בּוֹלִי מתגלגל לידה ומתאים את הקצב לקצב הצעדים — טוּמְפּ רך.`
  GOOD: `בּוֹלִי מתגלגל לידה, באותו קצב כמו הצעדים — טוּמְפּ רך.`
- BAD:  `המחשבה על מחר עושה את הכתפיים לעלות קצת.`
  GOOD: `המחשבה על מחר מעלה קצת את הכתפיים.`
  *Why:* "קצב לקצב" stumbles in the mouth; "עושה את X לעלות" is a calque. Say
  it the short, natural way.

### Family H — Mechanism over relationship · `mechanism_over_relationship`
The companion performs a function; there is no exchange.

- BAD:       `נועה פוחדת. בּוֹלִי משמיע טוּמְפּ. נועה נרגעת.`
  GOOD:      `נועה לוחשת: "אתה בא איתי?" בּוֹלִי מתגלגל אל התרמיל — טוּמְפּ קטן.`
  STORYBOOK: `נועה מציצה אל בּוֹלִי. "אתה בא איתי?" בּוֹלִי מתגלגל אל התרמיל, ונשמע טוּמְפּ קטן.`
  *Why:* the first is a calming machine; the second and third are two friends.

### Family I — Name overuse / subject monotony · `name_overuse`
The child's name (or "X does… X does…") opens line after line. Usually a
STORY-level pattern -> `scope: story` -> diagnostic -> recipe/prompt task, not
a page reroll.

- BAD:  `דניאל מרגיש את הטוּמְפּ. דניאל שומע. דניאל מניח יד. דניאל קולט.`
  GOOD: `הוא שומע את הטוּמְפּ ליד הרגל. היד נשארת רגע על הכיס. בדרך הביתה המבט חוזר למדבקה.`
  *Why:* vary the subject — the name, a pronoun, one body part doing one real
  thing. *Caution:* do not overcorrect into "הגוף" / "היד" on every line —
  that is Family B. The child stays the subject most of the time; just not by
  name every line. The name is an anchor, not a tic.

### Family J — Parallel action chains · `parallel_action_chains`
"Child does X. Companion does Y. Child calms." Two actors in parallel, no
exchange. This was the core failure the B.3 `relationshipLoop` was built to
kill; the Voice Reviewer is the backstop. Related to Family H — but H is about
the companion's *role* (tool vs friend), J is about the *structural rhythm*.
Pervasive across pages -> `scope: story` -> recipe/prompt task.

- BAD:  `נועה עושה תרגיל. בּוֹלִי משמיע טוּמְפּ. נועה נרגעת.`
  GOOD: `נועה לוחשת: "ככה?" בּוֹלִי נשאר עגול וחם, קרוב ליד.`
  *Why:* the first is two tracks running side by side. The second is one
  exchange — she acts toward him, he answers in body.

## 4. Forbidden-pattern families (quick reference)

Substrings / shapes the deterministic layer and the Voice Reviewer watch for:
clinical nouns used of a child ("מצב של", "תחושת חרדה"); abstract-noun subjects
("הצעדים נושאים", "השקט עוטף"); moral / lesson closers ("הבינה ש", "למדה ש");
AI-poetic ("ליטף", "התמלא", "נושא מבט"); companion-as-voice ("בּוֹלִי אמר").
Each recipe also carries its own scenario-specific `forbiddenPatterns` array.

## 5. Read-aloud rules (Hebrew)

A children's book is *read aloud*. These rules keep a parent's mouth flowing
and feed the `read-aloud` axis of the Voice Reviewer.

- **Em dashes:** at most one long dash (—) per page; never two in one sentence.
- **Clauses:** avoid sentences with 3+ clauses. Two short sentences beat one
  long one.
- **Commas:** at most ~2 per sentence.
- **Dialogue:** short, and attributed naturally to the child ("נועה לוחשת:",
  "הוא לוחש:") — never to an abstract noun ("הלחישה באה:").
- **Page endings:** each page ends on a small concrete moment. Do not end most
  pages on the word "שקט" / "שקט." — vary the closing image.
- **First sentence:** the opening line of a page is the most-read line — keep
  it light; it must never be the densest sentence on the page.

## 6. Age Voice Profiles

(Reference. The Age Voice *layer* is Phase C v2 — but the profiles live here.)

**Ages 3-4:** very short sentences; almost no metaphor; gentle repetition;
concrete objects and actions; little "thinking about tomorrow"; the feeling
lives in the body ("הבטן מתכווצת", "היד מחזיקה", "בּוֹלִי קרוב").

**Ages 5-6:** a gentle emotional arc is allowed; short dialogue is allowed; one
small image is allowed; still concrete; not too abstract. *(The current Bolly
line.)*

**Ages 7-8:** more interiority; slightly longer sentences; more humour and
character; some subtext; still no heavy therapeutic language.

Every recipe declares its age tier; the Voice Reviewer checks the voice
against the matching profile.

### Age-specific BAD / GOOD (skeleton — expand when the tiers get recipes)

**3-4:**
- BAD:  `המחשבה על מחר עוד לוחצת.`
  GOOD: `מחר יש בדיקה. היד מחזיקה את השמיכה.`
  *Why:* "the thought of tomorrow presses" is abstract for a 3-year-old —
  name the fact, then show the body.

**5-6:** *(current Bolly line — Families A-J above are calibrated to this tier.)*

**7-8:**
- BAD:  `נועה פחדה.`
  GOOD: `נועה ידעה שהבדיקה קצרה, אבל היד שלה עדיין לא רצתה להתקרב.`
  *Why:* at 7-8 a small amount of interiority and contrast is welcome — but
  still grounded in the body, never heavy therapeutic language.

This skeleton is intentionally minimal — it grows when the 3-4 and 7-8 tiers
get real recipes (Phase C v2, Age Voice layer).

## 7. Gender rules (Hebrew)

- Every child-referencing word uses the `/ה` placeholder form in recipe text
  (`מתכווצ/ת`, `אליו/ה`, `לידו/ה`); the Author resolves it per gender.
- The Language Correctness layer verifies every resolved verb / pronoun /
  adjective agrees with the child's gender, including inflection (closes #178).
- Every recipe gets a boy validation run before sealing — girl-only testing
  hides the masculine path.

## 8. Multilingual structure

This document is the `he` standard. Each future language gets its own file with
the same shape: core principles, a BAD/GOOD library, forbidden-pattern
families, read-aloud rules, age voice profiles, gender / agreement rules,
common AI-smell patterns. Hebrew is first and richest because it is the
current MVP. Nothing here assumes Hebrew is the only language.
