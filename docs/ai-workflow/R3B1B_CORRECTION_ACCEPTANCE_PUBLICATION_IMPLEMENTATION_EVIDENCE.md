# R3-B1b Correction Acceptance and Publication — Implementation Evidence

Date: 2026-09-03

Branch: `codex/r3b1b-correction-acceptance-publication`

Review base: `1227495e4020e7e70aff728852826660fd998514`

Initial review head: `4c4cb91ead784d852759d448e03bc3012f9f68c2`

Corrective re-gate head: `2e0b8096d018a45d0c78d8fd4bc610d862b6de5a`

## P1 canonical publication — 2026-09-03

Publication base: `e87b5c5b3e68cbd6158e1324c73167d56160658c` (already pushed at
0/0 upstream parity before this action). Guy explicitly confirmed exact P1
revision `64dcd0e741f17fc08cde95ad8a5a00b303955aa28ccd065d44f01e49e9d155fc` and
authorized canonical Story Source / Visual Direction only. No render,
narration, package, deployment or paid action was authorized or executed.

Real publication authority:

- Product-decision digest: `9b625e71318cf3a26117bc89744a1e39c04d13f6d74f632cddab4aaa639113e8`.
- Technical-review digest: `819c27fa8387b167d0b2b2c3f8f0ae26033fedf1a4c93beb62700a52dbe69661`.
  This transcribes Claude Code's actual PASS for `1227495e..2e0b8096`, zero
  P0/P1 and one documentation-only P2. It does not claim QA of this new diff.
- Guy's final product-acceptance digest: `1ce47c29e525b0e99d151d7bf3380293d4479cd6382ed29032461cdb75e6b56f`.
- Accepted manifest digest: `8103e741ce9e7402264f5edac24204bce2b72e4df523fd88031d43ef5d44416d`.
- Accepted manifest raw SHA-256: `cd99b3ddbfc34bcca682888e142f6103ba09f2a5b758496bf9b4f9838bb1b505`.

The target is
`story-pipeline/04_approved_story_sources/accepted/dragon_dini_adventure/revisions/64dcd0e741f17fc08cde95ad8a5a00b303955aa28ccd065d44f01e49e9d155fc/`.
It contains exactly 12 files: `correction-candidate.json`,
`correction-manifest.json`, `correction-request.json`,
`direction-migration.json`, `integrated.md`, `manifest.json`,
`product-acceptance.json`, `product-decision.json`, `revision-identity.json`,
`story.md`, `technical-review.json`, and `visual-directions.json`.

### Exact executed publication commands

From `C:\GNart\Work\sh-r3b1b-correction-acceptance-publication`, the following
argument vector was used with `prepare --write false`, then `prepare --write
true`, then `publish --write true` twice. Every command exited 0. The first
publish returned `created:true`; the second returned `created:false` with
identical revision/manifest digests. All ten external counters were zero.

```powershell
$publicationArgs = @(
  '--decision', 'story-pipeline/04_approved_story_sources/approvals/r3b1b-story-source-visual-direction-correction-product-decision.json',
  '--pending-manifest', 'outputs/r3b1a-story-source-visual-direction-correction-candidates/request-identities/4a19ed8592597de780adcc36655f3e53085e32fd594cfef2d985b7c5f4e7ac6b/records/dragon_dini_adventure/candidate/71c8ba64f3fa6b5fabc46412646723dd85a8a7fce830cd287df07be8c18e09f8.manifest.json',
  '--technical-review', 'outputs/r3b1b-correction-acceptance-publication/technical-reviews/819c27fa8387b167d0b2b2c3f8f0ae26033fedf1a4c93beb62700a52dbe69661.json',
  '--product-acceptance', 'story-pipeline/04_approved_story_sources/approvals/r3b1b-dragon-dini-adventure-product-acceptance-1ce47c29e525b0e99d151d7bf3380293d4479cd6382ed29032461cdb75e6b56f.json',
  '--output-root', 'outputs/r3b1b-correction-acceptance-publication/prepared'
)
node scripts/story-source-visual-direction-correction-acceptance-lifecycle.cjs publish @publicationArgs --write true
```

This is an execution record, not a request for QA to republish. The first
independent review is read-only; use loader/readiness and temporary-root tests.

### Real readiness and bounded compatibility correction

`npm run wizard-all-story-readiness -- --format json`, with
`ENABLE_V3_APPROVED_BANK=true` and `ENABLE_WIZARD_QA_RENDER_CATALOG=false`, exited
0 with semantic report digest
`39819a34f01385e1aa6ea11307e788aaeaefa3e4cdf451e3753796c481faad4a`.
Accepted lineage / supported gender / automated narration preflight are each
2/18; soft-TTS items are 10 across 5 stories. P1's source role is
`accepted_product_source`, both projections have no automated critical/soft
gaps, and `renderQualified:false`. Its earliest blocker is
`package_bound_visual_contract_template_unavailable`. Render-qualified count
remains 1/18. Environment product sellability is 17, not the old 18: explicit
P1 lineage fails closed without a qualified package. Automated TTS evidence is
not narration approval and no audio was generated.

The first post-publication lifecycle test exposed that historical R3-B0b
preparation was reading later acceptances and no longer yielded its fixed 17/1
selection. A closed historical-readiness allow-list, bound to the original
request's preserved authority, now reconstructs that old evidence while the
ordinary entrypoint ignores any injected historical option. Historical
qualification/sellability evidence is computed inside this read-only adapter;
production `mvp-story-matrix.ts`, `audit.ts`, and
`wizardVisualPackageSelection.ts` remain byte-unchanged. R3-B0b's original
`7a8434c7...` digest and the exact R3-B1a batch remain reproducible.

The lifecycle fixture removes only the exact P1 revision from its disposable
copy (retaining the legacy story directory), then computes its source-overlay
baseline there. Current audit/CLI tests assert 2 accepted authorities and 1
render-qualified story; a regression proves untyped historical-option
injection cannot hide P1 in the ordinary audit. During diagnosis, the exact
new canonical revision was briefly held under ignored `outputs/` and restored
with `finally`; no file was deleted or rewritten. Temporary diagnostic outputs
are not authority and are not staged.

### Publication validation

The final 14-file focused selection was run exactly as follows:

```powershell
npx vitest run lib/__tests__/story-source-visual-direction-correction-acceptance-lifecycle.spec.ts lib/visual-package/__tests__/story-source-visual-direction-correction-batch.spec.ts lib/visual-package/__tests__/story-source-visual-direction-review-batch.spec.ts lib/__tests__/story-source-revision-materializer.spec.ts lib/__tests__/story-source-revision-lifecycle.spec.ts lib/__tests__/story-source-visual-direction-enrichment-lifecycle.spec.ts lib/visual-package/__tests__/accepted-story-source-authoring-authority.spec.ts lib/visual-package/__tests__/wizard-all-story-render-readiness.spec.ts lib/visual-package/__tests__/wizard-all-story-readiness-cli.spec.ts lib/__tests__/vitest-workload-classifier.spec.ts lib/visual-package/__tests__/render-qualification-audit-cli.spec.ts lib/visual-package/__tests__/visual-package-lifecycle.spec.ts lib/__tests__/mvp-story-matrix.spec.ts lib/__tests__/wizard-mvp-matrix-api.spec.ts --maxWorkers=1 --no-file-parallelism
```

Observed result: **13 passing files, 1 failing file; 138 passing tests, 1
timeout; exit 1**. The already disclosed deterministic-audit cell at
`wizard-all-story-render-readiness.spec.ts:295` took **5,156 ms**, exceeding its
unchanged effective **5,000 ms** limit. There was no assertion or digest
mismatch. The lifecycle was 11/11, review batch 14/14, correction batch 9/9,
and all four current-catalog matrix/API/audit/package specs passed. This is
not represented as a green 139-test command.

The exact same timing-sensitive cell was then run in isolation:

```powershell
npx vitest run lib/visual-package/__tests__/wizard-all-story-render-readiness.spec.ts -t "keeps its semantic digest deterministic and environment claims aligned with runtime helpers" --maxWorkers=1 --no-file-parallelism
```

It passed in **3,818 ms**: 1 test passed, 11 skipped, exit 0. This establishes
that run's assertion result, not timing stability and not a retroactive PASS
for the combined command. No timeout, runner, worker policy or test skip was
changed in this milestone.

Also executed successfully, exit 0 for each:

```powershell
npx tsc --noEmit
npm run story:autonomous-typecheck
node --check scripts/story-source-visual-direction-acceptance-lifecycle.cjs
node --check scripts/story-source-visual-direction-correction-acceptance-lifecycle.cjs
git diff --check
git diff --cached --check
```

The final literal `npm run check` rerun after all catalog expectation changes
reports **338 passing / 7 failing / 17 skipped ordinary files**, and **4,790
passing / 11 failing / 73 skipped tests**. Ten failures are the unchanged
missing ignored-fixture failures in child-lexicon (1), Koko momentum (1),
page-entity image QA (1), story read-back (2), general v3 acceptance lifecycle
(4), and reserved-page placement (1). The eleventh is the same deterministic
cell, this time **5,102 ms** against 5,000 ms. Ordinary exit is 1, classified
`test_timeout` and `signal_or_exit_failure`.

The final resource-intensive phase reports **21/21 files and 651/651
assertions passing**, followed by **three** `onTaskUpdate` RPC errors and exit
1. Diagnostics classify it as `on_task_update_rpc_timeout` plus
`signal_or_exit_failure`. Overall `npm run check` exits 1 and is **not PASS**.

For comparison, the first full check before the last catalog expectation
corrections had 334 passing / 11 failing / 17 skipped ordinary files, and
4,785 passing / 16 failing / 73 skipped tests: the same ten fixture failures,
five now-corrected stale catalog assertions, and a 5,727 ms deterministic-cell
timeout. Its resource phase had 21/21 files and 651/651 assertions passing,
followed by **two** `onTaskUpdate` RPC errors and exit 1. Those errors are not
counted as PASS and are distinct from the final run.

Real post-test read-only verification repeated `publish @publicationArgs
--write false`: exit 0, `created:false`, `wouldCreate:false`, exact revision and
manifest digests, ineligible runtime and all ten external counters zero. The
strict accepted-authority loader loaded the canonical P1 source; all 11
manifest-listed files matched their declared byte counts and SHA-256 hashes,
with exactly 12 directory entries including the manifest. The full readiness
digest remained `39819a34f01385e1aa6ea11307e788aaeaefa3e4cdf451e3753796c481faad4a`.
The 13 new authority files (12-file revision plus external acceptance receipt)
were also compared between Git index blobs and disk: every raw byte hash
matched, so staging introduced no CRLF/digest drift.

Independent publication QA is pending. No push is authorized by this action.

## Implementation authority and scope (historical pre-publication record)

Everything from this heading to the end records the earlier lifecycle
implementation and its QA closeout, not the subsequent canonical publication.
Its no-publication statements and test counts are historical; the publication
record above supersedes them for the current milestone.

Guy approved packet commit
`19f110f414ec70cd64e96be3b0a99132bb4ef8b9` against exact candidate batch
`96154a39091b71c9dffb64dcf60b8667c149b78d4b4c0d5a07787189d00a7e9b`.
The approved input is acceptance intent for P1-P5/P7/P8, P6 referral to Claude
Cowork without acceptance, and D1-D5, D6A and D7-D13 correction directions.
R3-B1b implementation is approved. Narration, independent implementation QA,
exact final-digest confirmation and canonical publication are not approved by
that decision and remain separate gates.

This milestone adds the zero-cost correction-aware acceptance/publication
mechanism and proves P1 only in temporary test roots. It does not publish any
accepted revision and does not change render eligibility.

## Immutable inputs

- Candidate batch: 353,307 bytes; raw SHA-256
  `d8a57650364d62cfc52496b1385ba5dd95fe702f06edf51ff327ae5a43caba4c`.
- Product packet: 18,413 bytes; raw SHA-256
  `cbe65b9687d04bba5fdf691a4a0f0275297bc79e5195d8eb0d68a36e9deb3d78`;
  commit `19f110f414ec70cd64e96be3b0a99132bb4ef8b9`.
- Candidate implementation QA: exact range
  `462aaf4c19c7e8809284a96579fb993400e5a593..85ef104cd7765a3e0376bb5ec84a72e75103d9c8`,
  no P0/P1 and three P2 findings.
- Candidate QA closeout: exact range
  `e7c7bf4a3dda1e06a692802000a0a93cb1646bd0..e1df111f9b956fa360a03d53ef0bfc438bb29c2c`,
  no P0/P1/P2; it closes/disposes the three bound P2 findings without changing
  candidate implementation or artifact bytes.
- Packet QA: exact range
  `ad54e3c1929e9ca235131b3a559dd4f30403c4f7..19f110f414ec70cd64e96be3b0a99132bb4ef8b9`,
  no P0/P1/P2 findings.
- Tracked canonical product-decision digest:
  `9b625e71318cf3a26117bc89744a1e39c04d13f6d74f632cddab4aaa639113e8`.

## Initial independent-QA HOLD and correction

Claude Code reviewed
`1227495e4020e7e70aff728852826660fd998514..4c4cb91ead784d852759d448e03bc3012f9f68c2`
read-only and returned HOLD with no P0, one P1 and two P2:

1. The product-decision JSON falsely recorded `p2: 0` for an R3-B1a range
   whose PASS carried three P2 findings, and the final technical-review schema
   also rejected any otherwise-passing review with nonblocking P2 findings.
2. The record, Story Source and Visual Direction digest bindings were enforced
   end to end but lacked direct substitution tests.
3. The readiness inventory resolved the injected accepted root before the two
   downstream consumers validated it.

All three are corrected. Product-decision schema v2 records the truthful three
P2 and a separately bound exact closeout range with zero findings. Technical-
review schema v2 requires `status: pass`, Claude Code, zero P0/P1 and a
nonnegative integer P2 count; a HOLD is still rejected for publication. The
three identity substitutions now reach the immutable-batch binding and fail.
The shared accepted-root validator is exported and called before inventory path
resolution or enumeration. A traversal regression proves the audit throws the
path error at this boundary.

## Independent corrective re-gate

Claude Code independently reviewed combined immutable range
`1227495e4020e7e70aff728852826660fd998514..2e0b8096d018a45d0c78d8fd4bc610d862b6de5a`
read-only and returned **PASS with no P0/P1 and one documentation-only P2**. It
confirmed all three prior findings closed, reproduced the decision and revision
digests, independently passed 10/10 files / 90/90 tests plus 11/11 lifecycle
tests, and verified the early root fence with zero outside-repository filesystem
touches. It also confirmed zero publication/effects/provider reachability,
unchanged historical loaders and unchanged 0.70 threshold.

The new P2 corrects a factual handoff claim: Codex said the branch had no
upstream and was unpushed, but the reviewed implementation head was already
pushed. Both Claude and Codex subsequently measured upstream
`origin/codex/r3b1b-correction-acceptance-publication` at exact
`2e0b8096d018a45d0c78d8fd4bc610d862b6de5a`, 0 ahead and 0 behind. This is a
handoff-accuracy issue only; it changes no implementation finding or authority.

## Implementation claims

1. A new correction-v4 lifecycle consumes exact batch, packet, record, request,
   Story Source, Visual Direction, QA and product-decision identities.
2. `inspect` is read-only and reports the remaining independent implementation
   review and exact final-digest confirmation gates. `prepare` and `publish`
   require those later closed envelopes.
3. The new 12-file accepted inventory records the immutable correction
   candidate/request, original materializer manifest and migration, accepted
   story/Visual Directions, decision, review, acceptance and revision identity.
4. Publication reuses the v3 safety kernel for containment, canonical bytes,
   hardlink/symlink/junction rejection, atomic staging, immutable replay and
   collision rejection.
5. The accepted-authority loader validates correction v4 without changing its
   exact v3 or legacy-v2 branches.
6. The all-story readiness loader accepts an injected temporary accepted root
   for proof, while the default canonical root is unchanged.
7. Operator code has no provider, render, database, storage, order, payment or
   deployment capability.

## P1 temporary proof

The exact proposed P1 revision digest is
`64dcd0e741f17fc08cde95ad8a5a00b303955aa28ccd065d44f01e49e9d155fc`.
Synthetic technical-review and final-product-acceptance envelopes exist only
inside temporary test roots to prove the future gated path. They are not
production decisions and are removed after the test.

The temporary readiness overlay changes only accepted-source-derived facts:

- accepted source authority: 1 to 2;
- supported gender authority: 1 to 2;
- automated narration preflight: 1 to 2;
- soft narration findings: 12 items / 6 stories to 10 items / 5 stories;
- P1 corpus decision required: true to false;
- narration input ready: remains 18;
- critical narration findings: remains 18;
- corpus conflict evidence: remains 18 because the accepted candidate bytes
  differ from the historical corpus bytes;
- complete visual packages and strict render-ready stories: remain 1/18;
- P1 strict render-ready: remains false.

The other 17 functional dispositions remain unchanged. The canonical accepted
tree is not written.

## Validation evidence

Focused command:

```powershell
npx vitest run lib/__tests__/story-source-visual-direction-correction-acceptance-lifecycle.spec.ts lib/visual-package/__tests__/story-source-visual-direction-correction-batch.spec.ts lib/visual-package/__tests__/story-source-visual-direction-review-batch.spec.ts lib/__tests__/story-source-revision-materializer.spec.ts lib/__tests__/story-source-revision-lifecycle.spec.ts lib/__tests__/story-source-visual-direction-enrichment-lifecycle.spec.ts lib/visual-package/__tests__/accepted-story-source-authoring-authority.spec.ts lib/visual-package/__tests__/wizard-all-story-render-readiness.spec.ts lib/visual-package/__tests__/wizard-all-story-readiness-cli.spec.ts lib/__tests__/vitest-workload-classifier.spec.ts --maxWorkers=1 --no-file-parallelism
```

Corrected result: **10/10 files and 90/90 tests PASS**, exit 0. The lifecycle
spec is **11/11 PASS**. Its temporary publication fixture deliberately carries
two nonblocking P2 findings in a passing technical-review envelope, proving the
new schema through prepare, publish and strict-loader verification.

Also PASS:

```powershell
npx tsc --noEmit
npm run story:autonomous-typecheck
node --check scripts/story-source-visual-direction-acceptance-lifecycle.cjs
node --check scripts/story-source-visual-direction-correction-acceptance-lifecycle.cjs
git diff --check
```

Literal `npm run check` is not PASS. Its ordinary phase reports 339 passing,
6 failing and 17 skipped files; 4,790 passing, 10 failing and 73 skipped tests.
All ten failures are missing-file errors in unchanged tests whose ignored
historical `outputs/` fixtures are absent from this worktree. The
resource-intensive phase reports **21/21 files and 651/651 assertions passing**,
then three Vitest worker `onTaskUpdate` RPC timeouts; it therefore exits 1. The
phase diagnostics classify the ordinary failure as `signal_or_exit_failure`
and the resource failure as `on_task_update_rpc_timeout` plus
`signal_or_exit_failure`. Neither failing phase is represented as PASS.

## Effects and exclusions

Provider calls 0; network calls 0; image renders 0; audio renders 0; PDF renders
0; database/storage/order/payment/deployment writes 0; spend USD 0. No canonical
accepted-source path was created. The resemblance threshold remains 0.70.

P6 Cowork review, D-decision candidate correction/materialization, narration
work and ear QA, Visual Contracts, Blueprints, Boards/props, package authority,
rendering, final digest confirmation and canonical publication are out of this
milestone.

## Independent-QA falsification targets

- substitute any packet, batch, candidate, request, source, Visual Direction,
  QA range, reviewer identity, product decision or final digest;
- attempt partial decisions, P6 acceptance, unresolved HOLD publication,
  wrong-world acceptance or D-record digest reuse;
- forge correction v4 by relabeling v3 or omit/cross-wire any inventory file;
- attempt traversal, hardlink, symlink, junction, partial-stage, collision and
  replay attacks;
- compare historical v2/v3 behavior and canonical accepted bytes;
- recompute the temporary readiness delta and prove no package/render authority;
- inspect the eager/static operator graph for provider or mutation reachability;
- verify the literal repository-check disclosure independently.

Independent QA has passed the corrected combined range. That technical PASS
does not authorize canonical publication; Guy must separately confirm the exact
final revision digest afterward.
