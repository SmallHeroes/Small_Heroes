# M23 — bounded same-book plan recovery, USD0 implementation

Owner approval: Guy's explicit approval in this chat on 2026-11-08 of the USD0 limited continuation proposal in M22 QA-ACCEPTANCE.md. This task continues here, sole Codex writer, branch codex/engine-site-launch-20261104, worktree C:/GNart/Work/sh-engine-site-launch, base4535cb52544f0b5e2b2a15c5827d574be2506d9b. Claude's independent first pass is read-only, manually routed through Guy. No paid activation is created by this work.

## 1. Proposed change

A new explicit local-test planning-recovery envelope admits a terminal first continuation whose response was charged/settled but refused by the source-quote compiler. It replays the original six operations under their original authority, replays the failed seventh operation under its own authority and requires its original compiler refusal. It retains that failed reply as evidence, never as a valid draft. One new repair of the original reviewed/HOLD draft and one fresh full semantic review are the only prospective slots. Return a plan-only outcome; never call the full book recipe or materializer.

## 2. Why now / observed versus expected

M22's schema adapter passed independent review. It does not bypass M21's consumed child claim or make its literal string-null source quotes valid. The current v1 continuation deliberately rejects continuation parents and any stop other than engine_storyboard_held. Blind resume repeats the saved compiler failure; a copied/new grant must not fork the consent-wide book. Expected: the same manuscript and all seven receipts remain, with an explicit third planning attempt counted across the entire book.

## 3. Scope / root cause / contributing factors

General local engine recovery, no story/child/companion/page constants. The root cause is a missing versioned transition from a settled compiler-HOLD to a bounded planning-only attempt; the schema-domain mismatch was independently corrected in M22. This version supports the source-quote compiler refusal under the OLD dialect only, not an already corrected-dialect failure, arbitrary transport errors, UNKNOWN, successful books, media-stage failures or recursive recovery. STORYBOARD_MAX_ATTEMPTS=3 in storyboard-diagnosis.ts remains the ceiling. The original initial attempt and failed repair consume two of these attempts, even though the latter did not reach semantic review. The semantic repair parent is the original compilable reviewed draft: the invalid candidate consumes an execution attempt without becoming a semantic parent or a fabricated second review.

## 4. Hardcoding risks and rejected alternatives

No paid reply editing, literal-null coercion, old review paired with a different draft, renewed story writing, deleted/reset claims, per-directory consumption keys, recursive grant chains, expanded provider defaults or relaxed compile/review gates. Reusing the original reviewed parent under the corrected schema avoids presenting the invalid seventh draft as an approved/compilable parent. Its paid result remains required provenance and consumes an attempt.

## 5. Expected files / order / commit boundary

First seal baseline/protected files. Add a small planning-recovery module and tests, reuse terminal-tree and settled-journal validation, add an explicit grant/activation mode in engine-local-book.ts, and allow a separate repair_2 step in storyboard preparation. Keep normal recipe/native/full-book behavior unchanged. Self-check reproduced an additional state-loss gap: after a lost POST, deleting the synthetic local journal let the same runtime POST again. A provider-denied red test is retained. The new mode therefore requires write-once per-slot dispatch witnesses alongside the consent-global claim, outside the local journal. The file runtime's optional witness port retains the FULL slot reserve/count and blocks if local state is lost or inconsistent; legacy runtimes without that port retain their behavior. Then provider-denied chain/claim/raw-replay/slot/UNKNOWN/state-loss tests, both TypeScript gates, relevant suite, preservation verification, canonical docs, focused local commit, immutable freeze and manual QA brief. No dependency migration or new service.

## 6. Expected behavior / acceptance

- Root and its one child are both terminal, completely sealed and still match the same consent/request/options/owner/draft/Reader/cap. Root and child master claims must match exact derived bindings.
- Recalculate every raw receipt and carry all seven calls/852724 microUSD in the real saved case, before any new reserve. Unknown/pending/failed transport/over-reserve, missing/extra/duplicated slots and incoherent meters stop.
- At most two prospective slots (one planner, one review); fixed consent-global exclusive recovery claim prevents a second grant/copy from obtaining a new attempt. Resume only re-admits identical saved results or polls the same durable pending id; it never creates a second POST after uncertain dispatch.
- New grant and activation bind the complete recovery envelope and reviewed json-schema-null/v1 policy. Source/input checks and after-await wire guards remain. No activation/claim is written against the real book during this implementation.
- Plan-only success still needs independent/product review, is never book acceptance, and never schedules images/TTS/PDF/Reader. HOLD/compile failure remain truthful stops. Root/child/default customer behavior and old wire hashes stay unchanged.

## 7. Validation and failure preservation

Provider/constructor/network/env-denied synthetic tests of chain admission, exact raw arithmetic, altered outcomes/receipts, scopes/caps, global claim forks and exact resume, third-attempt accounting, pending/UNKNOWN, source drift, no media slots, and the actual planning runner. Replay all seven real saved calls read-only; preflight the actual complete future planner wire/reserve without creating paid authority. Rehash paid trees/claims/manuscript, M22 evidence, R17's321 files/279 book files and runtime assets. Preserve every failed control and all incomplete historical full-check evidence. No full-book render. Report full npm check's known bounded/incomplete status honestly; no blind repetition.

## 8. Cost / allowance

Implementation USD0, zero provider calls, zero image/audio generations. Original outer cap stays USD10/121; real carry852724/7, unused9147276/114 is history arithmetic, not permission. Prospective full planner reserve1,200,000 and existing review reserve are encoded, checked before dispatch; UNKNOWN/cache and attempts unchanged. A future exact paid activation requires manual independent QA and separate explicit Guy approval.

## 9. Rollback / compatibility

New optional local-test mode only, mutually exclusive with legacy continuation. Absence preserves old authority/wire/claim/recipe behavior. Revert this focused local commit before any future execution to remove the mode; never erase paid journals/claims or migrate them in place. If a future run consumes the new recovery claim it stays immutable even after reverting code.

## 10. Review assignment / remaining decisions

Guy has approved this USD0 implementation; no product/creative decision is required to implement the boundary. Claude should falsify the whole-chain raw admission, cost/attempt carry, consent-global exclusivity, re-entry/crash behavior, exact schema/source binding and hard stop before media. Manual handoff only. Paid/model efficacy/product/release approval remain separate.

## 11. Stop-check and exclusions

General flow/authority change: yes, explicit Decision Gate approved scope. Production/customer behavior: unchanged; validate legacy paths. Spending: zero. Smallest proof: provider-denied real receipt replay plus synthetic runtime tests. Guy later inspects any separately approved new plan, not hand-repaired book art. No .env/key read (including credential-file hashing), provider call, live DB/service/payment, server start, automatic Claude message, new book, cleanup, push/merge/deploy or budget increase.
