import type { PageTransitionStructuralCause } from './draftValidationDiagnostics';
import type { PageTransition, PageVisualContract } from './types';

const TRANSITION_KINDS = new Set<PageTransition['kind']>([
  'steady',
  'before_transition',
  'threshold',
  'after_transition',
]);

export interface PageTransitionFinding {
  cause: PageTransitionStructuralCause;
  message: string;
}

export interface TransitionEdgeState {
  fromZoneId: string;
  toZoneId: string;
}

export interface EffectiveTransitionState {
  kind: PageTransition['kind'] | 'invalid';
  fromZoneId: string | null;
  toZoneId: string | null;
}

export interface TransitionSequencePageInput {
  page: PageVisualContract;
  pageIndex: number;
}

export interface TransitionSequencePageAnalysis {
  pageIndex: number;
  pageNumber: number;
  zoneId: string | null;
  effectiveTransition: EffectiveTransitionState;
  previous: { pageNumber: number; zoneId: string } | null;
  next: { pageNumber: number; zoneId: string | null } | null;
  establishedZoneIdsBeforePage: string[];
  lastThresholdEdgeBeforePage: TransitionEdgeState | null;
  findings: PageTransitionFinding[];
}

function isStr(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function transitionValue(page: PageVisualContract): unknown {
  return page.transition as unknown;
}

function transitionMember(
  transition: unknown,
  key: 'kind' | 'fromZoneId' | 'toZoneId',
): unknown {
  return transition !== null &&
    (typeof transition === 'object' || typeof transition === 'function')
    ? (transition as Record<string, unknown>)[key]
    : undefined;
}

function sequenceKind(page: PageVisualContract): {
  effective: EffectiveTransitionState['kind'];
  raw: unknown;
} {
  const transition = transitionValue(page);
  const member = transitionMember(transition, 'kind');
  const raw = member ?? 'steady';
  return {
    effective: TRANSITION_KINDS.has(raw as PageTransition['kind'])
      ? (raw as PageTransition['kind'])
      : 'invalid',
    raw,
  };
}

export function effectiveTransitionState(
  page: PageVisualContract,
): EffectiveTransitionState {
  const transition = transitionValue(page);
  const kind = sequenceKind(page).effective;
  const fromZoneId = transitionMember(transition, 'fromZoneId');
  const toZoneId = transitionMember(transition, 'toZoneId');
  return {
    kind,
    fromZoneId: isStr(fromZoneId) ? fromZoneId : null,
    toZoneId: isStr(toZoneId) ? toZoneId : null,
  };
}

export function analyzePageTransition(args: {
  label: string;
  page: PageVisualContract;
  declaredZoneIds: ReadonlySet<string>;
}): PageTransitionFinding[] {
  const findings: PageTransitionFinding[] = [];
  const transition = transitionValue(args.page);
  if (transition == null) return findings;
  const rawKind = transitionMember(transition, 'kind');
  if (
    typeof transition !== 'object' ||
    Array.isArray(transition) ||
    !TRANSITION_KINDS.has(rawKind as PageTransition['kind'])
  ) {
    findings.push({
      cause: 'page_transition_kind_invalid',
      message: `${args.label}.transition.kind invalid (${String(rawKind)})`,
    });
    return findings;
  }
  const typedTransition = transition as unknown as PageTransition;
  if (typedTransition.kind === 'steady') {
    if (isStr(typedTransition.toZoneId)) {
      findings.push({
        cause: 'page_transition_steady_destination_declared',
        message: `${args.label} is steady but declares a destination zone "${typedTransition.toZoneId}"`,
      });
    }
    return findings;
  }
  if (
    !isStr(typedTransition.fromZoneId) ||
    !args.declaredZoneIds.has(typedTransition.fromZoneId)
  ) {
    findings.push({
      cause: 'page_transition_from_zone_undeclared',
      message: `${args.label}.transition.fromZoneId "${String(typedTransition.fromZoneId)}" is not a declared zone`,
    });
  }
  if (
    !isStr(typedTransition.toZoneId) ||
    !args.declaredZoneIds.has(typedTransition.toZoneId)
  ) {
    findings.push({
      cause: 'page_transition_to_zone_undeclared',
      message: `${args.label}.transition.toZoneId "${String(typedTransition.toZoneId)}" is not a declared zone`,
    });
  }
  if (
    isStr(typedTransition.fromZoneId) &&
    isStr(typedTransition.toZoneId) &&
    typedTransition.fromZoneId === typedTransition.toZoneId
  ) {
    findings.push({
      cause: 'page_transition_endpoints_equal',
      message: `${args.label}.transition from/to zones must differ ("${typedTransition.fromZoneId}")`,
    });
  }
  if (typedTransition.kind === 'before_transition') {
    if (
      isStr(typedTransition.toZoneId) &&
      args.page.zoneId === typedTransition.toZoneId
    ) {
      findings.push({
        cause: 'page_transition_before_already_destination',
        message: `${args.label} is before_transition but already sits in the destination zone "${typedTransition.toZoneId}"`,
      });
    }
    if (
      isStr(typedTransition.fromZoneId) &&
      isStr(args.page.zoneId) &&
      args.page.zoneId !== typedTransition.fromZoneId
    ) {
      findings.push({
        cause: 'page_transition_before_zone_not_origin',
        message: `${args.label} before_transition zone "${args.page.zoneId}" must be the origin "${typedTransition.fromZoneId}"`,
      });
    }
  } else if (typedTransition.kind === 'after_transition') {
    if (
      isStr(typedTransition.toZoneId) &&
      isStr(args.page.zoneId) &&
      args.page.zoneId !== typedTransition.toZoneId
    ) {
      findings.push({
        cause: 'page_transition_after_zone_not_destination',
        message: `${args.label} after_transition zone "${args.page.zoneId}" must be the destination "${typedTransition.toZoneId}"`,
      });
    }
  } else if (
    typedTransition.kind === 'threshold' &&
    isStr(args.page.zoneId) &&
    isStr(typedTransition.fromZoneId) &&
    isStr(typedTransition.toZoneId) &&
    args.page.zoneId !== typedTransition.fromZoneId &&
    args.page.zoneId !== typedTransition.toZoneId
  ) {
    findings.push({
      cause: 'page_transition_threshold_zone_not_endpoint',
      message: `${args.label} threshold zone "${args.page.zoneId}" must be the origin or the destination`,
    });
  }
  return findings;
}

export function analyzeTransitionSequence(
  pages: readonly TransitionSequencePageInput[],
): TransitionSequencePageAnalysis[] {
  const ordered = pages
    .filter(({ page }) => typeof page.pageNumber === 'number')
    .sort((left, right) => left.page.pageNumber - right.page.pageNumber);
  const establishedZones = new Set<string>();
  let previousZone: string | undefined;
  let previousPage: number | undefined;
  let lastThresholdEdge: TransitionEdgeState | undefined;
  const result: TransitionSequencePageAnalysis[] = [];

  for (let index = 0; index < ordered.length; index += 1) {
    const { page, pageIndex } = ordered[index]!;
    const pageNumber = page.pageNumber as number;
    const { raw: rawKind } = sequenceKind(page);
    const transition = effectiveTransitionState(page);
    const findings: PageTransitionFinding[] = [];
    const nextPage = ordered[index + 1]?.page;
    const snapshot: Omit<TransitionSequencePageAnalysis, 'findings'> = {
      pageIndex,
      pageNumber,
      zoneId: isStr(page.zoneId) ? page.zoneId : null,
      effectiveTransition: transition,
      previous:
        previousZone === undefined || previousPage === undefined
          ? null
          : { pageNumber: previousPage, zoneId: previousZone },
      next:
        nextPage === undefined
          ? null
          : {
              pageNumber: nextPage.pageNumber,
              zoneId: isStr(nextPage.zoneId) ? nextPage.zoneId : null,
            },
      establishedZoneIdsBeforePage: [...establishedZones].sort(),
      lastThresholdEdgeBeforePage: lastThresholdEdge
        ? { ...lastThresholdEdge }
        : null,
    };

    if (
      previousZone === undefined &&
      (rawKind === 'threshold' || rawKind === 'after_transition')
    ) {
      findings.push({
        cause: 'page_transition_opening_departure_without_origin',
        message: `page ${pageNumber} declares a ${String(rawKind)} transition with no established origin — the opening page must be steady or before_transition (nothing precedes it to depart from)`,
      });
    }
    if (previousZone !== undefined && isStr(page.zoneId)) {
      if (rawKind === 'steady' || rawKind === 'before_transition') {
        if (page.zoneId !== previousZone) {
          findings.push({
            cause: 'page_transition_no_move_zone_changed',
            message: `page ${pageNumber} moves to zone "${page.zoneId}" from "${previousZone}" (page ${previousPage}) without a transition — a ${String(rawKind)} page declares no move (undeclared scene move)`,
          });
        }
        lastThresholdEdge = undefined;
      } else {
        const from = transition.fromZoneId;
        const to = transition.toZoneId;
        if (from !== null && !establishedZones.has(from)) {
          findings.push({
            cause: 'page_transition_origin_not_established',
            message: `page ${pageNumber} (${String(rawKind)}) departs from "${from}" but that zone has not been established yet`,
          });
        }
        const continuesThreshold =
          rawKind === 'after_transition' &&
          from !== null &&
          to !== null &&
          lastThresholdEdge?.fromZoneId === from &&
          lastThresholdEdge.toZoneId === to;
        if (from !== null && from !== previousZone && !continuesThreshold) {
          findings.push({
            cause: 'page_transition_origin_not_previous_zone',
            message: `page ${pageNumber} (${String(rawKind)}) departs from "${from}" but the previous page (${previousPage}) was in "${previousZone}" — the move is not continuous (undeclared scene move)`,
          });
        }
        if (rawKind === 'threshold' && from !== null && to !== null) {
          lastThresholdEdge = { fromZoneId: from, toZoneId: to };
        } else {
          lastThresholdEdge = undefined;
        }
        if (to !== null) establishedZones.add(to);
      }
    }
    if (isStr(page.zoneId)) {
      establishedZones.add(page.zoneId);
      previousZone = page.zoneId;
      previousPage = pageNumber;
    }
    result.push({ ...snapshot, findings });
  }
  return result;
}
