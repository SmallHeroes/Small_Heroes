import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { auditionContinuityReport, auditionContinuityReportMain, writeAuditionContinuityReport } from '../../../scripts/personal-audition-continuity-report';

// Engine continuity repair, stage A (2026-10-29): a read-only report over a SAVED book. Two synthetic worlds, neither the R17 book.
type World = { landmark: string; landmarkDesign: string; prop: string; part: { id: string; design: string }; outdoor: string; indoor: string };
const FOREST: World = { landmark: 'old_oak', landmarkDesign: 'An old oak split by lightning down its trunk.', prop: 'lantern',
  part: { id: 'owl_nest', design: 'A nest woven around a lantern handle.' }, outdoor: 'forest', indoor: 'cottage' };
const HARBOUR: World = { landmark: 'white_lighthouse', landmarkDesign: 'A white lighthouse with a red band.', prop: 'red_sail',
  part: { id: 'toy_boat', design: 'A toy boat whose mast carries a red sail.' }, outdoor: 'harbour', indoor: 'boathouse' };

/** A saved book: page 0 indoors, pages 1–2 outdoors (one scene), as the engine writes it (escaped review context, render wire, sheets). */
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
    json(`paid-stages/page_${n}_0_qa.wire.json`, { input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify(context) }] }] });
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
      expect(second.attempts[0].review.predecessor).toEqual({ present: true, imageName: 'page_1_0.png' });
      expect(second.attempts[0].review.references).toEqual(['page_1_0.png', 'reference_child.png']);
      expect(first.attempts[0].review.references).toEqual(['reference_child.png']);
      expect(first.attempts[0].review.predecessor).toEqual({ present: true, imageName: null });
      expect(second.attempts[0].review.referenceStatus).toEqual({ entities: 'approved_reference', locations: 'diagnostic_candidate' });
      expect(r.sheets.locations).toEqual({ status: 'held', attempts: 2, chosen: 'sheet_locations_1.png', knownFlaws: [`design:${world.landmark}: the landmark is not distinct`] });
      expect(r.partMentions).toEqual([{ entity: world.part.id, mentions: world.prop, text: world.part.design }]);
      expect(first.attempts[0].render.partMentionsInRender).toEqual([{ entity: world.part.id, mentions: world.prop, inRender: true }]);
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
      expect(() => writeAuditionContinuityReport(book, 'relative.json')).toThrow('continuity_report_output');
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
  it('is general: the script names no entity, location or companion of any book', () => {
    const src = readFileSync(path.resolve(__dirname, '../../../scripts/personal-audition-continuity-report.ts'), 'utf8').toLowerCase();
    for (const word of ['soft_tower', 'orange_block', 'block_cat', 'valley', 'elephant', 'momo', 'ido', 'bunny']) expect(src).not.toContain(word);
  });
});
