export interface DraftActionCastReferenceProjectionResult {
  draft: Record<string, unknown>;
  reboundReferenceCount: number;
  conflictingReferenceCount: number;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Rebinds only exact provider-wire child/companion aliases inside typed action
 * cast references. Cast identity itself remains compiler-owned elsewhere; this
 * projection merely makes action references use that same identity domain.
 * Unknown aliases remain unchanged so ordinary validation fails closed.
 * Ambiguous/cross-role aliases become an invalid compiler sentinel so they
 * cannot validate as the wrong person; unambiguous authoritative IDs remain
 * byte-semantically stable.
 */
export function projectDraftActionCastReferences(args: {
  draft: Record<string, unknown>;
  authoritativeChildId: string;
  authoritativeCompanionId: string | null;
  authoritativeHumanIds: readonly string[];
}): DraftActionCastReferenceProjectionResult {
  const draft = structuredClone(args.draft);
  const draftCast = recordValue(draft.cast);
  const draftChild = recordValue(draftCast?.child);
  const draftCompanion = recordValue(draftCast?.companion);
  const authoritativeIds = new Set(
    [
      args.authoritativeChildId,
      args.authoritativeCompanionId,
      ...args.authoritativeHumanIds,
    ].filter((value): value is string => typeof value === 'string'),
  );
  const aliasTargets = new Map<string, Set<string>>();

  const addAlias = (aliasValue: unknown, authoritativeId: string | null) => {
    const alias = nonEmptyString(aliasValue);
    if (!alias || !authoritativeId) return;
    const targets = aliasTargets.get(alias) ?? new Set<string>();
    targets.add(authoritativeId);
    aliasTargets.set(alias, targets);
  };

  addAlias(draftChild?.id, args.authoritativeChildId);
  addAlias(draftCompanion?.id, args.authoritativeCompanionId);

  const conflictingAliases = new Set<string>();
  for (const [alias, targets] of aliasTargets) {
    if (
      targets.size !== 1 ||
      (authoritativeIds.has(alias) && !targets.has(alias))
    ) {
      conflictingAliases.add(alias);
    }
  }
  const childAlias = nonEmptyString(draftChild?.id);
  const companionAlias = nonEmptyString(draftCompanion?.id);
  if (childAlias && companionAlias && childAlias === companionAlias) {
    conflictingAliases.add(childAlias);
  }
  if (
    companionAlias &&
    args.authoritativeCompanionId === null &&
    authoritativeIds.has(companionAlias)
  ) {
    conflictingAliases.add(companionAlias);
  }
  let invalidConflictId = '__compiler_invalid_ambiguous_cast_reference__';
  for (let suffix = 1; authoritativeIds.has(invalidConflictId); suffix++) {
    invalidConflictId =
      `__compiler_invalid_ambiguous_cast_reference__:${suffix}`;
  }

  let reboundReferenceCount = 0;
  let conflictingReferenceCount = 0;
  const rebindId = (value: unknown): unknown => {
    if (typeof value !== 'string') {
      return value;
    }
    if (conflictingAliases.has(value)) {
      conflictingReferenceCount += 1;
      return invalidConflictId;
    }
    if (authoritativeIds.has(value)) return value;
    const targets = aliasTargets.get(value);
    if (!targets || targets.size !== 1) return value;
    const [target] = targets;
    if (target === undefined || target === value) return value;
    reboundReferenceCount += 1;
    return target;
  };

  const rebindEntityRef = (value: unknown): void => {
    const reference = recordValue(value);
    if (reference?.kind !== 'cast') return;
    reference.id = rebindId(reference.id);
  };

  const pages = Array.isArray(draft.pageContracts)
    ? draft.pageContracts
    : [];
  for (const pageValue of pages) {
    const page = recordValue(pageValue);
    if (!page || !Array.isArray(page.actionRequirements)) continue;
    for (const actionValue of page.actionRequirements) {
      const action = recordValue(actionValue);
      if (!action) continue;
      const subject = recordValue(action.subject);
      if (subject?.kind === 'entity') {
        rebindEntityRef(subject.entity);
      } else if (
        subject?.kind === 'cast_group' &&
        Array.isArray(subject.castIds)
      ) {
        subject.castIds = subject.castIds.map(rebindId);
      }
      rebindEntityRef(action.object);
      const spatialEffect = recordValue(action.spatialEffect);
      if (spatialEffect?.kind === 'relation') {
        rebindEntityRef(spatialEffect.target);
      }
      const spatialConstraint = recordValue(action.spatialConstraint);
      if (spatialConstraint) {
        rebindEntityRef(spatialConstraint.target);
      }
    }
  }

  return {
    draft,
    reboundReferenceCount,
    conflictingReferenceCount,
  };
}
