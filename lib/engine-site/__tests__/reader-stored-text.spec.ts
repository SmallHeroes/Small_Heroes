import * as React from 'react';
import { createElement } from 'react';
import { createRequire } from 'module';
import { resolve } from 'path';
const { renderToStaticMarkup } = createRequire(resolve('package.json'))('react-dom/server') as { renderToStaticMarkup: (element: React.ReactElement) => string };
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
beforeEach(() => vi.stubGlobal('React', React));
afterEach(() => vi.unstubAllGlobals());
import { adaptLegacyBookToStoryScenes, storySceneToDesktopSpread, storySceneToMobilePage } from '@/lib/book-layout';
import { DesktopBookSpread } from '@/app/book/[id]/read-v2/components/DesktopBookSpread';
import { MobileBookPage } from '@/app/book/[id]/read-v2/components/MobileBookPage';
const text = 'יַלְדָּה קְטַנָּה.\n\nהִיא הָלְכָה בַּדֶּרֶךְ.';
describe('Q16 actual reader adapter and rendered desktop/mobile prose', () => {
  it.each(['desktop','mobile','mobile-paper'])('preserves stored niqqud and explicit line breaks in %s markup', device => {
    const scene = adaptLegacyBookToStoryScenes({ book: { pages: [{pageNumber:1,text,imageUrl:'/synthetic.png'}] }, preserveStoredText: true } as any)[0];
    const html = device === 'desktop' ? renderToStaticMarkup(createElement(DesktopBookSpread,{spread:storySceneToDesktopSpread(scene,'Synthetic'),isCurrent:true}))
      : renderToStaticMarkup(createElement(MobileBookPage,{page:storySceneToMobilePage(scene,'Synthetic'),isCurrent:true,immersive:device==='mobile'}));
    expect(html).toContain(text); expect(html).toContain('white-space:pre-wrap');
  });
  it('retains historical normalization for a historical book', () => {
    expect(adaptLegacyBookToStoryScenes({book:{pages:[{pageNumber:1,text}]}})[0].text).not.toContain('\n');
  });
});
