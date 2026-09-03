# R3-B1b Correction Acceptance and Publication — Implementation Evidence

Date: 2026-09-03

Branch: `codex/r3b1b-correction-acceptance-publication`

Review base: `1227495e4020e7e70aff728852826660fd998514`

Review head: the focused branch HEAD supplied in the independent-QA handoff

## Authority and scope

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
  no P0/P1 findings.
- Packet QA: exact range
  `ad54e3c1929e9ca235131b3a559dd4f30403c4f7..19f110f414ec70cd64e96be3b0a99132bb4ef8b9`,
  no P0/P1/P2 findings.
- Tracked canonical product-decision digest:
  `341d73c53e9c11c753bc75f8e7235294e17a8e271ff9ee618b02321c9534ae5b`.

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

Result: **10/10 files and 88/88 tests PASS**, exit 0. The new lifecycle spec is
**9/9 PASS** both here and in the resource-intensive phase of the repository
check.

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
resource-intensive phase reports **21/21 files and 649/649 assertions passing**,
then two Vitest worker `onTaskUpdate` RPC timeouts; it therefore exits 1. The
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

Independent QA is review-only on its first pass. A technical PASS does not
authorize canonical publication; Guy must separately confirm the exact final
revision digest afterward.
