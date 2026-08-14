# Story Engine Autonomous Batch Orchestrator — Implementation Evidence

## Scope and topology

- Base: `ea4404a5b2492099c35c90c6da2a14ee6478144f`
- Branch: `codex/story-engine-autonomous-batch-orchestrator`
- Worktree: `C:\Users\guyna\.codex\worktrees\storybatch1\Small_Heroes`
- Product scope: autonomous Architect A/B/C invention, deterministic Selector,
  isolated Writer, diagnostic Editor, bounded revisions and resumable staging.
- Excluded: accepted Dini source changes, story-bank/Wizard activation, render,
  storage/database, QA/Production deployment and push.

## Implementation

The orchestration uses exact model `gpt-5.6-sol` through `/v1/responses` at
Standard tier, with `store:false`, truncation disabled, no retry and no
fallback. Official pricing verified on 2026-08-14 is $5/M uncached input,
$0.50/M cached input, $6.25/M cache write and $30/M output. Reasoning tokens are
included in output usage.

Architect, Selector and Editor use strict JSON Schema plus independent exact-key
runtime validation. Writer and revision outputs remain Markdown stories. Code,
not the Selector, recomputes equal-weight totals across eight editorial axes,
requires at least 60/80, rejects all disqualified options and requires a unique
highest score matching the recommendation.

The Writer sees the winning premise only. Rejected options, their scores and the
post-draft rubric are excluded. Exact frontmatter/page and complete gender-chip
instructions prevent the mechanical failures observed in prior manual runs.
The accepted Dini adventure brief ID is explicitly excluded from the default
wave, leaving 17 commissions.

Each successful output and call receipt is content-addressed. A mutable root
manifest binds HEAD, model, tier, cost ceiling and contract digests. A resume
must reproduce those identities; completed stages are read and hash-checked,
while an unresolved in-flight marker produces terminal HOLD without another
provider request.

## Validation

- `npx vitest run lib/__tests__/story-commission-materializer.spec.ts`:
  **1 file / 21 tests PASS**.
- `npx --no-install tsc --noEmit`: **PASS** after offline `npm ci
  --offline --ignore-scripts` and local `prisma generate`.
- `node --check` for the four new CJS entrypoints: **PASS**.
- `git diff --check`: **PASS**.
- No dependency or lockfile changed.
- Post-gate README activation correction:
  `npx vitest run lib/__tests__/story-pipeline-next-generation-creative-briefs.spec.ts lib/__tests__/story-commission-materializer.spec.ts`:
  **2 files / 29 tests PASS**; deterministic TypeScript and `git diff --check`:
  **PASS**.
- QA correction focused validation using the same two files: **2 files / 30
  tests PASS**; deterministic TypeScript, all four CJS `node --check` commands
  and `git diff --check`: **PASS**. `npm run check` was not rerun.
- The literal `npm run check` ran exactly once and was not retried. TypeScript,
  the changed 21-test suite under ordinary load and the complete 19-file
  resource-intensive phase passed. Ordinary failed eight assertions: the
  established six missing ignored-output fixtures, the pre-existing stale Dini
  measurement assertion and a directly related stale Story Pipeline README
  contract assertion. The README already scoped manual Guy A/B/C selection to
  the historical pilot; its test still required obsolete wording and did not
  bind the new autonomous route. The README and contract test were corrected
  afterward and passed focused validation; the repository gate was
  intentionally not rerun. The remaining seven failures stay a separate
  repository/release HOLD, not a PASS for the whole repository.

## Live pilot v1 — terminal and not reusable

Root:
`outputs/story-autonomous-bunny-pilot-20260814-v1`

The sole Architect request returned an incomplete Responses object after 105.3
seconds. The initial adapter correctly suppressed raw provider material but
incorrectly threw away usage at that boundary. Its manifest therefore shows
zero attested calls/cost and an Architect in-flight marker. This is not proof of
zero billing. The pre-call reservation bounds the unobserved charge at no more
than `$0.12333125` (`$0.123332` rounded upward). Claude independently
reconstructed the exact round-stamped 2,933-byte request at `9df78d62`, matched
its recorded prompt digest and corrected the earlier pre-stamp underestimate.
No options, draft or authority
were persisted. Commit `7e41de2e` adds a sanitized terminal receipt that records
reason, usage and cost for future incomplete Responses.

## Replacement live pilot v2 — exact evidence / HOLD

Root:
`outputs/story-autonomous-bunny-pilot-20260814-v2`

- Model/tier/store: `gpt-5.6-sol` / `default` / `false`
- Logical calls: 4, in order: Architect, Selector, Writer, Editor
- Transport retries / fallback: `0 / false`
- Usage: 6,189 input; 4,482 cache-write; 8,012 output; 4,343 reasoning;
  14,201 total
- Exact cost: `$0.2769075`
- Combined known-plus-conservative pilot ceiling: at most `$0.40023875`
- Architect artifact: `01f2e6ac6854837d936c7caa59c312a961edbf5e1bc6c6c5d20ed3afc230af55`
- Selector artifact: `0524015d1ceed51ffb101f200dee8c30d943723bab320b807f856a1ebb42913a`
- Writer artifact: `6ec6293f3320a72e9e523b0da7c6ee4ff9d24680e4757a90c0a564737c977ea5`
- Editor artifact: `56239a7aa6bc99b1f984bdbb05cdae87e86ec020dc6e90808fe4022eac4245f7`

Selector totals were A 68, B 74 and C 67, all without disqualifiers, so B was
the unique code-confirmed winner. Writer output completed. Editor returned
`revise` with one major `personalization_syntax_invalid` issue on page 4 and one
minor `hebrew_readaloud_issue` spanning pages 3 and 8, but supplied six
strengths. The existing canonical validator permits at most four, so the result
failed closed as `story_editor_review_result_invalid` before any revision call.

The post-pilot correction adds the missing literal Writer envelope,
complete-form chip instruction, exact Editor collection cardinalities and a
Hebrew-only Architect output instruction. It passes offline validation but has
not been exercised live.

## Independent QA first pass and correction

Claude Code reviewed immutable range `ea4404a5..8f378944` read-only and returned
**HOLD** with one MAJOR and six MINOR findings. Codex independently reproduced
the two behavioral findings before editing.

- **MAJOR-1 corrected:** the shared editorial-result validator now requires
  exactly zero `revisionPriorities` when `verdict` is `pass`. A direct validator
  assertion and a complete Architect/Selector/Writer/Editor regression prove a
  priority-bearing pass ends in `story_editor_review_result_invalid`, writes no
  final story and grants no `machine_qualified` state.
- **MINOR-1/2 corrected:** pilot-v1 and combined conservative figures are
  `$0.12333125`/`$0.40023875`, and pilot-v2 contained one minor issue spanning
  pages 3 and 8 rather than two minor issues.
- **MINOR-3/4 corrected:** README identifies the manual-v3 versus autonomous-v4
  authority relationship and names the Selector/Writer contracts; the Selector
  contract now states the actual equal-weight score sum.
- **MINOR-5 corrected:** a terminal call entry can never be read as a completed
  output. Even after a hand-edited resume manifest, it persists only the closed
  `story_batch_terminal_call_not_resumable` code and sends no provider request.
- **MINOR-6 retained as advisory:** the orchestrator follows the existing CJS
  materializer lineage and sits outside `tsconfig.json`. Its
  implementation is covered by focused behavioral tests and `node --check`,
  while `tsc --noEmit` covers the TypeScript callers/tests rather than the CJS
  core itself. Migrating that lineage is broader than this fail-closed QA fix.

No pilot artifact was rewritten or re-priced in place. No credential or
provider call occurred during the correction. Independent closure remains
pending a read-only micro re-gate.

## Authority result and next gate

The implementation and evidence do not grant technical PASS; Claude's first
review returned HOLD and the QA correction awaits micro re-gate. Both pilot
attempts are terminal, no story is
machine-qualified, and the default 17-story wave has not run. Per Guy's explicit
two-failure rule, a third live attempt requires a new decision after this report.
No artifact in either output root may be promoted to the accepted story source,
story bank, Wizard or render pipeline.
