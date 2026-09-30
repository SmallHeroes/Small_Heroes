# Claude Code re-gate: availability refresh and exact boundary tests

## Original requirement and received review

Guy authorized activating the voice-first wizard with the existing key so he can
record a profile, correct/remove/add facts, select companion/length and judge a
personal Hebrew adventure plus whole-book storyboard/continuity. A schema pass
does not establish humour, age-appropriate prose, resilience or visual quality.

Received Claude verdict: technical PASS, no P0/P1/P2, EXACTLY
`10f54930..806ce4d7`; docs-only `30961ca5` consistent. Earlier writer/runner HOLD
findings addressed, but bridge `45b9e754..07d3c8d3` remains unreviewed. Four P3
observations were provided, not zero observations or a full-branch acceptance.

This correction addresses availability P3-1 and test gaps P3-4 only. First QA pass
READ ONLY: no credentials, provider calls, ledger resets, edits, deployment or push.

## Frozen topology

- Implementation worktree: `C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes`.
- Branch: `codex/personal-book-storyboard-bridge`, local, no upstream.
- Base: `30961ca5ad491600b4cb8d1ee24ba1be3ae2f3ce`.
- Review head: the immediate single-commit successor of that base. Freeze with
  `git rev-parse HEAD` and require `git rev-parse HEAD^` equals the full base above.
  An exact short/full SHA is supplied in Codex's final message after committing.
- Same Codex chat, sole writer. No new/overlapping implementation task.
- Protected d53b `768ccb2f`, accepted-intent `63ccb484`: clean/unchanged.
- Claude landing `86ca47e8` ahead 2, prototype `fd2b26bd`, QA release `41359878`:
  clean/unchanged; reviewer remains detached at `806ce4d7`. None received writes.

## Investigation, decision and scope

Observed: intake refresh encoded network/non-200/malformed status as false. The
focus consumer then invoked the existing send-withdrawal effect. Summary checked
book availability only on mount, so returning from sign-in left it disabled.
Expected: indeterminate status must not revoke known availability; actual denial
must still revoke it. Sign-in return should update both surfaces without reload,
draft loss or any automatic paid request.

Root cause: unknown and explicit refusal conflated at one boundary; mount-only
subscription at the other. Not an auth failure or a reason to bypass route guards.
Two consumers justified one small browser-only focus lifecycle after diagnosing
those paths. Rejected: removing withdrawal, treating all errors as live, auto
retrying paid work, page reload, polling, increasing limits or restarting ledgers.

Order: baseline regression -> client distinction/shared lifecycle -> both effects
-> exact timer/cap tests -> offline mutations -> focused/full check -> browser
request acceptance without paid generation -> focused local commit -> re-gate.
No data migration. Rollback only the scoped successor; no evidence erasure or
restarting the active server to reset its in-memory allowances.

## Implementation claims / paths

1. `lib/personal-wizard/availability-client.ts` (new, browser-only): initial read
   and window-focus read, latest-request epoch, unmount cleanup, undefined means
   unknown/no publication. No POST, timers, polling, auto retry or draft access.
2. `intake-live-client.ts`: valid boolean status is known; HTTP 401/403/404 is known
   unavailable; malformed/network/other non-success is unknown. Compatibility
   boolean reader still returns false for anything except explicit live true.
3. `book-preview.ts`: validated quote is known; 401/403/404 publishes null and clears
   stale quotes; malformed/network/other non-success is unknown. GET no-store only.
4. `app/dev/personal-wizard/{PersonalWizard,StoryPreview}.tsx`: both use that watcher.
   Initial states remain false/null. Real revocation still withdraws send intent.
   Result/job epoch, explicit POST, edit/cancel behavior and server-reviewed request
   are unchanged. Availability shapes UI only; routes still authorize each call.
5. Existing four specs extended: `intake-live-client`, `book-preview`, `book-runner`,
   `story-openai`. No new spec file or workload classification change.
6. `CURRENT.md`, `ROADMAP.md` and this handoff record the exact earlier PASS and
   open limits, without awarding an independent PASS to this successor.

No changes to writer, book runner, actual SDK, budgets, ledger, auth, server routes,
schemas, recording controller, approved story bank, image QA, marketing or design.

## Evidence actually produced

- Baseline control before client correction: 97/98 across three specs, native 1;
  new unknown-status test failed on actual existing reader. Exact deadline and cap
  tests passed baseline (they expose missing coverage, not existing timer defects).
- An intermediate test-only assertion typo and ES target-incompatible `.at()` were
  corrected; no production change for either. Final four specs **124/124**, native 0.
- `npx tsc --noEmit`: native 0.
- `npx vitest run lib/personal-wizard/__tests__ lib/__tests__/vitest-workload-classifier.spec.ts`:
  **467/467**, 19 files, native 0. Includes actual audio tests; no new flake here.
- `npm run check`: overall native 1, RED. Ordinary 375 files, 10 failed / 5272
  passed / 73 skipped; resource 20 files, 635/635 tests but three onTaskUpdate RPC
  errors and native 1. Same ten failure names as `full-check-806ce4d7.log` by exact
  comparison. This is matching historical evidence, not revert-and-compare proof
  of causal independence or a stability/release claim.
- Four Vite pre-transform mutations only in the test process, no runtime source
  writes: wrong visual deadline -> 6 failed; deleted story cap guard -> 3 failed;
  removed epoch guard -> 4 failed; removed unmount guard -> 1 failed. All native 1,
  mutation harness native 0 (all detected). Providers are mocked; $0.
- Chrome on existing live server: authenticated live-intake privacy line shown;
  manual synthetic profile accepted by request POST 200; book GET 200; matching
  short quote $1.8018 and enabled explicit generation control. No audio/text intake
  or book POST, no provider call, no money/job reservation consumed by this check.
- One browser console hydration warning showed body attribute `cz-shortcut-listen`
  absent from server markup. We did not change/remove browser extensions, and do
  not claim a zero-error browser run or prove the warning's cause. UI flow completed.
- Transient/focus race and sign-out cases exercised through the actual production
  reader + watcher with scripted Response/EventTarget, not real browser auth toggles.
  The component hookup also has a static wiring guard; it is not a mounted React
  test or a live sign-in/out race reproduction. Please attack the real hookup.

Raw artifacts: `outputs/personal-book-availability-correction-20260930/` contains
focused/full logs, mutation config/harness, four mutant logs and result JSON.
Ignored/untracked/local-only, no verified off-machine backup; Git push does not
preserve them. Previous outputs were not edited except the naturally growing live
server log. Screenshot outside repo:
`C:/Users/guyna/.codex/visualizations/2026/09/04/01a06c5c-a233-76c0-ac8e-618c02ce6246/personal-book-live-ready-20260930.png`.

## Explicit falsification targets

1. Start false/null; malformed JSON/5xx/rejected promise must not enable either UI.
   Start known true/quote; same failures must not downgrade it. A valid false or
   401/403/404 must revoke, even if that error response carries a true-looking body.
2. Focus after initial refusal should publish a validated quote/live flag without
   remount or draft edits. No recording request or book POST may follow focus alone.
3. Resolve focus requests out of order, including a newer unknown result. Only the
   latest known response may publish. Unmount removes listener/blocks late answers.
4. Preserve the real send-withdrawal/security guard and current request/result
   epochs. Cached UI state cannot grant server authority or hide a paid refusal.
5. Exact timer tests must fail if storyboard/review use the plan deadline, for
   short/medium/long. Reject cap -1/+1/wrong-length before SDK dispatch on both
   writer stages; matching cap still dispatches with its correct SDK timeout.
6. Audit scope: server/ledger/generation code, baseline artifacts, other worktrees
   and cloud flags unchanged. Do not infer a restart from a child worker PID.

## Deferred / unchanged limits

- P3-2: missing key consumes reserved money/job slot, unchanged. Existing key is
  present in the running pilot; no key-before-reserve shortcut, refund or reset.
- P3-3: long tab-bound request can lose paid progress on sleep/close; worst-case
  sequential deadline sum remains large. Durable/recoverable jobs are a separate
  architecture milestone before public activation, not closed by focus refresh.
- Existing loopback-only development pilot on **3443** was not restarted. Original
  launcher/child intact; intake $1/eight jobs, book $3/one job gpt-6-sol medium.
  Process-local budgets are not durable or cloud-wide caps. No new key/auth bypass.
- No creative acceptance, successful live book, illustration, narration, launch or
  push. Original bridge remains unreviewed. All held plans remain runtime-ineligible.

## PowerShell inspection / optional push (Guy's explicit decision only)

The focused commit has already been created; no stage/commit commands are needed.
Pushing carries this branch's earlier history too, including the unreviewed bridge.
This block does not grant push or imply those earlier commits passed review.

```powershell
Set-Location 'C:\Users\guyna\.codex\worktrees\personal-story-product\Small_Heroes'
git status --short --branch
git log --oneline 30961ca5..HEAD
git diff --stat 30961ca5..HEAD
git diff --check 30961ca5..HEAD
# Only if Guy explicitly decides to push the entire branch:
git push -u origin HEAD:refs/heads/codex/personal-book-storyboard-bridge
```
