# Chameleon accepted-source package promotion — implementation evidence

## Outcome

The exact Guy-approved Visual Package Candidate
`31176f576824ca7f3bb56d945c04e460f66c99d576cf6f63d3d2c00e864bfc9d`
and Package Review
`bb6de707e9ae7ca88c46c6b13423ab9065fc999e32239562e5c7e133065eff61`
were finalized and published without provider, image, audio, database, storage
or network work. The Chameleon current locator now selects immutable revision
`2b488f2db44702106f49ad80c257b88269972ffb8ebbc92cced95f81c13d98a6`.

This is a local engineering result pending independent Claude Code review. It
does not authorize deployment or render by itself.

## Exact authority chain

| Authority | Digest |
| --- | --- |
| Package assembly manifest | `baf92870b9b94b8873e7971647d0e175a3228d2d8a198990893883f1d1a168d7` |
| Visual Package Candidate | `31176f576824ca7f3bb56d945c04e460f66c99d576cf6f63d3d2c00e864bfc9d` |
| Package Review | `bb6de707e9ae7ca88c46c6b13423ab9065fc999e32239562e5c7e133065eff61` |
| Guy Package approval | `c51cf5ccf76ba3aa32bef55f0b44093d10cf0612e0b6c872895fa852ce165860` |
| Published package revision | `2b488f2db44702106f49ad80c257b88269972ffb8ebbc92cced95f81c13d98a6` |
| Promotion manifest | `6f4daa7dad20d9a86e0900d76affae2d799fe25e0aaebdd61ebd60f05ebf29ee` |

The approval was recorded at `2026-08-22T14:14:19.841Z`; publication was
recorded at `2026-08-22T14:16:04.221Z`.

## Publication behavior

The adapter:

1. reloads the canonical assembly manifest and reconstructs it byte-for-byte;
2. validates exact Candidate/Review/Guy approval bindings and publication
   qualification;
3. finalizes through the existing Visual Package v4/v5 lifecycle;
4. requires the current locator to equal either the reviewed predecessor bytes
   or the exact intended successor bytes;
5. validates the selected predecessor through the current package loader;
6. preflights immutable revision and promotion-manifest collisions;
7. obtains an exclusive locator-adjacent lock, rechecks the locator under that
   lock, writes the revision, atomically advances the locator, verifies exact
   resulting bytes, and only then writes the promotion manifest;
8. requires an already-advanced replay to have the exact immutable revision on
   disk and to load through the current locator.

Preview produced no files and preserved predecessor locator SHA-256
`9d6ea2f84cbee48bb6f671edeea5aee2960328f55f0e3427bd4ee1e916b1cddf`.
The first write returned `locatorChanged:true, manifestCreated:true`; exact
replay returned both flags false. The published package file SHA-256 is
`81fcbc2980abd89ace79a9ad8f7804f4a91570fa5b398cc8a4cd63e9b26a7859`
and locator SHA-256 is
`6d3d9431054a71b47456b659f343bc0674efa62403e6f488156b8a8fc02bb96b`.

## Falsification coverage

The focused spec proves rejection, without partial advancement, for:

- wrong Candidate or Review digest;
- non-Guy approval and noncanonical timestamp;
- alternate/tampered approval path;
- stale or unexpected locator bytes;
- conflicting immutable revision bytes;
- concurrent promotion lock contention;
- locator already advanced while the selected revision is missing or stale;
- replay byte drift.

Historical migration tests no longer depend on the mutable production locator:
they create an exact frozen predecessor locator fixture, while runtime tests
assert the newly published accepted revision.

## Runtime proof

`resolveStoryProductTruth` now returns source `visual_package_v4` and the exact
nested accepted source path for Chameleon bedtime. The source raw digest is
`3aac47b55f606fd65a127c0679ffb42e6b16f93783d7a6386d81e5e8db01cef4`.
Both Bar-boy and Bar-girl resolve all eight pages deterministically with no LLM
rewrite. The offline Wizard runtime-authority preflight validates revision
`2b488f2d...`, the approved Blueprint, materialized contract, cover plus eight
pages, and both approved Set Boards without provider or network reachability.

The Board artifacts remain byte-identical and unstaged:

- Home candidate: `8e530b4489c003307d85ebb22fc7125912d94a99809330bb7b7f0d2ef22892db`
- Home approved Registry: `bbce002dbee70639dc6651f0aaf85f274b7cf45fac6f99a7041168e75f4c74b3`
- Home QA receipt: `a2bff52603b01bef4dfc61c78c9e078e9c2d9adeef35bfbbb2bb94ca3522fbf8`
- Town approved Registry: `53e446c9db371fb67e1d851f7c3ecdcf356019a7ef083abd1c97e676820bfe86`

## Validation

- promotion/migration/resolver/accepted-source/preflight focus: 6 files, 36
  tests PASS;
- Wizard/order/freeze/resume/render-qualification matrix: 14 files, 98 tests
  PASS;
- `npx --no-install tsc --noEmit`: PASS;
- `npm run story:autonomous-typecheck`: PASS;
- CLI dependency graph: 86 repository inputs, 0 `node_modules`, 0
  provider/render/database/storage-capable inputs. The one OpenAI-named module
  is the pure structured-output schema compatibility evaluator;
- one literal `npm run check`: ordinary 3,492 PASS / 65 skipped / five
  established missing-output fixture failures; resource-intensive 610 PASS /
  one 5-second QA Bridge junction timeout plus three known Vitest worker RPC
  timeouts. The same Bridge file passed 8/8 with a 15-second diagnostic test
  timeout; its junction assertion completed in about 5.3 seconds;
- `git diff --check`: PASS before final staging, and required again before
  commit.

## Remaining boundary

Deployment and render remain separate. After independent Claude Code PASS, the
next sequence is: push the focused commit, deploy the exact reviewed head with
`VISUAL_CONTRACT_ENFORCEMENT=true`, run the deployed provider-free authority
preflight, verify Wizard product truth and Order freeze, then execute the one
full-book render explicitly authorized by Guy. Any deployed preflight mismatch
stops before paid image work.
