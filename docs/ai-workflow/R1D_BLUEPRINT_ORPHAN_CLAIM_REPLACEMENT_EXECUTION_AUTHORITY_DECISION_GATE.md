# R1D Blueprint orphan-claim replacement execution authority — Decision Gate

## 1. Proposed change

Add a general, versioned authority lane for one human-approved replacement Blueprint execution when an earlier single-use paid claim is durable but has neither a recoverable terminal result nor sufficient evidence to determine the provider outcome. Preserve the original claim permanently; do not mutate content authority merely to obtain another ledger address.

## 2. Why now?

The approved Chameleon authoring authority is correctly fenced by historical claim `466252b4a082ea6b98503bb2bc3e433a36408cfb61d1fd305afcbfa2b9804b64`. The corrected runtime will never redispatch that authority automatically, but the product cannot advance to Blueprint, package, Wizard and render without an explicit successor execution. This is a launch blocker and an authority problem, not a prompt/story/model problem.

## 3. Scope

General Blueprint paid-execution authority only. The implementation must work for any story/style/context whose prior claim is an unresolved orphan. It must not contain Chameleon, Bar, page, companion, prop or scene literals.

## 4. Risk of hardcoding

High if the new attempt is obtained by changing request/content digests, output directories, timestamps, model settings or source artifacts. The solution must instead represent replacement intent explicitly and bind it to the exact immutable predecessor claim and current preflight/request authority.

## 5. Files likely affected

- `lib/visual-package/qaWizardBlueprintAuthoringLifecycle.ts` or a focused pure authority module;
- the Blueprint lifecycle CLI and focused specs;
- `CURRENT.md` and focused implementation evidence;
- no Story Source, Visual Contract, prompt, model, schema, budget, package, Wizard UI or render module.

## 6. Expected behavior after change

- An unresolved exact predecessor claim cannot be retried through the ordinary lane.
- Offline preparation produces a canonical reviewable replacement-execution proposal bound to the predecessor claim bytes/digest/path, original authoring authority, current preflight/request, reason and a maximum of one successor paid execution.
- Only an exact Guy approval of that proposal can create an approved replacement authorization. Codex/Claude cannot self-approve or infer approval from a changed timestamp/output path.
- Execution under the approved authorization has a distinct compiler-owned execution identity while the resulting Blueprint retains the unchanged canonical content authoring authority.
- The successor admits at most one paid owner globally, writes its own claim/incident/terminal lookup, remains replayable, and can never overwrite or impersonate the predecessor.
- Ordinary first executions and all existing terminal recovery remain compatible.
- A replacement of a replacement is rejected in this milestone; another unresolved successor requires a new Decision Gate.

## 7. Validation plan

Use only injected offline providers and temporary repositories. Prove preparation/approval exactness, wrong-person/time/digest/path/tamper rejection, unresolved-predecessor requirement, terminal-predecessor rejection, ordinary-lane fence, global one-owner concurrency, content-authority preservation, one successor call, failed/completed terminal replay with zero calls, post-claim incident recovery, cross-output/cross-preflight/cross-story replay rejection, and no nested replacement. Run TypeScript, focused Blueprint/Wizard suites and `git diff --check`.

No live call is permitted until the implementation has a local green commit, independent Claude Code PASS, fresh canonical readiness, and Guy explicitly approves the generated exact replacement proposal/review/authorization digests.

## 8. Cost impact

Implementation and tests cost `$0` externally. After all gates, one replacement Blueprint authoring attempt may use the already approved provider policy and existing credential. No image/audio/render cost is part of this milestone.

## 9. Rollback plan

Revert the focused implementation. New authority artifacts are versioned and additive; the original claim remains immutable. Before any real authorization is written, rollback leaves no runtime artifact.

## 10. Review assignment

Guy's standing instruction authorizes the offline engineering milestone and requires Codex to continue toward an operational Wizard. Guy must still approve the exact generated replacement proposal/review/authorization digests before the paid successor execution. Claude Code should implement the smallest general solution, then Codex will independently inspect and test it; a separate read-only Claude re-gate follows any Codex corrections.

No Claude Cowork product/creative review is needed because this does not alter story, UX or visual direction.

## 11. Do not do

Do not delete, edit, rename, supersede or fabricate a terminal for the predecessor claim. Do not call the ordinary execution with a changed request ID/timestamp/output directory to evade the fence. Do not change Story Source, reconciliation, style, prompt, model, reasoning, schema, budgets or provider fallback. Do not mint Guy approval, use credentials, call a provider, render, deploy or push during implementation.

## Stop-check answers

1. General system fix, not story-specific.
2. It can affect all future paid Blueprint executions; compatibility and cross-authority replay tests are mandatory.
3. It adds an explicit production authority path but does not change ordinary execution behavior.
4. Offline milestone spends `$0`; the later exact-approved successor may spend one bounded authoring attempt.
5. Smallest safe proof is an injected one-call successor plus exact zero-call replay in a temporary root.
6. Guy must decide only the exact replacement proposal/authorization after implementation and QA; no further design choice is unresolved.
7. Claude must falsify lineage, single-use, cross-binding, recovery precedence, provider reachability and content-authority preservation.
8. No creative/UX review needed.
9. Guy should eyeball the later Blueprint review/contact sheet before Blueprint approval and before any page render.
