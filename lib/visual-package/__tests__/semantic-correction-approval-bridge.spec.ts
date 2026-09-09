import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canonicalHash } from '@/lib/canonical-json';
import { canonicalContentAddressedJsonBytes } from '../canonicalContentAddressedJson';
import { validateSemanticCorrectionForCurrentConsumer } from '../semanticCorrectionConsumerValidation';
import { readCurrentQaWizardConsumerRepositoryAuthority, qaWizardCandidateBridgeManifestIsValid,
  loadQaWizardCandidateBridgeManifest } from '../qaWizardCandidateBridge';
import { recordSemanticCorrectionApproval, loadApprovedSemanticCorrection, prepareSemanticCorrectionBridge,
  loadSemanticCorrectionBridge, prepareSemanticReconciliationReview, loadSemanticReconciliationReview,
  recordSemanticReconciliationApproval, loadApprovedSemanticReconciliation,
  materializeSemanticProductionInputs, prepareSemanticProductionBridge, loadSemanticProductionBridge,
  type RecordSemanticCorrectionApprovalRequest } from '../semanticCorrectionApprovalBridge';
import { buildSemanticCorrectionReviewPacket } from '../semanticCorrectionPreview';
import { buildProductionReconciliationDraftFromSourceSnapshot } from '../reconciliationLifecycle';
import { p1SemanticRecoveryFixture, P1_REQUEST } from './fixtures/semantic-recovery-p1-fixture';
import { loadQaWizardProductionContext } from '../qaWizardProductionContext';
import { prepareQaWizardBlueprintLiveRequest, loadQaWizardBlueprintAuthoringManifest } from '../qaWizardBlueprintAuthoringLifecycle';
import { STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH, STYLE01_PRODUCTION_STYLE_ID } from '../styleAuthority';

vi.mock('../semanticCorrectionConsumerValidation', async original => ({
  ...await original<typeof import('../semanticCorrectionConsumerValidation')>(), validateSemanticCorrectionForCurrentConsumer: vi.fn(),
}));
vi.mock('../qaWizardCandidateBridge', async original => ({
  ...await original<typeof import('../qaWizardCandidateBridge')>(), readCurrentQaWizardConsumerRepositoryAuthority: vi.fn(),
}));
const validate=vi.mocked(validateSemanticCorrectionForCurrentConsumer);
const current=vi.mocked(readCurrentQaWizardConsumerRepositoryAuthority);
let root:string;
let request:RecordSemanticCorrectionApprovalRequest;
let validated:Awaited<ReturnType<typeof validateSemanticCorrectionForCurrentConsumer>>;
const rel=(file:string)=>path.relative(process.cwd(),file).replace(/\\/g,'/');
const abs=(file:string)=>path.join(process.cwd(),file);
function rewrite(file:string, change:(value:any)=>void, rehash=false) {
  const value=JSON.parse(fs.readFileSync(abs(file),'utf8'));change(value);
  if(rehash){const {digest:_d,digestAlgorithm:_a,...payload}=value;value.digest=canonicalHash(payload);
    file=rel(path.join(path.dirname(abs(file)),`${value.digest}.json`));}
  fs.writeFileSync(abs(file),canonicalContentAddressedJsonBytes(value));return {file,value};
}
async function approve(){return recordSemanticCorrectionApproval({...request,write:true});}
async function bridge(){const approved=await approve();return prepareSemanticCorrectionBridge({consumerRepoRoot:process.cwd(),
  approvalPath:approved.artifact.path,expectedApprovalDigest:approved.approval.digest,outputDir:request.outputDir,write:true});}

// Test-only mapping: exercises exact pointers/hashes, not product semantic judgment.
function fixtureDecisions(pending: Awaited<ReturnType<typeof bridge>>) {
  const { template, coverage } = pending.manifest.effective;
  const visible = new Set(coverage.filter(r => r.disposition.kind !== 'non_visual').map(r => r.pageNumber));
  return { version: 'qa-wizard-reconciliation-reviewer-decisions/v1',
    sourceRequirements: pending.manifest.reconciliation.reconciliation.frames.flatMap(frame =>
      frame.sourceRequirements.filter(r => !(frame.frameKind === 'page' && r.sourceKind === 'story_prose' && visible.has(frame.pageNumber)))
        .map((r, index) => {
          const pageIndex = template.pageContracts.findIndex(page => page.pageNumber === frame.pageNumber);
          const historical = r.sourceKind === 'historical_image_direction';
          return { frameKind: frame.frameKind, pageNumber: frame.pageNumber, sourceKind: r.sourceKind,
            sourceTextSha256: createHash('sha256').update(r.sourceText, 'utf8').digest('hex'),
            visualBeats: [{ id: `fixture:${frame.frameKind}:${frame.pageNumber}:${index}`, description: 'Test-only exact source mapping',
              aspects: historical ? ['camera'] : ['narrative_meaning'], disposition: 'preserved',
              contractEvidence: [{ path: historical ? `/pageContracts/${pageIndex}/camera` : '/coverContract/mustShow/0',
                value: historical ? template.pageContracts[pageIndex]!.camera : template.coverContract.mustShow[0] }],
              justification: null, supersessionReview: null }] };
        })),
    presentationRequirements: pending.manifest.reconciliation.reconciliation.presentationRequirements.requirements.map(r => ({
      pageNumber: r.pageNumber, beatId: r.beatId, sourceEvidenceId: r.sourceEvidenceId,
      kind: 'preserved', reboundPointer: null, reboundValue: null, justification: null,
    })) };
}
async function reviewRequest() {
  const pending = await bridge();
  return { consumerRepoRoot: process.cwd(), manifestPath: pending.artifact.path, expectedManifestDigest: pending.manifest.digest,
    decisions: fixtureDecisions(pending), outputDir: rel(path.join(root, 'review-output')), write: true };
}
async function reviewed() { return prepareSemanticReconciliationReview(await reviewRequest()); }
async function approvedReconciliation() {
  const result = await reviewed();
  return recordSemanticReconciliationApproval({ consumerRepoRoot: process.cwd(), reviewPath: result.artifact.path,
    expectedReviewDigest: result.review.digest, approvedBy: 'Guy', approvedAt: request.approvedAt,
    outputDir: rel(path.join(root, 'reconciliation-output')), write: true });
}
async function productionSubject() {
  const approved = await approvedReconciliation();
  const identity = { consumerRepoRoot: process.cwd(), approvalPath: approved.artifact.path, expectedApprovalDigest: approved.approval.digest };
  const inputDir = rel(path.join(root, 'production-inputs'));
  await materializeSemanticProductionInputs({ ...identity, outputDir: inputDir, write: true });
  const style = JSON.parse(fs.readFileSync(abs(STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH), 'utf8'));
  return { ...identity, inputDir, styleId: STYLE01_PRODUCTION_STYLE_ID, styleAuthorityPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
    expectedStyleAuthorityDigest: canonicalHash(style), outputDir: rel(path.join(root, 'production-bridge')), write: true };
}
beforeEach(()=>{
  vi.clearAllMocks();
  fs.mkdirSync(path.join(process.cwd(),'outputs'),{recursive:true});
  root=fs.mkdtempSync(path.join(process.cwd(),'outputs/semantic-approval-test-'));
  const fixture=p1SemanticRecoveryFixture();
  const packet=buildSemanticCorrectionReviewPacket(fixture.context,fixture.plan);
  const git={repositoryRealPath:fs.realpathSync(process.cwd()),branchRef:'refs/heads/codex/test',head:'a'.repeat(40),
    upstreamRef:'refs/remotes/origin/codex/test',upstreamHead:'a'.repeat(40),ahead:0,behind:0,trackedChanges:0,untrackedChanges:0} as const;
  current.mockReturnValue(git);
  validated={packet,historical:{...fixture.context},proof:{digest:'b'.repeat(64),currentConsumer:git,historicalProofDigest:'c'.repeat(64)}} as unknown as typeof validated;
  validate.mockResolvedValue(validated);
  request={validation:{consumerRepoRoot:process.cwd(),reviewPacketPath:'outputs/packet.json',historical:{...P1_REQUEST,
    candidatePath:'unused',authoringRequestPath:'unused',authoringReceiptPath:'unused',authoringReadinessPath:'unused',
    freshReadinessPath:'unused',supervisorExecutionRequestPath:'unused',supervisorExecutionResultPath:'unused'}},
    expectedReviewPacketDigest:packet.digest,approvedBy:'Guy',approvedAt:'2026-09-09T06:20:00.000Z',outputDir:rel(path.join(root,'new-output'))};
});
afterEach(()=>{vi.restoreAllMocks();if(root)fs.rmSync(root,{recursive:true,force:true});});

describe('semantic production context and real Blueprint consumer', () => {
  it('previews and materializes exact projections without creating production authority', async () => {
    const approved = await approvedReconciliation();
    const args = { consumerRepoRoot: process.cwd(), approvalPath: approved.artifact.path, expectedApprovalDigest: approved.approval.digest,
      outputDir: rel(path.join(root, 'inputs')) };
    const preview = await materializeSemanticProductionInputs(args);
    expect(preview.wrote).toBe(false); expect(fs.existsSync(abs(args.outputDir))).toBe(false);
    const written = await materializeSemanticProductionInputs({ ...args, write: true });
    expect(written.inputs).toEqual(preview.inputs);
    for (const projection of written.inputs) expect(canonicalHash(JSON.parse(fs.readFileSync(abs(projection.path), 'utf8')))).toBe(projection.digest);
    expect((await materializeSemanticProductionInputs({ ...args, write: true })).inputs).toEqual(preview.inputs);
    expect(fs.existsSync(abs(`${args.outputDir}/semantic-production-bridges`))).toBe(false);
  });
  it('reconstructs a complete real P1 context and prepares/reloads the actual Blueprint request with zero providers', async () => {
    const args = await productionSubject();
    const preview = await prepareSemanticProductionBridge({ ...args, write: false });
    expect(fs.existsSync(abs(args.outputDir))).toBe(false);
    const produced = await prepareSemanticProductionBridge(args);
    expect(produced.manifest).toEqual(preview.manifest);
    const loaded = await loadQaWizardProductionContext({ repoRoot: process.cwd(), bridgeManifestPath: produced.artifact.path });
    expect(loaded.context).toEqual(produced.context);
    expect(loaded.context.template.identity.digest).toBe(validated.packet.correction.effective.templateDigest);
    expect(loaded.context.reconciliation.content.actionSemanticCoverageAuthority.actionSemanticCoverageDigest).toBe(validated.packet.correction.effective.coverageDigest);
    const preflight = await prepareQaWizardBlueprintLiveRequest({ repoRoot: process.cwd(), bridgeManifestPath: produced.artifact.path,
      outputDir: rel(path.join(root, 'blueprint')), requestId: 'semantic-context-test', requestedAt: request.approvedAt, write: true });
    expect(preflight.manifest.bridge.version).toBe(produced.manifest.version);
    expect(preflight.manifest.context.digest).toBe(produced.context.digest);
    expect(await loadQaWizardBlueprintAuthoringManifest({ repoRoot: process.cwd(), manifestPath: preflight.manifestPath })).toEqual(preflight.manifest);
  });
  it.each(['context', 'scope', 'subject', 'inputs', 'approval', 'extra'])('rejects rehashed production bridge %s substitution without falling back', async kind => {
    const produced = await prepareSemanticProductionBridge(await productionSubject());
    const changed = rewrite(produced.artifact.path, value => {
      if (kind === 'context') value.productionContext.digest = 'f'.repeat(64);
      if (kind === 'scope') value.doesNotAuthorize = [];
      if (kind === 'subject') value.subject.effective.coverageDigest = 'f'.repeat(64);
      if (kind === 'inputs') value.inputs[0].digest = 'f'.repeat(64);
      if (kind === 'approval') value.reconciliationApproval.digest = 'f'.repeat(64);
      if (kind === 'extra') value.approvedForRender = true;
    }, true);
    await expect(loadQaWizardProductionContext({ repoRoot: process.cwd(), bridgeManifestPath: changed.file })).rejects.toThrow();
  });
  it.each(['projection', 'style', 'approval-pin', 'context-injection', 'missing-projection'])('rejects invalid production inputs: %s before publishing authority', async kind => {
    const args = await productionSubject();
    const template = `${args.inputDir}/semantic-templates/${validated.packet.correction.effective.templateDigest}.json`;
    if (kind === 'projection') fs.appendFileSync(abs(template), ' ');
    if (kind === 'missing-projection') fs.renameSync(abs(template), abs(template) + '.held');
    if (kind === 'style') args.expectedStyleAuthorityDigest = 'f'.repeat(64);
    if (kind === 'approval-pin') args.expectedApprovalDigest = 'f'.repeat(64);
    if (kind === 'context-injection') (args as any).context = { approved: true };
    await expect(prepareSemanticProductionBridge(args)).rejects.toThrow();
    expect(fs.existsSync(abs(args.outputDir))).toBe(false);
  });
  it('rejects pending and review-only artifacts at the actual shared consumer boundary', async () => {
    const pending = await bridge();
    await expect(loadQaWizardProductionContext({ repoRoot: process.cwd(), bridgeManifestPath: pending.artifact.path })).rejects.toThrow();
    const review = await reviewed();
    await expect(loadQaWizardProductionContext({ repoRoot: process.cwd(), bridgeManifestPath: review.artifact.path })).rejects.toThrow();
  });
  it('pins production arguments before validation yields', async () => {
    const args = await productionSubject();
    const originalStyle = args.styleId;
    validate.mockImplementationOnce(async () => { (args as { styleId: string }).styleId = 'changed'; args.outputDir = '../escape'; return validated; });
    const produced = await prepareSemanticProductionBridge(args);
    expect(produced.context.styleId).toBe(originalStyle);
    expect(produced.artifact.path).toContain('/production-bridge/');
  });
  it('rejects production manifest byte drift during approval validation', async () => {
    const produced = await prepareSemanticProductionBridge(await productionSubject());
    validate.mockImplementationOnce(async () => { fs.appendFileSync(abs(produced.artifact.path), ' '); return validated; });
    await expect(loadSemanticProductionBridge({ consumerRepoRoot: process.cwd(), manifestPath: produced.artifact.path,
      expectedManifestDigest: produced.manifest.digest })).rejects.toThrow();
  });
  it('rejects stale current validation at the real Blueprint entry before creating its output', async () => {
    const produced = await prepareSemanticProductionBridge(await productionSubject());
    const outputDir = rel(path.join(root, 'rejected-blueprint'));
    validate.mockRejectedValueOnce(new Error('current_dirty'));
    await expect(prepareQaWizardBlueprintLiveRequest({ repoRoot: process.cwd(), bridgeManifestPath: produced.artifact.path,
      outputDir, requestId: 'semantic-drift-test', requestedAt: request.approvedAt, write: true })).rejects.toThrow('current_dirty');
    expect(fs.existsSync(abs(outputDir))).toBe(false);
  });
  it('rejects Blueprint manifest byte drift across the newly asynchronous authority load', async () => {
    const produced = await prepareSemanticProductionBridge(await productionSubject());
    const preflight = await prepareQaWizardBlueprintLiveRequest({ repoRoot: process.cwd(), bridgeManifestPath: produced.artifact.path,
      outputDir: rel(path.join(root, 'blueprint')), requestId: 'semantic-drift-test', requestedAt: request.approvedAt, write: true });
    validate.mockImplementationOnce(async () => { fs.appendFileSync(abs(preflight.manifestPath), ' '); return validated; });
    await expect(loadQaWizardBlueprintAuthoringManifest({ repoRoot: process.cwd(), manifestPath: preflight.manifestPath })).rejects.toThrow();
  });
  it('refuses a projection collision without replacing bytes or creating another projection', async () => {
    const approved = await approvedReconciliation();
    const args = { consumerRepoRoot: process.cwd(), approvalPath: approved.artifact.path, expectedApprovalDigest: approved.approval.digest,
      outputDir: rel(path.join(root, 'inputs')), write: true };
    const preview = await materializeSemanticProductionInputs({ ...args, write: false });
    const second = abs(preview.inputs[1]!.path);
    fs.mkdirSync(path.dirname(second), { recursive: true }); fs.writeFileSync(second, 'collision');
    await expect(materializeSemanticProductionInputs(args)).rejects.toThrow();
    expect(fs.readFileSync(second, 'utf8')).toBe('collision');
    expect(fs.existsSync(abs(preview.inputs[0]!.path))).toBe(false);
  });
  it('rejects all three production CLI operations with invalid authority, sanitized output and network denied', () => {
    const file = path.join(root, 'production-request.json');
    for (const operation of ['materialize-production-inputs', 'prepare-production-bridge', 'read-production-bridge']) {
      fs.writeFileSync(file, JSON.stringify({ operation, arguments: {} }));
      const run = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', '--require', './scripts/shims/register-server-only.cjs',
        '--require', './lib/set-identity-board/__tests__/fixtures/deny-network.cjs', 'scripts/semantic-correction-approval-bridge.ts', '--request', file],
        { encoding: 'utf8', windowsHide: true, timeout: 15000 });
      expect(run.error).toBeUndefined(); expect(run.status).toBe(1);
      expect(JSON.parse(run.stdout)).toEqual({ status: 'rejected', providerCalls: 0 });
    }
  }, 20000);
});

describe('v6 reviewed reconciliation with corrected coverage', () => {
  it('compiles all explicit decisions with effective identities and no authority escalation', async () => {
    const args = await reviewRequest();
    const before = canonicalContentAddressedJsonBytes(validated.packet);
    const preview = await prepareSemanticReconciliationReview({ ...args, write: false });
    expect(fs.existsSync(abs(args.outputDir))).toBe(false);
    expect(preview.review.content.contentReview.contentReadyForGuyReview).toBe(true);
    expect(preview.review.content.pendingReconciliation.review.status).toBe('pending');
    expect(preview.review.subject.effective).toEqual({
      templateDigest: validated.packet.correction.effective.templateDigest, coverageDigest: validated.packet.correction.effective.coverageDigest,
      catalogVersion: validated.packet.correction.effective.catalogVersion, catalogDigest: validated.packet.correction.effective.catalogDigest,
    });
    expect(preview.review.productionContext).toBeNull();
    expect(preview.review.content.reviewerPlan.actionSemanticCoverageDigest).toBe(validated.packet.correction.effective.coverageDigest);
    expect(preview.review.content.reviewerPlan.actionSemanticCoverageDigest).not.toBe(validated.packet.correction.original.coverageDigest);
    expect(preview.review.doesNotAuthorize).toContain('reconciliation_approval');
    expect(preview.review.doesNotAuthorize).toContain('image_render');
    const result = await prepareSemanticReconciliationReview(args);
    expect(result.review).toEqual(preview.review);
    const repeat = await prepareSemanticReconciliationReview(args);
    expect(repeat.artifact.created).toBe(false);
    const loaded = await loadSemanticReconciliationReview({ consumerRepoRoot: process.cwd(), reviewPath: result.artifact.path,
      expectedReviewDigest: result.review.digest });
    expect(loaded.review).toEqual(result.review);
    expect(canonicalContentAddressedJsonBytes(validated.packet)).toBe(before);
  });
  it('records and reconstructs an exact approval but leaves all downstream consumers closed', async () => {
    const result = await approvedReconciliation();
    expect(result.approval.reconciliation.review).toMatchObject({ status: 'approved', reviewedBy: 'Guy', reviewedAt: request.approvedAt });
    expect(result.approval.productionContext).toBeNull();
    expect(result.approval.doesNotAuthorize).not.toContain('reconciliation_approval');
    expect(result.approval.doesNotAuthorize).toContain('blueprint_authoring');
    expect(result.approval.doesNotAuthorize).toContain('image_render');
    const loaded = await loadApprovedSemanticReconciliation({ consumerRepoRoot: process.cwd(), approvalPath: result.artifact.path,
      expectedApprovalDigest: result.approval.digest });
    expect(loaded.approval).toEqual(result.approval);
    expect(loaded.approval.reconciliationDigest).toBe(canonicalHash(loaded.approval.reconciliation));
    expect(() => loadQaWizardCandidateBridgeManifest({ repoRoot: process.cwd(), manifestPath: result.artifact.path })).toThrow();
  });
  it('preserves explicit rebind and supersession decisions, and only stamps them in exact approval', async () => {
    const args = await reviewRequest();
    const first = args.decisions.presentationRequirements[0]!;
    const template = validated.packet.correction.effective.template;
    const index = template.pageContracts.findIndex(page => page.pageNumber === first.pageNumber);
    Object.assign(first, { kind: 'rebound', reboundPointer: `/pageContracts/${index}/mustShow/2`,
      reboundValue: template.pageContracts[index]!.mustShow[2] });
    Object.assign(args.decisions.presentationRequirements[1]!, { kind: 'superseded', justification: 'Explicit fixture-only omission.' });
    const result = await prepareSemanticReconciliationReview(args);
    expect(result.review.content.pendingReconciliation.review.status).toBe('pending');
    const outputDir = rel(path.join(root, 'approval-preview'));
    const approvalArgs = { consumerRepoRoot: process.cwd(), reviewPath: result.artifact.path, expectedReviewDigest: result.review.digest,
      approvedBy: 'Guy' as const, approvedAt: request.approvedAt, outputDir };
    const preview = await recordSemanticReconciliationApproval(approvalArgs);
    expect(fs.existsSync(abs(outputDir))).toBe(false);
    const dispositions = preview.approval.reconciliation.presentationRequirementDispositions.entries;
    expect(dispositions[0]).toMatchObject({ kind: 'rebound', review: { status: 'approved' } });
    expect(dispositions[1]).toMatchObject({ kind: 'superseded', review: { status: 'approved' } });
    const stored = await recordSemanticReconciliationApproval({ ...approvalArgs, write: true });
    expect(stored.approval).toEqual(preview.approval);
    expect((await recordSemanticReconciliationApproval({ ...approvalArgs, write: true })).artifact.created).toBe(false);
  });
  it('rejects a source proof pointing at a different real page even when that value is exact', async () => {
    const args = await reviewRequest();
    const source = args.decisions.sourceRequirements.find(r => r.sourceKind === 'historical_image_direction')!;
    const template = validated.packet.correction.effective.template;
    const other = template.pageContracts.findIndex(page => page.pageNumber !== source.pageNumber);
    source.visualBeats[0]!.contractEvidence[0] = { path: `/pageContracts/${other}/camera`, value: template.pageContracts[other]!.camera };
    await expect(prepareSemanticReconciliationReview(args)).rejects.toThrow();
  });
  it.each(['missing-source', 'duplicate-source', 'source-hash', 'missing-presentation', 'duplicate-presentation', 'wrong-value', 'cross-page', 'unknown-key'])(
    'rejects invalid reviewer decisions: %s before creating output', async kind => {
      const args = await reviewRequest();
      const d = args.decisions;
      if (kind === 'missing-source') d.sourceRequirements.pop();
      if (kind === 'duplicate-source') d.sourceRequirements.push(d.sourceRequirements[0]!);
      if (kind === 'source-hash') d.sourceRequirements[0]!.sourceTextSha256 = 'f'.repeat(64);
      if (kind === 'missing-presentation') d.presentationRequirements.pop();
      if (kind === 'duplicate-presentation') d.presentationRequirements.push(d.presentationRequirements[0]!);
      if (kind === 'wrong-value') d.sourceRequirements[0]!.visualBeats[0]!.contractEvidence[0]!.value = 'not the actual contract';
      if (kind === 'cross-page') d.presentationRequirements[0]!.pageNumber = 999;
      if (kind === 'unknown-key') (d as any).approved = true;
      await expect(prepareSemanticReconciliationReview(args)).rejects.toThrow();
      expect(fs.existsSync(abs(args.outputDir))).toBe(false);
    });
  it.each(['scope', 'plan', 'pending', 'subject', 'extra'])('reconstructs and rejects a rehashed review %s change', async kind => {
    const result = await reviewed();
    const changed = rewrite(result.artifact.path, value => {
      if (kind === 'scope') value.doesNotAuthorize = [];
      if (kind === 'plan') value.content.reviewerPlan.extra = true;
      if (kind === 'pending') value.content.pendingReconciliation.review.status = 'approved';
      if (kind === 'subject') value.subject.effective.coverageDigest = 'f'.repeat(64);
      if (kind === 'extra') value.productionContext = { approved: true };
    }, true);
    await expect(loadSemanticReconciliationReview({ consumerRepoRoot: process.cwd(), reviewPath: changed.file,
      expectedReviewDigest: changed.value.digest })).rejects.toThrow('review_reconstruction_mismatch');
  });
  it.each(['scope', 'reconciliation', 'bundle', 'subject', 'extra'])('reconstructs and rejects a rehashed approval %s change', async kind => {
    const result = await approvedReconciliation();
    const changed = rewrite(result.artifact.path, value => {
      if (kind === 'scope') value.doesNotAuthorize = [];
      if (kind === 'reconciliation') value.reconciliation.review.reviewedBy = 'Claude';
      if (kind === 'bundle') value.reviewBundle.extra = true;
      if (kind === 'subject') value.subject.effective.coverageDigest = 'f'.repeat(64);
      if (kind === 'extra') value.productionContext = { approved: true };
    }, true);
    await expect(loadApprovedSemanticReconciliation({ consumerRepoRoot: process.cwd(), approvalPath: changed.file,
      expectedApprovalDigest: changed.value.digest })).rejects.toThrow('approval_reconstruction_mismatch');
  });
  it.each([{ approvedBy: 'Claude' }, { approvedAt: '2000-01-01T00:00:00.000Z' }, { approvedAt: 'bad' },
    { expectedReviewDigest: 'f'.repeat(64) }, { write: 'true' }, { productionContext: {} }])('rejects invalid exact approval %j', async change => {
    const result = await reviewed();
    const outputDir = rel(path.join(root, 'never-created'));
    await expect(recordSemanticReconciliationApproval({ consumerRepoRoot: process.cwd(), reviewPath: result.artifact.path,
      expectedReviewDigest: result.review.digest, approvedBy: 'Guy', approvedAt: request.approvedAt, outputDir, write: true, ...change } as any)).rejects.toThrow();
    expect(fs.existsSync(abs(outputDir))).toBe(false);
  });
  it('pins reviewer inputs before asynchronous validation', async () => {
    const args = await reviewRequest();
    const original = structuredClone(args.decisions);
    validate.mockImplementationOnce(async () => { args.decisions.presentationRequirements.length = 0; return validated; });
    const result = await prepareSemanticReconciliationReview(args);
    expect(result.review.decisions).toEqual(original);
  });
  it.each(['review', 'approval'])('rejects %s bytes changed during fresh chain validation', async kind => {
    const result = kind === 'review' ? await reviewed() : await approvedReconciliation();
    validate.mockImplementationOnce(async () => { fs.appendFileSync(abs(result.artifact.path), ' '); return validated; });
    if (kind === 'review') {
      await expect(loadSemanticReconciliationReview({ consumerRepoRoot: process.cwd(), reviewPath: result.artifact.path,
        expectedReviewDigest: result.artifact.digest })).rejects.toThrow();
    } else {
      await expect(loadApprovedSemanticReconciliation({ consumerRepoRoot: process.cwd(), approvalPath: result.artifact.path,
        expectedApprovalDigest: result.artifact.digest })).rejects.toThrow();
    }
  });
  it('rejects current consumer drift before review persistence', async () => {
    const args = await reviewRequest();
    current.mockReturnValue({ ...validated.proof.currentConsumer, head: 'e'.repeat(40) });
    await expect(prepareSemanticReconciliationReview(args)).rejects.toThrow('consumer_changed_before_publish');
    expect(fs.existsSync(abs(args.outputDir))).toBe(false);
  });
  it('rejects a previously approved reconciliation when current proof changes, retaining original bytes', async () => {
    const result = await approvedReconciliation();
    const before = fs.readFileSync(abs(result.artifact.path), 'utf8');
    validate.mockResolvedValue({ ...validated, proof: { ...validated.proof, digest: 'e'.repeat(64) } });
    await expect(loadApprovedSemanticReconciliation({ consumerRepoRoot: process.cwd(), approvalPath: result.artifact.path,
      expectedApprovalDigest: result.approval.digest })).rejects.toThrow('manifest_reconstruction_mismatch');
    expect(fs.readFileSync(abs(result.artifact.path), 'utf8')).toBe(before);
  });
  it('requires the trusted approval digest, not merely a self-consistent timestamp substitution', async () => {
    const result = await approvedReconciliation();
    const changed = rewrite(result.artifact.path, value => value.approvedAt = '2026-09-10T00:00:00.000Z', true);
    await expect(loadApprovedSemanticReconciliation({ consumerRepoRoot: process.cwd(), approvalPath: changed.file,
      expectedApprovalDigest: result.approval.digest })).rejects.toThrow('artifact_not_canonical');
  });
  it('exposes all four new CLI operations with sanitized failure and network disabled', () => {
    const file = path.join(root, 'reconciliation-request.json');
    for (const operation of ['prepare-reconciliation-review', 'read-reconciliation-review', 'approve-reconciliation', 'read-reconciliation-approval']) {
      fs.writeFileSync(file, JSON.stringify({ operation, arguments: { unexpected: 'not authority' } }));
      const run = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', '--require', './scripts/shims/register-server-only.cjs',
        '--require', './lib/set-identity-board/__tests__/fixtures/deny-network.cjs', 'scripts/semantic-correction-approval-bridge.ts',
        '--request', file], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
      expect(run.error).toBeUndefined(); expect(run.status).toBe(1);
      expect(JSON.parse(run.stdout)).toEqual({ status: 'rejected', providerCalls: 0 });
    }
  }, 20000);
});

describe('exact semantic approval and changed-coverage pending bridge',()=>{
  it('previews approval with no directory or artifact write',async()=>{
    const result=await recordSemanticCorrectionApproval(request);
    expect(result.artifact.created).toBe(false);expect(fs.existsSync(abs(request.outputDir))).toBe(false);
    expect(result.approval).toMatchObject({decision:'approved',approvedBy:'Guy',authorityScope:'exact_semantic_correction_approval_only'});
    expect(result.approval.doesNotAuthorize).toContain('image_render');
    expect(result.approval.subject.original.coverageDigest).not.toBe(result.approval.subject.effective.coverageDigest);
  });
  it('persists one immutable approval, replays identically and reloads using fresh validation',async()=>{
    const first=await approve();const second=await approve();
    expect(first.artifact.created).toBe(true);expect(second.artifact.created).toBe(false);expect(second.approval).toEqual(first.approval);
    validate.mockClear();
    const loaded=await loadApprovedSemanticCorrection({consumerRepoRoot:process.cwd(),approvalPath:first.artifact.path,expectedApprovalDigest:first.approval.digest});
    expect(loaded.approval).toEqual(first.approval);expect(validate).toHaveBeenCalledExactlyOnceWith(request.validation);
  });
  it('routes effective template AND coverage into the real pending reconciliation projection',async()=>{
    const before=canonicalContentAddressedJsonBytes(validated.packet);
    const result=await bridge();const effective=validated.packet.correction.effective;
    expect(canonicalContentAddressedJsonBytes(validated.packet)).toBe(before);
    expect(canonicalHash(result.manifest.effective.template)).toBe(result.manifest.effective.templateDigest);
    expect(canonicalHash(result.manifest.effective.coverage)).toBe(result.manifest.effective.coverageDigest);
    expect(result.manifest).toMatchObject({version:'qa-wizard-candidate-bridge-manifest/v6',stage:'reconciliation_pending',productionContext:null});
    expect(result.manifest.effective.coverageDigest).toBe(effective.coverageDigest);
    expect(result.manifest.reconciliation).toEqual(buildProductionReconciliationDraftFromSourceSnapshot({
      snapshot:validated.historical.snapshot,template:effective.template,actionSemanticCoverage:effective.coverage}));
    expect(result.manifest.reconciliation.reconciliation.review.status).toBe('pending');
    expect(result.manifest.doesNotAuthorize).toContain('blueprint_authoring');
    const loaded=await loadSemanticCorrectionBridge({consumerRepoRoot:process.cwd(),manifestPath:result.artifact.path,expectedManifestDigest:result.manifest.digest});
    expect(loaded.manifest).toEqual(result.manifest);
    expect(qaWizardCandidateBridgeManifestIsValid(result.manifest)).toBe(false);
    expect(()=>loadQaWizardCandidateBridgeManifest({repoRoot:process.cwd(),manifestPath:result.artifact.path})).toThrow();
  });
  it('previews pending bridge without creating its output root',async()=>{
    const approval=await approve();const outputDir=rel(path.join(root,'bridge-preview'));
    const result=await prepareSemanticCorrectionBridge({consumerRepoRoot:process.cwd(),approvalPath:approval.artifact.path,
      expectedApprovalDigest:approval.approval.digest,outputDir});
    expect(result.artifact.created).toBe(false);expect(fs.existsSync(abs(outputDir))).toBe(false);
  });
  it('rejects an expected packet mismatch before creating output',async()=>{
    await expect(recordSemanticCorrectionApproval({...request,expectedReviewPacketDigest:'d'.repeat(64),write:true})).rejects.toThrow('expected_packet_mismatch');
    expect(fs.existsSync(abs(request.outputDir))).toBe(false);
  });
  it.each([{approvedBy:'Claude'},{approvedAt:'2026-09-09'},{approvedAt:'bad'},{write:'true'},
    {expectedReviewPacketDigest:'bad'},{proof:{}},{bridgeManifest:{}},{outputDir:'../escape'},
    {outputDir:'outputs/a/../b'},{outputDir:'outputs\\escape'},{outputDir:'story-bank/new'}])('rejects invalid input %j',async change=>{
    await expect(recordSemanticCorrectionApproval({...request,write:true,...change} as any)).rejects.toThrow();
    expect(fs.existsSync(abs(request.outputDir))).toBe(false);
  });
  it('pins the original caller arguments across async validation',async()=>{
    validate.mockImplementationOnce(async()=>{request.approvedAt='2020-01-01T00:00:00.000Z';request.validation.reviewPacketPath='changed';return validated;});
    const result=await recordSemanticCorrectionApproval(request);
    expect(result.approval.approvedAt).toBe('2026-09-09T06:20:00.000Z');
    expect(result.approval.validationRequest.reviewPacketPath).toBe('outputs/packet.json');
  });
  it('rejects current Git movement immediately before persistence',async()=>{
    current.mockReturnValue({...validated.proof.currentConsumer,head:'e'.repeat(40),upstreamHead:'e'.repeat(40)});
    await expect(approve()).rejects.toThrow('consumer_changed_before_publish');expect(fs.existsSync(abs(request.outputDir))).toBe(false);
  });
  it('rejects stale current validation before any output',async()=>{
    validate.mockRejectedValue(new Error('current_dirty'));
    await expect(approve()).rejects.toThrow('current_dirty');expect(fs.existsSync(abs(request.outputDir))).toBe(false);
  });
  it.each(['subject','decision','scope','extra'] as const)('rejects rehashed approval %s substitution',async kind=>{
    const original=await approve();
    const changed=rewrite(original.artifact.path,value=>{
      if(kind==='subject')value.subject.effective.coverageDigest='f'.repeat(64);
      if(kind==='decision')value.decision='pending';
      if(kind==='scope')value.doesNotAuthorize=[];
      if(kind==='extra')value.productionContext={approved:true};
    },true);
    await expect(loadApprovedSemanticCorrection({consumerRepoRoot:process.cwd(),approvalPath:changed.file,expectedApprovalDigest:changed.value.digest})).rejects.toThrow('approval_reconstruction_mismatch');
  });
  it('rejects a digest-swapped approval even if its rehash is self-consistent',async()=>{
    const original=await approve();const changed=rewrite(original.artifact.path,v=>v.approvedAt='2026-09-10T00:00:00.000Z',true);
    await expect(loadApprovedSemanticCorrection({consumerRepoRoot:process.cwd(),approvalPath:changed.file,expectedApprovalDigest:original.approval.digest})).rejects.toThrow('artifact_not_canonical');
  });
  it('rejects approval bytes changed during async validation',async()=>{
    const original=await approve();validate.mockImplementationOnce(async()=>{
      fs.appendFileSync(abs(original.artifact.path),' ');return validated;
    });
    await expect(loadApprovedSemanticCorrection({consumerRepoRoot:process.cwd(),approvalPath:original.artifact.path,expectedApprovalDigest:original.approval.digest})).rejects.toThrow();
  });
  it.each(['1970-01-01T00:00:00.000Z','2999-12-31T23:59:59.999Z'])('treats canonical operator time %s as metadata, never a replacement for the pinned decision',async approvedAt=>{
    const original=await approve();
    const changed=await recordSemanticCorrectionApproval({...request,approvedAt,write:true});
    expect(changed.approval.approvedAt).toBe(approvedAt);
    expect(changed.approval.subject).toEqual(original.approval.subject);
    expect(changed.approval.digest).not.toBe(original.approval.digest);
    await expect(loadApprovedSemanticCorrection({consumerRepoRoot:process.cwd(),approvalPath:changed.artifact.path,
      expectedApprovalDigest:original.approval.digest})).rejects.toThrow('artifact_not_canonical');
    const loaded=await loadApprovedSemanticCorrection({consumerRepoRoot:process.cwd(),approvalPath:changed.artifact.path,
      expectedApprovalDigest:changed.approval.digest});
    expect(loaded.approval).toEqual(changed.approval);
    expect(loaded.approval.authorityScope).toBe('exact_semantic_correction_approval_only');
    expect(loaded.approval.doesNotAuthorize).toContain('image_render');
  });
  it.each(['coverage','reconciliation','approval','scope','current'] as const)('rejects rehashed manifest %s substitution',async kind=>{
    const result=await bridge();const changed=rewrite(result.artifact.path,v=>{
      if(kind==='coverage')v.effective.coverageDigest='f'.repeat(64);
      if(kind==='reconciliation')v.reconciliation.reconciliation.review.status='approved';
      if(kind==='approval')v.approval.digest='f'.repeat(64);
      if(kind==='scope')v.productionContext={approved:true};
      if(kind==='current')v.currentValidation.currentConsumer.head='f'.repeat(40);
    },true);
    await expect(loadSemanticCorrectionBridge({consumerRepoRoot:process.cwd(),manifestPath:changed.file,expectedManifestDigest:changed.value.digest})).rejects.toThrow();
  });
  it('keeps content approval reusable but rejects an old pending bridge after current validation changes',async()=>{
    const result=await bridge();const updated={...validated,proof:{...validated.proof,digest:'e'.repeat(64)}};
    validate.mockResolvedValue(updated);
    await expect(loadApprovedSemanticCorrection({consumerRepoRoot:process.cwd(),approvalPath:result.manifest.approval.path,expectedApprovalDigest:result.manifest.approval.digest})).resolves.toBeDefined();
    await expect(loadSemanticCorrectionBridge({consumerRepoRoot:process.cwd(),manifestPath:result.artifact.path,expectedManifestDigest:result.manifest.digest})).rejects.toThrow('manifest_reconstruction_mismatch');
  });
  it('refuses a colliding approval rather than overwriting it',async()=>{
    const first=await approve();const before=fs.readFileSync(abs(first.artifact.path),'utf8')+' ';
    fs.writeFileSync(abs(first.artifact.path),before);await expect(approve()).rejects.toThrow();
    expect(fs.readFileSync(abs(first.artifact.path),'utf8')).toBe(before);
  });
  it('rejects a linked approval file',async()=>{
    const first=await approve();const alias=path.join(root,'hardlink.json');fs.linkSync(abs(first.artifact.path),alias);
    await expect(loadApprovedSemanticCorrection({consumerRepoRoot:process.cwd(),approvalPath:first.artifact.path,expectedApprovalDigest:first.approval.digest})).rejects.toThrow();
  });
  it('rejects noncanonical bytes introduced during store preparation, without replacing those bytes',async()=>{
    const preview=await recordSemanticCorrectionApproval(request);
    const mkdir=fs.mkdirSync;let changed=false;
    vi.spyOn(fs,'mkdirSync').mockImplementation(((file:fs.PathLike,...args:unknown[])=>{
      const result=(mkdir as Function)(file,...args);
      if(!changed && String(file).endsWith('semantic-correction-approvals')){
        changed=true;fs.writeFileSync(abs(preview.artifact.path),JSON.stringify(preview.approval));
      }
      return result;
    }) as typeof fs.mkdirSync);
    await expect(approve()).rejects.toThrow('artifact_not_canonical');
    expect(fs.readFileSync(abs(preview.artifact.path),'utf8')).toBe(JSON.stringify(preview.approval));
  });
  it('rejects a manifest changed during async approval reload',async()=>{
    const result=await bridge();validate.mockImplementationOnce(async()=>{
      fs.appendFileSync(abs(result.artifact.path),' ');return validated;
    });
    await expect(loadSemanticCorrectionBridge({consumerRepoRoot:process.cwd(),manifestPath:result.artifact.path,expectedManifestDigest:result.manifest.digest})).rejects.toThrow();
  });
  it('rejects an aliased output category without creating approval files',async()=>{
    const target=path.join(root,'target');fs.mkdirSync(target);fs.mkdirSync(abs(request.outputDir));
    fs.symlinkSync(target,path.join(abs(request.outputDir),'semantic-correction-approvals'),'junction');
    await expect(approve()).rejects.toThrow('category_alias');expect(fs.readdirSync(target)).toEqual([]);
  });
  it('real CLI rejects unknown/repeated flags and a dirty current request with sanitized output',()=>{
    const file=path.join(root,'request.json');fs.writeFileSync(file,JSON.stringify({operation:'approve',arguments:{...request,write:true}}));
    const cli=['node_modules/tsx/dist/cli.mjs','--require','./scripts/shims/register-server-only.cjs',
      '--require','./lib/set-identity-board/__tests__/fixtures/deny-network.cjs','scripts/semantic-correction-approval-bridge.ts'];
    for(const flags of [['--request',file],['--request',file,'--write'],['--request',file,'--request',file]]){
      const run=spawnSync(process.execPath,[...cli,...flags],{encoding:'utf8',windowsHide:true,timeout:15000});
      expect(run.error).toBeUndefined();expect(run.status).toBe(1);expect(JSON.parse(run.stdout)).toEqual({status:'rejected',providerCalls:0});
    }
    expect(fs.existsSync(abs(request.outputDir))).toBe(false);
  },20000);
});
