/**
 * Recipe loader + synthesis utilities for v0.5 Story Composer.
 *
 * Scope of this module (#168):
 *   1. loadRecipe()           — look up a hand-authored Recipe by (companion, direction, age tier).
 *                              Returns null if no recipe is registered. NEVER calls an LLM.
 *   2. pickVariations()       — deterministically resolve variationSlots based on
 *                              child input so the same child gets a stable texture.
 *   3. synthPlanFromRecipe()  — build a Plan-shaped object equivalent to what
 *                              the Plan LLM would have produced, from the Recipe.
 *                              This is the bypass that makes "recipe mode" work
 *                              without touching downstream stages.
 *
 * NOT in scope here:
 *   - reroll budget caps        → #172
 *   - mustInclude/forbidden validators → #170
 *   - Author prompt rework      → #169
 *   - bedtime / fantasy recipes → #175 / #176
 *
 * IMPORTANT: this module never generates a Recipe via an LLM. If no Recipe
 * matches, callers must either fall back to the legacy pipeline or throw.
 */

import type {
  AgeTier,
  PageCard,
  ProductionRecipe,
  RecipeVariationSlots,
  StoryDirection,
} from './recipe-types';
import { bollyAdventureAge5Recipe } from './bolly_adventure_age_5';
import { bollyBedtimeAge5Recipe } from './bolly_bedtime_age_5';
import type {
  BeatMapEntry,
  GenerateInput,
  HookContract,
  MomentContract,
  Plan,
  VisualPacingMap,
} from '../types';
import type { RecipeContract } from '@/lib/story-validators';

// ─────────────────────────────────────────────────────────────────────────
// REGISTRY — manually curated. No LLM-generated recipes. Add new recipes
// here only after the corresponding .ts file has been reviewed.
// ─────────────────────────────────────────────────────────────────────────
const REGISTRY: ProductionRecipe[] = [
  bollyAdventureAge5Recipe,
  bollyBedtimeAge5Recipe,
];

export interface RecipeLookupKey {
  companionId: string;
  direction: StoryDirection;
  ageTier: AgeTier;
}

/** Map childAge (years) → recipe AgeTier. Returns null if out of MVP range. */
export function ageToTier(age: number): AgeTier | null {
  if (age >= 3 && age <= 4) return '3-4';
  if (age >= 5 && age <= 6) return '5-6';
  if (age >= 7 && age <= 8) return '7-8';
  return null;
}

/**
 * Look up a Recipe by (companion, direction, ageTier).
 * Returns null when no recipe is registered for that combo — callers decide
 * whether to fall back to the legacy LLM pipeline or fail.
 */
export function loadRecipe(key: RecipeLookupKey): ProductionRecipe | null {
  const match = REGISTRY.find(
    (r) =>
      r.companionId === key.companionId &&
      r.direction === key.direction &&
      r.ageTier === key.ageTier
  );
  return match ?? null;
}

/**
 * Deterministic variation picker.
 *
 * Same `(childName, childAge, direction)` → same picks across reruns.
 * Different children get different textures so 100 books from the same
 * recipe don't read identically.
 */
export function pickVariations(
  recipe: ProductionRecipe,
  input: Pick<GenerateInput, 'childName' | 'childAge' | 'direction'>
): Partial<Record<keyof RecipeVariationSlots, string>> {
  const seed = fnv1aHash(`${input.childName}|${input.childAge}|${input.direction}`);
  const picks: Partial<Record<keyof RecipeVariationSlots, string>> = {};
  let rolling = seed;
  for (const [slotName, candidates] of Object.entries(recipe.variationSlots)) {
    if (!candidates || candidates.length === 0) continue;
    const idx = Math.abs(rolling) % candidates.length;
    picks[slotName as keyof RecipeVariationSlots] = candidates[idx];
    // Rotate the seed so different slots pick independent values
    rolling = fnv1aHash(`${rolling}|${slotName}`);
  }
  return picks;
}

/**
 * Build a Plan-shaped object from a Recipe + resolved variations.
 *
 * The shape exactly matches what `runPlan()` would have returned, so
 * downstream stages (validatePlan, runDraft, validateStory, Y-lite) work
 * unchanged. This is the "Recipe replaces ONLY Plan LLM" guarantee.
 */
export function synthPlanFromRecipe(
  recipe: ProductionRecipe,
  variations: Partial<Record<keyof RecipeVariationSlots, string>>
): Plan {
  const beatMap: BeatMapEntry[] = recipe.pageCards.map((card) =>
    pageCardToBeat(card, variations)
  );

  // The Moment Contract anchors on the resilience-arc center.
  // For Bolly Adventure that's p9 (Bolly closes) → p10 (child mirrors).
  // We expose p9's mechanic as the canonical moment.
  const momentPage = pickMomentPage(recipe);
  const momentCard = recipe.pageCards.find((c) => c.page === momentPage);
  const moment: MomentContract = {
    page: momentPage,
    type: 'transformation',
    physicalAction: momentCard?.companionAction ?? '',
    companionSignature: 'closes into a ball, then opens slowly',
    childBodyResponse: momentCard?.childBodyState,
    residue: variations.stickerType,
  };

  // Hook contract — declare ONLY pages where a hook element (sound or
  // object) is actually required by the recipe's mustInclude.
  //
  // Earlier bug: we declared every page where the companion *name* appears
  // in mustInclude. The hookAppearances validator then required the hook
  // sound/object on each of those pages, which the recipe never asked the
  // Author to write. Result: 7 false BLOCKING findings per story.
  //
  // The correct semantics: hookContract.appearsOnPages == pages where the
  // VALIDATOR should enforce a hook element. That equals the pages where
  // the recipe itself mandates one.
  const hookSound = recipe.companionId === 'bolly_armadillo' ? 'טוּמְפּ' : '';
  const hookObject = variations.medicalObject ?? '';
  const hookTokens = [hookSound, hookObject].filter(Boolean);
  const hookContract: HookContract = {
    sound: hookSound || undefined,
    phrase: undefined,
    microAction: undefined,
    object: hookObject || undefined,
    appearsOnPages: recipe.pageCards
      .filter((c) =>
        c.mustInclude.some((m) => hookTokens.some((t) => m.includes(t)))
      )
      .map((c) => c.page),
  };

  // PreserveList seeds = canonical anchors that any reroll/repair must keep.
  // For recipe mode this is academic (no editorial repair), but downstream
  // validators may still consult it.
  const preserveListSeeds = Array.from(
    new Set([
      'בּוֹלִי',
      hookSound,
      variations.medicalObject ?? '',
      variations.stickerType ?? '',
    ])
  ).filter(Boolean);

  // Visual pacing map: derive from dramaticRole.
  const visualPacingMap = buildPacingMap(recipe.pageCards);

  return {
    beatMap,
    momentContract: moment,
    hookContract,
    preserveListSeeds,
    visualPacingMap,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function pageCardToBeat(
  card: PageCard,
  variations: Partial<Record<keyof RecipeVariationSlots, string>>
): BeatMapEntry {
  const obj = card.requiredObjectSlot ? variations[card.requiredObjectSlot] : undefined;
  return {
    pageNumber: card.page,
    location: card.imageIntent.slice(0, 80),
    childAction: composeChildAction(card, obj),
    companionAction: card.companionAction,
    emotionalRead: card.childBodyState,
    wordCountTarget: card.targetWords,
  };
}

function composeChildAction(card: PageCard, resolvedObject: string | undefined): string {
  // The Author prompt (in #169) will consume the richer PageCard directly.
  // For #168 we keep the synthetic Plan structurally compatible — feed the
  // requiredEvent verbatim, with the resolved object inlined when relevant.
  if (resolvedObject) {
    return `${card.requiredEvent} [${card.requiredObjectSlot}: ${resolvedObject}]`;
  }
  return card.requiredEvent;
}

function pickMomentPage(recipe: ProductionRecipe): number {
  // Prefer the page tagged as companion_closes (Bolly's signature mechanic).
  const closes = recipe.pageCards.find((c) => c.dramaticRole === 'companion_closes');
  if (closes) return closes.page;
  // Fallback: first critical page.
  const critical = recipe.pageCards.find((c) => c.critical);
  if (critical) return critical.page;
  // Last resort: middle page.
  return Math.ceil(recipe.pageCount / 2);
}

function buildPacingMap(cards: PageCard[]): VisualPacingMap {
  const quiet: number[] = [];
  const active: number[] = [];
  let heart = 0;

  for (const card of cards) {
    switch (card.dramaticRole) {
      case 'opening_state':
      case 'environment_sensing':
      case 'cooldown_journey':
      case 'home_inspection':
      case 'settling_in':
      case 'sleep_or_calm':
      // bedtime quiet roles
      case 'fear_object_revisited':
      case 'object_revisited_safely':
      case 'quiet_spark_settling':
      case 'sleep_with_residue':
        quiet.push(card.page);
        break;
      case 'child_body_resists':
      case 'procedure_happens':
      case 'companion_closes':
      case 'residue_appears':
      // bedtime active role
      case 'anticipation_body_resists':
        active.push(card.page);
        break;
      default:
        // journey_step, arrival_at_setting, companion_introduction,
        // companion_contact, etc. stay unclassified.
        break;
    }
    if (card.dramaticRole === 'child_mirrors') {
      heart = card.page;
    }
  }

  return {
    quietPages: quiet,
    activePages: active,
    heartPage: heart || Math.ceil(cards.length / 2),
  };
}

/**
 * #177 — map a ProductionRecipe to the minimal RecipeContract the
 * story-validators package consumes. Threaded into the validation context
 * so the recipeContract validator can enforce forbiddenPatterns +
 * per-page mustInclude / mustNotInclude.
 */
export function recipeToContract(recipe: ProductionRecipe): RecipeContract {
  return {
    id: recipe.id,
    forbiddenPatterns: recipe.forbiddenPatterns,
    pages: recipe.pageCards.map((c) => ({
      page: c.page,
      mustInclude: c.mustInclude,
      mustNotInclude: c.mustNotInclude,
    })),
  };
}

/** Stable, dependency-free 32-bit hash for variation seeding. */
function fnv1aHash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0; // unsigned
}

// ─────────────────────────────────────────────────────────────────────────
// Feature flag
// ─────────────────────────────────────────────────────────────────────────

/**
 * Recipe mode is OFF by default. Set STORY_RECIPE_MODE=on in the
 * environment to enable. Any other value (including missing) = OFF.
 */
export function isRecipeModeEnabled(): boolean {
  return (process.env.STORY_RECIPE_MODE ?? '').trim().toLowerCase() === 'on';
}
