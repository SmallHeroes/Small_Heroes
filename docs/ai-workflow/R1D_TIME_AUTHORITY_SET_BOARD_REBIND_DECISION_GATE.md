# R1D Time-Authority Set Board Rebind — Decision Gate

**Status:** implementation authorized as a zero-cost consequence of Guy's approved Visual Time-of-Day Authority Closure and rebuild; exact rebind artifact approval remains pending Guy
**Date:** 2026-08-21
**Branch/worktree:** `codex/qa-wizard-presentation-dispositions` / `C:\GNart\Work\sh-wt-r1d-output-budget`
**Approved migration manifest:** `a57c3cffd9cd7e2ee43c3a62380f890025c050830ecc8fde378fe21e7936184a`

## Observed behavior

The approved Chameleon Town Board is current v6, QA-passed and Guy-approved,
with asset SHA-256
`41580dfa9ea11a8dd5c6027ffd5cc5a46f5afe0bfc6eae62c047d00cd05a751e`.
It is bound to pre-migration Set Definition hash
`5b1917ceec616cd9c8613f8075f2a7b3426c96e9549eaeef40f2381eb550b9dc`.

The approved time-only migration changes the Town authority from open prose
`evening into night` to the closed value `mixed`. The current Set Board
projection therefore correctly expects a different Set Definition hash,
`fd15ad19983952607f118282aa05d9e8f6931697453994ee4d8516ece78f7651`,
while the content-policy digest and declared prop set remain unchanged. Visual
Package assembly fails closed at `board_unresolved`; it does not reuse the old
approval under the new identity.

## Decision

Add one offline lifecycle that prepares an exact Set Board identity-rebind
candidate and human review from an already-approved time migration. It may
reuse only the exact source Board bytes and provenance already frozen in the
approved source Visual Package. It may change only the current Set Definition
identity and reset human approval to pending.

An independent approval phase must rebuild the same migration and candidate,
require exact canonical candidate/review artifacts, exact approver `Guy`, and a
canonical UTC timestamp before writing a new immutable Registry entry. The
source Registry entry and source image remain unchanged. The new identity is
not usable until that exact approval is recorded.

## Required guards

1. Load and replay the exact approved migration manifest; callers cannot
   supply a replacement context or source package.
2. Source Board identity must be present in the exact approved source package,
   QA-passed, Guy-approved, and byte/digest bound to its Registry artifact.
3. Target story, style, set identity, Board/Registry versions, content policy,
   declared props, storage key, asset hash, prompt hash, model, quality and QA
   evidence remain exact.
4. The source and target Set Definition hashes must differ; unchanged Boards
   are ineligible.
5. The candidate is pending (`approvedBy`/`approvedAt` null) and cannot satisfy
   the live Board resolver.
6. Candidate, review and approval are exact-key, content-addressed artifacts.
7. Approval writes only the exact target Registry path, never overwrites
   different bytes, preflights any existing target bytes before recording the
   approval artifact, and is replay-idempotent.
8. Hostile path, digest, identity, asset, QA, timestamp, approver, extra-key,
   stale-source and non-time drift must fail before a Registry write.
9. The public CLI imports Set Board authority only through pure submodules; it
   must not transitively load `liveResolverDeps`, image storage, Supabase or a
   provider SDK.

## Acceptance proof

- Pure validator/tamper tests for candidate, review and approval.
- Filesystem lifecycle test with prepare, reload, rejected hostile approvals,
  exact approval, replay and no source mutation.
- Real-artifact-conditioned proof that the re-bound Town Board plus the
  unchanged Home Board allows the migrated Blueprint to assemble a Visual
  Package whose only remaining qualification reason is missing package
  approval.
- Focused Set Board, migration, Blueprint, package and Wizard seams, TypeScript,
  `npm run check`, and `git diff --check`.
- Independent Claude Code adversarial PASS before a real rebind candidate is
  materialized.
- Guy's exact digest approval before the real target Registry entry is written.

## Cost and exclusions

External cost is `$0`. No provider, image generation, Vision, upload, remote
storage/database, Wizard promotion, package approval, locator change,
publication, render, deployment or production activation is authorized. The
approved Town image is not regenerated. One LOW page remains the first paid
action, after every offline authority gate passes.

## Rejected alternatives

- Do not copy/rename the old Registry JSON and carry its approval forward.
- Do not exclude `timeOfDay` from the Set Definition hash; day/night identity
  remains render-relevant.
- Do not weaken Board resolution or accept a stale hash.
- Do not rerender the already accepted Board when the exact bytes remain
  suitable and the approved migration is provably time-only.
