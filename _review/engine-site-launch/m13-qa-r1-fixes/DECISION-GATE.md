STATUS: M13 DECISION-GATE DONE
HEAD: 3185919b42c493b0f56c4d67867aef1fa1798a89
Summary 1/5: Guy authorized M13 in response to Claude Code's independent HOLD for 6a223a28..3185919b.
Summary 2/5: Reproduce Q1-Q16 through actual entry/SQL/parser/provider boundaries before changing each behavior; record any disproved part explicitly.
Summary 3/5: Fix payment binding, transient/terminal classification, worker ownership/deadlines, admission reuse, publication lifetime and private project/table authority.
Summary 4/5: Preserve LOW/5900 agorot/0.70, attempts, identity/review gates, meter and default-off activation; prepare a separate production Q1 patch only.
Summary 5/5: Direct-Node tsc/focused tests gate the recovery; full npm check is logged/report-only; no index/commit/provider/key/service operation is authorized here.
Guy decisions: None needed for these approved general corrections. Retention/deletion policy and bounded paid-test activation remain Guy's separate decisions.

## 1. Proposed change
Implement the independently reported general corrections Q1-Q16, after falsification against the current committed code. Address cheap P3 defects with regression controls and record the rest. Produce explicit-path M13 recovery against this exact HEAD and a minimal PROD-PAYME-HOTFIX.patch against the verified production ref, without applying it elsewhere.

## 2. Why now / observed versus expected
The current return handler lets browser IDs choose payment proof and the verifier accepts a status-only first/root item. Fulfillment catches read/decode/admission errors as terminal, and the production worker sends every held result to an unfenced failure path. Current reader/send readiness uses mutable launch policy even after delivery. Engine refunds depend on the unrelated readiness flag; long/deployed jobs lack a complete bounded recovery path. Readmission compares unparsed raw reviews and unconditionally requests identity. Other Q9-Q16 claims require targeted verification; no live exposure or PayMe filter behavior is inferred from source alone.

Expected: only exact server-bound payment proof; deterministic evidence failure may refund, infrastructure ambiguity retries boundedly then parks for an operator; only an owning fenced worker may terminate its work; delivered book access survives policy changes while unsent books are re-evaluated. All execution and storage authority remains explicit and fail closed.

## 3. Scope / 4. Hardcoding risk
General lifecycle, payment, private storage, reader and intake fixes. No story/child/page-specific exception or price/quality decision. No bank reconnection. Test fixtures are synthetic and exercise production functions with injected external boundaries only.

## 5. Likely files / work order
1. Payment verifier/return/checkout/webhook/refund proof and standalone production patch (Q1,Q10).
2. Fulfillment/readmission/error disposition/cache/policy lifetime (Q2,Q5,Q6,Q11).
3. Durable worker/production wrapper/long loop/sweeper/poll scheduling/cron/runtime tracing (Q3,Q4,Q7,Q8,Q14).
4. Private database/storage project guard, upload resizing, rendered reader text (Q12,Q13,Q15,Q16).
5. P3 dispositions, canonical CURRENT, proof matrix, recovery and adversarial full-surface handoff.
Use one final M13 commit/recovery boundary; development red/green logs preserve each finding's proof.

## 6. Risks / rejected alternatives / exceptions
Do not classify every thrown error as evidence corruption or automatically refund unknown infrastructure outcomes. Do not trust a cached summary without exact input/receipt/asset hashes. Do not make live policy retroactively revoke sent books. Do not continue a new deployment under old spend authority: fail an incompatible in-flight job through the engine's fenced terminal path, without dispatch. Do not create a second paid call while polling. Production Q1 patch must not depend on engine modules. Retention dates are not invented. Existing historical data and unrelated pricing remain outside scope.

## 7. Validation / acceptance
First capture failing tests per verified Q finding on the real affected function, then green controls including wrong-owner/concurrent/stale/hash/amount/currency/refund paths. Actual offline PostgreSQL semantics use PGlite, external providers/network/DB constructors are denied. Trace includes are checked against all disk dependencies; no deployed build claim. Direct Node tsc and relevant Vitest; full npm check report-only. Verify all explicit file/patch pins, PowerShell parse/InspectOnly, reverse applicability, diff whitespace and no extra blank EOF. Claude re-gates the whole relevant surface, not just the diff; Codex does not award independent PASS.

## 8. Cost / 9. Rollback
USD0, no images/story/TTS/payment/email/storage service calls or real customer data. No keys or .env reads. Recovery is local source only, flags remain off. Roll back the future M13 commit after preserving any owner changes; do not reset or remove worktrees/old evidence. No schema/service migration is executed.

## 10. Review / 11. Stop check
Current dedicated thread remains sole implementer in sh-engine-site-launch on codex/engine-site-launch-20261104. Scene worktree is excluded. Guy already explicitly authorized these fixes and the reversible exact-text reader default in Q16. No additional product decision or creative review is required. Claude should falsify forged/duplicate/late payment events, ownership races, transient outages, raw review/identity replay, sent/unsent policy flips, cron activation/deploy/backstop, RLS/project mismatches and rendered Hebrew text. Guy's later eye review and paid/launch GO remain distinct. No push/merge/deploy/service write or paid run.
