import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
const sdk = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('openai', () => ({ default: class { responses = { create: sdk.create }; } }));
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { providerStoryboard, providerReview, withKind } from './storyboard-replan-fixture';
import { STORYBOARD_MOMENTS_VERSION } from '../storyboard-moments';
import { QUALITY_CATEGORIES } from '../../local-preview-quality';
import type { SimpleStoryDraft } from '../simple-story-engine';
import { decodePersonalBookProviderOutput } from '../book-openai';
import * as images from '../../generate-image';
import { CHILD_ANCHOR_REQUIRED_VISIBLE, CHILD_ANCHOR_INSPECTION_VERSION, childAnchorInspectionContextSha } from '../child-anchor-style';
import { auditionReviewRule, type AuditionMeter } from '../../../scripts/personal-simple-book-reviewed-audition';
import { inspectedDesignWire, inspectedStyleWire } from '../../../scripts/personal-child-anchor-judges';
import { planRereview, runRereview, REREVIEW_AMENDMENT, type RereviewConfig, type RereviewEnv } from '../../../scripts/personal-child-anchor-rereview';
import { FRESH_BOOK_CYCLE, freshBookProfileSchema } from '../../../scripts/personal-fresh-book-authority';
import { planFreshBook, runFreshBookText, runFreshBookChild, runFreshBookBook, type FreshBookConfig, type FreshTextTransports }
  from '../../../scripts/personal-fresh-book-driver';

const sha = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const json = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const ORIGINAL = 'C:/GNart/Work/book-renders/child-anchor-probe-r1-anchor-diag-20261018';
const ORIGINAL_CONFIG = 'C:/GNart/Work/Small_Heroes/_review/new-book-anchor-diagnostic-20261018/probe-config.json';
const real = existsSync(path.join(ORIGINAL, 'sealed.json')) && existsSync(ORIGINAL_CONFIG);
const roots: string[] = [];
let f: Awaited<ReturnType<typeof personalStoryboardFixture>>;
beforeEach(async () => {
  sdk.create.mockReset();
  vi.stubGlobal('fetch', vi.fn(() => { throw Error('no network in the fresh-book rehearsal'); }));
  f = await personalStoryboardFixture();
});
afterEach(async () => {
  await new Promise<void>(r => setImmediate(r));
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});
const png = (shade: number, size = 64) => sharp({ create: { width: size, height: size, channels: 3, background: { r: shade, g: 60, b: 90 } } }).png().toBuffer();
const passChecks = () => QUALITY_CATEGORIES.map(category => ({ category, verdict: 'pass', observation: `${category} ok`, correction: '' }));

/** The book's synthetic text providers (the fixture book told with the fox Uri, as the old experiment's rehearsal does). */
function textTransports(): Required<FreshTextTransports> {
  const fox = <T>(value: T): T => JSON.parse(JSON.stringify(value).replace(/דיני/g, 'אורי'));
  const plan = fox(f.result.plan), review = fox(f.review);
  const story: SimpleStoryDraft = { title: plan.title, childGoal: plan.childGoal, companionWant: plan.companionWant, comicPromise: plan.comicPromise,
    ending: plan.ending, pages: fox(f.result.manuscript.pages).map(p => ({ text: p.text + ' נועה ואורי משחקים בציור.' })),
    pageMap: plan.beats.map(({ pageNumber: _n, ...b }) => b), resilienceMoments: plan.resilience.moments.map(({ pageNumber, ...m }) => ({ page: pageNumber, ...m })) };
  const owned = fox(structuredClone(f.draft)) as any;
  delete owned.plan.wardrobe;
  owned.plan.actorAppearance = { child: { role: 'child', clothing: ['red shirt', 'blue shorts', 'teal shoes'] }, companion: { role: 'companion', authority: 'companionVisualAuthority' } };
  const structured = { ...providerStoryboard(withKind(owned)), moments: { version: STORYBOARD_MOMENTS_VERSION, frames: owned.plan.pages.map(() => ({ requirements: [], depicted: null })) } };
  const cli = (output: unknown, usd: number, session?: string) => { const termination = { code: 0, signal: null }, usage = { inputTokens: 100, outputTokens: 100 };
    return { output, usage, estimatedMicroUsd: Math.ceil(usd * 1e6), metadata: { kind: 'cli_reported_estimate_not_invoice', reportedModels: ['claude-opus-5-5'], termination },
      raw: { termination, killConfirmed: true, stopped: false, stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false,
        ...(session ? { session_id: session } : {}), total_cost_usd: usd, modelUsage: { 'claude-opus-5-5': usage }, structured_output: output }) } } as any; };
  return {
    opus: vi.fn(async (_w: any, call: any) => call.stage === 'author' ? cli(structuredClone(story), .23, '11111111-1111-4111-8111-111111111111')
      : cli({ ...structuredClone(story), editorChanges: ['Synthetic only.'] }, .23, '22222222-2222-4222-8222-222222222222')),
    reader: vi.fn(async (wire: any, call: any) => {
      const output = { packetDigest: JSON.parse(call.input).packetDigest, summary: 'Synthetic complete reading, no product acceptance.', findings: [] };
      const raw = { model: wire.model, service_tier: 'default', status: 'completed', output_text: JSON.stringify(output), usage: { input_tokens: 1000, output_tokens: 500 } };
      return { output, usage: { inputTokens: 1000, outputTokens: 500 }, estimatedMicroUsd: 7000, metadata: {}, raw } as any;
    }),
    responses: vi.fn(async (payload: any) => ({ model: payload.model, service_tier: 'default', status: 'completed', created_at: 1792300000,
      usage: { input_tokens: 10000, output_tokens: 5000 }, output_text: JSON.stringify(providerReview(structuredClone(review))) }) as any),
    planner: vi.fn(async (_w: any, call: any) => cli(decodePersonalBookProviderOutput(call, structured), .41)),
  };
}

/** Provider answers at the SDK boundary for the child anchor and the audition (the real adapters, meters and settlement run). */
function providers(opts: { heldPage?: number; anchor?: 'pass' | 'uncertain' | 'repair_once' } = {}) {
  let shade = 40, designs = 0;
  vi.spyOn(images, 'generateGPTImage').mockImplementation(async input => {
    const buffer = await png(shade++ % 250, 1024), usage = { input_tokens: 100, output_tokens: 300 };
    input.observeProviderResponse?.({ data: [{ b64_json: buffer.toString('base64') }], usage });
    return { buffer, usage, model: 'gpt-image-2', finalPrompt: input.finalPrompt, hasReferencePhoto: !!input.referenceImages?.length,
      apiMode: input.referenceImages?.length ? 'images.edit' : 'images.generate', referenceCountRequested: input.referenceImages?.length ?? 0,
      referenceCountPassed: input.referenceImages?.length ?? 0, durationMs: 1, fallbackUsed: false } as never;
  });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ model: 'gpt-4o-2024-08-06', choices: [{ message: { content: JSON.stringify({
    referenceChildVisible: true, candidateChildVisible: true, candidateChildCount: 1, comparisonUsable: true, sameChildDecision: 'same', faceStructure: 'match',
    eyesBrows: 'match', noseMouth: 'match', hairIdentity: 'match', distinctiveFeatures: 'match' }) } }], usage: { prompt_tokens: 1500, completion_tokens: 120 } }), { status: 200 })));
  sdk.create.mockImplementation(async (payload: any) => {
    const text = JSON.parse(payload.input[0].content[0].text), name: string = payload.text.format.name;
    const reply = (value: unknown) => ({ model: 'gpt-6.1-sol', service_tier: 'default', status: 'completed', usage: { input_tokens: 5000, output_tokens: 800 }, output_text: JSON.stringify(value) });
    // 'repair_once': the first candidate's design review finds one known non-identity defect (with its correction); every later one passes.
    const repair = name.includes('design_inspection') && opts.anchor === 'repair_once' && designs++ === 0;
    if (name.includes('design_inspection')) return reply({ candidateSha: text.candidateSha, contextSha: text.contextSha, recipeSha: text.recipeSha,
      inspectionVersion: CHILD_ANCHOR_INSPECTION_VERSION, checks: passChecks().map(c => c.category === 'identity' && opts.anchor === 'uncertain' ? { ...c, verdict: 'uncertain' }
        : repair && c.category === QUALITY_CATEGORIES.find(k => k !== 'identity') ? { ...c, verdict: 'defect', correction: 'Soften the outline.' } : c),
      apparentAge: { requestedAge: text.apparentAge.requestedAge, verdict: 'compatible', observation: 'reads the age', correction: '' },
      visibleEvidence: CHILD_ANCHOR_REQUIRED_VISIBLE.map(aspect => ({ aspect, verdict: 'matched', observation: `${aspect} seen` })), unobservedConditional: [] });
    if (name.startsWith('child_anchor_style')) return reply({ candidateSha: text.candidateSha, contextSha: text.contextSha, recipeSha: text.recipeSha, assessable: true,
      style01Match: true, looksPhotoreal: false, looksPortrait: false, notes: 'watercolor' });
    const context = text.context, page = name === 'personal_audition_pixels_v4';
    const checks = passChecks().map(c => ({ ...c, issues: [] as unknown[] }));
    if (page && context.packet?.pageNumber === opts.heldPage) Object.assign(checks.find(c => c.category === 'environment')!, { verdict: 'defect', correction: 'Repair it.',
      issues: [{ impact: 'continuity', requirement: context.requirementIds.find((id: string) => id !== 'safety'), note: 'a bound continuity defect' }] });
    const landmarks = context.checks?.uniqueLandmarks ?? [];
    const inventory = { objects: landmarks.map((l: any, i: number) => ({ objectId: `o${i + 1}`, region: `${l.id} place`, description: l.id })),
      landmarks: landmarks.map((l: any, i: number) => ({ landmarkId: l.id, candidates: [{ objectId: `o${i + 1}`, association: 'this_landmark', evidence: 'seen',
        featureChecks: l.features.map((x: any) => ({ featureId: x.id, observed: 'matches' })) }] })) };
    return reply({ candidateSha: text.candidateSha, contextSha: text.contextSha, checks, ...(page ? { landmarkInventory: inventory } : {}) });
  });
}

describe.skipIf(!real)('fresh-book driver: one book from admission to the viewer (native stages, synthetic providers)', { timeout: 180_000 }, () => {
  /** A temporary authority root and output parent; the real consumed diagnostic is read only. Round 1 re-review run for real (fake judges). */
  async function setup(opts: { rereview?: 'passed' | 'held' | 'none' } = {}) {
    const root = mkdtempSync(path.join(tmpdir(), 'fresh-driver-')); roots.push(root);
    const authority = path.join(root, 'book-authority'), parent = path.join(root, 'renders'); mkdirSync(authority); mkdirSync(parent);
    for (const n of [REREVIEW_AMENDMENT.originalClaimName, REREVIEW_AMENDMENT.originalOutcomeName]) writeFileSync(path.join(authority, n), '{}');
    const rereview: RereviewConfig = { version: 'child-anchor-rereview-config/v1', round: 1, diagnosticOutput: ORIGINAL, diagnosticConfig: ORIGINAL_CONFIG,
      diagnosticConfigSha256: sha(readFileSync(ORIGINAL_CONFIG)), candidateSha256: '6375db61419767bd120293396cac50b0c20ccc76fc27a333a65c34f2c9419c4f',
      outputParent: parent, keyEnvFile: path.join(root, 'no-key.env') };
    let head = 'f'.repeat(40), clean = true;
    const env = { authorityRoot: authority, head: () => ({ head, branch: 'claude/book-render-20261009', clean }) } satisfies RereviewEnv;
    if (opts.rereview !== 'none') {
      const { grantDraft } = await planRereview(rereview, env), g = path.join(root, 'rereview-grant.json'); writeFileSync(g, JSON.stringify(grantDraft));
      const identity = opts.rereview === 'held' ? 'uncertain' : 'pass';
      await runRereview({ config: rereview, env, grantFile: g, grantSha: sha(readFileSync(g)), signal: new AbortController().signal, log: () => {},
        adapters: (directory: string, meter: AuditionMeter, guard: () => void) => {
          const reply = (wire: unknown, value: unknown) => { const raw = { model: 'gpt-6.1-sol', service_tier: 'default', status: 'completed', output_text: JSON.stringify(value),
            usage: { input_tokens: 2000, output_tokens: 300 } }; const s = auditionReviewRule.settle(wire, { raw }, true);
            return { value, estimatedMicroUsd: s.estimatedMicroUsd, receipt: { raw, estimatedMicroUsd: s.estimatedMicroUsd } }; };
          return { writeImage: async (name: string, bytes: Buffer) => { writeFileSync(path.join(directory, name), bytes, { flag: 'wx' }); return { imageName: name, imageSha: sha(bytes) }; },
            bytesOf: (img: { imageName: string }) => readFileSync(path.join(directory, img.imageName)),
            inspectedStyle: async (step: string, c: any, ctx: any, recipeSha: string) => { guard(); const wire = inspectedStyleWire(c, readFileSync(path.join(directory, c.imageName)), ctx, recipeSha);
              return meter.run(step, wire, 600000, async () => reply(wire, { candidateSha: c.imageSha, contextSha: childAnchorInspectionContextSha(ctx), recipeSha, assessable: true,
                style01Match: true, looksPhotoreal: false, looksPortrait: false, notes: 'watercolor' })); },
            inspectedDesign: async (step: string, c: any, ctx: any, r: any) => { guard(); const wire = await inspectedDesignWire(c, readFileSync(path.join(directory, c.imageName)), ctx, r);
              return meter.run(step, wire, 600000, async () => reply(wire, { candidateSha: c.imageSha, contextSha: childAnchorInspectionContextSha(ctx),
                recipeSha: (JSON.parse((wire as any).input[0].content[0].text)).recipeSha, inspectionVersion: CHILD_ANCHOR_INSPECTION_VERSION,
                checks: passChecks().map(x => x.category === 'identity' ? { ...x, verdict: identity, observation: 'identity' } : x),
                apparentAge: { requestedAge: 6, verdict: 'compatible', observation: 'six', correction: '' },
                visibleEvidence: CHILD_ANCHOR_REQUIRED_VISIBLE.map(aspect => ({ aspect, verdict: 'matched', observation: 'seen' })),
                unobservedConditional: [{ trait: 'One front baby tooth missing, visible when she smiles', condition: 'open_mouth_or_smile', observation: 'lips closed' }] })); } } as any;
        } });
    }
    const rereviewFile = path.join(root, 'rereview-config.json'); writeFileSync(rereviewFile, JSON.stringify(rereview));
    const profile = freshBookProfileSchema.parse({ version: 'fresh-book-profile/v1', cycle: FRESH_BOOK_CYCLE.id,
      child: { name: 'נועה', age: 5, gender: 'girl', design: 'A fictional five-year-old girl with short dark-brown hair, dark brown eyes and light olive skin; natural child proportions.',
        wardrobe: 'a red shirt, blue shorts and teal shoes', fictional: true },
      companion: { id: 'fox_uri', design: 'the registry fox Uri, copper fur and lantern eyes' },
      parentInputs: { about: 'She loves drawing in the garden and inventing games.', wish: 'to enjoy a silly adventure' },
      seed: 'fresh-book-driver-test-seed', request: { ...structuredClone(f.request), companion: { id: 'fox_uri' } }, routes: FRESH_BOOK_CYCLE.routes,
      childAnchor: CHILD_ANCHOR_INSPECTION_VERSION });
    const profileFile = path.join(root, 'profile.json'); writeFileSync(profileFile, JSON.stringify(profile));
    const executable = path.join(root, 'SYNTHETIC-claude.exe'); writeFileSync(executable, 'never spawned');
    const keyEnvFile = path.join(root, 'SYNTHETIC.env'); writeFileSync(keyEnvFile, 'OPENAI_API_KEY=sk-synthetic-test-value-not-a-credential-000\n');
    const config: FreshBookConfig = { version: 'fresh-book-driver-config/v1', profileFile, profileSha256: sha(readFileSync(profileFile)), rereviewConfig: rereviewFile,
      rereviewConfigSha256: sha(readFileSync(rereviewFile)), bookDir: path.join(parent, 'fresh-book'), executable, executableSha256: sha(readFileSync(executable)), keyEnvFile };
    const { grantDraft } = planFreshBook(config, env), grantFile = path.join(root, 'fresh-grant.json'); writeFileSync(grantFile, JSON.stringify(grantDraft));
    const common = { config, env, grantFile, grantSha: sha(readFileSync(grantFile)), signal: new AbortController().signal, log: () => {} };
    return { root, authority, config, env, common, setHead: (h: string) => { head = h; }, setClean: (c: boolean) => { clean = c; } };
  }
  const claims = (dir: string) => readdirSync(dir).filter(n => n.endsWith('.claim.json')).map(n => n.replace('.claim.json', '')).sort();

  it('honest: admission from the settled re-review, one claim, Opus planner, inspected child, samples first, then cover + 1..8; never a second book', async () => {
    const s = await setup(), t = textTransports();
    expect(await runFreshBookText({ ...s.common, transports: t })).toMatchObject({ status: 'review_supported' });
    expect(t.planner).toHaveBeenCalledTimes(1);
    expect(vi.mocked(t.responses).mock.calls.map(c => (c[0] as any).model)).toEqual(['gpt-6.1-sol']);
    expect(claims(path.join(s.config.bookDir, 'text', 'paid-stages'))).toEqual(['comparison', 'final_review', 'storyboard_review']);
    expect(claims(path.join(s.config.bookDir, 'text', 'claude-max-stages'))).toEqual(['author', 'editor', 'storyboard']);
    expect(json(path.join(s.config.bookDir, 'admission.json'))).toMatchObject({ rereviewOutcome: { disposition: 'passed' } });
    providers();
    expect(await runFreshBookChild(s.common)).toMatchObject({ status: 'child_reference_passed' });
    const book = await runFreshBookBook(s.common);
    expect(book.status).toBe('complete');
    expect(book.order.map(o => o.slot)).toEqual(['cover', ...Array.from({ length: 8 }, (_, i) => `page-${i + 1}`)]);
    // The diagnostic subcap re-derived from records (original 59910 + the round), never a passed-in figure; the book's stages beside it.
    expect(book.ledger.diagnosticSettledMicroUsd).toBeGreaterThan(59910);
    expect(book.ledger.stages.map(x => x.name)).toEqual(['text', 'child', 'audition']);
    const grant = json(path.join(s.config.bookDir, 'audition.grant.json'));
    const [a, b] = grant.scope.sample;
    const seq = (step: string) => json(path.join(s.config.bookDir, 'audition', 'paid-stages', `${step}.claim.json`)).seq;
    expect(Math.max(seq(`page_${a}_0`), seq(`page_${b}_0`))).toBeLessThan(seq('page_0_0'));
    expect(existsSync(path.join(s.authority, FRESH_BOOK_CYCLE.outcomeName))).toBe(true);
    // One book: the same or another configuration/folder/grant cannot start again.
    await expect(runFreshBookText({ ...s.common, transports: textTransports() })).rejects.toThrow();
    await expect(runFreshBookText({ ...s.common, config: { ...s.config, bookDir: path.join(s.root, 'renders', 'other') }, transports: textTransports() })).rejects.toThrow();
    expect(readdirSync(path.join(s.root, 'renders')).filter(n => n.startsWith('fresh') || n === 'other')).toEqual(['fresh-book']);
  });

  it('a held sample page stops the paid run before any other page, and the book is held/partial, never complete', async () => {
    const s = await setup();
    await runFreshBookText({ ...s.common, transports: textTransports() });
    providers(); await runFreshBookChild(s.common);
    const grantPages = async () => json(path.join(s.config.bookDir, 'audition.grant.json')).scope.sample as number[];
    // The sample is the engine's pair; hold its second page.
    const { book: compiled } = await import('../../../scripts/personal-simple-book-reviewed-audition').then(m => ({ book: m.loadReviewedStoryboard(s.config.bookDir, process.cwd(),
      m.readReviewedBookLayout(path.join(s.config.bookDir, 'book-layout.json'))).book }));
    const { earliestSameScenePair } = await import('../../../scripts/personal-new-book-experiment');
    const [a, b] = earliestSameScenePair(compiled);
    providers({ heldPage: b });
    const book = await runFreshBookBook(s.common);
    expect(await grantPages()).toEqual([a, b]);
    expect(book.status).not.toBe('complete');
    expect(book.manifestStatus).toBe('held_sample');
    expect(claims(path.join(s.config.bookDir, 'audition', 'paid-stages')).filter(x => /^page_/.test(x)).every(x => new RegExp(`^page_[${a}${b}]_`).test(x))).toBe(true);
    expect(book.order.filter(o => o.disposition === 'pending').length).toBeGreaterThanOrEqual(7);
  });

  it('admission is the settled re-review: missing or held refuses before the claim or the folder', async () => {
    for (const rereview of ['none', 'held'] as const) {
      const s = await setup({ rereview });
      await expect(runFreshBookText({ ...s.common, transports: textTransports() })).rejects.toThrow(rereview === 'none' ? 'fresh_book_admission_missing' : 'fresh_book_admission_held');
      expect([existsSync(path.join(s.authority, FRESH_BOOK_CYCLE.claimName)), existsSync(s.config.bookDir)]).toEqual([false, false]);
    }
  });

  it('the source moving after admission, before the claim, refuses with no claim; a dirty tree at a later call stops before its claim', async () => {
    const s = await setup();
    let reads = 0; const env = { ...s.env, head: () => { const h = s.env.head(); if (++reads === 2) queueMicrotask(() => s.setHead('0'.repeat(40))); return h; } };
    await expect(runFreshBookText({ ...s.common, env, transports: textTransports() })).rejects.toThrow('fresh_book_source_changed');
    expect(existsSync(path.join(s.authority, FRESH_BOOK_CYCLE.claimName))).toBe(false);
    s.setHead('f'.repeat(40));
    const t = textTransports();
    vi.mocked(t.reader).mockImplementationOnce(async (wire: any, call: any) => { s.setClean(false); return textTransports().reader(wire, call, new AbortController().signal); });
    await expect(runFreshBookText({ ...s.common, transports: t })).rejects.toThrow('fresh_book_source_changed');
    // The first reader settled; the change during it stops the next one before its claim.
    expect(claims(path.join(s.config.bookDir, 'text', 'paid-stages'))).toEqual(['final_review']);
    expect(json(path.join(s.authority, FRESH_BOOK_CYCLE.outcomeName))).toMatchObject({ status: 'failed_text' });
  });

  /**
   * The accepted baseline is pinned BEFORE any reader validates it: a change after admission's own reads (here, at its final head read) is
   * never adopted as a new baseline. Each case refuses with no claim, no output and no model or provider call.
   */
  const rereviewStages = (s: Awaited<ReturnType<typeof setup>>) => path.join(path.dirname(s.config.bookDir), 'child-anchor-rereview-r1-anchor-diag-20261018-round1', 'paid-stages');
  const afterAdmission = (s: Awaited<ReturnType<typeof setup>>, change: () => void) => {
    let reads = 0;
    return { ...s.env, head: () => { const state = s.env.head(); if (++reads === 2) change(); return state; } };
  };
  const textMutations: Record<string, (s: Awaited<ReturnType<typeof setup>>) => void> = {
    // Codex's case: only the re-review style answer is withdrawn; request, usage and price stay, so its meter still re-derives.
    'style pass withdrawn': s => { const file = path.join(rereviewStages(s), 'reference_child_style_qa.receipt.json'), receipt = json(file);
      receipt.raw.output_text = JSON.stringify({ ...JSON.parse(receipt.raw.output_text), assessable: false }); writeFileSync(file, JSON.stringify(receipt)); },
    're-review round outcome record': s => writeFileSync(path.join(s.authority, REREVIEW_AMENDMENT.outcomeName(1)), '{"changed":true}'),
    'original diagnostic claim record': s => writeFileSync(path.join(s.authority, REREVIEW_AMENDMENT.originalClaimName), '{"changed":true}'),
    'profile bytes': s => writeFileSync(s.config.profileFile, readFileSync(s.config.profileFile, 'utf8') + ' '),
  };
  it.each(Object.keys(textMutations))('text: a change after admission is not re-adopted (%s): no claim, no folder, no call', async name => {
    const s = await setup(), t = textTransports();
    expect(await import('../../../scripts/personal-fresh-book-authority').then(m => m.assertFreshBookAdmission(json(s.config.rereviewConfig), s.env)))
      .toMatchObject({ disposition: 'passed' });
    await expect(runFreshBookText({ ...s.common, env: afterAdmission(s, () => textMutations[name](s)), transports: t }))
      .rejects.toThrow(/^fresh_book_(roots|profile)_changed$/);
    expect([existsSync(path.join(s.authority, FRESH_BOOK_CYCLE.claimName)), existsSync(s.config.bookDir)]).toEqual([false, false]);
    expect([t.opus, t.reader, t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)).toEqual([0, 0, 0, 0]);
  });
  it('child and book: an earlier stage changed after admission refuses before any folder, write or paid call', async () => {
    const s = await setup();
    await runFreshBookText({ ...s.common, transports: textTransports() });
    providers();
    const render = vi.mocked(images.generateGPTImage);
    await expect(runFreshBookChild({ ...s.common, env: afterAdmission(s, () => writeFileSync(path.join(s.config.bookDir, 'text', 'story.md'), 'changed')) }))
      .rejects.toThrow('fresh_book_roots_changed');
    expect([existsSync(path.join(s.config.bookDir, 'child')), render.mock.calls.length, sdk.create.mock.calls.length]).toEqual([false, 0, 0]);
    // The book stage on a clean second book of the same shape: the child folder moved after admission.
    const b = await setup();
    await runFreshBookText({ ...b.common, transports: textTransports() });
    providers(); await runFreshBookChild(b.common);
    const before = { render: vi.mocked(images.generateGPTImage).mock.calls.length, sdk: sdk.create.mock.calls.length };
    await expect(runFreshBookBook({ ...b.common, env: afterAdmission(b, () => writeFileSync(path.join(b.config.bookDir, 'child', 'context.json'), '{}')) }))
      .rejects.toThrow('fresh_book_roots_changed');
    expect(['audition.grant.json', 'audition'].map(n => existsSync(path.join(b.config.bookDir, n)))).toEqual([false, false]);
    expect(existsSync(path.join(b.authority, 'owner-cycle-20261017-fresh-book-usd7.audition.json'))).toBe(false);
    expect({ render: vi.mocked(images.generateGPTImage).mock.calls.length, sdk: sdk.create.mock.calls.length }).toEqual(before);
  });

  it('the one child correction: the rejected first candidate is an edit input only; the corrected one gets its own style, design and age under the same context', async () => {
    const s = await setup();
    await runFreshBookText({ ...s.common, transports: textTransports() });
    providers({ anchor: 'repair_once' });
    const child = await runFreshBookChild(s.common) as { status: string; candidate: { imageName: string; imageSha: string } };
    expect(child.status).toBe('child_reference_passed');
    const dir = path.join(s.config.bookDir, 'child'), paid = path.join(dir, 'paid-stages');
    expect(claims(paid)).toEqual(['reference_child', 'reference_child_qa', 'reference_child_repair', 'reference_child_repair_qa', 'reference_child_repair_style_qa',
      'reference_child_style_qa']);
    const first = json(path.join(paid, 'reference_child.receipt.json')).candidate, repaired = json(path.join(paid, 'reference_child_repair.receipt.json')).candidate;
    expect(repaired.imageSha).not.toBe(first.imageSha);
    expect(child.candidate).toEqual(repaired);
    expect(json(path.join(dir, 'reference_child_correction_input.json'))).toMatchObject({ candidate: first, authority: 'rejected_edit_input_only_not_canonical' });
    // The correction's render edits the rejected image; its reviews bind the NEW candidate, the same context and the correction's own recipe.
    expect(json(path.join(paid, 'reference_child_repair.wire.json')).references.map((r: any) => r.imageSha)).toEqual([first.imageSha]);
    const context = json(path.join(dir, 'context.json')), contextSha = childAnchorInspectionContextSha(context);
    const asked = (step: string) => JSON.parse(json(path.join(paid, `${step}.wire.json`)).input[0].content[0].text);
    for (const step of ['reference_child_repair_style_qa', 'reference_child_repair_qa']) expect(asked(step)).toMatchObject({ candidateSha: repaired.imageSha, contextSha });
    expect(asked('reference_child_repair_style_qa').recipeSha).not.toBe(asked('reference_child_style_qa').recipeSha);
    expect(asked('reference_child_repair_qa').apparentAge).toMatchObject({ requestedAge: 5 });
    const style = json(path.join(dir, 'reference_child_repair_style_review.json')), design = json(path.join(dir, 'reference_child_repair_design_review.json'));
    expect([style.disposition, design.design, design.apparentAge.verdict]).toEqual(['passed', 'passed', 'compatible']);
    expect(json(path.join(dir, 'reference_child_design_review.json')).design).toBe('repair');
    // The settled-adoption validator (the book stage's admission of the child) admits only the real final candidate.
    const keep = Object.fromEntries(readdirSync(dir, { recursive: true, withFileTypes: false }).map(String).filter(n => n.endsWith('.json'))
      .map(n => [n, readFileSync(path.join(dir, n))]));
    const restore = () => { for (const [n, bytes] of Object.entries(keep)) writeFileSync(path.join(dir, n), bytes); };
    const refusedBook = async () => {
      await expect(runFreshBookBook(s.common)).rejects.toThrow(/^(child_anchor|audition_child)_/);
      expect(['audition.grant.json', 'audition'].map(n => existsSync(path.join(s.config.bookDir, n)))).toEqual([false, false]);
    };
    // (a) the adoption names the rejected first image
    const adoption = json(path.join(dir, 'reference_child_adoption.json'));
    writeFileSync(path.join(dir, 'reference_child_adoption.json'), JSON.stringify({ ...adoption, candidate: first }));
    await refusedBook(); restore();
    // (b) the first candidate's style answer paired with the corrected candidate's design answer
    writeFileSync(path.join(paid, 'reference_child_repair_style_qa.receipt.json'), readFileSync(path.join(paid, 'reference_child_style_qa.receipt.json')));
    await refusedBook(); restore();
    // Honest: the untouched evidence admits the corrected candidate and the book proceeds.
    const book = await runFreshBookBook(s.common);
    expect(json(path.join(s.config.bookDir, 'book-layout.json')).childImage).toBe(repaired.imageName);
    expect(book.ledger.stages.find(x => x.name === 'child')!.calls).toBe(6);
  });

  it('an interrupted audition resumes only with known costs, the same book, grant and start, and the cumulative ledger; an orphan refuses, nothing resets', async () => {
    const s = await setup();
    await runFreshBookText({ ...s.common, transports: textTransports() });
    providers(); await runFreshBookChild(s.common);
    const out = path.join(s.config.bookDir, 'audition'), paid = path.join(out, 'paid-stages');
    const start = path.join(s.authority, 'owner-cycle-20261017-fresh-book-usd7.audition.json');
    // Interrupt before a paid claim (the guard refuses once the first sample page has settled): nothing is in flight, every cost is known.
    let stopped = false;
    const interrupted = { ...s.env, head: () => { const h = s.env.head();
      if (existsSync(paid) && readdirSync(paid).some(n => /^page_\d+_0\.result\.json$/.test(n))) stopped = true;
      return stopped ? { ...h, clean: false } : h; } };
    await expect(runFreshBookBook({ ...s.common, env: interrupted })).rejects.toThrow('fresh_book_source_changed');
    expect(existsSync(path.join(s.authority, FRESH_BOOK_CYCLE.outcomeName))).toBe(false);
    const firstClaims = claims(paid), grantBytes = readFileSync(path.join(s.config.bookDir, 'audition.grant.json')), startBytes = readFileSync(start);
    expect(firstClaims.some(n => /^page_/.test(n))).toBe(true);
    // A fresh start of the same book is refused (the grant, start and folder exist); it never resets them.
    await expect(runFreshBookBook(s.common)).rejects.toThrow('fresh_book_audition_used');
    // An orphan (claimed, never settled: unknown cost) refuses the resume before any new claim; it stays.
    const orphan = path.join(paid, 'orphan.claim.json');
    writeFileSync(orphan, JSON.stringify({ step: 'page_9_0', seq: 999 }));
    await expect(runFreshBookBook({ ...s.common, resume: true })).rejects.toThrow();
    expect(claims(paid)).toEqual([...firstClaims, 'orphan'].sort());
    expect(readdirSync(out).filter(n => /^resume-/.test(n))).toEqual([]);
    rmSync(orphan);
    // Known costs: the same grant and start (unchanged bytes), the earlier claims kept, the ledger cumulative across both runs.
    const book = await runFreshBookBook({ ...s.common, resume: true });
    expect(book.status).toBe('complete');
    expect([readFileSync(path.join(s.config.bookDir, 'audition.grant.json')).equals(grantBytes), readFileSync(start).equals(startBytes)]).toEqual([true, true]);
    const after = claims(paid);
    expect(firstClaims.every(n => after.includes(n))).toBe(true);
    expect(after.some(n => /^r1_/.test(n))).toBe(true);
    const audition = book.ledger.stages.find(x => x.name === 'audition')!;
    expect(audition.calls).toBe(after.length);
    expect(book.ledger.bookKnownMicroUsd).toBe(book.ledger.stages.reduce((n, x) => n + x.knownMicroUsd, 0));
  });

  it('an orphan claim (unknown cost) halts every later stage; it is never reset', async () => {
    const s = await setup();
    await runFreshBookText({ ...s.common, transports: textTransports() });
    writeFileSync(path.join(s.config.bookDir, 'text', 'paid-stages', 'orphan.claim.json'), JSON.stringify({ step: 'final_review', seq: 99 }));
    providers();
    await expect(runFreshBookChild(s.common)).rejects.toThrow();
    expect(existsSync(path.join(s.config.bookDir, 'child'))).toBe(false);
  });
});
