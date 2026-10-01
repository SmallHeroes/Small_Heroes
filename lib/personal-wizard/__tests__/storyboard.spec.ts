import { describe, expect, it, vi } from 'vitest';
import { resolvePersonalWizardOptions, PROTOTYPE_COMPANION_ROSTER } from '../options';
import { canonicalJson } from '../request-acceptance';
import { previewSha, previewTextPages, previewStoryEvidence } from '../../local-story-preview';
import { authorPersonalStoryboard, preparePersonalStoryboard, compilePersonalStoryboard,
  personalStoryboardReviewInput, personalStoryboardFrame, storyboardReviewDisposition } from '../storyboard';
import { buildStyle01ChildAnatomicalLock } from '../../style01-gptimage';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { personalStoryboardFixture } from './personal-storyboard-fixture';

const options = resolvePersonalWizardOptions();

describe('personal writer -> whole-book storyboard -> identical render/QA state', () => {
  it.each([['short', 8, 16], ['medium', 12, 24], ['long', 16, 32]])('binds all %s spreads and ending before extracting frames', async (length, count, display) => {
    const f = await personalStoryboardFixture(length as string);
    expect(f.book.narrativeSpreads).toBe(count); expect(f.book.displayPages).toBe(display);
    expect(f.source.planningInput.story.pages).toEqual(f.result.manuscript.pages);
    expect(f.source.planningInput.narrativePlan.ending).toBe(f.result.plan.ending);
    expect(f.book.sequence.pages).toHaveLength(count as number);
    expect(f.book.runtimeEligible).toBe(false);
    for (let n = 0; n <= (count as number); n++) {
      const frame = personalStoryboardFrame(f.book, f.review, n, f.current);
      expect(frame.context.text).toBe(n === 0 ? f.result.manuscript.title : f.result.manuscript.pages[n - 1].text);
      expect(frame.qa.context).toBe(frame.context);
      expect(frame.qa.contextSha).toBe(frame.render.contextSha);
      expect(frame.packetDigest).toBe(previewSha(canonicalJson(frame.context)));
      expect(frame.render.prompt).toContain(`CAMERA: ${f.draft.plan.pages[n].shot}, ${f.draft.plan.pages[n].angle}`);
      expect(frame.render.prompt).toContain(`EXPRESSION: feeling ${n}`);
    }
  });
  it.each(PROTOTYPE_COMPANION_ROSTER)('binds chosen %s without a legacy topic mapping', async id => {
    const f = await personalStoryboardFixture('short', id);
    expect(personalStoryboardFrame(f.book, f.review, 1, f.current).context.companion.id).toBe(id);
    expect(f.source.brief.resilienceMode).toBe('adventure_only');
    expect(f.source.planningInput).not.toHaveProperty('allowedDirections');
  });
  it('inherits offscreen state and retains canonical set identity on return', async () => {
    const f = await personalStoryboardFixture();
    const state = (n: number, id: string) => f.book.sequence.pages[n - 1].states.find(s => s.entityId === id)!.value;
    expect(state(1, 'child').relation).toBe('inside'); expect(state(2, 'child').relation).toBe('inside');
    expect(state(3, 'child').relation).toBe('beside'); expect(state(6, 'child').relation).toBe('inside');
    expect(state(2, 'companion').relation).toBe('inside');
    expect(state(2, 'ribbon')).toEqual(state(1, 'ribbon'));
    expect(state(4, 'hut')).toEqual(state(5, 'hut'));
    const second = personalStoryboardFrame(f.book, f.review, 2, f.current);
    expect(second.context.sequence!.visibleCastIds).toEqual(['child']);
    expect(second.context.visual.recurringProps).toEqual([]);
    const returned = personalStoryboardFrame(f.book, f.review, 5, f.current);
    expect(returned.context.visual.locations[0].id).toBe('garden');
    expect(returned.context.visual.continuity.entities.find(e => e.id === 'hut')!.currentState.material).toBe('wood');
  });
  it('preserves literal prose without template interpretation', () => {
    const pages = [1, 2].map(pageNumber => ({ pageNumber, text: 'Literal {{childName}} and {boy|girl}, quotes "hello" and line\nbreak.' }));
    const story = previewTextPages({ title: 'Literal {title}', pages });
    expect(story.pages).toEqual(pages);
    expect(previewStoryEvidence(story).texts[1]).toBe(pages[0].text);
    expect(() => previewStoryEvidence(structuredClone(story))).toThrow('source_binding');
  });
  it.each(['title', 'prose', 'outline'])('does not silently trim changed final %s', async kind => {
    const f = await personalStoryboardFixture(); const result = structuredClone(f.result);
    if (kind === 'title') result.manuscript.title += ' ';
    if (kind === 'prose') result.manuscript.pages[0].text += '\n';
    if (kind === 'outline') result.plan.ending += ' ';
    expect(() => preparePersonalStoryboard(f.request, result, options)).toThrow('noncanonical_writer_result');
  });
  it.each(['name', 'residence', 'interest', 'companion', 'length', 'revision'])('rejects stale writer output after parent %s edit', async kind => {
    const f = await personalStoryboardFixture(); const request = structuredClone(f.request);
    if (kind === 'name') request.child.name = 'בר';
    if (kind === 'residence') request.child.residence = 'חיפה';
    if (kind === 'interest') request.facts[0].value = 'כדורגל';
    if (kind === 'companion') request.companion.id = 'fox_uri';
    if (kind === 'length') request.bookOptions.lengthId = 'long';
    if (kind === 'revision') request.draftRevision++;
    expect(() => preparePersonalStoryboard(request, f.result, options)).toThrow('source_binding');
    expect(() => personalStoryboardFrame(f.book, f.review, 1, { ...f.current, request })).toThrow('source_binding');
  });
  it.each(['plan', 'fact', 'fixture', 'mode'])('rejects tampered writer %s data', async kind => {
    const f = await personalStoryboardFixture(); const result = structuredClone(f.result);
    if (kind === 'plan') result.plan.ending += ' invented';
    if (kind === 'fact') {
      result.plan.beats[0].factIds = ['f_removed0001'];
      result.planDigest = previewSha(canonicalJson(result.plan)); result.manuscript.planDigest = result.planDigest;
    }
    if (kind === 'fixture') result.containsFixtureData = !result.containsFixtureData;
    if (kind === 'mode') {
      result.plan.resilience.mode = 'chosen_topic';
      result.planDigest = previewSha(canonicalJson(result.plan)); result.manuscript.planDigest = result.planDigest;
    }
    expect(() => preparePersonalStoryboard(f.request, result, options)).toThrow();
  });
  it.each(['cut', 'from', 'quote', 'cycle', 'reset', 'appearance', 'coverage', 'framing'])('rejects structural world-state defect %s', async kind => {
    const f = await personalStoryboardFixture(); const draft = structuredClone(f.draft);
    if (kind === 'cut') draft.sequence.pages[2].transitions = [];
    if (kind === 'from') draft.sequence.pages[2].transitions[0].from.targetId = 'lane';
    if (kind === 'quote') draft.sequence.pages[2].transitions[0].evidence = 'no such words';
    if (kind === 'cycle') draft.sequence.initialStates[3].value = { relation: 'held_by', targetId: 'ribbon' };
    if (kind === 'reset') draft.sequence.pages[2].transitions[0].to = { relation: 'unestablished' as any, targetId: null as any };
    if (kind === 'appearance') draft.plan.continuity.pages[2].changes.push({ entityId: 'hut', attribute: 'material', value: 'stone', storyEvidence: f.result.manuscript.pages[1].text } as never);
    if (kind === 'coverage') draft.plan.pages.pop();
    if (kind === 'framing') draft.plan.continuity.pages[1].childHeightFraction = .8;
    expect(() => compilePersonalStoryboard(f.source, draft)).toThrow();
  });
  it.each(['clone_source', 'source_edit', 'clone_book', 'book_edit'])('rejects forged or mutated %s', async kind => {
    const f = await personalStoryboardFixture();
    if (kind === 'clone_source') expect(() => compilePersonalStoryboard(structuredClone(f.source), f.draft)).toThrow('unvalidated_or_changed_source');
    if (kind === 'source_edit') { f.source.result.manuscript.pages[0].text += ' drift'; expect(() => compilePersonalStoryboard(f.source, f.draft)).toThrow('unvalidated_or_changed_source'); }
    if (kind === 'clone_book') expect(() => personalStoryboardReviewInput(structuredClone(f.book))).toThrow('unvalidated_or_changed_book');
    if (kind === 'book_edit') { f.book.plan.wardrobe += ' changed'; expect(() => personalStoryboardFrame(f.book, f.review, 1, f.current)).toThrow('unvalidated_or_changed_book'); }
  });
  it('requires the current source, rejects out-of-range frame, and invalidates a changed manuscript', async () => {
    const f = await personalStoryboardFixture();
    // @ts-expect-error detached old-source API must not return
    expect(() => personalStoryboardFrame(f.book, f.review, 1)).toThrow('current_source_required');
    expect(() => personalStoryboardFrame(f.book, f.review, .5, f.current)).toThrow('unknown_frame');
    expect(() => personalStoryboardFrame(f.book, f.review, 9, f.current)).toThrow('unknown_frame');
    const writerResult = structuredClone(f.result); writerResult.manuscript.pages[0].text += ' new text';
    expect(() => personalStoryboardFrame(f.book, f.review, 1, { ...f.current, writerResult })).toThrow('story_editor_revision_binding');
    writerResult.editing.finalDigest = previewSha(canonicalJson({ plan: writerResult.plan, manuscript: writerResult.manuscript }));
    expect(() => personalStoryboardFrame(f.book, f.review, 1, { ...f.current, writerResult })).toThrow('stale_book');
  });
  it.each(['source', 'board', 'book_check', 'frame_check', 'frame_count', 'order'])('rejects incomplete/stale review %s', async kind => {
    const f = await personalStoryboardFixture(); const review = structuredClone(f.review);
    if (kind === 'source') review.sourceDigest = 'f'.repeat(64);
    if (kind === 'board') review.storyboardDigest = 'f'.repeat(64);
    if (kind === 'book_check') review.bookChecks[1] = review.bookChecks[0];
    if (kind === 'frame_check') review.frames[0].checks[1] = review.frames[0].checks[0];
    if (kind === 'frame_count') review.frames.pop();
    if (kind === 'order') review.frames.reverse();
    expect(() => personalStoryboardFrame(f.book, review, 1, f.current)).toThrow();
    expect(() => personalStoryboardFrame(f.book, null, 1, f.current)).toThrow();
  });
  it.each(['uncertain', 'contradiction'] as const)('holds %s and keeps evidence without emitting a packet', async verdict => {
    const f = await personalStoryboardFixture(); const review: any = structuredClone(f.review);
    review.frames[2].checks[2].verdict = verdict;
    expect(storyboardReviewDisposition(f.book, review).disposition).toBe(`held_${verdict}`);
    expect(() => personalStoryboardFrame(f.book, review, 1, f.current)).toThrow(`held_${verdict}`);
  });
  it('does not pretend a matching quote or a fabricated supported review proves semantic truth', async () => {
    const f = await personalStoryboardFixture(); const draft = structuredClone(f.draft);
    draft.sequence.pages[2].transitions[0].evidence = 'They';
    const book = compilePersonalStoryboard(f.source, draft);
    expect(book.status).toBe('pending_semantic_review');
    const review: any = structuredClone(f.review); review.storyboardDigest = book.storyboardDigest;
    review.frames[3].checks[2].verdict = 'contradiction'; review.frames[3].checks[2].observation = 'They alone cannot justify an exit';
    expect(storyboardReviewDisposition(book, review).disposition).toBe('held_contradiction');
    review.frames[3].checks[2].verdict = 'supported';
    // Reports are model-proposed data, not unforgeable creative or product authority.
    expect(personalStoryboardFrame(book, review, 1, f.current).runtimeEligible).toBe(false);
  });
  it('authors once from the WHOLE source, sanitises failures and stops after cancellation', async () => {
    const f = await personalStoryboardFixture(); const author = vi.fn(async (call: any) => {
      expect(call.input.story.pages).toHaveLength(8); expect(call.input.story.pages[7]).toEqual(f.result.manuscript.pages[7]);
      call.input.story.pages[0].text = 'cannot mutate real source'; return f.draft;
    });
    expect((await authorPersonalStoryboard(f.source, author, new AbortController().signal)).sourceDigest).toBe(f.book.sourceDigest);
    expect(author).toHaveBeenCalledTimes(1);
    await expect(authorPersonalStoryboard(f.source, async () => { throw Error('secret-sentinel'); }, new AbortController().signal)).rejects.toThrow('author_failed');
    const controller = new AbortController(); controller.abort();
    await expect(authorPersonalStoryboard(f.source, author, controller.signal)).rejects.toThrow('cancelled');
    expect(author).toHaveBeenCalledTimes(1);
    const late = new AbortController();
    await expect(authorPersonalStoryboard(f.source, async () => { late.abort(); return f.draft; }, late.signal)).rejects.toThrow('cancelled');
  });
  it.each([3, 5, 8])('keeps the %i-year-old legacy anatomical lock unless explicitly opted in', age => {
    for (const companionId of [undefined, 'dragon_dini']) {
      const before = buildStyle01ChildAnatomicalLock({ childAge: age, companionId });
      expect(before).toBe(buildStyle01ChildAnatomicalLock({ childAge: age, companionId, allowDistinctSupportingChildren: false }));
      expect(before).toContain('NEVER two children');
      const opted = buildStyle01ChildAnatomicalLock({ childAge: age, companionId, allowDistinctSupportingChildren: true });
      expect(opted).not.toContain('NEVER two children');
      expect(opted).toBe(before.replace('NEVER two children', 'distinct supporting children required by the scene are allowed; NEVER two copies of the protagonist'));
    }
  });
});

describe('actual offline personal storyboard CLI', () => {
  const repo = path.resolve(__dirname, '../../..');
  const outputs = path.join(repo, 'outputs');
  const run = (args: string[]) => spawnSync(process.execPath, ['./node_modules/tsx/dist/cli.mjs',
    '--require', './scripts/shims/register-server-only.cjs', './scripts/prepare-personal-storyboard.ts', ...args],
  { cwd: repo, encoding: 'utf8', timeout: 30_000, env: { ...process.env, OPENAI_API_KEY: '', PERSONAL_WIZARD_STORY_WRITER: 'false' } });
  async function files() {
    const f = await personalStoryboardFixture(); mkdirSync(outputs, { recursive: true });
    const folder = mkdtempSync(path.join(outputs, 'personal-storyboard-test-'));
    const write = (name: string, value: unknown) => { const file = path.join(folder, name); writeFileSync(file, JSON.stringify(value)); return file; };
    const args = [write('request.json', f.request), write('result.json', f.result), write('draft.json', f.draft), write('review.json', f.review), folder + '-result'];
    const cleanup = () => {
      for (const target of [folder, folder + '-result']) {
        if (!/^personal-storyboard-test-[^/\\]+$/.test(path.relative(outputs, target))) throw Error('unsafe_test_cleanup');
        rmSync(target, { recursive: true, force: true });
      }
    };
    return { ...f, folder, args, write, cleanup };
  }
  it('writes complete source-bound packets without key/provider access, and refuses overwrite', async () => {
    const f = await files();
    try {
      const made = run(f.args); expect(made.status, made.stderr).toBe(0);
      const manifest = JSON.parse(readFileSync(path.join(f.args[4], 'manifest.json'), 'utf8'));
      expect(manifest).toMatchObject({ status: 'review_supported', runtimeEligible: false, providerCalls: 0, costUsd: 0, framePackets: 9 });
      const packets = JSON.parse(readFileSync(path.join(f.args[4], 'frame-packets.json'), 'utf8'));
      expect(packets[1].qa.context).toEqual(packets[1].context); expect(packets[1].render.contextSha).toBe(packets[1].qa.contextSha);
      const before = readFileSync(path.join(f.args[4], 'manifest.json'));
      const twice = run(f.args); expect(twice.status).toBe(1); expect(twice.stderr.trim()).toBe('personal_storyboard_output_boundary');
      expect(readFileSync(path.join(f.args[4], 'manifest.json'))).toEqual(before);
    } finally { f.cleanup(); }
  });
  it.each(['pending', 'uncertain', 'contradiction'])('preserves %s diagnostic evidence with native exit 2 and no frame packets', async status => {
    const f = await files();
    try {
      const review: any = structuredClone(f.review);
      if (status === 'pending') f.args[3] = '-';
      else { review.bookChecks[0].verdict = status; f.write('review.json', review); }
      const held = run(f.args); expect(held.status, held.stderr).toBe(2);
      const manifest = JSON.parse(readFileSync(path.join(f.args[4], 'manifest.json'), 'utf8'));
      expect(manifest.framePackets).toBe(0); expect(manifest.runtimeEligible).toBe(false);
      expect(existsSync(path.join(f.args[4], 'frame-packets.json'))).toBe(false);
    } finally { f.cleanup(); }
  });
  it.each(['traversal', 'nested', 'stale', 'malformed', 'bad_state'])('rejects %s before output writes with sanitised stderr', async kind => {
    const f = await files();
    try {
      if (kind === 'traversal') f.args[4] = path.join(outputs, '..', 'escape-test');
      if (kind === 'nested') f.args[4] = path.join(f.folder, 'nested');
      if (kind === 'stale') { const changed = structuredClone(f.request); changed.child.name = 'בר'; f.write('request.json', changed); }
      if (kind === 'malformed') writeFileSync(f.args[1], '{SECRET_SENTINEL');
      if (kind === 'bad_state') { const draft = structuredClone(f.draft); draft.sequence.pages[2].transitions[0].from.targetId = 'lane'; f.write('draft.json', draft); }
      const failed = run(f.args); expect(failed.status, failed.stderr).toBe(1);
      expect(failed.stdout.trim()).toBe(''); expect(failed.stderr).not.toMatch(/SECRET_SENTINEL|at .*\(|Error:|\.json/);
      expect(existsSync(f.folder + '-result')).toBe(false);
    } finally { f.cleanup(); }
  });
  it('refuses an output directory junction without touching the destination', async () => {
    const f = await files();
    try {
      symlinkSync(f.folder, f.args[4], 'junction');
      const failed = run(f.args); expect(failed.status, failed.stderr).toBe(1);
      expect(failed.stderr.trim()).toBe('personal_storyboard_output_boundary');
      expect(existsSync(path.join(f.folder, 'manifest.json'))).toBe(false);
      expect(lstatSync(f.args[4]).isSymbolicLink()).toBe(true);
    } finally { f.cleanup(); }
  });
});
