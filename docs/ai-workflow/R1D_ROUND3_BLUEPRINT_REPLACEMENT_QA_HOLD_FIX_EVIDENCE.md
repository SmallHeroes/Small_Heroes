# R1D Round 3 — Codex QA HOLD corrected (Claude implementation)

Codex re-gated the round-2 baseline at `bc20f5e4` and returned HOLD with four
uncovered findings (2 BLOCKER, 2 MAJOR). Guy delegated implementation to Claude
Code; Codex remains independent QA. All four are corrected together in the same
worktree with the smallest general form, focused regressions, and no external
action. This is not an independent PASS; Codex re-gates.

## Finding 1 (BLOCKER) — crash window permitted cross-lane terminal adoption

Root cause: `runBlueprintExecutionUnderClaim` published the terminal **manifest**
first and the per-identity terminal **binding** second. A crash in that interval
left a globally visible, byte-identical terminal manifest with no ownership
binding; the other execution identity's `recoverTerminalLookup` (no own binding,
no foreign binding for the crashed lane) would scan and adopt it. The injected
`afterTerminalManifest` hook fired only after **both** writes, so no test could
exercise the real interval.

Correction (general, fail-closed ordering): terminal identity ownership now
becomes durable **before** the terminal manifest is visible. The manifest path
is deterministic from the already-built terminal manifest, so we compute it via
`persistManifest({ write:false })`, publish the ownership binding, then publish
the manifest, and assert the published path equals the bound path. If the
process crashes in the interval, the manifest never appears without its binding:
the other identity has nothing to adopt, and the owning lane's re-entry sees a
binding that names a missing terminal and fails closed as
`execution_state_uncertain` with no provider redispatch. A new
`afterTerminalBinding` hook fires in the actual ownership→manifest interval.

Hostile proof — `publishes terminal ownership before the terminal manifest so a
crash cannot expose an unbound terminal`: crashes at `afterTerminalBinding`;
asserts exactly one paid provider call, the terminal binding present, the
manifest it names **absent**, no terminal lookup, and a fail-closed re-entry with
zero further provider calls.

## Finding 2 (BLOCKER) — orphan eligibility ignored a legacy unbound terminal

Root cause: `loadPredecessorOrphanClaim` rejected an existing terminal lookup, an
own terminal binding, and an incident, but performed no census of the terminal
**manifests**. A pre-Round-2 terminal can exist with no binding and no lookup
(old crash state); ordinary recovery still adopts it, yet replacement
preparation called such a predecessor an orphan and could authorize a second paid
execution.

Correction: extracted the read-only scan from `recoverTerminalLookup` into
`scanRecoverableTerminalManifests` (single source of truth, applies the exact
foreign/own-binding ownership rules, writes nothing). A new
`classifyPredecessorRecoverableTerminal` reuses it to classify the predecessor's
own identity: exactly one matching terminal with a receipt ⇒ `recoverable`
(replacement rejected); any multiple/receiptless/torn state ⇒ `ambiguous`
(fail closed, not eligible); none ⇒ `none`. `loadPredecessorOrphanClaim` calls
it after the binding check and rejects `recoverable`/`ambiguous`. The census is
pure-read, so `write:false` preparation writes nothing.

Hostile proof — `rejects replacement for a legacy unbound but recoverable
predecessor terminal (write:false and write:true)`: constructs the exact legacy
state (ordinary claim + canonical terminal manifest + no lookup + no binding);
proves both `write:false` and `write:true` preparation reject with
`/recoverable terminal/` and create **zero** replacement artifacts across
`replacement-{proposals,reviews,authorizations,authorization-slots}`; the
predecessor claim bytes are untouched; and ordinary legacy recovery still adopts
the same terminal with zero provider calls (compatibility preserved).

## Finding 3 (MAJOR) — time ordering enforced only by constructors, not on reload

Root cause: the builders enforce `reviewedAt ≥ preparedAt` and
`approvedAt ≥ reviewedAt`, but `loadValidatedReplacementAuthorization` re-derived
neither. Individually self-valid, content-addressed proposal/review/authorization
bytes with hand-inverted timestamps and recomputed digests could reach execution.
Separately, the pure `buildBlueprintReplacementAuthorization` bound the review to
the proposal by **digest only**, so the exported authority surface could
construct a lineage the filesystem reload later rejects.

Correction: `loadValidatedReplacementAuthorization` now re-derives
`review.reviewedAt ≥ proposal.preparedAt` and `authorization.approvedAt ≥
review.reviewedAt` (canonical UTC ms compare lexically; each field is validated
as canonical UTC by the artifact validators). `buildBlueprintReplacementAuthor-
ization` additionally requires `review.proposalPath === proposalPath`.

Hostile proof — two on-disk tests forge fully self-consistent lineages (recomputed
digests, matching recomputed successor identity, exact path relations) whose only
defect is `approvedAt < reviewedAt` (case 1) or `reviewedAt < preparedAt`
(case 2); both reject with `/lineage is inconsistent or tampered/` before any
slot/claim/provider (asserted: no slot bound, no successor claim, provider never
called). A pure-builder test proves the `proposalPath` mismatch is rejected
(`/not bound to this proposal path/`).

## Finding 4 (MAJOR) — documented operator CLI was not runnable as documented

Root cause: the CLI header documented `node --import tsx scripts/qa-wizard-
blueprint-replacement-cli.ts <command>`, which crashes inside `server-only`
before the parser; there was no `package.json` script, and the subprocess tests
quietly used a shim form that diverged from any documented command.

Correction: added `qa-wizard-blueprint-replacement` to `package.json`, wired to
the standard operator form `tsx --require ./scripts/shims/register-server-only.cjs
scripts/qa-wizard-blueprint-replacement-cli.ts` (no lockfile change). The header
now documents the canonical `npm run qa-wizard-blueprint-replacement -- <command>`
and notes the shim requirement. The subprocess helper now **exactly mirrors** that
command (tsx CLI entry under the shim). Two new tests: one asserts the
`package.json` script equals the canonical string; one is a smoke that reaches the
strict parser under the canonical command (unknown command ⇒ exit 2; known command
missing a flag ⇒ exit 2), proving the shimmed import resolves and control reaches
argument validation. `server-only` is not weakened.

## Validation

- `npx --no-install tsc --noEmit`: exit 0.
- Focused suites 67/67 green:
  `qa-wizard-blueprint-replacement-lifecycle.spec.ts` (17, +5),
  `qa-wizard-blueprint-authoring-lifecycle.spec.ts` (34, unchanged),
  `qa-wizard-blueprint-replacement-cli.spec.ts` (16, +2). Round-2 guarantees stay
  green (global single successor, exact claim closure, note-only cross-auth
  rejection, ordinary/successor terminal isolation, unchanged canonical
  `authoringAuthorityDigest`, no nested replacement, no provider on authorization
  failure, ordinary legacy suite).
- `git diff --check`: clean.

## Historical preservation

The predecessor claim
`outputs/qa-wizard-blueprint-authoring-ledger-v1/execution-claims/466252b4a082ea6b98503bb2bc3e433a36408cfb61d1fd305afcbfa2b9804b64.json`
remains length 766, sha256
`900bd0c95d748637d90922c1a28fb05c87d116563c604529f027bc8160453515`. `git status`
shows only six code/doc files changed; no output artifact was modified. The
implementation ran no live execution, so no receipt/terminal/lookup was minted
for the predecessor.

## No external action

No provider, network, database, image/audio generation, render, deployment, push,
or approval mint occurred. All work is offline code + tests + docs. The
historical predecessor claim and its output were neither touched, retried, nor
resolved.

## Files

- `lib/visual-package/qaWizardBlueprintAuthoringLifecycle.ts` — F1 ordering +
  `afterTerminalBinding` hook; F2 `scanRecoverableTerminalManifests` +
  `classifyPredecessorRecoverableTerminal` + census in
  `loadPredecessorOrphanClaim`; F3 reload temporal re-derivation.
- `lib/visual-package/qaWizardBlueprintReplacementAuthority.ts` — F3 builder
  `proposalPath` binding.
- `scripts/qa-wizard-blueprint-replacement-cli.ts` — F4 header.
- `package.json` — F4 `qa-wizard-blueprint-replacement` script.
- `lib/visual-package/__tests__/qa-wizard-blueprint-replacement-lifecycle.spec.ts`
  — F1/F2/F3 regressions.
- `lib/visual-package/__tests__/qa-wizard-blueprint-replacement-cli.spec.ts` —
  F4 canonical-command tests + mirrored subprocess helper.
