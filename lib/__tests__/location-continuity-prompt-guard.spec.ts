import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * P0 guard (Visual Contract Compiler brief, 2026-06-25): the shot-plan prompts must NOT instruct the
 * model to invent a new location/zone every page — that rule was the active cause of the cave→gate /
 * "new world each spread" breakage. The LOCATION must stay the same unless the story moves; only
 * camera/action/pose vary. This guard pins the copy so the coercive rule can't silently return.
 */
const pipelineSrc = readFileSync(
  path.join(process.cwd(), 'backend', 'providers', 'pipeline.ts'),
  'utf8'
);

describe('shot-plan prompt: location continuity (P0 — no new-zone-every-page coercion)', () => {
  it('states the location stays the same unless the story moves', () => {
    expect(pipelineSrc).toContain('LOCATION CONTINUITY');
    expect(pipelineSrc).toContain(
      'The LOCATION stays the same unless the story explicitly moves to a new place'
    );
    expect(pipelineSrc.toLowerCase()).toContain('new camera angle');
  });

  it('does NOT contain the old "new locationZone every page" directives', () => {
    const banned = [
      'No two consecutive pages may use the same locationZone',
      'different locationZones',
      'locationZone changes every page',
      'DIFFERENT locationZone from the previous page',
      'different locationZone on every page',
    ];
    for (const phrase of banned) {
      expect(pipelineSrc).not.toContain(phrase);
    }
  });
});
