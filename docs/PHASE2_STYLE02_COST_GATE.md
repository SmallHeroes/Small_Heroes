# Phase 2 — Style 02 gpt-image-2 cost gate (numeric)

**Date:** 2026-05-25 · **Model:** `gpt-image-2` · **Size:** 1024×1536 · **Quality:** high · **API:** `images.edit` (style + identity refs)

Sources: [OpenAI API pricing](https://openai.com/api/pricing/) (token rates); industry calculator estimates for per-image equivalents ([WaveSpeed 2026 summary](https://wavespeed.ai/blog/posts/gpt-image-2-pricing-2026/)). Edit calls cost more than text-only generate because input image tokens bill at high fidelity.

## Step 0 — reference limit

Code default: `GPT_IMAGE_EDIT_MAX_REFERENCES=4` (same cap as gpt-image-1). Run `npx tsx scripts/run-phase2-style02-ref-limit-probe.ts` to empirically test 5+ refs on gpt-image-2.

## Step 1 — cost table

| Metric | Value |
|---|---|
| Cost per image (1024×1536, high, **images.edit** w/ ~4 refs) | **$0.22** (mid estimate; calculator base high portrait **$0.165** × **~1.33** edit/ref premium) |
| Projected raw image cost — 10 / 15 / 20 pages | **$2.20** / **$3.30** / **$4.40** |
| Retry multiplier assumed (reroll / failure overhead) | **1.35×** |
| Projected real image cost per book incl. retries — 10 / 15 / 20 | **$2.97** / **$4.46** / **$5.94** |
| GO / NO-GO vs ₪59 / ₪79 / ₪99 price points | **GO (test phase)** — image COGS ≈ **5–10%** of ₪59 tier at 10 pages with retries; still requires CTO margin review before production |

### Notes

- Does **not** include story LLM, storage, or cover-only extras.
- If empirical billing from probe manifests exceeds **$0.30/image**, re-run this table with measured `usage` fields.
- **NO-GO trigger:** sustained **>$0.40/image** all-in → revisit before Step 5 book test.

## Wiring gate

Cost **GO** → proceed with `PHASE2_STYLE02_BOOK_PIPELINE=true` test scripts only. **Do not** enable on live `app/api/generate/route.ts` customer path until CTO Phase 2 QA approves.
