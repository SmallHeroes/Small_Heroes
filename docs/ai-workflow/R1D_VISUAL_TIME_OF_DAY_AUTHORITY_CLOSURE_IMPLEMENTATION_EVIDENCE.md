# R1D Visual Time-of-Day Authority Closure — Implementation Evidence

**Date:** 2026-08-21
**Branch/worktree:** `codex/qa-wizard-presentation-dispositions` / `C:\GNart\Work\sh-wt-r1d-output-budget`
**Approved base:** `cf07e5cbd70afaaf694ec665164ab553aa648ce6`
**Status:** closure correction independently PASSed; provider-free rebuild lifecycle green locally; Claude Code review next

## Outcome

Visual Contract authoring, stable Set Board authority, Visual Package
qualification, and runtime finalization now share one closed time-of-day domain:

`day | night | dusk | dawn | mixed`

The shared canonicalizer keeps exact values, maps one recognized cue family to
its closed value, maps `evening` to `dusk`, maps multiple distinct families to
`mixed`, and returns `null` for blank or unmappable input. Unknown prose remains
present through draft normalization and therefore fails validation rather than
acquiring a default.

The Chameleon historical phrase `evening into night` is covered by compiler
regression and becomes `mixed`; cover `evening` becomes `dusk`. Provider
structured output can no longer author arbitrary strings for location, stable
Board location, or cover time authority.

Visual Package offline qualification now runs the same runtime world-authority
validator used by finalization. Unsupported time authority produces the closed
qualification reason `world_authority_invalid` and cannot be reported ready for
publication.

## Authority cutover

- Template draft schema: `vc-draft-schema/v16`
- Template system prompt: `vc-template-prompt/v14`
- Template user prompt: unchanged `vc-template-user-prompt/v13`
- Authoring request / receipt / readiness: `v44` / `v49` / `v47`
- B0 input / manifest / verification: `v33` / `v42` / `v42`
- Execution materialization input / result: `v32` / `v36`
- Supervisor request / readiness / result: `v41` / `v41` / `v34`
- Fresh Readiness evidence: `v41`
- Visual Package offline qualification: `v4`

Immediate authoring predecessors `v43` / `v48` / `v46` remain registered as
`legacy_immutable`. Current-only B0, execution, Supervisor, and Fresh envelopes
reject their redigested immediate predecessors. Candidate v9, policy, model,
budgets, retries, fallback, runtime enum, Boards, story text, and renderer are
unchanged.

## Validation

Provider-free focused validation:

- TypeScript: `npx --no-install tsc --noEmit` — PASS.
- Time/compiler/Board/prompt suites: 4 files, 100 tests — PASS.
- Structured-output compatibility and package lifecycle: 2 files, 49 tests — PASS.
- Authoring receipt/readiness lifecycle: 1 file, 101 tests — PASS.
- B0/request/canonical authoring boundary: 3 files, 254 tests — PASS.
- Execution materialization/Fresh/Supervisor: 3 files, 77 tests — PASS.
- Total focused: 13 files, 581 tests — PASS.
- `git diff --check` — PASS before documentation closeout.

Literal `npm run check`:

- TypeScript and autonomous Story typecheck — PASS.
- Ordinary tests — 3,392 PASS, 65 skipped, 5 failures.
- Resource-intensive tests — 20 files, 610 PASS.
- The five ordinary failures are the established missing ignored-`outputs/`
  fixture assertions in four unchanged specs: `momentum-gate-koko`,
  `page-entity-qa`, `story-read-back-validation` (two assertions), and
  `child-lexicon-ages-5-8`.
- No changed or adjacent test failed.

Corrective follow-up validation after Claude Code's first review:

- Time canonicalizer, migration, diagnostic census, compiler repair loop,
  package lifecycle and runtime-world authority: 6 files, 175 tests — PASS.
- TypeScript: `npx --no-install tsc --noEmit` — PASS.
- `git diff --check` — PASS.
- A second literal `npm run check` passed TypeScript and autonomous Story
  typecheck, then reported 3,398 ordinary tests PASS, 65 skipped, and the same
  five established missing ignored-`outputs/` fixture failures in the same
  four unchanged specs. Its resource-intensive phase passed 20 files / 610
  tests. No changed or adjacent test failed.

## External-effect proof and boundaries

No authoring provider, image provider, Vision, network, credential, storage,
database, publication, locator, Wizard promotion, render, deployment, or
production action occurred. The pre-existing untracked Chameleon Set Board
directory was not edited, staged, or removed.

The approved historical Visual Contract, Blueprint, package candidate,
reviews, approvals, and locators remain immutable. This implementation does
not mint replacement authority and does not reuse an old approval against new
bytes.

## Next gate

Give Claude Code the focused provider-free lifecycle commit range for
adversarial read-only review. Only after technical PASS may Codex materialize
the pending migration review and present its exact reconciliation content to
Guy. Fresh Blueprint and Visual Package approvals remain later identities;
publication/Wizard promotion then precede one separately gated `gpt-image-2`
LOW page. Full-book rendering remains blocked until Guy inspects and accepts
that page.

## Independent QA findings and correction

Claude Code returned a technical PASS for `cf07e5cb..7e97e69f`, with one
blocking planning consequence and one bounded regex finding:

1. the new validators correctly reject the historical Chameleon template, but
   no explicit offline current-schema migration API existed; and
2. the new Hebrew dusk/dawn cue regexes could match a cue inside an unrelated
   word such as `מערב` or `שחרור`.

Both are corrected without weakening the closed domain. The shared Hebrew cue
matchers now require whole Hebrew tokens while retaining explicit common
prefix forms. Tests also close the pre-existing `ירחון`/`ירח` collision.

`migrateBookVisualContractTemplateTimeOfDayAuthority` is an explicit,
runtime-unreachable offline migration for current-schema template evidence. It
clones the source, changes only location/cover/stable-Board `timeOfDay`, rejects
unmappable values, validates the whole result, and never restamps or mutates the
historical artifact. Callers must persist the clone under a new digest and
rebuild every reconciliation, Blueprint, package review and approval bound to
the former digest.

A read-only probe against the real immutable Chameleon Candidate
`fada3965253054a5703b7c26aa727d26c54ed23b15fb6a1bcf63d90802a5968f`
proved the intended no-provider path:

- source template digest:
  `4e945dc0aeec47f21339cc780cfa6d86d87055f60a75685e8f1a25ab7b35cf31`;
- migrated template digest:
  `51901523133394266c7e5a795e2ee5b5cf471733d9d781e61107484e3460f365`;
- Town location and stable Board: `mixed`;
- cover: `dusk`;
- full template validation: PASS;
- source Candidate/template bytes: read-only and unwritten.

The authoring Candidate remains immutable evidence and is not reminted. Its
coverage is available from the already frozen Visual Package Candidate through
the existing offline production-context path; new downstream content-addressed
artifacts and fresh exact approvals are still required. No paid authoring call
is needed or authorized.

## Provider-free rebuild lifecycle

Claude Code independently re-gated `7e97e69f..f810fa5a` and returned **PASS**
with no BLOCKER, MAJOR or MINOR finding. The next repository investigation
proved that the existing QA Wizard bridge is deliberately unable to substitute
a new template: it binds its template path and digest to the historical Visual
Contract Candidate. Reusing it would recreate the stale authority.

The focused follow-up adds an explicit offline lifecycle rooted instead in the
exact approved Visual Package candidate, package review and Guy package
approval. Preparation:

1. requalifies that immutable package under current code and requires exactly
   one `template_stale` reason attributable to `timeOfDay`;
2. verifies the source snapshot, package identities, approved reconciliation
   and frozen Action Semantic Coverage;
3. performs the deterministic time-only migration and proves the non-time
   projection digest is unchanged;
4. rebinds an existing contract-evidence value only when its JSON pointer
   resolves exactly in both old and migrated templates and its old value is not
   stale;
5. resets the root reconciliation review, presentation disposition reviews and
   supersession reviews to `pending`; and
6. emits only content-addressed local review evidence with explicit
   non-authority exclusions.

Fresh approval and advance are separate CLI phases. Approval validates the
pending template, reconciliation, review bundle and Markdown byte-for-byte and
records exact Guy/time identity. Advance validates them again and calls the
existing frozen-Visual-Package production-context builder with the migrated
template and freshly approved reconciliation. It does not create Blueprint,
package, Wizard, render, provider, image, publication or deployment authority.

New artifact contracts:

- migration projection: `visual-contract-time-authority-migration/v1`;
- migration manifest: `qa-wizard-time-authority-migration-manifest/v1`;
- exact-content approval:
  `qa-wizard-time-authority-migration-approval/v1`.

Real Chameleon dry preview (`--write false`):

- source approved package candidate:
  `c3e28ae1c22ab2bfcea53dddd0e802b71d97b4adbaf6a395313a1a6445df4e82`;
- migrated template:
  `51901523133394266c7e5a795e2ee5b5cf471733d9d781e61107484e3460f365`;
- pending reconciliation:
  `cf0684dad5746395842298d97f7ba5de30b6aef62487e8e799f638a9dae8cc5b`;
- pending review bundle:
  `f816a7d7c9d27e80b319d2540c1e3d4795224d0ba12b92b5286b654f593fb6dc`;
- provider/image/network/database/production calls: all zero;
- preview output root: absent after execution.

Focused validation for this lifecycle was **8 files / 124 tests PASS**,
including reconciliation, package qualification, production package,
production lifecycle, time canonicalization, workload classification and the
real QA Wizard bridge seams. The direct migration suite is **4/4 PASS**.
`npx --no-install tsc --noEmit`, `npm run lint`, and `git diff --check` pass.

One literal `npm run check` passes TypeScript and autonomous Story typecheck.
The ordinary phase passes **3,402 tests**, skips 65 and retains only the five
established missing ignored-`outputs/` fixture assertions in four unchanged
specs: `momentum-gate-koko`, `page-entity-qa`,
`story-read-back-validation` (two assertions), and
`child-lexicon-ages-5-8`. The resource-intensive phase passes **20 files / 610
tests** with gate status `passed`. The overall command remains nonzero solely
because of those five baseline fixture failures; no changed or adjacent
functional test failed.

Claude Code's first read-only filesystem-lifecycle audit returned **HOLD** with
one BLOCKER, one MAJOR and two MINOR findings. The BLOCKER proved that
`prepare` wrote pending reconciliation and review JSON through the shared
insertion-order pretty-JSON writer, while `record` required those exact files
to use sorted canonical JSON bytes; therefore approval always rejected the
artifact preparation itself had written. The MAJOR was the absence of direct
coverage for `prepare`, `record` and `advance`. The first in-scope MINOR showed
that the exported pending-reconciliation builder could receive a non-time
template directly even though every CLI caller derived an exact migration.
The second MINOR concerned the older shared permissive timestamp validator and
was outside the range.

The corrective implementation:

1. leaves the shared reconciliation writer and all historical bytes unchanged;
2. validates reconciliation/review JSON against that writer's exact
   insertion-order pretty form, while manifest/template/snapshot/approval
   artifacts retain sorted canonical-byte validation;
3. independently rebuilds the expected pending or approved reconciliation on
   reload before accepting its exact writer bytes;
4. makes the exported builder require its migrated-template argument to equal
   the deterministic time-only projection; and
5. locally requires new migration approval timestamps to be exact UTC ISO
   instants, without widening the shared timestamp change into this milestone.

Corrective provider-free validation is **8 files / 126 tests PASS**. The direct
migration suite is **6/6 PASS**. An always-run hermetic test locks the shared
writer byte form. When the ignored approved Chameleon package is locally
present, an artifact-conditioned test executes it through a temporary,
automatically removed filesystem lifecycle:
`prepare -> reload -> approve -> reload -> advance`. It proves source bytes
remain unchanged and that a same-digest canonical key reorder is rejected as
the wrong persisted writer form. A clean checkout skips only that
artifact-conditioned integration while retaining the hermetic writer proof.
TypeScript and `git diff --check` pass.

The corrective literal `npm run check` passes TypeScript and autonomous Story
typecheck. Ordinary passes **3,404 tests**, skips 65 and retains only the same
five established missing ignored-`outputs/` fixture assertions in four
unchanged specs. Resource-intensive passes **20 files / 610 tests** with gate
status `passed`. No changed or adjacent functional test failed.

Claude Code independently re-gated exact correction range
`f9338f4240c067c1b16488077b854ec49ebf5c15..02225d0bfc7e87d2d3682c2444ecbc542d9811ac`
and returned **PASS**, verifying all fourteen correction claims and closing the
prior BLOCKER, MAJOR and both MINORs.

After that PASS, the authorized offline `prepare` phase materialized only a
pending review under
`outputs/r1d-chameleon-time-authority-migration-pending-20260821T125112868Z`.
Its canonical manifest digest is
`352ea8ed9944415b0881401a9f1230d9c75454ffed0871c324f3bb05e3e20e33`;
its migrated-template digest is
`51901523133394266c7e5a795e2ee5b5cf471733d9d781e61107484e3460f365`;
its reconciliation digest is
`cf0684dad5746395842298d97f7ba5de30b6aef62487e8e799f638a9dae8cc5b`;
and its review-bundle digest is
`f816a7d7c9d27e80b319d2540c1e3d4795224d0ba12b92b5286b654f593fb6dc`.
The manifest stage is `reconciliation_pending`; reviewer, reviewed timestamp,
approval and production context are all null. An identical write replay
returned `created: false` for the canonical artifacts and preserved artifact
bytes. The three source-package inputs retained their exact pre-write lengths
and SHA-256 identities.

No approval, provider, credential, network, Vision, image, database/storage,
publication, locator, Wizard, render, deployment or production action
occurred. The next gate is Guy's explicit exact-content acceptance of the five
rebinds and five non-depiction supersessions in the pending review.

## Approved reconciliation and Blueprint continuation correction

Guy subsequently approved exact reconciliation
`cf0684dad5746395842298d97f7ba5de30b6aef62487e8e799f638a9dae8cc5b`
and all ten decisions in review bundle
`f816a7d7c9d27e80b319d2540c1e3d4795224d0ba12b92b5286b654f593fb6dc`.
The lifecycle recorded approval
`bdbf9098898f7f64be41678b98e1ea86e23ac04218fa141ff214fecda9442e06`
at `2026-08-21T12:59:21.749Z` and advanced to approved manifest
`a57c3cffd9cd7e2ee43c3a62380f890025c050830ecc8fde378fe21e7936184a`
with production context
`0a6dc6e8b533fd4b61fe5cbae40549c6adb9b687216c7bdfb8d4903fecfaf186`.
The approval scope remains exact reconciliation content only and does not
confer Blueprint, package, Wizard, render, publication or deployment authority.

An offline audit replayed all four recorded whole-book Blueprint drafts under
that exact context. Draft `1dec723c…` passed immediately with zero repairs. Its
assembled content differs from approved historical Blueprint `fc1412a3…` at
exactly these paths and nowhere else after excluding root identity/digest:

- `/visualContract/coverContract/timeOfDay`: `evening` -> `dusk`;
- `/visualContract/locations/0/timeOfDay`: `evening into night` -> `mixed`;
- `/visualContract/setBoardAuthorities/0/locations/0/timeOfDay`:
  `evening into night` -> `mixed`.

The audit exposed one downstream lifecycle gap: advance returned the complete
`ProductionAuthoringContext` only in memory and persisted only its identity;
the generic Blueprint CLI trusted an independently supplied context file, while
the public Candidate-backed context builder correctly rejected the migrated
template against the historical Visual Contract Candidate digest. Manual JSON
construction or mutation would have bypassed the intended authority chain.

The local correction adds:

1. `loadApprovedTimeAuthorityMigration`, which loads one canonical approved
   manifest, derives its pending manifest from the exact approval, replays the
   existing advance boundary with `write:false`, and requires the rebuilt
   approved manifest and production-context identity to match exactly;
2. `prepareTimeAuthorityMigratedBlueprint`, an offline-only composition that
   injects a caller-supplied recorded draft into the existing Blueprint
   compiler and persists the existing lifecycle artifacts; and
3. `approveTimeAuthorityMigratedBlueprint`, which reloads the same approved
   migration, reconstructs its production context, re-proves the exact time-
   only Blueprint content, and invokes the existing exact Candidate/Review
   approval writer without accepting an external context; and
4. `prepare-migration` plus `approve-migration` on the existing offline
   Blueprint CLI, with contained repository-relative manifest, draft,
   Candidate, review and output paths. Prior Blueprint and approval evidence
   are derived only from the exact approved source package; the caller cannot
   substitute another package's comparison evidence.

The historical Blueprint and approval are read-only comparison evidence. The
new review records no changed frames, connections or affordances and records
only `authorityChanged: true`. Before persistence and again before approval,
the bridge requires the new Blueprint content to equal the source Blueprint
after replacing only its Visual Contract with the exact approved migrated
template; a valid but unrelated draft is rejected as non-time drift. The code
neither copies nor auto-creates a new approval. Any real new Blueprint requires
Guy's exact digest approval through `approve-migration`; the test suite issues
only a temporary test-root attestation and proves its replay is idempotent.

Local real-artifact proof:

- exact approved manifest path:
  `outputs/r1d-chameleon-time-authority-migration-pending-20260821T125112868Z/time-authority-migration-manifests/a57c3cffd9cd7e2ee43c3a62380f890025c050830ecc8fde378fe21e7936184a.json`;
- Blueprint: `c6f753eabdb278842c3d8e686bd844752c849a930d15970f06ddf3f918e91208`;
- authoring authority:
  `dd2cdeb52124402f18c62ed0a216e0d7b35903ca446d3701245b173428baa62b`;
- review packet:
  `137be727f154a03ee97f43afb2c2a46ed41b59f81bb18c196c7c11c30605da57`;
- repair attempts: zero;
- provider, credential, network, image, database and production calls: zero;
- redigested manifest with a substituted context digest: rejected;
- source package, historical Blueprint, historical approval and recorded draft:
  byte-identical before and after.

Validation:

- direct migration suite: **6/6 PASS**, including temporary
  prepare/approve/replay coverage;
- adjacent Blueprint/package/Wizard set: **5 files / 58 tests PASS**;
- TypeScript and Story autonomous typecheck: PASS;
- `npm run lint`: PASS under the repository's honest lint gate;
- `git diff --check`: PASS;
- literal `npm run check`: **3,404 ordinary tests PASS**, with only the same
  five missing ignored-output fixture assertions in four unchanged specs;
- resource assertions: **20 files / 610 tests PASS**, exit zero in the literal
  run.

Independent QA PASSed all twelve claims. Its one MINOR was that the reproduced
Blueprint/authority/review identities are intentionally bound to the approved
reconciliation artifact path but that path was not recorded beside them; the
exact path is now recorded above. The local migration approval wrapper also
narrows `approvedBy` to the exact `Guy` literal and requires canonical UTC ISO
milliseconds before invoking the unchanged historical approval writer.

No real migrated Blueprint was persisted into the approved lifecycle root, no
Blueprint approval was issued, and no Visual Package, Wizard, image or render
action occurred in this implementation milestone. Independent Claude Code
re-gate of the small correction is required before materializing the fresh
Blueprint Candidate/Review.
