# Cursor Brief — Image Consistency Sprint, Experiment 1

**Owner:** CTO · **Status:** ready for Cursor · **Depends on:** `docs/IMAGE_CONSISTENCY_AUDIT.md`
**Goal:** answer ONE question fast — with real photo conditioning (Path A), does the child look like the child and Bolly look like one Bolly across a whole book, and is the composition tradeoff tolerable for a pilot?

---

## 0. Context & decision

The launch blocker is image character-consistency, not text (`docs/LAUNCH_READINESS_AUDIT.md`). The image audit found: the live Flux path conditions the child only via a text description; the gpt-image-1 `images.edit` face-conditioning path is fully built but dormant; Bolly has no visual anchor; the "resemblance" score is an RGB colour histogram, not face similarity.

**Decision:** Experiment 1 runs **Path A — gpt-image-1 `images.edit`** (`IMAGE_PROVIDER=gpt-image`). This is an *experiment* to answer the identity question quickly — NOT a permanent provider commitment. If Path A's composition weakness proves intolerable, the fallback is to test Flux face-transfer.

**This is a measurement, not a migration.** Do NOT delete or rewrite the Flux path. Do NOT touch the recipe pipeline, the story bank, or text generation. Image work only.

---

## Phase 1 — Experiment 1: setup & run

### 1.1 — Canonical Bolly reference image  *(CTO selects; Cursor plumbs)*
Bolly has no visual anchor — not even an entry in `lib/companions.ts`. Establish ONE canonical reference:
- First check the repo for existing usable Bolly art (cover assets, wizard assets, prior renders).
- If none is clean enough, generate 3–5 Bolly candidates (armadillo companion, the book's illustration style, neutral pose, plain background, no text) — the CTO picks one.
- Store the chosen image as a fixed asset with a stable path/URL. Add a `bolly` entry to `lib/companions.ts` carrying that reference URL. This image is the single source of truth for Bolly's look.

### 1.2 — Wire both references into the gpt-image path  *(Cursor)*
`images.edit` (`generate-image.ts:285`, `generateGPTImage`) accepts up to 4 image inputs. Ensure every page request passes **both**: the child's photo AND the canonical Bolly reference. If the path currently wires only the child photo, extend it to a 2-reference array. Confirm `IMAGE_PROVIDER=gpt-image` activates this path (`image.ts:2199`).

### 1.3 — Fixed test child  *(CTO supplies)*
One fixed test child photo, reused unchanged on every run so iterations are comparable. Use a stock / synthetic / properly-consented test face — not a scraped image.

### 1.4 — Run the Bedtime test book  *(Cursor runs, CTO observes)*
Generate one full **Bedtime** book (~10 pages) with `IMAGE_PROVIDER=gpt-image`, the fixed test child, and the Bolly reference. Bedtime first because it is short and same-setting — it isolates the consistency mechanism. (Cost ~$3/book on gpt-image-1 — negligible for the experiment.)

### 1.5 — Human QA against the pass bar  *(CTO)*
Page by page, a person viewing the 10 pages cold judges:
1. Same child on every page?
2. Same Bolly on every page?
3. Does each scene match its page text?
4. Any Hebrew/text rendered inside an image?
5. **Composition honesty check** — how bad is the gpt-image framing/sameness weakness, really? Tolerable for a pilot, or a dealbreaker?

---

## Phase 2 — Adventure stress test  *(only if Phase 1 passes)*

Same setup, the **Adventure** book — varied scenes (clinic, street, indoors). Same-setting Bedtime consistency is the easy 80%; Adventure is the real proof. Do NOT declare image consistency solved on Bedtime alone.

---

## Phase 3 — Real face-similarity QA + regenerate gate  *(only after Phases 1–2 prove Path A)*

Do not build this before the visual tests prove Path A works — there is no point building a QA instrument for a path that failed.
- **Replace the resemblance metric.** `buildEmbedding` (`resemblance-core.ts:268`) is a 48-value RGB colour histogram — it does not measure faces. Replace it with a real face-recognition embedding (face detection + face embedding; cosine similarity on the face vector).
- **Then gate + regenerate.** In the page monitor (`image.ts:3491-3531`) — which today only logs — compare the face-similarity score to a threshold; on fail, regenerate (new seed, 2–3 attempts, keep the best).
- This is what makes a real "safety mode" QA possible.

---

## Do NOT

- Do NOT build a regenerate gate on the current `resemblance-core` RGB histogram — it would regenerate books by shirt colour.
- Do NOT rely on a text prompt alone for Bolly — it must have the reference image.
- Do NOT treat the LoRA as a consistency solution — it is unverified as live; out of scope here.
- Do NOT delete or rewrite the Flux path — Path A is an experiment; the fallback must stay intact.
- Do NOT touch the recipe pipeline, story bank, or text generation.
- Do NOT declare success on Bedtime alone.

---

## Decision points

- **After Phase 1:** child identity held AND composition tolerable → Phase 2. Identity held but composition intolerable → STOP, report; CTO decides Path-A-with-composition-fixes vs testing Flux face-transfer. Identity failed → STOP, report; Path A is not the answer.
- **After Phase 2:** holds across varied scenes → Phase 3.

---

## Definition of done (Experiment 1)

An `IMAGE_PROVIDER=gpt-image` Bedtime book exists with: a canonical Bolly reference wired as a second `images.edit` input, the fixed test child, 10 rendered pages, and a CTO human-QA verdict against the 5-point pass bar — including an honest read on the composition tradeoff. That verdict decides whether the sprint proceeds to Adventure.
