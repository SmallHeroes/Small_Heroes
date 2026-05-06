# Small Heroes — Project Handoff Document

> Hand this to a new Claude conversation so context is preserved.
> Last updated: end of phase 3d.3.

---

## 1. The Product

**Small Heroes** is a Hebrew personalized children's book product. The user (Guy, working solo, working locally — no remote git) generates 8-page illustrated picture books for individual children. Each book is generated end-to-end:

1. Wizard collects child info (name, age, gender, photo, traits, story topic)
2. LLM generates story directions (3 archetype cards) → user picks one
3. LLM generates story prose (Hebrew, 8 pages)
4. Image generator (Flux) renders 8 page illustrations + 1 cover
5. Reader displays the book at `/book/[id]/read-v2`

The product goal: **a generated book that feels like a real published children's book**, not an AI demo. Picture-book quality art, character consistency across pages, story-driven illustrations, real book layout.

## 2. The User

- Working **solo**, **locally only**, no team, no remote git push (origin was removed early).
- Strong product/design intuition. Frustrated by iteration on bad output. Wants forward momentum.
- Communicates in Hebrew + English mix. **Prefers fully English responses from Claude** — RTL+LTR mixing is hard to read.
- Delegates code work to Cursor agents. Claude's job: strategy, briefs, code review, hand-holding through commits/tests.
- Local Windows machine. Uses PowerShell. Project at `C:\GNart\Work\Small_Heroes`.

## 3. Initial Strategic Diagnosis

When the user asked Claude to lead, Claude identified two architectural sins:

1. **Visual decisions happen too late.** All creative decisions (shot, composition, action, mood, text zone) are deferred to image-generation time. Real picture books design top-down: story → storyboard → character bible → final art → typeset spreads.

2. **Atomic unit was "image + text in container," not "spread."** Reader treated each page as image-card + text-block, producing UI/CMS feeling, not book feeling.

Plus several technical issues uncovered during recon:
- Two prompt paths coexisted (`buildImagePrompt` legacy + `composeVisualDirectorPrompt` newer), gated by `USE_VISUAL_DIRECTOR` env flag (default false → legacy was running in production).
- Post-processing (`lib/illustrationPresentation.ts`) was running unconditionally despite user thinking it was disabled.
- Dev mode used `bytedance/sdxl-lightning-4step` (a fast preview model), NOT Flux. Every dev-generated book was SDXL output the user thought was Flux.
- Character lock had a copy-paste bug where Hair field used the same fallback as Age impression.
- Visual Director's `stage4Prompt` was being polluted with the full STYLE LOCK block instead of per-page scene notes.
- The "phantom" `PageVisualStoryboard` type turned out to actually be wired up (Stage D works) — it's just not effective on its own.
- Direction-preview images were portrait, but card slot is square.
- Final prompt was ~5000 characters with massive redundancy (4 ways of saying "no text", 4 ways of saying "keep character consistent", style block twice, character lock first, scene description buried).

## 4. Phases Completed (in order, with commits)

### Phase 1 — Cleanup + Diagnostic (no behavior change)
**Commit:** `8921b648` (originally `0abf489c` before author rename)

Changes:
- Added `[image_pipeline_path]` log per image generation showing path (legacy/visual_director), postProcess status, styleId, model.
- Added `ENABLE_PRESENTATION_POSTPROCESS` env flag (default `"true"` preserves behavior).
- Added `GET /api/debug/image-prompt/[orderId]?page=N` endpoint that returns stored prompt + URLs.
- Added doc comment blocks at top of `backend/providers/image.ts` and `lib/styles.ts` explaining dual-path situation.
- Deleted root junk: `tmp_storyboard_run.json`, `story-output.json`.

Files: `.env.example`, `lib/styles.ts`, `app/api/generate/route.ts`, `backend/providers/image.ts`, new `app/api/debug/image-prompt/[orderId]/route.ts`.

### Phase 2 — Style A/B Experiment Script
**Commit:** `phase 2: style A/B experiment script`

- Created `scripts/style-experiment.ts` — standalone read-only DB script.
- Auto-selects an existing order, renders the same 4 pages under 2×2 matrix (2 styles × 2 prompt variants: `current` vs `minimalist_v1`).
- Outputs to `experiments/style-test/<orderId>/<timestamp>/` with manifest.json + side-by-side index.html.
- **Result:** 16/16 succeeded. Minimalist prompt (~970 chars) showed sharper style separation than current (~7300 chars), but neither hit the target aesthetic. **Diagnosis confirmed: prompt-only is exhausted; LoRA needed for style fidelity.**

Files: `scripts/style-experiment.ts`, `.gitignore` (added `experiments/style-test/`).

### Phase 3a — Dev model + prompt bugs
**Commit:** `c4e6e057` (`phase 3a: switch dev model to flux-dev + fix character lock and visual director input bugs`)

T1: `REPLICATE_IMAGE_MODEL_DEVELOPMENT` default switched from `bytedance/sdxl-lightning-4step` to `black-forest-labs/flux-dev`. (User had to manually update `.env.local` separately.)

T2: `MAIN CHARACTER LOCK` builder fixed — Hair/Skin/Face/Eyes/Clothing each get field-specific fallback instead of the age fallback. New `[character_lock_resolved]` log shows which fields have real data.

T3: Visual director `stage4Prompt` now receives `page.imagePrompt ?? ''` instead of the polluted `storyboardPrompt`. New `[visual_director_inputs]` log.

Files: `lib/replicate.ts`, `.env.example`, `backend/providers/image.ts`.

### Phase 3a.2 — Prompt cleanup
**Commit:** `phase 3a.2: prompt cleanup — action-beat override, strip PROMPT_CONTRACT, reorder final prompt`

T1: Action-beat heuristic override. If page text contains action verbs (Hebrew + English regex list), composition fields are overridden to `type=action_page, focus=action, background=full, pageTemplate=art_top_text_bottom`. Shorts out Stage 4B's bad calls without rewriting it. New `[composition_override]` log.

T2: Stripper for `PROMPT_CONTRACT_PAGE_N: CRITICAL_IMAGE_RULE: ...` boilerplate. Strips ~4127 chars → 0 in polluted cases. New `[image_prompt_stripped]` log.

T3: Final prompt reordered — style sentence first, character lock condensed and moved later, MAIN CHARACTER LOCK no longer dominates token-anchoring.

Files: `backend/providers/image.ts` only.

**Known issue**: T2 over-strips. When `page.imagePrompt` is fully polluted with no scene tail, output is empty. Action-beat override (T1) compensates partially. Real fix is upstream in `pipeline.ts` (deferred to Phase 3e).

### Phase 3d — Real book layout
**Commit:** `phase 3d: real book layout`

Wired up four layout templates that the data layer already provides (`pageTemplate` field):
- `full_bleed_overlay` — image fills page, text overlays in storyboard's `textZone` with gradient
- `art_top_text_bottom` — image bleeds top/sides, fades into paper at bottom, text on paper
- `character_vignette_text` — soft-edged vignette image, text in white space
- `text_only` — paper page, typographic focus

Heebo font loaded via `next/font/google`. Cover treatment: full-bleed image + title overlay. Page chrome reduced to small footer.

T3: `textZoneDirective` added to image prompt — "Leave the [zone] visually quiet, suitable for text overlay."

Files: `app/book/[id]/read-v2/reader-v2.tsx`, `app/book/[id]/read-v2/reader-v2.module.css`, `app/layout.tsx`, `backend/providers/image.ts`.

### Phase 3d.2 — Collapse to single overlay layout
**Commit:** `phase 3d.2: collapse interior pages to full-bleed overlay`

Per user direction: every interior page now renders as **full-bleed image with text overlay**. The `art_top_text_bottom` paper band approach was removed. The `character_vignette_text` paper section was removed. One consistent layout for all interior pages.

Typography: Heebo 20px line-height 1.6.

Stronger `textZoneDirective`:
- "CRITICAL TEXT OVERLAY ZONE" framing
- Scales 25% / 40% of frame by text length (>120 chars → 40%)
- Names allowed content (sky, plain wall, fog, water, snow, grass, haze)
- Names forbidden content (faces, hands, intricate patterns, written text)

Files: same as 3d.

### Phase 3d.3 — Polish (last commit)
**Commit:** `phase 3d.3: polish — dark overlay text, side padding, Arimo fallback, cover style alignment, story length 25-55 words`

T1: Overlay text now `#2a241a` (dark) with no shadow. Existing dark gradient behind text replaced with subtle paper-fade or removed entirely.

T2: 32px horizontal padding on overlay text shell.

T3: Arimo loaded as fallback via `next/font/google`. Font stack: `var(--font-heebo), var(--font-arimo), 'Heebo', 'Arimo', sans-serif`.

T4: **Cover style alignment.** Cursor's investigation found that `generateBookCover` in `app/api/generate/route.ts` was NOT passing `heroVisualLock`, `styleLock`, `entityVisualLock` to the cover image input — interior pages received them but covers didn't. Plus `buildCoverPrompt` used "Premium published / cinematic / iconic focal point" language pushing the model toward poster-style. Both fixed: route now passes all three locks to `generateBookCover`; `buildCoverPrompt` rewritten to align with interior style. New `[cover_style_alignment]` log.

T5: Story page word target reduced from **40–80 → 25–55** Hebrew words. Constants in `pipeline.ts`: `PAGE_HEBREW_WORDS_MIN=25`, `PAGE_HEBREW_WORDS_MAX=55`. All prose stage prompts and quality thresholds updated.

Files: `app/book/[id]/read-v2/reader-v2.module.css`, `app/book/[id]/read-v2/reader-v2.tsx`, `app/layout.tsx`, `backend/providers/image.ts`, `app/api/generate/route.ts`, `backend/providers/pipeline.ts`.

**Known limitation flagged by Cursor**: 3D only EXPANDS short pages. No automatic trim for pages > 55 words. Long pages rely on 3B/3C obeying the new band.

## 5. Phases Pending (in priority order)

### Phase 3e — Prompt builder rebuild ⭐ MOST IMPORTANT NEXT STEP
**Brief: not yet written. About to start drafting when conversation paused.**

This is the deepest fix. Solves character inconsistency, story-image disconnect, and the 5000-char prompt absurdity in one shot.

Scope:
1. **Throw out `buildImagePrompt`** (legacy) and the multiple overlapping rule blocks (MANDATORY RENDER CONSTRAINTS, CHARACTER_CONSISTENCY_GUIDELINE, STRONG CHILD RESEMBLANCE GUIDANCE, SUPPORTING_CHARACTER_GUIDANCE, CRITICAL TEXT EXCLUSION RULE — all redundant). Replace with one clean prompt builder. Target: ~400 chars per page.

2. **English scene description per page.** Add a small upstream LLM call: Hebrew page text + character data + story context → 2-sentence English scene paragraph. This becomes the actual scene Flux sees, instead of relying on Flux to parse Hebrew (which it can't).

3. **Real character lock from wizard data.** Currently lock has generic placeholders ("natural age-appropriate hair"). Thread the wizard's structured data: name, gender, age band, uploaded photo URL, defined traits, hair description, clothing description. Use the uploaded photo as the IP-Adapter / reference image. Use real text descriptions in the lock.

4. **Fix `PROMPT_CONTRACT` origin in `pipeline.ts`.** Today the pipeline emits `PROMPT_CONTRACT_PAGE_N: CRITICAL_IMAGE_RULE: ...` boilerplate INTO `page.imagePrompt`. Stop. The contract should be applied at prompt-build time, not stuffed into per-page data.

5. **Cover prompt rebuild.** Even after 3d.3's alignment, the cover prompt has its own composition logic. May need further unification.

Expected impact: this is what makes Yuval the same kid across all 8 pages, and what makes the images actually depict the story.

### Phase 3c.1 — Square direction previews
**Brief written: `phase-3c-1-square-direction-previews.md`. Not sent to Cursor yet.**

Direction-preview images render at 1024×1024 (square / aspect_ratio "1:1") so they fit the wizard's three-card chooser slot without cropping. Book pages and cover keep portrait dimensions. Small targeted change.

### Phase 3c — Three-cards differentiation + new "magic" archetype
**Brief: not written.**

User's product call: replace `courage` archetype with `magic` (magical world, no rules, flying elephants, singing chicks). Card vibes:
- Right (1st in RTL): רגוע / לפני שינה (Calm / before sleep) — `connection`
- Middle: מסע של הרפתקאה (Adventure journey) — `adventure`
- Left: מקום קסום (Magical place) — `magic` (replaces `courage`)

Each card needs:
- Distinct title + description (Hebrew, user will write)
- Distinct preview image style/palette signal
- Distinct story-tone in the LLM prompts per archetype

Touches: wizard copy, story-direction generation prompts, story prose generation prompts (per archetype tone tag).

### Phase 3b — LoRA training
**Brief: not written. References ready.**

User collected reference packs:
- `Refs/Styles/Style_01/` — 42 images. **Direction: French colored-pencil + pastel** (Sébastien Pelon / Albertine adjacent). NOT Genevieve Godbout as Claude initially recommended — user picked something else.
- `Refs/Styles/Style_02/` — 36 images. **Direction: Freya Blackwood** (loose ink + watercolor wash on cream paper). NOT Jim Field as Claude initially recommended — user picked something else.

Plan:
- Script: `scripts/train-style-lora.ts`. CLI args: `--style <id> --refs <folder>`.
- Reads images, normalizes (resize, format), zips, uploads to Replicate, trains via `ostris/flux-dev-lora-trainer`, polls, saves config.
- Trigger words: `s1style` / `s2style` (unique tokens, not English words).
- Output: `assets/styles/lora-config.json` with `{ styleId: { loraModelUrl, triggerWord, trainedAt, imageCount } }`.
- Cost: ~$3-5 per LoRA × 2 = ~$8 total. Runtime: ~30-45 min per LoRA.

Then production integration (3b.4):
- Update `lib/styles.ts` style configs to include `loraUrl` + `loraWeight` + `triggerWord`.
- Update image gen call to load LoRA per book.
- Behind feature flag for canary.

Legal note flagged: training on copyrighted picture-book scans is gray-area for commercial. OK for internal R&D / architecture validation. Before commercial launch, migrate to public-domain / commissioned / properly-licensed reference imagery.

### Phase 3d.4 (later) — Layout variations
**Deferred per user.**

Currently all interior pages = full-bleed overlay. User explicitly said: get one layout right first, then add variations. Future variations:
- Hero pages (image fills 100%, no text or short caption only)
- Image-dominant pages
- Asymmetric spreads
- Spot illustrations with text dominating

A note comment was added in `reader-v2.tsx` documenting this is intentional uniformity, not oversight.

### Open small items
- **`textZone` not on orders API.** Reader defaults to `bottom_clear` regardless of storyboard's choice. The data is stored per-page on the storyboard but not surfaced via `GET /api/orders/[orderId]`. Small follow-up needed eventually.
- **`USE_VISUAL_DIRECTOR` flag.** Both prompt paths still coexist. Phase 3e implicitly resolves this (the rebuild replaces the old builder entirely).
- **DB enum has 3 styles.** Active are 2 (`soft_hand_drawn_storybook`, `expressive_painterly_storybook`). Legacy `realistic_illustrated` mapped to soft_hand_drawn. Not blocking.
- **`LEGACY_STYLE_INPUT_MAP`** has 30+ aliases. Cleanup deferred.
- **tsconfig deprecation** TS5101 (baseUrl) — pre-existing, blocks `tsc --noEmit` but not `npm run build`. Cursor flags this as NO-GO every time but it's a pre-existing issue, not from any of our work.
- **38+ unrelated uncommitted files** in working tree (predate this work). User aware. Each phase commit explicitly stages only the phase's files.
- **Backups.** Local-only, no remote. User aware, deferred — when ready, options: GitHub private repo, git bundle to cloud storage, or workspace folder backup.

## 6. Architectural state

### Active configuration
- **Image model dev**: `black-forest-labs/flux-dev` (was SDXL Lightning before phase 3a)
- **Image model prod**: `black-forest-labs/flux-2-pro` (unchanged)
- **`USE_VISUAL_DIRECTOR`**: default `"false"` in `.env.example`, but user's `.env.local` may have it set to true. Either way, both paths still exist.
- **`ENABLE_PRESENTATION_POSTPROCESS`**: default `"true"` but **user has it set to `"false"` in `.env.local`** (added during phase 3d.2 testing).
- **Active styles**: `soft_hand_drawn_storybook`, `expressive_painterly_storybook`.
- **Active archetypes**: `connection`, `adventure`, `courage` (will become `magic` in 3c).

### Key files (where things live)

**Backend / generation:**
- `backend/providers/image.ts` — image generation orchestration, prompt assembly, character lock, cover generation. ~2200+ lines, the biggest file.
- `backend/providers/pipeline.ts` — story generation pipeline (Stage 1 StoryBrain, Stage 2 PageOutline, Stage 3 Prose A-D, Stage 4 VisualBible/Composition/Shots). Contains `PROMPT_CONTRACT` pollution origin.
- `backend/providers/story.ts` — core story generation.
- `backend/providers/story-directions.ts` — three-card direction generation.
- `backend/schema.prisma` — DB schema. `Order`, `BookPage`, `ImageAsset`, `StoryDirection`, `StoryDirectionSet`, `ResemblanceAudit`, etc.

**Lib:**
- `lib/styles.ts` — style registry, `STYLE_REGISTRY`, normalizers. Has the doc comment block from phase 1.
- `lib/replicate.ts` — model resolution, `resolveReplicateImageModel`, `resolveReplicateDevelopmentModel`.
- `lib/promptBuilder.ts` — legacy `buildImagePrompt`. Phase 3e will retire this.
- `lib/visualDirector.ts` — newer `composeVisualDirectorPrompt`.
- `lib/character-lock.ts` — character consistency block builder.
- `lib/illustrationPresentation.ts` — post-processing (smart crop + paper fade integration). Off by env flag.
- `lib/bookPageLayout.ts` — `assignLayoutsForBook`, `assignTemplatesForBook`. Sophisticated rhythm logic.
- `lib/generate-image.ts` — `generateReplicateImage`. The actual Replicate call.
- `lib/resemblance-core.ts` — embedding-based resemblance scoring (used for character monitoring, has its own `ResemblanceAudit` table).

**App:**
- `app/book/[id]/read-v2/reader-v2.tsx` — reader React component.
- `app/book/[id]/read-v2/reader-v2.module.css` — reader styles.
- `app/layout.tsx` — root layout, fonts (Heebo + Arimo via next/font/google).
- `app/api/generate/route.ts` — main generation orchestration. Calls `generateBookCover`, `generateAllPageImages`, etc.
- `app/api/orders/[orderId]/route.ts` — orders API (returns book data to reader).
- `app/api/debug/image-prompt/[orderId]/route.ts` — phase 1 debug endpoint.

**Scripts:**
- `scripts/style-experiment.ts` — phase 2 experiment script.

**Reference assets (user-provided):**
- `Refs/Styles/Style_01/` — 42 reference images for soft hand-drawn storybook style.
- `Refs/Styles/Style_02/` — 36 reference images for expressive painterly style.

### Workflow conventions established with the user

1. **Phase-based development.** Each phase: write a markdown brief → user pastes into Cursor → Cursor reports back → Claude reviews → user commits with structured message. Phase briefs live at root: `phase-X-Y-name.md`.

2. **Targeted commits, never blanket.** User has 38+ unrelated uncommitted files in working tree. Every commit stages only the files touched by the phase. Use `git diff --cached --stat` to verify before committing.

3. **Commit message format:**
   ```
   phase X[.Y]: <short subject>
   
   <2-3 line body explaining what each Tn delivered>
   ```

4. **Local only.** No `git push`. The "remote" was removed early because user has no permissions on the only remote that existed (`SmallHeroes/Small_Heroes` belongs to a different account `NamasteBabaG`). Backups deferred.

5. **No emoji unless user uses them.** Doesn't apply here, just noting.

6. **English-only responses.** User asked Claude to stop mixing Hebrew and English mid-paragraph because the RTL+LTR rendering breaks. Hebrew product terms / quotes from logs are fine inline.

7. **Brief structure.** Each phase brief follows the same pattern: Principle, Goal, Scope (in/out), Tasks (T1, T2, ...), Safety, Acceptance criteria, Return format.

### Cursor working notes
- Cursor reports return GO / NO-GO + Files changed + per-task locations + sample logs + risks. Phase 3a.2 once crashed mid-edit (truncated `image.ts`); workaround was to do diff inspection and confirm the file was actually intact (sandbox sync issue, not a real truncation).
- `tsc --noEmit` always returns NO-GO due to pre-existing TS5101 (`baseUrl` deprecated in tsconfig.json). Treat that NO-GO as informational. `npm run build` passing is the real gate.

## 7. Visual state of output (as of last test, phase 3d.2)

What was working:
- Pages no longer rendered as character sheets (3a fixed)
- Most pages had a real environment scene (3a.2 helped)
- One layout treatment across the book (3d.2)
- Cover had title overlay

What was still broken (phase 3e will fix):
- Character not consistent — different child every page
- All pages set in same generic location (forest), regardless of story
- Cover style sometimes mismatched (3d.3 should fix)
- Story still too long for overlay zone (3d.3 lowered to 25-55 words)
- Some style inconsistency between pages (LoRA in 3b will fix)
- Text appeared white-on-cream sometimes (3d.3 fixed)

Phase 3d.3 was just committed; user is about to test it. The next step is **send 3c.1 and start drafting 3e**.

## 8. Recommended order from here

1. **User tests phase 3d.3** (generates one new book, verifies cover matches interior style, verifies story is shorter, verifies dark text on cream backgrounds).
2. **Send phase 3c.1 to Cursor** (square direction previews — small, written brief ready at `phase-3c-1-square-direction-previews.md`).
3. **Write and send phase 3e brief** — the prompt-builder rebuild. This is the highest-impact remaining work. Will fix character consistency, story disconnect, and the 5000-char prompt all at once.
4. **Commit 3e, test one book.** Expectation: same child across all 8 pages, scene matches each page's narrative beat.
5. **Phase 3b — LoRA training.** References are ready in `Refs/Styles/Style_01` and `Refs/Styles/Style_02`. Brief not written yet. Cost ~$8, runtime ~1 hour.
6. **Phase 3b.4 — production integration of LoRAs.** Behind feature flag. Update `lib/styles.ts` configs.
7. **Phase 3c — three-cards differentiation + magic archetype.** Wizard copy + per-archetype story prompts.
8. **Phase 3d.4 — layout variations** (hero pages, image-dominant, asymmetric spreads). Once base is locked.
9. **Cleanup phases:** consolidate prompt paths (retire `buildImagePrompt` formally), cleanup `LEGACY_STYLE_INPUT_MAP`, fix tsconfig deprecation, surface `textZone` in orders API.

## 9. Files in workspace (reference docs)

- `PROJECT_HANDOFF.md` (this file)
- `phase-1-cleanup-diagnostic.md`
- `phase-2-style-experiment.md`
- `phase-2-style-experiment-fix.md`
- `phase-3a-fix-dev-model-and-prompt-bugs.md`
- `phase-3a-2-prompt-cleanup.md`
- `phase-3c-1-square-direction-previews.md` (written, not yet sent to Cursor)
- `phase-3d-real-book-layout.md`
- `phase-3d-2-overlay-everywhere.md`
- `phase-3d-3-polish.md`
- `stage-d-storyboard-prompt.md` (early phase, mostly historical)

These can be moved to `docs/phases/` later for organization, but currently sit at root.
