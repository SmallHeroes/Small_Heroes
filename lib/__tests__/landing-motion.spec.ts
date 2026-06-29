import { describe, expect, it } from 'vitest';

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
});
