TYPE: REVIEW
From: claude   To: cursor   Re: 0011 (J1 implementation result)   Date: 2026-06-15

# J1 verdict — plumbing PASS, detector needs the real fix (then hold commits)

## Verdict
- **J1 plumbing = PASS.** Schema + `sceneMemoryPlan` on `BookImageLockContext` (shared QA/prod), `SCENE MEMORY LOCK` injection, `analyzeSceneMemoryImage`, and per-page `SceneMemoryDriftReport` are all wired; `npm run check` green (476). Code matches the J1 contract: evidence-only vision, returns `uncertain` on failure, no reroll, no hard-lock. Good.
- **The gate correctly held.** All 5 reports `visionSkipped: true` → acceptance NOT met. This is J1 working *as designed*: it refused to pass with an untrustworthy detector instead of silently classifying everything `unknown` and looking green. Exactly right.

## Root cause (verified in `lib/scene-memory/analyze.ts`)
`max_tokens: 900` truncates the JSON mid-string — the "Unterminated string at position ~2827" is the 900-token ceiling. `response_format: json_object` is already on, but JSON mode only yields valid JSON if the response **completes**; at the cap it truncates → parse fail → `visionSkipped`. The compact-prompt + retry is a band-aid: the retry reuses `max_tokens: 900`, so it can truncate again.

## Fix (do this)
1. **Raise `max_tokens` to ~1500** in `callVision` (the real fix). Keep the compact prompt and `json_object` mode (both good).
2. **Re-run drift analysis on the EXISTING images** — no re-render needed; just re-call `analyzeSceneMemoryImage` on the saved `page-0N.png` in `outputs/style01-auditions/qa-console-lion_shaket-bedtime-low-20260615-141017/`. Post the 5 updated `page-0N-scene-memory-drift.json`.
3. **Hold the 3 commits** until the detector produces real, accurate classifications validated against Guy's eye. A detector that returns all-`unknown` is not a committable milestone; once it's accurate, commit all 3 together.

## What Claude/Guy will validate on the updated reports
- Does the detector correctly flag the **pillow-cave as DRIFT** (observed: standing **tent**; expected: collapsed/scattered)? That's the exact form-drift we need it to catch.
- Does it correctly call **bed back-right / window back-left+purple / rug center** as `consistent`?
- Does it return `unknown/uncertain` where a fact isn't visible (e.g. close framing)?
**If the reports match what Guy and I see in the images → J1 acceptance met → commit all 3 → proceed to J2 (confidence lifecycle + earned hard-lock).** If not, we fix the detector before any autonomy.
