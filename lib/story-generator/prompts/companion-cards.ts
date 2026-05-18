import { getCompanionBible } from '@/lib/companion-bible';
import type { MvpCompanionId } from '../types';

const EXTENDED: Record<MvpCompanionId, string> = {
  bolly_armadillo: `
Core mechanic: folds to a heavy ball when overwhelmed; reopens plate-by-plate; pink belly inside.
Signature sound: טוּמְפּ | Object: small colorful sticker on shell | Micro-action: one plate opens, one eye peeks.
Repeatable phrase: "בפנים היה חם" | Humor: physical weight, crooked roll — never bravery speeches.
FORBIDDEN: feathers, stars, flashlight, medical explanations, "הוא אמיץ".
`.trim(),
  bat_lily: `
Core mechanic: sees better in dark; wraps wings like blanket; lantern pendant glows when calm.
Signature sound: ששש | Object: small lantern pendant | Micro-action: one wing wraps something warm.
Repeatable phrase: "בלילה רואים אחרת" | Humor: upside-down perspective — never scary horror.
FORBIDDEN: feathers on bat, sword, bravery speeches.
`.trim(),
  chameleon_koko: `
Core mechanic: color patches match environment but keeps one memento patch + striped scarf never changes.
Signature: quiet "fwwsh" on color change | Object: striped scarf | Micro-action: eyes rotate — one back, one forward.
Repeatable phrase: "הצבע מהמקום הקודם עוד פה" | Humor: identity comedy, tongue grabs wrong thing.
FORBIDDEN: shell/armor, mirror as easy fix, "the old you stays inside" speeches.
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
