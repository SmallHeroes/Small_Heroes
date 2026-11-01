import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { replanFixture } from './storyboard-replan-fixture';
import { resolvePersonalWizardOptions } from '../options';
import { prepareSimpleStory } from '../simple-story-engine';
import { runSimpleStoryboardDiagnostic } from '../simple-storyboard-diagnostic';
import { prepareCurrentPersonalStoryboard, compilePersonalStoryboard, currentPersonalStoryboardFrame } from '../storyboard';
import { nativeBookContinuitySchema, nativeBookContinuityContracts, NATIVE_BOOK_CONTINUITY_VERSION } from '../engine-continuity-contracts';
import { COMPANION_SCALE_SAMPLE_GATE } from '../companion-scale';
import { sourceSpans } from '../storyboard-claim-basis';
import { trialConfigSchema, trialRunContracts, trialAuditionContracts, trialBookVisualQualification, trialSelectedPages,
  BOOK_E2E_TRIAL, MOMENTUM_BOOK_TRIAL, PORTRAIT_BOOK_TRIAL, READER_SAFE_BOOK_TRIAL, bookTrialPolicy, planBookSourceContinuation, planBookStoryboardSpanContinuation } from '../../../scripts/personal-book-e2e-trial';
import { admitReviewedStoryboardBundle, loadReviewedStoryboard, loadReviewedBook, reviewedBookLayoutSchema } from '../../../scripts/personal-simple-book-reviewed-audition';
import { REFERENCE_QUALIFICATION_VERSION, LANDMARK_COVERAGE_TOPOLOGY_VERSION } from '../simple-book-reviewed-audition';
import { previewSha } from '../../local-story-preview';
import { canonicalJson } from '../request-acceptance';

const policy = () => ({ version: NATIVE_BOOK_CONTINUITY_VERSION, sample: [1, 2] });
const visual = () => ({ engineContinuity: policy(), referenceQualification: REFERENCE_QUALIFICATION_VERSION,
  sampleScaleGate: COMPANION_SCALE_SAMPLE_GATE, pageAttempts: 1, materialSceneRepair: false, structuralAnatomy: true,
  landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION });
const baseConfig = () => ({ version: 'book-e2e-trial-config/v1', cycle: BOOK_E2E_TRIAL.id, ownerFile: 'C:/synthetic-owner', ownerSha: 'a'.repeat(64),
  bookDir: 'C:/synthetic-book', profileFile: 'C:/synthetic-profile', profileSha: 'b'.repeat(64), executable: 'C:/synthetic-exe',
  executableSha256: 'c'.repeat(64), keyFile: 'C:/never-read' });

describe('native CDE versioned config and shared contract bindings, no new authority', () => {
  it('leaves every legacy cycle unmarked and accepts only explicit prospective CDE policy', () => {
    expect(trialConfigSchema.parse(baseConfig())).not.toHaveProperty('engineContinuity');
    for (const cycle of [BOOK_E2E_TRIAL.id, READER_SAFE_BOOK_TRIAL.id, PORTRAIT_BOOK_TRIAL.id, MOMENTUM_BOOK_TRIAL.id]) {
      const old = trialRunContracts(cycle);
      expect(old).not.toHaveProperty('engineContinuity'); expect(old).not.toHaveProperty('instanceDistinctionContract');
      expect(trialRunContracts(cycle, false, policy())).toEqual({ ...old, instanceDistinctionContract: true,
        engineContinuity: { materialFunction: true, companionScale: true } });
    }
    expect(trialConfigSchema.parse({ ...baseConfig(), engineContinuity: policy() }).engineContinuity).toEqual(policy());
    expect(nativeBookContinuityContracts()).toBeUndefined();
    const marked=trialConfigSchema.parse({...baseConfig(),engineContinuity:policy()});
    for(const plan of [planBookSourceContinuation,planBookStoryboardSpanContinuation])expect(()=>plan(marked)).toThrow('trial_continuity_fresh_scope');
    expect(()=>trialRunContracts(PORTRAIT_BOOK_TRIAL.id,true,policy())).toThrow('trial_continuity_fresh_scope');
  });
  it.each([null, true, {}, { ...policy(), version: 'native-book-continuity/v0' }, { ...policy(), sample: [] },
    { ...policy(), sample: [0, 1] }, { ...policy(), sample: [2, 1] }, { ...policy(), sample: [1, 1] },
    { ...policy(), sample: [1, 2, 3] }, { ...policy(), sample: [1.5] }, { ...policy(), sample: [9] },
    { ...policy(), apiCapMicroUsd: 999999999 }])('rejects malformed/unbounded opt-in %# before file/provider work', bad => {
    expect(nativeBookContinuitySchema.safeParse(bad).success).toBe(false);
    expect(trialConfigSchema.safeParse({ ...baseConfig(), engineContinuity: bad }).success).toBe(false);
  });
  it('binds sequential sample and qualified references; no full-cohort or partial declaration can bypass it', () => {
    expect(trialAuditionContracts({})).toEqual({});
    expect(trialAuditionContracts(visual())).toEqual({ referenceQualification: REFERENCE_QUALIFICATION_VERSION,
      sample: [1, 2], sampleScaleGate: COMPANION_SCALE_SAMPLE_GATE });
    for (const changed of [{ freshCohort: 'audition-fresh-cohort/v1' }, { referenceQualification: undefined }, { structuralAnatomy: undefined },
      { landmarkTopology: undefined }, { pageAttempts: 3 }, { materialSceneRepair: true }, { sampleScaleGate: undefined }, { engineContinuity: null }])
      expect(() => trialAuditionContracts({ ...visual(), ...changed })).toThrow('trial_visual_contract');
    expect(() => trialAuditionContracts({ sampleScaleGate: COMPANION_SCALE_SAMPLE_GATE })).toThrow('trial_visual_contract');
  });
});

describe('actual dry-plan code, virtual filesystem only and key read denied',()=>{
  const source=readFileSync(path.resolve(__dirname,'../../../scripts/personal-book-e2e-trial.ts'),'utf8');
  const start=source.indexOf('function planTrialInputs('),end=source.indexOf('export function planBookTrial',start);
  const js=transformSync(source.slice(start,end)+'\nglobalThis.plan=planTrialInputs;',{loader:'ts',format:'cjs'}).code;
  function run(marked:boolean,consumed=false){
    const reads:string[]=[],keyFile='C:/GNart/Work/Small_Heroes/.env.local';
    const config=trialConfigSchema.parse({...baseConfig(),ownerSha:'a'.repeat(64),profileSha:'a'.repeat(64),executableSha256:'a'.repeat(64),keyFile,
      ...(marked?{engineContinuity:policy()}:{})});
    const c:any={trialConfigSchema,bookTrialPolicy,BOOK_E2E_TRIAL,READER_SAFE_BOOK_TRIAL,PORTRAIT_BOOK_TRIAL,MOMENTUM_BOOK_TRIAL,
      nativeBookContinuitySchema,nativeBookContinuityContracts,trialRunContracts,path,source:'C:/synthetic-source',
      previewSha,canonicalJson,REFERENCE_QUALIFICATION_VERSION,COMPANION_SCALE_SAMPLE_GATE,LANDMARK_COVERAGE_TOPOLOGY_VERSION,
      AUDITION_FRESH_COHORT_VERSION:'audition-fresh-cohort/v1',PINNED:['synthetic-parent.ts'],CHILD_ANCHOR_TECHNIQUE_MANIFEST:[],
      validateTrialProfile:()=>({profile:{companionId:'elephant_momo'},options:{companions:[{id:'elephant_momo'}]},prepared:{accepted:{requestId:'d'.repeat(64)}}}),
      shaFile:()=> 'a'.repeat(64),read:(file:string)=>{reads.push(file);if(file===keyFile)throw Error('KEY_FORBIDDEN');return{};},
      readFileSync:(file:string)=>{reads.push(file);if(file===keyFile)throw Error('KEY_FORBIDDEN');return '2026-10-23 ONE NEW יש אישור לתשלום';},
      git:(...args:string[])=>args[0]==='status'?'':args[0]==='branch'?'claude/book-render-20261009':'e'.repeat(40),
      realDirectory(){},inside:()=>false,existsSync:(file:string)=>consumed&&file.endsWith(BOOK_E2E_TRIAL.claim),
      lstatSync:()=>({isFile:()=>true,isSymbolicLink:()=>false}),companionIdentityReference:()=>({file:'C:/synthetic-reference.png'}),
      resolveChildAnchorTechnique:()=>({version:'synthetic-technique-only'}),fail:(code:string)=>{throw Error(code);}};
    vm.createContext(c);vm.runInContext(js,c);return {plan:()=>c.plan(config),reads,keyFile};
  }
  it('binds native flags, sample, reference qualification and all new source pins without changing limits or creating authority',()=>{
    expect(start).toBeGreaterThan(0);expect(end).toBeGreaterThan(start);
    const old=run(false),next=run(true),a=old.plan(),b=next.plan();
    expect(a.contracts).not.toHaveProperty('engineContinuity');expect(a.visual).not.toHaveProperty('engineContinuity');
    expect(a.visual.freshCohort).toBe('audition-fresh-cohort/v1');expect(a.visual.materialSceneRepair).toBe(true);
    expect(b.visual.freshCohort).toBeUndefined();expect(b.visual.materialSceneRepair).toBe(false);
    expect(b.contracts).toMatchObject({instanceDistinctionContract:true,engineContinuity:{materialFunction:true,companionScale:true}});
    expect(trialAuditionContracts(b.visual)).toMatchObject({sample:[1,2],sampleScaleGate:COMPANION_SCALE_SAMPLE_GATE});
    expect(b.limits).toEqual(a.limits);expect(b.cycle).toBe(a.cycle);expect(b.engine).toEqual(a.engine);expect(b.configSha).not.toBe(a.configSha);
    for(const f of ['engine-continuity-contracts','storyboard-instance-distinction','storyboard-material-function','companion-scale','companion-scale-authority','personal-companions'])
      expect(Object.keys(b.pins)).toContain('lib/personal-wizard/'+f+'.ts');
    expect(old.reads).not.toContain(old.keyFile);expect(next.reads).not.toContain(next.keyFile);
  });
  it('the same native dry-plan still rejects a consumed historical claim before execution; opting into CDE is no reset',()=>{
    const r=run(true,true);expect(()=>r.plan()).toThrow('trial_consumed');expect(r.reads).not.toContain(r.keyFile);
  });
});

async function compiledBundle() {
  const f = await replanFixture('elephant_momo', resolvePersonalWizardOptions()), flags = Array(16).fill(undefined);
  flags[0] = true; flags[2] = true; flags[15] = true;
  const source = prepareCurrentPersonalStoryboard(...([f.request, f.writerResult, f.options, ...flags,
    { materialFunction: true, companionScale: true }] as unknown as Parameters<typeof prepareCurrentPersonalStoryboard>));
  const draft = structuredClone(f.draft) as any;
  draft.plan.continuity.companionStandingHeightInChildHeights = .7;
  for (const location of draft.plan.locations) location.population = [];
  for (const e of draft.plan.continuity.entities) { e.invariants.push({ attribute: 'kind', value: e.id === 'hut' ? 'hut' : 'ribbon' }); e.builtFrom = null; }
  const sentence = sourceSpans([f.writerResult.manuscript.title, ...f.writerResult.manuscript.pages.map(p => p.text)]).p1[0];
  draft.plan.continuity.entities[0].builtFrom = { sources: [{ entityId: 'ribbon' }], evidence: { citation: sentence.id, quote: sentence.text } };
  const book = compilePersonalStoryboard(source, draft), rawReview = { ...structuredClone(f.review), sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest };
  const current = { request: f.request, writerResult: f.writerResult, options: f.options };
  const board = { status: 'review_supported', storyboard: book, rawReview,
    framePackets: Array.from({ length: 9 }, (_, n) => currentPersonalStoryboardFrame(book, rawReview, n, current)) };
  const prepared = prepareSimpleStory(f.request, f.options, 'diagnostic-fixture');
  const queued = { version: 'local-simple-wizard-request/v1', requestId: prepared.accepted.requestId,
    optionsFingerprint: prepared.accepted.optionsFingerprint, request: prepared.accepted.canonical };
  const layout = reviewedBookLayoutSchema.parse({ version: 'reviewed-book-layout/v1', seed: 'diagnostic-fixture',
    childDesign: 'A generic fictional child for provider-free native admission only.', storyboardDir: 'story', childDir: 'child', childImage: 'reference_child.png', savedCompanion: null });
  return { bundle: { queued, result: { status: board.status, source: f.writerResult, storyboard: board, runtimeEligible: false }, draft }, layout, book, current };
}

describe('actual compiled CDE source admission and filesystem reload, no storyboard mocks', () => {
  let f: Awaited<ReturnType<typeof compiledBundle>>;
  beforeAll(async () => { f = await compiledBundle(); });
  it('requires explicit exact caller binding and reproduces all real compiled packets and typed source', () => {
    const before = JSON.stringify(f), binding = nativeBookContinuityContracts(policy())!;
    expect(() => admitReviewedStoryboardBundle(f.bundle, process.cwd(), f.layout)).toThrow();
    const loaded = admitReviewedStoryboardBundle(f.bundle, process.cwd(), f.layout, binding);
    expect(loaded.book).toEqual(f.book); expect(loaded.book.instanceDistinction?.version).toBe('instance-distinction/v1');
    expect(loaded.book.materialFunction?.entities).toHaveLength(1);
    expect(loaded.book.companionScale).toMatchObject({ companionId: 'elephant_momo', scale: { standingHeightInChildHeights: { min: .6, max: .75 } } });
    for (let n = 0; n < 9; n++) expect(currentPersonalStoryboardFrame(loaded.book, loaded.rawReview, n, loaded.current)).toEqual(f.bundle.result.storyboard.framePackets[n]);
    expect(JSON.stringify(f)).toBe(before);
  });
  it('CDE storyboard repair rebinds its actual parent source and review; omitted repair input still refuses',async()=>{
    const held:any=structuredClone(f.bundle.result.storyboard.rawReview);held.frames[1].checks[0].verdict='uncertain';
    const repair={parentStoryboardDigest:f.book.storyboardDigest,draft:f.bundle.draft,review:held};
    const next=await runSimpleStoryboardDiagnostic({...f.current,signal:new AbortController().signal,actorOwnedAppearance:true,landmarkKindContract:true,
      ...nativeBookContinuityContracts(policy()),repair,
      generate:async call=>structuredClone(call.stage==='storyboard'?f.bundle.draft:{...f.bundle.result.storyboard.rawReview,
        sourceDigest:call.context.sourceDigest,storyboardDigest:call.context.storyboardDigest})});
    expect(next.status).toBe('review_supported');
    const repaired={...f.bundle,result:{...f.bundle.result,status:next.status,storyboard:next},repair};
    const loaded=admitReviewedStoryboardBundle(repaired,process.cwd(),f.layout,nativeBookContinuityContracts(policy()));
    expect(loaded.book.repair).toBeDefined();expect(loaded.book.instanceDistinction).toEqual(f.book.instanceDistinction);
    expect(loaded.book.materialFunction).toEqual(f.book.materialFunction);expect(loaded.book.companionScale).toEqual(f.book.companionScale);
    const missing={...repaired} as any;delete missing.repair;
    expect(()=>admitReviewedStoryboardBundle(missing,process.cwd(),f.layout,nativeBookContinuityContracts(policy()))).toThrow('audition_repair_binding');
  });
  it.each(['instance', 'material', 'scale', 'review', 'packet', 'draft', 'source'])('rejects changed %s rather than silently downgrading the saved source', kind => {
    const changed = structuredClone(f.bundle) as any, binding = nativeBookContinuityContracts(policy())!;
    if (kind === 'instance') delete changed.result.storyboard.storyboard.instanceDistinction;
    if (kind === 'material') changed.result.storyboard.storyboard.materialFunction.entities[0].builtFrom.evidence.quote += 'invented';
    if (kind === 'scale') changed.result.storyboard.storyboard.companionScale.scale.standingHeightInChildHeights.max = 99;
    if (kind === 'review') changed.result.storyboard.rawReview.sourceDigest = 'f'.repeat(64);
    if (kind === 'packet') changed.result.storyboard.framePackets[1].render.prompt += 'changed';
    if (kind === 'draft') changed.draft.plan.locations[0].population = ['hut'];
    if (kind === 'source') changed.result.source.manuscript.pages[0].text += 'changed';
    expect(() => admitReviewedStoryboardBundle(changed, process.cwd(), f.layout, binding)).toThrow();
  });
  it('filesystem wrapper uses the same strict admission; an old replan cannot upgrade to CDE', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'native-cde-bundle-')), story = path.join(root, 'story'); mkdirSync(story);
    writeFileSync(path.join(root, 'request.json'), JSON.stringify(f.bundle.queued));
    for (const [name, value] of [['visual_simple_book_result.json', f.bundle.result], ['owned_storyboard_draft.json', f.bundle.draft]] as const)
      writeFileSync(path.join(story, name), JSON.stringify(value));
    const binding = nativeBookContinuityContracts(policy())!;
    expect(loadReviewedStoryboard(root, process.cwd(), f.layout, binding).book).toEqual(f.book);
    expect(() => loadReviewedStoryboard(root, process.cwd(), f.layout)).toThrow();
    expect(() => loadReviewedBook(root, process.cwd(), 'legacy-replan', f.layout, binding)).toThrow('audition_continuity_replan_scope');
  });
});

describe('actual native terminal selection / narration boundary (compiled source slice, virtual side effects)', () => {
  const source = readFileSync(path.resolve(__dirname, '../../../scripts/personal-book-e2e-trial.ts'), 'utf8');
  const start = source.indexOf('    const selected:SavedPage[]='), end = source.indexOf('\n  }catch(error){', start);
  const js = transformSync(`async function probe(){${source.slice(start, end)}\n}\nglobalThis.probe=probe;`, { loader: 'ts', format: 'cjs' }).code;
  const manifest = (count: number, complete: boolean, status: string, scale = 'unverified') => ({ version: 'synthetic-engine-result', status,
    scope: { complete, sample: [1, 2], frames: Array.from({ length: count }, (_, n) => n + (complete ? 0 : 1)) },
    scaleVerification: { status: scale }, pages: Array.from({ length: count }, (_, i) => ({ pageNumber: i + (complete ? 0 : 1),
      candidate: { imageName: `p${i}.png`, imageSha: String(i).repeat(64) }, status: 'qa_supported', companionScale: { disposition: 'abstain' } })) });
  async function run(m: ReturnType<typeof manifest>, momentum: boolean, marked = true) {
    const saved = new Map(m.pages.map(p => ['page_' + p.pageNumber, { pageNumber: p.pageNumber, status: p.status,
      attempts: [{}], chosen: { candidate: p.candidate, assessment: { companionScale: p.companionScale } } }]));
    const writes: string[] = [], prohibited: string[] = [], deny = (s: string) => () => { prohibited.push(s); throw Error('UNEXPECTED_' + s); };
    const c: any = { continuity: marked ? nativeBookContinuityContracts(policy()) : undefined, manifest: m, saved, trialSelectedPages, trialBookVisualQualification,
      previewSha, canonicalJson, path, config: { bookDir: 'VIRTUAL' }, result: { source: { manuscript: { title: 'Synthetic', pages: [] } } },
      meter: { snapshot: () => ({}) }, max: { snapshot: () => ({}) }, BOOK_E2E_TRIAL, sourceAdmission: undefined, sourceRepairUsed: 0, boardAttempts: 1,
      save: (s: string) => writes.push(s), writeTrialReader: () => writes.push('viewer'), finish: (status: string, data: object) => ({ status, ...data }),
      momentum, narrationPlan: { voice: 'dad_v2' }, grant: {}, imageDir: 'VIRTUAL', narrationReserve: 0,
      narrateBook: deny('NARRATION'), createNarrationTransport: deny('TRANSPORT'), elevenLabsKeyReader: deny('KEY'),
      writeLocalReaderBundle: deny('AUDIO_READER'), repairReviewedAuditionPage: deny('REPAIR'), guard() {}, log() {} };
    vm.createContext(c); vm.runInContext(js, c);
    return { outcome: await c.probe(), writes, prohibited };
  }
  it('a partial supported-page sample returns a truthful HOLD before all correction, key, narration and Reader-audio operations', async () => {
    expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
    const r = await run(manifest(2, false, 'held_sample'), true);
    expect(r.outcome).toMatchObject({ status: 'held_visual_sample', fullCoverage: false, supported: 2, bookQa: { qaSupported: false, complete: false } });
    expect(r.writes).toEqual(['final-selection', 'viewer']); expect(r.prohibited).toEqual([]);
  });
  it('nine supported pages never promote an unverified or diagnostic manifest; the real book label stays authoritative', async () => {
    for (const [status, scale] of [['held_audition_with_findings', 'unverified'], ['diagnostic_audition', 'observed_within_range']]) {
      const r = await run(manifest(9, true, status, scale), false);
      expect(r.outcome).toMatchObject({ supported: 9, fullCoverage: true, bookQa: { manifestStatus: status, qaSupported: false } });
      expect(r.prohibited).toEqual([]);
    }
    const good = await run(manifest(9, true, 'qa_supported_audition', 'observed_within_range'), false);
    expect(good.outcome.bookQa.qaSupported).toBe(true); expect(good.outcome.bookQa.productAccepted).toBe(false);
  });
  it.each(['missing','page','candidate','status','scale'] as const)('native selection rejects altered %s binding rather than trusting a supported-page label',kind=>{
    const m=manifest(2,false,'held_sample'),saved=new Map(m.pages.map(p=>['page_'+p.pageNumber,{pageNumber:p.pageNumber,status:p.status,
      attempts:[{}],chosen:{candidate:p.candidate,assessment:{companionScale:p.companionScale}}}]));
    const first=m.pages[0],record=saved.get('page_'+first.pageNumber)!;
    if(kind==='missing')saved.delete('page_'+first.pageNumber);
    if(kind==='page')record.pageNumber=8;
    if(kind==='candidate')record.chosen.candidate={...record.chosen.candidate,imageSha:'f'.repeat(64)};
    if(kind==='status')record.status='held';
    if(kind==='scale')record.chosen.assessment.companionScale={disposition:'pass'};
    expect(()=>trialSelectedPages(m as any,saved)).toThrow('trial_continuity_selection_binding');
  });
  it('unmarked native output keeps its legacy shape without the new bookQa field', async () => {
    const r = await run(manifest(9, true, 'diagnostic_audition'), false, false);
    expect(r.outcome).not.toHaveProperty('bookQa'); expect(r.outcome.supported).toBe(9);
  });
});
