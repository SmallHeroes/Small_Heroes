# QA cost experiment — owner approved 2026-09-15

1. Change: isolated Flex control versus compact-context/concise-report experiment.
   No active judge, renderer, reader, calibration or release gate changes.
2. Why:29QA calls cost estimated3.340410USD; contextual14 cost2.449830, blind
   anatomy15 cost0.890580. All cached_tokens0. Full21,801-character plan repeated.
   Known serious anatomy defects still missed. Savings alone are not acceptance.
3. Scope: generic experiment transport/helpers plus four existing panda fixtures.
   This task sole writer in semantic-m1 at4a66197d, ahead28/behind0, clean start.
   Protected d53b768ccb2f and accepted-intent63ccb484 clean/read-only. No new task.
4. Hardcoding: page selection is experiment data, never runtime conditionals.
5. Files: scripts/lib/qa-cost-experiment.ts, scripts/run-qa-cost-experiment.ts,
   lib/qa-cost-experiment.spec.ts, CURRENT.md, this gate. outputs separate/local-only.
6. Expected: compare same gpt-5.5 medium/high-detail pixels and same eight categories.
   Shared fresh blind anatomy per image; two contextual arms use the SAME anatomy.
   Control retains current full context/instruction/schema; compact uses current
   state, canonical inventory, current page and book camera summary, stable refs
   before dynamic data, concise observations. Output limits unchanged10000/4500.
   Counterbalance arm order. No claim to isolate each compact-bundle subcomponent.
7. Validate: unit request contracts, projection state/change coverage, no future-state
   leakage, strict category/binding validation, served-tier check, immutable replay,
   no fallback; tsc. Four cases0/3/9/12 original image bytes. Anatomy negatives0/9
   are implementer-observed controls only, not gold all-category product approvals.
   Positive3/12 have extra conductor hands. Expectations never sent to the judge.
8. Cost: up to12new Responses calls (4shared anatomy+8contextual), Flex only, no
   images/audio.8USD conservative accounting ceiling using shared checkpoint30/M
   upper rate, not invoice hardcap.1USD admission per call, one dispatch, no retries.
   Stop on unknown outcome, non-Flex served tier, transport error or budget fence.
   Known incomplete responses remain billed and never become PASS. Same-token
   standard/Flex list-price comparison distinguished from observed token changes.
9. Rollback: stop experiment; original artifacts/runtime remain untouched.
10. Review: Guy explicitly approved running this proposed experiment and previously
    authorized existing-key reuse. No new unresolved owner choice in this scope.
    Independent Claude QA pending: falsify cost attribution, equivalence claims,
    held-to-pass conversion, frozen inputs, side effects and preservation.
11. Do not: change model/effort/0.70threshold, shorten output cap, remove image crops,
    promote diagnostic PASS, rerender, deploy, push, read other credentials, create
    keys or broaden permissions. No automatic retry on Flex unavailability.

Stop-check: general isolated prototype; no production behavior; paid small bounded
sample explicitly approved; no creative acceptance requested or inferred. Need
matched detection of known defects and no new false anatomy positives before any
quality recommendation; four-case sample cannot establish population reliability.

Official docs checked: https://developers.openai.com/api/docs/guides/flex-processing
and https://developers.openai.com/api/docs/pricing. Flex slower/occasionally unavailable;
gpt-5.5 rates2.5/.25/15USD per million input/cached/output (standard5/.5/30).

## Completed evidence and independent review handoff

Implementation range4a66197db4a1634c672926cf60dab88d433dcadf..
d7bdf371 (resolve full SHA before review). This completion documentation is a later
separate commit, not an extension of independent code PASS (none has been issued).
Same branch/worktree, sole task writer; no push. New generic isolated builder/runner
and11tests; existing active adapters unchanged.74/74 in4specs, tsc0,diffcheck0.

12known completed/0unknown calls, all actual Flex/gpt-5.5-2026-04-23. No attempts
beyond declared ceiling, SDK maxRetries0, no fallbacks. Unique usage list estimate
0.6753635USD; conservative4.66815under8. No invoice verification.4shared anatomy
calls cost0.112735; contextual control4cost0.30634; compact4cost0.2562885.
Hypothetical full lanes0.419075 vs0.3690235; shared anatomy counted only once in
actual total. Control Standard-equivalent0.83815 is counterfactual, NOT new paid
Standard requests. Additional compact savings11.9433%, combined55.9717%; original
60–70% goal not achieved. Context input60418→50253, output10353→9632; reasoning
6726→7878. Cache0→6144; visible output3627→1754. Do not equate report brevity
with reduced hidden reasoning. Latency15.312–58.387sec, sum388.366sec.

Both arms anatomy pass on all four cases, thus BOTH known extra-hand positives3/12
MISSED, negatives0/9matched. Negatives are anatomy-only implementer labels, not
gold full-category PASS. Cover control flags framing omitted by compact; page9
compact flags gate drift omitted by control. Both page12 overall passed despite
extra hand. No statistical equivalence, calibration or runtime authority follows.
Compact is a bundle of projection/order/report changes; cannot attribute each
saving/quality difference causally from this sample. Recommend Flex-only migration
next, not active compact rollout. Neither change solves existing anatomy failures.

All local evidence outputs/qa-cost-experiment-20260915: identity,12claim/result
pairs,8input/decision pairs,report,COST_COMPARISON.json,REPORT.md. Inputs/config and
cost summarizer outputs/qa-cost-experiment-input-20260915. Ignored/local-only; push
does not back up any paid evidence. Whole book originals/manifests preserved.
Actual artifact replay with dummy key/network forbidden:0providerDispatches, same
decisions, exit0. First replay ESM named import failed before execution; CommonJS
invocation worked. No paid replay call. Fullcheck remains NON-GREEN/not rerun.

Claude first pass read-only. Falsification targets: actual tier/rate accounting,
no double-count shared anatomy, artifact/request identity and resume cache, no
expected-label leakage into prompts, current-state projection/future isolation,
reference/crop parity, conservative admission, no active adapter imports/cutover,
and correct distinction between cost success and quality failure. No keys/providers,
rendering, edits, commits, push or independent self-PASS in this handoff.

```powershell
Set-Location 'C:/GNart/Work/sh-r3b1b-semantic-m1'
$reviewBase = '4a66197db4a1634c672926cf60dab88d433dcadf'
$codeTip = git rev-parse d7bdf371
$docsTip = git log -1 --format=%H -- docs/ai-workflow/QA_COST_EXPERIMENT_20260915.md
git status --short --branch
git worktree list --porcelain
git branch -vv
git diff --stat "$reviewBase..$docsTip"
git diff --check "$reviewBase..$docsTip"
npx.cmd tsc --noEmit
npx.cmd vitest run lib/qa-cost-experiment.spec.ts lib/__tests__/local-preview-judge.spec.ts lib/__tests__/local-preview-quality.spec.ts lib/__tests__/local-story-preview.spec.ts
node outputs/qa-cost-experiment-input-20260915/summarize.cjs
# Optional push only on Guy's explicit instruction; carries all ahead commits:
# git push origin codex/r3b1b-semantic-recovery-m1
```
