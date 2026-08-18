# R1D BookSurface Action Cardinality Reattachment — Implementation Evidence

**Date:** 2026-08-18
**Branch:** `codex/r1d-book-surface-typed-hint-compaction-render-unblock`
**Base:** `08f1faa70e54aeacf0bb3a587bc6cbe411a5a891`

## Consumed execution evidence

Two new canonical requests on base `08f1faa7` are terminal and will not be reused.

1. `outputs/r1d-transition-normalization-fresh-08f1faa7-20260818T161408386Z`: one HTTP-200 provider dispatch ended at the sanitized streaming boundary as `provider_response_parse_failure`, with no usage evidence and no Candidate.
2. `outputs/r1d-transition-normalization-recovery-08f1faa7-20260818T162307234Z`: three provider calls completed with route `initial -> page_spatial_reference_patch -> book_surface_patch`. The final response was atomically rejected as `book_surface_repair_action_binding_changed`; receipt digest `1102503224d4ea21b3922ae3af870d40fe8b8b71455c5fbed9d444885c88e477`. No Candidate, Wizard or render authority exists.

The second attempt proves the transport recovery was successful and isolates the current deterministic boundary to the BookSurface action-binding echo.

## Implementation

BookSurface continues to treat action binding identity and cardinality as compiler-owned:

- exact-cardinality responses retain the existing ordered index behavior;
- cardinality-drift responses are rebuilt to the exact authority length;
- only one response action carrying an existing exact beat ID may patch that authority index;
- every missing/unmatched action is restored from authority;
- extra or unknown response actions are discarded;
- beat IDs and existing Source Evidence subjects are reattached;
- an unbound response-created `source_phenomenon` subject is replaced by the original subject;
- response patches and source drafts remain unmodified;
- action coverage is never returned or changed;
- all containment and final template validation still run.

No schema, prompt text/version, policy, model, service tier, reasoning, timeout, input/output budget, hard USD 10 fence, retry, fallback, Candidate, Wizard, style or renderer surface changed.

## Validation

- BookSurface unit: **33/33 PASS**.
- BookSurface + compiler repair loop after integration hardening: **73/73 PASS**.
- BookSurface, repair loop, source-authority lifecycle and canonical live boundary: **334/334 PASS**.
- `npx --no-install tsc --noEmit`: **PASS**.
- `git diff --check`: **PASS**.
- Literal `npm run check` ran exactly once:
  - ordinary: **3,281 PASS, 65 skipped, 5 failed** only for the established missing ignored-output fixtures in four unchanged specs;
  - resource-intensive: **607/607 PASS**, with the two established post-assertion `onTaskUpdate` RPC timeouts;
  - diagnostic protocol valid; no new implementation assertion failed.

The five-call integration now deliberately supplies an extra provider action during BookSurface and still reaches Candidate with the exact original action cardinality and coverage.

## Execution authority

Implementation cost USD 0. No credential, provider, Fresh, live, image or render call occurred after the code edit. A new Fresh is mandatory after commit/push. Wizard and the authorized 12-page QA/non-production `gpt-image-2` LOW render remain strictly gated on a valid Candidate. Independent QA is not self-awarded by this evidence.
