# Claude Code: whole-book local sequence recovery

Read-only first pass. No provider, credentials, paid rendering, source approval,
publication, push or changes to historic evidence. Guy requests coherent story-wide
identity and situation continuity after occupants moved outside the Panda station.

## Topology and exact review boundary

Worktree C:/GNart/Work/sh-r3b1b-semantic-m1; branch
codex/r3b1b-semantic-recovery-m1. Sole implementation task is the current Codex task.
Base4ee9afc137c50494c30acd3358eb1f79c5fd33fe; head is the single local commit carrying
this handoff (resolve it and freeze the SHA before review; do not silently widen).
Start was clean/ahead8/behind0. Protected d53b768ccb2f and accepted-intent63ccb484
are read-only and clean. The earlier Claude PASS ends32654edf, not this branch tip.

## Verified problem and implementation

Read DIAGNOSIS.md before interpreting claims. Full-book planning existed, but typed
physical relations did not survive page projection. Both local runners supplied
prior images only to QA, not first-attempt generation. The production contract and
legacy scene-memory already exist and are intentionally not replaced or activated.

- lib/local-book-sequence.ts: whole-book source/plan-bound ledger, complete entity
  state, scene visits, before/after transitions and exact same-page quote checks.
  Fixed appearance unless existing attribute changes are explicitly declared mutable.
- scripts/run-owner-book-draft.ts: optional sequence config, pre-key validation,
  v6 identity, same packet for prompt/judge, reviewed/hash-bound prior same-scene
  image. Repairs retain packet but use their own candidate instead of a fifth ref.
  Without props, sequence still uses selected QA context, never full future plan.
- New focused spec and additive actual-entry tests in owner-book-draft.spec.ts.
- prepare.cjs authors an unaccepted diagnostic sidecar for all12 Panda pages from
  the existing exact source/plan, without editing either. verify.cjs independently
  loads inputs, checks sizes and rehashes historical artifacts. No network dispatch.
- CURRENT/ROADMAP and decision gate record authority, limits and next action.

## Claims to falsify

1. Change a driver's inside relation on page2 without a declared source-linked
   transition. It must reject before credential reads/output binding/provider access.
   Try wrong before-state, unsupported quote, duplicate/no-op/reset/cyclic relations,
   missing/unknown inventory, location drift, scene-id reuse, and appearance changes.
2. Prove that hiding an entity does NOT forget its state or force it onto the page.
   Expression/camera changes should remain allowed. A genuinely declared transition
   must work; this is not blanket freezing.
3. Through the real entry, inspect image reference order and actual prompt/context:
   no prior generation ref at scene cuts, no cover/gaps, no held/tampered/unreviewed
   predecessor. No future full-plan fallback when no prop board is supplied.
4. Targeted edit uses its own failed candidate with the same sequence packet and
   existing repair/input caps. Check replay, budget fences and legacy v2-v5 behavior.
5. The sequence is only local diagnostic data, not accepted-source/runtime authority.
   Deliberately weak source quotes can pass structural binding: this limitation is
   explicitly tested, not disguised as semantic proof. Critique the authored Panda
   staging separately from code correctness. No visual accuracy claim follows.

## Reproduction and evidence

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
git status --short --branch
git log --oneline 4ee9afc137c50494c30acd3358eb1f79c5fd33fe..HEAD
git diff --check 4ee9afc137c50494c30acd3358eb1f79c5fd33fe..HEAD
npx.cmd vitest run lib/__tests__/local-book-sequence.spec.ts lib/owner-book-draft.spec.ts lib/__tests__/local-preview-quality.spec.ts lib/__tests__/local-preview-judge.spec.ts lib/__tests__/local-story-preview.spec.ts --silent
npx.cmd tsc --noEmit
node --import tsx --require ./scripts/shims/register-server-only.cjs story-pipeline/06_editorial_refresh/2026-09-16/book-proof/sequence-recovery/prepare.cjs
node --import tsx --require ./scripts/shims/register-server-only.cjs story-pipeline/06_editorial_refresh/2026-09-16/book-proof/sequence-recovery/verify.cjs
```

Observed: 177/177 = sequence29 + owner72 + quality28 + judge16 + preview32; tsc0.
Preparation0, offline CLI preflight0; no rendered-output root. Witness0:56 snapshot
files match bytes/SHA/mtime, including9 accepted source +6 canonical paid artifacts;
3 current reader file hashes and both page-image hashes unchanged. All12 image prompts fit24000 (max22296),
core QA context max16474; this is not the full wire payload size. The in-memory
synthetic reviews in verify.cjs are only size probes, never receipts or authority.

Final full check returned native0/tool0: both typechecks0; ordinary390files,
5771pass/73skip/0fail,144095ms; resource22files,671pass/0fail,214662ms.
Total6442pass/0fail/73skip. Logs captured separately via hidden Node/npm process,
with native ExitCode observed after WaitForExit. No concurrent test runs. This is
an observed green run, not stability closure, independent PASS or release readiness.
The preceding full run on the pre-final no-props projection correction returned0:
ordinary390 files exit0, resource22 files/671 tests exit0. Do not substitute that
earlier observation for the final-code run. No timeout, threshold or test suppression.
During development, one old callback assertion needed the new sixth argument; a
tamper test initially used non-PNG bytes and correctly hit PNG validation first.
The test now tampers to a valid different PNG and proves hash-bound rejection.

## Local storage, preservation and cost

New ignored roots, local only and no verified off-machine backup:
- outputs/panda-book-sequence-input-20260919: sequence.json, config.json, verification.json.
  sequence SHA285410883545b3ad291fc0183bf32cb59ee2d34645208c02771cbc0d51f9128b.
- outputs/panda-book-sequence-validation-20260919: final full-check stdout/stderr.
  check.stdout.log177657B SHA d4a70666cef6a2bdf6d1712c801ebbc61cd34896341f32e86e2356ff9e363fad.
  check.stderr.log195975B SHA abfb510fa39ad9d9ef25ce499bc4f70faa47b90d31df3bd9bc5419c5ccbfaf7a.

The six prior roots remain listed in five-page-sample/OUTCOME.md and untouched.
The proposed live root panda-book-sequence-unexecuted-20260919 is absent. The
preparation config copies prior fences only for offline loading, not an aggregate
budget reset. Existing unknown$1 reservation is retained. New calls0/new cost$0.

## Boundaries and next step

Owner-draft sample lane only. run-local-story-preview.ts, production renderer,
visual-contract compiler, active judge/model/thresholds, accepted story, canonical
candidate41d40069, historical false PASS, reader and narration are untouched.
One principal relation is not complete3D/limb/contact/capacity coverage; final tote
is not inventoried, framing prose has an inherited numeric tension, and prior pixels
can themselves be wrong. No automatic acceptance, independent PASS or release claim.

After independent review, measure a bounded same-scene pair1/2 against the retained
failure before continuing3-5. Need evidence of stable station geometry/occupants,
no extra box, expressive child and diverse framing. No new approval requested here.

## Owner handoff (inspect; push only if Guy explicitly requests it)

The implementation is committed locally; no staging or commit reconstruction needed.
Freeze the reviewed head before any future push; push includes all ahead commits,
not only this milestone. This handoff does not grant review coverage to those commits.

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
git status --short --branch
git log --oneline '@{upstream}..HEAD'
git diff --stat 4ee9afc137c50494c30acd3358eb1f79c5fd33fe..HEAD
# Only after explicit push instruction:
git push origin HEAD:refs/heads/codex/r3b1b-semantic-recovery-m1
```
