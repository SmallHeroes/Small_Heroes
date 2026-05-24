# Cursor Brief — Voice Reviewer (Phase C v1)

**Owner:** Cursor (implementing engineer). **Author:** CTO. **Date:** 2026-05-24 (rev 2 — pre-handoff tightening).
**Reads with:** `docs/PHASE_C_SPEC.md`, `lib/story-generator/STORYBOOK_VOICE_STANDARD.md`.
**Status:** implementation-ready. Build **diagnostic-only** first (see section 2).

---

## 0. Context

Recipe-mode ships Hebrew children's stories to paying customers with no human
reviewer. Structure is proven; *voice* is not. The Voice Reviewer is the
centerpiece of Phase C v1 — one multi-axis LLM call that reads a finished
story and reports where its language falls short of a real children's book
(semantic misuse, AI-poetic phrasing, therapeutic prose, read-aloud
awkwardness, weak relationship).

It does **not** rewrite. It detects. Flagged pages are later regenerated from
their own `PageCard` by the existing splice-reroll — never patched by an editor
LLM.

## 1. Scope of this brief

**In scope:** the Voice Reviewer LLM stage, the finding schema, calibration
mode, logging. The full reviewer prompt is in section 4 — written here, do not
re-author it.

**Out of scope:** the deterministic Layer 1 (separate brief); the reroll wiring
is *specified* (section 7) but stays **disabled** until calibration passes.

## 2. Diagnostic-first — the hard rule

v1 ships **diagnostic-only**:
- The Voice Reviewer runs, produces findings, and logs them.
- Findings do **NOT** change `finalStatus`. Nothing blocks. No reroll fires.
- This stays true until the calibration loop (section 6) measures per-axis
  precision and the CTO promotes specific axes to blocking.

Hard rules, permanent:
- **No `replacement` field.** The reviewer never returns corrected text.
- **No editor-LLM patching. No full-story repair.**
- The reviewer only detects; the Author (via splice-reroll) is the only fixer.

## 3. Finding schema (Zod)

New file `lib/story-generator/editorial/voice-schemas.ts`:

```ts
import { z } from 'zod';

export const VoiceFamily = z.enum([
  'therapeutic_abstract',        // Family A
  'body_as_character',           // Family B
  'ai_poetic',                   // Family C
  'emotion_explained',           // Family D
  'motif_overuse',               // Family E
  'semantic_misuse',             // Family F — real word wrong meaning OR
                                 //            impossible subject-verb pair
  'read_aloud_stumble',          // Family G
  'mechanism_over_relationship', // Family H
  'name_overuse',                // Family I — usually story-scope
  'parallel_action_chains',      // Family J — usually story-scope
  'age_mismatch',                // age-fit axis (Standard section 6)
]);

/** Exactly what the LLM returns. */
export const VoiceFindingLLM = z.object({
  page: z.number().int().nullable(),
  scope: z.enum(['page', 'story']),
  axis: z.enum(['voice', 'ai-smell', 'read-aloud', 'relationship', 'age-fit']),
  family: VoiceFamily,
  severity: z.enum(['blocking', 'warning', 'diagnostic']),
  quote: z.string().optional(),      // required when scope === 'page'
  reason: z.string(),
  confidence: z.number().min(0).max(1),
});

/** Final finding = LLM output, normalized, + code-derived reroll fields. */
export const VoiceFinding = VoiceFindingLLM.extend({
  rerollEligibleCandidate: z.boolean(),  // broad set, for analysis/calibration
  rerollEligibleActive: z.boolean(),     // what may actually fire a reroll
});

export const VoiceReviewReport = z.object({
  meta: z.object({
    reviewerVersion: z.string(),   // e.g. 'voice-reviewer-v1'
    promptVersion: z.string(),     // e.g. '2026-05-24'
    modelName: z.string(),
    standardVersion: z.string(),   // STORYBOOK_VOICE_STANDARD.md header rev
    createdAt: z.string(),         // ISO timestamp
  }),
  storyId: z.string(),
  language: z.literal('he'),
  ageTier: z.string(),
  findings: z.array(VoiceFinding),
});
```

### Post-parse processing (code, after the LLM responds)

1. Parse the LLM output array with `VoiceFindingLLM`. Retry once on Zod
   failure (mirror `editorial-qa.ts`).
2. **Normalize story-scope severity.** The prompt says story-scope findings
   are always diagnostic — enforce it in code, do not trust the LLM:
   ```ts
   if (f.scope === 'story' && f.severity !== 'diagnostic') {
     console.warn(`[voice-reviewer] story finding had severity=${f.severity} — normalized to diagnostic`);
     f.severity = 'diagnostic';
   }
   ```
3. **Reject** a `scope: 'page'` finding with no `quote` — retry once, then drop
   that finding with a logged warning.
4. **Derive the two reroll fields** — never ask the LLM for them:
   ```ts
   f.rerollEligibleCandidate = f.scope === 'page' && f.severity !== 'diagnostic';
   f.rerollEligibleActive =
     VOICE_REVIEWER_BLOCKING_ON &&
     f.scope === 'page' && f.severity === 'blocking' && f.confidence >= 0.75;
   ```
   `Candidate` is the broad analysis set. `Active` is what may fire a reroll —
   it is hard-false for all of v1 (the blocking flag is off; see section 7).
5. Attach `meta`, validate the whole `VoiceReviewReport`.

## 4. The Voice Reviewer prompt (final — do not re-author)

Two parts. Instructions in English; the story and examples are Hebrew. Use the
**same model + routing as the Y-lite reviewers** (currently `gpt-5-chat-latest`
via the Responses API — see the OpenAI-Responses routing rule; do not use
chat-completions for gpt-5.x). Low temperature.

### 4.1 System prompt

```
You are the Storybook Voice Reviewer for "Small Heroes" — a system that
produces personalized Hebrew children's books. You read a finished story and
DIAGNOSE where its language falls short of a real, published children's book.

You are a DIAGNOSTIC reviewer. You do exactly three things:
1. Read the story.  2. Identify genuine voice/language problems.
3. Return them as structured findings.

You DO NOT rewrite. You DO NOT suggest replacement text. You DO NOT return
corrected lines. You point at what is wrong and why — nothing else. A separate
part of the system regenerates a flagged page from its original spec.

THE MEASURE — judge every story against one question:
"Would a parent read this aloud to their child at night, after dozens of good
children's books, and not feel it was written by an AI?"

THE FIVE AXES — every finding belongs to exactly one:
- voice        — therapeutic/abstract prose; emotion explained not shown;
                 a body part or abstraction used as the main character; motif
                 overuse; semantic misuse.
- ai-smell     — AI-poetic phrasing; translated-sounding syntax.
- read-aloud   — sentences that stumble in the mouth: clause overload, calque
                 constructions, an over-dense opening line.
- relationship — the companion reads as a calming tool, not a friend; parallel
                 action chains with no real exchange.
- age-fit      — the voice is wrong for the child's age tier.

THE VOICE STANDARD — you are given the Storybook Voice Standard below: a
library of BAD / GOOD / STORYBOOK examples in families (A-J), each with an id.
Anchor every finding to one family id. If a problem does not fit a listed
family, use the closest family only if it genuinely applies — otherwise omit
it. Do not invent issue types.

Family F (semantic misuse) is the subtle one: a sentence where every word is
valid Hebrew but the meaning is wrong. Two shapes — (a) a real word used with
the wrong meaning (e.g. "דוקדק", a real word, where "דוקר" was meant); (b) an
impossible subject-verb pair (e.g. "הצעדים שומעים" — steps cannot hear). A
spell-checker catches neither; you must.

INTENTIONAL MOTIFS — companions have signature motifs by design (Bolly's
"טוּמְפּ" sound; the warmth-inside-his-shell motif "בפנים חם"). Do NOT flag an
intentional motif — unless it becomes unclear, is dropped as a bare unanchored
fragment, or genuinely harms readability.

SCOPE — each finding is one of:
- "page"  — a specific bad line on a specific page. Set `page` to that number,
            `quote` to the EXACT offending text (verbatim, for splice anchoring).
- "story" — a pattern across the whole story (the name overused on most pages;
            the whole story reading as mechanism; pervasive parallel chains).
            Set `page` to null, omit `quote`.
Do not inflate one bad line into a story finding, or collapse a true
whole-story pattern into one page finding.

SEVERITY — your honest judgment:
- "blocking"   — a genuine defect that should not ship.
- "warning"    — a real but mild issue.
- "diagnostic" — a story-level pattern for the recipe/prompt owners; never a
                 per-line defect. Story-scope findings are ALWAYS "diagnostic".
(In this version NO finding blocks the story — all are recorded for
calibration. Still assign severity as your true judgment.)

CONFIDENCE — 0 to 1: how sure you are this is a real defect, not a stylistic
preference. If an issue may genuinely matter, include it with a lower
confidence. If it is merely a stylistic preference, omit it. Do not return a
finding below 0.45 confidence — except a story-scope diagnostic, which may be
lower. Never invent a finding to seem thorough.

LIMIT — return at most 6 findings. Choose the most important. If many lines
share one pattern, return a single story-scope diagnostic finding, not many
page findings.

DISCIPLINE — flag only genuine issues a discerning parent would notice. Do NOT
nitpick acceptable simple prose. A clean story with zero findings is a correct,
welcome result. Over-flagging is a failure mode, as harmful as missing issues.

OUTPUT — return ONLY this JSON object, nothing around it:
{
  "storyId": "<echo>",
  "language": "he",
  "ageTier": "<echo>",
  "findings": [
    {
      "page": <number|null>,
      "scope": "page"|"story",
      "axis": "voice"|"ai-smell"|"read-aloud"|"relationship"|"age-fit",
      "family": "<family id from the Standard>",
      "severity": "blocking"|"warning"|"diagnostic",
      "quote": "<exact text — required for scope=page, omit for scope=story>",
      "reason": "<one sentence: what is wrong + which family>",
      "confidence": <0-1>
    }
  ]
}
```

### 4.2 User prompt (template — `{{...}}` injected at runtime)

```
=== STORYBOOK VOICE STANDARD (he) ===
{{STORYBOOK_VOICE_STANDARD_HE}}

=== AGE VOICE PROFILE — tier {{AGE_TIER}} ===
{{AGE_VOICE_PROFILE}}

=== STORY ===
storyId: {{STORY_ID}}
ageTier: {{AGE_TIER}}

{{STORY_PAGES}}

=== TASK ===
Review the story against the Voice Standard and the Age Voice Profile. Return
the findings JSON exactly as specified. If the story is clean, return
"findings": [].
```

Injection:
- `{{STORYBOOK_VOICE_STANDARD_HE}}` — read `lib/story-generator/STORYBOOK_VOICE_STANDARD.md` at runtime and inject sections 2-5 (principles + the BAD/GOOD library + read-aloud rules). The Standard is the single source of truth — do not copy it into code.
- `{{AGE_VOICE_PROFILE}}` — the matching block from the Standard's section 6.
- `{{STORY_PAGES}}` — every page as `--- Page N ---\n<text>`.

Parse the response with `VoiceFindingLLM`; retry once on Zod failure (mirror
`editorial-qa.ts`). Then derive `rerollEligible` and validate `VoiceFinding`.

## 5. Stage placement & integration

New stage: `lib/story-generator/stages/voice-reviewer.ts` — `runVoiceReviewer(story, { storyId, ageTier, language })` -> `VoiceReviewReport`.

Pipeline position (in `orchestrate-recipe.ts`):

```
Author draft
 -> blueprint / technical validators
 -> splice retry (caps)
 -> recipeContract validators
 -> resilience / book QA (Y-lite)
 -> Voice Reviewer            <-- NEW
 -> [v1: record findings only — does NOT touch finalStatus]
 -> READY / REVIEW_REQUIRED / FAILED
```

v1 wiring:
- Run after Y-lite, before the final status is decided.
- Persist the `VoiceReviewReport` to the QA log dir as `voice-review.json`
  (alongside `editorial-qa.json`).
- **Do not** let findings change `finalStatus`. Gate any verdict effect behind
  a flag `VOICE_REVIEWER_BLOCKING=off` (default off).
- If the Voice Reviewer call fails (timeout, parse fail after retry): log it,
  set `voiceReviewer: 'skipped'` — never fail the story on the reviewer itself
  in v1.

## 6. Calibration mode

Before any axis is promoted to blocking, the reviewer must be measured.

Script: `scripts/calibrate-voice-reviewer.ts`. It calls `runVoiceReviewer()`
**directly on fixture markdown** — it does NOT generate stories and does NOT
call Y-lite or any other pipeline stage.

Corpus: a **vendored fixture set** — copy the 8 story texts (appendix A) into
`lib/story-generator/__tests__/voice-calibration-corpus/` as stable `.md`
fixtures. Do not point calibration at dated `story-qa-logs/` paths — they are
not reproducible.

Each fixture has a sibling `<name>.human.json` — the ground truth, with BOTH
expected findings and expected non-findings:

```json
{
  "expectedFindings": [
    { "page": 6, "family": "ai_poetic", "quoteContains": "החום עובר אל קצה האצבע" }
  ],
  "expectedNonFindings": [
    { "quoteContains": "ובפנים חם",
      "reason": "intentional Bolly warmth motif — must NOT be flagged unless a bare fragment" }
  ]
}
```

`expectedNonFindings` matters as much as `expectedFindings`: it scores the
reviewer for *not* flagging things we know are fine (intentional motifs,
acceptable simple prose). A flagged quote overlapping an `expectedNonFindings`
entry counts as a **false positive**.

For each fixture the script:
1. Runs `runVoiceReviewer()`.
2. Diffs findings vs `expectedFindings` and `expectedNonFindings`.
3. Records matched / false positives / false negatives.

**Matching is fuzzy, not exact.** A finding matches an expected entry when:
the page numbers agree (or both are story-scope) AND `family` agrees AND the
quotes overlap after normalization — strip nikud, maqaf and gershayim, collapse
whitespace, then substring-contains. Exact string matching manufactures false
FP/FN on Hebrew punctuation.

Output `voice-calibration-report.json` + a console summary:

```
=== Voice Reviewer Calibration ===
corpus: 8 stories
per story: <id> — N findings (P page / S story) | matched X/Y | FP a | FN b
per axis:  voice: precision __% recall __%   ai-smell: ...   read-aloud: ...
semantic_misuse keystone: adventure_michal_run1 -> "דוקדק" caught? YES/NO
blocking candidates: axes with precision >= 80% AND false-block rate < 10%
```

The `semantic_misuse` keystone is decisive: the reviewer MUST flag "דוקדק" in
the run-1 fixture. If it misses that, the reviewer is not ready.

## 7. Reroll integration (specified, gated OFF for v1)

Build the wiring but leave it disabled.

- A finding with `rerollEligible: true` (`scope: 'page'` + non-diagnostic) is a
  candidate to feed the existing splice-reroll: regenerate that page from its
  `PageCard` with a constraint note ("avoid <family> phrasing; keep the beat").
- Budget (from PHASE_C_SPEC 6.4): max 2 Phase C reroll rounds, max 3 pages per
  round, max 2 attempts per page; a finding family on 4+ pages -> no reroll ->
  `REVIEW_REQUIRED` + recipe/prompt task.
- `scope: 'story'` findings NEVER reroll — they open a recipe/prompt task.
- All of this is behind `VOICE_REVIEWER_BLOCKING`. With the flag off (v1
  default) the wiring exists and is unit-tested but never executes.

## 8. Logging

`voice-review.json` is the machine record. The console log is the human one:

```
[voice-reviewer] story=bolly_bedtime_noa  3 findings (2 page / 1 story)
  p6  page  WARNING    voice/ai_poetic        conf=0.72  "החום עובר אל קצה האצבע"
  p4  page  WARNING    read-aloud/read_aloud_stumble conf=0.61  "עושה את הכתפיים לעלות"
  --  story DIAGNOSTIC relationship/name_overuse   conf=0.55  (name on 8/10 pages)
[voice-reviewer] v1 diagnostic-only — findings recorded, finalStatus unaffected
```

Every line shows page, scope, severity, axis/family, confidence, and the quote
(or the story-level note). Logs are part of the product, not optional.

## 9. Implementation checklist

1. `editorial/voice-schemas.ts` — the Zod schemas (section 3).
2. `prompts/voice-reviewer-prompt.ts` — build system + user prompts (section 4);
   inject the Standard + age profile + numbered pages.
3. `stages/voice-reviewer.ts` — `runVoiceReviewer()`: call the LLM (Y-lite model
   + routing), parse + retry-once, derive `rerollEligible`, return the report.
4. Wire into `orchestrate-recipe.ts` after Y-lite — record only; write
   `voice-review.json`; console log (section 8).
5. `scripts/calibrate-voice-reviewer.ts` + the vendored corpus (section 6,
   appendix A).
6. Reroll wiring (section 7) behind `VOICE_REVIEWER_BLOCKING` (default off).
7. Unit tests: schema parse/retry; `rerollEligible` derivation; page-scope
   finding without a quote is rejected.

## 10. Definition of done — Voice Reviewer v1

- The stage runs on every recipe-mode story, writes `voice-review.json`, logs
  transparently, and does NOT affect `finalStatus`.
- Calibration script runs over the 8-story corpus and emits the report.
- The `semantic_misuse` keystone passes: "דוקדק" in the run-1 fixture is
  flagged.
- Reroll wiring exists, unit-tested, disabled by flag.
- Hand the calibration report to the CTO — promotion of axes to blocking is a
  separate, data-driven decision, not part of this build.

---

## Appendix A — calibration corpus (8 stories)

Seven sealed/clean stories (measure false-positives) + one known-defect story
(measure recall). Copy each story's text into the fixture dir; author the
`.human.json` from the notes below.

| Fixture | Source | Key human-noted issues (seed `.human.json`) |
|---|---|---|
| fantasy_gold | `gold-candidates/bolly_fantasy_v0.5.5g_gold.md` | faintly-clinical lines ("הגוף עדיין מכווץ") — known, mild |
| adventure_noa | Adventure smoke, נועה | "מתאים את הקצב לקצב" (read-aloud); "הגוף עדיין מכווץ" |
| adventure_michal | Adventure smoke, מיכל (sealed run) | p4 cross-beat "כתפיים" repetition; p11 "מדחום" twice |
| adventure_daniel | Adventure smoke, דניאל (boy) | name overused (~26 in 15p) — story-scope |
| bedtime_noa | Bedtime smoke, נועה | "אי-השקט" (therapeutic); p7 "החום עובר אל קצה האצבע" (ai-poetic) |
| bedtime_michal | Bedtime smoke, מיכל | p4 "עושה את הכתפיים לעלות" (read-aloud calque) |
| bedtime_daniel | Bedtime smoke, דניאל (boy) | p1 dense first sentence (read-aloud) |
| **adventure_michal_run1** | Adventure smoke, מיכל **run 1** (superseded) | **p6 "דוקדק" — semantic misuse. THE recall keystone.** |

"ובפנים חם" recurs across several stories — an intentional Bolly motif; the
reviewer should NOT flag it unless it stands alone as a bare fragment (Family
E). Note this in the relevant `.human.json` files so it is scored as a
correct non-finding.
