# Cursor Punch-list — Voice Reviewer rev-1 → rev-2 alignment

**From:** CTO — verification of the Voice Reviewer implementation.
**Date:** 2026-05-24.
**Reads with:** `docs/CURSOR_BRIEF_voice-reviewer.md` (the approved rev-2 brief).

This is **not a redesign** — it is rev-1 → rev-2 alignment. The implementation
was verified against the approved rev-2 brief. The architecture is correct;
six points were implemented at the rev-1 (pre-tightening) level and must be
brought to rev-2 **before calibration is run**.

## Verified good — do not change

- diagnostic-only architecture is correct
- `finalStatus` untouched by the Voice Reviewer
- no `replacement` field
- no editor-LLM patching
- reroll gated off by default (`VOICE_REVIEWER_BLOCKING`)
- reviewer failure logs `skipped` and does not fail the story
- tsc clean

## Not approved yet — apply all 6 sections before calibration

### 1. Update the prompt to rev-2

`prompts/voice-reviewer-prompt.ts` currently matches rev-1. Add:

- **max 6 findings** — return at most 6; if many lines share one pattern,
  return a single story-scope diagnostic finding rather than many page findings.
- **intentional motifs rule** — do not flag intentional companion motifs (e.g.
  "בפנים חם") unless they become unclear, are repeated as bare fragments, or
  harm readability.
- **confidence rule** — if an issue may matter, include it with a lower
  confidence; if it is merely a stylistic preference, omit it. Do not return
  findings with confidence < 0.45 unless they are story-scope diagnostic.
- **Family F** — `semantic_misuse` includes a real word in the wrong context
  AND an impossible subject/verb pair (all words valid, the sentence still
  wrong).
- **family-fit rule** — if a problem does not fit a listed family, use the
  closest family only if it genuinely applies; otherwise omit the finding.

The exact rev-2 prompt text is in `CURSOR_BRIEF_voice-reviewer.md` §4.1 — match
it verbatim.

### 2. Schema / derived fields

Replace the single `rerollEligible` with two fields:

- `rerollEligibleCandidate`
- `rerollEligibleActive`

`Candidate` may be derived from future policy. `Active` must **always be false
in v1 diagnostic-only.** Future policy should only activate page-scope blocking
findings, preferably with a confidence threshold.

### 3. Story-scope severity

If `scope === "story"` and severity is not `diagnostic`: **normalize to
`diagnostic` and log a warning.** Do NOT reject the whole report or retry
because of that. (Current code rejects it via `validateVoiceFindingShape` —
change that to normalization.)

### 4. Metadata in `voice-review.json`

Add a `meta` block to `VoiceReviewReport`:

- `reviewerVersion`
- `promptVersion`
- `modelName`
- `standardVersion` (or hash)
- `createdAt`

### 5. Fixture schema

Align `.human.json` field names to:

- `expectedFindings`
- `expectedNonFindings`

Not `expected` / `correctNonFindings`.

### 6. Calibration matching

Confirm and/or implement **fuzzy matching, not exact-only** (in
`voice-calibration.ts`):

- match by page + family + quote overlap
- normalize whitespace, nikud, maqaf / gershayim

Exact matching will create false positives / false negatives.

## Do not run calibration until all 6 are fixed

We must calibrate the **approved reviewer**, not the old prompt.

## When done — report back

Report the **exact files changed** and a short checklist confirming each of the
6 sections above. The CTO will run a second verification against rev-2 before
calibration is permitted.
