# 0074 · Claude → Cursor · Harden Entity-QA (companion-count + fail-closed) + p5 single-Kim + v5 quarantine

**Status:** 0071 committed clean (67936f84) + v5 restored (4c8cc144). Codex review: the presence-contract fix is good, but (1) the Entity-QA still passes a 3-Kim page, and (2) v5 koko still carries old canon. This brief closes both. Keep 67936f84 untouched. Small, targeted. `npm run check` green; route via Cursor; explicit pathspecs.

## Validated gaps (file:line)
- `lib/generation-pipeline/page-entity-qa.ts`: the JSON prompt asks `duplicateChildCount`/`singleChildOnly` (CHILD only) — **no companion-count check** → 3 Kims pass (companionPresentOk/speciesOk/identityOk all true). And the result handling is **fail-OPEN**: HTTP-not-ok (line 98), empty parse `?? '{}'` (104), catch (129-135), missing API key (78) all return `passed: true`. A QA gate that returns PASS on error/skip is unsafe.
- `story-bank/v5-fixed-v2/chameleon_koko_bedtime.md` (line 10 title "קוקו" + scarf) and `chameleon_koko_fantasy.md` (line 9 "צעיף הצבעים" + scarf motif) — restored intact but old canon; must be unreachable before any user render.

## Fixes

### [P0] A — Entity-QA: add exactly-ONE-companion check
In `buildEntityQaPrompt`, add to the JSON schema:
- `"companionCount": number of distinct companion creatures of the expected species (0 if none)`
- `"singleCompanionOnly": true if at most ONE companion creature (no duplicate/clone/multiple copies of the companion)`
Add a new failure type `duplicate_companion` and hard-fail it when `expectsCompanion && (singleCompanionOnly === false || (typeof companionCount === 'number' && companionCount > 1))`. (This is the 3-Kim case that currently slips through.)

### [P0] B — Entity-QA: fail-CLOSED (never PASS on error/skip)
Errors/skips must NOT return `passed: true`. Introduce a distinct outcome (e.g. add `status: 'pass' | 'fail' | 'error'` or an `errored: true` flag) and set it for: missing API key (78), HTTP not-ok (98), empty/`{}` parse (104), and catch (129-135). The gate/QA-console must treat `error` as "QA could not verify — manual review required," **never as a green PASS.** Keep transient errors non-blocking for retry, but they must never auto-pass a render. (Don't over-block: an `error` is "unverified," distinct from a hard `fail`.)

### [P0] C — p5 content: force a SINGLE Kim (my v3 re-angle)
`story-bank/v3-approved/chameleon_koko_fantasy.md` p5 (the "Kim changes color" beat) still invites multiple Kims. Append to the p5 imageDirection: "A SINGLE Kim — ONE chameleon body shifts through the colors across the description; NEVER multiple Kims, NEVER duplicate or clone the child." (pink-dots already removed; this adds the single-instance clause.) Quick scan the file for any other color-sequence wording that could read as multiple figures.

### [P1] D — Quarantine v5 koko bedtime/fantasy SAFELY (no large-file edit)
Make `story-bank/v5-fixed-v2/chameleon_koko_bedtime.md` + `chameleon_koko_fantasy.md` unreachable as a live source via a **loader-level exclusion** (a small denylist constant in the bank loader/index that refuses to serve these two paths) OR a rename to `*.superseded.md` if no test/loader depends on the exact name. Do NOT edit the large file bodies (that's what corrupted them in 0071-H). Add/adjust a test so the exclusion is asserted. Goal: even with `ENABLE_V3_APPROVED_BANK` off, these old-canon files can never be served for koko bedtime/fantasy.

## Gate (re-test, minimal)
1. Re-render ONLY koko·fantasy **page 5** LOW (the clone page), same boy child, approved Stage0 anchor.
2. PASS (eyeballed): exactly ONE Kim (chameleon, mustard satchel, orange nose), NO duplicate Kims, NO clone children, watercolor child.
3. **Also test the QA itself:** confirm the hardened Entity-QA now HARD-FAILS `duplicate_companion` on the OLD 3-Kim p5 image (run it against the prior failing render artifact) — proving the gate would have caught it. And confirm an injected HTTP/parse error yields `error`/non-pass, not `passed:true`.
4. `npm run check` green.
Report as 0075 with the p5 re-render + the QA result on both the new and the old p5 image.

## Do NOT
- Do NOT touch commit 67936f84.
- Do NOT edit the large v5 koko file bodies (corruption risk) — exclude/rename only.
- Do NOT proceed to other slots or a full 16-page render until p5 passes eyeball + the QA proves it catches duplication.
