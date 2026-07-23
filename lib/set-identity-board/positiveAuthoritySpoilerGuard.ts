import { getPositiveStylePromptBlock } from '@/lib/styles';

import type { SetBoardExcludedProp, SetDefinition } from './types';

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

function positiveAuthoritySources(definition: SetDefinition): PositiveAuthoritySource[] {
  const sources: PositiveAuthoritySource[] = [
    {
      fieldPath: 'setIdentityId',
      provenance: 'SetDefinition.setIdentityId -> positive SET IDENTITY line',
      value: definition.setIdentityId,
    },
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
        fieldPath: `${prefix}.name`,
        provenance: `SetDefinitionLocation ${JSON.stringify(location.id)} -> positive location line`,
        value: location.name,
      },
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
    fieldPath: `styles[${JSON.stringify(definition.styleId)}].positivePrompt`,
    provenance: 'registered positive style block -> positive STYLE section',
    value: getPositiveStylePromptBlock(definition.styleId),
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
  const excludedProps = definition.contentPolicy.excludedProps
    .slice()
    .sort((a, b) => (a.propId < b.propId ? -1 : a.propId > b.propId ? 1 : 0));
  if (excludedProps.length === 0) return;

  const termsByProp = new Map<string, CanonicalTerm[]>(
    excludedProps.map((prop) => [
      prop.propId,
      deriveExcludedPropCanonicalTerms(prop).map((label) => ({
        label,
        words: canonicalSetBoardWords(label),
      })),
    ]),
  );

  for (const source of positiveAuthoritySources(definition)) {
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
}
