import type { BookLocationBible } from '../story-location-bible/types';
import type { SceneMemory } from '../scene-memory/types';
import { isFortFormPrimaryFact } from '../scene-memory/fact-compare';
import type { AppearanceLightingTarget, SceneAppearanceMemory, SceneAppearanceSignature } from './types';

function deriveLightingTarget(bible: BookLocationBible | null | undefined): AppearanceLightingTarget {
  const time = bible?.setTopology?.timeOfDay?.toLowerCase() ?? '';
  const mode = bible?.continuityMode?.toLowerCase() ?? '';
  if (/night|bedtime|evening/.test(time) || /night|bedtime/.test(mode)) {
    return 'night_warm_lamp';
  }
  if (/day|morning|afternoon/.test(time)) return 'day_soft';
  return 'unspecified';
}

function lightingLockNote(target: AppearanceLightingTarget): string {
  switch (target) {
    case 'night_warm_lamp':
      return 'Consistent cozy NIGHT bedroom — warm local lamp key light only; readable but NOT daytime-bright, NOT sunny, NOT washed-out white walls.';
    case 'night_moonlit':
      return 'Night scene with cool moon fill + warm local accents; never daylight.';
    case 'day_soft':
      return 'Soft daytime interior — even readable light, no harsh noon glare.';
    default:
      return 'Match the established scene lighting across all pages — no random brightness jumps.';
  }
}

function signatureFromFact(factId: string, fact: SceneMemory['stableFacts'][string]): SceneAppearanceSignature {
  const id = factId.toLowerCase();
  const sig: SceneAppearanceSignature = { factId };

  if (/bed/i.test(id)) {
    sig.silhouette = 'fixed headboard shape and bed frame silhouette';
    sig.material = fact.appearance?.trim() || 'warm wood headboard';
    sig.formNote = 'same bed DESIGN family every page — camera angle may vary';
  } else if (/^curtain|curtains|drape|drapes|valance/i.test(id)) {
    sig.formNote = 'curtains excluded from fixed board — window frame only';
  } else if (/window/i.test(id)) {
    sig.silhouette = 'bare window frame with clear glass panes';
    const rawPalette = [fact.color, fact.position].filter(Boolean).join(' ').trim();
    sig.colorFamily = /curtain|drape|fabric|valance|swag/i.test(rawPalette)
      ? 'warm wood frame with cool moonlit glass panes'
      : rawPalette || 'warm wood frame with cool moonlit glass panes';
    sig.formNote =
      'NO curtains, drapes, valances, or fabric — bare frame and glass only; same frame design every page';
  } else if (/lamp/i.test(id)) {
    sig.formNote = 'same bedside lamp shape and warm glow colour';
    sig.material = 'small warm table lamp';
  } else if (/shelf/i.test(id)) {
    sig.silhouette = 'same wall shelf shape';
    sig.colorFamily = fact.color?.trim() || 'books only';
    sig.formNote = 'same book COLOUR families — exact spine order may vary (Accept)';
  } else if (/rug/i.test(id)) {
    sig.colorFamily = fact.position;
    sig.formNote = 'same rug shape and palette';
  } else if (isFortFormPrimaryFact(factId)) {
    sig.formNote = 'pillow pile palette and soft heap form — collapsed/scattered states only';
    sig.colorFamily = fact.color?.trim();
  } else if (/pillow/i.test(id)) {
    sig.colorFamily = fact.color?.trim() || fact.position;
    sig.formNote = 'locked pillow palette — individual arrangement may vary (Accept)';
  } else if (/blanket/i.test(id)) {
    sig.colorFamily = fact.color?.trim() || fact.position;
    sig.formNote = 'same blanket pattern and colour family';
  } else if (id === 'walls') {
    sig.colorFamily = fact.position;
  } else if (id === 'floor') {
    sig.material = fact.position;
  } else {
    sig.formNote = fact.position;
    if (fact.color) sig.colorFamily = fact.color;
  }

  return sig;
}

export function seedSceneAppearanceMemory(args: {
  sceneMemory: SceneMemory | null | undefined;
  locationBible?: BookLocationBible | null;
}): SceneAppearanceMemory | null {
  const memory = args.sceneMemory;
  if (!memory?.stableFacts || !Object.keys(memory.stableFacts).length) return null;

  const lightingTarget = deriveLightingTarget(args.locationBible);
  const signatures = Object.entries(memory.stableFacts).map(([factId, fact]) =>
    signatureFromFact(factId, fact)
  );

  return {
    sceneId: memory.sceneId,
    lightingTarget,
    lightingLockNote: lightingLockNote(lightingTarget),
    signatures,
  };
}
