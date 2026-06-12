import { describe, expect, it } from 'vitest';

import { PREMISE_CRITIC_SYSTEM } from '../story-gen-v3/premise-score';

describe('premise judge/critic prompts', () => {
  it('critic system prompt is companion-neutral (no Dini-led arc)', () => {
    expect(PREMISE_CRITIC_SYSTEM).not.toMatch(/Dini-led/i);
    expect(PREMISE_CRITIC_SYSTEM).toMatch(/companion-led arc/i);
    expect(PREMISE_CRITIC_SYSTEM).toMatch(/\{\{childName\}\}/);
  });
});
