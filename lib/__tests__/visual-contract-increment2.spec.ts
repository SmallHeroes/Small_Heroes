import * as fs from 'fs';
import * as path from 'path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { assembleStyle01BookReferencesWithZoneSheets } from '../story-location-bible/zone-sheets';
import { parseStoryMarkdownForContract } from '../visual-contract/parse-story';
import { compileBookVisualContract } from '../visual-contract/compiler';
import { buildCalibrationPagePrompt } from '../visual-contract/render-prompt';
import { buildObjectSheetPrompt } from '../visual-contract/object-reference-sheet';
import { interpretVisionJson } from '../visual-contract/contract-vision';
import type { BookVisualContract } from '../visual-contract/types';

const ENV_KEY = 'GPT_IMAGE_EDIT_MAX_REFERENCES';
let prevMax: string | undefined;
beforeEach(() => {
  prevMax = process.env[ENV_KEY];
});
afterEach(() => {
  if (prevMax === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = prevMax;
});

describe('referencePlan — critical-object refs outrank style under budget (#4)', () => {
  function input(max: string) {
    process.env[ENV_KEY] = max;
    return {
      styleRefPaths: ['style1.png', 'style2.png'],
      childPhotoPath: 'child.png',
      includeChildPhoto: true,
      companionRefPaths: ['companion.png'],
      otherCharacterRefPaths: [] as string[],
      config: 'A' as const,
      criticalObjectRefPaths: ['stone-gate-open.png'],
    };
  }

  it('drops a style ref before a critical-object ref under pressure', () => {
    // child(1)+companion(1)+critical(1)+style(2) = 5, budget 4 → one style drops; critical survives.
    const { paths, breakdown } = assembleStyle01BookReferencesWithZoneSheets(input('4'));
    expect(paths).toContain('stone-gate-open.png');
    expect(breakdown.criticalObjects).toEqual(['stone-gate-open.png']);
    expect(paths).toContain('style1.png');
    expect(paths).not.toContain('style2.png');
    expect(paths.length).toBe(4);
  });

  it('keeps the critical-object ref even when ALL style refs are dropped', () => {
    // child+companion+critical = 3 protected, budget 3 → both style drop, critical survives.
    const { paths } = assembleStyle01BookReferencesWithZoneSheets(input('3'));
    expect(paths).toContain('stone-gate-open.png');
    expect(paths).not.toContain('style1.png');
    expect(paths).not.toContain('style2.png');
  });
});

describe('Increment 2 — Leo contract-driven prompts + vision interpreter', () => {
  let contract: BookVisualContract;
  beforeAll(() => {
    const file = path.join(process.cwd(), 'story-bank', 'v5-fixed-v2', 'lion_shaket_adventure.md');
    contract = compileBookVisualContract(parseStoryMarkdownForContract(fs.readFileSync(file, 'utf8'), 'lion_shaket_adventure'), {
      generatedAt: '2026-06-23T00:00:00.000Z',
      maxRerolls: 2,
    });
  });

  it('page prompt encodes the contract: p1 castle+cube, no companion, gate forbidden', () => {
    const p1 = contract.pageContracts.find((p) => p.page === 1)!;
    const prompt = buildCalibrationPagePrompt(contract, p1);
    expect(prompt).toMatch(/exactly ONE child/i);
    expect(prompt.toLowerCase()).toContain('block');
    expect(prompt.toLowerCase()).toContain('red');
    expect(prompt).not.toMatch(/companion/i); // Leo absent on p1
    expect(prompt.toLowerCase()).toContain('do not include');
    expect(prompt.toLowerCase()).toContain('stone_gate');
  });

  it('page prompt for p11 locks Leo to a small cub and demands the roar-line + opening gate', () => {
    const p11 = contract.pageContracts.find((p) => p.page === 11)!;
    const prompt = buildCalibrationPagePrompt(contract, p11);
    expect(prompt.toLowerCase()).toContain('small cub');
    expect(prompt.toLowerCase()).toContain('never be adult');
    expect(prompt.toLowerCase()).toContain('roar-line');
    expect(prompt.toLowerCase()).toMatch(/open/);
  });

  it('object sheet prompt forbids the portal/indoor confusion for the gate', () => {
    const gate = contract.criticalObjects.find((o) => o.objectId === 'stone_gate')!;
    const prompt = buildObjectSheetPrompt(gate, 'closed with a circular center mark');
    expect(prompt.toLowerCase()).toContain('do not render it as');
    expect(prompt.toLowerCase()).toContain('portal');
    expect(prompt.toLowerCase()).toContain('no people');
  });

  it('interpretVisionJson maps a clean p11 observation (gate present, cub, roar shown)', () => {
    const p11 = contract.pageContracts.find((p) => p.page === 11)!;
    const roarClause = p11.mustShow.find((m) => /roar-line/.test(m))!;
    const obs = interpretVisionJson(
      {
        scene: 'gate_area',
        child_count: 1,
        photoreal: false,
        companion: { present: true, small_cub: true, species: 'lion' },
        objects: { stone_gate: { present: true, correct_scale: true, correct_state: true, confused_with: null } },
        must_show: { [roarClause]: true },
        must_not_show_violations: [],
      },
      p11
    );
    expect(obs.sceneId).toBe('gate_area');
    expect(obs.objects?.stone_gate.present).toBe(true);
    expect(obs.companion?.smallCub).toBe(true);
    expect(obs.mustShowSatisfied).toContain(roarClause);
  });

  it('interpretVisionJson surfaces gate→portal confusion + adult cub + missing roar', () => {
    const p11 = contract.pageContracts.find((p) => p.page === 11)!;
    const obs = interpretVisionJson(
      {
        scene: 'bedroom',
        child_count: 2,
        photoreal: true,
        companion: { present: true, small_cub: false, species: 'lion' },
        objects: { stone_gate: { present: true, correct_scale: false, correct_state: false, confused_with: 'golden_sand_portal' } },
        must_show: {},
        must_not_show_violations: ['the golden_sand_portal in place of the stone_gate'],
      },
      p11
    );
    expect(obs.objects?.stone_gate.confusedWith).toBe('golden_sand_portal');
    expect(obs.objects?.stone_gate.correctScale).toBe(false);
    expect(obs.companion?.smallCub).toBe(false);
    expect(obs.childCount).toBe(2);
    expect(obs.photoreal).toBe(true);
    expect(obs.mustNotShowViolations).toContain('the golden_sand_portal in place of the stone_gate');
  });
});
