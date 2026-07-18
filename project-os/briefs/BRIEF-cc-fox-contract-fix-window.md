# BRIEF (CC) — SET-CONSISTENCY step 1: fix the fox contract (remove balcony_door → window+railing+balcony)

## 1. ROUTING + TARGET BRANCH
- **Executor:** Claude Code (CC). **Target branch:** `feat/chunked-generation` (the contract engine + fox contract live here — NOT `feat/otp-email-redesign`).
- **⚠️ BRANCH PRE-CHECK (FIRST):** `git branch --show-current` MUST be `feat/chunked-generation`. This is the `sh-wt-style01` worktree. If not → `git checkout feat/chunked-generation`.
- **Gate status:** NON-[CODEX-GATE] (contract-data/authoring only). Commit locally; Guy pushes.
- **Origin:** Codex set-consistency ruling — the fox render's window↔door was NOT a model invention: the CONTRACT authored `balcony_door` as the only balcony exit and the location-bible still says `window/door`, so the model obeyed a wrong authority. Guy's story decision (confirmed): window + balcony/railing, NO door.

## 2. SCOPE
Correct the fox visual contract + location bible so the opening set is a **מרפסת (balcony) with a WINDOW + RAILING, and NO glass exit-door** — matching the story text (p1 "נשמע מתחת לחלון" = window; p4/p5 "מעקה"/"קצה המרפסת" = balcony; no door anywhere in the text). This is authoring only — no engine change. Do NOT recompile the template (`assembleTemplateFromDraft` passes zones verbatim → a re-run drops hand-authored structure).

## 3. FILES / AREAS
- The fox visual-contract template — remove the `balcony_door` `SpatialNode`; the opening becomes `window` (listening) + the balcony `railing`; the child steps out onto the same מרפסת, no separate glazed door. (Path per Codex: `story-bank/v3-approved/fox_uri_adventure.visual-contract-template.json:123`; Cowork saw it at `backend/story-bank/v3-approved/...` — confirm the real path in the worktree.)
- The fox **location bible** — replace the `window/door` ambiguity with `window` + `railing` + `balcony` (`...fox_uri_adventure.location-bible.json:60`).
- Update the Tier-A `stableGeometry` projection and Tier-B `mustShow`/`mustNotShow` so `mustNotShow` now FORBIDS a door/vitrine (it was the invented element) and the geometry describes one balcony-with-window set.

## 4. ACCEPTANCE CRITERIA
- No `balcony_door` node anywhere in the fox contract; opening = `window` + balcony `railing`; one consistent balcony set.
- `mustNotShow` explicitly forbids a glass exit-door / vitrine on the relevant pages.
- Fox contract VALIDATES under Stage-3 + Stage-4; Tier-A/B still hold; fox NOT recompiled.
- Bunny canary (`1ecfdcb2…`) stays green; `npm run check` green.

## 5. TESTS
- A test asserting the fox contract has NO `balcony_door` and DOES have the window + railing nodes, and that `mustNotShow` forbids a door on the opening pages.
- Existing contract/validate specs + canary green.

## 6. WHAT NOT TO TOUCH
- Engine/compiler/validator, Stage-1 safety track, money. Authoring/data only.
- Do NOT re-render here — that comes after the Set Board engine (brief 2) + the 5-page validation.

## 7. GIT HYGIENE
Explicit pathspecs only; NEVER `git add -A`. Commit locally on `feat/chunked-generation`; Guy pushes.

## 8. FINAL VERIFICATION
- `npm run check` green (via the real toolchain — run `tsc` through node if the `.bin` shim is missing; do NOT trust an `npx tsc` stub). Report the fox contract diff (door removed, window+railing in) + confirm not recompiled. Then STOP.
