# Simple story storyboard diagnostic driver

## Decision and observed gap

Guy approved progress toward a consistent storyboard and bounded visual proof. Claude's independent re-gate at
`624a7025` lifts the source adapter HOLD; no live spending allowance is open. Continue the current Codex task as
sole writer in the existing `simple-story-voice-followup` worktree/branch, from clean `624a7025`. Claude is read-only
QA after a focused commit. No extra implementation task, writer, new product choice or provider migration is needed.

Current library admission works at preparation and frame extraction. The old `prepare-personal-storyboard.ts` CLI
instead uses archive preparation and default options, and accepts precomputed outputs without dispatching the review
instruction. The writing trial saves result/evidence, native receipts, exact instruction text and wire input. Its
textCanonOptions is the authoritative trial configuration. Reuse these seams; do not widen the old CLI or fake a v3 receipt.

## Small general solution

One injectable diagnostic function orchestrates the existing current source, whole-book author/compiler, exact
PERSONAL_BOOK_REVIEW_INSTRUCTION, semantic disposition and all current frame packets. Caller supplies the model
function; there is no default SDK, key, network, paid guard or retry. A future live caller must separately enforce
approved budget/credentials and preserve transport receipts. This milestone adds no live transport or paid permission.

One offline-only CLI admits a completed source from original result/evidence/native records and checks saved author/
editor instructions and wire inputs against current calls. It uses textCanonOptions, supplies saved planner/reviewer
JSON as explicitly labelled replay callbacks, preserves source files byte-for-byte in a new bounded output directory,
and records instructions/inputs, content-byte headroom, source identities, review and packets. Callback invocations
are not claimed as real provider calls; CLI provider count and actual spending are zero. Held review writes zero packets.

Use the established CommonJS server-only shim together with the installed tsx CJS loader in the same Node process;
test this actual command, not a Vitest alias alone. No SDK installation, transport import refactor or model changes.
No intentional source/character/story-specific exceptions. Keep final prose, identities, source and visual gates unchanged.

## Validation and acceptance

- Positive injection and actual offline CLI replay: current simple source with exact writing options, 8/12/16 spreads,
  cover plus all body packets, same final prose, exact planner and reviewer instruction/schema, no original/editor ratings
  in final reviewer input. Existing whole-book continuity guards stay authoritative.
- Negative: bare/archive source, stale source or sidecar inputs, default-options downgrade, malformed/stale/held review,
  cancellation and source change around async callbacks, rejected input size, unknown arguments/live flags, escaping/
  existing/symlink output. Fail before subsequent callback or any output when input validation fails. No retries.
- Record content bytes for full instruction and input; do not equate them to wire size/tokens or adequate output caps.
  Actual real long-book headroom is deliberately pending a later approved run, not replaced with fixture proof.
- Type-check, relevant focused tests, deliberate weakened-check controls, local CLI evidence and one complete hashed
  full check on clean committed code. Distinguish inherited missing artifacts, Windows probe and RPC failures from new ones.
- Adding one spec requires only a correct exact test-inventory pin, preserving partition/default-ordinary policy.

## Stop check and exclusions

This is general diagnostic orchestration, not a literary fix. Customer routes, production flow, story prompts, canon,
references, financial policy, model authority, classifier policy, old CLI and visual/render qualification do not change.
No key read, provisioning or provider/API/Max call in implementation/testing. Credential selection/provisioning is held
before any future API-backed live wrapper; do not reuse a detected key silently. No current allowance is renewed.

F2 import load/timeout remains disclosed; this milestone does not change its constant location or broaden allowlists.
F4 native records do not attest actual prompts/history: preserving and checking wire files provides inspectable local
consistency, not cryptographic authenticity. F3's remaining guards stay as previously reviewed.

No new real book, actual model-authored storyboard, images, full render, wizard/public rollout, push/merge/deployment.
Rollback is a focused revert of this diagnostic and its inventory pin, leaving approved source/storyboard code intact.
Claude must falsify real call instruction/configuration, no fallback, source/sidecar identity, abort/review/packet gating,
filesystem preservation and actual loader evidence. Guy later approves a priced live proof and inspects storyboard/pixels.

## Implementation and local verification

`simple-storyboard-diagnostic.ts` drives existing current admission/author/compiler/review/disposition/frames using
an injected callback, rechecking current source/cancellation around awaits. `personal-simple-storyboard.ts` is replay
only; it rejects live/unknown/duplicate flags and validates all source inputs before output. The CLI copies all eleven
original buffers, records their hashes and materialized call instructions/inputs, and labels zero cost as replay-only,
not prior writing or supplied model outputs. Held disposition is native exit 2 without a frame file; invalid input is
exit 1, invalid arguments 3. No paid transport, writer/edit stage, retry or secret access is added.

44 cases exercise three lengths, exact instructions/output caps, final-text fidelity, supported/held/stale review,
bare and valid legacy-v3 refusal, options downgrade, cancellation, request drift, private callback errors, byte/file
limits, source wires, eleven-buffer preservation, no-overwrite/traversal/junction/reserved-path boundaries and actual
Node CJS shim/tsx bootstrap. Only the new spec is added to the exact ordinary inventory: 421 total, 401 ordinary,
20 resource. No workload/model policy is relaxed. A local ES2020 compilation issue in two test .at() assertions was
fixed by indexing, not changing tsconfig. Local compiler and the 15 relevant specs passed 689/689 before the last
assertion-only tightening. Clean-commit verification, full gate and virtual weakened-check controls are next.

Real CLI bootstrap is `node --require ./scripts/shims/register-server-only.cjs --require tsx/cjs
./scripts/personal-simple-storyboard.ts ...` in one process. This new entry is proved, not a global fix or promotion
of the earlier failed wrapper attempts. Real long-book input headroom and provider/token adequacy remain pending.
