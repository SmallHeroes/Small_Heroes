import { describe, expect, it } from 'vitest';

import type { BookVisualContract } from '@/lib/visual-contract-compiler';

import { buildSetIdentityBoardPrompt } from '../boardPrompt';
import { projectSetDefinition } from '../setDefinition';

/**
 * SYNTHETIC fixture — deliberately avoids the story-literal words the "no hardcoding" assertion checks
 * (/fox|balcony|bedroom|uri|bucket/i) and uses a `doorway` opening ONLY (never a `balcony_door` or `window`), so the
 * test can prove the prompt names only the openings the structure authored.
 */
function makeContract(): BookVisualContract {
  return {
    version: 1,
    storyKey: 'synthetic_story',
    worldType: 'indoor_world',
    locations: [
      {
        id: 'hall_main',
        name: 'Main Hall',
        description: 'a plain stone hall with a flat floor',
        lighting: 'cool daylight',
        environmentClass: 'indoor',
        setIdentityId: 'set_hall',
        setReference: { status: 'pending' },
        anchors: [{ id: 'anchor_pillar', description: 'a stone pillar at the center' }],
        topology: 'a single open hall',
      },
    ],
    zones: [
      {
        id: 'z_hall',
        locationId: 'hall_main',
        name: 'Hall Zone',
        description: 'the open hall floor',
        spatialNodes: [
          { id: 'east_door', kind: 'doorway', description: 'a tall arched doorway in the east wall' },
          {
            id: 'stone_table',
            kind: 'furniture',
            description: 'a heavy stone table',
            bindsTo: { kind: 'prop', id: 'stone_table_prop' },
          },
        ],
        spatialRelations: [{ subjectId: 'stone_table', relation: 'centered_in' }],
      },
    ],
    cast: {
      child: { id: 'child_1', role: 'child', name: 'Kid', wardrobe: { description: 'a green tunic' } },
    },
    recurringProps: [
      {
        id: 'stone_table_prop',
        name: 'Stone Table',
        description: 'a stone table',
        material: 'grey granite',
        scale: 'waist-high to the child',
      },
    ],
    forbiddenGlobalElements: [],
    coverContract: { worldType: 'indoor_world', locationId: 'hall_main', mustShow: [], mustNotShow: [] },
    pageContracts: [
      {
        pageNumber: 1,
        locationId: 'hall_main',
        zoneId: 'z_hall',
        mustShow: [],
        mustNotShow: [],
        characterPresence: { child: true, companion: false },
        propState: [],
        camera: 'wide shot',
      },
    ],
  };
}

const STYLE = 'detailed_whimsical_world';

function buildForFixture() {
  const def = projectSetDefinition(makeContract(), 'set_hall', STYLE);
  return { def, ...buildSetIdentityBoardPrompt(def) };
}

describe('buildSetIdentityBoardPrompt', () => {
  it('is derived from the SetDefinition (set identity, location, geometry, materials)', () => {
    const { prompt } = buildForFixture();
    expect(prompt).toContain('set_hall');
    expect(prompt).toContain('Main Hall');
    expect(prompt).toContain('a tall arched doorway in the east wall'); // geometry from spatialNode
    expect(prompt).toContain('Stone Table'); // fixed set object
    expect(prompt).toContain('grey granite'); // material fact
  });

  it('is character-free: contains explicit forbids for people, animals, text, and panels', () => {
    const { prompt, negativePrompt } = buildForFixture();
    expect(prompt).toMatch(/NO people/i);
    expect(prompt).toMatch(/NO animals/i);
    expect(prompt).toMatch(/NO text/i);
    expect(prompt).toMatch(/panel/i);
    expect(prompt).toMatch(/gutter/i);
    // negatives are also mirrored into the negative prompt
    expect(negativePrompt).toMatch(/character/i);
    expect(negativePrompt).toMatch(/animal/i);
  });

  it('mentions ONLY the opening kinds present in the def (doorway present, balcony_door absent)', () => {
    const { prompt } = buildForFixture();
    expect(prompt).toContain('doorway');
    expect(prompt).not.toMatch(/balcony/i);
  });

  it('contains NO story-specific literal', () => {
    const { prompt, negativePrompt } = buildForFixture();
    expect(prompt).not.toMatch(/fox|balcony|bedroom|uri|bucket/i);
    expect(negativePrompt).not.toMatch(/fox|balcony|bedroom|uri|bucket/i);
  });

  it('is deterministic: same input → same promptHash', () => {
    const a = buildForFixture();
    const b = buildForFixture();
    expect(a.promptHash).toBe(b.promptHash);
    expect(a.prompt).toBe(b.prompt);
    expect(a.negativePrompt).toBe(b.negativePrompt);
  });
});

/**
 * SINGLE ESTABLISHING VIEW — the shape the first real mint taught us.
 *
 * The original prompt asked for a "multi-view reference sheet" and enumerated a numbered VIEW PLAN. The model did
 * exactly as told: it returned a 3-panel sheet with cream gutters, and board QA correctly failed it on `panels`.
 * The set CONTENT was already right — only the layout was. Enumerating views is what draws panels, and a panel
 * border is precisely the thing that must never leak into a page. So the prompt must ask for ONE continuous view,
 * and this spec is what stops "1. Primary view / 2. Secondary view" ever creeping back in.
 */
describe('buildSetIdentityBoardPrompt — ONE continuous establishing view, never a panelled sheet', () => {
  const def = () => projectSetDefinition(makeContract(), 'set_hall', 'detailed_whimsical_world');
  const prompt = () => buildSetIdentityBoardPrompt(def()).prompt;

  it('asks for a SINGLE continuous establishing view', () => {
    const p = prompt();
    expect(p).toMatch(/SINGLE ESTABLISHING VIEW/i);
    expect(p).toMatch(/SINGLE CONTINUOUS ILLUSTRATION/i);
    expect(p).toMatch(/ONE picture/i);
  });

  it('has NO numbered VIEW PLAN — the block that enumerated panels is gone', () => {
    const p = prompt();
    expect(p).not.toMatch(/VIEW PLAN/i);
    expect(p).not.toMatch(/^\s*1\.\s+Primary/im);
    expect(p).not.toMatch(/Secondary view/i);
    // Matched on the old plan's EXACT line rather than on "detail study": the FORBIDS legitimately say
    // "NO detail study", and a negative mention is exactly what we want — a broad match would fail on the fix.
    expect(p).not.toMatch(/Optional detail study/i);
  });

  it('never frames the board as a multi-view "reference sheet"', () => {
    const p = prompt();
    expect(p).not.toMatch(/MULTI-VIEW/i);
    expect(p).not.toMatch(/reference sheet/i);
    expect(p).not.toMatch(/alternate (view|angle)/i);
    // "1–2 neutral alternate views ... arranged as a clean reference sheet" — the exact old framing.
    expect(p).not.toMatch(/arranged as a/i);
  });

  it('still FORBIDS panels/gutters/grids — belt and suspenders alongside the positive single-view ask', () => {
    const { prompt: p, negativePrompt } = buildSetIdentityBoardPrompt(def());
    for (const text of [p, negativePrompt]) {
      expect(text).toMatch(/NO panel borders|panel/i);
      expect(text).toMatch(/gutter/i);
    }
    expect(p).toMatch(/NO multiple views/i);
    expect(p).toMatch(/NO grid/i);
    expect(p).toMatch(/NO collage/i);
  });

  it('still carries the set geometry, fixed objects, authored openings and the order style', () => {
    const p = prompt();
    expect(p).toMatch(/SET GEOMETRY/);
    expect(p).toMatch(/Main Hall/); // from the spoiler-neutral projection
    expect(p).toMatch(/FIXED SET OBJECTS/);
    expect(p).toMatch(/WALL OPENINGS/);
    expect(p).toMatch(/doorway/); // the ONLY authored opening
    expect(p).not.toMatch(/balcony door/i); // never invents an opening the structure lacks
    expect(p).toMatch(/STYLE \(from the order style/);
  });

  it('stays deterministic and still character-free', () => {
    const a = buildSetIdentityBoardPrompt(def());
    const b = buildSetIdentityBoardPrompt(def());
    expect(a.promptHash).toBe(b.promptHash);
    expect(a.prompt).toMatch(/NO people/i);
    expect(a.prompt).toMatch(/NO animals/i);
  });
});
