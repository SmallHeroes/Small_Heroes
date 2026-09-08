/** One contained, review-only packet; validation completes before any write. */
import fs from 'node:fs';
import path from 'node:path';
import { canonicalHash } from '@/lib/canonical-json';
import { loadAcceptedSupportingCastReview } from './acceptedSupportingCastReview';
import { resolveExistingContainedArtifact } from './qaWizardCandidateBridge';
import { createContainedContentAddressedJsonArtifactStore } from './canonicalLiveAuthoringArtifacts';
import { canonicalContentAddressedJsonBytes } from './canonicalContentAddressedJson';
import { applySemanticCorrection, buildSemanticCorrectionPlan, type SemanticCorrectionContext, type SemanticCorrectionPlan } from './visualContractSemanticCorrection';
import type { VisualContractCandidateArtifact } from './visualContractAuthoringLifecycle';
import type { SupportingCastReview } from '@/lib/visual-contract-compiler/supportingCastReview';

export interface SemanticCorrectionPreviewRequest {
  repoRoot: string; storyKey: string; storyPath: string;
  candidatePath: string; supportingCastReviewPath: string; operationsPath: string;
  outputDir: string; write?: boolean;
}
/** Shared exact packet construction: consumer validation must not trust a rehash. */
export function buildSemanticCorrectionReviewPacket(context: SemanticCorrectionContext, plan: SemanticCorrectionPlan) {
  const correction = applySemanticCorrection(context, plan);
  const payload = {
    version: 'visual-contract-semantic-correction-review-packet/v1' as const,
    decision: 'pending' as const, sourceSnapshotDigest: context.snapshot.digest,
    supportingCastReview: context.supportingCastReview, plan, correction,
    before: { template: context.candidate.template, coverage: context.candidate.actionSemanticCoverage },
    authorityScope: 'exact_semantic_product_review_only' as const,
    doesNotAuthorize: correction.doesNotAuthorize,
  };
  return { ...payload, digestAlgorithm: 'canonical-json-sha256' as const, digest: canonicalHash(payload) };
}
export type SemanticCorrectionReviewPacket = ReturnType<typeof buildSemanticCorrectionReviewPacket>;

export function prepareSemanticCorrectionPreview(args: SemanticCorrectionPreviewRequest) {
  if (!args.outputDir.startsWith('outputs/') || path.posix.normalize(args.outputDir) !== args.outputDir || args.outputDir.includes('\\')) throw new Error('semantic_preview_output_must_be_new_outputs_scope');
  const read = (relativePath: string, label: string) => {
    const file = resolveExistingContainedArtifact({ repoRoot: args.repoRoot, relativePath, label });
    if (fs.statSync(file).size > 2_000_000) throw new Error('semantic_preview_input_too_large');
    const bytes = fs.readFileSync(file, 'utf8');
    const value: unknown = JSON.parse(bytes);
    return { bytes, value };
  };
  const candidateInput = read(args.candidatePath, 'semantic candidate');
  const candidate = candidateInput.value as VisualContractCandidateArtifact;
  if (candidateInput.bytes !== canonicalContentAddressedJsonBytes(candidate)) throw new Error('semantic_preview_candidate_bytes_not_canonical');
  const supportingCastReview = read(args.supportingCastReviewPath, 'supporting cast review').value as SupportingCastReview;
  const accepted = loadAcceptedSupportingCastReview({ ...args, review: supportingCastReview });
  const context = { snapshot: accepted.snapshot, candidate, supportingCastReview };
  const plan = buildSemanticCorrectionPlan(context, read(args.operationsPath, 'semantic operations').value);
  const packet = buildSemanticCorrectionReviewPacket(context, plan);
  const store = createContainedContentAddressedJsonArtifactStore({
    repoRoot: args.repoRoot, outputDir: args.outputDir, categories: ['semantic-correction-reviews'] as const,
    rejectSymlinkAliases: true, errorPrefix: 'semantic correction review',
  });
  // The store's no-write constructor validates paths. prepare/persist only follow success.
  const artifact = args.write === true
    ? (store.prepare(), store.persist({ category: 'semantic-correction-reviews', digest: packet.digest, value: packet }))
    : null;
  return { packet, artifact, providerCalls: 0 as const };
}
