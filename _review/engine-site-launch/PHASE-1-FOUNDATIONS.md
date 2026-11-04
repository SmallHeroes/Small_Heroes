STATUS: PHASE-1-FOUNDATIONS BLOCKED
HEAD: 6a223a287913d0d5acb5693cf2ff280dd576e34f
Summary 1/5: Five local implementation slices are present: authority/gate, durable meter/audit, checkout/bank refusal, LOW wire, and Anthropic/cost/runtime seams.
Summary 2/5: Final TypeScript exits 0; final focused suite passes 232/232 in 14 files, including 128 new tests and actual local SQL/HTTP-adapter seams.
Summary 3/5: Full repository stability is HOLD; it failed before the final checkout/API changes and has environment, fixture, Git-history and reporter limitations.
Summary 4/5: Git staging is blocked by linked .git permissions; nothing is staged/committed/pushed, so an immutable independent commit review is still unavailable.
Summary 5/5: Customer checkout remains OFF; wizard-to-personal-order, full durable worker, private production assets, reader/PDF and fulfillment are not yet connected.

Current policy (Guy round 3): 59 ILS inclusive, customer LOW, no HIGH; paid MEDIUM measurement cancelled. This historical foundation report predates M06. The original foundation evidence is preserved in Git at 8bc0c92d; use m06-launch-policy/REPORT.md for the new policy implementation and later milestone reports for integration state. Full npm check is reported/nonblocking under Guy's round-3 instructions; Node-direct TypeScript and focused Vitest are the per-commit gates.

Decisions Guy must make: separately approved measurement/spend and per-order/global caps, any cost changes needed at 59 ILS, delivery/refund promise, legal/company/mailbox items, later gate-disable and release GO. Already closed: eight story pages, 59 ILS including narration/PDF, Anthropic API/current Opus author design, existing job scheduler with justified long-step executor. No key or paid GO requested/used here.

## M1 — order contract and launch review gate

Implemented `lib/engine-site/contract.ts` and `delivery-gate.ts` with strict server-owned order/policy/offer/budget fields, customer LOW/test LOW separation, exact ordered nine-frame digest, and promised audio/PDF requirements. HIGH, unknown fields and other lengths/engines are rejected. No caller-supplied bank filename or unversioned visual approval is accepted by these contracts.

Acceptance is a projection of the **existing** native `attemptStatus`, including identity 0.70 and detail nonblocking. It assumes the server caller has already admitted raw review, exact bytes, references and scale through the engine. It is not a new pixel judge or a raw-evidence attestation. The future producer must supply prerequisite holds; empty caller-supplied prerequisites are not public authority. Diagnostic auditions are not promoted to production by this module.

One gate runs above the automatic result. Required mode waits for a current approve decision; off permits an automatically acceptable unreviewed book. Explicit reject remains a hold even when off. A later audited decision may resolve it, but cannot override automatic HOLD. Missing/malformed policy fails closed. Text/image/audio/PDF/source/storyboard changes alter the book digest and invalidate approval. Policy revision changes invalidate readiness/send tokens. Approval records operator, original server UTC time, exact manifest digest, policy digest, sequence and prior-decision digest. These helpers provide no HTTP authentication themselves.

## M2 — actual receipt-backed SQL meter and operator audit

`order-meter.ts` reuses `runAtomicOperation`/`AtomicOperationReceipt`, Order-first locks and the existing ambiguous-commit recovery protocol. No schema migration or new mutable cost counter. Immutable authority requires the new Order discriminator and refuses bank/package rows. Every allowed logical slot is one use and must reserve its **full exact approved slot amount**. Call count/total cap, paid PayMe state, holds and wire/policy binding are rechecked. Pending and UNKNOWN keep the full reserve; known failed/over-reserve calls stop. Actual above-reserve usage is recorded in full. Settlement remains possible after a hold so a late billed answer does not disappear.

The claim nonce is stable within the existing receipt helper's transaction retry, but fresh on a new outer invocation. Therefore internal lost-commit recovery can return the original claim once before dispatch; restarting after a lost claim response never grants dispatch again. The adapter must dispatch only once after a granted result and keep its server admission checks.

`operator-review-store.ts` persists append-only decisions through the same receipt fence. Idempotent command replay retains the first timestamp; altered command/payload, stale displayed book digest, stale previous decision and competing commands are refused. The final delivery path still needs to read/bind this history atomically with its existing delivery fence. The audit helper alone does not revoke a sent email, implement admin auth or establish live RLS.

PGlite executes the actual tagged SQL and existing receipt helper, including rollback, JSONB/unique keys, simultaneous queued calls and simulated P2028 after commit. This is local in-memory PostgreSQL semantics, **not** independent connections, Supavisor or production concurrency proof.

## M3 — 59 ILS checkout bridge and retired-bank fallback refusal

`offer.ts` defines one inclusive SKU (5900 agorot, eight story pages, audio and PDF, no video/add-ons/discounts). The **actual** checkout handler selects this immutable personal protocol before legacy price computation, refuses mismatch/missing entitlement/unknown version and has a default-off `ENGINE_SITE_CHECKOUT_ENABLED` guard. It sends/stores 5900, labels audio/PDF included, blocks coupon/fake authority and does not fall back to fake payment on PayMe failure. Existing historical checkout pricing remains unchanged and its focused money/fake/release tests pass.

`startChunkedGeneration` and `processGenerationChunk` refuse the personal namespace before bank job creation or bank content generation. This is deliberate safe incompleteness until the personal worker is connected. **Do not enable the checkout flag yet.** An enabled checkout bridge is not evidence that a book can be fulfilled. No personal order route or wizard CTA was enabled in this milestone.

## M4 — exact LOW request boundary

`native-image-plan.ts` builds through the actual common `planGPTImageRequest` with explicit gpt-image-2/LOW, fixed retry-zero behavior and ordered exact reference bytes. It accepts only native-v1 page slots and current reference modes/roles; no v2 upgrade, model/quality override, reference truncation or injected key is accepted. It binds the assembled body and reference hashes into the meter call. Revalidation immediately before future dispatch reconstructs a fresh byte copy and rejects prompt/body/reference/model/quality/reserve/source/key drift.

This is a provider-free planner, not an active native LOW render transport or qualified LOW reserve model. Historical LOW planner, receipts, manifests, policy and paid evidence were not changed. The step's amount comes from a separately admitted policy; no default paid cap is minted.

## M5 — approved Anthropic author API and cost/runtime analysis

`anthropic-author.ts` uses the current Opus model from the model-authority registry, pins API version, one fresh user turn, original instructions/input/output cap and MED effort, with no executable/process session/tools/fallback/retry. Unsupported API grammar constraints are retained in descriptions while the original Zod schema validates output. Real API schema acceptance/complexity remains unproved.

The injected adapter checks server admission, claims once, then and only then invokes its supplied key reader. It sends one request to the fixed Anthropic endpoint, persists exact raw body through a required private-storage port, validates standard/global model/usage/cache buckets, and settles both success and failure through the meter. Missing/malformed/fast/unknown-geo/cache/refusal/truncated responses hold; known billed usage remains recorded. No raw provider error/key is logged. Short invocation budgets yield `long_step_required` before claim or key access. No actual key was read and every transport test used synthetic responses.

An integration test drives this adapter through the actual local SQL meter, private persistence port and one-use replay; it does not replace a real hosted stage/lease/DB/provider proof. The separate long-step executor is identified but not provisioned/running. Cost/runtime details and the unapproved USD8.50 cap proposal are in `COST-AND-RUNTIME.md`.

## Verification and limitations

| Check | Exact result / boundary |
| --- | --- |
| `npx tsc --noEmit` after final code | exit 0, `typescript-final.log` |
| Final focused suite | **232/232, 14 files, exit 0**, `phase1-final-tests.log` |
| New namespace | 128 tests across 8 specs within that focused run |
| Earlier native/story/reader/refund regression run | 557/557, 8 files, exit 0, `focused-regression.log`; run before final checkout/API slices, not a final full gate |
| `npm run check`, initial baseline | exit 1; 514-file classifier, user TEMP realpath EPERM and reporter/test failures |
| `npm run check`, local-TEMP followup | exit 1; 517 files; ordinary 24 failed/452 passed/21 skipped files and 445 failed/8816 passed/195 skipped tests; resource phase 1 failed/19 passed files, 1 failed/634 passed tests, 3 reporter errors |
| Diff whitespace/EOL | `git diff --check` exit 0; tracked root changes are narrow prepends, no bulk EOL conversion |
| Real provider, DB, PayMe, email, deployment | NOT RUN; no live evidence or independent technical PASS |

The broad check ran before the final checkout/API files existed. Its failure is preserved, and later final focused checks do not convert it into a green repository gate. Representative blockers include unavailable historical commit IDs/ignored output fixtures, user TEMP canonical-path permission denial, deliberately repository-external output fences rejecting a TEMP inside `outputs/`, an existing model-authority scanner mismatch, and onTaskUpdate RPC timeouts. Old affected source files were not fixed or gate timeouts relaxed. Complete broad-failure triage remains open; this report does not label every failure harmless or certify every baseline case.

## Git, topology, preservation and next boundary

Sole source writer: this task, `C:/GNart/Work/sh-engine-site-launch`, `codex/engine-site-launch-20261104`; unchanged Git HEAD/base `6a223a287913d0d5acb5693cf2ff280dd576e34f`, no upstream. Eight tracked paths changed plus new `lib/engine-site/` and task reports. Other untracked launch logs/Guy answer files were preserved and are not swept into staging.

The scene-preservation branch independently advanced from 6a223a28 to `ddc08c52b9797c3b0f1e6d4afa3596a598ffcde6` (clean, ahead 174); no edit/merge/import from that worktree. Local release branch remains `006b3757`, clean, behind its local upstream by four. Original checkout retains unrelated tracked/untracked changes. Node_modules junction was not deleted, installed into or regenerated. No cleanup, push, merge, deploy, real customer data or real secret read occurred.

Git refused `Small_Heroes/.git/worktrees/sh-engine-site-launch/index.lock` at **staging**, so the requested staged fallback is also unavailable. There is no new commit and no immutable base-to-new-head range yet. `SOURCE-AND-EVIDENCE.json`, `FOUNDATIONS.patch`, commit-message files and `RECOVER-LOCAL-COMMITS.ps1` make the exact local work reviewable/recoverable without broad staging. The script requires a green full gate before code commits and never pushes. It is supplied for a commit-capable environment; it was not executed here.

Next implementation milestone after the source freeze/review boundary: personal wizard/order intake with one inclusive SKU and private uploads; per-stage durable executor/checkpoints and long-step lease; native LOW transport/receipt validation; production reader/audio/PDF materialization; same acceptance/audit token in readiness/outbox/send-time CAS; failure/refund integration. Then separately approved actual LOW/LOW evidence, independent re-gate, approved staging and launch decisions. This foundation milestone does not complete that end-to-end objective.
