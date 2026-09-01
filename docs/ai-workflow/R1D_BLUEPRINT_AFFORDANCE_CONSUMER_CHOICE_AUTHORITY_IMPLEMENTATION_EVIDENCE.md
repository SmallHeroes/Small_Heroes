# R1D — Blueprint Affordance Consumer Choice Authority — Implementation Evidence

Date: 2026-09-01

Branch: `codex/r1d-order-package-authority-binding`

Base: `81e454815d6dcef3dfbf090db07db11a9f86f5ad`

Decision Gate:
`docs/ai-workflow/R1D_BLUEPRINT_AFFORDANCE_CONSUMER_CHOICE_AUTHORITY_DECISION_GATE.md`

## Outcome

The provider no longer authors or copies canonical non-frame Blueprint consumer identities.
It chooses a closed semantic kind plus a zero-based index into a deterministic compiler-owned
catalog. The compiler resolves that bounded choice back to the exact canonical action, placement,
transition, or safety identity before the unchanged final Blueprint validation contract runs.

No final validation rule, Blueprint version, camera reverse-link rule, model, call count, repair
count, hard cost ceiling, retry policy, fallback policy, Wizard contract, package contract, or
render policy changed.

## Evidence that selected this fix

The bounded paid run under request
`01dfc1aa1b9bac2781eb982872e40bfdf0da9896c5427c87fe964cca17c2e8ea`
and receipt
`069b551d7660250d4fbd80851314ea0fe827a18f8217878b47b7830be25bd582`
used the exact then-current program
`1bd60e8c172304aa8c05715e76149b69b7f36992111d37cd86a98db9da6bbe10`.
It consumed exactly three generation calls and two repairs, with retry zero and no fallback. The
complete frontier converged to two `affordance_incompatible` diagnostics at
`worldPlan.affordances[20].consumers[0]` and `[1]`; no Candidate or render was produced.

Repository, execution-program, request, receipt, provider-wire, repair-wire, feature-flag, and
call-site inspection found no stale or fallback route in that execution. The active schema
permitted the provider to choose any non-frame consumer kind and copy canonical page/check/prop/
safety identities, while the final validator required a smaller kind mapping and exact canonical
targets. The paid call could therefore return schema-valid material that necessarily failed the
post-call contract.

## Implemented authority boundary

`preRenderBlueprintAffordanceConsumerChoices.ts` owns one deterministic catalog derived only from
the frozen compilation template:

- action: only `polarity === 'must'` action requirements;
- placement: only `visibility === 'required'` prop constraints;
- transition: only non-`steady` page transitions;
- safety: every canonical page safety constraint.

Canonical values are de-duplicated and sorted by canonical JSON identity. The provider sees the
compact lists and returns only `{kind, choiceIndex}`. Runtime binding is collect-all and rejects:

- additional/missing consumer keys or raw canonical identity fields;
- an affordance-incompatible consumer kind;
- negative, fractional, string, unsafe-integer, or out-of-range indices;
- duplicate choices within one affordance.

The static schema is also kind-specific:

- `traversal` and `opening_clearance` accept transition choices;
- `placement_support` accepts placement choices;
- `action_space` accepts action choices;
- `safe_boundary` accepts transition or safety choices;
- `camera_access` accepts no provider consumers.

The compiler snapshots the validation context before the first await, builds one catalog from that
snapshot, and reuses it for the initial provider wire, binding, validation, retained attempt, and
repair projection. A caller mutation after provider dispatch therefore cannot rebind an index.

Malformed choice drafts remain inside the bounded repair lane. The repair-only projection reduces
known identities and malformed choice-shaped values to the closed choice vocabulary instead of
throwing a generic serialization error before the next permitted call. Unknown canonical semantic
identities are never silently dropped by the compiler.

Camera authority is unchanged. The provider selects a camera only through
`frame.camera.affordanceId`; the compiler strips raw frame consumers and reconstructs the one
canonical `{kind:'frame', frameId}` reverse link. General `frame.affordanceIds` membership is not
used to mint reverse consumers.

## Version and replay cutover

Fresh dispatch now binds one coherent generation:

- draft schema v8 — digest
  `07859ed3aa44e40834adcec70662a79ed92aec7d4a61aaa13fb14585c34a48cc`;
- authoring prompt v9 — digest
  `4dd98fe44f2a5ee1e06f955122c2b88b5689a24a45dc8cb00fed3dd8c642cec8`,
  3,042 UTF-8 bytes;
- repair prompt v10 — digest
  `d7e2706c26ff927e909f53d9fbcabc42d5b7897cdd0f51c20c8b1461c38e0031`,
  3,165 UTF-8 bytes;
- provider wire v2;
- repair wire v4;
- execution-program payload digest
  `0944bdb56a83368e6c22feb886f0cfeed3b9a195ad01918e5ffd7d61de275f4b`.

Exact schema v7, prompt v8, repair prompt v9, provider wire v1, and repair wire v3 remain replay
only. The consumed former-current execution program is frozen as the literal immutable object
`LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_CAMERA_AUTHORITY`. Its payload digest remains
`1bd60e8c172304aa8c05715e76149b69b7f36992111d37cd86a98db9da6bbe10`.
Schema v6 and older prompt/wire generations remain separately preserved.

Tests pin exact historical and current schema, prompt, provider-wire, repair-wire, and program
bytes/digests. Ten self-redigested current/camera hybrid programs are rejected in both directions
across schema, initial prompt, repair prompt, provider wire, and repair wire. Lifecycle provenance
tests cover the full supported six-row historical/current matrix plus adjacent cross-generation
negatives.

The real request/receipt pair above was loaded after cutover and
`productionBlueprintAuthoringReceiptReplayIsValid(...)` returned `true` for the failed three-call
terminal. That read-only check used no credential or provider and changed no artifact. The exact
operator-recovery path is not copied into a tracked test fixture because reproducing its private
authoring-authority context would require tracking unredacted story/source prose; synthetic
lifecycle regressions instead prove zero-provider recovery/replay for every supported program
generation, while the real pair proves the concrete byte compatibility locally.

## Full-check regression found and closed before QA

The first post-change `npm run check` exposed seven failures in
`story-source-revision-blueprint-migration.spec.ts`. This was an in-scope producer integration
defect, not dismissed as baseline noise: the offline migration lifecycle returned a deterministic
legacy semantic-consumer draft to the now-current v8 compiler. Choice binding correctly rejected
it, after which the unintended repair exceeded the unchanged 64K conservative ceiling by 1,360
tokens.

The lifecycle now snapshots its validation context, builds the catalog from that same snapshot,
and strictly inverse-projects its deterministic legacy semantic consumers into current choices
before the one offline authoring call. The migration is again one call, zero repairs, and its final
semantic affordances and compiler-owned camera reverse links are byte/structure identical to the
source. No budget, ceiling, or repair policy was changed.

The new spec also entered the ordinary Vitest partition explicitly; the canonical inventory moved
from 352 to 353 files, with resource-intensive fixed at 20 and ordinary moving from 332 to 333.

## Offline validation before independent QA

- cross-boundary focused gate: **16 files / 432 tests PASS**;
- migration + bounded-choice + workload-classifier re-gate: **3 files / 24 tests PASS**;
- migration alone: **9/9 PASS**, including one-call/zero-repair current-schema integration;
- production-scale cover + eight-page harness: **PASS**, trajectory `86 -> 7 -> 6`, exact
  50,000-token count authority, three-call/two-repair maximum, and every reservation below the
  unchanged `$5` hard ceiling;
- `npx --no-install tsc --noEmit`: exit 0;
- `git diff --check`: clean;
- literal final `npm run check`: both TypeScript phases passed. Ordinary returned exactly the
  established ignored-output baseline, **5 unchanged fixture files / 9 assertions**, with
  **4,311 passing / 73 skipped** and no changed-file failure. Resource-intensive passed
  **19/20 files / 629 tests**; three five-second timeouts and three worker RPC timeout reports were
  confined to the unchanged Git/subprocess-heavy
  `live-execution-request-materialization.spec.ts`. That file then passed alone with one worker,
  **21/21**, so no behavioral assertion remained failing.

The Claude Code independent verdict is recorded in `CURRENT.md` after completion and is not
pre-claimed here.

## Explicitly rejected alternatives

- no story, child, companion, page, affordance-index, or terminal-digest special case;
- no weakening of the final Blueprint validator;
- no global “one consumer may appear only once” rule: one canonical transition legitimately
  serves traversal/opening/safe-boundary topology;
- no reverse frame consumer derived from general frame membership;
- no invented global topology-orphan invariant in this milestone;
- no prompt-only request to copy canonical identity more carefully;
- no higher token ceiling, extra call, retry, fallback, model change, or best-of-N sampling;
- no provider, input-count endpoint, image, audio, render, deployment, database, or remote mutation
  during this implementation milestone.

## Next gate

This milestone does not itself authorize or claim a successful live run. After a focused local
commit, Claude Code must review the immutable base-to-head range read-only with Opus/max. Only a
technical PASS permits creation of new exact Fresh Readiness and one ordinary live attempt under
the unchanged three-generation/two-repair/$5/retry-zero/no-fallback policy. A full render follows
only if that live produces a valid Candidate and the existing Wizard/package lifecycle closes.
