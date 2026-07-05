import type { FamilyContext } from '@/backend/providers/story';
import { HAIR_COLOR_WORD, HAIR_TEXTURE_WORD } from './member-locks';
import type {
  FamilyCoherenceProfile,
  HairColorFamily,
  HairTextureFamily,
  SkinToneBand,
} from './types';

export type DeriveFamilyProfileInput = {
  childPhotoDescription?: string | null;
  childStructured?: {
    face?: string;
    hair?: string;
    body?: string;
    signature?: string;
  } | null;
  familyContext?: FamilyContext | null;
};

const SKIN_BAND_PROMPTS: Record<SkinToneBand, string> = {
  'deep-warm':
    'deep warm brown skin tone (rich brown, not pale, not pink-default); natural illustrated warmth',
  'medium-deep-warm':
    'medium-deep warm brown / tan skin (clearly not pale or pink-default)',
  'medium-warm':
    'medium warm tan / olive-beige skin (coherent with the hero, not pale-pink default)',
  'light-warm': 'light warm peach-beige skin with gentle rosy warmth (not gray, not pink plastic)',
  'light-neutral': 'light neutral warm skin with soft natural blush (not default pale-pink newborn)',
};

function haystack(input: DeriveFamilyProfileInput): string {
  return [
    input.childPhotoDescription ?? '',
    input.childStructured?.face ?? '',
    input.childStructured?.hair ?? '',
    input.childStructured?.body ?? '',
    input.childStructured?.signature ?? '',
    input.familyContext?.parent1?.description ?? '',
    input.familyContext?.parent2?.description ?? '',
    input.familyContext?.sibling?.description ?? '',
  ]
    .join(' ')
    .toLowerCase();
}

// (P0 Fix 2) MATCHED-vs-DEFAULTED: `match*` return null on NO positive evidence; `infer*` keep the legacy default
// (byte-identical behaviour for family-coherence's own use). The visual-contract adapter uses the `match*` signal to
// FAIL CLOSED on a silent default (a wrong-ethnicity mother by another door), while a legitimately-evidenced light
// child still MATCHES `light-warm` and resolves.
export function matchSkinToneBand(text: string): SkinToneBand | null {
  if (/\b(deep brown|dark brown|rich brown|ebony|very dark|brown skin|deep tan|mahogany)\b/.test(text)) return 'deep-warm';
  if (/\b(medium brown|brown skin|tan skin|caramel|olive brown|warm brown)\b/.test(text)) return 'medium-deep-warm';
  if (/\b(medium tan|light olive|olive skin|warm beige|golden tan)\b/.test(text)) return 'medium-warm';
  if (/\b(warm pale|light skin|fair skin|peachy|light peach)\b/.test(text)) return 'light-warm';
  return null;
}
export function inferSkinToneBand(text: string): SkinToneBand {
  return matchSkinToneBand(text) ?? 'light-neutral';
}

export function matchHairTexture(text: string): HairTextureFamily | null {
  if (/\b(coily|kinky|tight curl|afro)\b/.test(text)) return 'coily';
  if (/\b(curly|curls|ringlets)\b/.test(text)) return 'curly';
  if (/\b(wavy|waves)\b/.test(text)) return 'wavy';
  if (/\b(straight|sleek)\b/.test(text)) return 'straight';
  return null;
}
export function inferHairTexture(text: string): HairTextureFamily {
  return matchHairTexture(text) ?? 'mixed';
}

export function matchHairColor(text: string): HairColorFamily | null {
  if (/\b(black hair|jet black|dark black)\b/.test(text)) return 'black';
  if (/\b(dark brown|chocolate brown|brown hair)\b/.test(text)) return 'dark-brown';
  if (/\b(auburn|red hair|ginger|strawberry)\b/.test(text)) return 'red';
  if (/\b(blonde|blond|golden hair|light hair)\b/.test(text)) return 'blonde';
  if (/\b(medium brown|chestnut)\b/.test(text)) return 'medium-brown';
  if (/\b(light brown|honey brown)\b/.test(text)) return 'light-brown';
  return null;
}
export function inferHairColor(text: string): HairColorFamily {
  return matchHairColor(text) ?? 'mixed-dark';
}

/** Concrete family appearance resolved ONLY from positive evidence — used by the visual-contract materializer. */
export type MatchedFamilyAppearance = { skinTone: string; hairColour: string; hairTexture: string };

/**
 * (P0 Fix 2) Derive the family appearance from POSITIVE, trait-specific evidence for skin AND hair (colour + texture).
 * Additive wrapper over the same match logic — legacy `inferX`/`deriveFamilyCoherenceProfile` behaviour is unchanged.
 * Returns `{ ok:false, defaulted:[…] }` when any of skin / hairColour / hairTexture had NO positive match (would
 * otherwise silently default to light-neutral/mixed-dark/mixed), so the adapter FAILS CLOSED rather than resolving a
 * wrong-ethnicity default. A legitimately-evidenced light child (e.g. "light skin") MATCHES and resolves.
 */
export function matchFamilyAppearance(
  input: DeriveFamilyProfileInput,
):
  | { ok: true; value: MatchedFamilyAppearance }
  | { ok: false; defaulted: Array<'skin' | 'hairColour' | 'hairTexture'> } {
  const text = haystack(input);
  const band = matchSkinToneBand(text);
  const colour = matchHairColor(text);
  const texture = matchHairTexture(text);
  if (!band || !colour || !texture) {
    const defaulted: Array<'skin' | 'hairColour' | 'hairTexture'> = [];
    if (!band) defaulted.push('skin');
    if (!colour) defaulted.push('hairColour');
    if (!texture) defaulted.push('hairTexture');
    return { ok: false, defaulted };
  }
  return {
    ok: true,
    value: { skinTone: SKIN_BAND_PROMPTS[band], hairColour: HAIR_COLOR_WORD[colour], hairTexture: HAIR_TEXTURE_WORD[texture] },
  };
}

export function inferGlasses(text: string): boolean {
  return /\b(glasses|spectacles|eyeglasses)\b/.test(text);
}

export function inferBroadFeatures(
  face: string,
  signature: string,
  photo: string
): string {
  const src = `${face} ${signature} ${photo}`.toLowerCase();
  const hits: string[] = [];
  const cues = [
    ['round face', /\bround face\b/],
    ['full cheeks', /\bfull cheek/],
    ['wide-set eyes', /\bwide[- ]set eye/],
    ['almond-shaped eyes', /\balmond[- ]shaped eye/],
    ['button nose', /\bbutton nose\b/],
    ['prominent dimples', /\bdimple/],
    ['freckles', /\bfreckle/],
    ['soft jawline', /\bsoft jaw/],
  ] as const;
  for (const [label, re] of cues) {
    if (re.test(src)) hits.push(label);
  }
  if (!hits.length) return 'soft rounded storybook facial proportions matching the hero’s illustrated world';
  return hits.slice(0, 3).join('; ');
}

export function deriveFamilyCoherenceProfile(
  input: DeriveFamilyProfileInput
): FamilyCoherenceProfile {
  const text = haystack(input);
  const skinToneBand = inferSkinToneBand(text);
  const hairTextureFamily = inferHairTexture(text);
  const hairColorFamily = inferHairColor(text);
  const glasses = inferGlasses(text);
  const broadFeatures = inferBroadFeatures(
    input.childStructured?.face ?? '',
    input.childStructured?.signature ?? '',
    input.childPhotoDescription ?? ''
  );

  return {
    skinToneBand,
    skinTonePrompt: SKIN_BAND_PROMPTS[skinToneBand],
    hairTextureFamily,
    hairColorFamily,
    glasses,
    broadFeatures,
    variationAllowed: true,
    derivedFrom: 'photo_dna_and_anchor',
    derivedAt: new Date().toISOString(),
  };
}
