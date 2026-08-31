# R1D Blueprint Camera Consumer Authority — implementation evidence

Date: 2026-09-01
Branch: `codex/r1d-order-package-authority-binding`
Decision Gate: `docs/ai-workflow/BLUEPRINT_CAMERA_CONSUMER_AUTHORITY_DECISION_GATE.md`

## Outcome

The active whole-book Blueprint authoring contract no longer asks the provider to reproduce
compiler-owned frame IDs. The provider selects a camera affordance; the compiler creates the
reciprocal frame consumer only after it has overlaid the canonical frame identity.

This is a general authority correction. It names no story, child, companion, page, or concrete
affordance ID. It changes no validation predicate and does not auto-repair the two residual
non-frame consumer incompatibilities from the consumed live attempt.

## Consumed live evidence

- Fresh Readiness: `091e0166555f0524d90835e24e0be363b49f9917a31e945897c44fec328f446d`
- Request: `078b961c709921466858d7ac010ecc2817fc22c027a906a3fb2b32adb37eb641`
- Preflight: `c35bdda0748353f08abc30cd97e6e24dac6335d8c43c7da6e9b5cd69a8299a76`
- execution identity: `5e0abd5bbf4c91010dc4396b582b18f3cec6b05d22148437d30934c132d84f48`
- terminal: `cbb6522e72bfcba477e04d525e4236b8264dc82262d95e90975d7a3adcbcf314`
- receipt: `561d623995290fb0ef07a538cac6673498dfc2c63d54f663878447a08bfa63fe`
- sanitized capture: `c692f33b933ca33d3e0f505a50f25550d10ace3e64f59c0453b23636f2d1b7ad`
- calls/repairs/retry/fallback: `3 / 2 / 0 / none`
- conservative cost: `$1.301108`
- Candidate/render: none

Complete per-attempt census:

| attempt | emitted | distinct | terminal families |
|---|---:|---:|---|
| 1 | 83 | 67 | mixed world/frame validation |
| 2 | 25 | 25 | 11 reference + 9 camera + 5 incompatibility |
| 3 | 22 | 22 | 11 reference + 9 camera + 2 incompatibility |

The second repair introduced zero identities. The final frontier was stable, not random.

## Proven root cause

1. The provider draft frame schema omits frame IDs.
2. Assembly deterministically overlays `frame:cover` and `frame:page:N`.
3. Schema v6 nevertheless required affordance consumers with provider-authored `frameId`.
4. Repair wire v2 carried `['f', frameId]` while its frame tuple omitted the canonical ID.
5. Assembly previously copied raw consumers unchanged.

On a valid cover+8-page fixture, corrupting only those nine reverse IDs reproduced nine
`camera_infeasible` plus nine consumer `reference_unresolved` diagnostics. Reconstructing the
reverse links from canonical frames restored zero issues.

## Implemented authority boundary

- Draft schema v7 has no provider frame-consumer variant.
- `camera_access.consumers` is required and exactly empty in provider output.
- All non-camera affordances retain their non-frame consumer union and minimum cardinality.
- The provider owns `frame.camera.affordanceId`, shot, angle, geometry, and all non-frame
  associations.
- The compiler strips any raw frame consumers defensively, then appends one canonical reverse
  consumer for every frame to the selected `camera_access`.
- Shared camera affordances receive all selecting canonical frame IDs exactly once.
- Unknown IDs, wrong affordance kinds/zones, duplicate authority, and missing frame membership
  remain fail-closed validation errors.

## Version and replay cutover

| surface | former current | new current |
|---|---|---|
| draft schema | v6 | v7 |
| initial prompt | v7 | v8 |
| repair prompt | v8 | v9 |
| repair wire | v2 | v3 |
| execution program digest | `3e362021...` | `1bd60e8c...` |

Unchanged: provider wire v1, Blueprint v5, authoring authority/provenance v4, composition policy
v1, model, three generation calls, two repairs, retry zero, no fallback, and `$5` ceiling.

Historical preservation is explicit rather than reconstructed from mutable current aliases:

- schema v6 digest: `36cb86c90f11bdddae0d3ba970c73aa296e5265d178cb7fa66bdcf175e328e77`
- schema v7 digest: `89fe06057ee4a6bcb05d92dfb2c20e116e39eeae4e1d1026ba7dab1830d3fd18`
- former program: `3e3620216a38422e1e0513487073eb166ad64085483f12d35ed18e00322ff3ca`
- current program: `1bd60e8c172304aa8c05715e76149b69b7f36992111d37cd86a98db9da6bbe10`

Former programs are `legacy_immutable`: exact replay is accepted and fresh dispatch is rejected.
Receipt validation chooses the schema named by the replayed program; request-v4 history uses the
explicit v6 fallback. Cross-generation schema/initial/repair provenance is rejected.

## Offline falsification

- Cover+8 provider-shaped draft: 9 frames, 0 provider frame consumers, one author call, zero
  repairs, 9 canonical reverse consumers, zero issues, byte-identical canonical Blueprint.
- Forged/duplicate/unknown frame consumers on arbitrary affordances: all stripped; input object
  unchanged; final Blueprint byte-identical.
- Shared camera: cover and page 1 produce exactly `frame:cover` and `frame:page:1` consumers.
- Missing camera ID and missing frame membership: `camera_infeasible` remains.
- Repair wire v3: no `['f', ...]` tuples; every non-frame tuple equals v2 after filtering only the
  `f` tag. Explicit v2 serializer retains exactly nine frame tuples.
- Structured-output compatibility: schema v7 and frozen schema v6 both compatible.
- Historical v4/v6, frozen v5/v6, replacement, diagnostic-successor, and approved-package replay
  tests remain green.

Real immutable replay command used an intentionally nonexistent credential file. Result:

```text
replayed=true
terminal=cbb6522e72bfcba477e04d525e4236b8264dc82262d95e90975d7a3adcbcf314
receipt=561d623995290fb0ef07a538cac6673498dfc2c63d54f663878447a08bfa63fe
callCount=3
repairCount=2
files before/after=40/40
inventory changed=false
```

Because credential loading is lazy, successful replay with a nonexistent path proves the provider,
counter, and credential boundary was not reached.

## Validation

- Focused changed/cross-boundary battery: **8 files / 287 tests PASS**
- `npx tsc --noEmit`: exit 0
- `git diff --check`: clean
- Independent Claude Code reviewed immutable range `a30da1e1...9fa43b55` with Opus/max and
  returned **PASS — 0 BLOCKER / 0 MAJOR**. It verified all nine implementation claims from source,
  call sites, Git history, and hostile test construction. Its two non-blocking cosmetic notes were
  a harmless second clone and an unnecessary inner-loop `break` under already-enforced ID
  uniqueness; neither changes behavior or warrants reopening the reviewed range.
- Post-review exact confirmation requested by Claude: **3 files / 66 tests PASS**, covering current
  and frozen program digests, both structured-output schemas, and the cover+8 compiler-authority
  harness.
- Literal repository-wide `npm run check`: both TypeScript phases passed. The ordinary partition
  reproduced only the established **nine missing ignored-output fixture assertions in five
  unchanged files**. The resource-intensive partition passed **626/632** assertions and hit six
  fixed five-second timeouts in two unchanged subprocess/Git-heavy files, followed by four known
  Vitest worker `onTaskUpdate` RPC timeout errors. Both affected files were then rerun alone with
  one worker and passed **15/15** and **21/21**. The literal command therefore remains honestly
  non-green on the documented fixture/test-runner baseline; no changed Blueprint assertion failed.

No provider, input-token endpoint, credential, image, audio, render, deployment, database, or
production action occurred in this offline milestone.
