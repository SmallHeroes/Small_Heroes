# R1D Blueprint Provider-Wire Input Compaction — Decision Gate

Status: approved for offline implementation by Guy on 2026-08-29. Provider, live authoring, and render remain blocked until the implementation is independently re-gated by Claude Code.

## 1. Proposed change

Replace the Blueprint author's current full-artifact prompt with a compact, typed provider-wire projection derived from the already-validated Story Source, Visual Contract, reconciliation, and style authority. The complete canonical inputs remain in memory and continue to control deterministic overlay, post-call validation, persistence, approval, packaging, and rendering.

Add the same conservative UTF-8 byte accounting used at the provider boundary to preflight, so an oversized initial prompt is rejected before an execution claim, credential access, provider construction, or paid dispatch. Keep every repair prompt under the same ceiling.

## 2. Why now?

The first bounded Blueprint execution stopped before dispatch with `input_token_ceiling_exceeded`: 188,654 estimated bytes versus the unchanged 64,000-byte ceiling. The provider was never called and cost remained $0. The current prompt serializes the full 87,566-byte Source Prompt Reconciliation even though that artifact's contract says it is offline authoring/promotion evidence and never becomes prompt text. Preflight validated authority shape but did not validate prompt admission, so the terminal failure was discovered too late.

This blocks the new-story Wizard path before a Blueprint Candidate can exist.

## 3. Scope

General system change. It applies to every Blueprint-authoring story and is not specific to Bar, Kim, Chameleon, one page, one companion, or one style.

## 4. Risk of hardcoding

The projection must be derived only from typed canonical fields. No story prose, story key, character identity, companion state, wardrobe, location, zone, prop, action, safety, transition, or page-number special case may be hardcoded.

Provider-visible free prose must use the approved marker-free spatial projection. Canonical spatial IDs remain internal authority and must still control overlay and validation.

## 5. Files likely affected

- `lib/visual-package/preRenderBlueprintProviderWire.ts` (new typed projection)
- `lib/visual-package/preRenderBlueprintAuthoring.ts`
- `lib/visual-package/preRenderBlueprintAuthoringContract.ts`
- `lib/visual-package/preRenderBlueprintLifecycle.ts` (legacy prompt-version acceptance only if required)
- `lib/visual-package/productionAuthoringRunner.ts`
- focused Blueprint authoring, lifecycle, runner, and provider-boundary tests
- `CURRENT.md` and implementation evidence

## 6. Expected behavior after change

- Preflight and execution derive byte-identical initial prompts from the same validated context.
- The approved eight-page Chameleon context fits below 59,904 bytes before the 4,096-byte protocol allowance, with measurable headroom under the unchanged 64,000-byte conservative ceiling.
- The provider receives exact story page prose plus compact world, cast, prop, spatial, action, safety, transition, camera, wardrobe, and companion-state obligations needed to author the provider-owned world plan and frame fields.
- The provider does not receive the full reconciliation artifact, digests-as-instructions, internal marker syntax, or compiler-owned output fields.
- The compiler still overwrites identity, Visual Contract, aspect ratio, coordinate space, location, zone, cast, prop lifecycle, text-safe region, transition kind, and previous-frame identity from the complete canonical context.
- Post-call validation remains against the complete canonical context. Omitted wire data never weakens acceptance.
- Initial and bounded repair prompts use the same authority projection. Every dispatched repair remains under the same ceiling; a repair that cannot fit is classified terminally before another provider call.
- Existing approved v5-prompt Blueprint/package artifacts remain loadable and sellable; new authoring records a new prompt version.

## 7. Validation plan

1. Unit-test deterministic, marker-free provider-wire projection and compiler-owned field preservation.
2. Census the exact approved Chameleon production context and prove initial plus worst-case repair admission under the existing ceiling.
3. Prove preflight rejects an oversized projection before execution claim, provider/credential access, or write.
4. Prove the runner and adapter independently reject a genuinely oversized initial or repair prompt.
5. Prove hostile mutations of canonical authority are still rejected even if the mutated field is compacted or omitted from provider wire.
6. Run focused suites, `npx tsc --noEmit`, `git diff --check`, and `npm run check` if the focused battery is green.
7. Commit one focused offline milestone and obtain an independent Claude Code PASS before any new live attempt.

No image or full-book render is part of this milestone.

## 8. Cost impact

Offline implementation and QA cost $0 in provider/image/audio spend. No credential is needed. After Claude PASS, a fresh single bounded Blueprint authoring attempt may use the already authorized key under the unchanged $5 hard ceiling, three-call maximum, two-repair maximum, no fallback, and zero transport retries.

## 9. Rollback plan

Revert the focused commit. Existing artifacts remain valid because their bytes are untouched and their legacy prompt version remains accepted. The consumed terminal request remains immutable evidence and will not be replayed.

## 10. Review assignment

Guy approved the offline architecture and autonomous continuation, with the condition that failures stop the live path and are diagnosed with Claude before a decision. Claude Code must try to falsify:

- authority loss caused by compaction;
- unresolved `[spatial:id]` leakage;
- preflight/execution prompt mismatch;
- execution claim or credential/provider access before ceiling rejection;
- repair prompts that exceed the ceiling;
- accidental policy, model, schema, budget, retry, fallback, Candidate, Wizard, render, or legacy-package drift;
- story-specific branches or hardcoded Chameleon data.

Claude Cowork review is not required: this is an engineering boundary correction, not a new product or creative decision.

## 11. Stop-check disposition

1. General system fix: yes.
2. Cross-story risk: yes; controlled by typed projection, exact-context census, hostile tests, and legacy acceptance.
3. Production behavior affected: prompt assembly and preflight admission only.
4. Spend: none during this milestone.
5. Smallest proof: exact approved-context offline census and focused tests.
6. Owner decision: already granted by Guy.
7. Independent falsification: assigned above.
8. Product/creative review: not required.
9. Guy eyeball: the next successful bounded Candidate/visual proof, after technical PASS.

## 12. Do not do

- Do not raise or reinterpret the 64,000-byte conservative input ceiling.
- Do not add a tokenizer dependency.
- Do not change model, reasoning effort, output schema, max output, call count, repair count, cost ceiling, retries, fallback, or storage policy.
- Do not weaken full-context validation or deterministic overlay.
- Do not mutate existing Story Source, reconciliation, Visual Contract, Blueprint, package, approval, locator, or render artifacts.
- Do not call a provider, run live authoring, create a Candidate, render, deploy, or push during this milestone before Claude PASS.
