import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { zodTextFormat } from 'openai/helpers/zod';
import { replanFixture } from './storyboard-replan-fixture';
import { prepareCurrentPersonalStoryboard, currentPersonalStoryboardFrame } from '../storyboard';
import { canonicalJson } from '../request-acceptance';
import { QUALITY_CATEGORIES } from '../../local-preview-quality';
import { AUDITION_JUDGE_INSTRUCTIONS, REVIEWED_AUDITION_POLICY, auditionPageContext, auditionPageReviewSchema } from '../simple-book-reviewed-audition';
import { PAGE_CHILD_RESEMBLANCE_VISION_VERSION, scoreIdentityFeatures } from '../../generation-pipeline/page-child-resemblance-vision';
import { grantReferenceStatus } from '../../../scripts/personal-simple-book-reviewed-audition';
import { admitCurrentReviews, admitSavedIdentity, reselectPage, staleSuccessorTransitions, originalPage, type PageAuthority }
  from '../../../scripts/personal-audition-reselect';

const sha = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const json = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const put = (file: string, value: unknown) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)); };
// Re-selection is provider-free: any network use fails the test.
beforeEach(() => { vi.stubGlobal('fetch', vi.fn(() => { throw Error('no provider in re-selection'); })); });
afterEach(() => { vi.unstubAllGlobals(); });

const FEATURES = { faceStructure: 'match', eyesBrows: 'match', noseMouth: 'match', hairIdentity: 'match', distinctiveFeatures: 'match' } as const;
type Review = 'clean' | 'critical' | 'invalid_citation' | 'safety';
/**
 * A self-consistent synthetic evidence chain: an original run (page records, chosen sheets, images, identity wire/claim/result/receipt,
 * the successor page's saved review wires) and one current-policy rejudge run (grant, admission, wires, receipts, evidence index).
 */
async function world(opts: { page?: number; reviewed?: Record<number, Review>; chosen?: number } = {}) {
  const r = await replanFixture(), root = mkdtempSync(path.join(tmpdir(), 'reselect-'));
  const page = opts.page ?? 1, reviewed = opts.reviewed ?? { 1: 'clean', 2: 'critical' }, chosenAttempt = opts.chosen ?? 2;
  const original = path.join(root, 'original'), run = path.join(root, 'rejudge');
  const companionDescription = prepareCurrentPersonalStoryboard(r.request, r.writerResult, r.options, true).companionDescription;
  const image = (name: string) => { const bytes = Buffer.from(`synthetic image ${name}`); put(path.join(original, 'illustrations', name), bytes); return { imageName: name, imageSha: sha(bytes) }; };
  const child = image('reference_child.png'), companion = image('reference_companion.png');
  const authority: PageAuthority = { kind: 'parent', book: r.book, rawReview: r.review, current: { request: r.request, writerResult: r.writerResult, options: r.options },
    companionDescription, child, companion };
  const identity = { evaluatorVersion: PAGE_CHILD_RESEMBLANCE_VISION_VERSION, status: 'passed', resemblanceScore: scoreIdentityFeatures(FEATURES), threshold: 0.7,
    subjectVisible: true, sameChild: true, reasonCode: 'same_child', attempts: 1, model: 'gpt-4o', featureAssessments: FEATURES };
  const identityChain = (candidate: { imageName: string; imageSha: string }, change: { wire?: (w: any) => void; answer?: (a: any) => void; receiptModel?: string } = {}) => {
    const step = `${candidate.imageName.replace(/\.png$/, '')}_identity`, dir = path.join(original, 'paid-stages');
    const wire: any = { model: 'gpt-4o', max_tokens: 180, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: [
      { type: 'image_url', image_url: { url: `sha256:${child.imageSha}`, detail: 'high' } }, { type: 'image_url', image_url: { url: `sha256:${candidate.imageSha}`, detail: 'high' } },
      { type: 'text', text: 'identity verifier prompt' }] }] };
    change.wire?.(wire);
    const answer: any = { referenceChildVisible: true, candidateChildVisible: true, candidateChildCount: 1, comparisonUsable: true, sameChildDecision: 'same', ...FEATURES };
    change.answer?.(answer);
    const digest = sha(canonicalJson(wire));
    put(path.join(dir, `${step}.wire.json`), wire);
    put(path.join(dir, `${step}.claim.json`), { step, wireDigest: digest, maximumMicroUsd: 50000 });
    put(path.join(dir, `${step}.result.json`), { wireDigest: digest, estimatedMicroUsd: 5600, completed: true });
    put(path.join(dir, `${step}.receipt.json`), { raw: { model: change.receiptModel ?? 'gpt-4o-2024-08-06', choices: [{ message: { content: JSON.stringify(answer) } }] },
      estimatedMicroUsd: 5600, status: 200 });
  };
  // Original run: page records, chosen sheets, identities.
  const attempts = [0, 1, 2].map(a => ({ attempt: a, candidate: image(`page_${page}_${a}.png`), identity }));
  attempts.forEach(a => identityChain(a.candidate));
  put(path.join(original, `page_${page}.json`), { pageNumber: page, contextSha: 'a'.repeat(64), attempts, chosen: { candidate: attempts[chosenAttempt].candidate } });
  if (page > 1) put(path.join(original, `page_${page - 1}.json`), { pageNumber: page - 1, attempts: [{ attempt: 0, candidate: image(`page_${page - 1}_0.png`), identity }],
    chosen: { candidate: image(`page_${page - 1}_0.png`) } });
  const sheets = { entities: image('sheet_entities_1.png'), locations: image('sheet_locations_0.png') };
  put(path.join(original, 'sheet_entities.json'), { chosen: { candidate: sheets.entities } });
  put(path.join(original, 'sheet_locations.json'), { chosen: { candidate: sheets.locations } });
  // The next page's saved reviews compared against the originally chosen image (same scene for page 1 -> 2 in the fixture).
  const successor = image(`page_${page + 1}_0.png`);
  put(path.join(original, `page_${page + 1}.json`), { pageNumber: page + 1, attempts: [{ attempt: 0, candidate: successor, identity }], chosen: { candidate: successor } });
  put(path.join(original, 'paid-stages', `page_${page + 1}_0_qa.wire.json`), { input: [{ content: [{ type: 'input_text', text: '{}' },
    { type: 'input_image', image_url: `sha256:${successor.imageSha}` }, { type: 'input_image', image_url: `sha256:${attempts[chosenAttempt].candidate.imageSha}` }] }] });
  // Current rejudge run of the reviewed attempts.
  const references = { entities: { image: sheets.entities, status: 'diagnostic_candidate' as const, knownFlaws: [{ impact: 'continuity' as const, requirement: 'design:hut', note: 'synthetic sheet flaw' }] },
    locations: { image: sheets.locations, status: 'diagnostic_candidate' as const, knownFlaws: [] } };
  const status = grantReferenceStatus(references), canonical = [child, companion, sheets.entities, sheets.locations];
  const predecessor = page >= 2 && r.book.sequence.pages[page - 1].sceneId === r.book.sequence.pages[page - 2].sceneId ? image(`page_${page - 1}_0.png`) : null;
  const frames = Object.keys(reviewed).map(Number).map(a => ({ label: `A${a}`, pageNumber: page, image: attempts[a].candidate, predecessor }));
  const evidence = path.join(root, 'ledger.json'); put(evidence, '{"synthetic":true}');
  const grant = { version: 'audition-spend-grant/v1', approvalReference: 'SYNTHETIC TEST ONLY: no provider, no spend, no authority.',
    book: { requestId: r.book.requestId, storyboardDigest: r.book.storyboardDigest },
    ledger: { priorKnownApiMicroUsd: 1, evidence: [{ file: evidence, sha256: sha(readFileSync(evidence)) }], note: 'synthetic ledger' },
    capMicroUsd: 1200001, maxCalls: 2, scope: { mode: 'rejudge', sourceDirectory: path.join(original, 'illustrations'), references, frames },
    claudeMax: 'Claude Max usage is separate: not an API invoice, not $0 and not included in this ledger' };
  put(`${run}.grant.json`, grant);
  put(path.join(run, 'admission.json'), { version: 'reviewed-simple-book-audition-admission/v2', requestId: r.book.requestId, sourceDigest: r.book.sourceDigest,
    storyboardDigest: r.book.storyboardDigest, child, companion, policy: REVIEWED_AUDITION_POLICY, grant: { file: `${run}.grant.json`, sha256: sha(readFileSync(`${run}.grant.json`)) } });
  const packet = currentPersonalStoryboardFrame(r.book, r.review, page, authority.current);
  const { context, contextSha, checks } = auditionPageContext(r.book, packet.context, page, companionDescription, canonical, status, predecessor);
  const format = zodTextFormat(auditionPageReviewSchema, 'personal_audition_pixels_v4');
  const reviewOf = (candidateSha: string, kind: Review) => {
    const l = checks.uniqueLandmarks;
    const inventory = { objects: l.map((x, i) => ({ objectId: `o${i + 1}`, region: `${x.id} place`, description: x.id })),
      landmarks: l.map((x, i) => ({ landmarkId: x.id, candidates: [{ objectId: `o${i + 1}`, association: 'this_landmark', evidence: 'seen',
        featureChecks: x.features.map(f => ({ featureId: f.id, observed: 'matches' })) }] })) };
    const pass = (category: string) => ({ category, verdict: 'pass', observation: `${category} ok`, correction: '', issues: [] as unknown[] });
    const items = QUALITY_CATEGORIES.map(pass);
    if (kind === 'critical') Object.assign(items.find(c => c.category === 'environment')!, { verdict: 'defect', correction: 'Repair it.',
      issues: [{ impact: 'continuity', requirement: checks.requirementIds.find(id => id !== 'safety')!, note: 'a bound continuity defect' }] });
    if (kind === 'invalid_citation') Object.assign(items[0], { verdict: 'defect', correction: 'Repair it.', issues: [{ impact: 'continuity', requirement: 'unbound_requirement', note: 'unbound' }] });
    if (kind === 'safety') Object.assign(items.find(c => c.category === 'safety')!, { verdict: 'uncertain', correction: 'Check it.',
      issues: [{ impact: 'safety', requirement: 'safety', note: 'possibly unsafe' }] });
    return { candidateSha, contextSha, checks: items, landmarkInventory: inventory };
  };
  frames.forEach((frame, i) => {
    const step = `rejudge_${i}_page_${page}`, dir = path.join(run, 'paid-stages');
    const text = JSON.stringify({ candidateSha: frame.image.imageSha, contextSha, context, imageRoles: [] });
    const images = [frame.image, frame.image, frame.image, frame.image, frame.image, ...canonical, ...(predecessor ? [predecessor] : [])].map(img => ({ type: 'input_image',
      image_url: `sha256:${img.imageSha}`, detail: 'high' }));
    const wire = { model: 'gpt-6.1-sol', store: false, service_tier: 'default', reasoning: { effort: 'medium' }, instructions: AUDITION_JUDGE_INSTRUCTIONS.page,
      input: [{ role: 'user', content: [{ type: 'input_text', text }, ...images] }], max_output_tokens: 12000,
      text: { format: { type: 'json_schema', name: format.name, strict: format.strict, schema: format.schema } } };
    const digest = sha(canonicalJson(wire));
    put(path.join(dir, `${step}.wire.json`), wire);
    put(path.join(dir, `${step}.claim.json`), { step, seq: i, wireDigest: digest, maximumMicroUsd: 600000 });
    put(path.join(dir, `${step}.result.json`), { wireDigest: digest, estimatedMicroUsd: 80000, completed: true });
    put(path.join(dir, `${step}.receipt.json`), { raw: { status: 'completed', model: 'gpt-6.1-sol', output_text: JSON.stringify(reviewOf(frame.image.imageSha, reviewed[Number(frame.label.slice(1))])) },
      estimatedMicroUsd: 80000 });
  });
  const reindex = () => {
    const files: string[] = [];
    (function walk(d: string) { for (const n of readdirSync(d).sort()) { const p = path.join(d, n); try { readdirSync(p); walk(p); } catch { if (n !== 'EVIDENCE-INDEX.json') files.push(p); } } })(run);
    files.push(`${run}.grant.json`);
    const index = path.join(run, 'EVIDENCE-INDEX.json');
    put(index, { files: files.map(f => ({ file: f, bytes: readFileSync(f).length, sha256: sha(readFileSync(f)) })) });
    put(`${run}.index-receipt.json`, { index, sha256: sha(readFileSync(index)), rows: files.length });
  };
  reindex();
  const identities = () => new Map(originalPage(original, page).attempts.map(a => [a.candidate!.imageSha, admitSavedIdentity(original, a, child)]));
  return { r, root, page, original, run, authority, attempts, child, contextSha, reindex, identityChain, identities };
}
type World = Awaited<ReturnType<typeof world>>;
const select = (w: World) => reselectPage(originalPage(w.original, w.page), admitCurrentReviews(w.run, w.page, w.authority, w.original).admitted, w.identities());
const editJson = (file: string, change: (v: any) => void) => { const v = json(file); change(v); writeFileSync(file, JSON.stringify(v)); };
const wireOf = (w: World, i = 0) => path.join(w.run, 'paid-stages', `rejudge_${i}_page_${w.page}.wire.json`);
const rebindClaim = (w: World, i = 0) => {
  const digest = sha(canonicalJson(json(wireOf(w, i))));
  editJson(path.join(w.run, 'paid-stages', `rejudge_${i}_page_${w.page}.claim.json`), c => { c.wireDigest = digest; });
  editJson(path.join(w.run, 'paid-stages', `rejudge_${i}_page_${w.page}.result.json`), c => { c.wireDigest = digest; });
};

describe('re-selection reuses the existing status and selection rules over admitted evidence only', () => {
  it('a clean, reviewed alternative replaces a held original choice; the unreviewed attempt is named and the choice is not best-of-all', async () => {
    const w = await world();
    const s = select(w);
    expect(s).toMatchObject({ outcome: 'reselected_qa_supported', changed: true, exhaustive: false,
      chosen: { attempt: 1, candidate: w.attempts[1].candidate, status: 'qa_supported' }, originalChosen: w.attempts[2].candidate });
    expect(s.rows.map(r => [r.attempt, r.admitted, r.status, r.excluded])).toEqual([[0, false, null, ['no_current_review']], [1, true, 'qa_supported', []], [2, true, 'held', []]]);
    expect(s.rows[1].identity).toMatchObject({ score: scoreIdentityFeatures(FEATURES), step: 'page_1_1_identity' });
  });

  it('no clean alternative: the page stays held and nothing is replaced', async () => {
    const w = await world({ reviewed: { 1: 'critical', 2: 'critical' } });
    expect(select(w)).toMatchObject({ outcome: 'held_no_supported_candidate', changed: false, chosen: { status: 'held' } });
  });

  it('invalid-citation and safety-blocked candidates are listed but can never win', async () => {
    const w = await world({ reviewed: { 0: 'invalid_citation', 1: 'safety', 2: 'critical' } });
    const s = select(w);
    expect(s.rows.map(r => r.excluded)).toEqual([['cannot_win_review_invalid'], ['cannot_win_ineligible_safety'], []]);
    expect(s).toMatchObject({ chosen: { attempt: 2, status: 'held' }, outcome: 'held_no_supported_candidate', exhaustive: true });
    const only = await world({ reviewed: { 0: 'invalid_citation', 1: 'safety' } });
    expect(select(only)).toMatchObject({ chosen: null, outcome: 'no_current_candidate', changed: false });
  });

  it('the original choice stays when it is itself the supported one', async () => {
    const w = await world({ reviewed: { 1: 'critical', 2: 'clean' } });
    expect(select(w)).toMatchObject({ outcome: 'kept_qa_supported', changed: false, chosen: { attempt: 2 } });
  });
});

describe('current-review admission refuses any unbound link (no key, no provider)', () => {
  const refused = async (code: string, tamper: (w: World) => void, reindex = true, page?: number) => {
    const w = await world(page ? { page } : {}); tamper(w); if (reindex) w.reindex();
    expect(() => admitCurrentReviews(w.run, w.page, w.authority, w.original), code).toThrow(code);
  };
  it('a file changed after the run was indexed', async () => {
    await refused('reselect_run_index', w => editJson(path.join(w.run, 'admission.json'), a => { a.extra = 1; }), false);
  });
  it('an older review policy, another storyboard or source, other references, or a re-plan anchor on a parent authority', async () => {
    await refused('reselect_review_policy', w => editJson(path.join(w.run, 'admission.json'), a => { a.policy.version = 'reviewed-audition-policy/v8'; }));
    await refused('reselect_authority', w => editJson(path.join(w.run, 'admission.json'), a => { a.storyboardDigest = 'a'.repeat(64); }));
    await refused('reselect_authority', w => editJson(path.join(w.run, 'admission.json'), a => { a.sourceDigest = 'a'.repeat(64); }));
    await refused('reselect_authority', w => editJson(path.join(w.run, 'admission.json'), a => { a.child.imageSha = 'a'.repeat(64); }));
    await refused('reselect_authority', w => editJson(path.join(w.run, 'admission.json'), a => { a.replan = { producerGrantSha256: 'a'.repeat(64), indexSha256: 'b'.repeat(64) }; }));
  });
  it('a grant that is not the one the run recorded, or a reference sheet the original run did not choose', async () => {
    await refused('reselect_grant', w => editJson(`${w.run}.grant.json`, g => { g.approvalReference += ' (edited)'; }));
    await refused('reselect_reference', w => {
      editJson(path.join(w.original, 'sheet_locations.json'), s => { s.chosen.candidate.imageSha = 'a'.repeat(64); });
    });
  });
  it('a judge wire with another instruction, schema or model, or whose claim no longer matches it', async () => {
    await refused('reselect_review_policy', w => { editJson(wireOf(w), x => { x.instructions += ' '; }); rebindClaim(w); });
    await refused('reselect_review_policy', w => { editJson(wireOf(w), x => { x.text.format.schema.title = 'x'; }); rebindClaim(w); });
    await refused('reselect_review_policy', w => { editJson(wireOf(w), x => { x.model = 'gpt-6-astra'; }); rebindClaim(w); });
    await refused('reselect_review_binding', w => editJson(wireOf(w), x => { x.max_output_tokens = 12000; x.extra = 1; }));
  });
  it('a context that is not the recomputed one, a reordered image list, or other candidate bytes', async () => {
    await refused('reselect_context', w => { editJson(wireOf(w), x => { const t = JSON.parse(x.input[0].content[0].text); t.context.requirementIds = []; x.input[0].content[0].text = JSON.stringify(t); }); rebindClaim(w); });
    await refused('reselect_context', w => { editJson(wireOf(w), x => { const c = x.input[0].content; [c[6], c[7]] = [c[7], c[6]]; }); rebindClaim(w); });
    await refused('reselect_candidate', w => writeFileSync(path.join(w.original, 'illustrations', w.attempts[1].candidate.imageName), 'other bytes'));
  });
  it('a predecessor other than the one the original run chose (same-scene page)', async () => {
    await refused('reselect_predecessor', w => editJson(path.join(w.original, 'page_1.json'), p => { p.chosen.candidate = { imageName: 'page_1_9.png', imageSha: 'c'.repeat(64) }; }), true, 2);
  });
  it('a current-format review the engine refuses is unusable, and the whole run is refused for that page', async () => {
    await refused('reselect_review_unusable', w => editJson(path.join(w.run, 'paid-stages', `rejudge_0_page_${w.page}.receipt.json`), rc => {
      const r = JSON.parse(rc.raw.output_text); r.checks[0].verdict = 'uncertain'; rc.raw.output_text = JSON.stringify(r); }));
  });
  it('an older (stale) review format never enters the current pool', async () => {
    await refused('reselect_review_stale', w => editJson(path.join(w.run, 'paid-stages', `rejudge_0_page_${w.page}.receipt.json`), rc => {
      const old = JSON.parse(rc.raw.output_text); delete old.landmarkInventory; rc.raw.output_text = JSON.stringify(old); }));
  });
});

describe('saved child identity is reused only through its own chain, at the unchanged 0.70 gate', () => {
  const excluded = async (reason: string, tamper: (w: World) => void) => {
    const w = await world(); tamper(w);
    const s = select(w);
    expect(s.rows[1].excluded, reason).toContain(reason);
    expect(s.rows[1].admitted).toBe(false);
  };
  it('wrong reference or candidate image, evaluator settings, or a broken claim chain', async () => {
    await excluded('identity_wire', w => w.identityChain(w.attempts[1].candidate, { wire: x => { x.messages[0].content[0].image_url.url = `sha256:${'a'.repeat(64)}`; } }));
    await excluded('identity_wire', w => w.identityChain(w.attempts[1].candidate, { wire: x => { x.messages[0].content[1].image_url.url = `sha256:${w.attempts[2].candidate.imageSha}`; } }));
    await excluded('identity_wire', w => w.identityChain(w.attempts[1].candidate, { wire: x => { x.temperature = 0.2; } }));
    await excluded('identity_chain', w => editJson(path.join(w.original, 'paid-stages', 'page_1_1_identity.claim.json'), c => { c.wireDigest = 'a'.repeat(64); }));
    await excluded('identity_evaluator', w => w.identityChain(w.attempts[1].candidate, { receiptModel: 'gpt-4.1' }));
  });
  it('a changed threshold or evaluator version, a score the raw answer does not support, or a non-passing result', async () => {
    const savedEdit = (change: (i: any) => void) => (w: World) => editJson(path.join(w.original, 'page_1.json'), p => { change(p.attempts[1].identity); });
    await excluded('identity_evaluator', savedEdit(i => { i.threshold = 0.6; }));
    await excluded('identity_evaluator', savedEdit(i => { i.evaluatorVersion = 'page-child-resemblance-vision/v0'; }));
    await excluded('identity_not_reusable', savedEdit(i => { i.resemblanceScore = 0.99; }));
    await excluded('identity_not_reusable', w => w.identityChain(w.attempts[1].candidate, { answer: a => { a.sameChildDecision = 'uncertain'; } }));
    await excluded('identity_not_reusable', savedEdit(i => { i.status = 'failed'; }));
    await excluded('identity_missing', w => editJson(path.join(w.original, 'page_1.json'), p => { p.attempts[1].identity = null; }));
  });
});

describe('a changed choice marks the next page\'s saved review as stale (no call, no redraw)', () => {
  it('records the old and new predecessor and the actual saved successor wires', async () => {
    const w = await world(), s = select(w);
    const t = staleSuccessorTransitions(w.original, w.r.book, w.page, s.originalChosen, s.chosen!.candidate);
    expect(w.r.book.sequence.pages[0].sceneId).toBe(w.r.book.sequence.pages[1].sceneId);
    expect(t).toMatchObject({ from: 1, to: 2, status: 'stale_needs_revalidation', oldPredecessor: w.attempts[2].candidate, newPredecessor: w.attempts[1].candidate,
      successorReviews: [{ step: 'page_2_0_qa', predecessorSha: w.attempts[2].candidate.imageSha }] });
    // Evidence that does not show the old predecessor is refused rather than guessed.
    editJson(path.join(w.original, 'paid-stages', 'page_2_0_qa.wire.json'), x => { x.input[0].content.pop(); });
    expect(() => staleSuccessorTransitions(w.original, w.r.book, w.page, s.originalChosen, s.chosen!.candidate)).toThrow('reselect_successor_evidence');
  });

  it('a next page in another scene has no comparison to invalidate', async () => {
    const w = await world({ page: 2 });
    expect(w.r.book.sequence.pages[2].sceneId).not.toBe(w.r.book.sequence.pages[1].sceneId);
    expect(staleSuccessorTransitions(w.original, w.r.book, 2, w.attempts[2].candidate, w.attempts[1].candidate)).toEqual({ from: 2, to: 3, status: 'not_applicable' });
  });
});
