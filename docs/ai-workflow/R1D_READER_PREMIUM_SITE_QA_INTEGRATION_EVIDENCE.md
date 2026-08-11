# R1D Reader + Premium Site QA Integration Evidence

Status: locally integrated; Reader and integration technical PASSes recorded; the sole integration MINOR is independently closed; product-design HOLD remains.

## Authority and topology

- Common base: `d328b3e4220101eb642f09270bc340fe494af477`
- Reader commit: `773f364fddada45eee236a8e4876bb93ae673eef`
- Website source range: `d328b3e4..b3582646`
- Integration branch: `codex/r1d-reader-premium-site-qa-integration`
- Worktree: `C:\Users\guyna\.codex\worktrees\qaexperience1\Small_Heroes`
- Production: blocked and unchanged
- External provider cost: `$0`

The branch begins at the completed Reader commit and cherry-picks Claude's two website commits:

1. `4ebf319c` - premium depth and motion variables/primitives.
2. `b3582646` - landing and story-selection presentation changes.

The Reader and website pathsets do not overlap and both commits applied without conflict.

## Product-design audit

The audited user flow was Home -> story selection -> first Wizard form. Evidence was captured from the website branch's local server at 1440x900 and 390x844 and inspected after capture.

Confirmed strengths:

- The page remains clearly RTL and responsive at both audited sizes.
- The primary Home CTA reaches `/start`, a story card reaches the real Wizard, and the tested pages emitted no browser warnings or errors.
- Story cards have a clearly visible desktop lift/settle interaction and a strong selected/focus treatment.
- Mobile hierarchy, CTA sizing, and the two-column companion grid remain legible and usable.
- Reduced-motion rules preserve state while removing travel.

Product/design HOLDs:

- This is a useful polish layer, not yet the requested transformative "2027 WOW" result. The homepage composition and emotional reveal remain substantially unchanged.
- Opaque companion images retain a large cream backing plate. The gradient mask softens edges but does not make the art well read as genuinely lavender/transparent.
- Two legacy Wizard surfaces still use cream-tinted gradient fills even though their borders moved to the purple system.
- The Reader frame and the generation-result reveal were outside Claude's implementation range.
- Some pre-existing desktop header targets remain below 44px.

These are product-quality findings, not evidence of a Reader regression. They block final visual acceptance but do not require reverting the safe depth/motion foundation.

## Independent integration QA and MINOR correction

Claude Code reviewed exact integration range `773f364fddada45eee236a8e4876bb93ae673eef..5fbfa92f47ab13ff9a1a3bb3d3a6acea4e79540e` read-only and returned **PASS** with zero BLOCKER, zero MAJOR and one advisory MINOR. It verified the four-commit topology, clean range, no credential or forbidden-surface changes, logical RTL CSS, pointer/hover gating, reduced-motion behavior, legacy stylesheet fallbacks, unchanged connectivity and faithful documentation. Claude disclosed that the two website commits were its own work; its integration review is therefore adversarial self-review, not a second-author review of those website changes.

MINOR-1 identified latent custom-property coupling in `app/category-challenge-card.css`. Six depth/rim variables had no fallback, so a future page importing the reusable card without `premium-2027.css` could invalidate complete shadow declarations, including the selected-state ring. The correction gives every depth/rim reference an exact local fallback matching the premium contract. A direct source-contract regression rejects any return to bare `var(--lift-*)` or `var(--rim*)` calls. This does not change current rendering when the premium layer is loaded.

Claude Code independently micro re-gated exact correction range `5fbfa92f47ab13ff9a1a3bb3d3a6acea4e79540e..71374be655e27d1ff6030bb6d4e64b75eab1642a` and returned **PASS**, closing MINOR-1 with zero new BLOCKER, MAJOR or MINOR. Its parenthesis-aware machine comparison confirmed all seven uses of the six distinct variables have fallbacks exactly equal to their `premium-2027.css` definitions; the selected-state ring remains valid without the premium layer; the regression covers all six names; and the correction contains no unrelated change. Claude's N1/N2 are advisory only: the regression locks fallback presence rather than value equality and uses whitespace-literal matching. They do not reopen MINOR-1. Codex records Claude Code's verdict rather than self-awarding closure.

## Validation

Executed on the combined integration branch:

- `npm ci --offline --ignore-scripts`: PASS; 200 packages; no network fallback.
- `npx --no-install prisma generate`: PASS.
- Focused Reader suite: **6 files / 36 tests PASS**.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check d328b3e4..HEAD`: PASS.

`npm run build` reached Next compilation but failed at the external `next/font` download boundary. The source website branch failed fetching Rubik from `fonts.gstatic.com`; the clean integration worktree failed fetching Frank Ruhl Libre. This is a pre-existing build portability dependency in `app/layout.tsx`, not a type or application-code failure introduced by either milestone. It remains unresolved and the build is not claimed green.

## Credential and environment handling

Claude's source worktree contained an ignored, untracked `.env.local` copy used for its local preview. It was not committed and was not copied into this integration worktree. Codex did not inspect or print the file or any value. The integration dependency, test, TypeScript and build checks ran with no `.env.local` in this worktree.

## Boundaries and next action

No provider/model call, credential read, image generation, narration generation, database/storage mutation, payment, deployment, Production action or push occurred. This record does not self-award independent technical PASS or product acceptance.

Recommended next sequence:

1. A bounded visual follow-up that targets the still-flat Home reveal, opaque companion plates, and remaining legacy Wizard cream surfaces without touching Reader behavior.
2. Replace build-time Google font fetching with repository-owned font assets in a separate general build-reliability milestone.
3. Only after QA deployment proof, continue to narration and payment integration.
