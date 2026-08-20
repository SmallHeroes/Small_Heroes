import { getSetBoardStylePromptBlock } from '@/lib/styles';

import {
  SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION,
  type SetBoardExcludedProp,
  type SetDefinition,
} from './types';

const LEADING_PROP_ID_NAMESPACES = new Set([
  'prop',
  'props',
  'recurring',
  'item',
  'items',
  'object',
  'objects',
]);

interface PositiveAuthoritySource {
  fieldPath: string;
  provenance: string;
  value: string;
}

interface CanonicalTerm {
  label: string;
  words: string[];
}

// These closed vocabularies are part of set-board-positive-authority/v2.
// Changing either list requires a new policy version so historical prompt
// projection cannot be silently reinterpreted.
const GENERIC_CAST_TERMS_V2 = [
  'person',
  'people',
  'human',
  'child',
  'children',
  'boy',
  'girl',
  'character',
  'companion',
  'animal',
  'creature',
  'mascot',
  'pet',
] as const;

const ACTION_TERMS_V2 = [
  'step through',
  'steps through',
  'stepping through',
  'step over',
  'steps over',
  'stepping over',
  'presses',
  'pressed',
  'pressing',
  'holds',
  'holding',
  'offers',
  'offering',
  'touches',
  'touching',
  'looks at',
  'reaches toward',
  'climbs onto',
  'sits on',
  'stands on',
  'points at',
  'walks',
  'walking',
  'runs',
  'running',
  'crouches',
  'crouching',
  'kneels',
  'kneeling',
  'leans',
  'leaning',
  'gestures',
  'posing',
  'behind them',
  'in front of them',
  'reveals',
  'revealed',
  'revealing',
  'discovers',
  'discovered',
  'appears',
  'appearing',
  'disappears',
  'disappearing',
  'portable light',
  'portable beam',
  'handheld light',
  'hand held light',
  'carried light',
  'moving beam',
  'sound',
  'sounds',
  'sound effect',
  'audible',
  'noise',
] as const;

const CAST_LABEL_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'of',
  'the',
]);

export class SetBoardPositiveAuthoritySpoilerError extends Error {
  readonly code = 'set_board_positive_authority_spoiler_leak' as const;
  readonly isSetBoardPositiveAuthoritySpoilerError = true as const;

  constructor(
    readonly setIdentityId: string,
    readonly fieldPath: string,
    readonly provenance: string,
    readonly excludedPropId: string,
    readonly excludedPropName: string,
    readonly matchedTerm: string,
  ) {
    super(
      `[set_board_positive_authority_spoiler_leak] set ${JSON.stringify(setIdentityId)} ` +
      `positive field ${fieldPath} (${provenance}) contains canonical excluded-prop term ` +
      `${JSON.stringify(matchedTerm)} for ${excludedPropId} (${JSON.stringify(excludedPropName)})`,
    );
    this.name = 'SetBoardPositiveAuthoritySpoilerError';
  }
}

export class SetBoardPositiveAuthorityLeakError extends Error {
  readonly code = 'set_board_positive_authority_leak' as const;
  readonly isSetBoardPositiveAuthorityLeakError = true as const;

  constructor(
    readonly setIdentityId: string,
    readonly category: 'policy' | 'cast' | 'undeclared_prop' | 'action',
    readonly fieldPath: string,
    readonly provenance: string,
    readonly matchedTerm: string,
    readonly blockedIdentity?: string,
  ) {
    super(
      `[set_board_positive_authority_leak] set ${JSON.stringify(setIdentityId)} ` +
      `positive field ${fieldPath} (${provenance}) contains ${category} term ` +
      `${JSON.stringify(matchedTerm)}` +
      (blockedIdentity ? ` for ${JSON.stringify(blockedIdentity)}` : ''),
    );
    this.name = 'SetBoardPositiveAuthorityLeakError';
  }
}

/**
 * Canonical word extraction is deliberately small and explainable:
 * - Unicode NFKC normalization
 * - locale-independent lowercase
 * - Unicode letter/mark/number tokens
 * - punctuation, whitespace, hyphens, and underscores are boundaries
 *
 * Matching compares whole token sequences. It never performs substring or fuzzy/stem matching.
 */
export function canonicalSetBoardWords(value: string): string[] {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .match(/\p{L}[\p{L}\p{M}\p{N}]*|\p{N}+/gu) ?? [];
}

/**
 * Terms come only from the excluded prop's structured identity/name:
 * - the full canonical name;
 * - the semantic id after leading namespaces such as `prop_` are removed;
 * - one semantic head token: the last id token also present in the name, or the final name token.
 *
 * The head catches a partial mention of the prop's semantic noun without treating leading descriptive modifiers
 * as standalone spoiler terms.
 */
export function deriveExcludedPropCanonicalTerms(
  prop: Pick<SetBoardExcludedProp, 'propId' | 'name'>,
): string[] {
  const nameWords = canonicalSetBoardWords(prop.name);
  const idWords = canonicalSetBoardWords(prop.propId);
  while (idWords.length > 0 && LEADING_PROP_ID_NAMESPACES.has(idWords[0])) {
    idWords.shift();
  }

  const nameWordSet = new Set(nameWords);
  const sharedSemanticHead = idWords
    .slice()
    .reverse()
    .find((word) => nameWordSet.has(word));
  const head = sharedSemanticHead ?? nameWords[nameWords.length - 1];
  const candidates = [
    nameWords,
    idWords,
    head ? [head] : [],
  ];

  const seen = new Set<string>();
  const terms: string[] = [];
  for (const words of candidates) {
    if (words.length === 0 || words.every((word) => /^\d+$/u.test(word))) continue;
    const label = words.join(' ');
    if (!seen.has(label)) {
      seen.add(label);
      terms.push(label);
    }
  }
  return terms;
}

function containsTerm(sourceWords: readonly string[], termWords: readonly string[]): boolean {
  if (termWords.length === 0 || termWords.length > sourceWords.length) return false;
  for (let start = 0; start <= sourceWords.length - termWords.length; start += 1) {
    if (termWords.every((word, offset) => sourceWords[start + offset] === word)) return true;
  }
  return false;
}

function canonicalTerms(values: readonly string[], includeIndividualWords: boolean): CanonicalTerm[] {
  const seen = new Set<string>();
  const terms: CanonicalTerm[] = [];
  for (const value of values) {
    const words = canonicalSetBoardWords(value);
    const candidates = [
      words,
      ...(includeIndividualWords
        ? words
            .filter((word) => word.length > 1 && !CAST_LABEL_STOP_WORDS.has(word))
            .map((word) => [word])
        : []),
    ];
    for (const candidate of candidates) {
      if (candidate.length === 0) continue;
      const label = candidate.join(' ');
      if (!seen.has(label)) {
        seen.add(label);
        terms.push({ label, words: candidate });
      }
    }
  }
  return terms;
}

/**
 * Closed label-only classifier shared by the prompt and Vision projections.
 * It does not sanitize descriptive authority; those fields remain in the
 * ordinary fail-closed source scan below.
 */
export function positiveAuthorityLabelIsSafe(
  definition: SetDefinition,
  value: string,
): boolean {
  const sourceWords = canonicalSetBoardWords(value);
  if (sourceWords.length === 0) return true;
  const candidateGroups: CanonicalTerm[][] = [
    canonicalTerms(GENERIC_CAST_TERMS_V2, false),
    ...definition.positiveAuthorityPolicy.blockedCast.map((identity) =>
      canonicalTerms([identity.castId, ...identity.labels], true)),
    ...[
      ...definition.positiveAuthorityPolicy.blockedProps,
      ...definition.contentPolicy.excludedProps,
    ].map((prop) =>
      deriveExcludedPropCanonicalTerms(prop).map((label) => ({
        label,
        words: canonicalSetBoardWords(label),
      }))),
    canonicalTerms(ACTION_TERMS_V2, false),
  ];
  return !candidateGroups.some((terms) =>
    terms.some((term) => containsTerm(sourceWords, term.words)));
}

function positiveAuthoritySources(definition: SetDefinition): PositiveAuthoritySource[] {
  const sources: PositiveAuthoritySource[] = [
    {
      fieldPath: 'boardVersion',
      provenance: 'SetDefinition.boardVersion -> positive SET IDENTITY line',
      value: definition.boardVersion,
    },
  ];

  for (const [locationIndex, location] of definition.locations.entries()) {
    const prefix = `locations[${locationIndex}]`;
    sources.push(
      {
        fieldPath: `${prefix}.timeOfDay`,
        provenance: `SetDefinitionLocation ${JSON.stringify(location.id)} -> positive time-of-day facet`,
        value: location.timeOfDay ?? '',
      },
      {
        fieldPath: `${prefix}.lighting`,
        provenance: `SetDefinitionLocation ${JSON.stringify(location.id)} -> positive lighting facet`,
        value: location.lighting ?? '',
      },
      {
        fieldPath: `${prefix}.environmentClass`,
        provenance: `SetDefinitionLocation ${JSON.stringify(location.id)} -> positive environment facet`,
        value: location.environmentClass ?? '',
      },
    );
  }

  for (const [zoneIndex, zone] of definition.zones.entries()) {
    for (const [geometryIndex, geometry] of zone.geometry.entries()) {
      sources.push({
        fieldPath: `zones[${zoneIndex}].geometry[${geometryIndex}]`,
        provenance:
          `SetDefinitionZone ${JSON.stringify(zone.id)} projected spatial-node description/closed relation ` +
          '-> positive geometry line',
        value: geometry,
      });
    }
  }

  for (const [factIndex, fact] of definition.fixedSetFacts.entries()) {
    const prefix = `fixedSetFacts[${factIndex}]`;
    sources.push(
      {
        fieldPath: `${prefix}.name`,
        provenance: `fixed prop ${JSON.stringify(fact.propId)} -> positive fixed-object name`,
        value: fact.name,
      },
      {
        fieldPath: `${prefix}.material`,
        provenance: `fixed prop ${JSON.stringify(fact.propId)} -> positive material fact`,
        value: fact.material ?? '',
      },
      {
        fieldPath: `${prefix}.scale`,
        provenance: `fixed prop ${JSON.stringify(fact.propId)} -> positive scale fact`,
        value: fact.scale ?? '',
      },
    );
  }

  sources.push({
    fieldPath: `styles[${JSON.stringify(definition.styleId)}].setBoard`,
    provenance: 'registered board-safe structured style fields -> positive STYLE section',
    value: getSetBoardStylePromptBlock(definition.styleId),
  });
  return sources;
}

/**
 * Fail closed when an excluded prop leaks into any positive text that the board prompt can emit.
 *
 * Intentional `NO <excluded prop>` policy/negative lines are not sources here, so they remain legal and required.
 * Location/zone/node ids, placement ids, and raw relation endpoints are not prompt prose: the prompt uses neutral
 * area/local-node aliases. Relation labels and opening kinds are closed enums, not authored free text.
 */
export function assertSetBoardPositiveAuthoritySpoilerNeutral(
  definition: SetDefinition,
): void {
  if (
    definition.positiveAuthorityPolicy?.version !==
    SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION
  ) {
    throw new SetBoardPositiveAuthorityLeakError(
      definition.setIdentityId,
      'policy',
      'positiveAuthorityPolicy.version',
      'direct SetDefinition prompt-input policy',
      String(definition.positiveAuthorityPolicy?.version ?? '(missing)'),
    );
  }

  const sources = positiveAuthoritySources(definition);
  const excludedProps = definition.contentPolicy.excludedProps
    .slice()
    .sort((a, b) => (a.propId < b.propId ? -1 : a.propId > b.propId ? 1 : 0));
  const termsByProp = new Map<string, CanonicalTerm[]>(
    excludedProps.map((prop) => [
      prop.propId,
      deriveExcludedPropCanonicalTerms(prop).map((label) => ({
        label,
        words: canonicalSetBoardWords(label),
      })),
    ]),
  );

  for (const source of sources) {
    const sourceWords = canonicalSetBoardWords(source.value);
    if (sourceWords.length === 0) continue;
    for (const prop of excludedProps) {
      for (const term of termsByProp.get(prop.propId) ?? []) {
        if (containsTerm(sourceWords, term.words)) {
          throw new SetBoardPositiveAuthoritySpoilerError(
            definition.setIdentityId,
            source.fieldPath,
            source.provenance,
            prop.propId,
            prop.name,
            term.label,
          );
        }
      }
    }
  }

  const genericCastTerms = canonicalTerms(GENERIC_CAST_TERMS_V2, false);
  const blockedCast = definition.positiveAuthorityPolicy.blockedCast.map((identity) => ({
    identity: identity.castId,
    terms: canonicalTerms([identity.castId, ...identity.labels], true),
  }));
  const blockedProps = definition.positiveAuthorityPolicy.blockedProps.map((prop) => ({
    identity: prop.propId,
    terms: deriveExcludedPropCanonicalTerms(prop).map((label) => ({
      label,
      words: canonicalSetBoardWords(label),
    })),
  }));
  const actionTerms = canonicalTerms(ACTION_TERMS_V2, false);

  for (const source of sources) {
    const sourceWords = canonicalSetBoardWords(source.value);
    if (sourceWords.length === 0) continue;
    for (const term of genericCastTerms) {
      if (containsTerm(sourceWords, term.words)) {
        throw new SetBoardPositiveAuthorityLeakError(
          definition.setIdentityId,
          'cast',
          source.fieldPath,
          source.provenance,
          term.label,
        );
      }
    }
    for (const blocked of blockedCast) {
      for (const term of blocked.terms) {
        if (containsTerm(sourceWords, term.words)) {
          throw new SetBoardPositiveAuthorityLeakError(
            definition.setIdentityId,
            'cast',
            source.fieldPath,
            source.provenance,
            term.label,
            blocked.identity,
          );
        }
      }
    }
    for (const blocked of blockedProps) {
      for (const term of blocked.terms) {
        if (containsTerm(sourceWords, term.words)) {
          throw new SetBoardPositiveAuthorityLeakError(
            definition.setIdentityId,
            'undeclared_prop',
            source.fieldPath,
            source.provenance,
            term.label,
            blocked.identity,
          );
        }
      }
    }
    for (const term of actionTerms) {
      if (containsTerm(sourceWords, term.words)) {
        throw new SetBoardPositiveAuthorityLeakError(
          definition.setIdentityId,
          'action',
          source.fieldPath,
          source.provenance,
          term.label,
        );
      }
    }
  }
}
