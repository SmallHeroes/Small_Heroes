export type StructuredChildDNA = {
  face: string;
  hair: string;
  body: string;
  clothing: string;
  signature: string;
};

/** Accessories/props that must not be invented when a real photo description exists. */
const GENERIC_FALLBACK_MARKERS =
  /\b(stuffed bunny|worn stuffed|light olive skin|thin red fabric|tucked behind ears|almond-shaped eyes)\b/i;

const ACCESSORY_RULES: Array<{ re: RegExp; photoNeedles: string[] }> = [
  {
    re: /\b(stuffed (animal|bunny|toy)|plush\b)/i,
    photoNeedles: ['stuffed', 'plush', 'bunny', 'toy'],
  },
  {
    re: /\b(hair\s*clip|barrette|hair\s*bow|bow\s+on|headband|hair\s*band)\b/i,
    photoNeedles: ['clip', 'barrette', 'bow', 'headband', 'hair band', 'hair clip'],
  },
  {
    re: /\b(glasses|spectacles|eyeglasses)\b/i,
    photoNeedles: ['glasses', 'spectacle', 'eyeglass'],
  },
  { re: /\b(hat|cap|beanie|beret)\b/i, photoNeedles: ['hat', 'cap', 'beanie', 'beret'] },
  {
    re: /\b(necklace|choker|pendant|earring|jewelry|jewellery)\b/i,
    photoNeedles: ['necklace', 'choker', 'pendant', 'earring', 'jewelry', 'jewellery'],
  },
  {
    re: /\b(birthmark|mole on)\b/i,
    photoNeedles: ['birthmark', 'mole'],
  },
];

function photoMentionsAccessory(text: string, photoLower: string): boolean {
  return ACCESSORY_RULES.some(
    (rule) => rule.re.test(text) && !rule.photoNeedles.some((n) => photoLower.includes(n))
  );
}

function stripAccessoryPhrases(text: string): string {
  let out = text;
  for (const { re } of ACCESSORY_RULES) {
    out = out.replace(re, '');
  }
  return out.replace(/\s{2,}/g, ' ').replace(/,\s*,/g, ',').trim();
}

/** Facial-only anchor from photo text — never invent props. */
function signatureFromPhotoOnly(photoDescription: string): string {
  const lower = photoDescription.toLowerCase();
  const facialAnchors = [
    'freckle',
    'dimple',
    'gap tooth',
    'gap between',
    'prominent cheek',
    'full cheek',
    'wide-set eye',
    'thick brow',
    'arched brow',
    'button nose',
    'upturned nose',
  ];
  const hits = facialAnchors.filter((a) => lower.includes(a));
  if (!hits.length) return '';
  return hits.slice(0, 2).join('; ');
}

/**
 * After DNA generation: strip invented clips/glasses/etc. not present in the photo description.
 */
/** When LLM DNA fails, anchor structured fields to the photo description only. */
export function buildPhotoAnchoredChildStructured(
  childPhotoDescription: string,
  childAge: number,
  childGender: string
): StructuredChildDNA {
  const genderWord = childGender === 'girl' ? 'girl' : 'boy';
  const photo = childPhotoDescription.trim();
  return {
    face: photo,
    hair: 'Match hair color, length, and texture from the photo reference in the face lock above',
    body: `Build and height appropriate for a ${childAge}-year-old ${genderWord}`,
    clothing: 'Story wardrobe lock on each page — not from photo',
    signature: signatureFromPhotoOnly(photo),
  };
}

export function isLikelyGenericFallbackChildDNA(child: StructuredChildDNA): boolean {
  const blob = `${child.face} ${child.hair} ${child.signature}`;
  return GENERIC_FALLBACK_MARKERS.test(blob);
}

export function sanitizeChildStructuredAgainstPhoto(
  child: StructuredChildDNA,
  childPhotoDescription: string | null | undefined
): StructuredChildDNA {
  if (!childPhotoDescription?.trim()) return child;

  const photoLower = childPhotoDescription.toLowerCase();
  let working = child;

  if (isLikelyGenericFallbackChildDNA(working)) {
    console.warn('[StoryBankDNA] Replacing generic fallback child DNA with photo-anchored fields');
    working = {
      ...working,
      face: childPhotoDescription.trim(),
      hair: 'As described in the photo reference (face lock)',
      signature: signatureFromPhotoOnly(childPhotoDescription),
    };
  }
  let { face, hair, signature } = working;

  if (signature && photoMentionsAccessory(signature, photoLower)) {
    console.warn(
      '[StoryBankDNA] Stripping invented signature accessory not present in photo description'
    );
    signature = signatureFromPhotoOnly(childPhotoDescription);
  }

  if (hair && photoMentionsAccessory(hair, photoLower)) {
    console.warn('[StoryBankDNA] Stripping invented hair accessory not present in photo');
    hair = stripAccessoryPhrases(hair);
  }

  if (face && photoMentionsAccessory(face, photoLower)) {
    face = stripAccessoryPhrases(face);
  }

  return { ...child, face, hair, signature: signature.trim() };
}

export function joinChildStructuredDNA(child: StructuredChildDNA): string {
  const parts = [child.face, child.hair, child.body, child.clothing];
  if (child.signature?.trim()) parts.push(child.signature.trim());
  return parts.filter(Boolean).join('. ') + '.';
}
