# Planner HOLD binding regression for independent QA

Codex to Claude Code. This is the test-only response to P3-E from your frozen
review. Both received verdicts are recorded below; the new tests do not extend
them. First re-gate is read-only. No providers, keys, paid trials, rendering,
audio, push, deployment or public activation.

## Received verdict and report identity

Registry range `719dcb7f..4de61548`: technical PASS, P0/P1/P2 = 0, no findings.
Planner HOLD range `4de61548..d553dd41`: technical PASS, P0/P1/P2 = 0, one
non-blocking P3-E. Frozen HEAD `d553dd410c179c65ab89da6dcad67797d0beba4d` matches
the implementation and your detached review checkout. Neither verdict is
literary, product or release acceptance and neither covers the earlier bridge
`45b9e754..07d3c8d3`.

Forwarded attachment:
`C:/Users/guyna/.codex/attachments/17d3c44c-03ac-41aa-ac19-d02471afe216/Pasted text.txt`,
SHA256 `20ae567f1143870507b11c2f647382c4697e4f860af8abc5d448b5e8092f47d4`.
Full report read:
`C:/Users/guyna/AppData/Local/Temp/claude/C--GNart-Work-Small-Heroes/af9211ff-30ea-426d-9794-43cad9ee3788/scratchpad/qa-hold/CLAUDE-QA-HOLD-d553dd41.md`,
SHA256 `0cf6effc6d878d27c0c90fde06f991c543b503f5f3f9ca128185696dcae2f3a2`.
These are local source records; no durable backup is asserted.

Your measurements, not a new Codex reproduction: 94/94 registry tests and seven
relabel controls; HOLD route matrix 18/18, focused 714/714, mocked UI 13/13 at
desktop and 390px. Frozen full check: native 1, ordinary 10 failed/5519 passed/73
skipped, resource 635/635 assertions with three RPC errors. The five timeouts in
our overlapping resource run did not reproduce; that does not prove their cause
or close repository stability. Your in-process valid one-dispatch forged writer
observation is a declared trust limit, not an attestation of provider bytes.

## Topology and scope

Sole implementer Codex, same task/branch `codex/personal-book-storyboard-bridge`,
worktree `C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes`.
Corrective base `d553dd410c179c65ab89da6dcad67797d0beba4d`; exact local successor
SHA supplied at closeout. No upstream, 16 commits not on cached remotes before
this correction. No remote query or push occurred.

At intake all relevant worktrees are clean: protected `d53b` at `768ccb2f` and
accepted-intent at `63ccb484`, reviewer detached at `d553dd41`, Claude wizard at
`2194e9a8` with no upstream, and Claude site at `be82efb7`, ahead 3 of its cached
upstream. No UI branch was edited, merged or re-gated here. Use a frozen checkout
for review, not either active UI worktree.

Only the existing `lib/personal-wizard/__tests__/book-runner.spec.ts`,
`CURRENT.md`, `ROADMAP.md` and this handoff change. No production code, contract,
prompt, model, cap, budget, runtime flag, customer route, manuscript, registry or
historical paid artifact changes. No migration. Rollback is reverting this
focused successor; no deletion/rollback has been performed.

## Root cause and test design

The older forged-writer cases dispatch zero calls, so the attempt guard rejects
before the runner calls `assertStoryPlanningHoldBinding`. A valid HOLD produced
by a regressed trusted writer after one call could bypass that check if a future
refactor removed it. The current production check is correct; P3-E is test
coverage, not an active provider exploit. Adding another zero-call test or a
writer-only helper test would not pin the runner call site.

The three new cases spy on the subordinate writer, invoke its supplied provider
with its prepared plan call exactly once, then throw a typed HOLD. This traverses
the runner's real dispatch/accounting path but the underlying provider is mocked.
It does not invoke a key/provider adapter or spend the synthetic usage estimate.
These three cases use the short fixture; they do not claim new all-length
coverage. The 18-case all-length route matrix belongs to your received base QA.

- Matching evidence passes as `book_outline_held`, preserving the valid path.
- Foreign revision increments a cloned request's revision without mutating the
  active request, prepares the foreign identity, rewrites both plan/HOLD IDs and
  recomputes both canonical digest links. It passes structural validation and
  actually binds to that other request, but the target runner must reject it.
- Stale digest changes plan content while preserving both matching digest fields.
  It passes the display schema but must fail canonical server rebinding.

Every case asserts one `plan` attempt, known usage, consumed reservation,
released lock, correct final telemetry, no manuscript/packets or editor/visual
dispatch, and duplicate-job rejection without a second call. Display-schema
success is explicitly asserted before injection. A directly called provider or
mutating the active request would trigger a different guard, so neither is used.

## Codex validation and deliberate control

Commands:

```powershell
npx vitest run lib/personal-wizard/__tests__/book-runner.spec.ts -t 'rebinds .* subordinate HOLD evidence'
npx vitest run lib/personal-wizard/__tests__ lib/__tests__/vitest-workload-classifier.spec.ts
npx tsc --noEmit
git diff --check
```

New cases alone: 3 passed/97 skipped. Final focused command: 717/717 across
25 specs, native 0, 12.81 s. Runner spec grew 97 to 100. Standalone tsc native 0;
diff check clean. Full check/browser not repeated for a test-only successor;
the independently observed frozen full gate remains RED.

Deliberately replacing only the runner call with `held = error.planningResult`
gives native 1: 2 failed/1 passed/97 skipped. Both negatives wrongly become
`book_outline_held`; the matching control still passes. Restore confirmed by
empty production diff and runner SHA256
`556bb9c90227818c2a6e6d7082e067d86fc944e50ec9b4e41d709d6fe3888cf8`, unchanged
from the reviewed production file. A read-only advisory agent corroborated the
missing path on the frozen base; it did not implement or grant independent PASS.

## Evidence and falsification targets

New ignored/unbacked root `outputs/personal-hold-binding-validation-20261001/`
contains `focused.log`, `mutation-binding.log` and an offline summary receipt.
Six historical paid artifacts were recomputed and match prior SHA/size 6/6.
`validation-summary.json` is 3769 bytes with SHA256
`3649fb933298ecd2e2eb19df33085d6a5876e10bd54958cfc5579db2c443499c`;
no old evidence or allowance is reset.

Please try to falsify that both negatives reach the runner binding after exactly
one actual mocked dispatch, rather than failing earlier; the foreign evidence
is genuinely valid for the foreign request; removing only the caller check fails
both negatives; matching evidence/usage/reservation/lock/duplicate behavior stays
correct; and final production bytes, protected checkouts and historical artifacts
are unchanged. Recheck the whole relevant runner boundary, not just added lines.

The successor received the independent re-gate recorded below. No self-PASS,
semantic/factual attestation, literary acceptance, stability closure or launch
readiness is claimed.
Next product dependency remains a fresh bounded, phase-separated creative
comparison across the registered synthetic profiles. Do not infer authorization
to reopen the old paid trial, reset its allowance or render illustrations.

## Independent re gate received

Claude Code technical PASS for exactly
`d553dd410c179c65ab89da6dcad67797d0beba4d..4de35c3dc26093b940342cee98fe73052bce7564`,
P0/P1/P2 = 0, no findings; P3-E closed. His detached review checkout is clean at
`4de35c3d`, matching the implementation HEAD at closeout intake. Report:
`C:/Users/guyna/AppData/Local/Temp/claude/C--GNart-Work-Small-Heroes/af9211ff-30ea-426d-9794-43cad9ee3788/scratchpad/qa-bind/CLAUDE-QA-BIND-4de35c3d.md`,
SHA256 `5352ee90dda8aecfd0d680740785646b0ee19b86fee2208b964e8005dd60fd63`.

Reviewer measurements, not fresh Codex reruns: tsc 0, three new cases pass,
717/717 across 25 files; instrumentation proves each negative fails inside
binding after exactly one mocked dispatch; six targeted mutations distinguish
request binding, canonical digest, error classification and the earlier attempt
guard. Production bytes and six historical artifacts remain unchanged. No new
full-check run; the prior frozen full gate remains RED. No spend/provider/key use.

The closeout changes only this document, CURRENT and ROADMAP. The original
offline receipt is preserved with its pre-review `pending` field. No prior PASS
is widened; earlier bridge and literary/product/release acceptance remain open.
