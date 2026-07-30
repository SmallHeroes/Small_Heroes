# R1D-PVB-D1A1B1 post-preflight execution harness hardening Decision Gate

**Decision owner:** Guy
**Technical owner / implementer:** Codex
**Independent QA:** Claude Code, first pass read-only
**Approved milestone:** `R1D-PVB-D1A1B1-POST-PREFLIGHT-EXECUTION-HARNESS-HARDENING`
**Approved immutable base:** `6442e6ff4b45821ee53c1f20e4f29321390b6eec`
**Worktree:** `C:\Users\guyna\.codex\worktrees\0ea6\Small_Heroes`
**Branch:** `codex/r1d-pvb-d1a1b1-post-preflight-execution-harness-hardening`
**Cost / render authority:** `$0.00`; zero images

## Problem and verified root cause

The repository already owns canonical B0 materialization and
`verifyCanonicalLiveRequestBundle`, including schema, canonical-byte,
payload-domain digest, current Story Source rebuild, live policy/budget, and
`futureLiveCommand` authority. It does not own the next execution layer.

The latest diagnostic attempt passed B0 verification and its single canonical
import preflight, then exhausted authority when a hand-authored PowerShell
topology/artifact/hash fence failed at parse time before executing any check.
That is a general execution-orchestration defect, not evidence of B0 drift.
Manual shell composition also leaves Git argv, preservation fences,
expected-absence checks, credential isolation, child environment, and
termination propagation without one versioned repository contract.

## Expected behavior

A separate repository-owned Execution Supervisor accepts only a canonical
structured request and strict public Node modes `verify` and future `live`.
It composes the existing B0 verifier as the sole B0 authority, verifies exact
Git/topology and filesystem preservation/absence fences, and emits sanitized
bounded `canonical-live-execution-readiness/v1` evidence.

`verify` is read-only and cannot inspect a credential source or reach
provider/network/storage/database/write boundaries. A future authorized `live`
call runs the same readiness core immediately before credential access, reads
only `OPENAI_API_KEY` from the declared source, builds a minimal
platform-aware environment, and spawns the exact manifest command with
`process.execPath`, exact argv, `shell:false`, and `windowsHide:true`. There is
no retry or fallback.

## Approved decisions

1. Add versioned contracts `canonical-live-execution-request/v1` and
   `canonical-live-execution-readiness/v1`, with canonical bytes, payload
   digests, exact fields, bounded collections, and bounded reason codes.
2. Keep the Execution Supervisor separate from the authoring CLI/launcher.
   Its only public modes are `verify` and `live`; public arguments are
   separate-value `--repo-root` and `--request`.
3. Compose `verifyCanonicalLiveRequestBundle`; do not duplicate or change B0
   Story Source, prompt, schema, model, pricing, budget, repair, retry,
   fallback, or `futureLiveCommand` policy.
4. Verify Git through fixed exact argv and `shell:false`: repository root,
   symbolic branch, HEAD, tracked/untracked cleanliness, explicit refs, and
   explicit left/right divergence.
5. Require explicit contained preservation paths with byte length and SHA-256.
   Reject traversal, glob syntax, duplicate paths, noncanonical paths,
   symlink/junction aliases, and hard-linked file authority. Require explicit
   expected-absence paths.
6. Keep `verify` credential-blind and external-boundary-blind. Emit no raw
   path, command output, environment value, exception, stack, prompt, response,
   provider payload, or secret-derived value.
7. Implement the future `live` path only behind the same readiness core and
   fake-key/fake-child tests. Reject ambient key authority, parse one exact
   line-start assignment from the declared source, copy no neighboring
   assignment, clear key-bearing authority immediately after spawn, suppress
   bounded child output, and propagate child error/signal/nonstandard exit.
8. Add a fixed repository-owned zero-cost probe child through the same process
   runner. It may receive controlled probe data and a fixed scenario enum, but
   never an executable or arbitrary command. It cannot reach provider/network
   or application-write boundaries.
9. Keep canonical import preflight separate. This milestone does not run it
   and does not make it a readiness/Blueprint attestation. The future
   authorized sequence remains `verify -> one preflight -> verify -> live`,
   with `live` internally re-verifying before key access.

## Scope

- New story-neutral execution-supervisor library and public barrel export.
- Separate fixed Node launcher and TypeScript entrypoint.
- Fixed local process probe child.
- Focused schema, temp-Git, filesystem, sentinel, fake-live, CLI, and probe
  tests.
- This Decision Gate, execution evidence, and `CURRENT.md`.

Existing authoring launcher/verifier/B0 artifacts and every request/prompt/
model/timeout/budget/retry/fallback authority remain valid and unchanged.

## Validation contract

1. Offline-only local dependency preparation; stop if the lockfile cannot be
   satisfied without network.
2. Deterministic TypeScript.
3. Focused supervisor, B0 materializer/verifier, canonical authoring launcher,
   canonical authoring boundary, and source-authority tests.
4. Only after focused PASS, literal `npm run check` at most once.
5. Full-check success means TypeScript PASS and no timeout/new failure beyond
   the six established ignored-output fixture failures in five known files.
   No retry, skip, timeout change, assertion weakening, or fixture fabrication.
6. Explicit Git pathspec staging, focused local commits, clean unpushed final
   state, and immutable first-pass read-only Claude Code range.

## Risks and mitigations

- **TOCTOU before key access:** `live` runs the same core in that invocation and
  performs no credential action until it returns ready.
- **Git write/alias behavior:** fixed read-only argv uses optional locks off;
  paths and refs are schema-bounded and not commands.
- **Filesystem escape:** lexical, realpath, containment, regular-file,
  canonical-relative, link-count, byte-length, and SHA-256 checks fail closed.
- **Credential/environment leakage:** public launcher scrubs ambient authority;
  future child receives only the declared key plus a versioned minimal
  platform allowlist; output is suppressed rather than hashed or serialized.
- **Probe confusion:** the probe always runs the repository probe child. The
  real future path instead runs only the B0-verified manifest command.
- **Story-specific drift:** shared implementation contains no selected story,
  child, companion, action, beat, or page literal.

## Rejected alternatives

- Eval, shell strings, inline/complex PowerShell, or arbitrary-command input.
- Extending the existing authoring launcher into the supervisor.
- Reimplementing B0 schemas, digests, Story Source, policy, or command rules.
- Whole-file JSON hashes as B0 payload authority.
- Credential presence/read checks in `verify`.
- A probe that accepts an executable or arbitrary argv.
- Running preflight, a real credential, provider, model, or downstream
  lifecycle boundary in this milestone.

## Stop check

1. General system fix: **yes**.
2. Cross-story/child/companion/style risk: **additive future path only; covered
   by story-neutral contracts and no literal special cases**.
3. Production behavior: **no existing path changes or invocation**.
4. Spend: **none; `$0.00`**.
5. Smallest proof: **synthetic temp repositories, fake key/child, and fixed
   local probe**.
6. Guy decisions required: **all architecture and scope decisions are explicit
   in the approved delegation**.
7. Claude Code falsification targets: **B0 composition, Git semantics,
   read-only proof, path/link escape, credential timing/isolation, exact spawn,
   sanitization, and termination propagation**.
8. Claude Cowork review: **not required; no product/creative/UX decision**.
9. Guy eyeball: **no generated product output; inspect evidence and QA verdict**.

Implementation is authorized only within this gate. No independent technical
PASS is claimed until Claude Code reviews the final immutable range.
