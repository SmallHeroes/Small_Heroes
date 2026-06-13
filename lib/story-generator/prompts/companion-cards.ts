import { getCompanionBible } from '@/lib/companion-bible';
import type { MvpCompanionId } from '../types';

const EXTENDED: Record<MvpCompanionId, string> = {
  bolly_armadillo: `
Core mechanic: folds to a heavy ball when overwhelmed; reopens plate-by-plate; pink belly inside.
Signature sound: טוּמְפּ | Object: small colorful sticker on shell | Micro-action: one plate opens, one eye peeks.
Repeatable phrase: "בפנים היה חם" | Humor: physical weight, crooked roll — never bravery speeches.

═══════════════════════════════════════════════════════
COMPANION MECHANIC CONTRACT (v0.3.5).
═══════════════════════════════════════════════════════
The body mechanism:
  - Closes into a ball when overwhelmed.
  - Inside is warm ("בפנים היה חם").
  - Opens slowly, plate by plate. Never all at once.

What the child mirrors (REQUIRED at the procedure moment, two consecutive pages):
  - Page N:   Bolly closes to a ball in pocket/lap. טוּמְפּ.
  - Page N+1: The child closes HER hand to a small fist. Then opens it slowly.

What makes Bolly irreplaceable (PROOF TEST — if you can swap him with a
puppy or kitten and the story still works, you have NOT used him):
  - The shell is the model. No other companion has armor that opens plate-by-plate.
  - "טוּמְפּ" is his sound. No other companion makes it.
  - The closing-and-opening rhythm IS the story's resilience mechanic.

What must NEVER happen:
  - Bolly fighting, pushing, or removing obstacles (he is NOT an action hero).
  - Bolly giving a speech ("הוא אמיץ", "אל תפחדי" — forbidden).
  - Bolly being just "a comforting small animal" (replaceable = failed).
  - Mirror on a walking page before the medical instrument appears.
  - Bolly opening at the start of the procedure (he opens AFTER the child has).

Counter-examples that DON'T count as mirror:
  -  "בולי היה שקט. נועה הסתכלה עליו." (no body action)
  -  "בולי היה חם. נועה הרגישה את החום." (no closing/opening)

FORBIDDEN: feathers, stars, flashlight, medical explanations, "הוא אמיץ".
`.trim(),
  bat_lily: `
Core mechanic: sees better in dark; wraps wings like blanket; lantern pendant glows when calm.
Signature sound: ששש | Object: small lantern pendant | Micro-action: one wing wraps something warm.
Repeatable phrase: "בלילה רואים אחרת" | Humor: upside-down perspective — never scary horror.
FORBIDDEN: feathers on bat, sword, bravery speeches.
`.trim(),
  chameleon_koko: `
Core mechanic: warm harmonious green chameleon; tiny mustard fabric shoulder satchel always visible (her travel bag / piece of home).
Signature sound: פששש (Hebrew transliteration — use Hebrew letters ONLY, NEVER Latin "fwwsh") | Object: tiny mustard shoulder satchel | Micro-action: eyes rotate — one back, one forward.
Repeatable phrase: "חתיכה מהבית עוד פה" | Humor: shy identity comedy, tongue grabs wrong thing.
FORBIDDEN: scarf, patchwork, multicolor patches, shell/armor, mirror as easy fix, "the old you stays inside" speeches.
`.trim(),
};

export function formatCompanionCard(companionId: MvpCompanionId): string {
  const bible = getCompanionBible(companionId);
  if (!bible) throw new Error(`Unknown companion: ${companionId}`);
  return [
    `companionId: ${bible.companionId}`,
    `canonicalName: ${bible.canonicalName}`,
    `nameClean: ${bible.nameClean}`,
    `gender: ${bible.gender}`,
    EXTENDED[companionId],
    `forbiddenAnatomy: ${bible.forbiddenAnatomy.slice(0, 8).join(', ')}`,
    `forbiddenObjects: ${bible.forbiddenObjects.slice(0, 8).join(', ')}`,
  ].join('\n');
}
