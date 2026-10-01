# Selection QA receipt and bounded P3 correction

## Intake / decision / scope

Guy forwarded Claude's independent report, attachment
`C:/Users/guyna/.codex/attachments/60b3eeb9-ff37-44ae-83c5-3a535ddd9ed3/Pasted text.txt`,
SHA256 `385e43cfe6f7323cd47b8f41a18bed543517a0db17f5944c3af08eea246e40d4`.
Received PASS for exactly `6de84b4f..43978d85`: P0/P1/P2 = 0, four non-blocking P3s.
Separate received PASS, no new findings, for `8695d196..6de84b4f`. Neither covers
the earlier bridge, current product quality, release, public activation or push.

Same chat/sole Codex implementation writer, worktree
`C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes`, branch
`codex/personal-book-storyboard-bridge`, corrective base `43978d85b027599c6710ee738c08c01677dbc82f`.
Protected d53b `768ccb2f` and accepted-intent `63ccb484` clean/parity; Claude site
`86ca47e8` clean/ahead 2; detached reviewer `sh-qa-book-10f54930` now clean at
`43978d85` (reconciled, unlike its earlier stale HEAD). Implementation branch has
no upstream. No parallel writer; subagents advise read-only against frozen base.

Observed: current private-seed labels/A/B assignment/synthetic-only guard work,
but existing tests allow their removal. Current literal comparison strips Hebrew
marks/Cf, not CGJ and variation selectors (Mn), so identical text can pass as distinct.
Expected: tests must catch those losses and invisible-only changes must not count.

Implement the smallest correction under existing approved planner/evaluation scope:
add behavioral regression tests using distinct prose and isolated source guards;
remove Default_Ignorable_Code_Point locally in the candidate comparison key. Preserve
stored strings and shared comparableText. No extra stage, schema/cap/budget change.
Also test CLI validation BEFORE filesystem writes, a survivor noted in the report.

Order: new regressions -> base control/guard correction -> deliberate breakages ->
restore -> focused/tsc/full gate -> preservation -> explicit local commit/re-gate.
Rollback: revert this focused corrective commit, never edit paid artifacts.
Stop-check: general fix, local diagnostic only, no money, smallest proof is mocked/
offline actual boundaries. No unresolved product decision for this bounded scope.
No prompt, public/UI, voice, order, image QA, story-bank, model or allowance change.

## Findings deliberately left separate

- P3-1 is REAL: valid planner needs_work becomes story_outline_held in writer,
  then book_story_invalid in full runner, with no draft/selection receipt preserved.
  Parent sees generic 502 rather than editorial hold. A next wizard/evidence
  milestone needs a bounded, privacy-safe HOLD payload and explicit UI semantics;
  do not pass raw provider output or label this malformed data. No fix claimed here.
- P3-3 stability remains open. Claude reports 11 ordinary failures vs our 10;
  extra untouched timeout passed 28/28 in isolation. That supports a timing/load
  hypothesis, not proof of load causality or pre-existing failure origin. Keep the
  full gate RED. No timeout increase or suppressed test/RPC errors.

## Independent evidence boundaries

Claude reports tsc 0 and 412/412 at main range; 11/18 deliberate breakages caught,
remaining safeguards motivated this correction. Previous corrective range reportedly
passed 550/550 across 22 files, hostile-getter actual trial probe, nine of nine
deliberate breakages and six paid-artifact fingerprints. These are RECEIVED results,
not reruns by Codex this turn. The forwarded text names a full report file but does
not provide its accessible path; this record anchors the actual received attachment.
Do not invent raw probe logs, exact unsupplied timeout names or creative acceptance.

## Corrective evidence and adversarial re-gate

Review-only first pass, branch/worktree above. Range begins at full base SHA above
and ends at the sole focused successor containing this document; exact head SHA
supplied with the handoff. Verify parent == base, clean tree and no upstream.
Independent acceptance of the predecessor does not cover this correction.

Changed production surface: ONE local comparison expression + comment in
`lib/personal-wizard/story-planning-contract.ts`. Test additions in planning and
comparison specs; runner spec only renames a misleading test. CURRENT/ROADMAP and
this handoff record received QA and actual correction, not creative acceptance.
No comparison/packager implementation change remains after deliberate probes.

Measured negative controls, native exit 1 for each run:

| Deliberate pre-fix/breakage | Actual targeted failure |
| --- | --- |
| Reviewed normalizer, six new cases | 6 failures, accepted result has no rejection code |
| Packet label omits seed only | 1 failure, corresponding opaque IDs remain equal |
| A/B assignment forced false | 1 failure, public A contains only one of the two distinct texts |
| Entire synthetic registry guard disabled | 6 failures, one typed source each with all supplied slots null |
| CLI mkdir moved ahead of validation | 2 failures, rejected binding/schema inputs leave package directory |

The six Unicode cases are CGJ 034F; text/emoji selectors FE0E/FE0F; supplementary
selector E0100; Mongolian selectors 180B/180F. Original guarded integration tests
also assert one mocked attempt, usage retained, no manuscript and released lock.
An additional control preserves É vs E and stored input verbatim.

No copied hash formula or expected digests in the new behavioral tests. Semantic
packet identities compared across two seeds; public first-draft texts/label
mapping checked across the existing fixed twelve-seed bank. This is a finite
regression guard, NOT statistical balance proof or protection against deliberate
forging. Nullable-slot synthetic declaration is not authentication of a real child.
CLI rejection tests establish no remaining output; they are NOT a filesystem
syscall trace or proof against a deliberately write-and-delete implementation.

All four deliberate mutations restored; `git diff --exit-code` confirms
`story-comparison.ts` and `personal-story-comparison-package.ts` unchanged.
Final focused 14 specs 430/430 =
35+19+32+38+20+39+14+15+18+88+32+13+60+7. `npx tsc --noEmit` native 0.
Full check on frozen code, native 1; both typechecks passed:

- Ordinary: 381 files, 6 failed / 358 passed / 17 skipped; 10 failed / 5444 passed /
  73 skipped tests. Its ten failure names match the earlier recorded final run
  exactly (0 name differences). This is NOT a fresh baseline experiment, proof
  they predate the prior planner implementation or load-causality closure.
- Resource: 20 files, 635/635 tests passed BUT three unhandled onTaskUpdate RPC
  timeouts; phase exit 1, gate failed. Canonical total remains 401 files.

Ignored local output: `outputs/personal-selection-p3-validation-20261001/full-check.log`;
SHA256 `03da6c8edf5f540d5378ca715c19fbca22efb2c7093be2ef3cb6c8d8fc7954d5`.
Not backed up/committed, no provider payload. Paid historical artifacts 6/6 SHA/size
unchanged, see predecessor handoff fingerprints. No historical records rewritten.

### Commands for independent falsification

```powershell
Set-Location 'C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes'
git status --short --branch
git log --oneline -2
git diff --check 43978d85..HEAD
npx tsc --noEmit
npx vitest run lib/personal-wizard/__tests__/story-planning.spec.ts lib/personal-wizard/__tests__/story-comparison.spec.ts lib/personal-wizard/__tests__/book-runner.spec.ts
```

Falsify invisible-only duplicate blocking through real mocked writer boundary;
check accented-letter differences and stored data are preserved. Independently
disable each seed/orientation/source/CLI ordering safeguard and verify the new
test fails for the intended behavioral reason, then restore. Test a non-fixture
source with NO artifacts so downstream request bindings cannot mask failure.
Verify no shared normalizer, prompt, cap, stage, allowance, runtime flag, UI or
historical artifact changes. Confirm valid needs_work still holds with generic
diagnosis, explicitly OPEN, not a claimed correction.

First pass review only: no edits, keys, providers, allowance reset, render, audio,
push or deployment. No self-awarded PASS, release/stability/literary acceptance.

### Guy's inspection / optional later push

No stage/commit reconstruction required; Codex makes the focused local commit.
Inspection is safe. Push ONLY after Guy explicitly authorizes it AND all earlier
branch commit scopes have been reconciled; this review covers only one successor.

```powershell
Set-Location 'C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes'
git status --short --branch
git show --stat --oneline HEAD
git log --oneline codex/personal-book-storyboard-bridge --not --remotes
# Not executed; requires the separate authorization/scope reconciliation above:
# git push -u origin codex/personal-book-storyboard-bridge
```
