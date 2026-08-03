# Decision Gate - R1D-PVB-D1A1B1 Draft Authority and Reference Domain Hardening

Status: **DRAFT / HOLD pending Guy approval**

Mode: repository investigation and architecture only

Investigated authority: `c2e44cfac55e99772567b29ed081b0677bdddf06`

## 1. Proposed change

Harden the general Visual Contract authoring boundary so model-authored descriptive data cannot invent or drift across four closed reference domains:

1. action `checkId` identity;
2. page-zone spatial-node identity;
3. recurring-prop identity used by stable-board fixed objects;
4. spatial-relation arity, especially unary `centered_in`.

The compiler, not prompt prose, will own deterministic identifiers and projections wherever the value is derivable from already-approved Story Source or contract authority. Values that require an actual semantic choice remain model-authored but must be selected from explicit, typed, closed input domains and fail locally before provider access when the domain is absent or ambiguous.

## 2. Why now?

The latest live attempt reached the provider and returned a completed structured response, proving the credential, transport, model, schema-compatibility, and provider-response boundaries. Local validation then produced 49 structural failures split across four distinct domains: 37 `checkId`, 5 spatial-node, 6 fixed-object/recurring-prop, and 1 relation-arity failure. A whole-draft repair was selected but exceeded the unchanged 64K input ceiling before a second provider call.

This blocks the first current-authority Visual Contract candidate and therefore blocks Blueprint approval, Wizard qualification, and the smallest LOW portrait page render. Treating all 49 as one `checkId` problem would leave three proven gaps open.

## 3. Observed behavior, expected behavior, and root cause

### Observed

- The draft schema accepts arbitrary strings for action `checkId`; the prompt calls them stable/page-scoped but does not expose the validator's exact `^action:[a-z0-9_]+$` namespace.
- Action Semantic Coverage binds to the same draft-authored `checkId`, so one invented identifier can contaminate two linked structures.
- Typed spatial entity references resolve only against `spatialNodes` of the page's own zone. The draft asks the model to author actions that may target spatial nodes, while the page-zone authority exposed to the model does not provide a closed node-selection domain equivalent to the validator's domain.
- Stable-board `fixedObjects[].propId` is an unrestricted draft string, but validation requires an exact recurring-prop identifier with stable placement and page-safe lifecycle semantics. The model used architecture-like `fixed_*` identifiers instead.
- One schema shape gives all relations a nullable `objectId`, while runtime validation treats `centered_in` as unary and forbids the field.
- Full-draft repair resends the complete prior draft plus authority and errors. It is inappropriate for deterministic identifier/arity defects and exceeded the existing 64K input ceiling.

### Expected

- A valid provider response either compiles deterministically to the closed authority domains or fails locally with a precise, typed ambiguity before any live attempt is armed.
- Descriptive authorship never owns identifiers already derivable from Story Source, page number, beat identity, zone structure, recurring-prop authority, or relation kind.
- A repair call is not spent on deterministic local normalization, and no invalid reference can be silently dropped, fuzzy-matched, or force-fit.

### Root cause

The systemic defect is **split ownership between permissive authoring shapes and stricter runtime reference domains**. The prompt/schema currently ask the model to emit several identifiers and relation fields whose exact legal domain is owned elsewhere by compiler/validator authority. The 49 errors are the runtime manifestation of that ownership split, not one story's content defect.

## 4. Scope and hardcoding risk

This is a general system change for every Story Source. The captured story and its error strings are regression fixtures only. Production code must contain no story ID, page-specific literal, named character, named room, or named prop from the calibration attempt.

The change must not reinterpret narrative meaning, add action predicates, or force a story beat into an existing semantic. It only closes identifier, reference-domain, and relation-shape ownership around already-selected semantics.

## 5. Nine proposed architectural decisions

1. **Compiler-owned action IDs.** Derive each action `checkId` deterministically from its same-page Action Semantic Coverage `beatId` (or another explicit compiler-owned stable key), then rewrite the linked coverage disposition and action requirement together. The model no longer authors an unconstrained identifier.
2. **No fuzzy action binding.** Compilation requires exactly one same-page action and exactly one coverage record for the stable key. Missing, duplicate, or conflicting bindings fail closed; order, prose similarity, and normalized-string guessing are forbidden.
3. **Explicit page spatial domain.** Add a typed, current-authority page-zone spatial selection domain derived from the approved zone/set structure. A spatial action may select only an advertised node ID for that page's exact zone. Set-board area IDs and page-zone node IDs are not assumed interchangeable.
4. **Explicit set-area-to-zone projection.** Where set-board geometry must feed page zones, persist a typed binding/projection with exact IDs and one-to-one or declared one-to-many cardinality. The compiler creates the page-zone node view; the model may not invent a cross-domain alias. Ambiguous or absent mappings fail before authoring readiness.
5. **Separate architecture from recurring props.** Fixed architectural geometry remains in `spatialNodes`. `fixedObjects` may reference only exact, explicitly supplied recurring-prop IDs that are safe on every consuming page and have stable placement. The compiler/schema supplies this allowlist; invalid entries are rejected, not silently discarded.
6. **Typed relation variants.** Encode `centered_in` as a unary typed-const variant with no `objectId`; encode binary relations as variants requiring `objectId`. Validate the serialized schema against the existing OpenAI Structured Outputs compatibility profile and its depth limit.
7. **Local deterministic normalization before repair.** Compiler-owned ID rewrites, exact domain projection, and typed relation normalization occur before semantic validation and do not consume a provider repair. A wrong non-null binary operand, unknown target, or ambiguous binding remains a terminal local failure.
8. **Versioned authority cutover.** Bump the draft schema/prompt and every lifecycle/B0/Execution/readiness digest that binds changed authority. Old requests, receipts, readiness artifacts, and candidates remain immutable historical evidence and are not current authority. Any migration is explicit, offline, deterministic, and fail-closed; no loader fallback.
9. **No budget expansion.** Keep `gpt-5.6-sol`, service tier, 64K input ceiling, output ceiling, initial/repair call budget, transport retries, fallback, timeout, `$4.884` reservation, and `$5.00` hard ceiling unchanged. First prove the captured four-domain matrix compiles without a full-draft repair. A future compact structural-repair mechanism, if still necessary, requires a separate Decision Gate.

## 6. Likely implementation surface and commit boundaries

Likely modules, subject to implementation-time topology verification:

- `lib/visual-contract-compiler/templateDraftSchema.ts`
- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- `lib/visual-contract-compiler/validateBookVisualContract.ts`
- `lib/visual-contract-compiler/setBoardStableAuthority.ts`
- Action Semantic Coverage/source-authority helpers
- `lib/visual-package/visualContractAuthoringLifecycle.ts`
- B0/live-request/readiness binding and verification modules
- Blueprint feasibility and Wizard/runtime qualification tests
- focused fixtures under `lib/**/__tests__`

Recommended green commits:

1. compiler-owned action identity plus typed relation variants;
2. explicit page spatial and set-board/recurring-prop reference domains;
3. lifecycle/schema migration, B0/readiness bindings, Blueprint/Wizard qualification, and documentation.

No implementation branch or worktree is authorized by this gate draft.

## 7. Validation and acceptance criteria

The smallest zero-cost proof is a captured, story-neutral fixture matrix representing all four observed classes plus hostile ambiguity cases.

Acceptance requires:

- all 49 captured failures map to the four exact classes and compile without provider repair when their semantic inputs are otherwise valid;
- action and coverage IDs are stable across array reordering and are changed together;
- missing/duplicate beat-action bindings fail closed;
- page actions cannot reference a board-area node unless an exact current-authority projection binds it to the page zone;
- fixed architecture cannot masquerade as a recurring prop, and unsafe/lifecycle-gated props cannot enter stable-board fixed objects;
- `centered_in` cannot serialize an `objectId`; binary relations cannot omit one;
- Structured Outputs compatibility passes with measured depth/headroom;
- old schema/request/readiness/candidate versions are rejected as current authority and retained byte-immutable;
- B0 materialization/verifier, canonical readiness, Blueprint feasibility, runtime authority, and Wizard qualification bind the new digests and reject stale ones before a provider/image sentinel;
- model, budget, retry, fallback, timeout, accounting, and render behavior remain byte/behavior unchanged where not explicitly version-bound;
- focused suites, deterministic TypeScript, and one `npm run check` run complete under the implementation authorization, with any known baseline separated from new failures.

After independent Claude Code technical PASS, the next operational proof remains one bounded authoring attempt. Only after a valid candidate, Semantic Reconciliation, human approval, Blueprint authoring/review/approval, and Wizard/runtime qualification may Guy separately authorize one LOW portrait page render. No full-book render is part of this gate.

## 8. Cost impact

Planning and implementation are `$0`: code, fixtures, local artifacts, and tests only. No pricing lookup, credential access, provider call, authoring, render, Vision, storage, or database boundary is needed to implement or validate the hardening.

The future live attempt retains the existing hard `$5.00` ceiling and requires a new explicit authorization. The future LOW portrait page render is a separate Decision Gate and explicit spend decision.

## 9. Migration and rollback

- Historical v10 draft/B0/readiness/receipt artifacts remain immutable evidence.
- Current loaders reject historical authority rather than translating it implicitly.
- If an offline migration is needed for local fixtures, it must rebuild from Story Source/current authority, emit new content-addressed bytes, and preserve the source artifact.
- Rollback is commit-level: revert the new compiler/schema/reference-domain commits together and keep the current live path on HOLD. Do not reactivate old readiness or candidates.

## 10. Risks and rejected alternatives

Risks:

- A set-area/page-zone mapping that is too permissive could bind geometry to the wrong page.
- Compiler-owned IDs can become unstable if derived from array position or mutable prose.
- Typed relation variants can consume the remaining Structured Outputs nesting headroom.
- Silent filtering could hide authoring defects and weaken reviewability.

Rejected:

- Prompt-only instructions for the regex or allowed IDs.
- Story-specific substitutions for the 49 observed values.
- Fuzzy matching between board areas, zones, nodes, or props.
- Treating fixed architecture as invented recurring props.
- Silently deleting invalid objects/relations.
- Raising the 64K ceiling, call count, retry count, fallback, or `$5.00` cap.
- Adding a general repair framework before deterministic ownership is fixed.

## 11. Review assignment and owner decisions

Guy must approve or reject the nine decisions, especially the explicit set-area-to-zone projection and compiler ownership of action IDs. No product/creative decision is required unless the new spatial projection exposes a genuinely ambiguous world layout; that ambiguity must return to Guy rather than be guessed.

After implementation, Claude Code should try to falsify domain completeness, identifier stability, ambiguity rejection, historical-version fences, schema-depth compliance, repair ineligibility, B0/readiness binding, and provider/image unreachability on stale authority.

Guy's first visual checkpoint remains the later LOW portrait page: verify composition, spatial logic, object affordances, story clarity, safety, style, and Wizard personalization. Automated validation cannot provide that product PASS.

## 12. Do not do

No implementation, credential loading/check, pricing/network/provider/model call, live authoring, B0/readiness run, render, image/Vision, storage/database, Board action, Semantic Reconciliation, approval, publication, promotion, production activation, deployment, or push is authorized by this planning gate.
