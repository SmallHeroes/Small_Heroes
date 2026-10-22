/** Native one-use SAME-book successor; uses the existing renderer, judge, meter and reading-order gate. Dry by default. */
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { previewSha } from '../lib/local-story-preview';
import { canonicalJson } from '../lib/personal-wizard/request-acceptance';
import { currentPersonalStoryboardFrame } from '../lib/personal-wizard/storyboard';
import { AUDITION_ANATOMY_VERSION } from '../lib/personal-wizard/audition-anatomy';
import { auditionPageContext, assessAuditionReview, attemptStatus, selectAuditionAttempt, referenceStatus, auditionPageReviewSchemaForContext,
  illustrateReviewedAudition, reviewedAuditionPolicy, LANDMARK_DESIGN_HEAD_VERSION, LANDMARK_COVERAGE_TOPOLOGY_VERSION,
  AUDITION_WORST_CASE_CALLS, ReviewedAuditionError, type AuditionAnatomyRecovery, type SavedCoverageContinuation } from '../lib/personal-wizard/simple-book-reviewed-audition';
import type { AuditionImage } from '../lib/personal-wizard/simple-book-illustrations';
import { evaluatePageChildResemblanceVision } from '../lib/generation-pipeline/page-child-resemblance-vision';
import { FRESH_BOOK_CYCLE, assertFreshBookAdmission, freshBookReadingOrder, type FreshBookEnv, type PageGate } from './personal-fresh-book-authority';
import { freshBookConfig, realFreshBookEnv, planFreshBook, freshBookLedger, freshBookAuditionOrphanGrantSchema,
  FRESH_BOOK_AUDITION_ORPHAN as AO, type FreshBookConfig } from './personal-fresh-book-driver';
import { AuditionMeter, auditionMeterRules, loadReviewedBook, readReviewedBookLayout, runReviewedAudition, auditionGrantSchema,
  auditionJudgePayload, digestImages, durableReviewPayload } from './personal-simple-book-reviewed-audition';
import { folderBaseline } from './personal-child-anchor-rereview';
import { exclusiveJson } from './personal-causal-trial-journal';
import { DURABLE_REVIEW_VERSION } from './personal-durable-review';

const hash = z.string().regex(/^[a-f0-9]{64}$/), abs = z.string().refine(path.isAbsolute);
const workspace = path.resolve(__dirname, '..');
const fail = (code: string): never => { throw new ReviewedAuditionError(code); };
const fileBytes = (f: string) => { const s = lstatSync(f); if (!s.isFile() || s.isSymbolicLink() || s.size > 32000000) fail('fresh_book_anatomy_file'); return readFileSync(f); };
const json = (f: string) => JSON.parse(fileBytes(f).toString('utf8'));
export const FRESH_BOOK_AUDITION_ANATOMY = Object.freeze({ version: 'audition-anatomy-recovery/v1' as const,
  claimName: 'owner-cycle-20261017-fresh-book-usd7.audition-anatomy.claim.json',
  outcomeName: 'owner-cycle-20261017-fresh-book-usd7.audition-anatomy.outcome.json',
  approvalLine: 'תבצע תיקון למנוע ולשופטים ולסדרי הפעולות' });
const AA = FRESH_BOOK_AUDITION_ANATOMY;
export const freshBookAuditionAnatomyGrantSchema = freshBookAuditionOrphanGrantSchema.omit({
  version: true, continuation: true, parent: true, transition: true, allowance: true, predecessorPlanSha256: true, contract: true }).extend({
  version: z.literal('fresh-book-audition-anatomy-grant/v1'), continuation: z.literal(AA.version), contract: z.literal(AUDITION_ANATOMY_VERSION),
  configurationSha256: hash,
  parent: z.object({ grantFile: abs, grantSha256: hash, claimSha256: hash, outcomeSha256: hash, admissionSha256: hash }).strict(),
  transition: z.object({ version: z.literal(AUDITION_ANATOMY_VERSION), pages: z.array(z.object({ page: z.number().int().min(1).max(8),
    priorSha256: hash, consumedAttemptsBefore: z.number().int().min(1).max(20), maxNewAttempts: z.number().int().min(0).max(2) }).strict()).length(2) }).strict(),
  allowance: z.object({ maxNewCalls: z.number().int().min(1).max(AUDITION_WORST_CASE_CALLS), extraFailedSampleRenders: z.literal(2),
    firstSampleRenders: z.literal(0), remainingFrameAttempts: z.literal(3) }).strict(),
}).strict();

export async function planFreshBookAuditionAnatomy(config: FreshBookConfig, env: FreshBookEnv, parentGrantFile: string, approvalFile: string) {
  const refuse = (): never => fail('fresh_book_anatomy_parent'), dir = path.join(config.bookDir, 'audition'), paid = path.join(dir, 'paid-stages');
  const at = (n: string) => path.join(env.authorityRoot, n), parentBytes = fileBytes(parentGrantFile), parentSha = previewSha(parentBytes);
  const parent = freshBookAuditionOrphanGrantSchema.parse(JSON.parse(parentBytes.toString('utf8'))), base = planFreshBook(config, env);
  if (!path.isAbsolute(approvalFile) || !fileBytes(approvalFile).toString('utf8').includes(AA.approvalLine)) fail('fresh_book_anatomy_approval');
  const approval = { file: path.resolve(approvalFile), sha256: previewSha(fileBytes(approvalFile)) }, engine = env.head();
  const pins = Object.fromEntries([...Object.keys(parent.pins), 'lib/personal-wizard/audition-anatomy.ts',
    'scripts/personal-fresh-book-anatomy.ts'].map(n => [n, previewSha(fileBytes(path.join(workspace, n)))]));
  const bookFiles = folderBaseline(config.bookDir), authorityFiles = folderBaseline(env.authorityRoot);
  const unchanged = () => {
    if (canonicalJson(folderBaseline(config.bookDir)) !== canonicalJson(bookFiles) || canonicalJson(folderBaseline(env.authorityRoot)) !== canonicalJson(authorityFiles) ||
        previewSha(fileBytes(parentGrantFile)) !== parentSha || previewSha(fileBytes(approval.file)) !== approval.sha256 ||
        env.head().head !== engine.head || env.head().branch !== engine.branch ||
        Object.entries(pins).some(([n, sha]) => previewSha(fileBytes(path.join(workspace, n))) !== sha)) refuse();
  };
  const claim = json(at(AO.claimName)), outcome = json(at(AO.outcomeName)), admission = json(path.join(dir, 'admission-coverage-orphan.json'));
  if (canonicalJson(claim) !== canonicalJson({ cycle: FRESH_BOOK_CYCLE.id, version: AO.version, grantSha256: parentSha, parent: parent.parent,
      ownerApproval: parent.ownerApproval, engine: parent.engine, bookDir: parent.bookDir, provision: parent.provision, allowance: parent.allowance }) ||
      outcome.cycle !== FRESH_BOOK_CYCLE.id || outcome.status !== 'held_sample' || outcome.manifestStatus !== 'held_sample' ||
      admission.grantSha256 !== parentSha || admission.version !== AO.version || admission.parentAdmissionSha256 !== parent.parent.admissionSha256 ||
      canonicalJson(admission.provision) !== canonicalJson(parent.provision) ||
      canonicalJson(admission.policy) !== canonicalJson(reviewedAuditionPolicy(undefined, true, LANDMARK_COVERAGE_TOPOLOGY_VERSION)) ||
      parent.profileSha256 !== base.plan.profileSha256 || path.resolve(parent.bookDir).toLowerCase() !== path.resolve(config.bookDir).toLowerCase()) refuse();
  const ledger = freshBookLedger(config, env, base.rereview, 'child_fresh_anchor', parent.debits, [parent.provision]);
  const status = json(path.join(config.bookDir, 'book-status-orphan.json'));
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
  if (meter.unknownCost || meter.unknownOutcome || meter.reservedUnsettledMicroUsd || meter.calls >= original.maxCalls) refuse();
  const readImage = (imageName: string): AuditionImage => ({ imageName, imageSha: previewSha(fileBytes(path.join(dir, 'illustrations', imageName))) });
  const bytesOf = (img: AuditionImage) => { if (!/^[a-zA-Z0-9_-]+\.png$/.test(img.imageName)) refuse();
    const b = fileBytes(path.join(dir, 'illustrations', img.imageName)); if (previewSha(b) !== img.imageSha) refuse(); return b; };
  const sheets = { entities: json(path.join(dir, 'sheet_entities.json')), locations: json(path.join(dir, 'sheet_locations.json')) };
  const refs = referenceStatus(sheets), child = readImage('reference_child.png'), companion = readImage('reference_companion.png');
  const canonical = [child, companion, refs.entities.image, refs.locations.image];
  const sourcePrefix = /^r[0-9]+_/.exec(parent.firstReview.step)?.[0] ?? refuse();
  const pages: AuditionAnatomyRecovery['pages'] = [];
  for (const [i, page] of scope.sample!.entries()) {
    const saved = json(path.join(dir, `page_${page}_coverage.json`)) as SavedCoverageContinuation, a = saved.reviewed;
    const sourceStep = `${sourcePrefix}page_${page}_${a.attempt}`;
    const oldWire = json(path.join(paid, `${sourceStep}_qa.wire.json`));
    const context = JSON.parse(oldWire.input[0].content[0].text).context;
    const packet = 'ownerAcceptance' in loaded ? currentPersonalStoryboardFrame(loaded.book, loaded.rawReview, page, loaded.current, loaded.ownerAcceptance)
      : currentPersonalStoryboardFrame(loaded.book, loaded.rawReview, page, loaded.current);
    const seq = loaded.book.sequence.pages, prev = pages[i - 1]?.prior;
    const predecessor = page >= 2 && prev && prev.pageNumber === page - 1 && seq[page - 1].sceneId === seq[page - 2].sceneId ? prev.chosen.candidate : null;
    const old = auditionPageContext(loaded.book, packet.context, page, loaded.companionDescription, canonical, refs, predecessor,
      LANDMARK_DESIGN_HEAD_VERSION, LANDMARK_COVERAGE_TOPOLOGY_VERSION);
    if (canonicalJson(context) !== canonicalJson(old.context) || saved.contextSha !== old.contextSha || !a.candidate || !a.review ||
        canonicalJson(a.review) !== canonicalJson(auditionPageReviewSchemaForContext(context).parse(JSON.parse(
          json(path.join(paid, `${sourceStep}_qa.receipt.json`)).raw.output_text)))) refuse();
    bytesOf(a.candidate!);
    const oldPayload = durableReviewPayload(await auditionJudgePayload({ candidate: a.candidate!, candidateBytes: bytesOf(a.candidate!),
      context: old.context, contextSha: old.contextSha, refs: canonical.map(bytesOf), predecessor: predecessor ? bytesOf(predecessor) : null, kind: 'page' }));
    if (canonicalJson(digestImages(oldPayload)) !== canonicalJson(oldWire)) refuse();
    const identityReceipt = json(path.join(paid, `${sourceStep}_identity.receipt.json`));
    const identity = await evaluatePageChildResemblanceVision({ referenceImageUrl: `data:image/png;base64,${bytesOf(child).toString('base64')}`,
      candidateImageUrl: `data:image/png;base64,${bytesOf(a.candidate!).toString('base64')}`, threshold: .7, model: 'gpt-4o',
      apiKey: 'offline-receipt-replay-not-a-key', maxRetries: 0, fetchImpl: async (_url, init) => {
        if (canonicalJson(digestImages(JSON.parse(String(init!.body)))) !== canonicalJson(json(path.join(paid, `${sourceStep}_identity.wire.json`)))) refuse();
        return new Response(JSON.stringify(identityReceipt.raw), { status: identityReceipt.status });
      } });
    if (canonicalJson(identity) !== canonicalJson(a.identity)) refuse();
    unchanged();
    const assessment = assessAuditionReview(a.review, a.candidate!.imageSha, old.contextSha, old.checks.requirementIds,
      old.checks.uniqueLandmarks, LANDMARK_COVERAGE_TOPOLOGY_VERSION).assessment;
    if (canonicalJson(assessment) !== canonicalJson(a.assessment) || a.status !== attemptStatus('page', { ...a, assessment }) ||
        a.status !== (i === 0 ? 'qa_supported' : 'held') || saved.status !== a.status) refuse();
    const renders = readdirSync(paid).map(n => new RegExp(`^(?:r[0-9]+_)?page_${page}_([0-9]+)\\.claim\\.json$`).exec(n))
      .filter((m): m is RegExpExecArray => !!m).map(m => Number(m[1])).sort((x, y) => x - y);
    if (renders.some((n, index) => n !== index) || renders.length !== (i === 0 ? 2 : 4)) refuse();
    const chosen = selectAuditionAttempt('page', [a]) ?? refuse();
    pages.push({ page, consumedAttemptsBefore: renders.length, maxNewAttempts: i === 0 ? 0 : 2,
      prior: { pageNumber: page, contextSha: old.contextSha, requirementIds: old.checks.requirementIds, attempts: [a], chosen, status: a.status } });
  }
  const contract: AuditionAnatomyRecovery = { version: AUDITION_ANATOMY_VERSION, pages };
  const markers = Object.keys(bookFiles).filter(n => /^audition\/resume-[0-9]+\.json$/.test(n)).length + 1;
  let first: { step: string; candidate: AuditionImage; context: unknown; contextSha: string; refs: AuditionImage[]; predecessor: AuditionImage | null } | undefined;
  try { await illustrateReviewedAudition({ book: loaded.book, rawReview: loaded.rawReview, texts: loaded.texts, current: loaded.current,
    child, companion, companionDescription: loaded.companionDescription, pages: scope.pages, sample: scope.sample,
    ...('ownerAcceptance' in loaded ? { ownerAcceptance: loaded.ownerAcceptance } : {}), recovery: true,
    landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION, structuralAnatomy: true, anatomyRecovery: contract,
    resume: { designs: json(path.join(dir, 'audition_sheet_designs.json')), sheets, pages: {}, stepPrefix: `r${markers}_` },
    render: async () => refuse(), identity: async () => refuse(), save: () => refuse(),
    judge: async (step, candidate, context, contextSha, refs, predecessor) => {
      first = { step, candidate, context, contextSha, refs, predecessor }; throw new ReviewedAuditionError('fresh_book_anatomy_preview'); },
    check: () => { unchanged(); if (first) fail('fresh_book_anatomy_preview'); } });
  } catch (e) { if (!first || (e as { code?: string }).code !== 'fresh_book_anatomy_preview') throw e; }
  if (!first) return refuse();
  const payload = durableReviewPayload(await auditionJudgePayload({ ...first, candidateBytes: bytesOf(first.candidate),
    refs: first.refs.map(bytesOf), predecessor: first.predecessor ? bytesOf(first.predecessor) : null, kind: 'page' }));
  unchanged();
  const roots = { bookFiles, authorityFiles };
  const plan = { version: AA.version, continuation: AA.version, cycle: FRESH_BOOK_CYCLE.id, ownerApproval: approval,
    configurationSha256: previewSha(canonicalJson(config)), profileSha256: base.plan.profileSha256, bookDir: path.resolve(config.bookDir),
    parent: { grantFile: path.resolve(parentGrantFile), grantSha256: parentSha, claimSha256: previewSha(fileBytes(at(AO.claimName))),
      outcomeSha256: previewSha(fileBytes(at(AO.outcomeName))), admissionSha256: bookFiles['audition/admission-coverage-orphan.json'] },
    auditionFolderSha256: previewSha(canonicalJson(folderBaseline(dir))), rootsSha256: previewSha(canonicalJson(roots)),
    debits: parent.debits, provision: parent.provision, ledger, contract: AUDITION_ANATOMY_VERSION, durableReview: DURABLE_REVIEW_VERSION,
    transition: { version: AUDITION_ANATOMY_VERSION, pages: pages.map(({ page, prior, consumedAttemptsBefore, maxNewAttempts }) =>
      ({ page, priorSha256: previewSha(canonicalJson(prior)), consumedAttemptsBefore, maxNewAttempts })) },
    firstReview: { step: first.step, contextSha256: first.contextSha, wireDigest: previewSha(canonicalJson(digestImages(payload))) },
    allowance: { maxNewCalls: original.maxCalls - meter.calls, extraFailedSampleRenders: 2 as const, firstSampleRenders: 0 as const,
      remainingFrameAttempts: 3 as const }, providerCalls: 0, keyRead: false };
  const { providerCalls: _p, keyRead: _k, ...bound } = plan;
  const grantDraft = freshBookAuditionAnatomyGrantSchema.parse({ ...bound, version: 'fresh-book-audition-anatomy-grant/v1',
    engine: { head: engine.head, branch: engine.branch }, pins, nativePlanSha256: previewSha(canonicalJson(plan)) });
  return { plan, grantDraft, state: { engine, claimExists: existsSync(at(AA.claimName)), outcomeExists: existsSync(at(AA.outcomeName)) },
    roots, contract, base, original };
}

export async function runFreshBookAuditionAnatomy(a: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string;
  signal: AbortSignal; log: (line: string) => void }) {
  const bytes = fileBytes(a.grantFile), refuse = (): never => fail('fresh_book_anatomy_grant');
  if (previewSha(bytes) !== a.grantSha) refuse();
  const g = freshBookAuditionAnatomyGrantSchema.parse(JSON.parse(bytes.toString('utf8')));
  const p = await planFreshBookAuditionAnatomy(a.config, a.env, g.parent.grantFile, g.ownerApproval.file);
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
  if (p.state.claimExists || p.state.outcomeExists || existsSync(at(AA.claimName)) || existsSync(at(AA.outcomeName))) fail('fresh_book_anatomy_used');
  exclusiveJson(at(AA.claimName), { cycle: FRESH_BOOK_CYCLE.id, version: AA.version, grantSha256: a.grantSha, parent: g.parent,
    ownerApproval: g.ownerApproval, engine: g.engine, bookDir: g.bookDir, transition: g.transition, allowance: g.allowance });
  const claimSha = previewSha(fileBytes(at(AA.claimName)));
  const guard = () => { same(); if (previewSha(fileBytes(at(AA.claimName))) !== claimSha || existsSync(at(AA.outcomeName))) fail('fresh_book_anatomy_used'); };
  const finish = (status: string, extra: Record<string, unknown>) => exclusiveJson(at(AA.outcomeName),
    { cycle: FRESH_BOOK_CYCLE.id, status, ...extra, finishedAt: new Date().toISOString() });
  try {
    const result = await runReviewedAudition({ bookDir: a.config.bookDir, out: path.join(a.config.bookDir, 'audition'), keyFile: a.config.keyEnvFile,
      grantFile: path.join(a.config.bookDir, 'audition.grant.json'), signal: a.signal, log: a.log, resume: true, debits: g.debits,
      layout: readReviewedBookLayout(path.join(a.config.bookDir, 'book-layout.json')),
      anatomyRecovery: { grantSha256: a.grantSha, contract: p.contract, provision: g.provision, firstReview: g.firstReview },
      experiment: { slot: p.original.experiment!.slot, claimSha256: p.original.experiment!.claimSha256, guard } });
    if (result.mode !== 'render') return fail('fresh_book_audition_mode');
    const gate = (s: unknown): PageGate['disposition'] => s === 'qa_supported' ? 'passed' : 'held_uncertain';
    const cover = result.manifest.pages.find(x => x.pageNumber === 0), reading = freshBookReadingOrder(cover ? gate(cover.status) : null,
      result.manifest.pages.filter(x => x.pageNumber > 0).map(x => ({ page: x.pageNumber, disposition: gate(x.status) })));
    const status = result.manifest.status === 'held_sample' ? 'held_sample' : reading.status === 'complete' &&
      result.manifest.status !== 'qa_supported_audition' ? 'partial' : reading.status;
    const ledger = freshBookLedger(a.config, a.env, p.base.rereview, 'child_fresh_anchor', g.debits, [g.provision]);
    exclusiveJson(path.join(a.config.bookDir, 'book-status-anatomy.json'), { status, manifestStatus: result.manifest.status,
      order: reading.order, ledger, grantSha256: a.grantSha, runtimeEligible: false });
    finish(status, { manifestStatus: result.manifest.status, ledger });
    return { status, manifestStatus: result.manifest.status, order: reading.order, ledger };
  } catch (e) {
    if (!existsSync(at(AA.outcomeName))) finish('failed_audition_anatomy', { code: e instanceof Error ? e.message : 'fresh_book_anatomy_failed' });
    throw e;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  const config = freshBookConfig(arg('--config') ?? fail('fresh_book_arguments')), env = realFreshBookEnv();
  if (process.argv.includes('--resume')) fail('fresh_book_arguments');
  const task = process.argv.includes('--execute') ? runFreshBookAuditionAnatomy({ config, env,
    grantFile: arg('--grant') ?? fail('fresh_book_arguments'), grantSha: arg('--grant-sha') ?? fail('fresh_book_arguments'),
    signal: new AbortController().signal, log: console.log }) : planFreshBookAuditionAnatomy(config, env,
    arg('--parent-grant') ?? fail('fresh_book_arguments'), arg('--owner-approval') ?? fail('fresh_book_arguments'))
      .then(({ plan, grantDraft, state }) => ({ plan, grantDraft, state }));
  task.then(r => console.log(JSON.stringify(r, null, 2))).catch(e => { console.error(e instanceof Error ? e.message : String(e)); process.exitCode = 1; });
}
