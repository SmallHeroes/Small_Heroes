# Site / engine integration audit, 2026-09-26

Status: integration HOLD; focused engineering checks pass, not independent QA,
product acceptance, complete end-to-end verification or release readiness.

## Request and authority

Guy asked Codex to inspect Claude's UI / structural work, check the correct
branches and pipeline, and push what is needed. That authorizes the scoped
feature-branch propagation below. It does not turn held visual evidence into
acceptance or authorize a customer-runtime or production-domain cutover.

This existing task is the sole writer of the engine worktree. All website,
release and protected dependency worktrees were inspected read-only. Untracked
Claude review scripts and unrelated main-worktree changes were left intact.

## Observed topology, after successful fetch and server reconciliation

| Purpose | Worktree | Branch | Observed HEAD / state |
| --- | --- | --- | --- |
| Engine | C:/GNart/Work/sh-r3b1b-semantic-m1 | codex/r3b1b-semantic-recovery-m1 | c7bab93b71ef2f5c9f4b1483ecac65842ac82d8b; clean; ahead 1 of origin 8145309c |
| Claude website source | C:/Users/guyna/.codex/worktrees/wowredesign2/Small_Heroes | codex/r1d-2027-wow-site-redesign-v2 | 51ce55fc8288c58bbe276d353e1fbc4b9b297957; origin matches; untracked _review scripts retained |
| Website QA branch | C:/Users/guyna/.codex/worktrees/qaexperience1/Small_Heroes | codex/r1d-reader-premium-site-qa-integration | 70d4f2455a6e0231d5d1c8ce7fa4ccbcbe37e719; clean; origin matches |
| Current stable QA release | C:/GNart/Work/sh-release-reader-final | codex/r1d-release-reader-voice-final | f223a54af36b075fe21660959e5a591743b351d4; clean; origin matches |
| Protected dependency | C:/Users/guyna/.codex/worktrees/d53b/Small_Heroes | codex/r3b1b-p1-a1-post-cardinality-authoring | 768ccb2fe20edb1351cb4783796613cbf7a2993c; clean |
| Protected dependency | C:/GNart/Work/sh-r3b1b-accepted-intent-wave-2 | codex/r3b1b-accepted-intent-wave-2 | 63ccb4846ebe5be9ab392960d389610a1b2b9d42; clean |

These are time-scoped observations, not promises that branches remain unchanged.
No task, branch or worktree was deleted or reset.

The latest UI merge has parents 4f1c8e2c and 51ce55fc. Its four source commits are
248c6710 (flow/cover/contact), 3c254c1a (gallery), 451b1441 (Style02 withdrawal),
51ce55fc (name/audio/typography). Relative to 4f1c8e2c the aggregate diff is 24
files, +1155/-140, with no app/api, backend or lib/generation-pipeline changes.
This limited claim does NOT make the older UI branch runtime current.

## Deployment identity is the first broken integration boundary

Project small-heroes / prj_4MpzfIz0Nw8zEdBZVzaDUOcZKquX, team
team_2bLUDGyHayGB1UHIvcCBgyWh:

| Surface | Observed deployment | Commit | Result |
| --- | --- | --- | --- |
| qa.smallheroes.co.il | dpl_B919bcgPteP7xWxtMyR5YmPBTiov | f223a54a | READY; stable alias still points here |
| New UI preview | dpl_3zwZZimTjP2J4eea9FxHh8AGbD4g | 70d4f245 | READY; stable QA alias absent |
| Engine upstream preview at audit start | dpl_CNqg7j4JVCja6YfGpYHt5HtVA8tC | 8145309c | READY; not the stable QA domain |

The HTML returned from the stable QA domain includes the same old deployment ID
in asset URLs. This confirms actual served identity as well as control-plane
metadata. READY proves build/deploy state, not functional generation or QA PASS.

The UI preview URL is
https://small-heroes-gqsftq0e8-smallheroes-projects.vercel.app . It is protected.
An authorized, temporary 23-hour Vercel share link was used to inspect it in the
browser. No token or share URL is stored in this report; deployment protection
was not disabled. The connector's project-detail schema failed, so project
details were not inferred from that failed request. A connector fetch of the
protected matrix endpoint returned a 302, not an API success; no live matrix
JSON assertion is based on that response.

## Why a blind alias change or merge is unsafe

`git rev-list --left-right --count 70d4f245...c7bab93b` returns 93 / 577. The
merge base is 388dc4336c17487b9c0ef35da2f98ec8000c7db7. This counts history, not
93 newly reviewed UI changes or 577 missing features. f223a54a is an ancestor of
c7bab93b (178 engine commits beyond it).

Comparing the UI snapshot to the currently served release in app/api, backend
and lib/generation-pipeline yields 106 changed files, +1913/-22604. In particular
the UI snapshot lacks app/api/release/v1 and several order/status handlers and
release/quality modules. This is a snapshot difference, not evidence that the
four latest UI commits deleted them. Replacing the domain target would replace
the entire deployment, including that older runtime.

No-checkout `git merge-tree --write-tree` previews of UI + release and UI +
engine both report conflicts in the same 10 paths:

- app/accessibility/page.tsx
- app/components/CompanionSpotlight.tsx
- app/components/LegalShell.tsx
- app/landing/landing-page.tsx
- app/landing/landing.css
- app/landing/wow-2027.css
- app/privacy/page.tsx
- app/terms/page.tsx
- next.config.js
- public/Fonts/OFL-suezone.txt

Only Git objects were produced by these previews; no merge, index change or
worktree checkout was performed. Conflict-free auto-merged files still require
semantic review, especially public/JS/wizard.js and content/index.ts.

## Verified functional gap: landing identity is not Wizard identity

At 70d4f245, app/landing/landing-page.tsx stores `sh.hero-child` with a name and
boy/girl value. The CTA still navigates to /start. A repository search shows no
Wizard consumer of that key. In the live protected preview, a synthetic name
and girl selection changed the headline and CTA correctly. Following the CTA,
then Transition, opened /wizard?category=TRANSITION. The name and gender fields
were both empty. The new landing interaction works locally but does not prefill
the next step. No real child's details, photo or order were used.

This audit did not verify every UI element, mobile/desktop breakpoint, audio
playback, signed reader access, delivery email, checkout or actual generation.

## Engine update is not a customer-runtime cutover

CURRENT already explicitly scopes sequence/decorative-priority changes to fresh
local owner samples. scripts/run-owner-book-draft.ts imports local-book-sequence,
local-visual-priority and the local preview judge. Searches for those modules,
run-owner-book-draft and judgePreviewCandidate under app/api,
lib/generation-pipeline and backend found no direct consumers. Together with
the explicit milestone scope this supports the missing cutover finding; it is
not a formal proof about every possible indirect/dynamic import.

Pushing c7bab93b preserves and propagates the correction, but does not make a
customer order use the new sequence or QA policy. No flags, authority checks,
held artifacts, resemblance thresholds or budgets were changed in this audit.

## Fresh validation

On UI 70d4f245:

```powershell
npx tsc --noEmit
npx vitest run lib/__tests__/landing-motion.spec.ts lib/__tests__/reader-nav.spec.ts lib/__tests__/reader-page-turn.spec.ts lib/__tests__/reader-storytime-dwell.spec.ts lib/__tests__/reader-narration-src.spec.ts lib/__tests__/wizard-render-readiness.spec.ts lib/__tests__/wizard-mvp-matrix-api.spec.ts lib/__tests__/frozen-product-truth.spec.ts lib/generation-pipeline/__tests__/wizard-runtime-qualification.spec.ts --silent
```

tsc exit0; 9 files / 43 tests passed, native exit0. These are existing focused
tests, not a new complete regression suite for Claude's four commits.

On engine c7bab93b:

```powershell
npx vitest run lib/owner-book-draft.spec.ts lib/__tests__/local-visual-priority.spec.ts lib/__tests__/local-preview-quality.spec.ts lib/__tests__/local-preview-judge.spec.ts lib/__tests__/local-book-sequence.spec.ts lib/__tests__/local-story-preview.spec.ts lib/__tests__/local-book-planning.spec.ts lib/__tests__/local-preview-identity.spec.ts lib/__tests__/local-preview-narration.spec.ts --silent
npx tsc --noEmit
npm run story:autonomous-typecheck
```

365/365 in 9 files, native exit0; both typechecks exit0. Tests use mocked provider
seams; no actual image/audio provider calls. Full `npm run check` was not rerun;
the previously RED engine gate remains open. c7bab93b's independent re-gate is
still pending; these runs do not expand Claude's PASS at 8145309c.

## Next integration Decision Gate (plan, not implemented)

1. Proposed change: a dedicated integration branch based on the current engine,
   preserving release backend/guards, bringing in the approved site UI and
   explicitly reconciling the 10 conflicts. Do not reuse the old UI deployment
   as the new runtime baseline.
2. Why now: Git branch naming and a READY preview currently obscure the live
   domain/runtime split. The owner expects one connected product.
3. Scope: general integration; no story/child-specific workaround.
4. Hardcoding risk: pass identity through a general validated client handoff,
   not a hardcoded name; do not overwrite an existing Wizard draft silently.
5. Likely files: conflicted paths above, Wizard state/persistence, their focused
   specs; separate customer-runtime adapters require a separate bounded change.
6. Expected outcome: current backend retained, UI preserved, chosen name/gender
   enter the Wizard, stable QA alias changed only to a validated integration.
7. Validation: exact merge diff and retained release API inventory, typechecks,
   complete check results disclosed, browser pre-order flow, mocked order ->
   engine -> delivery contract, then bounded authorized visual proof as needed.
8. Cost: integration/code/browser checks require no paid images/audio. This
   audit did not authorize or initiate a fresh paid run.
9. Rollback: retain all source branches and known deployment IDs; test on an
   isolated preview first. Domain rollback is to the observed stable deployment,
   not a hard reset or deletion of another task's work.
10. Review: Codex implements; Claude independently reviews frozen ranges; Guy
    retains product/launch acceptance. The broad request does not answer how
    experimental sample policies should be promoted into customer authority.
11. Do not do: no blind merge, automatic acceptance of all conflict sides,
    payment/production cutover, alias replacement with the stale UI snapshot,
    or claimed end-to-end PASS from focused tests.

Stop-check: this next integration touches reader/layout and customer flow;
these risks are not resolved by the current audit. Runtime policy migration is
not bundled into the authorized propagation. No creative direction is changed.

## Scoped propagation and QA handoff

Guy explicitly authorized push. At audit start only c7bab93b was unpushed on the
engine branch. The intended propagation is that existing focused correction
plus this documentation-only audit commit, to the same feature branch. Website
commits already on origin need no repeat merge/push. This paragraph records the
scope before execution, not a prediction of command success. The final task
response should report the actual push output and server-reconciled SHA.

Independent reviewer: first pass read-only, no providers or deployment changes.
Review correction 8145309c..c7bab93b using VISUAL_PRIORITY_CORRECTION_HANDOFF.md;
review the audit successor separately as documentation, without extending any
old PASS. Attack these claims:

- stable QA alias / actual HTML identity versus new UI preview;
- old UI snapshot versus newer release route and guard inventory;
- engine ancestry and exact dry-merge conflicts;
- landing name/gender loss at Wizard entry;
- distinction between local-sample features and customer order runtime;
- test counts and absence of paid calls, order/checkout and alias writes (apart
  from the disclosed temporary preview-access link and authorized Git push).

Copy-ready inspection and idempotent feature-branch push (already executed only
if the accompanying task response confirms it):

```powershell
Set-Location 'C:\GNart\Work\sh-r3b1b-semantic-m1'
git status --short --branch
git log --oneline origin/codex/r3b1b-semantic-recovery-m1..HEAD
git show --stat --oneline HEAD
git push origin HEAD:refs/heads/codex/r3b1b-semantic-recovery-m1
git ls-remote origin refs/heads/codex/r3b1b-semantic-recovery-m1
```

No UI edits, new render, customer order, checkout, payment, deployment promotion
or alias assignment was performed by this audit. The repository documentation
and authorized feature propagation must not be presented as a finished product
integration.
