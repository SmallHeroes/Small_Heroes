import { afterEach, describe, it, expect, vi } from 'vitest';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { COMPANIONS_BY_CATEGORY } from '../../companions';
import { buildCompanionSheetPrompt, COMPANION_SHEET_VIEW_KINDS } from '../../generation-pipeline/companion-character-sheet';
import { PALETTE_FAITHFULNESS, COMPANION_SHEET_VIEW_SCENE } from '../../generation-pipeline/companion-sheet-prompt';
import { CONTRACT_VIEW_LINE } from '../../generation-pipeline/companion-sheet-view-contract';
import { STYLE_REFERENCE_PREFIX } from '../../generate-image';
import { getPersonalAddedCompanion, PERSONAL_ADDED_COMPANIONS, personalCompanionVisual } from '../personal-companions';
import { companionIdentityReference } from '../companion-identity';
import { AuditionMeter, auditionRenderPlan, auditionRenderRule, auditionReviewRule, renderMaximum, REVIEW_MODEL } from '../../../scripts/personal-simple-book-reviewed-audition';
import { READER_PORTRAIT_FRAMING_VERSION } from '../../storybook-scene-framing';
import { admitCompanionSheetGrant, companionSheetDisposition, companionSheetMeterRules, companionSheetRenderPlan, companionSheetRenderRule,
  companionSheetReviewPayload, companionSheetReviewRule, parseCompanionSheetReview, runCompanionSheets, COMPANION_SHEET_SOURCE_FILES,
  COMPANION_SHEETS_EXECUTING_PHASE, COMPANION_SHEETS_EXECUTOR, COMPANION_SHEETS_REGISTRY_KEY, COMPANION_SHEET_REVIEW_INSTRUCTIONS, type CompanionSheetProviders,
  type CompanionSheetReview, admitCompanionSheetRepairGrant, runCompanionSheetRepair, REPAIR_LEASE, companionSheetGeometrySha,
  companionSheetRepairDisposition } from '../../../scripts/personal-companion-sheets';

const ROOT = path.resolve(__dirname, '../../..');
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const read = (f: string) => readFileSync(path.join(ROOT, f), 'utf8');
const png = (shade = 240) => sharp({ create: { width: 1024, height: 1536, channels: 3, background: { r: shade, g: 236, b: 222 } } }).png().toBuffer();
const momo = () => personalCompanionVisual('elephant_momo')!;
const MOMO_BODY = { legs: 4, upright: true, trunk: 1, tusks: 0, ears: 2, accessories: ['coral neckerchief, knot on his left'] };
const MOMO_GEOMETRY = getPersonalAddedCompanion('elephant_momo')!.sheetGeometry!;

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
  it('loads in the real runtime in either order (style01-gptimage and the legacy sheet module import each other)', () => {
    // The operator's launcher: one CommonJS process with the server-only shim and tsx. style01-gptimage FIRST was the failing order
    // (a load-time read of its constants from the legacy module); the legacy-first order and the operator itself must load too.
    for (const first of ['lib/style01-gptimage.ts', 'lib/generation-pipeline/companion-character-sheet.ts', 'scripts/personal-companion-sheets.ts']) {
      const code = `require('./scripts/shims/register-server-only.cjs');require('./node_modules/tsx/dist/cjs/index.cjs');require('./${first}');` +
        `const op=require('./scripts/personal-companion-sheets.ts');const legacy=require('./lib/generation-pipeline/companion-character-sheet.ts');` +
        `if(typeof op.companionSheetsMain!=='function'||!legacy.style01SheetBlocks().noText)process.exit(3);`;
      const r = spawnSync(process.execPath, ['-e', code], { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
      expect({ first, status: r.status, err: r.status ? r.stderr.slice(0, 400) : '' }).toEqual({ first, status: 0, err: '' });
    }
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
  it('an angle view is the companion-only angle prompt over the declared lock and its view contract, with ONE reference: the approved front', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cs-plan-')), front = path.join(dir, 'front.png'); writeFileSync(front, await png());
    const plan = companionSheetRenderPlan({ companionId: 'elephant_momo', view: 'side', references: [front], visualLock: momo().description, geometry: MOMO_GEOMETRY });
    expect(plan.input.finalPrompt).toContain(`COMPANION VISUAL LOCK (verbatim): ${momo().description}`);
    expect(plan.input.finalPrompt).toContain(CONTRACT_VIEW_LINE.side);
    expect(plan.input.finalPrompt).not.toContain(COMPANION_SHEET_VIEW_SCENE.side); // the legacy "(left or right)" line
    expect(plan.input.finalPrompt).toContain("Facing: the companion faces the viewer's LEFT in a clean profile, so the viewer sees its own LEFT side.");
    expect(plan.input.finalPrompt).toContain('Accessory: the neckerchief knot sits on the NEAR side of the neck, fully visible');
    expect(plan.input.finalPrompt).toContain('STYLE 01 COMPANION CHARACTER SHEET — angle/expression variant.');
    expect(plan.input.finalPrompt).toContain(PALETTE_FAITHFULNESS);
    // Companion-only: no child rendering block, no page negative, no "void" against the cream rule.
    for (const banned of ['Render the child', 'NOT empty cream void', 'Dini', 'duplicate human children', 'photoreal child portrait'])
      expect(plan.wire.body.prompt).not.toContain(banned);
    expect(plan.wire).toMatchObject({ mode: 'images.edit', sheetView: 'side', sheetPlan: 'companion-sheet-wire/v2', retries: 0,
      sheetContract: { version: 'companion-sheet-view-contract/v1', view: 'side', sha256: expect.stringMatching(/^[0-9a-f]{64}$/) },
      body: { model: 'gpt-image-2', quality: 'low', size: '1024x1536', n: 1 } });
    expect(plan.wire.references).toHaveLength(1);
    expect('readerFraming' in plan.wire).toBe(false);
    expect(plan.maximumMicroUsd).toBe(renderMaximum(plan.wire.body.prompt, 1));
    const theme = companionSheetRenderPlan({ companionId: 'elephant_momo', view: 'theme', references: [front], visualLock: momo().description, geometry: MOMO_GEOMETRY });
    expect(theme.input.finalPrompt).toContain(CONTRACT_VIEW_LINE.theme);
    // No angle without geometry, and no geometry on a concept.
    expect(() => companionSheetRenderPlan({ companionId: 'elephant_momo', view: 'side', references: [front], visualLock: momo().description })).toThrow('companion_sheet_geometry');
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
    expect(plan.wire).toMatchObject({ sheetPlan: 'companion-sheet-wire/v2', sheetContract: null });
    for (const banned of ['Render the child', 'NOT empty cream void', 'Dini']) expect(plan.wire.body.prompt).not.toContain(banned);
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
    const wire = JSON.parse(JSON.stringify(companionSheetRenderPlan({ companionId: 'elephant_momo', view: 'happy', references: [front], visualLock: momo().description,
      geometry: MOMO_GEOMETRY }).wire));
    expect(companionSheetRenderRule.reserve(wire)).toBe(renderMaximum(wire.body.prompt, 1));
    expect(auditionRenderRule.reserve(wire)).toBeNull();
    for (const bad of [{ readerFraming: READER_PORTRAIT_FRAMING_VERSION }, { sheetPlan: undefined }, { sheetView: 'front' }, { retries: 1 },
      { sheetPlan: 'companion-sheet-wire/v1' }, { sheetContract: null }, { sheetContract: { ...wire.sheetContract, view: 'side' } },
      { sheetContract: { ...wire.sheetContract, version: 'companion-sheet-view-contract/v0' } },
      { references: [] }, { references: [wire.references[0], wire.references[0]] }, { body: { ...wire.body, quality: 'high' } },
      { body: { ...wire.body, size: '1024x1024' } }, { body: { ...wire.body, n: 2 } }, { pricing: 'cheaper' }, { outputReservationTokens: 100 }])
      expect(companionSheetRenderRule.reserve({ ...wire, ...bad })).toBeNull();
  });
  it('reviews: each rule prices only its own marker; step names select exactly one rule and never a front render', async () => {
    const images = await Promise.all(COMPANION_SHEET_VIEW_KINDS.map(async (view, i) => ({ view, provenance: 'generated' as const, bytes: await png(200 + i) })));
    const sheetReview = JSON.parse(JSON.stringify(await companionSheetReviewPayload({ companionId: 'elephant_momo', description: momo().description, body: MOMO_BODY,
      geometry: MOMO_GEOMETRY, images })));
    expect(companionSheetReviewRule.reserve(sheetReview)).toBe(600000);
    expect(companionSheetReviewRule.reserve({ ...sheetReview, metadata: { companion_sheet_review: 'companion-sheet-review/v1' } })).toBeNull();
    // v2 keeps every v1 instruction and adds each view's contract to the payload.
    expect(sheetReview.instructions.startsWith(COMPANION_SHEET_REVIEW_INSTRUCTIONS)).toBe(true);
    expect(sheetReview.instructions).toContain('correctAngle, anatomyConsistent and accessoryConsistent are true only when the view ALSO matches its viewContract');
    const packet = JSON.parse(sheetReview.input[0].content[0].text);
    expect(packet.images.map((i: any) => i.viewContract.view)).toEqual(COMPANION_SHEET_VIEW_KINDS);
    expect(packet.images[3].viewContract.hides).toContain('the WHOLE face: no eye, none of eyes, rosy cheeks, trunk is visible');
    expect(auditionReviewRule.reserve(sheetReview)).toBeNull();
    const pageReview = { model: REVIEW_MODEL, service_tier: 'default', max_output_tokens: 12000 };
    expect(auditionReviewRule.reserve(pageReview)).toBe(600000);
    expect(companionSheetReviewRule.reserve(pageReview)).toBeNull();
    expect(companionSheetMeterRules('sheet_elephant_momo_side_1')).toBe(companionSheetRenderRule);
    expect(companionSheetMeterRules('sheet_elephant_momo_review_2')).toBe(companionSheetReviewRule);
    expect(companionSheetMeterRules('concept_ibex_tzuki_b')).toBe(companionSheetRenderRule);
    expect(companionSheetMeterRules('repair_elephant_momo_three_quarter_back')).toBe(companionSheetRenderRule);
    expect(companionSheetMeterRules('repair_elephant_momo_review')).toBe(companionSheetReviewRule);
    for (const step of ['sheet_elephant_momo_front_1', 'sheet_elephant_momo_side_3', 'sheet_elephant_momo_review_3', 'concept_ibex_tzuki_c', 'page_1_0',
      'repair_elephant_momo_front', 'repair_elephant_momo_review_1', 'repair_elephant_momo_side_1'])
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
function fakes(reviews: (CompanionSheetReview | 'schema' | 'unknown')[], opts: { imageUsage?: unknown; imageThrowsAt?: number;
  onGenerate?: (n: number) => void; onReview?: (payload: any) => void } = {}) {
  const calls = { generate: 0, review: 0, keys: [] as string[], payloads: [] as any[] };
  const providers: CompanionSheetProviders = {
    generate: (async (input: any) => {
      calls.generate++; calls.keys.push(input.apiKey);
      if (opts.imageThrowsAt === calls.generate) throw new Error('provider 500');
      opts.onGenerate?.(calls.generate);
      const usage = opts.imageUsage === undefined ? { input_tokens: 1500, output_tokens: 1800 } : opts.imageUsage;
      input.observeProviderResponse?.({ usage });
      return { buffer: await png(200 + calls.generate), model: 'gpt-image-2', usage, fallbackUsed: false } as any;
    }) as any,
    review: async (payload, o) => {
      calls.review++; calls.keys.push(o.apiKey); calls.payloads.push(payload); opts.onReview?.(payload);
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
    // Published = judged, byte for byte: for every view the bytes sent to the review, the published file and the manifest hash agree.
    const manifest = JSON.parse(readFileSync(path.join(set, 'manifest.json'), 'utf8')), sent = judgedImages(f.calls.payloads[0]);
    for (const view of COMPANION_SHEET_VIEW_KINDS) {
      expect(sha(readFileSync(path.join(set, manifest.views[view].filename)))).toBe(sent[view]);
      expect(manifest.views[view].sha256).toBe(sent[view]);
    }
    expect(sha(readFileSync(path.join(s.grant.out, 'grant.json')))).toBe(sha(readFileSync(s.grantFile)));
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

// The image bytes a review payload carries, by view (the payload's data URLs, decoded).
function judgedImages(payload: any): Record<string, string> {
  const packet = JSON.parse(payload.input[0].content[0].text), images = payload.input[0].content.slice(1);
  return Object.fromEntries(packet.images.map((i: any, n: number) => {
    const bytes = Buffer.from(String(images[n].image_url).replace(/^data:image\/png;base64,/, ''), 'base64');
    expect(sha(bytes)).toBe(i.sha256);
    return [i.view, i.sha256];
  }));
}
/** The coordination lease taken away (as qa-release or execute-release would leave it). */
const revoke = (registry: string) => { const r = JSON.parse(readFileSync(registry, 'utf8')); r.phase = 'COMPANION_SHEETS_QA_RELEASED'; r.coordination.activeWriter = null;
  writeFileSync(registry, JSON.stringify(r)); };
/** Revokes the lease once, inside the claimed call of `step`, after its claim is durable and before its callback runs. */
const revokeAfterClaim = (registry: string, step: string) => {
  const original = AuditionMeter.prototype.run;
  return vi.spyOn(AuditionMeter.prototype, 'run').mockImplementation(function (this: AuditionMeter, s: string, wire: unknown, max: number, dispatch: any) {
    return original.call(this, s, wire, max, async () => {
      if (s === step) { expect(existsSync(path.join(this.root, `${s}.claim.json`))).toBe(true); revoke(registry); }
      return dispatch();
    });
  } as never);
};
const paid = (out: string, step: string, kind: string) => JSON.parse(readFileSync(path.join(out, 'paid', `${step}.${kind}.json`), 'utf8'));

describe('round 2 (Codex CS-S0-F1): the live lease is the last fence before the key and the provider, and before any result is used', () => {
  afterEach(() => vi.restoreAllMocks());
  it('a lease revoked after a render claim: no key read, no image call, the claim is closed as a stop with its cost unknown, nothing more runs', async () => {
    const s = await scratchS1(), f = fakes([verdicts()]), spy = revokeAfterClaim(s.grant.registry, 'concept_ibex_tzuki_a');
    // An unreadable key would fail as a provider failure if it were read: the stop code proves the fence came first.
    const r = await runCompanionSheets({ grantFile: s.grantFile, keyFile: path.join(s.dir, 'no-key.env'), signal: signal(), providers: f.providers });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(r.stopped?.code).toBe('companion_sheet_lease'); expect([f.calls.generate, f.calls.review, f.calls.keys.length]).toEqual([0, 0, 0]);
    expect(paid(s.grant.out, 'concept_ibex_tzuki_a', 'failure')).toMatchObject({ code: 'companion_sheet_lease', receipt: null });
    expect(paid(s.grant.out, 'concept_ibex_tzuki_a', 'result')).toMatchObject({ completed: false, estimatedMicroUsd: null });
    expect(r.spend).toMatchObject({ calls: 1, unknownCost: 1, newKnownApiMicroUsd: 0 });
    expect(r.concepts).toEqual([]); expect(existsSync(path.join(s.grant.out, 'sheets'))).toBe(false);
  });
  it('a lease revoked after the review claim: no review call, no verdict used, no passed set, the sheet is stopped', async () => {
    const s = await scratchS1(), f = fakes([verdicts()]), spy = revokeAfterClaim(s.grant.registry, 'sheet_elephant_momo_review_1');
    const r = await runCompanionSheets({ grantFile: s.grantFile, keyFile: s.keyFile, signal: signal(), providers: f.providers });
    expect(spy).toHaveBeenCalledTimes(9);
    expect(r.stopped?.code).toBe('companion_sheet_lease'); expect([f.calls.generate, f.calls.review]).toEqual([8, 0]);
    expect(paid(s.grant.out, 'sheet_elephant_momo_review_1', 'failure')).toMatchObject({ code: 'companion_sheet_lease', receipt: null });
    expect(r.sheets[0]).toMatchObject({ status: 'stopped', reason: 'companion_sheet_lease', views: {} });
    expect(existsSync(path.join(s.grant.out, 'sheets'))).toBe(false);
  });
  it('a lease lost while a call is in flight: the real receipt and known cost are kept, the result is not used, nothing more runs', async () => {
    // A render: its image is recorded as made (completed, known cost); the run stops before the next claim and before listing it.
    let s = await scratchS1(), f = fakes([verdicts()], { onGenerate: n => { if (n === 3) revoke(s.grant.registry); } });
    let r = await runCompanionSheets({ grantFile: s.grantFile, keyFile: s.keyFile, signal: signal(), providers: f.providers });
    expect(r.stopped?.code).toBe('companion_sheet_lease'); expect(f.calls.generate).toBe(3);
    expect(paid(s.grant.out, 'concept_mole_mishi_a', 'result')).toMatchObject({ completed: true, estimatedMicroUsd: expect.any(Number) });
    expect(paid(s.grant.out, 'concept_mole_mishi_a', 'receipt').candidate.imageName).toBe('concept_mole_mishi_a.png');
    expect(r.spend).toMatchObject({ calls: 3, unknownCost: 0, unknownOutcome: 0, failed: 0 }); expect(r.concepts).toHaveLength(2);
    // A review: its answer is recorded with its real cost, but no verdict is applied and no set is published.
    s = await scratchS1(); f = fakes([verdicts()], { onReview: () => revoke(s.grant.registry) });
    r = await runCompanionSheets({ grantFile: s.grantFile, keyFile: s.keyFile, signal: signal(), providers: f.providers });
    expect(r.stopped?.code).toBe('companion_sheet_lease'); expect([f.calls.generate, f.calls.review]).toEqual([8, 1]);
    expect(paid(s.grant.out, 'sheet_elephant_momo_review_1', 'result')).toMatchObject({ completed: true, estimatedMicroUsd: expect.any(Number) });
    expect(r.spend).toMatchObject({ calls: 9, unknownCost: 0, unknownOutcome: 0 });
    expect(r.sheets[0]).toMatchObject({ status: 'stopped', reason: 'companion_sheet_lease', views: {} });
    expect(existsSync(path.join(s.grant.out, 'sheets'))).toBe(false);
    // A review whose verdict would leave the companion pending (no publication follows): the verdict is still not used.
    s = await scratchS1(); f = fakes([verdicts(['front'])], { onReview: () => revoke(s.grant.registry) });
    r = await runCompanionSheets({ grantFile: s.grantFile, keyFile: s.keyFile, signal: signal(), providers: f.providers });
    expect(r.stopped?.code).toBe('companion_sheet_lease');
    expect(r.sheets[0]).toMatchObject({ status: 'stopped', reason: 'companion_sheet_lease', views: {} });
  });
});

describe('round 2 (Codex CS-S0-F2): a passed set is exactly the bytes its review judged, and the front is exactly the granted front', () => {
  it('working copies changed while the review is in flight (front and a generated view, pixels identical): nothing is published', async () => {
    let s = await scratchS1();
    const drift = () => { for (const name of ['elephant_momo_front.png', 'sheet_elephant_momo_side_1.png']) {
      const file = path.join(s.grant.out, 'illustrations', name); writeFileSync(file, Buffer.concat([readFileSync(file), Buffer.from('byte-drift')])); } };
    let f = fakes([verdicts()], { onReview: drift });
    const r = await runCompanionSheets({ grantFile: s.grantFile, keyFile: s.keyFile, signal: signal(), providers: f.providers });
    expect(r.stopped?.code).toBe('companion_sheet_reviewed_bytes_changed'); expect([f.calls.generate, f.calls.review]).toEqual([8, 1]);
    expect(r.sheets[0]).toMatchObject({ status: 'stopped', reason: 'companion_sheet_reviewed_bytes_changed' });
    expect(existsSync(path.join(s.grant.out, 'sheets'))).toBe(false);
    // The review and its cost are kept as they happened; the judged hashes are recorded per view; no call is made for the drift.
    expect(paid(s.grant.out, 'sheet_elephant_momo_review_1', 'result')).toMatchObject({ completed: true, estimatedMicroUsd: expect.any(Number) });
    expect(r.sheets[0].views.front.sha256).toBe(s.grant.sheets[0].front.sha256);
    expect(r.spend).toMatchObject({ calls: 9, unknownCost: 0 });
    // A non-front drift alone stops as well.
    s = await scratchS1();
    f = fakes([verdicts()], { onReview: () => { const file = path.join(s.grant.out, 'illustrations', 'sheet_elephant_momo_theme_1.png');
      writeFileSync(file, Buffer.concat([readFileSync(file), Buffer.from('x')])); } });
    expect((await runCompanionSheets({ grantFile: s.grantFile, keyFile: s.keyFile, signal: signal(), providers: f.providers })).stopped?.code)
      .toBe('companion_sheet_reviewed_bytes_changed');
    expect(existsSync(path.join(s.grant.out, 'sheets'))).toBe(false);
  });
  it('a working copy changed before the review: the review is sent the held bytes (the image as made), and publication still stops', async () => {
    const s = await scratchS1();
    // During the second sheet render (call 6), the first generated view's working copy changes; no render uses it as a reference.
    const f = fakes([verdicts()], { onGenerate: n => { if (n === 6) { const file = path.join(s.grant.out, 'illustrations', 'sheet_elephant_momo_side_1.png');
      writeFileSync(file, Buffer.concat([readFileSync(file), Buffer.from('x')])); } } });
    const r = await runCompanionSheets({ grantFile: s.grantFile, keyFile: s.keyFile, signal: signal(), providers: f.providers });
    expect(judgedImages(f.calls.payloads[0]).side).toBe(paid(s.grant.out, 'sheet_elephant_momo_side_1', 'receipt').candidate.imageSha);
    expect(r.stopped?.code).toBe('companion_sheet_reviewed_bytes_changed'); expect(existsSync(path.join(s.grant.out, 'sheets'))).toBe(false);
  });
  it('a render reference changed on disk after it was taken: refused before the claim (the claimed request names the bytes it sends)', async () => {
    const s = await scratchS1();
    // During the first sheet render (call 5), the front's working copy changes; the next render's request would name other bytes.
    const f = fakes([verdicts()], { onGenerate: n => { if (n === 5) { const file = path.join(s.grant.out, 'illustrations', 'elephant_momo_front.png');
      writeFileSync(file, Buffer.concat([readFileSync(file), Buffer.from('x')])); } } });
    const r = await runCompanionSheets({ grantFile: s.grantFile, keyFile: s.keyFile, signal: signal(), providers: f.providers });
    expect(r.stopped?.code).toBe('companion_sheet_reference_changed'); expect(f.calls.generate).toBe(5);
    expect(r.spend).toMatchObject({ calls: 5, unknownCost: 0 });
    expect(existsSync(path.join(s.grant.out, 'paid', 'sheet_elephant_momo_three_quarter_back_1.claim.json'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// CSR-1: the repair grant (retained judged bytes, held views only, one six-view review, never a redraw).
// ---------------------------------------------------------------------------------------------------------------
const viewVerdict = (view: string, held: boolean) => verdicts(held ? [view] : []).views.find(v => v.view === view)!;
async function scratchRepair(edit: (g: any, ctx: { dir: string; draft: any; outcome: any }) => void = () => undefined,
  opts: { registryPhase?: string; qa?: (outcomeSha: string) => string } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'csr-grant-')), file = (name: string, bytes: Buffer | string) => { const f = path.join(dir, name); writeFileSync(f, bytes); return f; };
  const pin = (f: string) => ({ file: f, sha256: sha(readFileSync(f)) });
  mkdirSync(path.join(dir, 'approved-looks', 'elephant_momo'), { recursive: true });
  const front = file('approved-looks/elephant_momo/front-candidate.png', await png(241)), tq = file('approved-looks/elephant_momo/three-quarter-completion.png', await png(239));
  const happy = file('sheet_elephant_momo_happy_1.png', await png(212)), theme = file('sheet_elephant_momo_theme_1.png', await png(213));
  const draft: any = { companions: { elephant_momo: { visualDescription: momo().description, body: MOMO_BODY } } };
  const index = [{ id: 'elephant_momo', file: 'approved-looks/elephant_momo/front-candidate.png', sha256: sha(readFileSync(front)) },
    { id: 'elephant_momo', file: 'approved-looks/elephant_momo/three-quarter-completion.png', sha256: sha(readFileSync(tq)) }];
  const priorGrant = file('prior-grant.json', '{"consumed":true}');
  const outcome: any = { grantSha256: sha(readFileSync(priorGrant)), concepts: [], sheets: [{ companionId: 'elephant_momo', status: 'pending', reason: 'held_after_redraw',
    views: { front: { sha256: sha(readFileSync(front)), verdict: viewVerdict('front', false) }, three_quarter_front: { sha256: sha(readFileSync(tq)), verdict: viewVerdict('three_quarter_front', false) },
      side: { sha256: '1'.repeat(64), verdict: viewVerdict('side', true) }, three_quarter_back: { sha256: '2'.repeat(64), verdict: viewVerdict('three_quarter_back', true) },
      happy: { sha256: sha(readFileSync(happy)), verdict: viewVerdict('happy', false) }, theme: { sha256: sha(readFileSync(theme)), verdict: viewVerdict('theme', false) } } }],
    spend: { newKnownApiMicroUsd: 350982, calls: 12, unknownCost: 0, unknownOutcome: 0, reservedUnsettledMicroUsd: 0 } };
  const head = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const grant: any = { version: 'companion-sheet-repair-grant/v1', stage: 'R1', ledger: { name: 'companion-sheets-20261028', priorKnownApiMicroUsd: 350982, priorCalls: 12 },
    capMicroUsd: 1500000, maxCalls: 3, out: path.join(dir, 'run'), registry: path.join(dir, 'registry.json'),
    lineage: { descriptions: pin(file('draft.json', '')), approvedIndex: pin(file('index.json', JSON.stringify(index))), ownerLooks: pin(file('looks.txt', 'מאשר את כולם')),
      ownerAuthorization: pin(file('owner.txt', 'יש אישור')), priorGrant: pin(priorGrant), priorOutcome: pin(file('outcome.json', '')), priorOutcomeQa: pin(file('outcome-qa.txt', '')) },
    source: { root: ROOT, commit: head, files: Object.fromEntries(COMPANION_SHEET_SOURCE_FILES.map(f => [f, sha(readFileSync(path.join(ROOT, f)))])) },
    sheet: { companionId: 'elephant_momo', descriptionSha256: sha(momo().description), geometrySha256: companionSheetGeometrySha(MOMO_GEOMETRY), body: MOMO_BODY,
      front: pin(front), threeQuarter: pin(tq), retained: [{ view: 'happy', image: pin(happy) }, { view: 'theme', image: pin(theme) }], repair: ['side', 'three_quarter_back'] } };
  edit(grant, { dir, draft, outcome });
  const repin = (p: any, bytes: string) => { writeFileSync(p.file, bytes); p.sha256 = sha(readFileSync(p.file)); };
  repin(grant.lineage.descriptions, JSON.stringify(draft));
  repin(grant.lineage.priorOutcome, JSON.stringify(outcome));
  repin(grant.lineage.priorOutcomeQa, (opts.qa ?? (o => `DISPOSITION: PASS\nOUTCOME_SHA256: ${o}\n`))(grant.lineage.priorOutcome.sha256));
  const grantFile = file('grant.json', JSON.stringify(grant, null, 2)), grantSha = sha(readFileSync(grantFile));
  writeFileSync(grant.registry, JSON.stringify({ phase: opts.registryPhase ?? REPAIR_LEASE.phase,
    coordination: { activeWriter: REPAIR_LEASE.executor, activeQA: null }, [REPAIR_LEASE.key]: { executeGrantSha256: grantSha } }));
  return { dir, grant, grantFile, outcome, keyFile: file('key.env', 'OPENAI_API_KEY=test-not-a-real-key\n') };
}

describe('CSR-1 repair grant: binds the prior PASS-reviewed outcome, retains only judged passing bytes, repairs only held views', () => {
  it('admits the exact repair grant: 2 renders + 1 review = 3 calls, inside the cumulative cap', async () => {
    const s = await scratchRepair(), a = admitCompanionSheetRepairGrant(s.grantFile);
    expect(a.grant.maxCalls).toBe(3); expect(a.geometry).toEqual(MOMO_GEOMETRY);
  });
  it.each([
    ['a retained view the prior review held', (g: any) => { g.sheet.retained[0] = { view: 'side', image: g.sheet.retained[0].image }; g.sheet.repair = ['happy', 'three_quarter_back']; }, 'companion_sheet_repair_retained'],
    ['retained bytes other than the judged ones', (_g: any, c: any) => { c.outcome.sheets[0].views.happy.sha256 = '3'.repeat(64); }, 'companion_sheet_repair_retained'],
    ['a retained view whose pass had a failed check', (_g: any, c: any) => { c.outcome.sheets[0].views.theme.verdict.anatomyConsistent = false; }, 'companion_sheet_repair_retained'],
    ['repairing a view that passed', (g: any) => { g.sheet.repair = ['side', 'happy']; g.sheet.retained = [{ view: 'theme', image: g.sheet.retained[1].image }]; }, 'companion_sheet_repair_views'],
    ['a view neither retained nor repaired', (g: any) => { g.sheet.retained = g.sheet.retained.slice(0, 1); }, 'companion_sheet_views'],
    ['a front the prior review did not pass', (_g: any, c: any) => { c.outcome.sheets[0].views.front.verdict = viewVerdict('front', true); }, 'companion_sheet_front'],
    ['a three-quarter other than the judged one', (_g: any, c: any) => { c.outcome.sheets[0].views.three_quarter_front.sha256 = '4'.repeat(64); }, 'companion_sheet_three_quarter'],
    ['a prior outcome of another grant', (_g: any, c: any) => { c.outcome.grantSha256 = '5'.repeat(64); }, 'companion_sheet_repair_prior'],
    ['a prior outcome with an unknown cost', (_g: any, c: any) => { c.outcome.spend.unknownCost = 1; }, 'companion_sheet_repair_prior'],
    ['a prior spend other than the outcome\'s', (g: any) => { g.ledger.priorKnownApiMicroUsd = 0; }, 'companion_sheet_repair_prior'],
    ['prior calls other than the outcome\'s', (g: any) => { g.ledger.priorCalls = 11; }, 'companion_sheet_repair_prior'],
    ['a prior set that is not pending', (_g: any, c: any) => { c.outcome.sheets[0].status = 'passed'; }, 'companion_sheet_repair_prior'],
    ['a cumulative cap above $2.50', (g: any, c: any) => { g.ledger.priorKnownApiMicroUsd = 1000001; c.outcome.spend.newKnownApiMicroUsd = 1000001; }, 'companion_sheet_repair_cap'],
    ['another geometry', (g: any) => { g.sheet.geometrySha256 = '6'.repeat(64); }, 'companion_sheet_geometry'],
    ['a body that disagrees with the geometry counts', (g: any, c: any) => { g.sheet.body = { ...MOMO_BODY, ears: 3 }; c.draft.companions.elephant_momo.body = g.sheet.body; }, 'companion_sheet_geometry'],
    ['a call ceiling other than renders + one review', (g: any) => { g.maxCalls = 2; }, 'companion_sheet_calls'],
    ['a changed source pin', (g: any) => { g.source.files['scripts/personal-simple-book-reviewed-audition.ts'] = '0'.repeat(64); }, 'companion_sheet_source'],
    ['an existing output folder', (g: any) => { mkdirSync(g.out); }, 'companion_sheet_out'],
  ])('refuses %s', async (_label, edit, code) => {
    const s = await scratchRepair(edit as never);
    expect(() => admitCompanionSheetRepairGrant(s.grantFile)).toThrow(code);
  });
  it('refuses a prior QA that is not a PASS or names another outcome; refuses a cap above $1.50 or more than 3 calls by schema', async () => {
    for (const qa of [(o: string) => `DISPOSITION: HOLD\nOUTCOME_SHA256: ${o}\n`, () => `DISPOSITION: PASS\nOUTCOME_SHA256: ${'7'.repeat(64)}\n`]) {
      const s = await scratchRepair(undefined, { qa });
      expect(() => admitCompanionSheetRepairGrant(s.grantFile)).toThrow('companion_sheet_repair_prior');
    }
    for (const edit of [(g: any) => { g.capMicroUsd = 1500001; }, (g: any) => { g.maxCalls = 4; }, (g: any) => { g.sheet.repair = ['side', 'three_quarter_back', 'happy']; }]) {
      const s = await scratchRepair(edit);
      expect(() => admitCompanionSheetRepairGrant(s.grantFile)).toThrow();
    }
  });
});

describe('CSR-1 repair run (fake providers): two contract renders, one review, pass or pending, never a redraw', () => {
  afterEach(() => vi.restoreAllMocks());
  it('all pass: 3 calls; the published set is the granted front, the retained judged bytes and the two new renders, exactly as judged', async () => {
    const s = await scratchRepair(), f = fakes([verdicts()]);
    const r = await runCompanionSheetRepair({ grantFile: s.grantFile, keyFile: s.keyFile, signal: signal(), providers: f.providers });
    expect(r.stopped).toBeUndefined(); expect([f.calls.generate, f.calls.review]).toEqual([2, 1]);
    expect(r.spend).toMatchObject({ calls: 3, maxCalls: 3, capMicroUsd: 1500000, unknownCost: 0 });
    expect(r.cumulative).toMatchObject({ priorKnownApiMicroUsd: 350982, priorCalls: 12, cumulativeCalls: 15,
      cumulativeAccountedMicroUsd: 350982 + r.spend.cumulativeAccountedMicroUsd, cumulativeCapMicroUsd: 2500000 });
    expect(r.sheets[0]).toMatchObject({ status: 'passed', reviews: ['repair_elephant_momo_review'] });
    const sent = judgedImages(f.calls.payloads[0]);
    expect(sent.front).toBe(s.grant.sheet.front.sha256); expect(sent.three_quarter_front).toBe(s.grant.sheet.threeQuarter.sha256);
    expect(sent.happy).toBe(s.grant.sheet.retained[0].image.sha256); expect(sent.theme).toBe(s.grant.sheet.retained[1].image.sha256);
    expect(sent.side).toBe(paid(s.grant.out, 'repair_elephant_momo_side', 'receipt').candidate.imageSha);
    expect(sent.three_quarter_back).toBe(paid(s.grant.out, 'repair_elephant_momo_three_quarter_back', 'receipt').candidate.imageSha);
    const set = path.join(s.grant.out, 'sheets', 'elephant_momo', 'style01-sheets'), manifest = JSON.parse(readFileSync(path.join(set, 'manifest.json'), 'utf8'));
    for (const view of COMPANION_SHEET_VIEW_KINDS) { expect(manifest.views[view].sha256).toBe(sent[view]); expect(sha(readFileSync(path.join(set, manifest.views[view].filename)))).toBe(sent[view]); }
    // Each render's wire is the v2 contract wire of its own view; the review is v2 with every view's contract.
    for (const view of ['side', 'three_quarter_back']) expect(paid(s.grant.out, `repair_elephant_momo_${view}`, 'wire'))
      .toMatchObject({ sheetPlan: 'companion-sheet-wire/v2', sheetView: view, sheetContract: { view, version: 'companion-sheet-view-contract/v1' } });
    expect(f.calls.payloads[0].metadata.companion_sheet_review).toBe('companion-sheet-review/v2');
    expect(JSON.parse(readFileSync(path.join(s.grant.out, 'outcome.json'), 'utf8')).version).toBe('companion-sheet-repair-outcome/v1');
  });
  it('a held view (or front) after the repair: pending at 3 calls, no redraw, no re-review, no set', async () => {
    for (const [held, reason] of [[['side'], 'held_after_repair'], [['front', 'theme'], 'front_held']] as const) {
      const s = await scratchRepair(), f = fakes([verdicts([...held]), verdicts()]);
      const r = await runCompanionSheetRepair({ grantFile: s.grantFile, keyFile: s.keyFile, signal: signal(), providers: f.providers });
      expect(r.sheets[0]).toMatchObject({ status: 'pending', reason }); expect([f.calls.generate, f.calls.review, r.spend.calls]).toEqual([2, 1, 3]);
      expect(existsSync(path.join(s.grant.out, 'sheets'))).toBe(false);
    }
    expect(companionSheetRepairDisposition(verdicts())).toEqual({ status: 'passed' });
    const sneaky = verdicts(); sneaky.views[3] = { ...sneaky.views[3], accessoryConsistent: false };
    expect(companionSheetRepairDisposition(sneaky)).toEqual({ status: 'pending', reason: 'held_after_repair' });
  });
  it('an unknown cost, an invalid answer or a provider failure stops with no further call and no set', async () => {
    for (const [reviews, opts, code, calls, unknown] of [[['unknown'], {}, 'companion_sheet_review_invalid', [2, 1], 1],
      [['schema'], {}, 'companion_sheet_review_schema', [2, 1], 0], [[], { imageUsage: null }, 'audition_unknown_cost', [1, 0], 1],
      [[], { imageThrowsAt: 1 }, 'companion_sheet_image_provider_failed', [1, 0], 1]] as const) {
      const s = await scratchRepair(), f = fakes([...reviews] as never, opts as never);
      const r = await runCompanionSheetRepair({ grantFile: s.grantFile, keyFile: s.keyFile, signal: signal(), providers: f.providers });
      expect(r.stopped?.code).toBe(code); expect([f.calls.generate, f.calls.review]).toEqual(calls); expect(r.spend.unknownCost).toBe(unknown);
      expect(r.sheets[0].status).toBe('stopped'); expect(existsSync(path.join(s.grant.out, 'sheets'))).toBe(false);
    }
  });
  it('the repair lease, not the S1 lease: absent → nothing created; revoked after a claim → no key, no call; lost in flight → result unused', async () => {
    let s = await scratchRepair(undefined, { registryPhase: COMPANION_SHEETS_EXECUTING_PHASE }), f = fakes([verdicts()]);
    await expect(runCompanionSheetRepair({ grantFile: s.grantFile, keyFile: s.keyFile, signal: signal(), providers: f.providers })).rejects.toThrow('companion_sheet_lease');
    expect(existsSync(s.grant.out)).toBe(false);
    s = await scratchRepair(); f = fakes([verdicts()]);
    const spy = revokeAfterClaim(s.grant.registry, 'repair_elephant_momo_side');
    let r = await runCompanionSheetRepair({ grantFile: s.grantFile, keyFile: path.join(s.dir, 'no-key.env'), signal: signal(), providers: f.providers });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(r.stopped?.code).toBe('companion_sheet_lease'); expect([f.calls.generate, f.calls.review, f.calls.keys.length]).toEqual([0, 0, 0]);
    expect(r.spend).toMatchObject({ calls: 1, unknownCost: 1 });
    vi.restoreAllMocks();
    s = await scratchRepair(); f = fakes([verdicts()], { onReview: () => revoke(s.grant.registry) });
    r = await runCompanionSheetRepair({ grantFile: s.grantFile, keyFile: s.keyFile, signal: signal(), providers: f.providers });
    expect(r.stopped?.code).toBe('companion_sheet_lease'); expect(r.sheets[0]).toMatchObject({ status: 'stopped', views: {} });
    expect(paid(s.grant.out, 'repair_elephant_momo_review', 'result')).toMatchObject({ completed: true });
    expect(existsSync(path.join(s.grant.out, 'sheets'))).toBe(false);
  });
  it('a retained working copy changed during the review: nothing is published; a consumed repair grant cannot run again', async () => {
    const s = await scratchRepair(), f = fakes([verdicts()], { onReview: () => { const file = path.join(s.grant.out, 'illustrations', 'elephant_momo_happy_retained.png');
      writeFileSync(file, Buffer.concat([readFileSync(file), Buffer.from('x')])); } });
    const r = await runCompanionSheetRepair({ grantFile: s.grantFile, keyFile: s.keyFile, signal: signal(), providers: f.providers });
    expect(r.stopped?.code).toBe('companion_sheet_reviewed_bytes_changed'); expect(existsSync(path.join(s.grant.out, 'sheets'))).toBe(false);
    await expect(runCompanionSheetRepair({ grantFile: s.grantFile, keyFile: s.keyFile, signal: signal(), providers: f.providers })).rejects.toThrow('companion_sheet_out');
  });
});