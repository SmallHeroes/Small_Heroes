/**
 * #169 — PageCard → PageBlueprint mapping for recipe-mode Author.
 *
 * The existing structured-draft pipeline validates Author output against a
 * PageBlueprint (page, purpose, targetWords, maxWords, maxSentences,
 * requiredCompanionPresence, companionRequirementMode, requiredAnchor).
 *
 * In recipe mode the source-of-truth is a richer PageCard. This module
 * derives the PageBlueprint shape DETERMINISTICALLY from PageCards so:
 *   - structured-draft's blueprint validator works unchanged
 *   - the richer PageCard fields (dramaticRole, requiredEvent, mustInclude,
 *     mustNotInclude, etc.) are still available for the prompt builder
 *
 * Mapping rules:
 *   - page             ← card.page
 *   - purpose          ← card.dramaticRole (closed vocabulary, fine for echo)
 *   - targetWords      ← card.targetWords
 *   - maxWords         ← card.maxWords
 *   - maxSentences     ← card.maxSentences
 *   - requiredCompanionPresence ← mustInclude contains the canonical
 *                                  companion name ("בּוֹלִי" / "בולי" / etc.)
 *                                  OR contains the companion's hook sound
 *   - companionRequirementMode  ← 'per-page' if critical=true, else 'cumulative-by'
 *   - requiredAnchor   ← first mustInclude entry (legacy blueprint validator
 *                        only takes one; the full list is in the prompt)
 */

import type {
  PageBlueprint,
  // BlueprintValidationFinding is unused here but the schema lives next to it
} from '../editorial/draft-page-schema';
import type { PageCard, ProductionRecipe } from './recipe-types';

/** Canonical companion name fragments (any of these = companion presence). */
const COMPANION_NAME_TOKENS: Record<string, string[]> = {
  bolly_armadillo: ['בּוֹלִי', 'בולי'],
  bat_lily: ['לִילִי', 'לילי'],
  chameleon_koko: ['קוֹקוֹ', 'קוקו', 'קוֹקו'],
};

/** Companion hook sounds — when these are in mustInclude they imply presence. */
const COMPANION_HOOK_SOUNDS: Record<string, string[]> = {
  bolly_armadillo: ['טוּמְפּ', 'טומפ'],
  bat_lily: ['ששש', 'שששש'],
  chameleon_koko: [],
};

export function buildBlueprintFromRecipe(recipe: ProductionRecipe): PageBlueprint[] {
  const nameTokens = COMPANION_NAME_TOKENS[recipe.companionId] ?? [];
  const soundTokens = COMPANION_HOOK_SOUNDS[recipe.companionId] ?? [];
  const allCompanionTokens = [...nameTokens, ...soundTokens];

  return recipe.pageCards.map((card) => pageCardToBlueprint(card, allCompanionTokens));
}

function pageCardToBlueprint(
  card: PageCard,
  companionTokens: string[]
): PageBlueprint {
  const requiredCompanionPresence = card.mustInclude.some((m) =>
    companionTokens.some((t) => m.includes(t))
  );

  return {
    page: card.page,
    purpose: card.dramaticRole,
    targetWords: card.targetWords,
    maxWords: card.maxWords,
    maxSentences: card.maxSentences,
    requiredCompanionPresence,
    companionRequirementMode: card.critical ? 'per-page' : 'cumulative-by',
    requiredAnchor: card.mustInclude[0],
  };
}
