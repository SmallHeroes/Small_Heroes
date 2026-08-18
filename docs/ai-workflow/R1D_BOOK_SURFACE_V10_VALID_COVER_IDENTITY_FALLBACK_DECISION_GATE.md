# R1D BookSurface v10 valid cover identity fallback — Decision Gate

**Status:** approved under Guy's 2026-08-18 standing instruction to complete the new-story Wizard path and render when valid authority exists.

## Evidence and root cause

The sole run under `outputs/r1d-echo-identity-fresh-633affac-20260818T123615036Z` completed three provider calls and ended fail-closed at `book_surface_repair_cover_reference_invalid`. Receipt v40 is `0e36ec18ab1ad689e3b62c4601b38b908a4b1524a63fef56cabafa12f74c38b5`. No Candidate exists and the root will not be replayed.

The v9 normalizer always restored cover identity from the current assembled cover. That is safe only when the current identity is already valid. When the cover diagnostic itself includes a bad location/zone/cast reference, v9 discards a potentially valid repair and reintroduces the broken identity before validation.

## Decision

1. Keep `worldType` compiler-owned and exact to `referenceAuthority`.
2. Preserve the current cover location/zone pair when it is valid. Otherwise accept only a provider pair that exactly resolves inside the closed location/zone authority.
3. Preserve current ordered cover cast IDs when every ID is valid. Otherwise accept a wholly valid provider list; if neither is wholly valid, retain only the nonempty valid subset already selected by the current cover. Never invent a cast member.
4. Malformed identity shape, an empty valid cast set, unknown location/zone, stale authority, non-target drift and full-template validation remain terminal.
5. Update BookSurface system/user prompt to v10. Schema v6, policy v13, model, budgets, retries, fallback, hard `$5`, Candidate v9, Wizard and renderer remain unchanged.
6. Advance the current request/receipt/readiness and Fresh/Supervisor/materialization authority chain. Immediate authoring predecessors remain immutable legacy evidence.

## Required proof

- Existing valid current identity wins over hostile provider identity.
- Invalid current identity is replaced only by a fully valid provider identity.
- If both contain unknown IDs, only an existing nonempty valid current subset may survive; otherwise reject.
- Focused compiler/lifecycle and full authority-chain tests, TypeScript and diff-check pass before commit/push.
- One new Fresh package and one live invocation only. Wizard/render remain gated on a valid Candidate.
