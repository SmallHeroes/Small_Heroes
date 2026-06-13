import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { resolveBookShotPlan, beatsFromStoryPages } from '../book-shot-plan';
import { assembleStyle01Phase2Prompt } from '../style01-prompt-assembly';
import { buildScenarioSettingLockBlock } from '../scenario-setting-lock';
import {
  buildLocationContinuityPromptBlock,
  deriveBookLocationBible,
  derivePageLocationPlans,
  loadStoryLocationPlanOverride,
  resolveStoryLocationPlan,
  resolvePageLocationPlan,
  isStoryLocationPlanValid,
} from '../story-location-bible';

const FOX_BANK = path.join(process.cwd(), 'story-bank', 'v3-approved', 'fox_uri_adventure.md');
const FOX_SIDECAR = path.join(
  process.cwd(),
  'story-bank',
  'v3-approved',
  'fox_uri_adventure.location-bible.json'
);

function loadFoxStoryPages() {
  const md = fs.readFileSync(FOX_BANK, 'utf8');
  const pages: Array<{ pageNumber: number; text: string; imagePrompt: string }> = [];
  for (const m of md.matchAll(/--- Page (\d+) ---\r?\n([\s\S]*?)(?=\r?\n--- Page |\r?\nWORD_COUNT:|$)/g)) {
    const block = m[2];
    const imagePrompt = block.match(/^imageDirection:\s*(.+)$/m)?.[1]?.trim() ?? '';
    const text = block
      .split(/\r?\n/)
      .filter((line) => !line.startsWith('imageDirection:'))
      .join('\n')
      .trim();
    pages.push({ pageNumber: Number(m[1]), text, imagePrompt });
  }
  return pages;
}

describe('StoryLocationBible', () => {
  it('scenario inheritance: NIGHT_FEAR without sidecar derives a default bible', () => {
    const beats = [{ page: 1, imageDirection: 'bedroom window', bookPageText: 'לילה' }];
    const bible = deriveBookLocationBible({
      challengeCategory: 'NIGHT_FEAR',
      direction: 'adventure',
      pages: beats,
    });
    expect(bible.source).toBe('derived');
    expect(bible.primarySetting).toMatch(/bedroom at night/i);
    expect(bible.forbiddenDrift).toContain('stream');
    const plans = derivePageLocationPlans(bible, beats);
    expect(plans[0].zoneId).toBeTruthy();
  });

  it('override priority: fox sidecar wins over scenario default', () => {
    expect(fs.existsSync(FOX_SIDECAR)).toBe(true);
    const pages = loadFoxStoryPages();
    const beats = beatsFromStoryPages(pages);
    const bundle = resolveStoryLocationPlan({
      storyFilePath: FOX_BANK,
      challengeCategory: 'NIGHT_FEAR',
      direction: 'adventure',
      pages: beats,
    });
    expect(bundle.bible.source).toBe('sidecar');
    expect(bundle.bible.primarySetting).toMatch(/home at night/i);
    expect(isStoryLocationPlanValid(bundle)).toBe(true);
    const derivedOnly = deriveBookLocationBible({
      challengeCategory: 'NIGHT_FEAR',
      pages: beats,
    });
    expect(bundle.bible.primarySetting).not.toBe(derivedOnly.primarySetting);
  });

  it('no duplicate location truth: bible prompt replaces SCENARIO SETTING LOCK', () => {
    const pages = loadFoxStoryPages();
    const beats = beatsFromStoryPages(pages);
    const bundle = resolveStoryLocationPlan({
      storyFilePath: FOX_BANK,
      challengeCategory: 'NIGHT_FEAR',
      pages: beats,
    });
    const shotPlan = resolveBookShotPlan({ storyFilePath: FOX_BANK, pages: beats });
    const pageShot = shotPlan.pages.find((p) => p.page === 10)!;
    const pagePlan = resolvePageLocationPlan(bundle, 10)!;

    const { prompt } = assembleStyle01Phase2Prompt({
      pageNumber: 10,
      rawScenePrompt: 'bucket repositioned',
      bookPageText: pages.find((p) => p.pageNumber === 10)?.text,
      challengeCategory: 'NIGHT_FEAR',
      pageShot,
      locationBible: bundle.bible,
      pageLocationPlan: pagePlan,
      companion: { id: 'fox_uri', name: 'אורי' },
    });

    expect(prompt).toMatch(/BOOK LOCATION CONTINUITY/);
    expect(prompt).toMatch(/same metal bucket/i);
    expect(prompt).not.toMatch(/SCENARIO SETTING LOCK/);
    expect(buildScenarioSettingLockBlock('NIGHT_FEAR')).toMatch(/SCENARIO SETTING LOCK/);
  });

  it('bucket_close_area page plan includes same bucket + drip and forbidden water bodies', () => {
    const override = loadStoryLocationPlanOverride(FOX_BANK);
    expect(override).toBeTruthy();
    const p10 = override!.pagePlans.find((p) => p.page === 10)!;
    expect(p10.zoneId).toBe('bucket_close_area');
    const block = buildLocationContinuityPromptBlock(override!.bible, p10, {
      pageShot: { page: 10, shot: 'close_up', rationale: 'emotional peak' },
    });
    expect(block).toMatch(/same metal bucket/i);
    expect(block).toMatch(/same drip source/i);
    expect(block).toMatch(/river|pond|stream|rooftop|cliff/i);
  });

  it('BookShotPlan preserved: location plan does not change shot type', () => {
    const pages = loadFoxStoryPages();
    const beats = beatsFromStoryPages(pages);
    const shotPlan = resolveBookShotPlan({ storyFilePath: FOX_BANK, pages: beats });
    const p10Shot = shotPlan.pages.find((p) => p.page === 10);
    expect(p10Shot?.shot).toBe('close_up');
  });

  it('fallback safety: without bible input, scenario lock still applies', () => {
    const { prompt } = assembleStyle01Phase2Prompt({
      pageNumber: 1,
      rawScenePrompt: 'clinic waiting room',
      challengeCategory: 'MEDICAL_PROCEDURE',
    });
    expect(prompt).toMatch(/SCENARIO SETTING LOCK/);
    expect(prompt).not.toMatch(/BOOK LOCATION CONTINUITY/);
  });

  it('cover page 0 plan preserves mystery — no bucket anchor', () => {
    const bundle = loadStoryLocationPlanOverride(FOX_BANK);
    expect(bundle).toBeTruthy();
    const cover = resolvePageLocationPlan(bundle!, 0);
    expect(cover?.page).toBe(0);
    expect(cover?.visibleAnchors.some((a) => /bucket/i.test(a))).toBe(false);
    expect(cover?.expectedBucketVisibility).toBe('hidden');
    expect(cover?.forbiddenDrift.some((d) => /visible bucket|drip source|falling water/i.test(d))).toBe(true);
  });
});
