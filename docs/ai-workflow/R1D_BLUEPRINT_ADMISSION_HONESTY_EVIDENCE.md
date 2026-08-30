# R1D — Blueprint Admission Honesty + Sanitized Failure Observability (implementation evidence)

**Implementer:** Claude Code (delegated). **QA:** Codex (Round 1 = HOLD; re-gate pending). **Product:** Guy (approved framing).
**Branch:** `codex/r1d-order-package-authority-binding`. Offline only. Not pushed.

> **Round 2 note (2026-08-30):** Codex's Round-1 QA of `e757b14b` issued HOLD on
> four findings. The **"Round 2 — Codex HOLD corrections"** section at the bottom of
> this file is authoritative; where the Round-1 text below conflicts (notably the
> "deterministic truncation at 256" claim and the initial-prompt message wording),
> the Round-2 section supersedes it.
>
> **Round 3 note (2026-08-30):** Codex's QA of the Round-2 capture returned HOLD on
> three findings. The **"Round 3 — Codex HOLD F2/F3 correction"** section at the
> bottom is authoritative for the capture: it removes the raw-tuple `detailDigest`
> and its high-entropy threat claim (census identity is now sanitized-only,
> `identityDigest`, capture `v1 → v2`) and replaces the null capture derivation with
> a typed disposition that fails closed into the incident path. Finding 1 (paid
> exact-token count) is numerically unchanged and remains HOLD. Not a milestone PASS.

## What changed and why

The real R1D lantern receipt stopped at `repair_route_input_not_admissible`
(`errorClass: input_limit_violation`) because the admission gate compared
`BlueprintAuthoringInputAccounting.estimatedBytes` (a UTF-8 **byte** sum, 61502)
against `BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS` (a **token** ceiling, 64000). The
real call consumed only 12007 input tokens. The failure evidence collapsed 86
symptoms into 3 category codes with no structural identities.

### 1. Honest, versioned, proven token admission authority (numerically preserving)

New `lib/visual-package/blueprintAuthoringInputTokenAdmission.ts`
(`blueprint-authoring-conservative-input-token-admission/v1`,
basis `utf8-byte-level-bpe-monotone-upper-bound`):

- Proof: the canonical model tokenizes with byte-level BPE (o200k_base family);
  UTF-8 bytes are the base tokens and BPE only *merges*, so
  `tokenCount(t) <= utf8ByteLength(t)`; concatenation only adds merges, so the sum
  of per-segment byte lengths bounds the whole. Hence `estimatedBytes` is a
  **proven conservative upper bound on provider input tokens**. Admitting only when
  the bound ≤ ceiling keeps real tokens ≤ ceiling. The ceiling is **not weakened**.
- `blueprintAuthoringConservativeInputTokenUpperBound` /
  `blueprintAuthoringInputTokensAreAdmissible` /
  `blueprintAuthoringInputTokensExceedCeiling` /
  `blueprintAuthoringObservedInputTokensWithinBound` are the single authority.
- Byte accounting is preserved verbatim as **observability**; the numeric outcome
  at the ceiling is unchanged, so persisted v6 receipts and their digests remain
  valid. A tighter exact-tokenizer policy is deliberately **deferred** to a future
  version cutover — not guessed, no chars/bytes ratio presented as exact tokens.
- Both routes now flow through the same authority: `preRenderBlueprintAuthoring.ts`
  (repair), `productionAuthoringRunner.ts` (initial pre-dispatch + initial-prompt
  issues), `openaiResponsesBlueprintAuthoringAdapter.ts` (adapter admission), and
  the `qaWizardBlueprintAuthoringLifecycle.ts` receipt-replay comparisons.

### 2. Sanitized failure observability capture (fail-closed, content-addressed)

New `lib/visual-package/blueprintAuthoringSanitizedFailureCapture.ts`
(`blueprint-authoring-sanitized-failure-capture/v1`):

- Carries a complete bounded **census** of normalized structural identities
  (`groupPreRenderBlueprintRepairDiagnostics` → `{code, safe fieldPath, presence
  flags, detailDigest, repetitionCount}`), so repeated symptoms vs distinct defects
  are explicit (`totalEmitted`, `distinctIdentities`, `fullCensusDigest`,
  deterministic truncation accounting at 256).
- Carries exact **byte accounting** + **conservative token admission accounting**
  for **both** the admitted initial route and the rejected repair route, plus the
  real observed input tokens for the initial route (a conservativeness cross-check).
- Explicit `doesNotAuthorize` no-authority semantics, content-addressed linkage to
  the terminal receipt/request/context digests, and a recomputed content digest.
- **Prose/PII-free by construction:** `message`/`expected`/`actual` are never
  retained (only presence + a digest); every retained string is a bounded
  snake_case code, hex digest, safe path token, or fixed literal; the validator
  additionally runs a recursive leak scan rejecting any string with spaces/quotes/
  non-ASCII. Leak-freedom is structural and testable.
- The runner’s failure path derives and returns the capture
  (`ProductionAuthoringRunResult.sanitizedFailureCapture`, fail-safe → null) and
  `persistBlueprintAuthoringSanitizedFailureCapture` writes it content-addressed.
  Structured diagnostics are threaded in-memory only via an optional
  `PreRenderBlueprintAuthoringAttempt.diagnostics`; **the persisted v6 receipt shape
  is unchanged.**

**The historical failed attempt cannot be retroactively upgraded** — its concrete
86 identities were never persisted and remain unknowable. This milestone prevents
future blindness and proves admission on production-scale fixtures.

## Tests (offline)

New `lib/visual-package/__tests__/blueprint-admission-honesty-and-capture.spec.ts`
— 25 tests: conservative-bound derivation; like-for-like admission; same-unit
rejection on both routes; conservativeness on the real 61502/12007 numbers;
production-scale ≥8-page overflow that stops before a 2nd provider call (injected
pure `callAuthor`, no provider/credential); end-to-end capture from the real failed
8-page compile; 86-symptom census completeness with explicit repeated-vs-unique and
no drop/dup; topology retained but prose/PII (planted child+family name) absent;
bounded truncation accounting (300→256); field-path redaction; and hostile
regressions (tampered digest/version/keys, weakened no-authority, route
admitted-flag mismatch, schema/accounting mismatch, malformed accounting, two
initial routes, bad linkage digest, contradictory census counts, planted prose in a
census identity, planted prose anywhere via the leak scan, over-count of routes).

One pinned message assertion in `production-lifecycle-foundation.spec.ts` was
updated to the corrected (honest) initial-prompt-ceiling wording; behavior is
otherwise numerically identical.

Adjacent suites re-run green: `production-lifecycle-foundation` (52),
`pre-render-blueprint-authoring`, `qa-wizard-blueprint-authoring-lifecycle`,
`openai-responses-blueprint-authoring-adapter`,
`qa-wizard-blueprint-replacement-lifecycle` (17, replacement/ordinary lane
isolation preserved), `source-authority-lifecycle` (108, incl. "records sanitized
exact byte accounting when a repair is rejected at input admission"),
`draft-authority-reference-diagnostics` (52), `book-surface-repair` (44).
`npx --no-install tsc --noEmit` clean; `git diff --check` clean.

## Out of scope / preserved

The identical-looking Visual Contract compiler twin (`VISUAL_CONTRACT_AUTHORING_*`)
was intentionally left untouched (separate spend authority + version cutover). No
model/reasoning/output/budget/no-fallback/retry/cost-ceiling/schema/prompt-creative/
provider-adapter behavior changed. No provider/network/credential/live/render/DB/
deploy/push. The consumed real artifacts under `outputs/` were only read.

---

## Round 2 — Codex HOLD corrections (authoritative; supersedes Round-1 claims where they conflict)

Codex QA of `e757b14b` returned **HOLD** on four findings. Corrections below fix the
smallest general root causes and were independently re-verified offline.

### F1 (BLOCKER) — capture is now integrated into the real QA Wizard lifecycle

Round 1 derived/returned the capture from the runner but nothing in
`executeQaWizardBlueprintLiveRequest` consumed or persisted it, so a real failed run
still wrote only the lossy receipt.

- The terminal manifest gains an **optional** `observabilityCapture` authority
  (`ManifestObservabilityCaptureAuthority = {version, digest, path}`) present **only**
  on `authoring_failed` terminals that carry a capture. It is omitted otherwise, so
  every completed/approved/preflight/failed-without-capture manifest keeps its exact
  prior digest — **no manifest version cutover**, backward compatible.
- Ordering (in `terminal_materialization`, `qaWizardBlueprintAuthoringLifecycle.ts`):
  the receipt (already published, shape unchanged, never referencing the capture) →
  the capture is published `write:true` and **re-read + re-validated**
  (`publishAndBindSanitizedFailureCapture` → `loadSanitizedFailureCaptureAuthority`:
  exact digest/canonical path/on-disk bytes + full `blueprintAuthoringSanitizedFailureCaptureIsValid`
  + linkage bound to *this* receipt) → only then is the terminal manifest built with
  the binding and published. A terminal therefore never claims a capture that is not
  already durable; post-claim publication uncertainty surfaces as
  `execution_state_uncertain` (no redispatch), consistent with the existing model.
- **Replay/recovery** (`loadExecutionRecord`, and `recoverTerminalLookup` via the
  manifest-derived record) re-reads and re-validates the exact bound capture; a
  missing/tampered capture is a torn state → `execution_state_uncertain`.
- Completed terminals and failure types without diagnostics bind **no** capture (the
  absence is well-defined; nothing claims a complete capture that does not exist).
- Proven by `qa-wizard-blueprint-authoring-lifecycle.spec.ts` (+5): published +
  manifest-bound + re-validated; zero-call replay; fail-closed on tampered and on
  missing capture; no capture on a completed candidate. The replacement lane inherits
  the same path (its isolation suite stays green).

### F2 (MAJOR) — PII "impossible" guarantee made real via a closed vocabulary

Round 1 accepted any identifier-shaped key (`SAFE_PATH_KEY`), so
`frames[0].Bar.privateThing` (or an ASCII name used as a key) survived.

- Retained field-path **key** segments are now constrained to a **closed structural
  vocabulary** (`SAFE_PATH_KEY_VOCABULARY`, drawn from the draft schema + validator
  field tokens). Any other identifier is replaced by a **non-reversible** `#redacted`
  sentinel (never a digest of the raw token → no dictionary/rainbow recovery). Index
  segments stay verbatim. The **same** closed rule is re-enforced on reload, so an
  out-of-vocabulary key segment cannot validate.
- The `detailDigest` (the only consumer of raw diagnostic content) is documented with
  a threat assessment: a one-way SHA-256 over the **entire** high-entropy structured
  identity (code + full field + full message + structured expected/actual), not a
  bare-name fingerprint; unsalted only to keep the capture content-addressable and
  deterministically reproducible on recovery/replay.
- Proven by hostile tests: `frames[0].Bar.privateThing` →
  `['frames','[0]','#redacted','#redacted']`; an ASCII `frames[2].Sarah.Chameleon`
  field yields a valid capture whose serialization contains neither name; a
  hand-crafted path with an out-of-vocabulary segment fails validation.

### F3 (MAJOR) — a "complete census" can no longer omit identities

Round 1 truncated to 256 and still validated `true`.

- Silent truncation removed. A valid capture always retains **every** distinct
  identity (`retained == distinct`, `omitted == 0`, `truncated == false`); the
  validator rejects any artifact claiming omission. `MAX_SANITIZED_CENSUS_IDENTITIES`
  is now a **fail-closed hard bound** (4096, far above the real 86): a run beyond it
  throws at build time → the runner's fail-safe derivation yields `null` → **no**
  capture is minted (truncation is never relabeled "complete").
- Proven: 300 distinct identities retained completely; `> 4096` throws
  `refusing to mint an incomplete census`; a hand-crafted capture claiming
  truncation/omission fails validation.

### F4 (MAJOR) — one honest admission quantity in tokens, shared by both routes

Round 1 compared `estimatedBytes` to the ceiling on both routes and the harness only
proved the old rejection.

- Single authority `decideBlueprintAuthoringInputTokenAdmission({accounting,
  exactInputTokens})`: admit on the proven conservative token upper bound when it is
  within ceiling; when the bound is inconclusive (bytes > ceiling), admit/reject on an
  **exact provider input-token count**; a missing/failed count **fails closed**. Both
  the initial (`productionAuthoringRunner`) and repair
  (`compilePreRenderBookVisualBlueprint`) gates route through it.
- The exact count is modeled on the installed SDK's `client.responses.inputTokens.count`
  (`BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_AUTHORITY`), exposed as an injectable
  `BlueprintAuthoringInputTokenCounter` that is **never invoked** in this milestone
  (no network); it is distinct from the paid `callAuthor` generation call.
- Proven at the generation-dispatch boundary (`compilePreRenderBookVisualBlueprint`
  with injected pure `callAuthor`): with the repair wire's bytes **> 64K**, an
  injected exact count of 50 000 **admits** the repair and reaches the **second**
  author call; an injected count of 70 000 **rejects** before that call; an
  unavailable count (`null`) fails closed. Plus a direct decision-matrix test.
- **Deferred (documented):** wiring the exact count into the **paid runner/replay**
  path additionally requires recording the admission basis + exact count in the
  attempt receipt so replay can re-validate a bytes-over-ceiling admission **without**
  weakening hostile-tamper checks (a Round-1 relaxation attempt was reverted for
  exactly this reason), plus a live provider count. Until then the paid runner path
  stays on the proven conservative bound — numerically unchanged, v6 receipts/digests
  untouched, and the existing over-ceiling hostile-tamper replay test still rejects.
  This is an engineering-sequencing deferral, not a new product/policy decision.

### Round-2 validation

`blueprint-admission-honesty-and-capture.spec.ts` now 34 tests (F4 matrix +
exact-count lane open/close/fail-closed; complete-census + fail-closed overflow;
closed-vocabulary redaction incl. ASCII names + reload re-enforcement; the four
falsification families). `qa-wizard-blueprint-authoring-lifecycle.spec.ts` 39
(incl. the +5 capture-integration/replay/hostile tests). Adjacent suites green:
`production-lifecycle-foundation` (52), `pre-render-blueprint-authoring`,
`pre-render-blueprint-composition-policy`, `openai-responses-blueprint-authoring-adapter`,
`qa-wizard-blueprint-replacement-lifecycle` + `-cli`, `production-package-lifecycle`.
`npx tsc --noEmit` clean; `git diff --check` clean. No
provider/network/credential/live/render/DB/deploy/push; real `outputs/` only read.

## Round 3 — Codex HOLD F2/F3 correction (2026-08-30; supersedes the Round-2 capture claims where they conflict)

Codex's QA of the Round-2 capture work returned HOLD on three findings. This round
corrects the two decision-free **safety** findings only; Finding 1 (the paid
exact-token-count lane above) is **numerically unchanged and remains HOLD**, awaiting
Guy's cost-treatment decision. This is **not** a milestone PASS.

### F2 — census identity is sanitized-only (raw-tuple PII fingerprint removed)

The Round-2 capture persisted a per-identity `detailDigest =
canonicalJsonDigest([code, field, message, expected, actual])` — a deterministic,
unsalted SHA-256 over **raw** diagnostic content. With an empty message and no
expected/actual, that digest is a dictionary-attackable fingerprint of a redacted
name (guess `frames[0].<name>` over a short candidate list → match). The
"high-entropy, not a bare-name fingerprint" threat claim was false for that shape.

Correction (`blueprintAuthoringSanitizedFailureCapture.ts`):

- The census identity is defined by the **sanitized structural projection ONLY**:
  closed diagnostic `code`, closed-vocabulary/redacted `fieldPath`, `fieldPresent` /
  `fieldRedacted`, and `expectedPresent` / `actualPresent`. No raw
  message/field-value/expected/actual is consumed.
- `detailDigest` is removed; the persisted `identityDigest` is a one-way SHA-256 over
  that sanitized projection alone. On reload the validator **re-derives** it from the
  structural fields and requires an exact match, so it is provably a function of
  non-PII fields only.
- Grouping and counting are now over the sanitized identity: two raw diagnostics that
  differ only in never-retained prose collapse to one identity with a truthful summed
  count. Distinct-vs-repeated is truthful over what is actually persisted.
- Capture version cut **`v1 → v2`**; a legacy v1 artifact (which carried the raw-tuple
  digest) is rejected cleanly and can never revalidate under v2 (no persisted v1
  captures exist — the feature is unreleased).
- Regression: an exact dictionary-attack test (`schema_invalid` + `frames[0].Bar` +
  empty message / no expected/actual; candidates Avi/Bar/Dan/Sarah) asserts no
  persisted value equals or reveals the raw-tuple candidate digest; a merge test
  proves the sanitized grouping/count; all planted-prose/name regressions retained.

### F3 — a diagnostic-bearing failure never becomes an ordinary replayable terminal without a bound capture

The Round-2 runner derived the capture with a catch-all `try { … } catch { return
null }`, and a census overflow (> 4096) threw into that same null. The lifecycle then
coalesced `null → undefined` and published an ordinary `authoring_failed` terminal
with no capture — a diagnostic-bearing failure that replays as a clean completion
whose promised census is absent.

Correction (`productionAuthoringRunner.ts` + `qaWizardBlueprintAuthoringLifecycle.ts`):

- The derivation returns a **typed disposition** — `captured` /
  `diagnostic_less_absence` / `derivation_failed` (with a sanitized reason code) —
  governed by a single closed **capture-required failure-code set**
  (`repair_route_input_not_admissible`, `draft_validation_repair_exhausted`) shared by
  the runner and the lifecycle so they can never disagree.
- On first materialization, a `derivation_failed` disposition (including a census
  overflow) is thrown into the existing `execution_state_uncertain`/incident path
  **before** any terminal manifest, ownership binding, or lookup is published. The
  already-published receipt may remain; no replayable terminal/lookup claims
  completion.
- Replay and recovery reject any `authoring_failed` terminal whose failure code is
  capture-required but whose capture binding is absent — including a hostile or
  legacy-shaped/manual artifact — and continue to reject a missing/tampered bound
  capture.
- Diagnostic-less boundary failures are an explicit allowed absence (no capture) and
  replay cleanly. Complete-census semantics unchanged; capture linkage and manifest
  exact-key/version checks remain immutable and backward compatible.

### Round-3 validation

`blueprint-admission-honesty-and-capture.spec.ts` **36** (adds the exact
dictionary-attack + sanitized-merge regressions; v1-rejection retained as the
tampered-version case). `qa-wizard-blueprint-authoring-lifecycle.spec.ts` **+3**
(diagnostic-less allowed absence + replay; hostile capture-less diagnostic-bearing
terminal rejected on replay; census-overflow derivation failure driven to the
incident path). Adjacent green: `production-lifecycle-foundation`,
`qa-wizard-blueprint-replacement-lifecycle` (runner + replacement isolation),
`qa-wizard-package-lifecycle`, `provider-failure-diagnostics`. `npx tsc --noEmit`
clean; `git diff --check` clean.

**Pre-existing, unrelated:** `vitest-workload-classifier` expects 345 canonical specs
but disk carries 346 at HEAD `f2fb23be`; it fails identically before and after this
change (no spec file was added here) and is left untouched as out of scope.

No provider/network/API/credential/live/render/DB/deploy/push; real `outputs/`
artifacts were not touched. The Decision Gate is unchanged.

## Round 4 — Codex HOLD F3 correction (2026-08-30; supersedes Round-3 F3 claims where they conflict)

Codex's QA of the Round-3 F3 work returned **HOLD** on two related MAJOR findings
about the failure-capture disposition. This round closes both in the smallest general
form. Finding 1 (the paid exact-token-count lane) is **untouched and remains HOLD**;
this is **not** a milestone PASS. All F2 privacy/census protections are preserved.

### MAJOR A — the result contract is now total; first publication is no longer permissive

Round 3 left `ProductionAuthoringRunResult.sanitizedFailureCaptureDisposition`
**optional**, and `qaWizardBlueprintAuthoringLifecycle.ts` replaced a missing
disposition with `{kind:'diagnostic_less_absence'}` at first materialization. A
required capture-less failed terminal could therefore reach ownership
binding/terminal/lookup publication, with replay rejecting it only afterward.

Correction:

- `ProductionAuthoringRunResult` is now a **total discriminated union**
  (`productionAuthoringRunner.ts`): `preflight_passed` (no authoring result, no
  disposition), `completed` (authoring result present, no disposition), `failed`
  (no authoring result, **disposition mandatory**). The arms are keyed on
  `receipt.status`; a failed arm cannot omit the disposition (compile-time), and the
  three constructors (`preflightRunResult` / `completedRunResult` / `failedRunResult`)
  assert status/authoring-result/disposition consistency at **runtime**, so even an
  untyped caller cannot mint a contradictory result. Every runner return arm — the
  deterministic pre-provider failures included — flows through them.
- First materialization no longer defaults a missing disposition. It **re-derives**
  the requirement from the replay-valid ACTUAL receipt and **cross-checks** the
  disposition **before** publishing any terminal authority: required ⇒ only `captured`
  is admissible; non-required ⇒ only `diagnostic_less_absence`; any other combination
  (missing, malformed, `derivation_failed`, or a capture on a non-required failure) is
  torn state → `execution_state_uncertain`/incident, published receipt aside, with no
  terminal manifest/binding/lookup.

### MAJOR B — the capture requirement is derived from receipt evidence, not the terminal code alone

Round 3 keyed the requirement on a closed **code** set
(`repair_route_input_not_admissible`, `draft_validation_repair_exhausted`). A real
path — an initial invalid draft that produced grouped validation diagnostics followed
by a repair-time **`provider_call_failed`** (and the `local_processing_failed`
fallback that still carries structured diagnostics) — bound **no** capture and
replayed as a clean completion, losing the prior diagnostics.

Correction:

- One canonical receipt-evidence predicate
  (`blueprintAuthoringReceiptRequiresSanitizedCapture`,
  `blueprintAuthoringSanitizedFailureCapture.ts`): a capture is required iff the
  terminal failure **code** is in the closed mandatory set **OR** any attempt carried
  a non-empty grouped validation-diagnostic set (`validationDiagnostics` count/codes).
  The **single** predicate is used by the runner derivation, first materialization,
  replay (`loadExecutionRecord`), and recovery (`recoverTerminalLookup`), so the four
  sites can never disagree. A genuinely first-call diagnostic-less provider/boundary
  failure (no mandatory code, no attempt diagnostics) remains an explicit allowed
  absence.
- The census is derived only from the in-memory structured diagnostic sources that
  **correspond** to the failed receipt's diagnostic-bearing attempts. If that
  correlation cannot be proven (a receipt attempt declares grouped diagnostics but no
  matching in-memory source exists, or the derived census would be empty), the
  derivation returns `derivation_failed` (`sanitized_census_correlation_unproven`) —
  never an empty/partial census minted to satisfy the binding. Census overflow stays
  `derivation_failed`. Both drive the incident path at first materialization.
- Replay/recovery tear a `provider_call_failed` / `local_processing_failed` terminal
  that carries prior grouped diagnostics but no capture binding, exactly as for a
  mandatory-code terminal.
- Stale comments that said overflow "returns null" now describe the typed
  `derivation_failed` disposition and the incident path.

### Round-4 validation

- `blueprint-admission-honesty-and-capture.spec.ts` **41** (+5): the canonical
  receipt-evidence predicate — mandatory-code-alone; non-mandatory `provider_call_failed`
  + prior grouped diagnostics ⇒ required; `local_processing_failed` + diagnostic-bearing
  attempt ⇒ required; first-call diagnostic-less ⇒ not required; empty/malformed ⇒ not
  required (with codes-present/count-zero still diagnostic-bearing).
- `qa-wizard-blueprint-authoring-lifecycle.spec.ts` **43** (+1, +1 extended): the
  repair-time provider/credential failure with prior diagnostics now asserts the
  now-required bound capture is published, valid, linkage-bound, and preserved on
  zero-call replay; a new test fabricates the capture-stripped `provider_call_failed`
  terminal with prior diagnostics and proves replay/recovery refuse before any lookup
  with no provider load. The mock seam now overrides the canonical receipt-evidence
  predicate.
- `production-lifecycle-foundation.spec.ts` **57** (+5): total-result arms
  (preflight/completed/failed) carry consistent status/authoring-result/disposition; a
  first-call provider failure is an explicit allowed absence; a repair-time provider
  failure with prior grouped diagnostics binds a complete valid capture (no raw prose);
  and the derivation fails closed to `derivation_failed`
  (`sanitized_census_correlation_unproven`) when the census cannot be correlated.
- `openai-responses-blueprint-authoring-adapter.spec.ts` (20) green.
  `npx --no-install tsc --noEmit` clean; `git diff --check` clean.

**Pre-existing, unrelated:** the `vitest-workload-classifier` census (345 vs 346 on
disk) fails identically at HEAD and is untouched.

No provider/network/API/credential/live/render/DB/deploy/push; real `outputs/`
artifacts were not touched. F1 (paid exact-token count) remains a separate HOLD.

## Round 5 — Codex HOLD corrections on `70d9713a..4a52c3d3` (F3 MAJOR 1 + MAJOR 2 + doc MINOR)

Codex re-gated `70d9713a..4a52c3d3` **HOLD** (0 BLOCKER / 2 MAJOR / 1 doc MINOR): the
focused tests were green but did not falsify the replay/recovery capture-binding paths or
the census-correlation proof. Closed on top of `4a52c3d3` as one focused commit.

### MAJOR 1 — replay/recovery accepted contradictory and cross-bound captures

- Added ONE shared acceptance assertion,
  `assertTerminalObservabilityCaptureDisposition`, enforced identically at **first
  materialization**, **replay** (`loadExecutionRecord`), and **recovery**
  (`recoverTerminalLookup`). Recovery now runs the FULL assertion BEFORE writing the
  lookup, so a torn disposition tears with zero lookup written and no provider redispatch.
- The assertion enforces EXACT equivalence
  `captureRequired === Boolean(manifest.observabilityCapture)` — closing the
  previously-unchecked "not required but a capture is present" direction — and, when
  bound, reloads the canonical bytes and requires: manifest binding version/digest/path
  match; exact linkage to the CURRENT receipt (terminal receipt digest, request digest,
  context digest, terminal failure code); and exact containment at THIS `outputDir`'s
  canonical `sanitized-failure-captures/<digest>.json` location.
- `loadSanitizedFailureCaptureAuthority` now takes `outputDir` and rejects any capture not
  at the exact canonical path (previously any directory named `sanitized-failure-captures`
  anywhere under the repo was accepted); it returns the full validated capture so linkage
  can be compared. Existing missing/tamper checks are preserved (not weakened).
- Completed (`blueprint_candidate`) terminals stay exempt: they can be legitimately
  diagnostic-bearing (invalid draft repaired to a passing one) yet bind no capture, so the
  equivalence is scoped to `authoring_failed` terminals — identical to the prior guard.

### MAJOR 2 — census correlation now proves a complete bijection, not attempt-key presence

- Before minting a capture, the runner derivation establishes a COMPLETE bijection between
  every diagnostic-bearing receipt attempt and its in-memory structured source: forward,
  each such attempt's raw errors must RE-DERIVE (same canonical
  `sanitizedAuthoringDiagnostics` logic/source used to persist them) to the EXACT
  `{count,codes}` the receipt carries, AND its structured diagnostics must be complete
  (one structured diagnostic per raw error — cardinality linkage, not mere presence);
  reverse, every in-memory source carrying structured diagnostics must map to a matched
  attempt. Missing, partial, count-mismatched, code-mismatched, duplicate-attempt, and
  extra/unmatched evidence all return
  `derivation_failed` (`sanitized_census_correlation_unproven`).
- The real repair-time `provider_call_failed` path (attempt 1 has grouped validation
  diagnostics; the later provider failure has none) is preserved and still mints a capture.

### Documentation MINOR

- The stale comment on `BLUEPRINT_AUTHORING_CAPTURE_REQUIRED_FAILURE_CODES` no longer
  claims every code outside the closed set is diagnostic-less or that the code set alone
  governs runner/replay. It now states it is only the code-only MANDATORY subset and that
  `blueprintAuthoringReceiptRequiresSanitizedCapture` (mandatory code OR attempt
  diagnostics) is the single total requirement.

### Round-5 validation (serial)

- `blueprint-admission-honesty-and-capture.spec.ts` **41** green.
- `production-lifecycle-foundation.spec.ts` **64** (+7): a new `describe` proves the census
  bijection — valid fully-correlated shape mints a complete capture; count mismatch, code
  mismatch, partial structured source, duplicate attempt, and extra/unmatched evidence each
  return `sanitized_census_correlation_unproven`; and the real repair-time
  `provider_call_failed` path still mints a capture.
- `qa-wizard-blueprint-authoring-lifecycle.spec.ts` **46** (+3): real hostile filesystem
  regressions at the actual replay/recovery boundaries — (a) a diagnostic-less-classified
  terminal carrying a bound capture tears on replay (zero provider); (b) a required terminal
  re-signed on disk to rebind a VALID capture from another receipt tears on recovery before
  any lookup (zero provider); (c) a required terminal whose capture is bound under another
  output root tears on recovery before any lookup (zero provider). Existing required+missing
  rejection and normal exact replay stay green.
- `openai-responses-blueprint-authoring-adapter.spec.ts` **20** green.
- `npx --no-install tsc --noEmit` clean; `git diff --check` clean. Directly-affected
  `qa-wizard-blueprint-replacement-lifecycle.spec.ts` and `qa-wizard-package-lifecycle.spec.ts`
  (**27**) green.

No provider/network/API/credential/live/render/DB/deploy/push; real `outputs/` artifacts
were not touched. F1 (paid exact-token count) remains a separate HOLD.
