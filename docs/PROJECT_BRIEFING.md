# Small Heroes — Full Project Briefing for the Strategic Consultant

*Snapshot as of 2026-05-25. Prepared by the CTO for the project's strategic advisor.*

---

## How to use this document

You are **Small Heroes' strategic consultant** — the founder consults you on architecture, product, and business decisions. This briefing brings you fully current: what the product is, how it is built, the state of every part of it, the decisions already locked, and the decisions ahead. Where something is genuinely unresolved it is marked **OPEN QUESTION** — those are where your advice matters most.

**Who's who.** Guy — founder, product owner, final decision-maker. The CTO/product lead — owns architecture, breaks work into phases, writes implementation briefs, QAs output. Cursor — the implementing engineer (an AI coding agent that writes and edits the actual code). You (ChatGPT) — strategic advisor consulted on most decisions.

---

## 1. Product & Vision

Small Heroes generates **personalized children's storybooks in Hebrew**. A parent completes a short wizard (child's name, age, gender, photo, and a theme or situation), and the system produces a complete illustrated picture book — story text + one illustration per page + a cover — read in a web-based reader, with optional narration, a video version, and a print-ready PDF.

The product is built around **emotional and resilience themes** — bedtime fears, medical procedures, a new sibling, transitions, social situations, anger, sensitivity, focus, and so on. Every book pairs the child with an animal **companion** who models a coping mechanism. The north star: a book that feels like a **real, premium, printed children's book** — high emotional quality, visually consistent, delightful, and simple to buy.

The business is direct-to-consumer, **Israel-first** (Hebrew language, ₪ pricing, Israeli payment provider). The strategic goal is to turn the current working prototype into a genuinely sellable product.

**The founder's stated priority order:** (1) pipeline integrity — clean data flow from wizard input through prompts to images; (2) upgrade the reader into a real book layout; (3) image quality and visual consistency; (4) wizard/UX polish.

---

## 2. Tech Stack & Architecture

- **Frontend:** Next.js (App Router) plus a set of static HTML pages (`wizard`, `generating`, `ready`, `reader`).
- **Backend:** Next.js API routes, with heavy logic in `backend/providers/`.
- **Database:** Supabase (PostgreSQL, accessed via Prisma).
- **Image generation:** historically Replicate / Flux; **as of today, Style 02 is locked on OpenAI's gpt-image-2** (see §6).
- **LLM (story + prompts):** OpenAI GPT-5 family (and Anthropic models are wired as an alternative provider). Note: gpt-5.x models must be called via OpenAI's `/v1/responses` API — the older chat-completions endpoint silently fails for them.
- **Payments:** PayMe (Israel); Stripe exists as legacy.
- **Repo & environment:** GitHub `SmallHeroes/Small_Heroes`, branch `main`. Development is on Windows, in the Cursor IDE. Project root `C:\GNart\Work\Small_Heroes`.

**End-to-end flow:** Wizard → order created → (optional) 3 story-direction cards shown, user picks one → story text assembled → page layouts assigned → cover + per-page illustrations generated → optional audio → book served in the reader at `/book/[id]/read-v2`.

---

## 3. The Three Story Systems (read this carefully — it is the most confusing part of the codebase)

There are **three separate story-generation systems** in the repo. Conflating them is the single most common source of confusion:

1. **Story Bank — THIS IS WHAT LIVE CUSTOMERS GET.** Pre-authored, human-written-and-vetted stories are loaded from a bank and personalized at runtime (child's name, gender, character DNA inserted). The live `app/api/generate` route calls `loadStoryFromBank`. No story LLM runs per customer order on the live path.

2. **Legacy 4-stage pipeline (`pipeline.ts`)** — a fully LLM-generative story pipeline (StoryBrain → PageOutline → Prose → Illustration planning). It exists in the repo but is **NOT on the live path**. Largely superseded.

3. **v0.5 Recipe Pipeline (`lib/story-generator/`)** — the **future** generative engine, in active development. Hand-authored "Production Recipes" replace a free-form planning LLM; an Author LLM fills structured PageCards; validators and a QA layer check the output. Reachable only via debug routes today. **This is where most recent story R&D effort has gone.**

**Strategic implication:** the live product's text quality rests on the **story bank** (a fixed, finite, human-vetted library). The **recipe pipeline** is the bet for scaling to arbitrary personalized situations later. A major open strategic question (see §12) is *when and how* the recipe engine replaces the bank.

---

## 4. Story Content — The Story Bank (the live text engine)

The story bank is a library of **~108 human-authored stories** (current generation: `v5-fixed-v2`). Stories are organized by **companion × emotional direction**. Each story is written natively at its direction's length (no condensing/retelling).

- **Quality state:** ~97% of stories pass the internal LLM-judged rubric (average ≥8.5, every dimension ≥8). A small number sit just below the bar but are usable.
- **Production process used:** LLM skeleton + Claude prose → automated Hebrew-quality audit → auto-fixes → targeted regeneration of weak stories → manual surgical edits.
- **Hard rule from the founder:** a **human read-through of every story is mandatory before launch.** The rubric is LLM-judged — it clears the bar but does not guarantee flawless Hebrew or perfect age-appropriateness. This human pass is an outstanding pre-launch task.
- Personalization at runtime inserts the child's name (5–7 placements, including subject role), gender, and companion DNA. A known fragile area is name/gender insertion correctness.

The story bank is solid, vetted content — the **text side of the product is in good shape for a supervised launch.** It is finite, though: it does not cover arbitrary free-text situations a parent might type.

---

## 5. Story Content — The v0.5 Recipe Pipeline & Phase C (the future engine)

This is the in-development generative engine, piloted on one companion — **Bolly the armadillo**, age 5–6.

**Recipe-mode** replaces a free-form planning LLM with **hand-authored Production Recipes**. The Author LLM fills structured PageCards; validators + a lightweight QA layer ("Y-lite") gate the result; there is no free-form editorial-repair LLM (deliberately — see below).

**The sealed quality standard** every recipe must hit: each page is a 4-beat *relationship loop* (child feels → companion answers → child notices → shift), not two actors acting in parallel; relief is withheld through the rising action and accumulates in the back half; the child's name is anchored deliberately; direct speech is attributed to the child; failed pages can be re-rolled without disturbing the rest; gender-neutral placeholders; a mandatory "boy run" before sealing.

**Status of the three directions (all on Bolly):**
- **Fantasy — SEALED** (v0.5.5g). Passes 3/3 both genders. Do not keep polishing it.
- **Adventure — structural candidate** (v0.5.6). Passes 3/3 both genders; less literary polish than Fantasy; pending the Voice-QA layer before a production seal. Note: Adventure is judged as a *direct, warm medical story* — NOT against Fantasy's imaginative bar.
- **Bedtime — recipe-seal-ready** (v0.5.6). The cleanest-reading of the three; no open recipe debt.

**Phase C — the Voice Reviewer.** A multi-axis LLM reviewer that detects voice/Hebrew/relationship defects across 11 "families." Shipped as **diagnostic-only** (it flags, it does not block). Key design decision: QA works by **detection → re-roll the bad page**, NOT by an editor LLM rewriting lines. Reason: a re-roll *fails safe* (budget exhausted → flagged for a human); a patch *fails open* (a worse-but-compliant line ships silently).

**Target architecture (designed, not built):** a 4-layer model — `Story = CompanionDNA + ResilienceTemplate + ScenarioPack + Direction + AgeTier + Personalization`, with a SituationRouter. Free text would *classify* to the nearest supported template+scenario and fill slots — it never invents story structure. Unsupported free text gets an honest fallback, not a guess. Serious-illness/trauma is a sensitive tier, explicitly out of MVP automation.

**Reality check (from the launch-readiness audit):** because the live product serves the **story bank**, the **Voice Reviewer does not run on customer books today.** The entire v0.5 recipe + Phase C effort is the *next-generation* system, not the current shipping product.

---

## 6. Image / Illustration Pipeline (the area of heaviest recent work)

Illustration has been the project's hardest problem and the historical launch blocker. Recent history is an **oscillation, not a clean progression**: Flux (Replicate) was the original engine → switched to OpenAI gpt-image for better style → switched back to Flux for better prompt-following and cost → and most recently a structured **style audition** that concluded today.

**Two product styles:**
- **Style 01 — "soft watercolor / cute."** Gentle, cozy, rounded characters, big eyes. Auditioned on gpt-image-1; **parked as "close-enough"** at a style-reference version. Not finally locked.
- **Style 02 — "cinematic fantasy / epic."** Rich, dense, semi-realistic, dramatic lighting, premium. **LOCKED today (2026-05-25) on gpt-image-2.**

**How Style 02 works (locked):** OpenAI **gpt-image-2**, `images.edit` mode, passing the founder's reference images as **style references** (4 per call). References are **scene-typed** — night scenes use dark reference subsets, daytime scenes use bright ones; child-prominent scenes exclude the most photo-real references to prevent CGI drift. This was settled by audition: text-prompt iteration and gpt-image-1 both plateaued (could not render dense detail without a global amber wash, could not hold bright daytime); **gpt-image-2 broke that ceiling.** A LoRA — long considered the fallback — turned out **not to be needed**.

**Critical caveat:** the Style 02 lock is a **style** decision. It is **not yet wired into the book pipeline.** The live image path still runs `IMAGE_PROVIDER=replicate` (Flux). Connecting gpt-image-2 to the actual book generator (`generateAllPageImages`) is "Phase 2" — not started.

**The still-unsolved hard problem — character consistency.** Across earlier experiments: the companion (Bolly) can be locked well via a reference image; the **child** is harder — page-to-page consistency drifts (hair, render softness), wardrobe changes between pages, and "does the illustrated child actually read as *my* child" is unresolved. This — not style — has always been the real launch blocker for images.

---

## 7. Reader & Output Formats

- **Web reader** (`/book/[id]/read-v2`): single-page swipe/click navigation, RTL (Hebrew). Interior pages render **full-bleed** — image fills the page, text overlaid at the bottom with a gradient. Cover is full-bleed with the title overlaid. Fonts: Heebo (primary) + Arimo. Audio playback supported.
- Known reader debt: a desktop aspect-ratio crop issue (2:3 vs 3:4), a dev-toolbar leak, and the reader still feels a bit "app-like" rather than "real printed book."
- **PDF:** a print-ready PDF is a paid add-on. It has had reliability issues (silent failures in past) and is not yet at premium quality.
- **Video:** a narrated video version is a paid add-on; text-overlay layout was reworked to match the mobile reader (text at bottom).

**Founder's stated next focus after a short story pass: upgrading the reader into a true book layout** — full-bleed pages, proper typography, text-on-image — so the product *feels* like a printed book, not a card-based app.

---

## 8. Wizard, UX & Product Flow

The wizard collects child details (name, age, gender, photo) and a theme/direction. The **length picker was removed** — the chosen direction now determines page count (see §9). Direction is presented as cards; pricing shows as a live total. Direction previews use **pre-made static images** (6 + 2) rather than live AI generation — this made the step instant, free, and reliable (the old live-preview generation was slow and failure-prone).

UX is functional but not yet polished to "premium product" standard — it is item #4 in the founder's priority order, after pipeline integrity, reader, and image quality.

---

## 9. Pricing & Business Model

**Direction = page count = price** (one bundled choice, no separate length step):
- **Bedtime** — 10 pages — **₪59**
- **Adventure** — 15 pages — **₪79**
- **Fantasy** — 20 pages — **₪99**

**Add-ons:** narration ₪19 · video + narration ₪29 · print-ready PDF ₪19 · video + print combo ₪39.

This model also shrinks the content matrix (companion × direction instead of companion × direction × length). **OPEN QUESTION for unit economics:** image generation cost. A book is 10–20 illustrations; gpt-image-2 per-image cost must be confirmed against these price points before the pipeline is committed to it.

---

## 10. Companions

Companions are the animal characters who partner with the child and model the coping mechanism. They use a **deep 20-field profile schema** (weaknesses, speech pattern, humor type, body language, stress response, internal rules, psychological context, etc.) — the depth of companion metadata is treated as a direct driver of story quality. Five "pilot" companions were built across diverse emotional categories. **Bolly the armadillo** is the dedicated pilot for the v0.5 recipe engine. A "Companions v2" proposal (a refreshed roster) exists but is not yet executed.

A **story-solution taxonomy** of 8 psychological types (Force, Build, Ask, Sacrifice, Trick, Exit, Rule-hack, Trade/Redirect) is used to force variety — the model otherwise collapses every story into "build something" or "endure a sacrifice."

---

## 11. Decisions Already Locked

- **Style 02 = gpt-image-2**, `images.edit` style-reference, scene-typed reference subsets (locked 2026-05-25). No LoRA needed for it.
- **Direction = page count = price** — bedtime/adventure/fantasy at 10/15/20 pages, ₪59/79/99.
- **Story bank is the live text source**; the v0.5 recipe pipeline is the future engine, not yet live.
- **Recipe-mode over a free-form planning LLM** — the fully-generative planner failed; hand-authored recipes + slot-filling is the chosen path.
- **Voice QA = detection → page re-roll**, never an editor LLM that rewrites lines (fail-safe over fail-open).
- **Static direction-preview cards** instead of live-generated previews.
- **Story LLM = GPT-5 family**, called via the Responses API for gpt-5.x models.
- v0.5 Fantasy recipe is **sealed** — frozen, no more polishing.

---

## 12. Roadmap & What's Next

**Immediate (image pipeline):**
- **Phase 2 — wire Style 02 / gpt-image-2 into the book pipeline** (`generateAllPageImages`), then a 5-page book test for composition variety + child/companion consistency. Verify gpt-image-2 cost first.
- Re-audition **Style 01** on gpt-image-2 (it was parked on the older model; the newer model will likely lift it too).
- Collapse a dead style registry in code (it lists 3–4 styles; the product has 2).

**Story side:**
- A short pass back over story content, then continue widening the v0.5 recipe engine (more scenarios within proven templates, then more templates, then age tiers, then more companions, then the SituationRouter).
- Graduate the Phase C Voice Reviewer from diagnostic-only toward blocking, once calibration is stable.
- The mandatory human read-through of every story-bank story before launch.

**Product side:**
- Upgrade the reader into a true printed-book layout (founder's next major focus).
- Wizard/UX polish; PDF quality; companions v2.

**Recommended launch shape (from the internal audit):** a small **supervised story-bank pilot**, gated on image quality, with a human reviewing the *images* of each book before delivery. Text is in good shape (vetted bank); images are the gate.

---

## 13. Top Risks & Open Questions (where your advice is most valuable)

1. **Image character consistency.** Style is now solved; making the illustrated child reliably *read as that specific child* — and keeping hair, face, and wardrobe stable across 10–20 pages — is not. This is the #1 launch blocker.
2. **gpt-image-2 unit economics.** Per-image cost × 10–20 pages must work against ₪59–99 pricing. Unverified.
3. **Story-bank vs recipe-engine transition.** The live product is a finite human-authored library; the scalable engine is mid-build. *When* and *how* the recipe engine takes over — and whether the bank is the long-term launch vehicle — is an unresolved strategic call.
4. **QA coverage gap.** The sophisticated Voice-QA work applies to the recipe pipeline, which is not live — so live (bank) books rely on the one-time human read, not an ongoing automated gate.
5. **Pipeline not yet wired.** The Style 02 lock is real but is a *style* decision; the book pipeline still renders via the old Flux path until Phase 2 connects it.
6. **Scope discipline.** The project has a long history of oscillation (especially on images). The current operating principle: lock decisions, phase the work, do not re-litigate settled calls.

---

*End of briefing. For any area, the consultant should feel free to ask for a deeper drill-down — the CTO can expand any section on request.*
