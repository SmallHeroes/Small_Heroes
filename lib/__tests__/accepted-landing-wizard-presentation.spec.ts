import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), 'utf8');

describe('accepted Landing and Wizard presentation boundary', () => {
  it('keeps the accepted 2027 Landing composition and its required media', () => {
    const page = source('app/page.tsx');
    const landing = source('app/landing/landing-page.tsx');
    const collage = source('app/landing/hero-collage.tsx');
    const spotlight = source('app/components/CompanionSpotlight.tsx');

    expect(page).toContain("import './landing/wow-2027.css'");
    expect(landing).toContain("import { HeroCollage } from './hero-collage'");
    expect(landing).toContain("import { CompanionSpotlight } from '@/app/components/CompanionSpotlight'");
    expect(landing).toContain('data-motion="on"');
    expect(collage.match(/\/Images\/hero-beat-[1-3]\.webp/g)).toEqual([
      '/Images/hero-beat-1.webp',
      '/Images/hero-beat-2.webp',
      '/Images/hero-beat-3.webp',
    ]);
    expect(spotlight).toContain('export function companionSpotlightCutoutSrc');
    expect(spotlight).toContain('export function companionSpotlightWizardHref');

    const requiredMedia = [
      'public/Images/hero-beat-1.webp',
      'public/Images/hero-beat-2.webp',
      'public/Images/hero-beat-3.webp',
      'public/Fonts/SuezOne-Regular.ttf',
      'public/Videos/Chameleon_Idle.mp4',
      'public/Videos/Dragon_Idle.mp4',
      'public/Videos/Fox_Idle.mp4',
      'public/Videos/Lion_Idle.mp4',
      'public/Videos/Panda_Idle.mp4',
      'public/Videos/Rabbit_Idle.mp4',
    ];
    for (const relativePath of requiredMedia) {
      const absolutePath = join(root, relativePath);
      expect(existsSync(absolutePath), relativePath).toBe(true);
      expect(statSync(absolutePath).size, relativePath).toBeGreaterThan(1_024);
    }
  });

  it('keeps the accepted Wizard styling while retaining current sellability and no-photo logic', () => {
    const wizardHtml = source('public/HTML/wizard.html');
    const wizardJs = source('public/JS/wizard.js');
    const matrixResponse = source('lib/web/mvp-matrix-response.ts');

    expect(wizardHtml).toContain('family=Rubik:wght@400;500;600;700;800;900');
    expect(wizardHtml).toContain('/CSS/main.css?v=wow-2027-v2');
    expect(wizardHtml).toContain('/CSS/wizard.css?v=wow-2027-v2');
    expect(wizardJs).toContain("btn.textContent = 'להמשיך בלי תמונה'");
    expect(wizardJs).toContain('const comingSoon = dirMeta.sellable === false');
    expect(wizardJs).not.toContain('const comingSoon = dirMeta.selectable === false');
    expect(matrixResponse).toContain('sellable: boolean');
  });

  it('keeps restored marketing media out of the unreachable debug function bundle', () => {
    const nextConfig = source('next.config.js');

    expect(nextConfig).toContain("excludes['/api/debug/replicate-image']");
    expect(nextConfig).toContain("'./public/Videos/**/*'");
    expect(nextConfig).toContain("'./public/Images/**/*'");
  });
});
