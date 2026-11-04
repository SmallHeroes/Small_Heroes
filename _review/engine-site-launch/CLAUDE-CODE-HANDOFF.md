STATUS: INDEPENDENT-QA-HANDOFF BLOCKED
HEAD: 6a223a287913d0d5acb5693cf2ff280dd576e34f
Summary 1/5: This is Codex's completed local foundation diff for Guy's live-engine launch track, not independent technical PASS.
Summary 2/5: The exact base is 6a223a28; Git staging/commit failed, so review must not mistake that base HEAD for the implementation.
Summary 3/5: Final focused evidence is 232/232 in 14 files plus TypeScript 0; the full repository stability gate remains HOLD.
Summary 4/5: Review the immutable recovered commit range after commit, or stop and reconcile any HEAD/hash mismatch; first pass read-only.
Summary 5/5: No paid dispatch, real credential read, customer/production data, service write, push, merge, deploy or automatic reviewer transfer occurred.

Guy decisions still required: paid measurement and total/global caps, cost-policy changes if needed at 49 ILS, legal/customer promise, eventual gate-disable/release. Price/inclusions/format/Anthropic API are settled. Guy decides when to request Claude Code review; no reviewer was dispatched.

## Copy-ready brief for Claude Code (forward manually after commit freeze)

You are independent QA, first pass **read-only**. Try to falsify Codex's claims. Do not fix files, approve spend, query production, read keys, execute paid providers, merge/push/deploy or edit another worktree. Issue a ranked, file/line-cited PASS/HOLD only for the actual immutable reviewed scope. Product/visual/launch acceptance belongs to Guy.

Original requirement: connect the NEW live-written personal book engine to the site through wizard, PayMe, story, preparation/references, native-v1 illustration, good-enough acceptance, narration/reader/PDF/delivery and failure/refund. Launch 2026-11-30. Guy decisions: cover + eight story pages; 49 ILS includes narration and PDF, no add-ons; customer MEDIUM, never HIGH; 0.70 identity; detail nonblocking; retire 18 bank stories for new orders; automatic delivery target with initially enabled, switchable, audited operator review; Anthropic API for same Opus design and existing durable jobs with long-step executor only where required. USD0 now; any paid measurement requires separate GO.

Actual implemented scope is the **foundation/bridge** in PHASE-1-FOUNDATIONS.md, not the complete customer flow. Do not grant an end-to-end or launch PASS for these tests.

Worktree: `C:/GNart/Work/sh-engine-site-launch`.
Branch: `codex/engine-site-launch-20261104`.
Base: `6a223a287913d0d5acb5693cf2ff280dd576e34f`.
Current Git HEAD before recovery: the same base; no commit/staging succeeded because `.git/worktrees/sh-engine-site-launch/index.lock` is outside writable permissions.
Review head/range: **not minted yet**. After Guy runs recovery in a commit-capable environment, capture `git rev-parse HEAD` and use base..that exact head. If no commit exists, stop/reconcile; do not review base..base as the implementation. Source/patch hashes are provided to detect drift during recovery, not as a substitute for a falsely claimed commit range.

The unrelated scene thread independently moved to ddc08c52; none of it was merged. Do not inspect its live working tree as the target implementation. v2 scene preservation is optional and still not activated here.

### Files and claims

- `lib/engine-site/contract.ts`, `delivery-gate.ts`: strict server policy, exact nine-frame/entitlement digest, existing native acceptance rule projection, on/off launch gate, append-only decision chain and fence token. Trusted admitted evidence is a prerequisite; no public auth or raw-pixel attestation is claimed.
- `order-meter.ts`, `operator-review-store.ts`: existing AtomicOperationReceipt and Order-first lock, immutable authority/slot limits, exact full reserves, no dispatch on an outer replay, correct internal P2028 recovery, full UNKNOWN/late-cost retention, immutable review commands/current-revision CAS. Local PGlite proof, no real multi-session/pooler proof.
- `offer.ts`, `app/api/checkout/handler.ts`: server-only 49 ILS inclusive pricing at actual PayMe seam; default-off, no coupon/add-on/fake fallback; existing historical pricing tests remain green. New order creator/fulfillment is absent, so the flag must stay off.
- `lib/generation-chunked/start.ts`, `lib/generation-pipeline/chunk-runner.ts`: personal namespaces refuse bank fallback before job creation/paid generation. This is a guard while the real personal worker is still to be implemented, not that worker.
- `native-image-plan.ts`: actual shared planner, explicit gpt-image-2 MEDIUM, ordered exact byte binding, retry zero, before-dispatch reconstruction. No renderer execution or qualified MEDIUM usage ceiling yet.
- `anthropic-author.ts`, `backend/providers/anthropic-model-authority.ts`: current approved Opus through API, original prompt/input/cap, no CLI/session/tools/retry, original output validation, meter-before-key, exact private raw-body persistence before completed status, standard/global/cache accounting and fail-closed unknown outcomes. Injected synthetic transport only; schema complexity/model access/real latency not proved.
- `cost-model.ts`, COST-AND-RUNTIME.md: explicit sensitivity using supplied LOW aggregate and current reserve rules, proposal only for USD8.50 cap. Current long steps cannot honor existing timeouts under 300s; adapter defers before claim. No executor/service provisioned and no economics acceptance claimed.
- CURRENT/ROADMAP/PROJECT/QUALITY_GATES: narrow current-direction notes; historical text/evidence remains.

### Exact test evidence

Final: `npx tsc --noEmit`, exit 0; log `typescript-final.log`.

Final focused command (all synthetic/local; no external providers):

```powershell
npx vitest run lib/engine-site/__tests__ lib/__tests__/money-truth.spec.ts lib/__tests__/fake-payment-gating.spec.ts lib/__tests__/release-v1-entrypoint-fences.spec.ts lib/__tests__/payment-refunds.spec.ts lib/__tests__/payment-generation-trigger-isolation.spec.ts lib/__tests__/chunked-worker-reliability.spec.ts
```

232/232 in 14 files, native exit 0, log `phase1-final-tests.log`. Includes 128 new tests in eight specs. SQL-meter→Anthropic-adapter integration uses actual receipt SQL/PGlite and fake HTTP/private storage, not a real provider or database service.

Earlier eight-file native/story/reader/refund set: 557/557, exit 0, `focused-regression.log`. It predates the final checkout/API changes. Do not add overlapping counts or present it as final full stability.

Broad contract: `npm run check` ran twice and is **HOLD**. Local-TEMP run: 517 specs classified; ordinary 24 failed/452 passed/21 skipped files, 445 failed/8816 passed/195 skipped tests and one error; resource phase 1 failed/19 passed files, 1 failed/634 passed tests and three errors. Log `npm-check-local-temp.log`. It predates final checkout/API files. Initial baseline had user TEMP realpath EPERM. Followup also hit repository-external-output fences, missing historical objects/output fixtures, existing assertions/scanner failures and reporter RPC timeouts. No timeout/gate relaxation or full-suite baseline-clean claim. Determine whether a finding is introduced by this diff; complete baseline triage is open.

### Falsification targets

1. Can a caller forge monetary/offer/approval authority through browser fields, change a cap, lower the full slot reserve, invent another cycle or adopt a bank order?
2. Can replay/claim-response loss/internal P2028 produce a second dispatch? Can distinct simultaneous slots evade single-flight or total/call limits? PGlite's queue is not multi-connection PG proof.
3. Do pending/UNKNOWN/failed/over-reserve calls ever free budget or disappear after hold/cancel? Does a raw returned cost survive private-persistence or review failure?
4. Can a client-supplied summary/status/prerequisite list or diagnostic manifest be mistaken for admitted production evidence? Identify the still-unwired producer boundary and any overclaim.
5. Can required/off gate behavior bypass automatic HOLD, 0.70, explicit rejection, stale book bytes or a changed policy? Does audit recovery retain actor/time/book and previous-decision binding?
6. Are operator identity, active policy, actual private storage and final readiness/send CAS still unimplemented? They must remain limitations, not implied claims.
7. Does actual checkout send/store 4900 rather than legacy 5900, lose narration/PDF, call an old photo path, apply a coupon, accept unknown version or fall back to fake payment?
8. Can the old start/direct chunk path reach a bank loader for a new personal order? Can an unready personal checkout be activated by one flag? That flag is default-off and requires full qualification before activation.
9. Can image byte/body/source/role/model/quality/reserve drift survive revalidation? Does the future actual transport revalidate again after awaits? It is not connected here.
10. Does Anthropic preserve the same author/editor prompts/schema/caps and fresh turn? Are standard/global/cache billing, refusal/truncation/malformed response, known/UNKNOWN costs and private persistence correct? No actual API acceptance proof exists.
11. Do the cost conclusions acknowledge unknown LOW cost split, MEDIUM multiplier, provider overruns, actual fees/VAT and refunded-order loss? No cap is spend authority or a profit guarantee.
12. Can a long call start on a 300s invocation, or a seven-minute lease expire during a 780/860s call? A real long executor/lease remains required; do not infer reliability from adapter refusal tests.

### Inspection commands

```powershell
Set-Location C:\GNart\Work\sh-engine-site-launch
git worktree list --porcelain
git branch -vv
git status --short --branch
git rev-parse HEAD
git log --oneline 6a223a287913d0d5acb5693cf2ff280dd576e34f..HEAD
git diff --stat 6a223a287913d0d5acb5693cf2ff280dd576e34f..HEAD
git diff --check 6a223a287913d0d5acb5693cf2ff280dd576e34f..HEAD
```

Reconcile source pins and the actual new commit range before beginning. Return technical findings only; no live service write, paid call, key read, external transmission or product acceptance.
