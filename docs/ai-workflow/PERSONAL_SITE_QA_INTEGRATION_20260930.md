# Personal site QA integration — Decision Gate

## Authority and scope

Guy explicitly asked Codex to inspect Claude's homepage and wizard work and push it to QA if safe. This is an authorized QA-only design preview, not a production launch, paid writing activation, or product acceptance. Claude independently reviewed `fd2b26bd..45b9e754`: HOLD on the paid writer (two P2 capacity/timeout predictions); no risk found shipping with writing OFF. Codex's technical review of Claude's landing fix covers `c0827427..86ca47e8`, with no findings. Those verdicts are not expanded to the new routing delta.

## Observed versus expected

The named QA alias serves `a0835b72` on `codex/r1d-release-reader-voice-final`. Claude's complete site/wizard successor is `86ca47e8` on `claude/personal-landing-wow`. The latter descends from the former, but its design mounts only at `/dev/personal-product`; simply pushing it does not update the root homepage. Expected: QA's root shows that design and its CTA opens the personal wizard, while production and `/start` retain their existing behavior.

## Recommended solution and rejected alternatives

Use a narrowly opted-in middleware rewrite of `/` to the existing preview page. Require non-production Vercel preview/development, `ALLOW_STAGING_QA=true`, `PERSONAL_WIZARD_PREVIEW=true`, `PERSONAL_PRODUCT_QA_HOME=true`, the exact QA hostname, and GET/HEAD. Keep the preview's existing page-level guard, noindex metadata and scoped fonts/CSS. No public-page component or CSS changes, no `/start` rewrite, no schema or engine migration.

Rejected: importing the preview page into public `/` (global CSS/font and metadata leakage); assuming a branch push changes routing; merging the separate engine branch (unrelated held engine code); enabling paid paths to demonstrate the UI; weakening deployment protection.

## Implementation ownership and sequence

This chat is the sole writer of `codex/personal-site-qa-integration-20260930` in the managed `personal-site-qa/Small_Heroes` worktree, starting at `86ca47e8`. Claude's source checkout stays untouched. Protected checkouts remain `d53b` at `768ccb2f` and accepted-intent-wave-2 at `63ccb484`. The engine branch at `10f54930` is excluded.

1. Add the root rewrite and adversarial tests against the real middleware.
2. Run typecheck, relevant middleware/wizard/landing tests, full repository check, and release-check; record exact outcomes, not blanket readiness.
3. Create a focused local commit and prepare an independent Claude QA handoff.
4. Configure only the QA branch's preview flags: UI ON, live intake and paid writer OFF. Preserve other flags, secrets, production settings and aliases.
5. Verify the QA remote is unchanged; fast-forward only, push the named QA branch under Guy's existing authorization, verify the resulting preview deployment and alias before/after.

## Acceptance and risks

Positive root rewrite; negative production (even all flags ON), default-OFF, wrong host/forwarded host, non-root and POST; old dev/debug/fake-payment controls unchanged. Query parameters preserved; noindex/no-store. Real HTTP/browser checks must prove QA homepage → personal wizard, with unavailable paid paths. Focused green does not close inherited full-check failures or writer/engine HOLDs. Codex does not independently PASS its own delta.

## Stop-check / cost / rollback

General environment routing fix, no story-specific behavior. No image/audio/LLM generation, no API-key reads, $0 provider spend. No production change or customer charge. Existing QA authorization resolves the owner decision for this narrow preview. Guy should eyeball the new homepage and wizard. Claude should attack environment/host isolation and accidental paid activation. Rollback: set the QA-only home flag OFF and repoint only `qa.smallheroes.co.il` to the recorded prior READY preview (`dpl_B6iLmc3JkghRXnEF5hd9CTihXgjs`); revert the focused routing commit if necessary. Never force-push or change production aliases.

## Explicit exclusions

No production deployment, paid voice/writer trial, generated story/illustration, engine timeout/token-cap fix, database write/migration, repo cleanup, or launch/stability certification. Independent technical QA of the new routing delta remains required.

## Execution evidence (updated before handoff)

- Focused production-path suite: 337/337 in 17 files, exit 0. Includes every personal-wizard spec, hero child handoff, voice-stage lifecycle, 31 new real-middleware cases, and classifier inventory.
- First tsc run caught an overly broad DOM `RequestInit` type in the new test helper. Fixed by deriving NextRequest's constructor type. Subsequent standalone/full-check typechecks pass. No runtime code affected by that correction.
- Mutation probe loads the base middleware directly from Git into memory and current source through real TypeScript/NextRequest. Base root unchanged; current QA rewrites. Removing the runtime fence, hostname fence, explicit-home flag or preview flag is detected (four controls). Probe itself: writes 0, provider calls 0.
- Adding one spec exposed a pinned inventory expectation. Updated exact counts 389→390 and 369→370, pinned the new spec in ordinary, left 20 resource specs and all thresholds/policies unchanged.
- First complete check: ordinary 11 failures / 5055 passes / 73 skipped; one own inventory expectation corrected, remaining ten names match Claude's missing-fixture baseline. Resource 635/635 tests pass but three RPC timeout errors cause native exit 1; overall RED. No fresh full baseline run claimed.
- Fresh complete check after the inventory update: native exit 1; ordinary 10 failures / 5056 passes / 73 skipped in 370 files, all ten failures are the recorded missing-artifact cases; resource 635/635 in 20 files but three `onTaskUpdate` RPC timeout errors and native exit 1. Overall RED. No gate override, timeout increase or stability closure claimed.
- Config-only release-check with `ENABLE_V3_APPROVED_BANK=true`: native exit 0; 18/18 product-sellable, 1/18 render-qualified; database check skipped because DATABASE_URL is unconfigured. Strict render qualification was not requested because this is a design-only preview; no render/release readiness is claimed.
- Authenticated HTTP baseline: existing QA preview responds 200, noindex, old homepage and no new voice-stage markup. Its deployment remains `dpl_B6iLmc3JkghRXnEF5hd9CTihXgjs`. Production alias `smallheroes.co.il` points to `dpl_2X7E6d1acZ5vKJVhLSuKFGP5Q4HN` and must remain unchanged.
- Four new variables created only for preview target / `codex/r1d-release-reader-voice-final`: `PERSONAL_WIZARD_PREVIEW=true`, `PERSONAL_PRODUCT_QA_HOME=true`, `PERSONAL_WIZARD_LIVE_INTAKE=false`, `PERSONAL_WIZARD_STORY_WRITER=false`. Existing ALLOW_STAGING_QA and all unrelated variables preserved. Name/target metadata verified without revealing secret values.
- CLI input-array attempts were rejected (400), with no new variables present in the readback. Four individual JSON stdin requests then succeeded; metadata confirms exactly the intended names/branch/preview target. A broad value-read command was rejected before execution by the sandbox reviewer; safe follow-up reads use name/target metadata only. No sensitive env values printed or downloaded.

Local additional evidence is outside the repo, in `C:/Users/guyna/.codex/visualizations/2026/09/04/01a06c5c-a233-76c0-ac8e-618c02ce6246/personal-site-qa-20260930/`: `middleware-probe.cjs`, non-secret flag payload and final full-check log. These are local artifacts, not a verified off-machine backup. The Git-tracked test and this document carry the durable assertions, not the raw log.
