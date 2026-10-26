import { beforeAll, describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { replanFixture } from './storyboard-replan-fixture';
import { runSimpleStoryboardDiagnostic } from '../simple-storyboard-diagnostic';
import { personalBookProviderPayload } from '../book-openai';
import { personalStoryboardReviewSchema } from '../storyboard';
import { STORYBOARD_REVIEW_CAPACITY as capacity } from '../storyboard-review-capacity';
import { simpleWizardVisualPayload } from '../../../scripts/personal-simple-wizard-worker';
import { AUDITION_REVIEW_CAPACITY_VERSION } from '../../../scripts/personal-simple-book-reviewed-audition';
import { MOMENTUM_BOOK_TRIAL, PORTRAIT_BOOK_TRIAL, READER_SAFE_BOOK_TRIAL, BOOK_E2E_TRIAL, trialRunContracts, trialApiRules } from '../../../scripts/personal-book-e2e-trial';

const BASE = { actorOwnedAppearance: true, momentContract: true, landmarkKindContract: true, sceneLocationContract: true, compilerRulesContract: true,
  drawnInstantContract: true, visibleMomentContract: true, selfCheckContract: true, reviewImpactPolicy: true, selfCheckNames: true, claimBasisContract: true,
  stagingFields: true, calibrationContract: true, presenceContract: true };
const TRIAL = path.resolve(__dirname, '../../../scripts/personal-book-e2e-trial.ts');

describe('R17-F1: the momentum cycle reaches storyboard review with the existing review input capacity', () => {
  it('run contracts: momentum opts into the storyboard review INPUT capacity; every other cycle is exactly as before', () => {
    expect(trialRunContracts(MOMENTUM_BOOK_TRIAL.id)).toEqual({ ...BASE, selfCheckSourceSpans: true, stateParityContract: true, reviewCapacity: capacity.version });
    // The image audition capacity is a different contract, kept on the policy for images only.
    expect(MOMENTUM_BOOK_TRIAL.reviewCapacity).toBe(AUDITION_REVIEW_CAPACITY_VERSION); expect(AUDITION_REVIEW_CAPACITY_VERSION).not.toBe(capacity.version);
    expect(trialRunContracts(BOOK_E2E_TRIAL.id)).toEqual(BASE);
    expect(trialRunContracts(READER_SAFE_BOOK_TRIAL.id)).toEqual({ ...BASE, selfCheckSourceSpans: true });
    expect(trialRunContracts(PORTRAIT_BOOK_TRIAL.id)).toEqual({ ...BASE, selfCheckSourceSpans: true, stateParityContract: true });
    expect(trialRunContracts(PORTRAIT_BOOK_TRIAL.id, true)).toEqual({ ...BASE, selfCheckSourceSpans: true, stateParityContract: true, reviewCapacity: capacity.version });
    for (const id of [BOOK_E2E_TRIAL.id, READER_SAFE_BOOK_TRIAL.id, PORTRAIT_BOOK_TRIAL.id]) expect(trialRunContracts(id)).not.toHaveProperty('reviewCapacity');
  });

  describe('the actual executeBookTrial orchestration forwards it to every fresh board (exact source slice, virtual stage IO)', () => {
    const source = readFileSync(TRIAL, 'utf8'), body = source.slice(source.indexOf('export async function executeBookTrial'));
    const start = body.indexOf('    let io=stageIO('), end = body.indexOf('    guard();\n    const layoutBase=');
    const js = transformSync(`async function probe(){${body.slice(start, end)}\nreturn{status:result.status,finalTextDir};}\nglobalThis.probe=probe;`, { loader: 'ts', format: 'cjs' }).code;
    it('computes its contracts once, from the shared function, and binds them to the grant', () => {
      expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
      const head = body.slice(0, start);
      expect(head.match(/const contracts=/g)).toHaveLength(1);
      expect(head).toContain('const contracts=trialRunContracts(config.cycle,!!portraitRecovery);');
      expect(head).toContain("if(momentum&&!same(grant.contracts,contracts))fail('trial_contracts_binding');");
    });
    async function run(cycle: string, o: { held?: boolean; boardHeld?: number } = {}) {
      const seen: { call: string; reviewCapacity: unknown; repair: boolean }[] = [];
      let boards = 0;
      const legacy = cycle !== MOMENTUM_BOOK_TRIAL.id, story = { title: 'Synthetic routing', pages: [{ pageNumber: 1, text: 'synthetic' }] };
      const board = () => ({ status: ++boards <= (o.boardHeld ?? 0) ? 'held_uncertain' : 'review_supported', storyboardDigest: `s${boards}`, rawReview: {} });
      const c: any = { BOOK_E2E_TRIAL, MOMENTUM_BOOK_TRIAL, trial: legacy ? PORTRAIT_BOOK_TRIAL : MOMENTUM_BOOK_TRIAL, SIMPLE_WRITING_ROLES: { label: MOMENTUM_BOOK_TRIAL.routes.writing },
        SOL_WRITING: { model: 'gpt-6.1-sol' }, portraitRecovery: null, receiptRecovery: null, bundleRecovery: null, sol: null, spanning: false, parent: null, completing: false,
        momentum: !legacy, portrait: true, readerSafe: true, continuationTextIndex: 2, sourceRepairUsed: 0, finalTextDir: 'text', sourceAdmissionSha: null, result: null,
        get boardAttempts() { return boards; }, set boardAttempts(v: number) { boards = v; },
        contracts: trialRunContracts(cycle as any), baseCurrent: {}, profile: { seed: 'fixture', child: { age: 6 } }, prepared: { accepted: { canonical: {} } }, options: {},
        signal: new AbortController().signal, config: { bookDir: 'VIRTUAL' }, grant: { requestId: 'fixture' }, policy: {}, log: () => {}, path, shaFile: () => 'f'.repeat(64),
        canonicalJson: JSON.stringify, key: () => { throw Error('KEY_FORBIDDEN'); },
        stageIO: (index: number) => ({ dir: index ? `VIRTUAL/text_${index}` : 'VIRTUAL/text', opus() {}, reader() {}, visual() {}, draft: () => ({}),
          ...(legacy ? { correctReading() {} } : { citationCorrector() {} }) }),
        runSimpleWizardBook: async (args: any) => {
          seen.push({ call: 'flow', reviewCapacity: args.reviewCapacity, repair: !!args.repair });
          return o.held ? { status: 'story_held', source: { manuscript: story }, readings: [], storyboard: null } : { status: board().status, source: {}, storyboard: { storyboardDigest: 's', rawReview: {} } };
        },
        runSimpleStoryboardDiagnostic: async (args: any) => { seen.push({ call: 'board', reviewCapacity: args.reviewCapacity, repair: !!args.repair }); return board(); },
        exclusiveJson() {}, save() {}, simpleStoryReadingPackets: () => ({ final: {} }), prepareSourceImpactReview: () => ({ packetDigest: 'p' }),
        runTrialSourceImpact: async () => ({ status: 'diagnostic_source_supported_with_notes' }),
        admittedStatus: (s: string) => s === 'review_supported' || s === 'review_supported_with_notes', finish: (status: string) => ({ status }), fail: (code: string) => { throw Error(code); } };
      vm.createContext(c); vm.runInContext(js, c);
      return { out: await c.probe(), seen };
    }
    it('initial board inside the flow (clean momentum source): marked', async () => {
      const r = await run(MOMENTUM_BOOK_TRIAL.id);
      expect(r.out.status).toBe('review_supported'); expect(r.seen).toEqual([{ call: 'flow', reviewCapacity: capacity.version, repair: false }]);
    });
    it('a board repair after the flow board was held: marked', async () => {
      const r = await run(MOMENTUM_BOOK_TRIAL.id, { boardHeld: 1 });
      expect(r.seen).toEqual([{ call: 'flow', reviewCapacity: capacity.version, repair: false }, { call: 'board', reviewCapacity: capacity.version, repair: true }]);
    });
    it('held source: the severity successor board and its repairs are marked', async () => {
      const r = await run(MOMENTUM_BOOK_TRIAL.id, { held: true, boardHeld: 2 });
      expect(r.out).toEqual({ status: 'review_supported', finalTextDir: 'text_3' });
      expect(r.seen).toEqual([{ call: 'flow', reviewCapacity: capacity.version, repair: false }, { call: 'board', reviewCapacity: capacity.version, repair: false },
        { call: 'board', reviewCapacity: capacity.version, repair: true }, { call: 'board', reviewCapacity: capacity.version, repair: true }]);
    });
    it('legacy portrait fresh run: no marker on any board, exactly as before (source repair, then successor)', async () => {
      const r = await run(PORTRAIT_BOOK_TRIAL.id, { held: true });
      expect(r.seen).toEqual([{ call: 'flow', reviewCapacity: undefined, repair: false }, { call: 'flow', reviewCapacity: undefined, repair: true },
        { call: 'board', reviewCapacity: undefined, repair: false }]);
    });
  });

  describe('the marked momentum review wire: rich input admitted under the existing bound, true oversize still refused', () => {
    let review: any;
    beforeAll(async () => {
      const f = await replanFixture();
      const r = await runSimpleStoryboardDiagnostic({ request: f.request, writerResult: f.writerResult, options: f.options, signal: new AbortController().signal,
        actorOwnedAppearance: true, reviewCapacity: trialRunContracts(MOMENTUM_BOOK_TRIAL.id).reviewCapacity, generate: async c => c.stage === 'storyboard' ? f.draft : f.review });
      review = { ...r.calls[1], schema: personalStoryboardReviewSchema };
    });
    it('the diagnostic raises only the review content limit and marks the call', () => {
      expect(review.context.reviewCapacity).toBe(capacity.version); expect(review.contentByteLimit).toBe(capacity.contentBytes);
    });
    it('the trial payload and the momentum review reservation admit a rich review; unmarked or oversized refuse', () => {
      const input = JSON.stringify({ syntheticEvidence: 'x'.repeat(140000) }), marked = simpleWizardVisualPayload({ ...review, input }, 'gpt-6.1-sol');
      expect(marked.input).toBe(input); expect(marked.metadata?.storyboard_review_capacity).toBe(capacity.version);
      expect(Buffer.byteLength(JSON.stringify(marked))).toBeLessThan(capacity.wireBytes);
      for (const step of ['momentum_s0_storyboard_review', 'momentum_s3_storyboard_review']) expect(trialApiRules(step)!.reserve(marked)).toBeGreaterThanOrEqual(600000);
      const unmarked = { ...review, input, context: { ...review.context, reviewCapacity: undefined } };
      expect(() => personalBookProviderPayload(unmarked, 'gpt-6.1-sol')).toThrow('book_provider_input_limit');
      expect(() => simpleWizardVisualPayload({ ...review, input: 'x'.repeat(240000) }, 'gpt-6.1-sol')).toThrow('book_provider_input_limit');
      expect(() => trialApiRules('momentum_s0_storyboard_review')!.reserve({ ...simpleWizardVisualPayload(review, 'gpt-6.1-sol'), input: 'x'.repeat(240000) })).toThrow('new_book_wire_limit');
    });
  });
});
