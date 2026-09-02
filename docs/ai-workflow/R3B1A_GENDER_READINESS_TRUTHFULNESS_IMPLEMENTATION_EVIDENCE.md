# R3-B1a Correction Foundation — Implementation Evidence

Date: 2026-09-03
Branch: `codex/r3b1a-story-correction-candidates`
Worktree: `C:\GNart\Work\sh-r3b0b-story-source-review`
Base: `462aaf4c19c7e8809284a96579fb993400e5a593`
Scope: first green sub-milestone under the R3-B1a Decision Gate

## Outcome

The default all-story readiness audit no longer counts a fixed `female` or
`male` Story Source as supporting both Wizard gender projections merely because
placeholder resolution completes. Readiness now requires the source's exact
declared gender authority to be `neutral` as well as clean executable boy/girl
projections.

This closes the false-positive exposed by exact R3-B0b content review: 17
current product fallbacks could be converted into text strings for both genders,
but were not authoritative gender-flexible sources and several contained actual
wrong-gender child grammar.

The Story Source materializer also has a new closed correction-request version.
It binds the exact R3-B0b batch digest and record digest, permits the typed
`shotType` and `cameraAngle` repairs needed by the existing composition policy,
and permits exact indexed edits to `continuityAnchors` where the source review
found a real prop-state contradiction. It emits distinct pending-only manifest
and direction-migration versions.
Legacy v3 requests preserve their exact schema and cannot use the wider edit
surface.

The Visual Direction enrichment preflight now fails new candidates containing
singular English gender pronouns. It requires companion appearance-state
authority when a declared transition or explicit body-state claim actually uses
that authority, while allowing a fixed companion with an explicit empty
transition list. Its wardrobe detector now requires a child-subject clothing
claim, avoiding false positives when one direction names both the child and a
supporting character's garment.

## Compatibility boundary

R3-B0b review-batch v1 is immutable reviewed evidence. Its builder supplies the
closed `legacy_syntactic_projection_only` policy explicitly while reproducing
that historical artifact. No runtime, CLI, environment variable, feature flag,
or production caller selects that policy. The normal audit defaults to
`require_neutral_source_authority`.

The existing R3-B0b suite proves the exact historical digest remains
reproducible after the correction.

## Fresh evidence

Command:

```powershell
npx vitest run lib/visual-package/__tests__/wizard-all-story-render-readiness.spec.ts lib/visual-package/__tests__/story-source-visual-direction-review-batch.spec.ts lib/visual-package/__tests__/wizard-all-story-readiness-cli.spec.ts lib/__tests__/story-source-revision-materializer.spec.ts lib/__tests__/story-source-visual-direction-enrichment-lifecycle.spec.ts --pool=threads --maxWorkers=1 --minWorkers=1
```

Result: **5 files PASS; 52 tests PASS; exit 0**.

Command:

```powershell
npx tsc --noEmit --pretty false
```

Result: **exit 0**.

Command:

```powershell
git diff --check
```

Result: **exit 0**.

Command:

```powershell
npm run check
```

Result: TypeScript and `story:autonomous-typecheck` pass. The canonical
**381 / 361 / 20** test partition ran. Ordinary tests report **338 passed
files / 4,781 passed tests**, with ten ENOENT failures across six unchanged
specs caused by six absent ignored historical `outputs/` fixtures. The resource
phase reports **18 passed / 2 failed files** and **636 passed / 4 failed tests**:
three cells exceeded their 5-second timeout under load and one Windows child
`git init` launch returned a transient access denial. Three known post-run
`onTaskUpdate` RPC timeouts also occurred. The command exits 1 and is not counted
as PASS.

The two affected resource files were then rerun with one worker:

```powershell
npx vitest run lib/visual-package/__tests__/canonical-pre-live-readiness.spec.ts lib/visual-package/__tests__/live-execution-supervisor.spec.ts --pool=threads --maxWorkers=1 --minWorkers=1
```

Result: **2 files PASS; 60 tests PASS; exit 0**, including all four cells that
failed under the resource phase's parallel load. No missing fixture was copied
and no failure was hidden.

Fresh read-only Wizard audit with `ENABLE_V3_APPROVED_BANK=true` and
`ENABLE_WIZARD_QA_RENDER_CATALOG=false`:

- nominal slots: 18;
- configured environment product-sellable markers: 18;
- supported gender projection authority: 1;
- supported automated narration preflight: 1;
- strict render-qualified: 1;
- earliest blocker: 17 `product_source_text_not_ready`, one none.

The configured product-sellable counter is preserved as the environment/catalog
signal it already represented. It is not strict render readiness and does not
override the new source-text blocker.

## Effects and limits

No Story Source, Visual Direction, candidate output, acceptance, publication,
Visual Contract, Blueprint, Board, package, locator, runtime feature flag,
provider, image, audio, PDF, database, storage, order, payment, or deployment
state changed. Spend is USD 0. The 0.70 resemblance threshold is unchanged.

This is not an independent technical PASS and does not complete R3-B1a. Claude
Code must review the final immutable implementation range after the exact-17
correction-candidate milestone is complete.
