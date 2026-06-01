import { describe, expect, it } from 'vitest';
import { assembleStyle01Phase2Prompt } from '../style01-prompt-assembly';

/** Story-bank p11 imageDirection omits the child (egg/valley only). */
const DINI_P11_IMAGE_DIRECTION =
  'A whimsical valley filled with giant fuzzy reed-like plants swaying gently. The egg spins on its tip like a top, kicking up colored dust, heading toward a sticky purple puddle of melted-marshmallow goo.';

describe('assembleStyle01Phase2Prompt — composition overrides entity presence', () => {
  it('forces child present + CHILD VISUAL LOCK on Dini p11 despite imageDirection omitting child', () => {
    const { prompt, entityPresence } = assembleStyle01Phase2Prompt({
      pageNumber: 11,
      rawScenePrompt: DINI_P11_IMAGE_DIRECTION,
      childFirstName: 'Yuval',
      childAge: 8,
      childGender: 'girl',
      childDescription: 'long curly brown hair, warm smile',
      childStructured: {
        face: 'round face, brown eyes',
        hair: 'long curly brown hair',
        body: 'slender 8-year-old girl',
        clothing: 'mismatched animal-print pajamas',
        signature: 'photo-derived likeness',
      },
      companion: {
        id: 'dragon_dini',
        name: 'Dini',
        visualDescription: 'copper-scaled young dragon',
      },
    });

    expect(entityPresence.childPresence).toBe('present');
    expect(prompt).toMatch(/CHILD VISUAL LOCK/i);
    expect(prompt).toMatch(/IDENTITY COMPOSITION \(child protagonist present\)/);
    expect(prompt).toMatch(/SUBJECT SCALE: medium/);
    expect(prompt).not.toMatch(/CRITICAL:\s*NO human child/i);
  });
});
