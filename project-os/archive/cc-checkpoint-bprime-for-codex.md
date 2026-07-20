# B′ (receipt fence) — COMPLETE + Codex-hold fixes applied, HOLD for Codex RE-gate

**What:** wired `runAtomicOperation` (the AtomicOperationReceipt fence from `6c44697f` [1/n]) into the 3 post-render interactive write-barrier sites, so an ambiguous commit on the Supavisor 6543 transaction pooler (tx commits on the server, caller receives P2028 after the ~45-50s render gap) replays the recorded result instead of double-applying the mutation.

**Commits on `feat/chunked-generation` (LOCAL, UNPUSHED, flag OFF):**
- `6c44697f` [1/n] — model + migration + `runAtomicOperation` wrapper (pre-existing).
- `c7a2ea0d` [2/n] — wiring into the 3 sites + 4 integration tests.
- `a8971626` [3/n] — the 17-cycle live-pooler proof spec (skipped by default; EXECUTED green on staging).
- `a582eec4` [4/n] — **the Codex-hold fixes (3 P1 + 2 P2), below.**

## Codex-hold fixes ([4/n], applied EXACTLY; npm run check green 1075/11-skip; live proof re-run GREEN)
- **P1 #1 (real payload in the fence):** `withDeliveryInputMutation` gains `mutationPayload`, REQUIRED on the fenced path (throws `delivery_input_mutation_payload_required` if omitted), folded into `payloadHash` alongside `{reason, operationKey}`. Every call site supplies its REAL persisted content (story text/templates; page prompt/urls/dims/idempotencyKey/QA-context; cover; audio; pdf; readUrl; anchors; single-page-regen; debug; reserve = artifact+budget intent). A same-key/different-content retry now FAILS CLOSED. [+2 unit tests]
- **P1 #2 (typed outcome_unknown):** exhausted retries throw `AtomicOperationOutcomeUnknownError` + `isOutcomeUnknown()` (the tx MAY have committed). The chunk-runner top-level catch branches on it and does NOT overwrite `Order.ready`/`Job.done`→failed — it opens an `infra_transient` recovery case so a redrive re-enters the fence and reconciles exactly-once. [+integration test: commit lands → all 3 acks fail → typed error, state consistent (1 manifest/outbox, ready/done) → redrive replays, no dup]
- **P1 #3 (canonical hash):** sorted+NFC serializer extracted to `lib/canonical-json.ts` (`canonicalize`/`canonicalHash`), shared by `delivery-outbox.hashPayload` + `atomic-operation.hashOperationPayload`. Byte-identical to the prior inline serializer; a benign JSONB key reorder no longer false-mismatches the receipt hash — underpins #1.
- **P2 #4 (JSON-safe result):** `ReceiptSafeValue` union constrains the CALLER boundary (`withDeliveryInputMutation<T>` / `DeliveryInputMutationResult<T>`), rejecting `Date`/Prisma records at compile time. (A self-referential `<T extends JsonSafe<T>>` is a TS circular constraint (TS2313) — enforced at the caller boundary instead; the internal `runAtomicOperation<T>` stays unconstrained with the contract documented.) Prisma-record-returning callbacks now return void or a `{ id }` projection.
- **P2 #6 (REVOKE grants):** additive migration `20260702_atomic_receipt_revoke_grants` — `REVOKE ALL ON "AtomicOperationReceipt" FROM PUBLIC, anon, authenticated` (keeps RLS-enabled + no client policy; service-role unaffected). **Applied to staging.**

**Live proof RE-RUN GREEN** (staging ref qvksgpzzosotubcbizay, :6543, 21.4 min): 17 cycles × 45-50s gaps; P2028 injected 17× per path; order-A inputVersion=17; **52 receipts** (17+17+17+1 fail-closed seed); one manifest/cycle, outbox stays 1; regenCount=1/artifact; same-key/diff-payload → `ReceiptPayloadMismatchError`; 0 genuine pooler errors; self-cleaned.

**HOLD: Claude re-verify → Codex RE-gate.** Flag OFF, nothing pushed, wizard test NOT started.

---
### (original B′ notes below — superseded where the [4/n] fixes above overlap)

## operationKey per site (durable, retry-stable, NOT a bare content hash)
1. **withDeliveryInputMutation** — `delivery_input:<order>:<slot>:<content-addressed-url>` supplied by each call site (cover/page/audio/pdf/readUrl/anchors in chunk-runner; story in text-finalization; single-page-regen; debug). An identical replay is fenced; a genuine re-render (new bytes → new url) is a NEW operation → new inputVersion++. Optional `operationKey` — flag-off OR no key → the legacy direct `$transaction`, byte-identical to pre-B′.
2. **reserveMarkAndClearRegen** — `regen_reserve:<ExceptionCase.id>:<claimVersion>:<artifactKey>`, threaded from the claimed case in exception-processor. A worker restart under the SAME claim → same key → EXACTLY ONE regenCount++ (no double budget burn); a fresh claim (new claimVersion) → new key → a legit new reservation.
3. **commitBaseBookReadiness** — `readiness_commit:<order>:<scope>:<inputVersion>:<inputsHash>:<anchorDisposition>` per commit attempt. A TOCTOU/revision retry reloads FRESH → different inputVersion/inputsHash → a NEW key (correct: genuinely different inputs, both are non-retryable-pooler errors so they propagate to the existing outer loop). An ambiguous commit replays the recorded CommitResult → EXACTLY ONE Manifest + ONE Outbox binding. `inputsHash` folds in the quality evidence, so a re-QA that flips a verdict → new key → new manifest (recovery flow intact).

**Receipt atomic with:** the asset/context write + EXACTLY ONE inputVersion++ / EXACTLY ONE regenCount++ + marker + clear / EXACTLY ONE Manifest+Outbox binding — all in the SAME tx as the receipt insert (all-or-nothing).

**Retry:** `runAtomicOperation` retries the SAME operationKey ≤3× over 6543 (maxWait 10_000, timeout 20_000, bounded jittered backoff) on P2028/P1017/P2024/P2034/connection-loss — THROUGH the fence. Never blindly reruns the callback; never `$disconnect`s the global client. Payload-hash mismatch under the same key → `ReceiptPayloadMismatchError` (fail closed, never retried).

## Guard note (why the AST barrier check still passes)
Only the barrier INTERNALS changed. Every call site still passes `withDeliveryInputMutation(prisma, args, async (tx) => {...})` with the identical tx-callback shape, so `delivery-input-writer-coverage.spec.ts` (AST walk over generatedBook/bookPage/imageAsset/order writes) still sees each model write inside the barrier callback. The receipt `$queryRaw` INSERT + `bookReadiness`/`generationJob` writes inside readiness-manifest.ts are not in the guard's MODEL_NAMES (order raw-SQL is already exempted).

## Green
`npm run check`: tsc clean, **1071 passed / 10 skipped** (baseline 1067 + 4 new `atomic-barrier-wiring.spec.ts`: exactly-once under injected ambiguous commit for delivery_input + regen_reserve, payload-mismatch fail-closed, flag-on-without-key stays legacy).

## MANDATORY PROOF — EXECUTED GREEN (staging ref qvksgpzzosotubcbizay, :6543, pgbouncer=true, 21.9 min)
`lib/generation-chunked/__tests__/atomic-receipt-pooler.staging.spec.ts`. Migration `20260702_atomic_operation_receipt` applied to staging (`migrate deploy`; was the only pending one).
- 17 cycles × (45-50s real pooler gap → barrier tx), NO renders.
- P2028 injected 17× on EACH of the 3 paths (51 ambiguous commits) via the `afterCommit` hook; each logs the exact `P2028.meta.error` + phase.
- **order-A inputVersion = 17** → one inputVersion++ per key.
- **52 receipts** = 17 (delivery_input) + 17 (regen_reserve) + 17 (readiness_commit) + 1 (fail-closed seed) → one receipt per operationKey.
- **readiness_commit:** 17 manifests (one per cycle, each cycle bumped inputVersion first), Outbox rebound in place → **count stays 1** (one delivery intent).
- **regen_reserve:** regenCount = 1 per fresh artifact (no double-spend).
- **fail-closed:** same-key/different-payload → `ReceiptPayloadMismatchError`.
- 0 genuine pooler errors this run; self-cleaned (0 leftover rows).

RLS: migration `ENABLE ROW LEVEL SECURITY` + NO `CREATE POLICY` (service-role only, mirrors QualityEvidence). The runtime pooler role (`postgres`, rolbypassrls) INSERTed/SELECTed the table throughout the proof — functional RLS confirmation.

## HOLD
Flag stays OFF. Nothing pushed. Order: **Claude re-verify (exactly-once across all 3 paths under ambiguous commit + the 17-cycle proof) → Codex gate.** Only after the gate: push + flag-on continuation.

### Open notes for Codex
- The commit fence makes a re-commit with identical inputVersion+inputsHash+anchor a fence-hit REPLAY (no duplicate manifest) — intended idempotency; a genuinely-changed input (new inputVersion via a barrier write, or new quality evidence → new inputsHash) always gets a new key. Confirm this is the desired recommit semantics (it strengthens exactly-once but means an identical recommit produces no new manifest revision).
- `SUPABASE_SERVICE_ROLE_KEY` is returned EMPTY by `vercel env pull` (marked Sensitive). The proof is DB-only so a placeholder satisfied validateEnv; no storage op runs. Real live renders still need the real key on the deployment (already set there).
