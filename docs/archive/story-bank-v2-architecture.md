# Story Bank v2 — Complete Architecture

## 1. Core Decisions (Confirmed)

### 1.1 Companion-Specific Stories
Every story is written FOR a specific companion character. The companion's name, gender, species, habitat, abilities, and personality are hardcoded into the story text. No {{companionName}} placeholder needed.

Example: A story for סוסון ים (seahorse) features underwater elements, currents, coral. A story for חפרפרת שקט (mole) features tunnels, underground quiet, digging.

**Critical rule**: The CHILD is always the protagonist. The companion HELPS but doesn't dominate. The story is about the child's challenge. The companion's environment can flavor the setting, but the companion "pops up from there" — the story isn't SET in the companion's world unless it serves the child's arc.

### 1.2 Three Story Directions
Each companion gets 3 different stories, one per direction:

| Direction | Hebrew | Energy | Age Sweet Spot | Description |
|-----------|--------|--------|----------------|-------------|
| bedtime | סיפור לפני השינה | שקט, חם, בטוח | 3-4 | Home, bed, soft light, slow pace, hug, quiet |
| adventure | הרפתקה | פעולה, תנועה, גילוי | 5-6 | Going out, trail, forest, discovery, riddles |
| fantasy | סיפור בדיוני | דמיון, אבסורד, חופש | 7-9 | Broken rules, flying dog, other planets, upside-down |

**Note**: Age is a recommendation, not a lock. A 4yo can enjoy fantasy, an 8yo can want bedtime.

**Humor belongs in ALL three directions**, not as a separate direction.

**Renaming**: Current archetypes `connection` → `bedtime`, `adventure` → `adventure`, `courage` → `fantasy`.

### 1.3 Three Story Lengths
Each story has 3 file variants:
- **short** (10 pages) — `_10p.md` suffix
- **medium** (15 pages) — base, no suffix
- **long** (20 pages) — `_20p.md` suffix

Same story, different depth. The 10p is a condensed version, 20p is expanded.

### 1.4 Total Scope
- 36 companions × 3 directions × 3 lengths = **324 story files**
- 36 companions × 3 directions = **108 unique stories** (each with 3 length variants)

### 1.5 Features Removed
- **Additional characters** (wizard step 7) — REMOVED. Does not work with pre-written companion-specific stories. Cannot meaningfully integrate "Uncle David" into a story about a seahorse in the ocean.
- **{{companionName}} template** — REMOVED. Companion identity is hardcoded per story.
- **{{companionVerb}}** — NOT NEEDED. Companion gender is known at write time.

### 1.6 Features Added
- **Dedication page** — Optional. Parent writes a personal dedication that appears on the first page of the book. Example: "הספר הזה מוקדש לסבתא רות ולדוד יוסי, שתמיד שומרים על יואב"
- **Book name + Dedication** — New wizard step (before summary). Book name on top, dedication below (optional).

---

## 2. Template Variables

Only child-related variables remain:

```
{{childName}} — Child's name (string replacement)
```

**Gender handling**: Stories are written in one gender (male default). When child is female, the existing LLM-based gender swap converts all gendered Hebrew forms automatically. This is BETTER than verb templates because:
- A 15-page Hebrew story has 100+ gendered forms (verbs, adjectives, pronouns)
- Templating each one as {{childVerb:הלך}} makes text unreadable and error-prone
- The LLM swap already works, costs ~$0.02 per story, handles everything
- Companion gender is hardcoded (no swap needed) — LLM only swaps child forms

**Simplification from v1**: Loader now only needs to handle {{childName}} + LLM gender swap. No companion replacement. Cleaner, fewer bugs.

---

## 3. File Structure

```
story-bank/
  raw/
    # Naming: {companionId}_{direction}.md (15p base)
    # Naming: {companionId}_{direction}_10p.md
    # Naming: {companionId}_{direction}_20p.md
    
    # Example for seahorse_yam (MEDICAL_PROCEDURE):
    seahorse_yam_bedtime.md
    seahorse_yam_bedtime_10p.md
    seahorse_yam_bedtime_20p.md
    seahorse_yam_adventure.md
    seahorse_yam_adventure_10p.md
    seahorse_yam_adventure_20p.md
    seahorse_yam_fantasy.md
    seahorse_yam_fantasy_10p.md
    seahorse_yam_fantasy_20p.md
```

324 files total. Clear naming = no index ambiguity.

---

## 4. Pipeline Changes Required

### 4.1 Story Selection (story-bank-index.ts)
**Current**: `selectStoryFromBank(challengeCategory, storyLength)` → random story from category pool
**New**: `selectStoryFromBank(companionId, direction, storyLength)` → deterministic file lookup

```typescript
// New signature
function selectStoryFromBank(
  companionId: string,     // e.g. 'seahorse_yam'
  direction: StoryDirection, // 'bedtime' | 'adventure' | 'fantasy'
  storyLength: StoryLength   // 'short' | 'medium' | 'long'
): StoryBankSelection
```

No randomness needed. One companion + one direction + one length = exactly one file.

### 4.2 Story Loader (story-bank-loader.ts)
**Current**: Replaces {{childName}} and {{companionName}}, runs gender swap
**New**: Replaces {{childName}} only, runs gender swap for child only

Remove: `companionName` parameter, `{{companionName}}` replacement
Keep: `childName` replacement, `childGender` detection + LLM swap

### 4.3 Direction Archetypes (story-directions.ts)
**Current**: `'connection' | 'adventure' | 'courage'`
**New**: `'bedtime' | 'adventure' | 'fantasy'`

Rename everywhere: type definitions, UI labels, DB stored values, direction card generation, preview image prompts.

### 4.4 Direction Selection Flow
**Current**: Direction step generates 3 LLM-based direction cards with dynamic preview images. Story-bank path IGNORES direction selection (picks randomly).
**New**: Direction must drive story selection. User picks companion (step 4), then picks direction (bedtime/adventure/fantasy), then the specific story file is deterministically selected.

### 4.5 Wizard Changes
**Current 13 steps**: Welcome → Topic → Follow-up → Companion → Child → Superpower → Additional Characters → Challenges → Outcomes → Helpers → Avoids → Package → Summary+Checkout

**New flow** (remove step 7, add book name+dedication step):
1. Welcome
2. Topic
3. Category follow-up questions
4. Companion selection
5. Child details (name/age/gender/traits/photo)
6. Superpower
7. ~~Additional characters~~ → REMOVED
8. Direction selection (bedtime/adventure/fantasy) ← MOVED/CHANGED
9. Challenges
10. Desired outcomes
11. Helpers
12. Avoids
13. Package (length/style/addons)
14. Book name + Dedication (optional)
15. Summary + Checkout

**Note**: Direction selection should come AFTER companion (so we know which companion stories are available) and BEFORE challenges (so the story direction informs the rest of the wizard context). Actually, this ordering needs discussion — see section 5.

### 4.6 Generation Route (api/generate/route.ts)
**Current**: `selectStoryFromBank(challengeCategory, storyLength)` ignoring direction
**New**: `selectStoryFromBank(companionId, selectedDirection, storyLength)`

Must pass: companion ID + selected direction archetype + story length.

### 4.7 Additional Characters Cleanup
Remove from:
- Wizard step 7 (HTML + JS)
- `state.extraCharacters` in wizard state
- `familyContext.additionalCharacters` in payload
- `fetchAdditionalCharactersDNA` in story-bank-loader
- `generateStoryBankCharacterDNA` additional characters handling
- `buildCharacterSheet` supporting characters from additionalCharacters

### 4.8 Dedication System
New field in order: `dedication` (optional string, max ~200 chars)
New in reader: page 0 (before page 1) shows dedication text on a simple, warm background
New in PDF/video: include dedication page

### 4.9 DB Schema
- Add `dedication` field to Order
- Rename direction archetype values: connection→bedtime, courage→fantasy
- Remove `additionalCharacters` from characterAnchors JSON (or ignore)

---

## 5. Contradictions & Issues Found

### ⚠️ ISSUE 1: Direction Selection Timing
**Problem**: Currently the direction step (3 cards) generates expensive LLM-based preview images. With story-bank v2, directions are fixed (bedtime/adventure/fantasy) — we don't need LLM-generated direction cards.

**Solution options**:
A. Static direction cards — 3 fixed images per direction type (bedtime lamp, adventure trail, fantasy stars). Same for all orders. Cheap, fast, simple.
B. Semi-static — 3 base images, overlaid with companion illustration. No LLM needed.
C. Keep dynamic — generate 3 personalized preview images as before (most expensive, best UX).

**Recommendation**: A (static). Direction cards are a quick selection step, not a product page. The book itself is personalized. Save generation budget for the actual book.

### ⚠️ ISSUE 2: Gender Template vs LLM Swap
**Problem**: User proposed {{childVerb:הלך}} templates for gender handling. But Hebrew has 100+ gendered forms per story. Templating all of them makes text unreadable and nearly impossible to write/maintain.

**Decision**: Keep LLM-based gender swap. Write stories in male default, swap to female via LLM when needed. Cost: ~$0.02/story. Already works. Companion gender doesn't need swapping (hardcoded).

### ⚠️ ISSUE 3: 36 vs 12 Category Mapping
**Problem**: Current index maps 12 ChallengeCategories to 11 BankCategories. New index maps to 36 companion IDs. The category layer becomes irrelevant for story selection — companion ID is the key.

**Impact**: `CATEGORY_MAP` and `BankCategory` type in story-bank-index.ts become obsolete. The category is still used by the wizard (to show 3 companions per topic), but story selection is purely `companionId + direction + length`.

### ⚠️ ISSUE 4: Old Stories Migration
**Problem**: 66 existing story files become obsolete when v2 launches. They reference generic companions or hardcode wrong companion identities.

**Decision**: Keep old files in `story-bank/v1/` for reference. New files go in `story-bank/raw/` (same location, new naming). Clean cut — no migration, no gradual rollout. When v2 launches, old stories stop being served.

### ⚠️ ISSUE 5: Fantasy Direction — Companion Natural Fit
**Observation (positive)**: The fantasy direction gives MAXIMUM freedom for companion integration. A seahorse on an alien water planet? Perfect. A mole in an upside-down underground kingdom? Perfect. Fantasy lets the companion's nature shine without forcing realistic settings.

This is actually the direction where companion-story integration will be strongest and easiest to write.

### ⚠️ ISSUE 6: Direction Preview Images Need Redesign
**Problem**: Current `buildCoverMomentImagePrompt` generates elaborate direction preview images with specific scene compositions per archetype. The 'courage' archetype generates emotional two-character beats. This entire function needs rewriting for bedtime/adventure/fantasy archetypes.

**Impact**: `story-directions.ts` needs significant rewrite, not just renaming.

### ✅ NO CONTRADICTION: Page Variants
Current system already supports 10p/15p/20p as separate files with suffix naming. v2 uses the same mechanism. No change needed in how variants are stored or loaded.

### ✅ NO CONTRADICTION: Style System
Style 01 (illustrated) and Style 02 (realistic) work independently of story content. Story-bank v2 doesn't affect the style pipeline at all.

### ✅ NO CONTRADICTION: Visual Bible / Image Generation
Image generation reads from story page metadata (imageDirection, imageSubject). This metadata is embedded in each story file. Companion-specific stories will have companion-appropriate imageDirection naturally. No pipeline change needed.

---

## 6. Writing Guidelines for New Stories

### 6.1 Golden Rules
1. **CHILD IS THE HERO** — Every story is about the child overcoming their challenge. The companion helps, guides, models — but the child acts.
2. **Companion is ORGANIC, not forced** — A mole doesn't mean the story is set underground. The mole pops up from underground. The setting serves the child's story.
3. **Companion-specific behavior** — Seahorse swims, firefly glows, giant shakes the ground, owl sees in the dark. Use the companion's NATURE, not just their name.
4. **Humor in every direction** — Bedtime can be funny-warm. Adventure can be funny-exciting. Fantasy can be funny-absurd. Humor is a tool, not a genre.
5. **Active resolution** — The child DOES something at the climax. Not just "understood" or "felt better." Physical, concrete action.

### 6.2 Per-Direction Guidelines

**Bedtime (שינה)**
- Indoor, home, evening/night
- Slow pace, short sentences, repetitive rhythm
- Sensory: warmth, softness, quiet sounds
- Resolution: child feels safe, calm, ready to sleep
- Companion is soothing, gentle, reassuring

**Adventure (הרפתקה)**
- Outdoor, movement, discovery
- Fast pace, variety of settings (2-3 locations)
- Sensory: wind, colors, textures, smells
- Resolution: child overcomes obstacle through action
- Companion is guide, partner, co-explorer

**Fantasy (בדיוני)**
- Rules broken, anything goes
- Surprising, absurd, imaginative
- World-building: unique rules, unexpected physics
- Resolution: creative/lateral thinking, not brute force
- Companion's nature is amplified (seahorse controls all water, mole tunnels between dimensions)

### 6.3 Template
```markdown
---
title: "שם הסיפור"
companionId: seahorse_yam
direction: bedtime
category: MEDICAL_PROCEDURE
gender: male
pages: 15
---

## Page 1
text: "טקסט עמוד 1 עם {{childName}} כגיבור"
imageDirection: "תיאור סצנה לאיור"
imageSubject: "נושא מרכזי"
narrationText: "טקסט לקריינות"

## Page 2
...
```

### 6.4 Gender Convention
- Write all stories in **male** form (default)
- LLM gender swap handles female automatically
- {{childName}} is the only template variable
- Companion gender is hardcoded (matches companion definition)

---

## 7. Implementation Order

### Phase A: Infrastructure (Cursor)
1. Rename direction archetypes: connection→bedtime, courage→fantasy
2. Remove additional characters from wizard + pipeline
3. Add book name + dedication wizard step
4. Rewrite story-bank-index for companion-based selection
5. Simplify story-bank-loader (remove companionName)
6. Add dedication to reader + PDF + video
7. Direction card redesign (static or semi-static)

### Phase B: Story Writing (Claude + ChatGPT)
1. Write 108 unique stories (36 companions × 3 directions)
2. Generate 10p and 20p variants for each
3. QA all 324 files

### Phase C: Integration & Testing
1. Wire new stories into pipeline
2. Test all 12 categories end-to-end
3. Verify gender swap works with new format
4. Verify images match companion-specific scenes

---

## 8. Resolved Decisions (2026-05-11)

1. **Direction preview images**: STATIC. Faster, cheaper, simpler.
2. **Wizard step order**: Direction comes AFTER companion, BEFORE challenges. Flow: Topic → Follow-up → Companion → Direction → Child details → Challenges → Outcomes → Helpers → Package → Book name + Dedication → Summary.
3. **Gender**: Male default. LLM swap to female when child is girl. Companion gender hardcoded (no swap needed). No {{childVerb}} templates — impractical in Hebrew.
4. **All open questions are closed. Ready to begin Phase B (story writing).**
