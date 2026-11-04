import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { frameProjection, assertProjectionMatchesPacket, picturedDelta, scenePreservationRecord, allowedContentIds, admitReferenceContent,
  contentEvidenceSha, classifyCorrection, findingLocality, assertNoPositionalReferences, neutralisePositional, sceneJudgeReferenceRoles,
  scenePreservationPromptSection, SCENE_V2_PAGE_SUFFIX, SCENE_EDIT_V2_RULES, SCENE_PRESERVATION_VERSION, REFERENCE_CONTENT_VERSION,
  OFFLINE_CONTENT_METHOD } from '../scene-preservation';
import { scopedAtlasComposite, atlasManifestEvidenceSha, REVEAL_SCOPED_ATLAS_VERSION } from '../reveal-scoped-atlas';
import { AUDITION_PAGE_SUFFIX, SCENE_V2_REFERENCE_ROLES_LINE } from '../simple-book-reviewed-audition';
import { planGPTImageRequest, SCENE_V2_MAX_REFERENCES } from '../../generate-image';
import { auditionRenderPlan, auditionJudgePayload, digestImages } from '../../../scripts/personal-simple-book-reviewed-audition';
import { READER_PORTRAIT_FRAMING_VERSION } from '../../storybook-scene-framing';
import { previewSha } from '../../local-story-preview';
import { v1RequestSeams } from './scene-v2-seams';

// ---- Synthetic sequences that are NOT any book's story. S1: a garden sand castle with towers A/B/C and a flag; S2: a kitchen robot. ----
type Rel = { relation: string; targetId: string | null };
const at = (t: string): Rel => ({ relation: 'at', targetId: t }), on = (t: string): Rel => ({ relation: 'on', targetId: t });
function packet(o: { n: number; scene: string; loc: string; cast: string[]; entities: { id: string; kind: string; invariants: { attribute: string; value: string }[];
  state: Record<string, string>; rel?: Rel }[]; drawn?: unknown; endLedger?: { entityId: string; value: Rel }[]; transitions?: unknown[] }) {
  return { pageNumber: o.n, sequence: { sceneId: o.scene, visibleCastIds: o.cast, allowedTransitions: o.transitions ?? [],
    relations: o.entities.filter(e => e.rel).map(e => ({ entityId: e.id, value: e.rel! })), ...(o.drawn ? { drawnInstant: o.drawn } : {}), ...(o.endLedger ? { endOfPageLedger: o.endLedger } : {}) },
    visual: { page: { locationId: o.loc }, continuity: { page: { visibleEntityIds: o.entities.map(e => e.id), visibleLocationIds: [o.loc] },
      entities: o.entities.map(e => ({ id: e.id, kind: e.kind, invariants: e.invariants, currentState: e.state })) } } };
}
const tower = (id: string) => ({ id, kind: 'landmark', invariants: [{ attribute: 'design', value: `${id} sand tower` }], state: { design: `${id} sand tower` }, rel: at('garden') });
const flag = (where: string, colour = 'red') => ({ id: 'flag', kind: 'prop', invariants: [{ attribute: 'colour', value: 'red' }, { attribute: 'design', value: 'paper flag' }],
  state: { colour, design: 'paper flag' }, rel: on(where) });
const proj = (p: ReturnType<typeof packet>, end: { rel?: Record<string, Rel>; attrs?: Record<string, Record<string, string>> } = {}, changes: any[] = []) =>
  frameProjection(p, { pageNumber: p.pageNumber, castIds: p.sequence.visibleCastIds, mutableAttributes: [{ entityId: 'flag', attribute: 'colour' }],
    endRelations: Object.entries(end.rel ?? {}).map(([entityId, value]) => ({ entityId, value })), endAttributes: end.attrs ?? {}, changes });
const S1 = { cast: ['child', 'companion'], loc: 'garden', scene: 'garden_visit_1' };

describe('scene-preservation/v1 record: drawn-instant time semantics, evidenced deltas, honest coverage', () => {
  it('a frame drawn BEFORE a same-page flag transfer keeps the flag at A; the next frame shows C, bound to that page\'s transition evidence', () => {
    const transfer = { entityId: 'flag', from: on('tower_a'), to: on('tower_c'), evidence: 'She carries the flag to the last tower.' };
    const p2 = packet({ n: 2, ...S1, entities: [tower('tower_a'), tower('tower_b'), tower('tower_c'), flag('tower_a')], transitions: [transfer],
      drawn: { evidence: 'She lifts the flag.', overrides: [{ entityId: 'flag', value: on('tower_a'), evidence: 'She lifts the flag.' }], attributes: [] },
      endLedger: [{ entityId: 'flag', value: on('tower_c') }] });
    const p3 = packet({ n: 3, ...S1, entities: [tower('tower_a'), tower('tower_b'), tower('tower_c'), flag('tower_c')] });
    const a = proj(p2), b = proj(p3, { rel: { flag: on('tower_c') } });
    assertProjectionMatchesPacket(a, p2); assertProjectionMatchesPacket(b, p3);
    expect(a.relations.flag).toEqual(on('tower_a')); expect(a.relationsEnd.flag).toEqual(on('tower_c'));
    expect(picturedDelta(a, b)).toEqual([{ entityId: 'flag', aspect: 'relation', from: on('tower_a'), to: on('tower_c'), evidence: [transfer.evidence] }]);
    const r = scenePreservationRecord(b, a, null);
    expect(r.baseline).toBe(false); expect(r.entities.find(e => e.id === 'tower_b')!.coverage).toEqual({ identity: 'covered', parts: 'not_covered',
      relations: 'covered', layout: 'not_covered', currentState: 'not_applicable' }); expect(r.undeclaredStructures).toBe('not_covered');
    // The mutable colour is a starting value, never a fixed invariant.
    expect(r.entities.find(e => e.id === 'flag')!.fixed).toEqual([{ attribute: 'design', value: 'paper flag' }]);
  });
  it('a temporary drawn-instant override never persists; an attribute change after the instant or an unplanned change refuses', () => {
    const lifted = packet({ n: 2, ...S1, entities: [tower('tower_a'), flag('tower_a')],
      drawn: { evidence: 'The flag is lifted high.', overrides: [{ entityId: 'flag', value: on('sky') , evidence: 'The flag is lifted high.' }], attributes: [] },
      endLedger: [{ entityId: 'flag', value: on('tower_a') }] });
    lifted.sequence.relations = [{ entityId: 'tower_a', value: at('garden') }, { entityId: 'flag', value: on('sky') }];
    const next = packet({ n: 3, ...S1, entities: [tower('tower_a'), flag('tower_a')] });
    const d = picturedDelta(proj(lifted), proj(next, { rel: { flag: on('tower_a') } }));
    expect(d).toEqual([{ entityId: 'flag', aspect: 'relation', from: on('sky'), to: on('tower_a'), evidence: ['The flag is lifted high.'] }]);
    const recolour = packet({ n: 3, ...S1, entities: [tower('tower_a'), flag('tower_a', 'blue')] });
    expect(() => picturedDelta(proj(next), proj(recolour, { attrs: { flag: { colour: 'blue' } } }))).toThrow('scene_preservation_unsupported_delta');
    expect(picturedDelta(proj(next), proj(recolour, { attrs: { flag: { colour: 'blue' } } }, [{ entityId: 'flag', attribute: 'colour', value: 'blue',
      storyEvidence: 'He paints the flag blue.' }]))).toEqual([{ entityId: 'flag', aspect: 'attribute', attribute: 'colour', from: 'red', to: 'blue', evidence: ['He paints the flag blue.'] }]);
    const moved = packet({ n: 3, ...S1, entities: [{ ...tower('tower_a'), rel: at('beach') }, flag('tower_a')] });
    expect(() => picturedDelta(proj(next), proj(moved))).toThrow('scene_preservation_unsupported_delta');
    const redesigned = packet({ n: 3, ...S1, entities: [{ ...tower('tower_a'), invariants: [{ attribute: 'design', value: 'stone tower' }], state: { design: 'stone tower' } }, flag('tower_a')] });
    expect(() => picturedDelta(proj(next), proj(redesigned))).toThrow('scene_preservation_unsupported_delta');
  });
  it('S2 kitchen robot: the arm is absent before its declared addition; a new visit is a baseline; a return keeps source identity only', () => {
    const robot = { id: 'robot', kind: 'prop', invariants: [{ attribute: 'design', value: 'cardboard robot' }], state: { design: 'cardboard robot' }, rel: at('kitchen') };
    const arm = { id: 'robot_arm', kind: 'prop', invariants: [{ attribute: 'design', value: 'tube arm' }], state: { design: 'tube arm' }, rel: { relation: 'attached_to', targetId: 'robot' } };
    const k1 = packet({ n: 1, cast: ['child'], loc: 'kitchen', scene: 'kitchen_visit_1', entities: [robot] });
    const k2 = packet({ n: 2, cast: ['child'], loc: 'kitchen', scene: 'kitchen_visit_1', entities: [robot, arm],
      transitions: [{ entityId: 'robot_arm', from: { relation: 'unestablished', targetId: null }, to: arm.rel, evidence: 'They tape on an arm.' }] });
    const yard = packet({ n: 3, cast: ['child'], loc: 'yard', scene: 'yard_visit_1', entities: [] });
    const k4 = packet({ n: 4, cast: ['child'], loc: 'kitchen', scene: 'kitchen_visit_2', entities: [robot, arm] });
    const p1 = proj(k1), p2 = proj(k2), p3 = proj(yard), p4 = proj(k4);
    expect(p1.entityIds).not.toContain('robot_arm'); expect(picturedDelta(p1, p2)).toEqual([]); // the arm enters; nothing visible on both changed
    expect(scenePreservationRecord(p3, p2, null).baseline).toBe(true); expect(scenePreservationRecord(p3, p2, null).picturedDelta).toEqual([]);
    const back = scenePreservationRecord(p4, p3, null);
    expect(back.baseline).toBe(true); expect(back.entities.map(e => [e.id, e.relation])).toEqual([['robot', at('kitchen')], ['robot_arm', arm.rel]]);
    expect(back.entities.every(e => e.coverage.parts === 'not_covered' && e.coverage.layout === 'not_covered')).toBe(true);
  });
  it('a projection that contradicts its packet refuses', () => {
    const p = packet({ n: 2, ...S1, entities: [tower('tower_a'), flag('tower_a')] }), f = proj(p);
    const bad = structuredClone(p); bad.sequence.relations[1].value = on('tower_b');
    expect(() => assertProjectionMatchesPacket(f, bad)).toThrow('scene_preservation_projection');
    expect(() => proj({ ...p, visual: { ...p.visual, continuity: { ...p.visual.continuity, entities: [] } } } as any)).toThrow('scene_preservation_projection');
  });
});

describe('scene-preservation/v1 references: admitted by qualified ACTUAL content against the current allow-set', () => {
  const f = proj(packet({ n: 2, ...S1, entities: [tower('tower_a'), flag('tower_a')] })), allowed = allowedContentIds(f);
  const ev = (imageSha: string, contents: string[], method: string = OFFLINE_CONTENT_METHOD) => ({ version: REFERENCE_CONTENT_VERSION, imageSha, contents,
    qualification: { method, evidenceSha: contentEvidenceSha({ imageSha, contents, method }) } });
  it('the allow-set holds visible entities, locations and the frame\'s cast including the reserved child', () => {
    expect([...allowed].sort()).toEqual(['child', 'companion', 'flag', 'garden', 'tower_a']);
  });
  it('qualified content admits; a record-copied, rebound, forbidden or child-less list never does', () => {
    const sha = previewSha('drawn page bytes');
    expect(admitReferenceContent(sha, ev(sha, ['child', 'flag']), allowed)).toEqual({ admitted: true, contents: ['child', 'flag'] });
    expect(admitReferenceContent(sha, ev(sha, ['child', 'flag'], 'expected_record'), allowed)).toEqual({ admitted: false, reason: 'content_unqualified' });
    expect(admitReferenceContent(previewSha('changed bytes'), ev(sha, ['child']), allowed)).toEqual({ admitted: false, reason: 'content_binding' });
    const forged = { ...ev(sha, ['child']), contents: ['child', 'flag'] };
    expect(admitReferenceContent(sha, forged, allowed)).toEqual({ admitted: false, reason: 'content_binding' });
    expect(admitReferenceContent(sha, ev(sha, ['child', 'shell']), allowed)).toEqual({ admitted: false, reason: 'content_forbidden' });
    expect(admitReferenceContent(sha, ev(sha, ['companion']), allowed, 'child')).toEqual({ admitted: false, reason: 'content_unqualified' });
    expect(admitReferenceContent(sha, null, allowed)).toEqual({ admitted: false, reason: 'content_unqualified' });
  });
});

describe('reveal-scoped-atlas/v1: a frame composite from a qualified, SHA-bound manifest; pixel membership, fail closed', () => {
  const colours: Record<string, [number, number, number]> = { shell: [240, 200, 210], bucket: [30, 90, 220], spade: [200, 40, 40], kite: [40, 200, 90] };
  async function atlas(layout: 'row' | 'column', ids = Object.keys(colours), contents: Record<string, string[]> = {}) {
    const rects = ids.map((id, i) => ({ id, rect: layout === 'row' ? { left: i * 60, top: 0, width: 50, height: 50 } : { left: 0, top: i * 60, width: 50, height: 50 } }));
    const width = layout === 'row' ? ids.length * 60 : 50, height = layout === 'row' ? 50 : ids.length * 60;
    const layers = await Promise.all(rects.map(async r => ({ input: await sharp({ create: { width: 50, height: 50, channels: 3, background: { r: colours[r.id][0], g: colours[r.id][1], b: colours[r.id][2] } } }).png().toBuffer(), left: r.rect.left, top: r.rect.top })));
    const bytes = await sharp({ create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } } }).composite(layers).png().toBuffer();
    const m: any = { version: REVEAL_SCOPED_ATLAS_VERSION, role: 'entities', atlasSha: previewSha(bytes), width, height,
      tiles: rects.map(r => ({ ...r, contents: contents[r.id] ?? [r.id] })) };
    m.qualification = { method: OFFLINE_CONTENT_METHOD, evidenceSha: atlasManifestEvidenceSha({ ...m, method: OFFLINE_CONTENT_METHOD }) };
    return { bytes, m };
  }
  const pixelsOf = async (png: Buffer) => { const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    const seen = new Set<string>(); for (let i = 0; i < data.length; i += info.channels) seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`); return seen; };
  it.each(['row', 'column'] as const)('only allowed tiles reach the composite pixels (%s layout)', async layout => {
    const { bytes, m } = await atlas(layout), c = (await scopedAtlasComposite(bytes, m, 'entities', ['bucket', 'kite'], new Set(['bucket', 'kite'])))!;
    const px = await pixelsOf(c.bytes);
    expect(px.has(colours.bucket.join(','))).toBe(true); expect(px.has(colours.kite.join(','))).toBe(true);
    expect(px.has(colours.shell.join(','))).toBe(false); expect(px.has(colours.spade.join(','))).toBe(false);
    expect(c.contents).toEqual(['bucket', 'kite']); expect(c.recipe.tiles.map(t => t.id)).toEqual(['bucket', 'kite']);
  });
  it('a wanted tile whose qualified contents are not all allowed refuses (never silently dropped)', async () => {
    const { bytes, m } = await atlas('row');
    await expect(scopedAtlasComposite(bytes, m, 'entities', ['bucket', 'shell'], new Set(['bucket']))).rejects.toThrow('scene_reference_forbidden_content');
  });
  it('an allowed tile that encloses a forbidden object refuses; a missing required tile refuses; nothing wanted gives no reference', async () => {
    const { bytes, m } = await atlas('row', Object.keys(colours), { bucket: ['bucket', 'shell'] });
    await expect(scopedAtlasComposite(bytes, m, 'entities', ['bucket'], new Set(['bucket']))).rejects.toThrow('scene_reference_forbidden_content');
    const ok = await atlas('row');
    await expect(scopedAtlasComposite(ok.bytes, ok.m, 'entities', ['bucket'], new Set(['bucket']), ['sandbox'])).rejects.toThrow('scene_atlas_missing_tile');
    expect(await scopedAtlasComposite(ok.bytes, ok.m, 'entities', [], new Set(['bucket']))).toBeNull();
  });
  it.each(['swapped_ids', 'duplicate_id', 'merged_cells', 'changed_bytes', 'unqualified_method', 'tile_out_of_bounds'])('a %s manifest refuses before any crop', async kind => {
    const { bytes, m } = await atlas('row'); let atlasBytes = bytes;
    if (kind === 'swapped_ids') { const [a, b] = [m.tiles[0].id, m.tiles[1].id]; m.tiles[0].id = b; m.tiles[0].contents = [b]; m.tiles[1].id = a; m.tiles[1].contents = [a]; }
    if (kind === 'duplicate_id') m.tiles[1].id = m.tiles[0].id;
    if (kind === 'merged_cells') m.tiles[1].rect = { ...m.tiles[0].rect, left: 25 };
    if (kind === 'changed_bytes') atlasBytes = await sharp(bytes).modulate({ brightness: 0.9 }).png().toBuffer();
    if (kind === 'unqualified_method') m.qualification.method = 'panel_detection';
    if (kind === 'tile_out_of_bounds') m.tiles[3].rect.width = 500;
    await expect(scopedAtlasComposite(atlasBytes, m, 'entities', ['bucket'], new Set(Object.keys(colours)))).rejects.toThrow('scene_atlas_unqualified');
  });
});

describe('scene-preservation/v1 correction operation: a total, ordered classifier', () => {
  const f = (category: string, requirement: string, verdict = 'defect', impact = 'continuity') => ({ category, requirement, verdict, impact, note: 'n', bound: true });
  it.each([
    [[f('props', 'entity:shell')], true, 'edit', 'verified_local_defects'],
    [[f('anatomy', 'anatomy:companion', 'defect', 'identity')], true, 'edit', 'verified_local_defects'],
    [[f('props', 'not_yet_revealed:shell', 'defect', 'story')], true, 'redraw', 'global_defect'],
    [[f('scene', 'entity:shell')], true, 'redraw', 'global_defect'],
    [[f('props', 'entity:shell'), f('environment', 'location:garden')], true, 'redraw', 'mixed_local_global'],
    [[f('props', 'entity:shell'), f('identity', 'cast:child', 'uncertain', 'identity')], true, 'redraw', 'local_with_uncertainty'],
    [[f('props', 'entity:shell')], false, 'redraw', 'local_with_failed_child_measurement'],
    [[f('props', 'unknown_future_requirement')], true, 'redraw', 'unclassified_locality'],
    [[f('props', 'entity:shell', 'uncertain')], true, 'redraw', 'uncertain_only'],
    [[], false, 'redraw', 'child_measurement_only'],
    [[f('framing', 'framing', 'defect', 'detail')], true, 'redraw', 'no_material_defect'],
  ] as const)('%j (child %s) -> %s/%s', (findings, child, kind, reason) => {
    expect(classifyCorrection(findings as any, child)).toMatchObject({ kind, reason });
  });
  it('global wins over a local prefix', () => { expect(findingLocality(f('relative_scale', 'entity:shell'))).toBe('global'); });
});

describe('scene-preservation/v1 prompts and judge roles: no positional statement outside the role-derived prefix', () => {
  it('v2 texts are role-named; the v1 page suffix fails the gate; reviewer numbering is neutralised', () => {
    for (const t of [SCENE_V2_PAGE_SUFFIX, SCENE_EDIT_V2_RULES, SCENE_V2_REFERENCE_ROLES_LINE]) assertNoPositionalReferences(t);
    expect(() => assertNoPositionalReferences(`PAGE 1${AUDITION_PAGE_SUFFIX}`)).toThrow('scene_prompt_positional');
    expect(neutralisePositional('Unlike image 3 and Image #4, the boat')).toBe('Unlike a reference and a reference, the boat');
    const p = packet({ n: 2, ...S1, entities: [tower('tower_a'), flag('tower_a')] });
    assertNoPositionalReferences(scenePreservationPromptSection(scenePreservationRecord(proj(p), null, null)));
  });
  it('judge roles are declared with exact hashes; absent means the v1 positional list', () => {
    expect(sceneJudgeReferenceRoles({ version: 'audition-page-context/v7' })).toBeNull();
    const roles = [{ role: 'canonical_child', imageSha: 'a'.repeat(64) }, { role: 'canonical_locations', imageSha: 'b'.repeat(64) }];
    expect(sceneJudgeReferenceRoles({ scenePreservation: { version: SCENE_PRESERVATION_VERSION, referenceRoles: roles } })).toEqual(roles);
    expect(() => sceneJudgeReferenceRoles({ scenePreservation: { version: 'scene-preservation/v0', referenceRoles: roles } })).toThrow('scene_judge_reference_binding');
    expect(() => sceneJudgeReferenceRoles({ scenePreservation: { version: SCENE_PRESERVATION_VERSION, referenceRoles: [roles[0], roles[0]] } })).toThrow('scene_judge_reference_binding');
  });
});

describe('v2 request seams: role table, per-mode cap, scene canvas, judge payload; v1 seams byte-identical to the pre-v2 baseline', () => {
  const plan = (mode: string, roles: string[], maxReferences = 4, count = roles.length) => planGPTImageRequest({ finalPrompt: 'SCENE TASK TEXT',
    referenceImages: Array.from({ length: count }, (_, i) => `/virtual/r${i}.png`), referenceMode: mode as never, ...(roles.length ? { referenceRoles: roles as never } : {}),
    requireReferenceEdit: true, quality: 'low', size: '1024x1536', modelOverride: 'gpt-image-2' }, { defaultQuality: 'low', defaultModel: 'gpt-image-2', maxReferences });
  const C = 'child_design_authority', P = 'companion_design_authority', E = 'entity_scoped_authority', L = 'location_scoped_authority', S = 'scene_continuity_reference', T = 'scene_edit_target';
  it.each([[[C, L]], [[C, P, L]], [[C, E, L]], [[C, P, E, L]], [[C, P, E, L, S]], [[C, L, S]]])('book_scene_render admits %j and numbers it from the roles', roles => {
    const p = plan('book_scene_render', roles); expect(p.referenceCountPassed).toBe(roles.length);
    expect([...p.finalPrompt.matchAll(/\bImage (\d+):/g)].map(m => Number(m[1]))).toEqual(roles.map((_, i) => i + 1));
  });
  it.each([[[T, C, L]], [[T, C, P, E, L]]])('book_scene_edit_v2 admits %j', roles => { expect(plan('book_scene_edit_v2', roles).referenceCountPassed).toBe(roles.length); });
  it.each([['book_scene_render', [L, C]], ['book_scene_render', [C]], ['book_scene_render', [C, L, P]], ['book_scene_render', [C, C, L]], ['book_scene_render', [T, C, L]],
    ['book_scene_render', [C, P, E, L, S, S]], ['book_scene_edit_v2', [C, L]], ['book_scene_edit_v2', [T, C, L, S]], ['book_scene_edit', [T, C, P, L]],
    ['book_design', [C, E]], ['book_identity', [C, P, E, L]]] as const)('%s refuses %j', (mode, roles) => {
    expect(() => plan(mode, [...roles])).toThrow('Invalid explicit book design reference roles.');
  });
  it('the per-mode cap is the v2 cap at both seams, independent of the environment default', () => {
    expect(SCENE_V2_MAX_REFERENCES).toBe(5);
    expect(plan('book_scene_render', [C, P, E, L, S], 4).referenceCountCap).toBe(5);
    expect(plan('book_identity', [], 4, 4).referenceCountCap).toBe(4);
  });
  it.each(['book_scene_render', 'book_scene_edit_v2'] as const)('%s keeps the portrait scene canvas and reader framing in the dry plan', mode => {
    const refs = (mode === 'book_scene_render' ? [C, L] : [T, C, L]).map((_, i) => ({ imageName: `r${i}.png`, imageSha: previewSha(`r${i}`) }));
    const roles = mode === 'book_scene_render' ? [C, L] : [T, C, L];
    const w = auditionRenderPlan('/virtual', 'SCENE TASK TEXT', refs, mode, roles as never, undefined, READER_PORTRAIT_FRAMING_VERSION).wire as any;
    expect(w.body.size).toBe('1024x1536'); expect(w.readerFraming).toBe(READER_PORTRAIT_FRAMING_VERSION); expect(w.referenceRoles).toEqual(roles);
  });
  it('the judge payload labels v2 references from the declared role/hash list, refusing any mismatch', async () => {
    const png = (v: number) => sharp({ create: { width: 64, height: 96, channels: 3, background: { r: v, g: v, b: v } } }).png().toBuffer();
    const [cand, child, loc] = await Promise.all([png(250), png(20), png(120)]);
    const context = { version: 'audition-page-context/v2', requirementIds: ['page_text'], scenePreservation: { version: SCENE_PRESERVATION_VERSION,
      referenceRoles: [{ role: 'canonical_child', imageSha: previewSha(child) }, { role: 'canonical_locations', imageSha: previewSha(loc) }] } };
    const p = await auditionJudgePayload({ candidate: { imageName: 'c.png', imageSha: previewSha(cand) }, candidateBytes: cand, context, contextSha: 'a'.repeat(64),
      refs: [child, loc], predecessor: null, kind: 'page' });
    expect(JSON.parse((p.input[0].content[0] as any).text).imageRoles.slice(5)).toEqual(['canonical_child', 'canonical_locations']);
    await expect(auditionJudgePayload({ candidate: { imageName: 'c.png', imageSha: previewSha(cand) }, candidateBytes: cand, context, contextSha: 'a'.repeat(64),
      refs: [loc, child], predecessor: null, kind: 'page' })).rejects.toThrow('scene_judge_reference_binding');
    expect(digestImages(p)).toBeTruthy();
  });
  it('v1 planner, render plan, judge payload, suffix and steps equal the baseline captured at the parent commit', async () => {
    const base = JSON.parse(readFileSync(path.join(__dirname, 'fixtures', 'scene-v2-v1-seams.json'), 'utf8'));
    expect(base.capturedAt).toBe('2ae3b641b6980a90d0a32c23bbb92a0717d06280');
    expect(await v1RequestSeams()).toEqual(base.seams);
  });
});
