import {
  ACTION_SEMANTIC_CATALOG_VERSION,
  actionSemanticDefinition,
  isActionPredicate,
  type ActionSemanticEntityKind,
  type ActionSemanticSpatialConstraintRelation,
  type ActionSemanticSubjectKind,
} from './actionSemanticCatalog';
import {
  PRESENTATION_REQUIREMENT_CLASS_VALUES,
  type PresentationRequirementClass,
} from './actionSemanticCoverage';
import {
  resolveSourceEvidenceId,
  type SourceEvidenceCatalog,
} from './sourceEvidenceCatalog';

export const ACTION_SEMANTIC_REPRESENTABILITY_AUDIT_VERSION =
  'action-semantic-representability-audit/v1' as const;

export const ACTION_SEMANTIC_REPRESENTABILITY_GAP_VALUES = [
  'predicate_missing',
  'subject_authority_missing',
  'subject_kind_unsupported',
  'object_required',
  'object_forbidden',
  'object_kind_unsupported',
  'spatial_effect_required',
  'spatial_effect_forbidden',
  'spatial_constraint_required',
  'spatial_constraint_forbidden',
  'spatial_constraint_relation_unsupported',
  'laterality_unsupported',
] as const;

export type ActionSemanticRepresentabilityGap =
  (typeof ACTION_SEMANTIC_REPRESENTABILITY_GAP_VALUES)[number];

interface ReviewedIntentBase {
  pageNumber: number;
  beatKey: string;
  sourceEvidenceId: string;
}

export type ReviewedActionSemanticIntent =
  | (ReviewedIntentBase & {
      representation: 'action_requirement';
      predicate: string;
      subjectKind: ActionSemanticSubjectKind;
      subjectAuthority: 'available' | 'missing';
      objectKind: ActionSemanticEntityKind | null;
      spatialEffect: 'present' | 'absent';
      spatialConstraint:
        | ActionSemanticSpatialConstraintRelation
        | null;
      laterality: 'present' | 'absent';
    })
  | (ReviewedIntentBase & {
      representation: 'presentation_requirement';
      presentationClass: PresentationRequirementClass;
    })
  | (ReviewedIntentBase & {
      representation: 'non_visual';
    })
  | (ReviewedIntentBase & {
      representation: 'review_required';
      candidatePredicate: string | null;
    });

export interface ActionSemanticRepresentabilityAuditItem {
  pageNumber: number;
  beatKey: string;
  sourceEvidenceId: string;
  representation: ReviewedActionSemanticIntent['representation'];
  predicate: string | null;
  status:
    | 'representable_action'
    | 'representable_presentation'
    | 'representable_non_visual'
    | 'action_gap'
    | 'review_required';
  gaps: readonly ActionSemanticRepresentabilityGap[];
}

export interface ActionSemanticRepresentabilityAudit {
  version: typeof ACTION_SEMANTIC_REPRESENTABILITY_AUDIT_VERSION;
  catalogVersion: typeof ACTION_SEMANTIC_CATALOG_VERSION;
  status: 'review_evidence_only';
  authorizes: [];
  intentCount: number;
  representableCount: number;
  actionGapCount: number;
  reviewRequiredCount: number;
  items: readonly ActionSemanticRepresentabilityAuditItem[];
}

function lexicalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertIntentIdentity(
  intent: ReviewedActionSemanticIntent,
  seen: Set<string>,
  sourceEvidenceCatalog: SourceEvidenceCatalog,
): void {
  if (!Number.isSafeInteger(intent.pageNumber) || intent.pageNumber <= 0) {
    throw new Error('action_semantic_audit_page_invalid');
  }
  if (!/^[a-z0-9_]+$/.test(intent.beatKey)) {
    throw new Error('action_semantic_audit_beat_key_invalid');
  }
  const evidenceResolution = resolveSourceEvidenceId({
    catalog: sourceEvidenceCatalog,
    sourceEvidenceId: intent.sourceEvidenceId,
    pageNumber: intent.pageNumber,
  });
  if (!evidenceResolution.ok) {
    throw new Error(`action_semantic_audit_${evidenceResolution.code}`);
  }
  const candidatePredicate =
    intent.representation === 'action_requirement'
      ? intent.predicate
      : intent.representation === 'review_required'
        ? intent.candidatePredicate
        : null;
  if (
    candidatePredicate !== null &&
    !/^[a-z][a-z0-9_]*$/.test(candidatePredicate)
  ) {
    throw new Error('action_semantic_audit_candidate_predicate_invalid');
  }
  const identity = `${intent.pageNumber}:${intent.beatKey}`;
  if (seen.has(identity)) {
    throw new Error('action_semantic_audit_beat_duplicate');
  }
  seen.add(identity);
}

function actionGaps(
  intent: Extract<
    ReviewedActionSemanticIntent,
    { representation: 'action_requirement' }
  >,
): ActionSemanticRepresentabilityGap[] {
  if (!isActionPredicate(intent.predicate)) return ['predicate_missing'];

  const definition = actionSemanticDefinition(intent.predicate);
  const gaps: ActionSemanticRepresentabilityGap[] = [];
  if (intent.subjectAuthority === 'missing') {
    gaps.push('subject_authority_missing');
  }
  if (!(definition.subjectKinds as readonly string[]).includes(intent.subjectKind)) {
    gaps.push('subject_kind_unsupported');
  }
  if (definition.objectRule === 'required' && intent.objectKind === null) {
    gaps.push('object_required');
  }
  if (definition.objectRule === 'forbidden' && intent.objectKind !== null) {
    gaps.push('object_forbidden');
  }
  if (
    intent.objectKind !== null &&
    definition.objectRule !== 'forbidden' &&
    !(definition.objectKinds as readonly string[]).includes(intent.objectKind)
  ) {
    gaps.push('object_kind_unsupported');
  }
  if (
    definition.spatialEffectRule === 'required' &&
    intent.spatialEffect === 'absent'
  ) {
    gaps.push('spatial_effect_required');
  }
  if (
    definition.spatialEffectRule === 'forbidden' &&
    intent.spatialEffect === 'present'
  ) {
    gaps.push('spatial_effect_forbidden');
  }
  if (
    definition.spatialConstraintRule === 'required' &&
    intent.spatialConstraint === null
  ) {
    gaps.push('spatial_constraint_required');
  }
  if (
    definition.spatialConstraintRule === 'forbidden' &&
    intent.spatialConstraint !== null
  ) {
    gaps.push('spatial_constraint_forbidden');
  }
  if (
    intent.spatialConstraint !== null &&
    definition.spatialConstraintRule !== 'forbidden' &&
    !(definition.spatialConstraintRelations as readonly string[]).includes(
      intent.spatialConstraint,
    )
  ) {
    gaps.push('spatial_constraint_relation_unsupported');
  }
  if (intent.laterality === 'present' && !definition.lateralityAllowed) {
    gaps.push('laterality_unsupported');
  }
  return gaps;
}

export function auditReviewedActionSemanticIntents(
  intents: readonly ReviewedActionSemanticIntent[],
  sourceEvidenceCatalog: SourceEvidenceCatalog,
): ActionSemanticRepresentabilityAudit {
  const seen = new Set<string>();
  const items = [...intents]
    .sort(
      (left, right) =>
        left.pageNumber - right.pageNumber ||
        lexicalCompare(left.beatKey, right.beatKey),
    )
    .map((intent): ActionSemanticRepresentabilityAuditItem => {
      assertIntentIdentity(intent, seen, sourceEvidenceCatalog);
      if (intent.representation === 'action_requirement') {
        const gaps = actionGaps(intent);
        return {
          pageNumber: intent.pageNumber,
          beatKey: intent.beatKey,
          sourceEvidenceId: intent.sourceEvidenceId,
          representation: intent.representation,
          predicate: intent.predicate,
          status:
            gaps.length === 0 ? 'representable_action' : 'action_gap',
          gaps,
        };
      }
      if (intent.representation === 'presentation_requirement') {
        if (
          !PRESENTATION_REQUIREMENT_CLASS_VALUES.includes(
            intent.presentationClass,
          )
        ) {
          throw new Error('action_semantic_audit_presentation_class_invalid');
        }
        return {
          pageNumber: intent.pageNumber,
          beatKey: intent.beatKey,
          sourceEvidenceId: intent.sourceEvidenceId,
          representation: intent.representation,
          predicate: null,
          status: 'representable_presentation',
          gaps: [],
        };
      }
      if (intent.representation === 'non_visual') {
        return {
          pageNumber: intent.pageNumber,
          beatKey: intent.beatKey,
          sourceEvidenceId: intent.sourceEvidenceId,
          representation: intent.representation,
          predicate: null,
          status: 'representable_non_visual',
          gaps: [],
        };
      }
      return {
        pageNumber: intent.pageNumber,
        beatKey: intent.beatKey,
        sourceEvidenceId: intent.sourceEvidenceId,
        representation: intent.representation,
        predicate: intent.candidatePredicate,
        status: 'review_required',
        gaps: [],
      };
    });
  return {
    version: ACTION_SEMANTIC_REPRESENTABILITY_AUDIT_VERSION,
    catalogVersion: ACTION_SEMANTIC_CATALOG_VERSION,
    status: 'review_evidence_only',
    authorizes: [],
    intentCount: items.length,
    representableCount: items.filter((item) =>
      item.status.startsWith('representable_'),
    ).length,
    actionGapCount: items.filter((item) => item.status === 'action_gap')
      .length,
    reviewRequiredCount: items.filter(
      (item) => item.status === 'review_required',
    ).length,
    items,
  };
}
