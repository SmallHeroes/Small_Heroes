# PLAN — consolidation to main (Codex-audited, 2026-07-13)

**Source:** Codex branch-consolidation audit. Target integration branch = **`feat/chunked-generation`** (tip `7093f890`, 1 ahead of remote). Everything lands here, then → `main`.
**Rules:** all git ops = Guy's terminal; `fetch` first; NEVER `git add -A`; explicit pathspecs; never force-push. **LEDGER: record the replacement target SHA for each ported/merged feature BEFORE archiving+deleting its branch. Keep a recoverable `archive/<name>` tag.**

Codex's NO-GO-to-main-today stands; the path is clear. Executed in **4 phases with a checkpoint (npm run check green) after each**, not one marathon.

## Phase 1 — foundation (unblocks Contract v2)
1. **Preserve dirty work first** — disposition the untracked `_review` assets in BOTH worktrees (OTP mockup, READY mockups, visual-contract candidates, project-os docs). Don't lose them; don't `git add -A`.
2. **Reconcile `origin/main` into target** — local `main@6b7f9d9a` is stale vs `origin/main@fdfd2469`; trial merge = 13 conflict regions; merge once retaining newer target behavior; record the target SHA per feature.
3. **Merge `feat/live-authoring-fix@37299b3c` into target `--no-ff`** — 8 valuable compiler commits (pipeline, parser, schema, appearance, topology, `assertSourceProse`, `templateDraftSchema`, companion-presence). 1 conflict in `contractTemplateTypes.ts` → **keep `parent` in `RELATIVE_ROLES`**, accept the engine changes. ← this lands the engine on the render branch = **prerequisite for Contract v2.**

## Phase 2 — reader + narration (has the Codex verdict already)
5. **Reader work** (`BRIEF-cc-reader-ui-fixes.md`): three-way PORT `28b42b7c`+`51e0251b`+`e3a35dac`; implement the missing desktop-control + READY behavior; fix the Bolly fallback. (Line-spacing already on target — skip.)
6. **Finish narration** — the rules landed (`7093f890`) but `criticalTtsNiqqudGaps()` (`tts-ambiguity-niqqud.ts:179`) has **no production caller**. Wire it into `buildPageNarrationTtsText` / `generatePageAudio` (`audio.ts:204`) with the hard-block (critical lemmas) vs soft-warn (`שם`) behavior. **Guy confirms the vocalizations first.**

## Phase 3 — render reliability + OTP
4. **Port render reliability (not wholesale merges):** durable Stage-0 gen/persist/deadline recovery from `stage0-anchor-durable-deadline@1eb6807a` onto the runner seam (`chunk-runner.ts:574`); from `visual-contract-live-wiring`, port ONLY canonical companion-scale (`a3673be3`) + version-bound human-release (`e1ed97f5`). Do NOT merge its other 43 legacy commits.
7. **Resolve OTP explicitly** — `feat/otp-email-redesign` has 0 commits ahead; the design exists only in `_review/otp-login-email-mockup.html`. Either implement on target or record an explicit rejection before deleting.

## Phase 4 — money last, then main (Codex-gated)
8. **Money:** merge all of `feat/coupon-code@e3b89173` (expect Prisma conflict); cherry-pick ONLY `fix/remove-addon-charges@dff4681f` (its earlier 4 commits are an obsolete coupon prefix). **Re-run the money gates** (coupon concurrency, PayMe return/webhook, displayed-vs-charged, refund, migration, tsc) — Codex is the gate.
9. **Final gate:** `tsc --noEmit` + full tests + targeted compiler/materialize/freeze tests + reader desktop/mobile/READY checks + migration audit + **one approved staging golden-path sample**.
10. **Merge target → `main`** — fetch again, reconcile any moved `origin/main`, require it to be an ancestor of target, merge via PR/`--no-ff`, smoke-test, tag the release.

## Archive/delete map (ONLY after replacement SHAs recorded + archive tags)
Archive-tag + delete: the 4 superseded reader branches, Power Card 3a/4b/5, old wizard branches, `fix/narration-accuracy`, `feat/tts-phase0b`, old OTP, anchor-calibration, chunk-worker-reliability, old Style01 experiments, old visual compiler, `voices-6pack`, `cover-title-audio`, `rebuild-prod`, unused remainder of `visual-contract-live-wiring`.
**DO NOT delete until their replacement target SHA is in the ledger:** `fix/reader-mobile`, `feat/live-authoring-fix`, `stage0-anchor-durable-deadline`, `visual-contract-live-wiring`, coupon, pricing, OTP.

## Interleave with Contract v2
Phase 1 (esp. step 3, engine → target) is the prerequisite for the Contract-v2 engine work — so the consolidation isn't a detour; it lands the foundation Contract v2 builds on. Sequence: **Phase 1 → then Contract v2 spec (Codex-reviewed) can proceed on target**; Phases 2–4 run alongside.
