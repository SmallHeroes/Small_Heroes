# Decision Gate — R1D Book Surface repair-output identity and schema alignment

## Decision

Proceed with one bounded, zero-provider implementation milestone on immutable base
`425ffccefad1421c0a45a68cf9dbd60fba585d49`.

## Observed behavior

The exhausted post-admission live attempt completed one initial provider call and
one `book_surface_patch` repair call, then persisted only the broad terminal
diagnostic `repair_output_application_rejected`. The compiler converted the
underlying exception to `TemplateRepairOutputFailureCode` and discarded the safe
snake-case identity. Consequently, the durable receipt cannot distinguish
`book_surface_repair_prop_invalid` from an unexpected local failure.

The shared draft schema also permits two values that the deterministic appliers
reject: a blank recurring-prop `id`, and a non-positive or fractional
`pageNumber`.

## Expected behavior

A completed but unusable repair response must persist one closed, content-free
repair-output diagnostic with its exact compiler-owned identity when known, or
an explicit `unclassified` value otherwise. The response schemas must express
the deterministic non-blank recurring-prop identity and positive-integer page
number constraints before provider dispatch.

## Root cause

1. `TemplateRepairOutputInvalidError` retains only the broad failure code.
2. The failure-code mapper has no recurring-prop category for the two reachable
   Book Surface identities.
3. `VisualContractAuthoringTerminalFailure` has no repair-output-specific typed
   diagnostic binding, so `diagnosticCount` conflates carried draft diagnostics
   with the one repair-output failure.
4. The shared recurring-prop and page-contract schema members are weaker than
   their downstream exact-key/applier validators.

## Nine architectural decisions

1. Add a closed compiler-owned repair-output identity catalog. Arbitrary error
   messages, even if snake-case, are never persisted; unknown errors become
   `unclassified`.
2. Carry the sanitized identity on `TemplateRepairOutputInvalidError` together
   with the existing repair attempt, mode, and failure code. Raw output,
   provider messages, stacks, paths, prompts, and secrets remain excluded.
3. Add `recurring_prop_invalid` to the closed failure-code taxonomy and map both
   `book_surface_repair_prop_invalid` and
   `book_surface_repair_prop_change_not_authorized` to it. The exact identity
   remains available to distinguish them.
4. Add a Visual Contract-specific exact-key `repairOutputDiagnostics/v1`
   structure. Do not widen or weaken the shared
   `authoringTerminalFailureIsValid` structural predicate or count semantics;
   the required closed diagnostic-code enum extension remains closed. Do not
   change Blueprint receipt v4.
5. The diagnostic records `carriedDraftDiagnosticCount` and
   `repairOutputDiagnosticCount: 1`; the existing aggregate
   `failure.diagnosticCount` must equal their capped sum. This preserves
   compatibility while making the prior `39 + 1` semantics explicit.
6. Tighten the shared recurring-prop `id` schema with a strict-compatible
   non-whitespace `pattern`, and page `pageNumber` with `minimum: 1` and
   `multipleOf: 1`. Do not use unsupported `minLength`.
7. Because the shared members feed four structured-output schemas, cut over
   `vc-draft-schema/v15`, `page-contract-repair-schema/v2`,
   `structural-bundle-repair-schema/v2`, and
   `book-surface-repair-schema/v3`. Prompt versions and repair routing remain
   unchanged.
8. Cut over Visual Contract request/receipt/readiness and every canonical
   materialization/Supervisor/Fresh-Readiness binding that digests those
   contracts. Immediate predecessors remain `legacy_immutable`; historical
   artifacts are never rewritten.
9. Do not add correction hints, calls, repairs, retries, fallback, or provider
   behavior. A future paid attempt requires a brand-new Fresh Readiness after
   independent QA.

## Scope

- Compiler error identity and failure-code mapping.
- Visual Contract-specific terminal diagnostics and validators.
- Shared structured-output schema constraints.
- Lifecycle/version/digest migration and deterministic tests.
- `CURRENT.md` and implementation evidence.

## Explicitly unchanged

Model, Responses API endpoint, service tier, prompt text, reasoning effort,
64K input ceiling, 4,096-byte route margin, token/call/repair/cost budgets,
timeouts, retries, fallback, candidate semantics, Blueprint v4, Wizard behavior,
rendering, storage, deployment, and production behavior outside validation and
evidence classification.

## Acceptance criteria

- Every reachable repair identity is either in the closed catalog or persists
  as `unclassified`; no prose is persisted.
- Both recurring-prop identities receive `recurring_prop_invalid`, while unknown
  runtime failures remain `application_rejected`.
- Receipt and readiness round-trips accept canonical key sorting and reject
  identity/count/key/mode/attempt tampering.
- Blank recurring-prop IDs and invalid page numbers are rejected by schemas;
  valid existing fixtures remain compatible.
- Immediate predecessor artifacts classify `legacy_immutable`; new versions are
  current; later versions are unsupported.
- Focused tests, deterministic TypeScript, and `git diff --check` pass. One
  literal repository check may run only after focused green validation. The
  historical baseline was recorded as six ignored-fixture assertions; the
  immutable base already replaces the Set Appearance case with an isolated
  temporary fixture, so the current run may report the five remaining
  assertions. Any new assertion remains fail-closed.

## Rollback

Revert only this milestone's focused commits. No historical artifact migration
or data rewrite is required. A rollback invalidates any readiness created from
the new versions but does not alter prior immutable evidence.

## Stop check

This milestone performs no credential access, pricing lookup, network/provider
call, B0/Fresh Readiness, preflight, live authoring, candidate creation, render,
storage/database action, QA deployment, production deployment, or push.
