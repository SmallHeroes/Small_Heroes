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

1. Read this file again.
2. Write the story respecting **every** rule above.
3. Verify with `grep -E '(אחוז|מחקרים|תאי דם|תהליך ביולוגי|בדיוק [0-9]+ דקות|זה נקרא [^"]+\")' new_file.md` — must return zero matches.
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
