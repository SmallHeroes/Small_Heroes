TYPE: RESULT
AUTHOR: Claude Code
DATE: 2026-06-18
RELATED: 0078 (claude brief: World/Object identity lock — phases A–D), 0046/0048 (fox book#2), 0036 (book #2 strategy)

# 0079 · World-lock implementation RESULT — 0078 brief, phases A–C + generalization + wave-1

Executes the `0078_claude_location-scene-graph-lock` brief (per Guy's direct instructions, Claude Code
acted as implementer here, not just reviewer). Phases A, B, C done + generalized to a 2nd structure
type + a sceneGraph deriver + wave-1 across 3 diverse stories. **Phase D (drift hard-fail) NOT done.**
All commits on branch `feat/chunked-generation`, `npm run check` green (tsc + 533 vitest) at each step.

## Findings (Confirmed unless noted)

### Phase A — kill hardcoded bedroom vocab + restore koko p5 location  (commit 2a84436d, water-drift cfc6f921)
- **A1 Confirmed** — `lib/set-appearance/compose.ts`: the `VISUAL SET BOARD` and `FORBIDDEN` lines are
  now data-driven from `appearance.signatures` (board = `filterSignaturesForFixedBoard`; forbidden
  clauses emitted only when the scene actually has bed/shelf/fort). The ACCEPTABLE line was also made
  object-agnostic (`minor object arrangement within palette`). Verified on koko p5: `lamp/shelf/rug/
  fort/canopy` GONE; `bed/window` remaining hits were traced to `lib/structured-object-composition.ts`
  (a generic conditional furniture-geometry rule, left intact by design) and the ACCEPTABLE line
  (since fixed).
- **A2 Confirmed** — `story-bank/v3-approved/chameleon_koko_fantasy.md` p5 imageDirection keeps the
  single-Kim clause and adds: "in front of the same color gate on the kindergarten path (NOT an indoor room)".

### Phase B — Scene-Graph + Recurring-Object schema + scene-memory wiring  (commit 2a84436d)
- New types in `lib/story-location-bible/types.ts`: `SceneGraph` / `LocationSceneNode` /
  `RecurringObjectLock` / `RecurringObjectStateEntry` (+ `LocationSceneNode.pages` added in 7938d568).
- Parsed in `lib/story-location-bible/resolve.ts` (`parseSceneGraph`); wired into scene-memory derive
  in `lib/scene-memory/seed.ts` so a present bible overrides the generic `keep_the` fallback.
- Pilot `story-bank/v3-approved/chameleon_koko_fantasy.location-bible.json`: 4 scenes
  (kindergarten_path → color_gate_threshold → color_courtyard → real_kindergarten_entrance),
  3 recurringObjects (color_gate / blue_button / ordinary_kindergarten_door) with stateTimelines.
  color_gate identity locked = stone arch + shifting-rainbow center + empty central circle.

### Phase C — RECURRING OBJECT LOCK block  (commit 2a84436d)
- `buildRecurringObjectLockBlock` in `lib/story-location-bible/compose.ts`, injected high-priority next
  to the PAGE LOCATION block. Per page, for each recurring object present (by `stateTimeline` page OR
  `appearsInScenes`): emits locked identity + page-range + this-page state (exact or carry-forward) +
  per-object forbiddenDrift.
- **koko full-book LOW render (16 pages, 2 runs, same anchor) — Confirmed:** the SAME stone-arch gate
  appears p4–13, only its STATE changes (closed→glow→opening→empty circle→button→blue ring→opens);
  ABSENT on p1–3 and p15–16 (ordinary door); one Kim + one child throughout; wardrobe locked. p14
  color_courtyard (new scene) coherent. Contact sheet `koko_fantasy_16page_contact_sheet.png`.
- A scene-memory contradiction was caught and fixed during this phase: a journey's recurring objects
  must NOT be asserted book-wide (koko p15 had a stale `color_gate MUST remain`). Fix = `seed.ts`
  suppresses book-wide scene memory for multi-scene/journey books; the scene-aware lock governs them.

### Generalization to single-room + different companion (bunny)  (commit cfc6f921)
- `story-bank/v3-approved/bunny_ometz_bedtime.location-bible.json` (single `night_bedroom`,
  recurringObjects bed/tomorrow_shoes/tomorrow_note; note state blank→drawn(p6)→by-the-shoes(p8)).
- `lib/scene-memory/seed.ts` discriminator changed from "no topology" to **multi-scene**: journey →
  suppress book-wide (lock-only); single-room → seed book-wide stable facts AND per-page lock.
- General guard fix `lib/image-entity-presence.ts`: "<Companion> absent"/"gone" no longer trips the
  companion-presence conflict (bunny p1 said "Bunny absent"). koko water-drift terms (stream/river/
  creek/forest/woods) added to koko bible forbiddenDrift (p12 had drawn a stream).
- **LOW sample p1/p5/p8 — Confirmed:** same night bedroom, shoes by the bed all pages, note state
  evolves, one bunny + one child, no clinic/daylight/other-room/outdoor drift.

### Deriver — sceneGraph is the single source  (commit 7938d568)
- `lib/story-location-bible/derive.ts`: `deriveZonesFromSceneGraph` + `derivePagePlansFromSceneGraph`
  (scene `pages` → per-page zone; carry-forward; whole-story `appearsInScenes` only seeded book-wide).
  Wired via `materializeSceneGraphDefaults` in `resolve.ts` — a bible may now omit `allowedZones` +
  `pagePlans` and have them auto-derived.
- **Verified same result on koko (16/4) and bunny (8/1)** — they have authored plans → deriver is a
  no-op → identical load. Synthetic sceneGraph-only case derives zones + page mapping correctly.

### Wave 1 — 3 diverse stories (sceneGraph-only bibles, exercising the deriver)  (commits 7938d568, ecec60d5)
| Story (bank) | Axis tested | SET continuity | Entity QA | Verdict |
|---|---|---|---|---|
| lion_shaket_bedtime (v3-approved) | different companion + stateful pillow-cave | Confirmed: same room, collapsed→scattered cave held, thunder-corner only p6+ | **4/4 pass** | clean generalization |
| fox_uri_bedtime (v5-fixed-v2) | same companion as existing fox bible, diff story/dir | Confirmed: chair+shirt shadow + window held; **no conflict** with fox_uri_adventure bible | p1/p8 pass; p4 duplicate_child+wrong_species; p7 wrong_species | set-lock OK; entity caveat |
| dragon_dini_bedtime (v3-approved) | baby/family + crib | Confirmed (room/bed/crib+baby) | p1 pass; p4/6/8 wrong_species | **excluded** (see Risk 1) |
- Contact sheets: `wave1_{lion_shaket_bedtime,fox_uri_bedtime,dragon_dini_bedtime}_contact.png`.
- Generic render gate added: `scripts/run-story-gate.ts` (STORY_KEY env; handles v3-approved + v5).

## Risks
1. **Dragon bespoke-catalog collision (Needs Guy decision long-term).** `lib/dragon-dini-style01-blocks.ts`
   injects its own RECURRING OBJECT LOCK catalog (TOY CHEST/CRIB/YELLOW BLANKET/GREEN SPECKLED EGG…)
   for *every* dragon_dini render, keyed to a different (egg) story — it contaminated dragon_dini_bedtime
   (green egg on p8). I removed the dragon generic bible (commit ecec60d5) so the two systems don't
   double-lock; the contamination is a **pre-existing** bug, filed as a separate background task. Until
   the bespoke catalog is scoped per-storyId or retired, dragon stays out of the generic world-lock.
2. **Entity-QA / anchor track (separate from world-lock).** fox p4 duplicate_child + fox/dragon
   wrong_companion_species — root cause is very low Stage-0 anchor resemblance (0.08–0.14) + companion
   reference handling, not the bible. Does not affect the world-lock conclusion but blocks those
   sample pages from passing entity QA.
3. **Phase D not implemented.** SceneMemory now carries real facts, but scene/location drift is not yet
   a hard-fail (gate-redesign / wrong-location / interior-when-exterior). Still report-only.
4. **CRLF churn / dirty tree.** Unrelated `lib/power-cards/*` + a few specs are modified in the tree
   (not mine) — all commits used explicit pathspecs; nothing unrelated was staged.

## Recommendation
The world-lock layer + deriver are proven general across journey (koko), single-room (bunny, lion),
and same-companion-different-story (fox). Proceed in this order:
1. **Phase D** (drift hard-fail) — the missing acceptance teeth from brief 0078.
2. **Wave 2** — sceneGraph-only bibles for the remaining non-bespoke slots via the deriver (small LOW
   batches + contact sheet per the wave-1 flow).
3. **Dragon** — reconcile the bespoke catalog (scope per-storyId) before adopting dragon into the
   generic layer.
4. **Entity-QA/anchor** — separate track; regenerate higher-resemblance anchors before trusting
   fox/dragon entity QA.

## Exact next instruction for Cursor (proposed — awaiting Guy approval)
Not yet an executable brief. When Guy approves, the first Cursor task should be **Phase D drift
hard-fail** (general): in the scene-memory/appearance drift path, promote to hard-fail (a) recurring-object
identity drift (gate/crib/etc redesigned vs bible identity), (b) wrong-zone (page rendered off its
scene's allowed zone), (c) interior-when-exterior-expected — driven entirely by the location-bible,
no per-story literals; validate on a fresh koko LOW page that the gate-redesign case hard-fails. Keep
`npm run check` green; explicit pathspecs only.
