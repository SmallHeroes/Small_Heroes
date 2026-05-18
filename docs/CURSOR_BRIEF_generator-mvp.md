# Cursor Brief — Story Generator MVP v1

> **Priority:** P0 — depends on Validators v1 being green (✅ confirmed 21/21).
> **Owner:** Cursor (implementing)
> **Reviewer:** Claude (architecture) + Guy (acceptance)
> **Target:** Production-grade story generator at `lib/story-generator/`
> **Sister docs:** `STORY_ENGINE_v1.md`, `COMPANION_BIBLE_v1.md`, `PSYCH_ENGINE_v1.md`, `CURSOR_BRIEF_validators.md`

---

## למה זה ה-MVP

> **The validators are the gate. The generator is the door — but no story walks through without passing the gate.**

הברירות בעולם:
- 108 סיפורי בנק (קיים, יקר לתחזוקה, לא scale-able)
- כתיבה ידנית של ChatGPT לכל הזמנה (יקר, איטי)
- **מנוע + 12 Gold Stories + Validators** (הכיוון שלנו)

ה-MVP הזה מוכיח שהמנוע יכול לייצר סיפור שעובר את ה-validators באמינות. אם זה עובד — אנחנו עוברים מ"בנק" ל"מערכת ייצור".

**Scope:**
- 3 companions: `bolly_armadillo`, `chameleon_koko`, `bat_lily`
- 3 directions: bedtime / adventure / fantasy
- 9 test stories (3×3)
- LLM: **GPT-5.x chat-latest דרך /v1/responses endpoint** (חובה — לא /v1/chat/completions)

---

## File Structure

```
lib/story-generator/
├── index.ts                       # main: generateStory(input)
├── types.ts                       # GenerateInput, GenerateOutput, Plan, etc.
├── llm.ts                         # GPT-5.x client (Responses API)
├── stages/
│   ├── plan.ts                    # Stage A: LLM call → Plan
│   ├── validatePlan.ts            # Stage B: structural plan validation
│   ├── draft.ts                   # Stage C: LLM call → story markdown
│   ├── repair.ts                  # Stage E: REPAIR mode call
│   └── orchestrate.ts             # Stage F: full pipeline with retries
├── prompts/
│   ├── plan-prompt.ts             # System + user prompt for planning
│   ├── draft-prompt.ts            # System + user prompt for drafting
│   ├── repair-prompt.ts           # System + user prompt for repair
│   └── shared-rules.ts            # Kid-First rules + Kill Phrases (loaded into all prompts)
├── data/
│   └── direction-dna.ts           # 10/15/20 page beat maps per direction
├── qa-logger.ts                   # Writes story-qa-logs/{timestamp}_{id}/
└── __tests__/
    ├── orchestrate.spec.ts        # E2E test: 9 stories, all pass validators
    └── plan.spec.ts               # Plan validation tests

scripts/
└── generate-test-batch.mjs        # CLI: generates the 9 test stories + saves logs
```

---

## LLM Call Count (clarification)

- **Success path: 2 LLM calls** (Plan + Draft)
- **With 1 repair: 3 calls** (Plan + Draft + Repair)
- **With 2 repairs: 4 calls** (Plan + Draft + Repair × 2)
- **Plan retry (if validatePlan fails once): +1 call**
- **No critic/reviewer call in MVP** — adding one would push to 3+ in success path. Defer to v1.1 if needed.

---

## Pipeline (9 Stages)

### Input

```typescript
interface GenerateInput {
  companionId: 'bolly_armadillo' | 'chameleon_koko' | 'bat_lily';  // MVP scope
  direction: 'bedtime' | 'adventure' | 'fantasy';
  pageCount: 10 | 15 | 20;     // derived from direction
  childName: string;
  childGender: 'boy' | 'girl';
  childAge: number;            // 3-9

  // From Psych Engine (or simplified for MVP):
  prescription: {
    emotionalSituation: string;       // 1 sentence
    physicalMechanicSuggestion: string;  // see PART 3 of STORY_ENGINE
    tabooDirectWords: string[];
    narrativeConstraint: string;
  };
}

interface GenerateOutput {
  storyMarkdown: string;
  plan: Plan;
  validationReport: ValidationReport;  // final, post-repair
  repairAttempts: number;
  fallbackUsed: boolean;
  costUsd: number;                     // sum of all LLM calls
  qaLogPath: string;                   // where the log was written
}
```

### Stage A — Plan (1st LLM call)

**Goal:** Before any prose is written, the LLM commits to a structured plan.

**System prompt** (excerpt):
```
You are the Planner for Small Heroes story generation.
Your job is NOT to write prose. Your job is to commit to a structured plan.

Output a JSON object with these REQUIRED fields:
- beatMap: array of {pageNumber, location, childAction, companionAction, emotionalRead, wordCountTarget}
- momentContract: {page, type, setup, pause, physicalAction, companionSignature, childBodyResponse, echo, residue}
- hookContract: {sound?, phrase?, microAction?, object?, appearsOnPages: number[]}
- preserveListSeeds: array of strings that REPAIR mode must protect later
- visualPacingMap: {quietPages: number[], activePages: number[], heartPage: number}

Constraints:
- Follow Direction DNA exactly (10/15/20 pages with specific beat positions)
- Moment must be in declared window: bedtime 5-7, adventure 8-11, fantasy 12-15
- Hook must appear on at least 2 pages
- Companion must appear by page 3 (bedtime/adventure) or page 5 (fantasy)
- DO NOT write any Hebrew story content yet.
```

**User message:**
- Companion Bible card (loaded)
- Direction DNA card (only for the chosen direction)
- Prescription (from input)
- Age tier guidance

**Output:** JSON. NOT a story.

### Stage B — Validate Plan (code-level)

Before sending Stage C, validate the plan structurally:

```typescript
function validatePlan(plan: Plan, input: GenerateInput): PlanValidationResult {
  // Must have all required fields
  if (!plan.momentContract?.page) return { ok: false, reason: 'momentContract.page missing' };
  if (!plan.hookContract?.appearsOnPages?.length) return { ok: false, reason: 'hookContract.appearsOnPages empty' };
  if (plan.beatMap.length !== input.pageCount) return { ok: false, reason: `beatMap length ${plan.beatMap.length} ≠ pageCount ${input.pageCount}` };

  // Moment in correct window for direction
  const window = MOMENT_WINDOWS[input.direction];  // bedtime [5,7], etc.
  if (plan.momentContract.page < window[0] || plan.momentContract.page > window[1]) {
    return { ok: false, reason: `moment page ${plan.momentContract.page} outside window ${window}` };
  }

  // Hook appears on at least 2 pages
  if (plan.hookContract.appearsOnPages.length < 2) {
    return { ok: false, reason: 'hook must appear on ≥2 pages' };
  }

  // preserveListSeeds is non-empty
  if (!plan.preserveListSeeds?.length) {
    return { ok: false, reason: 'preserveListSeeds must be populated' };
  }

  return { ok: true };
}
```

**If invalid:** retry Stage A once with feedback. If still invalid — fail fast, don't draft.

#### Plan Quality Warnings (non-blocking)

In addition to structural validation, `validatePlan` returns **non-blocking warnings** that are written to the QA log but don't stop generation. These help us identify weak plans before they become weak stories:

```typescript
interface PlanQualityWarning {
  type:
    | 'companion_action_generic'   // "the companion sits" / "watches" — too passive
    | 'child_action_passive'       // 4+ pages with non-action child verbs
    | 'pacing_flat'                // all pages similar wordCountTarget
    | 'location_repetition'        // same location 4+ consecutive pages
    | 'escalation_missing'         // no rising emotional arc detected
    | 'hook_weak';                 // hook is generic ("hi" / "again")
  detail: string;
  affectedPages?: number[];
}
```

These warnings go into `qa-log/plan.json` for human review. Track frequency — if a warning type fires on 50%+ of generated stories, that's a prompt-engineering signal.

**In MVP: log only. In v1.1: use as input for repair-or-replan decision.**

### Stage C — Draft (2nd LLM call — primary success path ends here)

**System prompt** (excerpt):
```
You are the Drafter for Small Heroes.
You have been given a Plan. Your job is to write the Hebrew story EXACTLY according to it.

RULES (in order of importance):
1. Body Before Meaning — every emotional shift first appears in body/sensory/object.
2. Companion Swap Test — the story must REQUIRE this companion, not just feature them.
3. No Kill Phrases (list provided).
4. No direct therapy language.
5. Hook from hookContract MUST appear on all declared pages. Additional natural appearances are allowed if they fit organically, but must not become repetitive (validator catches both underuse and overuse — see `hookAppearances` in validators).
6. Moment from momentContract must occur on declared page with physical action.
7. Hebrew only in body text. English in imageDirection lines.

Output format:
---
title: "..."
companionId: ...
direction: ...
childGender: ...
pages: N
---

--- Page 1 ---
[Hebrew prose]

imageDirection: [English shot direction]

--- Page 2 ---
...
```

**User message:**
- The full Plan from Stage A
- Companion Bible card
- Age tier card (word counts per page)
- Kill Phrases list (from Story Engine PART 0)
- Few-shot example: one Gold Story matching the direction (when available)

**Output:** Full story markdown.

### Stage D — Validate Story (all 20 validators)

Run `validateStory()` from `lib/story-validators/` with:
- `mode: 'production'`
- `context.declared` = plan.momentContract + plan.hookContract

**If verdict === 'PASS':** ship.
**If verdict === 'FAIL':** go to Stage E (repair).

### Stage E — Repair (only if Stage D failed — up to 2 attempts = up to 4 total calls)

**Critical: This is the stage that prevents the regressions we saw with Bolly's fantasy getting deleted.**

```typescript
async function repair(
  previousStory: string,
  validationReport: ValidationReport,
  plan: Plan,
  attempt: number
): Promise<string> {
  // Build preserveList from plan + previous story
  const preserveList = [
    `Moment on page ${plan.momentContract.page}: ${plan.momentContract.physicalAction}`,
    ...plan.hookContract.appearsOnPages.map(p =>
      `Hook on page ${p}: ${plan.hookContract.sound ?? plan.hookContract.phrase}`
    ),
    `Residue: ${plan.momentContract.residue}`,
    `Companion signature: ${plan.momentContract.companionSignature}`,
    ...plan.preserveListSeeds,
  ];

  // changeOnly = pages that have BLOCKING findings
  const failedPages = new Set(
    validationReport.findings
      .filter(f => f.severity === 'BLOCKING' && f.page)
      .map(f => f.page!)
  );
  const changeOnly = Array.from(failedPages);

  // System prompt makes REPAIR MODE explicit
  const systemPrompt = `
You are in REPAIR MODE.

ABSOLUTE RULES:
- DO NOT rewrite pages not in changeOnly.
- DO NOT improve style.
- DO NOT add or remove plot elements.
- DO NOT change page count or order.
- DO NOT modify the ending unless it's in changeOnly.
- ONLY fix the specific blockers listed.

You will receive:
- The previous story
- A preserveList (things that MUST remain)
- A changeOnly list (pages allowed to differ)
- A failureList (the specific blockers to fix)

Return: full story markdown with ONLY the failed pages changed.
`;

  // ... LLM call

  return repairedStory;
}
```

### Stage F — Orchestrate (full pipeline)

```typescript
async function generateStory(input: GenerateInput): Promise<GenerateOutput> {
  const log = startQALog(input);

  // Stage A + B
  let plan = await runPlan(input);
  log.recordPlan(plan);
  const planValid = validatePlan(plan, input);
  if (!planValid.ok) {
    // Retry once with feedback
    plan = await runPlan(input, planValid.reason);
    const retry = validatePlan(plan, input);
    if (!retry.ok) {
      log.recordFailure('Plan invalid after retry', retry.reason);
      throw new GeneratorError('PLAN_INVALID', retry.reason);
    }
  }

  // Stage C
  let story = await runDraft(plan, input);
  log.recordDraft(story);

  // Stage D + E (max 2 repair attempts)
  let report = validateStory({
    storyMarkdown: story,
    mode: 'production',
    context: buildValidationContext(plan, input),
  });
  log.recordValidation(1, report);

  let repairAttempts = 0;
  while (report.verdict === 'FAIL' && repairAttempts < 2) {
    repairAttempts++;
    story = await runRepair(story, report, plan, repairAttempts);
    report = validateStory({
      storyMarkdown: story,
      mode: 'repair',
      previousVersion: { storyMarkdown: /* the version before */, preserveList: ..., changeOnly: ... },
      context: buildValidationContext(plan, input),
    });
    log.recordValidation(repairAttempts + 1, report);
  }

  // Stage F: ship or fallback
  if (report.verdict === 'PASS') {
    log.markPassed();
    return { storyMarkdown: story, plan, validationReport: report, repairAttempts, fallbackUsed: false, ... };
  }

  // Fallback to Gold Story (or fail loudly in MVP)
  log.markFallback(report);
  if (FALLBACK_ENABLED) {
    const goldStory = loadGoldStory(input.companionId, input.direction);
    return { storyMarkdown: goldStory, ..., fallbackUsed: true };
  }
  throw new GeneratorError('VALIDATION_FAILED_AFTER_REPAIR', JSON.stringify(report.findings));
}
```

---

## LLM Configuration

### Endpoint (CRITICAL — from project memory)

```typescript
// lib/story-generator/llm.ts

// gpt-5.x REQUIRES /v1/responses, NOT /v1/chat/completions.
// Using chat-completions returns 400 silently — verified in prior debug.

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const MODEL = process.env.GENERATOR_LLM_MODEL ?? 'gpt-5-chat-latest';
```

Reference implementation: check existing `backend/providers/*.ts` for Responses API patterns already in use.

### Cost Budget

| Stage | Tokens (est.) | Cost (gpt-5-chat-latest est.) |
|---|---|---|
| Plan | ~3k in + 1.5k out | ~$0.06 |
| Draft | ~5k in + 4k out | ~$0.18 |
| Repair (×1) | ~6k in + 3k out | ~$0.15 |
| **Total (no repair)** | | **~$0.24** |
| **Total (1 repair)** | | **~$0.39** |
| **Total (2 repairs)** | | **~$0.54** |

Acceptable budget: <$1.00 per successful story.

---

## QA Log Format

Every story (success OR fail) writes a log:

```
story-qa-logs/{YYYY-MM-DD}_{run-id}/
├── input.json                  # GenerateInput
├── plan.json                   # Stage A output (+ planQualityWarnings)
├── plan-validation.json        # Stage B verdict
├── draft.md                    # Stage C output (before any repair)
├── validation-1.json           # Stage D first validation
├── repair-1.md                 # Stage E (if needed) — first repair
├── validation-2.json
├── repair-2.md                 # Second repair (if needed)
├── validation-3.json
├── final-story.md              # the shipped version
├── manual-review.json          # Human review (see schema below)
├── summary.json                # see required fields below
└── notes.md                    # human-readable summary for review
```

### Required `summary.json` fields

```typescript
interface QASummary {
  // Outcome
  finalVerdict: 'PASS' | 'FAIL';
  blockingFindings: Finding[];
  warningFindings: Finding[];
  repairAttempts: 0 | 1 | 2;
  fallbackUsed: boolean;       // always false in MVP

  // Cost + performance
  costUsd: number;
  durationMs: number;
  llmCalls: number;            // 2 for success, up to 4 with repairs

  // Provenance (CRITICAL for reproducibility)
  modelName: string;           // e.g., 'gpt-5-chat-latest'
  modelVersion: string;        // exact version returned by API
  promptVersion: string;       // hash or semver of prompt assembly
  validatorVersion: string;    // hash of lib/story-validators/
  generatorVersion: string;    // hash of lib/story-generator/

  // Plan signals
  planQualityWarnings: PlanQualityWarning[];

  // Timestamp
  timestamp: string;           // ISO 8601
}
```

### Required `manual-review.json` schema

Human review happens AFTER generation. The reviewer (Guy / ChatGPT / both) scores each story:

```typescript
interface ManualReview {
  reviewer: string;                     // 'guy' | 'chatgpt' | 'other'
  reviewedAt: string;                   // ISO 8601

  scores: {
    childWouldAskAgain: 1 | 2 | 3 | 4 | 5;    // the most important metric
    companionIdentity: 1 | 2 | 3 | 4 | 5;     // would Swap Test fail?
    emotionalTruth: 1 | 2 | 3 | 4 | 5;        // feels real, not preachy
    storyFun: 1 | 2 | 3 | 4 | 5;              // is there delight?
    visualPotential: 1 | 2 | 3 | 4 | 5;       // can each page be illustrated?
    hebrewNaturalness: 1 | 2 | 3 | 4 | 5;     // reads like real Hebrew
  };

  overall: 'PASS' | 'WEAK' | 'FAIL';
  notes: string;                        // free text, recommended 50-200 words
}
```

**Scoring guidance:**
- **PASS**: 4+ on at least 4 of 6 dimensions
- **WEAK**: avg 3-4, no dimension below 2
- **FAIL**: any dimension at 1, OR companionIdentity ≤ 2 (Swap Test failed)

---

## Acceptance Criteria

### Technical (Cursor delivers green)

```
□ generateStory(input) function exposed from lib/story-generator/index.ts
□ 9 test stories generated successfully via scripts/generate-test-batch.mjs
□ All 9 stories pass full validateStory() with verdict === 'PASS'
□ Repair attempts ≤ 2 per story on average
□ Cost average < $0.50 per story
□ All QA logs written and parseable (summary.json + manual-review.json scaffolds)
□ E2E test (orchestrate.spec.ts) — runs against mock LLM, validates the orchestration logic
□ FALLBACK_ENABLED = false enforced in code (no silent fallback in MVP)
□ Failure after 2 repairs throws GeneratorError, not silent return
```

### Manual Review (Guy + ChatGPT score after generation)

```
□ ≥ 6/9 stories rated PASS or WEAK+ on overall review
□ Each direction (bedtime/adventure/fantasy) has at least 1 Gold candidate (PASS, all dimensions ≥4)
□ No story rated PASS if companionIdentity score is ≤ 2 (Companion Swap Test failed)
□ Cross-story repetition check: are 3 Bolly stories distinguishable from each other?
□ Hebrew quality spot-check: 2 native speakers confirm naturalness ≥ 3/5
```

**If technical criteria pass but manual review yields <6/9 — DO NOT promote engine to production.** Iterate on prompts. The engine is not ready until BOTH gates are green.

---

## What NOT to Build (Explicit Out-of-Scope)

- 36-companion support (only 3 in MVP)
- 11-category Psych Engine integration (use simplified prescription input)
- Photo analysis integration (separate pipeline)
- Image generation (use existing pipeline after story is ready)
- UI integration (CLI batch generation only for MVP)
- Caching / persistence (each generation is fresh)
- Streaming (return after full generation)
- Multi-model fallback (gpt-5.x only for MVP)
- Semantic regression in repair (structural only — already in validators v1)

---

## Implementation Order

1. **Day 1 (Foundation):**
   - `types.ts` — all types
   - `llm.ts` — Responses API client
   - `data/direction-dna.ts` — beat maps for 10/15/20
   - `qa-logger.ts` — log writer

2. **Day 2 (Plan):**
   - `prompts/plan-prompt.ts` — system + user
   - `stages/plan.ts` — calls LLM
   - `stages/validatePlan.ts` — structural validation
   - Test: 9 plans (3×3) — all validate

3. **Day 3 (Draft):**
   - `prompts/draft-prompt.ts`
   - `stages/draft.ts` — calls LLM, returns markdown
   - Test: 3 drafts — manually inspect quality
   - Iterate on prompt until 3/3 produce valid markdown structure

4. **Day 4 (Repair + Orchestrate):**
   - `prompts/repair-prompt.ts` — explicit REPAIR MODE language
   - `stages/repair.ts` — with preserveList + changeOnly
   - `stages/orchestrate.ts` — full pipeline + max-2-repair
   - Test: deliberately broken draft → verify repair fixes only blockers

5. **Day 5 (E2E):**
   - `scripts/generate-test-batch.mjs` — generates 9 stories
   - Run real LLM
   - Review QA logs
   - Document cost + repair rates

**Total estimate:** 5 working days.

---

## Important Implementation Notes

### 1. CRLF + File Edit caution

Per project memory: the Edit tool has corrupted large CRLF files before (saw it just last session with package.json). When writing/editing files:
- Use python with `newline=''` for large files
- Verify with `wc -c` after each write
- `tail -c 50` to confirm file ends properly

### 2. Prompt assembly architecture

DO NOT send one mega-prompt with all rules. Layer:
- **System**: core principles (Kid-First, Body Before Meaning, Companion Swap Test) — 100-200 tokens
- **Developer**: hard constraints (Kill Phrases, technical format) — 300-500 tokens
- **Context**: assembled per-order (Bible card + Direction DNA + Age Tier + Plan from previous stage)
- **User**: the order

### 3. Hebrew prompting

When sending Hebrew text in prompts, ensure no Unicode escape leakage. Test the prompt output by parsing the response — if you see `ש` instead of `ש`, something's wrong.

### 4. Few-shot examples (when available)

The Gold Stories (`docs/GOLD_STORIES/`) don't exist yet. For MVP, run without few-shot. After the first 9 stories are reviewed and one is approved per direction — copy it to `docs/GOLD_STORIES/{direction}.md` and use as few-shot for v1.1.

### 5. Fallback strategy

For MVP, **don't** fall back to Gold Stories (we don't have them). Instead, on validator failure after 2 repairs: throw `GeneratorError('VALIDATION_FAILED_AFTER_REPAIR', findings)`. Operator handles.

---

## After This Brief Lands Green

Next steps (sequenced):
1. **Manual review** of 9 stories — Guy + ChatGPT score each on subjective quality (1-5)
2. **Identify 3 Gold Stories** (one per direction) — best-of-3 per direction
3. **Annotate Gold Stories** — "why this works" comments per the Story Engine
4. **Integrate Gold Stories as few-shot** — back into Draft prompt
5. **Generate 9 more stories** — measure improvement
6. **Decide:** is this our default engine, or augment-only?

---

## Final Note

> **The validators are the gate. This brief is the door.**
> **Build a door that always opens on what the gate accepts.**

ChatGPT was right that this should be a small MVP, not a full production system. 3 companions, 3 directions, 9 stories. Once it works — we expand. Don't over-engineer.

---

*Sister docs: `STORY_ENGINE_v1.md`, `COMPANION_BIBLE_v1.md`, `PSYCH_ENGINE_v1.md`, `CURSOR_BRIEF_validators.md`*
