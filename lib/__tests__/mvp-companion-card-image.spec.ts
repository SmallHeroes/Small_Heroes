import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import {
  companionSpotlightCutoutSrc,
  companionSpotlightWizardHref,
} from '../../app/components/CompanionSpotlight';
import { MVP_STORY_MATRIX } from '../../backend/config/mvp-story-matrix';
import { getCompanionById } from '../companions';

describe('MVP companion cardImage', () => {
  it('points each matrix companion at an existing public style01 sheet file', () => {
    const categories = Object.keys(MVP_STORY_MATRIX) as (keyof typeof MVP_STORY_MATRIX)[];
    expect(categories).toHaveLength(6);

    for (const category of categories) {
      const companionId = MVP_STORY_MATRIX[category].companionId;
      const companion = getCompanionById(companionId);
      expect(companion, companionId).not.toBeNull();
      expect(companion!.cardImage, `${companionId}.cardImage`).toBeTruthy();

      const rel = companion!.cardImage!.replace(/^\//, '');
      const abs = join(process.cwd(), 'public', rel);
      expect(existsSync(abs), abs).toBe(true);
    }
  });

  it('binds every MVP companion to a small transparent Spotlight asset and its Wizard category', () => {
    const categories = Object.keys(MVP_STORY_MATRIX) as (keyof typeof MVP_STORY_MATRIX)[];
    const cutouts = new Set<string>();

    for (const category of categories) {
      const companionId = MVP_STORY_MATRIX[category].companionId;
      const companion = getCompanionById(companionId);
      expect(companion, companionId).not.toBeNull();

      const sourceImage = companion!.cardImage ?? companion!.image;
      const cutout = companionSpotlightCutoutSrc(sourceImage);
      expect(cutout).toBe(`/Images/spotlight/${companionId}.png`);
      expect(companionSpotlightWizardHref(category)).toBe(`/wizard?category=${category}`);

      const absoluteCutout = join(process.cwd(), 'public', cutout.replace(/^\//, ''));
      expect(existsSync(absoluteCutout), absoluteCutout).toBe(true);
      expect(statSync(absoluteCutout).size, absoluteCutout).toBeLessThan(150_000);
      cutouts.add(cutout);
    }

    expect(cutouts.size).toBe(6);
  });

  it('keeps the modal fail-safe and returns focus through the landing owner', () => {
    const componentSource = readFileSync(
      join(process.cwd(), 'app', 'components', 'CompanionSpotlight.tsx'),
      'utf8',
    );
    const landingSource = readFileSync(
      join(process.cwd(), 'app', 'landing', 'landing-page.tsx'),
      'utf8',
    );

    expect(componentSource).toContain('aria-modal="true"');
    expect(componentSource).toContain("e.key === 'Escape'");
    expect(componentSource).toContain('e.target === e.currentTarget');
    expect(componentSource).toContain("document.body.style.overflow = 'hidden'");
    expect(componentSource).toContain('img.dataset.fallback');
    expect(landingSource).toContain('current?.originEl?.focus?.()');
    expect(componentSource).toContain('landing_companion_spotlight_start');
  });
});
