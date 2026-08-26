# R1D Canonical Projection Alignment and Replay Evidence — Implementation Evidence

**Date:** 2026-08-26

**Branch:** `codex/r1d-qa-wizard-downstream-lifecycle`

**Immutable code range:** `eb161317414d8dc529ba4d7db392dc12c7055e69..beda712a2f142579bdf68da8f8c4739cf60324c5`

**Code commit:** `beda712a2f142579bdf68da8f8c4739cf60324c5`

**Decision Gate:** `R1D_CANONICAL_PROJECTION_ALIGNMENT_REPLAY_EVIDENCE_DECISION_GATE.md`

**State:** offline implementation green; initial Claude Code review found no
production defect and issued a verification-completeness HOLD; executable
micro re-gate pending

## Outcome

This milestone removes the remaining address-domain mismatch between the
provider's initial/full-draft selectors and the compiler's final persisted
Visual Contract, and adds a content-addressed offline replay boundary for the
exact canonical authoring calls. It does not change validation policy, creative
provider authority, call count, model, retries, fallback, Candidate semantics,
Wizard semantics, rendering, or any approved artifact.

No provider, live authoring, Candidate publication, Wizard progression, image,
audio, or render operation occurred while implementing or validating this
milestone.

## Implemented architecture

1. One shared continuity projection defines the compiler-owned canonical
   values used by both binding and validation:
   - wardrobe selector -> `childWardrobeOverride.description`;
   - companion selector -> `companionStateOverride.stateId`;
   - source-evidence selector -> `origin.phrase`.
2. Initial and full-draft responses are bound against the raw provider draft
   and the final projected draft. A selector can resolve only to one exact
   same-page compiler pointer/value. Direct-final and mapped-topology
   candidates are unioned and de-duplicated; zero or multiple candidates fail
   closed.
3. The production compiler performs this binding before assembly and persists
   the bound form after initial/full-draft calls. Narrow-patch responses retain
   their existing typed write authority and are not rebound.
4. Action-semantic candidate enumeration excludes provenance-only `/origin/`
   fields.
5. Every canonical provider response can be captured as a privacy-minimised,
   immutable, content-addressed sidecar. The sidecar contains only the
   structured response plus exact route/schema/prompt/options identity needed
   for deterministic replay; it contains no credential, transport metadata,
   hidden reasoning, or raw prompt text.
6. Replay validates exact call count, call order, route, schema name/digest,
   prompt digests, exhaustive `ContractLlmCallOptions` identity, Candidate or
   typed terminal failure, final complete issue count, and normalized issue
   digest. Extra calls are rejected before dequeue; missing calls are rejected
   at terminal completion.
7. Replay evidence is bound one way:
   `evidence path+digest -> receipt digest -> child-output authority`. The
   evidence binds the request and attempts but never the receipt digest, so the
   graph is non-circular.
8. The supervisor requires exactly one sidecar at the canonical locator and
   rechecks its bytes and digest. The QA Wizard bridge reloads the physical
   sidecar each time it reloads the authority; deletion, substitution, path
   drift, or byte drift fails closed.
9. Failed provider evidence is rebound when the terminal receipt changes due
   to its replay locator, preserving the failure-diagnostic integrity chain.
10. Capture mode is reachable through the real CLI and was exercised in a
    subprocess with the normal server-only shim. The proof produced four
    content-addressed artifacts, made zero provider calls, and left the input
    byte inventory unchanged.

## Fresh/version cutover

- template draft schema: `vc-draft-schema/v21`
- canonical request/readiness: `canonical-live-execution-request/v47` and
  `canonical-live-execution-readiness/v47`
- canonical supervisor result: `canonical-live-execution-result/v40`
- child-output authority: `canonical-live-execution-child-output-authority/v2`
- materialization input/result:
  `canonical-live-execution-request-materialization-input/v37` and
  `canonical-live-execution-request-materialization-result/v42`
- canonical pre-live evidence: `canonical-pre-live-readiness-evidence/v47`
- authoring receipt: `visual-contract-authoring-receipt/v55`; v54 remains a
  recognized predecessor only
- replay evidence/result: `visual-contract-authoring-replay-evidence/v2` and
  `visual-contract-authoring-replay-result/v1`

Immediate-predecessor tests prove that v36 materialization input, v38
supervisor result, v1 child-output authority, and redigested v54 receipts do
not cross the new boundary.

## Validation

The final focused census is **14 files / 491 assertions passed**:

- action-semantic catalog: 10
- initial/full-draft disposition binding: 12
- offline repair harness: 21
- visual-contract live authoring: 19
- workload classifier: 7
- accepted Story Source authority: 4
- canonical live boundary: 175
- canonical live launcher: 31
- canonical pre-live readiness: 14
- materialization: 21
- supervisor: 46
- QA Wizard bridge: 9
- Story Source lifecycle: 108
- replay evidence: 14

Additional results:

- compiler-focused matrix: 6 files / 83 assertions passed;
- canonical boundary, launcher, and accepted-source matrix: 3 files / 210
  assertions passed;
- downstream assertions: 195 passed; three aggregate workers emitted the
  repository's known Vitest `onTaskUpdate` RPC timeout noise. Isolated reruns
  passed supervisor 46/46, materialization 21/21, Story Source lifecycle
  108/108, canonical pre-live 14/14, and bridge 9/9;
- `npx --no-install tsc --noEmit`: exit 0;
- `npm run story:autonomous-typecheck`: exit 0;
- `git diff --check`: clean.

The literal `npm run check` was run earlier in this milestone before the final
focused hostile additions. It passed both TypeScript phases, 3,753 ordinary
assertions and 620 resource assertions. It reproduced only the established
nine missing ignored-output fixture assertions across five unchanged files,
70 skips, and three known Vitest RPC timeouts. It was not rerun after the last
focused additions; this document does not present that earlier run as a final
byte-for-byte full-check result.

## Exact revised-Chameleon evidence boundary

The current accepted `chameleon_koko_bedtime` revision is
`3ef645415b3cdd5945baeaa275d97ae0aa0491bf30addbcc46208475278f534a`.
Its integrated story SHA is
`9acf0433386ac515d08d5d30f0429dc6b9f03596b29ba0994316ff69507195b1`,
its Visual Directions SHA is
`51e3bb3e7bd8266befe7f1030c86fb979feef919dfc223442dfe039dc6ab9778`,
and its accepted source snapshot is
`35fe04ab5601031735bd7bdd283bab7a8d897bc399427d592e39fe56aa1f6a6c`.

The regression binds that exact accepted snapshot and proves the sparse
selector-level continuity projection used on pages 2, 3, 5, 6, and 8. There is
no preserved full Template Draft/provider output for this revised Story Source
anywhere in `C:\GNart\Work`; all four preserved paid receipts for this snapshot
failed and carry no Candidate digest. Visual Directions cannot be projected
honestly into the Template Draft schema (`worldType` is already absent).
Therefore this milestone does **not** claim a full story-specific compiler
replay. The first bounded live attempt after independent PASS will be the first
combined revised-story capture. Whether that attempt succeeds or fails, its
exact responses must be replayed offline before any second paid call.

The older approved package is bound to the superseded walking/bus-stop Story
Source and is not used as proof for the revised kindergarten story.

## Accepted bounded diagnostic limitation

If one or more calls were captured successfully and a later call terminates as
`provider_output_decode_failed`, the current failure path discards that valid
captured prefix and records a null replay locator for the whole receipt. This
is privacy-safe and cannot mint a Candidate or advance the Wizard. Claude Code
verified that behavior in its initial read-only review and classified it as a
non-gating MINOR. The Decision Gate now states the exact contract: every
captured response from a run that can advance remains replayable; a terminal
decode failure intentionally discards its prefix as an accepted
forensic-fidelity loss.

## Unchanged production policy

Policy remains v18: `gpt-5.6-sol`, medium reasoning, seven standard calls, six
standard repairs, zero transport retries, no fallback, `$10` hard ceiling,
64K maximum input, and the existing single terminal-cleanup allowance. The
Candidate remains v9. No Wizard, payment, image, audio, or render policy changed.

## Next binding gate

Claude Code's initial review found no production defect but withheld PASS
because its plan-mode sandbox blocked test execution and it did not line-read
the replay runner, CLI capture proof, transition enumeration, or remaining
identity guards. Claude Code must now micro re-gate the immutable
code-plus-documentation range read-only with executable local-test authority
and try to falsify binding uniqueness, exhaustive call identity, replay
determinism, privacy, immutable sidecar persistence, receipt/authority binding,
bridge reload behavior, version rejection, and the exact revised-Chameleon
evidence wording. Codex does not self-award PASS.
Only an independent PASS permits a new Fresh root and one bounded paid live
authoring attempt. A failed attempt permits offline replay, not a second paid
attempt.
