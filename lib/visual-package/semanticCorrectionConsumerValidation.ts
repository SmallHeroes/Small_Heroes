/** Current-code validation only. Never semantic approval or a bridge manifest. */
import fs from 'node:fs';
import path from 'node:path';
import { canonicalHash } from '@/lib/canonical-json';
import { validateHistoricalCandidateChain, type HistoricalCandidateChainRequest } from './historicalCandidateChain';
import { resolveExistingContainedArtifact, readCurrentQaWizardConsumerRepositoryAuthority } from './qaWizardCandidateBridge';
import { loadAcceptedSupportingCastReview } from './acceptedSupportingCastReview';
import { canonicalContentAddressedJsonBytes } from './canonicalContentAddressedJson';
import { buildSemanticCorrectionReviewPacket, type SemanticCorrectionReviewPacket } from './semanticCorrectionPreview';

export const SEMANTIC_CORRECTION_CONSUMER_VALIDATION_VERSION = 'semantic-correction-consumer-validation/v1' as const;
export interface SemanticCorrectionConsumerValidationRequest {
  historical: HistoricalCandidateChainRequest;
  consumerRepoRoot: string;
  reviewPacketPath: string;
}
function same(left: unknown, right: unknown) { return canonicalHash(left) === canonicalHash(right); }
function readPacket(repoRoot: string, relativePath: string) {
  const file = resolveExistingContainedArtifact({ repoRoot, relativePath, label: 'semantic correction review packet' });
  if (fs.statSync(file).size > 4_000_000) throw new Error('semantic_consumer_packet_too_large');
  const bytes = fs.readFileSync(file, 'utf8');
  const packet = JSON.parse(bytes) as SemanticCorrectionReviewPacket;
  if (bytes !== canonicalContentAddressedJsonBytes(packet) ||
      path.posix.basename(relativePath) !== `${packet.digest}.json` ||
      path.posix.basename(path.posix.dirname(relativePath)) !== 'semantic-correction-reviews') {
    throw new Error('semantic_consumer_packet_not_canonical');
  }
  return { packet, bytes };
}

/** Every invocation reloads the full historical chain AND recomputes the overlay. */
export async function validateSemanticCorrectionForCurrentConsumer(args: SemanticCorrectionConsumerValidationRequest) {
  if (Object.keys(args).sort().join('|') !== 'consumerRepoRoot|historical|reviewPacketPath') {
    throw new Error('semantic_consumer_arguments_invalid');
  }
  // A clean unrelated repo must never attest code executing from another worktree.
  const executingRoot = fs.realpathSync(path.resolve(__dirname, '../..'));
  const consumerRoot = fs.realpathSync(args.consumerRepoRoot);
  if (consumerRoot !== executingRoot) throw new Error('semantic_consumer_executing_repository_mismatch');
  const beforeConsumer = readCurrentQaWizardConsumerRepositoryAuthority(consumerRoot);
  const historical = await validateHistoricalCandidateChain(args.historical);
  const { packet, bytes } = readPacket(consumerRoot, args.reviewPacketPath);
  const accepted = loadAcceptedSupportingCastReview({
    repoRoot: consumerRoot, storyKey: args.historical.storyKey,
    storyPath: args.historical.storyPath, review: packet.supportingCastReview,
  });
  if (!same(accepted.snapshot, historical.snapshot)) throw new Error('semantic_consumer_source_revision_mismatch');
  const rebuilt = buildSemanticCorrectionReviewPacket({ snapshot: accepted.snapshot,
    candidate: historical.candidate, supportingCastReview: packet.supportingCastReview }, packet.plan);
  if (!same(rebuilt, packet)) throw new Error('semantic_consumer_packet_reconstruction_mismatch');

  // Re-observe across async replay; never return a mixed before/after authority.
  const afterHistory = await validateHistoricalCandidateChain(args.historical);
  const afterSource = loadAcceptedSupportingCastReview({ repoRoot: consumerRoot,
    storyKey: args.historical.storyKey, storyPath: args.historical.storyPath,
    review: packet.supportingCastReview });
  const afterPacket = readPacket(consumerRoot, args.reviewPacketPath);
  const afterConsumer = readCurrentQaWizardConsumerRepositoryAuthority(consumerRoot);
  if (!same(beforeConsumer, afterConsumer) || !same(historical.proof, afterHistory.proof) ||
      !same(accepted.snapshot, afterSource.snapshot) || bytes !== afterPacket.bytes) {
    throw new Error('semantic_consumer_inputs_changed_during_validation');
  }
  const payload = {
    version: SEMANTIC_CORRECTION_CONSUMER_VALIDATION_VERSION,
    authorityScope: 'effective_correction_current_validation_only' as const,
    historicalProofDigest: historical.proof.digest,
    historicalRepository: historical.proof.historicalRepository,
    currentConsumer: afterConsumer,
    sourceSnapshotDigest: accepted.snapshot.digest,
    reviewPacketDigest: packet.digest, planDigest: packet.plan.digest,
    correctionDigest: packet.correction.digest,
    original: packet.correction.original,
    effective: { templateDigest: packet.correction.effective.templateDigest,
      coverageDigest: packet.correction.effective.coverageDigest,
      catalogVersion: packet.correction.effective.catalogVersion,
      catalogDigest: packet.correction.effective.catalogDigest },
    semanticApproval: null, bridgeManifest: null, providerCalls: 0 as const, zeroWrite: true as const,
    doesNotAuthorize: ['semantic_acceptance', 'reconciliation_approval', 'blueprint_authoring',
      'package_approval', 'image_render', 'provider_call', 'credential_load', 'publication', 'deployment'],
  };
  return { proof: { ...payload, digestAlgorithm: 'canonical-json-sha256' as const, digest: canonicalHash(payload) },
    packet: rebuilt, historical };
}
