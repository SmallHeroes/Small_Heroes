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
    expect(prompt).toContain('a plain stone hall with a flat floor');
    expect(prompt).toContain('a tall arched doorway in the east wall'); // geometry from spatialNode
    expect(prompt).toContain('stone_table_prop'); // fixed set object
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
