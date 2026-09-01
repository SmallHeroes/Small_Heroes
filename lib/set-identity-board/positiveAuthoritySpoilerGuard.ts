import { getSetBoardStylePromptBlock } from '@/lib/styles';

import {
  SET_BOARD_POSITIVE_AUTHORITY_CONTEXTUAL_POLICY_VERSION,
  SET_BOARD_POSITIVE_AUTHORITY_PRECISE_POLICY_VERSION,
  SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION,
  type SetBoardExcludedProp,
  type SetBoardPositiveAuthorityPolicyVersion,
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
  architecturalScaleFixtureSuffix?: string[];
  spatialNode?: SetDefinition['zones'][number]['spatialNodes'][number];
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

// Every closed vocabulary and derivation rule in this v3 block is
// hash-semantic set-board-positive-authority/v3 policy. Any addition,
// removal, or reinterpretation requires a new positive-authority policy
// version; never edit these semantics in place for an approved v3 identity.
const ARCHITECTURAL_SCALE_MODIFIERS_V3 = new Set([
  'scale',
  'scaled',
  'sized',
]);

// V4 is additive. Never add this member to the frozen v3 vocabulary.
const ARCHITECTURAL_FIXTURE_MODIFIERS_V4 = new Set([
  ...ARCHITECTURAL_SCALE_MODIFIERS_V3,
  'accessible',
]);

const ARCHITECTURAL_SCALE_FIXTURE_SUFFIXES_V3 = new Set([
  'bed',
  'table',
  'craft table',
  'work table',
]);

const LEADING_SPATIAL_NODE_ID_NAMESPACES_V3 = new Set([
  'node',
  'spatial',
]);

const HUMAN_CONTEXT_APERTURE_SUFFIXES_V4 = new Map<
  SetDefinition['zones'][number]['spatialNodes'][number]['kind'],
  readonly (readonly string[])[]
>([
  ['doorway', [['gate']]],
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

export type SetBoardPositiveAuthorityIssue =
  | SetBoardPositiveAuthoritySpoilerError
  | SetBoardPositiveAuthorityLeakError;

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
  policyVersion: SetBoardPositiveAuthorityPolicyVersion =
    SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION,
): string[] {
  const nameWords = canonicalSetBoardWords(prop.name);
  const idWords = canonicalSetBoardWords(prop.propId);
  while (idWords.length > 0 && LEADING_PROP_ID_NAMESPACES.has(idWords[0])) {
    idWords.shift();
  }

  let headWords: string[] = [];
  if (
    policyVersion === SET_BOARD_POSITIVE_AUTHORITY_PRECISE_POLICY_VERSION ||
    policyVersion === SET_BOARD_POSITIVE_AUTHORITY_CONTEXTUAL_POLICY_VERSION
  ) {
    const terminalIdWord = idWords[idWords.length - 1];
    const nameWordSet = new Set(nameWords);
    const sharedSemanticHead = idWords
      .slice()
      .reverse()
      .find((word) => nameWordSet.has(word));
    const alignedNameWord = nameWords
      .slice()
      .reverse()
      .find((word) =>
        Boolean(terminalIdWord) &&
        canonicalSingularPluralPair(word, terminalIdWord));
    const fallbackNameHead =
      sharedSemanticHead ?? nameWords[nameWords.length - 1];
    headWords = alignedNameWord && terminalIdWord
      ? [terminalIdWord, alignedNameWord]
      : fallbackNameHead
        ? [fallbackNameHead]
        : [];
  } else {
    const nameWordSet = new Set(nameWords);
    const sharedSemanticHead = idWords
      .slice()
      .reverse()
      .find((word) => nameWordSet.has(word));
    const head = sharedSemanticHead ?? nameWords[nameWords.length - 1];
    headWords = head ? [head] : [];
  }
  const candidates = [
    nameWords,
    idWords,
    ...headWords.map((word) => [word]),
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

function canonicalSingularPluralPair(left: string, right: string): boolean {
  return left === right ||
    (left.length > 2 && `${left}s` === right) ||
    (right.length > 2 && `${right}s` === left);
}

function containsTerm(sourceWords: readonly string[], termWords: readonly string[]): boolean {
  if (termWords.length === 0 || termWords.length > sourceWords.length) return false;
  for (let start = 0; start <= sourceWords.length - termWords.length; start += 1) {
    if (termWords.every((word, offset) => sourceWords[start + offset] === word)) return true;
  }
  return false;
}

function containsCastTerm(
  sourceWords: readonly string[],
  termWords: readonly string[],
  policyVersion: SetBoardPositiveAuthorityPolicyVersion,
  architecturalScaleChildOrdinals: ReadonlySet<number>,
  contextualHumanQualifierOrdinals: ReadonlySet<number> = new Set<number>(),
): boolean {
  if (termWords.length !== 1) {
    return containsTerm(sourceWords, termWords);
  }
  for (let index = 0; index < sourceWords.length; index += 1) {
    if (sourceWords[index] !== termWords[0]) continue;
    const architecturalChildOccurrence =
      termWords[0] === 'child' &&
      (policyVersion === SET_BOARD_POSITIVE_AUTHORITY_PRECISE_POLICY_VERSION ||
        policyVersion ===
          SET_BOARD_POSITIVE_AUTHORITY_CONTEXTUAL_POLICY_VERSION) &&
      architecturalScaleChildOrdinals.has(index);
    const contextualHumanOccurrence =
      policyVersion ===
        SET_BOARD_POSITIVE_AUTHORITY_CONTEXTUAL_POLICY_VERSION &&
      contextualHumanQualifierOrdinals.has(index);
    if (!architecturalChildOccurrence && !contextualHumanOccurrence) {
      return true;
    }
  }
  return false;
}

function architecturalScaleChildOrdinals(
  source: PositiveAuthoritySource,
  policyVersion: SetBoardPositiveAuthorityPolicyVersion,
): ReadonlySet<number> {
  if (
    (policyVersion !== SET_BOARD_POSITIVE_AUTHORITY_PRECISE_POLICY_VERSION &&
      policyVersion !==
        SET_BOARD_POSITIVE_AUTHORITY_CONTEXTUAL_POLICY_VERSION) ||
    !/^zones\[\d+\]\.geometry\[\d+\]$/u.test(source.fieldPath) ||
    !source.architecturalScaleFixtureSuffix
  ) {
    return new Set<number>();
  }
  const normalized = source.value.normalize('NFKC').toLowerCase();
  const tokenMatches = [
    ...normalized.matchAll(/\p{L}[\p{L}\p{M}\p{N}]*|\p{N}+/gu),
  ];
  const modifiers = policyVersion ===
      SET_BOARD_POSITIVE_AUTHORITY_CONTEXTUAL_POLICY_VERSION
    ? ARCHITECTURAL_FIXTURE_MODIFIERS_V4
    : ARCHITECTURAL_SCALE_MODIFIERS_V3;
  const ordinals = new Set<number>();
  for (let index = 0; index < tokenMatches.length - 1; index += 1) {
    const current = tokenMatches[index];
    const next = tokenMatches[index + 1];
    if (
      current[0] !== 'child' ||
      !modifiers.has(next[0]) ||
      current.index === undefined ||
      next.index === undefined
    ) {
      continue;
    }
    const separator = normalized.slice(
      current.index + current[0].length,
      next.index,
    );
    // The exception is lexical, not semantic guesswork: only an explicit
    // hyphen/dash compound is architectural. Spaced prose such as
    // "the child scaled the wall" remains ordinary cast authority.
    if (!/^\p{Pd}+$/u.test(separator)) continue;
    const fixtureSuffix = source.architecturalScaleFixtureSuffix;
    if (fixtureSuffix.every((word, offset) =>
      tokenMatches[index + 2 + offset]?.[0] === word)) {
      ordinals.add(index);
    }
  }
  return ordinals;
}

function wordsEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return left.length === right.length &&
    left.every((word, index) => word === right[index]);
}

/**
 * V4 may release only the contextual prefix of a namespaced human role when
 * structured geometry independently proves that the same words name an
 * aperture. The person-denoting terminal head is never released.
 */
function contextualHumanQualifierOrdinals(
  source: PositiveAuthoritySource,
  policyVersion: SetBoardPositiveAuthorityPolicyVersion,
  castId: string,
  castLabels: readonly string[],
): ReadonlySet<number> {
  if (
    policyVersion !== SET_BOARD_POSITIVE_AUTHORITY_CONTEXTUAL_POLICY_VERSION ||
    !/^zones\[\d+\]\.geometry\[\d+\]$/u.test(source.fieldPath) ||
    !source.spatialNode ||
    !castId.startsWith('human:')
  ) {
    return new Set<number>();
  }
  const roleWords = canonicalSetBoardWords(castId);
  if (roleWords[0] !== 'human' || roleWords.length < 3) {
    return new Set<number>();
  }
  roleWords.shift();
  const qualifierWords = roleWords.slice(0, -1);
  if (qualifierWords.length === 0) return new Set<number>();
  const structuralRoleWords = roleWords;
  const structuralCastIdWords = ['human', ...roleWords];
  const nonStructuralLabelClaimsQualifier = castLabels.some((label) => {
    const labelWords = canonicalSetBoardWords(label);
    if (
      wordsEqual(labelWords, structuralRoleWords) ||
      wordsEqual(labelWords, structuralCastIdWords)
    ) {
      return false;
    }
    return labelWords.some((word) => qualifierWords.includes(word));
  });
  // A name/alias claim always outranks the contextual aperture exception.
  // The exception is derivable only from the stable human role identity.
  if (nonStructuralLabelClaimsQualifier) return new Set<number>();

  const suffixes = HUMAN_CONTEXT_APERTURE_SUFFIXES_V4.get(
    source.spatialNode.kind,
  ) ?? [];
  const nodeWords = canonicalSetBoardWords(source.spatialNode.id);
  while (
    nodeWords.length > 0 &&
    LEADING_SPATIAL_NODE_ID_NAMESPACES_V3.has(nodeWords[0])
  ) {
    nodeWords.shift();
  }
  const physicalPhrase = suffixes
    .map((suffix) => [...qualifierWords, ...suffix])
    .find((candidate) => wordsEqual(candidate, nodeWords));
  if (!physicalPhrase) return new Set<number>();

  const sourceWords = canonicalSetBoardWords(source.value);
  const matchingStarts: number[] = [];
  for (
    let start = 0;
    start <= sourceWords.length - physicalPhrase.length;
    start += 1
  ) {
    if (!physicalPhrase.every(
      (word, offset) => sourceWords[start + offset] === word,
    )) {
      continue;
    }
    matchingStarts.push(start);
  }
  // A node describes one physical aperture. Repeated contextual phrases are
  // ambiguous positive authority, so v4 never releases more than one lexical
  // occurrence from one structured node.
  if (matchingStarts.length !== 1) return new Set<number>();
  const ordinals = new Set<number>();
  for (let offset = 0; offset < qualifierWords.length; offset += 1) {
    ordinals.add(matchingStarts[0]! + offset);
  }
  return ordinals;
}

function architecturalScaleFixtureSuffix(
  node: SetDefinition['zones'][number]['spatialNodes'][number] | undefined,
): string[] | undefined {
  if (node?.kind !== 'furniture') return undefined;
  const words = canonicalSetBoardWords(node.id);
  while (
    words.length > 0 &&
    LEADING_SPATIAL_NODE_ID_NAMESPACES_V3.has(words[0])
  ) {
    words.shift();
  }
  return ARCHITECTURAL_SCALE_FIXTURE_SUFFIXES_V3.has(words.join(' '))
    ? words
    : undefined;
}

function supportedPolicyVersion(
  value: unknown,
): value is SetBoardPositiveAuthorityPolicyVersion {
  return value === SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION ||
    value === SET_BOARD_POSITIVE_AUTHORITY_PRECISE_POLICY_VERSION ||
    value === SET_BOARD_POSITIVE_AUTHORITY_CONTEXTUAL_POLICY_VERSION;
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
  const policyVersion = definition.positiveAuthorityPolicy?.version;
  if (!supportedPolicyVersion(policyVersion)) return false;
  const sourceWords = canonicalSetBoardWords(value);
  if (sourceWords.length === 0) return true;
  const castGroups: CanonicalTerm[][] = [
    canonicalTerms(GENERIC_CAST_TERMS_V2, false),
    ...definition.positiveAuthorityPolicy.blockedCast.map((identity) =>
      canonicalTerms([identity.castId, ...identity.labels], true)),
  ];
  if (castGroups.some((terms) =>
    terms.some((term) =>
      containsTerm(sourceWords, term.words)))) {
    return false;
  }
  const propGroups = [
    ...definition.positiveAuthorityPolicy.blockedProps,
    ...definition.contentPolicy.excludedProps,
  ].map((prop) =>
    deriveExcludedPropCanonicalTerms(prop, policyVersion).map((label) => ({
      label,
      words: canonicalSetBoardWords(label),
    })));
  if (propGroups.some((terms) =>
    terms.some((term) => containsTerm(sourceWords, term.words)))) {
    return false;
  }
  return !canonicalTerms(ACTION_TERMS_V2, false).some((term) =>
    containsTerm(sourceWords, term.words));
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
      const node = geometryIndex < zone.spatialNodes.length
        ? zone.spatialNodes[geometryIndex]
        : undefined;
      const fixtureSuffix = architecturalScaleFixtureSuffix(node);
      sources.push({
        fieldPath: `zones[${zoneIndex}].geometry[${geometryIndex}]`,
        provenance:
          `SetDefinitionZone ${JSON.stringify(zone.id)} projected spatial-node description/closed relation ` +
          '-> positive geometry line',
        value: geometry,
        ...(node ? { spatialNode: node } : {}),
        ...(fixtureSuffix
          ? { architecturalScaleFixtureSuffix: fixtureSuffix }
          : {}),
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
export function collectSetBoardPositiveAuthorityIssues(
  definition: SetDefinition,
): SetBoardPositiveAuthorityIssue[] {
  const policyVersion = definition.positiveAuthorityPolicy?.version;
  if (!supportedPolicyVersion(policyVersion)) {
    return [new SetBoardPositiveAuthorityLeakError(
      definition.setIdentityId,
      'policy',
      'positiveAuthorityPolicy.version',
      'direct SetDefinition prompt-input policy',
      String(policyVersion ?? '(missing)'),
    )];
  }

  const issues: SetBoardPositiveAuthorityIssue[] = [];
  const seen = new Set<string>();
  const add = (candidate: SetBoardPositiveAuthorityIssue): void => {
    const key = candidate instanceof SetBoardPositiveAuthoritySpoilerError
      ? [candidate.code, candidate.fieldPath, candidate.excludedPropId, candidate.matchedTerm].join('\u0000')
      : [
          candidate.code,
          candidate.category,
          candidate.fieldPath,
          candidate.matchedTerm,
          candidate.blockedIdentity ?? '',
        ].join('\u0000');
    if (!seen.has(key)) {
      seen.add(key);
      issues.push(candidate);
    }
  };
  const sources = positiveAuthoritySources(definition);
  const excludedProps = definition.contentPolicy.excludedProps
    .slice()
    .sort((a, b) => (a.propId < b.propId ? -1 : a.propId > b.propId ? 1 : 0));
  const termsByProp = new Map<string, CanonicalTerm[]>(
    excludedProps.map((prop) => [
      prop.propId,
      deriveExcludedPropCanonicalTerms(prop, policyVersion).map((label) => ({
        label,
        words: canonicalSetBoardWords(label),
      })),
    ]),
  );

  for (const source of sources) {
    const sourceWords = canonicalSetBoardWords(source.value);
    if (sourceWords.length === 0) continue;
    for (const prop of excludedProps) {
      const term = (termsByProp.get(prop.propId) ?? []).find((candidate) =>
        containsTerm(sourceWords, candidate.words));
      if (term) {
        add(new SetBoardPositiveAuthoritySpoilerError(
          definition.setIdentityId,
          source.fieldPath,
          source.provenance,
          prop.propId,
          prop.name,
          term.label,
        ));
      }
    }
  }

  const genericCastTerms = canonicalTerms(GENERIC_CAST_TERMS_V2, false);
  const blockedCast = definition.positiveAuthorityPolicy.blockedCast.map((identity) => ({
    identity: identity.castId,
    labels: identity.labels,
    terms: canonicalTerms([identity.castId, ...identity.labels], true),
  }));
  const excludedPropIds = new Set(excludedProps.map((prop) => prop.propId));
  const blockedProps = definition.positiveAuthorityPolicy.blockedProps.map((prop) => ({
    identity: prop.propId,
    terms: deriveExcludedPropCanonicalTerms(prop, policyVersion).map((label) => ({
      label,
      words: canonicalSetBoardWords(label),
    })),
  })).filter((prop) => !excludedPropIds.has(prop.identity));
  const actionTerms = canonicalTerms(ACTION_TERMS_V2, false);

  for (const source of sources) {
    const sourceWords = canonicalSetBoardWords(source.value);
    if (sourceWords.length === 0) continue;
    const scaleChildOrdinals = architecturalScaleChildOrdinals(
      source,
      policyVersion,
    );
    const specificallyBlockedCastLabels = new Set<string>();
    for (const blocked of blockedCast) {
      const contextualOrdinals = contextualHumanQualifierOrdinals(
        source,
        policyVersion,
        blocked.identity,
        blocked.labels,
      );
      for (const term of blocked.terms) {
        if (containsCastTerm(
          sourceWords,
          term.words,
          policyVersion,
          scaleChildOrdinals,
          contextualOrdinals,
        )) {
          add(new SetBoardPositiveAuthorityLeakError(
            definition.setIdentityId,
            'cast',
            source.fieldPath,
            source.provenance,
            term.label,
            blocked.identity,
          ));
          specificallyBlockedCastLabels.add(term.label);
          break;
        }
      }
    }
    for (const term of genericCastTerms) {
      if (
        !specificallyBlockedCastLabels.has(term.label) &&
        containsCastTerm(
          sourceWords,
          term.words,
          policyVersion,
          scaleChildOrdinals,
        )
      ) {
        add(new SetBoardPositiveAuthorityLeakError(
          definition.setIdentityId,
          'cast',
          source.fieldPath,
          source.provenance,
          term.label,
        ));
      }
    }
    for (const blocked of blockedProps) {
      for (const term of blocked.terms) {
        if (containsTerm(sourceWords, term.words)) {
          add(new SetBoardPositiveAuthorityLeakError(
            definition.setIdentityId,
            'undeclared_prop',
            source.fieldPath,
            source.provenance,
            term.label,
            blocked.identity,
          ));
          break;
        }
      }
    }
    for (const term of actionTerms) {
      if (containsTerm(sourceWords, term.words)) {
        add(new SetBoardPositiveAuthorityLeakError(
          definition.setIdentityId,
          'action',
          source.fieldPath,
          source.provenance,
          term.label,
        ));
      }
    }
  }
  return issues;
}

export function assertSetBoardPositiveAuthoritySpoilerNeutral(
  definition: SetDefinition,
): void {
  const [firstIssue] = collectSetBoardPositiveAuthorityIssues(definition);
  if (firstIssue) throw firstIssue;
}
