/** Native one-use SAME-book successor; uses the existing renderer, judge, meter and reading-order gate. Dry by default. */
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { previewSha } from '../lib/local-story-preview';
import { canonicalJson } from '../lib/personal-wizard/request-acceptance';
import { currentPersonalStoryboardFrame } from '../lib/personal-wizard/storyboard';
import { AUDITION_ANATOMY_VERSION } from '../lib/personal-wizard/audition-anatomy';
import { auditionPageContext, assessAuditionReview, attemptStatus, selectAuditionAttempt, referenceStatus, auditionPageReviewSchemaForContext, auditionAnatomyCast,
  AUDITION_FULL_BOOK_DIAGNOSTIC_VERSION,
  illustrateReviewedAudition, reviewedAuditionPolicy, LANDMARK_DESIGN_HEAD_VERSION, LANDMARK_COVERAGE_TOPOLOGY_VERSION,
  AUDITION_WORST_CASE_CALLS, ReviewedAuditionError, type AuditionFullBookDiagnostic, type SavedPage } from '../lib/personal-wizard/simple-book-reviewed-audition';
import type { AuditionImage } from '../lib/personal-wizard/simple-book-illustrations';
import { evaluatePageChildResemblanceVision } from '../lib/generation-pipeline/page-child-resemblance-vision';
import { FRESH_BOOK_CYCLE, assertFreshBookAdmission, freshBookReadingOrder, type FreshBookEnv, type PageGate } from './personal-fresh-book-authority';
import { freshBookConfig, realFreshBookEnv, planFreshBook, freshBookLedger,
  type FreshBookConfig } from './personal-fresh-book-driver';
import { freshBookAuditionAnatomyGrantSchema as parentAnatomyGrantSchema, FRESH_BOOK_AUDITION_ANATOMY as AO } from './personal-fresh-book-anatomy';
import { AuditionMeter, auditionMeterRules, loadReviewedBook, readReviewedBookLayout, runReviewedAudition, auditionGrantSchema,
  auditionJudgePayload, digestImages, durableReviewPayload, auditionRenderPlan } from './personal-simple-book-reviewed-audition';
import { folderBaseline } from './personal-child-anchor-rereview';
import { exclusiveJson } from './personal-causal-trial-journal';
import { DURABLE_REVIEW_VERSION } from './personal-durable-review';

const hash = z.string().regex(/^[a-f0-9]{64}$/), abs = z.string().refine(path.isAbsolute);
const workspace = path.resolve(__dirname, '..');
const fail = (code: string): never => { throw new ReviewedAuditionError(code); };
const fileBytes = (f: string) => { const s = lstatSync(f); if (!s.isFile() || s.isSymbolicLink() || s.size > 32000000) fail('fresh_book_diagnostic_file'); return readFileSync(f); };
const json = (f: string) => JSON.parse(fileBytes(f).toString('utf8'));
export const FRESH_BOOK_FULL_BOOK_DIAGNOSTIC = Object.freeze({ version: AUDITION_FULL_BOOK_DIAGNOSTIC_VERSION,
  claimName: 'owner-cycle-20261017-fresh-book-usd7.audition-full-book-diagnostic.claim.json',
  outcomeName: 'owner-cycle-20261017-fresh-book-usd7.audition-full-book-diagnostic.outcome.json',
  approvalLine: 'יותר קל לשפוט על 8 איורים' });
const AA = FRESH_BOOK_FULL_BOOK_DIAGNOSTIC;
export const freshBookFullBookDiagnosticGrantSchema = parentAnatomyGrantSchema.omit({
  version: true, continuation: true, parent: true, transition: true, allowance: true, contract: true, firstReview: true }).extend({
  version: z.literal('fresh-book-full-book-diagnostic-grant/v1'), continuation: z.literal(AA.version), contract: z.literal(AUDITION_FULL_BOOK_DIAGNOSTIC_VERSION),
  configurationSha256: hash,
  firstOperation: z.object({ step: z.string().regex(/^[a-z][a-z0-9_]{0,79}$/), wireDigest: hash }).strict(),
  parent: z.object({ grantFile: abs, grantSha256: hash, claimSha256: hash, outcomeSha256: hash, admissionSha256: hash }).strict(),
  transition: z.object({ version: z.literal(AUDITION_FULL_BOOK_DIAGNOSTIC_VERSION), pages: z.array(z.object({
    page: z.number().int().min(1).max(8), priorSha256: hash, consumedAttemptsBefore: z.number().int().min(1).max(20),
  }).strict()).length(2) }).strict(),
  allowance: z.object({ maxNewCalls: z.literal(21), newFrameAttempts: z.literal(1), newSampleCalls: z.literal(0),
    newFrames: z.array(z.number().int().min(0).max(8)).length(7) }).strict(),
}).strict().superRefine((g, ctx) => {
  const parents = g.transition.pages.map(p => p.page), expected = [...Array.from({ length: 8 }, (_, i) => i + 1).filter(n => !parents.includes(n)), 0];
  if (new Set(parents).size !== 2 || canonicalJson(g.allowance.newFrames) !== canonicalJson(expected))
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['allowance', 'newFrames'], message: 'exact complementary frame scope required' });
});

export async function planFreshBookFullBookDiagnostic(config: FreshBookConfig, env: FreshBookEnv, parentGrantFile: string, approvalFile: string) {
  const refuse = (): never => fail('fresh_book_diagnostic_parent'), dir = path.join(config.bookDir, 'audition'), paid = path.join(dir, 'paid-stages');
  const at = (n: string) => path.join(env.authorityRoot, n), parentBytes = fileBytes(parentGrantFile), parentSha = previewSha(parentBytes);
  const parent = parentAnatomyGrantSchema.parse(JSON.parse(parentBytes.toString('utf8'))), base = planFreshBook(config, env);
  if (!path.isAbsolute(approvalFile) || !fileBytes(approvalFile).toString('utf8').includes(AA.approvalLine)) fail('fresh_book_diagnostic_approval');
  const approval = { file: path.resolve(approvalFile), sha256: previewSha(fileBytes(approvalFile)) }, engine = env.head();
  const pins = Object.fromEntries([...Object.keys(parent.pins), 'scripts/personal-fresh-book-diagnostic.ts'].map(n => [n, previewSha(fileBytes(path.join(workspace, n)))]));
  const bookFiles = folderBaseline(config.bookDir), authorityFiles = folderBaseline(env.authorityRoot);
  const unchanged = () => {
    if (canonicalJson(folderBaseline(config.bookDir)) !== canonicalJson(bookFiles) || canonicalJson(folderBaseline(env.authorityRoot)) !== canonicalJson(authorityFiles) ||
        previewSha(fileBytes(parentGrantFile)) !== parentSha || previewSha(fileBytes(approval.file)) !== approval.sha256 ||
        env.head().head !== engine.head || env.head().branch !== engine.branch ||
        Object.entries(pins).some(([n, sha]) => previewSha(fileBytes(path.join(workspace, n))) !== sha)) refuse();
  };
  const claim = json(at(AO.claimName)), outcome = json(at(AO.outcomeName)), admission = json(path.join(dir, 'admission-anatomy.json'));
  if (canonicalJson(claim) !== canonicalJson({ cycle: FRESH_BOOK_CYCLE.id, version: AO.version, grantSha256: parentSha, parent: parent.parent,
      ownerApproval: parent.ownerApproval, engine: parent.engine, bookDir: parent.bookDir, transition: parent.transition, allowance: parent.allowance }) ||
      outcome.cycle !== FRESH_BOOK_CYCLE.id || outcome.status !== 'held_sample' || outcome.manifestStatus !== 'held_sample' ||
      admission.grantSha256 !== parentSha || admission.contract?.version !== AUDITION_ANATOMY_VERSION ||
      canonicalJson(admission.firstReview) !== canonicalJson(parent.firstReview) || admission.parentAdmissionSha256 !== parent.parent.admissionSha256 ||
      canonicalJson(admission.provision) !== canonicalJson(parent.provision) ||
      canonicalJson(admission.policy) !== canonicalJson(reviewedAuditionPolicy(undefined, true, LANDMARK_COVERAGE_TOPOLOGY_VERSION, true)) ||
      parent.profileSha256 !== base.plan.profileSha256 || path.resolve(parent.bookDir).toLowerCase() !== path.resolve(config.bookDir).toLowerCase()) refuse();
  const ledger = freshBookLedger(config, env, base.rereview, 'child_fresh_anchor', parent.debits, [parent.provision]);
  const status = json(path.join(config.bookDir, 'book-status-anatomy.json'));
  if (canonicalJson(ledger) !== canonicalJson(outcome.ledger) || canonicalJson(ledger) !== canonicalJson(status.ledger) ||
      status.grantSha256 !== parentSha || status.status !== 'held_sample') refuse();
  await assertFreshBookAdmission(base.rereview, env); unchanged();
  const loaded = loadReviewedBook(config.bookDir, workspace, undefined, readReviewedBookLayout(path.join(config.bookDir, 'book-layout.json')));
  const original = auditionGrantSchema.parse(json(path.join(config.bookDir, 'audition.grant.json')));
  if (original.scope.mode !== 'render') return refuse();
  const scope = original.scope;
  if (original.maxCalls !== AUDITION_WORST_CASE_CALLS || original.capMicroUsd !== FRESH_BOOK_CYCLE.bookSubcapMicroUsd ||
      original.book.requestId !== loaded.queued.requestId || original.book.storyboardDigest !== loaded.book.storyboardDigest ||
      canonicalJson(scope.pages) !== canonicalJson([0, 1, 2, 3, 4, 5, 6, 7, 8]) || scope.sample?.length !== 2 ||
      scope.scaleLineup || scope.reuseSheets || scope.pageAttempts !== undefined || !original.experiment) refuse();
  const meter = new AuditionMeter(paid, original.capMicroUsd, original.maxCalls, original.ledger.priorKnownApiMicroUsd,
    0, auditionMeterRules, parent.debits, [parent.provision]).snapshot();
  if (meter.unknownCost || meter.unknownOutcome || meter.reservedUnsettledMicroUsd || original.maxCalls - meter.calls < 21) refuse();
  const readImage = (imageName: string): AuditionImage => ({ imageName, imageSha: previewSha(fileBytes(path.join(dir, 'illustrations', imageName))) });
  const bytesOf = (img: AuditionImage) => { if (!/^[a-zA-Z0-9_-]+\.png$/.test(img.imageName)) refuse();
    const b = fileBytes(path.join(dir, 'illustrations', img.imageName)); if (previewSha(b) !== img.imageSha) refuse(); return b; };
  const sheets = { entities: json(path.join(dir, 'sheet_entities.json')), locations: json(path.join(dir, 'sheet_locations.json')) };
  const refs = referenceStatus(sheets), child = readImage('reference_child.png'), companion = readImage('reference_companion.png');
  const canonical = [child, companion, refs.entities.image, refs.locations.image];
  const sourcePrefix = /^r[0-9]+_/.exec(parent.firstReview.step)?.[0] ?? refuse();
  const parentTransition = { version: admission.contract.version, pages: admission.contract.pages.map((p: any) => ({
    page: p.page, priorSha256: previewSha(canonicalJson(p.prior)), consumedAttemptsBefore: p.consumedAttemptsBefore, maxNewAttempts: p.maxNewAttempts })) };
  if (canonicalJson(parentTransition) !== canonicalJson(parent.transition) ||
      parent.configurationSha256 !== previewSha(canonicalJson(config)) || parent.engine.branch !== engine.branch) refuse();
  const renderIndices = (page: number) => readdirSync(paid).map(n => new RegExp(`^(?:r[0-9]+_)?page_${page}_([0-9]+)\\.claim\\.json$`).exec(n))
    .filter((m): m is RegExpExecArray => !!m).map(m => Number(m[1])).sort((x, y) => x - y);
  const pages: AuditionFullBookDiagnostic['pages'] = [];
  for (const [i, page] of scope.sample!.entries()) {
    const saved = json(path.join(dir, `page_${page}_anatomy.json`)) as SavedPage;
    const packet = 'ownerAcceptance' in loaded ? currentPersonalStoryboardFrame(loaded.book, loaded.rawReview, page, loaded.current, loaded.ownerAcceptance)
      : currentPersonalStoryboardFrame(loaded.book, loaded.rawReview, page, loaded.current);
    const seq = loaded.book.sequence.pages, prev = pages[i - 1]?.prior;
    const predecessor = page >= 2 && prev && prev.pageNumber === page - 1 && seq[page - 1].sceneId === seq[page - 2].sceneId ? prev.chosen.candidate : null;
    const old = auditionPageContext(loaded.book, packet.context, page, loaded.companionDescription, canonical, refs, predecessor,
      LANDMARK_DESIGN_HEAD_VERSION, LANDMARK_COVERAGE_TOPOLOGY_VERSION, true);
    if (saved.pageNumber !== page || saved.contextSha !== old.contextSha ||
        canonicalJson(saved.requirementIds) !== canonicalJson(old.checks.requirementIds) || !saved.attempts.length ||
        new Set(saved.attempts.map(a => a.attempt)).size !== saved.attempts.length) refuse();
    for (const a of saved.attempts) {
      if (!a.candidate || !a.review || !a.assessment) refuse();
      const sourceStep = `${sourcePrefix}page_${page}_${a.attempt}`, candidate = a.candidate!;
      const oldWire = json(path.join(paid, `${sourceStep}_qa.wire.json`));
      const context = JSON.parse(oldWire.input[0].content[0].text).context;
      if (canonicalJson(context) !== canonicalJson(old.context) ||
          canonicalJson(a.review) !== canonicalJson(auditionPageReviewSchemaForContext(context).parse(JSON.parse(
            json(path.join(paid, `${sourceStep}_qa.receipt.json`)).raw.output_text)))) refuse();
      bytesOf(candidate);
      const oldPayload = durableReviewPayload(await auditionJudgePayload({ candidate, candidateBytes: bytesOf(candidate),
        context: old.context, contextSha: old.contextSha, refs: canonical.map(bytesOf), predecessor: predecessor ? bytesOf(predecessor) : null, kind: 'page' }));
      if (canonicalJson(digestImages(oldPayload)) !== canonicalJson(oldWire)) refuse();
      const identityReceipt = json(path.join(paid, `${sourceStep}_identity.receipt.json`));
      const identity = await evaluatePageChildResemblanceVision({ referenceImageUrl: `data:image/png;base64,${bytesOf(child).toString('base64')}`,
        candidateImageUrl: `data:image/png;base64,${bytesOf(candidate).toString('base64')}`, threshold: .7, model: 'gpt-4o',
        apiKey: 'offline-receipt-replay-not-a-key', maxRetries: 0, fetchImpl: async (_url, init) => {
          if (canonicalJson(digestImages(JSON.parse(String(init!.body)))) !== canonicalJson(json(path.join(paid, `${sourceStep}_identity.wire.json`)))) refuse();
          return new Response(JSON.stringify(identityReceipt.raw), { status: identityReceipt.status });
        } });
      if (canonicalJson(identity) !== canonicalJson(a.identity)) refuse();
      unchanged();
      const assessment = assessAuditionReview(a.review, candidate.imageSha, old.contextSha, old.checks.requirementIds,
        old.checks.uniqueLandmarks, LANDMARK_COVERAGE_TOPOLOGY_VERSION, auditionAnatomyCast(old.context)).assessment;
      if (assessment.safetyBlocked || canonicalJson(assessment) !== canonicalJson(a.assessment) ||
          a.status !== attemptStatus('page', { ...a, assessment })) refuse();
    }
    const chosen = selectAuditionAttempt('page', saved.attempts) ?? refuse(), renders = renderIndices(page);
    if (canonicalJson(chosen) !== canonicalJson(saved.chosen) || saved.status !== attemptStatus('page', chosen) ||
        saved.status !== (i === 0 ? 'qa_supported' : 'held') || renders.some((n, index) => n !== index) || renders.length !== (i === 0 ? 2 : 6)) refuse();
    pages.push({ page, consumedAttemptsBefore: renders.length, prior: saved });
  }
  const newFrames = [...scope.pages.filter(n => n > 0 && !scope.sample!.includes(n)).sort((a, b) => a - b), 0];
  if (newFrames.length !== 7 || newFrames.some(n => renderIndices(n).length ||
      existsSync(path.join(dir, `page_${n}_diagnostic.json`)) || existsSync(path.join(dir, `diagnostic_render_${n}.json`)))) refuse();
  const contract: AuditionFullBookDiagnostic = { version: AUDITION_FULL_BOOK_DIAGNOSTIC_VERSION, pages };
  const markers = Object.keys(bookFiles).filter(n => /^audition\/resume-[0-9]+\.json$/.test(n)).length + 1;
  let first: { step: string; prompt: string; refs: AuditionImage[]; mode: 'book_identity' } | undefined;
  try { await illustrateReviewedAudition({ book: loaded.book, rawReview: loaded.rawReview, texts: loaded.texts, current: loaded.current,
    child, companion, companionDescription: loaded.companionDescription, pages: scope.pages, sample: scope.sample,
    ...('ownerAcceptance' in loaded ? { ownerAcceptance: loaded.ownerAcceptance } : {}), recovery: true,
    landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION, structuralAnatomy: true, fullBookDiagnostic: contract,
    resume: { designs: json(path.join(dir, 'audition_sheet_designs.json')), sheets, pages: {}, stepPrefix: `r${markers}_` },
    render: async (step, prompt, refs, mode, roles) => {
      if (mode !== 'book_identity' || roles !== undefined) return refuse();
      first = { step, prompt, refs, mode }; throw new ReviewedAuditionError('fresh_book_diagnostic_preview'); },
    judge: async () => refuse(), identity: async () => refuse(), save: () => refuse(),
    check: () => { unchanged(); if (first) fail('fresh_book_diagnostic_preview'); } });
  } catch (e) { if (!first || (e as { code?: string }).code !== 'fresh_book_diagnostic_preview') throw e; }
  if (!first || first.step !== `r${markers}_page_${newFrames[0]}_0`) return refuse();
  const payload = auditionRenderPlan(path.join(dir, 'illustrations'), first.prompt, first.refs, first.mode).wire;
  unchanged();
  const roots = { bookFiles, authorityFiles };
  const plan = { version: AA.version, continuation: AA.version, cycle: FRESH_BOOK_CYCLE.id, ownerApproval: approval,
    configurationSha256: previewSha(canonicalJson(config)), profileSha256: base.plan.profileSha256, bookDir: path.resolve(config.bookDir),
    parent: { grantFile: path.resolve(parentGrantFile), grantSha256: parentSha, claimSha256: previewSha(fileBytes(at(AO.claimName))),
      outcomeSha256: previewSha(fileBytes(at(AO.outcomeName))), admissionSha256: bookFiles['audition/admission-anatomy.json'] },
    auditionFolderSha256: previewSha(canonicalJson(folderBaseline(dir))), rootsSha256: previewSha(canonicalJson(roots)),
    debits: parent.debits, provision: parent.provision, ledger, contract: AUDITION_FULL_BOOK_DIAGNOSTIC_VERSION, durableReview: DURABLE_REVIEW_VERSION,
    transition: { version: AUDITION_FULL_BOOK_DIAGNOSTIC_VERSION, pages: pages.map(({ page, prior, consumedAttemptsBefore }) =>
      ({ page, priorSha256: previewSha(canonicalJson(prior)), consumedAttemptsBefore })) },
    firstOperation: { step: first.step, wireDigest: previewSha(canonicalJson(payload)) },
    allowance: { maxNewCalls: 21 as const, newFrameAttempts: 1 as const, newSampleCalls: 0 as const, newFrames }, providerCalls: 0, keyRead: false };
  const { providerCalls: _p, keyRead: _k, ...bound } = plan;
  const grantDraft = freshBookFullBookDiagnosticGrantSchema.parse({ ...bound, version: 'fresh-book-full-book-diagnostic-grant/v1',
    engine: { head: engine.head, branch: engine.branch }, pins, nativePlanSha256: previewSha(canonicalJson(plan)) });
  return { plan, grantDraft, state: { engine, claimExists: existsSync(at(AA.claimName)), outcomeExists: existsSync(at(AA.outcomeName)) },
    roots, contract, base, original };
}

export async function runFreshBookFullBookDiagnostic(a: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string;
  signal: AbortSignal; log: (line: string) => void }) {
  const bytes = fileBytes(a.grantFile), refuse = (): never => fail('fresh_book_diagnostic_grant');
  if (previewSha(bytes) !== a.grantSha) refuse();
  const g = freshBookFullBookDiagnosticGrantSchema.parse(JSON.parse(bytes.toString('utf8')));
  const p = await planFreshBookFullBookDiagnostic(a.config, a.env, g.parent.grantFile, g.ownerApproval.file);
  if (canonicalJson(g) !== canonicalJson(p.grantDraft)) refuse();
  const at = (n: string) => path.join(a.env.authorityRoot, n);
  const same = () => {
    const e = a.env.head();
    if (a.signal.aborted || !e.clean || e.head !== g.engine.head || e.branch !== g.engine.branch) fail('fresh_book_source_changed');
    for (const [n, sha] of Object.entries(g.pins)) if (previewSha(fileBytes(path.join(workspace, n))) !== sha) fail('fresh_book_source_changed');
    for (const [f, sha] of [[a.grantFile, a.grantSha], [g.ownerApproval.file, g.ownerApproval.sha256], [g.parent.grantFile, g.parent.grantSha256]])
      if (previewSha(fileBytes(f)) !== sha) refuse();
    for (const [rel, sha] of Object.entries(p.roots.bookFiles)) if (previewSha(fileBytes(path.join(a.config.bookDir, rel))) !== sha) refuse();
    for (const [rel, sha] of Object.entries(p.roots.authorityFiles)) if (previewSha(fileBytes(at(rel))) !== sha) refuse();
  };
  same();
  if (p.state.claimExists || p.state.outcomeExists || existsSync(at(AA.claimName)) || existsSync(at(AA.outcomeName))) fail('fresh_book_diagnostic_used');
  exclusiveJson(at(AA.claimName), { cycle: FRESH_BOOK_CYCLE.id, version: AA.version, grantSha256: a.grantSha, parent: g.parent,
    ownerApproval: g.ownerApproval, engine: g.engine, bookDir: g.bookDir, transition: g.transition, allowance: g.allowance });
  const claimSha = previewSha(fileBytes(at(AA.claimName)));
  const guard = () => { same(); if (previewSha(fileBytes(at(AA.claimName))) !== claimSha || existsSync(at(AA.outcomeName))) fail('fresh_book_diagnostic_used'); };
  const finish = (status: string, extra: Record<string, unknown>) => exclusiveJson(at(AA.outcomeName),
    { cycle: FRESH_BOOK_CYCLE.id, status, ...extra, finishedAt: new Date().toISOString() });
  try {
    const result = await runReviewedAudition({ bookDir: a.config.bookDir, out: path.join(a.config.bookDir, 'audition'), keyFile: a.config.keyEnvFile,
      grantFile: path.join(a.config.bookDir, 'audition.grant.json'), signal: a.signal, log: a.log, resume: true, debits: g.debits,
      layout: readReviewedBookLayout(path.join(a.config.bookDir, 'book-layout.json')),
      fullBookDiagnostic: { grantSha256: a.grantSha, parentAdmissionSha256: g.parent.admissionSha256,
        contract: p.contract, provision: g.provision, firstOperation: g.firstOperation },
      experiment: { slot: p.original.experiment!.slot, claimSha256: p.original.experiment!.claimSha256, guard } });
    if (result.mode !== 'render') return fail('fresh_book_audition_mode');
    const gate = (s: unknown): PageGate['disposition'] => s === 'qa_supported' ? 'passed' : 'held_uncertain';
    const cover = result.manifest.pages.find(x => x.pageNumber === 0), reading = freshBookReadingOrder(cover ? gate(cover.status) : null,
      result.manifest.pages.filter(x => x.pageNumber > 0).map(x => ({ page: x.pageNumber, disposition: gate(x.status) })));
    if (result.manifest.status !== 'diagnostic_audition' || !result.manifest.diagnostic) fail('fresh_book_diagnostic_mode');
    const fullIllustratedBook = [0, 1, 2, 3, 4, 5, 6, 7, 8].every(n => result.manifest.pages.some(p => p.pageNumber === n));
    const status = fullIllustratedBook ? 'diagnostic_complete' : 'diagnostic_partial';
    const ledger = freshBookLedger(a.config, a.env, p.base.rereview, 'child_fresh_anchor', g.debits, [g.provision]);
    exclusiveJson(path.join(a.config.bookDir, 'book-status-full-book-diagnostic.json'), { status, manifestStatus: result.manifest.status,
      order: reading.order, ledger, grantSha256: a.grantSha, fullIllustratedBook, diagnosticOnly: true, runtimeEligible: false, productAccepted: false });
    finish(status, { manifestStatus: result.manifest.status, ledger, fullIllustratedBook, diagnosticOnly: true });
    return { status, manifestStatus: result.manifest.status, order: reading.order, ledger, fullIllustratedBook, diagnosticOnly: true };
  } catch (e) {
    if (!existsSync(at(AA.outcomeName))) finish('failed_full_book_diagnostic', { code: e instanceof Error ? e.message : 'fresh_book_diagnostic_failed' });
    throw e;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  const config = freshBookConfig(arg('--config') ?? fail('fresh_book_arguments')), env = realFreshBookEnv();
  if (process.argv.includes('--resume')) fail('fresh_book_arguments');
  const task = process.argv.includes('--execute') ? runFreshBookFullBookDiagnostic({ config, env,
    grantFile: arg('--grant') ?? fail('fresh_book_arguments'), grantSha: arg('--grant-sha') ?? fail('fresh_book_arguments'),
    signal: new AbortController().signal, log: console.log }) : planFreshBookFullBookDiagnostic(config, env,
    arg('--parent-grant') ?? fail('fresh_book_arguments'), arg('--owner-approval') ?? fail('fresh_book_arguments'))
      .then(({ plan, grantDraft, state }) => ({ plan, grantDraft, state }));
  task.then(r => console.log(JSON.stringify(r, null, 2))).catch(e => { console.error(e instanceof Error ? e.message : String(e)); process.exitCode = 1; });
}
