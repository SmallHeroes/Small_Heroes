# R1D — Canonical Child Style Anchor and QA Reader Page Turn — Implementation Evidence

Status: local implementation and bounded LOW proof complete; independent Claude Code QA pending. Product, production and release acceptance are not claimed.

## Repository authority

- Worktree: `C:\Users\guyna\.codex\worktrees\barfidelity1\Small_Heroes`
- Branch: `codex/r1d-child-expression-style-fidelity`
- Overall branch base: `ced2f4e19dcaf843f772ba88b09adf2fc5509604`
- This implementation base: `f508038d`
- Implementation commits:
  - `41157b25 fix(style01): bind canonical child style fidelity`
  - `f014861b feat(reader): animate directional page turns`
- Push: not performed by this milestone.

## Root cause and implemented boundary

The prior local multi-page measurement supplied the raw child photo as reference 0 on every page. That made each page call independently reinterpret the photo into Style 01 under different scale, composition, companion and style-reference pressure. The small page-3/page-4 child therefore drifted toward mascot/cartoon treatment even after page-specific expression handling was corrected.

Four contributing defects were verified:

1. The measurement runner bypassed the production pipeline's approved canonical child-anchor boundary.
2. Stage-0 identity sanitation removed toddler wording but retained transient smile, mouth and gaze language.
3. Stage-0 child reference prefixes explicitly requested a `cute simplified` child, conflicting with the semi-naturalistic Style 01 contract.
4. Expression-anchor prefixes contained stale hard-coded Mia identity/wardrobe/accessory details and could contaminate another child.

The general solution is one style-normalized child anchor per child/style authority. The raw photo is Stage-0 input only. The anchor owns stable face, hair, skin, age, anatomy and Style 01 realism. Page expression, gaze, mouth, pose, action, placement and camera remain page/Blueprint authority. No production branch uses Bar, Dini, page 3/4 or story prose as a special case.

## Implementation

- `lib/generation-pipeline/stage0-method-b.ts`
  - Reuses the existing transient-expression sanitizer before anchor prompt assembly.
  - Requires relaxed closed-mouth neutrality and refined semi-naturalistic human rendering.
- `lib/style01-gptimage.ts`
  - Adds `Style01ChildReferenceKind = raw_photo | canonical_anchor`.
  - Uses explicit authority first and retains normalized Windows/URL path recognition only for legacy callers.
  - Strengthens the canonical anchor rule to preserve exact human realism/detail while leaving page pose variable.
- `lib/generate-image.ts`
  - Removes the child `cute simplified` instruction.
  - Removes stale Mia/age/pajama/bracelet literals from generic child anchor prefixes.
  - Requires the exact supplied child identity, wardrobe and accessories with believable human anatomy.
- `backend/providers/image.ts` and `lib/generation-pipeline/chunk-runner.ts`
  - Carry the typed child reference kind through page generation.
  - Production pages identify the already-required approved anchor as `canonical_anchor`.
- `scripts/run-r1d-wizard-low-full-book-measurement.ts`
  - Requires `--child-anchor` for the Dini/Bar multi-page proof and never falls back to the raw photo.
  - Records `childReferenceKind: canonical_anchor` in evidence.
- `scripts/run-local-style01-child-anchor-audition.ts`
  - Uses the repository-owned Stage-0 prompt/reference builder for one local LOW anchor.
  - Loads only `OPENAI_API_KEY` for the provider child process, clears it in `finally`, forbids fallback and writes sanitized local evidence.
- `lib/book-layout/page-turn.ts`, QA viewer and production Reader
  - Derive direction only from scene indices.
  - Apply a common forward/backward class and data attribute to every scene kind.
  - Use a 520 ms CSS-only 3D turn/shadow and disable it under reduced-motion preference.

Existing anchor approval, resemblance threshold `0.70`, model, budgets, retry/fallback policy, storage, publication and deployment behavior were not changed.

## Automated validation

Direct focused command:

```text
npx --no-install vitest run
  lib/__tests__/stage0-method-b-references.spec.ts
  lib/__tests__/style01-child-expression-style-fidelity.spec.ts
  lib/__tests__/reader-page-turn.spec.ts
  lib/__tests__/child-photo-dna-sanitize.spec.ts
  lib/__tests__/reader-nav.spec.ts
  lib/__tests__/reader-storytime-dwell.spec.ts
  lib/__tests__/reader-narration-src.spec.ts
```

Result: **7 files / 44 tests PASS**.

Additional results:

- `npx --no-install vitest run lib/__tests__/vitest-workload-classifier.spec.ts`: **1 file / 7 tests PASS** after the exact inventory correction.
- `npx --no-install tsc --noEmit`: PASS before and after the inventory correction.
- `git diff --check`: PASS.
- React best-practices review: no new data waterfall, global event listener, hydration boundary, heavy dependency or expensive render loop; the change is one small state value, a pure direction helper and CSS animation.

### Literal repository gate

`npm run check` was invoked exactly once. TypeScript passed. The 19-file resource-intensive phase passed in 109,964 ms with valid diagnostics and no timeout, RPC/IPC, reporter, launch, signal or teardown failure. The ordinary phase reported seven assertions:

- Six established missing ignored-output fixture failures, unchanged and retained as a separate release HOLD.
- One stale workload inventory expectation introduced by adding the new Reader spec: expected `293` total / `274` ordinary, observed `294` / `275`; resource-intensive remained `19`.

Only those two numeric test expectations were corrected. The direct classifier and TypeScript passed afterward. The literal full gate was not rerun.

## Bounded visual proof

Current official OpenAI GPT-Image-2 token rates used for nominal local accounting: image input `$8.00 / 1M`, cached image input `$2.00 / 1M`, image output `$30.00 / 1M`, text input `$5.00 / 1M`, cached text input `$1.25 / 1M`. Source: `https://openai.com/api/pricing/`, checked 2026-08-11.

### Call 1 — canonical Bar Style 01 anchor

- Model/quality/size: `gpt-image-2` / LOW / `1024x1536`
- Provider mode: `images.edit`
- References: raw child photo plus two Style 01 references
- Provider calls/retries/fallback: `1 / 0 / false`
- Usage: image input `2966`, text input `1129`, image output `158`
- Nominal token accounting: `$0.034113`
- Artifact: `outputs/r1d-bar-canonical-style-anchor-20260811-attempt-2/character-anchors/child-canonical-style01-low.png`
- SHA-256: `3715cf8f6dcb1775abba4a81138ac41a2bb2db437b38efaad6aaea936cdbcb88`

Visual intake: recognizable Bar identity, closed-mouth neutral expression, natural five-year-old anatomy, refined watercolor modelling, no mascot/chibi treatment and the approved teal/rust/yellow wardrobe.

### Calls 2–3 — corrected pages 3 and 4

- Model/quality/size: `gpt-image-2` / LOW / `1024x1536`
- Qualified authority: `visual-package/v5`, `pre-render-book-visual-blueprint/v4`, `style01-runtime-authority/v6`
- Package revision: `c27da6ddc7f30cb67fe156713719580b1bb4e2fa6b00c19d66a2161c380aac9e`
- Blueprint digest: `b997d383bc5ee9b2d22c044359dd78d832dac2eb8749ba01f06c6265993bb3f3`
- Child reference: the same canonical anchor above, explicitly `canonical_anchor`
- Calls/retries/fallback: `2 / 0 / false`
- Provider-reported usage per page: text input `8`, image output `158`
- Nominal token accounting per page: `$0.004780`
- Page 3 SHA-256: `02d64209b2502c600c944c614b2413a552497d42c5d858dd4ec2020c51153d58`
- Page 4 SHA-256: `fd02e0b2a9b1c7a466be3601d81e582faf7d35dde6c178a399a73ce0549c7a42`

Total bounded proof: exactly three provider image calls, zero transport retries, no fallback, no Vision and `$0.043673` nominal token accounting. This is not an OpenAI billing/account audit.

Visual result: page 3 uses a wide low-angle arrival composition with a small attentive child; page 4 uses a closer three-quarter action composition with a surprised child. Bar's core face, curl silhouette, wardrobe, anatomy and watercolor realism remain materially consistent while expressions and camera differ. LOW-scale simplification remains possible and final product acceptance belongs to Guy.

## QA Reader verification

Manifest: `outputs/style01-auditions/r1d-dini-bar-canonical-anchor-reader/manifest.json`.

It combines retained pages 1, 2 and 5 with corrected pages 3 and 4. A local Next dev server ran on port 3181 with image generation disabled, local-only placeholder backend values and no usable provider credential.

Browser evidence from the Codex in-app browser:

- Viewer HTTP response: `200`.
- Document title: `גיבורים קטנים — ספרי ילדים אישיים`.
- Framework error overlay: absent.
- Console errors: none.
- Page 3 corrected asset: loaded, natural size `1024x1536`.
- Page 4 corrected asset: loaded, natural size `1024x1536`.
- Forward navigation: `data-page-turn-direction=forward`, computed animation `readerPageTurnForward`, duration `0.52s`.
- Backward navigation: `data-page-turn-direction=backward`, computed animation `readerPageTurnBackward`, duration `0.52s`.
- The user-facing browser is left open on the new Reader for direct product review.

## Boundaries and rollback

- No full-book or HIGH render.
- No Vision, remote database/storage, Board, approval, publication, promotion, deployment, production activation or push.
- Production remains blocked and the six ignored-fixture failures remain release-blocking.
- Local output roots are evidence only and grant no production authority.
- Rollback: revert `f014861b` to remove Reader motion independently; revert `41157b25` to restore the earlier child-reference path. Historical images and manifests remain immutable.

## Independent QA target

Claude Code should review the exact implementation range from `f508038d` through the final documentation closeout and try to falsify:

1. Raw-photo-to-anchor separation and fail-closed measurement behavior.
2. Explicit typed reference routing and Windows-safe legacy fallback.
3. Absence of story-, page- and child-specific production logic or stale identity literals.
4. Expression sanitation without stable identity/wardrobe loss.
5. Unchanged Blueprint composition authority and production anchor approval boundary.
6. All-scene forward/backward Reader animation and reduced-motion behavior.
7. Test, full-check, provider-call, retry/fallback, pricing and artifact claims.
8. Local-only QA/production-block boundaries.
