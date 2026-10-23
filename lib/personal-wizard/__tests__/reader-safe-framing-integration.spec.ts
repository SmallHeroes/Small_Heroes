import { beforeAll, describe, expect, it } from 'vitest';
import { READER_SAFE_FRAMING_VERSION as version, READER_FIT_FRAMING_VERSION as v2, readerSafeSceneFraming } from '../../storybook-scene-framing';
import { previewSha } from '../../local-story-preview';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { personalStoryboardFrame } from '../storyboard';
import { QUALITY_CATEGORIES } from '../../local-preview-quality';
import { assessAuditionReview, attemptStatus, auditionCorrections, auditionJudgeInstruction, type AuditionAttempt } from '../simple-book-reviewed-audition';
import { LEGACY_BOOK_LAYOUT, reviewedBookLayoutSchema, readAuditionGrant } from '../../../scripts/personal-simple-book-reviewed-audition';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

describe('actual frame/context and native-layout opt-in', () => {
  let fixture: Awaited<ReturnType<typeof personalStoryboardFixture>>;
  beforeAll(async () => { fixture = await personalStoryboardFixture(); }, 20000);
  it.each([0, 1, 7])('binds cover/body frame %i guidance to BOTH renderer and QA without changing source', page => {
    const f = fixture, before = JSON.stringify(f.book);
    const old = personalStoryboardFrame(f.book, f.review, page, f.current);
    const next = personalStoryboardFrame(f.book, f.review, page, { ...f.current, readerFraming: version });
    expect(next.context.readerFraming).toEqual(readerSafeSceneFraming(version, f.book.plan.pages[page].shot,
      f.book.plan.continuity!.pages[page].childHeightFraction));
    expect(next.render.prompt).toContain(version);
    expect(next.render.promptSha).toBe(previewSha(next.render.prompt));
    expect(next.qa.context).toBe(next.context);
    expect(next.qa.contextSha).toBe(next.render.contextSha);
    expect(next.packetDigest).not.toBe(old.packetDigest);
    expect(next.context.visual).toEqual(old.context.visual);
    expect(next.context.sequence).toEqual(old.context.sequence);
    expect(next.context.text).toBe(old.context.text);
    expect(auditionJudgeInstruction('page', { packet: next.context })).toContain('context.packet.readerFraming is the render');
    expect(auditionJudgeInstruction('page', { packet: old.context })).not.toContain('READER-SAFE SCENE FRAMING');
    expect(JSON.stringify(f.book)).toBe(before);
    expect(personalStoryboardFrame(f.book, f.review, page, f.current)).toEqual(old);
  });
  it('a corrupt explicit marker cannot silently become legacy render instructions', () => {
    const f = fixture;
    expect(() => personalStoryboardFrame(f.book, f.review, 1, { ...f.current, readerFraming: 'unknown' as never })).toThrow('framing_contract');
  });
  it.each([0, 1, 7])('binds prospective v2 on the actual cover/body frame %i and shared judge', page => {
    const f = fixture, old = personalStoryboardFrame(f.book, f.review, page, f.current);
    const next = personalStoryboardFrame(f.book, f.review, page, { ...f.current, readerFraming: v2 });
    expect(next.context.readerFraming).toEqual(readerSafeSceneFraming(v2, f.book.plan.pages[page].shot,
      f.book.plan.continuity!.pages[page].childHeightFraction));
    expect(next.render.prompt).toContain('Pull the CAMERA BACK');
    expect(next.render.prompt).toContain(v2);
    expect(next.qa.context).toBe(next.context);
    expect(next.qa.contextSha).toBe(next.render.contextSha);
    expect(next.context.text).toBe(old.context.text);
    expect(next.context.visual).toEqual(old.context.visual);
    expect(next.context.sequence).toEqual(old.context.sequence);
    expect(next.packetDigest).not.toBe(old.packetDigest);
    expect(auditionJudgeInstruction('page', { packet: next.context })).toContain('ceiling55%');
  });
  it('the exact optional layout is accepted; legacy/default and unknown versions stay distinct', () => {
    expect(reviewedBookLayoutSchema.parse(LEGACY_BOOK_LAYOUT)).toEqual(LEGACY_BOOK_LAYOUT);
    expect(LEGACY_BOOK_LAYOUT).not.toHaveProperty('readerFraming');
    expect(reviewedBookLayoutSchema.parse({ ...LEGACY_BOOK_LAYOUT, readerFraming: version }).readerFraming).toBe(version);
    for (const readerFraming of [null, true, '', 'reader-safe-scene-framing/v3'])
      expect(reviewedBookLayoutSchema.safeParse({ ...LEGACY_BOOK_LAYOUT, readerFraming }).success).toBe(false);
  });
  it.each(['version', 'target', 'rect', 'impact', 'missing'])('rejects a forged %s in the judge contract', field => {
    const framing: any = readerSafeSceneFraming(version, 'medium', .45);
    if (field === 'version') framing.version = 'unknown';
    if (field === 'target') framing.targetChildHeightFraction = .9;
    if (field === 'rect') framing.safeActionRect.left = .1;
    if (field === 'impact') framing.ratioDeviationImpact = 'story';
    if (field === 'missing') delete framing.maximumVisibleActorHeightFraction;
    expect(() => auditionJudgeInstruction('page', { packet: { readerFraming: framing } })).toThrow('audition_reader_framing_contract');
  });
  it.each([false, true])('requires the layout and grant to agree in BOTH directions (grant opt-in %s)', optedIn => {
    const dir = mkdtempSync(path.join(tmpdir(), 'reader-framing-grant-')), evidence = path.join(dir, 'evidence.json'), file = path.join(dir, 'grant.json');
    writeFileSync(evidence, '{}');
    const book = { requestId: 'a'.repeat(64), storyboardDigest: 'b'.repeat(64), ...(optedIn ? { readerFraming: version } : {}) };
    const grant = { version: 'audition-spend-grant/v1', approvalReference: 'Synthetic offline authority fixture; NOT permission to spend', book,
      ledger: { priorKnownApiMicroUsd: 0, evidence: [{ file: evidence, sha256: previewSha('{}') }], note: 'Synthetic known fixture ledger' },
      capMicroUsd: 1000000, maxCalls: 1, scope: { mode: 'render', pages: [1] },
      claudeMax: 'Claude Max usage is separate: not an API invoice, not $0 and not included in this ledger' };
    writeFileSync(file, JSON.stringify(grant));
    expect(readAuditionGrant(file, book).grant.book).toEqual(book);
    const mismatch = { requestId: book.requestId, storyboardDigest: book.storyboardDigest, ...(!optedIn ? { readerFraming: version } : {}) };
    expect(() => readAuditionGrant(file, mismatch)).toThrow('audition_grant_reader_framing');
  });
  it.each(['detail', 'story', 'safety'] as const)('retains the existing %s gate; no ratio-based retry engine is introduced', impact => {
    const candidateSha = 'a'.repeat(64), contextSha = 'b'.repeat(64);
    const raw = { candidateSha, contextSha, checks: QUALITY_CATEGORIES.map(category => ({ category,
      verdict: category === (impact === 'safety' ? 'safety' : 'framing') ? 'defect' : 'pass', observation: 'Synthetic visible evidence, not pixel QA',
      correction: category === (impact === 'safety' ? 'safety' : 'framing') ? 'Correct the reported requirement' : '',
      issues: category === (impact === 'safety' ? 'safety' : 'framing') ? [{ impact, requirement: impact === 'story' ? 'page_text' : impact === 'safety' ? 'safety' : 'framing', note: 'Synthetic finding' }] : [] })) };
    const { review, assessment } = assessAuditionReview(raw, candidateSha, contextSha, ['framing', 'page_text', 'safety']);
    const attempt = { attempt: 0, candidate: { imageSha: candidateSha, imageName: 'image.png' }, review, assessment,
      identity: { status: 'passed', subjectVisible: true, sameChild: true, reasonCode: 'same_child', threshold: .7, resemblanceScore: .8 } } as AuditionAttempt;
    expect(attemptStatus('page', attempt)).toBe(impact === 'detail' ? 'qa_supported' : impact === 'safety' ? 'ineligible_safety' : 'held');
    expect(auditionCorrections(attempt, 'page') === '').toBe(impact === 'detail');
  });
  it.each([[version, v2], [v2, version], [v2, v2]] as const)('binds explicit grant %s to exact prospective book %s', (grantVersion, bookVersion) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'reader-fit-grant-')), evidence = path.join(dir, 'evidence.json'), file = path.join(dir, 'grant.json');
    writeFileSync(evidence, '{}');
    const book = { requestId: 'a'.repeat(64), storyboardDigest: 'b'.repeat(64), readerFraming: bookVersion };
    const grant = { version: 'audition-spend-grant/v1', approvalReference: 'Synthetic offline v2 binding; NOT permission to spend',
      book: { ...book, readerFraming: grantVersion }, ledger: { priorKnownApiMicroUsd: 0,
        evidence: [{ file: evidence, sha256: previewSha('{}') }], note: 'Synthetic known ledger' },
      capMicroUsd: 1000000, maxCalls: 1, scope: { mode: 'render', pages: [1] },
      claudeMax: 'Claude Max usage is separate: not an API invoice, not $0 and not included in this ledger' };
    writeFileSync(file, JSON.stringify(grant));
    if (grantVersion === bookVersion) expect(readAuditionGrant(file, book).grant.book).toEqual(book);
    else expect(() => readAuditionGrant(file, book)).toThrow('audition_grant_reader_framing');
  });
});
