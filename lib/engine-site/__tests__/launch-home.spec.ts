import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';
import { resolve } from 'path';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import * as React from 'react';
beforeAll(() => vi.stubGlobal('React', React));
afterAll(() => vi.unstubAllGlobals());
// This worktree's shared dependency junction has no @types/react-dom/server; keep the runtime renderer typed locally.
const { renderToStaticMarkup } = createRequire(resolve('package.json'))('react-dom/server') as { renderToStaticMarkup(node: ReactNode): string };
import { EngineLaunchHome } from '@/app/personal/launch-home';
import { engineSitePriceIls } from '../offer-definition';
vi.mock('@/app/components/SiteHeader', () => ({ SiteHeader: () => null }));
vi.mock('@/app/landing/personal-wow/PersonalWowHero', () => ({ PersonalWowHero: ({ hero }: any) => createElement('h1', null, hero.h1Line1, ' ', hero.h1Line2) }));
vi.mock('@/app/landing/personal-companion-carousel', () => ({ PersonalCompanionCarousel: () => null }));
describe('activated personal homepage offer, separate from the retained production bank pricing', () => {
  it('renders one all-inclusive offer from the single source and links only to the personal wizard', () => {
    const html = renderToStaticMarkup(EngineLaunchHome());
    expect(html.match(/price-now-digits/g)).toHaveLength(1);
    expect(html).toContain(`>${engineSitePriceIls()}<`); expect(html).toContain('קריינות'); expect(html).toContain('PDF');
    expect(html).toContain('כריכה ו־8 עמודי סיפור'); expect(html).toContain('/wizard/personal');
    expect(html).not.toMatch(/direction=|category=|בתצוגת הפיתוח|באבטיפוס|מחיר יפורסם|₪99/);
  });
});
