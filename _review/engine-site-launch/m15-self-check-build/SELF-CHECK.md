STATUS: M15 ADVERSARIAL SELF-CHECK DONE
HEAD: 36bd62daf98cc73c1b3e49a2f3c3b23548d4bddd
Summary 1/5: This is Codex's own adversarial engineering check, not Claude Code's pending independent round-3 re-gate or technical PASS.
Summary 2/5: One real late-infrastructure regression was reproduced through the actual fulfillment/SQL path after confirmed delivery and corrected in the shared fault writer.
Summary 3/5: Mixed scope/owner/manual exception claims and four stale/unauthorized infrastructure-action controls pass on real production handlers/SQL with synthetic transports.
Summary 4/5: An overbroad terminal guard was falsified by the existing explicit-refund contract and removed; that regression test was preserved unchanged.
Summary 5/5: All policy/quality/accounting gates and default-off flags remain; local build artifacts and protected/live/paid evidence have separate limits.
Guy decisions: No fixed product decision is reopened. Independent re-gate, protected infrastructure and separately bounded paid GO remain required.

## Confirmed defect and smallest general correction

`reconcileEngineBook` loads the materialized book before its existing sent-publication branch. A late/replayed reconciliation or already-selected concurrent task can therefore enter `recordEngineInfrastructureFault` during a free Storage outage after an email is confirmed sent. That writer protected a processing send but did not protect a sent publication. Three faults changed the delivered Order from ready to needs_human_qa, advanced its fence, blocked readiness and opened an infrastructure case. This revoked family access despite the previously authorized book being unchanged.

`red-storage-outage-final-control.log` is the definitive before-fix proof. It temporarily executes the immutable M14 fault-writer bytes from `36bd62da` with the final negative control, restores final working bytes in `finally`, and never changes the index. The control builds a synthetic materialized book, uses the actual automatic gate/readiness/outbox/send CAS and SQL, confirms sent, injects only ECONNRESET into Storage, advances past real backoffs and calls actual reconciliation. Original code fails the unchanged-ready/fence assertion. No provider or real service is involved.

The final correction extends the existing Order-locked processing-send guard to a confirmed sent row (`status=sent`, sentAt present). It records no new free-fault count, hold, case, fence or refund after that publication. Ordinary unsent outages still retry/park; UNKNOWN accounting, bytes, reviews, identity and explicit refund authority are unchanged. The final 1154-test run includes restored family access after the synthetic outage ends and all existing unsent-failure/refund controls.

This defect exists at the M14 HEAD. The self-check does not claim that M14 first introduced it; M14's narrower in-flight guard did not close the sent-state seam.

## Hypotheses rejected or narrowed

- An initial broader guard in `failEngineOrder` also blocked an explicit financial revocation after delivery. The existing Q6 delivered-book/refund regression failed in `focused.log` (1155 pass / 1 fail). That test is an intentional existing contract, not a test to weaken. The extra guard and its new overbroad tests were removed. `fulfillment.ts` has no M15 diff; only the free infrastructure writer changes. The final existing Q6 control passes. Initial red/green/expanded logs are retained as development history, not evidence that all terminal/refund actions must be prohibited after delivery.
- A possible async temp-file deletion race in `decodeEngineAudio` was rejected by the actual caller: `probeNarrationAudio` is synchronous and uses execFileSync for both probe/decode (scripts/personal-book-narration.ts:105–112). No speculative narration edit was made.
- Partial failed-build NFT output cannot falsify final include/exclude behavior by itself. The generated files contain pre-finalization closure data, missing client manifests and omitted includes. They are inspected/reported, not repaired by weakening tracing or stripping required media. See BUILD-PROOF.md.
- The pre-deploy webhook log line `Order marked paid` is not proof of which path first changed payment state: the same source message can describe recovery of an already-paid order. The owner handoff makes the needed timeline/state evidence explicit rather than claiming live confirmation.

## R2 surface checked

| Surface | Actual check and result | Limit |
| --- | --- | --- |
| Engine-only exception drain | Existing authenticated cron/SQL quarantine test, plus new actual claim SQL with wrong owning protocol, wrong scope, manual infrastructure case and one positive personal refund case. Only the positive case claims; other attempts remain zero. | No live legacy quarantine query or financial action. |
| Effective media traces | Existing installed-Next contains matcher / real-file checks pass. Actual CLI build attempts and generated partial traces are separately inspected. | No complete production build, final size or Linux binary proof. |
| Nine-table privacy | Existing real PGlite GRANT/RLS/table/column negative controls and checkout/operator guards run in the full focused suite. Calls are scoped to personal authority; existing financial/legacy compatibility specs remain. | No live Supabase grants, Data API, server role or production-login compatibility assertion. Prepared SQL requires owner review. |
| Resume/fail | Existing UNKNOWN/replay/single-liability controls plus stale hold, active lease, unknown action and unauthorized actor. Refusals leave the hold, case and receipts unchanged. | No browser/live operator or unresolved-accounting override; no automatic UNKNOWN resume. |
| Checkout claim/renewal | Real handler + adapter + PGlite + signed synthetic callback suite covers definite/ambiguous failure, lost reply, margin, renewal and late predecessor capture. | Actual merchant expiry/response fixture remains a prerequisite. |
| Persist-before-decode | Actual materializer/durable narration tests preserve billed bytes/receipt and retry local decode without another TTS POST; known usage/invalid media remain enforced. | No live TTS or Linux packaged decoder proof. |
| Progress/host/deadline | Existing cached replay/same-phase/reset, foreign host and absolute/inactivity controls rerun. | Protected deployed scheduler/host continuation is unproven. |

The final direct-Node tsc and 61-file/1154-test focused run are local evidence. Full npm check is informational and may remain red. The expanded controls are six new cases total; they do not replace the existing suite or the whole-surface independent re-gate.

## Evidence preservation

Keep the original M14 owner record/log, R1/R2 reports, all M15 negative/development logs, failed builds and raw traces. M15 package pins final source and prepared runbooks; VALIDATION binds raw-log/build hashes. No real customer data, key/env-file read, provider call, live SQL/query, service write, index change, commit, push/merge/deploy or other-worktree edit occurred. Any first-book or launch conclusion remains Guy's after the independent and operational gates.
