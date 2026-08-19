import {
  MAX_DRAFT_VALIDATION_STRUCTURAL_INDEX,
} from './draftValidationDiagnostics';

export const PAGE_PROP_CONSTRAINT_VIOLATION_CODES = [
  'prop_constraints_not_array',
  'prop_constraints_empty',
  'prop_id_missing',
  'prop_id_unknown',
  'visibility_invalid',
  'visibility_self_contradiction',
  'state_id_invalid',
  'anchor_id_invalid',
  'anchor_id_unknown',
] as const;

export type PagePropConstraintViolationCode =
  (typeof PAGE_PROP_CONSTRAINT_VIOLATION_CODES)[number];

type PagePropConstraintCollectionViolation = {
  code: 'prop_constraints_not_array' | 'prop_constraints_empty';
};

type PagePropConstraintItemViolation = {
  code:
    | 'prop_id_missing'
    | 'prop_id_unknown'
    | 'visibility_invalid'
    | 'state_id_invalid'
    | 'anchor_id_invalid'
    | 'anchor_id_unknown';
  constraintIndex: number;
};

type PagePropConstraintContradictionViolation = {
  code: 'visibility_self_contradiction';
  constraintIndex: number;
  relatedConstraintIndex: number;
};

export type PagePropConstraintViolation =
  | PagePropConstraintCollectionViolation
  | PagePropConstraintItemViolation
  | PagePropConstraintContradictionViolation;

export interface PagePropConstraintClassification {
  violations: PagePropConstraintViolation[];
  visibilityByProp: Map<string, 'required' | 'forbidden'>;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonBlankString(value: unknown): value is string {
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

function boundedStructuralIndex(value: unknown): value is number {
  return (
    Number.isSafeInteger(value) &&
    Number(value) >= 0 &&
    Number(value) <= MAX_DRAFT_VALIDATION_STRUCTURAL_INDEX
  );
}

export function pagePropConstraintViolationIsValid(
  value: unknown,
): value is PagePropConstraintViolation {
  const record = recordValue(value);
  if (!record || typeof record.code !== 'string') return false;
  if (
    record.code === 'prop_constraints_not_array' ||
    record.code === 'prop_constraints_empty'
  ) {
    return exactKeys(record, ['code']);
  }
  if (record.code === 'visibility_self_contradiction') {
    return (
      exactKeys(record, [
        'code',
        'constraintIndex',
        'relatedConstraintIndex',
      ]) &&
      boundedStructuralIndex(record.constraintIndex) &&
      boundedStructuralIndex(record.relatedConstraintIndex) &&
      record.relatedConstraintIndex < record.constraintIndex
    );
  }
  if (
    !PAGE_PROP_CONSTRAINT_VIOLATION_CODES.includes(
      record.code as PagePropConstraintViolationCode,
    ) ||
    !exactKeys(record, ['code', 'constraintIndex'])
  ) {
    return false;
  }
  return boundedStructuralIndex(record.constraintIndex);
}

export function pagePropConstraintViolationsAreValid(
  value: unknown,
): value is PagePropConstraintViolation[] {
  return (
    Array.isArray(value) &&
    value.every(pagePropConstraintViolationIsValid)
  );
}

/**
 * Classifies the existing deterministic page prop-constraint rules without
 * carrying authored strings into repair authority. The returned order is the
 * validator's emission order. Valid visibility writes are last-write-wins,
 * including for unknown prop IDs, because Stage 4 consumes the same map.
 */
export function classifyPagePropConstraints(args: {
  propConstraints: unknown;
  propIds: ReadonlySet<string>;
  anchorIds: ReadonlySet<string>;
}): PagePropConstraintClassification {
  const violations: PagePropConstraintViolation[] = [];
  const visibilityByProp = new Map<
    string,
    'required' | 'forbidden'
  >();
  const visibilityIndexByProp = new Map<string, number>();

  if (args.propConstraints === undefined) {
    return { violations, visibilityByProp };
  }
  if (!Array.isArray(args.propConstraints)) {
    return {
      violations: [{ code: 'prop_constraints_not_array' }],
      visibilityByProp,
    };
  }
  if (args.propConstraints.length === 0) {
    return {
      violations: [{ code: 'prop_constraints_empty' }],
      visibilityByProp,
    };
  }

  args.propConstraints.forEach((rawValue, constraintIndex) => {
    const raw = recordValue(rawValue);
    if (!raw || !nonBlankString(raw.propId)) {
      violations.push({ code: 'prop_id_missing', constraintIndex });
      return;
    }
    const propId = raw.propId;
    if (!args.propIds.has(propId)) {
      violations.push({ code: 'prop_id_unknown', constraintIndex });
    }
    if (
      !nonBlankString(raw.visibility) ||
      (raw.visibility !== 'required' && raw.visibility !== 'forbidden')
    ) {
      violations.push({ code: 'visibility_invalid', constraintIndex });
    } else {
      const priorVisibility = visibilityByProp.get(propId);
      const relatedConstraintIndex = visibilityIndexByProp.get(propId);
      if (
        priorVisibility !== undefined &&
        priorVisibility !== raw.visibility &&
        relatedConstraintIndex !== undefined
      ) {
        violations.push({
          code: 'visibility_self_contradiction',
          constraintIndex,
          relatedConstraintIndex,
        });
      }
      visibilityByProp.set(propId, raw.visibility);
      visibilityIndexByProp.set(propId, constraintIndex);
    }
    if (raw.stateId !== undefined && !nonBlankString(raw.stateId)) {
      violations.push({ code: 'state_id_invalid', constraintIndex });
    }
    if (raw.anchorId !== undefined) {
      if (!nonBlankString(raw.anchorId)) {
        violations.push({ code: 'anchor_id_invalid', constraintIndex });
      } else if (!args.anchorIds.has(raw.anchorId)) {
        violations.push({ code: 'anchor_id_unknown', constraintIndex });
      }
    }
  });

  return { violations, visibilityByProp };
}
