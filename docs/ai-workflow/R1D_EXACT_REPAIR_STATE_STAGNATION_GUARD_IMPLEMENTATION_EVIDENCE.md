# R1D Exact Repair-State Stagnation Guard — Implementation Evidence

**Date:** 2026-08-19
**Owner:** Codex
**Branch:** `codex/r1d-book-surface-typed-hint-compaction-render-unblock`
**Base:** `1bf99d8b870e9ab5cf6f2fd371705c943bc0c6fd`
**Boundary:** offline only; no Fresh, credential, provider, Candidate, Wizard, image or render action.

## Outcome

The compiler now stops before another paid dispatch when a successfully applied repair leaves both:

- the canonical invalid draft byte-equivalent after canonicalization; and
- the complete normalized typed issue census identical, including page-final `causes`.

Raw emission counts, unique-count equality alone, route subsets and issue-only equality are insufficient. The existing positive-regression guard remains separate and runs first. An atomically rejected PageContract output remains governed by its existing one-call closed correction contract and is not misclassified as an applied repair fixed point.

The offline harness exposes `repair_stagnated`. Canonical lifecycle evidence exposes a new sanitized `draft_validation_repair_stagnated` terminal with phase `draft_validation`, class `draft_validation_stagnation`, eligibility `ineligible`, and reason `repair_made_no_complete_issue_progress`. Current receipt/readiness authority advances from v46/v44 to v47/v45; request v42, Candidate v9, policy v17, output budget v6, prompt/schema/model/tier/reasoning/call/retry/fallback authorities remain unchanged. v46/v44 are immutable legacy versions.

## Safety and falsification coverage

- Exact fixed state stops after two total calls and no third provider dispatch.
- Same complete issues with a changed canonical draft continue.
- Same count with changed identity or changed causes continues.
- Route-subset comparisons never trigger stagnation.
- A complete unique-count increase still uses the existing regression terminal.
- PageContract's one bounded incomplete/scope correction remains reachable.
- Receipt persistence reconstructs complete current issues from transition items, rejects truncated evidence, binds exact call/repair/provider counters and exact adjacent issue arrays, and readiness copies the terminal classification.
- The production-backed offline harness records two injected responses, `providerCalls:0`, complete delta `0`, outcome `repair_stagnated`, and no Candidate.

## Validation

- Compiler, harness and lifecycle: **153/153 PASS**.
- Canonical authoring boundary: **169/169 PASS**.
- Terminal diagnostics unit: **24/24 PASS**.
- Reference-domain and S2b focused regression coverage: **63/63 PASS**.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- One literal `npm run check` was run without retry. Resource-intensive phase: **609/609 PASS**. Ordinary phase initially had seven stagnation-expectation fixtures plus five established missing ignored-output fixture failures. The seven change-related failures were corrected and their focused suites pass; the five unrelated baseline failures remain missing local ignored artifacts and were not repaired or masked.

## Explicit exclusions

This milestone does not implement the typed nine-clause prop-constraint authority. That is a separate prompt/schema/version milestone after immutable Claude QA of this guard. No best-of-N, resampling, extra call, increased budget, fallback, retry, story-specific fix, Candidate promotion, Wizard mutation or render behavior is present.

## Independent QA

Claude Code reviewed commit `accfe2f6b3b637d17bcbb38cb627e8b7af02a3b0` read-only over immutable range `1bf99d8b870e9ab5cf6f2fd371705c943bc0c6fd..accfe2f6b3b637d17bcbb38cb627e8b7af02a3b0` and returned **PASS — 0 BLOCKER / 0 MAJOR / 0 MINOR**. It independently confirmed canonical draft-plus-cause-aware issue equality, regression-first ordering, bounded PageContract correction reachability, harness isolation, truthful terminal mapping, receipt/readiness tamper resistance, v47/v45 cutover, and absence of prompt/schema/policy/model/budget/Candidate/Wizard/render drift. Its first pass performed no writes, credential access, network/provider call, Fresh, image or render action.
