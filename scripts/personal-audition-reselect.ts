/**
 * Trusted saved-evidence admission and re-selection for a reviewed audition page (diagnostic; owner review only). Provider-free: no key,
 * no client, no image. It never re-ranks by its own rules: candidates enter the EXISTING `attemptStatus` / `selectAuditionAttempt` only
 * when every piece of evidence is bound to the bytes it claims to describe.
 *
 *   node --require ./scripts/shims/register-server-only.cjs --import tsx scripts/personal-audition-reselect.ts --spec <spec.json> [--write]
 *
 * Admission (fail-closed, per page):
 * - CURRENT reviews only: a rejudge run whose evidence index verifies, whose admission names the current review policy, the page's
 *   storyboard authority (and, for a re-plan, its producer-grant/index anchor) and the same child/companion references; each review's
 *   claim/result digests match its wire, and that wire must EQUAL the complete request rebuilt by the shared judge builder from the actual
 *   bytes (candidate, its four derived crops, the canonical references and sheets the original run chose, the predecessor the original run
 *   chose), the context RECOMPUTED from the authority, today's instruction, roles, detail and strict schema. Any other request (an extra
 *   message, another crop, a role or detail change) is refused, never trimmed. The raw output must parse under today's schema.
 * - Child identity is reused only through its original chain: a successful receipt (HTTP 2xx, gpt-4o family, usage within the evaluator's
 *   output bound), a wire that EQUALS the complete request the real evaluator builds for this exact reference and candidate, and a result
 *   that EQUALS the real evaluator's replay of the saved raw answer at the unchanged 0.70 gate. A score or boolean alone is not evidence.
 * - Invalid-citation and safety-blocked candidates are listed but cannot win; an unadmitted attempt is listed as excluded, so a choice
 *   among some attempts is never presented as the best of all of them.
 * - A changed choice marks the next page's saved review (which compared against the old image) as stale: it needs revalidation, nothing
 *   is redrawn or re-reviewed here.
 */
import path from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { previewSha } from '../lib/local-story-preview';
import { canonicalJson } from '../lib/personal-wizard/request-acceptance';
import { currentPersonalStoryboardFrame, type PersonalStoryboard } from '../lib/personal-wizard/storyboard';
import type { PersonalWizardOptions } from '../lib/personal-wizard/options';
import { REVIEWED_AUDITION_POLICY, assessAuditionReview, attemptStatus, auditionPageContext, selectAuditionAttempt,
  type AuditionAttempt } from '../lib/personal-wizard/simple-book-reviewed-audition';
import type { AuditionImage } from '../lib/personal-wizard/simple-book-illustrations';
import { PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD, evaluatePageChildResemblanceVision,
  type PageChildResemblanceVisionResult } from '../lib/generation-pipeline/page-child-resemblance-vision';
import { auditionGrantSchema, auditionJudgePayload, digestImages, grantReferenceStatus, loadReviewedBook } from './personal-simple-book-reviewed-audition';

export const RESELECT_VERSION = 'audition-reselect/v1' as const;
export class ReselectError extends Error { constructor(readonly code: string) { super(code); } }
const fail = (code: string): never => { throw new ReselectError(code); };
const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const fileSha = (file: string) => previewSha(readFileSync(file));
const JUDGE_MODEL = 'gpt-6.1-sol';
// The identity dispatch's own acceptance (the reviewed runner's identity adapter): a known gpt-4o model and usage within 180 output tokens.
const IDENTITY_MODELS = ['gpt-4o', 'gpt-4o-2024-08-06', 'gpt-4o-2024-11-20'];
const IDENTITY_MAX_COMPLETION_TOKENS = 180;
/** The original run's saved image bytes, bound to the hash the evidence names. */
const originalBytes = (originalDir: string, img: AuditionImage) => {
  const file = path.join(originalDir, 'illustrations', img.imageName);
  if (!/^[a-z0-9_]+\.png$/.test(img.imageName) || !existsSync(file)) return null;
  const bytes = readFileSync(file);
  return previewSha(bytes) === img.imageSha ? bytes : null;
};

/** The storyboard authority a page is judged under (the re-planned book with its anchor, or the approved parent). */
export type PageAuthority = { kind: 'replan' | 'parent'; book: PersonalStoryboard; rawReview: unknown;
  current: { request: unknown; writerResult: unknown; options: PersonalWizardOptions }; companionDescription: string;
  child: AuditionImage; companion: AuditionImage; replan?: { producerGrantSha256: string; indexSha256: string } };
/** The original run's own page record (its paid attempts, their saved identities and its chosen attempt). */
type OriginalAttempt = { attempt: number; candidate: AuditionImage | null; identity?: PageChildResemblanceVisionResult | null };
type OriginalPage = { pageNumber: number; attempts: OriginalAttempt[]; chosen: { candidate: AuditionImage } };
export const originalPage = (originalDir: string, page: number): OriginalPage => {
  const record = read(path.join(originalDir, `page_${page}.json`)) as OriginalPage;
  if (record.pageNumber !== page || !Array.isArray(record.attempts) || !record.chosen?.candidate) fail('reselect_original_record');
  return record;
};
const chosenSheet = (originalDir: string, role: 'entities' | 'locations') => (read(path.join(originalDir, `sheet_${role}.json`)) as { chosen: { candidate: AuditionImage } }).chosen.candidate;
/** The original run's same-scene predecessor rule: page N compares with the chosen page N-1 only inside one scene. */
export function originalPredecessor(originalDir: string, book: PersonalStoryboard, page: number): AuditionImage | null {
  const seq = book.sequence.pages;
  return page >= 2 && seq[page - 1].sceneId === seq[page - 2].sceneId ? originalPage(originalDir, page - 1).chosen.candidate : null;
}

/** A run's index file and its external receipt: every listed file must still have its recorded bytes. */
export function verifyRunIndex(runDir: string) {
  const receiptFile = `${runDir}.index-receipt.json`;
  if (!existsSync(receiptFile)) return fail('reselect_run_index');
  const receipt = read(receiptFile), index = read(receipt.index);
  if (path.resolve(receipt.index).toLowerCase() !== path.resolve(runDir, 'EVIDENCE-INDEX.json').toLowerCase() || fileSha(receipt.index) !== receipt.sha256 ||
      !Array.isArray(index.files) || index.files.length !== receipt.rows) fail('reselect_run_index');
  for (const row of index.files as { file: string; bytes: number; sha256: string }[]) {
    if (!existsSync(row.file)) fail('reselect_run_index');
    const bytes = readFileSync(row.file);
    if (bytes.length !== row.bytes || previewSha(bytes) !== row.sha256) fail('reselect_run_index');
  }
  return { receiptFile, indexSha256: receipt.sha256, rows: receipt.rows as number, files: new Set((index.files as { file: string }[]).map(f => path.resolve(f.file).toLowerCase())) };
}

export type AdmittedReview = { candidate: AuditionImage; rawReview: unknown; assessment: NonNullable<AuditionAttempt['assessment']>;
  provenance: { run: string; step: string; wireDigest: string; receiptSha256: string; contextSha: string; storyboardDigest: string; authority: 'replan' | 'parent' } };

/** Admits the CURRENT reviews of one page from one rejudge run. Any unbound piece refuses the whole run for that page. */
export async function admitCurrentReviews(runDir: string, page: number, authority: PageAuthority, originalDir: string) {
  const index = verifyRunIndex(runDir);
  const indexed = (file: string) => { if (!index.files.has(path.resolve(file).toLowerCase())) fail('reselect_run_index'); return file; };
  const admission = read(indexed(path.join(runDir, 'admission.json')));
  if (admission.policy?.version !== REVIEWED_AUDITION_POLICY.version) fail('reselect_review_policy');
  if (admission.storyboardDigest !== authority.book.storyboardDigest || admission.sourceDigest !== authority.book.sourceDigest ||
      canonicalJson(admission.child) !== canonicalJson(authority.child) || canonicalJson(admission.companion) !== canonicalJson(authority.companion)) fail('reselect_authority');
  if (authority.kind === 'replan' ? canonicalJson({ producerGrantSha256: admission.replan?.producerGrantSha256, indexSha256: admission.replan?.indexSha256 }) !==
      canonicalJson(authority.replan) : admission.replan !== undefined) fail('reselect_authority');
  const grantFile = indexed(`${runDir}.grant.json`);
  if (fileSha(grantFile) !== admission.grant?.sha256) fail('reselect_grant');
  const grant = auditionGrantSchema.parse(read(grantFile)), scope = grant.scope;
  if (scope.mode !== 'rejudge') return fail('reselect_grant');
  if (grant.book.storyboardDigest !== authority.book.storyboardDigest ||
      canonicalJson(scope.replan ?? null) !== canonicalJson(authority.kind === 'replan' ? authority.replan : null)) fail('reselect_grant');
  // The reference sheets the reviews saw must be the ones the original run chose; their flaw notes are bound through the recomputed context.
  const references = grantReferenceStatus(scope.references);
  for (const role of ['entities', 'locations'] as const)
    if (canonicalJson(references[role].image) !== canonicalJson(chosenSheet(originalDir, role))) fail('reselect_reference');
  const canonical = [authority.child, authority.companion, references.entities.image, references.locations.image];
  const canonicalBytes = canonical.map(img => originalBytes(originalDir, img) ?? fail('reselect_reference'));
  const predecessor = originalPredecessor(originalDir, authority.book, page);
  const predecessorBytes = predecessor ? originalBytes(originalDir, predecessor) ?? fail('reselect_predecessor') : null;
  const admitted = new Map<string, AdmittedReview>();
  for (const [i, frame] of scope.frames.entries()) {
    if (frame.pageNumber !== page) continue;
    const step = `rejudge_${i}_page_${page}`, stage = (k: string) => indexed(path.join(runDir, 'paid-stages', `${step}.${k}.json`));
    const wire = read(stage('wire')), claim = read(stage('claim')), result = read(stage('result')), receiptFile = stage('receipt'), receipt = read(receiptFile);
    const wireDigest = previewSha(canonicalJson(wire));
    if (claim.wireDigest !== wireDigest || result.wireDigest !== wireDigest || result.completed !== true || !Number.isSafeInteger(result.estimatedMicroUsd)) fail('reselect_review_binding');
    if (canonicalJson(frame.predecessor) !== canonicalJson(predecessor)) fail('reselect_predecessor');
    const candidateBytes = originalBytes(originalDir, frame.image) ?? fail('reselect_candidate');
    const packet = currentPersonalStoryboardFrame(authority.book, authority.rawReview, page, authority.current);
    const { context, contextSha, checks } = auditionPageContext(authority.book, packet.context, page, authority.companionDescription, canonical, references, predecessor);
    // The complete effective request, rebuilt by the shared judge builder from the actual bytes, must EQUAL the saved wire.
    const rebuilt = digestImages(await auditionJudgePayload({ candidate: frame.image, candidateBytes, context, contextSha, refs: canonicalBytes,
      predecessor: predecessorBytes, kind: 'page' }));
    if (canonicalJson(rebuilt) !== canonicalJson(wire)) fail('reselect_wire');
    if (receipt.raw?.status !== 'completed' || receipt.raw?.model !== JUDGE_MODEL || receipt.raw?.error || receipt.raw?.incomplete_details ||
        typeof receipt.raw?.output_text !== 'string') fail('reselect_review_binding');
    const rawReview = JSON.parse(receipt.raw.output_text);
    let assessed: ReturnType<typeof assessAuditionReview>;
    // Today's schema and catalogue only: an older review format (no parse) is stale; a current-format review the engine refuses is unusable.
    try { assessed = assessAuditionReview(rawReview, frame.image.imageSha, contextSha, checks.requirementIds, checks.uniqueLandmarks); }
    catch (error) { return fail(error instanceof Error && error.name === 'ZodError' ? 'reselect_review_stale' : 'reselect_review_unusable'); }
    if (admitted.has(frame.image.imageSha)) fail('reselect_review_duplicate');
    admitted.set(frame.image.imageSha, { candidate: frame.image, rawReview, assessment: assessed.assessment,
      provenance: { run: runDir, step, wireDigest, receiptSha256: fileSha(receiptFile), contextSha, storyboardDigest: authority.book.storyboardDigest, authority: authority.kind } });
  }
  return { admitted, run: { dir: runDir, indexSha256: index.indexSha256, grantSha256: admission.grant.sha256 } };
}

export type AdmittedIdentity = { identity: PageChildResemblanceVisionResult; provenance: { step: string; wireDigest: string; receiptSha256: string } } | { excluded: string };
/**
 * Reuses a saved child-identity result only through its original chain; otherwise excluded with the reason. The real evaluator rebuilds
 * its own complete request for this reference and candidate (images named by hash, exactly as the saved wire records them) and replays the
 * saved raw answer through a local stub: no network, no key. Its request must equal the saved wire and its result the saved result.
 */
export async function admitSavedIdentity(originalDir: string, attempt: OriginalAttempt, child: AuditionImage): Promise<AdmittedIdentity> {
  const candidate = attempt.candidate, saved = attempt.identity;
  if (!candidate || !saved) return { excluded: 'identity_missing' };
  if (!originalBytes(originalDir, candidate)) return { excluded: 'identity_candidate' };
  const step = `${candidate.imageName.replace(/\.png$/, '')}_identity`, stage = (k: string) => path.join(originalDir, 'paid-stages', `${step}.${k}.json`);
  if (!['wire', 'claim', 'result', 'receipt'].every(k => existsSync(stage(k)))) return { excluded: 'identity_evidence_missing' };
  const wire = read(stage('wire')), claim = read(stage('claim')), result = read(stage('result')), receipt = read(stage('receipt'));
  const wireDigest = previewSha(canonicalJson(wire));
  if (claim.wireDigest !== wireDigest || result.wireDigest !== wireDigest || result.completed !== true || !Number.isSafeInteger(result.estimatedMicroUsd))
    return { excluded: 'identity_chain' };
  const usage = receipt.raw?.usage;
  if (!Number.isInteger(receipt.status) || receipt.status < 200 || receipt.status > 299 || !IDENTITY_MODELS.includes(receipt.raw?.model) || !usage ||
      !Number.isSafeInteger(usage.prompt_tokens) || !Number.isSafeInteger(usage.completion_tokens) || usage.completion_tokens > IDENTITY_MAX_COMPLETION_TOKENS)
    return { excluded: 'identity_receipt' };
  let captured: unknown = null;
  let replayed: PageChildResemblanceVisionResult;
  try {
    replayed = await evaluatePageChildResemblanceVision({ referenceImageUrl: `sha256:${child.imageSha}`, candidateImageUrl: `sha256:${candidate.imageSha}`,
      threshold: PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD, model: 'gpt-4o', apiKey: 'replay-only-not-a-credential', maxRetries: 0,
      fetchImpl: async (_url, init) => {
        captured = JSON.parse(String(init?.body));
        return new Response(JSON.stringify(receipt.raw), { status: 200, headers: { 'content-type': 'application/json' } });
      } });
  } catch { return { excluded: 'identity_replay' }; }
  if (canonicalJson(captured) !== canonicalJson(wire)) return { excluded: 'identity_wire' };
  if (canonicalJson(replayed) !== canonicalJson(saved)) return { excluded: 'identity_result' };
  // Only a PASSED result at the unchanged gate is reused.
  if (replayed.status !== 'passed' || replayed.threshold !== PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD) return { excluded: 'identity_not_reusable' };
  return { identity: saved, provenance: { step, wireDigest, receiptSha256: fileSha(stage('receipt')) } };
}

export type ReselectRow = { attempt: number; candidate: AuditionImage | null; admitted: boolean; status: string | null; excluded: string[];
  counts?: Record<string, number>; findings?: { verdict: string; impact: string; requirement: string; derived?: true; note: string }[];
  review?: AdmittedReview['provenance']; identity?: { score: number | null; step: string; wireDigest: string; receiptSha256: string } };
/**
 * Re-selection over the admitted attempts with the EXISTING status and selection rules. A candidate the engine marks review_invalid or
 * ineligible_safety is listed but cannot win; an attempt without a current review or a reusable identity is excluded and named.
 */
export function reselectPage(record: OriginalPage, admitted: Map<string, AdmittedReview>, identities: Map<string, AdmittedIdentity>) {
  const rows: ReselectRow[] = [], pool: (AuditionAttempt & { candidate: AuditionImage })[] = [];
  for (const a of record.attempts) {
    const review = a.candidate ? admitted.get(a.candidate.imageSha) : undefined, idn = a.candidate ? identities.get(a.candidate.imageSha) : undefined;
    const excluded = [...(!a.candidate ? ['no_candidate'] : []), ...(a.candidate && !review ? ['no_current_review'] : []),
      ...(idn && 'excluded' in idn ? [idn.excluded] : a.candidate && !idn ? ['identity_missing'] : [])];
    if (!a.candidate || !review || !idn || 'excluded' in idn) { rows.push({ attempt: a.attempt, candidate: a.candidate, admitted: false, status: null, excluded }); continue; }
    const attempt = { attempt: a.attempt, candidate: a.candidate, review: review.rawReview as AuditionAttempt['review'], assessment: review.assessment, identity: idn.identity,
      status: attemptStatus('page', { candidate: a.candidate, assessment: review.assessment, identity: idn.identity }) };
    const cannotWin = attempt.status === 'review_invalid' || attempt.status === 'ineligible_safety';
    if (!cannotWin) pool.push(attempt);
    rows.push({ attempt: a.attempt, candidate: a.candidate, admitted: true, status: attempt.status, excluded: cannotWin ? [`cannot_win_${attempt.status}`] : [],
      counts: review.assessment.counts, findings: review.assessment.findings.map(f => ({ verdict: f.verdict, impact: f.impact, requirement: f.requirement,
        ...(f.derived ? { derived: true as const } : {}), note: f.note })), review: review.provenance,
      identity: { score: idn.identity.resemblanceScore, ...idn.provenance } });
  }
  const chosen = selectAuditionAttempt('page', pool);
  const status = chosen ? attemptStatus('page', chosen) : null;
  const original = record.chosen.candidate;
  return { pageNumber: record.pageNumber, rows, exhaustive: rows.every(r => r.admitted), originalChosen: original,
    chosen: chosen ? { attempt: chosen.attempt, candidate: chosen.candidate, status } : null,
    outcome: !chosen ? 'no_current_candidate' as const : status !== 'qa_supported' ? 'held_no_supported_candidate' as const
      : chosen.candidate.imageSha === original.imageSha ? 'kept_qa_supported' as const : 'reselected_qa_supported' as const,
    changed: !!chosen && status === 'qa_supported' && chosen.candidate.imageSha !== original.imageSha };
}

/**
 * The next page's saved reviews compared against the OLD chosen image (same-scene rule): after a change they are historical evidence of
 * the old transition, not proof of the new one. Recorded from the actual saved review wires; nothing is re-reviewed or redrawn here.
 */
export function staleSuccessorTransitions(originalDir: string, book: PersonalStoryboard, page: number, oldChosen: AuditionImage, newChosen: AuditionImage) {
  const next = page + 1;
  if (next > book.narrativeSpreads || originalPredecessor(originalDir, book, next) === null) return { from: page, to: next, status: 'not_applicable' as const };
  const record = originalPage(originalDir, next), evidence: { step: string; predecessorSha: string | null; wireSha256: string }[] = [];
  for (const a of record.attempts) {
    if (!a.candidate) continue;
    const file = path.join(originalDir, 'paid-stages', `${a.candidate.imageName.replace(/\.png$/, '')}_qa.wire.json`);
    if (!existsSync(file)) continue;
    const content = read(file).input?.[0]?.content as { type: string; image_url?: string }[] | undefined;
    const inputImages = content?.filter(p => p.type === 'input_image') ?? [], last = inputImages[inputImages.length - 1]?.image_url ?? null;
    evidence.push({ step: path.basename(file, '.wire.json'), predecessorSha: last?.startsWith('sha256:') ? last.slice(7) : null, wireSha256: fileSha(file) });
  }
  if (!evidence.length || evidence.some(e => e.predecessorSha !== oldChosen.imageSha)) fail('reselect_successor_evidence');
  return { from: page, to: next, status: 'stale_needs_revalidation' as const, oldPredecessor: oldChosen, newPredecessor: newChosen, successorReviews: evidence,
    note: 'diagnostic: the successor page is not judged defective; its saved review simply compared against the replaced image' };
}

// ---------------------------------------------------------------------------------------------------------------
// Spec -> diagnostic manifest (new folder; nothing old is modified).
// ---------------------------------------------------------------------------------------------------------------
export type ReselectSpec = { bookDir: string; originalRun: string; out: string;
  pages: { page: number; authority: { kind: 'replan'; replanDir: string } | { kind: 'parent' }; reviewRuns: string[] }[] };
export async function buildReselectManifest(spec: ReselectSpec, workspace = process.cwd()) {
  const loads = new Map<string, ReturnType<typeof loadReviewedBook>>();
  const load = (replanDir?: string) => { const key = replanDir ?? ''; if (!loads.has(key)) loads.set(key, loadReviewedBook(spec.bookDir, workspace, replanDir)); return loads.get(key)!; };
  const childSha = (l: ReturnType<typeof loadReviewedBook>) => ({ imageName: 'reference_child.png', imageSha: previewSha(l.childBytes) });
  const companionSha = (l: ReturnType<typeof loadReviewedBook>) => ({ imageName: 'reference_companion.png', imageSha: previewSha(l.companionBytes) });
  const pages = [];
  for (const p of spec.pages) {
    const loaded = load(p.authority.kind === 'replan' ? p.authority.replanDir : undefined);
    if (p.authority.kind === 'replan' && !loaded.replan?.pairPages.includes(p.page)) fail('reselect_authority');
    const authority: PageAuthority = { kind: p.authority.kind, book: loaded.book, rawReview: loaded.rawReview, current: loaded.current,
      companionDescription: loaded.companionDescription, child: childSha(loaded), companion: companionSha(loaded),
      ...(loaded.replan ? { replan: { producerGrantSha256: loaded.replan.producerGrantSha256, indexSha256: loaded.replan.indexSha256 } } : {}) };
    const record = originalPage(spec.originalRun, p.page), admitted = new Map<string, AdmittedReview>(), runs = [];
    for (const run of p.reviewRuns) {
      const r = await admitCurrentReviews(run, p.page, authority, spec.originalRun);
      for (const [k, v] of r.admitted) { if (admitted.has(k)) fail('reselect_review_duplicate'); admitted.set(k, v); }
      runs.push(r.run);
    }
    const identities = new Map<string, AdmittedIdentity>();
    for (const a of record.attempts) if (a.candidate) identities.set(a.candidate.imageSha, await admitSavedIdentity(spec.originalRun, a, authority.child));
    const selection = reselectPage(record, admitted, identities);
    const transition = selection.changed ? staleSuccessorTransitions(spec.originalRun, authority.book, p.page, selection.originalChosen, selection.chosen!.candidate) : null;
    pages.push({ page: p.page, authority: { kind: authority.kind, storyboardDigest: authority.book.storyboardDigest, ...(authority.replan ? { replan: authority.replan } : {}) },
      predecessor: originalPredecessor(spec.originalRun, authority.book, p.page), reviewRuns: runs, ...selection, ...(transition ? { successorTransition: transition } : {}) });
  }
  return { version: RESELECT_VERSION, policy: REVIEWED_AUDITION_POLICY.version, originalRun: spec.originalRun, providerCalls: 0, keyRead: false,
    pages,
    scope: 'diagnostic re-selection of the listed pages only, each under its own storyboard authority; not a whole-book review, not a replacement of the original run, not product acceptance',
    ownerReviewRequired: true as const, runtimeEligible: false as const };
}

function argValue(name: string) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; }
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const specFile = argValue('--spec') ?? fail('reselect_args');
  const spec = read(specFile!) as ReselectSpec;
  buildReselectManifest(spec).then(manifest => {
  if (!process.argv.includes('--write')) console.log(JSON.stringify(manifest, null, 2));
  else {
    if (!path.isAbsolute(spec.out) || existsSync(spec.out)) fail('reselect_out');
    mkdirSync(spec.out);
    const body = JSON.stringify({ ...manifest, spec: { file: specFile, sha256: fileSha(specFile!) }, at: new Date().toISOString() }, null, 2);
    writeFileSync(path.join(spec.out, 'reselect-manifest.json'), body, { flag: 'wx' });
    writeFileSync(`${spec.out}.receipt.json`, JSON.stringify({ version: `${RESELECT_VERSION}-receipt`, manifest: path.join(spec.out, 'reselect-manifest.json'),
      sha256: previewSha(body) }, null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ out: spec.out, pages: manifest.pages.map(p => ({ page: p.page, outcome: p.outcome, chosen: p.chosen?.candidate.imageName ?? null,
      exhaustive: p.exhaustive, transition: p.successorTransition?.status ?? null })) }, null, 2));
  }
  }).catch(error => { console.error('FAILED', error?.code ?? error?.message ?? error); process.exitCode = 1; });
}
