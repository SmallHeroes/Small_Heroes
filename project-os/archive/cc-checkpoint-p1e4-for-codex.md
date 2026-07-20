# P1-e4 checkpoint — 2 P0 races + 1 P1 snapshot CAS (+ adversarial-review hardening)

**Branch:** `feat/chunked-generation` · **5 commits** (unpushed), green per-commit (`npm run check`: 868 pass, 2 skipped = staging-DB specs). Flag default-OFF · zero renders · **chunk-runner.ts untouched** (verified `856ee340..HEAD`). 8 files, +363/−91.

| Commit | What |
|---|---|
| `293b6e30` | **P1-e4-1** manifest-swap rollback |
| `c2ff8985` | **P1-e4-2** durable failure classification |
| `1e3c1946` | **P1-e4-3** recheck CAS |
| `38df2985` | review hardening (3 logic gaps the panel found in the above) |
| `6f027fae` | reason-aware supersede guard (final defense-in-depth) |

## The three fixes
- **P1-e4-1 (P0) — rollback when the manifest swapped under suppress.** `suppressAndInvalidateDelivery` returns `SuppressOutcome` ('suppressed' | 'lost_lease' | 'manifest_superseded'). When the manifest-guarded readiness update matches 0 (M2 superseded M1, and the still-`processing` row now backs M2), it **throws to roll back the whole tx** (incl. the fenced suppress) → `manifest_superseded`; the worker **reschedules** the row instead of killing it. Flipped the test that locked the old "benign" bug.
- **P1-e4-2 (P0) — no auto-roll on an ambiguous send.** New `DeliveryOutbox.failureClass`: `recheck_exhausted` (no provider send → enqueue may roll fulfillmentVersion+1) vs `send_ambiguous` (a send was attempted, result unknown → enqueue **throws `outbox_send_ambiguous_needs_reconciliation`**, never a new idempotency key → no duplicate email). Unknown class is fail-safe (ambiguous).
- **P1-e4-3 (P1) — recheck CAS, no false-hold.** Read the manifest first, then a post-eval CAS of (status, inputVersion, currentManifestId): `currentManifestId` moved → **retry** (`manifest_superseded`, never false-suppress a valid book); `inputVersion` moved under the same manifest → suppress+invalidate. First step to the pure-CAS end-state once P1-f wires inputVersion bumps.

## Adversarial review found 3 real gaps in my own fixes (commit `38df2985`)
A 4-lens panel (each finding independently verified) confirmed **3 logic + 5 test gaps** in the P1-e4-1/2/3 implementation:
- **A (HIGH):** the e4-1 rollback only guarded *invalidating* suppresses; a no-invalidate suppress (`order_not_ready`/`readiness_not_passed`/…) could still kill a row M2 adopted → the same orphan. Fixed: the no-invalidate path re-reads live readiness+order and rolls back if ready+passed.
- **C (HIGH):** `failureClass` was decided from the *current* attempt, but a row lives across attempts — a prior ambiguous send then a later recheck-exhaustion was mis-tagged roll-safe → duplicate email. Fixed: durable `DeliveryOutbox.sendAttempted` (set in the pre-send fenced renew); recheck-exhaustion classifies `send_ambiguous` if a send was ever attempted.
- **B (MED):** benign `manifest_superseded` retries consumed `OUTBOX_MAX_ATTEMPTS` → a re-commit storm could terminal-fail a healthy delivery. Fixed: exempt from the cap + undo the claim's attempt increment.

## Re-review of the hardening (`6f027fae`)
A focused re-review of `38df2985` confirmed **0 live bugs** (both raised findings refuted on verification). One refuted-but-valid defense-in-depth point: the no-invalidate guard was reason-blind, so a structurally-dead reason a reschedule can never clear (book gone / manifest gone) would livelock *if* such a state arose (not reachable today). Closed correctly-by-construction: `Disposition.supersedable` — the recheck marks only transient-deliverability reasons supersedable; the guard rolls back only for those, structurally-dead reasons always suppress.

## Schema / migrations (additive, idempotent; ordered after `20260630_add_input_version`)
`20260630_outbox_failure_class` (failureClass) · `20260630_outbox_send_attempted` (sendAttempted). **Not yet applied to staging** (flag OFF; not needed until pre-flag-on — staging is baselined, so `prisma migrate deploy` works there now).

## Next: P1-f
Wire `bumpOrderInputVersion` into every Order/GeneratedBook/BookPage/ImageAsset writer that affects the gate or payload (same tx). Per Codex, this is the expected approval gate after P1-e4.
