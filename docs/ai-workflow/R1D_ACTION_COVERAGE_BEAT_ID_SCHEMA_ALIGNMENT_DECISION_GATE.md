# R1D Action Coverage Beat-ID Schema Alignment — Decision Gate

**Date:** 2026-08-24

**Status:** approved for provider-free diagnosis and implementation by Guy's
explicit instruction to continue without stopping; no second live attempt is
authorized by this implementation gate

## 1. Observed behavior

The single accepted-v3 live authoring attempt produced three completed provider
responses and no Candidate. The complete unique issue census moved
`58 -> 47 -> 49`; the existing complete-census regression guard correctly
stopped the second repair. The receipt records 50, then 39, then 41
`action_semantic/beat_identity_out_of_scope` issues and eight persistent
`final_structural_invariant_invalid` issues caused by
`page_action_requirements_invalid`, one per page.

## 2. Root cause hypothesis

The whole-draft structured-output schema constrains
`actionRequirements[].beatId` to
`^beat:p[1-9][0-9]*:[a-z0-9_]+$`, but leaves
`actionSemanticCoverage[].beatId` as an unconstrained string. The compiler
nevertheless requires each coverage beat to match the stricter page-specific
`^beat:pN:[a-z0-9_]+$` contract and uses the beat identity to bind coverage to
an action. The provider therefore completed schema-valid drafts that the
compiler universally rejected at the next boundary.

The eight structural failures are expected downstream effects: invalid
coverage identities cannot bind the otherwise schema-valid action beat IDs,
so compiler-owned action check IDs are not minted and page action requirements
remain structurally invalid.

## 3. Proposed general fix

Create one shared draft beat-ID schema authority and reuse it for both action
requirements and action semantic coverage. State the exact same-page format and
copy/binding rule in the shared initial/full-draft system prompt. Preserve the
compiler's stricter page-number validation as the final fail-closed authority.

Do not normalize or guess malformed identities, change the action catalog, or
introduce story-specific IDs. The model still chooses descriptive suffixes;
the schema closes lexical shape and the compiler closes page/binding identity.

## 4. Scope

- `templateDraftSchema.ts`: shared beat-ID schema and schema version.
- `compileBookVisualContractTemplate.ts`: exact shared prompt wording and
  affected system-prompt versions.
- canonical request/materialization versions that bind schema/prompt identity.
- focused schema, compiler, repair-loop, prompt-budget and compatibility tests.
- `CURRENT.md` and immutable local evidence.

## 5. Acceptance criteria

1. Initial and full-draft structured-output schemas expose the exact same
   beat-ID pattern on action and coverage records.
2. Invalid lexical coverage IDs are rejected at schema authority rather than
   surviving to compiler repair.
3. A syntactically valid wrong-page coverage ID remains rejected by the
   compiler; no silent normalization is introduced.
4. A valid same-page action/coverage pair binds once and does not emit
   `beat_identity_out_of_scope` or page action structural failure.
5. Offline harness proves an invalid-identity draft can be replaced by one
   valid full draft with non-increasing complete issue census and zero provider
   calls.
6. All accepted and historical prompt inputs remain under the unchanged 64K
   ceiling.
7. Structured-output compatibility remains `compatible`.
8. Model, budget, call count, retries, fallback, action catalog, accepted Story
   Source, continuity authority, package, locator, Wizard and renderer remain
   unchanged.

## 6. Cost and execution boundary

This milestone is `$0`: no credential read, provider, network, image, Vision,
audio or render operation. The failed live evidence is immutable and must not
be deleted or rewritten. A green local fix requires independent QA before a
new spend decision; it does not inherit the previous one-attempt authority.

## 7. Rejected alternatives

- More repair calls, higher budget, retry, fallback or another model: unrelated
  to the schema/validator mismatch and explicitly excluded.
- Story-specific beat IDs or Chameleon patches: violates generality.
- Compiler coercion of arbitrary strings: can hide wrong-page/cross-action
  binding and weakens authority.
- Ignoring the regression guard: would spend from a worse state.

## 8. Rollback

Revert the focused schema/prompt/version commit. The failed live output root,
accepted revision, package, locator and Boards remain untouched.
