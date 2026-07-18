# BRIEF (CC) — consolidate: bring feat/otp-email-redesign onto feat/chunked-generation (ONE current pipeline)

## 1. ROUTING + TARGET BRANCH
- **Executor:** Claude Code (CC). **Target/integration branch:** `feat/chunked-generation` (`sh-wt-style01` worktree) — this is THE launch pipeline (board + contract + money + safety all live here).
- **⚠️ BRANCH PRE-CHECK FIRST:** `git branch --show-current` == `feat/chunked-generation`; `git status --short` clean; note HEAD. Single CC session.
- **Gate:** NON-[CODEX-GATE] for the UI/email work itself, BUT if a ported commit touches money/coupon/safety/readiness → STOP and flag (those are Codex-gated). Commit locally; Guy pushes.
- **Origin:** the generating-screen redesign (`BookOnTheWay`, `5edf9654`) + the OTP-email work live only on `feat/otp-email-redesign`, so they're missing from the pipeline Guy renders/deploys. Two divergent branches = recurring "why don't I see X". Consolidate onto ONE branch.

## 2. SCOPE
Port the UNIQUE work of `feat/otp-email-redesign` onto `feat/chunked-generation`, so the one branch has everything (board/contract/money/safety + the generating-screen redesign + OTP email). Do NOT merge the whole branch blindly — identify the unique commits, port them, resolve conflicts, keep the board/money/safety work already on `feat` intact.

## 3. FILES / AREAS
1. **Map first:** `git log --oneline feat/chunked-generation..feat/otp-email-redesign` = the commits unique to OTP (incl. `5edf9654` BookOnTheWay redesign + the OTP-email commits). `git log --oneline feat/otp-email-redesign..feat/chunked-generation` = what OTP is missing (for awareness).
2. **Port the unique OTP commits** onto `feat/chunked-generation` (cherry-pick or a reviewed merge), resolving conflicts by keeping BOTH sides where they're orthogonal (the generating screen + the board work don't overlap functionally).
3. Watch the known overlap: the `/generating` client + `BookOnTheWay` — the redesign is cosmetic; ensure it still handles the states the board/contract pipeline produces (esp. leave room for the `needs_human_qa`/`under_review` state which is a separate later task, don't regress it).
4. Update `CONSOLIDATION-LEDGER.md` with each ported commit → its new SHA.

## 4. ACCEPTANCE CRITERIA
- `feat/chunked-generation` now contains the generating-screen redesign + OTP-email work (verify the `BookOnTheWay` component + the OTP templates are present).
- ZERO regression to the board/contract/money/safety work already on `feat` (the set-identity-board code, the money/coupon commits, Stage-1 safety, the fox contract — all intact).
- `npm run check` green (tsc via node; full vitest) — report the count.
- No money/coupon/safety/readiness LOGIC changed by the port (if a ported commit touches those → STOP + flag for Codex).
- The ported commits logged in `CONSOLIDATION-LEDGER.md`.

## 5. TESTS
- `npm run check` green. Spot-confirm the generating screen renders (the redesign) and the board/money tests still pass.

## 6. WHAT NOT TO TOUCH
- Do NOT alter the board engine, the money/coupon fixes, Stage-1 safety, or the fox contract while porting. This is additive consolidation, not a rewrite.
- Do NOT force-push. Explicit pathspecs; NEVER `git add -A`.

## 7. GIT HYGIENE
Explicit pathspecs; commit per coherent unit on `feat/chunked-generation`; **Guy pushes**. Log the SHAs.

## 8. FINAL VERIFICATION
- `npm run check` green; report the ported commit list + confirm zero regression to board/money/safety. Then STOP.
- **After this:** `feat/chunked-generation` is the single current pipeline → the remaining step is `origin/main` fast-forward/merge from it (post-launch-blockers). Note in the report whether a clean FF to `main` is available.
