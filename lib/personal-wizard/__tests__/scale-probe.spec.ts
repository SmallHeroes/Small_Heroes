import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
const sdk = vi.hoisted(() => ({ create: vi.fn(), clients: [] as Record<string, unknown>[] }));
vi.mock('openai', () => ({ default: class { responses = { create: sdk.create }; constructor(options: Record<string, unknown> = {}) { sdk.clients.push(options); } } }));
import * as images from '../../generate-image';
import { previewSha } from '../../local-story-preview';
import { QUALITY_CATEGORIES } from '../../local-preview-quality';
import { auditionRenderRule, auditionReviewRule, renderMaximum } from '../../../scripts/personal-simple-book-reviewed-audition';
import { readScaleProbeConfig, planScaleProbe, runScaleProbe, controlOutcome, c1Gate, stageSteps, scaleProbeMeterRules, probePagePrompt,
  SCALE_PROBE_JUDGE_INSTRUCTION, type ScaleProbeConfig, type MeasuredSubject } from '../../../scripts/personal-scale-probe';

// Synthetic, fictional inputs only (solid colours and a pattern atlas); every provider is a stub. Nothing here reads a key or a real book.
const solid = (shade: number, width = 256, height = width) => sharp({ create: { width, height, channels: 3, background: { r: shade, g: 140, b: 255 - shade } } }).png().toBuffer();
const pattern = (width: number, height: number) => {
  const raw = Buffer.alloc(width * height * 3); for (let i = 0; i < raw.length; i++) raw[i] = (i * 37 + (i >> 11)) % 251;
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
};
const BAND = { version: 'scale-band-input/v1', marks: [{ id: 'post', label: 'child height', ratio: 1 }, { id: 'grandma', label: 'grandma', ratio: 3 },
  { id: 'companion', label: 'companion', ratio: 0.42 }, { id: 'bumbum', label: 'bumbum', ratio: 0.5 }, { id: 'silver_stone', label: 'silver_stone', ratio: 0.12 }] };
const scene = (s: string) => ({ scene: `In the green valley meadow of image 4, ${s}`, camera: 'wide shot at the child\'s eye level, level horizon.' });
const APPROVAL = { owner: 'Guy', quote: 'synthetic test approval', recordedAt: '2026-10-17T18:00:00+03:00', recordedBy: 'scale-probe spec' };
const S = (id: string, visibility: MeasuredSubject['visibility'], baseY: number | null, topY: number | null): MeasuredSubject => ({ id, visibility, baseY, topY, evidence: `${id} positions` });
type Scenario = (control: string, arm: string) => { rs: 'pass' | 'defect' | 'uncertain'; subjects: MeasuredSubject[]; usage?: { input_tokens: number; output_tokens: number } };
/** O1 by default: baseline Grandma 1.2 child heights with a size defect, M1 Grandma 2.88 with a pass; S2's controls all realised. */
const DEFAULT: Scenario = (control, arm) => control === 'c1'
  ? arm === 'band' ? { rs: 'pass', subjects: [S('child', 'whole', .9, .65), S('grandma', 'whole', .9, .18)] } : { rs: 'defect', subjects: [S('child', 'whole', .9, .65), S('grandma', 'whole', .9, .6)] }
  : control === 'c2' ? { rs: 'pass', subjects: [S('child', 'whole', .92, .6), S('grandma', 'whole', .6, .2)] }
  : control === 'c3' ? { rs: 'pass', subjects: [S('child', 'whole', .92, .55), S('grandma', 'cropped_by_frame', .92, 0)] }
  : { rs: 'pass', subjects: [S('child', 'whole', .9, .5), S('bumbum', 'whole', .9, .7), S('silver_stone', 'whole', .9, .86)] };

let root: string, outputParent: string, file: string, rawConfig: any, config: ScaleProbeConfig, configSha256: string;
let renderUsage: { input_tokens: number; output_tokens: number } | null;
const armOf = new Map<string, string>();
const write = (name: string, value: unknown) => { const f = path.join(root, name); writeFileSync(f, typeof value === 'string' ? value : JSON.stringify(value)); return f; };
const judgeWith = (scenario: Scenario) => sdk.create.mockImplementation(async (payload: any) => {
  const text = JSON.parse(payload.input[0].content[0].text), s = scenario(text.context.packet.control, armOf.get(text.candidateSha)!);
  const subject = text.context.scaleProbe.subjects[1];
  const checks = QUALITY_CATEGORIES.map(category => category !== 'relative_scale' || s.rs === 'pass'
    ? { category, verdict: 'pass', observation: `${category} ok`, correction: '', issues: [] }
    : { category, verdict: s.rs, observation: 'the sizes differ', correction: s.rs === 'defect' ? 'Redraw at the declared size.' : '',
      issues: [{ impact: 'continuity', requirement: `size:${subject}`, note: 'size note' }] });
  return { model: 'gpt-6.1-sol', service_tier: 'default', status: 'completed', usage: s.usage ?? { input_tokens: 5000, output_tokens: 800 },
    output_text: JSON.stringify({ candidateSha: text.candidateSha, contextSha: text.contextSha, scaleMeasurement: { subjects: s.subjects }, checks,
      landmarkInventory: { objects: [], landmarks: [] } }) };
});
beforeEach(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'sh_scale_probe_')); outputParent = path.join(root, 'renders');
  const inputs = path.join(root, 'inputs'); mkdirSync(inputs); mkdirSync(outputParent);
  const img = (name: string, data: Buffer) => { const f = path.join(inputs, name); writeFileSync(f, data); return { file: f, sha256: previewSha(data) }; };
  rawConfig = { version: 'scale-probe-config/v1', label: 'synthetic-scale',
    inputs: { child: img('child.png', await solid(30)), companion: img('companion.png', await solid(90, 256, 384)), entitiesAtlas: img('atlas.png', await pattern(1024, 1024)),
      locations: img('locations.png', await solid(160)) },
    referenceStatus: { entities: { status: 'approved_reference', knownFlaws: [] }, locations: { status: 'diagnostic_candidate', knownFlaws: ['One pool is drawn twice.'] } },
    child: { name: 'Itai', description: 'a 5-year-old boy', clothing: 'Plain sea-blue shirt; mustard trousers; dark-teal shoes.' }, companion: { name: 'Uri' },
    cast: [{ id: 'grandma', design: 'Huge rounded gray boulder, three child heights tall, broad nose, small eyes and thick moss hair; no costume.' },
      { id: 'bumbum', design: 'Round slate-gray boulder approximately half the child\'s standing height, with tiny eyes.' },
      { id: 'silver_stone', design: 'Small pocket-sized dark-gray rounded stone with one diagonal silver stripe and tiny eyes.' }],
    band: BAND,
    controls: { c1: scene('the child stands right beside grandma, both whole at one depth.'), c2: scene('grandma rests far behind the child.'),
      c3: scene('the child stands beside grandma; her top is cut by the frame.'), c4: scene('bumbum and silver_stone stand beside the child.') },
    criteria: { c1: { subject: 'grandma', accept: { min: 2.4, max: 3.6 }, sameDepthMax: 0.05 }, c2: { subject: 'grandma', behindMin: 0.15, consistent: { min: 1, max: 3 } },
      c3: { subject: 'grandma', visibleAbove: 1.5, sameDepthMax: 0.05, croppedTopMax: 0.02 },
      c4: { subjects: [{ id: 'bumbum', accept: { min: 0.35, max: 0.65 } }, { id: 'silver_stone', accept: { min: 0.06, max: 0.2 } }], sameDepthMax: 0.05 } },
    costAssumption: { renderMicroUsd: 75000, reviewMicroUsd: 90000, source: 'synthetic' }, readOnly: [inputs],
    outputParent, keyEnvFile: write('key.env', 'OPENAI_API_KEY=sk-synthetic-test-only\n'), capMicroUsd: 2000000 };
  file = write('config.json', rawConfig); ({ config, configSha256 } = readScaleProbeConfig(file));
  renderUsage = { input_tokens: 400, output_tokens: 300 };
  let shade = 20;
  vi.spyOn(images, 'generateGPTImage').mockImplementation(async input => {
    const buffer = await solid(shade++ % 250, 1024), usage = renderUsage;
    armOf.set(previewSha(buffer), path.basename(input.referenceImages![2]) === 'canvas_band.png' ? 'band' : 'baseline');
    input.observeProviderResponse?.({ data: [{ b64_json: buffer.toString('base64') }], usage });
    return { buffer, usage, model: 'gpt-image-2', finalPrompt: input.finalPrompt, hasReferencePhoto: true, apiMode: 'images.edit',
      referenceCountRequested: 4, referenceCountPassed: 4, durationMs: 1, fallbackUsed: false } as never;
  });
  judgeWith(DEFAULT);
});
afterEach(() => { vi.restoreAllMocks(); sdk.create.mockReset(); sdk.clients.length = 0; armOf.clear(); rmSync(root, { recursive: true, force: true }); });

const out = () => path.join(outputParent, 'scale-probe-synthetic-scale');
const json = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
const grant = (over: Record<string, unknown> = {}) => writeFileSync(path.join(outputParent, 'scale-probe-synthetic-scale.grant.json'), JSON.stringify({
  version: 'scale-probe-grant/v1', label: 'synthetic-scale', configSha256, capMicroUsd: 2000000, maxCalls: 16, s1Calls: 4, approval: APPROVAL, ...over }));
const ownerGo = (over: Record<string, unknown> = {}) => writeFileSync(path.join(out(), 's2-owner-go.json'), JSON.stringify({ version: 'scale-probe-owner-go/v1',
  label: 'synthetic-scale', s1SealSha256: previewSha(readFileSync(path.join(out(), 's1.sealed.json'))), gate: 'O1_candidate_positive', approval: APPROVAL, ...over }));
const run = (stage: 'S1' | 'S2', c = config, sha = configSha256) => runScaleProbe({ config: c, configSha256: sha, stage, signal: new AbortController().signal, log: () => {} });
const renders = () => vi.mocked(images.generateGPTImage).mock.calls.map(([input]) => input);
const reviews = () => sdk.create.mock.calls.map(([payload]) => JSON.parse(JSON.stringify(payload)));
const S1_STEPS = ['c1_baseline', 'c1_baseline_qa', 'c1_band', 'c1_band_qa'];

describe('scale probe (M1 S0): A/B parity, one ledger, the C1 gate and the owner-locked S2 (synthetic providers only)', () => {
  it('dry run: S1 4 calls, S2 12, 16 in all; exact reservations; the one difference stated; nothing written, no key read, no provider call', async () => {
    rmSync(config.keyEnvFile);
    const plan = await planScaleProbe(config, configSha256);
    expect(plan.calls).toEqual({ S1: S1_STEPS, S2: stageSteps('S2'), total: 16 });
    expect(stageSteps('S2')).toEqual(['c2', 'c3', 'c4'].flatMap(c => [`${c}_baseline`, `${c}_baseline_qa`, `${c}_band`, `${c}_band_qa`]));
    for (const c of plan.controls) {
      expect(c.renderReservationMicroUsd).toBe(renderMaximum('x'.repeat(c.finalPromptBytes), 4));
      expect(c.reviewReservationMicroUsd).toBe(600000);
      expect(c.prompt).toBe(probePagePrompt(config, c.id));
    }
    expect(plan.references.render.baseline.map(r => r.imageName)).toEqual(['child.png', 'companion.png', 'canvas_baseline.png', 'locations.png']);
    expect(plan.references.render.band.map(r => r.imageName)).toEqual(['child.png', 'companion.png', 'canvas_band.png', 'locations.png']);
    expect(plan.references.judge.map(r => r.imageName)).toEqual(['child.png', 'companion.png', 'atlas_plain.png', 'locations.png']);
    expect(plan.canvases).toMatchObject({ width: 1024, height: 1344, atlasPixelsIdenticalInBoth: true, bandAreaIsTheBand: true });
    expect(plan.band.geometry.unitPx).toBe(85);
    // Sequential admission: under the assumed costs all 16 fit; if every call cost its whole reservation the fourth claim would not.
    expect(plan.projections.assumed).toMatchObject({ calls: 16, stopsBefore: null });
    expect(plan.projections.everyCallAtItsReservation).toMatchObject({ calls: 3, stopsBefore: 'c1_band_qa' });
    expect(plan).toMatchObject({ capMicroUsd: 2000000, maxCalls: 16, providerCalls: 0, keyRead: false, written: [], state: { outputExists: false, grantExists: false } });
    expect(readdirSync(outputParent)).toEqual([]);
    expect(renders()).toHaveLength(0);
    expect(sdk.create).not.toHaveBeenCalled();
  });

  it('S1: four calls once, in order; the arms differ only in the render\'s image 3; the judge request is identical apart from the candidate', async () => {
    grant();
    const result = await run('S1');
    expect(result).toMatchObject({ status: 'complete', gate: { gate: 'O1_candidate_positive', pauseForOwner: true } });
    const [base, band] = renders();
    expect(renders()).toHaveLength(2);
    expect(base.finalPrompt).toBe(probePagePrompt(config, 'c1'));
    expect(band.finalPrompt).toBe(base.finalPrompt);
    expect(base).toMatchObject({ referenceMode: 'book_identity', modelOverride: 'gpt-image-2', quality: 'low', size: '1024x1024' });
    expect(base.referenceImages!.map(p => path.basename(p))).toEqual(['child.png', 'companion.png', 'canvas_baseline.png', 'locations.png']);
    expect(band.referenceImages!.map(p => path.basename(p))).toEqual(['child.png', 'companion.png', 'canvas_band.png', 'locations.png']);
    const parts = (p: any) => { const [text, ...imgs] = p.input[0].content;
      return { rest: { ...p, input: null }, text: { ...JSON.parse(text.text), candidateSha: null }, candidate: imgs.slice(0, 5), refs: imgs.slice(5) }; };
    const [a, b] = reviews().map(parts);
    expect(reviews()).toHaveLength(2);
    expect(a.rest).toEqual(b.rest);
    expect(a.text).toEqual(b.text);
    expect(a.refs).toEqual(b.refs);
    expect(a.candidate).not.toEqual(b.candidate);
    expect(a.rest).toMatchObject({ model: 'gpt-6.1-sol', instructions: SCALE_PROBE_JUDGE_INSTRUCTION, text: { format: { name: 'scale_probe_pixels_v1' } } });
    // The judge's image 3 is the plain atlas (never a canvas), in both arms.
    expect(a.refs[2].image_url).toBe(`data:image/png;base64,${readFileSync(config.inputs.entitiesAtlas.file).toString('base64')}`);
    const plan = json(path.join(out(), 'plan.json'));
    expect(Buffer.byteLength(reviews()[0].input[0].content[0].text)).toBe(plan.controls[0].judgeTextBytes);
    // The folder's inputs and canvases are the plan's, by hash; the review wires hold digests, never image bytes.
    for (const img of [...plan.references.render.baseline, plan.references.render.band[2], plan.references.judge[2]])
      expect(previewSha(readFileSync(path.join(out(), 'illustrations', img.imageName)))).toBe(img.imageSha);
    for (const name of readdirSync(path.join(out(), 'paid-stages')).filter(n => n.endsWith('_qa.wire.json')))
      expect(readFileSync(path.join(out(), 'paid-stages', name), 'utf8')).not.toContain('data:image/png;base64,');
    const seal = json(path.join(out(), 's1.sealed.json'));
    expect(seal).toMatchObject({ stage: 'S1', status: 'complete', gate: 'O1_candidate_positive', pauseForOwner: true, configSha256, runtimeEligible: false });
    expect(seal.ledger.map((l: any) => l.step)).toEqual(S1_STEPS);
    expect(seal.spend).toMatchObject({ calls: 4, maxCalls: 4, failed: 0, unknownCost: 0, unknownOutcome: 0 });
    expect(seal.spend.cumulativeAccountedMicroUsd).toBeLessThanOrEqual(2000000);
    const arms = json(path.join(out(), 's1.results.json')).controls[0].arms;
    expect(arms.baseline.outcome).toMatchObject({ outcome: 'fail', reason: 'below_range', relativeScale: 'defect' });
    expect(arms.band.outcome).toMatchObject({ outcome: 'pass', reason: 'inside_range', relativeScale: 'pass' });
    expect(arms.band.outcome.ratios.grandma).toBeCloseTo(2.88, 6);
    expect(readFileSync(path.join(out(), 's1-viewer.html'), 'utf8')).toContain('שלב 2 ירוץ רק אם תאשר במפורש');
    expect(existsSync(path.join(out(), 's2.started.json'))).toBe(false);
  });

  it('S1 refusals before any folder or call: no grant, a grant for other bytes or another cap, a second S1, an output inside a checkout', async () => {
    await expect(run('S1')).rejects.toThrow('scale_probe_grant');
    for (const over of [{ configSha256: 'f'.repeat(64) }, { capMicroUsd: 3000000 }, { maxCalls: 20 }, { approval: { ...APPROVAL, owner: 'Codex' } }]) {
      grant(over); await expect(run('S1')).rejects.toThrow('scale_probe_grant');
    }
    expect(existsSync(out())).toBe(false);
    expect(renders()).toHaveLength(0);
    grant(); await run('S1');
    await expect(run('S1')).rejects.toThrow('scale_probe_used');
    expect(renders()).toHaveLength(2);
    expect(reviews()).toHaveLength(2);
    const sourceRoot = path.resolve(__dirname, '..', '..', '..'), inside = path.join(sourceRoot, `scale-probe-qa-${process.pid}`);
    expect(() => readScaleProbeConfig(write('inside.json', { ...rawConfig, outputParent: inside }))).toThrow('scale_probe_output_in_repository');
    await expect(run('S1', { ...config, outputParent: inside })).rejects.toThrow('scale_probe_output_in_repository');
    expect(existsSync(inside)).toBe(false);
    // The held book (a declared read-only folder) is never written: an output inside it refuses at configuration and at the run's entry.
    const held = rawConfig.readOnly[0];
    expect(() => readScaleProbeConfig(write('held.json', { ...rawConfig, outputParent: held }))).toThrow('scale_probe_output_in_read_only');
    await expect(run('S1', { ...config, outputParent: held })).rejects.toThrow('scale_probe_output_in_read_only');
    expect(readdirSync(held).sort()).toEqual(['atlas.png', 'child.png', 'companion.png', 'locations.png']);
    expect(() => readScaleProbeConfig(write('undeclared.json', { ...rawConfig, readOnly: [path.join(root, 'elsewhere')] }))).toThrow('scale_probe_config');
  });

  it('S2 is locked: without the owner\'s go, with a go for another seal, or after a gate other than O1 it refuses; never on a judge pass alone', async () => {
    grant(); await run('S1');
    await expect(run('S2')).rejects.toThrow('scale_probe_owner_go');
    for (const over of [{ s1SealSha256: 'e'.repeat(64) }, { gate: 'O2_both_pass' }, { label: 'other-label' }, { approval: { ...APPROVAL, quote: '' } }]) {
      ownerGo(over); await expect(run('S2')).rejects.toThrow('scale_probe_owner_go');
    }
    expect(renders()).toHaveLength(2);
    expect(reviews()).toHaveLength(2);
    expect(existsSync(path.join(out(), 's2.started.json'))).toBe(false);
    // A judge "pass" on both arms is O2: it stops, and a go file cannot open S2.
    rmSync(out(), { recursive: true });
    judgeWith((control, arm) => control === 'c1' ? { rs: 'pass', subjects: [S('child', 'whole', .9, .65), S('grandma', 'whole', .9, .18)] } : DEFAULT(control, arm));
    expect((await run('S1')).gate).toEqual({ gate: 'O2_both_pass', pauseForOwner: false });
    ownerGo();
    await expect(run('S2')).rejects.toThrow('scale_probe_s1_gate');
    expect(renders()).toHaveLength(4);
  });

  it('S2 with the owner\'s go: twelve more calls on the SAME ledger (16 in all), an outcome per control, and only once', async () => {
    grant(); await run('S1'); ownerGo();
    const result = await run('S2');
    expect(result.status).toBe('complete');
    expect(renders()).toHaveLength(8);
    expect(reviews()).toHaveLength(8);
    const seal = json(path.join(out(), 's2.sealed.json'));
    expect(seal.ledger.map((l: any) => l.step)).toEqual([...S1_STEPS, ...stageSteps('S2')]);
    expect(seal.spend).toMatchObject({ calls: 16, maxCalls: 16, failed: 0, unknownCost: 0, unknownOutcome: 0 });
    expect(seal.spend.cumulativeAccountedMicroUsd).toBeLessThanOrEqual(2000000);
    expect(json(path.join(out(), 's2.results.json')).controls.map((c: any) => [c.control, c.arms.baseline.outcome.outcome, c.arms.band.outcome.outcome]))
      .toEqual([['c2', 'consistent', 'consistent'], ['c3', 'pass', 'pass'], ['c4', 'pass', 'pass']]);
    for (let i = 2; i < 8; i += 2) expect(renders()[i].finalPrompt).toBe(renders()[i + 1].finalPrompt);
    await expect(run('S2')).rejects.toThrow('scale_probe_s2_used');
    expect(renders()).toHaveLength(8);
  });

  it('S2 refuses a changed configuration and a ledger that no longer matches S1\'s seal, before its start record or any call', async () => {
    grant(); await run('S1'); ownerGo();
    const changed = structuredClone(rawConfig); changed.controls.c2.scene += ' Calm.';
    const re = readScaleProbeConfig(write('changed.json', changed));
    await expect(run('S2', re.config, re.configSha256)).rejects.toThrow('scale_probe_plan_changed');
    unlinkSync(path.join(out(), 'paid-stages', 'c1_band_qa.result.json'));
    await expect(run('S2')).rejects.toThrow('scale_probe_ledger');
    expect(renders()).toHaveLength(2);
    expect(existsSync(path.join(out(), 's2.started.json'))).toBe(false);
  });

  it('an unknown cost stops at once and keeps its reservation: no review, no second render; S1 sealed failed with the O4 gate', async () => {
    grant(); renderUsage = null;
    await expect(run('S1')).rejects.toThrow('audition_unknown_cost');
    expect(renders()).toHaveLength(1);
    expect(reviews()).toHaveLength(0);
    const seal = json(path.join(out(), 's1.sealed.json')), plan = json(path.join(out(), 'plan.json'));
    expect(seal).toMatchObject({ status: 'failed', code: 'audition_unknown_cost', gate: 'O4_unusable', pauseForOwner: false });
    expect(seal.spend).toMatchObject({ calls: 1, unknownCost: 1, newKnownApiMicroUsd: 0, reservedUnsettledMicroUsd: plan.controls[0].renderReservationMicroUsd });
  });

  it('a refused claim on the $2 ledger stops S2 honestly: sealed stopped, nothing claimed after the refusal, nothing retried', async () => {
    grant(); await run('S1'); ownerGo();
    judgeWith((control, arm) => ({ ...DEFAULT(control, arm), usage: { input_tokens: 150000, output_tokens: 0 } }));
    await expect(run('S2')).rejects.toThrow('audition_budget_exhausted');
    const seal = json(path.join(out(), 's2.sealed.json')), plan = json(path.join(out(), 'plan.json'));
    expect(seal).toMatchObject({ stage: 'S2', status: 'stopped', code: 'audition_budget_exhausted' });
    expect(seal.spend.calls).toBeLessThan(16);
    expect(renders().length + reviews().length).toBe(seal.spend.calls);
    const refusedStep = [...S1_STEPS, ...stageSteps('S2')][seal.spend.calls];
    const reservation = refusedStep.endsWith('_qa') ? 600000 : plan.controls.find((c: any) => refusedStep.startsWith(`${c.id}_`)).renderReservationMicroUsd;
    expect(seal.spend.cumulativeAccountedMicroUsd + reservation).toBeGreaterThan(2000000);
    expect(existsSync(path.join(out(), 'paid-stages', `${refusedStep}.claim.json`))).toBe(false);
    expect(seal.completed.length).toBeGreaterThan(0);
  });

  it('an unusable review (a wrong measurement list, or a review bound to another image) stops S1 before any further call', async () => {
    grant();
    judgeWith((control, arm) => ({ ...DEFAULT(control, arm), subjects: [S('grandma', 'whole', .9, .6), S('child', 'whole', .9, .65)] }));
    await expect(run('S1')).rejects.toThrow('scale_probe_review_unusable');
    expect(json(path.join(out(), 's1.sealed.json'))).toMatchObject({ status: 'failed', code: 'scale_probe_review_unusable', detail: 'scale_probe_measurement', gate: 'O4_unusable' });
    expect([renders().length, reviews().length]).toEqual([1, 1]);
    rmSync(out(), { recursive: true });
    const real = sdk.create.getMockImplementation()!;
    sdk.create.mockImplementation(async (payload: any) => { const r: any = await real(payload); const answer = JSON.parse(r.output_text);
      return { ...r, output_text: JSON.stringify({ ...answer, candidateSha: 'a'.repeat(64) }) }; });
    await expect(run('S1')).rejects.toThrow('scale_probe_review_unusable');
    expect(json(path.join(out(), 's1.sealed.json'))).toMatchObject({ code: 'scale_probe_review_unusable', detail: 'quality_evidence_binding' });
    expect([renders().length, reviews().length]).toEqual([2, 2]);
  });

  it('outcomes: the two-sided C1 range, depth and visibility rules, the agreement with the categorical verdict, and the C1 gate table', () => {
    const child = S('child', 'whole', .75, .5);
    const c1 = (ratio: number, rs: 'pass' | 'defect' | 'uncertain', g: Partial<MeasuredSubject> = {}) =>
      controlOutcome(config, 'c1', [child, { ...S('grandma', 'whole', .75, .75 - ratio * .25), ...g }], rs);
    expect([c1(2.41, 'pass'), c1(3.0, 'pass'), c1(3.59, 'pass')].map(o => o.outcome)).toEqual(['pass', 'pass', 'pass']);
    expect([c1(2.39, 'defect'), c1(3.61, 'defect')].map(o => [o.outcome, o.reason])).toEqual([['fail', 'below_range'], ['fail', 'above_range']]);
    expect([c1(3.0, 'defect'), c1(1.2, 'pass')].map(o => o.reason)).toEqual(['judge_verdict_disagrees_with_measurement', 'judge_verdict_disagrees_with_measurement']);
    expect(c1(3.0, 'uncertain')).toMatchObject({ outcome: 'inconclusive', reason: 'judge_uncertain' });
    expect(controlOutcome(config, 'c1', [child, S('grandma', 'whole', .75, 0)], 'pass', true)).toMatchObject({ outcome: 'inconclusive', reason: 'safety_blocked' });
    expect(controlOutcome(config, 'c4', [child, S('bumbum', 'whole', .75, .625), S('silver_stone', 'whole', .75, .725)], 'pass', true).outcome).toBe('not_counted');
    expect(c1(3.0, 'pass', { visibility: 'cropped_by_frame' })).toMatchObject({ outcome: 'inconclusive', reason: 'subject_not_whole' });
    expect(c1(3.0, 'pass', { baseY: .69, topY: .69 - .75 })).toMatchObject({ outcome: 'inconclusive' });
    expect(controlOutcome(config, 'c1', [child, S('grandma', 'whole', .69, .05)], 'pass')).toMatchObject({ outcome: 'inconclusive', reason: 'bases_not_at_one_depth' });
    expect(controlOutcome(config, 'c1', [S('child', 'occluded', .75, .5), S('grandma', 'whole', .75, .05)], 'pass').reason).toBe('child_not_whole');
    const c2 = (gBase: number, ratio: number) => controlOutcome(config, 'c2', [child, S('grandma', 'whole', gBase, gBase - ratio * .25)], 'pass');
    expect([c2(.5, 3.2), c2(.5, 2), c2(.5, .8), c2(.65, 2)].map(o => [o.outcome, o.reason])).toEqual([['over_scaled', 'above_consistent_range'],
      ['consistent', 'not_proof'], ['inconclusive', 'below_consistent_range'], ['inconclusive', 'not_behind']]);
    // C3: a crop at the child's depth fails only when the frame shows at most 1.5 child heights of her (a child filling most of the frame).
    const c3 = (g: MeasuredSubject, rs: 'pass' | 'defect', kid = child) => controlOutcome(config, 'c3', [kid, g], rs);
    const tall = S('child', 'whole', .95, .25);
    expect([c3(S('grandma', 'cropped_by_frame', .75, 0), 'pass'), c3(S('grandma', 'cropped_by_frame', .95, 0), 'defect', tall), c3(S('grandma', 'cropped_by_frame', .75, 0), 'defect'),
      c3(S('grandma', 'whole', .75, .1), 'pass'), c3(S('grandma', 'cropped_by_frame', .75, .05), 'pass'), c3(S('grandma', 'cropped_by_frame', .6, 0), 'pass')]
      .map(o => [o.outcome, o.reason])).toEqual([['pass', 'visible_part_above_threshold'], ['fail', 'visible_part_at_or_below_threshold'],
      ['inconclusive', 'judge_verdict_disagrees_with_measurement'], ['inconclusive', 'not_cropped_at_top'], ['inconclusive', 'not_cropped_at_top'],
      ['inconclusive', 'bases_not_at_one_depth']]);
    // Not cropped is inconclusive, but her ratio is still recorded (a giant shrunk to fit shows here).
    expect(c3(S('grandma', 'whole', .75, .45), 'defect').ratios.grandma).toBeCloseTo(1.2, 6);
    const c4 = (stone: MeasuredSubject, rs: 'pass' | 'defect') => controlOutcome(config, 'c4', [child, S('bumbum', 'whole', .75, .625), stone], rs);
    expect([c4(S('silver_stone', 'whole', .75, .725), 'pass'), c4(S('silver_stone', 'whole', .75, .675), 'defect'), c4(S('silver_stone', 'whole', .75, .745), 'defect'),
      c4(S('silver_stone', 'absent', null, null), 'pass'), c4(S('silver_stone', 'unreadable', null, null), 'pass'), c4(S('silver_stone', 'whole', .75, .675), 'pass')]
      .map(o => [o.outcome, o.reason])).toEqual([['pass', 'all_inside_range'], ['fail', 'outside_range'], ['fail', 'outside_range'],
      ['not_counted', 'silver_stone_absent'], ['not_counted', 'silver_stone_unreadable'], ['not_counted', 'judge_verdict_disagrees_with_measurement']]);
    const gate = (baseline: string, band: string) => c1Gate({ outcome: baseline }, { outcome: band }).gate;
    expect(['pass', 'fail', 'inconclusive'].flatMap(baseline => ['pass', 'fail', 'inconclusive'].map(band => [baseline, band, gate(baseline, band)]))).toEqual([
      ['pass', 'pass', 'O2_both_pass'], ['pass', 'fail', 'O3_band_fail'], ['pass', 'inconclusive', 'O4_unusable'],
      ['fail', 'pass', 'O1_candidate_positive'], ['fail', 'fail', 'O3_band_fail'], ['fail', 'inconclusive', 'O4_unusable'],
      ['inconclusive', 'pass', 'O4_unusable'], ['inconclusive', 'fail', 'O3_band_fail'], ['inconclusive', 'inconclusive', 'O4_unusable']]);
    expect(c1Gate({ outcome: 'fail' }, { outcome: 'pass' }).pauseForOwner).toBe(true);
  });

  it('configuration: the declared ranges must hold the declared ratios; strict, pinned inputs; only the probe\'s render and review steps are metered', async () => {
    for (const change of [(c: any) => { c.criteria.c1.accept = { min: 2.4, max: 2.9 }; }, (c: any) => { c.capMicroUsd = 3000000; },
      (c: any) => { c.cast.push({ ...c.cast[0] }); }, (c: any) => { c.band.marks.push({ id: 'herd', label: 'herd', ratio: 0.3 }); },
      (c: any) => { c.criteria.c3.visibleAbove = 3.5; }, (c: any) => { c.referenceStatus.locations.knownFlaws = []; },
      (c: any) => { c.criteria.c4.subjects[1].accept = { min: 0.2, max: 0.3 }; }, (c: any) => { c.inputs.child.file = 'relative/child.png'; },
      (c: any) => { c.band.marks[4].ratio = 0.05; }, (c: any) => { c.extra = 1; }])
      { const c = structuredClone(rawConfig); change(c); expect(() => readScaleProbeConfig(write('bad.json', c))).toThrow('scale_probe_config'); }
    expect(() => readScaleProbeConfig(write('missing.json', { ...rawConfig, inputs: { ...rawConfig.inputs, locations: { ...rawConfig.inputs.locations, file: path.join(rawConfig.readOnly[0], 'nope.png') } } })))
      .toThrow('scale_probe_input_missing');
    writeFileSync(config.inputs.locations.file, await solid(161));
    await expect(planScaleProbe(config, configSha256)).rejects.toThrow('scale_probe_input_changed');
    expect(scaleProbeMeterRules('c1_baseline')).toBe(auditionRenderRule);
    expect(scaleProbeMeterRules('c4_band_qa')).toBe(auditionReviewRule);
    for (const step of ['c1_baseline_identity', 'c5_band', 'page_2_0', 'c1_band_qa_qa']) expect(scaleProbeMeterRules(step)).toBeUndefined();
  });
});
