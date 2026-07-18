# Codex consult — branch consolidation audit: find every stranded fix, put order once, nothing left behind

**Why (Guy):** Some of the render-QA "defects" are actually PRIOR FIXES stranded on unmerged branches that never reached the branch we deploy/render from (`feat/chunked-generation`). Concrete proof: the mobile reader header-removal + exit button were implemented before, but staging (which deploys `feat/chunked-generation`) doesn't have them → they "regressed." Guy wants order **once and for all**: every fix/addition we've made must be accounted for, consolidated toward main, and **nothing left behind on a forgotten branch.**

## The two integration branches today
- **`feat/chunked-generation`** — the render/golden path + staging deploy target. Has: fox template promotion, `parent` parity, dedication, and (pending) the reader-UI + narration briefs.
- **`feat/live-authoring-fix`** — the offline authoring engine (7+ commits: model call, appearance/topology, parser/guard, repair loop, companion-presence fix). Its shared-module changes are NOT yet on `feat/chunked-generation`.
- Prior audit: `project-os/briefs/PLAN-branch-consolidation.md` (43 unmerged branches, your earlier classification — coupon/pricing/reader-mobile/etc.).

## What to produce
1. **Locate stranded fixes relevant to us** — scan ALL branches for reader/UI, narration, wizard, power-card, and render fixes that are NOT on `feat/chunked-generation`. **Specifically flag the mobile reader work** (header removal, left exit button, line-spacing, nav-typography — candidates: `reader-v2-mobile-desktop-polish`, `reader-v2-nav-typography`, `reader-mobile-18px`, `reader-typography`, `fix/reader-mobile`): which branch has each, is it ahead of / behind feat, and is it merge-worthy vs superseded. This directly decides whether CC MERGES vs re-implements `BRIEF-cc-reader-ui-fixes.md`.
2. **Reconcile the two integration branches** — the plan to land `feat/live-authoring-fix` (engine + shared-module changes: `contractTemplateTypes` `parent`, validators, appearance/palette, parser, pipeline, guards, repair loop) onto `feat/chunked-generation` cleanly, so the render branch and the engine agree (needed for Contract v2 anyway). No blind rebase; identify conflicts.
3. **One consolidation order to main** — a concrete sequence: which branches merge to `feat/chunked-generation`, in what order, which archive-tag+delete, and the final path `feat/chunked-generation` → `main`. For each money/lifecycle branch (coupon, pricing, refund) keep the money-gate. Confirm nothing we built this cycle is orphaned.
4. **A standing "no fix left behind" rule** — recommend a lightweight convention so future work always targets the integration branch (we're already adding "TARGET BRANCH" to every brief).

## Constraints
- Read-only audit; cite branch names + SHAs + files. All git ops are Guy's terminal; `fetch` first; NEVER `git add -A`; explicit pathspecs; never force-push.
- Deliverable: a prioritized consolidation plan Guy can execute step-by-step, with the reader-branch verdict (merge-or-reimplement) called out first since it unblocks the reader-UI brief.
