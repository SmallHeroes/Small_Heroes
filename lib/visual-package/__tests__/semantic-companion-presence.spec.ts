import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canonicalHash } from '@/lib/canonical-json';
import { materialize } from '@/lib/visual-contract-compiler/materializeContract';
import { derivePageVisualContracts } from '@/lib/visual-contract-compiler/derivePageVisualContracts';
import { buildVisualContractPromptBlock } from '@/lib/visual-contract-compiler/buildVisualContractPromptBlock';
import { applySemanticCorrection, assertSemanticCorrectionArtifact, buildSemanticCorrectionPlan } from '../visualContractSemanticCorrection';
import { buildSemanticCorrectionReviewPacket, prepareSemanticCorrectionPreview } from '../semanticCorrectionPreview';
import { canonicalContentAddressedJsonBytes } from '../canonicalContentAddressedJson';
import { validateSemanticCorrectionForCurrentConsumer } from '../semanticCorrectionConsumerValidation';
import { validateHistoricalCandidateChain } from '../historicalCandidateChain';
import { readCurrentQaWizardConsumerRepositoryAuthority } from '../qaWizardCandidateBridge';
import { PANDA_REQUEST, pandaPresenceFixture } from './fixtures/semantic-recovery-panda-fixture';
import { p1SemanticRecoveryFixture } from './fixtures/semantic-recovery-p1-fixture';
import { assertAcceptedCompanionPresenceEvidence } from '../acceptedCompanionPresenceEvidence';

// Only the historical paid replay/Git observation are mocked. Current accepted
// source loading, operation validation, packet reconstruction and prompt are real.
vi.mock('../historicalCandidateChain', async original => ({
  ...await original<typeof import('../historicalCandidateChain')>(), validateHistoricalCandidateChain: vi.fn(),
}));
vi.mock('../qaWizardCandidateBridge', async original => ({
  ...await original<typeof import('../qaWizardCandidateBridge')>(), readCurrentQaWizardConsumerRepositoryAuthority: vi.fn(),
}));
const created: string[] = [];
afterEach(() => {
  vi.restoreAllMocks(); vi.clearAllMocks();
  for (const dir of created.splice(0)) {
    const root = path.resolve(process.cwd(), 'outputs') + path.sep;
    if (!path.resolve(dir).startsWith(root) || !path.basename(dir).startsWith('presence-test-')) throw new Error('unsafe_cleanup');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
function inputs() {
  fs.mkdirSync(path.join(process.cwd(), 'outputs'), { recursive: true });
  const dir = fs.mkdtempSync(path.join(process.cwd(), 'outputs/presence-test-'));
  created.push(dir);
  const relative = path.relative(process.cwd(), dir).replace(/\\/g, '/');
  const fixture = pandaPresenceFixture();
  for (const [name, value] of Object.entries({ candidate: fixture.context.candidate,
    review: fixture.context.supportingCastReview, operations: [fixture.operation] })) {
    fs.writeFileSync(path.join(dir, `${name}.json`), canonicalContentAddressedJsonBytes(value));
  }
  return { ...fixture, dir, args: { ...PANDA_REQUEST, candidatePath: `${relative}/candidate.json`,
    supportingCastReviewPath: `${relative}/review.json`, operationsPath: `${relative}/operations.json`, outputDir: `${relative}/result` } };
}
function seal<T extends { digest: string; digestAlgorithm: string }>(value: T): T {
  const { digest: _d, digestAlgorithm: _a, ...payload } = value;
  return { ...value, digest: canonicalHash(payload) };
}

describe('accepted typed companion presence, additive review-only v2', () => {
  it.each(['absent', 'offscreen', '', 'PRESENT', 'present ', null, undefined])('a correctly hash-bound document with presence %s still cannot authorize addition', value => {
    const rawJson = JSON.stringify({ version: 'small-heroes-story-visual-direction-record/v1', storyKey: 'generic_story',
      pages: [{ pageNumber: 1, companionPresence: value, mainAction: 'the companion waits nearby' }] });
    const expectedSha256 = createHash('sha256').update(rawJson).digest('hex');
    expect(() => assertAcceptedCompanionPresenceEvidence({ rawJson, expectedSha256, storyKey: 'generic_story', pageCount: 1, pageNumber: 1 })).toThrow();
  });
  it.each(['story', 'version', 'missing page', 'duplicate page', 'order', 'malformed'])('rejects hash-bound invalid direction %s', kind => {
    const doc = { version: 'small-heroes-story-visual-direction-record/v1', storyKey: 'generic_story',
      pages: [1, 2].map(pageNumber => ({ pageNumber, companionPresence: 'present' })) };
    if (kind === 'story') doc.storyKey = 'wrong';
    if (kind === 'version') doc.version = 'unknown';
    if (kind === 'missing page') doc.pages.pop();
    if (kind === 'duplicate page') doc.pages[1]!.pageNumber = 1;
    if (kind === 'order') doc.pages.reverse();
    const rawJson = kind === 'malformed' ? '{' : JSON.stringify(doc);
    expect(() => assertAcceptedCompanionPresenceEvidence({ rawJson, expectedSha256: createHash('sha256').update(rawJson).digest('hex'),
      storyKey: 'generic_story', pageCount: 2, pageNumber: 1 })).toThrow();
  });
  it('repairs the real omission and projects it downstream without changing any other page or source', () => {
    const { context, plan } = pandaPresenceFixture();
    const before = canonicalHash(context);
    expect(context.candidate.template.pageContracts[5]!.characterPresence?.companion).toBe(false);
    const result = applySemanticCorrection(context, plan);
    expect(result.version).toBe('visual-contract-semantic-correction/v2');
    expect(plan.version).toBe('visual-contract-semantic-correction-plan/v2');
    const expected = structuredClone(context.candidate.template);
    expected.pageContracts[5]!.characterPresence!.companion = true;
    expected.pageContracts[5]!.castIds!.push(expected.cast.companion!.id);
    expect(result.effective.template).toEqual(expected);
    expect(result.effective.coverage).toEqual(context.candidate.actionSemanticCoverage);
    expect(canonicalHash(context)).toBe(before);
    expect(result.doesNotAuthorize).toContain('image_render');
    const resolved = materialize(result.effective.template, { skinTone: 'warm tan', hairColour: 'brown', hairTexture: 'wavy' });
    const page = derivePageVisualContracts(resolved).find(p => p.pageNumber === 6)!;
    expect(page.characterPresence?.companion).toBe(true);
    expect(buildVisualContractPromptBlock(page, resolved)).toContain(context.candidate.template.cast.companion!.id);
    assertSemanticCorrectionArtifact(context, plan, result);
  });
  it.each([
    ['source byte change', { acceptedVisualDirectionsJson: '{}' }, 'companion_direction_source_mismatch'],
    ['identity', { companionId: 'companion:invented' }, 'companion_identity_mismatch'],
    ['stale cast', { expectedCastIds: ['child:hero', 'human:invented'] }, 'companion_before_state_mismatch'],
    ['existing presence', { pageNumber: 5 }, 'companion_before_state_mismatch'],
    ['missing page', { pageNumber: 80 }, 'page_missing'],
  ])('rejects %s atomically', (_name, patch, message) => {
    const { context, operation } = pandaPresenceFixture();
    const before = canonicalHash(context);
    expect(() => applySemanticCorrection(context, buildSemanticCorrectionPlan(context, [{ ...operation, ...patch }]))).toThrow(message);
    expect(canonicalHash(context)).toBe(before);
  });
  it.each(['unknown field', 'removal', 'nonboolean', 'oversized source'])('rejects %s at the schema boundary', kind => {
    const { context, operation } = pandaPresenceFixture();
    const changed = { ...operation } as Record<string, unknown>;
    if (kind === 'unknown field') changed.approved = true;
    if (kind === 'removal') changed.kind = 'remove_companion_presence';
    if (kind === 'nonboolean') changed.expectedCompanionPresent = 'false';
    if (kind === 'oversized source') changed.acceptedVisualDirectionsJson = ' '.repeat(250001);
    expect(() => buildSemanticCorrectionPlan(context, [changed])).toThrow();
  });
  it('rejects duplicate operations and a rehashed v1 downgrade', () => {
    const { context, operation, plan } = pandaPresenceFixture();
    expect(() => applySemanticCorrection(context, buildSemanticCorrectionPlan(context, [operation, operation]))).toThrow('overlapping_operations');
    expect(() => applySemanticCorrection(context, seal({ ...plan, version: 'visual-contract-semantic-correction-plan/v1' }))).toThrow('plan_version_mismatch');
  });
  it('rejects source changes even when the supplied proof is still valid JSON', () => {
    const { context, operation } = pandaPresenceFixture();
    for (const change of ['presence', 'page', 'story', 'whitespace']) {
      const doc = JSON.parse(operation.acceptedVisualDirectionsJson);
      if (change === 'presence') doc.pages[5].companionPresence = 'absent';
      if (change === 'page') doc.pages[5].pageNumber = 7;
      if (change === 'story') doc.storyKey = 'other';
      const acceptedVisualDirectionsJson = change === 'whitespace' ? operation.acceptedVisualDirectionsJson + ' ' : JSON.stringify(doc);
      expect(() => applySemanticCorrection(context, buildSemanticCorrectionPlan(context, [{ ...operation, acceptedVisualDirectionsJson }]))).toThrow('companion_direction_source_mismatch');
    }
  });
  it('resolves presence before cast-consuming presentation operations in either order', () => {
    const { context, operation } = pandaPresenceFixture();
    const row = context.candidate.actionSemanticCoverage.find(r => r.pageNumber === 6)!;
    const replacement = { kind: 'replace_presentation', pageNumber: 6, mustShowIndex: 0,
      expectedMustShow: context.candidate.template.pageContracts[5]!.mustShow[0],
      replacement: 'Empty walking rover on nearby grass; companion waiting nearby.',
      sourceEvidenceIds: [row.sourceEvidenceId], castIds: [operation.companionId] };
    const run = (ops: unknown[]) => applySemanticCorrection(context, buildSemanticCorrectionPlan(context, ops)).effective;
    expect(run([replacement, operation])).toEqual(run([operation, replacement]));
    expect(() => run([replacement])).toThrow('presentation_cast_missing');
  });
  it('preserves the historical v1 packet digest exactly', () => {
    const { context, plan } = p1SemanticRecoveryFixture();
    expect(buildSemanticCorrectionReviewPacket(context, plan).digest).toBe('b7fdd4e5fbf8f8685de7e25baa9bcefe78df95829ad30a66ab6d23981f15c1c2');
  });
  it('rejects rehashed suppression of the effective companion', () => {
    const { context, plan } = pandaPresenceFixture();
    const result = applySemanticCorrection(context, plan);
    result.effective.template.pageContracts[5]!.characterPresence!.companion = false;
    result.effective.templateDigest = canonicalHash(result.effective.template);
    expect(() => assertSemanticCorrectionArtifact(context, plan, seal(result))).toThrow('reconstruction');
  });
});

describe('real preview / current consumer entry points', () => {
  it('dry-run is write-free; persisted pending packet is idempotent; bad source creates no output', () => {
    const { args, dir, operation } = inputs();
    const dry = prepareSemanticCorrectionPreview(args);
    expect(dry.artifact).toBeNull();
    expect(fs.existsSync(path.join(dir, 'result'))).toBe(false);
    const written = prepareSemanticCorrectionPreview({ ...args, write: true });
    expect(written.packet).toEqual(dry.packet);
    expect(written.packet.decision).toBe('pending');
    expect(prepareSemanticCorrectionPreview({ ...args, write: true }).artifact!.created).toBe(false);
    fs.writeFileSync(path.join(dir, 'operations.json'), JSON.stringify([{ ...operation, acceptedVisualDirectionsJson: '{}' }]));
    expect(() => prepareSemanticCorrectionPreview({ ...args, outputDir: args.outputDir + '-bad', write: true })).toThrow('source_mismatch');
    expect(fs.existsSync(path.join(dir, 'result-bad'))).toBe(false);
  });
  it('actual CLI succeeds with network disabled and does not grant approval', () => {
    const { args } = inputs();
    const run = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', '--require', './scripts/shims/register-server-only.cjs',
      '--require', './lib/set-identity-board/__tests__/fixtures/deny-network.cjs', 'scripts/preview-semantic-correction.ts',
      '--repo-root', process.cwd(), '--story-key', args.storyKey, '--story-path', args.storyPath,
      '--candidate', args.candidatePath, '--cast-review', args.supportingCastReviewPath,
      '--operations', args.operationsPath, '--output', args.outputDir], { encoding: 'utf8', windowsHide: true, timeout: 20000 });
    expect(run.status, run.stderr).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({ status: 'review_pending', providerCalls: 0, artifact: null });
  }, 25000);
  it.each([false, true])('current consumer reloads disk authority and reconstructs v2 (tamper=%s)', async tamper => {
    const { args: preview, context } = inputs();
    const written = prepareSemanticCorrectionPreview({ ...preview, write: true });
    const packet = written.packet;
    if (tamper) {
      const op = packet.plan.operations[0]!;
      if (op.kind !== 'require_companion_presence') throw new Error('fixture');
      op.acceptedVisualDirectionsJson += ' ';
      packet.plan = seal(packet.plan);
      Object.assign(packet, seal(packet));
      const file = path.join(process.cwd(), path.dirname(written.artifact!.path), packet.digest + '.json');
      fs.writeFileSync(file, canonicalContentAddressedJsonBytes(packet));
      written.artifact!.path = path.relative(process.cwd(), file).replace(/\\/g, '/');
    }
    vi.mocked(readCurrentQaWizardConsumerRepositoryAuthority).mockReturnValue({ repositoryRealPath: fs.realpathSync(process.cwd()),
      branchRef: 'refs/heads/codex/test', head: 'a'.repeat(40), upstreamRef: 'refs/remotes/origin/codex/test',
      upstreamHead: 'a'.repeat(40), ahead: 0, behind: 0, trackedChanges: 0, untrackedChanges: 0 });
    vi.mocked(validateHistoricalCandidateChain).mockResolvedValue({ ...context,
      proof: { digest: 'b'.repeat(64), historicalRepository: { head: 'c'.repeat(40) } },
    } as unknown as Awaited<ReturnType<typeof validateHistoricalCandidateChain>>);
    const request = { consumerRepoRoot: process.cwd(), reviewPacketPath: written.artifact!.path, historical: {
      ...PANDA_REQUEST, candidatePath: 'unused', authoringRequestPath: 'unused', authoringReceiptPath: 'unused',
      authoringReadinessPath: 'unused', freshReadinessPath: 'unused', supervisorExecutionRequestPath: 'unused', supervisorExecutionResultPath: 'unused',
    } };
    if (tamper) await expect(validateSemanticCorrectionForCurrentConsumer(request)).rejects.toThrow('source_mismatch');
    else {
      const result = await validateSemanticCorrectionForCurrentConsumer(request);
      expect(result.packet).toEqual(packet);
      expect(result.proof).toMatchObject({ semanticApproval: null, bridgeManifest: null, providerCalls: 0, zeroWrite: true });
    }
  });
});
