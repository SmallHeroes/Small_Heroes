/**
 * Photo→vision hair capture: prevent long/curly hair from collapsing to short/medium.
 * Dev-only overrides are gated by env — never hardcoded production hair.
 */

const LONG_HAIR_CUES =
  /\b(long|lengthy|past (the )?shoulders|below (the )?shoulders|shoulder[- ]length|mid[- ]back|waist[- ]length|flows (down|past)|reaches (her|his|their|the) shoulders|hangs (down|past)|cascades|very long|(just )?(at|to|above) the shoulders)\b/i;

const SHORT_HAIR_CUES =
  /\b(very short|pixie|buzz cut|cropped|above (the )?ears|ear[- ]length|short hair|short[- ]cropped)\b/i;

const MEDIUM_ONLY_CUES =
  /\b(short[- ]to[- ]medium|medium[- ]length|chin[- ]length|bob cut|shoulder[- ]grazing)\b/i;

const CURLY_CUES = /\b(curly|curls|ringlets|coily|spiral curls)\b/i;

const HAIR_COLOR_CUES =
  /\b(brown|blonde|blond|black|auburn|red|dark brown|light brown|chestnut)\b/i;

/** Dev-only: override misread hair for a specific test child (name and/or order id). */
export function resolveDevChildHairOverride(input: {
  orderId?: string;
  childName?: string;
}): string | null {
  const hair = process.env.DEV_CHILD_PHOTO_HAIR_OVERRIDE?.trim();
  if (!hair) return null;
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_HAIR_OVERRIDE !== 'true') {
    return null;
  }

  const orderIds = (process.env.DEV_CHILD_PHOTO_HAIR_OVERRIDE_ORDER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const names = (process.env.DEV_CHILD_PHOTO_HAIR_OVERRIDE_CHILD_NAMES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!orderIds.length && !names.length) {
    console.warn(
      '[PhotoHair] DEV_CHILD_PHOTO_HAIR_OVERRIDE set but no ORDER_IDS/CHILD_NAMES gate — ignoring (set DEV_CHILD_PHOTO_HAIR_OVERRIDE_CHILD_NAMES or _ORDER_IDS)'
    );
    return null;
  }

  if (orderIds.length && input.orderId && orderIds.includes(input.orderId)) return hair;
  if (names.length && input.childName && names.includes(input.childName.trim())) return hair;
  return null;
}

/** True when the photo description clearly indicates long hair. */
export function photoDescriptionIndicatesLongHair(photoDescription: string): boolean {
  const text = photoDescription.trim();
  if (!text) return false;
  if (LONG_HAIR_CUES.test(text)) return true;
  // Curly hair that hangs past the jaw is often mislabeled "medium" — treat voluminous curls as long unless explicitly short.
  if (CURLY_CUES.test(text) && /\b(past|below|shoulder|flows|hangs|lengthy|thick full)\b/i.test(text)) {
    return true;
  }
  return false;
}

/**
 * Fix vision outputs that collapse long/curly hair into short-to-medium / chin-length wording.
 */
export function normalizeChildPhotoHairDescription(photoDescription: string): string {
  let text = photoDescription.replace(/\s+/g, ' ').trim();
  if (!text) return text;

  let indicatesLong = photoDescriptionIndicatesLongHair(text);
  // Shoulder-grazing curly/wavy hair is often mislabeled "medium" — treat as long for DNA/anchor locks.
  if (
    !indicatesLong &&
    MEDIUM_ONLY_CUES.test(text) &&
    (CURLY_CUES.test(text) || /\bwavy\b/i.test(text)) &&
    /\b(shoulder|falls|falling|hangs)\b/i.test(text)
  ) {
    indicatesLong = true;
    console.log('[PhotoHair] Promoted shoulder-grazing curly/wavy hair from medium → long');
  }
  if (!indicatesLong) return text;

  // Remove contradictory short/medium-only phrases when long cues are present.
  if (MEDIUM_ONLY_CUES.test(text) || (SHORT_HAIR_CUES.test(text) && !LONG_HAIR_CUES.test(text))) {
    const before = text;
    text = text
      .replace(/\bshort[- ]to[- ]medium\b/gi, 'long')
      .replace(/\bmedium[- ]length\b/gi, 'long')
      .replace(/\bchin[- ]length\b/gi, 'long')
      .replace(/\b(short|ear[- ]length)\b/gi, (match, _p1, offset, whole) => {
        // Keep "short" only in "not short" negations
        const slice = whole.slice(Math.max(0, offset - 4), offset).toLowerCase();
        if (slice.includes('not ')) return match;
        return 'long';
      });
    if (text !== before) {
      console.log('[PhotoHair] Normalized contradictory short/medium hair wording → long');
    }
  }

  if (!LONG_HAIR_CUES.test(text) && indicatesLong) {
    const curlWord = CURLY_CUES.test(text) ? 'curly ' : '';
    const colorMatch = text.match(HAIR_COLOR_CUES);
    const color = colorMatch ? `${colorMatch[0]} ` : '';
    text = `${text} Hair is ${color}${curlWord}long, past the shoulders.`.replace(/\s+/g, ' ').trim();
    console.log('[PhotoHair] Appended explicit long-hair anchor to photo description');
  }

  return text;
}

/** Extract or synthesize a dedicated hair line for structured DNA. */
export function hairFieldFromPhotoDescription(photoDescription: string): string {
  const normalized = normalizeChildPhotoHairDescription(photoDescription);
  const lower = normalized.toLowerCase();

  const hairSentence =
    normalized
      .split(/(?<=[.!?])\s+/)
      .find((s) => /\bhair\b/i.test(s)) ?? '';

  if (hairSentence.trim().length >= 12) {
    return hairSentence.replace(/^[^:]*:\s*/, '').trim();
  }

  const parts: string[] = [];
  if (LONG_HAIR_CUES.test(lower) || photoDescriptionIndicatesLongHair(normalized)) parts.push('long');
  else if (SHORT_HAIR_CUES.test(lower)) parts.push('short');
  else if (MEDIUM_ONLY_CUES.test(lower)) parts.push('medium-length');

  if (CURLY_CUES.test(lower)) parts.push('curly');
  else if (/\bwavy\b/i.test(lower)) parts.push('wavy');
  else if (/\bstraight\b/i.test(lower)) parts.push('straight');

  const color = normalized.match(HAIR_COLOR_CUES);
  if (color) parts.unshift(color[0]);

  if (parts.length) {
    return `${parts.join(' ')} hair as shown in the uploaded child photo reference`;
  }

  return 'Match exact hair color, length, and texture from the uploaded child photo reference';
}

/** When structured hair contradicts the photo description, prefer photo-derived hair. */
export function reconcileStructuredHairWithPhoto(
  structuredHair: string,
  photoDescription: string
): string {
  const photoHair = hairFieldFromPhotoDescription(photoDescription);
  const photoLong = photoDescriptionIndicatesLongHair(photoDescription);
  const hairLower = structuredHair.toLowerCase();

  if (!photoLong) return structuredHair;

  const structuredShort =
    /\b(short|pixie|ear[- ]length|chin[- ]length|short[- ]to[- ]medium)\b/i.test(hairLower) &&
    !/\blong\b/i.test(hairLower);

  if (structuredShort) {
    console.warn('[PhotoHair] Replacing structured hair that contradicts long hair in photo description');
    return photoHair;
  }

  return structuredHair;
}

/** Dev-only: replace hair wording in an existing photo description. */
export function applyDevHairOverrideToPhotoDescription(
  photoDescription: string | null,
  devHair: string
): string {
  const base = (photoDescription ?? '').trim();
  const hairLine = devHair.trim();
  if (!base) return `Hair: ${hairLine}.`;
  const withoutHair = base
    .split(/(?<=[.!?])\s+/)
    .filter((s) => !/\bhair\b/i.test(s))
    .join(' ')
    .trim();
  const prefix = withoutHair ? `${withoutHair} ` : '';
  return `${prefix}Hair: ${hairLine}.`.replace(/\s+/g, ' ').trim();
}
