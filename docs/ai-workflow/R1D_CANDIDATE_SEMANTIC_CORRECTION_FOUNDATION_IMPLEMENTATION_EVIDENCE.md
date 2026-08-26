# R1D Candidate Semantic-Correction Foundation — Implementation Evidence

**Date:** 2026-08-26
**Owner:** Codex
**Branch/worktree:** `codex/r1d-qa-wizard-downstream-lifecycle` / `C:\GNart\Work\sh-live-chameleon-v3`
**Implementation base:** `4c34e05bf1633ca0f083a0dd1184025783d5f278`
**Cost:** `$0`; no provider, credential, network, image, audio, Wizard order, payment or render

## Outcome

This milestone does not edit or replace paid Candidate
`be2d3202ef92b7d0d0e2d9647871bc590cb8ec9bf55465e450c9c8141e7bcbc9`.
It hardens the general compiler seams needed by the forthcoming immutable
semantic-correction overlay and creates an explicit current/legacy authority
cutover because identical provider bytes no longer have identical acceptance
semantics.

Independent Claude Code review of `4c34e05b..dad01fec` returned **PASS**. The
review also identified one intentional capability reduction that this packet
must state plainly: a frontier that combines an unreviewed closed-catalog
presentation gap with an otherwise repairable structural failure now
terminates before repair. This prevents a broad `full_draft` or BookSurface
rewrite from deleting the unsupported beat and thereby self-authorizing the
provider's own capability gap. Independently admissible source-ID,
PageContract and pure structural BookSurface routes remain operational; mixed
frontiers containing the unreviewed presentation gap do not.

## Implemented claims

1. **Description-aware spatial projection v2.** Spatial references include the
   exact node description and stable node ID. Initial English articles are
   normalized. The legacy projector remains available only for compatibility.
2. **Bounded legacy upgrade.** A legacy kind-only projection upgrades only
   when current spatial meanings admit a unique mapping. Repeated actions with
   the exact same current projection share that set-like value. Multiple
   distinct description-plus-ID projections of the same legacy kind are mapped
   in declaration order only when the stored and distinct-current counts agree;
   ambiguous legacy authority remains invalid.
3. **Atomic presentation rebind.** An in-place `mustShow` projection upgrade
   rebinds the exact same-pointer `presentation_requirement.contractValue`.
4. **Low-ambiguity guard authority.** Exact source prose may derive a
   `kindergarten_guard`; bare Hebrew guard words and Image Directions cannot.
   The appearance projection is deterministic and closed.
5. **Strict presentation eligibility helper.** Eligibility records are exact-
   key, exact-beat, exact-class and same-page pointer/value authorities. Extra,
   duplicate, unused and multiply consumed records reject.
6. **Production fail-closed boundary.** No presentation eligibility is accepted
   from `TemplateCompileInput`. Both live compiler sites supply `[]`; a gap
   terminates as typed `ActionSemanticCapabilityGapError` before a presentation
   repair dispatch. Provider output cannot authorize its own route.
7. **Policy, prompt and projection cutover.** Authoring policy advances
   v19→v20; template user prompt v16→v17; full-repair user prompt v14→v15;
   appearance policy `role-policy/v1→v2`; and presentation-requirement repair
   schema/prompt/user-prompt `v2→v3`. The new closed authorities are
   `presentation-requirement-repair-eligibility/v1` and
   `spatial-reference-projection/v2`.
8. **Atomic outer version cutover.** Current versions are:
   - authoring request/receipt/readiness `v54` / `v57` / `v54`;
   - live-request materialization input/materialization/verification `v42` /
     `v52` / `v52`;
   - execution materialization input/result `v39` / `v44`;
   - execution supervisor request/result `v49` / `v42`;
   - canonical pre-live readiness `v49`.
9. **Historical evidence preserved.** Authoring request/receipt/readiness
   `v53` / `v56` / `v53` are explicit immutable legacy versions. Candidate
   remains `visual-contract-candidate-artifact/v9`; no historical artifact was
   rewritten, redigested, approved or promoted.
10. **Receipt truth updated.** Lifecycle tests prove typed capability-gap
    receipts, one-call terminal behavior where applicable, and continued
    operation of independently authorized source-ID, PageContract and pure
    structural BookSurface routes. They also prove the deliberate limitation:
    a mixed frontier containing an unreviewed presentation gap terminates
    before those otherwise repairable structural routes can dispatch.

## Deliberate boundaries

- The pure presentation eligibility helper is implemented, but no independent
  eligibility artifact is yet persisted or bound to snapshot/request digests.
  Production therefore intentionally leaves the route disabled.
- `SPATIAL_REFERENCE_PROJECTION_VERSION` names the current projection but is
  not yet persisted by Candidate v9. The correction overlay/review must record
  the projector used for every refreshed spatial authority; frozen legacy
  bytes remain selected by the compatibility profile rather than guessed from
  `vc-schema/v4` alone.
- The description-aware action/safety projector can emit internal
  `[spatial:<id>]` markers into the optional Visual Contract steering prompt.
  Enforcement is hard-off in Production but explicitly enabled by QA render
  runners. The current approved Chameleon package has no safety constraints
  and therefore emits no marker through the safety projector. Its page-8
  action prose does contain `[spatial:sp_bed]`, so a QA prompt path that emits
  action prose must not be described as marker-free. Before another steered
  render, Guy must decide whether provider prompt prose should retain the
  stable marker or use a distinct description-only projection.
- This milestone does not add a lexical/free-prose cover contradiction
  detector. The real cover defect will be closed only by the typed
  `cover_visible_recurring_prop` overlay operation with exact before-state.
- The historical paid bridge-v4 chain must be loaded and re-attested through a
  frozen compatibility loader. It must not enter current compiler, Candidate
  reconstruction or package-loader paths.
- The semantic-correction lifecycle, bridge v5, correction review/approval,
  fresh reconciliation, Blueprint/package/Wizard and render remain next work.

## Validation

### Focused compiler, repair and offline harness

Command covered ten files:

- `book-surface-repair.spec.ts`
- `presentation-requirement-repair.spec.ts`
- `visual-contract-prompt-table-compaction.spec.ts`
- `visual-contract-repair-loop.spec.ts`
- `visual-contract-stage3.spec.ts`
- `visual-contract-stage4.spec.ts`
- `visual-contract-text-first-compiler.spec.ts`
- `offline-repair-harness.spec.ts`
- `draft-reference-domain-hardening.spec.ts`
- `fox-uri-adventure-structured-contract.spec.ts`

Result: **10/10 files, 343/343 assertions pass**. This includes the exact
duplicate-action v2 upgrade, distinct same-kind fail-closed behavior, compact
spatial repair projection, mixed unreviewed-presentation terminal, and frozen
Fox v1 legacy-projector compatibility.

### Test-shape disclosure for the reviewed range

Across all changed `*.spec.ts` files in `4c34e05b..dad01fec`, 24 `it()`/`test()`
blocks were removed and 29 were added. Literal `expect()` lines changed from
177 removed to 77 added, a net reduction of 100. This is not hidden by the
343/343 result: the removed success-path assertions exercised provider-authored
presentation repair, while their replacements prove that the same fixtures
terminate without independently reviewed eligibility. The strongest removed
case explicitly let the provider author its own `presentation_requirement`
disposition and asserted success; the replacement asserts the required
fail-closed outcome. This is a deliberate coverage transformation and
capability reduction, not evidence that the old route still operates.

### Source authority lifecycle

`source-authority-lifecycle.spec.ts`: **108/108 assertions pass**.

### Outer cutover matrix

Eight files ran 405 assertions. The parallel run passed 400 assertions and
five tests exceeded Vitest's default 5-second timeout under Windows process
load. Each affected file was rerun in isolation with `--testTimeout=30000`:

- `live-execution-request-materialization.spec.ts`: **21/21 pass**, exit 0;
- `canonical-pre-live-readiness.spec.ts`: **14/14 pass**, followed by one known
  worker `onTaskUpdate` RPC timeout, process exit 1;
- `live-execution-supervisor.spec.ts`: **46/46 pass**, followed by one known
  worker `onTaskUpdate` RPC timeout, process exit 1.

The remaining five outer files passed 324/324 assertions in the matrix. The
worker errors are recorded rather than relabeled as a clean command PASS.

### Static checks

- `npx --no-install tsc --noEmit`: exit 0.
- `git diff --check`: exit 0.

### Post-PASS QA-findings closure

The follow-up closure makes both current and legacy spatial reference
projectors total over malformed runtime descriptions/kinds. Valid-input bytes
are unchanged; malformed references retain exact `spatial:<id>` fallback and
the validator still returns itemized rejection.

- focused ten-file compiler/repair/harness matrix: **349/349 pass** (the
  original 343 plus six malformed-reference regressions);
- `source-authority-lifecycle.spec.ts`: **108/108 pass**;
- both TypeScript phases in literal `npm run check`: pass;
- ordinary partition: **3,820 pass / 70 skip / the same 9 ENOENT failures in
  five unchanged ignored-output fixture files**;
- resource-intensive partition: **20/20 files and 627/627 assertions pass**,
  followed by the same three worker `onTaskUpdate` RPC timeouts;
- literal `npm run check`: exit 1 for those recorded baseline failures; it is
  not relabeled a clean command PASS.

### Full repository check

Literal `npm run check` passed both TypeScript phases. The ordinary partition
passed **3,814** assertions, skipped 70 and failed only the same **9** missing
ignored-output fixture assertions across five unchanged files. The
resource-intensive partition passed all **20/20 files and 627/627 assertions**,
then emitted the three known Vitest worker `onTaskUpdate` RPC timeouts. The
literal command therefore exits 1; this evidence does not relabel it as a clean
command PASS.

## Independent QA falsification targets

1. Find any public compile input or live call path that can inject presentation
   eligibility or cause a presentation repair dispatch without independent
   persisted/digest-bound authority.
2. Find any extra-key, duplicate, unused or multiply consumed eligibility that
   passes; or any eligibility that binds a different beat, class, page,
   pointer or value.
3. Make two distinct same-kind spatial nodes validate through one legacy
   projection, make identical repeated current projections falsely become
   ambiguous, or make an in-place projection upgrade leave stale coverage.
4. Mint `kindergarten_guard` from bare `שומר/שומרת`, Image Directions or
   non-source prose; or introduce nondeterministic appearance.
5. Find any current/legacy version alias, partial cutover or path that accepts
   v53/v56/v53 as current v20 authority.
6. Find any Candidate-version drift or mutation of paid source/request/receipt,
   Candidate, reconciliation, Board, Blueprint, package, locator or Registry
   artifacts.
7. Verify that pure structural BookSurface and other independently authorized
   repair routes remain live, while any mixed frontier containing an
   unreviewed presentation gap stops typed and sanitized before structural
   repair dispatch.

This is Codex implementation evidence, not an independent technical PASS and
not product acceptance.
