# Failed-provider Blueprint recovery — decision brief, not implementation

2026-09-10. Guy requested continued progress toward a ready book. Codex investigated in the existing sole-writer task, C:/GNart/Work/sh-r3b1b-semantic-m1, branch codex/r3b1b-semantic-recovery-m1. Start HEAD b2788c2361c1f0bc66fe5142e1d7038aec00c585, clean ahead2/behind0 against local upstream38f07659. Protected d53b768ccb2f and accepted-intent63ccb484 remain read-only. No push, paid call, credential read or runtime artifact mutation in this investigation.

## 1. Proposed change

Add one explicitly authorized failed-provider successor variant, reusing runBlueprintExecutionUnderClaim and existing immutable claim/slot/replay patterns. Preserve the frozen legacy diagnostic v1 contract; do not reinterpret it. Eligibility must be general, not keyed to Dini, a child or page. This document is a proposed scope and acceptance gate, not a completed implementation or live authorization.

## 2. Why now / verified cause

The real terminal lookup be3eb84d points to consumed ordinary identity beb7c945, failed manifest17c59994 and receipt0e464a99. Receipt v8 records one initial logical call/dispatch, zero repairs/retries/fallback, provider_call_failed, no response/usage/Blueprint. Actual charge and original API cause remain unknown. Logging repair cannot recover the discarded error.

Three distinct barriers were verified:

- ordinary identity is authoringAuthorityDigest + executionProgramDigest, not a request timestamp/id or output directory (qaWizardBlueprintAuthoringLifecycle.ts, qaWizardBlueprintOrdinaryExecutionIdentityDigest). Renaming a request does not authorize a paid repeat;
- orphan replacement explicitly rejects an existing terminal (load/replacement validation around lines4897/4913); our terminal exists, so this is not an orphan;
- diagnostic v1 requires receipt v7, draft_validation_repair_exhausted, three calls/two repairs and capture v3 (loadEligibleDiagnosticPredecessor around lines5600-5627). Our v8 provider-boundary failure meets none of those conditions.

Read-only CLI preparation against the exact real lookup, without --write, exited1 with candidate_validation_consumer_repository_stale_or_dirty. This is the actual first runtime rejection: the old semantic bridge is bound to historical f4cf3f05. The separate v7 eligibility mismatch is code/receipt inspection, not a second runtime assertion that was reached. The authoritative manifest loader currently reloads production context before terminal lineage; a correct successor must distinguish verified historical predecessor evidence from current dispatch authority, without relaxing the normal current-proof loader.

## 3. Scope

One successor execution after an exact ordinary-v2, current-schema v8 failed initial provider call. Bind immutable predecessor lookup/claim/binding/manifest/request/receipt identities and a separately validated current target preflight. Same accepted story/template/reconciliation/style and same compiler program; any difference is a hard rejection, not an implicit new approval. Historical verification must fully check the predecessor chain and accepted inputs, not trust a receipt alone or a caller-supplied context. Current target retains all production authority checks.

Require exactly one initial attempt, provider_call_failed at the canonical adapter boundary, one dispatch, zero retry/repair/fallback, null response/usage/Blueprint, no conflicting incident or terminal. Unknown historical charge remains explicit. Do not allow successor chaining. Slot uniqueness is tied to the predecessor, not mutable target paths/timestamps; parallel contenders can dispatch at most one authorized execution. Replay recovers only that successor's terminal and makes zero new calls.

## 4. Hardcoding / alternatives

No story/child/companion exceptions. Rejected: clearing a ledger, forging an orphan, loosening legacy v1, bypassing current proofs, changing program/version merely to mint an ordinary identity, direct SDK calls outside the executor, or retrying repeatedly until success. A generic retry framework is unnecessary for this bounded case.

## 5. Likely files and sequence

First map/extract the smallest shared immutable historical evidence validator while retaining strict current dispatch validation. Then add versioned failed-provider successor authority/validators and prepare/authorize/execute CLI routing; connect via the existing claimed executor, not a second transport. Likely affected: qaWizardBlueprintAuthoringLifecycle.ts, qaWizardBlueprintDiagnosticSuccessorAuthority.ts or a small dedicated authority module if disjoint schemas require it, corresponding CLI/entrypoint and existing replacement/lifecycle tests; semantic production bridge validation only if a strict read-only historical verifier is required. Exact file boundary follows this extraction investigation. No prompt, provider adapter, model, story or reader change is proposed.

## 6. Expected result and invariants

One deliberate new execution can produce a candidate or an attributable failed terminal while the predecessor remains byte-identical and consumed. A successful Blueprint still requires review before Boards/package/images. No automatic image render or product acceptance. Old ordinary/replacement/diagnostic v1 replay stays compatible. No migration of existing artifacts; new records are additive.

## 7. Validation and independent review

Smallest proof: real frozen predecessor bytes loaded offline; reject stale target, tampered historical chain, wrong terminal/version, unknown/ambiguous claim, changed content/program, unauthorized/duplicate successor and successor-of-successor before provider factory construction. Inject a counted fake provider to prove one winning dispatch under parallel callers, failed/successful terminal persistence, crash recovery, replay zero calls, and no cross-lane adoption. Test both historical predecessor integrity and current-target freshness. Demonstrate a failing regression before code; relevant focused tests, both typechecks and npm run check. Claude reviews the full implementation immutable range before any live attempt. These tests have NOT been run in this planning milestone.

## 8. Cost and owner decision

Investigation and proposed offline implementation cost USD0. Proposed live allowance: ONE additional compiler-governed execution under the unchanged USD5 ceiling; at most3 generation calls including up to2 schema-validation repairs, zero transport retries or fallback. A provider-boundary failure ends it immediately. This is not a promise of a single API call or USD5 total across historical and future attempts. The previous charge is unknown and remains separate. Fresh exposure authorization must explicitly acknowledge that uncertainty. No count/repair policy or reservation rule is relaxed. Use the existing key only, as already directed; never rotate or expose it.

Owner decision required before enabling this successor: permit the single additional execution with that additional ceiling and retained unknown prior charge, or keep all work offline. Standing book/render intent is retained; this brief does not silently turn it into unlimited provider retries.

## 9. Rollback / storage

Revert the focused implementation before live use; after live use, preserve the successor claim/terminal and compatible replay support. Never delete claims/receipts to roll back. Preserve old evidence and use fresh stdout/stderr paths through the reviewed Start-Process pattern. Capture process.ExitCode, per-line diagnostic events and log hashes; exit0 alone is not success. outputs remains ignored/local-only without verified backup. No publication/backup is part of this scope.

## 10. Review assignment and stop-check

General system change, affects paid production dispatch and thus concurrency/lineage safety; no creative choice or Cowork consultation required. Guy decides the additional paid exposure. Codex owns the focused implementation once the gate is resolved; remain in this task for the bounded continuation unless a separate execution task is explicitly requested. Claude first review read-only; attack duplicate spends, historical-current confusion, fail-open approvals and misleading billing. Guy eventually eyeballs real images; this milestone produces no visual acceptance. No independent PASS is self-awarded.

## 11. Do not do / current status

Do not implement a paid bypass, issue another provider request, push by implication, alter content/model/budget, fabricate authority, delete any worktree/artifact or call the book ready. This turn produced an investigation/decision brief only. The prior process-capture documentation P2 is independently CLOSED: Claude PASS0/0/0 for1fad4583..b2788c23, including18 independent checks on PowerShell5.1 only; code PASS remains38f07659. P1 HELD0/3/3, M2b, Boards/package and resource-phase timing P1 remain open.
