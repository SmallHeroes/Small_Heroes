# R1D General Visual Directions Acceptance and Publication — Implementation Evidence

**Date:** 2026-08-23

**Branch/worktree:** `codex/qa-wizard-presentation-dispositions` at
`C:\GNart\Work\sh-wt-r1d-output-budget`

**Base:** `972a25ad1f8f4243d01f4b8be92076713a63b28d`

**Status:** canonical Story Source revision published after independent Claude
Code PASS; focused artifact re-gate required before fresh Blueprint authoring

## Outcome

The repository now has one general provider-free lifecycle for accepting and
publishing a Story Source revision that already contains product-reviewed
Visual Directions. The real approved Bar/Kim candidate was staged under
ignored `outputs/` as a complete immutable nine-file publication bundle.
Claude Code independently PASSed the implementation and artifacts with no
findings. The exact bundle was then published to the canonical accepted Story
Source revisions directory and replayed byte-idempotently. No Blueprint
authoring, package promotion, Wizard change or render occurred.

This is a new v3 accepted-revision schema because the old v2 lifecycle encodes
the historical `female -> neutral` migration and cannot truthfully represent a
full creative Story Source plus Visual Directions replacement. The v3 bundle is
deliberately runtime-ineligible until a fresh Visual Contract is authored from
this exact accepted source.

## Implementation

- `scripts/story-source-visual-direction-enrichment-lifecycle.cjs` exposes a
  narrow `loadExistingCandidate` boundary. It re-derives the candidate from its
  request, requires the exact content-addressed directory and rechecks its full
  byte inventory.
- `scripts/story-source-visual-direction-acceptance-lifecycle.cjs` validates
  exact-key canonical requests, contained regular files, single-link files,
  canonical digests, Claude Code PASS, accepted MINOR dispositions, exact Guy
  approval and exact Candidate/Review identities.
- `prepare` builds and optionally atomically writes one complete publication
  candidate below ignored `outputs/`.
- `publish` re-runs all validation, requires the exact staged bundle and can
  atomically write only the complete revision directory. Before independent QA,
  the real repository was exercised with `--write false` only and `--write
  true` was tested only in hermetic temporary repositories. After PASS, one
  authorized real `--write true` publication and one exact replay were run.
- The executable contains no Bar, Kim, chameleon, kindergarten, bedtime,
  Candidate or Review digest branch and has no provider, HTTP, process,
  database, locator, Wizard or render capability.

## Authority and exact real artifacts

Guy approved:

- Visual Directions Candidate:
  `3ef645415b3cdd5945baeaa275d97ae0aa0491bf30addbcc46208475278f534a`
- Review Bundle:
  `fa519a11bca42e0d565479329b9d5c0767972814ee28d6e73a764a35a1a3b57c`

The canonical acceptance request is:

`outputs/r1d-chameleon-first-kindergarten-visual-directions-acceptance-v1/request.json`

- bytes: `1029`
- SHA-256:
  `5a3283d0a45cd81950e09224045eb7b9221881f204e3335d83ac3a8c453378a4`
- accepted by: exact `Guy`
- accepted at: `2026-08-23T12:39:21.963Z`

The technical-review artifact is 840 bytes, SHA-256
`1da18f21e067e97021985db4e06e1df1bb5d6861dd1908fff6d13e0e11638bde`
and canonical digest
`b447194273806856307c924974ebc13d07417272fa44a125ab25d87ad1b369f0`.
It binds Claude Code range `15fa4c9d..67d08a31`, 0 BLOCKER, 0 MAJOR, 1
accepted non-blocking MINOR, and the exact Candidate/Review pair.

The ignored staged bundle is:

`outputs/r1d-chameleon-first-kindergarten-visual-directions-acceptance-v1/publication-candidates/3ef645415b3cdd5945baeaa275d97ae0aa0491bf30addbcc46208475278f534a`

Its identities are:

- accepted v3 manifest digest:
  `157d729d9e023fde4e22d82a96bafcc19825523a1d5c7378d3df0a50eb4f8462`
- product-acceptance digest:
  `bf267c499381a581b34365790b6e3a74b2ab8e34bfee34d2f39143e456cad98b`
- revision identity digest: the approved Candidate digest
- runtime eligibility: `false`
- exact reason: `accepted_story_source_requires_fresh_visual_contract`

## Exact nine-file inventory

| File | Bytes | SHA-256 |
|---|---:|---|
| `enrichment-manifest.json` | 2732 | `9500106ebfdeef99b1e220ca18639bd4399ed06b032f71cf33850799120fa459` |
| `enrichment-review-bundle.json` | 2850 | `02abc8885da908f2799a9709817837f0d09268d85dd39dfd9c473ce194880dec` |
| `integrated.md` | 8717 | `9acf0433386ac515d08d5d30f0429dc6b9f03596b29ba0994316ff69507195b1` |
| `manifest.json` | 4111 | `e25df837debd54d6ffb958584f434b477a872d8f235d36731862b80102cf40ef` |
| `product-acceptance.json` | 1210 | `0556650b9824288d967768a8b38edb5f6657c18863b23ff909f621840ba6c50c` |
| `revision-identity.json` | 1409 | `3ef645415b3cdd5945baeaa275d97ae0aa0491bf30addbcc46208475278f534a` |
| `story.md` | 4142 | `b18e824c96bf43a3d3f5b9dfe6457b2ad8a19112b73e89fcfbb55417a02afd09` |
| `technical-review.json` | 840 | `1da18f21e067e97021985db4e06e1df1bb5d6861dd1908fff6d13e0e11638bde` |
| `visual-directions.json` | 7000 | `51e3bb3e7bd8266befe7f1030c86fb979feef919dfc223442dfe039dc6ab9778` |

The manifest binds parent accepted story-only revision
`eca8b3c8a8ed32a6a884cd9bd4fc493fcc6f00fed3c4ebe710c6a870ead2115d`,
the approved story bytes, exact enriched source and Visual Directions, Guy
acceptance, continuity intent, identity and the explicit exclusions.

## Real execution evidence

1. `prepare --write false`: `created:false`, nothing written.
2. `prepare --write true`: `created:true`, exact nine-file bundle written.
3. identical `prepare --write true`: `created:false`, byte-exact replay.
4. pre-QA `publish --write false`: `created:false`, `wouldCreate:true`.
5. Claude Code reviewed `972a25ad..2451309a` read-only and returned **PASS — 0
   BLOCKER / 0 MAJOR / 0 MINOR**, verifying all ten claims and independently
   re-deriving every digest.
6. post-PASS `publish --write true`: `created:true`; canonical target
   `story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/revisions/3ef645415b3cdd5945baeaa275d97ae0aa0491bf30addbcc46208475278f534a`
   created with exactly nine files.
7. immediate identical `publish --write true`: `created:false`; every accepted
   file is byte-identical to the staged bundle.
8. Every external/provider/render/database/storage/locator/Wizard counter is
   zero.
9. Current-locator SHA-256 remains
   `6d3d9431054a71b47456b659f343bc0674efa62403e6f488156b8a8fc02bb96b`
   and still selects package `2b488f2d...98a6`.

## Validation

- dedicated acceptance lifecycle: `5/5` PASS;
- Visual Directions enrichment lifecycle: `6/6` PASS;
- creative replacement: `5/5` PASS;
- v2 Story Source revision lifecycle: `6/6` PASS;
- revision materializer: `11/11` PASS;
- story commission materializer: `31/31` PASS;
- Companion State: `9/9` PASS;
- workload classifier: `7/7` PASS;
- combined focused matrix: **8 files / 80 tests PASS**;
- both lifecycle scripts: `node --check` PASS;
- `npx --no-install tsc --noEmit`: PASS;
- `git diff --check`: PASS;
- literal `npm run check` inventory: **326 canonical / 306 ordinary / 20
  resource-intensive**;
- resource-intensive: **20 files / 611 tests PASS**;
- ordinary: **285 files PASS, 16 skipped; 3,561 tests PASS, 65 skipped, 7
  failures**;
- ordinary failure classification: five established absent ignored-`outputs/`
  fixtures in four unchanged files, plus two five-second parallel timeouts in
  unchanged
  `lib/visual-package/__tests__/story-source-revision-blueprint-migration.spec.ts`;
- isolated migration diagnostic with one worker and 30-second allowance:
  **1 file / 8 tests PASS**;
- the new acceptance lifecycle itself passed **5/5** inside the literal
  repository run;
- post-publication expanded Story Source/Package/Wizard matrix: **14 files /
  154 tests PASS**;
- the first post-publication run exposed only a temporal fixture assumption:
  the hermetic fixture copied the newly published revision and expected it to
  be absent. The fixture now removes that revision from its temp copy before
  exercising pre-publication behavior; no production code changed.

## Preservation fence

The four pre-existing untracked Board artifacts remain unstaged and retain
their SHA-256 values:

- `8e530b4489c003307d85ebb22fc7125912d94a99809330bb7b7f0d2ef22892db`
- `bbce002dbee70639dc6651f0aaf85f274b7cf45fac6f99a7041168e75f4c74b3`
- `a2bff52603b01bef4dfc61c78c9e078e9c2d9adeef35bfbbb2bb94ca3522fbf8`
- `53e446c9db371fb67e1d851f7c3ecdcf356019a7ef083abd1c97e676820bfe86`

## Independent QA falsification targets

Claude Code should try to prove any of the following:

1. Candidate or Review bytes can drift without rejection.
2. a HOLD, wrong reviewer, wrong approver, malformed timestamp or unlike
   Candidate/Review population can reach a bundle.
3. a symlink, hardlink, traversal, hostile output root, staging collision or
   accepted-target collision can replace or partially publish authority.
4. prepare/publish can replay across story identities.
5. the nine-file bundle differs from the approved Candidate or parent Story
   Source, or a manifest digest cannot be independently reproduced.
6. the real canonical accepted target differs from the staged nine-file bundle
   or exact replay rewrites it.
7. v3 is reachable by current runtime/package/Wizard selection before a fresh
   Visual Contract.
8. production code contains story-specific logic or can call any external,
   provider, render, database, deployment or locator capability.

## Explicitly out of scope

- fresh Blueprint/Visual Contract authoring;
- package assembly, review, approval or locator promotion;
- Wizard selection or deployment;
- provider, image, audio, Vision, database, payment, order or render work;
- modification or staging of the four Board artifacts.
