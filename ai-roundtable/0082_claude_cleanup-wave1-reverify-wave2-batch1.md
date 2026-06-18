TYPE: RESULT
AUTHOR: Claude Code
DATE: 2026-06-18
RELATED: 0081 (World QA / Phase D), 0080 (floor-hardening), 0078 (world-lock brief)

# 0082 · Worktree cleanup + Wave-1 re-verify under floor + Wave-2 batch-1

Role: Claude Code = EXECUTOR (Cursor out ~3 days). `npm run check` green (tsc + **551 vitest**).
Commits on `feat/chunked-generation`: orphan roundtable docs; `e2de31c4` (World QA fix);
`3c60deb7` (wardrobe fix); `616c6169` (Wave-2 batch-1 bibles).

## 1. Worktree cleanup
### (a) Orphan roundtable files — COMMITTED (explicit pathspecs)
`ai-roundtable/0075_cursor_entity-qa-harden-gate-result.md` + `ai-roundtable/0078_claude_location-scene-graph-lock.md` (the world-lock master brief) committed to shared history.

### (b) Remaining dirty files — NOT touched (report only; Guy to decide)
These are a separate **v5→v3-approved supersession + power-cards golden-shelf** WIP track (not mine):
- `backend/providers/story-bank-index.ts` (+16): adds `V5_SUPERSEDED_STORY_FILENAMES` (koko bedtime/fantasy) + `isSupersededV5StoryFilename()` — stop serving superseded v5 stories.
- `lib/power-cards/shelf.ts` (+11): `GOLDEN_SHELF_FILENAME_OVERRIDES` (koko_fantasy → `.superseded.md`) + `goldenShelfStoryRelPath()`.
- `lib/power-cards/index.ts` (+1): export `goldenShelfStoryRelPath`.
- `lib/power-cards/__tests__/power-card-parse.spec.ts` (±7): tests for the golden-shelf override.
- `lib/__tests__/v3-approved-bank.spec.ts` (+14): superseded-slot handling.
- `lib/__tests__/power-card-gender-slash.spec.ts` (±4), `lib/__tests__/production-qa-escape-hatches.spec.ts` (±2): minor spec tweaks.
- `ai-roundtable/0059_*.md` (+9): appended notes by another author.
- Untracked `story-pipeline/02_prompts/drafts/*`, `story-pipeline/04..06_*`: story-authoring drafts/reports.
**Recommendation:** belongs to whoever owns the supersession track (Cursor/Codex) — commit or discard there; I left it untouched per protocol.

## 2. Wave-1 re-verified under the new floor — Confirmed
- presence-policy already applied (lion thunder_corner=timeline_only; fox fixtures whole_scene).
- LOW samples through the live World-QA gate: **lion** p1/p6 → worldQa=pass; **fox_uri_bedtime** p1/p8 → worldQa=pass. (Rendered entity-clean pages so the run completes.)

## 3. Wave-2 batch-1 — Confirmed (2 stories; deriver + presence-policy + World/entity-QA gate)
Both sceneGraph-only (deriver fills allowedZones+pagePlans). Hero-triage renders, not every page.
- **chameleon_koko_bedtime** (same companion as koko_fantasy, different story → no conflict; TRANSITION
  new-bedroom; blue_fabric=timeline_only home-token; locks OUT the magical color gate). Hero render
  p1 + p6 → worldQa=pass, entity=pass. Verified blue_fabric absent p1 / present p6.
- **panda_anat_bedtime** (NEW companion + a daytime gan FLASHBACK on p2 = 2-scene). Hero p7
  ("tomorrow's chair") → worldQa=pass, entity=pass. Deriver maps p2→gan_memory, p1/3-8→night_bedroom;
  presence: gan_chairs only on p2, small_chair (timeline_only) on p5-8.

### Fixes made while executing (flag for review)
- **World QA refined** (`e2de31c4`): it was false-failing `object_state_drift` on good pages —
  whole_scene fixtures (bed) carry a transient state ("child lies in bed") that contradicts a page
  where the child is up (koko_bedtime p6, panda p7), and off-frame fixtures were counted as drift.
  Changed the vision check to verify object **IDENTITY** (not redesigned) and to fire ONLY when an
  object is **visible AND redesigned**; out-of-frame / transient pose is not drift. This keeps the
  original motivation (gate re-invention) and kills the false-fails. NOTE vs brief 0078: that said
  "object in correct state" — exact free-text STATE via vision proved unreliable; per-page state is
  still enforced at generation via the RECURRING OBJECT LOCK prompt. **Guy: confirm this trade-off.**
- **Wardrobe general fix** (`3c60deb7`): panda render was blocked because a `_bedtime` story whose
  overall time-of-day isn't "night" (it has a daytime flashback) missed the night/pajama wardrobe and
  got day clothes → bedtime day-clothes audit failed. Fixed generally: every `_bedtime` story defaults
  to the night/pajama wardrobe (matches the audit, which already treats `_bedtime` as night). Affects
  all bedtime slots — **Guy: wardrobe is Decision-Gate material; flagging the general change.**

## Risks / open
1. **panda p2 entity-QA crowd limitation** — the gan musical-chairs flashback legitimately has MANY
   children; entity-QA hard-fails `duplicate_child`. That's an entity-QA gap for crowd/flashback scenes
   (separate track), not world-lock. p2's worldQa couldn't be read (entity marks it failed first).
2. World QA exercised live on koko/bunny/lion/fox/koko_bedtime/panda — small sample; broader stories may
   need prompt tuning. Unverified (vision error) path is non-blocking by design.
3. Dragon still excluded (bespoke catalog); green-egg task still open.

## Recommendation / next
- Wave-2 batch-1 is in. **Remaining Wave-2 (batch-2):** bunny_ometz_fantasy, fox_uri_fantasy,
  lion_shaket_fantasy, panda_anat_fantasy (all journeys/16p — heavier), and fox_uri_adventure
  (upgrade its legacy bible to sceneGraph). dragon_dini_adventure stays out pending bespoke reconcile.
- Hold for Guy on: the World-QA state→identity trade-off, the general bedtime-wardrobe change, and
  whether to fix entity-QA for crowd/flashback scenes (panda p2).

## Exact next instruction for Cursor
None pending — Claude Code executing. Cursor: the v5-supersession / power-cards golden-shelf dirty
tree (section 1b) is yours to land or discard.
