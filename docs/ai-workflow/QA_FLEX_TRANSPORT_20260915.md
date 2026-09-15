# QA Flex-only transport — Decision Gate and handoff

## Decision Gate (approved before implementation)

1. Change: route both stages of the shared local-preview judge through Flex,
   recording requested/served tier, response identity/model and incomplete details.
2. Why: the completed 12-call experiment proved Flex service on the existing model;
   compact context was not equivalent enough to adopt. Current adapter omits tier.
3. Scope: general shared adapter, tests and documentation only; callers are
   owner-book draft, accepted/calibrated local preview and calibration CLI.
   This is NOT a migration of every customer-production QA implementation.
4. No story/child/page-specific rules. No changes to prompts, crops, schemas,
   output caps, GPT-5.5 medium, calibration identity or resemblance threshold.
5. Files: scripts/lib/local-preview-judge.ts, its spec, CURRENT.md, this brief.
6. Expected: request Flex with 15-minute timeout and zero SDK retries; persist
   known responses before checking actual tier; missing/non-Flex tier stops.
   No Standard fallback, no reinterpretation as a visual defect.
7. Validate mocked real adapter: request parity, both stages, replay, tier
   mismatch/missing, incomplete response, unavailable/timeout, old receipts.
   Run focused neighboring suites and tsc. No paid validation required.
8. Cost: zero provider calls/renders/audio for implementation. Existing conservative
   reservations/accounting stay unchanged; tier metadata is not an invoice.
9. Rollback: revert only this focused commit after review; do not delete receipts.
   New checkpoint identity includes transport separately from model-visible input.
   Historical Standard checkpoints fail closed on resume, not silently relabeled
   or replaced. Preserve their roots; a separately authorized fresh QA root is
   required for re-evaluation (do not rerender existing images merely to migrate).
10. Guy approved proceeding after the Flex-only recommendation. Codex is sole
    writer in C:/GNart/Work/sh-r3b1b-semantic-m1, branch
    codex/r3b1b-semantic-recovery-m1, base 89de57e455d0931732edc11e71fddde13e908800,
    clean/ahead 30/behind 0 at intake. Protected d53b 768ccb2f and accepted-intent
    63ccb484 are clean/read-only. Continue in this task, no overlapping writer.
11. Exclusions: compact experiment promotion, anatomy accuracy claims, book/media
    changes, calibration PASS, release/deployment/push, relaxed gates or retries.

## Stop-check and risks

General transport change affects all three local-preview callers, not story content.
No new paid work or creative decision is needed; no visual eyeballing required.
Flex may be slower or unavailable. Existing claim-without-result handling reserves
unknown outcomes and prohibits automatic retries, including after a 429; conservative
accounting is deliberately not treated as actual billing. Existing roots with old
QA checkpoints reject at the judge checkpoint, not necessarily at CLI startup.
Independent QA should falsify prompt parity, receipt preservation, no fallback,
legacy replay refusal and context suppression after failed anatomy transport.
No new independent PASS. Known anatomy false negatives and full-check instability
remain open. OpenAI Docs skill informed tier selection and 900000 ms timeout:
https://developers.openai.com/api/docs/guides/flex-processing

## Verification and handoff

Implemented with one production adapter file and its focused spec. No caller code,
quality policy, budget code or assets changed. This adapter error stops the candidate;
the owner-draft caller retains its existing up-to-three-failure policy across pages.
No claim that a single wrong-tier result immediately halts that entire CLI.

105/105 tests pass in five specs (adapter 16, quality 28, checkpoint 32, experiment
11, owner draft 18). Includes real OpenAI SDK with intercepted fetch: a 429 creates
exactly one dispatch; replay cannot call again. All other provider tests are mocks.
tsc exit 0, diff check 0. Full npm run check not rerun for this narrow adapter change;
historical NON-GREEN stability remains unresolved. No new paid calls, no new live
adapter run: prior experiment proves availability, not this implementation's live QA.
25/25 reader PNG/MP3 hashes recomputed against its manifest. Inline Node verification
first failed syntax parsing; native PowerShell subsequently verified all 25.

Claude Code: first pass read-only, no credentials/provider/renders or edits. Review
only the focused commit directly after base 89de57e455d0931732edc11e71fddde13e908800
on codex/r3b1b-semantic-recovery-m1 (resolve the child below; reconcile topology).
Do not extend prior PASS ranges or infer whole-tree/release acceptance. Falsify:

- Actual requests, both stages: only service_tier changes model-visible payload;
  timeout increases, SDK retries stay zero. Five high-detail candidate views remain.
- Tier metadata persists before rejection; incomplete/unknown cannot become PASS
  or paid image-repair authority. Context cannot erase blind anatomy defects.
- Wrong/missing tier and exact replay: no fallback/rebill; historical Standard
  fingerprint rejected, unchanged evidence. Reservations remain conservative.
- Callers import the shared adapter, compact experiment remains isolated, and
  current book media are untouched. Known anatomy false negatives are not fixed.

Copy-ready PowerShell (inspection/tests; optional push only when Guy requests it):

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
$qaFlexBase = '89de57e455d0931732edc11e71fddde13e908800'
$qaFlexHead = git rev-list --reverse --ancestry-path "$qaFlexBase..codex/r3b1b-semantic-recovery-m1" | Select-Object -First 1
git show --no-patch --oneline $qaFlexHead
git status --short --branch
git diff --stat "$qaFlexBase..$qaFlexHead"
git diff --check "$qaFlexBase..$qaFlexHead"
npx.cmd tsc --noEmit
npx.cmd vitest run lib/__tests__/local-preview-judge.spec.ts lib/__tests__/local-preview-quality.spec.ts lib/__tests__/local-story-preview.spec.ts lib/qa-cost-experiment.spec.ts lib/owner-book-draft.spec.ts
# Optional, only following explicit push instruction; pushes this milestone, not later commits:
# git push origin "${qaFlexHead}:refs/heads/codex/r3b1b-semantic-recovery-m1"
```

Tests above run the current checkout; if HEAD differs from resolved review head,
reconcile and use an agreed immutable review worktree before testing (do not reset
the writer's worktree). No stage/commit commands needed: Codex commits the milestone.
