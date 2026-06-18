TYPE: RESULT
AUTHOR: Claude Code
DATE: 2026-06-18
RELATED: 0080 (floor-hardening — items 1/2/3/5 done, #4 partial), 0078 (brief: world-lock Phase D)

# 0081 · World QA hard-fail (Phase D) — completes floor-hardening item #4

Role note: Claude Code is EXECUTOR (Cursor out ~3 days) — implemented directly, no brief/handoff.
Floor-hardening items 1/2/3/5 were already done + committed (see 0080: presence-policy, deriver
page-coverage validation, deriver tests, gitignore hygiene). The only gap was **#4 — per-page
SceneGraph QA as a real hard-fail (=Phase D)**, which 0080 had only at plan level (`validateSceneGraph`).
This adds the POST-RENDER vision hard-fail, the world-lock analogue of entity-QA. `npm run check`
green (tsc + **550 vitest**, +6). Commit `16152a92`.

## Findings (Confirmed)

### #4 Post-render World QA hard-fail — Confirmed (commit 16152a92)
- New module `lib/generation-pipeline/page-world-qa.ts` (mirrors `page-entity-qa.ts`, fail-closed):
  `evaluatePageWorldQa({ imageUrl, zoneDescription, objects, forbiddenScenes })` → vision call →
  `evaluateWorldQaFromRaw` → `PageWorldQaResult` with hardFailures:
  - `wrong_zone` — rendered setting is not the expected scene/zone.
  - `object_state_drift` — a locked recurring object is missing / redesigned / in the wrong state
    (lists the drifted object labels).
  - `forbidden_scene` — the page's overall setting is a forbidden one (indoor when outdoor expected,
    clinic, daylight when night, forest/stream…). Prompt is gross-drift-focused and lenient on
    camera/palette to avoid false-fails; ignores character counts (entity-QA owns those).
- Wiring `lib/qa-console-run.ts`: a world-QA loop runs after entity QA, **scoped to bibles that carry
  a sceneGraph** (so legacy bibles like fox_uri_adventure are untouched). Per page it resolves the
  zone description (`resolveZoneById`), the present recurring objects + expected state
  (`resolvePageRecurringObjects`, new export in `compose.ts`), and the forbidden list
  (`bible.forbiddenDrift` + `sceneGraph.forbiddenDrift`). Hard-fail pages → `throw` (blocks the run);
  unverified (vision/no-key error) → warn only, NOT blocking (a new gate shouldn't break on vision
  flakiness — entity-QA throws on unverified; world-QA is intentionally softer there).
- Tests `lib/__tests__/page-world-qa.spec.ts`: pass / wrong_zone / object_state_drift (+labels) /
  forbidden_scene / fail-closed incomplete-JSON / prompt-contents.

## Acceptance (sample renders, world-QA gate live)
- **koko** LOW p5 (gate threshold) + p15 (real ordinary door): rendered, **worldQa=pass** both
  (status pass, hardFailures []). The gate page reads as the outdoor gate zone; the real-world page is
  not flagged forbidden — no false-fail.
- **bunny** LOW p1 + p8: rendered, **worldQa=pass** both.
- `npm run check` green (550). Worktree: only my files committed (explicit pathspecs); render outputs
  live under gitignored `outputs/`.

## Risks
1. **Vision cost/latency** — world QA adds one vision call per page on sceneGraph stories (on top of
   entity QA). Scoped to world-locked bibles; fine for LOW samples, doubles per-page vision on bigger
   runs. Tunable (could sample representative pages only) if needed.
2. **Possible false-fails at scale** — only koko+bunny (4 pages) exercised live so far; the prompt is
   deliberately lenient, but broader stories may surface tuning needs. The unverified path is non-blocking
   by design; only positive drift detection blocks.
3. **Unrelated dirty tree still present** (power-cards, story-pipeline drafts, story-bank-index.ts,
   untracked roundtable 0075/0078) — untouched per protocol; still needs a Guy/Cursor decision (see 0080).

## Recommendation
- Floor is hardened: presence-policy + deriver validation + deriver/QA tests + structural
  `validateSceneGraph` + post-render World QA hard-fail. **Hold Wave 2 until Guy approves** (as
  instructed).
- When resuming: Wave 2 bibles via the deriver (sceneGraph-only) + small LOW samples now also gated by
  World QA; dragon bespoke reconcile + entity-QA/anchor track remain separate.

## Exact next instruction for Cursor
None pending — Claude Code is executing. Cursor can resume normal RESULT-reporting on return; nothing
is handed off mid-flight.
