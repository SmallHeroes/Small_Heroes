# Existing-system gated draft sample — approved Decision Gate

Subsequent independent review: Claude HOLD0/1/4 on d1a79ab3..c94b0511,
reconciled at documentation-only6b14617a. Narrow correction and re-gate brief:
OWNER_DRAFT_SAMPLE_CORRECTION_20260916.md. Historical paid artifacts remain held.

Guy explicitly forbids off-system renders, directs implementation, and authorizes
paid rendering using existing key. Current task sole writer, semantic-m1 branch
codex/r3b1b-semantic-recovery-m1, base d1a79ab334536ac032192b411dba2aad2bd46839,
clean/ahead36. Protected d53b768ccb2f and accepted-intent63ccb484 read-only/clean.

## Observed / expected / root cause
External CLI audition discarded usage and skipped shared QA. It is rejected,
never an anchor. Existing owner-book-draft uses real shared source/continuity
validators, prompt assembly, generateGPTImage, previewCheckpoint and Flex judge,
but QA requires a completed full manifest, and render prefix does not persist a
sample manifest. Its board prompt includes prior-story living-path instructions.
Expected: existing shared draft runner supports selected-page render->QA->decision
with accounting, stops before next page on non-pass, with no standalone image API.
This is LOCAL EDITORIAL DRAFT workflow, NOT order/customer golden-path readiness.
No accepted-source, approved Blueprint/package or runtime authority is fabricated.

## Scope and smallest general solution
Extend existing runner, not new provider runner. Optional bound samplePages in
config; explicit sample execution only, cannot mix with prefix/render/legacy qa.
Reuse runPreviewQualityLoop(maxRepairs0), real judgePreviewCandidate and checkpoints.
Preserve existing schema/threshold/model. Stop on defect, uncertainty, transport,
malformed result or budget fence; no uncalibrated automatic repair. Preserve raw
receipts and manifest with productionReadyfalse even when diagnostic checks pass.
Generic prop-board prompt built from plan, no scene/story-specific injected prop.
Full Kim plan authored as data with unchanged draft SHA, canonical original child
and companion refs. New prop board, not rejected audition pixels. Sample pages3/7.

## Plan / dependencies / validation / acceptance
Files: existing runner, owner-book-draft.spec.ts, CURRENT, this gate; ignored Kim
plan/config and evidence. Bind sample selection to run identity. Pure plan/selection
tests and mocked sequential render/judge tests with defect, uncertain, exception,
binding mismatch, empty/duplicate/out-of-range selection, no acceptance. Validate
real Kim plan/source and existing refs offline before paid call. tsc before commit.
Run relevant shared tests; full check status remains separately tracked NON-GREEN.
No claim tests prove visual detection accuracy. New paid sample must record usage
and run the real unchanged judge before allowing another selected page.

## Spend / stop-check / exclusions
Up to one LOW prop board plus two LOW pages (1024x1536 existing pipeline size).
Image accounting budgetUSD2; QA accounting budgetUSD4, existing reservations and
unknown-outcome no-retry behavior. First non-pass stops; no repair attempts, no
audio, no fallback, no new QA calibration. Existing key memory only, no new key.
Keep current task; no delegated writers, no push, deployment or release. Product
acceptance belongs to Guy; current request supplies implementation/sample authority.
No rendering via installed standalone CLI. User's explicit system-only instruction
takes precedence over imagegen skill's default artifact-generation route.
No story-specific engine rules; selected story is data. Other stories and old roots
remain unchanged. Rollback: revert focused code, preserve receipts and old books.
Claude first review read-only, immutable range; falsify gate order, no post-hold
calls, replay binding, accounting, generic board and false production claims.
No separate product decision pending; narrower sample chosen to minimize spend.

## Completed execution and QA handoff

Code range d1a79ab334536ac032192b411dba2aad2bd46839..
c94b0511da4c3f61124ccae27b938dcb8c185ef7. Four tracked files,275 additions/13 deletions.
This following documentation-only completion is outside any independent code PASS.
No independent PASS exists for new code. Claude first pass read-only on exact range.

117/117 focused tests in four specs: owner41, quality28, judge16, checkpoints32;
tsc0. Real exported runOwnerBookDraft tested with mocked providers, real source/
plan loading, image checkpoints and qualityDisposition: defect saved usage and
held manifest, no page2, replay did not regenerate, alternate modes rejected.
Unit gate tests also cover uncertainty, exception, binding mismatch, invalid order,
duplicate/empty selection and evidence-write failure. These are not vision accuracy
tests. Standalone provider CLI is not used. No judge model/prompt/threshold change.

Full check exit1, ordinary5633pass/2fail/73skip; resource671/671pass. Reported two
failures: anthropic-model-authority unexpectedclaude-4 alongside retired Sonnet;
workload-classifier expected393 but got409. No baseline reproduction performed,
no all-inherited or stability closure claim. Full log:
outputs/kim-system-sample-input-20260916/full-check.log.

Paid command used existing key file (never copied or printed):
```powershell
npx.cmd tsx --require ./scripts/shims/register-server-only.cjs scripts/run-owner-book-draft.ts outputs/kim-system-sample-input-20260916/config.json --sample --key-env-file C:/GNart/Work/Small_Heroes/.env.local
```
Do not rerun this paid command as part of review. Live exit2: sample_held,
page3held_repair_limit, unassessed[7]. Actual four persisted provider results:
prop-board, page3, blind anatomy, contextual QA. Zero unknowns/retries/fallbacks.
Contextual QA: defects relative_scale/props/scene/framing, otherspass. Blind
anatomy flags biological-looking shelter feet; contextual anatomy accepts magical
prop connection. Existing override retains blind defect without altering raw logs.
This reveals false-positive risk; does not establish reliable anatomy adjudication.
Operator found extra animal passengers in prop board. Corrected causal attribution:
c94b0511 removed the generic `or animals` exclusion while removing prior-story
living-path prose. This is a verified prompt regression; a counterfactual proving
it alone caused the pixels was not run. Separate board QA is absent, but adding
paid QA is not the remedy for this omission. Restore the free constraint first.
Board is not approved; restoration alone establishes no visual detection accuracy.
Existing scale/props/scene/framing defects remain; no new product acceptance.

Image SHA prop-board0a8776ae0456f4fb9446996ec2649867a69ae577003a53e241868d9f9171ff28;
page3a3839a668d82dc07aa91f00ffcb4da208975d6b7ceb27c8697f029427453a6f0.
Source6ad80286... unchanged; plan a6c7d233eb17ae433ff038a7696954b7a131913f3c7db3dbc6f1a4b27c932eb2.
Page7 not generated. Unmodified rejected audition remains evidence only, not refs.
All25 panda reader image/audio hashes recomputed unchanged. Exact root:
outputs/panda-book-final-draft-20260915 (manifest.json), NOT
outputs/panda-book-render-v2-20260915/reader. Correction handoff includes the full
read-only verification command. No customer activation.

Usage-based price estimateUSD0.1572235, conservativeUSD0.81999, four known outcomes.
Not an invoice; local cost-audit.json includes tokens, per-row math and receipt SHA.
Offline audit helper writes/compares cost-audit.json only, calls no provider.
Real run replay with throwing fetch and dummy key reproduced manifest/hold with
providerDispatches0 and no real key read. This historical replay used c94b0511;
corrected sample policy v2 requires a fresh root. Do not rerun this old paid root
under corrected prompts/context. Do not infer a fresh visual review from replay.

Artifacts ignored/local-only, no verified off-machine backup. Push never preserves
outputs/kim-system-sample-20260916 or its sibling input directory. Logs/receipts
must remain unchanged; no evidence migration or provider work in independent QA.

Falsification targets: first non-pass prevents next render, mode/prefix bypasses,
complete-plan requirement despite selected pages, exact source/ref/request binding,
usage preservation/no unknown retries, no repair authority, same raw blind/contextual
conflict, restored generic animal exclusion, cost bounds and local-only scope.

Inspection and focused checks (PowerShell):
```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
git status --short --branch
git log --oneline d1a79ab3..HEAD
git diff --check d1a79ab3..HEAD
npx.cmd tsc --noEmit
npx.cmd vitest run lib/owner-book-draft.spec.ts lib/__tests__/local-preview-quality.spec.ts lib/__tests__/local-preview-judge.spec.ts lib/__tests__/local-story-preview.spec.ts
node outputs/kim-system-sample-input-20260916/audit-results.cjs
```
No push performed by this task. Only after Guy requests propagation:
```powershell
git push origin codex/r3b1b-semantic-recovery-m1
```
