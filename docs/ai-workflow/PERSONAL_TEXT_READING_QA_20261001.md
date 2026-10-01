# Claude Code: edited text-only personal book, independent QA request

## Requirement and frozen range

Guy requests recording -> inspect/edit/remove facts -> choose companion and length
-> complete personalized story for reading and product feedback. No image render,
visual storyboard or narration in this experiment. Do not claim perfect stories.
Reuse the existing implementation; do not manufacture another production chain.

First review read-only, no provider/key/network/spend/push. Technical PASS/HOLD is
yours, product acceptance is Guy's. Codex's subagent advice is not independent QA.

- Worktree: `C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes`
- Branch: `codex/personal-book-storyboard-bridge`, no upstream; local only.
- Base: `b2552fc487ace12897b309bbf053ccb5b6d5de3b`
- Code head: `c94e46fcc4d30efc114e113448c82cc2b34c8e80`
- Range: `b2552fc4..c94e46fc`, single commit, 14 files, +395/-46.
- Documentation successor records the outcome only, not another code approval.

Freeze the code range above even if HEAD includes this later handoff. Reconcile
any production movement before accepting a result. Do not reset/change the active
local server's checkout or claim. Separate clean detached QA worktree if needed.

## Observed causes and changes

1. Existing `/book` already never calls an image/audio provider, but its five
   stages also reserve/wait for storyboard and semantic visual review. Add explicit
   `story_only` scope: plan, manuscript, editor, distinct text result. Default
   `storyboard` preserves the five-stage API and existing adapters/contracts.
2. Wizard requests scope-specific GET quote and POST, renders whole final text,
   editor observations and original draft, no storyboard details. Planning HOLD
   remains plan-only; editorial HOLD retains text with explicit not-approved copy.
3. Real stopped trial returned `earned_payoff.evidenceSpreads=[2,5,6]` for eight
   spreads. The SDK schema allowed it; server compilation rejects lack of final
   spread. Actual provider schema now requires exactly the final 8/12/16. No
   output patching, validator relaxation or literary-quality conclusion.
4. Nested writer deadline signal now reaches the runner race; late completion
   cannot mutate terminal usage/events. Unknown usage stays unknown.
5. Advisory review identified inherited boundary gaps while editing this runner:
   actual invocation rechecks cap (not only preflight), every terminal failure
   revalidates after observer callbacks before returning partial prose, and text
   ledger completion follows the last success observer/identity check. Normal
   stage order unchanged. Tests cover faulty concurrency and observer mutations.
6. The source-wiring test changed the expected fetch function name only; the
   guarded availability watcher and revocation assertions remain intact.

## Changed paths

Production: `book-config.ts`, `book-preview.ts`, `book-runner.ts`, `story-openai.ts`
under `lib/personal-wizard/`; `/api/dev/personal-wizard/book/route.ts`; real
`app/dev/personal-wizard/StoryPreview.tsx`.

Tests: book-preview, book-routes, book-runner, intake-live-client, story-openai.
Docs: CURRENT, ROADMAP and PERSONAL_TEXT_READING_DECISION_20261001.md.
No image provider/anchor/QA threshold/catalog/public site/payment change.
No merge from Claude's UI work. Public deployment and previous unreviewed ranges
(including `45b9e754..07d3c8d3`) remain outside this proposed PASS.

## Measured verification

Standalone `npx tsc --noEmit --incremental false`: exit 0 after final code edits.
`git diff --check`: clean. Exact focused command:

```powershell
Set-Location 'C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes'
npx vitest run lib/personal-wizard/__tests__/book-runner.spec.ts lib/personal-wizard/__tests__/book-routes.spec.ts lib/personal-wizard/__tests__/book-preview.spec.ts lib/personal-wizard/__tests__/story-openai.spec.ts lib/personal-wizard/__tests__/story-writer.spec.ts lib/personal-wizard/__tests__/story-editor.spec.ts lib/personal-wizard/__tests__/story-planning.spec.ts lib/personal-wizard/__tests__/story-planning-trial.spec.ts lib/personal-wizard/__tests__/intake-live-client.spec.ts lib/__tests__/vitest-workload-classifier.spec.ts
```

406/406 across ten specs: 115+41+39+23+38+39+60+26+18+7. Tests mock SDK/provider;
trial tests include their synthetic process/HTTP guards, not real paid calls.

Offline real-component browser harness: 49/49, no errors, no key/provider. All
eight fixture spreads visible in success, correct text GET/POST scope, editor and
original available, HOLD/accounting/no-auto-retry and cancellation/stale/access
guards. 390/1024px *container widths*, not a full mobile/Next viewport audit.
The fixture is synthetic, not a newly generated or creatively accepted book.

Final `npm run check` on final production bytes (then committed at c94e46fc):
native exit 1. Ordinary 382 files, 5575 passed/10 failed/73 skipped; resource 20
files, 635 passed with three `onTaskUpdate` RPC errors/native 1. Earlier run had
one additional stale watcher-name expectation, now fixed. Remaining names match
historical logs, not a newly executed baseline or proof of cause. Full gate stays
RED. The local dev server was launched while the resource phase was running;
do not infer stable timing or causality from this run.

Six remaining failing files: reserved-page-placement-authority (1), child-lexicon-
ages-5-8 (1), momentum-gate-koko (1), page-entity-qa (1), story-read-back-validation
(2), story-source-visual-direction-acceptance-lifecycle (4). Do not close stability.

## Actual local activation, no paid generation initiated

Server at `http://127.0.0.1:3443/dev/personal-wizard`, launched at c94e46fc,
confirmed 127.0.0.1-only listener (observed child 145892, parent 143648).
Existing authorized operator, staging auth database, existing key only in server
memory, no real storage credential or payments. One intake <=$0.10 and one book
<=$1, GPT-6.1 Sol medium. Text reservations $0.8184/$0.8844/$0.9504, not bills;
the retained five-stage mode cannot fit this $1 ceiling before key access.

Atomic one-shot launcher claim at common Git dir:
`codex-local-pilots/personal-text-reading-20261001/`. Do not delete/restart/refill.
Existing runtime ledgers are process-memory only. They are not safe public or
multi-instance budget/idempotency authority; no such deployment is proposed.

Regular Chrome already held the existing operator session. Using synthetic manual
chip answers, Codex observed real request validation 200, text-only quote 200,
correct GPT-6.1 model and enabled explicit write button. **Did not click write,
record or process text**, no microphone permission prompt. Returned that fresh tab
to empty voice start and retained it for Guy. No live schema completion or book
quality claim follows. Signed-out quote 401; intake status 200 with
`{live:false,reason:'not_signed_in'}`. No book POST/stage telemetry after launch at
the recorded observation. Guy's explicit action consumes the allowance.

Ignored evidence root, local and without verified backup:
`outputs/personal-text-reading-validation-20261001/`:

- browser-server.ts, browser-client.tsx, browser-result.json
- start-local.cjs, launch.json, server-pid.json, sanitized launcher/server logs
- final-full-check.log, readiness.json

Do not read operator.txt or env credentials; check sanitized metadata/code instead.
Auth DB writes, voice recognition quality, real provider completion, text
persistence/export, literary/product acceptance and release are not proved here.
Wizard facts/text live in the tab; refresh/close discards them.

## Preservation and topology

Earlier matched comparison is stopped/consumed, estimate $0.123724 after three
completed calls, $4.158 reservation retained. No current manuscript/comparison or
edit exists from that run. No restart or historical receipt mutation. Its consumed
events.jsonl SHA rechecked unchanged:
`e9901a4e59aa6b3508a3fb698d4c843935163f3eaccc9d53ed1a70f8d9afdc51`.
Earlier read-only audit rehashed all six historical literary trial files and the
new 22-file comparison root; no mismatch. Those audits are not creative approval.

Relevant trees rechecked clean: protected d53b=768ccb2f, accepted-intent-wave-2=
63ccb484, Claude detached QA=4de35c3d, separate wizard-wow=2194e9a8. Claude landing
branch moved independently to 87b0d196/ahead4 during this work; untouched here.
No automatic push; no upstream configured for this implementation branch.

## Falsification targets

1. Reach the real runner and SDK boundary: each length text path makes exactly
   three calls, including editor, never either visual call; default remains five.
   Partial writer/editor failures retain only correctly bound completed text.
2. Independently recompute text and legacy reservations; reject unknown scopes
   before ledger/key/provider, and ensure a $1 configured pilot cannot use default
   legacy mode or replay jobs. Quotes are configured capacity, not remaining money.
3. Attack final SDK ending schema at all lengths with nonfinal/missing/duplicate
   refs and preserve needs_work. No fabricated model evidence or server bypass.
4. Cancel/change identity during factory, stages, late completions, success and
   failure observers. No stale text/plan/packets, no later usage mutation, correct
   lock/outcome. Faulty concurrent subordinate calls must stop at actual 3/5 cap.
5. Attack real browser decode/render binding, all final spreads, edit/original,
   partial HOLD honesty, availability revocation, wrong success shape, epoch/stale
   suppression, and no automatic paid start/retry. No model self-PASS presented as
   independent quality or rendering authority.
6. Verify scope exclusions and consumed paid roots/claim unchanged. Do not treat
   RED full gate or unreviewed earlier bridge as closed by this scoped review.

## PowerShell handoff, inspection first; push only by Guy's separate decision

Code and docs are already committed; no stage/commit reconstruction needed.
This block does not authorize publishing earlier commits or bypassing QA.

```powershell
Set-Location 'C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes'
git status --short --branch
git branch -vv --list codex/personal-book-storyboard-bridge
git log --oneline b2552fc4..HEAD
git diff --stat b2552fc4 c94e46fc
git diff --check b2552fc4 c94e46fc
# Only after Guy explicitly chooses push and reviews all commits it would carry:
git push -u origin codex/personal-book-storyboard-bridge
```

Rollback only the focused code milestone; retain every consumed claim and paid
artifact. The operator pilot should stay alive for Guy, not be restarted by QA.
