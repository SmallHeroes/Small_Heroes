# Cursor Brief — Wizard Reorganization + Product Cards + Power Card System

**Status:** Approved by Guy (final, after ChatGPT review pass).
**Version:** v2 — coupon clarified to fantasy-only, voice options unified across all products, Phase 3 split into preview-first then export.
**Goal:** Ship MVP-commercial version of Small Heroes: 3 product cards (no GBB tiers), restructured wizard, Power Card as core deliverable, fantasy-only next-book 30% discount coupon.

---

## 0. Decisions locked (do not relitigate)

| Decision | Value |
|---|---|
| Commercial model | 3 product cards (no tiered upsell) |
| Bedtime price | **₪79** — 10 pages |
| Adventure price | **₪99** — 15 pages |
| Fantasy price | **₪139** — 20 pages |
| Direction = Product | One choice. No separate "package" step. |
| Page count rule | LOCKED — bedtime=10, adventure=15, fantasy=20. No length variants. |
| Power Card | Included in **all three** products. Same quality, palette varies by direction. |
| Video (fantasy only) | MVP = slideshow + narration (NOT full animation). Defer real anim to v2. |
| Next-book 30% discount | **Fantasy-only.** Coupon generated ONLY on fantasy purchases, redeemable on any product, one-time use, 60-day expiry. |
| Voice options | **Identical across all 3 products** — same 3 default voices for everyone. No premium voices, no tier-locked voices, no upgrade modal. (Voice expansion deferred to v2.) |
| Welcome step | REMOVED. Modern flow starts at Topic. |
| Add-ons screen | REMOVED. Voice extracted to own step. PDF/Audio/Video baked into products. |
| Hero Notes step | KEEP — redesigned (see Phase 2). |

---

## 1. Phase 1 — Wizard structural rebuild

**Goal:** New 9-step ordering. Welcome and Add-ons removed; Voice extracted; Direction becomes the final commercial step.

### 1.1 New step order (9 total)

| New # | Old # | Screen | Notes |
|---|---|---|---|
| 1 | 2 | Topic | unchanged |
| 2 | 3 | Companion | unchanged |
| 3 | 4 | Child details | UI fix (see Phase 2.1) |
| 4 | 5 | Hero notes | UI redesign (see Phase 2.2) |
| 5 | 7 | Style | unchanged |
| 6 | NEW | Voice + Sleep mode | extracted from old Add-ons screen |
| 7 | 9 | Book name + Dedication | unchanged |
| 8 | 6 | **Product** (was "Direction") | NEW UI — 3 product cards with full deliverables list, prices, included items |
| 9 | 10 | Summary + Payment | layout flipped (see Phase 2.3) |

### 1.2 Files to touch

- `public/HTML/wizard.html` — re-order `<div class="step" id="step-N">` blocks. **Keep DOM IDs as `step-1` through `step-9`** (one less than today). The OLD `step-1` (Welcome) is deleted entirely. Map old contents to new IDs:
  - new `step-1` ← old `step-2` (Topic)
  - new `step-2` ← old `step-3` (Companion)
  - new `step-3` ← old `step-4` (Child details)
  - new `step-4` ← old `step-5` (Hero notes)
  - new `step-5` ← old `step-7` (Style)
  - new `step-6` ← **NEW Voice screen** (carve out from old `step-8`)
  - new `step-7` ← old `step-9` (Book + Dedication)
  - new `step-8` ← rebuilt **Product cards** (new layout)
  - new `step-9` ← old `step-10` (Summary + Payment)

- `public/JS/wizard.js`
  - `state.totalSteps = 9` (was 10)
  - `state.currentStep` initialization → start at 1 (Topic), not 1 (Welcome)
  - Update all `state.currentStep === N` switch cases throughout the file to the new numbering
  - `migrateLegacyWizardStep(step)` — add another migration tier mapping old 10-step → new 9-step. Mapping table: `{1→1, 2→1, 3→2, 4→3, 5→4, 6→8, 7→5, 8→6, 9→7, 10→9}`. (Old step 8 Add-ons collapses into new step 6 Voice; old step 6 Direction maps to new step 8 Product.)
  - Remove `renderDirectionCards()` in its current location at step 6. Move to step 8 (rebuilt as product cards — see 1.3).
  - In navigation logic, remove the `bottomBarTotal` reveal logic at step 6. Move to step 8.

- `public/JS/content.js` — rename keys for clarity:
  - Delete `WIZ.steps.s1` (Welcome content)
  - Delete `WIZ.steps.s8b` and `s8` (Add-ons screen content)
  - Add `WIZ.steps.voice` block (Voice + Sleep mode copy)
  - Rename old `directionPackages` array → `productPackages`, restructure entries (see 1.3)

### 1.3 Product cards structure (new step 8)

Replace `WIZ.directionPackages` with `WIZ.productPackages`:

```js
productPackages: [
  {
    id: 'bedtime',
    productName: 'ספר לילה טוב אישי',
    tagline: 'סיפור קצר, רגוע ומחבק לפני השינה.',
    pages: 10,
    priceILS: 79,
    bestFor: [
      'פחד מהחושך',
      'קולות בחדר בלילה',
      'מחשבות לפני שינה',
      'עצב רך, פרידה מהיום',
    ],
    includes: [
      { icon: 'book',  label: 'ספר דיגיטלי מאויר' },
      { icon: 'audio', label: 'קריינות מקצועית' },
      { icon: 'pdf',   label: 'PDF להדפסה ביתית' },
      { icon: 'card',  label: 'כרטיס כוח אישי (Power Card)' },
    ],
    palette: 'moonlit',  // → bedtime palette in Power Card renderer
  },
  {
    id: 'adventure',
    productName: 'הרפתקה אישית',
    tagline: 'מסע אישי עם אתגר, פעולה וחבר מלווה.',
    pages: 15,
    priceILS: 99,
    bestFor: [
      'כעס, תסכול',
      'לא מצליח/ה / לא מנצח/ת',
      'ביישנות, קושי חברתי',
      'חרדת רופא שיניים / רופא',
      'ניסיון של משהו חדש וקשה',
    ],
    includes: [
      { icon: 'book',  label: 'ספר דיגיטלי מאויר' },
      { icon: 'audio', label: 'קריינות מקצועית' },
      { icon: 'pdf',   label: 'PDF להדפסה ביתית' },
      { icon: 'card',  label: 'כרטיס כוח אישי (Power Card)' },
    ],
    palette: 'earth-warm',
  },
  {
    id: 'fantasy',
    productName: 'ספר פנטזיה אישי',
    tagline: 'ספר קסום ועשיר עם עולם מלא ודמיון גדול.',
    pages: 20,
    priceILS: 139,
    bestFor: [
      'גן/בית ספר חדש',
      'מעבר דירה',
      'אח/אחות חדש/ה',
      'עומס חושי',
      'מעברים גדולים, ביטחון עצמי',
    ],
    includes: [
      { icon: 'book',  label: 'ספר דיגיטלי מאויר' },
      { icon: 'audio', label: 'קריינות מקצועית' },
      { icon: 'pdf',   label: 'PDF להדפסה ביתית' },
      { icon: 'card',  label: 'כרטיס כוח אישי (Power Card)' },
      { icon: 'video', label: 'סרטון slideshow לשיתוף' },
      { icon: 'gift',  label: '30% הנחה לספר הבא' },
    ],
    palette: 'magical-cool',
  },
],
```

**Note:** The 30% next-book discount appears on the fantasy card only AND is generated only on fantasy purchases. The coupon, once issued, can be redeemed on any product (bedtime/adventure/fantasy) but bedtime/adventure purchases do not generate new coupons. See Phase 4.

### 1.4 New Voice screen (step 6) — carved from old Add-ons

- Only voice picker + sleep-mode toggle. No PDF / Audio / Video / Bundle rows (those are now baked into products).
- Sleep mode toggle stays as a small accessory below the voice options.
- Title: `הקול שיקריא את הספר`. Subtitle: `הקריינות כלולה בכל ספר — בחרו מי יספר ל{{childName}}.`
- **Exactly 3 default voices for ALL users.** No premium tiers, no gating, no fantasy-extra voices. Voice options identical regardless of product chosen later.
- Copy must NOT use language like "שדרוג", "פרימיום", "תוספת" — narration is INCLUDED, not an add-on. The wording should make this obvious.

### 1.5 Pricing reveal — single moment

Bottom-bar total (`#bottom-bar-total`) should be **hidden** for steps 1–7. Reveals at step 8 (Product selection) as the user clicks a card, and stays through step 9 (Summary).

The product card click handler sets:
- `state.storyDirection = 'bedtime' | 'adventure' | 'fantasy'`
- `state.productId = packageId`
- `state.priceILS = 79 | 99 | 139`
- `state.audioEnabled = true` (baked in)
- `state.pdfEnabled = true` (baked in)
- `state.videoEnabled = id === 'fantasy'`
- `state.bundleEnabled = false` (concept retired)

### 1.6 Acceptance criteria — Phase 1

1. Loading `/wizard.html` lands on Topic (no Welcome screen).
2. Total step count displays "1 מתוך 9" not "1 מתוך 10".
3. No "Add-ons" screen exists. PDF/audio/video selection is no longer a user choice.
4. Voice picker is its own screen, between Style and Book+Dedication.
5. Product step shows 3 cards with pages, price, bestFor list, includes list.
6. Selecting a card sets all derived state; advancing to summary shows correct total.
7. Old saved wizard states (pre-migration) load without errors; user is placed on closest equivalent step.

---

## 2. Phase 2 — Wizard UI fixes (from screenshots)

### 2.1 Child details (new step 3) — fixes

**Issue 1 — Gender + Age dropdowns side-by-side.**
Change layout to stacked, one above the other. CSS: convert the `flex-direction: row` on the dropdowns wrapper to `flex-direction: column` with `gap: 12px`.

File: `public/CSS/wizard.css` — find the `.child-details-row` or equivalent wrapper. If it uses CSS Grid, set `grid-template-columns: 1fr` (single column).

**Issue 2 — Double dropdown arrow.**
The native `<select>` arrow + a custom CSS chevron are both showing. Fix by:
- Add `appearance: none; -webkit-appearance: none; -moz-appearance: none;` to the `<select>` styles
- Keep the custom chevron pseudo-element (it's the styled one)
- Remove the inline `▼` if any element contains it literally in HTML

**Issue 3 — Warning placement.**
"קשה לזהות את הפנים..." currently sits glued under the photo, inside the photo card. Move it OUTSIDE the photo card, beneath the entire step container, as a standalone callout/alert that doesn't affect the photo card's geometry.

In `wizard.html` step-3 (new numbering), the photo warning element needs to be moved from inside the photo card div to a sibling position below the form's main container div. CSS: give it `margin-top: 16px` and full container width.

### 2.2 Hero Notes (new step 4) — redesign

The current screen is "two unrelated chip lists on flat background". **Redesign as a single card** with progressive disclosure:

```
┌─────────────────────────────────────────────────┐
│  💫  כמה מילים על {{childName}}                │
│      לא חובה — זה עוזר לנו להכיר אותו/ה        │
├─────────────────────────────────────────────────┤
│                                                  │
│  מה הכוח הכי גדול שלו/ה?                       │
│  [chip] [chip] [chip] [chip] [chip] [chip]      │
│                                                  │
│  ┌─────────────────────────────────────────┐   │
│  │  איזו תחושה הכי היית רוצה שתישאר איתו/ה? │   │
│  │  [chip] [chip] [chip] [chip] [chip]      │   │
│  └─────────────────────────────────────────┘   │
│                                                  │
│  [להמשיך אפילו בלי לבחור]                       │
└─────────────────────────────────────────────────┘
```

Concretely:
- Wrap the whole step in a card with `background: rgba(255,255,255,0.6); backdrop-filter: blur(8px); padding: 32px; border-radius: 24px;`
- Sub-question for "feeling to remain" gets its own inner card (slightly different bg)
- Skip CTA copy: **`אפשר להמשיך גם בלי זה`** — gentle, reduces guilt. Do NOT use "דלג" (too cold).
- The chips themselves are fine — keep styling

### 2.3 Summary (new step 9) — layout flip

Current: right side has form fields, left side is empty.
**Target:** right side = story summary + price block (the "filled" side), left side = name+email+pay button.

In HTML/CSS:
- The summary grid currently has two columns. Swap their content order.
- Right column (start of line in RTL): product card summary, includes list, total price.
- Left column: form fields, payment button, security badge.
- Make sure responsive: on mobile, stack with summary FIRST (top), then form.

The order should feel like: "this is what you're buying" → "here are your details" → "pay."

### 2.4 Acceptance criteria — Phase 2

1. Child details: age dropdown sits above gender dropdown, single column.
2. Child details: each `<select>` shows exactly one arrow.
3. Child details: photo warning sits BELOW the photo container, not inside it. Photo card geometry unchanged.
4. Hero notes: visible card structure with the two questions separated by visual hierarchy. Optional/skip CTA present.
5. Summary: summary block fills the right (RTL-start) column, form fills the left column. Mobile: summary on top, form below.

---

## 3. Phase 3 — Power Card system

**Goal:** Ship the Power Card as a downloadable PDF + PNG per order. No new AI image gen.

**Split into 4 sub-phases — DO NOT START FROM PUPPETEER.** Sub-phases must ship in order:

- **3a:** Data model + types + frontmatter parser
- **3b:** React preview component inside reader (HTML/CSS, no export yet). Validate RTL, fonts, palettes, personalization visually before ANY export work.
- **3c:** PDF/PNG export via Puppeteer + `@sparticuz/chromium` (only after 3b looks right)
- **3d:** API endpoint + Supabase Storage caching

### 3.1 Frontmatter schema (story-bank) — MVP, with catalog-compatible types

Each `story-bank/v5-fixed-v2/<companion>_<direction>.md` file gets a new `powerCard:` block in its YAML frontmatter. Schema:

```yaml
powerCard:
  title: "כרטיס הכוח של {{childName}}"          # required, supports {{childName}}
  subtitle: "כשאני מרגיש/ה שהחום עולה"          # required, supports /ה personalization
  coreTool: "safe anger release"                  # required, internal label (English)
  steps:                                          # required, exactly 4 items
    - "אני עוצר/ת רגע"
    - "אני מוצא/ת מקום בטוח"
    - "אני נותן/ת לחום לצאת בלי לפגוע"
    - "ואז אני חוזר/ת לדבר"
  companionReminder: "יש דברים שלא צריך לשבור."   # required, 1 short sentence
  visualMotifs:                                   # required, 3-4 items, English keywords
    - "pond ripple"
    - "smooth stone"
    - "fallen log"
```

**Personalization:** `{{childName}}` and `/ה` slash-form personalization works identically to story prose. Use the existing `lib/story-bank-personalization.ts` to apply them at render time.

**Future catalog compatibility (do NOT implement now, but design types for):** In v2 we will introduce `lib/power-cards/catalog.ts` keyed by `powerCardId`, and stories will optionally use `powerCardId: <id>` in frontmatter instead of an inline `powerCard:` block. The resolver must support BOTH paths:

```typescript
function resolvePowerCard(storyFrontmatter): PowerCardSpec {
  if (storyFrontmatter.powerCardId) {
    // v2: look up in catalog. Throw if not found.
    return catalog[storyFrontmatter.powerCardId];
  }
  if (storyFrontmatter.powerCard) {
    return storyFrontmatter.powerCard;
  }
  throw new Error('Story has neither powerCard nor powerCardId');
}
```

For MVP: implement only the inline path. The `powerCardId` branch can throw `'Not implemented in MVP'`. The point is that the **type** `PowerCardSpec` is the same in both — so v2 catalog migration is an additive change with no refactor.

**Content authoring:** Guy will write all 20 Power Card blocks manually (one per shipped story) and commit them in a single PR before the renderer ships. **Do not start sub-phase 3b until at least 5 sample cards exist for testing.**

### 3.2 Types

New file: `lib/power-cards/types.ts`

```typescript
export interface PowerCardSpec {
  title: string;              // raw, with {{childName}} placeholder
  subtitle: string;           // raw, with /ה personalization
  coreTool: string;           // internal English label
  steps: [string, string, string, string];   // exactly 4
  companionReminder: string;
  visualMotifs: string[];     // 3-4 items
}

export type PowerCardPalette = 'moonlit' | 'earth-warm' | 'magical-cool';

export interface PowerCardRenderInput {
  spec: PowerCardSpec;
  childName: string;
  childGender: 'male' | 'female';
  companionName: string;
  companionAvatarUrl: string;   // existing companion sticker from companions config
  palette: PowerCardPalette;    // derived from direction
  bookTitle?: string;            // optional, shown in footer
}
```

### 3.3 Palettes (3 only, by direction)

New file: `lib/power-cards/palettes.ts`

```typescript
export const POWER_CARD_PALETTES = {
  'moonlit': {           // bedtime
    bg:        '#1a1f3a',
    bgGradient: 'linear-gradient(135deg, #1a1f3a 0%, #2d3561 50%, #1a1f3a 100%)',
    textPrimary: '#f5f3ff',
    textSecondary: '#cbd5e1',
    accent:    '#fbbf24',  // warm moon yellow
    borderGlow: 'rgba(251, 191, 36, 0.3)',
  },
  'earth-warm': {        // adventure
    bg:        '#fef3e2',
    bgGradient: 'linear-gradient(135deg, #fef3e2 0%, #fde4b5 50%, #f5d59e 100%)',
    textPrimary: '#7c2d12',
    textSecondary: '#92400e',
    accent:    '#dc2626',
    borderGlow: 'rgba(220, 38, 38, 0.2)',
  },
  'magical-cool': {      // fantasy
    bg:        '#1e1b4b',
    bgGradient: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #1e1b4b 100%)',
    textPrimary: '#f5f3ff',
    textSecondary: '#c4b5fd',
    accent:    '#a78bfa',
    borderGlow: 'rgba(167, 139, 250, 0.4)',
  },
} as const;
```

### 3.4 Renderer — TWO STAGES, do not collapse

**Stage 3b — React preview component (DO FIRST):**

New file: `app/book/[id]/read-v2/components/PowerCardPreview.tsx`

A React component that renders the Power Card visually inside the reader. It:
- Accepts `PowerCardRenderInput` as props
- Renders RTL Hebrew
- Loads Heebo font weights via Google Fonts
- Applies palette CSS variables from `lib/power-cards/palettes.ts`
- Resolves personalization (`{{childName}}`, slash forms) using existing `lib/story-bank-personalization.ts`
- Shows companion avatar in the title section
- Does NOT export — purely visual

**Acceptance for 3b:** The card looks right in the browser (RTL correct, no font glyph holes, palette readable, motifs visible, all 4 steps render with correct gender slashes). Guy gives visual thumbs up. No PDF/PNG work until this step is green.

**Stage 3c — Export to PDF + PNG (after 3b is approved):**

New file: `lib/power-cards/render.ts`

Approach:
1. Generate an HTML string from the same template that drives the React preview (extract to `lib/power-cards/template.ts` so React + server share it).
2. Launch headless Chromium via `@sparticuz/chromium` (suitable for Vercel serverless).
3. Set viewport to A5 portrait (148mm × 210mm at 300dpi = 1748 × 2480 px).
4. Render → screenshot to PNG, also `page.pdf()` for PDF.
5. Return `{ pngBuffer, pdfBuffer }`.

Function signature:

```typescript
export async function renderPowerCard(
  input: PowerCardRenderInput
): Promise<{ pngBuffer: Buffer; pdfBuffer: Buffer }>;
```

**HTML template layout (proportional, A5 portrait):**

```
┌─────────────────────────────────────┐  ← Top 12%: brand mark + book title
│  גיבורים קטנים  ·  {{bookTitle}}    │
├─────────────────────────────────────┤
│                                      │
│   [Companion avatar 96px circle]    │  ← 18% from top: card title section
│                                      │
│         {{title}}                    │
│         {{subtitle}}                 │
│                                      │
├─────────────────────────────────────┤
│                                      │
│   1.  {{steps[0]}}                  │  ← 42% from top: numbered steps
│   2.  {{steps[1]}}                  │
│   3.  {{steps[2]}}                  │
│   4.  {{steps[3]}}                  │
│                                      │
├─────────────────────────────────────┤
│                                      │
│   "{{companionReminder}}"           │  ← 78% from top: italicized reminder
│   — {{companionName}}               │
│                                      │
└─────────────────────────────────────┘  ← Bottom 95%: tiny footer with motif glyphs
```

**Hebrew fonts:** Use `Heebo` (already in the project for the reader) for body and a heavier weight for titles. Embed via `<link>` in the HTML template head.

### 3.5 API endpoint

New file: `app/api/orders/[orderId]/power-card/route.ts`

```typescript
GET  /api/orders/[orderId]/power-card?format=pdf  // returns PDF
GET  /api/orders/[orderId]/power-card?format=png  // returns PNG
```

Flow:
1. Fetch order from Supabase by orderId. Verify ownership.
2. Load the story file referenced by the order. Parse frontmatter.
3. Apply personalization (childName, gender chips → frontmatter strings).
4. Look up companion avatar URL from `lib/companions.ts`.
5. Resolve palette from `order.direction`.
6. Call `renderPowerCard()`.
7. Return buffer with appropriate Content-Type and Content-Disposition headers.

**Caching:** Cache the rendered PNG/PDF in Supabase Storage at `power-cards/<orderId>.png` and `.pdf` on first request. Subsequent requests serve from cache.

### 3.6 Reader integration

After the book's final page, insert a new "end-of-book" overlay or page that surfaces the Power Card:

- Headline: `הכרטיס של {{childName}}`
- Subtext: `הנה כלי קטן שאפשר לחזור אליו גם אחרי שהסיפור נגמר.`
- Two CTAs: `הורד PDF` (downloads from `/api/orders/[orderId]/power-card?format=pdf`) and `הצג כתמונה` (opens PNG in lightbox or new tab)
- Render the card itself at small preview size (~50% of viewport width) in the screen

File: `app/book/[id]/read-v2/components/` — add `PowerCardEndScreen.tsx`. Show it as the page AFTER the last story page, BEFORE the "סוף" screen if there is one.

### 3.7 Acceptance criteria — Phase 3 (split by sub-phase)

**3a — Data model:**
1. `lib/power-cards/types.ts` + `palettes.ts` exist with full type safety.
2. Frontmatter `powerCard:` block parses for at least one story (e.g., `bear_cub_gahal_adventure.md`).
3. Resolver supports both inline `powerCard:` and `powerCardId:` paths (the latter throws `Not implemented in MVP` — type-compatible scaffold).

**3b — React preview:**
4. PowerCardPreview component renders in the reader with correct RTL Hebrew, Heebo font, all 4 steps, companion avatar, palette colors.
5. Three palettes produce visually distinct cards (moonlit/earth-warm/magical-cool) — verified visually.
6. Personalization works: `{{childName}}` filled, `/ה` slashes resolve by gender.
7. Guy gives visual thumbs up before sub-phase 3c starts.

**3c — Export:**
8. `renderPowerCard()` outputs valid A5 PDF + PNG identical in layout to the React preview.
9. Hebrew renders correctly in exported files (no glyph holes, RTL correct).

**3d — API + caching:**
10. `/api/orders/[orderId]/power-card?format=pdf` returns a personalized PDF.
11. Reader shows Power Card preview after final story page, with working PDF download CTA.
12. Power Card files cached in Supabase Storage; second request to same orderId serves from cache.

---

## 4. Phase 4 — Next-book 30% discount coupon (MVP minimal, fantasy-only)

**Goal:** Each **fantasy** purchase auto-generates a 30% off coupon for the same email, redeemable on the NEXT purchase of ANY product (bedtime/adventure/fantasy) within 60 days. One-time use per coupon. Minimal — no admin UI, no analytics, just the mechanism.

**Critical rule:** Only fantasy purchases generate coupons. Bedtime and adventure purchases do NOT generate coupons. The coupon, once issued, is product-agnostic at redemption time.

### 4.1 DB schema

Add Supabase migration: new table `coupons`

```sql
create table coupons (
  code              text primary key,            -- e.g. "MAGIC-4F9X-A2B7"
  user_email        text not null,
  discount_percent  int  not null default 30,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null,         -- created_at + 60 days
  used_at           timestamptz,                  -- null until redeemed
  used_on_order_id  uuid                          -- FK to orders.id, null until redeemed
);

create index coupons_email_active_idx on coupons (user_email)
  where used_at is null;
```

### 4.2 Generation

In `app/api/checkout/route.ts` (or wherever orders are finalized post-payment), after a successful order:

```typescript
// FANTASY-ONLY: do NOT generate coupons for bedtime or adventure
if (order.direction === 'fantasy') {
  const code = generateReadableCode();  // e.g., "MAGIC-" + random 8-char alphanumeric
  await supabase.from('coupons').insert({
    code,
    user_email: order.email,
    discount_percent: 30,
    expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
  });
  // Append code to order confirmation email payload (fantasy only)
}
```

Add `couponCode` field to email payload in `backend/lib/email.ts`. Append to email body **only for fantasy purchases**:

```
🎁 הקופון שלך לספר הבא: {{couponCode}}
מקנה 30% הנחה בכל מוצר Small Heroes. תוקף: 60 יום.
```

### 4.3 Redemption

On summary screen (new step 9), add a small optional input field:

```
יש לך קוד הנחה? [____________] [החל]
```

Click handler calls `POST /api/coupons/validate { code, email }` which returns:
```json
{ "valid": true, "discountPercent": 30, "newTotal": 69.30 }
```

If valid, update `state.appliedCoupon = { code, discountPercent }`, show the discount line in the price summary block, update total.

On successful checkout, mark coupon used in `app/api/checkout/route.ts`:
```typescript
if (state.appliedCoupon) {
  await supabase.from('coupons')
    .update({ used_at: new Date().toISOString(), used_on_order_id: order.id })
    .eq('code', state.appliedCoupon.code)
    .is('used_at', null);  // protects against double-use race
}
```

### 4.4 Acceptance criteria — Phase 4

1. Migration applies cleanly. `coupons` table exists.
2. Fantasy purchase generates a coupon row with `used_at=null` and 60-day expiry.
3. **Bedtime/adventure purchases do NOT generate any coupon row.** Verified.
4. Confirmation email contains the coupon code line ONLY for fantasy purchases.
5. Summary screen has coupon input field on ALL product flows. Entering valid code shows updated total with discount line. Discount works on any product (bedtime/adventure/fantasy).
6. Entering invalid/expired/used code shows clear error and doesn't apply discount.
7. Using a coupon marks it `used_at` and `used_on_order_id`. Trying again on a different order rejects it.
8. Coupons are scoped by email — a coupon issued to `a@b.com` doesn't validate for `c@d.com`.

---

## 5. Phase 5 — Wizard copy audit

**Status:** Guy will deliver a complete copy table separately (Hebrew text for every key in `WIZ.steps.*`). Cursor's job:

- Apply the table to `public/JS/content.js` exactly.
- Verify all step titles, subs, microcopy, CTAs, error states render the right Hebrew.
- Remove all references to "שדרוגים" / "Add-ons" terminology.
- Update `WIZ.summary.*` keys to reflect new product model (no bundle, no separate audio/video addons).

**Acceptance:** Guy reviews each step visually after Cursor pushes; thumbs up = done.

---

## 6. Phase 6 — State migration (legacy users)

`migrateLegacyWizardStep(step)` in `public/JS/wizard.js` currently handles 15-step → 10-step migration. Add a third tier:

```javascript
function migrateLegacyWizardStep(step) {
  const n = Number(step) || 1;
  // Tier 1: very old 15-step → 10-step (existing logic)
  if (n > 10) return migrate15to10(n);
  // Tier 2: 10-step → 9-step (NEW)
  const tenToNine = { 1: 1, 2: 1, 3: 2, 4: 3, 5: 4, 6: 8, 7: 5, 8: 6, 9: 7, 10: 9 };
  return tenToNine[n] || 1;
}
```

Also: any saved state with `audioEnabled/pdfEnabled/videoEnabled/bundleEnabled` properties from the old Add-ons screen needs to be reset — these are now derived from product selection, not user-chosen flags.

```javascript
// At state-load time:
if (savedState.productId) {
  // already on new schema, accept as-is
} else if (savedState.storyDirection) {
  // legacy: re-derive product from direction
  savedState.productId = savedState.storyDirection;
  savedState.priceILS = { bedtime: 79, adventure: 99, fantasy: 139 }[savedState.storyDirection];
  delete savedState.bundleEnabled;
}
```

### 6.1 Acceptance criteria — Phase 6

1. Loading saved state from old 10-step flow lands user on equivalent new 9-step screen, no errors.
2. Old `audioEnabled`/`videoEnabled` flags don't override new product-derived flags.
3. Console shows no warnings about missing keys or unexpected step numbers.

---

## 7. Files to touch — master list

```
public/HTML/wizard.html                                      # step reorder + new product card layout + summary flip
public/JS/wizard.js                                          # totalSteps=9, migration, navigation, product card render
public/JS/content.js                                         # remove Welcome+Addons, add Voice, productPackages array
public/CSS/wizard.css                                        # child details stacked, double-arrow fix, warning placement, hero notes card, summary flip
content/index.ts                                             # email body update (coupon code)
lib/power-cards/types.ts                                     # NEW
lib/power-cards/palettes.ts                                  # NEW
lib/power-cards/render.ts                                    # NEW
lib/power-cards/template.ts                                  # NEW — the HTML/CSS template literal
app/api/orders/[orderId]/power-card/route.ts                 # NEW
app/book/[id]/read-v2/components/PowerCardEndScreen.tsx     # NEW
app/api/coupons/validate/route.ts                            # NEW
app/api/checkout/route.ts                                    # coupon generation on fantasy + redemption on use
backend/lib/email.ts                                         # append coupon code line to fantasy confirmation
supabase/migrations/<timestamp>_coupons.sql                  # NEW
story-bank/v5-fixed-v2/*.md                                  # Guy adds powerCard: blocks (content work, not Cursor)
```

---

## 8. Suggested PR order (7 PRs — strict order)

This order is INTENTIONAL. Do not start later PRs before earlier ones are merged unless explicitly told.

1. **PR-1 — Wizard structural rebuild** (Phase 1 + Phase 6 migration). The foundation. Everything else assumes the new step numbering exists.
2. **PR-2 — Wizard UI fixes** (Phase 2). Pure visual polish, can start in parallel with PR-1 on a separate branch but must rebase onto PR-1.
3. **PR-3 — Power Card data model** (Phase 3a). Types + parser. No UI yet.
4. **PR-4 — Power Card React preview** (Phase 3b). Visual component inside reader. **MUST get Guy's visual approval before PR-5.** No PDF/PNG work in this PR.
5. **PR-5 — Power Card export + API + reader integration** (Phase 3c + 3d). Only after PR-4 is approved.
6. **PR-6 — Fantasy-only coupon** (Phase 4). Independent of Power Card, can run in parallel with PR-3/4 but rebase onto PR-1.
7. **PR-7 — Copy audit** (Phase 5). Last — pure text updates, waits on Guy's copy table delivery.

**Parallel-safe branches:** PR-1, PR-2, PR-6 can be developed in parallel (rebase ordering: PR-1 first, then PR-2/PR-6 rebase). Power Card PRs (3→4→5) are strictly serial because each builds on the previous.

**Guy-blocked PRs:** PR-3/4 blocked on Guy delivering at least 5 Power Card frontmatter blocks for testing. PR-7 blocked on Guy delivering copy audit table.

---

## 9. Open questions / explicit non-scope

**Out of scope for this brief — DO NOT IMPLEMENT:**

- **Premium / fantasy-only voice options.** All 3 products share the same 3 default voices. No voice gating, no upgrade modal, no fantasy-extra voices. Voice expansion is post-MVP.
- Physical book printing (post-MVP)
- Animated video (MVP is slideshow only — uses existing audio narration + page transitions)
- Power Card AI generation (MVP is HTML/CSS template + existing companion stickers)
- Power Card catalog file (`lib/power-cards/catalog.ts`) — types must be catalog-compatible but the catalog file is v2
- Power Card variants by age (single layout for all ages MVP)
- Admin coupon dashboard (no UI; coupons live in DB, queryable via Supabase console)
- Coupons for non-fantasy purchases (fantasy-only in MVP, period)

**Open — to confirm before shipping:**

- Visual review of the 3 Power Card palettes before locking — Guy may want palette tweaks.
- Reader end-screen interaction (modal vs inline page) — try inline first, fall back to modal if it hurts the book closure feeling.

---

**End of brief.**
