# R1D Full-Draft Source Regeneration and Bounded Child Output — Decision Gate

**Date:** 2026-08-15
**Owner:** Guy (product intent), Codex (technical execution)
**Base:** `21ff6c15e37037b769aefef96e5e400f810d0baa`
**Scope:** general Visual Contract repair admission and canonical live child-output transport only

## Observed behavior

The consumed Leo v9 attempt passed Fresh Readiness, official pricing,
canonical preflight and Supervisor verification. The initial call and one
page-spatial-reference repair completed. The remaining mixed structural and
action-semantic failures selected the final `full_draft` repair, but its input
exceeded the unchanged conservative 64K admission ceiling before provider
reachability. The persisted receipt records two logical calls, one repair,
zero transport retries, no fallback, no candidate and conservative accounting
of `$0.961006`.

Independently, the canonical live child serialized its complete result,
including the long diagnostic receipt, to stdout. The Supervisor's existing
64KB child-output guard terminated that transport with
`child_output_limit_exceeded` after the canonical receipt and readiness were
already durable.

## Root cause

1. The v12 full-draft repair input is lossless but its dictionary codec only
   guarantees substantial reduction when values repeat. A provider-authored
   invalid draft can contain enough unique descriptive and diagnostic material
   to remain above 64K.
2. The live CLI exposes the full in-memory canonical result even though the
   durable artifacts are the authority and the Supervisor intentionally
   suppresses child stdout/stderr. Large sanitized diagnostics can therefore
   trip the output guard without adding operator value.

## Approved architectural decisions

1. The final `full_draft` lane becomes source-authority regeneration: it uses
   the same complete compiler-owned Story Source input that passed initial
   admission plus closed typed failure identities. It does not transport the
   previous provider draft or prose validation messages.
2. Typed issues are canonicalized, deduplicated and encoded through a closed
   versioned tuple with canonical code, field-role and collection-role
   dictionaries. Invalid, duplicate, non-canonical or unused dictionary
   material fails locally; no prose parsing or story-specific routing is
   permitted.
3. The repair system prompt is the complete initial authoring authority plus a
   short repair contract. The response remains the same complete strict
   `BookVisualContractTemplateDraft` schema.
4. The compiler continues to overlay deterministic identities, presence and
   policy fields and to run every validator. Source regeneration grants no
   candidate authority by itself.
5. The model, service tier, 64K ceiling, output/call/repair/cost budgets,
   timeout, retries, no-fallback policy and candidate semantics do not change.
6. The live authoring CLI emits a bounded sanitized summary containing only
   status, versions, digests, counts, failure code and persistence locations.
   Full receipt/readiness diagnostics remain content-addressed artifacts.
7. The Supervisor's 64KB guard remains unchanged. Oversized or unexpected
   child output remains terminal.
8. Prompt versions and all lifecycle/readiness bindings advance explicitly;
   historical artifacts remain immutable and are not authority for a new run.
9. The correction is accepted only after direct regression tests, lifecycle
   bindings, TypeScript, the repository gate, independent Claude Code review,
   a new Fresh Readiness authority and a new bounded live attempt.

## Rejected alternatives

- Raising the 64K input ceiling or Supervisor output ceiling.
- Truncating a previous draft or diagnostic prose without a closed contract.
- Gzip/base64 material the model cannot deterministically decode.
- A Leo/page/companion-specific repair or hard-coded provider response.
- Reusing or rewriting any consumed readiness/live artifact.

## Acceptance criteria

- A high-entropy oversized previous draft cannot influence full-draft input
  size; the source-regeneration prompt remains within 64K with safety headroom.
- The exact complete source-authoring input round-trips unchanged and every
  typed issue identity remains present after canonical deduplication.
- Malformed/duplicate/extra-key compact issue payloads fail closed.
- The live CLI summary is deterministic, sanitized and comfortably below the
  unchanged 64KB Supervisor output guard even when the persisted receipt holds
  a maximal diagnostic trail.
- Existing output-limit rejection, credential isolation, receipt-first
  persistence, provider counts and all downstream gates remain intact.

## Rollback

Revert the focused commits before issuing new Fresh Readiness. No existing
artifact is migrated or rewritten. A consumed live authority is never reused.

## Explicit exclusions

No production deployment, payment, storage/database mutation, full-book
render, model/budget/policy change, credential inspection, provider retry or
historical-artifact rewrite is authorized by this gate.
