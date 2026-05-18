# Cursor Brief — Story Validators v1

> **Priority:** P0 — BLOCKING. No generator work until this is built and tested.
> **Owner:** Cursor (implementing)
> **Reviewer:** Claude (architecture) + Guy (acceptance)
> **Target:** Production-grade validator library in `lib/story-validators/`

---

## למה זה הקובץ הראשון של ה-MVP

> **"לא בונים writer לפני שיש QA קשיח שתופס זבל בלי רחמים."**

ראינו שוב ושוב בפרודקשן:
- `m` / `L` / `sh` באמצע טקסט עברי
- אותיות תאיות/ערביות זולגות
- `(טעות:` / `(תיקון:` נשארים בסיפור
- עמוד 10 אחרי עמוד 4
- שריון על קים, נוצות על עננה, בובו במקום בולי
- מגדר משתנה באמצע
- Repair שמחק את הפנטזיה הטובה

אם אנחנו בונים מנוע חדש שיכתוב סיפורים — הוא חייב להיבדק על-ידי validators שלא מתפשרים. אחרת ה-engine ייצר זבל יפה.

**הקובץ הזה לא יוצר סיפורים. הוא תופס באגים.**

---

## What We're Building

A TypeScript validator library at `lib/story-validators/` that takes:
- A generated story file (markdown with frontmatter)
- The order context (companion, direction, child profile, etc.)
- Optionally: a "preserved" version (for REPAIR mode regression checks)

And returns:
- A structured JSON report with BLOCKING / WARNING / NOTE findings
- A clear PASS / FAIL verdict
- Detailed per-rule output for debugging

---

## File Structure

```
lib/story-validators/
├── index.ts                    # main entry point: validateStory(input)
├── types.ts                    # ValidationReport, Finding, etc.
├── validators/
│   ├── foreignChars.ts
│   ├── unicodeEscapes.ts
│   ├── errorNotes.ts
│   ├── pageCount.ts
│   ├── pageSequence.ts
│   ├── genderConsistency.ts
│   ├── companionName.ts
│   ├── forbiddenAnatomy.ts
│   ├── forbiddenObjects.ts
│   ├── forbiddenTone.ts
│   ├── killPhrases.ts
│   ├── hookAppearances.ts
│   ├── momentPageWindow.ts
│   ├── namePersonalization.ts
│   ├── companionPresence.ts
│   ├── visualVariety.ts
│   ├── directTherapyLanguage.ts
│   ├── repairRegression.ts
│   └── modeCompliance.ts
├── data/
│   ├── kill-phrases.ts         # static Hebrew kill phrases list
│   ├── therapy-words.ts        # direct therapy language list
│   └── companion-rules.ts      # reads from COMPANION_BIBLE
└── __tests__/
    ├── samples/
    │   ├── good-bedtime.md
    │   ├── good-adventure.md
    │   ├── good-fantasy.md
    │   ├── broken-foreign-chars.md
    │   ├── broken-page-count.md
    │   ├── broken-gender.md
    │   ├── broken-companion-name.md
    │   ├── broken-forbidden-anatomy.md
    │   └── broken-kill-phrase.md
    └── validators.spec.ts
```

---

## ⚠ Parser Separation (CRITICAL — first thing to build)

**Before any validator runs, the story must be parsed into typed zones:**

```typescript
interface ParsedStory {
  frontmatter: Record<string, unknown>;   // English keys/values — DO NOT scan for Hebrew rules
  pages: Array<{
    pageNumber: number;
    imageDirection: string;                // ENGLISH — separate validator
    text: string;                          // HEBREW PROSE — most validators run here
  }>;
}
```

**Why this exists:** the markdown file contains:
- Frontmatter (English: `companionId`, `direction`, `gender`, `title`, etc.)
- Page markers (`--- Page N ---`)
- `imageDirection:` lines (English by design — fed to image LLM)
- Hebrew story body

If a validator runs on the **whole file**, every good story will fail `foreignChars` because of the legitimate English in frontmatter and imageDirection. **Parser first. Validators second.**

---

## Input Shape

```typescript
interface ValidationInput {
  storyMarkdown: string;       // raw md content (will be parsed internally)
  context: {
    companionId: string;         // normalized lowercase: 'bolly_armadillo'
                                  // input may be 'Bolly_armadillo' — normalize first
    direction: 'bedtime' | 'adventure' | 'fantasy';
    pageCount: 10 | 15 | 20;
    childName: string;
    childGender: 'boy' | 'girl' | 'other';
    childAge: number;
    declared: {
      moment: {
        page: number;
        type?: 'touch' | 'transformation' | 'discovery' | 'comic_failure' | 'sacrifice' | 'naming';
        physicalAction?: string;          // for validator semantic check
        companionSignature?: string;
      };
      hook: {
        sound?: string;                    // e.g., "טוּמְפּ"
        phrase?: string;                   // e.g., "בפנים היה חם"
        microAction?: string;              // e.g., "מתקפל לכדור"
        object?: string;                   // e.g., "מדבקה"
        appearsOnPages: number[];
      };
    };
  };
  mode: 'production' | 'repair';
  previousVersion?: {           // required for repair mode
    storyMarkdown: string;
    preserveList: string[];     // strings/beats that must still appear in new version
    changeOnly: number[];       // page numbers allowed to differ from previousVersion
  };
}
```

## Output Shape

```typescript
interface ValidationReport {
  verdict: 'PASS' | 'FAIL';
  summary: {
    blocking: number;
    warnings: number;
    notes: number;
  };
  findings: Finding[];
}

interface Finding {
  validator: string;            // e.g., 'foreignChars'
  severity: 'BLOCKING' | 'WARNING' | 'NOTE';
  message: string;              // Hebrew or English, clear
  page?: number;                // if location-specific
  excerpt?: string;             // ~30 chars surrounding the issue
  suggestion?: string;          // optional auto-fix suggestion
}
```

---

## Validators Specification

### 1. foreignChars (BLOCKING)

**Scope:** Runs ONLY on `parsed.pages[n].text` (the Hebrew prose). Does NOT touch:
- frontmatter (English keys/values are legitimate)
- imageDirection lines (English by design)
- markdown headings / page markers
- YAML structure

Reject any Latin (a-z, A-Z), Arabic, Thai, Cyrillic, Chinese, Japanese, or other non-Hebrew letters **inside Hebrew page text**.

Allowed in Hebrew prose:
- Hebrew letters
- Digits 0-9
- Basic punctuation, מקפים, ניקוד
- Whitelisted proper names (rare — log a NOTE if found)

Regex (after parsing): `/[a-zA-Z؀-ۿ฀-๿Ѐ-ӿ一-鿿぀-ゟ゠-ヿ]/g`

### 1b. imageDirectionValidator (WARNING + structural BLOCKING)

**Scope:** Runs ONLY on `parsed.pages[n].imageDirection`.

Rules:
- BLOCKING: must exist for every page (non-empty string)
- WARNING: no more than 3 consecutive pages with the same shot type (e.g., 4× "Close shot" in a row)
- WARNING: should mention child or companion position when relevant
- **English text is permitted and expected here — do NOT apply Hebrew foreignChars rule**

### 2. unicodeEscapes (BLOCKING)
Reject any `\u0xxx` escape sequences or unparsed unicode literals.

Regex: `/\\u[0-9a-fA-F]{4}/g`

### 3. errorNotes (BLOCKING)
Reject any model self-correction notes like:
- `(טעות:`
- `(תיקון:`
- `(הערה:`
- `<correction>`
- `[NOTE:`
- `(סליחה...`

### 4. pageCount (BLOCKING)
Count `--- Page N ---` markers. Must equal `context.pageCount`.

### 5. pageSequence (BLOCKING)
- Pages must be sequential: 1, 2, 3, ..., N.
- No duplicates.
- No gaps.

### 6. genderConsistency (MIXED severity — important for MVP)

**MVP rules (v1):**
- **BLOCKING**: frontmatter `childGender` must match context input
- **BLOCKING**: companion gender (from bible) must match across the story (verbs/pronouns about the companion)
- **WARNING** (NOT blocking in v1): Hebrew verb/pronoun gender for the child

**Why child-gender is WARNING in v1:** Hebrew gender detection is heuristic. The story may still contain `{זכר|נקבה}` template alternatives if validator runs before personalization pass, which would false-fail every story. Once we have ~20 real samples and confidence in detection — promote to BLOCKING (v2).

**Heuristic for WARNING level:**
- Suffix patterns: ה / ת / ים / ות / ני
- Flag mismatches with childGender for human review
- Do NOT auto-reject

### 7. companionName (BLOCKING)
- Normalize input companionId to lowercase (e.g., `Bolly_armadillo` → `bolly_armadillo`)
- Load expected canonical name + nameClean from bible
- Body must use canonical name OR nameClean ONLY
- Reject hallucinated alternatives (Bobo, Bolla, etc.) — fuzzy match with Levenshtein distance flag <=2

### 8. forbiddenAnatomy (BLOCKING — per companion ONLY)
- Load `forbiddenAnatomy` list for THIS companion from THIS companion's bible
- **NEVER global rules.** What's forbidden for Bolly may be allowed for another.
- Scan Hebrew prose for any mention
- Example: feathers forbidden for Bolly (he's an armadillo, not a bird)

### 9. forbiddenObjects (BLOCKING — per companion ONLY)
- Load `forbiddenObjects` list for THIS companion from bible
- **NEVER global rules.** Example: stars are forbidden for Bolly (not his world) but legitimate for night companions like Lily.
- Scan Hebrew prose for any mention
- Example for Bolly: flashlight, sword, stars

### 10. forbiddenTone (WARNING — these are pattern-based, false positives possible)
- Load `forbiddenTone` patterns from bible
- For Bolly: bravery-speech detection, medical-explanation detection, inspirational-quote detection
- Use semantic similarity (or simple keyword + structure heuristics)

### 11. killPhrases (BLOCKING)
Static list from `STORY_ENGINE_v1.md` PART 0. Examples:
- "באותו רגע הוא הבין"
- "ידע עתה ש"
- "הפחד נעלם"
- "האומץ נמצא ב"
- "הוא הבין ש"
- "חשוב לזכור"
- "לפעמים צריך"
- "האור לחש"
- etc.

Match: case-insensitive, partial-phrase OK.

### 12. hookAppearances (BLOCKING if declared, WARNING if missing)
- Load `context.declared.hook` (now contains: sound, phrase, microAction, object, appearsOnPages)
- For each declared element (sound/phrase/microAction/object) that is non-null:
  - Validate it appears on each page in `appearsOnPages` (string match for phrase/sound/object, semantic for microAction)
- Minimum total occurrences: 2 (any combination of declared elements)
- Maximum per page: 3 of same element (if "טוּמְפּ" appears 8 times on one page — FAIL, fatigue)

### 13. momentPageWindow (BLOCKING)
Direction-specific windows (per latest STORY_ENGINE update):
- bedtime: pages 5-7
- adventure: pages 8-11
- fantasy: pages 12-15

Validate `context.declared.moment.page` is in window AND the body of that page contains physical action (not just internal thought).

### 14. namePersonalization (WARNING)
Direction-specific ranges (per ChatGPT critique):
- bedtime 10p: 3-6 occurrences
- adventure 15p: 5-8
- fantasy 20p: 6-10

Subject-role check: name must be subject of at least 3 verbs.

### 15. companionPresence (WARNING / BLOCKING)
- BLOCKING: companion missing for more than 2 consecutive pages
- BLOCKING: companion not introduced by:
  - bedtime: page 3
  - adventure: page 3
  - fantasy: page 5 (unless premise = searching for companion)
- WARNING: companion appears in less than minimumPresence threshold from bible

### 16. visualVariety (WARNING)
Parse `imageDirection:` lines:
- No more than 3 consecutive pages with same shot type (close/wide/etc.)
- No more than 4 pages starting with "Close shot"
- Each page must specify child position OR companion position (extract from text)

### 17. directTherapyLanguage (WARNING)
Static list:
- להתמודד
- חרדה
- טראומה
- אומץ (in adult-mentor framing — context-sensitive)
- להתגבר
- ללמוד ש
- להאמין בעצמך
- בטוח לגמרי
- הכול בסדר
- "פחד הוא חלק מ..."

These are WARNINGs (not BLOCKING) because edge cases exist. But flag for review.

### 18. repairRegression (BLOCKING — repair mode only)

**v1 (MVP) — simple structural checks:**
- page count unchanged
- no page numbers added or removed
- page order unchanged (1, 2, 3 stays 1, 2, 3)
- each string in `preserveList` still appears verbatim in new version

**v2 (after v1 is green — separate brief):**
- declared moment semantic check (same page, same type, similar physicalAction)
- declared hook appears on same pages (±1 tolerance)
- companion active behavior still present
- residue object still in ending
- ending sentence unchanged (unless in `changeOnly`)

### 19. modeCompliance (BLOCKING — repair mode only)

**v1 (MVP):**
- Only pages in `changeOnly` array may differ from `previousVersion`
  - Diff check: any character difference on a page NOT in changeOnly = FAIL
- All `preserveList` strings still present in new version
- Page count and page numbering unchanged

**v2 (after v1):**
- No new plot elements (semantic check)
- No new proper nouns
- No new objects introduced
- Structural beat order preserved

---

## Test Suite Requirements

The validator library must have a test suite that:

1. **Passes** on 5 hand-crafted GOOD samples (one per direction, plus 2 variations).
2. **Catches** every BLOCKING issue in 9 BROKEN samples (each broken in a specific way).
3. **Doesn't false-positive** on the GOOD samples.

**CRITICAL — GOOD samples must include:**
- Hebrew prose in pages text (the real story content)
- **English imageDirection lines** (this is by design, must not fail foreignChars)
- **English frontmatter** (`companionId: bolly_armadillo`, `direction: bedtime`, etc.)
- Valid declared.hook with non-trivial sound/phrase
- Valid declared.moment with physicalAction
- Realistic page count (10/15/20)

If a validator rejects a GOOD sample because of legitimate English in imageDirection or frontmatter — the validator is **broken**, not the sample.

The PR is rejected if:
- Any GOOD sample fails any BLOCKING validator
- Any BROKEN sample passes (false-negative on a known bug)
- Parser doesn't correctly separate frontmatter / imageDirection / Hebrew prose

---

## Implementation Order

Build in this exact sequence (each must work before moving on):

1. **Parser** (`parseStoryMarkdown`) — separates frontmatter / pages[].text / pages[].imageDirection. **This is step 0 — no validator works without it.**
2. `types.ts` + `index.ts` skeleton + first dummy validator
3. `companionId` normalization util (lowercase + fuzzy match)
4. `foreignChars` + `unicodeEscapes` + `errorNotes` (run on Hebrew prose only)
5. `imageDirectionValidator` (run on imageDirection only — separate path)
6. `pageCount` + `pageSequence` (structural)
7. `companionName` + `forbiddenAnatomy` + `forbiddenObjects` (loads bible per-companion)
8. `killPhrases` + `directTherapyLanguage`
9. `genderConsistency` (companion gender BLOCKING; child gender WARNING in v1)
10. `hookAppearances` (full declared shape) + `momentPageWindow` + `namePersonalization`
11. `companionPresence` + `visualVariety`
12. `forbiddenTone` (lowest priority — pattern matching is fuzzy)
13. `repairRegression` v1 + `modeCompliance` v1 (structural only — semantic v2 later)

Each validator: 30-60 minutes of work. Parser: 1-2 hours. Total: 1-2 days of focused work for Cursor.

---

## Acceptance Criteria

```
□ Library exposes a single `validateStory(input)` function
□ Returns ValidationReport with all expected fields
□ All 19 validators implemented
□ Test suite passes (5 good samples, 9 broken samples)
□ No false positives on good samples
□ No false negatives on broken samples
□ Documentation: each validator has a JSDoc comment explaining what it catches
□ Hebrew strings tested for RTL handling (no display garbling in logs)
□ Performance: validation of 20-page story <500ms
```

---

## What This Brief Does NOT Cover

- The generator itself (next brief, after validators are green)
- The repair pass implementation (next brief)
- The Psych Engine integration (separate)
- The companion bible loader (assume `lib/companion-bible.ts` exists or build a stub)

---

## After This Brief Lands

Next brief: `CURSOR_BRIEF_generator-mvp.md`
- 3 companions (Bolly, Kim, Lily — or Anana when she's ready)
- 9 test stories (3×3 matrix)
- LLM call pipeline: Plan → Draft → Validate → Repair (if needed) → Validate again

But only after this brief is fully green.

---

*Sister docs: `STORY_ENGINE_v1.md`, `COMPANION_BIBLE_v1.md`, `PSYCH_ENGINE_v1.md`*
