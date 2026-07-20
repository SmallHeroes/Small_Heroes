# P1-f #3h-D checkpoint — recovery taxonomy (no stuck-book). For Codex + the Claude panel, BEFORE #5.

**Branch:** `feat/chunked-generation`. 7 commits unpushed (a push is pending — GCM write-auth handshake is timing out; the work is committed locally). Green per-commit, **chunk-runner.ts UNTOUCHED**, flag `READINESS_MANIFEST_ENABLED` OFF, zero renders. Supersedes `cc-checkpoint-p1f3h-rebind-for-codex.md`.
- `dc95408c`,`05c6ebbc` #3 (pure-CAS) · `0465efde`,`569799f2`,`b4fd3252` #3h-A/B/C (delivery-intent rebind + review) · `b0b9c71b` #3h-D · `401cd4f7` #3h-D review.

## #3h-D — what changed (closes the stuck-book trap; the dup-email is already officially closed)
The reframe: **a CAS mismatch is never a business revocation.** It is a recoverable not-yet-deliverable state, so the block→fix→re-pass dead-end I flagged for you disappears by construction.

1. **Taxonomy.** New enum values `delivery_blocked` + `invalid_payload` (migration `20260630_outbox_status_blocked_invalid`). The CAS 0-row diagnosis now returns **`delivery_blocked`** (order not ready — `paid/generating/needs_human_qa/partial` are all TRANSIENT — or readiness not passed / inputs_stale): RECOVERABLE, rebind-eligible. It never infers a cancellation from a generic status. `superseded_by_manifest` kept (documented as defense-in-depth). **`delivery_revoked` is now RESERVED for a future explicit cancellation/refund domain action — the CAS NEVER writes it, and no writer exists yet.** Payload corruption (#4) → **`invalid_payload`** (separate corrupt-row state, not a revocation).
2. **Rebind guard (HIGH).** The rebind `updateMany` guards on an **allowlist of recoverable statuses** (`status IN [scheduled, processing, delivery_blocked, superseded_by_manifest] AND sendAttempted=false`), not just `sendAttempted=false`. A row that turned terminal (`sent`/`invalid_payload`/`delivery_revoked`) between the read and the write → 0 rows → reconciliation, never revival.
3. **Three cheap fixes.** `superseded_by_manifest` re-documented as defense-in-depth/protocol-drift. enqueue throws a **typed `OutboxReconciliationError`**; the anchor-hold-release route maps ONLY that (by class OR name — survives a module-registry duplication) → **409**, every other error still a real 500. `canonicalize()` now **NFC-normalizes** strings.
4. **Configurable window.** `OUTBOX_IDEMPOTENCY_WINDOW_MS` (default **23h**, a margin below Resend's 24h key TTL), read per-call, never the exact boundary.

## Focused adversarial review (3 lenses) — clean
**1 confirmed LOW (doc-only, fixed in `401cd4f7`), 2 refuted.** The LOW: my comments called `delivery_blocked` unconditionally rebind-eligible, but a `delivery_blocked` row with `sendAttempted=true` correctly goes to reconciliation (the `sendAttempted` guard precedes the recoverable-status allowlist — same safety as `failed`/`send_ambiguous`, since a send may have reached Resend). No code change — qualified the comments + added a test pinning the guard ordering. Refuted: (a) an `inputs_stale`/`partial` `delivery_blocked` needs #5 + flag-on to occur (dormant); (b) a misconfigured >24h window can't double-deliver — the 6-attempt retry budget caps a row's survival at ~31 min, ~46× below the key TTL.

## Status / guardrails
Green: tsc clean; affected specs pass; full suite **859 pass / 2 skip**. Orthogonal reds (pre-existing on the branch, flagged as a separate task): 4 `mvp-story-matrix`/`wizard-matrix` specs (a sellable-slot config drift, verified failing on clean HEAD) + an occasional `env-separation-guard` load-flake (passes isolated). Flag OFF · zero renders · chunk-runner UNTOUCHED.

## Codex's locked order — next
1. **#3h-D ✅ (this).**
2. **#5** — writers + recovery re-commit. Each writer: **mutation + `inputVersion++` + readiness-invalidation atomic in ONE tx** → evaluate OUTSIDE the tx → **commit+rebind conditional on that version**. (This wires `bumpOrderInputVersion` — the #7 tripwire flips here — and is where chunk-runner finally gets touched.)
3. **ExceptionCase consumer** — the Phase-0 contract (`retry_scheduled | customer_action | refund_pending | resolved`) as model+writer+processor (the 409/dashboard are NOT the consumer).
4. **then flag-on.**

Awaiting sign-off before #5.
