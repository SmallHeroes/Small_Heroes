import { describe, it, expect } from 'vitest';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { COMPANIONS_BY_CATEGORY } from '../../companions';
import { buildCompanionSheetPrompt, COMPANION_SHEET_VIEW_KINDS } from '../../generation-pipeline/companion-character-sheet';
import { PALETTE_FAITHFULNESS, COMPANION_SHEET_VIEW_SCENE } from '../../generation-pipeline/companion-sheet-prompt';
import { STYLE_REFERENCE_PREFIX } from '../../generate-image';
import { PERSONAL_ADDED_COMPANIONS, personalCompanionVisual } from '../personal-companions';
import { companionIdentityReference } from '../companion-identity';
import { auditionRenderPlan, auditionRenderRule, auditionReviewRule, renderMaximum, REVIEW_MODEL } from '../../../scripts/personal-simple-book-reviewed-audition';
import { READER_PORTRAIT_FRAMING_VERSION } from '../../storybook-scene-framing';
import { admitCompanionSheetGrant, companionSheetDisposition, companionSheetMeterRules, companionSheetRenderPlan, companionSheetRenderRule,
  companionSheetReviewPayload, companionSheetReviewRule, parseCompanionSheetReview, runCompanionSheets, COMPANION_SHEET_SOURCE_FILES,
  COMPANION_SHEETS_EXECUTING_PHASE, COMPANION_SHEETS_EXECUTOR, COMPANION_SHEETS_REGISTRY_KEY, type CompanionSheetProviders,
  type CompanionSheetReview } from '../../../scripts/personal-companion-sheets';

const ROOT = path.resolve(__dirname, '../../..');
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const read = (f: string) => readFileSync(path.join(ROOT, f), 'utf8');
const png = (shade = 240) => sharp({ create: { width: 1024, height: 1536, channels: 3, background: { r: shade, g: 236, b: 222 } } }).png().toBuffer();
const momo = () => personalCompanionVisual('elephant_momo')!;
const MOMO_BODY = { legs: 4, upright: true, trunk: 1, tusks: 0, ears: 2, accessories: ['coral neckerchief, knot on his left'] };

describe('the shared sheet prompt data moved without changing one legacy prompt', () => {
  it('every legacy prompt (all registry companions × views × modes, and a null category) has the pre-move digest', () => {
    // Baseline captured from the unmoved builder (milestone baseline/legacy-prompts-before.json): 546 prompts.
    const rows: string[] = [];
    for (const [category, list] of Object.entries(COMPANIONS_BY_CATEGORY)) for (const c of list) for (const kind of COMPANION_SHEET_VIEW_KINDS)
      for (const mode of [{ isFrontFromJpg: true }, { isFrontFromJpg: false }, { isFrontFromJpg: false, isPromptOnlyFront: true }])
        rows.push(JSON.stringify([c.id, kind, mode, buildCompanionSheetPrompt({ companionId: c.id, kind, visualDescription: c.visualDescription,
          category: category as never, ...mode })]));
    for (const kind of COMPANION_SHEET_VIEW_KINDS) rows.push(JSON.stringify(['__null_category__', kind, buildCompanionSheetPrompt({ companionId: 'no_such',
      kind, visualDescription: 'X', category: null, isFrontFromJpg: false })]));
    expect(rows.length).toBe(546);
    expect(sha(rows.join('\n'))).toBe('c35cae93d737eb60786b38818766db31f9f6beb931ef429c8025ff4a731db9de');
  });
  it('the legacy module no longer owns the view/theme tables; the operator never uses the legacy generator or its pixel QA', () => {
    const legacy = read('lib/generation-pipeline/companion-character-sheet.ts'), operator = read('scripts/personal-companion-sheets.ts');
    expect(legacy).not.toMatch(/const VIEW_SCENE|const THEME_EXPRESSION_BY_CATEGORY|const PALETTE_FAITHFULNESS/);
    expect(legacy).toContain("from './companion-sheet-prompt'");
    for (const banned of ['generateCompanionSheetView', 'generateCompanionCharacterSheet', 'evaluateAnchorStyleFromVision', 'scoreResemblanceAgainstReference',
      'evaluateCompanionPaletteFaithfulness', 'COMPANION_SHEET_MAX_ATTEMPTS', 'getCompanionById']) expect(operator).not.toContain(banned);
    // General: no companion is named in the operator (ids arrive only from a grant).
    for (const c of PERSONAL_ADDED_COMPANIONS) expect(operator).not.toContain(c.id);
    for (const list of Object.values(COMPANIONS_BY_CATEGORY)) for (const c of list) expect(operator).not.toContain(`'${c.id}'`);
    expect([...COMPANION_SHEET_SOURCE_FILES]).toContain('scripts/personal-companion-sheets.ts');
  });
});

describe('the seven approved looks are declared; the two without a look are not', () => {
  it('declared exactly for the pictured seven, null for Tzuki and Mishi, and never tiny', () => {
    for (const c of PERSONAL_ADDED_COMPANIONS) {
      if (c.image) { expect(c.visualDescription!.length).toBeGreaterThan(200); expect(c.visualDescription).not.toMatch(/\btiny\b|\bsmall (elephant|tortoise|hedgehog|owl|kangaroo|puppy|cloud)\b/i); }
      else expect(c.visualDescription).toBeNull();
    }
    expect(momo().description).toContain("muted-coral neckerchief tied in a single knot on his left side (the viewer's right in a front view)");
    expect(personalCompanionVisual('turtle_tuk')!.description).toContain('mustard-yellow bow tied at the front of his neck');
  });
});

describe('prompts: an angle view and a concept front', () => {
  it('an angle view is the legacy angle prompt over the declared lock, with ONE reference: the approved front', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cs-plan-')), front = path.join(dir, 'front.png'); writeFileSync(front, await png());
    const plan = companionSheetRenderPlan({ companionId: 'elephant_momo', view: 'side', references: [front], visualLock: momo().description });
    expect(plan.input.finalPrompt).toContain(`COMPANION VISUAL LOCK (verbatim): ${momo().description}`);
    expect(plan.input.finalPrompt).toContain(COMPANION_SHEET_VIEW_SCENE.side);
    expect(plan.input.finalPrompt).toContain('STYLE 01 COMPANION CHARACTER SHEET — angle/expression variant.');
    expect(plan.input.finalPrompt).toContain(PALETTE_FAITHFULNESS);
    expect(plan.wire).toMatchObject({ mode: 'images.edit', sheetView: 'side', retries: 0, body: { model: 'gpt-image-2', quality: 'low', size: '1024x1536', n: 1 } });
    expect(plan.wire.references).toHaveLength(1);
    expect('readerFraming' in plan.wire).toBe(false);
    expect(plan.maximumMicroUsd).toBe(renderMaximum(plan.wire.body.prompt, 1));
    const theme = companionSheetRenderPlan({ companionId: 'elephant_momo', view: 'theme', references: [front], visualLock: momo().description });
    expect(theme.input.finalPrompt).toContain('THEME expression: one gentle story-appropriate mood'); // generic: added companions have no category
  });
  it('a concept front uses technique-only references and never asks to copy a reference palette', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cs-plan-')), a = path.join(dir, 'a.png'), b = path.join(dir, 'b.png');
    writeFileSync(a, await png(230)); writeFileSync(b, await png(220));
    const plan = companionSheetRenderPlan({ companionId: 'ibex_tzuki', view: 'concept_front', references: [a, b], visualLock: 'A sure-footed lively young ibex '.repeat(3),
      stance: 'natural stance on four legs' });
    expect(plan.input.finalPrompt).toContain('TECHNIQUE references only');
    expect(plan.input.finalPrompt).toContain('Stance: natural stance on four legs.');
    expect(plan.input.finalPrompt).not.toContain(PALETTE_FAITHFULNESS);
    expect(plan.wire.body.prompt.startsWith(STYLE_REFERENCE_PREFIX)).toBe(true);
    expect(plan.wire.references).toHaveLength(2);
  });
});

describe('a sheet is never a reader page and a reader page is never a sheet (both validators)', () => {
  it('the reader render rule prices an ordinary page exactly as before and refuses any wire carrying sheetView', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cs-rule-'));
    writeFileSync(path.join(dir, 'child.png'), await png());
    const page = auditionRenderPlan(dir, 'A page prompt.', [{ imageName: 'child.png', imageSha: sha(readFileSync(path.join(dir, 'child.png'))) }],
      'book_identity', undefined, undefined, READER_PORTRAIT_FRAMING_VERSION);
    const json = JSON.parse(JSON.stringify(page.wire));
    expect(auditionRenderRule.reserve(json)).toBe(page.maximumMicroUsd);
    expect(auditionRenderRule.reserve({ ...json, sheetView: 'side' })).toBeNull(); // double-tagged: refused
    expect(companionSheetRenderRule.reserve(json)).toBeNull();
    expect(companionSheetRenderRule.reserve({ ...json, sheetView: 'side', sheetPlan: 'companion-sheet-wire/v1' })).toBeNull(); // still framed
  });
  it('the sheet render rule prices only its own exact wire', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cs-rule-')), front = path.join(dir, 'front.png'); writeFileSync(front, await png());
    const wire = JSON.parse(JSON.stringify(companionSheetRenderPlan({ companionId: 'elephant_momo', view: 'happy', references: [front], visualLock: momo().description }).wire));
    expect(companionSheetRenderRule.reserve(wire)).toBe(renderMaximum(wire.body.prompt, 1));
    expect(auditionRenderRule.reserve(wire)).toBeNull();
    for (const bad of [{ readerFraming: READER_PORTRAIT_FRAMING_VERSION }, { sheetPlan: undefined }, { sheetView: 'front' }, { retries: 1 },
      { references: [] }, { references: [wire.references[0], wire.references[0]] }, { body: { ...wire.body, quality: 'high' } },
      { body: { ...wire.body, size: '1024x1024' } }, { body: { ...wire.body, n: 2 } }, { pricing: 'cheaper' }, { outputReservationTokens: 100 }])
      expect(companionSheetRenderRule.reserve({ ...wire, ...bad })).toBeNull();
  });
  it('reviews: each rule prices only its own marker; step names select exactly one rule and never a front render', async () => {
    const images = await Promise.all(COMPANION_SHEET_VIEW_KINDS.map(async (view, i) => ({ view, provenance: 'generated' as const, bytes: await png(200 + i) })));
    const sheetReview = JSON.parse(JSON.stringify(await companionSheetReviewPayload({ companionId: 'elephant_momo', description: momo().description, body: MOMO_BODY, images })));
    expect(companionSheetReviewRule.reserve(sheetReview)).toBe(600000);
    expect(auditionReviewRule.reserve(sheetReview)).toBeNull();
    const pageReview = { model: REVIEW_MODEL, service_tier: 'default', max_output_tokens: 12000 };
    expect(auditionReviewRule.reserve(pageReview)).toBe(600000);
    expect(companionSheetReviewRule.reserve(pageReview)).toBeNull();
    expect(companionSheetMeterRules('sheet_elephant_momo_side_1')).toBe(companionSheetRenderRule);
    expect(companionSheetMeterRules('sheet_elephant_momo_review_2')).toBe(companionSheetReviewRule);
    expect(companionSheetMeterRules('concept_ibex_tzuki_b')).toBe(companionSheetRenderRule);
    for (const step of ['sheet_elephant_momo_front_1', 'sheet_elephant_momo_side_3', 'sheet_elephant_momo_review_3', 'concept_ibex_tzuki_c', 'page_1_0'])
      expect(companionSheetMeterRules(step)).toBeUndefined();
  });
});

const verdicts = (held: string[] = [], over: Partial<Record<string, unknown>> = {}): CompanionSheetReview => ({ notes: '',
  views: COMPANION_SHEET_VIEW_KINDS.map(view => ({ view, correctAngle: true, sameCharacterAsFront: true, anatomyConsistent: true, accessoryConsistent: true,
    paletteConsistent: true, styleMatchesFront: true, isolatedOnPlainBackground: true, noTextNoExtraFigures: true,
    verdict: held.includes(view) ? 'hold' as const : 'pass' as const, reason: held.includes(view) ? 'extra leg' : 'ok', ...over })) });

describe('what a review decides', () => {
  it('passes only with every view and every check; the front is immutable; one bounded round; never a partial attempt', () => {
    expect(companionSheetDisposition(verdicts(), 1, 2)).toEqual({ status: 'passed' });
    expect(companionSheetDisposition(verdicts(['front']), 1, 2)).toEqual({ status: 'pending', reason: 'front_held' });
    expect(companionSheetDisposition(verdicts(['side', 'theme']), 1, 2)).toEqual({ status: 'redraw', views: ['side', 'theme'] });
    expect(companionSheetDisposition(verdicts(['side', 'happy', 'theme']), 1, 2)).toEqual({ status: 'pending', reason: 'too_many_held' });
    expect(companionSheetDisposition(verdicts(['side']), 2, 1)).toEqual({ status: 'pending', reason: 'held_after_redraw' });
    expect(companionSheetDisposition(verdicts(['three_quarter_front']), 1, 0)).toEqual({ status: 'pending', reason: 'too_many_held' });
    // A "pass" with a failed check is held.
    const sneaky = verdicts(); sneaky.views[2] = { ...sneaky.views[2], anatomyConsistent: false };
    expect(companionSheetDisposition(sneaky, 1, 2)).toEqual({ status: 'redraw', views: ['side'] });
  });
  it('an answer that does not judge each of the six views exactly once is unusable', () => {
    const ok = verdicts();
    expect(parseCompanionSheetReview(JSON.stringify(ok)).views).toHaveLength(6);
    const dup = verdicts(); dup.views[5] = { ...dup.views[5], view: 'side' };
    expect(() => parseCompanionSheetReview(JSON.stringify(dup))).toThrow('companion_sheet_review_views');
    expect(() => parseCompanionSheetReview(JSON.stringify({ ...ok, views: ok.views.slice(1) }))).toThrow();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// A complete scratch S1 grant over the real source, with scratch inputs.
// ---------------------------------------------------------------------------------------------------------------
async function scratchS1(edit: (g: any, ctx: { dir: string; draft: any }) => void = () => undefined, opts: { registryPhase?: string } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'cs-grant-')), file = (name: string, bytes: Buffer | string) => { const f = path.join(dir, name); writeFileSync(f, bytes); return f; };
  const pin = (f: string) => ({ file: f, sha256: sha(readFileSync(f)) });
  mkdirSync(path.join(dir, 'approved-looks', 'elephant_momo'), { recursive: true });
  const front = file('approved-looks/elephant_momo/front-candidate.png', await png(241)), tq = file('approved-looks/elephant_momo/three-quarter-completion.png', await png(239));
  const draft: any = { companions: { elephant_momo: { visualDescription: momo().description, body: MOMO_BODY } }, conceptBriefs: {
    ibex_tzuki: { brief: 'A sure-footed, lively young ibex with two short curved ridged horns and warm sand-brown fur.', variants: { A: 'natural stance on four legs', B: 'upright friendly stance on two hind legs' } },
    mole_mishi: { brief: 'A warm, curious young mole with soft velvety dark gray-brown fur and a pink pointed nose.', variants: { A: 'on four paws', B: 'upright friendly stance on two hind legs' } } } };
  const index = [{ id: 'elephant_momo', file: 'approved-looks/elephant_momo/front-candidate.png', sha256: sha(readFileSync(front)) },
    { id: 'elephant_momo', file: 'approved-looks/elephant_momo/three-quarter-completion.png', sha256: sha(readFileSync(tq)) }];
  const t1 = file('technique-1.png', await png(235)), t2 = file('technique-2.png', await png(233));
  const head = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const grant: any = { version: 'companion-sheet-grant/v1', stage: 'S1', ledger: { name: 'companion-sheets-20261028', priorKnownApiMicroUsd: 0 },
    capMicroUsd: 2500000, maxCalls: 12, out: path.join(dir, 'run'), registry: path.join(dir, 'registry.json'),
    lineage: { plan: pin(file('plan.txt', 'plan')), planQa: pin(file('qa.txt', 'DISPOSITION: PASS')), descriptions: pin(file('draft.json', '')),
      approvedIndex: pin(file('index.json', JSON.stringify(index))), ownerLooks: pin(file('looks.txt', 'מאשר את כולם')), ownerCap: pin(file('cap.txt', 'מאשר')) },
    source: { root: ROOT, commit: head, files: Object.fromEntries(COMPANION_SHEET_SOURCE_FILES.map(f => [f, sha(readFileSync(path.join(ROOT, f)))])) },
    sheets: [{ companionId: 'elephant_momo', descriptionSha256: sha(momo().description), body: MOMO_BODY, front: pin(front), threeQuarter: pin(tq),
      generate: ['side', 'three_quarter_back', 'happy', 'theme'], maxRedraws: 2 }],
    concepts: ['ibex_tzuki', 'mole_mishi'].map(id => ({ companionId: id, brief: draft.conceptBriefs[id].brief,
      variants: [{ variant: 'a', stance: draft.conceptBriefs[id].variants.A }, { variant: 'b', stance: draft.conceptBriefs[id].variants.B }], techniqueRefs: [pin(t1), pin(t2)] })) };
  edit(grant, { dir, draft });
  writeFileSync(grant.lineage.descriptions.file, JSON.stringify(draft)); grant.lineage.descriptions.sha256 = sha(readFileSync(grant.lineage.descriptions.file));
  const grantFile = file('grant.json', JSON.stringify(grant, null, 2)), grantSha = sha(readFileSync(grantFile));
  writeFileSync(grant.registry, JSON.stringify({ phase: opts.registryPhase ?? COMPANION_SHEETS_EXECUTING_PHASE,
    coordination: { activeWriter: COMPANION_SHEETS_EXECUTOR, activeQA: null }, [COMPANION_SHEETS_REGISTRY_KEY]: { executeGrantSha256: grantSha } }));
  return { dir, grant, grantFile, keyFile: file('key.env', 'OPENAI_API_KEY=test-not-a-real-key\n') };
}

describe('the grant binds every input; anything else refuses before a claim or a key read', () => {
  it('admits the exact S1 grant (12 calls = 4 concepts + 4 renders + review + 2 redraws + re-review)', async () => {
    const s = await scratchS1();
    expect(admitCompanionSheetGrant(s.grantFile).grant.maxCalls).toBe(12);
  });
  it.each([
    ['a changed approved front', (g: any) => { writeFileSync(g.sheets[0].front.file, Buffer.from('changed')); }, 'companion_sheet_input_changed'],
    ['a description other than the reviewed draft', (_g: any, c: any) => { c.draft.companions.elephant_momo.visualDescription += ' Wings.'; }, 'companion_sheet_description'],
    ['a body other than the reviewed draft', (g: any) => { g.sheets[0].body = { ...MOMO_BODY, legs: 6 }; }, 'companion_sheet_description'],
    ['a front not in the approved index', (g: any) => { g.sheets[0].front.sha256 = '0'.repeat(64); }, 'companion_sheet_front'],
    ['a call ceiling other than the worst case', (g: any) => { g.maxCalls = 11; }, 'companion_sheet_calls'],
    ['a ceiling with no redraw budget behind it', (g: any) => { g.sheets[0].maxRedraws = 0; }, 'companion_sheet_calls'],
    ['a legacy registry companion', (g: any) => { g.sheets[0].companionId = 'fox_uri'; }, 'companion_sheet_companion'],
    ['a concept for a companion that already has a look', (g: any) => { g.concepts[0].companionId = 'turtle_tuk'; }, 'companion_sheet_concept'],
    ['a stance other than the reviewed draft', (g: any) => { g.concepts[0].variants[1].stance = 'flying above the clouds today'; }, 'companion_sheet_concept'],
    ['a missing view (no three-quarter and not generated)', (g: any) => { g.sheets[0].threeQuarter = null; }, 'companion_sheet_views'],
    ['a changed source file pin', (g: any) => { g.source.files['lib/generate-image.ts'] = '0'.repeat(64); }, 'companion_sheet_source'],
    ['another commit', (g: any) => { g.source.commit = '0'.repeat(40); }, 'companion_sheet_source'],
    ['an existing output folder', (g: any) => { mkdirSync(g.out); }, 'companion_sheet_out'],
  ])('refuses %s', async (_label, edit, code) => {
    const s = await scratchS1(edit as never);
    expect(() => admitCompanionSheetGrant(s.grantFile)).toThrow(code);
  });
  it('refuses S2, a cap above $2.50 and more than 12 calls by schema', async () => {
    for (const edit of [(g: any) => { g.stage = 'S2'; }, (g: any) => { g.capMicroUsd = 2500001; }, (g: any) => { g.maxCalls = 13; }])
      expect(() => admitCompanionSheetGrant(scratchS1Sync(edit))).toThrow();
  });
});
// Schema refusals happen before any file check, so a minimal grant file is enough.
function scratchS1Sync(edit: (g: any) => void) {
  const dir = mkdtempSync(path.join(tmpdir(), 'cs-schema-')), g: any = { version: 'companion-sheet-grant/v1', stage: 'S1', ledger: { name: 'companion-sheets-20261028', priorKnownApiMicroUsd: 0 },
    capMicroUsd: 2500000, maxCalls: 12, out: path.join(dir, 'run'), registry: path.join(dir, 'r.json'), lineage: {}, source: {}, sheets: [], concepts: [] };
  edit(g); const f = path.join(dir, 'grant.json'); writeFileSync(f, JSON.stringify(g)); return f;
}

// ---------------------------------------------------------------------------------------------------------------
// The run, with fake providers.
// ---------------------------------------------------------------------------------------------------------------
function fakes(reviews: (CompanionSheetReview | 'schema' | 'unknown')[], opts: { imageUsage?: unknown; imageThrowsAt?: number } = {}) {
  const calls = { generate: 0, review: 0, keys: [] as string[] };
  const providers: CompanionSheetProviders = {
    generate: (async (input: any) => {
      calls.generate++; calls.keys.push(input.apiKey);
      if (opts.imageThrowsAt === calls.generate) throw new Error('provider 500');
      const usage = opts.imageUsage === undefined ? { input_tokens: 1500, output_tokens: 1800 } : opts.imageUsage;
      input.observeProviderResponse?.({ usage });
      return { buffer: await png(200 + calls.generate), model: 'gpt-image-2', usage, fallbackUsed: false } as any;
    }) as any,
    review: async (_payload, o) => {
      calls.review++; calls.keys.push(o.apiKey);
      const r = reviews.shift()!;
      if (r === 'unknown') return { status: 'completed', model: REVIEW_MODEL, service_tier: 'default', output_text: JSON.stringify(verdicts()) }; // no usage
      return { status: 'completed', model: REVIEW_MODEL, service_tier: 'default', usage: { input_tokens: 9000, output_tokens: 2500 },
        output_text: r === 'schema' ? JSON.stringify({ views: [], notes: '' }) : JSON.stringify(r) };
    },
  };
  return { providers, calls };
}
const signal = () => new AbortController().signal;

describe('S1 end to end (fake providers): metered, bounded, fail-closed, admission-shaped', () => {
  it('all pass: 4 concepts + 4 renders + 1 review; the set has the exact approved front and is what companionIdentityReference admits', async () => {
    const s = await scratchS1(), f = fakes([verdicts()]);
    const r = await runCompanionSheets({ grantFile: s.grantFile, keyFile: s.keyFile, signal: signal(), providers: f.providers });
    expect(r.stopped).toBeUndefined();
    expect([f.calls.generate, f.calls.review]).toEqual([8, 1]);
    expect(r.spend).toMatchObject({ calls: 9, unknownCost: 0, unknownOutcome: 0, capMicroUsd: 2500000 });
    expect(r.sheets).toEqual([expect.objectContaining({ companionId: 'elephant_momo', status: 'passed', reviews: ['sheet_elephant_momo_review_1'] })]);
    expect(r.concepts.map(c => c.image)).toEqual(['concept_ibex_tzuki_a.png', 'concept_ibex_tzuki_b.png', 'concept_mole_mishi_a.png', 'concept_mole_mishi_b.png']);
    const set = path.join(s.grant.out, 'sheets', 'elephant_momo', 'style01-sheets');
    expect(sha(readFileSync(path.join(set, 'front.png')))).toBe(s.grant.sheets[0].front.sha256);
    expect(sha(readFileSync(path.join(set, '3-4.png')))).toBe(s.grant.sheets[0].threeQuarter.sha256);
    // The future admission (copy into public/) is exactly what the engine's identity reference reads.
    const pub = path.join(s.dir, 'admission-proof'); cpSync(set, path.join(pub, 'public', 'companions', 'elephant_momo', 'style01-sheets'), { recursive: true });
    expect(companionIdentityReference('elephant_momo', pub).sha256).toBe(s.grant.sheets[0].front.sha256);
    expect(f.calls.keys.every(k => k === 'test-not-a-real-key')).toBe(true);
    expect(existsSync(path.join(s.grant.out, 'contact-sheet.html'))).toBe(true);
  });
  it('one held view: exactly one redraw and one re-review, then passed (11 calls)', async () => {
    const s = await scratchS1(), f = fakes([verdicts(['side']), verdicts()]);
    const r = await runCompanionSheets({ grantFile: s.grantFile, keyFile: s.keyFile, signal: signal(), providers: f.providers });
    expect([f.calls.generate, f.calls.review, r.spend.calls]).toEqual([9, 2, 11]);
    expect(r.sheets[0]).toMatchObject({ status: 'passed', reviews: ['sheet_elephant_momo_review_1', 'sheet_elephant_momo_review_2'] });
    expect(r.sheets[0].views.side.image).toBe('sheet_elephant_momo_side_2.png');
    expect(existsSync(path.join(s.grant.out, 'illustrations', 'sheet_elephant_momo_side_1.png'))).toBe(true); // the held image is kept
  });
  it('a held front: no redraw, pending, no set; still held after the round: pending', async () => {
    let s = await scratchS1(), f = fakes([verdicts(['front'])]);
    let r = await runCompanionSheets({ grantFile: s.grantFile, keyFile: s.keyFile, signal: signal(), providers: f.providers });
    expect(r.sheets[0]).toMatchObject({ status: 'pending', reason: 'front_held' }); expect(f.calls.generate).toBe(8);
    expect(existsSync(path.join(s.grant.out, 'sheets'))).toBe(false);
    s = await scratchS1(); f = fakes([verdicts(['side', 'happy']), verdicts(['happy'])]);
    r = await runCompanionSheets({ grantFile: s.grantFile, keyFile: s.keyFile, signal: signal(), providers: f.providers });
    expect(r.sheets[0]).toMatchObject({ status: 'pending', reason: 'held_after_redraw' }); expect([f.calls.generate, f.calls.review]).toEqual([10, 2]);
  });
  it('an invalid answer, an unknown cost or a provider failure stops: no redraw, no further call, no pass', async () => {
    for (const [reviews, opts, code, calls, unknown] of [[['schema'], {}, 'companion_sheet_review_schema', [8, 1], 0],
      [['unknown'], {}, 'companion_sheet_review_invalid', [8, 1], 1], [[], { imageUsage: null }, 'audition_unknown_cost', [1, 0], 1],
      [[], { imageThrowsAt: 2 }, 'companion_sheet_image_provider_failed', [2, 0], 1]] as const) {
      const s = await scratchS1(), f = fakes([...reviews] as never, opts as never);
      const r = await runCompanionSheets({ grantFile: s.grantFile, keyFile: s.keyFile, signal: signal(), providers: f.providers });
      expect(r.stopped?.code).toBe(code); expect([f.calls.generate, f.calls.review]).toEqual(calls);
      expect(r.spend.unknownCost).toBe(unknown);
      expect(existsSync(path.join(s.grant.out, 'sheets'))).toBe(false);
      expect(JSON.parse(readFileSync(path.join(s.grant.out, 'outcome.json'), 'utf8')).stopped.code).toBe(code);
    }
  });
  it('the key is read only inside a claimed call: an unreadable key fails the first claimed call, records it, and stops', async () => {
    const s = await scratchS1(), f = fakes([verdicts()]);
    const r = await runCompanionSheets({ grantFile: s.grantFile, keyFile: path.join(s.dir, 'no-key.env'), signal: signal(), providers: f.providers });
    expect(r.stopped?.code).toBe('companion_sheet_image_provider_failed');
    expect(f.calls.generate + f.calls.review).toBe(0);
    expect(readdirSync(path.join(s.grant.out, 'paid')).sort()).toEqual(['concept_ibex_tzuki_a.claim.json', 'concept_ibex_tzuki_a.failure.json',
      'concept_ibex_tzuki_a.result.json', 'concept_ibex_tzuki_a.wire.json']);
    expect(r.spend).toMatchObject({ calls: 1, unknownCost: 1 });
  });
  it('without the live lease nothing is created, claimed or read; a consumed grant cannot run again', async () => {
    const s = await scratchS1(undefined, { registryPhase: 'MOMENTUM_BOOK_QA_RELEASED' }), f = fakes([verdicts()]);
    await expect(runCompanionSheets({ grantFile: s.grantFile, keyFile: path.join(s.dir, 'no-key.env'), signal: signal(), providers: f.providers })).rejects.toThrow('companion_sheet_lease');
    expect(existsSync(s.grant.out)).toBe(false); expect(f.calls.generate + f.calls.review).toBe(0);
    const ok = await scratchS1(), g = fakes([verdicts()]);
    await runCompanionSheets({ grantFile: ok.grantFile, keyFile: ok.keyFile, signal: signal(), providers: g.providers });
    const before = readdirSync(path.join(ok.grant.out, 'paid')).length;
    await expect(runCompanionSheets({ grantFile: ok.grantFile, keyFile: ok.keyFile, signal: signal(), providers: g.providers })).rejects.toThrow('companion_sheet_out');
    expect(readdirSync(path.join(ok.grant.out, 'paid')).length).toBe(before);
  });
});
