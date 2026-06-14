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
    // imageDirection silent on child — consult the page text before declaring absent.
    // v3 imageDirections often describe a detail ("bunny ears popping up") while the
    // child IS in the scene per the Hebrew text; declaring absent drops the child
    // anchor reference and forbids the child, and the model then invents a generic
    // child from style references (bunny p1 boy contamination). Only environment/
    // object subjects keep the child out.
    const subject = input.visualDirection?.imageSubject?.toLowerCase() ?? '';
    if (subject === 'environment' || subject === 'object' || subject.startsWith('object:')) {
      return 'absent';
    }
    const textMentionsChild = mentionsHumanChild(
      input.bookPageText ?? '',
      input.childFirstName
    );
    if (imageDir.length > 0) return textMentionsChild ? 'present' : 'absent';
    return textMentionsChild || mentionsHumanChild(full, input.childFirstName)
      ? 'present'
      : 'absent';
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
  if (id === 'lion_shaket') {
    tokens.add('lion');
    tokens.add('leo');
    tokens.add('shaket');
    tokens.add('ליאו');
    tokens.add('אריה');
  }
  return [...tokens];
}

const NEGATION_BEFORE_COMPANION_TOKEN_RE =
  /\b(?:no|not|without|never|forbidden)\s+(?:a\s+)?(?:scary\s+)?$/i;
const COMPANION_ABSENT_AFTER_NAME_RE =
  /\b(?:is\s+)?not\s+(?:(?:yet\s+)?present|visible|there|shown|in\s+(?:the\s+)?(?:scene|image|frame)|(?:a\s+)?(?:companion|sidekick))\b/i;

/** Positive companion name mention — ignores negation windows (no Leo, Leo not present yet, etc.). */
export function tokenMentionedPositively(text: string, token: string): boolean {
  if (!token || token.length < 2) return false;
  const lower = text.toLowerCase();
  const tokenLower = token.toLowerCase();
  let searchFrom = 0;
  while (searchFrom < lower.length) {
    const pos = lower.indexOf(tokenLower, searchFrom);
    if (pos === -1) return false;

    const before = text.slice(Math.max(0, pos - 50), pos);
    if (NEGATION_BEFORE_COMPANION_TOKEN_RE.test(before)) {
      searchFrom = pos + tokenLower.length;
      continue;
    }

    const after = text.slice(pos + token.length, pos + token.length + 50);
    if (COMPANION_ABSENT_AFTER_NAME_RE.test(after)) {
      searchFrom = pos + tokenLower.length;
      continue;
    }

    return true;
  }
  return false;
}

export function findPositiveCompanionMentionInImageDirection(
  imageDirection: string,
  companionName: string,
  companionId?: string | null
): string | null {
  const tokens = companionPresenceTokens(companionName, companionId).sort(
    (a, b) => b.length - a.length
  );
  for (const token of tokens) {
    if (tokenMentionedPositively(imageDirection, token)) {
      return token;
    }
  }
  return null;
}

export class CompanionPresenceConflictError extends Error {
  constructor(
    pageNumber: number,
    matchedToken: string,
    companionPresence: CompanionPresence
  ) {
    super(
      `COMPANION_PRESENCE_CONFLICT page ${pageNumber}: imageDirection names the companion ("${matchedToken}") but presence resolved '${companionPresence}' — prompt would say no-companion while describing one. Fix tokens or imageDirection.`
    );
    this.name = 'CompanionPresenceConflictError';
  }
}

export function assertCompanionPresenceConsistency(input: {
  pageNumber?: number;
  imageDirection?: string | null;
  companionPresence: CompanionPresence;
  companionName?: string | null;
  companionId?: string | null;
}): void {
  if (input.companionPresence !== 'absent') return;
  const imageDir = (input.imageDirection ?? '').trim();
  if (!imageDir || !input.companionName?.trim()) return;

  const matched = findPositiveCompanionMentionInImageDirection(
    imageDir,
    input.companionName,
    input.companionId
  );
  if (matched) {
    throw new CompanionPresenceConflictError(
      input.pageNumber ?? 0,
      matched,
      input.companionPresence
    );
  }
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

  const mentionsCompanionInImageDir = tokens.some(
    (t) => t.length >= 2 && tokenMentionedPositively(imageDir, t)
  );
  const mentionsCompanionInHebrew = tokens.some((t) => t.length >= 2 && hebrew.includes(t));
  const mentionsCompanion = mentionsCompanionInImageDir || mentionsCompanionInHebrew;

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

  if (tokens.some((t) => t.length >= 2 && tokenMentionedPositively(imageDir, t))) {
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
