TYPE: RESULT
AUTHOR: Claude Code
DATE: 2026-06-18
RELATED: 0086 (brief — fix style/companion refs vs generation-route excludes + cleanup), 0084 (Goal A result), 0085 (consult), 0070 (deploy size-fail)

# 0088 · Style01 ref-load fix + 0083 renumber + dirty-tree report (executes 0086)

Executor = Claude Code. `npm run check` green. Commit `83a29f9f` (fix) + this roundtable commit.
**NOT merged to main; prod/domain/password untouched.** Deploy blocker (Hobby 12-function cap) is
Guy's Pro upgrade — separate.

## Validated the bug, then fixed it (file:line)
Confirmed against committed code:
- `lib/style01-gptimage.ts:419` `resolveStyle01StyleReferencePaths` → disk paths under
  `style-references/01` (`STYLE_01_REF_DIR`, line 46). **No URL fallback.**
- `lib/generate-image.ts:438` `resolveReferenceSource` → tries `existsSync(path)` then `public/<path>`,
  else returns the path; `:459` `referenceToOpenAIFile` → `existsSync ? readFileSync : fetch(resolved)`.
  In prod with `style-references` excluded, the file is absent and `resolved` is a DISK PATH (not a URL)
  → `fetch(<disk path>)` fails → Style01 style refs don't load. **Confirmed = the runtime breakage.**
- Companions are DIFFERENT: `companion.image` = `/companions/…` (public-relative) and
  `lib/image-reference-utils.ts` `resolveReferenceImageSource(src, baseUrl)` has a CDN-URL fallback
  (`getCompanionReferencePublicUrl`) when `baseUrl` is passed; `app/api/generate/route.ts:837-841`
  passes `appBaseUrl` → companions resolve to a CDN URL when absent from the bundle. So companions can
  stay excluded and load by URL (public/ is CDN-served regardless of function tracing).

## Fix (commit 83a29f9f, `next.config.js` — config only)
Chose: **bundle the narrow Style01 subset on disk (B for style) + companions by CDN URL (A for companions)**.
- `outputFileTracingIncludes` for the 5 generation routes now bundles `style-references/01/**` (~24MB) +
  `style-references/01-child-template/**` (~4MB) → `existsSync→readFileSync` works in prod.
- `outputFileTracingExcludes` for generation routes: ffmpeg/ffprobe + chromium/puppeteer (the real,
  route-specific size offenders) + `public/companions/**` (CDN-served) + Style02 (`style-references/02`,
  `style-references/style-02-locked-samples`, ~49MB, not used by Style01). Style01 is NOT excluded.
- Lean (payment/webhook) + dev/story-bank routes: unchanged (drop everything heavy; they don't render).
- Net per generation function: ~24MB Style01 + 12MB story-bank + node code (no ffmpeg/chromium/companions)
  → well under 250MB, and smaller than the broken-but-deployable variant that bundled full assets.

## ⚠️ Proof requires a CLOUD render (cannot be validated here)
`npm run check` is green but CANNOT catch this — local dev always has the files on disk. The bundle/runtime
behavior only shows in the cloud. **After Pro is active and the preview deploys READY, run a REAL render
against the PREVIEW (one slot, ~2 pages)** and confirm: (a) no `existsSync→fetch` error for style/companion
refs, (b) the image actually uses the Style01 watercolor style + the correct companion. I will run that
render-test once the preview is READY (Pro pending).

## Cleanup
- **0083 duplicate renumbered:** `0083_claude_scene-time-wardrobe-and-crowd.md` → `0087_…` (git mv).
  `0083` now uniquely = the Goal-A brief (`0083_claude_prod-refresh-goal-a.md`). Committed the previously
  untracked roundtable history: `0083` (brief), `0085` (consult), `0086` (brief). INDEX updated for
  0083/0085/0086/0087/0088.
- **Unrelated dirty worktree — REPORTED, not touched** (it is NOT this track; it's the v5-supersession /
  power-cards WIP — see 0082/0084). Tracked-modified: `backend/providers/story-bank-index.ts`,
  `lib/power-cards/{index.ts,shelf.ts}`, `lib/power-cards/__tests__/power-card-parse.spec.ts`,
  `lib/__tests__/{power-card-gender-slash,production-qa-escape-hatches,v3-approved-bank}.spec.ts`,
  `ai-roundtable/0059_*` (appended by another author). Untracked: `story-pipeline/02_prompts/drafts/*`,
  `story-pipeline/04..06_*`. I did NOT stash/commit these — they belong to their owner (Cursor). To keep
  the tree clean for the cutover, the owner should commit them to their track (or say the word and I'll
  `git stash push -- <those paths>` — recoverable). They must not ride along in the merge→main.

## Sequence status (0086)
Pro active (Guy) → **this style-refs fix DONE** + **cleanup DONE** → preview deploys READY (pending Pro)
→ **CLOUD render-test in preview (I run it)** → cutover review → merge→main. All gated; not done here.
`npm run check` green; commit per step; explicit pathspecs.
