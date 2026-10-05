# Independent QA request: one external synopsis repair

## Requirement and authority

Guy approves the bounded repair proposal with Claude's five design conditions.
Implement over the existing diagnostic coordinator/host/CLI, not a new pipeline:
off by default, one single-case repair, defects only, a fresh whole-plan review,
and both plans/reviews retained and visible. Do not recover sealed trials01–06.
No images, narration, public wizard change, push or deployment. A fresh fictional
eight-spread up-to12USD trial is authorized only after technical PASS.

Codex is sole implementer in personal-story-product, branch
codex/personal-book-storyboard-bridge. Base is
5acdde056788d52a18ed6ecd1aaacd4603bc174e; review the single successor containing
this handoff, at the exact full SHA supplied with the invocation. The automatic
reviewer uses managed personal-trial06-auto-qa detached at that SHA. Human Claude
checkout sh-qa-book-10f54930 stays at ccf5f706; protected d53b768ccb2f and
accepted-intent63ccb484 remain clean. SiteQA5fe73b3f and site87b0d196 untouched.
The engine was cached ahead15 before this new local milestone; no network refresh
or push was performed. Record exact reviewer HEAD/parent/status before review.

## Changed surface and architecture

- lib/personal-wizard/story-causal-experiment-runner.ts: strict repair request,
  positive captured opt-in/recorder, one-case admission, phase/binding/one-use
  guards, defects-only replan input, preserved attempts and fresh digest.
- scripts/personal-causal-trial-host.ts: optional policy field, existing fenced
  file reader, immutable critique before claim/dispatch, separate repaired files,
  and opt-in verifyRecords before every next step/dispatch.
- scripts/personal-single-book-calibration.ts: conditional opt-in plumbing,
  explicit repair command, two independent20minute waits, EOF cancellation over
  the enabled interface lifetime, and escaped planning evidence outside books.map.
- Corresponding three specs: additive tests; no removed tests.
- CURRENT/ROADMAP plus approved Decision Gate and this handoff.

No change to plan schema, ordinary plan/author/editor/critic instructions, transport
adapters, output caps, model IDs, rates, reservation slots or approval-family key.
Only the explicit repair receives a short general suffix. No plot-specific fix.
The existing replan slot is shared with automatic both_rejected; never twice.

Repair is requested before reviewSynopses consumes the initial decision: its
strict request contains the entire digest-bound HOLD, case/latest planning digest
and a trimmed list totaling at most2000characters. Full review reason and a
suggested-solution field are not sent to the model. Text cannot prove that a
reviewer did not smuggle a solution into a defect; operational reviewer discipline
and the generic data-not-authority instruction remain necessary.

Record critique write-once, then claim existing replan slot. Append exactly one
compiled result; do not enter the original plan loop again. New bundle binds all
attempts and critique. Prior digest cannot WRITE; latest disposition must selected.
Second HOLD completes with books[] and no author. Transport/malformed/cancel/cost
or invalid duplicate failure is terminal; no paid polling or recovery API exists.

## Validation by Codex, not independent PASS

Final tsc exits0 before commit. Final focused505/505 (114core+89host+80native+
91driver/CLI+42editor+41semantic audit+48comparison), after compatibility/test-only
additions. Exact command:

```powershell
npx vitest run lib/personal-wizard/__tests__/story-causal-experiment.spec.ts lib/__tests__/personal-causal-trial-host.spec.ts lib/__tests__/personal-causal-trial-native.spec.ts lib/__tests__/personal-single-book-calibration.spec.ts lib/personal-wizard/__tests__/story-editor.spec.ts lib/personal-wizard/__tests__/story-semantic-audit.spec.ts lib/personal-wizard/__tests__/story-comparison.spec.ts
```

The CLI positive tests mock TTY/readline and native transport constructors/Git,
but keep actual driver/host/journal/wire preparation. No key exists or provider
runs. They prove two explicit decisions, two20minute timer instances, fresh files,
WRITE/HOLD, stop/EOF/signal in both windows, rejected second repair, and EOF during
repair. They are not real OS-PTY evidence. Existing real piped/closed-stdin tests
and native transport tests pass. A real paid trial is deliberately deferred.

Internal read-only engineering audit found terminal revival at an async record
boundary and missed EOF during repair. Codex fixed both; production tests pin
record/claim/generate races and late replies, plus lifetime cancellation. This is
internal audit, not Claude Code independent gate.

Read-only helpers under the visualization evidence root, not production:
SYNOPSIS_REPAIR_DEFAULT_PARITY_20261005.cjs and its RESULT JSON compare Git base
in memory across normal/benchmark,1/6cases, selected/initial both_rejected. Bundle,
result,snapshot,all real wire JSON,viewer bytes equal in all8cases. Default parsed
policy,preview,probe wire,binding digest,reservation equal in both modes.
SYNOPSIS_REPAIR_NEGATIVE_CONTROLS_20261005.cjs and RESULT deliberately remove
planning/source/HOLD/record/terminal guards in memory:5/5 controls catch breakage.
No production overwrites, providers or keys. Readers may inspect and rerun them.

Archive preservation:91files/24roots,1291860bytes, SHA/size unchanged, zero
missing/extra/modified. Trials01–05:70/20;trial06:21/4. All12seals retain false
runtime eligibility. Inventory digest1d02275df71e6a138a7a60663d4c80f7f55fd6e4283c106c3f8bf5bf3594b1e7
(sorted absolute path,TAB,size,TAB,lowercase SHA;LF trailing LF).

Full check native1. Ordinary:10historical missing-artifact failures,6161passed/
73skipped,392files. Resource:15timeouts,620passed,4RPCerrors,20files. Prior RED and
known load-sensitive files do not establish the cause of these15 failures. No
fixture was manufactured to make it green. That full run preceded the final
restriction of the default CLI lifetime EOF listener to opt-in and one additive
initial-outline-HOLD test; final focused/tsc checks cover those last changes, but
no second full gate is claimed. This is not release/stability acceptance.

## Falsification targets

1. Can absent/false/mutated opt-in, multi-case, missing recorder, stale source or
   planning digest, WRITE or extra solutions field reach reserve/repair/author?
2. Can prior automatic replan, duplicate/concurrent call or late reply acquire a
   second slot or restore terminal state? Attack all async boundaries.
3. Are any review suggestions/full reasons passed to the planner? Is critique
   durable before claim/dispatch? Can record failure or edited archived evidence
   permit another call? Can separate filename bless an old digest?
4. Does new plan require real fresh decision, not inferred permission? Does
   author get latest plan? Can outline_held/both_rejected lead to WRITE?
5. Does second HOLD retain both plans/reviews in viewer with zero prose? Are all
   strings escaped? Are immutable original bytes left untouched?
6. Do two terminal windows get their own20minutes with listener/timer cleanup?
   EOF during repair, repeated repair, signal/timeout and noTTY must fail closed.
7. Compare disabled bytes against Git base, including automatic rejection replan.
   Check all full-gate failures and avoid claiming product/semantic quality.

First QA pass read-only. No source edits, commits, providers, credential reads,
paid books, permission/trust changes, push or deployment. Rank concrete findings
with absolute files/lines; distinguish code correctness, coverage and literary
unproven claims. Never self-accept model outline checks as semantic proof.

## PowerShell inspection and optional owner push

After Codex creates the local commit, the actual frozen SHA is supplied alongside
this brief. Inspect that commit and its parent; do not create another commit.

```powershell
Set-Location 'C:\Users\guyna\.codex\worktrees\personal-story-product\Small_Heroes'
git status --short --branch
git show --stat --oneline HEAD
git diff --check '5acdde05..HEAD'
# Only if Guy separately wants to publish every local commit on this branch:
git push origin HEAD:refs/heads/codex/personal-book-storyboard-bridge
```

Push is not performed here and would publish all ahead commits, not only this
milestone. Independent PASS is exact range only; Guy retains product acceptance.
