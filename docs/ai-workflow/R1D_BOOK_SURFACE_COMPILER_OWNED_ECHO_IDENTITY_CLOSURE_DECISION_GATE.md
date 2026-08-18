# R1D BookSurface compiler-owned echo identity closure — Decision Gate

**Status:** approved by Guy on 2026-08-18 as part of the standing instruction to complete the new-story Wizard path and render when valid authority exists.

## Observed behavior

The sole v9 live attempt under `outputs/r1d-cover-identity-v9-fresh-260c48aa-20260818T110925212Z` completed three provider calls. The final BookSurface response parsed, but local application stopped at `book_surface_repair_authority_mismatch`; no Candidate, Wizard or render authority was produced. The earlier cover-specific failure did not recur.

The BookSurface output still echoes identities already owned by the compiler: presentation target page/coverage/beat/Source-Evidence identity and recurring-prop immutable identity. These values are not creative repair authority. Requiring the provider to reproduce them exactly adds a paid failure surface, as already proven for action binding and cover reference identity.

## Decision

1. Preserve the strict output shape and exact target cardinality/order.
2. After parsing and before validation/application, restore presentation target identity from the exact ordered compiler authority. The model continues to own only `presentationClass` and one permitted `contractPointer`.
3. When recurring lifecycle repair is authorized, restore every recurring prop's immutable fields from the exact ordered compiler authority. The model continues to own only `firstRevealPage`.
4. Missing/extra records, null/non-null authorization mismatch, malformed output shape, stale authority, unpermitted pointer, non-target drift and full-template validation remain terminal and fail closed.
5. Do not change prompt/schema bytes or versions: the current prompt already requires exact order and identity preservation. This is defensive compiler normalization, and Fresh authority binds the new Git HEAD.
6. Do not change model, service tier, reasoning, call/repair/retry budgets, token caps, timeout, fallback, hard `$5` fence, Candidate version, Wizard semantics or renderer.

## Proof required before another live attempt

- Direct hostile tests prove wrong-but-well-shaped presentation identities and recurring immutable fields are restored while semantic choices apply.
- Missing/extra cardinality, invalid pointer, unauthorized null/non-null, stale authority and input mutation still reject.
- A compiler-loop regression reaches a Candidate with hostile echoed identities.
- Focused tests, TypeScript and `git diff --check` pass; commit and push are exact and tracked worktree state is clean.

## Execution authority

After the implementation is green and pushed, Guy's standing approval authorizes one new canonical Fresh package, one bounded live authoring invocation without retry, and—only if it produces a valid Candidate and Wizard authority—a full-book LOW render. HIGH, production deployment and bypassing Candidate remain excluded.
