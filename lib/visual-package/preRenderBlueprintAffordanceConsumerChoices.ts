import { canonicalize } from '@/lib/canonical-json';
import type { BookVisualContractTemplate } from '@/lib/visual-contract-compiler/contractTemplateTypes';

import type {
  BlueprintAffordanceConsumer,
  PreRenderBlueprintIssue,
} from './preRenderBlueprintTypes';

type Obj = Record<string, unknown>;

export type PreRenderBlueprintSemanticConsumer = Exclude<
  BlueprintAffordanceConsumer,
  { kind: 'frame' }
>;
export type PreRenderBlueprintSemanticConsumerKind =
  PreRenderBlueprintSemanticConsumer['kind'];

export interface PreRenderBlueprintAffordanceConsumerChoice {
  kind: PreRenderBlueprintSemanticConsumerKind;
  choiceIndex: number;
}

export interface PreRenderBlueprintAffordanceConsumerCatalog {
  action: Extract<PreRenderBlueprintSemanticConsumer, { kind: 'action' }>[];
  placement: Extract<
    PreRenderBlueprintSemanticConsumer,
    { kind: 'placement' }
  >[];
  transition: Extract<
    PreRenderBlueprintSemanticConsumer,
    { kind: 'transition' }
  >[];
  safety: Extract<PreRenderBlueprintSemanticConsumer, { kind: 'safety' }>[];
}

export class PreRenderBlueprintAffordanceConsumerChoiceBindingError extends Error {
  constructor(readonly issues: PreRenderBlueprintIssue[]) {
    super(
      `Blueprint affordance consumer choice binding failed with ${issues.length} issue(s)`,
    );
    this.name = 'PreRenderBlueprintAffordanceConsumerChoiceBindingError';
  }
}

function isObj(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function lexicalCompare(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueCanonical<T>(values: readonly T[]): T[] {
  const byIdentity = new Map<string, T>();
  for (const value of values) {
    byIdentity.set(stableJson(value), clone(value));
  }
  return [...byIdentity.entries()]
    .sort(([left], [right]) => lexicalCompare(left, right))
    .map(([, value]) => value);
}

export function buildPreRenderBlueprintAffordanceConsumerCatalog(
  template: BookVisualContractTemplate,
): PreRenderBlueprintAffordanceConsumerCatalog {
  return {
    action: uniqueCanonical(
      template.pageContracts.flatMap((page) =>
        (page.actionRequirements ?? []).flatMap((action) =>
          action.polarity === 'must'
            ? [
                {
                  kind: 'action' as const,
                  pageNumber: page.pageNumber,
                  checkId: action.checkId,
                },
              ]
            : [],
        ),
      ),
    ),
    placement: uniqueCanonical(
      template.pageContracts.flatMap((page) =>
        (page.propConstraints ?? []).flatMap((constraint) =>
          constraint.visibility === 'required'
            ? [
                {
                  kind: 'placement' as const,
                  pageNumber: page.pageNumber,
                  propId: constraint.propId,
                },
              ]
            : [],
        ),
      ),
    ),
    transition: uniqueCanonical(
      template.pageContracts.flatMap((page) =>
        page.transition && page.transition.kind !== 'steady'
          ? [
              {
                kind: 'transition' as const,
                pageNumber: page.pageNumber,
              },
            ]
          : [],
      ),
    ),
    safety: uniqueCanonical(
      template.pageContracts.flatMap((page) =>
        (page.safetyConstraints ?? []).map((constraint) => ({
          kind: 'safety' as const,
          pageNumber: page.pageNumber,
          subjectId: constraint.subjectId,
          relation: constraint.relation,
          target: clone(constraint.target),
        })),
      ),
    ),
  };
}

export function compactPreRenderBlueprintAffordanceConsumerCatalog(
  catalog: PreRenderBlueprintAffordanceConsumerCatalog,
): {
  a: [number, string][];
  p: [number, string][];
  t: number[];
  s: [number, string, string, [string, string]][];
} {
  return {
    a: catalog.action.map((consumer) => [
      consumer.pageNumber,
      consumer.checkId,
    ]),
    p: catalog.placement.map((consumer) => [
      consumer.pageNumber,
      consumer.propId,
    ]),
    t: catalog.transition.map((consumer) => consumer.pageNumber),
    s: catalog.safety.map((consumer) => [
      consumer.pageNumber,
      consumer.subjectId,
      consumer.relation,
      [consumer.target.kind, consumer.target.id],
    ]),
  };
}

const ALLOWED_CONSUMER_KINDS_BY_AFFORDANCE = {
  traversal: ['transition'],
  opening_clearance: ['transition'],
  placement_support: ['placement'],
  action_space: ['action'],
  camera_access: [],
  safe_boundary: ['transition', 'safety'],
} as const satisfies Record<string, readonly PreRenderBlueprintSemanticConsumerKind[]>;

function allowedConsumerKinds(
  affordanceKind: unknown,
): readonly PreRenderBlueprintSemanticConsumerKind[] {
  return typeof affordanceKind === 'string' &&
    Object.prototype.hasOwnProperty.call(
      ALLOWED_CONSUMER_KINDS_BY_AFFORDANCE,
      affordanceKind,
    )
    ? ALLOWED_CONSUMER_KINDS_BY_AFFORDANCE[
        affordanceKind as keyof typeof ALLOWED_CONSUMER_KINDS_BY_AFFORDANCE
      ]
    : [];
}

function choiceHasExactShape(
  value: unknown,
): value is PreRenderBlueprintAffordanceConsumerChoice {
  return (
    isObj(value) &&
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify(['choiceIndex', 'kind']) &&
    (value.kind === 'action' ||
      value.kind === 'placement' ||
      value.kind === 'transition' ||
      value.kind === 'safety')
  );
}

function catalogForKind(
  catalog: PreRenderBlueprintAffordanceConsumerCatalog,
  kind: PreRenderBlueprintSemanticConsumerKind,
): readonly PreRenderBlueprintSemanticConsumer[] {
  return catalog[kind];
}

function bindingIssue(
  code: PreRenderBlueprintIssue['code'],
  message: string,
  extra: Omit<PreRenderBlueprintIssue, 'code' | 'message'>,
): PreRenderBlueprintIssue {
  return { code, message, ...extra };
}

export function bindPreRenderBlueprintAffordanceConsumerChoices(args: {
  rawAffordances: unknown;
  catalog: PreRenderBlueprintAffordanceConsumerCatalog;
}): unknown[] {
  if (!Array.isArray(args.rawAffordances)) {
    throw new PreRenderBlueprintAffordanceConsumerChoiceBindingError([
      bindingIssue(
        'schema_invalid',
        'Blueprint affordances must be an array before consumer binding',
        { field: 'worldPlan.affordances', expected: 'array', actual: typeof args.rawAffordances },
      ),
    ]);
  }

  const affordances = clone(args.rawAffordances);
  const issues: PreRenderBlueprintIssue[] = [];

  affordances.forEach((affordance, affordanceIndex) => {
    const affordanceField = `worldPlan.affordances[${affordanceIndex}]`;
    if (!isObj(affordance) || !Array.isArray(affordance.consumers)) {
      issues.push(
        bindingIssue(
          'schema_invalid',
          'affordance consumers must be an array of bounded choices',
          { field: `${affordanceField}.consumers`, expected: 'array' },
        ),
      );
      return;
    }

    const allowedKinds = allowedConsumerKinds(affordance.kind);
    const resolved: PreRenderBlueprintSemanticConsumer[] = [];
    const seen = new Set<string>();

    affordance.consumers.forEach((choice, consumerIndex) => {
      const consumerField = `${affordanceField}.consumers[${consumerIndex}]`;
      if (!choiceHasExactShape(choice)) {
        issues.push(
          bindingIssue(
            'schema_invalid',
            'affordance consumer must contain only kind and choiceIndex',
            {
              field: consumerField,
              expected: ['choiceIndex', 'kind'],
              actual: isObj(choice) ? Object.keys(choice).sort() : typeof choice,
            },
          ),
        );
        return;
      }

      if (!allowedKinds.includes(choice.kind)) {
        issues.push(
          bindingIssue(
            'affordance_incompatible',
            'consumer choice kind is incompatible with the affordance kind',
            {
              field: `${consumerField}.kind`,
              expected: [...allowedKinds],
              actual: choice.kind,
            },
          ),
        );
        return;
      }

      if (!Number.isSafeInteger(choice.choiceIndex) || choice.choiceIndex < 0) {
        issues.push(
          bindingIssue(
            'schema_invalid',
            'consumer choiceIndex must be a non-negative safe integer',
            {
              field: `${consumerField}.choiceIndex`,
              expected: 'non_negative_safe_integer',
              actual: choice.choiceIndex,
            },
          ),
        );
        return;
      }

      const kindCatalog = catalogForKind(args.catalog, choice.kind);
      const selected = kindCatalog[choice.choiceIndex];
      if (!selected) {
        issues.push(
          bindingIssue(
            'affordance_incompatible',
            'consumer choiceIndex is outside the canonical catalog',
            {
              field: `${consumerField}.choiceIndex`,
              expected: {
                minimum: 0,
                exclusiveMaximum: kindCatalog.length,
              },
              actual: choice.choiceIndex,
            },
          ),
        );
        return;
      }

      const key = stableJson(selected);
      if (seen.has(key)) {
        issues.push(
          bindingIssue(
            'reference_duplicate',
            'duplicate affordance consumer choice',
            {
              field: consumerField,
              expected: 'unique_choice',
              actual: { kind: choice.kind, choiceIndex: choice.choiceIndex },
            },
          ),
        );
        return;
      }
      seen.add(key);
      resolved.push(clone(selected));
    });

    affordance.consumers = resolved;
  });

  if (issues.length > 0) {
    throw new PreRenderBlueprintAffordanceConsumerChoiceBindingError(issues);
  }
  return affordances;
}

function semanticConsumerKind(value: unknown): value is PreRenderBlueprintSemanticConsumer {
  return (
    isObj(value) &&
    (value.kind === 'action' ||
      value.kind === 'placement' ||
      value.kind === 'transition' ||
      value.kind === 'safety')
  );
}

export function projectPreRenderBlueprintAffordanceConsumerChoices(args: {
  affordances: unknown;
  catalog: PreRenderBlueprintAffordanceConsumerCatalog;
}): unknown[] {
  if (!Array.isArray(args.affordances)) {
    throw new Error('Blueprint affordances must be an array for consumer choice projection');
  }
  const affordances = clone(args.affordances);
  const indexByKind = {
    action: new Map(args.catalog.action.map((value, index) => [stableJson(value), index])),
    placement: new Map(
      args.catalog.placement.map((value, index) => [stableJson(value), index]),
    ),
    transition: new Map(
      args.catalog.transition.map((value, index) => [stableJson(value), index]),
    ),
    safety: new Map(args.catalog.safety.map((value, index) => [stableJson(value), index])),
  };

  affordances.forEach((affordance, affordanceIndex) => {
    if (!isObj(affordance) || !Array.isArray(affordance.consumers)) {
      throw new Error(
        `Blueprint affordance ${affordanceIndex} has no consumer array for choice projection`,
      );
    }
    affordance.consumers = affordance.consumers.flatMap((consumer, consumerIndex) => {
      if (isObj(consumer) && consumer.kind === 'frame') return [];
      if (choiceHasExactShape(consumer)) return [clone(consumer)];
      if (!semanticConsumerKind(consumer)) {
        throw new Error(
          `Blueprint affordance ${affordanceIndex} consumer ${consumerIndex} is not projectable`,
        );
      }
      const choiceIndex = indexByKind[consumer.kind].get(stableJson(consumer));
      if (choiceIndex === undefined) {
        throw new Error(
          `Blueprint affordance ${affordanceIndex} consumer ${consumerIndex} is outside canonical consumer authority`,
        );
      }
      return [{ kind: consumer.kind, choiceIndex }];
    });
  });
  return affordances;
}

/**
 * Repair-only projection. A schema-invalid provider draft must remain repairable:
 * known semantic consumers are rebound exactly, while malformed/unknown choices
 * are reduced to a closed kind + raw index sentinel instead of throwing before
 * the next bounded provider call.
 */
export function projectPreRenderBlueprintAffordanceConsumerChoicesForRepair(args: {
  affordances: unknown;
  catalog: PreRenderBlueprintAffordanceConsumerCatalog;
}): unknown[] {
  if (!Array.isArray(args.affordances)) {
    return clone(args.affordances) as unknown[];
  }
  const affordances = clone(args.affordances);
  const indexByKind = {
    action: new Map(args.catalog.action.map((value, index) => [stableJson(value), index])),
    placement: new Map(
      args.catalog.placement.map((value, index) => [stableJson(value), index]),
    ),
    transition: new Map(
      args.catalog.transition.map((value, index) => [stableJson(value), index]),
    ),
    safety: new Map(args.catalog.safety.map((value, index) => [stableJson(value), index])),
  };

  affordances.forEach((affordance) => {
    if (!isObj(affordance) || !Array.isArray(affordance.consumers)) return;
    affordance.consumers = affordance.consumers.flatMap((consumer) => {
      if (isObj(consumer) && consumer.kind === 'frame') return [];
      if (!semanticConsumerKind(consumer)) return [clone(consumer)];
      const knownIndex = indexByKind[consumer.kind].get(stableJson(consumer));
      if (knownIndex !== undefined) {
        return [{ kind: consumer.kind, choiceIndex: knownIndex }];
      }
      return [
        {
          kind: consumer.kind,
          choiceIndex:
            Object.prototype.hasOwnProperty.call(consumer, 'choiceIndex')
              ? (consumer as unknown as Obj).choiceIndex
              : null,
        },
      ];
    });
  });
  return affordances;
}
