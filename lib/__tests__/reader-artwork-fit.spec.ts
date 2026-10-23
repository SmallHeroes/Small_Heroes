import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mobileTextPresentationFor } from '../book-layout/adapters/mobile-page';

const root = path.join(process.cwd(), 'app/book/[id]/read-v2');
const css = () => fs.readFileSync(path.join(root, 'reader-v2.module.css'), 'utf8');
describe('complete artwork reader policy, not a pixel verdict', () => {
  it('opts the actual shared ReaderV2 into the fit policy, not a separate trial viewer', () => {
    expect(fs.readFileSync(path.join(root, 'reader-v2.tsx'), 'utf8')).toContain('data-artwork-fit="contain"');
  });
  it('uses paper prose on mobile for both short and long visible text', () => {
    for (const text of ['שלום.', 'טקסט ארוך '.repeat(200)])
      for (const treatment of ['standard', 'overlay'] as const)
        expect(mobileTextPresentationFor(text, treatment)).toBe('paper_panel');
    expect(mobileTextPresentationFor('Hidden narration', 'captionless')).toBe('captionless');
    expect(mobileTextPresentationFor('Hidden narration', 'standard', false)).toBe('captionless');
  });
  it('contains cover, static/turn desktop and mobile images without cover zoom', () => {
    const policy = css().split('/* Complete-artwork policy')[1];
    expect(policy).toBeDefined();
    for (const selector of ['.coverBleedImg', '.leftPageMaskedIllustration .illustrationImg',
      '.openPageIllustration .illustrationImg', '.mobileIllustration .illustrationImg'])
      expect(policy).toContain(selector);
    expect(policy).toContain('object-fit: contain');
    expect(policy).not.toContain('object-fit: cover');
    expect(policy).toContain('--left-illustration-overflow: 0%');
    expect(policy).toMatch(/\.mobileScene\s*\{\s*height: 100%;\s*min-height: 0;\s*max-height: 100%;/);
  });
  it('makes long desktop prose reachable and keyboard focusable, resetting by scene', () => {
    const policy = css().split('/* Complete-artwork policy')[1];
    expect(policy).toMatch(/\.openTextSafe\s*\{[^}]*display: block;[^}]*overflow-y: auto;/s);
    const surface = fs.readFileSync(path.join(root, 'components/DesktopBookPageSurface.tsx'), 'utf8');
    expect(surface).toContain('key={spread.sceneId}');
    expect(surface).toContain('tabIndex={isCurrent && !textureOnly ? 0 : -1}');
    expect(surface).toContain('aria-label="טקסט הסיפור"');
    const reader = fs.readFileSync(path.join(root, 'reader-v2.tsx'), 'utf8');
    expect(reader).toContain("event.target.closest('[data-reader-prose]')");
  });
  it('keeps physical turn slices using the same desktop surface', () => {
    const texture = fs.readFileSync(path.join(root, 'components/DesktopBookPageSurface.tsx'), 'utf8');
    expect(texture).toContain('styles.leftPageMaskedIllustration');
    expect(texture).toContain('textureOnly');
    expect(texture).not.toMatch(/page_\d|naomi|Uri|נעמי|אורי/);
  });
  it('reserves the diagnostic banner height instead of clipping the prose bottom off-screen', () => {
    const frame = fs.readFileSync(path.join(process.cwd(), 'app/dev/local-reader/local-reader.module.css'), 'utf8');
    expect(frame).toContain('grid-template-rows: auto minmax(0, 1fr)');
    expect(frame).toContain('min-height: 0 !important');
    const route = fs.readFileSync(path.join(process.cwd(), 'app/dev/local-reader/page.tsx'), 'utf8');
    expect(route).toContain('className={localStyles.frame}');
  });
});
