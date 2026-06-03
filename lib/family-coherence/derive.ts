import type { FamilyContext } from '@/backend/providers/story';
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

export function inferSkinToneBand(text: string): SkinToneBand {
  if (
    /\b(deep brown|dark brown|rich brown|ebony|very dark|brown skin|deep tan|mahogany)\b/.test(
      text
    )
  ) {
    return 'deep-warm';
  }
  if (/\b(medium brown|brown skin|tan skin|caramel|olive brown|warm brown)\b/.test(text)) {
    return 'medium-deep-warm';
  }
  if (/\b(medium tan|light olive|olive skin|warm beige|golden tan)\b/.test(text)) {
    return 'medium-warm';
  }
  if (/\b(warm pale|light skin|fair skin|peachy|light peach)\b/.test(text)) {
    return 'light-warm';
  }
  return 'light-neutral';
}

export function inferHairTexture(text: string): HairTextureFamily {
  if (/\b(coily|kinky|tight curl|afro)\b/.test(text)) return 'coily';
  if (/\b(curly|curls|ringlets)\b/.test(text)) return 'curly';
  if (/\b(wavy|waves)\b/.test(text)) return 'wavy';
  if (/\b(straight|sleek)\b/.test(text)) return 'straight';
  return 'mixed';
}

export function inferHairColor(text: string): HairColorFamily {
  if (/\b(black hair|jet black|dark black)\b/.test(text)) return 'black';
  if (/\b(dark brown|chocolate brown|brown hair)\b/.test(text)) return 'dark-brown';
  if (/\b(auburn|red hair|ginger|strawberry)\b/.test(text)) return 'red';
  if (/\b(blonde|blond|golden hair|light hair)\b/.test(text)) return 'blonde';
  if (/\b(medium brown|chestnut)\b/.test(text)) return 'medium-brown';
  if (/\b(light brown|honey brown)\b/.test(text)) return 'light-brown';
  return 'mixed-dark';
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
