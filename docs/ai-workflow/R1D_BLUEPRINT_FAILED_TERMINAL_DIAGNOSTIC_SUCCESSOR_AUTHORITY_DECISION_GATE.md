# R1D Blueprint failed-terminal diagnostic successor authority — Decision Gate

Status: **approved for focused offline implementation under Guy's standing instruction to
continue autonomously toward an operational Wizard; no provider/live/render is authorized by
this gate, and Guy must still approve the exact generated successor-candidate digest**

Owner: Guy (Product Owner)

Technical owner: Codex

Date: 2026-08-31

Branch: `codex/r1d-order-package-authority-binding`

Worktree: `C:\GNart\Work\sh-order-package-authority`

## 1. Proposed change

Add a separate, versioned, single-use authority lane for one diagnostic successor Blueprint
execution after an exact, fully recoverable failed terminal whose immutable evidence predates
per-attempt diagnostic attribution.

The lane must:

- accept only a fully validated current program-scoped ordinary claim and its exact terminal
  lookup, binding, manifest, receipt, and sanitized capture;
- require the narrow eligibility `legacy_per_attempt_diagnostic_evidence_unavailable`: failed
  `draft_validation_repair_exhausted`, receipt v7, capture v3, three calls/two repairs, no retry or
  fallback, no Candidate, and no per-attempt census in the immutable evidence;
- bind one canonical successor candidate -> exact Guy authorization -> one successor claim to the
  predecessor bytes, paths, digests, request/preflight/content authority, execution program, and
  current v8/v4 evidence contract;
- derive a distinct compiler-owned execution identity without changing the canonical content
  authoring authority, request, story, model, prompt, or output policy;
- revalidate eligibility immediately before claim publication/provider access, then reuse the
  existing `runBlueprintExecutionUnderClaim` ownership, incident, terminal, recovery, and replay
  machinery;
- preserve the orphan-claim replacement v1 lane unchanged and reject chaining or substitution
  between the two lanes.

## 2. Why now?

The latest bounded live run is a valid failed terminal, not an orphan. Its real compiler
trajectory was `223 -> 89 -> 5`, but immutable receipt v7 saturated the first count at 128 and
capture v3 persisted only aggregate total 317. The exact final five identities are therefore not
recoverable without inference.

Receipt v8/capture v4 now solve that observability defect and independently passed QA, but the
existing replacement authority correctly rejects every predecessor with a recoverable terminal.
It would be unsafe to bypass that fence by changing request IDs, timestamps, output directories,
content digests, or execution-program identity. An explicit human-approved terminal-successor
authority is the smallest honest route to one attributable run.

## 3. Scope

General Blueprint paid-execution authority for this one closed eligibility class. It applies to
any story/style/context with the same exact legacy evidence deficit; it contains no Lantern,
Chameleon, Bar, page, companion, prop, scene, or diagnostic-identity literal.

It is not a retry policy, provider fallback, convergence fix, prompt change, or story patch.

## 4. Risk of hardcoding

High if the implementation recognizes the current story/output path or if any code change alone
creates a new ordinary paid slot. The lane must use typed version/failure/topology evidence and
exact content-addressed lineage only. Tests must use synthetic authorities and hostile cross-story,
cross-preflight, cross-terminal, and cross-lane artifacts.

## 5. Files likely affected

- a small pure terminal-successor token module;
- `qaWizardBlueprintAuthoringLifecycle.ts` for exact filesystem eligibility and execution wiring;
- a strict operator CLI/entry or an additive closed command family;
- focused lifecycle/CLI specs and existing shared test helpers;
- `CURRENT.md` and implementation evidence.

No prompt, compiler, validator, Story Source, bridge/package, Wizard UI, payment, image, audio,
render, model, budget, retry, fallback, or provider transport file may enter the milestone.

## 6. Expected behavior after change

1. Ordinary re-entry remains replay-only and never redispatches a terminal identity.
2. Orphan replacement v1 remains orphan-only and cannot adopt a failed terminal.
3. Offline preparation succeeds only for one exact, replay-valid v7/v3 repair-exhausted terminal
   with the closed evidence-deficit reason.
4. Only exact approver `Guy` can authorize the exact canonical successor-candidate digest. No
   separately persisted review artifact or fourth governance stage is added. All reasons remain
   closed sanitized codes.
5. Authorization creates or verifies one immutable predecessor-terminal-keyed slot before persisting
   authorization. A conflicting authorization fails before a second successor exists.
6. Execution re-derives every claim/terminal/request/preflight/program/evidence relation before
   claim creation or lazy provider factory access.
7. The successor admits one global paid owner, uses unchanged three-call/two-repair/no-retry/
   no-fallback/$5 policy, and emits current receipt v8/capture v4 on another diagnostic failure.
8. Completed Candidate and failed terminals replay with zero calls. Torn, tampered, missing,
   completed, current-v8, diagnostic-less, or cross-bound predecessor evidence is ineligible.
9. No successor of this diagnostic successor is permitted by this milestone.

## 7. Validation plan

All implementation proof is offline with injected providers and temporary repositories:

- pure exact-key candidate/authorization/claim construction and tamper rejection;
- eligible ordinary claim -> v7/v3 repair-exhausted terminal -> one successor call -> v8/v4 failed
  terminal -> zero-call replay;
- one successful Candidate successor -> zero-call replay;
- wrong receipt/capture version, failure code, call/repair count, retry/fallback, missing capture,
  incomplete/tampered terminal, completed Candidate, orphan, replacement claim, wrong
  program/preflight/request/story/output, non-Guy approval, timestamp inversion, and extra-key
  rejection before provider factory access;
- concurrent execution and conflicting authorization prove one global successor;
- ordinary and orphan-replacement regression suites remain unchanged and green;
- focused tests, `npx --no-install tsc --noEmit`, `git diff --check`, and honest repository-gate
  disclosure.

No real credential, provider, image, audio, or render is part of implementation validation.

## 8. Cost impact

Implementation and tests cost `$0` externally. After local green, independent Claude Code PASS,
clean pushed-head readiness, and Guy's exact successor-candidate approval, one successor may spend at most the
unchanged `$5` hard ceiling. The prior comparable run cost `$1.285786`; that is an observation, not
a promised charge. Retry is zero. No image/audio/render spend is included.

## 9. Rollback plan

Before a real authorization, revert the focused additive implementation. Existing ordinary,
orphan-replacement, terminal, receipt, capture, and claim artifacts remain immutable. After an
authorization exists, preserve it as historical authority; never delete or rewrite it. Once a
successor claim or terminal is published, rollback must retain its v1 reader/replay support; a raw
code revert that removes that support is not a valid rollback.

## 10. Review assignment

Guy's standing instruction authorizes the offline engineering milestone and asks Codex not to stop
on reversible zero-cost work. Guy must still approve the exact generated successor-candidate digest
before Codex may mint its bound authorization and execute the paid successor call.

Claude Code must independently falsify eligibility totality, lineage, byte/path containment,
single-successor global fencing, pre-provider ordering, cross-lane replay, program/evidence binding,
terminal recovery precedence, no automatic retry, minimal authority surface, and absence of
content/prompt/budget drift.

Claude Cowork is not needed because this changes no product, story, UX, or creative behavior.

## 11. Do not do

- Do not edit/delete/supersede the predecessor claim, terminal, receipt, capture, binding, lookup,
  incident, successor candidate, authorization, or slot.
- Do not evade the paid fence with a new timestamp/output path/request/content/program digest.
- Do not broaden orphan replacement v1 or ordinary execution semantics.
- Do not allow a generic failed-terminal retry, current-v8 retry, provider retry, or nested
  diagnostic successor.
- Do not claim that this additive lane independently migrates shared manifest/request replay
  across a future program or request-version cutover; that cutover must preserve v5/v8 as legacy
  replay authority before it ships.
- Do not access credentials/provider, run Fresh Readiness/live authoring, mint Guy approval,
  render, deploy, push, or mutate external state during implementation.

## Stop-check

1. General system fix: **yes**, narrow typed evidence class; no story literal.
2. Cross-story/style risk: paid authority surface; controlled by exact lineage and hostile tests.
3. Production behavior: additive explicit execution lane only; ordinary/orphan behavior unchanged.
4. Spend: implementation `$0`; later exact-approved attempt at most `$5`, zero retry.
5. Smallest safe proof: one injected failed v8/v4 successor plus zero-call replay.
6. Guy decision: exact generated successor-candidate digest before any paid call.
7. Claude targets: eligibility, lineage, single-use, ordering, replay, cross-binding, no drift.
8. Claude Cowork: not required.
9. Guy eyeball: later Candidate/Blueprint review only; no visual output in this milestone.
