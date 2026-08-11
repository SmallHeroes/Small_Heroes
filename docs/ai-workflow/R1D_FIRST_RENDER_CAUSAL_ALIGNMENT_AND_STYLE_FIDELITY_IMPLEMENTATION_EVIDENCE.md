# R1D-FIRST-RENDER-CAUSAL-ALIGNMENT-AND-STYLE-FIDELITY - implementation evidence

**Date:** 2026-08-11
**Base:** `c58525f31c767b69a6295aa24eb77aef8ecc5597`
**Branch:** `codex/r1d-first-render-causal-alignment-style-fidelity`
**Worktree:** `C:\Users\guyna\.codex\worktrees\renderfidelity1\Small_Heroes`
**Status:** implementation and bounded local LOW measurement complete; independent Claude Code QA pending; production blocked

## Product finding

Guy identified two immediate defects in the first visible page-11 LOW render:

1. The visible drip trajectory and bucket were not aligned, so the falling water could not plausibly land in the bucket or create the authored sound.
2. The child used oversized eyes and rounded doll-like proportions that were materially more cartoon-like than the intended Style 01 watercolor direction.

The baseline remains immutable at:

`C:\Users\guyna\.codex\worktrees\streamtransport1\Small_Heroes\outputs\r1d-first-visible-low-page-20260811\page-11-gpt-image-2-low.png`

## Root cause

### Causal geometry

The approved contract described the bucket under the drip in prose, but the page-11 Blueprint frame had no typed action requirement. The provider received placements for the child, fox and bucket without a structural origin/destination/target relation for the falling water. It could therefore draw a drip and a bucket as individually plausible objects while placing them on incompatible paths.

### Human rendering style

The Style 01 prompt still asked for `rounded expressive characters` and rejected `semi-realistic portrait rendering`. With no child identity reference in this bounded measurement, that wording became the strongest anatomy prior and encouraged large eyes, a rounded head and toy-like proportions.

## General implementation

### Typed action geometry

`lib/style01-prompt-assembly.ts` now builds a closed `[PVB TYPED ACTION GEOMETRY - STRUCTURAL AUTHORITY]` block from:

- typed `actionRequirements`;
- exact Blueprint `action` and `action_destination` placements;
- exact target placements; and
- exact action-space target regions.

The implementation never parses source prose and contains no story, page, child, fox, water or bucket literal. An `into` relation requires the visible path to enter through the target opening and terminate inside the exact target. Missing destinations, missing targets and non-spatial actions produce no inferred geometry. Contradictory duplicate paths, destinations or splashes are explicitly forbidden.

### Style 01 human anatomy

`lib/style01-gptimage.ts` and `lib/style01-visual-polish.ts` retain watercolor paper texture, pigment bleed, warm local color and non-photographic illustration while changing the human prior to observational semi-naturalistic drawing. The prompt now requires ordinary-size eyes with eyelids, developed nose/mouth structure, credible age-appropriate head/body proportion, articulated fingers, ordinary feet and natural joints. Chibi, bobble-head, anime/Disney/Pixar eye scaling, mascot, shortened doll face, toy hands and plastic doll rendering are rejected.

## Bounded QA overlay

The ignored local runner at `outputs/r1d-first-visible-low-page-fidelity-20260811/run-local-wizard-low-sample.ts` adds `local-qa-causal-overlay/v1` only for this measurement. It represents the already-authored pages 10-12 falling-drop-into-bucket fact as typed action authority and projects exact action origin, destination, bucket target and water-drop placements before Wizard qualification.

The overlay is not committed production code, is not reusable runtime authority and does not alter historical artifacts. It exists because the current approved final contract predates the new typed causal relation. Production code remains story-agnostic.

## Validation

- `npm ci --offline --ignore-scripts`: PASS; no network fallback.
- local deterministic Prisma generation: PASS.
- direct runtime authority regression: **1 file / 25 tests PASS**.
- adjacent runtime/Wizard/prompt regression: **3 files / 27 tests PASS**.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- literal `npm run check`:
  - TypeScript: PASS;
  - canonical inventory: 290 files;
  - resource-intensive phase: **19 files PASS**, valid diagnostic protocol, no timeout/RPC/IPC/reporter/launch/signal/teardown failure;
  - ordinary phase: exactly the six established missing ignored-output fixture failures and no seventh failure.

The six fixtures remain an independent production/release HOLD. Guy already accepted them only for this bounded local LOW measurement.

## Wizard and authority evidence

Every render in this milestone qualified through the local Wizard path with:

- Story Source: `story-bank/v3-approved/fox_uri_adventure.md`
- Story Source SHA-256: `02629e886a9aaa1e714d9a8d652c24d94ca5843465ff8a9cb70d320a24e2231c`
- migrated template: `vc-schema/v4`
- package: `visual-package/v5`
- package revision: `956bf383eb939fdfa73ae485ca5516dde04a748ae2347591cc5672cc6f4c8c9f`
- Blueprint: `pre-render-book-visual-blueprint/v4`
- Blueprint digest: `84e0bca0bb1244122ce6abc9bf9d30dbb2f21ed740aff12b1ce39b637beb9980`
- runtime authority: `style01-runtime-authority/v6`
- runtime contract: `29a3382f8f5ec93f350151860246d64274fb03ac7020ec2b1a105e449b1e440e`
- `wizardRenderQualified: true`
- `productionBlocked: true`

## LOW render evidence

All calls used `gpt-image-2`, `quality: low`, `1024x1536`; raw image output was local only. The provider did not return a cost estimate, so this record does not invent one or claim an account-level billing audit.

| Run | Page | SHA-256 | Bytes | Result |
|---|---:|---|---:|---|
| correction-attempt-1 | 11 | `def6331f150e82d1c88bd57caff9946c17ccd372b3fbdc67e04ca0ba1fdc5773` | 2,680,799 | drip enters bucket; child improved but still slightly cute |
| correction-attempt-2 | 11 | `f02eca0f47fc48e0b58d1ad7961737f2aa68988d6eeb4f0f12b9e83f5d0787b3` | 2,806,646 | accepted bounded correction: causal geometry and more human anatomy |
| wizard-sequence-10-12 | 10 | `b0bad9520f272af88f1f5bdea64279d9ba6f63a440167db2420da98b26959a6d` | 2,724,149 | causal path ends inside bucket |
| wizard-sequence-10-12 | 11 | `d1f3b3703ced381eed6eaedfc9fe6e367cadb7ac1f0daed726454f87dfd99330` | 2,815,497 | causal path ends inside bucket |
| wizard-sequence-10-12 | 12 | `7fd3778fb026c333d8492477e24278aed05f492d81f24eeaa0a2af458f7a6850` | 2,797,332 | final drop ends inside bucket |

Totals: **5 provider calls**, **0 transport retries**, **0 fallback**, **0 Vision calls**, **0 remote database writes**, **0 remote storage writes**. Evidence files report `estimatedCostUsd: null`; billing was not inferred.

## Visual assessment

- Causal alignment: PASS for all five corrected images. The visible vertical water path enters the bucket opening and terminates at the water/splash inside it.
- Child rendering: materially improved. Attempt 2 and the three-page sequence have ordinary human eye scale, visible eyelids, a longer facial structure and more credible hands/feet while remaining painted watercolor illustrations.
- Sequence continuity: directionally PASS for pajamas, child hair/color family, fox identity, bucket, balcony, moonlit night and warm flashlight palette. Exact face/set locking is not yet production-grade and remains a later reference-authority task.
- Product conclusion: the system now demonstrates visible improvement and a functioning Story Source -> package -> Blueprint -> Wizard -> local LOW image path. This is not full-book or launch acceptance.

## Unchanged boundaries

- No full-book or HIGH render.
- No Vision or automatic visual QA provider.
- No retry or fallback.
- No production database/storage, publication, promotion, activation or deployment.
- No change to resemblance threshold, release gates or production block.
- Historical baseline and authoring artifacts remain immutable.

## Rollback

Revert the focused implementation commit(s). The ignored local images and evidence can be retained for comparison or removed in a separately authorized cleanup. No remote product state needs rollback.

## Independent QA target

Claude Code should review the committed base-to-head range and attempt to falsify:

1. typed-only geometry provenance and absence of prose parsing/story literals in production;
2. deterministic, fail-closed handling of missing/non-spatial authority;
3. unchanged Blueprint/Wizard composition ownership;
4. Style 01 watercolor preservation and the exact anti-cartoon constraints;
5. focused and repository validation claims;
6. the five-call/no-retry/no-fallback/no-Vision accounting;
7. local-only artifact boundaries and the production block; and
8. the visual claim that the drip terminates inside the bucket and child anatomy materially improved.

Claude Code's first pass is read-only. Codex does not self-award independent technical PASS.
