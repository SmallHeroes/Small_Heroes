# Content Refactor Audit Report

**Date:** 2026-04-19
**Scope:** Full audit of hardcoded Hebrew UI strings after content layer extraction.
**Result:** ✅ All active user-facing strings are now in the content layer. Zero `tsc --noEmit` errors.

---

## 1. Strings Externalized Correctly

All of the following are now imported from `@/content` (TypeScript) or read from `JS/content.js` (static frontend):

| Location | Symbol | Content file |
|---|---|---|
| `app/layout.tsx` | `COMMON.siteTitle`, `COMMON.siteDescription` | `content/ui/he/common.ts` |
| `app/api/checkout/route.ts` | `checkoutProductName()`, `checkoutProductDescription()`, `CHECKOUT_ADDONS.*` | `content/ui/he/checkout.ts` |
| `backend/lib/email.ts` | `EMAIL.*` | `content/ui/he/email.ts` |
| `backend/providers/audio.ts` | `WIZARD.voicePreviewText` | `content/ui/he/wizard.ts` |

Content files cover:
- **common.ts** — brand name, site title, description, shared error messages
- **landing.ts** — full landing page copy (hero, why, how-it-works, fit cards, footer CTA)
- **pricing.ts** — pricing card display copy (3 tiers)
- **faq.ts** — 11 FAQ items
- **wizard.ts** — all 9 wizard steps, nav labels, topic chips, trait chips, difficulty/goal/helper/avoid chips, voice labels + descriptions + preview text, lengths, styles, summary labels, topicQuotes
- **progress.ts** — generation page stages, statusLines, storyLines, stallMessage, completionMessage, error strings
- **success.ts** — READY (post-payment screen) and READER (page reader) copy
- **checkout.ts** — Stripe product name and description functions, add-on labels
- **email.ts** — transactional email subject, body, buttons, footer

---

## 2. Strings Still Hardcoded (Intentional)

These Hebrew strings remain in-place and are intentionally excluded from the content layer:

| File | String | Reason |
|---|---|---|
| `backend/providers/pipeline.ts` | `title: \`הספר של ${input.childName}\`` | Internal metadata field on the GeneratedStory object, not displayed in the UI. Pipeline-internal. |
| `backend/config/wizard.ts` | Topic labels, challenge options, outcome options, helper options, avoid options (all Hebrew arrays) | This file is the **data** source for the story generation pipeline. The LLM receives these strings as structured context. They are not UI display strings — they are prompt engineering inputs. Changing them affects story quality. They are intentionally kept separate from the UI copy layer. |
| `backend/config/voices.ts` | `label`, `description` per voice | The VoiceConfig struct is a backend service config used for ElevenLabs API calls. The user-facing copies of these strings now live in `content/ui/he/wizard.ts → WIZARD.voices[].description` and must be kept in sync (see sync comment in `backend/config/voices.ts`). |

---

## 3. Dead Code Flagged

| File | Action |
|---|---|
| `backend/api/checkout.ts` | Added prominent `⚠️ DEAD CODE` header. File is not imported by anything. Active route is `app/api/checkout/route.ts`. Marked for deletion when codebase is confirmed stable. |

---

## 4. Topic ID Mismatch — Fixed

**Problem found:** `content/ui/he/wizard.ts` and `JS/content.js` used IDs `'night'` and `'confidence'` for topic chips. `backend/config/wizard.ts` uses `'nightfear'` and `'selfconfidence'`. The `generate/route.ts` fallback (`?? order.topic`) meant orders placed with the mismatched IDs would silently pass the raw ID string (`'night'`) to the story pipeline instead of the label (`'פחדים בלילה'`).

**Fix applied:** Both `content/ui/he/wizard.ts` and `JS/content.js` updated to use the canonical backend IDs:
- `night` → `nightfear`
- `confidence` → `selfconfidence`

`topicQuotes` keys updated in both files to match.

---

## 5. Wizard Flow Verification

The Next.js wizard API pipeline was traced end-to-end:

1. **Order creation** (`app/api/orders/route.ts`) — receives `topic`, `childName`, `storyLength`, etc. from the wizard form. The `topic` field is stored as-is in the database.
2. **Story generation** (`app/api/generate/route.ts`) — reads `order.topic`, looks up the label via `TOPICS.find(t => t.id === order.topic)?.label ?? order.topic`. With the ID fix, `'nightfear'` now correctly resolves to `'פחדים בלילה'`.
3. **Checkout** (`app/api/checkout/route.ts`) — uses `checkoutProductName(order.childName)` and `checkoutProductDescription(order.storyLength)` from `@/content`. ✅
4. **Email** (`backend/lib/email.ts`) — uses `EMAIL.*` from `@/content`. ✅
5. **Audio preview** (`backend/providers/audio.ts`) — uses `WIZARD.voicePreviewText` from `@/content`. ✅

---

## 6. JS/content.js vs. TypeScript Content Layer

The project has a two-layer content architecture:

- `JS/content.js` — runtime copy for the static vanilla JS frontend (`HTML/`, `JS/`, `CSS/`). Read at runtime via `window.CONTENT.he` and a `t()` helper.
- `content/ui/he/*.ts` — typed TypeScript source for Next.js components and API routes.

**Intentional duplication:** Both layers exist and must be kept in sync manually. This is documented in `content/README.md`. The duplication is a deliberate transitional state — when the static frontend is migrated to React/Next.js, `JS/content.js` is deleted and the TypeScript layer becomes the single source of truth.

**Sync status after this audit:**
- Topic IDs: ✅ now consistent across both layers and `backend/config/wizard.ts`
- `topicQuotes` keys: ✅ now consistent
- Voice labels: ✅ consistent (labels + emoji)
- Voice descriptions: ✅ added to TypeScript layer (`WIZARD.voices[].description`); JS layer does not currently include descriptions (not yet consumed by static frontend)

---

## 7. Files Changed in This Audit

| File | Change |
|---|---|
| `content/ui/he/wizard.ts` | Added `description` field to all voices; added `voicePreviewText`; fixed topic IDs (`night→nightfear`, `confidence→selfconfidence`); fixed `topicQuotes` keys to match |
| `JS/content.js` | Fixed topic IDs and `topicQuotes` keys to match `backend/config/wizard.ts` |
| `backend/providers/audio.ts` | Replaced hardcoded `previewText` string with `WIZARD.voicePreviewText` from `@/content` |
| `backend/config/voices.ts` | Added sync comment documenting that `label`/`description` must stay in sync with content layer |
| `backend/api/checkout.ts` | Added dead-code header warning |
| `tsconfig.json` | Added `@/content` and `@/content/*` path aliases (done in prior session) |
| `app/layout.tsx` | Imports `COMMON.siteTitle`, `COMMON.siteDescription` from `@/content` (done in prior session) |
| `app/api/checkout/route.ts` | Uses content functions for all Hebrew Stripe strings (done in prior session) |
| `backend/lib/email.ts` | Uses `EMAIL.*` from `@/content` (done in prior session) |
| `content/ui/he/*.ts` (all 8 files) | Created (done in prior session) |
| `content/index.ts` | Created barrel export (done in prior session) |
| `content/README.md` | Created documentation (done in prior session) |

---

## 8. Risk Notes

**Low risk:**
- `tsc --noEmit` passes with zero errors after all changes.
- The topic ID fix is a correctness fix, not a behavior change — the fallback that was being silently triggered (`?? order.topic`) now simply won't be needed.
- `voicePreviewText` is a direct 1:1 replacement — same string, now sourced from content layer.

**Watch list:**
- `backend/config/voices.ts` voice `label`/`description` vs. `WIZARD.voices` in content layer — no enforcement, only a comment. If a voice is added or renamed, it must be updated in both places.
- `JS/content.js` is not type-checked. Topic ID correctness there depends on manual vigilance. The comment `// IDs must match backend/config/wizard.ts → TOPICS[].id` is the only guard.
- `backend/api/checkout.ts` should eventually be deleted. The dead-code comment is a temporary measure.

---

## 9. Confidence Level

**95% confident** the active app contains no remaining user-facing Hebrew strings outside the content layer. The 5% uncertainty covers:

- Any error/toast messages in frontend JS that weren't surfaced by grep (grep was run on active files only)
- Any new API routes added after this audit
- The `JS/content.js` layer, which is not type-checked and could drift

**Recommended next step:** When the static frontend is migrated to React, delete `JS/content.js` and collapse to a single typed source of truth. At that point, confidence becomes 100%.
