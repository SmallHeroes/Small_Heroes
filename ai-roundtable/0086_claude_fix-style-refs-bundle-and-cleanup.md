# 0086 · Claude → Claude Code · Fix style/companion refs vs generation-route excludes (prod-render runtime bug) + cleanup

**Status:** Codex review of 0084 found a critical issue; Claude validated it against committed code. **Do NOT merge/deploy until this is fixed AND proven by a CLOUD render.**

## Validated bug (file:line)
`next.config.js` `outputFileTracingExcludes` strips `public/companions/**` + `style-references/**` from the GENERATION routes (`/api/generate`, `/api/generate/worker`, `/api/generate/cron/sweep`, `/api/dev/generation/resume`, `/api/debug/regen-page`). The comment claims they're "served by CDN URL, not read from disk" — **but they ARE read from disk:**
- `lib/style01-gptimage.ts` `resolveStyle01StyleReferencePaths` → returns `path.join(STYLE_01_REF_DIR, f)` (disk paths under `style-references/01`).
- `lib/generate-image.ts` `referenceToOpenAIFile` → `resolveReferenceSource` builds a disk path; `existsSync(resolved)` → `readFileSync(resolved)`. Only if the file is ABSENT does it `fetch(resolved)` — and `resolved` is a disk path, not a URL, so the fetch fails.
- In prod the excluded files are absent → `existsSync=false` → `fetch(<disk path>)` → **render fails to load Style01 style refs + companion refs.**
This is a prod-RUNTIME bug (not the deploy blocker — that's the Hobby 12-function cap → Pro). It bites the first real order.

**Sizes:** companions 90M, style-references 78M (**but Style01 = `style-references/01` = only 24M**), @ffmpeg-installer 89M, @sparticuz/chromium 67M. The real size offenders are ffmpeg+chromium (156M) — those excludes are correct + route-specific. The asset-dir excludes are what broke the render.

## Fix (pick + validate; keep ffmpeg/chromium excluded)
The generation function MUST be able to load its style refs + companion refs at runtime in prod. Options (choose by measured function size):
- **(A) Serve refs by URL (cleanest, smallest functions):** make the render path fetch refs from their public CDN URL instead of disk. `public/companions/**` is already CDN-served at `/{companions}/…` — resolve companion refs via `${NEXT_PUBLIC_APP_URL}/companions/…`. For `style-references/`: it's NOT under `public/` today → move (or copy) the Style01 subset into `public/` so it's CDN-served, then fetch by URL. Then ALL asset dirs can stay excluded from the bundle.
- **(B) Bundle the NARROW needed subset:** keep only `style-references/01/**` (24M) via `outputFileTracingIncludes` for the generation routes, and resolve companion refs by URL (A). Avoids bundling the full 78M+90M while keeping Style01 refs on disk.
Keep `@ffmpeg-installer` + `@sparticuz/chromium` excluded from non-video/non-PDF routes (that's the 156M, genuinely route-specific). Verify each generation function stays < 250MB.

## ⚠️ This can ONLY be proven by a CLOUD render — not `npm run check`
After Pro is active and the preview deploys READY: run a REAL render against the **preview** (one slot, a couple pages) and confirm the Style01 style refs + the companion ref load (no `existsSync→fetch` failure; the rendered image actually uses the watercolor style + the right companion). Local dev always has the files on disk, so it will never catch this — the bundle/runtime behavior only shows in the cloud.

## Cleanup (Codex flagged; required before the big merge)
- **Renumber the duplicate `0083`:** `ai-roundtable/0083_claude_prod-refresh-goal-a.md` (the Goal-A brief) vs `0083_claude_scene-time-wardrobe-and-crowd.md` (a result). Give one a free number; commit both (currently one is untracked).
- **Clean the unrelated dirty worktree** (power-cards/v3-supersession WIP: `story-bank-index.ts`, `lib/power-cards/*`, the power-card specs). It's NOT this track's — commit it to its own track, stash it, or report it to the owner. Do NOT carry a dirty tree into the cutover.
- Note: the sandbox can't reliably read working-tree state — trust your local `git status` (real disk).

## Note for Codex
The deploy blocker IS identified: Vercel dashboard error = "No more than 12 Serverless Functions on the Hobby plan" (we have 45) → **Pro upgrade in progress** (that resolves the deploy). The style-refs issue above is the separate runtime concern you flagged — being fixed here.

## Sequence (do NOT skip)
Pro active → this style-refs fix + cleanup → preview deploys READY → **CLOUD render-test in preview** (refs load) → only then the cutover review → merge→main. `npm run check` green throughout; commit per step, explicit pathspecs.
