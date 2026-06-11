# Small Heroes — Project Bible

> ⚠️ **HISTORICAL (May 2026).** Current truth: **8/12/16 beats**, **16/24/32** display pages, **₪59/79/99**, MVP matrix **6×3×1** — see `outputs/DECISION_MEMO_launch_matrix_lock.md` + `CLAUDE.md`.

**Last updated:** May 12, 2026
**Repo:** https://github.com/SmallHeroes/Small_Heroes
**Live:** Vercel (Next.js)
**Status:** Pre-launch — pipeline functional, 5/36 companions have v3 stories, 66 v1 stories complete

---

## 1. Product Vision

Small Heroes ("גיבורים קטנים") is an AI-powered system that generates **personalized children's resilience storybooks** in Hebrew.

**Core proposition:** A parent tells us what their child is going through (fear of the dark, anger, new sibling, etc.), and we generate a complete illustrated storybook where the child is the protagonist, paired with an animal companion that guides them through the emotional challenge.

**Target audience:** Hebrew-speaking parents of children ages 3-8.

**What makes it different from generic AI storybooks:**
- Stories are built around **psychological resilience frameworks** — not just entertainment
- Each companion animal has a **deep personality profile** with coping strategies, humor styles, and collapse patterns
- Stories avoid functional/didactic endings — they aim for **emotional truth**, not lessons
- The child's name, gender, appearance, and specific fears are woven into a pre-written, QA'd story (not generated on-the-fly)

---

## 2. Business Model

### Pricing (ILS)

| Direction | Pages | Price |
|-----------|-------|-------|
| Bedtime (סיפור לפני שינה) | 10 | ₪59 |
| Adventure (הרפתקה) | 15 | ₪79 |
| Fantasy (מסע פלאי) | 20 | ₪99 |

### Add-ons

| Add-on | Price |
|--------|-------|
| Audio narration | ₪19 |
| Print-ready PDF | ₪19 |
| Video (includes narration) | ₪29 |
| Bundle (video + PDF) | ₪39 |

### Payment
- **Provider:** PayMe (Israeli payment processor)
- Prices stored in DB as agorot (ILS × 100)
- Fake payment mode available in dev only

---

## 3. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (app router) + vanilla JS for wizard |
| Backend | Next.js API routes (Node.js) |
| Database | Supabase (PostgreSQL) via Prisma ORM |
| File Storage | Supabase Storage (images, audio, video, PDF) |
| Image Gen | GPT Image (`gpt-image-1`) via OpenAI API — primary; Replicate (Flux + LoRA) as secondary |
| Story Gen | Pre-written story bank (v1 category-based + v3 companion-based) |
| LLM | GPT-5.3 Pro for character DNA, visual direction, gender swap |
| Audio | ElevenLabs (`eleven_v3`, Hebrew) |
| Video | FFmpeg + Sharp (server-side composition) |
| PDF | Puppeteer (server-side rendering) |
| Email | Resend API |
| Auth | Email OTP (6-digit code, 10-minute expiry) |
| Hosting | Vercel |
| Dev IDE | Cursor (AI-assisted coding) |

---

## 4. Architecture Overview

### 4-Stage Generation Pipeline

```
Order Created → Stage 1: Text → Stage 2: Images → Stage 3: Audio → Stage 4: Package
```

**Stage 1 — Text:**
- Selects a pre-written story from the story bank
- v3 path: companion-specific story (`story-bank/v3/{companionId}_{direction}.md`)
- v1 fallback: category-based random selection (`story-bank/raw/batch-XX_Na.md`)
- Substitutes `{{childName}}` and `{{companionName}}`
- If child gender doesn't match story gender → LLM gender-swap pass
- Assigns page templates (text zone positions)

**Stage 2 — Images:**
- Generates character DNA (structured visual descriptions via LLM)
- Builds anchor registry for all characters (child, companion, family)
- Generates cover image
- Generates per-page illustrations via GPT Image
- Each prompt includes: style contract, scene description, character DNA, composition rules, text zone reservation
- Post-processes images (crop, resize to presentation format)
- Analyzes luminance for text color (light/dark)

**Stage 3 — Audio (if enabled):**
- Per-page narration via ElevenLabs
- 3 voice options: Mom (warm), Dad (strong), Fairy (magical)
- Sleep mode: slower, softer pacing
- Optional video assembly via FFmpeg

**Stage 4 — Package:**
- PDF generation (if enabled) via Puppeteer
- Sets order status to `ready`
- Sends "book ready" email with links

### Key Data Flow

```
Wizard → Order (DB) → /api/generate → Story Bank → Character DNA → Image Prompts → GPT Image → Reader
```

---

## 5. Wizard Flow (13 Steps)

| # | Step | What it collects |
|---|------|-----------------|
| 1 | Welcome | CTA to start |
| 2 | Topic | Child's main challenge (12 categories) |
| 3 | Category follow-up | Dynamic sub-questions per topic |
| 4 | Companion | Animal companion selection (3 per category) |
| 5 | Child details | Name (required), age, gender, traits, photo |
| 6 | Superpower | Child's strengths |
| 7 | Difficulties | What's hard right now |
| 8 | Goals | Where the story should lead |
| 9 | Helpers | What helps the child feel whole |
| 10 | Avoid | Things to exclude |
| 11 | Package & Style | Direction (bedtime/adventure/fantasy), illustration style, add-ons, voice |
| 12 | Book name | Title + optional dedication |
| 13 | Summary & Payment | Order review, contact info, submit → PayMe checkout |

---

## 6. Challenge Categories (12)

| Category | ID | Example companions |
|----------|-----|-------------------|
| Fear of the dark | NIGHT_FEAR | bat_lily, fox_uri, owl_chacham |
| Anger & frustration | ANGER_FRUSTRATION | octopus_seara, bear_cub_gahal, salamander_lahav |
| Sensitivity & overwhelm | SENSITIVITY_OVERWHELM | fawn_tzvi, snail_sheli, kitten_mishi |
| Social difficulties | SOCIAL | panda_anat, bear_mati, hedgehog_rachi |
| Transitions & change | TRANSITION | chameleon_koko, squirrel_navad, turtle_beiti |
| Noise/siren fear | NOISE_FEAR | footstep_giant, song_whale, mole_sheket |
| General fears | GENERAL_FEARS | firefly_namit, bunny_ometz, mongoose_zariz |
| Self-confidence | SELF_CONFIDENCE | lion_shaket, butterfly_zohar, ant_harutza |
| New sibling | NEW_SIBLING | pelican_kis, dragon_dini, bee_ima |
| Focus & learning | FOCUS_LEARNING | hawk_had, dolphin_shahkan, captain_navat |
| Medical procedures | MEDICAL_PROCEDURE | starfish_kokhavi, seahorse_yam, gecko_rifa |
| Other | OTHER | puppy_neeman, parrot_tzivon, wolf_pup_siyar |

**Total: 36 companions** (3 per category).

---

## 7. Companion System

### Basic Data (all 36 companions)
Each companion has: `id`, `name` (Hebrew with nikud), `tagline`, `narrativeHook`, `image` path, `visualDescription` (English, for image generation).

### Deep Profiles (5 pilot companions)
Five companions have rich personality profiles used by the v3 story generation prompt:

| Companion | Category | Species |
|-----------|----------|---------|
| octopus_seara | ANGER_FRUSTRATION | Octopus |
| bat_lily | NIGHT_FEAR | Bat |
| chameleon_koko | SENSITIVITY_OVERWHELM | Chameleon |
| dolphin_shahkan | SOCIAL | Dolphin |
| fawn_tzvi | TRANSITION | Fawn |

**Deep profile fields:**
- **Identity:** name, gender, species, visualDescription
- **Narrative:** tagline, narrativeHook, habitat, abilities
- **Deep Personality:** personality, weaknesses, speechPattern, humorType, bodyLanguage, stressResponse, internalRules
- **Taste Bible:** comfortRitual, sensoryPalette
- **Personality Engine:** copingStrategy, collapsePattern, arcShape, quietPagePosition
- **Psychological Context:** meaning, coreNeed, avoid, resolution

---

## 8. Story Bank

### v1 — Category-Based (66 stories)
- Location: `story-bank/raw/`
- Naming: `batch-{NN}_{Na}.md` (e.g., `batch-01_1a.md`)
- 11 batches × 6 stories each = 66 base stories (15 pages each)
- Some have 10p and 20p variants (suffix `_10p`, `_20p`)
- Selection: random story matching the wizard's challenge category
- Generic — not companion-specific

### v3 — Companion-Specific (15 stories)
- Location: `story-bank/v3/`
- Naming: `{companionId}_{direction}.md` (e.g., `octopus_seara_adventure.md`)
- 5 companions × 3 directions = 15 stories
- All currently 15 pages (page count variants not yet generated)
- Written with deep companion personality, unique voice, humor, body language
- Selection: matched by companion ID + direction; falls back to v1 if no match

### Story File Format
```markdown
---
title: "הַיָּדַיִם שֶׁל הַלַּיְלָה"
companionId: octopus_seara
direction: bedtime
category: ANGER_FRUSTRATION
gender: male
pages: 15
---

storyStyle: ...
metaphor: ...
stakes: ...
emotionalArc: ...

--- Page 1 ---
[Hebrew text with nikud, {{childName}} variable]

imageDirection: wide_shot: [English scene description for GPT Image]
```

---

## 9. Illustration Styles

### Style 01 — Soft Hand-Drawn Storybook (מאוייר חם ועדין)
- **Look:** Adorable round cartoon characters, warm watercolor on cream paper, richly detailed backgrounds
- **Provider:** GPT Image (primary) or Replicate with LoRA
- **LoRA:** `REALISTART01` trigger word
- **DB value:** `pencil_watercolor`

### Style 02 — Expressive Painterly Storybook (אקוורל ריאליסטי)
- **Look:** Fine realistic watercolor portrait, real child proportions, luminous skin, bright and airy
- **Provider:** GPT Image (primary) or Replicate with LoRA
- **LoRA:** `REALISTART02` trigger word
- **DB value:** `whimsical_comic_fantasy`

### Style 03 — Detailed Whimsical World (dropped)
- Was ink-and-gouache mixed media
- Removed from wizard — GPT Image can't produce this style reliably
- Code reference cleaned up (LoRA set to null)

### Image Prompt Structure
Each page image prompt includes:
1. **Style contract** — rendering rules, color palette, texture, lighting
2. **Scene description** — from story's `imageDirection` field
3. **Character DNA** — structured visual descriptions (child, companion, family)
4. **Composition rules** — tight framing (60-70% character fill), text zone reservation (top 35%)
5. **Negative constraints** — no text, no letters, no watermarks

---

## 10. Reader

- **URL pattern:** `/book/{bookId}/read-v2`
- **Layout:** Single-page, full-bleed — one page fills the screen
- **Text overlay:** Text floats over the illustration in `top_clear` or `bottom_clear` zone
- **Text color:** Adaptive — dark or light based on image luminance analysis
- **Typography:** Heebo (body) + Abraham (display), Hebrew RTL
- **Navigation:** Prev/Next buttons, keyboard arrows, touch swipe
- **Audio:** Per-page MP3 auto-plays 1s after page turn; toggle button when available
- **Cover:** Full-bleed cover image with title overlay at bottom

---

## 11. Audio & Video

### Audio (ElevenLabs)
- Model: `eleven_v3`, language: Hebrew
- **3 voices:**
  - Mom (אמא) — warm, calm
  - Dad (אבא) — strong, warm
  - Fairy (פייה קסומה) — magical
- **Sleep mode:** Slower pacing, longer pauses, softer stability settings
- Per-page clips stored in Supabase Storage

### Video (FFmpeg)
- Server-side composition — no external API
- Each page: image (1080×1440) + text overlay (Sharp SVG) + audio
- Cover: 4s, pages with audio: dynamic, pages without: 5s
- Output: MP4 (H.264 + AAC), uploaded to Supabase Storage

---

## 12. Landing Page

Sections in order:
1. **Navbar** — logo, links (how it works / pricing / my books), CTA
2. **Hero** — headline + subheading + illustration + two CTAs
3. **Gallery** — style toggle (realistic/illustrated), 6 images per style, scrolling track
4. **Sample** — real book example with pull quote
5. **Why Us** — 3-card benefits grid
6. **How It Works** — 3-step process
7. **Pricing** — 3 direction cards on purple background (bedtime ₪59 / adventure ₪79 / fantasy ₪99)
8. **FAQ** — 6 accordion items
9. **Footer** — final CTA

All text injected via JS from `content.js` (Hebrew).

---

## 13. Database Schema (Key Models)

### Order
Core order record with: child details (name, age, gender, traits, photo), story config (topic, challenge items, outcome items, helper items, avoid items), product (storyLength, storyDirection, illustrationStyle, addons), pricing (basePrice, addonsPrice, totalPrice in agorot), payment (PayMe), generation status per stage (text, image, audio, package).

### UserAccount
Email + OTP auth. Fields: email, name. Relations: orders, sessions, otpCodes.

### GeneratedBook
Completed book with: title, coverImageUrl, pdfUrl, videoUrl, readUrl. Relations: pages (BookPage), audioAsset.

### BookPage
Per-page data: pageNumber, text, pageTemplate, textZone, lighting, textColorScheme, narrationText, audioUrl. Relation: imageAsset.

### ImageAsset
Per-page image: provider, prompt, url, presentationUrl, width, height, style.

---

## 14. File Structure (Key Paths)

```
Small_Heroes/
├── app/                          # Next.js app router
│   ├── api/
│   │   ├── generate/route.ts     # Main generation pipeline
│   │   ├── orders/route.ts       # Order creation
│   │   ├── checkout/route.ts     # PayMe checkout
│   │   ├── auth/                 # OTP login
│   │   └── categories/           # Dynamic category branching
│   ├── book/[id]/
│   │   ├── read-v2/              # Book reader
│   │   └── ready/                # "Your book is ready" page
│   └── my-books/                 # User's book library
├── backend/
│   ├── config/
│   │   ├── voices.ts             # ElevenLabs voice configs
│   │   └── wizard.ts             # Pricing config
│   ├── lib/
│   │   ├── email.ts              # Resend email
│   │   └── pipeline.ts           # Pipeline orchestration
│   ├── providers/
│   │   ├── story-bank-index.ts   # Story selection (v1 + v3)
│   │   ├── story-bank-loader.ts  # Story file parser
│   │   ├── audio.ts              # ElevenLabs integration
│   │   └── video.ts              # FFmpeg video generation
│   └── schema.prisma             # Database schema
├── lib/
│   ├── companions.ts             # 36 companion definitions
│   ├── styles.ts                 # Style contracts + pipeline profiles
│   ├── generate-image.ts         # GPT Image + Replicate providers
│   ├── promptBuilder.ts          # Image prompt assembly
│   ├── visualDirector.ts         # Scene → visual direction
│   └── categoryBranching.ts      # Wizard category logic
├── public/
│   ├── HTML/index.html           # Landing page
│   ├── JS/
│   │   ├── wizard.js             # Wizard logic
│   │   ├── content.js            # All Hebrew UI strings
│   │   ├── directions.js         # Direction card config
│   │   └── landing.js            # Landing page logic
│   └── CSS/                      # Stylesheets
├── story-bank/
│   ├── raw/                      # v1 stories (66 files)
│   └── v3/                       # v3 companion stories (15 files)
├── content/
│   └── index.ts                  # Server-side content strings
└── briefs/                       # Cursor implementation briefs
```

---

## 15. Current Status (May 12, 2026)

### What Works End-to-End
- Full wizard flow → payment → generation → reader → email
- Story bank v1 (66 stories, category-based) — live in production
- Story bank v3 (15 companion stories) — just wired in (Phase 11)
- GPT Image generation with style contracts
- Audio narration (3 voices + sleep mode)
- Video export (MP4)
- PDF generation
- Email OTP auth + My Books page
- Landing page with gallery, pricing, FAQ

### What's Done
- **Stories:** 66 v1 stories (11 categories × 6 each), 15 v3 stories (5 companions × 3 directions)
- **Companions:** 36 defined with basic data, 5 have deep personality profiles
- **Styles:** 2 active (illustrated + realistic watercolor), Style 03 dropped
- **Pipeline:** 4-stage generation fully functional
- **Reader:** Full-bleed single-page with text overlay, audio, navigation
- **Pricing:** Direction = page count model (bedtime/adventure/fantasy → 10/15/20p)
- **Payment:** PayMe integrated
- **Auth:** Email OTP
- **Deployment:** GitHub → Vercel, live

### What's Remaining

**HIGH PRIORITY — Content Gap:**
- 31 of 36 companions need deep profiles written
- 31 companions need v3 stories (3 directions each = 93 stories)
- v3 stories are all 15 pages — need 10p (bedtime) and 20p (fantasy) variants
- Companion card images need generation (36 cards, partially done)

**MEDIUM PRIORITY — Pipeline Quality:**
- Character consistency across pages still imperfect
- Visual Bible (locked character descriptions per book) — designed but not fully hardened
- Cover image sometimes doesn't match story content well
- PDF generation fails silently on Vercel (works locally)

**LOWER PRIORITY — Product Polish:**
- Story direction preview cards use static images (fine for now)
- HTML element IDs still use "length" naming (cosmetic)
- StoryDirection/StoryDirectionSet Prisma models still exist (legacy, functional)
- Gallery images need regeneration with latest style tuning
- Mobile layout needs more polish

**FUTURE:**
- Print-on-demand integration
- Multi-language support
- Subscription model
- More illustration styles
- Parent dashboard / reading analytics

---

## 16. Development Workflow

### Roles
- **Claude (Cowork):** CTO / Product Lead — architecture, planning, briefs, code review, direct fixes
- **Cursor:** Implementing engineer — receives briefs, writes code, commits
- **Guy:** Founder — product decisions, testing, feedback

### Process
1. Claude diagnoses problems and designs solutions
2. Claude writes a `CURSOR_BRIEF_PHASE_XX.md` with exact instructions
3. Guy passes the brief to Cursor
4. Cursor implements and reports back
5. Claude verifies the implementation
6. Git commit and push

### Conventions
- All responses in English (code + docs)
- Hebrew only in user-facing content
- Targeted commits per phase
- Briefs include: context, what to change, what NOT to change, testing checklist, commit message

---

## 17. Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Story approach | Pre-written bank, not real-time LLM | Quality control — resilience stories can't be mediocre |
| Image provider | GPT Image over Flux | Better scene understanding, no Hebrew issues, consistent style |
| Page count model | Direction = pages (bedtime=10, adventure=15, fantasy=20) | Simpler UX, clear value differentiation |
| Text on images | Overlay, not separate card | Feels like a real book, not an app |
| Auth | Email OTP, no passwords | Minimal friction for parents |
| Payment | PayMe (Israeli) | Local payment methods (credit cards, Bit) |
| Styles | 2 active (illustrated + watercolor) | Style 03 dropped — GPT Image can't produce ink-and-gouache reliably |
| LoRA | Trained but GPT Image is primary | LoRA useful for Flux fallback, not primary path |
| Story quality | v6 prompt with personality engine | 6 prompt iterations to reach emotional truth over functional resolution |

---

## 18. Psychological Framework

Stories use an **8-type solution taxonomy** (not mechanical archetypes):

| Type | Description | Example |
|------|-------------|---------|
| BUILD | Child constructs something that embodies the solution | Building a bridge of trust |
| SACRIFICE | Giving up something to gain something greater | Letting go of control |
| TRADE | Fair exchange that teaches reciprocity | Trading fear for curiosity |
| RULE_DISCOVERY | Finding a hidden rule that changes the game | Discovering that dark has sounds |
| WITNESS | Seeing someone else's struggle creates empathy | Watching the companion fail |
| INVERSION | The feared thing becomes the solution | The shadow becomes a friend |
| SLOW_ACCUMULATION | Many small moments create change | Tiny brave acts stack up |
| COLLAPSE_AND_REGROW | Breaking down precedes transformation | Falling apart to come back stronger |

Each companion's `copingStrategy` and `collapsePattern` determine which solution types feel natural for their stories.

---

## 19. Environment Variables (Key)

```
# Database
DATABASE_URL=postgresql://...

# Image Generation
OPENAI_API_KEY=...
GPT_IMAGE_QUALITY=high
REPLICATE_API_TOKEN=...
ENABLE_LORA=true
LORA_MODEL_STYLE_01=...
LORA_MODEL_STYLE_02=...

# Audio
ELEVENLABS_API_KEY=...

# Payment
PAYME_API_KEY=...
PAYME_API_BASE_URL=...

# Email
RESEND_API_KEY=...

# Auth
JWT_SECRET=...
OTP_EXPIRY_MINUTES=10

# Storage
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# Feature Flags
NEXT_PUBLIC_READER_V2=1
ENABLE_FAKE_PAYMENT=false (must be false in production)
```
