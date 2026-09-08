import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canonicalHash } from '@/lib/canonical-json';
import { canonicalContentAddressedJsonBytes } from '../canonicalContentAddressedJson';
import { buildSemanticCorrectionReviewPacket } from '../semanticCorrectionPreview';
import { validateSemanticCorrectionForCurrentConsumer } from '../semanticCorrectionConsumerValidation';
import { validateHistoricalCandidateChain } from '../historicalCandidateChain';
import { readCurrentQaWizardConsumerRepositoryAuthority } from '../qaWizardCandidateBridge';
import { p1SemanticRecoveryFixture, P1_REQUEST } from './fixtures/semantic-recovery-p1-fixture';

vi.mock('../historicalCandidateChain', async importOriginal => ({
  ...await importOriginal<typeof import('../historicalCandidateChain')>(), validateHistoricalCandidateChain: vi.fn(),
}));
vi.mock('../qaWizardCandidateBridge', async importOriginal => ({
  ...await importOriginal<typeof import('../qaWizardCandidateBridge')>(), readCurrentQaWizardConsumerRepositoryAuthority: vi.fn(),
}));
vi.mock('node:child_process', async importOriginal => ({
  ...await importOriginal<typeof import('node:child_process')>(), spawnSync: vi.fn(),
}));

const historyMock = vi.mocked(validateHistoricalCandidateChain);
const consumerMock = vi.mocked(readCurrentQaWizardConsumerRepositoryAuthority);
let root: string;
let packet: ReturnType<typeof buildSemanticCorrectionReviewPacket>;
let args: Parameters<typeof validateSemanticCorrectionForCurrentConsumer>[0];
function writePacket(value = packet) {
  const file = path.join(root, 'semantic-correction-reviews', `${value.digest}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, canonicalContentAddressedJsonBytes(value));
  args.reviewPacketPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
}
function rehash() {
  const { digest: _d, digestAlgorithm: _a, ...payload } = packet;
  packet.digest = canonicalHash(payload);
  writePacket();
}
beforeEach(() => {
  vi.clearAllMocks();
  const fixture = p1SemanticRecoveryFixture();
  packet = buildSemanticCorrectionReviewPacket(fixture.context, fixture.plan);
  fs.mkdirSync(path.join(process.cwd(), 'outputs'), { recursive: true });
  root = fs.mkdtempSync(path.join(process.cwd(), 'outputs/semantic-consumer-test-'));
  args = { consumerRepoRoot: process.cwd(), reviewPacketPath: '', historical: {
    ...P1_REQUEST, candidatePath: 'unused', authoringRequestPath: 'unused', authoringReceiptPath: 'unused',
    authoringReadinessPath: 'unused', freshReadinessPath: 'unused',
    supervisorExecutionRequestPath: 'unused', supervisorExecutionResultPath: 'unused',
  } };
  consumerMock.mockReturnValue({ repositoryRealPath: fs.realpathSync(process.cwd()),
    branchRef: 'refs/heads/codex/test', head: 'a'.repeat(40), upstreamRef: 'refs/remotes/origin/codex/test',
    upstreamHead: 'a'.repeat(40), ahead: 0, behind: 0, trackedChanges: 0, untrackedChanges: 0 });
  historyMock.mockResolvedValue({ ...fixture.context,
    proof: { digest: 'b'.repeat(64), historicalRepository: { head: 'c'.repeat(40) } },
  } as unknown as Awaited<ReturnType<typeof validateHistoricalCandidateChain>>);
  writePacket();
});
afterEach(() => { if (root) fs.rmSync(root, { recursive: true, force: true }); vi.restoreAllMocks(); });

describe('current consumer validation of an exact semantic correction', () => {
  it('reconstructs the original packet identically and keeps old/current identity and approval separate', async () => {
    const result = await validateSemanticCorrectionForCurrentConsumer(args);
    expect(result.packet).toEqual(packet);
    expect(packet.digest).toBe('b7fdd4e5fbf8f8685de7e25baa9bcefe78df95829ad30a66ab6d23981f15c1c2');
    expect(result.proof).toMatchObject({ semanticApproval: null, bridgeManifest: null, providerCalls: 0, zeroWrite: true,
      currentConsumer: { head: 'a'.repeat(40) }, historicalRepository: { head: 'c'.repeat(40) } });
    expect(result.proof.original.coverageDigest).not.toBe(result.proof.effective.coverageDigest);
    expect(historyMock).toHaveBeenCalledTimes(2);
    expect(consumerMock).toHaveBeenCalledTimes(2);
    expect(result.proof.doesNotAuthorize).toContain('image_render');
  });
  it.each(['write', 'outputDir', 'approvedBy', 'consumerAuthority', 'proof'])('rejects injected %s before input work', async key => {
    await expect(validateSemanticCorrectionForCurrentConsumer({ ...args, [key]: true })).rejects.toThrow('arguments_invalid');
    expect(historyMock).not.toHaveBeenCalled();
  });
  it('rejects a different repository even if that repository is claimed clean', async () => {
    args.consumerRepoRoot = root;
    await expect(validateSemanticCorrectionForCurrentConsumer(args)).rejects.toThrow('executing_repository_mismatch');
    expect(consumerMock).not.toHaveBeenCalled();
  });
  it('fails before historical access when current Git validation fails', async () => {
    consumerMock.mockImplementationOnce(() => { throw new Error('dirty'); });
    await expect(validateSemanticCorrectionForCurrentConsumer(args)).rejects.toThrow('dirty');
    expect(historyMock).not.toHaveBeenCalled();
  });
  it('performs no write or env read after positive-control sentinels are armed', async () => {
    const read = fs.readFileSync;
    const writeSentinel = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw new Error('write_denied'); });
    const readSentinel = vi.spyOn(fs, 'readFileSync').mockImplementation(((file: fs.PathOrFileDescriptor, ...rest: unknown[]) => {
      if (/^\.env(?:\.|$)/.test(path.basename(String(file)))) throw new Error('env_denied');
      return (read as Function)(file, ...rest);
    }) as typeof fs.readFileSync);
    expect(() => fs.writeFileSync('unused', '')).toThrow('write_denied');
    expect(() => fs.readFileSync('.env')).toThrow('env_denied');
    writeSentinel.mockClear(); readSentinel.mockClear();
    await validateSemanticCorrectionForCurrentConsumer(args);
    expect(writeSentinel).not.toHaveBeenCalled();
    expect(readSentinel.mock.calls.some(([file]) => /^\.env(?:\.|$)/.test(path.basename(String(file))))).toBe(false);
    writeSentinel.mockRestore(); readSentinel.mockRestore();
  });
  it.each(['approval', 'template', 'coverage', 'before', 'extra', 'catalog', 'plan'] as const)('rejects rehashed packet %s tamper', async kind => {
    if (kind === 'approval') Object.assign(packet, { decision: 'approved' });
    if (kind === 'template') packet.correction.effective.template.worldType = 'fantastical';
    if (kind === 'coverage') packet.correction.effective.coverageDigest = 'd'.repeat(64);
    if (kind === 'before') packet.before.template.worldType = 'fantastical';
    if (kind === 'extra') Object.assign(packet, { reconciliationApproved: true });
    if (kind === 'catalog') packet.correction.effective.catalogDigest = 'd'.repeat(64);
    if (kind === 'plan') packet.plan.operations.pop();
    rehash();
    await expect(validateSemanticCorrectionForCurrentConsumer(args)).rejects.toThrow();
  });
  it.each(['category', 'filename', 'bytes'] as const)('rejects canonical artifact %s drift', async kind => {
    if (kind === 'bytes') fs.appendFileSync(path.join(process.cwd(), args.reviewPacketPath), ' ');
    else {
      const target = kind === 'category' ? path.join(root, `${packet.digest}.json`)
        : path.join(root, 'semantic-correction-reviews', `${'f'.repeat(64)}.json`);
      fs.copyFileSync(path.join(process.cwd(), args.reviewPacketPath), target);
      args.reviewPacketPath = path.relative(process.cwd(), target).replace(/\\/g, '/');
    }
    await expect(validateSemanticCorrectionForCurrentConsumer(args)).rejects.toThrow('packet_not_canonical');
  });
  it('rejects current accepted source differing from the verified historical source', async () => {
    const original = await historyMock(args.historical);
    historyMock.mockResolvedValue({ ...original, snapshot: { ...original.snapshot, digest: 'd'.repeat(64) } });
    await expect(validateSemanticCorrectionForCurrentConsumer(args)).rejects.toThrow('source_revision_mismatch');
  });
  it.each(['consumer', 'history', 'packet'] as const)('rejects %s movement during async validation', async kind => {
    const original = await historyMock(args.historical);
    const consumer = consumerMock(args.consumerRepoRoot);
    historyMock.mockClear(); consumerMock.mockClear();
    if (kind === 'consumer') consumerMock.mockReturnValueOnce(consumer).mockReturnValueOnce({ ...consumer, head: 'e'.repeat(40) });
    if (kind === 'history') historyMock.mockResolvedValueOnce(original).mockResolvedValueOnce({ ...original,
      proof: { ...original.proof, digest: 'f'.repeat(64) } });
    if (kind === 'packet') historyMock.mockResolvedValueOnce(original).mockImplementationOnce(async () => {
      fs.appendFileSync(path.join(process.cwd(), args.reviewPacketPath), ' '); return original;
    });
    await expect(validateSemanticCorrectionForCurrentConsumer(args)).rejects.toThrow();
  });
});

describe('actual read-only consumer CLI', () => {
  it('rejects a non-admissible request and unknown/repeated flags without output artifacts', async () => {
    const child = await vi.importActual<typeof import('node:child_process')>('node:child_process');
    const request = path.join(root, 'request.json');
    fs.writeFileSync(request, JSON.stringify(args));
    const before = fs.readdirSync(root).sort();
    const cli = ['node_modules/tsx/dist/cli.mjs', '--require', './scripts/shims/register-server-only.cjs',
      '--require', './lib/set-identity-board/__tests__/fixtures/deny-network.cjs', 'scripts/validate-semantic-correction-consumer.ts'];
    for (const options of [['--request', request], ['--request', request, '--write'], ['--request', request, '--request', request]]) {
      const run = child.spawnSync(process.execPath, [...cli, ...options], { encoding: 'utf8', windowsHide: true, timeout: 15_000 });
      expect(run.error).toBeUndefined(); expect(run.status).toBe(1);
      expect(JSON.parse(run.stdout)).toEqual({ status: 'rejected', providerCalls: 0, zeroWrite: true });
    }
    expect(fs.readdirSync(root).sort()).toEqual(before);
  }, 20_000);
});

describe('shared strict current Git observation (mocked process output, real wrapper)', () => {
  async function run(overrides: Record<string, string> = {}) {
    const child = await import('node:child_process');
    vi.mocked(child.spawnSync).mockImplementation((_exe, argv, options) => {
      expect(options).toMatchObject({ shell: false, windowsHide: true });
      const key = (argv as string[]).slice(2).join(' ');
      const values: Record<string, string> = {
        'symbolic-ref --quiet HEAD': 'refs/heads/codex/test', 'rev-parse HEAD': 'a'.repeat(40),
        'rev-parse --symbolic-full-name @{upstream}': 'refs/remotes/origin/codex/test',
        'rev-parse refs/remotes/origin/codex/test': 'a'.repeat(40),
        'rev-list --left-right --count HEAD...@{upstream}': '0 0',
        'status --porcelain=v1 --untracked-files=all': '', ...overrides,
      };
      return { status: 0, signal: null, stdout: values[key] ?? '', stderr: '', pid: 1, output: [] } as ReturnType<typeof child.spawnSync>;
    });
    const actual = await vi.importActual<typeof import('../qaWizardCandidateBridge')>('../qaWizardCandidateBridge');
    return actual.readCurrentQaWizardConsumerRepositoryAuthority(process.cwd());
  }
  it('accepts clean same-name origin parity using fixed non-shell Git arguments', async () => {
    expect(await run()).toMatchObject({ ahead: 0, behind: 0, head: 'a'.repeat(40) });
  });
  it.each([
    ['main', { 'symbolic-ref --quiet HEAD': 'refs/heads/main' }],
    ['upstream', { 'rev-parse --symbolic-full-name @{upstream}': 'refs/remotes/other/codex/test' }],
    ['ahead', { 'rev-list --left-right --count HEAD...@{upstream}': '1 0' }],
    ['behind', { 'rev-list --left-right --count HEAD...@{upstream}': '0 1' }],
    ['tracked dirt', { 'status --porcelain=v1 --untracked-files=all': ' M changed.ts' }],
    ['untracked dirt', { 'status --porcelain=v1 --untracked-files=all': '?? untracked.ts' }],
    ['head mismatch', { 'rev-parse refs/remotes/origin/codex/test': 'b'.repeat(40) }],
  ])('rejects %s', async (_label, changes) => { await expect(run(changes)).rejects.toThrow(); });
});
