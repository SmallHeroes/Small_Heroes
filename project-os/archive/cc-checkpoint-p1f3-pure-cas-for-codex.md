# P1-f #3 checkpoint — pure-CAS send path (live re-eval removed). For Codex + the Claude panel, BEFORE #5.

**Branch:** `feat/chunked-generation` · 2 commits since the WIP push (`dc95408c` rewrite, `05c6ebbc` review fixes), green per-commit (`npm run check`: 844 pass, 2 skipped = staging-DB specs). Net **−526 lines** (749 del / 223 ins). Flag `READINESS_MANIFEST_ENABLED` default-OFF · zero renders · **chunk-runner.ts UNTOUCHED** (that is #5).

## The pivot (#3+#4) — what changed
- **REMOVED** the live re-evaluation send path entirely: `recheckBaseBookDelivery` (asset download + integrity re-eval) and `suppressAndInvalidateDelivery` (fenced suppress + readiness invalidation), plus all the `Disposition` / `SuppressOutcome` / `supersedable` / `manifest_superseded`-retry machinery the P1-e4 rounds built. The orphan + livelock classes **vanish with the architecture** — not patched.
- **ADDED** `casClaimSendSlot` — ONE `$executeRaw` `UPDATE` that renews the lease + sets `sendAttempted` IFF, atomically:
  `status='processing'` AND `attempts=token` (fencing) AND `payloadHash` unchanged AND `manifestId=row.manifestId` AND `inputVersion=row.inputVersion` AND `EXISTS(Order: ready, inputVersion=row.inputVersion)` AND `EXISTS(BookReadiness: passed, currentManifestId=row.manifestId)`.
  `updated===1` → **'ok'** (send the STORED payload); `0` rows → re-read: still ours → **'superseded'** (terminal; no re-eval, no readiness invalidation, no retry loop — the new manifest has its own Outbox); else **'lost_lease'**.
- `processDelivery`: `ok` → send → fenced `sent`; send-failure → reschedule (within 24h window/attempts) or terminal `failed`+`send_ambiguous`; `superseded` → fenced `superseded`. Idempotency-key = dedupeKey (never blind-resend).
- `OutboxDeps`: `recheck`/`suppress` → `cas`. Cron wires `casClaimSendSlot`. New `superseded` enum value (migration).

## Adversarial self-review (4 lenses, each finding independently verified) — clean
**0 logic bugs.** The verifier confirmed the CAS SQL is correct (all bindings present, correct quoting, nullable `manifestId`/`inputVersion` naturally fail the equality → CAS fails → superseded). A "HIGH" candidate (a re-commit after an ambiguous send mints a new idempotency key) was **refuted**: a re-commit is a NEW manifest = a genuinely distinct delivery event, so its own key is correct (the `sendAttempted` no-roll guard only blocks re-sending the SAME manifest's row). 2 LOW issues found + fixed in `05c6ebbc`: the `casClaimSendSlot` unit test now pins all outer-WHERE bindings (a dropped fence/binding now fails a test), and the `failureClass` schema comment no longer documents the removed `recheck_exhausted`.

## Two points for Codex/panel to confirm before #5
1. **The `payloadHash` CAS condition is `o.payloadHash = row.payloadHash` — a self-comparison** (the row's own stored hash, captured at claim). It does NOT detect payload drift; it is a row-integrity sanity binding (catches an externally-mutated row). **Payload drift is caught by the `inputVersion` match — which only becomes load-bearing once #5 wires `bumpOrderInputVersion` into every payload/gate writer.** So pre-#5, with the flag OFF, there is no send-time payload-drift detection. This is by design (the flag is OFF; #5 is the guard). Confirm this is the intended contract, or that the CAS should derive a fresh payload hash instead.
2. **Cross-manifest re-send semantics:** a re-commit (M2) after M1's ambiguous send creates a fresh Outbox for M2 and may send a second email (M2 is a corrected book). Confirm that's the intended product behavior vs. a suppression.

## Schema / migrations (additive; staging-apply DEFERRED — flag OFF; staging is baselined so `migrate deploy` works)
`20260630_*`: add_input_version · outbox_failure_class · outbox_send_attempted · outbox_manifest_binding · outbox_status_superseded.

## Next: #5 (INVASIVE) — only after sign-off
Wire `bumpOrderInputVersion` into every Order/GeneratedBook/BookPage/ImageAsset writer that affects the gate or payload, in the SAME tx (eval outside the tx; commit conditional on inputVersion). Writer wrapper + static coverage test. This is where chunk-runner finally gets touched. Then #6 (storage contract, interim) + #7 (6 integration tests + flag-on).
