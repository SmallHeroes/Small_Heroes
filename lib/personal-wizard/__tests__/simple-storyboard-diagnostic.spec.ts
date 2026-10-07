import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { resolvePersonalWizardOptions } from '../options';
import { canonicalJson } from '../request-acceptance';
import { prepareSimpleStory, writeSimpleStory, type SimpleStoryCall, type SimpleStoryDraft } from '../simple-story-engine';
import { createCurrentSimpleStorySource } from '../simple-story-source';
import { prepareCurrentPersonalStoryboard, compilePersonalStoryboard, PERSONAL_STORYBOARD_INSTRUCTION, personalStoryboardReviewSchema } from '../storyboard';
import { PERSONAL_BOOK_REVIEW_INSTRUCTION } from '../book-runner';
import { personalBookOutputLimits } from '../book-config';
import { runSimpleStoryboardDiagnostic, SIMPLE_STORYBOARD_INPUT_LIMIT, type SimpleStoryboardDiagnosticCall } from '../simple-storyboard-diagnostic';
import { textCanonOptions } from '../../../scripts/personal-simple-story';
import { main, loadSimpleStoryboardSource } from '../../../scripts/personal-simple-storyboard';

const baseOptions = resolvePersonalWizardOptions(), options = textCanonOptions(baseOptions);
const owned = new Set<string>(), sha = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of owned) {
    const parent = path.dirname(directory), name = path.basename(directory);
    if ((parent !== tmpdir() && parent !== path.join(process.cwd(), 'outputs')) || !name.startsWith('sh_diag_test_')) throw Error('test_cleanup_boundary');
    rmSync(directory, { recursive: true, force: true });
  }
  owned.clear();
});

async function fixture(length = 'short') {
  const f = await personalStoryboardFixture(length), prepared = prepareSimpleStory(f.request, options, 'diagnostic-fixture');
  const plan = f.result.plan;
  const draft: SimpleStoryDraft = { title: plan.title, childGoal: plan.childGoal, companionWant: plan.companionWant,
    comicPromise: plan.comicPromise, ending: plan.ending,
    pages: f.result.manuscript.pages.map(page => ({ text: `${page.text} נועה ודיני משחקות בציור.` })),
    pageMap: plan.beats.map(({ pageNumber: _page, ...row }) => row),
    resilienceMoments: plan.resilience.moments.map(({ pageNumber, ...row }) => ({ page: pageNumber, ...row })) };
  const records: Record<string, any> = {}, writerCalls: SimpleStoryCall[] = [];
  const generated = await writeSimpleStory(prepared, async call => {
    writerCalls.push(call);
    const output = call.stage === 'author' ? structuredClone(draft) : { ...structuredClone(draft), editorChanges: ['Synthetic structural fixture.'] };
    const usage = { inputTokens: 1000, outputTokens: 2000 }, termination = { code: 0, signal: null };
    records[call.stage] = { output, usage, estimatedMicroUsd: 100000,
      metadata: { kind: 'cli_reported_estimate_not_invoice', reportedModels: ['claude-opus-5-5'], termination },
      raw: { termination, killConfirmed: true, stopped: false, stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false,
        session_id: call.stage === 'author' ? '11111111-1111-4111-8111-111111111111' : '22222222-2222-4222-8222-222222222222',
        total_cost_usd: .1, modelUsage: { 'claude-opus-5-5': usage }, structured_output: output }) } };
    return { output, usage, estimatedUsd: .1 };
  }, { model: 'claude-opus-5-5', reservedUsd: 2 });
  const writerResult = createCurrentSimpleStorySource(f.request, generated, records as { author: unknown; editor: unknown }, options);
  const source = prepareCurrentPersonalStoryboard(f.request, writerResult, options), book = compilePersonalStoryboard(source, f.draft);
  const review = { ...structuredClone(f.review), sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest };
  const generate = vi.fn(async (call: SimpleStoryboardDiagnosticCall, _signal: AbortSignal) => structuredClone(call.stage === 'storyboard' ? f.draft : review));
  return { ...f, generated, writerCalls, records, writerResult, review, generate,
    args: { request: f.request, writerResult, options, signal: new AbortController().signal, generate } };
}
async function files(length = 'short') {
  const f = await fixture(length), root = mkdtempSync(path.join(tmpdir(), 'sh_diag_test_')); owned.add(root);
  const sourceDir = path.join(root, 'source'); mkdirSync(sourceDir);
  const write = (file: string, data: unknown) => writeFileSync(file, JSON.stringify(data, null, 2));
  write(path.join(root, 'request.json'), f.request); write(path.join(root, 'planner.json'), f.draft); write(path.join(root, 'reviewer.json'), f.review);
  write(path.join(sourceDir, 'result.json'), f.generated.result); write(path.join(sourceDir, 'evidence.json'), f.generated.evidence);
  for (const call of f.writerCalls) {
    write(path.join(sourceDir, `${call.stage}-receipt.json`), f.records[call.stage]);
    writeFileSync(path.join(sourceDir, `${call.stage}-instructions.txt`), call.instructions);
    write(path.join(sourceDir, `${call.stage}-wire.json`), { input: call.input, outputCap: call.maxOutputTokens,
      model: 'claude-opus-5-5', digest: sha(canonicalJson({ instructions: call.instructions, input: call.input })) });
  }
  const output = path.join(root, 'outputs', 'candidate'), argv = ['--request', path.join(root, 'request.json'), '--source-dir', sourceDir,
    '--storyboard', path.join(root, 'planner.json'), '--review', path.join(root, 'reviewer.json'), '--out', output];
  return { ...f, root, sourceDir, output, argv, deps: { root, options: baseOptions, log: vi.fn() } };
}

describe('simple storyboard diagnostic over existing current seams', () => {
  it.each(['short', 'medium', 'long'])('drives one complete %s book, exact instructions and final-text packets without render authority', async length => {
    const f = await fixture(length), before = structuredClone(f.writerResult), result = await runSimpleStoryboardDiagnostic(f.args);
    expect(f.generate).toHaveBeenCalledTimes(2); expect(result.calls.map(call => call.stage)).toEqual(['storyboard', 'review']);
    for (const [, signal] of f.generate.mock.calls) {
      expect(signal).toBe(f.args.signal); expect(signal.aborted).toBe(false);
    }
    const [planner, reader] = f.generate.mock.calls.map(([call]) => call);
    expect(planner.instructions).toBe(PERSONAL_STORYBOARD_INSTRUCTION);
    expect(reader.instructions).toBe(PERSONAL_BOOK_REVIEW_INSTRUCTION); expect(reader.schema).toBe(personalStoryboardReviewSchema);
    expect(planner.maxOutputTokens).toBe(personalBookOutputLimits(result.storyboard.narrativeSpreads).storyboardOutputTokens);
    expect(reader.maxOutputTokens).toBe(personalBookOutputLimits(result.storyboard.narrativeSpreads).reviewOutputTokens);
    const planningInput = JSON.parse(planner.input), reviewInput = JSON.parse(reader.input);
    expect(planningInput.story.pages.map((row: { text: string }) => row.text)).toEqual(f.writerResult.manuscript.pages.map(row => row.text));
    expect(reviewInput.manuscript).toEqual(f.writerResult.manuscript);
    expect(reviewInput).not.toHaveProperty('draft'); expect(reviewInput).not.toHaveProperty('editorChanges');
    expect(result.status).toBe('review_supported'); expect(result.framePackets).toHaveLength(result.storyboard.narrativeSpreads + 1);
    expect(result.runtimeEligible).toBe(false);
    for (const packet of result.framePackets) {
      expect(packet.runtimeEligible).toBe(false); expect(packet.render.contextSha).toBe(packet.qa.contextSha);
      expect(packet.context.text).toBe(packet.context.pageNumber === 0 ? f.writerResult.manuscript.title : f.writerResult.manuscript.pages[packet.context.pageNumber - 1].text);
    }
    for (const call of result.calls) {
      expect(call.contentBytes).toBe(Buffer.byteLength(call.instructions) + Buffer.byteLength(call.input));
      expect(call.headroomBytes).toBe(SIMPLE_STORYBOARD_INPUT_LIMIT - call.contentBytes);
    }
    expect(f.writerResult).toEqual(before);
  });
  it.each(['uncertain', 'contradiction'] as const)('keeps a %s whole-book review with zero packets', async verdict => {
    const f = await fixture(); f.review.frames[3].checks[2].verdict = verdict as 'supported';
    const result = await runSimpleStoryboardDiagnostic(f.args);
    expect(result.status).toBe(`held_${verdict}`); expect(result.framePackets).toEqual([]); expect(f.generate).toHaveBeenCalledTimes(2);
  });
  it.each(['bare', 'legacy_v3', 'default_options', 'changed_text'])('rejects %s before invoking either callback', async kind => {
    const f = await fixture(), args: any = { ...f.args, writerResult: structuredClone(f.writerResult) };
    if (kind === 'bare') delete args.writerResult.simpleSource;
    if (kind === 'legacy_v3') {
      expect(prepareCurrentPersonalStoryboard(f.request, f.result, baseOptions)).toBeDefined();
      args.writerResult = f.result; args.options = baseOptions;
    }
    if (kind === 'default_options') args.options = baseOptions;
    if (kind === 'changed_text') args.writerResult.manuscript.pages[0].text += ' changed';
    await expect(runSimpleStoryboardDiagnostic(args)).rejects.toThrow(kind === 'bare' || kind === 'legacy_v3' ? 'simple_source_required'
      : kind === 'default_options' ? 'writing_binding' : 'final_binding');
    expect(f.generate).not.toHaveBeenCalled();
  });
  it('rejects stale final review and does not invent or retry approval', async () => {
    const f = await fixture(); f.review.storyboardDigest = 'a'.repeat(64);
    await expect(runSimpleStoryboardDiagnostic(f.args)).rejects.toThrow('review_binding'); expect(f.generate).toHaveBeenCalledTimes(2);
  });
  it.each(['before', 'after_planner', 'after_review'])('cancels %s without a subsequent callback or packets', async when => {
    const f = await fixture(), controller = new AbortController();
    if (when === 'before') controller.abort();
    const generate = vi.fn(async (call: SimpleStoryboardDiagnosticCall, _signal: AbortSignal) => {
      if ((when === 'after_planner' && call.stage === 'storyboard') || (when === 'after_review' && call.stage === 'review')) controller.abort();
      return structuredClone(call.stage === 'storyboard' ? f.draft : f.review);
    });
    await expect(runSimpleStoryboardDiagnostic({ ...f.args, signal: controller.signal, generate })).rejects.toThrow('cancelled');
    expect(generate).toHaveBeenCalledTimes(when === 'before' ? 0 : when === 'after_planner' ? 1 : 2);
    for (const [, signal] of generate.mock.calls) {
      expect(signal).toBe(controller.signal); expect(signal.aborted).toBe(true);
    }
  });
  it.each(['storyboard', 'review'])('contains a %s callback failure without retry or private output', async stage => {
    const f = await fixture(), generate = vi.fn(async (call: SimpleStoryboardDiagnosticCall) => {
      if (call.stage === stage) throw Error('private-sentinel'); return f.draft;
    });
    const promise = runSimpleStoryboardDiagnostic({ ...f.args, generate });
    await expect(promise).rejects.toThrow(stage === 'storyboard' ? 'author_failed' : 'review_callback_failed');
    await expect(promise).rejects.not.toThrow('private-sentinel'); expect(generate).toHaveBeenCalledTimes(stage === 'storyboard' ? 1 : 2);
  });
  it.each(['storyboard', 'review'])('stops when the current request changes during %s', async stage => {
    const f = await fixture(), generate = vi.fn(async (call: SimpleStoryboardDiagnosticCall) => {
      if (call.stage === stage) f.request.child.name = 'תמר';
      return structuredClone(call.stage === 'storyboard' ? f.draft : f.review);
    });
    await expect(runSimpleStoryboardDiagnostic({ ...f.args, generate })).rejects.toThrow();
    expect(generate).toHaveBeenCalledTimes(stage === 'storyboard' ? 1 : 2);
  });
  it.each([0, -1, 1.5, 104001])('refuses invalid content-byte policy %s before callbacks', async inputByteLimit => {
    const f = await fixture(); await expect(runSimpleStoryboardDiagnostic({ ...f.args, inputByteLimit })).rejects.toThrow('input_policy');
    expect(f.generate).not.toHaveBeenCalled();
  });
  it('checks planner headroom before a callback and review headroom before a second callback', async () => {
    const f = await fixture(); await expect(runSimpleStoryboardDiagnostic({ ...f.args, inputByteLimit: 1 })).rejects.toThrow('input_limit');
    expect(f.generate).not.toHaveBeenCalled();
    const result = await runSimpleStoryboardDiagnostic(f.args), plannerBytes = result.calls[0].contentBytes;
    expect(result.calls[1].contentBytes).toBeGreaterThan(plannerBytes); f.generate.mockClear();
    await expect(runSimpleStoryboardDiagnostic({ ...f.args, inputByteLimit: plannerBytes })).rejects.toThrow('input_limit');
    expect(f.generate).toHaveBeenCalledTimes(1);
  });
});

describe('offline-only CLI source preservation and real bootstrap', () => {
  it('uses writing options and preserves every source file byte-for-byte, with a truthful replay manifest', async () => {
    const f = await files(), before = Object.fromEntries(['result.json', 'evidence.json', 'author-receipt.json', 'editor-receipt.json',
      'author-instructions.txt', 'editor-instructions.txt', 'author-wire.json', 'editor-wire.json'].map(name => [name, readFileSync(path.join(f.sourceDir, name))]));
    Object.assign(before, { 'request.json': readFileSync(path.join(f.root, 'request.json')),
      'planner-output.json': readFileSync(path.join(f.root, 'planner.json')), 'reviewer-output.json': readFileSync(path.join(f.root, 'reviewer.json')) });
    expect(await main(f.argv, f.deps)).toBe(0);
    const manifest = JSON.parse(readFileSync(path.join(f.output, 'manifest.json'), 'utf8'));
    expect(manifest).toMatchObject({ mode: 'offline_saved_outputs_replay', status: 'review_supported', providerCalls: 0, costUsd: 0,
      replayCallbackInvocations: 2, optionsFingerprint: options.fingerprint, framePackets: 9, runtimeEligible: false,
      costScope: 'this_offline_replay_only_not_prior_writing_or_supplied_model_outputs' });
    for (const [name, bytes] of Object.entries(before)) {
      if (name !== 'request.json' && name !== 'planner-output.json' && name !== 'reviewer-output.json') expect(readFileSync(path.join(f.sourceDir, name))).toEqual(bytes);
      expect(readFileSync(path.join(f.output, 'source', name))).toEqual(bytes); expect(manifest.originalFileHashes[name]).toBe(sha(bytes));
    }
    const calls = JSON.parse(readFileSync(path.join(f.output, 'calls.json'), 'utf8'));
    expect(calls[1].instructions).toBe(PERSONAL_BOOK_REVIEW_INSTRUCTION);
    expect(await main(f.argv, f.deps)).toBe(1); expect(f.deps.log.mock.calls[f.deps.log.mock.calls.length - 1][0]).toBe('simple_storyboard_diagnostic_output_boundary');
  });
  it.each(['uncertain', 'contradiction'] as const)('writes held %s evidence, exit 2, without a frame file', async verdict => {
    const f = await files(); f.review.bookChecks[0].verdict = verdict as 'supported';
    writeFileSync(path.join(f.root, 'reviewer.json'), JSON.stringify(f.review));
    expect(await main(f.argv, f.deps)).toBe(2); expect(existsSync(path.join(f.output, 'frame-packets.json'))).toBe(false);
    expect(JSON.parse(readFileSync(path.join(f.output, 'manifest.json'), 'utf8')).status).toBe(`held_${verdict}`);
  });
  it.each(['author_instructions', 'editor_instructions', 'author_input', 'editor_input', 'wire_model', 'wire_cap', 'wire_digest',
    'unknown_cost', 'missing_file', 'oversized_file', 'review'])('rejects %s before any output', async kind => {
    const f = await files();
    if (kind.endsWith('_instructions')) writeFileSync(path.join(f.sourceDir, `${kind.startsWith('author') ? 'author' : 'editor'}-instructions.txt`), 'different instructions');
    if (kind.endsWith('_input') || kind.startsWith('wire_')) {
      const role = kind.startsWith('editor') ? 'editor' : 'author', file = path.join(f.sourceDir, `${role}-wire.json`);
      const wire = JSON.parse(readFileSync(file, 'utf8'));
      if (kind.endsWith('_input')) wire.input += ' different';
      if (kind === 'wire_model') wire.model = 'other'; if (kind === 'wire_cap') wire.outputCap -= 1;
      if (kind === 'wire_digest') wire.digest = 'not-a-hash';
      writeFileSync(file, JSON.stringify(wire));
    }
    if (kind === 'unknown_cost') { const file = path.join(f.sourceDir, 'editor-receipt.json'), record = JSON.parse(readFileSync(file, 'utf8')); record.estimatedMicroUsd = null; writeFileSync(file, JSON.stringify(record)); }
    if (kind === 'missing_file') rmSync(path.join(f.sourceDir, 'author-wire.json'));
    if (kind === 'oversized_file') {
      const file = path.join(f.sourceDir, 'author-receipt.json');
      writeFileSync(file, readFileSync(file, 'utf8') + ' '.repeat(2_500_001));
    }
    if (kind === 'review') { f.review.sourceDigest = 'a'.repeat(64); writeFileSync(path.join(f.root, 'reviewer.json'), JSON.stringify(f.review)); }
    expect(await main(f.argv, f.deps)).toBe(1); expect(existsSync(path.join(f.root, 'outputs'))).toBe(false);
    if (kind === 'oversized_file') expect(f.deps.log.mock.calls[f.deps.log.mock.calls.length - 1][0]).toBe('simple_storyboard_diagnostic_file_limit');
    expect(f.deps.log.mock.calls[f.deps.log.mock.calls.length - 1][0]).not.toContain('נועה');
  });
  it.each(['--live', '--unknown', 'duplicate'])('rejects %s arguments before file access', async kind => {
    const f = await files(), argv = [...f.argv];
    if (kind === 'duplicate') argv[2] = '--request'; else argv.push(kind);
    expect(await main(argv, f.deps)).toBe(3); expect(existsSync(path.join(f.root, 'outputs'))).toBe(false);
  });
  it.each(['escape', 'existing', 'symlink_outputs', 'windows_reserved'])('rejects output boundary %s without overwriting', async kind => {
    const f = await files(), argv = [...f.argv];
    if (kind === 'escape') argv[9] = path.join(f.root, 'elsewhere');
    if (kind === 'existing') { mkdirSync(f.output, { recursive: true }); writeFileSync(path.join(f.output, 'keep.txt'), 'preserve'); }
    if (kind === 'symlink_outputs') { mkdirSync(path.join(f.root, 'elsewhere')); symlinkSync(path.join(f.root, 'elsewhere'), path.join(f.root, 'outputs'), 'junction'); }
    if (kind === 'windows_reserved') argv[9] = path.join(f.root, 'outputs', 'CON');
    expect(await main(argv, f.deps)).toBe(1); expect(existsSync(path.join(f.root, 'elsewhere', 'candidate'))).toBe(false);
    expect(f.deps.log.mock.calls[f.deps.log.mock.calls.length - 1][0]).toBe('simple_storyboard_diagnostic_output_boundary');
    if (kind === 'existing') expect(readFileSync(path.join(f.output, 'keep.txt'), 'utf8')).toBe('preserve');
  });
  it('boots in a real Node process with the server-only shim and tsx CJS loader, no Vitest alias', async () => {
    const f = await files(), output = path.join(process.cwd(), 'outputs', `sh_diag_test_${randomUUID()}`); owned.add(output);
    const argv = [...f.argv]; argv[9] = output;
    const reply = spawnSync(process.execPath, ['--require', './scripts/shims/register-server-only.cjs', '--require', 'tsx/cjs',
      './scripts/personal-simple-storyboard.ts', ...argv], { cwd: process.cwd(), encoding: 'utf8', timeout: 15000, windowsHide: true });
    expect(reply.error).toBeUndefined(); expect(reply.signal).toBeNull(); expect(reply.status).toBe(0);
    const manifest = JSON.parse(readFileSync(path.join(output, 'manifest.json'), 'utf8'));
    expect(manifest).toMatchObject({ providerCalls: 0, costUsd: 0, framePackets: 9, runtimeEligible: false });
    expect(JSON.parse(reply.stdout.trim()).optionsFingerprint).toBe(options.fingerprint);
  }, 20000);
});
