import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { parseRecurringEntitiesFromStoryMarkdown } from '../story-bank/recurring-entities';

const SAMPLE = `---
title: Test
recurringEntities:
  green_speckled_egg:
    role: object
    visualDescription: Small green egg
    sizeLock: palm-sized always
    appearsFromPage: 6
    negativeDriftRules:
      - barrel egg
  baby_dragon:
    role: creature
    visualDescription: Tiny hatchling
    referenceAnchorEnv: DINI_BABY_DRAGON_ANCHOR_URL
---
`;

describe('parseRecurringEntitiesFromStoryMarkdown', () => {
  it('parses entity blocks from frontmatter', () => {
    const entities = parseRecurringEntitiesFromStoryMarkdown(SAMPLE);
    expect(entities).toHaveLength(2);
    expect(entities[0].entityId).toBe('green_speckled_egg');
    expect(entities[0].negativeDriftRules).toEqual(['barrel egg']);
    expect(entities[1].entityId).toBe('baby_dragon');
    expect(entities[1].referenceAnchorEnv).toBe('DINI_BABY_DRAGON_ANCHOR_URL');
  });

  it('parses dragon_dini_fantasy story-bank frontmatter', () => {
    const raw = fs.readFileSync(
      path.join(process.cwd(), 'story-bank/v5-fixed-v2/dragon_dini_fantasy.md'),
      'utf8'
    );
    const ids = parseRecurringEntitiesFromStoryMarkdown(raw).map((e) => e.entityId);
    expect(ids).toContain('green_speckled_egg');
    expect(ids).toContain('baby_dragon');
  });
});
