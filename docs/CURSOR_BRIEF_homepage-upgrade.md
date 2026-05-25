# Cursor Brief — Home Page Upgrade + Style Realignment

**Owner:** CTO · **Date:** 2026-05-25 · **Status:** ready for Cursor
Full plan: `docs/HOMEPAGE_UPGRADE_PROPOSAL.md` (v1 + v2). This brief is the implementation spec.

**Priority rule:** Phase 2 (image pipeline wiring) takes precedence. Nothing in this brief may delay Phase 2.

---

## Rules — non-negotiable

- **No invented testimonials.** No testimonials section ships in this round.
- **No fabricated numbers.** Do not claim a user count ("מאות הורים…") unless it is verifiably true. If pre-launch, use honest launch-phase framing.
- **No unconfirmed privacy claims.** Any statement about what happens to a child's photo must be confirmed true by Guy before it is published. Build the structure; mark unconfirmed copy as a placeholder.
- The styles-registry id realignment **stops at an audit checkpoint** for CTO review before DB-touching changes.

---

## Pre-flight — do FIRST, before any code change

1. **Live-vs-repo check.** The live site is `smallheroes.co.il`; the repo's meta tags point to `small-heroes-projects.vercel.app`. Confirm the live deploy reflects current `main`. If stale → redeploy.
2. **The "קסה" typo.** The consultant saw "קסה" on the live site; the repo `content.js` is correct (`'משהו קשה לו עכשיו?'`). `grep -r "קסה"` the repo — if found, fix; if the repo is clean (expected), the live typo is a stale-deploy artifact → the redeploy in step 1 resolves it. Report which it was.
3. **Canonical URL fix.** In `public/HTML/index.html` (and any other HTML with the same), change `<link rel="canonical">`, `og:url`, `og:image`, `twitter:image` from the `vercel.app` URL to the real domain `smallheroes.co.il`. This is a real SEO defect.

---

## Part 1 — Copy + new sections (low-risk; do together)

### 1a. Hero
- Keep the h1 (`משהו קשה לו עכשיו?`) for now — a headline A/B test is a later call.
- Rewrite `landing.hero.sub` / `body` to name concrete situations (pre-sleep fear, doctor visit, new sibling, a change at home).
- Fill the empty `heroBadge` / `socialProof` / `trustBadge` / `ctaNote` slots — **honestly**. No fake user counts. If pre-launch, the meta description's `"מאות הורים כבר יצרו"` is likely false — replace it with honest launch-phase framing.
- Add a microcopy line under the CTA: *"3 דקות שאלון · ספר דיגיטלי מאויר · בעברית · מותאם לגיל ולמצב הרגשי"*.
- Dual CTA — primary: *"ליצור ספר לילד שלי"*; secondary: *"לראות דוגמה"*.

### 1b. NEW section — "מתי זה מתאים?" (What it helps with)
- New HTML section in `index.html`, placed **right after the Hero**.
- New `content.js` key `landing.helps` — `h2`, `sub`, and ~8 situation cards. Source from `wizard.topics`: pre-sleep fears, doctor / medical, new sibling, a move (home / kindergarten / class), social difficulty, anger & outbursts, a very sensitive child, self-confidence.
- CSS: a warm card grid; reuse the `why-grid` styling for consistency.

### 1c. NEW section — "אמון ופרטיות" (Trust & Privacy)
- New HTML section, placed **after "Why", before Pricing**.
- Two blocks:
  - **Photo privacy** — ⚠️ build the structure; only one claim is safe to publish as-is: *"התמונה משמשת אך ורק ליצירת הדמות המאוירת של הילד בספר."* Any statement about not sharing photos or deletion-on-request is a **placeholder pending Guy's confirmed data policy** — do not publish it until confirmed.
  - **Quality control** — safe and true: *"בתקופת ההשקה, כל ספר נבדק ידנית לפני המסירה."* This is the trust signal that stands in for testimonials this round.
- **No testimonials section.**

### 1d. Pricing copy
- Add a *which-child-it-suits* line to each tier description (bedtime = a child who needs calm; adventure = a child who needs courage / facing something; fantasy = a child who loves rich imagination).
- Swap the unverified `"הבחירה של רוב ההורים"` badge for an honest launch-phase label (e.g. `"בחירת ההשקה"`).

### 1e. FAQ
- Add the **likeness question** — *"האם הילד באמת ייראה כמו בתמונה?"* — honest answer: an illustrated character *inspired by* the child (age, hair, colors, general expression), not a photographic copy. Do not overpromise.
- Add: not-satisfied / refund, photo storage, can-I-correct-details, delivery time, digital-vs-print.

### 1f. CTA consistency + final CTA
- Make CTA labels consistent and stage-appropriate (discovery / value / decision), not 6× the same phrase.
- Warm the final CTA section — move it off the black SaaS-style block toward the brand's cream/purple; warmer copy.

---

## Part 2 — Style realignment (CAREFUL — audit first, then CTO checkpoint)

The two product styles must become exactly:

| | Style 01 | Style 02 |
|---|---|---|
| Name | **רך וחמים** | **עולם קסום** |
| Feel | soft watercolor, cozy, cute | cinematic fantasy, rich, magical |
| Description | *"איור רך וחם בצבעי מים — דמויות עגולות וחמודות, גוונים עדינים ואווירת חיבוק. סגנון ספר ילדים קלאסי, מנחם ועדין."* | *"עולם פנטזיה עשיר וקולנועי — אור דרמטי, פרטים בכל פינה, קסם ועומק. סגנון פרימיום שמרגיש כמו ספר הרפתקאות יוקרתי."* |

### 2a. Audit checkpoint — do this FIRST, report, do NOT proceed past it without CTO sign-off

The wizard currently lists `soft_hand_drawn_storybook` + `expressive_painterly_storybook`. But the **locked Style 02** and the **Phase 2 image path** both use `detailed_whimsical_world`. These do not match.

Audit and report: `lib/styles.ts` (`STYLE_IDS`, `STYLE_REGISTRY`, `STYLE_PROFILES`, `WIZARD_ILLUSTRATION_STYLES`, `DatabaseIllustrationStyle` + the mapping functions) **and the DB enum**. Determine: can the wizard's Style 02 id become `detailed_whimsical_world` cleanly? What happens to existing orders / DB rows that reference `expressive_painterly_storybook`? Is a data migration needed?

**Report the audit + your proposed realignment. STOP for CTO sign-off before any id-level or DB change.** Goal end-state: exactly two styles — `soft_hand_drawn_storybook` (Style 01) and `detailed_whimsical_world` (Style 02) — consistent across the registry, the wizard, and the Phase 2 path. Retire the dead registry entries (the 3→2 cleanup) as part of this.

### 2b. Label / description / copy changes (safe string changes — apply once 2a is signed off)

Change the names + descriptions to "רך וחמים" / "עולם קסום" in **every** place, together:

- `content.js` → `wizard.styles[]` (labels + descriptions — Style 02 description must be the new cinematic-fantasy blurb, NOT the old realistic-watercolor one).
- `content.js` → `landing.gallery` toggle labels (`toggleIllustrated` / `toggleRealistic` → "רך וחמים" / "עולם קסום"); resolve the dead `detailedComingSoonNote`.
- `content.js` → `landing.why.cards[1]` (the "two styles" card).
- `content.js` → `wizard.summary.styleLabel` and any style-value display.
- `lib/styles.ts` → `WIZARD_ILLUSTRATION_STYLES` labels (`content.js` notes it mirrors this — change both, keep them in sync).
- `index.html` → the gallery toggle buttons + their `data-gallery-style` attributes / ids (rename the stale `realistic`/`illustrated` values to something neutral like `style01`/`style02`).

---

## Part 3 — Gallery render spec (SPEC only — rendering needs the API key; run via Cursor or locally, CTO QAs)

Replace the 12 gallery images (`gallery-*` / `gallery-r-*`) with **finished-book proof**, not character portraits.

- **~6 images per style** (12 total). Each set shows a real book, not pretty kids: a **cover**, an **inner page/spread with Hebrew text**, a **quiet emotional page**, an **action page**, a **warm closing page**, and a **phone reader mockup** (a rendered page composited inside a device frame).
- ⚠️ **Must not overpromise.** Gallery images must be generated by the **same engine + config as the real book pipeline** so they represent what a customer actually gets — Style 02 via the locked gpt-image-2 config; Style 01 via its real engine. No hand-idealized one-offs.
- **Style 01 on gpt-image-2:** a lightweight re-audition is approved **only if it does not delay Phase 2**. If it would, render the Style 01 gallery set on Style 01's current engine instead.
- Deliver as a small standalone render script + the 12 assets + a manifest. **CTO QAs all 12 before they go live.**

---

## Suggested execution order

1. Pre-flight (live-vs-repo, typo, canonical).
2. Part 2a audit → **CTO checkpoint**.
3. Part 1 (copy + new sections) — can run in parallel with the 2a audit.
4. Part 2b (string changes) — after 2a sign-off.
5. Part 3 gallery render — after the style realignment; never ahead of Phase 2.

Report after the pre-flight + the 2a audit before going further. Phase 2 is the priority — this brief yields to it.
