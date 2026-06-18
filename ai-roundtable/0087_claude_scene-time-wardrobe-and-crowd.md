TYPE: RESULT
AUTHOR: Claude Code
DATE: 2026-06-18
RELATED: 0082 (Wave-2 batch-1 + Fix A/B), Guy verdicts (Fix A approved; Fix B approved as direction but blunt)

# 0083 · Scene-time-aware wardrobe (sharpened Fix B) + crowd-scene entity-QA relax

Role: EXECUTOR. Guy verdicts applied: **Fix A (World QA identity-not-state) kept**; **Fix B reworked
from blunt `_bedtime→night` to scene-time-aware**. `npm run check` green (tsc + **557 vitest**, +6).
Commit `da620b09`.

## 1. Scene-time-aware wardrobe — Confirmed
- `LocationSceneNode.timeOfDay` (`day|night|dusk|dawn|mixed`) added + parsed. The page's EFFECTIVE
  time-of-day now drives the wardrobe (sceneGraph scene override wins over story-level), in all three
  places that decide clothing:
  - audit prompt + parity guard (`assembleStyle01Phase2Prompt`, `assertQaRenderWardrobeParity`),
  - the **actual image-generation path** (`imageLockFields.pageTimeOfDayOverrides` is overridden with
    the scene-derived overrides — this was the missing piece; the gen path had been story-level only),
  - `auditPrompt` day-clothes leftover scan now skipped on daytime pages.
- `shouldUseGenericNightStoryWardrobe` refined: explicit `day` page → day clothes; else `_bedtime`
  defaults to night. New helper `scenePageTimeOfDayOverrides(bible, pagePlans)` builds per-page tod
  from scene `timeOfDay`.
- Bibles: panda gan_memory scene `timeOfDay:"day"`; panda night_bedroom + koko_bedtime `timeOfDay:"night"`.
- **Verified (LOW renders, finalPrompt + eyeball):** panda **p2 = day clothes** (daytime gan
  flashback, sun-shirt/denim/red-sneakers), panda **p7 = pajamas** (night bedroom); **koko_bedtime
  p1/p6 = pajamas (no regression)**.

## 2. Crowd-scene entity-QA relax — Confirmed
- `LocationSceneNode.crowdExpected` added + parsed; `pageCrowdExpected(bible, pagePlan)` helper.
- `evaluatePageEntityQa` / `evaluateEntityQaFromRaw` gain `allowMultipleChildren` — when the page's
  scene is `crowdExpected`, the raw duplicate-child count is NOT hard-failed (hero-clone remains a
  separate concern that raw count can't isolate; chose the count-relax option per Guy).
- Bible: panda gan_memory `crowdExpected:true`.
- **Verified:** panda **p2** (musical-chairs ring, many children) now **passes entity QA** (no
  duplicate_child false-fail) while world QA passes (gan_memory zone).

## Tests
`lib/__tests__/scene-time-wardrobe-and-crowd.spec.ts`: bedtime default-night, explicit-day-wins,
explicit-night, non-bedtime-day; entity crowd relax on/off. (557 green.)

## Risks
1. The night Stage-0 anchor (pajamas) is referenced on the daytime flashback page; the prompt wins
   (p2 rendered day clothes correctly), but a per-scene-time anchor is not built — acceptable for the
   single-flashback case.
2. Crowd relax uses raw-count suppression, not hero-clone detection — a cloned HERO inside a crowd
   scene would not be caught. Acceptable per Guy's chosen option.

## Next (Wave-2 batch-2 — in progress)
fantasy journeys (bunny/fox/lion/panda fantasy) + upgrade `fox_uri_adventure` legacy bible to the
sceneGraph schema; dragon stays out. World+entity QA as gate, hero-per-category triage. Reported
separately as it lands.
