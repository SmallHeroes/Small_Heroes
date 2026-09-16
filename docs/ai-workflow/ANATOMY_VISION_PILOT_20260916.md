# Targeted anatomy evidence vision pilot — approved Decision Gate

Owner approved continuing the recommended small visual pilot on existing images,
then next-story work only if useful. Existing-key reuse was explicitly authorized.
Current task sole writer: C:/GNart/Work/sh-r3b1b-semantic-m1,
codex/r3b1b-semantic-recovery-m1, base5e25996fa94a2d595cd0fd35da44dd558dabaf63,
clean/ahead33 at intake. Protected d53b768ccb2f / accepted-intent63ccb484 read-only.
Stay in current task, no overlapping implementation/reviewer. Claude supplied
PASS0/0/0 on 01f092ea..5e25996f (offline rules ONLY), not this new API adapter.

## Decision / stop-check

1. Isolated research adapter: extract structured observations for one specified
   person and feed the real reviewed offline-v2 adjudicator. Not an active judge.
2. Root problem: synthetic rules cannot establish pixel accuracy; legacy observations
   lack new fields and must not be retroactively promoted. Test extraction, not
   another schema-only claim. General target description, no story-specific rules.
3. Reuse five high-detail exact-pixel views, GPT-5.5 medium, explicit Flex, no retries
   or tier/model fallback. No change to current book/render/QA policy or calibration.
4. Four target cases / three image files: Dini original child (operator defect), Dini
   corrected child (operator no obvious defect), panda page3 conductor (defect),
   same page3 tuba player (ordinary-occlusion negative). Two books but tiny sample;
   repeated targets on same image are not independent images. Labels are implementer
   visual judgments, NOT an independent goldset. Target descriptions do not expose
   labels/corrections or page numbers; only one target inspected per request.
5. Freeze manifest image SHA, neutral target description, expected labels and code
   before first call. Full image plus same four overlapping high-detail crops.
   This is targeted anatomy only, NOT all-page automatic target discovery or QA.
6. At most8 calls: each target once, repeat in reversed order only if at least one
   positive contains a defect. Stop after first4 if neither positive is detected.
   Stop immediately on transport/tier/model/incomplete/schema/budget failure;
   no automatic recovery, no local label/prompt adjustment after seeing responses.
7. Conservative checkpoint budget3USD, reservation0.5USD/call, max6000output tokens.
   Admission accounting at30USD/M all tokens remains conservative; not an invoice
   or guarantee of provider-side cap. Price estimate uses observed tier/usage only.
   Known over-reservation results persist and halt; unknown claims cannot retry.
8. Validation: focused offline/mock tests, tsc, no-network preflight; then bounded
   live calls. Persist raw responses/usage/tier/id, decisions and request hashes.
   No regex reinterpretation, no held -> defect conversion. Count defect presence,
   actionable disposition, misses, false defect reports, false holds separately.
9. Rollback: revert focused code, preserve local outputs/old book. No schema change
   to offline policy: export its existing schema, preserving adjudication semantics.
10. Claude re-gate after completion: read-only; falsify label leakage, bindings,
    accounting, hold/no-retry and reporting. No self-awarded independent PASS.
11. No new image/audio generation, source publication, launch, deployment or push.
    Future extraction accuracy remains unproven even if this small pilot matches.

## Documentation and credential skills

OpenAI Docs verified GPT-5.5 image input/structured outputs and medium support;
Flex docs specify 15-minute timeout and possible unavailable capacity. SDK retries
explicitly disabled; no Standard fallback. Existing key presence checked without
revealing value; reused in-memory only, no credential file writes.
https://developers.openai.com/api/docs/models/gpt-5.5
https://developers.openai.com/api/docs/guides/flex-processing
https://developers.openai.com/api/docs/pricing
Rates verified: Flex input2.50/cached0.25/output15USD per million below272k input.

## Limits

Expected max2 hands/feet applies only to these ordinary-human targets and stays
outside the model request. It is not a universal species rule. The visual observer
can still omit fragments or hallucinate boundaries. We do not solve those failures
by changing expected labels. Local outputs are ignored/not backed up by a push.
No evidence here changes the existing book's held status or 0.70 resemblance gate.

## Execution outcome — completed, not promoted

Frozen code commit: def8df46243a100ecd837cba00ecc2fc9cbb83d7.
Four requests completed on GPT-5.5 medium/Flex. No retries, fallback, unknown
outcomes, image generation or audio generation. The preset futility rule stopped
before a second round: no_positive_defect_evidence_after_first_round.

| Operator case | Disposition | Explicit defects |
| --- | --- | --- |
| Dini original child (positive) | held_uncertain | 0 |
| Dini corrected child (negative) | observed_pass | 0 |
| Panda3 conductor (positive) | observed_pass | 0 |
| Panda3 tuba player (negative) | observed_pass | 0 |

Dini's rear hand was recorded as unresolved with incomplete coverage, not proven
defective. The conductor report omitted the extra hand entirely while claiming
complete coverage. This is the documented omission limitation in actual model
output, not something the deterministic endpoint counter can recover. Neither
hold nor prose is reclassified as explicit defect detection. This four-target,
three-image, operator-labelled sample proves neither accuracy nor repeatability.
Current judge unchanged; new pilot is NOT suitable for promotion based on results.

Input tokens27636, cached3840; output10605. Four known priced calls; zero unknown.
Usage-based Flex list estimate USD0.204525; conservative checkpoint accounting
USD1.11723 against USD3. These are different accounting measures, not two charges;
neither substitutes for a provider invoice. No spend beyond these four calls.

Artifacts: outputs/anatomy-vision-pilot-20260916/{identity.json,report.json,REPORT.md}
plus original claims/results/decisions. Config is
outputs/anatomy-vision-pilot-input-20260916/config.json. These roots are ignored,
local-only; no verified off-machine backup. Git push does not preserve them.

Validation: 173/173 across seven specs (pilot14, policy45, cost11, judge16,
anatomy27, quality28, checkpoints32). tsc0 before code commit. Actual receipt
replay with global fetch replaced by a throwing network fence reproduced the
report, providerDispatches0, no key read. All25 final panda reader PNG/MP3 hashes
matched the existing manifest. Five active judge/quality files byte-unchanged
against5e25996f. Full npm run check NOT rerun; repository stability stays NON-GREEN.

## Next story: editorial work only

Chosen accepted source: story-pipeline/04_approved_story_sources/accepted/
chameleon_koko_bedtime/story.md, unchanged SHA
49d2866ee4cdef5ea5155c87f7769f6c653ba224ff4b5ec490a039dfd632a76d.
New ignored draft: outputs/next-book-kim-draft-20260916/story.md, SHA
6ad8028651496247e70c7e1bdce1ab648ecf66642a5e44a43f548f0b6f0728a3.
Real previewStory parser returned8 pages/614 words for Bar/boy. The story gives
Bar a personal reason to get home, lets Kim contribute a successful solution,
and resolves the walking-stop problem through teamwork and a bedtime callback.
No accepted-source edits, publication, visual package/Blueprint reuse or media.
This is personalized editorial draft text, not approved catalog/runtime material.

## Claude Code read-only handoff

Original requirement: test whether targeted structured visual evidence improves
severe anatomy detection affordably, without modifying the active judge, then
advance useful next-story preparation. Review branch
codex/r3b1b-semantic-recovery-m1 in C:/GNart/Work/sh-r3b1b-semantic-m1.
Code range5e25996fa94a2d595cd0fd35da44dd558dabaf63..def8df46243a100ecd837cba00ecc2fc9cbb83d7;
the following documentation-only closeout is separately identifiable in git log.
Prior independent PASS ends at5e25996f; no independent adapter PASS is claimed.

Production changes: export existing anatomyEvidenceSchema without semantic change;
isolated scripts/lib/anatomy-vision-pilot.ts and scripts/run-anatomy-vision-pilot.ts.
Tests: lib/anatomy-vision-pilot.spec.ts. Documentation: CURRENT.md and this gate.
First pass review-only; no provider calls, credential access, renders or migration.

Falsify: label/count leakage in actual requests; image/context/code/checkpoint
bindings; one-dispatch/no-retry behavior; persistence before served-tier/status
validation; replay requiring no key/network/writes; accounting and unknown holds;
futility stop and honest separation of hold, defect and false pass. Inspect the
conductor omission against raw output. Confirm no active consumers were changed.
Do not treat mocked transport tests, operator labels or full-check omissions as
visual accuracy, independent editorial acceptance, stability or release approval.

Focused checks (PowerShell, no paid calls):
```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
git status --short --branch
git log --oneline 5e25996f..HEAD
git diff --check 5e25996f..HEAD
npx.cmd tsc --noEmit
npx.cmd vitest run lib/anatomy-vision-pilot.spec.ts lib/anatomy-evidence-policy.spec.ts lib/qa-cost-experiment.spec.ts lib/__tests__/local-preview-judge.spec.ts lib/__tests__/local-anatomy-experiment.spec.ts lib/__tests__/local-preview-quality.spec.ts lib/__tests__/local-story-preview.spec.ts
```
No push performed as part of this milestone. Only after owner requests propagation:
```powershell
git push origin codex/r3b1b-semantic-recovery-m1
```
