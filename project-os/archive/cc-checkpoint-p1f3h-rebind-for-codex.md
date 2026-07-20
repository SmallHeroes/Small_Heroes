# P1-f #3h checkpoint — fulfillmentVersion = delivery-intent (atomic rebind). For Codex + the Claude panel, BEFORE #5.

**Branch:** `feat/chunked-generation` · 3 commits on top of the #3 pure-CAS pivot, green per-commit, **chunk-runner.ts UNTOUCHED**, flag `READINESS_MANIFEST_ENABLED` default-OFF, zero renders.
- `0465efde` **#3h-A** — the reframe (rebind, superseded split, firstSendAttemptAt, real payloadHash).
- `569799f2` **#3h-B** — NOT NULL binding, stale-test cleanup, flag-on gating tripwire.
- `b4fd3252` **#3h-C** — adversarial-review fixes (canonical payloadHash HIGH, atomic rebind, classifier coverage).

Supersedes `cc-checkpoint-p1f3-pure-cas-for-codex.md` (the prior #3 milestone).

## The reframe (Codex) — what changed vs #3
`fulfillmentVersion` now means the **delivery-INTENT** (a stable `dedupeKey` = a stable Resend idempotency key). The Manifest is only the validity *proof* bound to a row. So a re-commit no longer rolls to a new key (which minted a fresh idempotency key → the panel's duplicate-email window); it **rebinds the same row in place**.

1. **enqueueDelivery — atomic REBIND, not roll.** sendAttempted=false + a NEW manifest (or a `superseded_by_manifest` row) → rebind the SAME row: new manifestId/inputVersion/payload, reset `scheduled`, `attempts++` to fence any in-flight worker, **same dedupeKey**. The write is a **conditional `updateMany WHERE dedupeKey AND sendAttempted=false`** (not a read-then-unconditional-update) — a worker CAS that flipped sendAttempted=true between our read and write matches 0 rows → reconciliation, never a clobber. Removed the roll loop + `MAX_FULFILLMENT_ROLL` + the `fulfillmentVersion` persistence in runReadinessTxn.
2. **sendAttempted=true OR status ∈ {sent, failed, delivery_revoked}** → never auto-rebind; throw `outbox_delivery_in_flight_needs_reconciliation` (a 2nd email / reviving a killed intent = a deliberate redelivery).
3. **firstSendAttemptAt** (new NOT-NULL-able column; CAS sets it once via COALESCE). The 24h idempotency window is measured from it, not createdAt: a 25h-queued order still gets its FIRST attempt; a RE-attempt >24h after the first → `send_ambiguous`, no blind resend.
4. **payloadHash — a REAL recompute** in processDelivery (`hashPayload(row.payload)` vs the stored hash) before the CAS → mismatch → terminal `delivery_revoked`. **hashPayload is now canonical** (recursively key-sorted) so it is invariant across the Postgres JSONB key-reorder round-trip (see HIGH below).
5. **superseded split.** The CAS 0-row diagnosis returns `superseded_by_manifest` (order ready + readiness passed + a DIFFERENT currentManifestId → recoverable via the re-commit rebind) vs `delivery_revoked` (order not ready / readiness not passed → held/cancelled/inputs_stale → explicit reconciliation only). New enum values + migrations.
6. **NOT NULL** on manifestId/inputVersion (preflight trivially met — Outbox empty everywhere); de-staled the CAS/null-binding comments; repointed the dead `base_book_readiness_stale` test to the real anchor-only allowlist contract.
7. **Gating tripwire** — a test asserting chunk-runner.ts does NOT yet call `bumpOrderInputVersion`; it FAILS the moment #5 wires the writer, forcing a conscious flag flip. **flag-on stays HARD-BLOCKED until #5 + the writer-audit** (pre-#5 nothing bumps inputVersion → that CAS binding is dormant by design).

## Adversarial self-review — 5 lenses, 8 findings, 2 confirmed, 6 refuted (each finding independently verified, refute-by-default)
**Confirmed + FIXED in `b4fd3252`:**
- **HIGH — non-canonical hashPayload would brick flag-on.** `JSON.stringify` is key-order-sensitive; JSONB physically reorders keys; the #4 recompute reads row.payload back from JSONB → false-mismatch on **every** real delivery → terminal `delivery_revoked` → no book ever sent. The verifier independently reproduced the two divergent hashes. The unit test masked it (reused the in-memory object). **Fixed:** canonicalize before hashing + a test that key-reorders row.payload and asserts it still sends. (Not triggerable while the flag is OFF, but it would fire deterministically on flag-on — so it blocked flag-on, now cleared.)
- **MEDIUM — classifier `readiness.status==='passed'` conjunct untested** (a mutation dropping it shipped green). **Fixed:** added blocked-readiness and null-readiness → `delivery_revoked` cases.
- (also fixed proactively: the rebind atomicity race above — refuted as a *present* defect because the concurrent re-commit path is #5-gated, but it was a real race I introduced, so I closed it by construction now.)

**Refuted (no code change) — disclosed here for your call before #5:**
- **`delivery_revoked` is terminal/non-recoverable by design** (per your #5 brief). The reviewer notes a *forward* lifecycle risk: once #5 wires re-commits, a **block→fix→re-pass** (or a bare inputVersion bump with no paired re-commit) could produce a `delivery_revoked` row that then blocks the re-commit at reconciliation. Refuted as a defect today (no wired path re-commits a `ready` order off-ready while a row is live; flag OFF). **#5 must decide:** always pair an inputVersion bump with a rebinding re-commit, OR add a rebind-on-`delivery_revoked`/explicit-reconciliation exit, before flag-on. **Confirm the intended resolution.**
- **`superseded_by_manifest` is currently structurally UNREACHABLE.** Because the rebind (currentManifestId + the outbox rebind) is atomic in one tx, an in-flight worker always sees either pre-state (CAS ok → sends) or post-state (status moved → `lost_lease`) — never "still ours + currentManifestId moved". So the `superseded_by_manifest` arm is correct-but-dead today; it becomes reachable only once a future writer mutates currentManifestId outside the rebind path. Kept (it's the contract you specified) — **confirm you want the branch retained as forward scaffolding** vs. simplified.
- **enqueue reconciliation/payload-mismatch throw surfaces as a 500, not a 409,** on the (flag-gated, secret-gated admin) anchor-hold-release path. The tx rolls back atomically (order unchanged), so it's correct behavior surfaced as an ugly status — a pre-flag-on ergonomics nicety, not a correctness bug. Deferred to the flag-on milestone.

## Status / guardrails
Green per-commit (57 affected-spec tests pass; tsc clean). Pre-existing + orthogonal reds on the branch: 4 `mvp-story-matrix`/`wizard-matrix` specs (a sellable-slot config drift — verified failing on clean HEAD, flagged as a separate task) + 1 load-flake (`env-separation-guard`, passes in isolation). Flag OFF · zero renders · chunk-runner UNTOUCHED. Migrations (additive, staging-apply DEFERRED): `20260630_outbox_firstsendattempt_and_status_split`, `20260630_outbox_binding_not_null`.

## Next: #5 (INVASIVE) — only after sign-off
Wire `bumpOrderInputVersion` into every Order/GeneratedBook/BookPage/ImageAsset writer affecting the gate/payload, in the SAME tx (eval outside, commit conditional on inputVersion) + the writer wrapper + static coverage test — this is where chunk-runner finally gets touched, and where the `delivery_revoked`-recovery decision above must be settled. Then #6/#7 (storage contract + integration tests + flag-on).
