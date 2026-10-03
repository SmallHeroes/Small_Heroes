# Semantic audit regression correction for Claude review

Claude's independent review placed `be1c73fa..83baf064` on technical HOLD: one P2
covering five new deterministic failures, plus five nonblocking P3 observations.
This successor fixes the test regressions without changing the engine or paid
evidence. It also isolates tests for the six previously unpinned guards. Codex
does not award its own independent PASS. New literary planning remains a separate
proposal awaiting Guy's decision.

## Ownership and review range

Codex is the sole writer in
`C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes`, branch
`codex/personal-book-storyboard-bridge`. Base is
`b167786afc9f9d2019214aa3e3f4c746a3465280`. The corrective head is the commit
containing this document; freeze it with `git rev-parse HEAD` before review.
The branch has no upstream. No push, deployment or provider migration is included.

Protected, clean worktrees at intake: d53b `768ccb2f`, accepted-intent `63ccb484`,
personal-site-qa `5fe73b3f`. Read-only advisers worked against immutable b167786a;
they are not the independent Claude Code gate.

## Root cause and scope decision

Codex reproduced Claude's three-spec command: 26 passed, 5 failed, exit1. Claude
independently measured those same specs as 31/31 at be1c73fa. The current audit
fixture was incompatible with the historical engine frozen at `9a1ba1f2`, the
census omitted two new specs, and the model scanner treated an approved diagnostic
model and its CLI package namespace as unapproved runtime model references.

The scoped correction is test-only and covered by the existing authorized semantic
editing milestone and its required QA fix loop. It changes neither product rules
nor runtime admission. Moving or re-pinning the paid diagnostic, making current
audit optional, adding Opus to global runtime authority, and hiding an entire
script from scanning were rejected. There is no spending or credential access.

## Corrective changes

Five spec files change; production, scripts, shared fixture, package/config and
workload-policy bytes remain unchanged.

- `book-companion-trial.spec.ts`: a local explicit five-field pre-audit projection
  is used only for the fixed historical engine. The current fixture still requires
  its audit. A bidirectional boundary test proves current output is refused by
  the historical strict schema, projected output yields archived v2, and current
  compilation rejects that projected output. The historical pin and slots stay.
- `vitest-workload-classifier.spec.ts`: reviewed census becomes 407 total, 387
  ordinary, 20 resource. Both new specs are explicitly ordinary. Execution
  policy, thresholds and partition invariants do not change.
- `anthropic-model-authority.spec.ts`: the experimental model exception is only
  the exact `claude-opus-5-5` plus `scripts/personal-opus-semantic-cohort.cjs` pair.
  Only one exact quoted executable path in that file is treated as transport,
  not as a model ID. Unknown/retired references, other files, different paths,
  duplicate CLI literals and a standalone `claude-code` still fail. Global
  runtime model authority remains unchanged.
- `story-semantic-audit.spec.ts`: isolated applicability, v3/audit coupling,
  persisted exact-quote revalidation after an attacker recomputes the digest,
  and original/revised critic character-binding tests.
- `opus-semantic-cohort.spec.ts`: exact running-budget boundary and four dash
  forms are tested without also inserting an image-direction marker.

## Validation

Standalone `npx tsc --noEmit` exits0. Expanded affected set: **520/520 across
13 specs**, exit0. This includes the original ten-spec set plus all three
omitted affected specs. Initial corrected five-spec run: 77/77. The first type
check exposed unsupported `Object.hasOwn`; the test helper now uses the repository's
supported `Object.prototype.hasOwnProperty.call`, without changing compiler targets.

`npm run check` was rerun after the focused suite, not concurrently with it.
Ordinary: 387 files, 10 failed / 5752 passed / 73 skipped, exit1. The ten failures
are the same missing historical assets identified by Claude, not the five new
regressions. Resource: 20 files, 632/635, three5s timeouts (canonical-pre-live-
readiness, live-execution-request-materialization, live-execution-supervisor),
four `onTaskUpdate` errors, exit1. Tool reports exit1; the supervisor separately
records exit1 for both observed Vitest child phases. No fresh
full baseline was run and resource-timeout causality is not asserted. The gate
remains RED; the correction does not close repository stability.

All six guard mutations were caught in isolated module loads: M5 applicability,
M9 persisted quote recheck, M10 schema version coupling, M12 critic character
binding, M15 slot budget and M19 dash exclusion. Each targeted test fails when its
specific clause is removed; source hashes are unchanged. Initial CJS probes did
not run because Windows preload quoting consumed backslashes; those failed
harness logs are preserved. The corrected forward-slash preload run catches6/6.
No production source edits were used for mutation testing.
Ignored evidence lives in `outputs/personal-semantic-regression-fix-20261003`.
Paid roots and both consumed claims were snapshotted separately before corrections
(272 files); final preservation matches272/272 for SHA, size and mtime.
`preservation.json`, `full-check-summary.json`, `mutation-results-fixed.json`
and per-mutation logs are additive evidence with no verified off-machine backup.

Focused command:

```powershell
npx vitest run lib/personal-wizard/__tests__/story-semantic-audit.spec.ts lib/personal-wizard/__tests__/story-editor.spec.ts lib/personal-wizard/__tests__/story-editor-openai.spec.ts lib/personal-wizard/__tests__/story-planning.spec.ts lib/personal-wizard/__tests__/story-comparison.spec.ts lib/personal-wizard/__tests__/storyboard.spec.ts lib/personal-wizard/__tests__/book-runner.spec.ts lib/personal-wizard/__tests__/book-preview.spec.ts lib/personal-wizard/__tests__/story-writer.spec.ts lib/personal-wizard/__tests__/opus-semantic-cohort.spec.ts lib/personal-wizard/__tests__/book-companion-trial.spec.ts lib/__tests__/vitest-workload-classifier.spec.ts lib/__tests__/anthropic-model-authority.spec.ts
```

## Falsification targets

Claude Code's first pass is read-only on the frozen base-to-head range. Try to
falsify that only tests/docs changed; that pre-audit output cannot enter current
compilation; that the old strict engine and its pin remain intact; that model
exceptions cannot leak into app/backend/other scripts or admit unknown/retired
models; and that each new guard test depends on its own clause, not another
rejection. Verify no paid root, claim, raw receipt or literary verdict was rewritten.
Recheck the real five-stage and HOLD-at1/3/5 frozen-runner paths.

## Remaining limits and next decision

This corrects P2-1 and adds evidence for P3-2; closure belongs to Claude's re-gate.
P3-5's old pending wording is superseded by the actual independent HOLD and failure
attribution. The full gate is not release-green. No story improvement is claimed.

P3-1 is confirmed: relabelling v3 as v2 and removing audit/digest can bypass the
diagnostic self-HOLD through archive compatibility. All results remain runtime
ineligible, but future current visual/render admission must refuse archive-only
capabilities or consult external bound authority. This is required before visual
integration, not silently solved here. Exact quote whitespace remains deliberately
strict (P3-3); changing provenance normalization needs its own decision. OpenAI
strict-mode live audit evidence is still absent (P3-4).

The six books remain unchanged: two reading candidates, three focused holds, one
with caveats. GPT's new feedback and proposed synopsis/backward-causality/editor
diagnosis change are recorded in `PERSONAL_STORY_CAUSAL_PLANNING_DECISION_20261003.md`.
That document authorizes neither implementation nor another paid cohort.

## PowerShell inspection and push

The local correction is committed by Codex before handoff. Inspect first:

```powershell
Set-Location 'C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes'
git status --short --branch
git log -1 --oneline
git diff --stat b167786afc9f9d2019214aa3e3f4c746a3465280..HEAD
git diff --check b167786afc9f9d2019214aa3e3f4c746a3465280..HEAD
git log --oneline HEAD --not --remotes=origin
```

Only if Guy explicitly approves publishing the entire branch history after
checking its previous gate records:

```powershell
git push -u origin codex/personal-book-storyboard-bridge
```

This is not a QA-site deploy command or a recommendation to merge into QA now.
