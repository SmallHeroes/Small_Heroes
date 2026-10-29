import { describe, expect, it } from 'vitest';
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { auditionContinuityReport, auditionContinuityReportMain, withoutWin32Namespace, writeAuditionContinuityReport } from '../../../scripts/personal-audition-continuity-report';

// Engine continuity repair, stage A (2026-10-29): a read-only report over a SAVED book. Two synthetic worlds, neither the R17 book.
type World = { landmark: string; landmarkDesign: string; prop: string; part: { id: string; design: string }; outdoor: string; indoor: string };
const FOREST: World = { landmark: 'old_oak', landmarkDesign: 'An old oak split by lightning down its trunk.', prop: 'lantern',
  part: { id: 'owl_nest', design: 'A nest woven around a lantern handle.' }, outdoor: 'forest', indoor: 'cottage' };
const HARBOUR: World = { landmark: 'white_lighthouse', landmarkDesign: 'A white lighthouse with a red band.', prop: 'red_sail',
  part: { id: 'toy_boat', design: 'A toy boat whose mast carries a red sail.' }, outdoor: 'harbour', indoor: 'boathouse' };

/** A review wire as the engine saves it: the judge envelope {candidateSha, contextSha, context, imageRoles} as one input_text, then images. */
function writeReview(book: string, n: number, context: unknown, serialize: (payload: unknown) => string = p => JSON.stringify(p), extra: unknown[] = []) {
  const payload = { candidateSha: 'c'.repeat(64), contextSha: 'd'.repeat(64), context, imageRoles: ['candidate'] };
  mkdirSync(path.join(book, 'paid-stages'), { recursive: true });
  writeFileSync(path.join(book, 'paid-stages', `page_${n}_0_qa.wire.json`), JSON.stringify({ model: 'judge', input: [{ role: 'user',
    content: [{ type: 'input_text', text: serialize(payload) }, ...extra, { type: 'input_image', image_url: 'sha256:' + 'e'.repeat(64) }] }] }));
}
/** A saved book: page 0 indoors, pages 1–2 outdoors (one scene), as the engine writes it (review envelope, render wire, sheets). */
function savedBook(w: World) {
  const book = mkdtempSync(path.join(tmpdir(), 'continuity-report-')), json = (rel: string, v: unknown) => {
    mkdirSync(path.dirname(path.join(book, rel)), { recursive: true }); writeFileSync(path.join(book, rel), JSON.stringify(v, null, 2));
  };
  json('book-layout.json', { version: 'reviewed-book-layout/v1', storyboardDir: 'text_1' });
  const locations = [w.indoor, w.outdoor];
  json('text_1/owned_storyboard_draft.json', { plan: { locations: locations.map(id => ({ id, design: `The ${id}.` })), continuity: {
    companionStandingHeightInChildHeights: 0.5,
    entities: [{ id: w.landmark, kind: 'landmark', invariants: [{ attribute: 'design', value: w.landmarkDesign }] },
      { id: w.prop, kind: 'prop', invariants: [{ attribute: 'design', value: `A ${w.prop.split('_').join(' ')}.` }] },
      { id: w.part.id, kind: 'prop', invariants: [{ attribute: 'design', value: w.part.design }] }],
    pages: [0, 1, 2].map(n => ({ pageNumber: n, visibleLocationIds: [n === 0 ? w.indoor : w.outdoor] })) } } });
  for (const n of [0, 1, 2]) {
    const planned = n !== 0;
    json(`page_${n}.json`, { pageNumber: n, status: 'held', attempts: [{ attempt: 0 }], chosen: { identity: { resemblanceScore: 0.9 }, assessment: { findings: [
      { requirement: `landmark_unique:${w.landmark}`, category: 'environment', verdict: 'uncertain', impact: 'continuity' },
      { requirement: `not_yet_revealed:${w.prop}`, category: 'props', verdict: 'defect', impact: 'story' },
      ...(n === 2 ? [{ requirement: 'cast:companion', category: 'relative_scale', verdict: 'defect', impact: 'identity' },
        { requirement: 'framing', category: 'framing', verdict: 'defect', impact: 'detail' }] : []),
    ] } } });
    json(`paid-stages/page_${n}_0.wire.json`, { body: { prompt: [`Page ${n}. The ${w.part.design}`, `UNIQUE LANDMARKS (one each, never duplicated): ${w.landmark}.`,
      `NOT YET IN THE STORY (must not appear, not even as tracks or marks): ${w.prop}.`, 'STATE {"predecessor":null}'].join('\n') },
      references: [{ imageName: 'reference_child.png' }, { imageName: 'reference_companion.png' }, { imageName: 'sheet_entities_0.png' }, { imageName: 'sheet_locations_1.png' }] });
    const context = { predecessor: n === 2 ? { pageNumber: 1, imageName: 'page_1_0.png', authority: 'comparison_only_not_canonical' } : null,
      referenceStatus: { entities: { status: 'approved_reference', knownFlaws: [] }, locations: { status: 'diagnostic_candidate', knownFlaws: [] } },
      checks: { uniqueLandmarks: [{ id: w.landmark, design: w.landmarkDesign, plannedVisible: planned }] },
      references: [{ imageName: 'reference_child.png' }, ...(n === 2 ? [{ imageName: 'page_1_0.png' }] : [])] };
    writeReview(book, n, context);
  }
  json('sheet_entities.json', { status: 'qa_supported', attempts: [{}], chosen: { candidate: { imageName: 'sheet_entities_0.png' }, assessment: { findings: [] } } });
  json('sheet_locations.json', { status: 'held', attempts: [{}, {}], chosen: { candidate: { imageName: 'sheet_locations_1.png' }, assessment: { findings: [
    { requirement: `design:${w.landmark}`, impact: 'continuity', note: 'the landmark is not distinct' }, { requirement: 'framing', impact: 'detail', note: 'tight' }] } } });
  return book;
}
const tree = (dir: string): Record<string, string> => Object.fromEntries(readdirSync(dir, { recursive: true }).map(String)
  .filter(f => statSync(path.join(dir, f)).isFile()).sort().map(f => [f, createHash('sha256').update(readFileSync(path.join(dir, f))).digest('hex')]));

describe('stage A: a read-only continuity report of a saved book (every id from its own storyboard)', () => {
  for (const world of [FOREST, HARBOUR]) it(`${world.outdoor}: reference sets, predecessor presence, landmark scope, sheets, parts and findings`, () => {
    const book = savedBook(world);
    try {
      const r = auditionContinuityReport(book);
      expect(r.book.landmarks).toEqual([world.landmark]);
      const [indoor, first, second] = r.pages;
      // The render prose lists the outdoor landmark on the indoor frame, where the review says it is not planned visible.
      expect(indoor.attempts[0].unscopedRenderLandmarks).toEqual([world.landmark]);
      expect(first.attempts[0].unscopedRenderLandmarks).toEqual([]);
      // Render references never include the previous page; the review gets it as comparison only.
      expect(second.attempts[0].render.previousPageImage).toBe(false);
      expect(second.attempts[0].render.contextPredecessor).toBe('null');
      expect(second.attempts[0].review!.predecessor).toEqual({ present: true, imageName: 'page_1_0.png' });
      expect(second.attempts[0].review!.references).toEqual(['page_1_0.png', 'reference_child.png']);
      expect(first.attempts[0].review!.references).toEqual(['reference_child.png']);
      expect(first.attempts[0].review!.predecessor).toEqual({ present: true, imageName: null });
      expect(second.attempts[0].review!.referenceStatus).toEqual({ entities: 'approved_reference', locations: 'diagnostic_candidate' });
      expect(r.sheets.locations).toEqual({ status: 'held', attempts: 2, chosen: 'sheet_locations_1.png', knownFlaws: [`design:${world.landmark}: the landmark is not distinct`] });
      expect(r.partMentions).toEqual([{ entity: world.part.id, mentions: world.prop, attribute: 'design', text: world.part.design }]);
      expect(first.attempts[0].render.partMentionsInRender).toEqual([{ entity: world.part.id, mentions: world.prop, attribute: 'design', inRender: true }]);
      expect(first.attempts[0].review!.contextFound).toBe(true);
      expect(second.relativeScale).toEqual([{ requirement: 'cast:companion', category: 'relative_scale', verdict: 'defect', impact: 'identity', derived: false }]);
      expect(r.byRequirement[`landmark_unique:${world.landmark}`].map(f => f.page)).toEqual([0, 1, 2]);
      expect(r.book.companionStandingHeightInChildHeights).toBe(0.5);
    } finally { rmSync(book, { recursive: true, force: true }); }
  });
  it('the counterfactual follows only the declared rule, and records it', () => {
    const book = savedBook(FOREST);
    try {
      const plain = auditionContinuityReport(book);
      expect(plain.counterfactual.rule).toEqual({ landmarkUniqueUncertain: true, declaredAmbiguous: [], criticalImpacts: ['story', 'identity', 'continuity'] });
      expect(plain.counterfactual.pagesThatWouldStillHold).toEqual([0, 1, 2]); // the reveal defect still counts
      const declared = auditionContinuityReport(book, { ambiguousRequirements: ['not_yet_revealed:lantern'] });
      expect(declared.counterfactual.rule.declaredAmbiguous).toEqual(['not_yet_revealed:lantern']);
      expect(declared.counterfactual.pagesThatWouldStillHold).toEqual([2]); // page 2 still has the scale defect
      expect(declared.counterfactual.pagesHeldOnlyByAmbiguousRules).toEqual([0, 1]);
      expect(declared.pages[2].counterfactual.remaining).toEqual(['cast:companion [defect/identity]']);
      // Only an UNCERTAIN uniqueness verdict is kind-ambiguous: a uniqueness DEFECT (a real duplicate) still holds its page.
      const file = path.join(book, 'page_1.json'), p = JSON.parse(readFileSync(file, 'utf8'));
      p.chosen.assessment.findings.push({ requirement: 'landmark_unique:old_oak', category: 'environment', verdict: 'defect', impact: 'continuity' });
      writeFileSync(file, JSON.stringify(p));
      const duplicate = auditionContinuityReport(book, { ambiguousRequirements: ['not_yet_revealed:lantern'] });
      expect(duplicate.counterfactual.pagesThatWouldStillHold).toEqual([1, 2]);
      expect(duplicate.pages[1].counterfactual.remaining).toEqual(['landmark_unique:old_oak [defect/continuity]']);
    } finally { rmSync(book, { recursive: true, force: true }); }
  });
  it('reads only: the saved book is byte-identical after a report, the output is created once and never inside the book', () => {
    const book = savedBook(HARBOUR), outDir = mkdtempSync(path.join(tmpdir(), 'continuity-out-')), out = path.join(outDir, 'report.json');
    try {
      const before = tree(book);
      writeAuditionContinuityReport(book, out);
      expect(tree(book)).toEqual(before);
      expect(JSON.parse(readFileSync(out, 'utf8')).version).toBe('audition-continuity-report/v1');
      expect(() => writeAuditionContinuityReport(book, out)).toThrow(); // exclusive create
      expect(() => writeAuditionContinuityReport(book, path.join(book, 'report.json'))).toThrow('continuity_report_output');
      expect(() => writeAuditionContinuityReport(book, path.join(book, '..nested', 'r.json'))).toThrow('continuity_report_output');
      // A relative output is refused; the call runs from scratch so even a broken check could not write into the repository.
      const cwd = process.cwd(); process.chdir(outDir);
      try { expect(() => writeAuditionContinuityReport(book, 'relative.json')).toThrow('continuity_report_output'); } finally { process.chdir(cwd); }
      expect(tree(book)).toEqual(before);
      expect(() => auditionContinuityReportMain([book, path.join(outDir, 'x.json'), '--ambiguous'])).toThrow('continuity_report_args');
    } finally { rmSync(book, { recursive: true, force: true }); rmSync(outDir, { recursive: true, force: true }); }
  });
  it('refuses a malformed saved book before reading pages', () => {
    const book = savedBook(FOREST);
    try {
      writeFileSync(path.join(book, 'book-layout.json'), JSON.stringify({ storyboardDir: '../elsewhere' }));
      expect(() => auditionContinuityReport(book)).toThrow('continuity_report_layout');
      writeFileSync(path.join(book, 'book-layout.json'), JSON.stringify({ storyboardDir: 'missing' }));
      expect(() => auditionContinuityReport(book)).toThrow('continuity_report_storyboard');
    } finally { rmSync(book, { recursive: true, force: true }); }
  });
  it('A-F1: the output boundary is physical: a junction into the book, or an aliased book, is refused and nothing appears inside it', () => {
    const book = savedBook(FOREST), scratch = mkdtempSync(path.join(tmpdir(), 'continuity-alias-'));
    try {
      const before = tree(book), alias = path.join(scratch, 'alias-into-book'), aliasedBook = path.join(scratch, 'aliased-book');
      symlinkSync(book, alias, 'junction'); symlinkSync(book, aliasedBook, 'junction');
      expect(() => writeAuditionContinuityReport(book, path.join(alias, 'aliased-report.json'))).toThrow('continuity_report_output');
      expect(() => writeAuditionContinuityReport(aliasedBook, path.join(book, 'direct.json'))).toThrow('continuity_report_output');
      expect(() => writeAuditionContinuityReport(aliasedBook, path.join(alias, 'both-aliased.json'))).toThrow('continuity_report_output');
      expect(() => writeAuditionContinuityReport(book, path.join(scratch, 'missing-parent', 'r.json'))).toThrow('continuity_report_output');
      expect(tree(book)).toEqual(before);
      // A genuinely external output through an aliased book is still allowed.
      writeAuditionContinuityReport(aliasedBook, path.join(scratch, 'outside.json'));
      expect(tree(book)).toEqual(before);
    } finally { rmSync(scratch, { recursive: true, force: true }); rmSync(book, { recursive: true, force: true }); }
  });
  it.runIf(process.platform === 'win32')('R2-F1: no NTFS stream can be written onto a saved record through an external hard link; namespaced paths stay bounded', () => {
    const book = savedBook(FOREST), scratch = mkdtempSync(path.join(tmpdir(), 'continuity-ads-'));
    try {
      const record = path.join(book, 'page_0.json'), link = path.join(scratch, 'page-hardlink.json');
      linkSync(record, link);
      const before = tree(book);
      for (const stream of [':report', ':report:$DATA', '::$DATA', ':report.json']) {
        expect(() => writeAuditionContinuityReport(book, link + stream), stream).toThrow('continuity_report_output');
        expect(existsSync(record + stream.replace(/^:([^:]+).*$/, ':$1')), `${stream} on the saved record`).toBe(stream === '::$DATA');
      }
      // A stream on a brand-new external name is refused too: the rule is the syntax, not whether a link exists.
      expect(() => writeAuditionContinuityReport(book, path.join(scratch, 'new.json:stream'))).toThrow('continuity_report_output');
      expect(existsSync(path.join(scratch, 'new.json'))).toBe(false);
      // Win32 namespaced forms: inside the book refused, outside allowed.
      expect(() => writeAuditionContinuityReport(book, `\\\\?\\${path.join(book, 'ns.json')}`)).toThrow('continuity_report_output');
      expect(() => writeAuditionContinuityReport(book, `\\\\.\\${path.join(book, 'ns2.json')}`)).toThrow('continuity_report_output');
      writeAuditionContinuityReport(book, `\\\\?\\${path.join(scratch, 'ns-outside.json')}`);
      expect(existsSync(path.join(scratch, 'ns-outside.json'))).toBe(true);
      expect(tree(book)).toEqual(before);
      expect(readFileSync(record, 'utf8')).toBe(readFileSync(link, 'utf8'));
    } finally { rmSync(scratch, { recursive: true, force: true }); rmSync(book, { recursive: true, force: true }); }
  });
  it('the JS realpath fallback keeps a Win32 namespace prefix; it is removed before the boundary comparison', () => {
    expect(withoutWin32Namespace('\\\\?\\C:\\books\\one')).toBe('C:\\books\\one');
    expect(withoutWin32Namespace('\\\\.\\C:\\books\\one')).toBe('C:\\books\\one');
    expect(withoutWin32Namespace('\\\\?\\UNC\\server\\share\\one')).toBe('\\\\server\\share\\one');
    expect(withoutWin32Namespace('\\\\?\\unc\\server\\share\\one')).toBe('\\\\server\\share\\one');
    for (const plain of ['C:\\books\\one', '\\\\server\\share\\one', '/home/books/one']) expect(withoutWin32Namespace(plain)).toBe(plain);
  });
  it('A-F2: the review context is decoded, not pattern-matched: quotes, key order, whitespace and colliding nested names', () => {
    const book = savedBook(FOREST);
    try {
      const design = 'An oak bearing a sign reading "Home" on its split trunk \\ with a backslash.';
      const context = (over: Record<string, unknown> = {}) => ({
        packet: { predecessor: { imageName: 'page_7_0.png' }, note: '{"predecessor":{"imageName":"page_8_0.png"},"plannedVisible":true}' },
        references: [{ imageName: 'reference_child.png' }],
        referenceStatus: { entities: { status: 'approved_reference', knownFlaws: [{ note: 'see page_9_0.png and {"imageName":"page_9_0.png"}' }] },
          locations: { status: 'diagnostic_candidate', knownFlaws: [] } },
        predecessor: null, checks: { uniqueLandmarks: [{ plannedVisible: false, design, id: 'old_oak' }] }, ...over });
      const expectIndoor = (label: string) => {
        const p = auditionContinuityReport(book).pages[0].attempts[0];
        expect(p.review, label).toEqual({ contextFound: true, references: ['reference_child.png'], predecessor: { present: true, imageName: null },
          referenceStatus: { entities: 'approved_reference', locations: 'diagnostic_candidate' }, plannedVisible: { old_oak: false } });
        expect(p.unscopedRenderLandmarks, label).toEqual(['old_oak']);
      };
      writeReview(book, 0, context()); expectIndoor('compact, quoted design, colliding nested names');
      writeReview(book, 0, context(), p => JSON.stringify(p, null, 2)); expectIndoor('pretty-printed');
      const reversed = (v: unknown): unknown => Array.isArray(v) ? v.map(reversed) : v && typeof v === 'object'
        ? Object.fromEntries(Object.keys(v).reverse().map(k => [k, reversed((v as Record<string, unknown>)[k])])) : v;
      writeReview(book, 0, context(), p => JSON.stringify(reversed(p))); expectIndoor('every key order reversed');
      // An actual predecessor is read from the context itself, alongside its references.
      writeReview(book, 0, context({ predecessor: { pageNumber: 0, imageName: 'page_0_9.png' } }));
      expect(auditionContinuityReport(book).pages[0].attempts[0].review!.references).toEqual(['page_0_9.png', 'reference_child.png']);
      // No context, or two contexts: unknown, never an empty success.
      writeReview(book, 0, { unrelated: true }, () => 'plain prose, not JSON');
      expect(auditionContinuityReport(book).pages[0].attempts[0].review).toEqual({ contextFound: false, references: null, predecessor: null,
        referenceStatus: null, plannedVisible: { old_oak: null } });
      writeReview(book, 0, context(), p => JSON.stringify(p), [{ type: 'input_text', text: JSON.stringify({ context: context() }) }]);
      expect(auditionContinuityReport(book).pages[0].attempts[0].review!.contextFound).toBe(false);
      // A listed landmark without a boolean plannedVisible is unknown (null), never "not visible".
      writeReview(book, 0, context({ checks: { uniqueLandmarks: [{ id: 'old_oak', design, plannedVisible: 'false' }] } }));
      expect(auditionContinuityReport(book).pages[0].attempts[0].review!.plannedVisible).toEqual({ old_oak: null });
      expect(auditionContinuityReport(book).pages[0].attempts[0].unscopedRenderLandmarks).toEqual([]);
      // A context without the fields reports them as unknown (null), not as empty.
      writeReview(book, 0, { checks: {} });
      expect(auditionContinuityReport(book).pages[0].attempts[0].review).toEqual({ contextFound: true, references: null,
        predecessor: { present: false, imageName: null }, referenceStatus: null, plannedVisible: { old_oak: null } });
    } finally { rmSync(book, { recursive: true, force: true }); }
  });
  it('A-F3: a part mention is measured on the invariant that names it, whatever labels separate several invariants', () => {
    const book = savedBook(HARBOUR);
    try {
      const file = path.join(book, 'text_1', 'owned_storyboard_draft.json'), d = JSON.parse(readFileSync(file, 'utf8'));
      d.plan.continuity.entities.push({ id: 'blue_flag', kind: 'prop', invariants: [{ attribute: 'design', value: 'A blue flag.' }] },
        { id: 'toy_bird', kind: 'prop', invariants: [{ attribute: 'body', value: 'A toy bird assembled around a blue flag.' },
          { attribute: 'beak', value: 'A small yellow beak.' }] });
      writeFileSync(file, JSON.stringify(d));
      const wire = path.join(book, 'paid-stages', 'page_1_0.wire.json'), w = JSON.parse(readFileSync(wire, 'utf8'));
      w.body.prompt += '\nENTITY toy_bird: body: A toy bird assembled around a blue flag.; beak: A small yellow beak.';
      writeFileSync(wire, JSON.stringify(w));
      const r = auditionContinuityReport(book);
      expect(r.partMentions.filter(p => p.entity === 'toy_bird')).toEqual([{ entity: 'toy_bird', mentions: 'blue_flag', attribute: 'body',
        text: 'A toy bird assembled around a blue flag.' }]);
      expect(r.pages[1].attempts[0].render.partMentionsInRender.find((p: { entity: string }) => p.entity === 'toy_bird')).toEqual({ entity: 'toy_bird', mentions: 'blue_flag',
        attribute: 'body', inRender: true });
      expect(r.pages[2].attempts[0].render.partMentionsInRender.find((p: { entity: string }) => p.entity === 'toy_bird')!.inRender).toBe(false);
    } finally { rmSync(book, { recursive: true, force: true }); }
  });
  it('is general: the script names no entity, location or companion of any book', () => {
    const src = readFileSync(path.resolve(__dirname, '../../../scripts/personal-audition-continuity-report.ts'), 'utf8').toLowerCase();
    for (const word of ['soft_tower', 'orange_block', 'block_cat', 'valley', 'elephant', 'momo', 'ido', 'bunny']) expect(src).not.toContain(word);
  });
});
