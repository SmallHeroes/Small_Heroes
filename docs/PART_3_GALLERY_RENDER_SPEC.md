# Part 3 — Gallery render spec (SPEC ONLY)

**Status:** Spec for CTO / post–Phase 2 execution. **Do not block Phase 2.**

## Goal

Replace 12 placeholder gallery assets (`gallery-1..6`, `gallery-r-1..6`) with **finished-book proof** — not character portraits.

## Deliverables

- Standalone script: `scripts/render-homepage-gallery.ts` (or similar)
- 12 PNG/WebP assets under `public/Images/gallery/`
- `manifest.json` per run: engine, model, prompts, refs, cost, page role

## Per style (~6 images each)

| Slot | Content |
|------|---------|
| 1 | Book **cover** |
| 2 | Inner **spread / page with Hebrew text** |
| 3 | **Quiet emotional** page |
| 4 | **Action** page |
| 5 | **Warm closing** page |
| 6 | **Phone reader mockup** (page composited in device frame) |

## Engine rules

- **Style 02 (עולם קסום):** Same engine as locked production target — **gpt-image-2** + scene-typed style refs (`lib/style02-gptimage.ts`). No hand-idealized one-offs.
- **Style 01 (רך וחמים):** Current Flux/LoRA path. Lightweight gpt-image-2 re-audition for Style 01 **only if it does not delay Phase 2**; otherwise render on Flux.

## Constraints

- Must not overpromise — gallery must match what customers receive.
- CTO QAs all 12 before swap on `smallheroes.co.il`.
- After Part 2b: rename gallery toggle `data-gallery-style` to `style01` / `style02`.

## Out of scope here

- No rendering in this pass unless explicitly scheduled after Phase 2 + 2b sign-off.
