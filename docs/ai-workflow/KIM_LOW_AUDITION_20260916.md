# Kim LOW three-image audition — owner-approved gate

## Proposal and authority
Guy approved the preceding recommendation: visual planning and three LOW sample
images, explicitly reusing the existing API key. Same task is sole writer in
C:/GNart/Work/sh-r3b1b-semantic-m1 on codex/r3b1b-semantic-recovery-m1,
base cd0e01140decfa9a464b593c24f248114cc0eb35, clean/ahead35 at start.
Protected worktrees d53b768ccb2f and accepted-intent63ccb484 remain clean/read-only.
This is unaccepted editorial audition data, NOT a production book or source cutover.

## Why / observed gap
Eight-page Kim editorial draft exists but has no corresponding approved visual
package. Existing renderer's through-page option selects a prefix, not three
noncontiguous story beats; its automatic board prompt also contains living-path
prose from a prior book. Do not invoke that path for Kim or alter it opportunistically.
Use the installed imagegen CLI for the explicitly authorized existing-key API
audition, with direct reference roles and persisted prompts. No one-off SDK runner.
This does not prove the production pipeline consumes this new story.

## Scope and intended result
Story SHA6ad8028651496247e70c7e1bdce1ab648ecf66642a5e44a43f548f0b6f0728a3.
Pages1/3/7 test discovery, active humorous interaction, and a gentle closing scene.
Warm watercolor, full scenic compositions, varied camera angles and emotions.
Bar's existing face reference and Kim's canonical yellow-green/mustard-satchel
front reference are reused, never overwritten. Page1 becomes a provisional stop
design reference for pages3/7; it is not promoted to a canonical accepted anchor.
Structured audition plan and final prompts are retained under a new local root.

## Decision / stop-check
1. Story-specific creative data only; no general code patch or production behavior.
2. No other story/child/style or accepted source is changed.
3. Paid: three intended gpt-image-2 LOW requests at768x1152, n1, sequential.
   No deliberate repair attempts or QA model calls; stop on failed CLI execution.
   Bundled CLI uses SDK default retry policy; do not claim zero SDK retries or a
   hard dollar fence. Its CLI does not retain response usage: exact billed total
   cannot be established from output files. Record this limitation, not fake cost.
4. Smallest approved test: three chosen pages, not full-book images/audio.
5. Owner decision supplied in current message; no new product decision needed.
6. Risks: anatomy misses, identity/scale drift, model redesigning the moving stop,
   local-only evidence, smaller detail. No claim of automatic QA reliability.
7. Validate actual output dimensions/hashes, inspect each full image, compare
   recurring designs and source moments. Technical checks do not equal product PASS.
8. Claude read-only review may falsify source/reference binding, scope, cost claims
   and preservation; Guy reviews visual direction. No consultant blocking dependency.
9. Rollback is non-adoption of isolated artifacts; original assets remain intact.

## Exclusions
No accepted-story publication, package/Blueprint migration, active QA/model/threshold
change, automated repair, HIGH rendering, full book, narration, deployment or push.
New outputs/prompts live in outputs/kim-low-audition-20260916, ignored/local-only,
no verified off-machine backup. Git push cannot preserve these artifacts.

## Results and independent read-only handoff

Three invocations completed exit0, CLI elapsed18.3s/29.4s/19.6s, three PNGs.
No intentional rerender, QA call, narration or key write. No usage/response ID
receipts available; paid total unknown. SDK attempt count unknown. No price-saving
measurement, budget-fence or image-provider invoice claim. This isolated CLI lane
must not be scaled up as a replacement for the existing accounted render pipeline.
Official pricing inspected but cannot recover missing usage:
https://developers.openai.com/api/docs/pricing

Operator inspection: airy composition and distinct scene actions; provisional
shelter materials recognizable across images. Remaining observations: page1 feet
both appear planted, so first step unclear; page3 hand seems to contact laundry,
not clearly release rope, and roof remains above intended shoulder level; page7
hands at window need ownership review. No numeric resemblance/automated PASS,
no independent visual accuracy claim. No final product acceptance requested by
implication. Full set is not rendered. Story source remains original draft SHA.

Artifacts and post-run hashes in outputs/kim-low-audition-20260916/REPORT.md.
Static comparison uses installed Creative Production review renderer, image-wall
preset; direct board invocation was not exposed in this session's tool interface,
so static fallback used. No custom reader or deployment was created.

Read-only review target: documentation-only child ofcd0e0114 in named branch;
resolve exact resulting HEAD before review. Changed tracked paths CURRENT.md and
this file. No source/engine/QA code change; new audition artifacts ignored.
tsc --noEmit0. Full repository check not rerun; prior NON-GREEN not waived.
Falsify source/reference preservation, three-output dimensions/hashes, honest
description of visual weaknesses, absence of cost/retry certainty, no accepted
source/active-reader changes, and local-only storage disclosure. No provider or
credential access is needed for review. Do not award independent PASS to unreviewed
ancestor code or these product images by reviewing the transcription.

PowerShell inspection (no paid calls):
```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
git status --short --branch
git log -1 --oneline
git diff --stat cd0e0114..HEAD
git diff --check cd0e0114..HEAD
npx.cmd tsc --noEmit
Get-FileHash outputs/kim-low-audition-20260916/page-*.png -Algorithm SHA256
```
No push in this task. Only if Guy requests propagation:
```powershell
git push origin codex/r3b1b-semantic-recovery-m1
```
