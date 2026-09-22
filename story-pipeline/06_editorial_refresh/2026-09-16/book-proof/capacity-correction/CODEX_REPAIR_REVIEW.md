# Repair lock counter-check and next QA boundary — 2026-09-22

## Topology, authority and scope

Guy asked Codex to resume after the usage pause. Start notice initially assumed
`f6bdf5f7`, but inspection found clean `a2d30f89af6d1e3ac6c3a2ac1268d49331a8c35a`,
ahead12/behind0 on `codex/r3b1b-semantic-recovery-m1`, worktree
`C:/GNart/Work/sh-r3b1b-semantic-m1`. Reconciled BEFORE editing. Claude authored
`f6bdf5f7..a2d30f89`; Codex reviewed it and did not duplicate or replace it.
Protected d53b at768ccb2f and accepted-intent-wave-2 at63ccb484 were clean/read-only.
This task is the sole writer; no other task launched, no push or render performed.

This milestone adds five regression cases, a read-only saved-input counter-check,
and documentation corrections. ZERO runtime changes. No source, plan, QA receipt,
candidate, image, model, threshold, budget fence or transport edits. No independent
PASS is self-awarded for the inherited Codex planning/sequence implementation.

## Finding and decision

Original omission reproduced from the Git baseline in memory: six exact STYLE_01
blocks absent on each saved Panda page. The current fix restores all six on all13
pages for a short synthetic anatomy correction, using the exact wide/close and
age-aware builders. No finding requiring a runtime correction was found in this
bounded counter-check. This does not prove a repaired image is correct.

The degradation is REAL, not merely theoretical: at eight1800-character corrections,
six saved pages retain full locks, six retain anatomy only, and page12 retains none.
All corrections, effective entity values, direction, prop/location designs and
sequence packets survive. The none-tier prompt is byte-identical to the old compact
builder. It still has the generic preservation paragraph, but NOT the six full locks.
This bounded restoration is not an unconditional anatomy safeguard.

Rejected here: reverting Claude's compatible correction; silently claiming that
ordinary correction length is guaranteed; retuning QA thresholds or launching paid
experiments before the outstanding sequence review. No new product decision is
introduced. Rollback of this milestone affects only tests/evidence/docs.

## Fresh proof

- Focused227/227: planning50, sequence29, owner72, quality28, judge16, preview32.
- Five new tests force all three tiers for BOTH3/4 reference roles; verify unchanged
  serialized authority, packet, prose and ordered/untruncated corrections; reject
  oversized none-tier; verify close framing and two ages; demonstrate transport-only
  CRLF overflow despite raw JS length fitting, and selection of a fitting tier.
- `verify-repair-locks.cjs`: original regression reproduced atf6bdf5f7; current six
  blocks present in the short-correction case on13/13 pages; both reference counts;
  full effective context deep-equal,82 current attribute checks INCLUDING cover
  (79 on body pages); exact full-lock thresholds tested on both sides; all-schema-max
  corrections preserved; largest multipart request31158/32000 including the margin.
  These are saved-plan/synthetic-correction probes, not a judge-length distribution.
- Actual saved page2 review has two defect corrections totaling368 characters
  (maximum single191). Offline assembly with those unchanged correction strings
  retains the full tier and fits. This does not re-QA, rebind or accept the old image.
- Sequence preservation witness:56 historical files SHA/size/mtime unchanged,
  three reader file hashes and two page images unchanged, paid target still absent.
- Corpus witness:18 hash-bound input stories/216 pages,432 gendered page checks.
  Still NOT18 generated/accepted plans, nor accepted-source runtime qualification.
- Both typechecks completed successfully in `npm run check` before Vitest launched.

### Fresh full check: NON-GREEN

Native/tool exit1. Ordinary391 files:5821 passed/73 skipped/0 failed, elapsed210737ms,
exit0. Resource22 files:668 passed/3 failed, elapsed331864ms, exit1. Total6489 passed,
73 skipped,3 failures. The three failures are test_timeout at the unchanged5000ms:

1. `canonical-materialization-input.spec.ts:278`, repeated CLI flag ordering.
2. Same spec:340, opaque credential/boundary sentinels.
3. `live-request-verification.spec.ts:1602`, repeated sanitized CLI rejection.

Fresh selected rerun, ONE worker, no full suite overlapping:2 failed/1 passed/63
skipped, exit1. Cases1 and3 again timed out; case2 passed in4956ms. Thus it is NOT
accurate to call all failures full-load-only. Both repeatedly launch subprocesses,
but the reason for this machine's slower execution was not proved. No untouched-base
counterfactual run was performed, no timeout raised and no stability waiver given.
Both spec files are byte-unchanged sincef6bdf5f7. This milestone's focused test gate
is green; the REPOSITORY gate remains RED. No unrelated runtime fix is smuggled in.

Reproduce the selected rerun:

```powershell
npx.cmd vitest run lib/visual-package/__tests__/canonical-materialization-input.spec.ts lib/visual-package/__tests__/live-request-verification.spec.ts -t 'makes arbitrary CLI flag order|runs the real writer entry with opaque|returns deterministic repeated failure' --maxWorkers=1 --minWorkers=1 --silent
```

The full run was captured via hidden Node/npm Start-Process with separate stdout
and stderr; native ExitCode observed after WaitForExit. No concurrent test suites.
Logs under `outputs/repair-lock-review-validation-20260922/`, raw byte SHA-256:

- check.stdout.log:242229 bytes,
  ce2c16daf075ec7be1815444a94362c8d8dc853a04cac1d7e1ccb9c771ecced5.
- check.stderr.log:198518 bytes,
  fee6cc26ec47293aa144f72bbcef2941ec19d00aeddc008243e8b2682eb565e5.

The isolated rerun was observed in tool output, not captured to a separate log file;
do not infer one. All preservation/input witnesses were rerun after the full check.

## Documentation corrections

The author handoff called its rerun drop audit independent even though Claude wrote
the fix, implied future judge corrections always stay short, and claimed a full
check while CURRENT explicitly denied a fresh Claude run. Those claims are scoped
or withdrawn in that same handoff. A fresh Codex run is separate evidence, not a
reconstruction of a previous unobserved execution.

The older capacity witness's24200/31200 comparisons are NOT raw input contracts.
Actual raw limits remain24000/31000; transport then adds a prefix and normalizes
CRLF under32000. The new witness validates through the actual planner and reports
multipart lengths. `maxRepair*` rows describe the schema-maximum correction case,
not the largest possible prompt over every tier: shorter corrections can retain
more lock text. Every actual dispatch is still size-checked separately.

## Next review: close the existing dependency gap, not another prose-only loop

Claude: first pass READ-ONLY; no credentials, paid calls, renders, edits or push.
Resolve the head carrying THIS file and freeze it. The local regression/doc range
starts at `a2d30f89`; Claude-authored runtime fix remains `f6bdf5f7..a2d30f89` and
was counter-checked by Codex here. Do not claim Claude independence on his own fix.

The still-unreviewed sequence dependency is `4ee9afc1..093d37c0`; mandatory local
whole-book planning is `093d37c0..5e990881`. Capacity findings on
`5e990881..f6bdf5f7` were closed by Claude except the subsequent lock finding.
Review the remaining sequence/planning consumer chain at the frozen final head,
explicitly distinguishing authorship and prior narrow verdicts. Do NOT repeat an
already completed documentation gate as if it qualified the book.

Attack: implicit inside/outside changes, hidden-state carryover, absent/mismatched
source binding, source quotes that do not entail transitions (known limitation),
scene cuts and returning visits, mutable appearance, held/tampered predecessor,
all-page validation before first image, future-beat leakage, actual generation/QA
packet equality, repairs using their own target,8/12/16 page composition variety,
terminal paid-step replay and unchanged production/accepted-source boundaries.
Use `sequence-recovery/QA_HANDOFF.md` and `whole-book-planning/QA_HANDOFF.md` for
the original requirements and limitations; their old moving-HEAD commands must be
pinned to this frozen range. No prior PASS is expanded by this document.

After technical closure: the existing authorized smallest consecutive visual sample
tests the actual same-scene continuity. Schema/string checks cannot establish visual
success. Five completed pages, semantic acceptance, narration, release and customer
production remain unclaimed; original held images stay held and unchanged.

## Copy-ready commands

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
$reviewHead = git rev-parse HEAD
git status --short --branch
git log --oneline a2d30f89..$reviewHead
git diff --check a2d30f89..$reviewHead
npx.cmd vitest run lib/__tests__/local-book-planning.spec.ts lib/__tests__/local-book-sequence.spec.ts lib/owner-book-draft.spec.ts lib/__tests__/local-preview-quality.spec.ts lib/__tests__/local-preview-judge.spec.ts lib/__tests__/local-story-preview.spec.ts --silent
npx.cmd tsc --noEmit
node --import tsx --require ./scripts/shims/register-server-only.cjs story-pipeline/06_editorial_refresh/2026-09-16/book-proof/capacity-correction/verify-repair-locks.cjs
node --import tsx --require ./scripts/shims/register-server-only.cjs story-pipeline/06_editorial_refresh/2026-09-16/book-proof/sequence-recovery/verify.cjs
# Inspection only above. Push ONLY if Guy separately asks for propagation:
# git push origin codex/r3b1b-semantic-recovery-m1
```

Storage: saved inputs and validation logs under ignored outputs/ are local only;
no verified off-machine backup. A push of this report would NOT preserve those
inputs/logs. No credentials accessed; live provider calls0, render calls0, cost$0.
