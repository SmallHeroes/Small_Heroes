# Part 2a — Style registry audit (CTO checkpoint)

**Date:** 2026-05-25 · **Status:** REPORT ONLY — no id/DB changes applied

## Mismatch summary

| Layer | Style 01 | Style 02 (locked + Phase 2) | Wizard today |
|-------|----------|-----------------------------|--------------|
| Canonical id | `soft_hand_drawn_storybook` | `detailed_whimsical_world` | `expressive_painterly_storybook` |
| User label (stale) | מאוייר חם / pencil | עולם קסום (target) | אקוורל ריאליסטי |
| Image engine | Flux + LoRA `REALISTART01` | **gpt-image-2** style-reference (`PHASE2_STYLE02_BOOK_PIPELINE`) | Same as wizard id → Flux path |
| DB enum | `pencil_watercolor` | `detailed_whimsical_world` | `whimsical_comic_fantasy` |

**Root issue:** Locked Style 02 and Phase 2 use `detailed_whimsical_world`, but the wizard offers `expressive_painterly_storybook`, which maps to DB `whimsical_comic_fantasy` and the old “realistic watercolor” Flux profile — not the gpt-image-2 cinematic path.

## `lib/styles.ts` findings

- **`WIZARD_STYLE_ORDER`** lists only `soft_hand_drawn_storybook` + `expressive_painterly_storybook`. `DETAILED_WHIMSICAL_WORLD` is in `STYLE_REGISTRY` but **excluded from wizard** (comment: gpt-image-1 ink-and-gouache failure).
- **`STYLE_TO_DB_MAP`:** expressive → `whimsical_comic_fantasy`; detailed_whimsical → `detailed_whimsical_world`.
- **`LEGACY_STYLE_INPUT_MAP`:** `detailed` alias → Style 01 (comment “retired”) — risky if old orders used `detailed`.
- **`public/JS/wizard.js`:** `detailed_whimsical_world` routed to `soft_hand_drawn_storybook` (wrong for new books).
- **`shouldUseStyle02Phase2Path`:** only triggers on `detailed_whimsical_world` + env flag — wizard selections never hit Phase 2 today.

## Database (`IllustrationStyle` enum)

Values in schema: `pencil_watercolor`, `whimsical_comic_fantasy`, `detailed_whimsical_world`, `realistic_illustrated` (legacy).

Existing orders likely store **`whimsical_comic_fantasy`** for Style 02 picks (wizard id → DB mapping). Rows with **`detailed_whimsical_world`** may exist only from dev/story-bank tests.

## Proposed realignment (pending CTO sign-off)

### End state (two product styles)

| | Id | DB value | Engine |
|---|-----|----------|--------|
| רך וחמים | `soft_hand_drawn_storybook` | `pencil_watercolor` | Flux (unchanged) |
| עולם קסום | `detailed_whimsical_world` | `detailed_whimsical_world` | gpt-image-2 Phase 2 path |

### Code changes (after approval)

1. **`WIZARD_STYLE_ORDER`:** replace `EXPRESSIVE_PAINTERLY_STORYBOOK` with `DETAILED_WHIMSICAL_WORLD`.
2. **`LEGACY_STYLE_INPUT_MAP`:** map `expressive_painterly_storybook` + `whimsical_comic_fantasy` → `detailed_whimsical_world` (read path for old orders).
3. **`STYLE_TO_DB_MAP`:** `detailed_whimsical_world` → `detailed_whimsical_world` (already); remove expressive as primary.
4. **`wizard.js`:** stop remapping `detailed_whimsical_world` to Style 01; map old `expressive_painterly_storybook` to `detailed_whimsical_world` for preview images if needed.
5. **`content.js` + `WIZARD_ILLUSTRATION_STYLES` labels** — Part 2b string pass.
6. **Retire dead third style entries** from wizard-facing lists only; keep legacy map entries for historical orders.

### Data migration?

| Scenario | Recommendation |
|----------|----------------|
| Orders with `whimsical_comic_fantasy` | **No destructive migration.** Keep enum value; normalize on read to `detailed_whimsical_world` for regeneration. Optional one-time SQL update only if Guy wants DB cleanliness. |
| Orders with `detailed_whimsical_world` | Already correct. |
| New wizard selections | Write `detailed_whimsical_world` to DB after code change. |

**Risk:** Re-rendering old `whimsical_comic_fantasy` books with Phase 2 will change visual style (intended once Style 02 is product-official).

## Can wizard Style 02 id become `detailed_whimsical_world` cleanly?

**Yes, with the mapping above** — no new enum value required (`detailed_whimsical_world` already exists in Prisma). Main work is wizard order + legacy aliases + removing wizard.js misroute + Phase 2 gate alignment (already keyed on `detailed_whimsical_world`).

## STOP

**Do not apply Part 2b or DB migrations until CTO signs off on this proposal.**
