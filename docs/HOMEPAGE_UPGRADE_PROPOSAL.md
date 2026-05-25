# Home Page — Upgrade Proposal

*CTO review, 2026-05-25. Live page: `small-heroes-projects.vercel.app`. Reviewed from source — full HTML structure + the complete Hebrew copy table (`content.js`).*

---

## TL;DR — three headline findings

1. **The page sells the product competently but does not yet sell *trust*.** It has no testimonials, no real social proof, and no visible "this is for *my* situation" moment. For an emotional, high-anxiety purchase — a book for a struggling child — trust is the conversion lever, and it is the biggest gap.
2. **A style mismatch needs fixing first.** The wizard still offers an old second style ("אקוורל ריאליסטי") that no longer matches the **locked Style 02** (cinematic fantasy). Renaming is not cosmetic — the second style was *redefined* by the audition. Home page + wizard must both be realigned to the two real styles. (Details in Part 2.)
3. **Unfinished hooks are already in the code.** The hero has empty `socialProof`, `trustBadge`, and `ctaNote` slots; `sample.p1`, `pricing.note`, `faq.sub` are empty strings. The scaffolding for several upgrades already exists — they were stubbed and never filled.

The page is **not bloated** — the fix is mostly *add and sharpen*, with one consolidation. No section needs deleting outright.

---

## Current home page at a glance

Section order today: **Navbar → Hero → Gallery → Sample → Why → How it works → Pricing → FAQ → Footer.**
All copy is centralized in `content.js` (good — clean to edit). Every CTA points to `/wizard`.

---

## Section-by-section review

### Navbar — KEEP, minor upgrade
Clean. Links: how / pricing / my-books. One idea: the nav CTA "אני רוצה לנסות" is soft — consider matching it to the hero's stronger "אני רוצה ספר כזה", or a verb-led "ליצירת הספר".

### Hero — KEEP structure, UPGRADE hard
The copy is genuinely strong — `"משהו קשה לו עכשיו?"` is problem-first and emotionally honest; the bullets are benefit-led. Two real upgrades:
- **Fill the empty social-proof slot.** The `heroBadge`/`socialProof`/`trustBadge` keys exist and are blank. The meta description already claims *"מאות הורים כבר יצרו"* — that claim belongs ON the page, in the hero. A single line ("כבר נוצרו מאות ספרים אישיים" + a rating or a parent micro-quote) materially lifts a cold visitor.
- **Upgrade the hero visual.** Today it is one static illustration (`HeroIllustrated.png`). The product's whole promise is *personalized illustrated books in two styles* — the hero should show that: a real book page or spread, ideally hinting at both styles, not a generic single character.

### Gallery — KEEP, RE-RENDER + RENAME
Strong concept (style toggle, "ככה זה נראה מבפנים"). Three problems:
- Images are old placeholders (`gallery-1..6`, `gallery-r-1..6`) — to be re-rendered (Part 2).
- Toggle labels (`מאוייר` / `אקוורל`) are stale and must change with the style realignment.
- A dead "Style 03 coming soon" note (`detailedComingSoonNote`) lingers — the locked Style 02 *is* that magical world; resolve it.

### Sample — KEEP, but SHARPEN its job
A real worked example (Tamar, 5, fear of sirens) with an actual prose excerpt — this is the page's most convincing emotional moment. But it currently overlaps the Gallery (both are "look at book imagery"). Make the division sharp: **Gallery = visual style proof; Sample = emotional/story proof.** Fill the empty `sample.p1`. Consider showing the *transformation* — the parent's wizard inputs → the resulting personalized page.

### Why — KEEP
Three cards (not-a-template / two-styles / no-waiting) — good, clear differentiation. The "two styles" card copy must update with the rename.

### How it works — KEEP
Three steps, clean. Standard and effective. No change needed beyond copy polish.

### Pricing — KEEP, minor
Three tiers (bedtime/adventure/fantasy), middle one featured. Solid. `pricing.note` is empty — a reassurance line there ("כל הספרים כוללים X", or a guarantee) would help. Consider naming what the price *includes* more concretely.

### FAQ — KEEP
Six well-chosen questions — they hit the real objections (is it really personalized, what age, sensitive kids, replace therapy, speed, photo required). Good. `faq.sub` is empty — optional to fill.

### Footer — KEEP
Final CTA. Fine.

### CTA discipline — UPGRADE
There are ~6 CTAs, almost all variants of "אני רוצה ספר כזה" → `/wizard`. Repetition dulls them. Vary by context: discovery-stage ("לראות איך זה עובד"), value-stage ("אני רוצה ספר כזה"), decision-stage ("ליצירת הספר — 3 דקות").

---

## New sections to ADD

### 1. "What it helps with" — themes/use-cases (HIGH priority)
The page never shows the *range* of situations a book can address. The wizard has 12 (night fears, new sibling, anger, confidence, transitions, friendships, sensitivity, other fears, sirens/noise, focus, medical, other). A parent must instantly see *"yes — this is for my situation."* Add a warm grid of situations, placed **right after the Hero**. It does double duty: self-identification + showing product depth. Low effort — the content already exists in `wizard.topics`.

### 2. Testimonials / parent voices (HIGHEST priority — the real conversion gap)
There is no social proof anywhere. For a parent buying a book for a *struggling* child, other parents' words are the strongest possible reassurance. Add a dedicated section — real parent quotes, each ideally with child first name + age + the topic ("נועה, בת 4, פחד מהחושך"). Place it **just before Pricing** (reassurance right at the decision point).
**This section needs REAL content.** Do not ship invented testimonials for a child-wellbeing product. If there aren't enough real ones yet, that is an action item for Guy — collect them from existing customers — and the section ships when content is ready.

### 3. The companion — give it a moment (MEDIUM, lightweight)
The animal companion who walks the journey with the child is a charming, differentiating feature, and the home page barely mentions it. Recommendation: do NOT add a whole section — **weave it into "Why"** (or "How it works" step 2): one card/line introducing "every book gives your child a companion — a small friend who goes through it *with* them." Keeps the page lean.

### Proposed section order

Navbar → **Hero** (+ social proof) → **What it helps with** (new) → **Gallery** (re-rendered, 2 styles) → **Sample** (sharpened) → **Why** (+ companion line) → **How it works** → **Testimonials** (new) → **Pricing** → **FAQ** → **Footer**

Two new sections, one consolidation of intent, no deletions. The page stays scannable.

---

## Style realignment & renaming (do this as ONE change — it is not just labels)

**The finding:** the wizard currently offers two styles —
- `soft_hand_drawn_storybook` → "מאוייר חם ועדין" — the soft cute style. **Still valid = our Style 01.**
- `expressive_painterly_storybook` → "אקוורל ריאליסטי" — "the child looks like a real child… soft watercolor portrait." **This is the OLD Style 02 definition. It no longer matches the LOCKED Style 02** (cinematic fantasy / rich magical world).

So this is a realignment, not a rename. The two real, locked styles are:

| | Style 01 | Style 02 |
|---|---|---|
| Character | soft, warm, cozy, cute | cinematic, rich, magical, epic |
| Feeling | "the hug" | "the wow" |
| Internal id | `soft_hand_drawn_storybook` | `detailed_whimsical_world` |

**Proposed names (pick one each — naming is yours):**
- **Style 01:** `אקוורל חלומי` *(recommended)* · `רך וחם` · `ציור חולמני`
- **Style 02:** `עולם קסום` *(recommended — also matches the internal id and the old "Style 03" magical-world slot)* · `פנטזיה קסומה` · `קסם קולנועי`

**New descriptions (the wizard blurbs must be rewritten — the current Style 02 blurb describes the retired style):**
- Style 01 — *"איור רך וחם בצבעי מים, דמויות עגולות וחמודות, אווירת חיבוק — סגנון ספר ילדים קלאסי ועדין."*
- Style 02 — *"עולם פנטזיה עשיר וקולנועי — אור דרמטי, פרטים בכל פינה, קסם ועומק. סגנון פרימיום שמרגיש כמו ספר הרפתקאות יוקרתי."*

**Every place the names/descriptions appear — change together:**
`content.js` → `landing.gallery.toggleIllustrated/toggleRealistic`, `landing.why.cards[1]`, `wizard.styles[]` (labels + descriptions), `wizard.summary.styleLabel` values · `index.html` → the gallery toggle buttons + `data-gallery-style` attributes · `lib/styles.ts` → `WIZARD_ILLUSTRATION_STYLES` (content.js explicitly notes it mirrors this — change both). **Fold this into the `styles.ts` 3→2 registry cleanup** (already an open task) — it is the same change.

---

## Gallery image render plan

The gallery needs **6 scenes × 2 styles = 12 fresh images** (replacing `gallery-*` / `gallery-r-*`).

- **Not blocked on Phase 2.** Gallery images are showcase pages — they need no child/companion identity consistency, so this is a standalone render job, essentially the audition method with 6 appealing scenes. It does not wait on the book-pipeline wiring.
- **Engine:** render **both** style sets on **gpt-image-2** for a consistent quality bar. Style 02 uses the locked config directly. Style 01 should get its quick **gpt-image-2 re-audition first** (already recommended after the lock) — then both gallery sets come from the same engine.
- **Scenes:** pick 6 that show emotional + environmental *range* — e.g. cozy bedroom, magical forest, bright classroom, outdoor adventure, a tender quiet moment, a friendly clinic. The gallery is the product's visual proof; variety sells.
- **Execution:** needs the OpenAI API key — runs via Cursor or locally, not from the CTO sandbox. A small dedicated render script (mirroring the audition script) is the clean way.

---

## Recommended sequencing & your decisions

This whole workstream is **independent of Phase 2** (landing page vs book pipeline) — it can run in parallel.

**Order:** (1) lock the style names + the realignment, (2) Style 01 gpt-image-2 re-audition, (3) render the 12 gallery images, (4) implement the home-page section changes + the new copy, (5) wire in testimonials when real content exists.

**Needs your decision now:**
1. Style 01 name + Style 02 name (from the options above).
2. Approve the section plan — add "What it helps with" + "Testimonials"; companion woven into "Why".
3. Confirm: re-audition Style 01 on gpt-image-2 before the gallery render (recommended).
4. Testimonials content — do real parent quotes exist to use, or is collecting them an action item?

Once you decide 1–4, I'll write the implementation brief for Cursor (copy changes, new sections, the rename across all files) and the gallery render script spec.

---

# v2 — Consolidated with the Consultant's Review (2026-05-25)

The consultant (ChatGPT) independently reviewed the live page. It converges with this proposal on the big calls — independent convergence means the direction is right. Below: what the consultant **adds**, what to **reconcile**, and the merged plan.

## What the consultant adds — adopt

- **Trust & Privacy section.** Explicit photo-handling reassurance — the photo is used only to create the character, not shared without consent, deletion on request — plus surfacing "every book is quality-checked before delivery" as a *strength*. This proposal underweighted privacy. ⚠️ Privacy claims must match the **actual backend data practice** — Guy confirms the real photo-handling policy before any wording is written. Never publish a claim the system does not honor.
- **Reframe the Gallery from "characters" to "a finished book."** Show a cover, an inner spread, an emotional page, a closing page, and a phone reader mockup — not pretty character portraits. This is the concrete fix for "feels like an AI generator, not a real book." Sharper than "re-render the gallery."
- **Concrete hero rewrite.** A fuller subtitle naming real situations (bedtime fear, doctor visit, new sibling); dual CTA (create / see an example); a microcopy line under the CTA (3-min questionnaire · illustrated digital book · Hebrew · age + emotion matched).
- **Tier framing by child-need.** Each price tier should say *which child it suits* (bedtime = needs calm; adventure = needs courage; fantasy = loves rich imagination) — not just page count.
- **FAQ — the likeness question.** Add "will the child really look like the photo?" with an honest answer: an illustrated character *inspired by* the child (age, hair, colors, general expression) — not a photographic copy. This matches the real likeness limitation. Do not overpromise.
- **Visual / brand polish.** Warm the palette (the purple reads "SaaS" — add cream / peach); the white cards are a touch cold (soft shadow / paper texture); give the logo more presence; add a **mobile mockup** (most parents arrive on mobile); verify RTL on every card.
- **Warm the final CTA.** The black section clashes with the soft brand — cream/purple background, warmer copy.

## Reconciliations — where the source check corrects the consultant

- **The "קסה" typo.** The consultant saw it on the live screenshot. The repo source (`content.js`) is **correct** — `'משהו קשה לו עכשיו?'`. So either the live deploy is **behind the repo** or it was a screenshot misread. ACTION: check the live site; if it shows "קסה" while the repo is correct → the deploy is stale, redeploy.
- **Deploy drift.** The consultant reviewed `smallheroes.co.il`; the repo's canonical / OG meta tags point to `small-heroes-projects.vercel.app`. The live site may not reflect the current repo. Confirm what is actually deployed before judging the live page against the repo.
- **Canonical-URL bug.** `index.html` sets `<link rel=canonical>` and `og:url` to the vercel.app URL, but the real domain is `smallheroes.co.il`. That is an SEO defect — canonical must be the real domain. FIX.
- **Tier copy is already partly emotional.** The pricing tiers already have names + emotional descriptions in `content.js`. The real upgrade is the *which-child-it-suits* framing, not inventing names from scratch.
- **The "most parents choose" badge.** The consultant rightly says don't claim "מומלץ" without data. Note: the current badge already says "הבחירה של רוב ההורים" — that is *also* an unverified data claim. Until there is data, use an honest launch-phase label ("בחירת ההשקה" / "מתאים לרוב הילדים").

## Consolidated home-page structure

1. **Hero** — rewritten, social-proof line, a finished-book visual
2. **"מתי זה מתאים?"** — situations grid (both reviews agree)
3. **Gallery** — reframed to finished-book pages (cover, spread, reader mockup) + 2-style toggle
4. **"הספר נבנה סביב הילד"** — concrete personalization list + the differentiator line ("the child doesn't just appear — he acts, chooses, changes the ending")
5. **How it works** — 3 steps (+ a small step 4: quality-checked before delivery)
6. **Why it's different** — 3 sharpened cards (child leads · companion models coping · built like a real book)
7. **Trust & Privacy** — photo handling + quality check (content gated on Guy confirming the real policy)
8. **Testimonials** — when real parent quotes exist
9. **Pricing** — emotional, framed by child-need
10. **FAQ** — expanded (likeness, refunds, photo storage, corrections, timing, Hebrew, digital vs print)
11. **Final CTA** — warmed

## Two debated points — my CTO calls

- The consultant suggested "choose art style" and "choose story direction" as their own landing sections. I'd **keep them folded** — the style choice lives in the Gallery toggle; the directions *are* the pricing tiers. Separate selector sections on the landing just duplicate the wizard. Keep the landing about *desire + trust*; the wizard is where you choose.
- **Hero headline:** the consultant both praised "משהו קשה לו עכשיו?" (problem-first, doesn't sell tech) and called it heavy. Genuine judgment call — treat it as an A/B candidate, not a settled rewrite.

## Immediate quick wins (no redesign needed)

1. Verify + fix the live "קשה" typo (and confirm the deploy is current).
2. Fix the canonical / OG URLs to `smallheroes.co.il`.
3. Fill the empty hero `socialProof` / `trustBadge` slots.
4. Add the "מתי זה מתאים?" situations section (content already exists in `wizard.topics`).
5. Add the Trust & Privacy section (after Guy confirms the policy).
6. Add the likeness FAQ + a few more questions.
7. Tier copy: add the which-child framing; swap the unverified badge to a launch-phase label.
8. CTA copy: make it consistent and stage-appropriate.

The gallery re-render (finished-book pages) and the visual/brand warm-up are the larger items — they follow the style realignment + the gallery render plan in v1.
