# Model comparison: independent QA intake and wording correction — 2026-09-24

## Decision and topology

Guy supplied Claude Code's completed read-only review. Its HEAD90c91555 matches
this task's starting HEAD90c9155530f99aed306b30af485a6f50f4c920fa, clean/ahead21,
behind0. Continue in the current task, Codex sole writer, worktree
C:/GNart/Work/sh-r3b1b-semantic-m1, branch codex/r3b1b-semantic-recovery-m1.
Protected worktrees d53b at768ccb2fe20edb1351cb4783796613cbf7a2993c and
sh-r3b1b-accepted-intent-wave-2 at63ccb4846ebe5be9ab392960d389610a1b2b9d42 are
clean/read-only. The concatenation d53b768ccb2f was imprecise prose, not a Git ref.

Scope is documentation correction only under the existing QA/re-gate workflow.
No new product choice, image-generation behavior, metadata schema, logging code,
QA severity, price calculation or authority change. No Decision Gate for a new
runtime change is implied. Cost0, no credentials/provider calls, no push.
Validation: tsc, diff check and read-only artifact report replays; no test/full
gate rerun needed for a Markdown-only diff. Rollback is a documentation revert,
never modification of saved provider or QA evidence.

## Supplied independent verdict and exact boundary

Claude supplied PASS (technical) for79dea3db..94285789 plus both measurement
records, reviewed at documentation closeout90c91555. Supplied grades were F1
Medium (non-blocking), F2 Low and F3 Low. No P0/P1/P2 counts were supplied, so
none are inferred or mapped from that different scale. He reported204/204 and
tsc0, ten black-box real-CLI
cases, old-root identity byte compatibility, independent hashes/fingerprints/raw
QA/ledger/preservation recomputation, and both offline reports reproducing.
He did not recheck live pricing. This is attributed independent evidence, not a
claim Codex reran those probes now. No PASS of the entire ahead set, product,
visual accuracy, continuity, release or full gate. At the original corrective
handoff this correction was outside that PASS and had no independent re-gate.
The subsequently supplied re-gate below covers it through aa0faa73 only.

## Supplied documentation re-gate — frozen aa0faa73

Claude subsequently supplied PASS for90c91555..aa0faa73eb5e2710675fa69234350bb95c5286f3:
one commit, five Markdown paths,+199/-10. All four falsification targets held.
He reported tsc0, both offline reports unchanged, his independent recomputation
41/41, and a direct inspection of58 files across the six ignored evidence roots.
He reports saving scratchpad/evidence-roots-baseline-aa0faa73.json for later
reviews; this is reviewer-provided context, not a tracked or independently backed
up artifact claimed by Codex. Optional-field and token-to-tier limitations and
intended-versus-observed exit distinctions were accepted by the reviewer.

The sole non-blocking nit was to retain the original Medium/Low/Low grades,
now recorded above. F2 metadata capture, F3 observed-exit logging and the estimator
comment remain deferred. Full gate RED; both images HELD. No product/continuity
acceptance and no extension to the earlier18 commits. At re-gate HEAD the branch
was clean/ahead22; propagation would carry all22, not just the four latest commits
Claude says he reviewed. This transcription adds a further local documentation
commit; it is outside the frozen PASS and has no self-awarded independent PASS.

Transcription scope: same sole-writer task/branch/worktree, base aa0faa73, three
Markdown paths only, zero code/artifact/spend/push. tsc0, diff check clean, both
offline reports exit0 with unchanged costs/preservation; no tests/full gate rerun.
For optional transcription QA,
freeze its direct successor and inspect aa0faa73..HEAD; verify the supplied grades
and the two exact PASS boundaries without rerunning or expanding the paid work.
Use the existing inspection/push commands below with that documentation range;
inspect the entire actual ahead set before any owner-authorized push.

Claude classified the historical41 failures as39 timeouts +2 assertion failures
and found no import/spawn path from the15 failing files to the changed owner CLI.
That is useful structural evidence, not an untouched-base timing counterfactual
or a stability closure. Full gate remains RED; no full run is claimed here.

## F1 — verified; misleading guard claim corrected in both documents

Direct code inspection confirms generate-image.ts sets requestedModel=imageModel,
never changes that model, compares those equal strings for fallbackUsed, and
returns the requested model. The current ImagesResponse SDK type has no model
field. The caller's mismatched-result branch exists and is tested with mocks,
but the current real generator cannot return the fault those tests inject.
The handoff and MODEL_COMPARISON_GATE now explicitly say defensive mocked
contract/request provenance, not live provider-substitution detection. Existing
runtime tests remain valuable but prove that narrower claim. No shared generator
fix or stronger provider guarantee is claimed. Independent wording closure pending.

## F2 — verified optional schema fields; stronger interpretation not adopted

Installed openai6.35.0 ImagesResponse declares optional top-level quality and size.
Both generator branches retain data[0] metadata and usage, not those top-level
fields. Thus available schema capacity was not persisted; we cannot assert that
the actual responses contained either optional field or reconstruct their values.
Future narrow metadata-capture work should record provider-reported quality/size
separately from requested values and represent absence honestly. It is deferred,
not silently implemented or declared closed by this documentation correction.

Recomputed raw usage: input5251 in each, output image tokens158 LOW vs343 MEDIUM,
343/158=2.170886075949367. This is provider-reported evidence of different token
consumption, consistent with changed quality; it does NOT by itself prove the
provider's exact quality tier. Claude's stronger "proof the render tier really
changed" wording is not adopted. No inference of better visual accuracy follows.
The official [image guide](https://developers.openai.com/api/docs/guides/image-generation)
fetched2026-09-24 recommends measuring consumption with usage and explains that
token counts vary by model and quality; it does not establish a unique inverse
mapping from a token count to actual tier. No new pricing/billing claim is made.

## F3 — historical exit claim scoped; future logging remains deferred

Both execution.json/native.json records persist child nativeExit2. The harness
normal branch assigns process.exitCode2 for their recorded preserved/budget
values. Codex's execution tool returned outer exit_code1 in the conversation,
but no artifact independently records the harness process exit. Claude could not
reproduce the asserted wrapper conversion. We withdraw the wording "wrapper
exit1" as a harness fact; the observation belongs to the tool boundary only, with
cause unknown. We do not infer PowerShell as the cause or replace unmeasured
historical exit status with a fabricated measurement.

A future harness may persist its intended exit and an outer runner's observed
process exit separately. Merely recording process.exitCode inside the harness
would attest intent, not an observed termination status. No historical artifacts
were edited and no new subprocess logging behavior was introduced here.

## Remaining note and unchanged product boundary

The upper-rate estimator comment still names older models. Claude recommends
updating it next time the allowlist grows; record that follow-up without changing
lib/ in this prose-only correction. Existing Sunburst pricing/accounting remains
as independently reviewed; one historical1USD reservation remains unresolved.
LOW and MEDIUM remain HELD, cumulative accounted upper8.13226 under9.50, nominal
new usage0.25998 not invoice verified. No next-page/continuity proof. No more
spend or QA relaxation authorized by this PASS. Constraint criticality still
requires an explicit prospective product decision; do not retroactively pass
held images. All six evidence roots remain local/ignored with no verified backup.

## Re-gate brief and copy-ready commands

Codex validation for the original prose correction committed aa0faa73:
tsc exit0, diff --check clean; both
offline reports exit0/providerCallsThisReport0 with original costs and dispositions,
including the original203-file SHA/size/mtime preservation. Five Markdown paths
only; zero runtime/test/output paths edited. No focused/full test rerun claimed.

Review this correction from90c91555 to its single documentation successor. Freeze
the actual successor SHA; verify its parent and Markdown-only scope. Falsify:

1. No wording still claims actual provider-model/fallback attestation from the
   current generator or quality-tier proof from token counts alone.
2. Native child exit, harness intended exit and outer tool observation remain
   distinct; no invented historic process measurement or asserted shell cause.
3. Supplied technical PASS stays79dea3db..94285789 plus measurement records;
   this correction and deferred F2/F3 code work receive no self-awarded closure.
4. Source, code/tests, six evidence roots, prices and all old image/QA bytes stay
   unchanged; both offline reports reproduce, including203 preserved files.

```powershell
Set-Location 'C:/GNart/Work/sh-r3b1b-semantic-m1'
git status --short --branch
git log --oneline 90c91555..HEAD
git diff --stat 90c91555..HEAD
git diff --check 90c91555..HEAD
npx tsc --noEmit
node story-pipeline/06_editorial_refresh/2026-09-16/book-proof/sequence-recovery/model-comparison.cjs --report
node story-pipeline/06_editorial_refresh/2026-09-16/book-proof/sequence-recovery/model-comparison.cjs --report --medium
```

Do not use --run or --write; no provider/credential/output-write authority.
Optional owner-only push AFTER reviewing the entire ahead set, not executed:

```powershell
Set-Location 'C:/GNart/Work/sh-r3b1b-semantic-m1'
git status --short --branch
git log --oneline '@{u}..HEAD'
git push origin HEAD:refs/heads/codex/r3b1b-semantic-recovery-m1
```
