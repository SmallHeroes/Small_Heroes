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

## Clean commit verification and first QA handoff

Driver code `862944e319821ab735ad893d3ddc87f9f22d6b8d` is directly on `624a7025`. After the last assertion-only
tightening, literal npx type-check passed and diagnostic/classifier passed 51/51. Clean committed focus passed
689/689 across fifteen files, including real CLI bootstrap. Eleven in-memory mutations were caught at intended
tests, with 44/44 control: source-only gate, review instruction, content limit, cancellation/source rechecks, held
packet branch, writing configuration, saved wire input/instructions, existing output and file limits. Other defensive
layers may also reject a mutant; the report claims intended failures, not universal exclusive-clause isolation.

One full npm run check completed exit 1. Ordinary: 6685 pass, exactly the ten old failures, 73 skip. Resource:
634 pass, the same Windows process-probe failure and three RPC errors. All eleven assertion names match the
previous full gate at `c7aa9c3b`. Passing ordinary count grows by 46: two F1 tests since that gate plus 44 new
driver tests. Windows probe cause is not established; full gate remains RED and is not a release waiver.

Each clean-commit focus/full/mutation receipt records exact HEAD/tree, operator/config hashes, actual completion
and 3380 tracked content hashes equal before/after. Preservation verifies 86 historical and 83 age files, six clean
protected worktrees and no diff outside eight declared paths from `624a7025`. This does not certify all ignored
dependencies/host files. Root story/source/compiler/reviewer, canon, assets, old CLI, model/classifier policy,
financial and public/customer flows stay unchanged. Initial test .at() compiler correction is disclosed above.

This docs-only closeout and `CLAUDE-SIMPLE-STORYBOARD-DIAGNOSTIC-QA-20261007.md` request first read-only
independent QA. No independent driver PASS is claimed. Offline replay is not provider-backed generation, output
adequacy, real long-book capacity, render qualification or product acceptance. A future paid wrapper needs explicit
credential/spending approval, bounded existing transport and raw receipts/wires. No budget was renewed or key read.

## Independent driver verdict and abort regression

Claude Code independently passed `624a7025..862944e3` and separately the docs suffix `862944e3..1efc908f`.
Its own type-check exits 0, fifteen specs pass 689/689, and all 21 scored virtual mutants are caught at the intended
checks. It verified the three inventories against 3380 committed blobs and the eleven full-gate baseline assertion
names. Its mutation control deliberately excludes the subprocess bootstrap and has 43 cases; its normal suite
has 44. This verdict covers the offline driver only, with no live, literary, visual, customer or release acceptance.

The one nonblocking P3-1 is genuine missing coverage: replacing the caller's AbortSignal with a fresh signal
survives the old spec, although production passes the right object. Continue the existing approved technical
loop in the same task/branch, as sole writer, from clean `1efc908f`; do not refactor transport or cancellation.

The focused correction changes only this spec and documentation. Existing three-length positive cases assert
the same signal at both callbacks and its non-aborted state. Existing after-planner/after-review cancellation
cases assert the same signal and its aborted state. This is a same-object guarantee, not proof that a provider
actually stops work. Counts remain 44 diagnostic, 689 focused and 421/401/20 inventory; no case is removed.

Local literal npx type-check exits 0 and the full diagnostic spec passes 44/44. The virtual control passes all
five selected cases. The fresh-signal substitution passes all five with the committed old spec, then fails all
five with the updated spec. Neither production files nor past evidence are changed by these runs. Tracked
content stays equal within each gate; preservation verifies 86 historical + 83 age files and six protected trees.

Clean-commit verification and Claude re-gate are next. The successor does not self-close P3-1 or widen the driver
PASS. Full check is not rerun for this test/docs-only delta; production is byte-identical to the reviewed code and
the full gate remains RED. F2 import/timeout, remaining F3 and F4 local-provenance limits remain open. Revert only
the focused spec/docs commit to roll back, leaving the independently passed driver intact.

Evidence is in `storyboard-abort-regression-evidence-20261007/` beside this chat's prior reports. The independent
driver report is Claude scratchpad `qa-driver-1efc908f/CLAUDE-QA-STORYBOARD-DRIVER-1efc908f.md`. Any future live
proof still needs explicit credentials and a newly priced allowance, bounded transport, deadline/abort and original
receipts/wires. Measure real long-book headroom before dispatch. No live transport is built or authorized here;
no key, provider/Max call, new book/storyboard/image/render, wizard migration, push/merge/deploy or budget renewal.
