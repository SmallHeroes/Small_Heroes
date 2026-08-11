import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { capRevealDelay } from '@/app/landing/motion';

describe('landing scroll reveal helpers', () => {
  it('caps stagger delay at 320ms', () => {
    expect(capRevealDelay(0)).toBe(0);
    expect(capRevealDelay(80)).toBe(80);
    expect(capRevealDelay(320)).toBe(320);
    expect(capRevealDelay(400)).toBe(320);
    expect(capRevealDelay(NaN)).toBe(0);
    expect(capRevealDelay(-10)).toBe(0);
  });

  it('keeps challenge-card depth declarations valid without the premium layer', () => {
    const css = readFileSync(join(process.cwd(), 'app', 'category-challenge-card.css'), 'utf8');

    for (const variable of [
      '--lift-2',
      '--lift-3',
      '--lift-4',
      '--lift-hold',
      '--rim',
      '--rim-purple',
    ]) {
      expect(css).not.toContain(`var(${variable})`);
      expect(css).toContain(`var(${variable},`);
    }
  });
});
