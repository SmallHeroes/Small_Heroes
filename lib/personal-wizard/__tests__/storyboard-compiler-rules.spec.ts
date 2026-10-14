import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { replanFixture } from './storyboard-replan-fixture';
import { resolvePersonalWizardOptions } from '../options';
import { preparePersonalStoryboard, prepareCurrentPersonalStoryboard, compilePersonalStoryboard, personalStoryboardFrame, storyboardInstructions,
  storyboardDraftSchema, PERSONAL_STORYBOARD_INSTRUCTION, OWNED_STORYBOARD_INSTRUCTION } from '../storyboard';
import { COMPILER_RULES_CONTRACT_VERSION, COMPILER_RULES_STORYBOARD_ADDENDUM } from '../storyboard-compiler-rules';
import { SCENE_LOCATION_STORYBOARD_ADDENDUM } from '../storyboard-scene-location';
import { MOMENT_STORYBOARD_ADDENDUM, STORYBOARD_MOMENTS_VERSION } from '../storyboard-moments';
import { KIND_STORYBOARD_ADDENDUM } from '../storyboard-landmark-kind';
import { wholeBookDraftSchema } from '../../local-book-planning';
import { savedCompilerRulesContract } from '../../../scripts/personal-simple-book-reviewed-audition';

const options = resolvePersonalWizardOptions();
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const flat = (s: string) => s.replace(/\s+/g, ' ');

describe('storyboard compiler-rules contract (opt-in instruction, source-bound)', () => {
  it('flag absent: every existing identity and instruction is byte-identical (pinned before the change)', async () => {
    const f = await personalStoryboardFixture();
    expect(preparePersonalStoryboard(f.request, f.result, options).sourceDigest).toBe('f1ad9a28816945b860324527a4050018ecd43cbb4eae2bd01b60975dfc4344f5');
    expect(preparePersonalStoryboard(f.request, f.result, options, true).sourceDigest).toBe('a72da5d557dba2e097c190febd3c0940ed1ac6a9b292f2b4e12aebb4ef379edb');
    expect(f.book.storyboardDigest).toBe('cb09f0812bafb902f1a7c27de12cc0593636b42b2e33498ac9501c20402c8c1f');
    expect(personalStoryboardFrame(f.book, f.review, 1, f.current).packetDigest).toBe('d737d76dc01ff5f9311247ec78c78a79cdf09b4579802a0b3a7160e8454514a1');
    expect(sha(PERSONAL_STORYBOARD_INSTRUCTION)).toBe('858f442ec1fde66c0ae79382fa961a50b1fd88803599570799264527edcc04bd');
    expect(sha(OWNED_STORYBOARD_INSTRUCTION)).toBe('a2286e4848e970b8ccef0917b0580801dbd64ab664b873f5774c3d3cc29fc8e7');
    expect(storyboardInstructions({ actorOwnedAppearance: true, momentContract: true, landmarkKindContract: true, sceneLocationContract: true }))
      .toBe(`${OWNED_STORYBOARD_INSTRUCTION}\n${MOMENT_STORYBOARD_ADDENDUM}\n${KIND_STORYBOARD_ADDENDUM}\n${SCENE_LOCATION_STORYBOARD_ADDENDUM}`);
    expect('compilerRules' in f.book).toBe(false);
  });

  it('flag on: exactly the addendum is added to the instructions, last; no schema or compiler change', () => {
    expect(storyboardInstructions({ compilerRulesContract: true })).toBe(`${PERSONAL_STORYBOARD_INSTRUCTION}\n${COMPILER_RULES_STORYBOARD_ADDENDUM}`);
    const all = { actorOwnedAppearance: true, momentContract: true, landmarkKindContract: true, sceneLocationContract: true } as const;
    expect(storyboardInstructions({ ...all, compilerRulesContract: true })).toBe(`${storyboardInstructions(all)}\n${COMPILER_RULES_STORYBOARD_ADDENDUM}`);
    expect(storyboardDraftSchema({ compilerRulesContract: true } as never)).toBe(wholeBookDraftSchema);
  });

  it('flag on: the marker is bound into the source and the book (and its digest), and current admission re-derives it', async () => {
    const f = await personalStoryboardFixture();
    const plain = preparePersonalStoryboard(f.request, f.result, options);
    const source = preparePersonalStoryboard(f.request, f.result, options, undefined, undefined, undefined, undefined, undefined, true);
    expect(source.sourceDigest).not.toBe(plain.sourceDigest);
    const book = compilePersonalStoryboard(source, f.draft), legacy = compilePersonalStoryboard(plain, f.draft);
    expect(book.compilerRules).toBe(COMPILER_RULES_CONTRACT_VERSION);
    expect([book.plan, book.sequence]).toEqual([legacy.plan, legacy.sequence]);
    expect(book.storyboardDigest).not.toBe(legacy.storyboardDigest);
    const review = { ...structuredClone(f.review), sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest };
    expect(personalStoryboardFrame(book, review, 1, f.current).context.sourceDigest).toBe(book.sourceDigest);
    expect(prepareCurrentPersonalStoryboard(f.request, f.result, options, undefined, undefined, undefined, undefined, undefined, true).sourceDigest)
      .toBe(source.sourceDigest);
    // Both instruction contracts together record both markers (and differ from either alone).
    const both = preparePersonalStoryboard(f.request, f.result, options, undefined, undefined, undefined, undefined, true, true);
    expect(new Set([both.sourceDigest, source.sourceDigest, preparePersonalStoryboard(f.request, f.result, options, undefined, undefined, undefined, undefined, true).sourceDigest]).size).toBe(3);
    expect(compilePersonalStoryboard(both, f.draft)).toMatchObject({ sceneLocation: 'storyboard-scene-location/v1', compilerRules: COMPILER_RULES_CONTRACT_VERSION });
  });

  it('policy: only true enables it, and it cannot ride on a preservation re-plan', async () => {
    const f = await personalStoryboardFixture();
    expect(() => preparePersonalStoryboard(f.request, f.result, options, undefined, undefined, undefined, undefined, undefined, 'yes' as never))
      .toThrow('personal_storyboard_compiler_rules_policy');
    const r = await replanFixture(), p = { parentStoryboardDigest: r.book.storyboardDigest, draft: r.draft };
    expect(prepareCurrentPersonalStoryboard(r.request, r.writerResult, r.options, true, undefined, true, p).preservation).toBeTruthy();
    expect(() => prepareCurrentPersonalStoryboard(r.request, r.writerResult, r.options, true, undefined, true, p, undefined, true))
      .toThrow('personal_storyboard_preservation_policy');
  });

  it('the reviewed loader takes the flag only from the saved, digest-bound book; an unknown marker is refused', () => {
    expect(savedCompilerRulesContract(undefined)).toBeUndefined();
    expect(savedCompilerRulesContract({})).toBeUndefined();
    expect(savedCompilerRulesContract({ compilerRules: COMPILER_RULES_CONTRACT_VERSION })).toBe(true);
    for (const marker of ['storyboard-compiler-rules/v2', true, null]) expect(() => savedCompilerRulesContract({ compilerRules: marker })).toThrow('audition_board_binding');
  });
});

/**
 * The audit's proof: each rule the addendum states is quoted from it (so a tested rule is a told rule) and broken, alone, on the fixture's
 * valid draft; the compiler (without the contract: the checks are the compiler's own) must refuse exactly that rule's code.
 */
describe('every rule the compiler-rules addendum states is enforced by the compiler, exactly', () => {
  type Case = [label: string, phrase: string, change: (d: any, pageText: (n: number) => string) => void, code: string, moments?: true];
  const longText = 'x'.repeat(1801);
  const directions = ['composition', 'childAction', 'childExpression', 'childGaze', 'companionAction', 'scene'];
  const cases: Case[] = [
    ['empty visualLanguage', 'visualLanguage, every design', d => { d.plan.visualLanguage = '   '; }, 'empty_visual_lock'],
    ['visualLanguage over 1800 characters', 'at most 1800 characters', d => { d.plan.visualLanguage = longText; }, 'empty_visual_lock'],
    ['an empty prop design', 'every design', d => { d.plan.recurringProps[0].design = ' '; }, 'invalid_visual_lock'],
    ['an empty location design', 'every design', d => { d.plan.locations[1].design = ''; }, 'invalid_visual_lock'],
    ...directions.map((field): Case => [`an empty ${field}`, field, d => { d.plan.pages[3][field] = ' '; }, 'empty_page_direction']),
    ['a direction over 1800 characters', 'at most 1800 characters', d => { d.plan.pages[3].scene = longText; }, 'empty_page_direction'],
    ['an empty prop state', 'every prop state', d => { d.plan.pages[1].props[0].state = ''; }, 'unknown_or_duplicate_prop'],
    ['nine recurring props', 'at most 8 recurringProps', d => { for (const x of 'abcdefgh') d.plan.recurringProps.push({ id: `prop_${x}`, design: `prop ${x}` }); },
      'invalid_lock_inventory'],
    ['no location', '1 to 16 locations', d => { d.plan.locations = []; }, 'invalid_lock_inventory'],
    ['seventeen locations', '1 to 16 locations', d => { for (let i = 0; i < 15; i++) d.plan.locations.push({ id: `place_${i}`, design: `place ${i}` }); },
      'invalid_lock_inventory'],
    ['an uppercase prop ID', 'only lowercase letters, digits and underscores', d => { d.plan.recurringProps[0].id = 'Ribbon'; }, 'invalid_visual_lock'],
    ['a location ID starting with a digit', 'starts with a letter', d => { d.plan.locations[0].id = '1garden'; }, 'invalid_visual_lock'],
    ['a 51-character ID', 'at most 50 characters', d => { d.plan.locations[1].id = `l${'a'.repeat(50)}`; }, 'invalid_visual_lock'],
    ['a repeated prop ID', 'unique in its list', d => { d.plan.recurringProps.push({ ...d.plan.recurringProps[0] }); }, 'invalid_visual_lock'],
    ['a repeated location ID', 'unique in its list', d => { d.plan.locations.push({ ...d.plan.locations[0], design: 'another garden' }); }, 'invalid_visual_lock'],
    ['a repeated continuity entity ID', 'unique in its list', d => { d.plan.continuity.entities.push(structuredClone(d.plan.continuity.entities[0])); },
      'continuity_entity_inventory'],
    ['an undeclared page location', "every page's locationId is a declared location", d => { d.plan.pages[3].locationId = 'moon'; }, 'plan_page_binding'],
    // The second attempt's refusal: a prop on a page that was never declared.
    ['an undeclared page prop', 'may list ONLY declared recurringProps', d => { d.plan.pages[7].props.push({ id: 'enclosure_gate', state: 'closed' }); },
      'unknown_or_duplicate_prop'],
    ['a prop listed twice on a page', 'each at most once', d => { d.plan.pages[1].props.push({ ...d.plan.pages[1].props[0] }); }, 'unknown_or_duplicate_prop'],
    ['a recurring prop with no continuity entity', 'every recurring prop is also a continuity entity with the SAME ID',
      d => { d.plan.continuity.entities = d.plan.continuity.entities.filter((e: any) => e.id !== 'ribbon'); }, 'continuity_entity_inventory'],
    ['a recurring prop whose entity is not a prop', 'kind "prop"',
      d => { d.plan.continuity.entities.find((e: any) => e.id === 'ribbon').kind = 'landmark'; }, 'continuity_entity_inventory'],
    ['a repeated invariant attribute', "an entity's invariant attributes are unique",
      d => { d.plan.continuity.entities.find((e: any) => e.id === 'hut').invariants.push({ attribute: 'material', value: 'stone' }); }, 'duplicate_continuity_attribute'],
    ['visible locations without the planned one', "includes that page's planned locationId", d => { d.plan.continuity.pages[3].visibleLocationIds = ['lane']; },
      'continuity_page_binding'],
    ['an undeclared visible location', 'lists only declared locations', d => { d.plan.continuity.pages[3].visibleLocationIds.push('moon'); }, 'continuity_page_binding'],
    ['a repeated visible location', 'without repeats', d => { d.plan.continuity.pages[3].visibleLocationIds.push('garden'); }, 'continuity_page_binding'],
    ['an undeclared visible entity', 'lists only declared continuity entities', d => { d.plan.continuity.pages[3].visibleEntityIds.push('dragon_egg'); },
      'continuity_page_binding'],
    ['a repeated visible entity', 'without repeats', d => { d.plan.continuity.pages[3].visibleEntityIds.push('hut'); }, 'continuity_page_binding'],
    ['a page prop that is not visible', 'includes EVERY prop listed on that page', d => { d.plan.continuity.pages[3].visibleEntityIds = ['hut']; },
      'continuity_page_binding'],
    ['a change on the cover', 'The cover has no continuity changes',
      (d, text) => { d.plan.continuity.pages[0].changes = [{ entityId: 'ribbon', attribute: 'color', value: 'blue', storyEvidence: text(0).slice(0, 8) }]; },
      'unsupported_continuity_change'],
    ['the same attribute changed twice on a page', 'changes each entity attribute at most once',
      (d, text) => { d.plan.continuity.pages[3].changes = ['blue', 'green'].map(value => ({ entityId: 'ribbon', attribute: 'color', value, storyEvidence: text(3).slice(0, 12) })); },
      'unsupported_continuity_change'],
    ['no close shot in the body', 'use all three shots (wide, medium, close)', d => { for (const p of d.plan.pages.slice(1)) if (p.shot === 'close') p.shot = 'medium'; },
      'insufficient_visual_variety'],
    ['only two angles in the body', 'at least three different angles', d => d.plan.pages.slice(1).forEach((p: any, i: number) => { p.angle = i % 2 ? 'low' : 'high'; }),
      'insufficient_visual_variety'],
    ['only four child expressions', 'at least five different child expressions',
      d => d.plan.pages.slice(1).forEach((p: any, i: number) => { p.childExpression = ['calm', 'curious', 'proud', 'surprised'][i % 4]; }), 'insufficient_visual_variety'],
    ['five expressions, two differing only in case and spaces', 'compared ignoring case and surrounding spaces',
      d => d.plan.pages.slice(1).forEach((p: any, i: number) => { p.childExpression = ['calm', ' Calm ', 'curious', 'proud', 'surprised'][i % 5]; }),
      'insufficient_visual_variety'],
    ['two transitions for one entity on a page', 'at most one transition per entity on a page',
      d => { const t = d.sequence.pages[2].transitions; t.push(structuredClone(t[0])); }, 'book_sequence_duplicate_transition'],
    // Page 4 (lane): the hut is offscreen; returning it to unestablished there is a reset, not an exit.
    ['a transition back to unestablished', 'no transition returns an entity to unestablished',
      (d, text) => { d.sequence.pages[3].transitions.push({ entityId: 'hut', from: { relation: 'at', targetId: 'garden' }, to: { relation: 'unestablished', targetId: null },
        evidence: text(4).slice(0, 12) }); }, 'book_sequence_state_reset'],
    // The hut starts unestablished and is never visible; the child starts inside it.
    ['a relation targeting an unestablished entity', 'no relation targets an entity that is still unestablished',
      d => { d.sequence.initialStates.find((s: any) => s.entityId === 'hut').value = { relation: 'unestablished', targetId: null };
        for (const p of d.plan.continuity.pages) p.visibleEntityIds = p.visibleEntityIds.filter((e: string) => e !== 'hut'); }, 'book_sequence_unestablished_target'],
    ['a depicted relation for an undeclared entity', 'a depicted relation names the child, the companion or a continuity entity',
      (d, text) => { const ev = text(3).slice(0, 12); d.moments.frames[3].depicted = { evidence: ev, attributes: [],
        relations: [{ entityId: 'dragon', value: { relation: 'at', targetId: 'lane' }, evidence: ev }] }; },
      'storyboard_moments_unknown_entity', true],
    // Page 4 (lane): the hut is not visible, so it may be drawn unestablished, but then nothing may stand beside it at that instant.
    ['a drawn relation to an entity unestablished at that instant', 'at that instant no relation targets an entity that is unestablished',
      (d, text) => { const ev = text(4).slice(0, 12); d.moments.frames[4].depicted = { evidence: ev, attributes: [], relations: [
        { entityId: 'hut', value: { relation: 'unestablished', targetId: null }, evidence: ev },
        { entityId: 'child', value: { relation: 'beside', targetId: 'hut' }, evidence: ev }] }; },
      'storyboard_moments_drawn_unestablished_target', true],
    ['a depicted attribute listed twice', 'a depicted attribute is listed at most once per entity and attribute',
      (d, text) => { d.sequence.mutableAttributes = [{ entityId: 'ribbon', attribute: 'color' }]; const ev = text(3).slice(0, 12);
        d.moments.frames[3].depicted = { evidence: ev, relations: [],
          attributes: ['blue', 'green'].map(value => ({ entityId: 'ribbon', attribute: 'color', value, evidence: ev })) }; },
      'storyboard_moments_depicted_attribute', true],
    ['two depicted relations for one entity on a frame', 'at most one per entity on a frame',
      (d, text) => { const ev = text(3).slice(0, 12); d.moments.frames[3].depicted = { evidence: ev, attributes: [],
        relations: [{ entityId: 'child', value: { relation: 'at', targetId: 'lane' }, evidence: ev }, { entityId: 'child', value: { relation: 'at', targetId: 'lane' }, evidence: ev }] }; },
      'storyboard_moments_duplicate_override', true],
    ['two requirements with the same kind and subject', 'no two requirements on a frame share the same kind and subject (ignoring case)',
      (d, text) => { const ev = text(3).slice(0, 12); d.moments.frames[3].requirements = [{ kind: 'show', subject: 'the red ribbon', evidence: ev },
        { kind: 'show', subject: 'The Red Ribbon', evidence: ev }]; }, 'storyboard_moments_duplicate_requirement', true],
  ];

  async function compileWith(change: Case[2] | null, moments = false) {
    const f = await personalStoryboardFixture(), count = f.result.manuscript.pages.length;
    const pageText = (n: number) => n === 0 ? f.result.manuscript.title : f.result.manuscript.pages[n - 1].text;
    const draft: any = structuredClone(f.draft);
    if (moments) draft.moments = { version: STORYBOARD_MOMENTS_VERSION, frames: Array.from({ length: count + 1 }, () => ({ requirements: [], depicted: null })) };
    change?.(draft, pageText);
    return () => compilePersonalStoryboard(preparePersonalStoryboard(f.request, f.result, options, undefined, moments ? true : undefined), draft);
  }

  it('the controls: the unchanged fixture draft compiles, with and without moments, and the book has at least 6 body pages', async () => {
    const f = await personalStoryboardFixture();
    expect(f.result.manuscript.pages.length).toBeGreaterThanOrEqual(6);
    expect((await compileWith(null))()).toBeTruthy();
    expect((await compileWith(null, true))()).toBeTruthy();
  });

  it('each stated limit is exact: the edge it allows compiles (8 props, 16 locations, a 50-character ID, 1800-character text, 3 angles, 5 expressions)', async () => {
    const text1800 = 'y'.repeat(1800);
    // A new recurring prop is also its continuity prop entity, with an initial state (unestablished: it is on no page).
    const addProp = (d: any, id: string) => { d.plan.recurringProps.push({ id, design: `prop ${id}` });
      d.plan.continuity.entities.push({ id, kind: 'prop', invariants: [{ attribute: 'shape', value: 'round' }] });
      d.sequence.initialStates.push({ entityId: id, value: { relation: 'unestablished', targetId: null } }); };
    const edges: [string, Case[2]][] = [
      ['exactly 8 recurring props', d => { for (let i = 0; d.plan.recurringProps.length < 8; i++) addProp(d, `prop_${i}`); }],
      ['exactly 16 locations', d => { for (let i = 0; d.plan.locations.length < 16; i++) d.plan.locations.push({ id: `place_${i}`, design: `place ${i}` }); }],
      ['a 50-character ID with digits and underscores', d => { d.plan.locations.push({ id: `l_9${'a'.repeat(47)}`, design: 'a far meadow' }); }],
      ['1800-character texts', d => { d.plan.visualLanguage = text1800; d.plan.recurringProps[0].design = text1800; d.plan.locations[1].design = text1800;
        d.plan.pages[3].scene = text1800; d.plan.pages[1].props[0].state = text1800; }],
      ['exactly three angles', d => d.plan.pages.slice(1).forEach((p: any, i: number) => { p.angle = ['low', 'high', 'over_shoulder'][i % 3]; })],
      ['exactly five expressions', d => d.plan.pages.slice(1).forEach((p: any, i: number) => {
        p.childExpression = ['calm', 'curious', 'proud', 'surprised', 'worried'][i % 5]; })],
    ];
    for (const [label, change] of edges) {
      const compile = await compileWith(change);
      expect(() => compile(), label).not.toThrow();
    }
  });

  it.each(cases)('%s', async (_label, phrase, change, code, moments) => {
    // A tested rule is a told rule: its phrase is in the addendum.
    expect(flat(COMPILER_RULES_STORYBOARD_ADDENDUM)).toContain(phrase);
    expect(await compileWith(change, moments)).toThrow(new RegExp(`^${code}$`));
  });
});
