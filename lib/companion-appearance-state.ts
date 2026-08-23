/**
 * Pure companion appearance-state authority.
 *
 * A companion may declare one closed, ordered vocabulary here. Authoring copies
 * that complete authority into an opted-in Visual Contract; runtime resolves
 * only the frozen contract copy, never this mutable registry declaration.
 */

export const COMPANION_APPEARANCE_STATE_AXIS_VERSION =
  'companion-appearance-state-axis/v1' as const;

export type CompanionAppearanceContinuityRole =
  | 'baseline'
  | 'transition'
  | 'mismatched'
  | 'resolved';

export interface CompanionAppearanceStateDefinition {
  id: string;
  /** Closed linear continuity position. Valid page transitions move at most one step. */
  continuityIndex: number;
  continuityRole: CompanionAppearanceContinuityRole;
  hue: string;
  pattern: string;
  bodyLanguageCue: string;
  forbidden: string[];
}

/** Complete immutable snapshot embedded in an opted-in Visual Contract cast member. */
export interface CompanionAppearanceStateAuthority {
  version: typeof COMPANION_APPEARANCE_STATE_AXIS_VERSION;
  companionId: string;
  defaultStateId: string;
  invariantIdentityDescription: string;
  invariantForbidden: string[];
  /** Tokens that establish that a prose clause is about this companion. */
  subjectAliases: string[];
  /** Appearance vocabulary reserved to typed state, never loose render prose. */
  reservedAppearanceTerms: string[];
  states: CompanionAppearanceStateDefinition[];
}

export interface ResolvedCompanionAppearanceState
  extends CompanionAppearanceStateDefinition {
  authorityVersion: typeof COMPANION_APPEARANCE_STATE_AXIS_VERSION;
  companionId: string;
  invariantIdentityDescription: string;
  invariantForbidden: string[];
}

export interface CompanionAppearanceProseConflict {
  textIndex: number;
  alias: string;
  term: string;
}

const AUTHORITY_KEYS = [
  'companionId',
  'defaultStateId',
  'invariantForbidden',
  'invariantIdentityDescription',
  'reservedAppearanceTerms',
  'states',
  'subjectAliases',
  'version',
] as const;

const STATE_KEYS = [
  'bodyLanguageCue',
  'continuityIndex',
  'continuityRole',
  'forbidden',
  'hue',
  'id',
  'pattern',
] as const;

const CONTINUITY_ROLES = new Set<CompanionAppearanceContinuityRole>([
  'baseline',
  'transition',
  'mismatched',
  'resolved',
]);

const STATE_ID_PATTERN = /^[a-z][a-z0-9_]*$/;
const HEBREW_SCRIPT_PATTERN = /\p{Script=Hebrew}/u;
const COMBINING_MARK_PATTERN = /\p{M}/u;
const HEBREW_ALIAS_BOUND_PREFIX_PATTERN =
  '(?:[ובלכ]\\p{M}*|ו\\p{M}*[בלכ]\\p{M}*)?';
const HEBREW_TERM_BOUND_PREFIX_PATTERN = '(?:[והבכלמש]\\p{M}*){0,2}';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  return (
    JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...expected].sort())
  );
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeMarkedSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function regexEscape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsSearchPhrase(args: {
  haystack: string;
  needle: string;
  hebrewPrefixKind: 'alias' | 'term';
}): boolean {
  const { haystack, needle, hebrewPrefixKind } = args;
  if (!needle) return false;
  const boundPrefixes = HEBREW_SCRIPT_PATTERN.test(needle)
    ? hebrewPrefixKind === 'alias'
      ? HEBREW_ALIAS_BOUND_PREFIX_PATTERN
      : HEBREW_TERM_BOUND_PREFIX_PATTERN
    : '';
  return new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${boundPrefixes}${regexEscape(needle)}(?:$|[^\\p{L}\\p{N}])`,
    'u',
  ).test(haystack);
}

function normalizedUniqueStrings(
  value: unknown,
  label: string,
  issues: string[],
  options?: { allowEmpty?: boolean },
): string[] {
  if (
    !Array.isArray(value) ||
    (!options?.allowEmpty && value.length === 0) ||
    !value.every(isNonBlankString)
  ) {
    issues.push(
      `${label} must be ${options?.allowEmpty ? 'an array' : 'a non-empty array'} of non-blank strings`,
    );
    return [];
  }
  const normalized = value.map((entry) => normalizeSearchText(entry));
  if (new Set(normalized).size !== normalized.length) {
    issues.push(`${label} contains duplicate normalized values`);
  }
  return normalized;
}

/** Structural/semantic validation for a frozen authority snapshot. Pure and total. */
export function companionAppearanceStateAuthorityIssues(
  value: unknown,
  expectedCompanionId?: string | null,
): string[] {
  const issues: string[] = [];
  if (!isObject(value)) {
    return ['companion appearance-state authority must be an object'];
  }
  if (!exactKeys(value, AUTHORITY_KEYS)) {
    issues.push('companion appearance-state authority keys are invalid');
  }
  if (value.version !== COMPANION_APPEARANCE_STATE_AXIS_VERSION) {
    issues.push(
      `companion appearance-state authority version must equal ${COMPANION_APPEARANCE_STATE_AXIS_VERSION}`,
    );
  }
  if (!isNonBlankString(value.companionId)) {
    issues.push('companion appearance-state authority companionId is missing');
  } else if (
    expectedCompanionId &&
    normalizeCompanionAppearanceStateId(value.companionId) !==
      normalizeCompanionAppearanceStateId(expectedCompanionId)
  ) {
    issues.push('companion appearance-state authority companionId does not match cast companion');
  }
  if (!isNonBlankString(value.defaultStateId)) {
    issues.push('companion appearance-state authority defaultStateId is missing');
  }
  if (!isNonBlankString(value.invariantIdentityDescription)) {
    issues.push('companion appearance-state authority invariantIdentityDescription is missing');
  }
  normalizedUniqueStrings(
    value.invariantForbidden,
    'companion appearance-state authority invariantForbidden',
    issues,
  );
  normalizedUniqueStrings(
    value.subjectAliases,
    'companion appearance-state authority subjectAliases',
    issues,
  );
  normalizedUniqueStrings(
    value.reservedAppearanceTerms,
    'companion appearance-state authority reservedAppearanceTerms',
    issues,
  );

  const states = Array.isArray(value.states) ? value.states : [];
  if (states.length < 2) {
    issues.push('companion appearance-state authority states must contain at least two states');
  }
  const ids = new Set<string>();
  const indexes = new Set<number>();
  const roles: CompanionAppearanceContinuityRole[] = [];
  states.forEach((raw, index) => {
    const label = `companion appearance-state authority states[${index}]`;
    if (!isObject(raw)) {
      issues.push(`${label} must be an object`);
      return;
    }
    if (!exactKeys(raw, STATE_KEYS)) {
      issues.push(`${label} keys are invalid`);
    }
    if (!isNonBlankString(raw.id)) {
      issues.push(`${label}.id is missing`);
    } else if (!STATE_ID_PATTERN.test(raw.id)) {
      issues.push(`${label}.id must be a canonical lowercase underscore id`);
    } else if (ids.has(raw.id)) {
      issues.push(`${label}.id is duplicated`);
    } else {
      ids.add(raw.id);
    }
    if (!Number.isSafeInteger(raw.continuityIndex) || Number(raw.continuityIndex) < 0) {
      issues.push(`${label}.continuityIndex must be a non-negative safe integer`);
    } else if (indexes.has(Number(raw.continuityIndex))) {
      issues.push(`${label}.continuityIndex is duplicated`);
    } else {
      indexes.add(Number(raw.continuityIndex));
    }
    if (
      !isNonBlankString(raw.continuityRole) ||
      !CONTINUITY_ROLES.has(raw.continuityRole as CompanionAppearanceContinuityRole)
    ) {
      issues.push(`${label}.continuityRole is invalid`);
    } else {
      roles.push(raw.continuityRole as CompanionAppearanceContinuityRole);
    }
    for (const key of ['hue', 'pattern', 'bodyLanguageCue'] as const) {
      if (!isNonBlankString(raw[key])) issues.push(`${label}.${key} is missing`);
    }
    normalizedUniqueStrings(
      raw.forbidden,
      `${label}.forbidden`,
      issues,
      { allowEmpty: true },
    );
  });

  const orderedIndexes = [...indexes].sort((left, right) => left - right);
  if (
    orderedIndexes.length !== states.length ||
    orderedIndexes.some((entry, index) => entry !== index)
  ) {
    issues.push('companion appearance-state continuityIndex values must be contiguous from zero');
  }
  if (
    states.some(
      (raw, index) =>
        isObject(raw) && raw.continuityIndex !== index,
    )
  ) {
    issues.push('companion appearance-state states must be ordered by continuityIndex');
  }
  if (roles.filter((role) => role === 'baseline').length !== 1) {
    issues.push('companion appearance-state authority must contain exactly one baseline state');
  }
  if (!roles.includes('transition')) {
    issues.push('companion appearance-state authority must contain a transition state');
  }
  if (!roles.includes('mismatched')) {
    issues.push('companion appearance-state authority must contain a mismatched state');
  }
  if (roles.filter((role) => role === 'resolved').length !== 1) {
    issues.push('companion appearance-state authority must contain exactly one resolved state');
  }
  const highestState = states[states.length - 1];
  if (isObject(highestState) && highestState.continuityRole !== 'resolved') {
    issues.push('companion appearance-state highest continuity state must be resolved');
  }
  if (isNonBlankString(value.defaultStateId)) {
    const defaultState = states.find(
      (raw) => isObject(raw) && raw.id === value.defaultStateId,
    );
    if (!defaultState) {
      issues.push('companion appearance-state defaultStateId does not resolve');
    } else if (
      defaultState.continuityIndex !== 0 ||
      defaultState.continuityRole !== 'baseline'
    ) {
      issues.push('companion appearance-state default state must be baseline at continuityIndex 0');
    }
  }
  return issues;
}

export function normalizeCompanionAppearanceStateId(value: string): string {
  return value.trim().toLowerCase().replace(/^companion:/, '').replace(/-/g, '_');
}

export function resolveCompanionAppearanceState(
  authority: CompanionAppearanceStateAuthority,
  stateId: string,
): ResolvedCompanionAppearanceState | null {
  if (companionAppearanceStateAuthorityIssues(authority).length > 0) return null;
  const state = authority.states.find((candidate) => candidate.id === stateId);
  if (!state) return null;
  return {
    authorityVersion: authority.version,
    companionId: authority.companionId,
    invariantIdentityDescription: authority.invariantIdentityDescription,
    invariantForbidden: [...authority.invariantForbidden],
    ...structuredClone(state),
  };
}

export function companionAppearanceStateTransitionIsGradual(
  previous: ResolvedCompanionAppearanceState,
  current: ResolvedCompanionAppearanceState,
): boolean {
  return Math.abs(current.continuityIndex - previous.continuityIndex) <= 1;
}

/**
 * Reject only companion-scoped appearance prose. Colours elsewhere in the set,
 * props, wardrobe or lighting remain legal and unaffected.
 */
export function companionAppearanceProseConflicts(args: {
  authority: CompanionAppearanceStateAuthority;
  texts: readonly string[];
}): CompanionAppearanceProseConflict[] {
  const aliases = args.authority.subjectAliases.map((raw) => ({
    raw,
    normalized: normalizeSearchText(raw),
  }));
  const terms = [
    ...args.authority.states.map((state) => state.id),
    ...args.authority.reservedAppearanceTerms,
  ].map((raw) => {
    const marked = normalizeMarkedSearchText(raw);
    const markedOnly =
      HEBREW_SCRIPT_PATTERN.test(marked) &&
      COMBINING_MARK_PATTERN.test(marked);
    return {
      raw,
      normalized: markedOnly ? null : normalizeSearchText(raw),
      marked: markedOnly ? marked : null,
    };
  });
  const conflicts: CompanionAppearanceProseConflict[] = [];
  args.texts.forEach((text, textIndex) => {
    const normalized = normalizeSearchText(text);
    const marked = normalizeMarkedSearchText(text);
    const alias = aliases.find((candidate) =>
      containsSearchPhrase({
        haystack: normalized,
        needle: candidate.normalized,
        hebrewPrefixKind: 'alias',
      }),
    );
    if (!alias) return;
    for (const term of terms) {
      if (
        (term.normalized !== null &&
          containsSearchPhrase({
            haystack: normalized,
            needle: term.normalized,
            hebrewPrefixKind: 'term',
          })) ||
        (term.marked !== null &&
          containsSearchPhrase({
            haystack: marked,
            needle: term.marked,
            hebrewPrefixKind: 'term',
          }))
      ) {
        conflicts.push({ textIndex, alias: alias.raw, term: term.raw });
      }
    }
  });
  return conflicts;
}

export function buildCompanionAppearanceStatePromptBlock(
  state: ResolvedCompanionAppearanceState,
  companionName: string,
): string {
  return [
    `COMPANION INVARIANT IDENTITY — ${companionName}:`,
    state.invariantIdentityDescription,
    `INVARIANT FORBIDDEN: ${state.invariantForbidden.join('; ')}.`,
    'Preserve the exact same companion identity and canonical accessory. Only the typed appearance state below may vary.',
    `COMPANION APPEARANCE STATE — sole page authority (stateId=${state.id}, role=${state.continuityRole}, continuityIndex=${state.continuityIndex}):`,
    `HUE: ${state.hue}.`,
    `PATTERN: ${state.pattern}.`,
    `BODY LANGUAGE: ${state.bodyLanguageCue}.`,
    ...(state.forbidden.length > 0
      ? [`STATE FORBIDDEN: ${state.forbidden.join('; ')}.`]
      : []),
    'Use one coherent body appearance, never random recolouring, multicolour patches, or a different companion design.',
  ].join('\n');
}

export const CHAMELEON_KOKO_APPEARANCE_STATE_AUTHORITY: CompanionAppearanceStateAuthority = {
  version: COMPANION_APPEARANCE_STATE_AXIS_VERSION,
  companionId: 'chameleon_koko',
  defaultStateId: 'settled_warm_green',
  invariantIdentityDescription:
    'A small round chameleon with a pale cream-yellow belly, big warm round eyes, a shy gentle smile, a softly curled tail silhouette, and cute simplified storybook proportions — warm, huggable, and slightly shy. Preserve the exact anatomy, size, face, eye design, tail shape, and approved reference-sheet identity. Her body uses one harmonious state-owned tone at a time; the tiny warm-mustard fabric shoulder satchel remains separate canonical accessory authority and never changes with body colour.',
  invariantForbidden: [
    'multicolour body patchwork',
    'pink body spots',
    'pure mint body',
    'recolouring or omitting the warm-mustard satchel when visibly present',
    'state-driven changes to species, anatomy, proportions, face, eyes, tail, or accessory design',
  ],
  subjectAliases: [
    'chameleon_koko',
    'companion:chameleon_koko',
    'Kim',
    'Koko',
    'קים',
    'הזיקית',
    'chameleon',
  ],
  reservedAppearanceTerms: [
    'settled_warm_green',
    'alert_olive_shift',
    'mismatched_amber_stripes',
    'attuning_blue_green',
    'blended_moonlit_teal',
    'warm green',
    'green',
    'greenish',
    'yellow-green',
    'yellow',
    'olive-green',
    'olive',
    'amber-green',
    'amber',
    'blue-green',
    'blue',
    'teal-green',
    'teal',
    'stress stripes',
    'sharp stripes',
    'stripes sharpen',
    'body colour',
    'body color',
    'ירוק',
    'יָרֹק',
    'צהוב',
    'זית',
    'ענבר',
    'כחול',
    'טורקיז',
    'פסים',
    'צבע הגוף',
    'גוון הגוף',
  ],
  states: [
    {
      id: 'settled_warm_green',
      continuityIndex: 0,
      continuityRole: 'baseline',
      hue: 'one harmonious soft warm-green to gentle yellow-green body tone',
      pattern: 'smooth quiet skin with no sharp stress stripes and no patches',
      bodyLanguageCue: 'tail softly curled, large eyes calm and warm, small relaxed posture',
      forbidden: [
        'multiple body-tone patches',
        'pink spots',
        'pure mint body',
        'sharp stress stripes',
      ],
    },
    {
      id: 'alert_olive_shift',
      continuityIndex: 1,
      continuityRole: 'transition',
      hue: 'one harmonious muted olive-green body tone, slightly cooler than the baseline',
      pattern: 'faint narrow bands beginning to appear, never multicolour patches',
      bodyLanguageCue: 'eyes more alert, shoulders slightly drawn in, tail curl tightening',
      forbidden: [
        'fully calm baseline posture',
        'hard high-contrast stripes',
        'random colour spots',
        'accessory recolouring',
      ],
    },
    {
      id: 'mismatched_amber_stripes',
      continuityIndex: 2,
      continuityRole: 'mismatched',
      hue: 'one harmonious warm amber-green body tone that visibly mismatches the surrounding cool environment',
      pattern: 'clear sharper stress stripes across the single body tone, never patchwork',
      bodyLanguageCue: 'tail folded inward, body held smaller, eyes scanning the unfamiliar space',
      forbidden: [
        'successful environmental blending',
        'relaxed open posture',
        'multicolour patchwork',
        'pink spots',
      ],
    },
    {
      id: 'attuning_blue_green',
      continuityIndex: 3,
      continuityRole: 'transition',
      hue: 'one harmonious blue-green body tone moving toward the surrounding evening colours',
      pattern: 'stress stripes softening into broad low-contrast bands',
      bodyLanguageCue: 'tail loosening, body uncurling, eyes returning to the child and environment',
      forbidden: [
        'hard stress stripes',
        'instant perfect camouflage',
        'random colour spots',
        'accessory recolouring',
      ],
    },
    {
      id: 'blended_moonlit_teal',
      continuityIndex: 4,
      continuityRole: 'resolved',
      hue: 'one harmonious soft moonlit teal-green body tone corresponding with the calm evening environment',
      pattern: 'quiet low-contrast tonal shading with no hard stripes and no patches',
      bodyLanguageCue: 'tail softly curled again, open relaxed posture, warm steady eyes',
      forbidden: [
        'hard stress stripes',
        'mismatched warm amber body',
        'multicolour patchwork',
        'pink spots',
      ],
    },
  ],
};

const DECLARED_COMPANION_APPEARANCE_STATE_AUTHORITIES: Record<
  string,
  CompanionAppearanceStateAuthority
> = {
  chameleon_koko: CHAMELEON_KOKO_APPEARANCE_STATE_AUTHORITY,
};

/** Authoring-only declaration lookup. Runtime must use the frozen contract copy. */
export function declaredCompanionAppearanceStateAuthority(
  companionId: string | null | undefined,
): CompanionAppearanceStateAuthority | null {
  if (!companionId?.trim()) return null;
  const authority =
    DECLARED_COMPANION_APPEARANCE_STATE_AUTHORITIES[
      normalizeCompanionAppearanceStateId(companionId)
    ];
  return authority ? structuredClone(authority) : null;
}
