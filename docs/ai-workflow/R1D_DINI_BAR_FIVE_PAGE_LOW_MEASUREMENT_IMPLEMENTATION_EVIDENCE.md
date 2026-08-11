# R1D-DINI-BAR-FIVE-PAGE-LOW-MEASUREMENT — implementation evidence

## Status

Local implementation and bounded five-page LOW measurement are complete. Independent Claude Code technical-record QA and Guy's product/visual acceptance remain pending. Production remains blocked.

## Repository authority

- Worktree: `C:\Users\guyna\.codex\worktrees\fullbookaudit1\Small_Heroes`
- Branch: `codex/r1d-dini-bar-five-page-low-measurement`
- Base: `78d1cb12461580f42ef38d6ffa6e86c3a9e76635`
- Story Source: `story-bank/v3-approved/dragon_dini_fantasy.md`
- Story Source SHA-256: `f63c5bac96d38bcb257ec58db8c89da1b15a86ab070c9f2ec9ee66087718000e`
- Bar reference: `C:\GNart\Work\Small_Heroes\public\Images\Bar.png`
- Bar reference SHA-256: `b3e6bef5ac4c07050389fad02767b5f007426aa850e16ef4a8fa813b929ae668`
- Legacy local Dini template input SHA-256: `3bea73da87eeab5466b5da49e52a2d98d9fab7c986b666f613e8c64d0514d366`
- Embedded shot-plan SHA-256: `fbd72e32418705d2ea85db0f602c10c24caf435b67c5b4d5f3fff437a38d2d52`

## Product question

The Fox full-book measurement was not a strong discriminator because most of its story occupied one balcony/bedroom set. Guy asked for five consecutive pages from a materially different story to determine whether the engine can preserve child/companion/world identity while changing location, viewpoint, action and visible story state.

`dragon_dini_fantasy` pages 1-5 were selected because the sequence contains:

1. Bar alone on the bed among baby things.
2. Bar opening a purple-glowing toy-chest portal.
3. Bar arriving in Dini's orange-hills world.
4. Dini's bell/stone/tail comic action beat.
5. Dini guarding a speckled egg in its nest.

## Implementation boundary

- The existing Fox runner now has a closed `dini-bar-five-page` measurement mode; its default Fox behavior is preserved.
- The synthetic Blueprint fixture accepts an explicit positive page count so the complete sixteen-page Story Source/Visual Contract is represented even when the measured render subset is pages 1-5.
- A local-only Dini measurement authority supplies a deterministic sixteen-row shot plan with five materially distinct opening signatures.
- The measurement overlay converts explicit legacy prop states for pages 1-5 into typed required/forbidden prop constraints and fills three legacy-to-current migration facts: cover zone, cover cast and opening-location time-of-day.
- The overlay does not change production compiler, validator, prompt, schema, Wizard or rendering behavior. The external legacy Dini template remains a local measurement input, not current production authority.
- Bar's exact image is the child identity reference. Dini uses repository-owned canonical companion references.
- Images are generated through the actual repository `generateImage` path after real Visual Package, Blueprint, runtime-authority and Wizard qualification.
- A loopback local storage emulator captures rendered bytes. No remote database/storage, Vision, entity QA, world QA, Board, publication, deployment or production activation is reachable from this run.

## Zero-cost qualification chronology

### Attempt 1

- Root: `outputs/r1d-dini-bar-five-page-low-20260811-qualify-1/`
- Provider calls: `0`
- Persisted files: `0`
- Result: fail-closed before render.
- Cause: the legacy template lacked current Blueprint cover-zone/cover-cast and opening-location time-of-day authority. The sorted Blueprint diagnostics also surfaced an apparently unrelated affordance index; repository inspection proved it was the cover camera whose zone was absent after canonical sorting.

### Attempt 2

- Root: `outputs/r1d-dini-bar-five-page-low-20260811-qualify-2/`
- Provider calls: `0`
- Result: PASS.
- Distinct measured frame signatures: `5/5`
- Visual Package: `visual-package/v5`
- Package revision: `c27da6ddc7f30cb67fe156713719580b1bb4e2fa6b00c19d66a2161c380aac9e`
- Blueprint: `pre-render-book-visual-blueprint/v4`
- Blueprint digest: `b997d383bc5ee9b2d22c044359dd78d832dac2eb8749ba01f06c6265993bb3f3`
- Runtime authority: `style01-runtime-authority/v6`
- Runtime contract hash: `dd53e963a0040dca62b7fb004bb479560f55c2d86a610d0221db72defb9624f6`
- Wizard `renderQualified`: `true`

## Render execution

- Root: `outputs/r1d-dini-bar-five-page-low-20260811-render-1/`
- Status: `rendered_local_low_dini_bar_five_page_measurement`
- Model/quality: `gpt-image-2` / `low`
- Dimensions: `1024x1536`
- Provider calls: `5`
- Transport retries: `0`
- Fallback used: `false`
- Visual-QA provider calls: `0`
- Remote database access: `false`
- Remote storage access: `false`
- Contact sheet SHA-256: `a7c41d4d3d2d900a7a2306efe2fefab04a162277837e76a8c8abf295fa2881f5`

| Page | Image SHA-256 | Bytes | Prompt SHA-256 |
|---|---|---:|---|
| 1 | `9fc791910d70338a679f4bb25710faaa0e89d5523bc53a96ba35649054703222` | 2,752,896 | `f8341dfe0a4f4a9297f6a31d001c24744fcaa8e554ecd48872a81591fd86c9bc` |
| 2 | `d7547576366d0d200e6c2a60a08f7a6beba64fb758bd8177ff4da5ed807693c5` | 2,922,499 | `f1ab0422e23b48a1d6cd376b32ec96d242ae27614269d0073e16a288069ec117` |
| 3 | `82b4bdbf6ca0a117d6748e2b710a13bb2835580b1d1d51f845f0af204f9b5e42` | 2,816,650 | `3970682a455411767433ab5c8e964ca32452ded07018f10ee5f49f51823595cb` |
| 4 | `c51b88c0cc49e3939933245182e5644c36c511693e7b9bb822aab7fc1265e68b` | 2,958,049 | `6548db1eef8dcd4fc7350d469421e85361728829723fbddd3534823cbdfa743d` |
| 5 | `2b94fe02bb5536a6c62e79096c2e6e367271e0c147645d130d6a66b64f192610` | 2,765,879 | `d1589c69f2ddca79519eb97944e86a77a81d051b1c8674b63d61f9653e72e1c8` |

The provider reported `8` text-input tokens and `158` image-output tokens for every call. At the official standard rates checked on 2026-08-11 (`$5/M` text input and `$30/M` image output), the five reported-token totals correspond to `$0.023900`. The repository estimator returned `null` because its gpt-image-2 rate table is not configured. This is nominal local accounting, not an OpenAI project/account billing audit.

## Visual assessment

### Demonstrated progress

- All five pages are materially different compositions rather than variants of one frame.
- Pages 1-2 preserve a recognizable bedroom family while changing from a medium-wide establishment to a high/close portal interaction.
- Page 3 changes environment and scale to a broad orange-hills reveal.
- Page 4 uses a side-action composition and correctly shows Dini's raised wing, bell cue, tail movement and displaced small stone.
- Page 5 moves to an elevated intimate composition with the nest and whole green speckled egg.
- Bar retains dense dark curls, recognizable face, teal top, rust trousers and yellow footwear across all pages.
- Dini retains orange scales, horn/wing silhouette and terracotta ribbon across pages 3-5.
- Dini is absent on pages 1-2; the egg/nest are absent before page 5; the stone is specific to page 4.

### Remaining product limitations

- Bar is visibly more cartoon-like on page 4 than pages 1-3/5.
- Dini's eyes remain larger and more mascot-like than the strict semi-naturalistic target.
- Bedroom continuity between pages 1-2 is coherent at the semantic/set-family level but does not prove exact geometry locking for every furnishing.
- The sequence used a migrated legacy local Dini contract plus measurement overlay. It proves Wizard-to-render behavior for a varied story, not fresh production authoring of Dini authority.
- Guy retains product/visual acceptance. Codex does not award visual PASS.

## Validation

- Direct authority + Blueprint tests: `2 files / 111 tests` PASS.
- Final focused classifier/authority/Blueprint set: `3 files / 118 tests` PASS.
- TypeScript: PASS.
- `git diff --check`: PASS.
- One literal `npm run check`:
  - TypeScript: PASS.
  - Resource-intensive phase: `19 files`, PASS, diagnostics valid, no timeout/RPC/launch/reporter/teardown failure.
  - Ordinary phase: the six established missing ignored-output fixture failures plus one stale inventory assertion caused by the new spec.
  - The test-only inventory expectation was corrected from total/ordinary `291/272` to `292/273`; focused classifier `7/7` PASS.
  - The literal repository check was not rerun.
- The six known fixture failures remain a separate production/release HOLD. They are not waived for launch.

## Rollback and exclusions

Delete the ignored local output roots and revert this focused branch. No production authority, remote storage/database, publication, deployment or production state changed. No full-book render, HIGH render, Vision, authoring-model call, approval or release action occurred.
