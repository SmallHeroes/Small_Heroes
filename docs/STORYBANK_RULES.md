# Story Bank — Hard Rules for Children's Stories

This file codifies what a Small Heroes story **must never contain**, and what
every story **must do**. Any author (human or LLM) generating new content for
`story-bank/v5-fixed-v2/` must read this first.

These rules came from real failures in production — every forbidden phrase
below has appeared in a generated story that we had to delete.

---

## FORBIDDEN — Never Write These in a Children's Story

### 1. Clinical / scientific / medical jargon

A children's storybook is not a science textbook. The child reading it is 3-7
years old. The following types of phrases are **always forbidden** in dialogue
and narration:

- **Percentages** of any kind:
  - ❌ `"95% מהילדים"`, `"תשעים וחמשה אחוז"`, `90%`, `"רוב הילדים"`, `"כמעט כולם"`
  - ❌ Even Hebrew-spelled percentages count.
- **Research / studies language:**
  - ❌ `"מחקרים מראים"`, `"מחקר מראה"`, `"מוכח"`, `"מומחים אומרים"`, `"המדע אומר"`
- **Measurement-as-fact in dialogue:**
  - ❌ `"בדיוק ארבע דקות"`, `"אפשר למדוד"`, `"זמן מדויק"`, `"בערך X שבועות"`,
    `"שלושה סנטימטרים"`
  - (A character can say `"לוקח קצת זמן"` — that's fine.)
- **Medical / biological terms:**
  - ❌ `"תאי דם לבנים"`, `"מערכת חיסונית"`, `"תהליך ביולוגי"`, `"בקטריות"`, `"מולקולה"`,
    `"DNA"`, `"חיסון"`, `"זריקה"` *(as clinical noun — `"זריקה קטנה"` describing a sensation is OK)*
  - ❌ `"זה נקרא ריפוי"`, `"זה נקרא X"` (lecturing the child)
- **Statistical claims:**
  - ❌ `"רוב הילדים"`, `"כל הילדים"`, `"תמיד"`, `"אף פעם"` *(as universal claims)*

### 2. Lecturing / explaining the lesson

The story shows, never tells. Forbidden patterns:

- ❌ `"זה לימד אותו ש—"` (this taught him that—)
- ❌ `"המוסר השכל הוא—"` (the moral is—)
- ❌ `"וככה למדנו ש—"` (and so we learned that—)
- ❌ Characters who summarize the lesson in the final page.

### 3. Adult-grammar phrases that feel like a textbook

- ❌ `"בעצם"` followed by a fact-dump.
- ❌ `"למעשה"`, `"כפי שאמרנו"`, `"במונחים פשוטים"`.
- ❌ Long subordinate clauses ("…אשר…אשר…") nested in dialogue.

### 4. Text-on-image instructions

- ❌ Never include text, numbers, letters, or words on clothing, walls, signs,
  papers, books, or any surface in `imageDirection`. Render generators struggle
  with Hebrew letters and produce gibberish.

---

## REQUIRED — Every Story Must Have

### 1. Use `{{childName}}` placeholders

Stories must include `{{childName}}` in **2-4 spots** spread across the text —
opening, an emotional turning point, and the closing. The loader replaces these
at render time with the real child's name.

```
דּוּרִי מסתכל על {{childName}}. "בואי תשבי," הוא אומר.   ← good
דּוּרִי מסתכל עליה. "בואי תשבי," הוא אומר.              ← weak (no name)
```

Even if you also write `הילדה`/`הילד` elsewhere — that's fine, the post-load
LLM pass replaces some of them. But ALWAYS include explicit `{{childName}}` in
the first page and last page so the child meets their own name immediately.

### 2. Use `{{companionName}}` for the companion

Same rule. The companion is named in `companions.ts` (e.g. `דּוּרִי`,
`לִילִי`, `זוּזִי`) — use `{{companionName}}` in the story so name changes in
`companions.ts` propagate automatically.

### 3. `imageDirection` for every page

Each page must end with one `imageDirection:` line in **English**, describing:

- WHO is in the frame (child + companion is the default)
- WHAT they're doing (action, pose, expression)
- WHERE (concrete setting — "underwater coral reef", "moonlit bedroom", "forest
  clearing at dawn") — **never** leave blank, **never** say just "scene"
- LIGHT / MOOD (one short phrase)

The image enricher only knows what `imageDirection` tells it. If the setting
or the companion isn't there, the rendered image won't have them either. The
locale regex now recognizes water/underwater/coral/reef/forest/mountain/desert/
meadow/cave/sky/snow/village — use those words explicitly when relevant.

### 4. Partial nikud (helping marks only)

Add nikud (vowel marks) **only** on words a 5-year-old reader might mispronounce.
Examples where nikud helps: rare names (`דּוּרִי`, `לוּלִי`), shoresh-ambiguous
verbs, and the first appearance of a new place name. Do NOT mark every word —
over-marking makes the text harder to read.

### 5. Hebrew partial dialogue, not Wikipedia narration

The companion should speak like a real animal-character would — short, sensory,
emotionally present. Examples of how to teach without lecturing:

- Instead of `"תאי דם לבנים מגיעים ועוזרים"` → `"הגוף יודע לחבק את הפצע מבפנים"`
- Instead of `"95% מהילדים בסדר"` → `"רוב הילדים שעוברים את זה — חוזרים לבית עם חיוך"`
- Instead of `"זה נקרא ריפוי"` → `"זה הקסם השקט שקורה כשמחכים"`

---

## EDITORIAL PRINCIPLES — added 2026-05-17

These principles emerged from a systemic editorial pass across 27 stories
(NIGHT_FEAR, NOISE_FEAR, TRANSITION) and codify what was previously implicit.

### A. Behavior modeling: what the child does on the page becomes a model

Picture books transmit behavior. A 4-7-year-old who reads the protagonist
roll their eyes at the helper, or shout "תפסיק!" at them, learns that this
is what frustrated children do. The emotional beat we need (overwhelm,
anger, confusion) can ALWAYS be expressed as INTERNAL EXPERIENCE rather
than DISRESPECTFUL ACTION toward the companion.

**Forbidden behaviors when the child is frustrated/overwhelmed:**

- ❌ `מגלגל/ת עיניים` (eye-rolling) → ✅ `מסתכל/ת הצידה. שותק/ת`
- ❌ `מחקה את הידיים/הקול/התנועות` (mocking-mimicry) → ✅ `אני לא מקשיב יותר`
- ❌ `"תפסיק!"` shouted at the helper → ✅ `"אני לא יכול יותר"` (self-statement)
- ❌ `"תזוּזי!"` / `"לך!"` (commanding helper to move/leave) → ✅ `בבקשה, זוזי...`
                                                              or `מסתובב/ת הצידה`
- ❌ `מרים את הכתפיים` (dismissive shrug) → ✅ `מסתכל/ת הצידה`
- ❌ `מנופף/ת הצידה / דוחף/ת הצידה` (waving/pushing helper aside)
  → ✅ `מצמיד/ה ידיים לחזה`
- ❌ `שׂם/ה יד על הפה של [companion]` (physical silencing)
  → ✅ `מסתובב/ת הצידה ומתכווץ/ת`
- ❌ `זורק/ת אות[הו] הצידה` (throwing helper's possession)
  → ✅ `מַזִּיז/ה אות[הו] הצידה`
- ❌ `לוקח/ת [item] מהיד של [companion]` (grabbing helper's object)
  → ✅ `נוגע/ת ב[item]` or `שׁוֹלֵחַ/ת יד אל [item]`

**Allowed:** the child covering their OWN ears (self-protection), turning
away in silence, getting impatient and moving ahead alone, expressing
confusion ("אני לא מבין/ה", "אני מתבלבל/ת").

**The principle:** the EMOTIONAL beat stays the same; only the SURFACE
ACTION changes. Frustrated child still frustrated — they just don't model
contempt toward the helper.

### B. Title rules

Every story has a `title` in YAML frontmatter. Rules:

1. **Each of a companion's 3 books needs a UNIQUE title.** A child collecting
   the series should be able to tell at a glance which is which.
   - ❌ `bedtime` and `adventure` both titled `"הצבע שנשאר"` → forbidden
2. **Titles should be EVOCATIVE, not ABSTRACT.**
   - ❌ `"סוּגֵי הַצְּלָלִים"` (Types of Shadows) — sounds like a textbook
   - ✅ `"הַצֵּל שֶׁלֹּא הִתְאִים"` (The Shadow That Did Not Fit) — story-like
3. **Hebrew titles preferred over English-translated structures.**
   Use natural Hebrew syntax, not "X of Y" calques unless they sound natural.
4. **Avoid the same first word repeated across the 3 books.**

### C. Canonical companion names

The companion's first name MUST appear in the body of the story at least
3 times. The canonical name comes from `lib/companions.ts` —
`getCompanionById(companionId).name`, taking the last word as the first name
(e.g., `'הקיפוד רַכִּי'` → `רַכִּי`).

Common audit failures:
- Story uses `הקיפוד` (the hedgehog) throughout but never `רַכִּי` → companion
  feels generic, fails the Director Layer's companion-presence check.
- Spelling variants: `רחי` vs `רכי`, `מישי` vs `משי`, `זוהר` vs `זהר` — pick
  the canonical form and stay with it.
- One book of the series uses a DIFFERENT name (e.g. bedtime says `טִיטִי` but
  adventure says `חֲרוּצָה`) → CRITICAL: breaks identity continuity.

### D. emotionalMistake design

Every v5 story has an `emotionalMistake` beat — the page where the child
inadvertently makes things worse. Good design vs bad:

**Good (story-functional internal struggle):**
- Child overwhelmed and walks ahead alone before the helper is ready.
- Child tries to help by adding more (and the situation worsens).
- Child chooses the wrong helper (a beetle when an ant was needed).
- Child gets distracted, breaks attention from the moment.

**Bad (models disrespect):**
- Child rolls eyes at the helper.
- Child shouts at the helper to stop.
- Child physically silences/restrains the helper.
- Child mocks the helper's gestures.
- Child throws the helper's possessions.

The `emotionalMistake` should make the reader feel "I've done that, it's
hard" — not "this is how to treat someone who frustrates you".

### E. UTF-8 hygiene

Files must contain ZERO U+FFFD replacement characters (`�`). If a story is
edited with a tool that breaks Hebrew encoding, the corruption shows as `�`
inside words (e.g., `יוש��` instead of `יושב`). Re-encode and verify with:
```
grep -l '�' story-bank/v5-fixed-v2/*.md   # must return nothing
```

---

## Frontmatter requirements

Every story file must have at the top:

```yaml
---
title: "..."                    # Hebrew title
companionId: ...                # e.g. starfish_kokhavi
direction: bedtime | adventure | fantasy
category: ANGER_FRUSTRATION | NIGHT_FEAR | MEDICAL_PROCEDURE | ...
gender: male | female           # the story's WRITTEN gender (gender swap fixes mismatch)
pages: 10 | 15 | 20             # matches direction
endingType: resolution | residue
companionLetter:                # optional but recommended
  insertAfterPage: 9
  imageDirection: "..."
---
```

---

## Page count per direction

- **bedtime** = 10 pages (shorter, calmer)
- **adventure** = 15 pages
- **fantasy** = 20 pages (longest, more imaginative)

---

## Workflow when adding/replacing a story

1. Read this file again (especially the EDITORIAL PRINCIPLES section).
2. Write the story respecting **every** rule above.
3. Run `node scripts/audit-stories-content.mjs` (deterministic pattern audit
   — checks names, titles, behavior modeling, UTF-8 hygiene).
4. Verify `{{childName}}` appears at least twice.
5. Save to `story-bank/v5-fixed-v2/<companionId>_<direction>.md`.
6. Test by generating a book through the wizard with that companion.

---

## Prior failures (what got us here)

- **2026-05-15** — `starfish_kokhavi_adventure.md` and `starfish_kokhavi_fantasy.md`
  shipped with "מחקרים מראים", "95% מהילדים", "תאי דם לבנים מגיעים ועוזרים",
  "זה נקרא ריפוי", "בדיוק ארבע דקות", "תהליך ביולוגי". User read the rendered
  book and rejected it. Both files deleted, replaced from scratch by hand.
  Lesson: even when the *meta-narrative* intends clinical language as the
  failed-coping the story teaches against, the reader experiences it as the
  voice of the book. Don't write it.

- **2026-05-17** — Editorial pass across 27 stories (NIGHT_FEAR, NOISE_FEAR,
  TRANSITION) found systemic modeling of disrespect: child rolling eyes,
  shouting "תפסיק!", covering helper's mouth, throwing helper's possessions,
  commanding helper to stop being themselves. Also 16 files with broken
  canonical-name consistency (the bedtime+adventure used different names
  for the same companion). Codified as EDITORIAL PRINCIPLES section above.
