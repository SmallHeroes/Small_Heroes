# Claude Code: recording wizard to whole-book planner, independent QA

## Requirement and immutable target

Guy asked Codex to activate the new personal engine together with the recording
wizard, not only collect a profile. Parents review/correct/remove captured facts,
choose their companion and length, then get a Hebrew adventure and a whole-book
storyboard with continuity. Humour, age-appropriate voice, child agency, causal
movement and resilience matter; green schemas do not prove creative quality.

First pass READ ONLY. No credentials, providers, paid calls, edits or push.

- Worktree: `C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes`
- Branch: `codex/personal-book-storyboard-bridge`, no upstream, local/unpushed.
- Base: `10f549304bfd0c3eb473a5c301e5a2a3f2164741`
- Frozen code head: `806ce4d771311ea574cee133172ece5e963a2790`
- Two commits: `188a1c53` connection/deadlines; `806ce4d7` sign-in visibility.
- Range: 26 paths, +485/-83. Any documentation successor must be reconciled,
  not silently substituted for the frozen code target.

Codex is sole writer in this chat. Claude's landing at `86ca47e8` and wizard
prototype at `fd2b26bd` are unchanged/clean. Protected `d53b` at `768ccb2f` and
accepted-intent-wave-2 at `63ccb484` are unchanged/clean. QA site remains the
previous integration at `41359878`; no cloud live flag, merge or deployment here.
Detached reviewer worktrees at earlier targets are not implementation surfaces.

## Root causes and implementation claims

1. QA cloud intake was `live_flag_off`. Local signed-out callers are separately
   `not_signed_in`; recording alone has no decoding in either case. No animation
   was missing from the active processing view. The live trial uses auth and the
   existing operator allowlist; it does not bypass either.
2. The summary used manuscript-only `/story`; it now uses `/book` only, with the
   server-reviewed request and its exact identity: plan -> prose -> whole-story
   storyboard -> semantic diagnostic. No silent fallback or auto paid retry.
3. Each writer call has 8k/10k/12k output at 8/12/16 narrative spreads. SDK and
   orchestration both use `60000 + ceil(cap/25)*1000` per stage, not one 180s
   whole-job timer. This is conservative headroom, not measured adequacy or SLA.
   Storyboard/review caps from the base are unchanged (32k/39k/51k and 39k/47k/55k).
4. Reservation uses those same caps. Sol whole-job $1.8018/$2.0108/$2.2748;
   Astra five times those, medium/long exceeding the unchanged $10 hard ceiling.
   Rates unchanged. Key read in the standalone story route/CLI is now lazy after
   reservation. Missing usage remains unknown; cancellation differs from timeout.
5. Promise racing bounds non-cooperative providers; late results/rejections do
   not advance jobs. Edits/unmount invalidate client epochs and abort requests.
6. Browser display validates identity, page coverage/numbering, digest bindings,
   disposition and runtime-ineligible status. It is not render authority. A
   completed manuscript after a later failure may be shown as PARTIAL only;
   cancelled/invalid/changed inputs cannot acquire this retained result.
7. Live status now preserves an explicit signed-out hint. Only exact
   `live:false/reason:not_signed_in` offers sign-in. Returning focus rechecks
   status without reloading/erasing the draft, with unmount/epoch guards.

## Changed files

- Routes: `app/api/dev/personal-wizard/{book,story}/route.ts`.
- UI: `app/dev/personal-wizard/{PersonalWizard,StepTell,StoryPreview}.tsx`.
- Core: `lib/personal-wizard/{story-config,story-writer,story-openai,book-config,
  book-runner,book-openai,intake-live-client}.ts` plus new `generation-deadline.ts`
  and browser-only `book-preview.ts`.
- CLI: `scripts/run-personal-manuscript-preview.ts`.
- Tests: two new specs (`generation-deadline`, `book-preview`), six existing
  personal specs and `lib/__tests__/vitest-workload-classifier.spec.ts`.
- `CURRENT.md`, Decision `PERSONAL_BOOK_LIVE_CONNECTION_DECISION_20260930.md`.

No production catalogue, illustration adapter, resemblance threshold, narration,
payment/auth implementation, schema, style or Claude landing changed.

## Verification actually performed

- `npx tsc --noEmit`: native 0 before each implementation commit.
- `git diff --check`: 0.
- Main connection focused run: 428/428, 18 files; separate audio 11/11, one file.
- Final connection + sign-in run:
  `npx vitest run lib/personal-wizard/__tests__ lib/__tests__/vitest-workload-classifier.spec.ts`
  **440/440, 19 files, native 0**, including real-media audio tests.
- Earlier full run: ordinary 11 failures (10 old names plus a stale pinned
  inventory newly caused by the added specs). Inventory fixed to 395 total/375
  ordinary; resource 635/635 but 3 onTaskUpdate RPC errors/native 1. RED.
- Frozen `806ce4d7` full rerun: ordinary 375 files, 10 failed/5245 passed/73
  skipped, native 1. Failed names match the preceding output-budget logs 10/10,
  differences 0. That is comparison of recorded names, not an untouched-base
  causality experiment. Resource/final outcome is recorded in the closeout below.

## Real browser/runtime evidence (no model run claimed)

One loopback listener: `127.0.0.1:3443`, parent 100100, Next child 122920. Boot
started at `188a1c53`; hot reload picked up `806ce4d7` in the SAME process, no
budget-reset restart. First boot failed before instrumentation completed and
before any dispatch; its separate logs were preserved.

The successful launcher reuses the existing OpenAI key/internal secret in memory
and the existing staging session-pooler database. A read-only SELECT 1 succeeded.
Storage is an unreachable loopback endpoint with a NON-credential placeholder:
the voice/text path has no storage calls, and accidental storage cannot reach
production. Payments none/waitlist; image generation disabled.

- Wizard GET 200 and regular Chrome UI observed, not in-app microphone browser.
- Signed-out intake status: 200 `{live:false,reason:not_signed_in}`; book GET 401.
- Explicit example -> visible processing view -> editable card with fixture
  labels -> remove football -> choose Dini/short/mom -> submit reviewed request.
- Server accepted request `c7093b4afc69...`; the visible JSON contained three
  remaining facts and NO football interest, with fixture provenance retained.
- Book UI displayed the new four-stage description and a disabled paid button
  for signed-out access. No writer POST/provider dispatch was performed.
- Sign-in hint seen on desktop and 390px Chrome viewport (scrollWidth 375,
  innerWidth 390); viewport reset. Initial screenshots retained locally.
- Login and clean wizard left open. Parent must sign in with their existing
  allowed account, return to wizard, record and initiate the bounded job.

Local pilot URLs:
`http://127.0.0.1:3443/login` and `/dev/personal-wizard`.
Dev login uses existing code 123456. No automated user login or microphone capture.

Live flags: intake $1/max8, book $3/max1, gpt-6-sol medium, old story flag OFF.
Process-local reservations are NOT invoices, durable cost records or global cloud
limits. Do not restart to obtain a new allowance. Zero paid usage observed here;
the first personal live generation/quality test remains for Guy.

## Evidence and preservation boundaries

New ignored/untracked root:
`outputs/personal-book-live-connection-20260930/` (including `boot-retry/`).
Contains focused/full logs, launch metadata, the scoped local launchers and
redacted server logs. They are local-only, without verified off-machine backup;
push does not preserve them. No secret material was written in these artifacts.
Screenshot files are in the calling chat's visualization directory. Existing raw
roots were not rewritten. No stronger recursive SHA-preservation claim is made.

## Attack targets

1. Test all three lengths against actual reservation and SDK arguments; invalid
   lengths, maximum cap, reasoning-inclusive limits and timeout distinctions.
2. Attack cancellation at every boundary, late rejection after timeout, nested
   writer/runner deadlines and unknown usage. No extra paid attempts/refund.
3. Falsify auth -> request -> reservation -> key access ordering on real routes
   and CLI; second/duplicate jobs and Astra-over-ceiling cases.
4. Attack stale result after edit/unmount, foreign identity, held/partial output,
   result validation, server-only imports leaking into the client bundle.
5. Attack sign-in status spoofing/network errors and late status overwrite;
   status must never grant backend permission, login must not delete the draft.
6. Check no cloud/public enablement, storage exposure, render/narration fallback,
   or independent-PASS/creative-quality claims were introduced.

## Limits / next

This does not independently approve earlier writer/bridge/output-budget ranges.
Please reconcile their separate reviews; do not silently extend this verdict.
No completed live book, proven humour/age-appropriate prose, semantic entailment
accuracy, visual fidelity, illustration, narration, product acceptance or release.
Full gate RED. No push. A real output may remain held and must not be rendered.

## PowerShell handoff (inspection; push only on Guy's later instruction)

```powershell
Set-Location 'C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes'
git status --short --branch
git log --oneline 10f54930..HEAD
git diff --check 10f54930..HEAD
git diff --stat 10f54930..806ce4d7
# After independent review and Guy's explicit push decision:
git push -u origin codex/personal-book-storyboard-bridge
```

Commits already staged/created by Codex; no add/commit reconstruction needed.
Pushing carries the branch's earlier history too, not only this frozen range.

## Full-check closeout

Frozen `806ce4d7` run completed: resource 20 files, **635/635 passed**, three
unhandled `onTaskUpdate` RPC errors, native exit 1. Ordinary native 1 as above;
overall gate failed. No timeout/worker policy changed and no stability closure.
The new inventory failure is absent in this run. The ten remaining failed names
match the prior logs; this does not establish causal independence or release
readiness. Raw final log: `full-check-806ce4d7.log` in the new evidence root.
