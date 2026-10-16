import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import * as images from '../../generate-image';
import { buildStage0MethodBPrompt } from '../../generation-pipeline/stage0-method-b';
import { STYLE_01_AVOIDANCE_NEGATIVE } from '../../style01-gptimage';
import { likenessProbeConfig, planLikenessProbe, runLikenessProbe, anchorRenderText, pagePrompt, anchorReferenceFiles,
  type LikenessProbeConfig } from '../../../scripts/personal-likeness-probe';

// Synthetic inputs only: a solid-colour "photo" and stand-ins for the companion, atlases and control. No real child image is ever used here.
const png = (shade: number, size = 256) => sharp({ create: { width: size, height: size, channels: 3, background: { r: shade, g: 120, b: 255 - shade } } }).png().toBuffer();
const ANSWER = (same: boolean) => ({ referenceChildVisible: true, candidateChildVisible: true, candidateChildCount: 1, comparisonUsable: true,
  sameChildDecision: same ? 'same' : 'different', faceStructure: same ? 'match' : 'mismatch', eyesBrows: same ? 'match' : 'mismatch',
  noseMouth: same ? 'match' : 'mismatch', hairIdentity: same ? 'match' : 'mismatch', distinctiveFeatures: same ? 'match' : 'mismatch' });

let root: string, inputs: string, outputParent: string, file: string, config: LikenessProbeConfig;
const write = (name: string, value: unknown) => { const f = path.join(root, name); writeFileSync(f, typeof value === 'string' ? value : JSON.stringify(value)); return f; };
beforeEach(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'sh_likeness_probe_')); inputs = path.join(root, 'inputs'); outputParent = path.join(root, 'renders');
  for (const d of [inputs, outputParent]) require('node:fs').mkdirSync(d);
  const img = async (name: string, shade: number) => { const f = path.join(inputs, name); writeFileSync(f, await png(shade)); return f; };
  const raw = { version: 'likeness-probe-config/v1', label: 'synthetic-child', photo: await img('photo.png', 10), child: { age: 7, gender: 'boy' },
    companion: await img('companion.png', 60), atlases: { entities: await img('entities.png', 110), locations: await img('locations.png', 160) },
    control: await img('control.png', 210), scene: 'In the green meadow of image 4, the child kneels beside the pool and looks at the fox of image 2; medium shot.',
    outputParent, keyEnvFile: write('key.env', 'OPENAI_API_KEY=sk-synthetic-test-only\n'), capMicroUsd: 700000 };
  file = write('config.json', raw); config = likenessProbeConfig(file);
  let shade = 30;
  vi.spyOn(images, 'generateGPTImage').mockImplementation(async input => {
    const buffer = await png(shade++ % 250, 1024), usage = { input_tokens: 400, output_tokens: 300 };
    input.observeProviderResponse?.({ data: [{ b64_json: buffer.toString('base64') }], usage });
    return { buffer, usage, model: 'gpt-image-2', finalPrompt: input.finalPrompt, hasReferencePhoto: !!input.referenceImages?.length,
      apiMode: 'images.edit', referenceCountRequested: input.referenceImages?.length ?? 0, referenceCountPassed: input.referenceImages?.length ?? 0,
      durationMs: 1, fallbackUsed: false } as never;
  });
  // The control (a different child) is answered "different"; every other comparison "same".
  const controlSha = () => readFileSync(config.control).toString('base64');
  vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init: { body: string }) => {
    const body = JSON.parse(init.body), first = body.messages[0].content.find((c: any) => c.type === 'image_url').image_url.url as string;
    const same = !first.endsWith(controlSha());
    return new Response(JSON.stringify({ model: 'gpt-4o-2024-08-06', choices: [{ message: { content: JSON.stringify(ANSWER(same)) } }],
      usage: { prompt_tokens: 1500, completion_tokens: 120 } }), { status: 200 });
  }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); rmSync(root, { recursive: true, force: true }); });

const renders = () => vi.mocked(images.generateGPTImage).mock.calls.map(([input]) => input);
const identityBodies = () => vi.mocked(globalThis.fetch).mock.calls.map(c => JSON.parse(String((c[1] as { body: string }).body)));
const run = () => runLikenessProbe({ config, signal: new AbortController().signal, log: () => {} });
const out = () => path.join(outputParent, 'likeness-probe-synthetic-child');

describe('likeness probe: a real-photo anchor with production\'s own prompt, one engine page, likeness checks (diagnostic only)', () => {
  it('dry run: production\'s anchor prompt and references, the engine page mode, reservations and cap fit; no key read, nothing written', () => {
    rmSync(config.keyEnvFile);
    const plan = planLikenessProbe(config);
    expect(anchorRenderText(config)).toBe(`${buildStage0MethodBPrompt({ order: { childAge: 7, childGender: 'boy' }, lockedChildDescription:
      'A 7-year-old boy. Hair, skin tone, eyes and face come only from reference image 1 (the photo).', childPhotoDescription: null,
      referenceLayout: 'photo_only_no_template' })}\n\n[AVOID]\n${STYLE_01_AVOIDANCE_NEGATIVE}`);
    expect(plan.anchor.prompt.startsWith('[STYLE 01 ANCHOR — PHOTO-FIRST IDENTITY, NO TEMPLATE]')).toBe(true);
    expect(plan.anchor.prompt).toContain('7-year-old young school-age boy');
    expect(plan.anchor.references).toEqual(['raw_child_photo', 'style01_ref_1', 'style01_ref_2']);
    expect(anchorReferenceFiles(config)[0].file).toBe(config.photo);
    expect(plan.page).toMatchObject({ mode: 'book_identity', references: ['anchor', 'companion', 'atlas_entities', 'atlas_locations'] });
    expect(plan.page.prompt.startsWith('[PERSONAL BOOK REFERENCE ROLES]')).toBe(true);
    expect(plan.page.prompt).toContain(pagePrompt(config));
    expect(plan.reservations.identityEach).toBe(50000);
    expect(plan.largestReservationMicroUsd).toBe(Math.max(plan.reservations.anchor, plan.reservations.page));
    expect(plan).toMatchObject({ fitsCap: true, providerCalls: 0, keyRead: false });
    expect(existsSync(out())).toBe(false);
    expect(renders()).toHaveLength(0);
  });

  it('execute: six calls once, in order (the anchor in production\'s photo mode, the page in the engine mode), checks, viewer and seal', async () => {
    const result = await run();
    expect(result.status).toBe('complete');
    const [anchor, page] = renders();
    expect(renders()).toHaveLength(2);
    expect(anchor).toMatchObject({ referenceMode: 'anchor_photo_style_only', modelOverride: 'gpt-image-2', quality: 'low', size: '1024x1024',
      requireReferenceEdit: true, finalPrompt: anchorRenderText(config) });
    expect(anchor.referenceImages!.map(p => path.basename(p))).toEqual(['photo.png', 'style_1.png', 'style_2.png']);
    expect(page).toMatchObject({ referenceMode: 'book_identity', finalPrompt: pagePrompt(config) });
    expect(page.referenceImages!.map(p => path.basename(p))).toEqual(['anchor.png', 'companion.png', 'atlas_entities.png', 'atlas_locations.png']);
    // Each identity check compares the right pair, the reference first.
    const pairs = identityBodies().map(b => b.messages[0].content.filter((c: any) => c.type === 'image_url').map((c: any) => c.image_url.url.slice(-40)));
    const tail = (name: string) => readFileSync(path.join(out(), 'illustrations', name)).toString('base64').slice(-40);
    expect(pairs).toEqual([[tail('photo.png'), tail('anchor.png')], [tail('control.png'), tail('anchor.png')], [tail('photo.png'), tail('page.png')],
      [tail('anchor.png'), tail('page.png')]]);
    expect(result.results.checks.map(c => [c.step, c.sameChild])).toEqual([['anchor_identity', true], ['control_identity', false],
      ['page_identity', true], ['page_anchor_identity', true]]);
    // Records: every call claimed and settled; spend inside the cap; the run sealed complete with a local viewer.
    const records = readdirSync(path.join(out(), 'paid-stages'));
    for (const step of ['anchor', 'anchor_identity', 'control_identity', 'page', 'page_identity', 'page_anchor_identity'])
      for (const kind of ['claim', 'wire', 'result', 'receipt']) expect(records).toContain(`${step}.${kind}.json`);
    expect(result.spend).toMatchObject({ calls: 6, failed: 0, unknownCost: 0, unknownOutcome: 0 });
    expect(result.spend.cumulativeAccountedMicroUsd).toBeLessThanOrEqual(config.capMicroUsd);
    expect(JSON.parse(readFileSync(path.join(out(), 'sealed.json'), 'utf8'))).toMatchObject({ status: 'complete', runtimeEligible: false });
    expect(readFileSync(path.join(out(), 'probe.html'), 'utf8')).toContain('Local diagnostic only, never published');
  });

  it('privacy: no record holds the ORIGINAL photo\'s bytes; the render receipts DO hold the generated likenesses (the folder is private); never inside the repository', async () => {
    await run();
    const photo64 = readFileSync(config.photo).toString('base64').slice(0, 200);
    for (const name of readdirSync(path.join(out(), 'paid-stages'))) {
      const text = readFileSync(path.join(out(), 'paid-stages', name), 'utf8');
      expect(text.includes(photo64)).toBe(false);
      expect(text.includes('data:image/png;base64,')).toBe(false);
    }
    expect(JSON.stringify(JSON.parse(readFileSync(path.join(out(), 'plan.json'), 'utf8')))).not.toContain(photo64);
    // Disclosure (Codex HOLD 22d93dd9): a render receipt keeps the provider's raw answer, so the generated likeness's bytes are in it.
    const anchorReceipt = JSON.parse(readFileSync(path.join(out(), 'paid-stages', 'anchor.receipt.json'), 'utf8'));
    expect(anchorReceipt.raw.data[0].b64_json).toBe(readFileSync(path.join(out(), 'illustrations', 'anchor.png')).toString('base64'));
    expect(planLikenessProbe(config).privateOutput).toContain('render receipts containing the generated images');
    write('inside.json', { ...JSON.parse(readFileSync(file, 'utf8')), outputParent: path.join(process.cwd(), 'tmp-probe-output') });
    expect(() => likenessProbeConfig(path.join(root, 'inside.json'))).toThrow('likeness_probe_output_in_repository');
  });

  it('one run only; a cap below the largest reservation is refused before any folder or call', async () => {
    await run();
    await expect(run()).rejects.toThrow('likeness_probe_used');
    expect(renders()).toHaveLength(2);
    const small = { ...config, label: 'small-cap', capMicroUsd: 300000 };
    await expect(runLikenessProbe({ config: small, signal: new AbortController().signal, log: () => {} })).rejects.toThrow('likeness_probe_cap');
    expect(existsSync(path.join(outputParent, 'likeness-probe-small-cap'))).toBe(false);
    expect(renders()).toHaveLength(2);
  });

  it('a failed call stops the run, sealed failed with its code: no retry and no later call', async () => {
    const real = vi.mocked(images.generateGPTImage).getMockImplementation()!;
    vi.mocked(images.generateGPTImage).mockImplementation(async input => {
      if (input.referenceMode === 'book_identity') throw Object.assign(Error('provider down'), { status: 500 });
      return real(input);
    });
    await expect(run()).rejects.toThrow('audition_image_provider_failed');
    expect(renders()).toHaveLength(2);
    expect(identityBodies()).toHaveLength(2);
    expect(JSON.parse(readFileSync(path.join(out(), 'sealed.json'), 'utf8'))).toMatchObject({ status: 'failed', code: 'audition_image_provider_failed' });
    expect(existsSync(path.join(out(), 'results.json'))).toBe(false);
  });

  // Codex HOLD 22d93dd9 F1: the protected boundary is the checkout holding this script (and the main checkout it is linked to), never the
  // launch directory. Destinations inside them are refused at configuration AND by the run itself, before any folder, copy or call.
  const sourceRoot = path.resolve(__dirname, '..', '..', '..');
  const mainCheckout = (() => { const g = readFileSync(path.join(sourceRoot, '.git'), 'utf8'); const m = /gitdir:\s*(.+)/.exec(g)!;
    return path.dirname(m[1].trim().replace(/[\\/]worktrees[\\/][^\\/]+$/, '')); })();
  const unique = () => `private-likeness-probe-output-${process.pid}-${Date.now()}`;
  it('F1: a destination inside this checkout or its main checkout is refused whatever the launch directory; normal external output is still admitted', async () => {
    const unrelated = path.join(root, 'unrelated-launch-directory'); require('node:fs').mkdirSync(unrelated);
    vi.spyOn(process, 'cwd').mockReturnValue(unrelated);
    const base = JSON.parse(readFileSync(file, 'utf8'));
    for (const destination of [path.join(sourceRoot, unique()), path.join(mainCheckout, '_review', unique())]) {
      write('inside.json', { ...base, outputParent: destination });
      expect(() => likenessProbeConfig(path.join(root, 'inside.json'))).toThrow('likeness_probe_output_in_repository');
      expect(existsSync(destination)).toBe(false);
    }
    // The ordinary external destination is still admitted from the unrelated launch directory.
    expect(likenessProbeConfig(file).outputParent).toBe(outputParent);
  });
  it('F1: direct execution cannot bypass the boundary: refused before any folder, copy or call', async () => {
    const destination = path.join(sourceRoot, unique());
    await expect(runLikenessProbe({ config: { ...config, outputParent: destination }, signal: new AbortController().signal, log: () => {} }))
      .rejects.toThrow('likeness_probe_output_in_repository');
    expect(existsSync(destination)).toBe(false);
    expect(renders()).toHaveLength(0);
    expect(identityBodies()).toHaveLength(0);
  });

  // Codex re-gate b5ba85a5 (P2): containment is by path SEGMENT. A folder whose name merely begins with ".." ("..private") inside a checkout
  // is inside it; only the ".." segment itself leaves it. Nothing is ever created inside the real checkouts.
  const dotted = (base: string) => [path.join(base, `..private-likeness-qa-${process.pid}`), path.join(base, `..private-likeness-qa-${process.pid}`, 'child')];
  it('segment-aware containment: a "..private" folder (and its child) inside either checkout is refused at configuration and at the run entry', async () => {
    const base = JSON.parse(readFileSync(file, 'utf8'));
    for (const destination of [...dotted(sourceRoot), ...dotted(mainCheckout)]) {
      write('dotted.json', { ...base, outputParent: destination });
      expect(() => likenessProbeConfig(path.join(root, 'dotted.json'))).toThrow('likeness_probe_output_in_repository');
      await expect(runLikenessProbe({ config: { ...config, outputParent: destination }, signal: new AbortController().signal, log: () => {} }))
        .rejects.toThrow('likeness_probe_output_in_repository');
      expect(existsSync(destination)).toBe(false);
    }
    expect(renders()).toHaveLength(0);
    expect(identityBodies()).toHaveLength(0);
  });
  it('segment-aware containment: a sibling sharing a checkout\'s name prefix and an external "..private" folder are outside (admitted; the external one runs)', async () => {
    const base = JSON.parse(readFileSync(file, 'utf8'));
    for (const destination of [`${sourceRoot}-sibling-probe`, `${mainCheckout}-sibling-probe`]) {
      write('sibling.json', { ...base, outputParent: destination });
      expect(likenessProbeConfig(path.join(root, 'sibling.json')).outputParent).toBe(destination);
      expect(existsSync(destination)).toBe(false);
    }
    const external = path.join(root, '..private-external'); require('node:fs').mkdirSync(external);
    const result = await runLikenessProbe({ config: { ...config, outputParent: external }, signal: new AbortController().signal, log: () => {} });
    expect(result.status).toBe('complete');
    expect(existsSync(path.join(external, 'likeness-probe-synthetic-child', 'sealed.json'))).toBe(true);
  });

  // Codex HOLD 22d93dd9 F2: unusable identity evidence stops the run before the next call; a valid answer (including "different child" and
  // a valid "not assessable") is a diagnostic result, recorded, and the run goes on.
  const answerOnce = (content: unknown) => {
    const real = vi.mocked(globalThis.fetch).getMockImplementation()!; let n = 0;
    vi.mocked(globalThis.fetch).mockImplementation(async (...a: any[]) => ++n === 1 ? new Response(JSON.stringify({ model: 'gpt-4o-2024-08-06',
      choices: [{ message: { content: JSON.stringify(content) } }], usage: { prompt_tokens: 1500, completion_tokens: 20 } }), { status: 200 }) : (real as any)(...a));
  };
  it('F2: a malformed first comparison stops at once: one render and one identity call, sealed failed with the pair, reason and known cost', async () => {
    answerOnce({});
    await expect(run()).rejects.toThrow('likeness_probe_identity_unusable');
    expect(renders()).toHaveLength(1);
    expect(identityBodies()).toHaveLength(1);
    const sealed = JSON.parse(readFileSync(path.join(out(), 'sealed.json'), 'utf8'));
    expect(sealed).toMatchObject({ status: 'failed', code: 'likeness_probe_identity_unusable', failedCheck: { step: 'anchor_identity',
      reference: 'photo', candidate: 'anchor', status: 'evidence_unknown', reasonCode: 'malformed', outcome: 'unusable' }, completedChecks: [] });
    const spend = JSON.parse(readFileSync(path.join(out(), 'spend.json'), 'utf8'));
    expect(spend).toMatchObject({ calls: 2, failed: 0, unknownCost: 0, unknownOutcome: 0 });
    expect(spend.newKnownApiMicroUsd).toBeGreaterThan(0);
    for (const name of ['results.json', 'probe.html']) expect(existsSync(path.join(out(), name))).toBe(false);
  });
  it('F2: a valid "not assessable" answer and the different-child control are diagnostic results: recorded, and the run completes', async () => {
    answerOnce({ referenceChildVisible: true, candidateChildVisible: true, candidateChildCount: 1, comparisonUsable: false, sameChildDecision: 'uncertain',
      faceStructure: 'unclear', eyesBrows: 'unclear', noseMouth: 'unclear', hairIdentity: 'match', distinctiveFeatures: 'unclear' });
    const result = await run();
    expect(result.status).toBe('complete');
    expect(result.results.checks.map(c => [c.step, c.reasonCode, c.outcome])).toEqual([['anchor_identity', 'subject_not_assessable', 'not_assessable'],
      ['control_identity', 'different_child', 'decision'], ['page_identity', 'same_child', 'decision'], ['page_anchor_identity', 'same_child', 'decision']]);
    expect(renders()).toHaveLength(2);
  });

  it('configuration: absolute PNG inputs that exist, a bounded cap, an absolute output folder', () => {
    const base = JSON.parse(readFileSync(file, 'utf8'));
    for (const change of [(c: any) => { c.photo = 'relative/photo.png'; }, (c: any) => { c.photo = c.photo.replace(/\.png$/, '.jpg'); },
      (c: any) => { c.capMicroUsd = 2000000; }, (c: any) => { c.outputParent = 'renders'; }, (c: any) => { c.extra = 1; },
      (c: any) => { c.child.gender = 'other'; }])
      { const c = structuredClone(base); change(c); write('bad.json', c); expect(() => likenessProbeConfig(path.join(root, 'bad.json'))).toThrow('likeness_probe_config'); }
    write('missing.json', { ...base, control: path.join(inputs, 'nope.png') });
    expect(() => likenessProbeConfig(path.join(root, 'missing.json'))).toThrow('likeness_probe_input_missing');
  });
});
