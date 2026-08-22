# Chameleon Story Source revision package migration — phase 1 implementation evidence

## Status

Local green on branch `codex/qa-wizard-presentation-dispositions`. This is a
Codex implementation result awaiting independent Claude Code review. It is not
reconciliation approval and authorizes no downstream Blueprint, package,
locator, deployment or render action.

## Goal

Rebuild the source-bound portion of the current approved Chameleon Visual
Package against the product-accepted neutral Story Source revision without a
provider call and without mutating any approved authority.

## Exact input authorities

- Current locator:
  `visual-packages/approved/chameleon_koko_bedtime.soft_hand_drawn_storybook.visual-package-current.json`
- Current approved package revision:
  `a9c253d989118262ed2b38a671fc7eccf6af44a084512af35285ad2f548a14fb`
- Historical source identity:
  `4336eddb1a7b4a24a5a16e1bb6456dbe8a1c18d9baa2d8392a5c286f3515fb74`
- Product-accepted Story Source revision:
  `20a1280107a94ca0134c08351bc18565883ee358ce7ed1ca47ea797549bca1eb`
- Accepted revision manifest digest:
  `b090505e232dc02c06ff8c3ce7684d2b433a00f9bba9fa907c541066da00dadd`
- Accepted Product Review Bundle:
  `2a84d1785e771072b5601e6fe1c85f84bd793b1666c229239ae60b3064d38565`
- Exact product acceptance SHA-256:
  `b64bd26589d9231e209377ebf93652c9a86c46a21ca41b4b3b8b9776bda49ee9`

## Implementation

`storySourceRevisionPackageMigrationLifecycle.ts`:

1. loads and validates the exact current v5 package via its current locator;
2. validates the accepted revision's exact canonical path, closed v2 manifest,
   eight-file inventory, every byte length/SHA, revision identity, Product
   Review binding and exact Guy product-acceptance artifact;
3. rebuilds valid current v3 snapshots for the old and new Story Sources and
   additionally binds the package's historical v2/v3 snapshot digest;
4. requires identical page and `(pageNumber, excerptOrdinal)` topology and
   constructs a unique exhaustive old-to-new evidence map;
5. recursively replaces only mapped `sourceEvidenceId` fields and their exact
   sibling `sourcePhrase`, rejecting stale or unknown occurrences;
6. validates the migrated Visual Contract and complete Action Semantic
   Coverage against the new catalog;
7. rebuilds source text, image directions, contract citations, presentation
   requirements and disposition identities in a fresh pending reconciliation;
8. writes only immutable content-addressed local artifacts below the requested
   `outputs/` child and supports exact byte replay.

The tiny direct import correction in `storySourceAuthority.ts` replaces the
compiler barrel with the exact pure prose validator. Behavior is unchanged; it
reduces the migration CLI graph without introducing a second validator.

## Real artifact result

Output root:

`outputs/r1d-chameleon-source-revision-package-migration-pending-20260822T064826732Z`

Key identities:

- manifest `db14ca61024e125cb63499846e4e56d8043e0103cf2997cbe955b5bb2ed6e184`;
- old reconstructed snapshot `bd3a6e8472e253972d431263180def894060a84cccedf58528342dc1ab15216e`;
- new neutral snapshot `e7ee0c72707d39b47ccac72c6ede2e266bed4c58a3bab9709f422395d36d345c`;
- evidence map `5b6cfbbb106fe4e451b6c3279609090cd2df3d7b121ebb16139a507a61c670e6`;
- migrated template `8cd21c2c6ab3de7e801a7596b0eb4be1f103136f66d342d41b7b42845871c980`;
- migrated Action Semantic Coverage `12846388e48507d6b0cd7e977012fd8b575f97bbbdeeab2578fcb9eb8c0d5f15`;
- pending reconciliation `601bf27eec36b31a9be1074671715fb3c9868d3d6c9c56dcede57f1b1a77f8d5`;
- pending review bundle `dada71130f08bd71ffdd81686263ccce29be51d9e9fac8b21be40a0f0b542887`.

Measured topology:

- 92 old evidence entries and 92 new entries;
- all 92 IDs change and form one bijection;
- 12 exact source excerpts change;
- 8 template evidence occurrences are projected;
- 98 Action Semantic Coverage records remain complete;
- the source package contains 155 evidence-ID occurrences;
- changed historical image directions are exactly pages 6 and 8.

The pending review is deliberately not ready for approval. Its only normalized
blocking code is `reconciliation_incomplete`, representing the fresh Guy review
required for the overall reconciliation and its inherited presentation
rebind/supersession decisions. A second write returned `created: false` and
left every artifact byte unchanged.

## Validation

- focused migration spec: 5/5 PASS;
- migration + source lifecycle + time migration + reconciliation + package:
  5 files / 130 tests PASS;
- `npx --no-install tsc --noEmit`: PASS;
- `npm run story:autonomous-typecheck`: PASS;
- `git diff --check`: PASS;
- literal `npm run check`: the ordinary phase reported 3,483 PASS / 65 skipped
  / 6 failures. Five are established absent ignored-output fixtures; one was
  the expected canonical-inventory count change caused by adding this spec and
  is corrected to 317 total / 297 ordinary / 20 resource-intensive. The
  resource phase reported 610 PASS / 1 test timeout plus three known Vitest
  worker `onTaskUpdate` RPC timeouts under parallel load. The timed file passed
  8/8 assertions in isolation, including the junction case that timed out under
  load; that process still exited nonzero only for one known post-assertion
  `onTaskUpdate` RPC timeout;
- real CLI preview: zero writes and no output directory;
- real CLI write + replay: `created: true`, then `created: false`;
- esbuild dependency graph: 78 inputs, 0 node_modules, 0 provider-call-capable
  inputs. Two static validation/classification modules have provider/OpenAI in
  their filenames; neither exposes an external call path.

## Preservation fence

Unchanged exact SHA-256 values after the real artifact mint:

- current locator: `9d6ea2f84cbee48bb6f671edeea5aee2960328f55f0e3427bd4ee1e916b1cddf`;
- current package revision bytes:
  `45145cd59561d5aaf974fc7461a9e026acf0141f811df11de46814685786c38d`;
- four untracked Board artifacts:
  `8e530b4489c003307d85ebb22fc7125912d94a99809330bb7b7f0d2ef22892db`,
  `bbce002dbee70639dc6651f0aaf85f274b7cf45fac6f99a7041168e75f4c74b3`,
  `a2bff52603b01bef4dfc61c78c9e078e9c2d9adeef35bfbbb2bb94ca3522fbf8`,
  `53e446c9db371fb67e1d851f7c3ecdcf356019a7ef083abd1c97e676820bfe86`.

## Explicit exclusions

No provider, image, audio, database, storage, deployment, publication,
reconciliation approval, Blueprint approval, package approval, locator update
or render was performed. The current approved package and locator are still
the old immutable authority until later approved stages complete.

## Independent falsification targets

Claude Code should try to falsify:

1. accepted revision path/inventory/product-acceptance binding;
2. evidence-map completeness, uniqueness and exact source-phrase binding;
3. non-target Visual Contract drift or stale contract citations;
4. coverage cardinality, pointer/value or action-binding drift;
5. pending-review integrity and any path that advances without exact approval;
6. output containment, collision/replay and source/package/Board preservation;
7. any provider/network/database/storage/locator call-capable import or runtime
   path reachable from the CLI.
