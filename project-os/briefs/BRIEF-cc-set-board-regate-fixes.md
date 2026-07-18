# BRIEF (CC) — Set Board: close the Codex NO-GO (4 P0 + 2 P1 + fox opt-in + real mint tool)

## 1. ROUTING + TARGET BRANCH
- **Executor:** Claude Code (CC). **Target:** `feat/chunked-generation` (`sh-wt-style01` worktree).
- **⚠️ BRANCH PRE-CHECK (FIRST):** `git branch --show-current` == `feat/chunked-generation`; `git rev-parse HEAD` == `028b3514` (Milestone C — confirm it's pushed first); `git status --short` clean. Single CC session.
- **Gate:** **[CODEX-GATE]** — resume semantics, byte integrity, paid image path. Commit green milestones; STOP for Codex re-gate. **No board mint, no render, no production enablement** until Codex GO + Guy spend-approval.
- **Origin:** Codex re-gate of `028b3514` = NO-GO. Architecture A+B+C accepted, OFF path safe, all 5 deviations accepted (with the two conditions below). These are the blocking fixes before the 5-page proof.

## 2. SCOPE
Fix the 4 P0 + 2 P1 Codex found, opt the fox contract into a real board, and build the working offline mint tool — so the 5-page proof actually exercises a board and is resume/integrity-safe. Build + static-verify only; do NOT mint or render.

## 3. FILES / AREAS + FIXES
- **[P0-1] Resume can skip `set_refs` (snapshot must be the authority, not the env flag).** `shouldEnterSetRefsStage` reads the env flag (`set-identity-board-stage.ts:237`); if a snapshot was written at `dna` and the flag later goes down, resume falls to `cover` with no post-bind assert (`chunk-runner.ts:2092`). Fix: the env flag governs ONLY snapshot CREATION. When `mode === 'required-v1'`, entry into `set_refs` is determined ONLY by the snapshot + bindings. Add an assertion immediately BEFORE every cover/page provider call.
- **[P0-2] styleId namespace mismatch (mint vs live).** Mint normalizes `pencil_watercolor → soft_hand_drawn_storybook` (`mint-set-identity-board.ts:91`, `styles.ts:390`); the live binder passes the raw `order.illustrationStyle` (`set-identity-board-stage.ts:196`). Fix: normalize once with `styleIdFromDatabaseValue(order.illustrationStyle)` in BOTH bind AND assert.
- **[P0-3a] Fox opts into a board.** The fox template has no `setIdentityId`/`setReference` on either location (`fox_uri_adventure.visual-contract-template.json:7`) → required-identities empty → a render "succeeds" with no board (false proof). Fix: add a SHARED `setIdentityId` (the room + balcony are one physical set → one board) + `setReference.status:'pending'` to both locations.
- **[P0-3b] Build the real offline mint tool.** `mint-set-identity-board.ts:38` is a stub that throws `offline mint render not enabled`. Build the full pipeline: render the board → upload (content-addressed, no-overwrite — see P0-4) → board QA → **explicit human approval** → registry entry. Never auto-approve.
- **[P0-4] SHA verified at bind only → bytes swappable.** A valid binding is reused from cache without re-reading registry/bytes (`resolveBoards.ts:191`); the pre-render assert checks only contract metadata/hash (`resolveBoards.ts:245`); storage allows `x-upsert:true` (`image-storage.ts:154`) so the object can be replaced under the same URL. Fix: content-addressed storage key INCLUDING the SHA + no-overwrite, AND re-verify the bytes' SHA before the provider call / on resume.
- **[P1-5] Manifest indices wrong.** The prompt role-map is built correctly from the assembled array (`image.ts:3440`), but the `referenceAssets` manifest is built from the tagged set subset and renumbered from 1 (`image.ts:3647`, `referenceTransport.ts:207`) → if child=Image1 and set=Image3, the manifest records set as 1. Fix: manifest indices from the ACTUALLY-assembled provider array (Codex's condition on accepting the `referenceAssets` deviation).
- **[P1-6] Malformed Board-QA passes.** A non-array `flags` is coerced to `[]` and passes (`boardQa.ts:107`). Fix: a malformed/uncertain QA response is `failed`/`error`, never `passed` (fail-closed).

## 4. ACCEPTANCE CRITERIA
- Resume with the flag turned OFF AFTER a snapshot STILL enters `set_refs` and binds (snapshot is the authority); an assertion fires before EVERY cover/page provider call.
- A board minted by the tool VALIDATES on the live path (styleId normalized identically both sides).
- The fox template opts into a shared board; required-identities is NON-empty → a render without an approved board FAILS closed (no false proof).
- The mint tool produces render → content-addressed upload (no overwrite) → QA → explicit human approval → registry entry.
- The board bytes' SHA is re-verified before the provider call and on resume; swapping the object under the URL is detected and fails closed.
- `referenceAssets` manifest indices match the assembled provider array.
- Malformed Board-QA → failed.
- OFF still byte-identical; `npm run check` green (real toolchain — tsc via node); the 1766 pre-existing tests stay green.

## 5. TESTS
- Resume-after-flag-down enters `set_refs` + binds (the P0-1 fence).
- styleId normalization round-trip: a mint-normalized board matches the live-resolved styleId.
- Fox required-identities non-empty; render-without-board fails closed.
- SHA re-verification detects a swapped object.
- Manifest index alignment (child=1, set=3 → manifest says set=3).
- Malformed Board-QA → failed.

## 6. WHAT NOT TO TOUCH
- Stage-1 safety LOGIC, money/coupon, reader/text/TTS/gender, `set-appearance/*`, and the OFF byte-identity.
- Do NOT mint or render here — build + verify, then STOP.

## 7. GIT HYGIENE
Explicit pathspecs only; NEVER `git add -A`. Commit per green milestone on `feat/chunked-generation`; Guy pushes.

## 8. FINAL VERIFICATION
- `npm run check` green (tsc via node if the `.bin` shim is missing). Report each of the 6 fixes + the fox opt-in + the mint tool, confirm OFF byte-identity and zero excluded-track LOGIC edits. Then STOP for Codex re-gate.
- After Codex GO + Guy spend-approval: mint ONE fox board → 5-page staging proof (QA must FAIL on door/railing-change/window-change/wall-drift/missing-ref-hash; shots must DIFFER) → then 12 pages.
