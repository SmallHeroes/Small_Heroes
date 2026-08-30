# R1D — Blueprint Admission Honesty + Sanitized Failure Observability (implementation evidence)

**Implementer:** Claude Code (delegated). **QA:** Codex (pending). **Product:** Guy (approved framing).
**Branch:** `codex/r1d-order-package-authority-binding`. Offline only. Not pushed.

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
