/** Offline, atomic review overlay. Never a provider candidate or approval. */
import { z } from 'zod';
import { canonicalHash } from '@/lib/canonical-json';
import { ACTION_PREDICATE_VALUES, ACTION_SEMANTIC_CATALOG, ACTION_SEMANTIC_CATALOG_VERSION } from '@/lib/visual-contract-compiler/actionSemanticCatalog';
import { actionSemanticCoverageIssues, PRESENTATION_REQUIREMENT_CLASS_VALUES, resolveJsonPointer } from '@/lib/visual-contract-compiler/actionSemanticCoverage';
import { assertCastIsFactAuthoritative, compilerOwnedActionCheckId, mergeHuman } from '@/lib/visual-contract-compiler/compileBookVisualContractTemplate';
import { GROUP_VISUAL_CONTRACT_SCHEMA_VERSION, VISUAL_CONTRACT_SCHEMA_VERSION, type BookVisualContractTemplate } from '@/lib/visual-contract-compiler/contractTemplateTypes';
import { projectPageActionProse } from '@/lib/visual-contract-compiler/projectContractProse';
import { resolveSourceEvidenceId } from '@/lib/visual-contract-compiler/sourceEvidenceCatalog';
import { assertSupportingCastReview, supportingCastCompilerInputDigest, supportingCastFacts, type SupportingCastReview } from '@/lib/visual-contract-compiler/supportingCastReview';
import { validateBookVisualContractTemplate } from '@/lib/visual-contract-compiler/validateTemplateContract';
import type { BookVisualContract, PageActionRequirement } from '@/lib/visual-contract-compiler/types';
import { applyCoverVisibleRecurringPropOperations } from './visualContractCandidateCoverCorrection';
import { assertVisualContractCandidateForReconciliation } from './reconciliationLifecycle';
import { storySourceSnapshotToTemplateInput, type StorySourceAuthoritySnapshot } from './storySourceAuthority';
import type { VisualContractCandidateArtifact } from './visualContractAuthoringLifecycle';
import { assertAcceptedCompanionPresenceEvidence } from './acceptedCompanionPresenceEvidence';

export const SEMANTIC_CORRECTION_PLAN_VERSION = 'visual-contract-semantic-correction-plan/v1' as const;
export const SEMANTIC_CORRECTION_VERSION = 'visual-contract-semantic-correction/v1' as const;
const PRESENCE_PLAN_VERSION = 'visual-contract-semantic-correction-plan/v2' as const;
const PRESENCE_CORRECTION_VERSION = 'visual-contract-semantic-correction/v2' as const;
export const SEMANTIC_CORRECTION_DOES_NOT_AUTHORIZE = Object.freeze([
  'candidate_mutation', 'receipt_mutation', 'reconciliation_approval',
  'blueprint_authoring', 'blueprint_approval', 'visual_package_approval',
  'wizard_qualification', 'image_render', 'provider_call', 'publication', 'deployment',
]);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const text = z.string().min(1).max(4000).refine(value => value === value.trim());
const predicate = z.enum(ACTION_PREDICATE_VALUES as [PageActionRequirement['predicate'], ...PageActionRequirement['predicate'][]]);
const pageNumber = z.number().int().min(1).max(80);
const index = z.number().int().min(0).max(1000);
const evidenceId = z.string().regex(/^se1_[a-f0-9]{64}$/);
const actionTarget = {
  pageNumber, beatId: text, sourceEvidenceId: evidenceId,
  expectedCheckId: text, expectedPredicate: predicate,
  expectedActionDigest: digest, newBeatId: text,
};
const operationsSchema = z.array(z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('require_companion_presence'), pageNumber,
    companionId: text, expectedCompanionPresent: z.literal(false),
    expectedCastIds: z.array(text).min(1).max(32),
    // Raw bytes, not a caller-supplied digest or prose interpretation. The accepted
    // revision binds this entire document; consumers reload that revision from disk.
    acceptedVisualDirectionsJson: z.string().min(1).max(250_000),
  }).strict(),
  z.object({ kind: z.literal('replace_action_predicate'), ...actionTarget, predicate }).strict(),
  z.object({ kind: z.literal('action_to_presentation'), ...actionTarget,
    mustShowIndex: index, expectedMustShow: text,
    presentationClass: z.enum(PRESENTATION_REQUIREMENT_CLASS_VALUES),
  }).strict(),
  z.object({ kind: z.literal('replace_presentation'), pageNumber,
    mustShowIndex: index, expectedMustShow: text, replacement: text,
    sourceEvidenceIds: z.array(evidenceId).min(1).max(32),
    castIds: z.array(text).max(32),
  }).strict(),
  z.object({ kind: z.literal('require_prop_state'), pageNumber,
    propId: text, expectedState: text, replacement: text,
    decisionBasis: z.literal('owner_required_visible_disposition'),
  }).strict(),
  z.object({ kind: z.literal('cover_visible_recurring_prop'), propId: text,
    expectedFirstRevealPage: pageNumber, expectedCoverMustShowIndex: index,
    expectedCoverMustShowValue: text, expectedCoverMustNotShowIndex: index,
    expectedCoverMustNotShowValue: text,
    decisionBasis: z.literal('cover_hero_object_intentionally_visible'),
  }).strict(),
])).max(160);
export type SemanticCorrectionOperation = z.infer<typeof operationsSchema>[number];
const subjectSchema = z.object({
  sourceSnapshotDigest: digest, candidateDigest: digest, templateDigest: digest,
  coverageDigest: digest, sourceEvidenceCatalogDigest: digest,
  supportingCastReviewDigest: digest,
  effectiveCatalogVersion: z.literal(ACTION_SEMANTIC_CATALOG_VERSION),
  effectiveCatalogDigest: digest,
}).strict();
const planSchema = z.object({
  version: z.enum([SEMANTIC_CORRECTION_PLAN_VERSION, PRESENCE_PLAN_VERSION]), subject: subjectSchema,
  operations: operationsSchema, authorityScope: z.literal('pending_exact_semantic_review'),
  digestAlgorithm: z.literal('canonical-json-sha256'), digest,
}).strict();
export type SemanticCorrectionPlan = z.infer<typeof planSchema>;
export interface SemanticCorrectionContext {
  snapshot: StorySourceAuthoritySnapshot;
  candidate: VisualContractCandidateArtifact;
  supportingCastReview: SupportingCastReview;
}
function fail(code: string): never { throw new Error(`semantic_correction_${code}`); }
function same(a: unknown, b: unknown): boolean { return canonicalHash(a) === canonicalHash(b); }
function sealed<T extends Record<string, unknown>>(payload: T) {
  return { ...payload, digestAlgorithm: 'canonical-json-sha256' as const, digest: canonicalHash(payload) };
}
function subject(context: SemanticCorrectionContext): SemanticCorrectionPlan['subject'] {
  return {
    sourceSnapshotDigest: context.snapshot.digest, candidateDigest: context.candidate.digest,
    templateDigest: context.candidate.templateDigest, coverageDigest: context.candidate.actionSemanticCoverageDigest,
    sourceEvidenceCatalogDigest: context.snapshot.content.sourceEvidenceCatalog.digest,
    supportingCastReviewDigest: context.supportingCastReview.digest,
    effectiveCatalogVersion: ACTION_SEMANTIC_CATALOG_VERSION,
    effectiveCatalogDigest: canonicalHash(ACTION_SEMANTIC_CATALOG),
  };
}
function factsFor(context: SemanticCorrectionContext) {
  assertVisualContractCandidateForReconciliation(context);
  const input = storySourceSnapshotToTemplateInput(context.snapshot);
  assertSupportingCastReview(context.supportingCastReview, input);
  const accepted = context.snapshot.content.acceptedRevisionAuthority;
  if (!accepted) fail('accepted_source_required');
  if (!same(context.supportingCastReview.binding, {
    storyKey: input.storyKey, sourceSnapshotDigest: context.snapshot.digest,
    acceptedRevisionDigest: accepted.revisionDigest, acceptedAuthorityDigest: canonicalHash(accepted),
    sourceDigest: context.snapshot.content.sourceIdentity.digest,
    visualDirectionsSha256: accepted.fileSha256['visual-directions.json'],
    compilerInputDigest: supportingCastCompilerInputDigest(input),
  })) fail('review_source_binding_mismatch');
  return { input, facts: supportingCastFacts(input, context.supportingCastReview) };
}

/** Source/candidate/review are pinned before any selected operation is applied. */
export function buildSemanticCorrectionPlan(context: SemanticCorrectionContext, operations: unknown): SemanticCorrectionPlan {
  factsFor(context);
  const parsed = operationsSchema.parse(operations);
  return sealed({ version: parsed.some(op => op.kind === 'require_companion_presence') ? PRESENCE_PLAN_VERSION : SEMANTIC_CORRECTION_PLAN_VERSION,
    subject: subject(context), operations: parsed,
    authorityScope: 'pending_exact_semantic_review' as const });
}

export function applySemanticCorrection(context: SemanticCorrectionContext, untrustedPlan: unknown) {
  const plan = planSchema.parse(untrustedPlan);
  const { digest: planDigest, digestAlgorithm: _algorithm, ...payload } = plan;
  if (!same(plan.subject, subject(context)) || planDigest !== canonicalHash(payload)) fail('plan_binding_mismatch');
  const presenceOperations = plan.operations.filter(op => op.kind === 'require_companion_presence');
  if (plan.version !== (presenceOperations.length ? PRESENCE_PLAN_VERSION : SEMANTIC_CORRECTION_PLAN_VERSION)) fail('plan_version_mismatch');
  const { input, facts } = factsFor(context);
  const original = context.candidate.template;
  const originalCheck = validateBookVisualContractTemplate(original);
  if (!originalCheck.ok) fail('original_template_invalid');
  // All mutation is confined to private clones; rejection has no output/write path.
  let template = structuredClone(original);
  const coverage = structuredClone(context.candidate.actionSemanticCoverage);
  const oldHumanIds = new Set([...template.humanCast, ...(template.humanGroups ?? [])].map(h => h.id));
  template.humanCast = facts.humans.map(fact => mergeHuman(fact,
    (template.humanCast.find(h => h.id === fact.id) ?? {}) as unknown as Record<string, unknown>));
  if (facts.humanGroups?.length) {
    template.humanGroups = structuredClone(facts.humanGroups);
    template.schemaVersion = GROUP_VISUAL_CONTRACT_SCHEMA_VERSION;
  } else {
    delete template.humanGroups;
    template.schemaVersion = VISUAL_CONTRACT_SCHEMA_VERSION;
  }
  for (const page of template.pageContracts) {
    page.castIds = [...(page.castIds ?? []).filter(id => !oldHumanIds.has(id)),
      ...facts.humans.filter(h => h.pagesPresent.includes(page.pageNumber)).map(h => h.id),
      ...(facts.humanGroups ?? []).filter(h => h.pagesPresent.includes(page.pageNumber)).map(h => h.id)];
  }
  assertCastIsFactAuthoritative(template, facts, input);

  // Resolve source-backed presence before any operation that consumes cast. Never
  // modify legacy extraction or reinterpret paid candidate/source bytes.
  const presencePages = new Set<number>();
  for (const operation of presenceOperations) {
    if (presencePages.has(operation.pageNumber)) fail('overlapping_operations');
    presencePages.add(operation.pageNumber);
    const before = original.pageContracts.find(p => p.pageNumber === operation.pageNumber);
    const page = template.pageContracts.find(p => p.pageNumber === operation.pageNumber);
    if (!before || !page) fail('page_missing');
    if (!template.cast.companion || operation.companionId !== template.cast.companion.id) fail('companion_identity_mismatch');
    if (before.characterPresence?.companion !== operation.expectedCompanionPresent ||
        !same(before.castIds, operation.expectedCastIds) || before.castIds?.includes(operation.companionId) ||
        facts.companionPresentPages.includes(operation.pageNumber)) fail('companion_before_state_mismatch');
    if (facts.companionAbsentPages.includes(operation.pageNumber)) fail('companion_presence_conflict');
    assertAcceptedCompanionPresenceEvidence({ rawJson: operation.acceptedVisualDirectionsJson,
      snapshot: context.snapshot, pageNumber: operation.pageNumber });
    facts.companionPresentPages.push(operation.pageNumber);
    facts.companionPresentPages.sort((a, b) => a - b);
    page.characterPresence = { ...page.characterPresence, companion: true };
    page.castIds = [...(page.castIds ?? []), operation.companionId];
  }
  assertCastIsFactAuthoritative(template, facts, input);

  // Stable original indices allow several deletions without stale coverage pointers.
  const presentation = template.pageContracts.map(page => page.mustShow.map(value => ({ value, removed: false })));
  const writes = new Set<string>();
  const reserve = (key: string) => { if (writes.has(key)) fail('overlapping_operations'); writes.add(key); };
  const source = (page: number, id: string) => {
    const resolved = resolveSourceEvidenceId({ catalog: context.snapshot.content.sourceEvidenceCatalog, pageNumber: page, sourceEvidenceId: id });
    if (!resolved.ok) fail('source_evidence_invalid');
    return resolved.entry;
  };
  // Validate every original coverage citation too; hashes are not source fidelity.
  for (const record of coverage) {
    const entry = source(record.pageNumber, record.sourceEvidenceId);
    if (entry.excerpt !== record.sourcePhrase) fail('coverage_source_mismatch');
  }
  for (const operation of plan.operations) {
    if (operation.kind === 'cover_visible_recurring_prop' || operation.kind === 'require_companion_presence') continue;
    const pi = original.pageContracts.findIndex(p => p.pageNumber === operation.pageNumber);
    if (pi < 0) fail('page_missing');
    const before = original.pageContracts[pi]!;
    const page = template.pageContracts[pi]!;
    if (operation.kind === 'require_prop_state') {
      reserve(`prop:${pi}:${operation.propId}`);
      const matches = page.propState.filter(p => p.propId === operation.propId);
      const constraints = (page.propConstraints ?? []).filter(p => p.propId === operation.propId);
      if (matches.length !== 1 || matches[0]!.state !== operation.expectedState ||
          constraints.length !== 1 || constraints[0]!.visibility !== 'required') fail('prop_before_state_mismatch');
      matches[0]!.state = operation.replacement;
      continue;
    }
    if (operation.kind === 'replace_presentation') {
      reserve(`presentation:${pi}:${operation.mustShowIndex}`);
      if (before.mustShow[operation.mustShowIndex] !== operation.expectedMustShow) fail('presentation_before_state_mismatch');
      operation.sourceEvidenceIds.forEach(id => source(page.pageNumber, id));
      if (operation.castIds.some(id => !page.castIds?.includes(id))) fail('presentation_cast_missing');
      presentation[pi]![operation.mustShowIndex]!.value = operation.replacement;
      continue;
    }
    reserve(`beat:${operation.beatId}`);
    reserve(`action:${operation.expectedCheckId}`);
    const records = coverage.filter(r => r.pageNumber === page.pageNumber && r.beatId === operation.beatId);
    const oldAction = before.actionRequirements?.find(a => a.checkId === operation.expectedCheckId);
    if (records.length !== 1 || !oldAction || oldAction.polarity !== 'must' ||
        oldAction.predicate !== operation.expectedPredicate || canonicalHash(oldAction) !== operation.expectedActionDigest) fail('action_before_state_mismatch');
    const record = records[0]!;
    if (record.disposition.kind !== 'action_requirement' || record.disposition.checkId !== oldAction.checkId ||
        record.sourceEvidenceId !== operation.sourceEvidenceId ||
        coverage.filter(r => r.disposition.kind === 'action_requirement' && r.disposition.checkId === oldAction.checkId).length !== 1) fail('action_coverage_mismatch');
    const newCheckId = compilerOwnedActionCheckId(page.pageNumber, operation.newBeatId);
    reserve(`newBeat:${operation.newBeatId}`);
    if (context.candidate.actionSemanticCoverage.some(r => r.beatId === operation.newBeatId && r.beatId !== operation.beatId) ||
        original.pageContracts.some(p => p.actionRequirements?.some(a => a.checkId === newCheckId && a.checkId !== oldAction.checkId))) fail('replacement_identity_collision');
    const oldProse = projectPageActionProse({ ...before, actionRequirements: [oldAction] }, original as unknown as BookVisualContract);
    const proseIndices = before.mustShow.flatMap((value, i) => value === oldProse ? [i] : []);
    if (!oldProse || proseIndices.length !== 1) fail('action_projection_ambiguous');
    const proseIndex = proseIndices[0]!;
    reserve(`presentation:${pi}:${proseIndex}`);
    const ai = page.actionRequirements!.findIndex(a => a.checkId === oldAction.checkId);
    record.beatId = operation.newBeatId;
    if (operation.kind === 'replace_action_predicate') {
      const action: PageActionRequirement = { ...oldAction, checkId: newCheckId, predicate: operation.predicate };
      page.actionRequirements![ai] = action;
      record.disposition = { kind: 'action_requirement', checkId: newCheckId };
      presentation[pi]![proseIndex]!.value = projectPageActionProse({ ...page, actionRequirements: [action] }, template as unknown as BookVisualContract);
    } else {
      if (before.mustShow[operation.mustShowIndex] !== operation.expectedMustShow || operation.mustShowIndex === proseIndex) fail('presentation_before_state_mismatch');
      page.actionRequirements!.splice(ai, 1);
      presentation[pi]![proseIndex]!.removed = true;
      record.disposition = { kind: 'presentation_requirement', presentationClass: operation.presentationClass,
        contractPointer: `/pageContracts/${pi}/mustShow/${operation.mustShowIndex}`, contractValue: operation.expectedMustShow };
    }
  }
  // Retarget all affected references, including unselected beats sharing a presentation.
  for (const record of coverage) {
    const disposition = record.disposition;
    if (disposition.kind !== 'presentation_requirement' && disposition.kind !== 'represented_elsewhere') continue;
    const match = /^\/pageContracts\/(\d+)\/mustShow\/(\d+)$/.exec(disposition.contractPointer);
    if (!match) {
      const resolved = resolveJsonPointer(template, disposition.contractPointer);
      if (!resolved.found || typeof resolved.value !== 'string') fail('orphaned_presentation');
      disposition.contractValue = resolved.value;
      continue;
    }
    const pi = Number(match[1]), oldIndex = Number(match[2]);
    const rows = presentation[pi];
    if (!rows?.[oldIndex] || rows[oldIndex].removed) fail('orphaned_presentation');
    disposition.contractPointer = `/pageContracts/${pi}/mustShow/${rows.slice(0, oldIndex).filter(r => !r.removed).length}`;
    disposition.contractValue = rows[oldIndex].value;
  }
  template.pageContracts.forEach((page, pi) => { page.mustShow = presentation[pi]!.filter(r => !r.removed).map(r => r.value); });
  const covers = plan.operations.filter(op => op.kind === 'cover_visible_recurring_prop');
  if (covers.length) template = applyCoverVisibleRecurringPropOperations({ template, operations: covers }).template;
  for (const page of template.pageContracts) {
    const actionShapes = (page.actionRequirements ?? []).map(({ checkId: _id, ...action }) => canonicalHash(action));
    if (new Set(actionShapes).size !== actionShapes.length || new Set(page.mustShow).size !== page.mustShow.length) fail('duplicate_effective_requirement');
  }
  const validation = validateBookVisualContractTemplate(template);
  if (!validation.ok) throw new Error(`semantic_correction_effective_template_invalid: ${validation.errors.join('; ')}`);
  const coverageIssues = actionSemanticCoverageIssues({ template, coverage });
  if (coverageIssues.length) throw new Error(`semantic_correction_effective_coverage_invalid: ${coverageIssues.join('; ')}`);
  assertCastIsFactAuthoritative(template, facts, input);
  if (same(template, original) && same(coverage, context.candidate.actionSemanticCoverage)) fail('no_change');
  return sealed({
    version: presenceOperations.length ? PRESENCE_CORRECTION_VERSION : SEMANTIC_CORRECTION_VERSION, planDigest, subject: plan.subject,
    original: { templateDigest: context.candidate.templateDigest, coverageDigest: context.candidate.actionSemanticCoverageDigest },
    effective: { template, templateDigest: canonicalHash(template), coverage, coverageDigest: canonicalHash(coverage),
      catalogVersion: ACTION_SEMANTIC_CATALOG_VERSION, catalogDigest: canonicalHash(ACTION_SEMANTIC_CATALOG) },
    authorityScope: 'effective_semantic_correction_for_review_only' as const,
    doesNotAuthorize: [...SEMANTIC_CORRECTION_DOES_NOT_AUTHORIZE],
  });
}
export type SemanticCorrectionArtifact = ReturnType<typeof applySemanticCorrection>;

/** Recompute the entire overlay, not merely an attacker-rehashable digest. */
export function assertSemanticCorrectionArtifact(context: SemanticCorrectionContext, plan: unknown, artifact: unknown): asserts artifact is SemanticCorrectionArtifact {
  if (!same(artifact, applySemanticCorrection(context, plan))) fail('artifact_reconstruction_mismatch');
}
