/** Read-only prerequisite for changed-coverage bridging, never live authority. */
import fs from 'node:fs';
import path from 'node:path';
import { canonicalHash } from '@/lib/canonical-json';
import { canonicalContentAddressedJsonBytes } from './canonicalContentAddressedJson';
import { buildStorySourceAuthoritySnapshot, type StorySourceAuthoritySnapshot } from './storySourceAuthority';
import { assertLegacyVisualContractCandidateV9ForReconciliation } from './reconciliationLifecycle';
import { loadHistoricalCanonicalSupervisorArtifacts, resolveExistingContainedArtifact,
  type AttestQaWizardCandidateValidationRequest } from './qaWizardCandidateBridge';
import { assertHistoricalVisualContractAuthoringReadinessV56,
  type VisualContractAuthoringRequest, type VisualContractAuthoringReceipt,
  type VisualContractAuthoringReadinessEvidence, type VisualContractCandidateArtifact,
} from './visualContractAuthoringLifecycle';
import { replayVisualContractAuthoringEvidence } from './visualContractAuthoringReplayRunner';
import type { VisualContractAuthoringReplayEvidence } from './visualContractAuthoringReplayEvidence';

export const HISTORICAL_CANDIDATE_CHAIN_VERSION = 'historical-candidate-chain-validation/v1' as const;
export type HistoricalCandidateChainRequest = Omit<AttestQaWizardCandidateValidationRequest, 'outputDir' | 'write'>;
export const HISTORICAL_CANDIDATE_CHAIN_DOES_NOT_AUTHORIZE = Object.freeze([
  'current_consumer_attestation', 'semantic_acceptance', 'reconciliation_approval',
  'blueprint_authoring', 'blueprint_approval', 'package_approval', 'image_render',
  'provider_call', 'credential_load', 'publication', 'deployment',
]);

function readCanonical<T extends { digest: string; digestAlgorithm: string }>(repoRoot: string, relativePath: string, category: string): T {
  const file = resolveExistingContainedArtifact({ repoRoot, relativePath, label: 'historical chain artifact' });
  if (fs.statSync(file).size > 4_000_000) throw new Error('historical_chain_artifact_too_large');
  const bytes = fs.readFileSync(file, 'utf8');
  const value = JSON.parse(bytes) as T;
  const { digest, digestAlgorithm, ...payload } = value;
  if (digestAlgorithm !== 'canonical-json-sha256' || canonicalHash(payload) !== digest ||
      path.posix.basename(relativePath) !== `${digest}.json` ||
      path.posix.basename(path.posix.dirname(relativePath)) !== category ||
      bytes !== canonicalContentAddressedJsonBytes(value)) throw new Error('historical_chain_canonical_artifact_mismatch');
  return value;
}

/** Pure tuple proof is separate from disk/Supervisor/replay verification below. */
export function assertHistoricalCandidateTuple(args: {
  snapshot: StorySourceAuthoritySnapshot; request: VisualContractAuthoringRequest;
  receipt: VisualContractAuthoringReceipt; readiness: VisualContractAuthoringReadinessEvidence;
  candidate: VisualContractCandidateArtifact;
}): void {
  const { snapshot, request, receipt, readiness, candidate } = args;
  assertLegacyVisualContractCandidateV9ForReconciliation({ snapshot, candidate });
  assertHistoricalVisualContractAuthoringReadinessV56({ snapshot, request, receipt, evidence: readiness });
  if (request.mode !== 'live' || receipt.status !== 'completed' ||
      receipt.executionAttestation.evidenceKind !== 'canonical_adapter_observed' ||
      receipt.executionAttestation.logicalProviderCalls !== receipt.callCount ||
      receipt.executionAttestation.transportDispatchCount !== receipt.callCount ||
      receipt.executionAttestation.transportRetryCount !== 0 || receipt.executionAttestation.fallbackUsed !== false ||
      receipt.executionAttestation.canonicalRouteConfirmed !== true || receipt.executionAttestation.canonicalModelConfirmed !== true ||
      candidate.authoringRequestDigest !== request.digest || candidate.authoringReceiptDigest !== receipt.digest ||
      receipt.sourceSnapshotDigest !== snapshot.digest || receipt.requestDigest !== request.digest ||
      receipt.candidateDigest !== candidate.templateDigest ||
      receipt.actionSemanticCoverage.coverageDigest !== candidate.actionSemanticCoverageDigest ||
      receipt.actionSemanticCoverage.sourceEvidenceCatalogDigest !== candidate.sourceEvidenceCatalogDigest ||
      receipt.actionSemanticCoverage.catalogVersion !== candidate.actionSemanticCatalogVersion ||
      receipt.actionSemanticCoverage.catalogDigest !== candidate.actionSemanticCatalogDigest ||
      readiness.visualContractCandidate.status !== 'candidate' || readiness.visualContractCandidate.digest !== candidate.templateDigest) {
    throw new Error('historical_candidate_tuple_mismatch');
  }
}

/** No output directory, write flag, credential path or current-consumer input. */
export async function validateHistoricalCandidateChain(args: HistoricalCandidateChainRequest) {
  const expectedKeys = ['repoRoot', 'storyKey', 'storyPath', 'candidatePath', 'authoringRequestPath',
    'authoringReceiptPath', 'authoringReadinessPath', 'freshReadinessPath',
    'supervisorExecutionRequestPath', 'supervisorExecutionResultPath'].sort();
  if (Object.keys(args).sort().join('|') !== expectedKeys.join('|')) throw new Error('historical_chain_arguments_invalid');
  const snapshot = buildStorySourceAuthoritySnapshot(args);
  const candidate = readCanonical<VisualContractCandidateArtifact>(args.repoRoot, args.candidatePath, 'contract-candidates');
  const request = readCanonical<VisualContractAuthoringRequest>(args.repoRoot, args.authoringRequestPath, 'authoring-requests');
  const receipt = readCanonical<VisualContractAuthoringReceipt>(args.repoRoot, args.authoringReceiptPath, 'authoring-receipts');
  const readiness = readCanonical<VisualContractAuthoringReadinessEvidence>(args.repoRoot, args.authoringReadinessPath, 'readiness-evidence');
  assertHistoricalCandidateTuple({ snapshot, candidate, request, receipt, readiness });
  const { artifacts: supervisor } = loadHistoricalCanonicalSupervisorArtifacts({
    repoRoot: args.repoRoot, freshReadinessPath: args.freshReadinessPath,
    executionRequestPath: args.supervisorExecutionRequestPath, executionResultPath: args.supervisorExecutionResultPath,
    authoringRequestPath: args.authoringRequestPath, authoringReceiptPath: args.authoringReceiptPath,
    authoringReadinessPath: args.authoringReadinessPath, candidatePath: args.candidatePath,
  });
  const b0 = supervisor.freshReadiness.canonicalAuthorities.b0;
  const source = supervisor.materializationManifest.sourceRevision;
  if (b0.sourceSnapshotDigest !== snapshot.digest || b0.liveAuthoringRequestDigest !== request.digest ||
      b0.normalizedSourceDigest !== snapshot.content.sourceIdentity.digest ||
      source.storyKey !== args.storyKey || source.storyPath !== args.storyPath ||
      source.sourceSnapshotDigest !== snapshot.digest || source.normalizedSourceDigest !== snapshot.content.sourceIdentity.digest ||
      supervisor.freshReadiness.request.storySourceKey !== args.storyKey ||
      supervisor.freshReadiness.request.storySourcePath !== args.storyPath ||
      supervisor.executionResult.outputAuthority!.visualContractCandidate.digest !== candidate.digest) {
    throw new Error('historical_chain_source_binding_mismatch');
  }
  const locator = receipt.structuredDraftReplayEvidence!;
  const evidence = readCanonical<VisualContractAuthoringReplayEvidence>(args.repoRoot, locator.path, 'structured-draft-replay-evidence');
  const replay = await replayVisualContractAuthoringEvidence({ repoRoot: args.repoRoot, snapshot, request, receipt,
    evidence, evidencePath: locator.path });
  if (replay.providerCalls !== 0 || !replay.exactCapturedCallSequence || !replay.receiptOutcomeCongruent ||
      !replay.receiptCandidateDigestCongruent || replay.harness.outcome !== 'candidate' ||
      replay.harness.candidateTemplateDigest !== candidate.templateDigest) throw new Error('historical_chain_replay_mismatch');
  const payload = {
    version: HISTORICAL_CANDIDATE_CHAIN_VERSION, authorityScope: 'immutable_historical_input_only' as const,
    subject: { storyKey: args.storyKey, storyPath: args.storyPath, snapshotDigest: snapshot.digest,
      requestDigest: request.digest, receiptDigest: receipt.digest, readinessDigest: readiness.digest,
      candidateDigest: candidate.digest, templateDigest: candidate.templateDigest,
      coverageDigest: candidate.actionSemanticCoverageDigest, replayEvidenceDigest: evidence.digest,
      b0ManifestDigest: supervisor.materializationManifest.digest, freshReadinessDigest: supervisor.freshReadiness.digest,
      executionRequestDigest: supervisor.executionRequest.digest, executionResultDigest: supervisor.executionResultDigest,
      childOutputAuthorityDigest: supervisor.executionResult.outputAuthority!.digest },
    historicalRepository: supervisor.freshReadiness.repositoryAuthority,
    currentConsumerAuthority: null, semanticApproval: null,
    zeroWrite: true as const, providerCalls: 0 as const,
    replay: { exactCapturedCallSequence: true, receiptOutcomeCongruent: true, receiptCandidateDigestCongruent: true },
    doesNotAuthorize: [...HISTORICAL_CANDIDATE_CHAIN_DOES_NOT_AUTHORIZE],
  };
  return { snapshot, candidate, request, receipt, readiness, supervisor,
    proof: { ...payload, digestAlgorithm: 'canonical-json-sha256' as const, digest: canonicalHash(payload) } };
}
