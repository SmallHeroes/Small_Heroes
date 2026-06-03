/**
 * Per-page entity presence contract for image prompts.
 * Story page text + imageDirection are authoritative (imageDirection first).
 */

export type ChildPresence = 'present' | 'absent' | 'background' | 'partial';
export type CompanionPresence = 'present' | 'absent' | 'partial' | 'offscreen_hint';

export type PageEntityPresenceContract = {
  childPresence: ChildPresence;
  companionPresence: CompanionPresence;
  recurringObjects: string[];
  recurringEntities: string[];
  forbiddenEntities: string[];
};

export type DerivePageEntityPresenceInput = {
  bookPageText?: string | null;
  imageDirection?: string | null;
  rawScenePrompt?: string | null;
  pagePrompt?: string | null;
  childFirstName?: string | null;
  companionName?: string | null;
  companionId?: string | null;
  visualDirection?: {
    mustInclude?: string[];
    mustNotInclude?: string[];
    imageSubject?: string;
  } | null;
  /** Locked recurring object keys → detection keywords (lowercase). */
  recurringObjectCatalog?: Record<string, string[]>;
  /** Locked recurring entity keys (characters/creatures) → detection keywords. */
  recurringEntityCatalog?: Record<string, string[]>;
};

const HUMAN_CHILD_EN =
  /\b(?:the\s+)?(?:child|boy|girl|kid|toddler|human\s+child|young\s+(?:boy|girl))\b/i;
const HUMAN_CHILD_HE = /(?:^|[^\w])(?:ה?ילד(?:ה)?|הילד(?:ה)?|ה?ילדים)(?:$|[^\w])/u;
const CHILD_NAME_PLACEHOLDER = /\{\{childName\}\}/;
const DRAGON_BABY =
  /baby\s+dragon|dragon\s+(?:cub|baby|hatchling|pup)|דרקון\s+תינוק|tiny\s+dragon/i;
const CHILD_BACKGROUND =
  /\b(?:child|boy|girl)\s+(?:in\s+)?(?:the\s+)?background\b|background\s+(?:child|figure)|small\s+(?:child|figure)\s+in\s+(?:the\s+)?distance|partial(?:ly)?\s+visible\s+(?:child|boy|girl)/i;
const CHILD_PARTIAL =
  /\b(?:partial|edge\s+of\s+frame|only\s+(?:a\s+)?hand|silhouette)\b.*\b(?:child|boy|girl)\b/i;

const FORBIDDEN_WHEN_CHILD_ABSENT = [
  'human child',
  'young boy',
  'young girl',
  'kid',
  'toddler',
  'human protagonist',
  'realistic child portrait',
];

function haystack(input: DerivePageEntityPresenceInput): string {
  return [
    input.imageDirection ?? '',
    input.rawScenePrompt ?? '',
    input.pagePrompt ?? '',
    input.bookPageText ?? '',
  ]
    .join('\n')
    .trim();
}

function mentionsHumanChild(text: string, childFirstName?: string | null): boolean {
  const stripped = text.replace(DRAGON_BABY, ' ');
  if (HUMAN_CHILD_EN.test(stripped) || HUMAN_CHILD_HE.test(stripped)) return true;
  if (CHILD_NAME_PLACEHOLDER.test(text)) return true;
  const name = childFirstName?.trim();
  if (name && name.length >= 2 && text.includes(name)) return true;
  return false;
}

function deriveChildPresence(input: DerivePageEntityPresenceInput): ChildPresence {
  const imageDir = (input.imageDirection ?? input.rawScenePrompt ?? '').trim();
  const full = haystack(input);

  // imageDirection is authoritative when present
  const primary = imageDir.length > 0 ? imageDir : full;

  if (!mentionsHumanChild(primary, input.childFirstName)) {
    // Fallback: Hebrew body text only when imageDirection silent on child
    if (imageDir.length > 0) return 'absent';
    return mentionsHumanChild(full, input.childFirstName) ? 'present' : 'absent';
  }

  if (CHILD_BACKGROUND.test(primary) || CHILD_BACKGROUND.test(full)) return 'background';
  if (CHILD_PARTIAL.test(primary) || CHILD_PARTIAL.test(full)) return 'partial';

  const subject = input.visualDirection?.imageSubject?.toLowerCase() ?? '';
  if (subject === 'environment' || subject === 'object') return 'absent';
  if (subject.startsWith('supporting:')) return 'partial';

  return 'present';
}

function companionPresenceTokens(
  companionName: string,
  companionId?: string | null
): string[] {
  const tokens = new Set<string>();
  const trimmed = companionName.trim();
  if (trimmed) {
    tokens.add(trimmed);
    tokens.add(trimmed.toLowerCase());
    const parts = trimmed.split(/\s+/).filter((p) => p.length >= 2);
    if (parts.length > 1) {
      const short = parts[parts.length - 1];
      tokens.add(short);
      tokens.add(short.toLowerCase());
    }
  }
  const id = (companionId ?? '').toLowerCase();
  if (id === 'fox_uri') {
    tokens.add('fox');
    tokens.add('uri');
    tokens.add('אורי');
    tokens.add('אוּרי');
  }
  if (id === 'dragon_dini') {
    tokens.add('dini');
    tokens.add('דיני');
  }
  if (id === 'bear_cub_gahal') {
    tokens.add('dobi');
  }
  if (id === 'octopus_seara') {
    tokens.add('octopus');
    tokens.add('seara');
    tokens.add('זוזי');
  }
  return [...tokens];
}

const COMPANION_PARTIAL_RE =
  /\b(only (?:the |a )?(?:tail|paw|ear|snout|tip)|tail tip|white tail tip|paw ?print|footprint|visible for a moment|just (?:a |the )?tail|נ(?:קב|ק)ב(?:ה)?(?: של)?(?: ה)?זנב)\b/i;
const COMPANION_OFFSCREEN_RE =
  /\b(outside (?:in|the)|through the window|outside the window|distant (?:glow|sound)|shadow (?:of|flicker)|hint of|offscreen|מ(?:בחוץ|חוץ ל(?:חלון|בית)))\b/i;
const FACE_READABLE_COMPANION =
  /\b(fox and the child|child and (?:the )?fox|face close|both eyes|looking at the child|beside the (?:child|talking fox)|step(?:s|ping)? (?:down|onto)|points with)\b/i;

function deriveCompanionPresence(input: DerivePageEntityPresenceInput): CompanionPresence {
  const companionName = input.companionName?.trim();
  if (!companionName) return 'absent';

  const tokens = companionPresenceTokens(companionName, input.companionId);
  const imageDir = (input.imageDirection ?? input.rawScenePrompt ?? '').trim();
  const hebrew = (input.bookPageText ?? '').trim();
  const hay = [imageDir, hebrew, input.pagePrompt ?? ''].join('\n');

  const mentionsCompanion =
    tokens.some((t) => t.length >= 2 && imageDir.toLowerCase().includes(t.toLowerCase())) ||
    tokens.some((t) => t.length >= 2 && hebrew.includes(t));

  if (!mentionsCompanion && !COMPANION_PARTIAL_RE.test(hay) && !COMPANION_OFFSCREEN_RE.test(hay)) {
    if (!hebrew && !imageDir) return 'present';
    return 'absent';
  }

  if (COMPANION_PARTIAL_RE.test(hay)) return 'partial';

  const mustNot = (input.visualDirection?.mustNotInclude ?? []).map((s) => s.toLowerCase());
  if (mustNot.some((item) => tokens.some((t) => t && item.includes(t.toLowerCase())))) {
    return 'absent';
  }

  if (COMPANION_OFFSCREEN_RE.test(hay) && !FACE_READABLE_COMPANION.test(hay)) {
    return 'offscreen_hint';
  }

  const mustInclude = (input.visualDirection?.mustInclude ?? []).map((s) => s.toLowerCase());
  if (mustInclude.some((item) => tokens.some((t) => t && item.includes(t.toLowerCase())))) {
    return 'present';
  }

  if (tokens.some((t) => t.length >= 2 && imageDir.toLowerCase().includes(t.toLowerCase()))) {
    return 'present';
  }
  if (tokens.some((t) => t.length >= 2 && hebrew.includes(t))) return 'present';

  if (!hebrew && !imageDir) return 'present';

  return 'absent';
}

function detectRecurringKeys(
  hay: string,
  catalog?: Record<string, string[]>
): string[] {
  if (!catalog) return [];
  const found: string[] = [];
  for (const [key, keywords] of Object.entries(catalog)) {
    if (keywords.some((kw) => hay.includes(kw.toLowerCase()))) {
      found.push(key);
    }
  }
  return found;
}

function detectRecurringObjects(input: DerivePageEntityPresenceInput): string[] {
  return detectRecurringKeys(haystack(input).toLowerCase(), input.recurringObjectCatalog);
}

function detectRecurringEntities(input: DerivePageEntityPresenceInput): string[] {
  return detectRecurringKeys(haystack(input).toLowerCase(), input.recurringEntityCatalog);
}

export function derivePageEntityPresence(
  input: DerivePageEntityPresenceInput
): PageEntityPresenceContract {
  const childPresence = deriveChildPresence(input);
  const companionPresence = deriveCompanionPresence(input);
  const recurringObjects = detectRecurringObjects(input);
  const recurringEntities = detectRecurringEntities(input);

  const forbiddenEntities: string[] = [];
  if (childPresence === 'absent') {
    forbiddenEntities.push(...FORBIDDEN_WHEN_CHILD_ABSENT);
  }
  if (companionPresence === 'absent') {
    forbiddenEntities.push('companion creature', 'duplicate mascot', 'sidekick animal');
  }

  return {
    childPresence,
    companionPresence,
    recurringObjects,
    recurringEntities,
    forbiddenEntities,
  };
}

export function childPresenceAllowsReferencePhoto(presence: ChildPresence): boolean {
  return presence === 'present' || presence === 'background' || presence === 'partial';
}

export function childPresenceAllowsVisualLock(presence: ChildPresence): boolean {
  return presence === 'present' || presence === 'background' || presence === 'partial';
}
