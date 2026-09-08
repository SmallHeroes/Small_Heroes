import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { canonicalHash } from '@/lib/canonical-json';
import { assertHistoricalCandidateTuple, validateHistoricalCandidateChain, type HistoricalCandidateChainRequest } from '../historicalCandidateChain';
import { assertHistoricalVisualContractAuthoringRequestV56, assertHistoricalVisualContractAuthoringReadinessV56,
  buildVisualContractAuthoringRequest, buildVisualContractAuthoringReadinessEvidence, buildVisualContractCandidateArtifact,
  type VisualContractAuthoringRequest, type VisualContractAuthoringReceipt, type VisualContractAuthoringReadinessEvidence,
} from '../visualContractAuthoringLifecycle';
import { verifyHistoricalLiveRequestBundle, verifyCanonicalLiveRequestBundle } from '../liveRequestMaterialization';
import { p1SemanticRecoveryFixture } from './fixtures/semantic-recovery-p1-fixture';

const hashes = {
  request: 'e81964b616739c0e1c12ffd1cde2e78ddaa91285c9ca6a1d32b549ff6721006f',
  receipt: 'd39dace8fba47af25c617eeb698f13e0aa4ca2677a3fd3e0ed30d66b6ce3f6b3',
  readiness: '356d8591a2c0f9b85f8f9f45d39bd1e988a7373c4993a2518e8038681951f7ce',
};
function fixture() {
  function load<T>(kind: keyof typeof hashes): T {
    const bytes = fs.readFileSync(path.join(process.cwd(), `lib/visual-package/__tests__/fixtures/semantic-recovery-held-${kind}.json`));
    expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(hashes[kind]);
    return JSON.parse(bytes.toString('utf8')) as T;
  }
  const { context: { snapshot, candidate } } = p1SemanticRecoveryFixture();
  return { snapshot, candidate, request: load<VisualContractAuthoringRequest>('request'),
    receipt: load<VisualContractAuthoringReceipt>('receipt'), readiness: load<VisualContractAuthoringReadinessEvidence>('readiness') };
}
function rehash<T extends { digest: string; digestAlgorithm: string }>(value: T): T {
  const { digest: _d, digestAlgorithm: _a, ...payload } = value;
  value.digest = canonicalHash(payload);
  return value;
}

describe('explicit frozen v56/v59/v3 historical input boundary', () => {
  it('validates the real complete tuple, with no mutation and no return of current authority', () => {
    const args = fixture();
    const before = canonicalHash(args);
    expect(assertHistoricalVisualContractAuthoringRequestV56(args)).toBeUndefined();
    expect(assertHistoricalVisualContractAuthoringReadinessV56({ ...args, evidence: args.readiness })).toBeUndefined();
    expect(assertHistoricalCandidateTuple(args)).toBeUndefined();
    expect(canonicalHash(args)).toBe(before);
  });
  it('leaves current factories strict while the explicit frozen readers accept the unchanged originals', () => {
    const args = fixture();
    expect(() => buildVisualContractAuthoringReadinessEvidence(args)).toThrow();
    expect(() => buildVisualContractCandidateArtifact({ request: args.request, receipt: args.receipt,
      compileResult: { template: args.candidate.template, actionSemanticCoverage: args.candidate.actionSemanticCoverage, supportingCastReviewDigest: null } })).toThrow();
    const current = buildVisualContractAuthoringRequest({ snapshot: args.snapshot, mode: args.request.mode,
      requestId: args.request.requestId, requestedAt: args.request.requestedAt });
    expect(current.actionSemanticAuthority.catalogVersion).toBe('action-semantic-catalog/v4');
    expect(() => assertHistoricalVisualContractAuthoringRequestV56({ snapshot: args.snapshot, request: current })).toThrow();
  });
  it.each([
    ['request ID', (r: VisualContractAuthoringRequest) => { r.requestId = ''; }],
    ['timestamp', (r: VisualContractAuthoringRequest) => { r.requestedAt = 'not-a-date'; }],
    ['mode', (r: VisualContractAuthoringRequest) => { Object.assign(r, { mode: 'approved' }); }],
    ['version', (r: VisualContractAuthoringRequest) => { Object.assign(r, { version: 'visual-contract-authoring-request/v55' }); }],
    ['catalog', (r: VisualContractAuthoringRequest) => { r.actionSemanticAuthority.catalogDigest = 'a'.repeat(64); }],
    ['schema', (r: VisualContractAuthoringRequest) => { r.structuredOutput.schemaDigest = 'a'.repeat(64); }],
    ['extra field', (r: VisualContractAuthoringRequest) => { Object.assign(r, { approved: true }); }],
  ])('rejects rehashed historical request tamper: %s', (_label, mutate) => {
    const args = fixture(); mutate(args.request); rehash(args.request);
    expect(() => assertHistoricalVisualContractAuthoringRequestV56(args)).toThrow();
  });
  it.each([
    ['readiness authority', (r: VisualContractAuthoringReadinessEvidence) => { Object.assign(r, { blueprintAuthoringReady: true }); }],
    ['removed blocker', (r: VisualContractAuthoringReadinessEvidence) => { r.blockers.pop(); }],
    ['coverage digest', (r: VisualContractAuthoringReadinessEvidence) => { r.actionSemanticCoverage.coverageDigest = 'a'.repeat(64); }],
    ['execution retry', (r: VisualContractAuthoringReadinessEvidence) => { r.executionAttestation.transportRetryCount = 1; }],
    ['false preflight', (r: VisualContractAuthoringReadinessEvidence) => { r.canonicalImportPreflight.status = 'passed'; }],
    ['receipt substitution', (r: VisualContractAuthoringReadinessEvidence) => { r.authoringReceiptDigest = 'b'.repeat(64); }],
    ['extra field', (r: VisualContractAuthoringReadinessEvidence) => { Object.assign(r, { approvedBy: 'Guy' }); }],
  ])('rejects rehashed historical %s', (_label, mutate) => {
    const args = fixture(); mutate(args.readiness); rehash(args.readiness);
    expect(() => assertHistoricalVisualContractAuthoringReadinessV56({ ...args, evidence: args.readiness })).toThrow();
  });
  it.each(['receipt', 'coverage', 'template', 'source'] as const)('rejects candidate %s substitution even after rehash', field => {
    const args = fixture();
    if (field === 'receipt') args.candidate.authoringReceiptDigest = 'a'.repeat(64);
    if (field === 'coverage') args.candidate.actionSemanticCoverageDigest = 'a'.repeat(64);
    if (field === 'template') args.candidate.template.worldType = 'fantastical';
    if (field === 'source') args.candidate.sourceSnapshotDigest = 'a'.repeat(64);
    rehash(args.candidate);
    expect(() => assertHistoricalCandidateTuple(args)).toThrow();
  });
  it('does not launder changed receipt accounting into valid historical readiness', () => {
    const args = fixture();
    const dispatchCount = args.receipt.executionAttestation.transportDispatchCount;
    if (dispatchCount === null) throw new Error('fixture must have observed dispatch accounting');
    args.receipt.executionAttestation.transportDispatchCount = dispatchCount + 1;
    rehash(args.receipt);
    args.readiness.authoringReceiptDigest = args.receipt.digest;
    args.readiness.executionAttestation = structuredClone(args.receipt.executionAttestation);
    rehash(args.readiness);
    expect(() => assertHistoricalVisualContractAuthoringReadinessV56({ ...args, evidence: args.readiness })).toThrow();
  });
  it('a rehashed source relabel cannot be used with the frozen request', () => {
    const args = fixture(); args.snapshot.digest = 'd'.repeat(64);
    expect(() => assertHistoricalVisualContractAuthoringRequestV56(args)).toThrow();
  });
  it('historical verifier rejection has a distinct version/scope and cannot be a live verified result', () => {
    const args = { repoRoot: process.cwd(), manifestPath: 'outputs/absent-historical-chain-manifest.json' };
    const historical = verifyHistoricalLiveRequestBundle(args);
    expect(historical).toMatchObject({ version: 'historical-live-request-verification/v1', status: 'rejected', zeroWrite: true,
      authorityScope: 'immutable_historical_input_only' });
    expect(historical.doesNotAuthorize).toContain('live_preflight');
    expect(verifyCanonicalLiveRequestBundle(args)).toMatchObject({ version: 'canonical-live-request-verification/v54', status: 'rejected' });
  });
  it.each(['write', 'outputDir', 'consumerAuthority', 'approvedBy'])('rejects an injected %s argument before disk access', async field => {
    const args = Object.fromEntries(['repoRoot', 'storyKey', 'storyPath', 'candidatePath', 'authoringRequestPath',
      'authoringReceiptPath', 'authoringReadinessPath', 'freshReadinessPath', 'supervisorExecutionRequestPath',
      'supervisorExecutionResultPath'].map(key => [key, 'unused']));
    Object.assign(args, { [field]: true });
    await expect(validateHistoricalCandidateChain(args as unknown as HistoricalCandidateChainRequest)).rejects.toThrow('arguments_invalid');
  });
});
