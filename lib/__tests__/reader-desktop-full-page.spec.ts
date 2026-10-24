import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'app/book/[id]/read-v2');
const reader = () => fs.readFileSync(path.join(root, 'reader-v2.tsx'), 'utf8');
const presentation = () => fs.readFileSync(path.join(root, 'reader-v2.module.css'), 'utf8')
  .split('/* Owner-approved full-page presentation')[1]?.split('/* Complete-artwork policy')[0] ?? '';

describe('explicit full-page reader presentation, not a source-image change', () => {
  it('keeps complete artwork as default and opts the general local-reader route in', () => {
    expect(reader()).toContain("presentation = 'complete-artwork'");
    expect(reader()).toContain('data-reader-presentation={presentation}');
    expect(reader()).toContain('data-artwork-fit="contain"');
    const route = fs.readFileSync(path.join(process.cwd(), 'app/dev/local-reader/page.tsx'), 'utf8');
    expect(route).toContain('presentation="desktop-full-page"');
    expect(route).not.toMatch(/ido|naomi|panda|page_\d/);
  });
  it('widens and safely centers desktop prose without hiding overflow', () => {
    const p = presentation();
    expect(p).toContain('@media (min-width: 1024px)');
    expect(p).toContain('.leftPageMaskedIllustration .illustrationImg');
    expect(p).toContain('.openPageIllustration .illustrationImg');
    expect(p).toContain('object-fit: cover');
    expect(p).toContain('font-size: clamp(13px, 2.1dvh, 18px)');
    expect(p).toContain('line-height: 1.5');
    expect(p).toMatch(/\.openTextSafe\s*\{[^}]*overflow-y: auto;/s);
    expect(p).toMatch(/\.openTextSafe\s*\{[^}]*display: flex;[^}]*flex-direction: column;/s);
    expect(p).toContain('margin-block: auto');
    expect(p).toContain('flex-shrink: 0');
    expect(p).toMatch(/\.openTextSafe\s*\{[^}]*right: 6%;[^}]*left: 6%;/s);
  });
  it('opts mobile into full-viewport artwork with accessible bounded gradient prose', () => {
    expect(reader()).toContain("immersive={presentation === 'desktop-full-page'}");
    const mobile = fs.readFileSync(path.join(root, 'components/MobileBookPage.tsx'), 'utf8');
    expect(mobile).toContain('immersive = false');
    expect(mobile).toContain('data-mobile-immersive');
    expect(mobile).toContain('splitTextByRhythm(page.text)');
    expect(mobile).toContain('page.showText &&');
    expect(mobile).toContain('data-reader-prose');
    expect(mobile).toContain('aria-label="טקסט הסיפור"');
    const p = presentation();
    expect(p).toContain('@media (max-width: 1023px)');
    expect(p).toContain('[data-mobile-immersive]');
    expect(p).toContain('.mobileOverlayProse');
    expect(p).toContain('overscroll-behavior: contain');
    expect(p).toContain('overflow-y: auto');
    expect(p).not.toContain('line-clamp');
  });
  it('uses full-image cover with a legible overlay and no book-specific asset or title', () => {
    const p = presentation();
    expect(p).toMatch(/\.coverBleed\s*\{[^}]*inset: 0;/s);
    expect(p).toContain('.coverBleedImg');
    expect(p).toContain('.coverTitleOverlay');
    expect(p).toContain('.coverTitleGradient');
    expect(p).toContain('display: block');
    expect(p).toContain('linear-gradient');
    expect(p).not.toMatch(/page_\d|naomi|ido|panda|כרטיס/);
  });
});
