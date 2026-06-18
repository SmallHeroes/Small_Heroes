TYPE: RESULT
AUTHOR: Claude Code
DATE: 2026-06-18
RELATED: 0079 (world-lock impl result), 0078 (claude brief: world-lock phases A–D); actions from Codex floor-hardening review

# 0080 · Floor-hardening RESULT — presence-policy, deriver validation, SceneGraph QA (pre-Wave-2)

Per Guy: do NOT start Wave 2; harden the floor first (Codex review items). All six items below
addressed. `npm run check` green (tsc + **544 vitest**, +11 new); my worktree artifacts cleaned; koko
+ bunny re-verified by prompt-audit. Commits on `feat/chunked-generation`: `2cc3c1c2` (gitignore),
`58700efd` (correctness + tests + bibles).

## Findings (Confirmed)

### 1. [P0 hygiene] worktree  — Confirmed (commit 2cc3c1c2)
- `.gitignore` now ignores my regenerable artifacts: `*_contact.png`, `*_contact_sheet.png`,
  `scripts/_build-contact-sheet.mjs`, `scripts/_build-koko-contact-sheet.mjs`. They no longer show
  as untracked.
- Location code / koko draft / scripts: the location code is already committed (0079); I did **not**
  touch the unrelated WIP in the tree (see Risk 2). Explicit pathspecs only.

### 2. [P0 correctness] presence-policy — Confirmed (commit 58700efd)
- New field `RecurringObjectLock.presencePolicy: 'whole_scene' | 'timeline_only' | 'explicit_pages'`
  (+ `appearsOnPages`) in `lib/story-location-bible/types.ts`; parsed in `resolve.ts`; resolved in
  `lib/story-location-bible/compose.ts` `recurringObjectAppearsOnPage` (exported). **Default =
  timeline_only.** `lib/scene-memory/seed.ts` now seeds book-wide stable facts ONLY for `whole_scene`.
- Bibles updated: koko (gate=whole_scene, **blue_button=timeline_only**, door=whole_scene),
  bunny (bed/shoes=whole_scene, **note=timeline_only**), lion (bed/pillow_cave=whole_scene,
  thunder_corner=timeline_only), fox (bed/chair_with_shirt/window=whole_scene).
- Prompt-audit proof (no spend):
  - koko p5 → only the gate locks; **blue_button no longer forced onto p5** (was present before).
  - koko p1 → button (pocket) + door; p15 → button (residue) + door; gate correctly absent on p1/p15.
  - bunny p5 → bed + shoes only; **note no longer forced onto p5**; p1/p8 → note present (its timeline).

### 3. [P0 correctness] deriver full-coverage validation — Confirmed (commit 58700efd)
- `derivePagePlansFromSceneGraph` now THROWS on any page (1..pageCount) that maps to no scene, unless
  `sceneGraph.allowCarryForward === true`. No silent carry-forward. `materializeSceneGraphDefaults`
  (resolve.ts) surfaces the throw via `console.error` and rethrows (loud, not silent).

### 4. [P1] deriver + presence tests — Confirmed (commit 58700efd)
- `lib/__tests__/scene-graph-deriver.spec.ts`: zones derived; full-coverage pagePlans; missing-page
  THROWS without allowCarryForward / carries-forward with it; presence-policy resolution
  (timeline_only / whole_scene / explicit_pages); `validateSceneGraph` pass + gap + bad-policy cases;
  **authored koko bible NOT overridden** by the deriver (16 plans, 4 zones, pageActions survive).

### 5. [P1] SceneGraph QA — Partially done (commit 58700efd)
- `validateSceneGraph(sceneGraph, pageCount)` → `SceneGraphValidationIssue[]`: deterministic
  structural hard-signal (page-coverage gap, unknown-scene refs, whole_scene-without-scenes,
  explicit_pages-without-pages, page-out-of-range). This is the PLAN-level world analogue of entity-QA.
- NOT done: the post-render **VISION** per-page world-QA (zone correct / object in correct state / no
  forbidden scene in the actual image) and wiring either as a live render hard-gate. That is brief
  0078 Phase D and is a QA-gate change → needs the Decision Gate (Guy/ChatGPT) before wiring. See
  Recommendation.

### 6. Dragon green-egg/toy-chest — flagged, not fixed (as instructed)
- Confirmed pre-existing bug in the BESPOKE system `lib/dragon-dini-style01-blocks.ts` (catalog applied
  to every dragon_dini story → egg/toys bleed into NEW_SIBLING bedtime). Handled separately (the
  dragon generic bible was removed in 0079/`ecec60d5`; a background task to scope the bespoke catalog
  per-storyId or migrate dragon to the generic world-lock is filed). Not touched now.

## Risks
1. **Phase D still open.** World drift is validated at PLAN level only; there is no post-render hard-fail
   yet. The acceptance teeth of brief 0078 remain unbuilt.
2. **Unrelated dirty worktree remains (NOT mine).** `lib/power-cards/*`, `backend/providers/story-bank-index.ts`,
   `lib/__tests__/{power-card-gender-slash,production-qa-escape-hatches,v3-approved-bank}.spec.ts`,
   `story-pipeline/02_prompts/drafts/*`, `ai-roundtable/0059` (M), and untracked roundtable files
   `0075_cursor_*` / `0078_claude_location-scene-graph-lock.md` (the master brief). I left all of these
   untouched per protocol (don't stage unrelated). **Needs Guy/Cursor decision** to commit or discard.
3. **CRLF churn** (no `.gitattributes`) — git warns on each commit; mitigated by explicit pathspecs.

## Recommendation
1. Hold Wave 2 (as instructed).
2. **Phase D** is the right next step but is a QA-gate change → fill the Decision Gate brief and route
   to Guy/ChatGPT before wiring `validateSceneGraph` as a pre-render gate + adding the vision per-page
   world-QA. Until then, `validateSceneGraph` can be run as a CI/dev check on every bible.
3. Decide on Risk 2 (the unrelated dirty tree) before more commits accumulate.
4. Dragon bespoke reconcile + entity-QA/anchor track remain separate.

## Exact next instruction for Cursor (proposed — awaiting Guy approval; NOT yet executable)
When approved: (a) call `validateSceneGraph` for each story bible in a dev/CI script and fail on any
issue (cheap, deterministic, no render); (b) Phase D vision world-QA — a post-render check parallel to
`evaluatePageEntityQa` that, per page, asserts the rendered zone matches the pagePlan zone and each
present recurring object matches its bible state, hard-failing on gate-redesign / wrong-zone /
interior-when-exterior. General, bible-driven, no per-story literals. Validate on a koko LOW page where
a deliberately wrong zone hard-fails. `npm run check` green; explicit pathspecs only.
