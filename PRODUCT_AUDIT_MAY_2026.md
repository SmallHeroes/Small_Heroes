# Small Heroes — Comprehensive Product Audit

**Date:** May 11, 2026
**Auditor:** CTO / Product Lead (Claude)
**Scope:** Full project — architecture, pipeline, content, UX/UI, performance, marketing, bugs, cleanup

---

## EXECUTIVE SUMMARY

Small Heroes is an AI-powered personalized children's storybook generator targeting Israeli parents. The product is functional end-to-end: wizard → payment → story → illustrations → reader, with optional audio, video, and PDF addons. The story bank covers 11 emotional categories with 66 base stories (198 including length variants).

**What's working well:** The core pipeline is solid — story bank matching, GPT Image generation with character DNA, audio narration with nikud, and the reader experience. Pricing is consistent across all files. Payment via PayMe is wired and functional.

**What needs attention:** SEO is completely absent (critical for marketing). Several content source-of-truth files have diverged. 2 story files are missing. PDF generator has a Hebrew fallback bug. Dead code and orphan files need cleanup.

**What's broken:** video.ts had duplicate corrupt code (fixed during this audit). `content/ui/he/` TypeScript files are severely outdated vs the live `content.js`. Style 03 is dead code. 6 MEDICAL stories are unreachable.

---

## 1. ARCHITECTURE & CODE HEALTH

### 1.1 What's Working Well

- **Clean separation of concerns:** `backend/providers/` for business logic, `backend/config/` for configuration, `backend/lib/` for utilities, `app/api/` for route handlers
- **No circular dependencies** detected in the import graph
- **All 7 debug routes properly guarded** with `NODE_ENV === 'production'` checks
- **Concurrency protection** is solid — in-memory lock set + DB-level lock prevents double-generation
- **LLM retry logic** with exponential backoff (3 retries, 2s/4s/8s delays)
- **Prisma singleton** pattern in `lib/prisma.ts`
- **Environment validation** in `lib/env.ts` with clear error messages

### 1.2 Architectural Issues

| # | Severity | Issue | File(s) | Impact |
|---|----------|-------|---------|--------|
| A1 | HIGH | `pipeline.ts` is 3,702 lines, `image.ts` is 3,226 lines — monolithic files | backend/providers/ | Maintenance risk, hard to review/debug |
| A2 | HIGH | `wizard.js` is 2,868 lines — all wizard logic in one file | public/JS/wizard.js | Single largest frontend maintenance risk |
| A3 | MEDIUM | Dual architecture — Next.js App Router for API but static HTML/vanilla JS for frontend | Throughout | React dep exists but only used for one page. Dual mental model for developers |
| A4 | MEDIUM | `generate/route.ts` is 1,442 lines with `triggerGeneration()` at 1,080 lines | app/api/generate/route.ts | Hard to test, debug, or modify individual stages |
| A5 | LOW | Two re-export shim files add indirection with no value | backend/providers/story.ts, backend/config/visual-system.ts | Minor clutter |
| A6 | LOW | `ignoreBuildErrors: true` in next.config.js — TypeScript errors don't block deploys | next.config.js | Type errors can ship to production silently |

### 1.3 Dependency Issues

| # | Severity | Issue | Action |
|---|----------|-------|--------|
| D1 | MEDIUM | `stripe` (22.0.2, ~2MB) still in package.json — webhook handler exists but PayMe is primary | Remove if Stripe is permanently retired |
| D2 | MEDIUM | `@sparticuz/chromium` in next.config.js `serverExternalPackages` but NOT in package.json | Remove from config (Puppeteer was replaced with pdf-lib) |
| D3 | LOW | No testing framework (jest, vitest, playwright) in deps | Add when ready for test coverage |
| D4 | LOW | .gitignore has duplicate entries (node_modules, .next, .tmp.driveupload) | Clean up |

---

## 2. PIPELINE & GENERATION

### 2.1 What's Working Well

- **4-stage pipeline** (story → images → audio → package) with independent failure handling per stage
- **Story bank** with pre-authored, QA'd stories and automatic name/gender substitution
- **Character DNA** system with structured identity locks (face, hair, clothing, signature)
- **Resemblance scoring** with anchor election for face consistency
- **Image retry** (3 attempts per page with rate-limit awareness)
- **Non-fatal addon stages** — audio, video, PDF failures don't crash the pipeline
- **Partial completion** — books with some failed pages still get delivered

### 2.2 Pipeline Bugs & Issues

| # | Severity | Issue | File | Impact |
|---|----------|-------|------|--------|
| P1 | **CRITICAL** | PDF generator fetches Heebo from Google Fonts at runtime. Fallback is Helvetica which **cannot render Hebrew**. Local Heebo font files exist at `backend/assets/fonts/` but are not used | backend/lib/pdf-generator.ts | If Google Fonts is slow/down, entire PDF text becomes empty boxes |
| P2 | HIGH | Audio has **zero retry logic** — single attempt, throws on non-200 | backend/providers/audio.ts | Transient ElevenLabs errors cause page audio loss |
| P3 | HIGH | Audio `fetch()` has **no timeout** — hung connection blocks pipeline indefinitely | backend/providers/audio.ts | Pipeline can stall forever |
| P4 | HIGH | Error details leaked to client in generate response: `details: error.message` | app/api/generate/route.ts:1437 | Internal errors (DB, stack traces) exposed to users |
| P5 | MEDIUM | PrismaClient duplicated (separate connection pool) in 2 files instead of using singleton | app/api/generate/status/route.ts:10, app/api/debug/replicate-image/route.ts:6 | Extra DB connections per cold start |
| P6 | MEDIUM | No image content safety retry — GPT Image prompt rejection = immediate page failure | backend/providers/image.ts | Pages fail silently when prompts trigger safety filters |
| P7 | MEDIUM | PDF RTL rendering — pdf-lib doesn't handle bidirectional text natively | backend/lib/pdf-generator.ts | Mixed Hebrew+numbers/Latin may display incorrectly |
| P8 | LOW | Scene translation timeout is 8 seconds — may be too aggressive for complex scenes | backend/providers/image.ts | Falls back to unrefined scene descriptions |
| P9 | LOW | No webhook retry for generation trigger — if initial trigger fails, requires manual intervention | app/api/webhooks/ | Rare but unrecoverable without manual action |

### 2.3 Video.ts Corruption (FIXED)

During this audit, I found and fixed:
- **Truncated file** ending at `return r` — appended missing `eadFile(outMp4)` + closing braces (commit `0484a6b9`)
- **Duplicate corrupt code** at lines 394-398 — remnant of the append fix, removed during this audit (needs commit)

---

## 3. CONTENT & STORIES

### 3.1 What's Working Well

- **66 base stories** across 11 emotional categories — comprehensive coverage
- **3 length variants** per story (10p, 15p, 20p)
- **All stories have nikud** for proper Hebrew TTS pronunciation
- **imageDirection metadata** per page for scene-accurate illustrations
- **Template variables** (`{{childName}}`, `{{companionName}}`) for personalization
- **Pricing is 100% consistent** across all files (wizard.ts, content.js, pricing.ts)

### 3.2 Content Issues

| # | Severity | Issue | Impact |
|---|----------|-------|--------|
| C1 | **CRITICAL** | **2 missing story files:** `batch-05_14a_20p.md` and `batch-05_15a_20p.md` | Users selecting stories 14a or 15a with "long" (20 pages) will get an error or crash |
| C2 | HIGH | **6 MEDICAL stories (Batch 06) unreachable** — no wizard topic, no ChallengeCategory enum, no companions | 18 story files (16a-18b × 3 lengths) are dead content that can never be served |
| C3 | HIGH | **`content/ui/he/wizard.ts` topics list is 3 categories short** vs live content.js (missing anger, sensitivity, general_fears) | Will break if React migration happens without update |
| C4 | HIGH | **`content/ui/he/landing.ts` diverged from `content.js`** — different hero text, missing trust/social proof fields, unused "fit" section | Landing.ts has better copy that's not being used; dual source of truth is dangerous |
| C5 | MEDIUM | **Style labels in `content/ui/he/wizard.ts` are stale** — old names that don't match current styles | Inconsistency if TypeScript content is ever used |
| C6 | MEDIUM | **Superpower lists completely diverged** between content.js (7 items) and backend/config/wizard.ts (10 items) | Different concept sets with no ID correspondence |
| C7 | MEDIUM | **Triple topic ID system** — content.js IDs, backend wizard.ts IDs, and ChallengeCategory enum values are all different | Fragile, error-prone mapping |
| C8 | LOW | All stories written in female gender — boys get machine-translated versions | Potential quality difference between girl/boy books |

### 3.3 Landing Page Copy Gaps

| Field | Status | Notes |
|-------|--------|-------|
| hero.socialProof | EMPTY | No customer count, no testimonial |
| hero.trustBadge | EMPTY | landing.ts has "הסיפור מרגיע ומחזק — לא מגביר חרדה" but content.js is empty |
| hero.ctaNote | EMPTY | landing.ts has privacy/data note but content.js is empty |
| faq.sub | EMPTY | No FAQ subtitle |
| sample.p1 | EMPTY | First paragraph of sample section empty |
| "fit" section | MISSING | Written in landing.ts but never added to index.html — valuable conversion content |

---

## 4. FRONTEND — UX & UI

### 4.1 What's Working Well

- **All 9 HTML pages are actively used** — no dead pages
- **All 15 JS files are actively used** — no dead files
- **All 9 CSS files are actively used** — no dead files
- **Full UX flow works:** landing → wizard → directions → generating → ready → reader → my-books
- **Wizard has excellent responsive coverage** — 6 breakpoints from 1200px to 640px
- **FAQ accordion, gallery toggle, and style picker** all functional
- **Reader** supports keyboard navigation, touch swipe, and audio playback

### 4.2 UX Issues

| # | Severity | Issue | File |
|---|----------|-------|------|
| U1 | MEDIUM | No "create new book" CTA on my-books page when user has books — must navigate back to landing | my-books.html |
| U2 | MEDIUM | Reader back link goes to `/ready` without params if JS fails | reader.html:29 |
| U3 | MEDIUM | `my-books.html` does not load `content.js` — hardcoded Hebrew strings instead of centralized content | my-books.html |
| U4 | LOW | Wizard step numbering in HTML comments doesn't match actual step IDs | wizard.html |

### 4.3 Responsiveness Gaps

| Page | Current Breakpoints | Gap |
|------|-------------------|-----|
| directions.css | 980px only | **Missing mobile (< 640px)** |
| my-books.css | **NONE** | Needs at least 640px mobile query |
| login.css | 480px only | Missing tablet breakpoint |
| generating.css | 640px only | Could use tablet (OK for MVP) |
| ready.css | 640px only | Could use tablet (OK for MVP) |

### 4.4 Dead Frontend Code

| # | File | Lines | What |
|---|------|-------|------|
| F1 | landing.js | 196-261 | Book history strip IIFE — targets HTML elements that no longer exist |
| F2 | landing.js | 123 | `setText('sampleP1', ...)` — element doesn't exist |
| F3 | landing.js | 46 | `setText('heroSocialProof', ...)` — element doesn't exist |
| F4 | bookHistory.js | `clearBookHistory()` | Called from dead history strip code |

---

## 5. SEO & MARKETING READINESS

### 5.1 SEO — Currently ZERO

This is the single biggest marketing blocker:

| Missing Item | Impact |
|-------------|--------|
| `<meta name="description">` on ALL pages | Google shows random text in search results |
| `<meta property="og:title/description/image">` | Social shares show blank previews |
| Twitter card meta tags | Same — blank previews on X/Twitter |
| `<link rel="icon">` (favicon) | No brand icon in browser tabs |
| `<link rel="canonical">` | Duplicate content risk |
| Structured data (JSON-LD) | No rich snippets in search |
| Fallback `<title>` tags | 4 pages have empty titles if JS fails |

**Minimum action:** Add meta description, OG tags, and favicon to `index.html`. This alone would dramatically improve social sharing and search appearance.

### 5.2 Marketing Readiness

| Area | Status | Notes |
|------|--------|-------|
| Value proposition | Good | Clear: personalized children's book for emotional challenges |
| Social proof | Missing | No testimonials, no customer count, no trust signals |
| Target audience section | Written but not shipped | "fit" section in landing.ts never added to HTML |
| Pricing clarity | Good | 3 tiers clearly presented |
| FAQ | Good | 6 relevant questions |
| CTA placement | Good | Multiple CTAs throughout landing page |
| Mobile experience | Mostly good | Directions and my-books pages need work |

---

## 6. PERFORMANCE

### 6.1 Frontend Performance Issues

| # | Severity | Issue | Action |
|---|----------|-------|--------|
| PF1 | HIGH | Google Fonts loaded on every page (Heebo, 7-9 weights) — render-blocking | Consider subsetting or self-hosting |
| PF2 | MEDIUM | Gallery loads 12 JPG images (6+6) on landing page | Already uses `loading="lazy"` — acceptable |
| PF3 | MEDIUM | Abraham font loaded as raw .ttf (~50% larger than WOFF2) | Convert to WOFF2 |
| PF4 | MEDIUM | All JS files loaded synchronously — no `defer` or `async` | Add `defer` to non-critical scripts |
| PF5 | LOW | No image optimization (WebP conversion, srcset) | Future improvement |
| PF6 | LOW | No CSS minification | Future improvement |

### 6.2 Backend Performance Issues

| # | Severity | Issue | Action |
|---|----------|-------|--------|
| PB1 | MEDIUM | Sequential image post-processing (one page at a time) | Could parallelize DB updates |
| PB2 | LOW | No caching on story-bank filesystem reads | Stories are static — could cache in memory |

---

## 7. SECURITY

| # | Severity | Issue | Action |
|---|----------|-------|--------|
| S1 | HIGH | OTP fallback code `'123456'` when RESEND_API_KEY not set | Gate behind `NODE_ENV !== 'production'` |
| S2 | MEDIUM | Rate limiter is in-memory only — resets on serverless cold start | Acceptable for MVP; needs Redis/Upstash at scale |
| S3 | MEDIUM | QA gate password (`SH2026qa!`) is weak | Acceptable for QA phase; remove before public launch |
| S4 | LOW | Debug routes included in production bundle (though properly guarded) | Consider conditional route inclusion |

---

## 8. ACCESSIBILITY

| # | Severity | Issue | Page(s) |
|---|----------|-------|---------|
| AC1 | HIGH | Wizard chips (difficulty/goal/helper/avoid) are not keyboard-accessible — div with onclick, no role="button", no tabindex, no onkeydown | wizard.html |
| AC2 | MEDIUM | FAQ buttons lack `aria-expanded` attribute | index.html |
| AC3 | MEDIUM | OTP inputs lack `aria-label` | login.html |
| AC4 | MEDIUM | No focus management when wizard steps change | wizard.js |
| AC5 | LOW | `--soft: #9692aa` text color may not meet WCAG AA contrast on white | main.css |

---

## 9. FILES TO DELETE (Cleanup List)

### 9.1 Orphan Images (confirmed unreferenced)

| File | Reason |
|------|--------|
| `public/Images/MagicBook.png` | Was in wizard step 1, removed in commit 6488fd69 |
| `public/Images/gallery/yuval.png` | Test/personal image, never referenced |
| `public/art-styles/classic.jpg` | Old style system, replaced |
| `public/art-styles/simple.jpg` | Old style system, replaced |

### 9.2 Dead Code to Remove

| File | Lines | What |
|------|-------|------|
| `landing.js` | 196-261 | Book history strip IIFE (HTML elements removed) |
| `landing.js` | 46, 123 | Dead `setText` calls to nonexistent elements |
| `content/ui/he/landing.ts` | Entire file | Diverged duplicate of content.js — dangerous dual source of truth |
| `content/ui/he/wizard.ts` | Entire file or update | Severely outdated vs content.js (missing 3 categories, wrong labels) |
| `content/ui/he/pricing.ts` | Review | May also be a stale duplicate |

### 9.3 Root Directory Clutter

**Phase briefs to move to `briefs/` or delete:**
18+ markdown files in root: `LANDING_PHASE_A_BRIEF.md`, `LORA_INTEGRATION_BRIEF.md`, `PHASE_3f_BRIEF.md` through `PHASE_5_HARDENING_BRIEF.md`, `PROJECT_HANDOFF.md`, `STORY_*.md`, `WIZARD_UX_FIXES_BRIEF.md`, various `phase-*` files, `stage-d-storyboard-prompt.md`

**Temp/junk files to delete:**
- `cleanup.ps1`, `fix-git-push.ps1` — utility scripts
- `.tmp_story_body.html` — temp file
- `chatgpt_export.zip` (194KB), `chatgpt_project.zip` (0 bytes)
- `Small_Heroes_Full_Spec.docx`, `Code_Review_Report.docx`
- `sample-yuval-style01-illustrated.png`, `sample-yuval-style02-realistic.png`

**Temp directories to delete:**
- `debug-story-validate/`, `test-outputs/`, `test-results/`, `proof-output/`
- `tmp/`, `tmp_storyboard_images/`, `tmp_storyboard_images_jpg/`
- `.tmp.driveupload/`, `.tmp.drivedownload/`
- `ziUjUPaB/`, `ziorbM5W/` — random-named temp dirs
- `voice-samples/`

### 9.4 Dead Config

| Item | File | Action |
|------|------|--------|
| `@sparticuz/chromium` in serverExternalPackages | next.config.js | Remove |
| Style 03 (`detailed_whimsical_world`) code — 275+ lines of prompt config | lib/styles.ts | Remove or flag as archived |
| `stripe` dependency | package.json | Remove if PayMe is permanent |
| Empty `public/Images/style-previews/` directory | public/ | Either populate or delete |

---

## 10. PRIORITIZED ACTION PLAN

### Phase A — Critical Fixes (blocks revenue / breaks user experience)

1. **Fix 2 missing 20p story files** — generate `batch-05_14a_20p.md` and `batch-05_15a_20p.md`
2. **Fix PDF Hebrew fallback** — use local `backend/assets/fonts/Heebo-Bold.ttf` instead of Google Fonts fetch
3. **Add audio retry + timeout** — 3 retries with backoff, 30s AbortSignal timeout
4. **Remove error details from production response** — generic message instead of `error.message`
5. **Fix OTP fallback code** — gate `'123456'` behind `NODE_ENV !== 'production'`
6. **Commit video.ts duplicate code fix** from this audit

### Phase B — SEO & Marketing (blocks growth)

7. **Add meta tags to index.html** — description, OG title/description/image, Twitter cards
8. **Add favicon** to all pages
9. **Add fallback `<title>` tags** to 4 pages with empty titles
10. **Add social proof** to hero section (even placeholder: "מאות הורים כבר יצרו ספר")
11. **Ship the "fit" section** from landing.ts to index.html
12. **Populate trust badge and CTA note** from landing.ts content

### Phase C — Code Cleanup (reduces bugs, improves maintainability)

13. **Delete orphan images** (MagicBook.png, yuval.png, old art-styles)
14. **Remove dead landing.js code** (book history strip, dead setText calls)
15. **Delete or consolidate `content/ui/he/` TypeScript files** — they diverged from content.js and are dangerous
16. **Move root markdown briefs** to `briefs/` folder
17. **Delete temp files and directories** from root
18. **Remove `@sparticuz/chromium`** from next.config.js
19. **Fix PrismaClient duplication** in generate/status and debug routes

### Phase D — UX Polish (improves conversion)

20. **Add mobile breakpoints** to directions.css and my-books.css
21. **Add "create new book" button** on my-books page
22. **Make wizard chips keyboard-accessible** (a11y)
23. **Add `defer` to non-critical scripts** (performance)
24. **Convert Abraham font to WOFF2** (performance)

### Phase E — Content Alignment (reduces technical debt)

25. **Decide on MEDICAL stories** — either add wizard topic + companions, or remove from story bank
26. **Align superpower and trait lists** between content.js and backend
27. **Unify topic ID system** — reduce from 3 different ID schemes to 1
28. **Remove or archive Style 03 dead code**
29. **Decide on Stripe** — remove dep or keep for fallback

---

## APPENDIX: FILE INVENTORY SUMMARY

### Frontend: 9 HTML, 9 CSS, 15 JS — all actively used
### Backend: ~15 TypeScript files in providers/config/lib — all actively used except 2 shims
### API Routes: 21 production + 9 debug — all properly wired and guarded
### Story Bank: 66 base stories, ~196 variant files (2 missing)
### Images: 12 gallery, 1 hero, ~47 companions, 4 orphans to delete
### Database: 17 Prisma models, 11 migrations
### Dependencies: 20+ production deps, 1 questionable (stripe)

---

*This audit was conducted by reading every file in the project, tracing all data flows, cross-referencing all content sources, and verifying all cross-file consistency. Findings are based on actual code inspection, not assumptions.*
