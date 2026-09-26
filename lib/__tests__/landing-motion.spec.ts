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

  it('labels only the opening and outcome of the unchanged three-panel hero', () => {
    const page = readFileSync(join(process.cwd(), 'app', 'landing', 'landing-page.tsx'), 'utf8');
    const captions = page.match(/<ol className="hero-captions"[^>]*>([\s\S]*?)<\/ol>/)?.[1];
    expect(captions).toBeDefined();
    expect(Array.from(captions!.matchAll(/<li>(.*?)<\/li>/g), ([, text]) => text))
      .toEqual(['רגע של פחד', 'יוצאת גאה']);
    expect(page).toContain('<HeroCollage />');

    const css = readFileSync(join(process.cwd(), 'app', 'landing', 'landing.css'), 'utf8');
    const captionRules = Array.from(css.matchAll(/\.hero-captions\s*\{([^}]+)\}/g), ([, rules]) => rules).join('\n');
    expect(captionRules).toMatch(/display:\s*flex/);
    expect(captionRules).toMatch(/justify-content:\s*space-between/);
    expect(captionRules).toMatch(/direction:\s*ltr/);
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
