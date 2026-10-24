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
  it('fills only desktop body images and compacts prose without hiding overflow', () => {
    const p = presentation();
    expect(p).toContain('@media (min-width: 1024px)');
    expect(p).toContain('.leftPageMaskedIllustration .illustrationImg');
    expect(p).toContain('.openPageIllustration .illustrationImg');
    expect(p).toContain('object-fit: cover');
    expect(p).toContain('font-size: clamp(13px, 2.1dvh, 18px)');
    expect(p).toContain('line-height: 1.38');
    expect(p).toMatch(/\.openTextSafe\s*\{[^}]*overflow-y: auto;/s);
    expect(p).not.toContain('.mobileIllustration');
    expect(p).not.toContain('.mobilePaperProse');
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
