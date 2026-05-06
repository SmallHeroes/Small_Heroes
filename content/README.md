# content/

This directory is the **content layer** for Small Heroes — the single place to edit all user-facing Hebrew copy without touching business logic or UI components.

---

## Structure

```
content/
  index.ts              ← barrel export (import everything from here)
  ui/
    he/
      common.ts         ← brand, site metadata, shared error messages
      landing.ts        ← landing page: hero, why, how-it-works, fit cards, footer CTA
      pricing.ts        ← pricing cards (copy only; prices live in backend/config/wizard.ts)
      faq.ts            ← FAQ questions and answers
      wizard.ts         ← wizard step titles, labels, nav buttons, option chips
      progress.ts       ← generation progress page (stages, status lines, story peek quotes)
      success.ts        ← ready page + reader page copy
      checkout.ts       ← Stripe product names and add-on labels
      email.ts          ← transactional email copy (book-ready notification)
  story/
    (reserved for future story prompt templates and metaphor systems)
```

---

## How to edit copy

### Landing page
Edit `content/ui/he/landing.ts`.
Fields: `hero`, `why`, `sample`, `how`, `fit`, `footer`.

### Wizard steps
Edit `content/ui/he/wizard.ts`.
Each step is `steps.s1` through `steps.s9`.
Option chips (topics, traits, difficulties, goals, helpers, avoid) are arrays at the bottom of the file.

> **Note**: Wizard *data* (prices, page counts, topic IDs, challenge options) lives in `backend/config/wizard.ts`. That file is used by the story generation pipeline — edit carefully.

### Pricing cards
Edit `content/ui/he/pricing.ts`.
Display copy only. Actual prices and page counts are in `backend/config/wizard.ts → STORY_LENGTHS`.

### FAQ
Edit `content/ui/he/faq.ts`.
Add, remove, or reorder `items` freely.

### Generation progress page
Edit `content/ui/he/progress.ts`.
Rotating `statusLines` and `storyLines` are plain string arrays — add or remove lines freely.

### Ready page / Reader
Edit `content/ui/he/success.ts`.
`READY` is the post-payment book-is-ready screen.
`READER` is the page-by-page reading experience.

### Checkout (Stripe product names)
Edit `content/ui/he/checkout.ts`.
`checkoutProductName()` and `checkoutProductDescription()` control what appears on the Stripe checkout page.

### Transactional email
Edit `content/ui/he/email.ts`.
Controls the book-ready email sent via Resend.

---

## How to import content in code

```typescript
// Import from the barrel:
import { COMMON, WIZARD, PROGRESS, READY, READER } from '@/content';
import { checkoutProductName, CHECKOUT_ADDONS }    from '@/content';
import { EMAIL }                                    from '@/content';

// Use:
const title = COMMON.siteTitle;
const subject = EMAIL.subject('תמר');   // → '✨ הסיפור של תמר מוכן!'
```

---

## The two-layer architecture

The static vanilla JS frontend (`HTML/`, `JS/`, `CSS/`) reads copy from **`JS/content.js`** at runtime via `window.CONTENT.he` and a `t()` helper.

The Next.js API layer and any future React components use the **TypeScript files in this directory**.

Both layers share the same Hebrew content — they are kept in sync manually. When making copy changes:
1. Edit the TypeScript file in `content/ui/he/`
2. Mirror the change in `JS/content.js` if it affects the static frontend

**Future plan**: When the static frontend is migrated to React/Next.js, `JS/content.js` will be deleted and this directory will be the single source of truth.

---

## Adding a second language

1. Create `content/ui/en/` (or another locale code) with the same file structure
2. Export from a locale-aware entry point, e.g. `content/index.ts` becomes:
   ```typescript
   export * from './ui/he/common';  // default
   // or: export * from `./ui/${locale}/common`;
   ```
3. The `t()` helper in `JS/content.js` already supports `window.CONTENT.en` — just add the matching JS object

---

## Adding A/B test copy variants

1. Add a variant key inside the relevant content file, e.g.:
   ```typescript
   export const LANDING = {
     hero: {
       h1:          'הילד שלכם מפחד?',      // control
       h1_variant_b:'הילד שלכם זקוק לעזרה?', // variant B
     }
   }
   ```
2. Select the variant in the component using a feature flag or experiment ID
