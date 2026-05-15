# Phase 10a — Direction = Page Count (Structural Pricing Change)

## Summary

Merge the direction picker with the length picker. Each direction now has a fixed page count:
- **bedtime** = 10 pages = ₪59
- **adventure** = 15 pages = ₪79
- **fantasy** = 20 pages = ₪99

The length picker step in the wizard is REMOVED. When a user picks a direction, the page count and base price are determined automatically.

## What's Already Done (by Cowork/Claude)

Config files have been updated with new prices:

1. **`backend/config/wizard.ts`** — Added `DIRECTION_PAGE_MAP`, updated `STORY_LENGTHS` labels/prices, updated `ADDON_PRICES` (video=29, bundle=39), updated `computePricing()` to accept optional `direction` param
2. **`public/JS/content.js`** — Updated landing page pricing cards (59/79/99, direction-based names), updated addon labels in wizard step s8 (video+קריינות=₪29, bundle=וידאו+הדפסה=₪39)
3. **`content/index.ts`** — Updated `checkoutProductDescription()` labels, updated `CHECKOUT_ADDONS` labels
4. **`public/HTML/wizard.html`** — Updated default price from ₪50 to ₪59

## What Cursor Needs to Do

### 1. REMOVE Length Picker from Wizard UI

**File: `public/JS/wizard.js`** (or wherever wizard step rendering lives)

The wizard currently has a step (s8/s9 area) where user picks style + length. Remove the length picker (`lengthTitle: 'כמה עמודים?'`). The style picker stays. The page count is now derived from the selected direction.

- Find where `STORY_LENGTHS` or `lengthTitle` is rendered in the wizard JS
- Remove the length cards/radio buttons
- The direction step already exists and sets `storyDirection` — this now also implicitly sets length

### 2. Wire Direction → Page Count in Order Creation

**File: `app/api/orders/route.ts`**

Currently line 221: `storyLength: product.length`

Change to derive `storyLength` from direction:
```typescript
import { DIRECTION_PAGE_MAP } from '@/backend/config/wizard';

// Map direction to legacy storyLength enum
const directionToLength: Record<string, 'short' | 'medium' | 'long'> = {
  bedtime: 'short',
  adventure: 'medium', 
  fantasy: 'long',
};

// In order creation:
storyLength: directionToLength[product.direction] ?? 'medium',
```

The DB still stores `StoryLength` enum (short/medium/long). We keep this for backward compat with existing orders. New orders just derive it from direction.

### 3. Wire Direction → Page Count in Generate Route

**File: `app/api/generate/route.ts`**

Line 445 area:
```typescript
const storyLength = (order.storyLength as 'short' | 'medium' | 'long') ?? 'medium';
```

This already works because we store the correct storyLength in the order. But also update the `STORY_LENGTHS` lookup for `expectedPageCount` in `app/api/generate/status/route.ts` line 127 — it should still work since we updated the pages in STORY_LENGTHS.

### 4. Update Checkout Route to Pass Direction

**File: `app/api/checkout/route.ts`**

Line 118-124: `computePricing()` call. Add direction:
```typescript
const pricing = computePricing({
  length: order.storyLength,
  direction: order.storyDirection,  // new — takes priority over length
  audioEnabled: order.audioEnabled,
  pdfEnabled: order.pdfEnabled,
  bundleEnabled: order.bundleEnabled,
  videoEnabled: order.videoEnabled,
});
```

Check if `order.storyDirection` exists in the Prisma schema. If not, it's stored in the wizard data JSON. Find where it's stored and pass it.

### 5. Update Wizard JS — Price Calculation

**File: `public/JS/wizard.js`**

The client-side price calculation needs to know: when a direction is selected, update the displayed base price. Currently it probably uses the length picker selection. Change to:
```javascript
const DIRECTION_PRICES = { bedtime: 59, adventure: 79, fantasy: 99 };
// On direction select:
basePrice = DIRECTION_PRICES[selectedDirection];
updatePriceDisplay();
```

### 6. Update Direction Cards UI

**File: direction cards component (wherever the 3 direction cards are rendered)**

Add price and page count to each direction card so users see what they're getting:
- bedtime card: add "10 עמודים · ₪59" 
- adventure card: add "15 עמודים · ₪79"
- fantasy card: add "20 עמודים · ₪99"

This replaces what the length picker used to show.

### 7. Update Landing Page Price Rendering

**File: `public/JS/landing.js`**

The pricing section renders cards from `content.js`. Make sure it correctly reads the new card data (kicker/name have changed). The cards now show direction names instead of "ספר קצר/בינוני/מלא".

### 8. Bundle Logic Change

**IMPORTANT**: The bundle addon is now video+PDF (not audio+pdf+video). Video already includes narration (it's ₪29 = video+audio). Bundle = video+pdf at ₪39 (saves ₪9 vs buying separately at ₪29+₪19=₪48).

Update anywhere that checks `bundleEnabled` logic:
- If bundle is selected: user gets video (which includes audio) + PDF
- If audio is selected alone: just narration, no video
- Video alone: narration + video slideshow

Check `wizard.js` for the addon toggle logic — the bundle checkbox should enable both video and PDF.

### 9. Remove Step References to Length

**Files: `public/JS/content.js`** 

- Remove `lengthTitle: 'כמה עמודים?'` from s8 (already in content, just make sure wizard.js doesn't reference it)
- Update wizard step microcopy s9 if it references length choice

### 10. Prisma Schema — Add storyDirection Field (if missing)

**File: `backend/schema.prisma`**

Check if `Order` model has a `storyDirection` field (type String, storing 'bedtime'|'adventure'|'fantasy'). If not, add it:
```prisma
storyDirection     String?  // 'bedtime' | 'adventure' | 'fantasy'
```

Run `npx prisma db push` after.

## Test Checklist

1. [ ] Landing page shows 3 pricing cards with ₪59/₪79/₪99
2. [ ] Wizard has NO length picker step
3. [ ] Direction selection shows price + page count on each card
4. [ ] Selecting bedtime → price shows ₪59, selecting fantasy → price shows ₪99
5. [ ] Addon prices: audio=₪19, video=₪29, PDF=₪19, bundle=₪39
6. [ ] Bundle = video + PDF (not audio + pdf + video)
7. [ ] Order saved with correct storyLength derived from direction
8. [ ] Checkout shows correct total
9. [ ] `next build` passes with no errors
10. [ ] Existing orders (with old prices) still load correctly

## Commit Message
```
feat: direction = page count — remove length picker, new pricing

bedtime=10p/₪59, adventure=15p/₪79, fantasy=20p/₪99
video+narration=₪29, bundle(video+PDF)=₪39
Remove length picker step from wizard
Direction cards now show price + page count
```
