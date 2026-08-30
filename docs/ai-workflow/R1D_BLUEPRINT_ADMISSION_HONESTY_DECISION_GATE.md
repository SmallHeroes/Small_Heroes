# Decision Gate — Blueprint Admission Honesty + Sanitized Failure Observability

**Owner authority to fill this in:** Claude Code (delegated implementer for this milestone).
**Product approval:** Guy (recorded verbatim below).
**Independent QA:** Codex (no PASS is self-awarded here).

## Guy's approval (verbatim)

> "Blueprint Admission Honesty + Sanitized Failure Observability: correct
> byte/token units, sanitized structural capture without prose or PII, complete
> census and production-scale offline harness. Claude implements, Codex QA; no
> provider, live or render until PASS."

## Real terminal evidence consumed (immutable, read-only)

- Receipt: `outputs/r1d-lantern-blueprint-wire-20260830T044048214Z/blueprint-authoring/authoring-receipts/4c33108016513c06dc6b5d12c0d8ef7c21e0b38f91edb5d71d52ea27c1ce8031.json`
- Recorded `inputAccounting.estimatedBytes = 61502` (a UTF-8 **byte** sum incl. the
  4096 protocol allowance) vs. real provider `usage.inputTokens = 12007`
  (**tokens**). `schemaBytes = 20753`. Initial attempt `validationDiagnostics =
  { codes: [authority_reference_validation_failed, draft_contract_validation_failed,
  draft_schema_validation_failed], count: 86 }`. Terminal `failure.code =
  repair_route_input_not_admissible`, `errorClass = input_limit_violation`,
  `diagnosticCount = 86`.
- The 86 concrete diagnostic identities and the real draft are **not persisted**
  anywhere; only the three category codes + count survive. They remain
  **unknowable** and this milestone does not reconstruct or synthesize them.

## 1. Proposed change

Two coupled, offline-only corrections to the **Blueprint** authoring lifecycle
(not the Visual Contract compiler, not Chameleon/Bar/page/story specifics):

1. **Admission honesty.** Today the admission gate compares
   `BlueprintAuthoringInputAccounting.estimatedBytes` (a UTF-8 byte sum) directly
   against `BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS = 64_000` (a *token* ceiling), in
   both the initial and repair paths. That is a bytes-vs-tokens unit confusion.
   Introduce one **named, versioned, proven** admission authority:
   `blueprint-authoring-conservative-input-token-admission/v1` whose quantity is a
   **conservative upper bound on the provider input-token count**, and route every
   Blueprint admission decision through it. Byte accounting is preserved verbatim
   as **observability** (so persisted v6 receipts and their digests are untouched).

   **Proof of the bound (offline, no tokenizer, no dependency, no guessed ratio):**
   the canonical Blueprint model uses a byte-level BPE tokenizer (o200k_base
   family). Text is UTF-8 encoded to bytes; every byte is already a base vocab
   token; BPE only *merges* adjacent tokens and never splits. Therefore for any
   admitted text `t`, `tokenCount(t) <= utf8ByteLength(t)`. Concatenation can only
   add merges across segment boundaries, so the sum of per-segment byte lengths is
   also an upper bound on the whole. Hence `estimatedBytes` (Σ segment bytes + a
   conservative token framing allowance) is a **proven conservative upper bound**
   on provider input tokens. Admitting only when the bound ≤ ceiling guarantees the
   real token count ≤ ceiling — the ceiling is **not weakened**. The bound's error
   is `bytes − tokens ≥ 0` (for the real incident: `61502 − 12007 = 49495` tokens
   of slack), i.e. the bound is safe and conservative, never under-admitting.

   A tighter, exact-tokenizer-backed policy is deliberately **deferred** to a future
   explicit version cutover (needs a decision on shipping/auditing a tokenizer
   offline). It is **not guessed** here.

2. **Sanitized failure observability.** Add a versioned, content-addressed,
   fail-closed **structural** projection artifact
   (`blueprint-authoring-sanitized-failure-capture/v1`) that a future failing run
   emits alongside the immutable receipt. It carries: a complete bounded
   normalized **diagnostic census** (distinguishing repeated symptoms from distinct
   structural defects via per-identity digests + repetition counts), the exact byte
   accounting **and** the conservative token admission accounting for **both** the
   admitted initial route and the **rejected** repair route, content-addressed
   linkage to the terminal receipt, explicit `doesNotAuthorize` semantics, and
   bounded size/count/string + deterministic redaction/hash policy. By construction
   it holds **no** narrative prose, source phrases, labels/names, prompts, raw
   provider output, or PII — every retained string is constrained to a closed
   alphabet (enum code, hex digest, bounded snake_case, safe path token, version).
   The historical failed attempt **cannot** be retroactively upgraded; docs say so.

## 2. Why now?

The real R1D lantern run stopped at `repair_route_input_not_admissible` on a
**dishonest unit comparison**, and its failure evidence collapsed 86 symptoms into
3 category codes with no structural identities — so neither the admission decision
nor the failure could be audited. This blocks trustworthy paid Blueprint authoring.
It is a correctness/observability defect, not a currently-red unit test.

## 3. Scope

General Blueprint system change. Not story/child/companion/page-specific. The
identical-looking Visual Contract compiler twin (`VISUAL_CONTRACT_AUTHORING_*`) is
**out of scope** (separate spend authority, separate version cutover) and is only
noted for Codex.

## 4. Risk of hardcoding

None intended. The bound is a general tokenizer-family property; the capture is a
general projection over the existing diagnostic vocabulary and accounting shapes.
No story, child, companion, or page is referenced.

## 5. Files likely affected

- New: `lib/visual-package/blueprintAuthoringInputTokenAdmission.ts` (policy).
- New: `lib/visual-package/blueprintAuthoringSanitizedFailureCapture.ts` (capture).
- Edit (route through named predicate; numerically preserving):
  `preRenderBlueprintAuthoring.ts`, `productionAuthoringRunner.ts`,
  `openaiResponsesBlueprintAuthoringAdapter.ts`,
  `qaWizardBlueprintAuthoringLifecycle.ts` (receipt-validation comparisons only).
- Additive: thread structured `diagnostics` on the internal repair attempt and
  emit/return the capture from the runner failure path; a sibling persist helper.
- New tests + production-scale offline harness under `lib/visual-package/__tests__/`.
- Docs: this gate, `CURRENT.md`, an evidence file.

## 6. Expected behavior after change

- Initial and repair admission both compare a **proven conservative token upper
  bound** to the token ceiling — one unit, one authority. Numeric outcome at the
  ceiling is unchanged (existing receipts/digests/tests stay valid); the contract
  is now honest and testable.
- Real overflow still fails **before** any provider reachability.
- A future failing run can emit a sanitized capture with a complete census and
  both-route accounting, provably free of prose/PII, fail-closed and versioned.

## 7. Validation plan

Focused new/changed specs + a production-scale offline harness (≥8-page whole-book
shape, schema-sized input, large mixed 86-style census). Adjacent Blueprint
runner/lifecycle/replacement suites, `npx --no-install tsc --noEmit`,
`git diff --check`, and one `npm run check`. No full book render.

## 8. Cost impact

Zero. No provider/network/credential/live/render/DB/deploy. Offline only.

## 9. Rollback plan

New modules are additive; admission edits are numerically identity-preserving and
revert to the prior bare comparison trivially. No data migration; v6 receipts
untouched. Single focused local commit, not pushed.

## 10. Review assignment

- **Guy** already approved the milestone framing (above). No further product
  decision is required to implement the approved offline scope.
- **Codex** should try to falsify: (a) the conservative-bound proof and that the
  ceiling is not weakened; (b) that admission is one unit across both routes and
  overflow still fails pre-provider; (c) that the capture leaks no prose/PII and is
  fail-closed under tamper/oversize/missing-census/route-mismatch; (d) census
  completeness (no dropped/duplicated identities; repeated-vs-unique explicit);
  (e) no provider factory/credential reachable by harness/tests; (f) v6 receipt
  replay and real-artifact preservation.

## 11. Do not do

No provider/network/credential access, no live/replacement/candidate/blueprint
approval, no Wizard/image/audio/render, no DB/storage/deploy, no push. Never mutate
the consumed real artifacts under `outputs/`. Do not synthesize the missing draft
or the 86 hidden identities. Do not introduce a chars/bytes ratio presented as
exact tokens. Do not change model/reasoning/output/budget/no-fallback/retry/cost
ceiling/schema/prompt-creative/provider-adapter behavior.

## Stop-check (STOP_BEFORE_MAJOR_ACTIONS)

1. General system fix (Blueprint admission + observability), not a patch.
2. Could it break another story/child/companion/style? No — numerically
   identity-preserving admission; additive capture; no prompt/anchor/style touch.
3. Affects production behavior? Only the honesty/observability of the admission
   contract and a new failure-path artifact; the ceiling decision is unchanged.
4. Spends money? No.
5. Smallest safe validation: focused specs + offline harness; no render.
6. Guy decision before implementation: already granted (verbatim above).
7. Claude Code / Codex falsification targets: see §10.
8. Claude Cowork product/creative question: none.
9. Guy eyeball: the honesty framing (numbers unchanged) and the capture shape.

**Decision:** proceed with the approved offline milestone. No stop rule triggers —
the token authority is a *proven conservative bound* (no unresolved tokenizer
decision), and the capture's prose/PII-freedom is a *structural, testable*
guarantee.
