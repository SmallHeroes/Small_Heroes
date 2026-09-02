# R3-B0b QA Story Source / Visual Direction Review Batch — Implementation Evidence

Date: 2026-09-02
Product owner: Guy
Technical owner: Codex
Branch: `codex/r3b0b-story-source-review-batch`
Worktree: `C:\GNart\Work\sh-r3b0b-story-source-review`
Pushed base: `68795de8c519f1260e01737582165cbe0ec75433`
Review range: `68795de8c519f1260e01737582165cbe0ec75433..R3-B0b focused commit`
Decision Gate: `docs/ai-workflow/R3B0B_QA_STORY_SOURCE_VISUAL_DIRECTION_REVIEW_BATCH_DECISION_GATE.md`

## Outcome

R3-B0b prepares one deterministic review artifact for the exact current Wizard
rows whose canonical readiness audit says `sources.corpusDecisionRequired ===
true`. It neither accepts nor publishes them. The real repository result is:

- 18 nominal slots preflighted;
- 17 pending-review records selected by predicate, not a key allowlist;
- 5 bedtime, 6 adventure and 6 fantasy records;
- 208 total pages;
- all six fantasy stories preserved at 16 pages;
- `chameleon_koko_bedtime` excluded because its strict accepted package
  authority is already resolved, and that exclusion is digest-bound;
- zero provider, network, database, storage, order, payment, deployment, render
  or spend effects.

The batch status is `pending_exact_product_and_visual_review` with
`runtimeEligible:false` and `productionEligible:false`. All 17 records require
Guy's exact product/visual acceptance. `lion_shaket_adventure` additionally
requires Claude Cowork story-quality review. Claude Code independent technical
QA is pending.

## Implementation

The implementation adds:

- `lib/visual-package/storySourceVisualDirectionReviewBatch.ts` — strict
  predictable-graph preflight, cross-authority validation, record/batch digest
  construction and immutable output writer;
- `scripts/prepare-story-source-visual-direction-review-batch.ts` — one public
  `prepare` command, dry-run by default, optional exact write;
- `story-pipeline/04_approved_story_sources/review-requests/r3b0b-qa-story-source-visual-direction-review-request.json`
  — Guy's already-made QA corpus / 16-beat fantasy choices and review gates,
  without an embedded 17-key selection or product acceptance;
- `lib/visual-package/__tests__/story-source-visual-direction-review-batch.spec.ts`
  — real graph, hostile filesystem/authority mutation, determinism, replay and
  CLI boundary coverage;
- one npm operator-script entry and the corresponding ordinary Vitest inventory
  bookkeeping update.

Before calling permissive legacy loaders, the module strict-reads the complete
predictable authority graph with canonical repository-relative paths, root
containment, bounded byte counts, regular-file checks, symlink/reparse and hard
link rejection, and stable pre/post identity. This covers all 18 QA story and
sidecar pairs, candidates, Visual Directions and receipts, V3 story and
sidecar pairs, six companion manifests and 36 fixed companion-view files.

Each selected record then binds and cross-checks:

- the V3 fallback Story Source and import sidecar;
- QA candidate, integrated QA story and import sidecar;
- accepted legacy source manifest, Story Source, editorial snapshot and
  product-acceptance authority;
- typed Visual Direction and generation receipt;
- companion manifest and all six fixed views;
- storyboard-corpus manifest and exact story record;
- canonical all-story readiness evidence and narration preflight.

The accepted legacy manifest is required to have exact canonical LF/NFC pretty
bytes, exact ordered top-level and nested keys, and matching semantic identity.
Individual and corpus product-acceptance schemas are distinguished. Corpus
acceptance dereferences its raw-SHA-bound historical corpus manifest and proves
membership. The ignored upstream Dini adventure provenance path remains opaque
and is never probed; its tracked accepted editorial snapshot is verified.

For every page, one typed `imageDirection` binding is allowed only immediately
after the page marker. Removing those bindings must reproduce the accepted
Story Source bytes exactly. Record and batch `digestAlgorithm` values are inside
their hashed payloads. Request time is parsed as a real calendar instant and
must round-trip canonically.

## Content-addressed evidence

Tracked request:

- path: `story-pipeline/04_approved_story_sources/review-requests/r3b0b-qa-story-source-visual-direction-review-request.json`
- bytes: 1,968
- raw SHA-256: `18f09474f8631d091c15a81f74b55efcf70fafafb7b1511af5bfec1d2fb31bde`
- self-digest: `a3d8daadbffb583f7af084e50070f5e027c61279aba461ad08179a304fb07041`

Ignored local review artifact:

- path: `outputs/r3b0b-story-source-visual-direction-review-batch/7a8434c76f90bc96776909430e93fecb97f2c8a08800085d0ba3e55d7f97a143.json`
- batch digest: `7a8434c76f90bc96776909430e93fecb97f2c8a08800085d0ba3e55d7f97a143`
- bytes: 207,472
- raw SHA-256: `143ff1a7a0f67382ae5efce1deecf492761bb51809f7183cf6c8304c682d5a08`
- first explicit write: `created:true`
- immediate exact replay: `created:false`

Replay loads a Buffer, checks exact length and bytes, and rechecks stable
filesystem identity. A same-address collision fails closed. Dry-run writes
nothing.

## Preserved authority

The protected Story Source, Visual Direction, QA, storyboard, package and
companion authority roots have no diff. The existing Chameleon bedtime lineage
is preserved as:

- accepted revision digest:
  `71ddee22faaf512815e3cb9bd2af6514d996b39f6af56b0d73264cdfc32fccdb`;
- package revision digest:
  `836a3414174dbe3060010371e81ebdbef821f705650a199cc4bbfd70081d523f`;
- package raw SHA-256:
  `5fd28d07a2dd95f7122953ab1f3fa3ff392522bebbaa17deb47eab42bca55175`
  at 550,144 bytes;
- locator raw SHA-256:
  `54614b665212f5f016779d9faa85a43a6043d0813d4cf990b5e63ac72f61d79a`
  at 363 bytes.

The resemblance threshold remains 0.70. No current pointer, accepted revision,
Visual Contract, Blueprint, Board, package or locator was minted for the 17.

## Narration evidence retained

This milestone intentionally does not repair narration. The batch preserves
the current automated evidence for human follow-up:

- 24 soft `שם` items across boy/girl projections;
- seven critical unpointed `ספר` occurrences, all in `fox_uri_fantasy` (four
  boy-projection occurrences and three girl-projection occurrences);
- `fox_uri_fantasy` therefore remains automated-preflight not ready;
- all records remain marked as automated evidence only, with human narration
  review pending.

## Validation

Final post-change commands and results:

1. `npx tsc --noEmit --pretty false` — exit 0.
2. `npm run story:autonomous-typecheck` — exit 0.
3. Focused batch plus workload classifier, one worker/no file parallelism —
   2 files, 19/19 tests PASS.
4. Adjacent readiness/enrichment/acceptance slice — 4 files passed, 1 failed;
   30/34 tests passed. All four failures are ENOENT for the unchanged ignored
   `outputs/r1d-chameleon-first-kindergarten-visual-directions-v1` fixture.
5. Dry-run — exact digest/count result above and all effect counters zero.
6. Explicit write plus replay — `created:true`, then `created:false`.
7. Protected-authority diff check — unchanged.
8. `git diff --check` — exit 0 before documentation closeout and rerun before
   commit.
9. Literal final `npm run check`:
   - TypeScript and story-autonomous typecheck PASS;
   - canonical inventory 381 files: 361 ordinary / 20 resource-intensive;
   - ordinary: 338 files passed, 17 skipped, 6 failed; 4,776 assertions passed,
     73 skipped, 10 failed;
   - the 10 failures are only ENOENT reads from six unchanged specs requiring
     six absent ignored historical `outputs/` fixtures;
   - resource-intensive: 20/20 files and 640/640 assertions PASS, followed by
     three known `onTaskUpdate` RPC timeout errors;
   - overall exit 1, reported as failed rather than converted to PASS.

No ignored fixture was copied into this worktree and no test was disabled to
manufacture a green repository gate.

## Known limits and next gates

- This is review preparation only. Strict render readiness remains 1/18.
- Claude Code must independently review the immutable base-to-head range before
  technical PASS. Codex internal reviewers reported no remaining finding but
  do not replace that gate.
- Guy must inspect and explicitly accept every exact Source/Visual Direction
  pair. `lion_shaket_adventure` additionally needs Claude Cowork review.
- Narration correction/review is separate and remains required.
- Later acceptance/publication, Visual Contract/Blueprint authoring, Board/prop
  images and Visual Packages require their own bounded milestones and Decision
  Gates. No full-book render is authorized here.

## Independent QA falsification targets

1. Prove the selection is derived from the complete current 18-slot matrix and
   cannot silently return a different 17.
2. Try missing, swapped, semantically redigested and raw-byte-mutated authority
   inputs across every bound type.
3. Try cross-story/cross-companion splices and corpus-acceptance substitution.
4. Falsify exact Story Source projection from page-local Visual Directions.
5. Attack path escape, case alias, symlink/reparse, hardlink, non-file,
   over-size, mid-read identity mutation and output collision boundaries.
6. Reproduce stable record/batch bytes under enumeration/cwd/wall-clock/Git
   variation.
7. Confirm the CLI cannot accept, publish, render or reach credentials/external
   systems.
8. Confirm Chameleon bytes and all protected input authorities are unchanged.
9. Confirm narration findings and human/technical gates cannot be relabeled as
   PASS or runtime eligibility.
