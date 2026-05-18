# Cursor Brief — Editorial QA Pass v1

> **Priority:** P0 — gates publishable quality.
> **Owner:** Cursor (implementing)
> **Reviewer:** Claude (architecture) + Guy (acceptance) + ChatGPT (QA)
> **Target:** `lib/story-generator/stages/editorial-qa.ts` + editorial repair stage
> **Sister docs:** `CURSOR_BRIEF_validators.md`, `CURSOR_BRIEF_generator-mvp.md`

---

## למה זה ה-Brief הבא

ה-Engine שלנו עבר 9/9 PASS על Validators v1.3. אבל בדיקה ידנית של 9 הסיפורים גילתה:

- שגיאות עברית סמנטיות שלא נתפסות (`"קרירות בברכה"`, `"צל הדיבור"`)
- ניסוחים מופשטים עד שבירת משמעות (`"קווים עלגי הדמיון"`)
- שם דמות מופיע פעמיים במשפט בלי הצדקה (`"מתגלגל בּוֹלִי טוּמְפּ"`)
- bedtime שמסתיים בבוקר במקום בשינה
- bedtime ארוך שגולש לפנטזיה בלי הצדקה
- imageDirection ארוך/לא תואם לאווירת העמוד

> **PASS טכני ≠ הורה יכול להקריא בנינוחות לילד בן 5.**

Editorial QA הוא השער השני: אחרי שהוויידיטורים אמרו "אין באג", העורך אומר "ראוי לפרסום".

---

## מה נבנה

```
lib/story-generator/stages/editorial-qa.ts        ← New
lib/story-generator/stages/editorial-repair.ts    ← New
lib/story-generator/prompts/editorial-qa-prompt.ts
lib/story-generator/prompts/editorial-repair-prompt.ts
lib/story-generator/types.ts                      ← Add EditorialReport
lib/story-generator/stages/orchestrate.ts         ← Integrate after technical validate
lib/story-generator/__tests__/editorial-qa.spec.ts
```

---

## Pipeline Integration

```
Plan → Draft → AutoFix → ValidateStory(production)
                              ↓
                         technical PASS?
                              ↓ yes
                         deterministicPreScan (no LLM)
                              ↓
                         editorialQA (LLM call, gpt-4o-mini)
                              ↓
                         merge scanner + LLM issues; Zod validate
                              ↓
                         every issue.quote exists in target?
                              ↓ no → status: REVIEW_REQUIRED (don't auto-ship)
                              ↓ yes
                         deriveVerdict(scores, issues)
                              ↓
                  ┌──────────┼──────────┐
                  ↓          ↓          ↓
                READY    NEEDS_REPAIR  REJECT
                  ↓          ↓          ↓
                Ship    Phase 1: deterministic quote replacement
                              ↓
                         re-validate technical + editorial verdict
                              ↓
                         READY now? → Ship (NO LLM cost added)
                              ↓ no
                         Phase 2: LLM patch-merge repair (max 1)
                              ↓
                         diff-ratio > 0.35 per page? → REVIEW_REQUIRED
                              ↓ no
                         re-validate
                              ↓
                         READY? → Ship | else → REVIEW_REQUIRED
                                              REJECT → REJECTED_EDITORIAL
```

**Key principles:**
- Editorial pass runs AFTER technical PASS. Never edit a story with technical BLOCKING.
- Deterministic before LLM — known regressions are caught by code, not API.
- Quote-must-exist — LLM can't hallucinate locations.
- Single LLM repair attempt max — no infinite loops.
- Final status is orchestration-level (READY / REVIEW_REQUIRED / REJECTED_EDITORIAL / FAILED_TECHNICAL).

---

## Status types — Editorial Verdict vs Orchestration Status

**These are TWO different concepts:**

```typescript
// What the Editor says about the story (LLM-derived)
type EditorialVerdict = 'READY' | 'NEEDS_REPAIR' | 'REJECT';

// What the pipeline decides to do with the story (orchestration-derived)
type FinalStoryStatus =
  | 'READY'                 // shipped — passes everything
  | 'FAILED_TECHNICAL'      // technical validators failed irrecoverably
  | 'REVIEW_REQUIRED'       // can't auto-ship, needs human
  | 'REJECTED_EDITORIAL';   // editor said REJECT
```

`REVIEW_REQUIRED` is triggered by:
- Zod schema parse failure on editorial JSON
- LLM returns issue with `quote` not found in story text
- Repair diff-ratio > 0.35 on any page
- Re-validation after repair still NEEDS_REPAIR
- Any unexpected error in the editorial pipeline

`REVIEW_REQUIRED` is not failure — it's "this story might be fine but we can't auto-ship it safely." Surface to operator.

---

## Schema validation (CRITICAL — Zod)

The editorial LLM response MUST be validated with Zod before any downstream use. If parse fails, status = `REVIEW_REQUIRED`. Never trust unvalidated JSON.

```typescript
import { z } from 'zod';

export const EditorialReasonSchema = z.enum([
  'broken_hebrew',
  'semantic_nonsense',
  'read_aloud_stumble',
  'too_abstract_for_age',
  'direction_drift',
  'object_drift',
  'companion_drift',
  'companion_name_repeat',
  'metadata_inconsistency',
  'image_direction_mismatch',
  'wrong_ending',
]);

export const EditorialIssueSchema = z.object({
  page: z.number().int().min(1),
  field: z.enum(['body', 'imageDirection', 'frontmatter']),
  severity: z.enum(['BLOCKING', 'MAJOR', 'MINOR']),
  reason: EditorialReasonSchema,
  quote: z.string().min(1),
  suggestion: z.string().min(1),
  explanation: z.string().min(1),
});

export const EditorialReportSchema = z.object({
  scores: z.object({
    naturalHebrew: z.number().int().min(1).max(5),
    directionFit: z.number().int().min(1).max(5),
    motifConsistency: z.number().int().min(1).max(5),
    continuity: z.number().int().min(1).max(5),
    readAloud: z.number().int().min(1).max(5),
    ageFit: z.number().int().min(1).max(5),
  }),
  issues: z.array(EditorialIssueSchema),
  verdict: z.enum(['READY', 'NEEDS_REPAIR', 'REJECT']),
});

export type EditorialReport = z.infer<typeof EditorialReportSchema>;
```

After Zod parse, add runtime-only fields (NOT part of the LLM response schema):

```typescript
// Runtime-augmented issue type — extra fields populated AFTER Zod parse
type EditorialIssueRuntime = EditorialIssue & {
  _unmatchedQuote?: boolean;
  _source?: 'scanner' | 'llm';
  _repairedDeterministically?: boolean;
  _ambiguousReplacement?: boolean;
};

// Additional validation: every issue.quote must exist verbatim in target field
for (const issue of report.issues as EditorialIssueRuntime[]) {
  const page = parsedStory.pages.find(p => p.pageNumber === issue.page);
  const target = issue.field === 'imageDirection' ? page?.imageDirection :
                 issue.field === 'frontmatter' ? frontmatterText :
                 page?.text;
  if (!target || !target.includes(issue.quote)) {
    // Issue quote doesn't match — LLM hallucinated location
    if (issue.severity !== 'MINOR') {
      // Keep in report but mark unrepairable
      issue._unmatchedQuote = true;
      orchestrationStatus = 'REVIEW_REQUIRED';
    }
  }
}
```

**Critical:** runtime fields (prefixed with `_`) are NEVER part of the Zod schema or LLM response. They're added in code after parse. Keeps the LLM contract strict.

This prevents the editor from inventing problems that don't exist in the text.

---

## Deterministic Editorial Pre-Scan (NEW — before LLM call)

Before calling the editorial LLM, run a **deterministic scanner** for known-bad phrases. Phrases caught by the scanner generate issues directly — no LLM judgment needed.

```typescript
// lib/story-generator/editorial/known-bad-hebrew.ts

export interface KnownBadPhrase {
  phrase: string;
  reason: EditorialReason;
  severity: 'BLOCKING' | 'MAJOR' | 'MINOR';
  suggestion: string;
  explanation: string;
}

export const KNOWN_BAD_PHRASES: KnownBadPhrase[] = [
  {
    phrase: 'קרירות בברכה',
    reason: 'semantic_nonsense',
    severity: 'BLOCKING',
    suggestion: 'הקור בברכיים',
    explanation: 'Singular "ברכה" with "קרירות" is semantically broken; need plural ברכיים',
  },
  {
    phrase: 'צל הדיבור',
    reason: 'semantic_nonsense',
    severity: 'BLOCKING',
    suggestion: 'הצליל האחרון',
    explanation: '"Shadow of speech" has no clear meaning',
  },
  {
    phrase: 'מפנה הקודם',
    reason: 'broken_hebrew',
    severity: 'BLOCKING',
    suggestion: 'מהמקום הקודם',
    explanation: 'Likely typo for מהמקום הקודם',
  },
  {
    phrase: 'משתתרת',
    reason: 'broken_hebrew',
    severity: 'BLOCKING',
    suggestion: 'מסתתרת',
    explanation: 'Likely typo for מסתתרת (hiding) — context in batch v0.2.2 was "ההברה מחליקה סביב האוזן, משתתרת..." → "מסתתרת"',
  },
  {
    phrase: 'מחוש הביטחון',
    reason: 'broken_hebrew',
    severity: 'BLOCKING',
    suggestion: 'תחושת הביטחון',
    explanation: '"מחוש" is not a noun here; likely meant תחושה',
  },
  {
    phrase: 'צורח פיהוק',
    reason: 'broken_hebrew',
    severity: 'BLOCKING',
    suggestion: 'מפהק חרישית',
    explanation: 'Yawn does not shout (צורח); semantic mismatch',
  },
  {
    phrase: 'קטם המדבקה',
    reason: 'broken_hebrew',
    severity: 'BLOCKING',
    suggestion: 'קצה המדבקה',
    explanation: 'Likely typo for קצה',
  },
  {
    phrase: 'נוזפת עין מסתובבת',
    reason: 'broken_hebrew',
    severity: 'MAJOR',
    suggestion: 'נוצצת עין מסתובבת',
    explanation: 'Likely typo for נוצצת',
  },
  // companion_name_repeat patterns are detected dynamically below
];

// Companion-name-repeat detector: any clause containing canonical name twice.
// Splits clauses broadly (not just sentences) — Hebrew prose with companion
// repeated within a comma-clause is also unnatural.
function stripHebrewNiqqud(s: string): string {
  return s.normalize('NFKD').replace(/[֑-ׇ]/g, '');
}

export function detectCompanionRepeats(text: string, canonicalName: string): boolean {
  // Niqqud-insensitive match — text may write בולי where bible says בּוֹלִי
  const normalizedText = stripHebrewNiqqud(text);
  const normalizedName = stripHebrewNiqqud(canonicalName);

  // Split by clause boundaries: sentence-end + comma + colon + semicolon + dash + newline
  const clauses = normalizedText.split(/[.!?,:;\n—-]/);
  for (const clause of clauses) {
    const occurrences = (clause.match(new RegExp(normalizedName, 'g')) ?? []).length;
    if (occurrences >= 2) return true;
  }
  return false;
}
```

**Scanner output:** Issues with `quote`, `suggestion`, `severity`, `reason` populated. Merged with LLM issues; dedupe by `(page, quote, reason)`, keep higher severity.

**Why this matters:** Known regressions can't depend on LLM judgment. The 10 phrases from batch v0.2.2 are caught deterministically — no API call, no flakiness, no cost.

---

## The Editorial QA Stage

### LLM call: `runEditorialQA`

**Input:** the full story markdown + plan + companion bible + direction DNA + child age.

**Prompt structure:**

**System:**
```
You are the Editor for Small Heroes children's stories in Hebrew.
You receive a story that PASSED technical validation. Your job is to score
it on 6 dimensions and flag specific lines that need editorial fixes.

CRITICAL: you are NOT writing or rewriting. You are scoring + flagging.
Output strict JSON.

Hebrew quality matters more than poetic beauty. The story will be read
ALOUD by a parent to a child aged 3-9. Every sentence must be:
- syntactically valid Hebrew (no broken noun-verb pairs)
- semantically meaningful (no "shadow of speech")
- naturally pronounceable (no tongue-twisters)
- emotionally clear (not over-abstracted)

Score each dimension 1-5 (5 = excellent, 1 = critical issue).
Flag every specific line that needs editorial repair.
```

**User:**
```
Companion: {companionId} — canonical name {nameClean}, sound {sound}, object {object}.
Direction: {bedtime|adventure|fantasy} (page count {N}).
Direction DNA: {beats and rules for this direction}
Child age: {age}

Story markdown:
{full story}

Output JSON:
{
  "scores": {
    "naturalHebrew": 1-5,
    "directionFit": 1-5,
    "motifConsistency": 1-5,
    "continuity": 1-5,
    "readAloud": 1-5,
    "ageFit": 1-5
  },
  "issues": [
    {
      "page": <number>,
      "field": "body" | "imageDirection" | "frontmatter",
      "severity": "BLOCKING" | "MAJOR" | "MINOR",
      "reason": "broken_hebrew" | "semantic_nonsense" | "read_aloud_stumble" | "too_abstract_for_age" | "direction_drift" | "object_drift" | "companion_drift" | "companion_name_repeat" | "metadata_inconsistency" | "image_direction_mismatch" | "wrong_ending",
      "quote": "<exact text from the story>",
      "suggestion": "<concrete suggested replacement>",
      "explanation": "<why this is a problem>"
    }
  ],
  "verdict": "READY" | "NEEDS_REPAIR" | "REJECT"
}
```

### Severity tiers (CRITICAL — drives the decision)

**BLOCKING** — story must not ship with this. Examples:
- Made-up word ("משתתרת", "עלגי", "מחוש")
- Semantic nonsense ("צל הדיבור האחרונים", "קרירות בברכה של נועה")
- Companion name repeated unnaturally in same clause ("מתגלגל בּוֹלִי טוּמְפּ")
- bedtime ending in morning instead of sleep
- Wrong companion name (any mutation)

**MAJOR** — degrades quality; usually fix:
- Awkward phrasing that's hard to read aloud
- 3+ consecutive metaphors with no concrete anchor
- imageDirection contradicts page text
- Object that appears once then vanishes
- Hook spelled inconsistently across pages

**MINOR** — note but don't block:
- Slightly poetic but acceptable
- Direction-fitting concern that doesn't break the arc
- Word choice that could be warmer but isn't broken

### Decision matrix (verdict computation)

```typescript
function deriveVerdict(scores, issues): EditorialVerdict {
  const blocking = issues.filter(i => i.severity === 'BLOCKING').length;
  const major = issues.filter(i => i.severity === 'MAJOR').length;
  const values = Object.values(scores);
  const minDimension = Math.min(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  // REJECT — irrecoverable (truly bad, not worth repair)
  if (minDimension <= 1) return 'REJECT';
  if (blocking >= 5) return 'REJECT';
  if (avg < 3.2 && major >= 2) return 'REJECT';

  // NEEDS_REPAIR — fixable
  if (blocking >= 1) return 'NEEDS_REPAIR';
  if (major >= 3) return 'NEEDS_REPAIR';
  if (minDimension <= 2) return 'NEEDS_REPAIR';
  if (avg < 4.0) return 'NEEDS_REPAIR';  // critical: publishable means avg ≥ 4

  // READY — publication-ready
  return 'READY';
}
```

**Key principle:** `READY` means publication-ready. Avg 3.2 is NOT publishable even with 0 BLOCKING. The avg gate prevents "passes by technicality" outputs.

**Minor-only stories with avg ≥ 4 ship as READY.** Don't over-repair small style preferences.

### Score Rubric (6 dimensions)

| Dimension | What it measures | 5 (excellent) | 1 (critical) |
|---|---|---|---|
| **naturalHebrew** | grammar, syntax, gender agreement, real words | reads like literature | broken phrases throughout |
| **directionFit** | bedtime stays calm/home; fantasy roams; adventure has arc | perfect fit | direction-violating (bedtime → sunrise, fantasy → no magic) |
| **motifConsistency** | hook tokens + companion name + signature behavior repeat cleanly | clean motif throughout | hook spelled differently, companion name drifts |
| **continuity** | objects/locations/state persist across pages without contradiction | watertight | flashlight appears p3 then vanishes; bedroom → forest → bedroom unexplained |
| **readAloud** | parent can read at bedtime pace without stumbling | flowing, comfortable | tongue-twisting, abstract, hard to parse |
| **ageFit** | vocabulary + emotional complexity match child age | perfectly tuned | too sophisticated OR too babyish |

(See Decision Matrix above for verdict computation — uses BLOCKING/MAJOR/MINOR severity, not just count.)

---

## The Editorial Repair Stage

### `runEditorialRepair`

**v0.2.2 principle: deterministic before LLM.**

Editorial Repair has TWO phases:

#### Phase 1 — Deterministic Quote Replacement (no LLM cost)

For each issue with `field === 'body'` AND `severity in [BLOCKING, MAJOR]`:
```typescript
const occurrences = countSubstring(page.text, issue.quote);
if (occurrences === 0) {
  // Quote not found — let LLM repair handle it
  continue;
}
if (occurrences === 1 && issue.suggestion) {
  // Unambiguous replacement
  page.text = page.text.replace(issue.quote, issue.suggestion);
  issue._repairedDeterministically = true;
  continue;
}
if (occurrences > 1) {
  // Multiple matches — can't safely choose which. Defer to LLM or REVIEW_REQUIRED.
  issue._ambiguousReplacement = true;
  // Don't replace; LLM Phase 2 will handle with full page context.
}
```

After Phase 1, re-run technical validators. If story now passes editorial verdict logic — ship as READY. **No LLM repair invoked.**

This saves $0.10/story for the common case where the editor's suggestions are clean replacements.

#### Phase 2 — LLM Repair (only for issues Phase 1 didn't fix)

Triggered when:
- Some issues have no exact `quote` match (LLM editor was less precise)
- Some suggestions are paragraph-level rewrites that need craft
- `imageDirection` or `frontmatter` issues

Same patch-merge architecture as technical repair (lib/story-generator/stages/repair.ts).

**Key constraints (HARD):**
- Repair ONLY pages flagged in `issues[]` (BLOCKING + MAJOR — never MINOR-only pages)
- Apply minimum-necessary edit per issue (sentence/span level, not full-page rewrite)
- DO NOT change: page count, page order, title (unless flagged), companion object, motif, location count, emotional arc, ending intent
- DO NOT alter imageDirection unless `field === "imageDirection"` in the issue
- Return JSON with repaired pages only (same shape as technical repair)

**Diff sanity check (CODE-LEVEL, after LLM returns):**
```typescript
// For each repaired page, compute change ratio vs original:
const ratio = levenshteinDistance(repairedText, originalText) / originalText.length;
if (ratio > 0.35) {
  // LLM rewrote too much — likely lost intent
  // → mark as REVIEW_REQUIRED, do NOT auto-ship
  // → log full diff for manual inspection
}
```

This is critical: prevents "creative rewriting" disguised as "minimal edit."

**Prompt:**
```
You are the Editorial Repair for Small Heroes.
You received a list of editorial issues from the Editor. Fix ONLY those issues.

For each issue:
- Locate the EXACT quoted text on the page
- Replace it with the suggested fix (or a very close variant)
- Touch nothing else on that page
- Keep punctuation, line breaks, paragraph structure identical

The diff between your output and the original must be MINIMAL — only the
flagged spans change. Anything else is a regression.

Return JSON: { pages: [{ pageNumber, text, imageDirection }] }
Only pages in the issues list. No frontmatter. No page markers.
```

After repair:
1. Run diff-ratio check per page (auto-reject if any page > 35%)
2. Re-run technical validators
3. Re-run editorial QA (max once total)

**Cap:** `MAX_EDITORIAL_REPAIR_ATTEMPTS = 1`. If still NEEDS_REPAIR after one editorial pass, save as `REVIEW_REQUIRED` and stop. Do not loop.

---

## Specific Detections (from ChatGPT's analysis of batch v0.2.2)

The editorial prompt should specifically detect:

### Broken Hebrew patterns
- Noun-verb gender mismatch
- Semantic mismatches: "קרירות בברכה" (singular "knee" but with "coldness", expected plural)
- Made-up words: "משתתרת", "עלגי", "מחוש"
- Words pasted from wrong context: "צורח פיהוק" (yawning shouts?)

### Direction drift
- **bedtime ending that wakes the child / shifts to morning activity**: BLOCKING
  - "ובבוקר נועה התעוררה ורקדה" → BLOCKING (child is awake + active)
  - "אור ראשון עוד לא הגיע, החדר נשאר שקט" → OK (still asleep)
  - "רמז לבוקר חיכה מעבר לחלון" → MINOR (soft hint, child likely asleep)
- **bedtime with multi-location journey** (without dreamlike return): MAJOR
- **fantasy with no magical element**: MAJOR
- **adventure with no movement / no discovery**: MAJOR
- **Note:** The line between "soft morning hint" and "wakes the child" matters.
  Use the criterion: *is the child described as awake/active at end?*

### Companion name repetition
- companion name appearing twice in same clause: BLOCKING
- companion name + sound in same word without space: BLOCKING ("מתגלגל בּוֹלִי טוּמְפּ")

### Abstract overload
- 3+ consecutive metaphors without a concrete anchor: WARNING
- philosophy-bait phrases ("הקווים עלגי הדמיון") — flag as WARNING

### imageDirection mismatch
- imageDirection describes scene that contradicts the page text: WARNING

---

## Acceptance Criteria

### Technical (Cursor delivers)

```
□ runEditorialQA(story, plan, input) returns EditorialReport JSON with 6 scores
□ Zod schema validates the response; parse failure → REVIEW_REQUIRED status
□ Verdict computed via the explicit decision matrix (avg < 4.0 → NEEDS_REPAIR)
□ Deterministic pre-scan runs BEFORE the LLM call (uses KNOWN_BAD_PHRASES list)
□ Scanner issues + LLM issues merged, deduped by (page, quote, reason)
□ Every issue.quote validated against actual text on page; missing match → no auto-repair
□ Editorial Repair Phase 1: deterministic quote→suggestion replacement (no LLM)
□ Editorial Repair Phase 2: LLM patch-merge ONLY if Phase 1 insufficient
□ runEditorialRepair patches only BLOCKING + MAJOR pages (NEVER MINOR-only)
□ Diff-ratio sanity check enforced (>35% change ratio → REVIEW_REQUIRED)
□ MAX_EDITORIAL_REPAIR_ATTEMPTS = 1 enforced in code
□ Pipeline integration after technical PASS (NOT replacing technical validate)
□ FinalStoryStatus enum: READY / FAILED_TECHNICAL / REVIEW_REQUIRED / REJECTED_EDITORIAL
□ EditorialReport written to story-qa-logs/{run}/editorial-qa.json (Zod-validated)
□ Human-readable summary written to story-qa-logs/{run}/editorial-summary.md
□ Issues with field + severity + reason + quote + suggestion all populated
□ orchestrate.spec.ts updated — mocked editorial QA returns READY for golden samples
□ Deterministic scanner tests (NO live LLM) cover all 10 KNOWN_BAD_PHRASES
□ Performance: editorial QA adds <30s per story
□ Cost: <$0.10 per story average added (gpt-4o-mini for QA, gpt-5-chat-latest for repair)
```

### Regression test suite (deterministic — NO live LLM)

The 10 known bad phrases are caught by the **deterministic pre-scanner**, not the LLM. Tests verify the scanner — no API key needed, fast, repeatable:

```typescript
// __tests__/editorial-prescan.spec.ts
import { runEditorialPrescan } from '../editorial/prescan';
import { KNOWN_BAD_PHRASES } from '../editorial/known-bad-hebrew';

describe('Editorial pre-scanner', () => {
  for (const bad of KNOWN_BAD_PHRASES) {
    it(`catches "${bad.phrase}" with severity ${bad.severity}`, () => {
      const story = injectIntoSamplePage(bad.phrase, /* page= */ 3);
      const issues = runEditorialPrescan(story, /* companionId */ 'bolly_armadillo');
      const match = issues.find(i => i.quote.includes(bad.phrase));
      expect(match).toBeDefined();
      expect(match!.severity).toBe(bad.severity);
      expect(match!.reason).toBe(bad.reason);
      expect(match!.suggestion).toMatch(/^[֐-׿]/);  // Hebrew starts
    });
  }

  it('catches companion name repeated in same clause', () => {
    const story = injectIntoSamplePage(
      'נועה ראתה את בּוֹלִי. בּוֹלִי טוּמְפּ מתגלגל בּוֹלִי שוב.',
      4
    );
    const issues = runEditorialPrescan(story, 'bolly_armadillo');
    expect(issues.some(i => i.reason === 'companion_name_repeat')).toBe(true);
  });
});
```

**Key principle:** known regressions are deterministic — they don't need an LLM. The LLM editor catches NEW patterns. PR rejected if any KNOWN_BAD_PHRASE doesn't trigger an issue from the scanner.

### Manual review (Guy + ChatGPT)

```
□ Re-generate 9 stories with editorial pass enabled
□ Score each manually using the same 6 dimensions
□ Compare: were the broken phrases ChatGPT identified caught?
   - "קרירות בברכה" → caught + suggested fix?
   - "צל הדיבור" → caught?
   - "מתגלגל בּוֹלִי טוּמְפּ" → caught?
   - bedtime → sunrise ending → caught + fixed?
□ Average naturalHebrew score ≥ 4 across 9
□ No story ships at directionFit ≤ 2 (BLOCKING direction violation)
```

---

## Implementation Order (5-7 days)

**Day 1:** Types + EditorialReport schema + LLM call wiring (no logic yet)

**Day 2:** Editorial QA prompt + parsing the JSON response

**Day 3:** Editorial Repair stage (reusing patch-merge from technical repair)

**Day 4:** Pipeline integration in orchestrate.ts (after technical PASS)

**Day 5:** QA log additions (editorial-qa.json + editorial-repair logs)

**Day 6:** Test suite (mock editorial response, integration test)

**Day 7:** First real-batch run with editorial enabled, compare to v0.2.2 batch

---

## Cost & Performance Budget

**Model split (recommended — saves cost):**
- Editorial QA: cheaper model (e.g., gpt-4o-mini or gpt-5-haiku if available)
  - QA is a classification/scoring task; doesn't need the strongest writer
- Editorial Repair: full model (gpt-5-chat-latest)
  - Repair needs to write good Hebrew; pay for quality here

```typescript
const EDITORIAL_QA_MODEL = process.env.EDITORIAL_QA_MODEL ?? 'gpt-4o-mini';
const EDITORIAL_REPAIR_MODEL = process.env.GENERATOR_LLM_MODEL ?? 'gpt-5-chat-latest';
```

**Per-story cost (typical case, no repair needed):**
- Plan: $0.06
- Draft: $0.18
- Auto-fix: $0
- Technical Validate: $0
- **Editorial QA: $0.02** (with cheaper model)
- **Total: $0.26**

**Worst case (1 editorial repair):**
- + Editorial Repair: $0.10
- **Total: $0.36**

**Per-story latency:**
- Editorial QA adds ~10-15s (with cheaper model)
- Editorial Repair adds ~20s
- **Total story time: 60-90s** (acceptable for async generation)

If editorial avg cost > $0.10 per story (sustained):
- Keep the deterministic pre-scan (it's free).
- Use the cheapest acceptable QA model (e.g., gpt-4o-mini, or even gpt-3.5-turbo if Hebrew quality holds).
- Invoke LLM repair ONLY for BLOCKING/MAJOR issues — MINOR issues stay as notes, don't trigger repair.
- For dev runs, editorial QA can be disabled entirely via `EDITORIAL_QA_ENABLED=false`.

All model names configurable:
```typescript
const EDITORIAL_QA_MODEL = process.env.EDITORIAL_QA_MODEL ?? 'gpt-4o-mini';
const EDITORIAL_REPAIR_MODEL = process.env.EDITORIAL_REPAIR_MODEL ?? process.env.GENERATOR_LLM_MODEL ?? 'gpt-5-chat-latest';
const EDITORIAL_QA_ENABLED = process.env.EDITORIAL_QA_ENABLED !== 'false';
```

---

## Human-Readable Summary (required)

In addition to `editorial-qa.json`, write `editorial-summary.md` to the QA log:

```markdown
# Editorial QA Summary — {story_id}

**Verdict:** NEEDS_REPAIR
**Scores:** naturalHebrew=2, directionFit=4, motifConsistency=5, continuity=3, readAloud=2, ageFit=4
**Lowest dimension:** naturalHebrew (2/5)

## Blocking issues (2)
- **Page 3 [body]:** "קרירות בברכה של נועה"
  - reason: semantic_nonsense
  - suggestion: "הקור בברכיים של נועה"
- **Page 8 [body]:** "צל הדיבור האחרונים"
  - reason: semantic_nonsense
  - suggestion: "הצליל האחרון נמוג"

## Major issues (1)
- **Page 11 [body]:** "כמו אבן קטנה שמסתובבת בּוֹלִי"
  - reason: companion_name_repeat
  - suggestion: "כמו אבן קטנה שמתגלגלת בידיים"

## Minor (3 — not blocking)
- ...

## Decision
NEEDS_REPAIR → repair pages [3, 8, 11] only.

## Cost
Editorial QA: $0.018 (gpt-4o-mini)
Editorial Repair: $0.094 (gpt-5-chat-latest)
Total: $0.112
```

This summary lets you scan a batch result in seconds without parsing JSON. Critical for batch-of-9+ runs.

---

## Implementation Notes / Edge Cases

These are surgical clarifications for Cursor — handle these explicitly:

1. **Niqqud normalization for name detection.**
   Stories may write `בולי` even when the bible canonical is `בּוֹלִי`. The companion-repeat
   detector and any name-based check must normalize niqqud on BOTH sides before comparing:
   ```typescript
   const normalize = (s: string) => s.normalize('NFKD').replace(/[֑-ׇ]/g, '');
   ```

2. **Clause splitting goes beyond sentences.**
   Hebrew prose can repeat a companion name within a comma-clause unnaturally
   ("בּוֹלִי הסתכל, בּוֹלִי חייך"). Split clauses on `.!?,:;—-\n`, not just `.!?`.

3. **Multiple-occurrence quote replacement.**
   In deterministic Phase 1 repair: if `issue.quote` appears more than once in the page,
   do NOT blindly replace all. Either:
   - Mark `_ambiguousReplacement = true` and defer to LLM Phase 2 (preferred), OR
   - Mark `REVIEW_REQUIRED` if Phase 2 also can't disambiguate.

4. **Runtime fields are NEVER in Zod / LLM response.**
   `_unmatchedQuote`, `_source`, `_repairedDeterministically`, `_ambiguousReplacement` are
   internal markers added AFTER Zod parse. They keep the LLM contract strict and the
   internal state expressive.

5. **Suggestion accuracy matters.**
   The KNOWN_BAD_PHRASES suggestions feed deterministic Phase 1. A wrong suggestion
   ships broken Hebrew without LLM review. Update suggestions based on actual story
   context (e.g., "משתתרת" → "מסתתרת", not "משוטטת").

6. **Pre-scanner runs on ALL fields.**
   Don't limit scanner to body text. Also scan `imageDirection` (in case LLM forgot)
   and frontmatter values (title, etc.). Each issue must have the correct `field`.

7. **Dedupe merge: scanner + LLM.**
   When merging scanner-generated issues with LLM issues, key on `(page, quote, reason)`.
   If duplicate → keep the higher severity. Tag with `_source: 'scanner' | 'llm' | 'merged'`
   for diagnostic logging.

8. **REVIEW_REQUIRED is not a failure.**
   Don't log it as ERROR. Log as WARN. Surface clearly in `editorial-summary.md`.
   The operator-facing UI (later) will show these as "needs human eyes."

---

## What This Does NOT Cover (out of scope)

- Image generation (separate pipeline)
- Multi-pass rewriting (only one editorial repair allowed per story)
- Cross-story consistency (each story is independent for editorial)
- Style transfer or "make it more poetic" (we're tightening, not loosening)
- User-facing review UI (still CLI-only for MVP)

---

## Notes on Approach

ChatGPT's deep insight is correct: **PASS ≠ publishable**. But we shouldn't try to encode 30 specific Hebrew rules as code — that's brittle and incomplete. Instead, use a high-quality LLM (GPT-5.x chat-latest, same as draft) to do the editor's job.

The validators v1.3 are still our floor. Editorial QA is our ceiling. Both are needed.

**The 6-dimension rubric matters more than the issue list.** A story with avg score 4.5 and 1 MAJOR is publishable. A story with avg 3.0 and 0 BLOCKING is not. The score IS the editorial judgment.

---

## After This Brief Lands

Next steps:
1. Manual review of editorial output on 9 stories
2. Tune the rubric thresholds if too strict/loose
3. Mine recurring issue types → add to forbidden patterns
4. Decide: do we now have Gold Story candidates?
5. Choose 3 Gold Stories per direction → annotate → feed back as few-shot

---

*Sister docs: `STORY_ENGINE_v1.md`, `COMPANION_BIBLE_v1.md`, `CURSOR_BRIEF_validators.md`, `CURSOR_BRIEF_generator-mvp.md`*
