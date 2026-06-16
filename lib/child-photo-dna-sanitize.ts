import {
  hairFieldFromPhotoDescription,
  reconcileStructuredHairWithPhoto,
} from './child-photo-hair';

export type StructuredChildDNA = {
  face: string;
  hair: string;
  body: string;
  clothing: string;
  signature: string;
};

/** Clothing is story-level (wardrobe lock) — never part of the identity lock. */
export const SAFE_CHILD_CLOTHING_POINTER = 'Story wardrobe lock on each page — not from photo';

const IDENTITY_CLOTHING_PHRASES_EN = ['dressed in'] as const;

const IDENTITY_CLOTHING_BLOCKLIST_EN = [
  'shirt',
  't-shirt',
  'tee',
  'shorts',
  'pants',
  'trousers',
  'jeans',
  'denim',
  'dress',
  'skirt',
  'shoe',
  'shoes',
  'sneaker',
  'sneakers',
  'sandals',
  'boots',
  'socks',
  'hat',
  'cap',
  'outfit',
  'clothing',
  'clothes',
  'wearing',
  'wears',
] as const;

const IDENTITY_CLOTHING_BLOCKLIST_HE = [
  'חולצה',
  'טי-שירט',
  'מכנסיים',
  'מכנס',
  "ג'ינס",
  'שמלה',
  'חצאית',
  'נעל',
  'נעליים',
  'סנדלים',
  'מגפיים',
  'גרביים',
  'כובע',
  'לובש',
  'לובשת',
  'לבוש',
  'לבושה',
  'מחליפה',
] as const;

export class IdentityClothingLeakError extends Error {
  readonly matchedWord: string;

  constructor(matchedWord: string) {
    super(
      `IDENTITY_CLOTHING_LEAK: child identity lock contains a clothing word ("${matchedWord}") while a wardrobe lock applies — clothing must come only from the wardrobe lock.`
    );
    this.name = 'IdentityClothingLeakError';
    this.matchedWord = matchedWord;
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Jewelry / continuity accessories — not story wardrobe; allowed in signature when wardrobe lock applies. */
const JEWELRY_ACCESSORY_PATTERN =
  /\b(bracelet|necklace|pendant|choker|wristband|earring|anklet|locket)\b/i;

export function findClothingWordInIdentityText(text: string): string | null {
  if (!text?.trim()) return null;
  if (
    JEWELRY_ACCESSORY_PATTERN.test(text) &&
    /\b(wears?|wearing)\b/i.test(text) &&
    !/\b(shirt|t-?shirt|tee|shorts|pants|trousers|jeans|dress|skirt|shoe|sneaker|sandal|boot|sock|pajama|legging|outfit|clothing|clothes)\b/i.test(
      text
    )
  ) {
    return null;
  }
  const lower = text.toLowerCase();
  for (const phrase of IDENTITY_CLOTHING_PHRASES_EN) {
    if (lower.includes(phrase)) return phrase;
  }
  for (const word of [...IDENTITY_CLOTHING_BLOCKLIST_EN].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i');
    if (re.test(lower)) return word;
  }
  for (const word of IDENTITY_CLOTHING_BLOCKLIST_HE) {
    if (text.includes(word)) return word;
  }
  return null;
}

/** Hard-fail when identity text carries clothing while a story wardrobe lock is active. */
export function assertIdentityLockFreeOfClothingWhenWardrobeApplies(input: {
  identityLockText: string;
  wardrobeLock?: string | null;
  childStructured?: Pick<StructuredChildDNA, 'face' | 'hair' | 'body' | 'signature'> | null;
}): void {
  if (!input.wardrobeLock?.trim()) return;

  const texts = [
    input.identityLockText,
    input.childStructured?.face,
    input.childStructured?.hair,
    input.childStructured?.body,
    input.childStructured?.signature,
  ].filter((t): t is string => Boolean(t?.trim()));

  for (const text of texts) {
    const hit = findClothingWordInIdentityText(text);
    if (hit) throw new IdentityClothingLeakError(hit);
  }
}

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
    hair: hairFieldFromPhotoDescription(photo),
    body: `Build and height appropriate for a ${childAge}-year-old ${genderWord}`,
    clothing: SAFE_CHILD_CLOTHING_POINTER,
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
  if (!childPhotoDescription?.trim()) {
    return { ...child, clothing: SAFE_CHILD_CLOTHING_POINTER };
  }

  const photoLower = childPhotoDescription.toLowerCase();
  let working = child;

  if (isLikelyGenericFallbackChildDNA(working)) {
    console.warn('[StoryBankDNA] Replacing generic fallback child DNA with photo-anchored fields');
    working = {
      ...working,
      face: childPhotoDescription.trim(),
      hair: hairFieldFromPhotoDescription(childPhotoDescription),
      signature: signatureFromPhotoOnly(childPhotoDescription),
    };
  }
  let { face, hair, signature } = working;

  hair = reconcileStructuredHairWithPhoto(hair, childPhotoDescription);

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

  return {
    ...child,
    face,
    hair,
    signature: signature.trim(),
    clothing: SAFE_CHILD_CLOTHING_POINTER,
  };
}

export function joinChildStructuredDNA(child: StructuredChildDNA): string {
  const parts = [child.face, child.hair, child.body];
  if (child.signature?.trim()) parts.push(child.signature.trim());
  return parts.filter(Boolean).join('. ') + '.';
}
