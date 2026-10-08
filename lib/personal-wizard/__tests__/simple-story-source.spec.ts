import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { resolvePersonalWizardOptions, PROTOTYPE_COMPANION_ROSTER } from '../options';
import { canonicalJson } from '../request-acceptance';
import { prepareSimpleStory, writeSimpleStory, type SimpleStoryCall, type SimpleStoryDraft } from '../simple-story-engine';
import { createCurrentSimpleStorySource, admitCurrentSimpleStorySource, projectSimpleCliReceipt, simpleStoryboardSourceEvidence, SimpleStorySourceError,
  prepareSimpleStoryRepair, createRepairedSimpleStorySource, simpleStoryReadingPackets, REPAIRED_SIMPLE_SOURCE_VERSION } from '../simple-story-source';
import { simpleEditorCall } from '../simple-story-engine';
import { causalSourceReviewPacket, compileCausalSourceReading } from '../story-causal-experiment';
import { citationTokens } from '../story-source-citations';
import { prepareCurrentPersonalStoryboard, preparePersonalStoryboard, authorPersonalStoryboard, compilePersonalStoryboard,
  currentPersonalStoryboardFrame, personalStoryboardReviewInput, storyboardReviewDisposition, PERSONAL_STORYBOARD_VERSION } from '../storyboard';
import { PERSONAL_STORYBOARD_INSTRUCTION } from '../storyboard';
import { PERSONAL_BOOK_REVIEW_INSTRUCTION } from '../book-runner';
import * as registry from '../../companions';
import { anyPersonalStoryResultSchema } from '../story-editor-contract';
import { textCanonOptions } from '../../../scripts/personal-simple-story';
import * as admission from '../storyboard-source-admission';

const options = resolvePersonalWizardOptions();
const sha = (x: unknown) => createHash('sha256').update(canonicalJson(x)).digest('hex');
afterEach(() => vi.restoreAllMocks());

function expectSourceError(action: () => unknown, code: string) {
  try { action(); } catch (error) {
    expect(error).toBeInstanceOf(SimpleStorySourceError);
    expect((error as SimpleStorySourceError).code).toBe(code);
    expect((error as SimpleStorySourceError).message).toBe(`simple_story_source_${code}`);
    return;
  }
  expect.fail(`Expected the source to reject with ${code}`);
}

async function fixture(length = 'short', companion = 'dragon_dini', activeOptions = options) {
  const f = await personalStoryboardFixture(length, companion), p = prepareSimpleStory(f.request, activeOptions, 'simple-source-fixture');
  const plan = f.result.plan;
  const draft: SimpleStoryDraft = { title: plan.title, childGoal: plan.childGoal, companionWant: plan.companionWant,
    comicPromise: plan.comicPromise, ending: plan.ending,
    pages: f.result.manuscript.pages.map(page => ({ text: `${page.text} נועה ו${p.book.companion.shortName} משחקות בציור.` })),
    pageMap: plan.beats.map(({ pageNumber: _number, ...row }) => row),
    resilienceMoments: plan.resilience.moments.map(({ pageNumber, ...moment }) => ({ page: pageNumber, ...moment })) };
  const records: Record<string, any> = {}, calls: SimpleStoryCall[] = [];
  const generated = await writeSimpleStory(p, async call => {
    calls.push(call);
    const output = call.stage === 'author' ? structuredClone(draft) : { ...structuredClone(draft), editorChanges: ['Synthetic no-op edit, not literary acceptance.'] };
    const usage = { inputTokens: 1000, outputTokens: 2000 }, termination = { code: 0, signal: null };
    records[call.stage] = { seconds: 0.1, output, usage, estimatedMicroUsd: 100_000,
      metadata: { kind: 'cli_reported_estimate_not_invoice', reportedModels: ['claude-opus-5-5'], termination },
      raw: { termination, killConfirmed: true, stopped: false, stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false,
        session_id: call.stage === 'author' ? '11111111-1111-4111-8111-111111111111' : '22222222-2222-4222-8222-222222222222',
        total_cost_usd: 0.1, modelUsage: { 'claude-opus-5-5': usage }, structured_output: output }) } };
    return { output, usage, estimatedUsd: 0.1 };
  }, { model: 'claude-opus-5-5', reservedUsd: 2 });
  const qualified = createCurrentSimpleStorySource(f.request, generated, records as { author: unknown; editor: unknown }, activeOptions);
  return { ...f, p, records, calls, generated, qualified };
}
const reviewFor = (f: Awaited<ReturnType<typeof fixture>>, book: ReturnType<typeof compilePersonalStoryboard>) =>
  ({ ...structuredClone(f.review), sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest });

function repairReadings(f: Awaited<ReturnType<typeof fixture>>, mode = 'issue', count = 1) {
  const packets = simpleStoryReadingPackets(f.request, f.qualified, options);
  return [packets.final, packets.comparison].map((packet, ri) => {
    const numbered = causalSourceReviewPacket(packet), wire: any = numbered.packet;
    const unit = ri === 0 ? wire.manuscript.pages[0].units[0] : wire.revised.pages[0].units[0];
    return compileCausalSourceReading(packet, { packetDigest: numbered.packetDigest, summary: 'Synthetic reading only, not literary approval.',
      findings: ri ? [] : Array.from({ length: count }, () => ({ severity: mode === 'blocking_preference' ? 'blocking' : 'meaningful',
        kind: mode === 'blocking_preference' ? 'preference' : 'issue', original: [],
        revised: [{ startId: unit.id, endId: unit.id, anchor: citationTokens(unit.text).slice(0, 2).join(' ') }],
        criterion: mode === 'bytes' ? 'א'.repeat(600) : 'Synthetic material causal ambiguity.',
        explanation: mode === 'bytes' ? 'ב'.repeat(600) : 'Synthetic reader impact, not a proposed solution.' })) });
  });
}
function repairReceipt(f: Awaited<ReturnType<typeof fixture>>, ready: ReturnType<typeof prepareSimpleStoryRepair>) {
  const record = structuredClone(f.records.editor), output = { ...structuredClone(ready.priorEvidence.edited),
    editorChanges: ready.guidance.findings.map(f => `${f.id} changed: Synthetic evidence-based repair, not literary approval.`) };
  output.pages[0].text += ' נועה ודיני ממשיכות במשחק.';
  const native = JSON.parse(record.raw.stdout);
  native.session_id = '33333333-3333-4333-8333-333333333333'; native.structured_output = output;
  record.output = output; record.raw.stdout = JSON.stringify(native);
  return record;
}

describe('one source-bound fresh editor repair, no repair chain or production default', () => {
  it('keeps the default editor call byte-identical and the original source unchanged', async () => {
    const f = await fixture(), before = canonicalJson(f.qualified), readings = repairReadings(f);
    const ready = prepareSimpleStoryRepair(f.request, f.qualified, readings, options);
    expect(simpleEditorCall(f.p, f.generated.evidence.draft, f.generated.evidence.findings).input).toBe(f.calls[1].input);
    expect(ready.call.instructions).toBe(f.calls[1].instructions);
    expect(ready.call.maxOutputTokens).toBe(f.calls[1].maxOutputTokens);
    const input = JSON.parse(ready.call.input);
    expect(input.readerObservations.findings).toHaveLength(1); expect(input.readerObservations).not.toHaveProperty('summary');
    expect(input.task).toContain('fallible claims'); expect(input.task).toContain(' kept:');
    const repaired = createRepairedSimpleStorySource(f.request, f.qualified, readings, repairReceipt(f, ready), options, 2);
    expect(repaired.source.simpleSource.version).toBe(REPAIRED_SIMPLE_SOURCE_VERSION);
    expect(repaired.source.accounting.providerCalls).toBe(3);
    expect(repaired.source.accounting.estimatedUsd).toBe(.3);
    expect(repaired.source.accounting.usage).toHaveLength(3);
    const { simpleSource: _proof, ...bare } = repaired.source;
    expect(anyPersonalStoryResultSchema.safeParse(bare).success).toBe(false);
    expect(repaired.source.simpleSource.author).toEqual(f.qualified.simpleSource.author);
    expect(repaired.generated.evidence.draft).toEqual(f.generated.evidence.draft);
    expect(canonicalJson(f.qualified)).toBe(before);
    expect(prepareCurrentPersonalStoryboard(f.request, repaired.source, options).planningInput.simpleSourceEvidence)
      .toEqual(simpleStoryboardSourceEvidence(repaired.source));
    expectSourceError(() => prepareSimpleStoryRepair(f.request, repaired.source, readings, options), 'repair_invalid');
  });
  it.each(['wrong_reading_digest', 'changed_quote', 'old_quote_contract', 'no_hold', 'limit', 'bytes', 'blocking_preference'])(
    'refuses %s instead of laundering, omitting or inventing guidance', async kind => {
      const f = await fixture(), readings: any[] = repairReadings(f, kind === 'bytes' || kind === 'blocking_preference' ? kind : 'issue',
        kind === 'limit' ? 7 : kind === 'bytes' ? 6 : kind === 'no_hold' ? 0 : 1);
      if (kind === 'wrong_reading_digest') readings[0].packetDigest = '0'.repeat(64);
      if (kind === 'changed_quote') readings[0].findings[0].revised[0].quote += ' forged';
      if (kind === 'old_quote_contract') delete readings[0].sourceEvidence;
      expectSourceError(() => prepareSimpleStoryRepair(f.request, f.qualified, readings, options),
        ['wrong_reading_digest', 'changed_quote', 'old_quote_contract'].includes(kind) ? 'repair_reading_binding' :
          kind === 'bytes' ? 'repair_guidance_limit' : kind === 'blocking_preference' ? 'repair_unactionable_hold' : 'repair_finding_limit');
    });
  it.each(['same_author_session', 'same_prior_editor_session', 'unknown_cost', 'missing_disposition', 'duplicate_disposition'])(
    'refuses fresh-editor %s with no reused receipt or automatic fallback', async kind => {
      const f = await fixture(), readings = repairReadings(f), ready = prepareSimpleStoryRepair(f.request, f.qualified, readings, options);
      const record = repairReceipt(f, ready), native = JSON.parse(record.raw.stdout);
      if (kind === 'same_author_session') native.session_id = f.qualified.simpleSource.author.sessionId;
      if (kind === 'same_prior_editor_session') native.session_id = f.qualified.simpleSource.editor.sessionId;
      if (kind === 'unknown_cost') record.estimatedMicroUsd = null;
      if (kind === 'missing_disposition') record.output.editorChanges = ['Synthetic edit with no observation disposition.'];
      if (kind === 'duplicate_disposition') record.output.editorChanges.push(record.output.editorChanges[0]);
      native.structured_output = record.output; record.raw.stdout = JSON.stringify(native);
      expectSourceError(() => createRepairedSimpleStorySource(f.request, f.qualified, readings, record, options, 2),
        kind === 'same_author_session' ? 'call_binding' : kind === 'same_prior_editor_session' ? 'repair_lineage' : kind === 'unknown_cost' ? 'receipt_invalid' : 'repair_disposition');
    });
  it.each(['guidance', 'prior_text', 'prior_cost', 'dropped_prior_cost', 'lost_prior_amount', 'retag', 'prior_session'])(
    'rejects repaired-source %s at the actual storyboard admission boundary', async kind => {
      const f = await fixture(), readings = repairReadings(f), ready = prepareSimpleStoryRepair(f.request, f.qualified, readings, options);
      const raw: any = createRepairedSimpleStorySource(f.request, f.qualified, readings, repairReceipt(f, ready), options, 2).source;
      if (kind === 'guidance') raw.simpleSource.repair.guidance.findings[0].explanation = 'Different unsupported instruction.';
      if (kind === 'prior_text') raw.simpleSource.repair.prior.manuscript.pages[0].text += ' Forged';
      if (kind === 'prior_cost') raw.simpleSource.repair.prior.simpleSource.editor.estimatedMicroUsd += 1;
      if (kind === 'dropped_prior_cost') { raw.accounting.providerCalls = 2; raw.accounting.estimatedUsd = .2; raw.accounting.usage.pop(); }
      if (kind === 'lost_prior_amount') raw.accounting.estimatedUsd = .2; // Three calls/usages stay valid; this targets the amount alone.
      if (kind === 'retag') { raw.simpleSource.version = f.qualified.simpleSource.version; delete raw.simpleSource.repair; }
      if (kind === 'prior_session') raw.simpleSource.editor.sessionId = f.qualified.simpleSource.editor.sessionId;
      expect(() => prepareCurrentPersonalStoryboard(f.request, raw, options)).toThrow(SimpleStorySourceError);
    });
});

describe('simple final source -> existing current whole-book storyboard', () => {
  it('pins the shared dispatcher at preparation and at both frozen/current frame checks', async () => {
    const f = await fixture(), guard = vi.spyOn(admission, 'admitCurrentStoryboardStory');
    const source = prepareCurrentPersonalStoryboard(f.request, f.qualified, options);
    expect(guard).toHaveBeenCalledExactlyOnceWith(f.request, f.qualified, options);
    const book = compilePersonalStoryboard(source, f.draft), review = reviewFor(f, book);
    guard.mockClear();
    currentPersonalStoryboardFrame(book, review, 1, { request: f.request, writerResult: f.qualified, options });
    expect(guard).toHaveBeenCalledTimes(2);
    expect(guard).toHaveBeenNthCalledWith(1, source.request, source.result, options);
    expect(guard).toHaveBeenNthCalledWith(2, f.request, f.qualified, options);
  });
  it('uses the actual fifteen-companion trial options consistently and rejects a default-options downgrade', async () => {
    const trialOptions = textCanonOptions(options), f = await fixture('short', 'dragon_dini', trialOptions);
    const source = prepareCurrentPersonalStoryboard(f.request, f.qualified, trialOptions);
    const book = compilePersonalStoryboard(source, f.draft), review = reviewFor(f, book);
    expect(currentPersonalStoryboardFrame(book, review, 1, { request: f.request, writerResult: f.qualified, options: trialOptions }).runtimeEligible).toBe(false);
    expect(() => prepareCurrentPersonalStoryboard(f.request, f.qualified, options)).toThrow('writing_binding');
    expect(() => currentPersonalStoryboardFrame(book, review, 1, { request: f.request, writerResult: f.qualified, options })).toThrow('writing_binding');
  });
  it.each(['short', 'medium', 'long'])('admits a complete %s book at BOTH current entry points, with final text unchanged', async length => {
    const f = await fixture(length), before = structuredClone(f.generated);
    expect(f.calls.map(c => c.stage)).toEqual(['author', 'editor']);
    expect(f.calls[1].input).not.toContain('readerVerdict');
    expect(f.qualified).not.toHaveProperty('editing');
    expect(f.qualified.manuscript).toEqual(f.generated.result.manuscript);
    const source = prepareCurrentPersonalStoryboard(f.request, f.qualified, options);
    const author = vi.fn(async () => structuredClone(f.draft));
    const book = await authorPersonalStoryboard(source, author, new AbortController().signal);
    const review = reviewFor(f, book), current = { request: f.request, writerResult: f.qualified, options };
    expect(PERSONAL_STORYBOARD_VERSION).toBe('personal-book-storyboard/offline-v3');
    expect(book.narrativeSpreads).toBe(f.p.book.pages);
    const packets = Array.from({ length: book.narrativeSpreads + 1 }, (_, n) => currentPersonalStoryboardFrame(book, review, n, current));
    expect(packets.every(packet => packet.runtimeEligible === false)).toBe(true);
    for (const packet of packets) expect(packet.context.text).toBe(packet.context.pageNumber === 0 ? f.qualified.manuscript.title : f.qualified.manuscript.pages[packet.context.pageNumber - 1].text);
    expect(source.planningInput.simpleSourceEvidence).toEqual(simpleStoryboardSourceEvidence(f.qualified));
    expect(personalStoryboardReviewInput(book).simpleSourceEvidence).toEqual(source.planningInput.simpleSourceEvidence);
    expect(personalStoryboardReviewInput(book)).not.toHaveProperty('draft');
    expect(author).toHaveBeenCalledTimes(1);
    expect(f.generated).toEqual(before);
  });

  it.each([
    { kind: 'writing_request', code: 'writing_binding' }, { kind: 'options', code: 'writing_binding' },
    { kind: 'book', code: 'writing_binding' }, { kind: 'shape', code: 'writing_binding' },
    { kind: 'checks', code: 'checks_binding' }, { kind: 'findings', code: 'checks_binding' },
    { kind: 'author_call', code: 'call_binding' }, { kind: 'editor_call', code: 'call_binding' },
    { kind: 'author_output', code: 'output_binding' }, { kind: 'editor_output', code: 'output_binding' },
    { kind: 'author_stage', code: 'call_binding' }, { kind: 'editor_stage', code: 'call_binding' },
    { kind: 'same_session', code: 'call_binding' }, { kind: 'unknown_cost', code: 'invalid' },
    { kind: 'wrong_model', code: 'invalid' }, { kind: 'accounting', code: 'accounting_binding' },
    { kind: 'final_text', code: 'final_binding' }, { kind: 'missing_evidence', code: 'invalid' },
    { kind: 'wrong_version', code: 'invalid' },
  ])(
    'rejects $kind evidence with $code before planning and at frame extraction without downgrading', async ({ kind, code }) => {
      const f = await fixture(), raw: any = structuredClone(f.qualified);
      const source = prepareCurrentPersonalStoryboard(f.request, f.qualified, options), book = compilePersonalStoryboard(source, f.draft), review = reviewFor(f, book);
      const proof = raw.simpleSource, evidence = proof.evidence;
      if (kind === 'writing_request') evidence.source.requestId = 'a'.repeat(64);
      if (kind === 'options') evidence.source.optionsFingerprint = 'a'.repeat(64);
      if (kind === 'book') evidence.source.bookDigest = 'a'.repeat(64);
      if (kind === 'shape') evidence.shape = 'wrong-shape';
      if (kind === 'checks') evidence.finalCheck.hard = [];
      if (kind === 'checks') evidence.finalCheck.soft.push('invented_check');
      if (kind === 'findings') evidence.findings.push('invented finding');
      if (kind === 'author_call') proof.author.callDigest = 'a'.repeat(64);
      if (kind === 'editor_call') proof.editor.callDigest = 'a'.repeat(64);
      if (kind === 'author_output') proof.author.outputDigest = 'a'.repeat(64);
      if (kind === 'editor_output') proof.editor.outputDigest = 'a'.repeat(64);
      if (kind === 'author_stage') proof.author.stage = 'editor';
      if (kind === 'editor_stage') proof.editor.stage = 'author';
      if (kind === 'same_session') proof.editor.sessionId = proof.author.sessionId;
      if (kind === 'unknown_cost') proof.editor.estimatedMicroUsd = null;
      if (kind === 'wrong_model') proof.editor.model = 'different-model';
      if (kind === 'accounting') raw.accounting.estimatedUsd += 0.01;
      if (kind === 'final_text') raw.manuscript.pages[0].text += ' Unapproved prose.';
      if (kind === 'missing_evidence') delete proof.evidence;
      if (kind === 'wrong_version') proof.version = 'old-version';
      expectSourceError(() => prepareCurrentPersonalStoryboard(f.request, raw, options), code);
      expectSourceError(() => currentPersonalStoryboardFrame(book, review, 1, { request: f.request, writerResult: raw, options }), code);
    });

  it.each(['author', 'editor'] as const)('pins current %s input recomputation when the receipt and evidence agree on a stale digest', async role => {
    const f = await fixture(), raw: any = structuredClone(f.qualified);
    const source = prepareCurrentPersonalStoryboard(f.request, f.qualified, options);
    const book = compilePersonalStoryboard(source, f.draft), review = reviewFor(f, book);
    const currentDigest = sha({ i: f.calls[role === 'author' ? 0 : 1].instructions, x: f.calls[role === 'author' ? 0 : 1].input });
    expect(raw.simpleSource.evidence.calls[role]).toBe(currentDigest);
    expect(raw.simpleSource[role].callDigest).toBe(currentDigest);
    expect(currentPersonalStoryboardFrame(book, review, 1, { request: f.request, writerResult: f.qualified, options }).runtimeEligible).toBe(false);
    // The saved evidence and projected receipt agree. Only recomputing the current call exposes staleness.
    const staleDigest = 'a'.repeat(64);
    expect(staleDigest).not.toBe(currentDigest);
    raw.simpleSource.evidence.calls[role] = staleDigest;
    raw.simpleSource[role].callDigest = staleDigest;
    expectSourceError(() => prepareCurrentPersonalStoryboard(f.request, raw, options), 'call_binding');
    expectSourceError(() => currentPersonalStoryboardFrame(book, review, 1, { request: f.request, writerResult: raw, options }), 'call_binding');
    expectSourceError(() => preparePersonalStoryboard(f.request, raw, options), 'call_binding');
  });

  it.each(['unknown_exit', 'nonzero', 'unknown_kill', 'stopped', 'unknown_cost', 'cost_mismatch', 'unknown_usage', 'cost_kind', 'model', 'error_reply', 'subtype', 'output'].map(
    kind => ({ kind, code: kind === 'output' ? 'receipt_output' : 'receipt_invalid' })))(
    'rejects native receipt $kind with $code rather than manufacture a completed projection', async ({ kind, code }) => {
      const f = await fixture(), record = structuredClone(f.records.editor), native = JSON.parse(record.raw.stdout);
      if (kind === 'unknown_exit') record.raw.termination.code = null;
      if (kind === 'nonzero') record.raw.termination.code = 1;
      if (kind === 'unknown_exit' || kind === 'nonzero') record.metadata.termination = structuredClone(record.raw.termination);
      if (kind === 'unknown_kill') record.raw.killConfirmed = false;
      if (kind === 'stopped') record.raw.stopped = true;
      if (kind === 'unknown_cost') record.estimatedMicroUsd = null;
      if (kind === 'cost_mismatch') native.total_cost_usd += 0.01;
      if (kind === 'unknown_usage') record.usage = null;
      if (kind === 'cost_kind') record.metadata.kind = 'unrelated-cost-record';
      if (kind === 'model') native.modelUsage = { other: native.modelUsage['claude-opus-5-5'] };
      if (kind === 'error_reply') native.is_error = true;
      if (kind === 'subtype') native.subtype = 'incomplete';
      if (kind === 'output') native.structured_output.pages[0].text += ' Wrong output.';
      record.raw.stdout = JSON.stringify(native);
      expectSourceError(() => projectSimpleCliReceipt(f.calls[1], record), code);
    });

  it('does not normalize an already compiled result or change any supplied raw record', async () => {
    const f = await fixture(), raw = structuredClone(f.generated), records = structuredClone(f.records);
    raw.result.manuscript.pages[0].text += ' ';
    const before = structuredClone(raw), recordsBefore = structuredClone(records);
    expect(() => createCurrentSimpleStorySource(f.request, raw, records as { author: unknown; editor: unknown }, options)).toThrow('noncanonical');
    expect(raw).toEqual(before); expect(records).toEqual(recordsBefore);
  });

  it('rejects a different parent request and cannot retrofit a bare simple or archived result into current permission', async () => {
    const f = await fixture(), changed = structuredClone(f.request); changed.child.name = 'תמר';
    expect(() => prepareCurrentPersonalStoryboard(changed, f.qualified, options)).toThrow('writing_binding');
    expect(() => prepareCurrentPersonalStoryboard(f.request, f.generated.result, options)).toThrow('current_edit_required');
    const archive = compilePersonalStoryboard(preparePersonalStoryboard(f.request, f.generated.result, options), f.draft);
    const review = reviewFor(f, archive);
    expect(() => currentPersonalStoryboardFrame(archive, review, 1, { request: f.request, writerResult: f.generated.result, options })).toThrow('current_edit_required');
    const stripped = structuredClone(f.qualified); delete (stripped as any).simpleSource;
    expect(() => prepareCurrentPersonalStoryboard(f.request, stripped, options)).toThrow('current_edit_required');
    // The local bridge must not widen existing preview/comparison or legacy-edit contracts.
    expect(anyPersonalStoryResultSchema.safeParse(f.qualified).success).toBe(false);
    expect(anyPersonalStoryResultSchema.safeParse(f.generated.result).success).toBe(true);
  });

  it('rejects unresolved visual identity and every writing/planning declaration drift, including normalization', async () => {
    const f = await fixture(), record = registry.getCompanionById('dragon_dini')!;
    const changed = structuredClone(record); changed.visualDescription = `${record.visualDescription} `;
    const spy = vi.spyOn(registry, 'getCompanionById').mockReturnValue(changed);
    expect(() => prepareCurrentPersonalStoryboard(f.request, f.qualified, options)).toThrow('visual_binding');
    changed.visualDescription = `${record.visualDescription} New physical detail.`;
    expect(() => prepareCurrentPersonalStoryboard(f.request, f.qualified, options)).toThrow();
    spy.mockReturnValue(null);
    expect(() => prepareCurrentPersonalStoryboard(f.request, f.qualified, options)).toThrow('appearance_unresolved');
    spy.mockRestore();
    const kim = await fixture('short', 'chameleon_koko'), kimRecord = registry.getCompanionById('chameleon_koko')!, next = structuredClone(kimRecord);
    next.appearanceStateAuthority!.states[0].hue += ' Different hue.';
    vi.spyOn(registry, 'getCompanionById').mockReturnValue(next);
    expect(() => prepareCurrentPersonalStoryboard(kim.request, kim.qualified, options)).toThrow();
  });

  it('binds differing valid author/editor records even when the final prose is identical, and refuses a held review', async () => {
    const f = await fixture(), records = structuredClone(f.records);
    for (const role of ['author', 'editor']) {
      const native = JSON.parse(records[role].raw.stdout);
      native.session_id = role === 'author' ? '33333333-3333-4333-8333-333333333333' : '44444444-4444-4444-8444-444444444444';
      records[role].raw.stdout = JSON.stringify(native);
    }
    const another = createCurrentSimpleStorySource(f.request, f.generated, records as { author: unknown; editor: unknown }, options);
    const a = prepareCurrentPersonalStoryboard(f.request, f.qualified, options), b = prepareCurrentPersonalStoryboard(f.request, another, options);
    expect(another.manuscript).toEqual(f.qualified.manuscript); expect(b.sourceDigest).not.toBe(a.sourceDigest);
    const book = compilePersonalStoryboard(a, f.draft), nextBook = compilePersonalStoryboard(b, f.draft), review = reviewFor(f, book);
    expect(() => storyboardReviewDisposition(nextBook, review)).toThrow('review_binding');
    expect(() => currentPersonalStoryboardFrame(book, review, 1, { request: f.request, writerResult: another, options })).toThrow('stale_book');
    (review.bookChecks[0] as { verdict: string }).verdict = 'uncertain';
    expect(() => currentPersonalStoryboardFrame(book, review, 1, { request: f.request, writerResult: f.qualified, options })).toThrow('held_uncertain');
  });

  it('recomputes an honest hard failure instead of trusting a claimed mechanical pass', async () => {
    const f = await fixture(), raw: any = structuredClone(f.qualified), evidence = raw.simpleSource.evidence;
    evidence.edited.pages[0].text += ' bad-dash';
    // Every other clause is valid: the model may return complete, paid, but mechanically bad prose.
    const { checkSimpleStory, compileSimpleStory } = await import('../simple-story-engine');
    evidence.finalCheck = checkSimpleStory(f.p, evidence.edited);
    const record = structuredClone(f.records.editor), output = { ...evidence.edited, editorChanges: evidence.editorChanges };
    record.output = output;
    const native = JSON.parse(record.raw.stdout); native.structured_output = output; record.raw.stdout = JSON.stringify(native);
    raw.simpleSource.editor = projectSimpleCliReceipt(f.calls[1], record);
    const candidate = { ...compileSimpleStory(f.p, evidence.edited, raw.accounting), simpleSource: raw.simpleSource };
    expect(() => admitCurrentSimpleStorySource(f.request, candidate, options)).toThrow('mechanical_held');
  });

  it.each(PROTOTYPE_COMPANION_ROSTER.flatMap(companion => ['short', 'medium', 'long'].map(length => ({ companion, length }))))(
    'keeps $companion / $length planning and review inputs bounded with compact evidence', async ({ companion, length }) => {
      const f = await fixture(length, companion), source = prepareCurrentPersonalStoryboard(f.request, f.qualified, options), book = compilePersonalStoryboard(source, f.draft);
      const review = personalStoryboardReviewInput(book);
      expect(Buffer.byteLength(PERSONAL_STORYBOARD_INSTRUCTION + canonicalJson(source.planningInput))).toBeLessThan(104_000);
      expect(Buffer.byteLength(PERSONAL_BOOK_REVIEW_INSTRUCTION + canonicalJson(review))).toBeLessThan(104_000);
      expect(Buffer.byteLength(canonicalJson(review.simpleSourceEvidence))).toBeLessThan(1000);
      expect(sha(f.qualified.simpleSource)).toBe(review.simpleSourceEvidence!.digest);
    });
});
