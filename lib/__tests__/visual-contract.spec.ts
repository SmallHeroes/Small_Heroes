import * as fs from 'fs';
import * as path from 'path';
import { beforeAll, describe, expect, it } from 'vitest';

import { parseStoryMarkdownForContract } from '../visual-contract/parse-story';
import { compileBookVisualContract, assertContractRenderReady } from '../visual-contract/compiler';
import { evaluatePageAgainstContract, decideGateVerdict, type PageVisionObservation } from '../visual-contract/gate';
import type { BookVisualContract } from '../visual-contract/types';

const GENERATED_AT = '2026-06-23T00:00:00.000Z';

describe('VisualContractCompiler — Leo (lion_shaket_adventure)', () => {
  let contract: BookVisualContract;

  beforeAll(() => {
    const file = path.join(process.cwd(), 'story-bank', 'v5-fixed-v2', 'lion_shaket_adventure.md');
    const raw = fs.readFileSync(file, 'utf8');
    const input = parseStoryMarkdownForContract(raw, 'lion_shaket_adventure');
    contract = compileBookVisualContract(input, { generatedAt: GENERATED_AT, maxRerolls: 2 });
  });

  it('derives all four critical objects with portal and gate DISTINCT', () => {
    const ids = contract.criticalObjects.map((o) => o.objectId).sort();
    expect(ids).toEqual(['fallen_block_castle', 'golden_sand_portal', 'red_cube', 'stone_gate']);
    const gate = contract.criticalObjects.find((o) => o.objectId === 'stone_gate')!;
    const portal = contract.criticalObjects.find((o) => o.objectId === 'golden_sand_portal')!;
    // Each forbids being confused with the other.
    expect(gate.forbiddenVariants.join(' ').toLowerCase()).toContain('portal');
    expect(portal.forbiddenVariants.join(' ').toLowerCase()).toContain('gate');
  });

  it('red_cube is scale-locked small and never a portal/wall', () => {
    const cube = contract.criticalObjects.find((o) => o.objectId === 'red_cube')!;
    expect(cube.scaleLock.toLowerCase()).toContain('small');
    expect(cube.forbiddenVariants.join(' ').toLowerCase()).toMatch(/portal|wall|giant/);
  });

  it('companion (Leo) is a small cub ALWAYS — even on the roar page (no exceptions)', () => {
    const lock = contract.companionLock!;
    expect(lock.characterScaleLock.neverAdultOrGiant).toBe(true);
    expect(lock.characterScaleLock.approvedExceptions).toEqual([]);
    const p11 = contract.pageContracts.find((p) => p.page === 11)!;
    expect(p11.companion.present).toBe(true);
    expect(p11.companion.scale).toMatch(/knee-to-waist/);
  });

  it('worldStateByPage follows room → fantasy → gate → return', () => {
    expect(contract.worldStateByPage['1']).toBe('bedroom');
    expect(contract.worldStateByPage['2']).toBe('fantasy_exterior');
    expect(contract.worldStateByPage['9']).toBe('gate_area'); // carry-forward, not bedroom
    expect(contract.worldStateByPage['11']).toBe('gate_area');
    expect(contract.worldStateByPage['12']).toBe('return');
  });

  it('p1 mustShow = fallen castle + red cube, Leo absent, gate forbidden in the bedroom', () => {
    const p1 = contract.pageContracts.find((p) => p.page === 1)!;
    expect(p1.mustShow).toContain('object:fallen_block_castle');
    expect(p1.mustShow).toContain('object:red_cube');
    expect(p1.companion.present).toBe(false);
    expect(p1.mustNotShow.join(' ')).toMatch(/stone_gate/);
  });

  it('p11 mustShow = roar-line opening the SAME stone gate; gate state is opening', () => {
    const p11 = contract.pageContracts.find((p) => p.page === 11)!;
    expect(p11.mustShow).toContain('object:stone_gate');
    expect(p11.mustShow.some((m) => /roar-line/.test(m))).toBe(true);
    const gate = contract.criticalObjects.find((o) => o.objectId === 'stone_gate')!;
    expect(gate.stateTimeline.find((s) => s.page === 11)?.state).toMatch(/open/);
  });

  it('is render-ready with confidence above the fail-closed bar', () => {
    expect(contract.renderReady).toBe(true);
    expect(contract.renderReadyBlockers).toEqual([]);
    expect(contract.confidence.overall).toBeGreaterThanOrEqual(0.6);
    expect(() => assertContractRenderReady(contract)).not.toThrow();
  });
});

describe('VisualContractCompiler — fail-closed on a weak contract', () => {
  it('a prose-only story with no motifs/directions is NOT render-ready', () => {
    const weak = parseStoryMarkdownForContract(
      ['--- Page 1 ---', 'פעם היה ילד.', '--- Page 2 ---', 'הוא הלך לישון.'].join('\n'),
      'weak_story'
    );
    const contract = compileBookVisualContract(weak, { generatedAt: GENERATED_AT });
    expect(contract.criticalObjects.length).toBe(0);
    expect(contract.renderReady).toBe(false);
    expect(contract.renderReadyBlockers.length).toBeGreaterThan(0);
    expect(() => assertContractRenderReady(contract)).toThrow(/fail-closed/);
  });
});

describe('Visual Contract hard gate — three failure classes', () => {
  let contract: BookVisualContract;
  beforeAll(() => {
    const file = path.join(process.cwd(), 'story-bank', 'v5-fixed-v2', 'lion_shaket_adventure.md');
    contract = compileBookVisualContract(parseStoryMarkdownForContract(fs.readFileSync(file, 'utf8'), 'lion_shaket_adventure'), {
      generatedAt: GENERATED_AT,
      maxRerolls: 2,
    });
  });

  // A fully-obedient observation for page 11 (the climactic roar page).
  function perfectP11(): PageVisionObservation {
    const pc = contract.pageContracts.find((p) => p.page === 11)!;
    return {
      sceneId: 'gate_area',
      childCount: 1,
      photoreal: false,
      companion: { present: true, smallCub: true, species: 'lion' },
      objects: { stone_gate: { present: true, correctScale: true, correctState: true, confusedWith: null } },
      mustShowSatisfied: pc.mustShow.filter((m) => !m.startsWith('object:')),
      mustNotShowViolations: [],
    };
  }

  it('accepts a fully-obedient page', () => {
    const r = evaluatePageAgainstContract(contract, 11, perfectP11());
    expect(r.passed).toBe(true);
    expect(decideGateVerdict(r, 0, contract.qaPolicy.maxRerolls)).toBe('accept');
  });

  it('ENTITY: flags an adult/giant companion (scale) + duplicate child + photoreal', () => {
    const obs = perfectP11();
    obs.companion = { present: true, smallCub: false, species: 'lion' };
    obs.childCount = 2;
    obs.photoreal = true;
    const r = evaluatePageAgainstContract(contract, 11, obs);
    const entity = r.failures.filter((f) => f.failureClass === 'entity').map((f) => f.assertion);
    expect(entity).toContain('companion_scale');
    expect(entity).toContain('duplicate_child');
    expect(entity).toContain('photoreal_not_illustrated');
    expect(r.passed).toBe(false);
  });

  it('CONTINUITY: flags wrong scene + gate/portal identity confusion', () => {
    const obs = perfectP11();
    obs.sceneId = 'bedroom';
    obs.objects = { stone_gate: { present: true, confusedWith: 'golden_sand_portal' } };
    const r = evaluatePageAgainstContract(contract, 11, obs);
    const cont = r.failures.filter((f) => f.failureClass === 'continuity').map((f) => f.assertion);
    expect(cont).toContain('scene_mismatch');
    expect(cont).toContain('object_identity_confusion');
  });

  it('STORYTELLING: flags the missing central action (roar-line) and rerolls then fails', () => {
    const obs = perfectP11();
    obs.mustShowSatisfied = ['protagonist:child', 'companion:lion_shaket (small cub)']; // roar-line NOT satisfied
    const r = evaluatePageAgainstContract(contract, 11, obs);
    const story = r.failures.filter((f) => f.failureClass === 'storytelling').map((f) => f.assertion);
    expect(story).toContain('must_show_absent');
    expect(decideGateVerdict(r, 0, contract.qaPolicy.maxRerolls)).toBe('reroll');
    expect(decideGateVerdict(r, contract.qaPolicy.maxRerolls, contract.qaPolicy.maxRerolls)).toBe('fail');
  });
});
