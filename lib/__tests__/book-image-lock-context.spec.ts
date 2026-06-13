import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { beatsFromStoryPages, resolveBookShotPlan } from '../book-shot-plan';
import {
  assembleStyle02BookReferencesWithLocks,
  assertStyle02SellableChildAnchorInBreakdown,
  buildBookImageLockContext,
  formatStyle02LockManifestLine,
  isStyle02CanonicalChildAnchorPath,
  resolvePageImageLockSlice,
  resolveStyle02ChildAnchorPath,
  STYLE02_REFERENCE_KIND_ORDER,
  validateStyle02ReferenceOrder,
} from '../book-image-lock-context';
import { loadStoryFromBank } from '../../backend/providers/story-bank-loader';
import { getCompanionById } from '../companions';
import {
  enrichStoryLocationPlanWithReferenceSheets,
  resolveStoryLocationPlan,
} from '../story-location-bible';
import {
  classifyStyle02SceneClassDetailed,
  resolveStyle02BookWardrobeLock,
  resolveStyle02RefBudgetConfig,
  resolveStyle02StyleReferencePaths,
  resolveStyle02SubsetKey,
  resolveCompanionReferencePath,
} from '../style02-gptimage';

const FOX_BANK = path.join(process.cwd(), 'story-bank', 'v3-approved', 'fox_uri_adventure.md');

function writeApprovedFixture(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'bucket-object.png'), Buffer.from('bucket-object'));
  fs.writeFileSync(
    path.join(dir, 'manifest.json'),
    JSON.stringify({
      zoneId: 'balcony_drip_area',
      approvedBy: 'Guy test fixture',
      generatedAt: '2026-06-12T00:00:00.000Z',
      files: { isolatedObject: 'bucket-object.png' },
    })
  );
}

describe('BookImageLockContext — Style 02 lock contract', () => {
  it('resolvePageImageLockSlice derives shot, location, time-of-day, and object refs', async () => {
    if (!fs.existsSync(FOX_BANK)) return;

    const story = await loadStoryFromBank(FOX_BANK, 'נועה', 'אורי', 'girl', {
      skipLlmPersonalization: true,
      maxPages: 20,
    });
    const beats = beatsFromStoryPages(story.pages);
    const shotPlan = resolveBookShotPlan({ storyFilePath: FOX_BANK, pages: beats });
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'style02-lock-'));
    const approvedDir = path.join(
      tmpRoot,
      'story-bank',
      'v3-approved',
      'fox_uri_adventure.zone-sheets',
      'balcony_drip_area'
    );
    writeApprovedFixture(approvedDir);
    const origCwd = process.cwd();
    process.chdir(tmpRoot);
    try {
      const locationPlan = enrichStoryLocationPlanWithReferenceSheets(
        resolveStoryLocationPlan({
          storyFilePath: FOX_BANK,
          challengeCategory: 'NIGHT_FEAR',
          direction: 'adventure',
          pages: beats,
        }),
        FOX_BANK
      );
      const ctx = buildBookImageLockContext({
        bookShotPlan: shotPlan,
        storyLocationPlan: locationPlan,
        storyTimeOfDay: story.storyTimeOfDay ?? 'night',
        pageTimeOfDayOverrides: story.pageTimeOfDayOverrides,
        totalPages: 20,
      });

      const p5 = resolvePageImageLockSlice(ctx, 5, {
        imageDirection: story.pages[4]?.imagePrompt,
        bookPageText: story.pages[4]?.text,
      });
      expect(p5.pageShot?.shot).toBeTruthy();
      expect(p5.pageLocationPlan?.zoneId).toBeTruthy();
      expect(p5.effectivePageTimeOfDay).toBeTruthy();
    } finally {
      process.chdir(origCwd);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('assembleStyle02BookReferencesWithLocks orders child → companion → objects → style', () => {
    const styleRefs = [
      '/style/a.png',
      '/style/b.png',
      '/style/c.png',
    ];
    const { paths, breakdown } = assembleStyle02BookReferencesWithLocks({
      styleRefPaths: styleRefs,
      childAnchorPath: '/anchors/child.png',
      companionRefPath: '/refs/fox.png',
      isolatedObjectRefPaths: ['/zones/bucket-object.png'],
      config: 'A',
    });

    const validation = validateStyle02ReferenceOrder(breakdown);
    expect(validation.ok, validation.violations.join('; ')).toBe(true);
    expect(breakdown.child).toEqual(['/anchors/child.png']);
    expect(breakdown.companion).toEqual(['/refs/fox.png']);
    expect(breakdown.isolatedObjects).toEqual(['/zones/bucket-object.png']);
    expect(paths.length).toBeGreaterThan(0);

    const childIdx = paths.indexOf('/anchors/child.png');
    const companionIdx = paths.indexOf('/refs/fox.png');
    const objectIdx = paths.indexOf('/zones/bucket-object.png');
    const firstStyleIdx = paths.findIndex((p) => p.startsWith('/style/'));
    expect(childIdx).toBeLessThan(companionIdx);
    expect(companionIdx).toBeLessThan(objectIdx);
    if (firstStyleIdx >= 0) {
      expect(objectIdx).toBeLessThan(firstStyleIdx);
    }
  });

  it('STYLE02_REFERENCE_KIND_ORDER lists identity kinds before style', () => {
    expect(STYLE02_REFERENCE_KIND_ORDER.indexOf('child')).toBeLessThan(
      STYLE02_REFERENCE_KIND_ORDER.indexOf('style')
    );
    expect(STYLE02_REFERENCE_KIND_ORDER.indexOf('isolatedObjects')).toBeLessThan(
      STYLE02_REFERENCE_KIND_ORDER.indexOf('style')
    );
  });

  it('canonical anchor path flows into BookImageLockContext and breakdown.child', () => {
    const anchor =
      'https://app.example/orders/abc/character-anchors/child-canonical-style02-a1.png';
    expect(isStyle02CanonicalChildAnchorPath(anchor)).toBe(true);

    const ctx = buildBookImageLockContext({
      childCanonicalAnchorPath: anchor,
    });
    expect(ctx.childCanonicalAnchorPath).toBe(anchor);

    const resolved = resolveStyle02ChildAnchorPath({
      childCanonicalAnchorPath: ctx.childCanonicalAnchorPath,
    });
    expect(resolved).toBe(anchor);

    const { breakdown } = assembleStyle02BookReferencesWithLocks({
      styleRefPaths: ['/style/a.png', '/style/b.png'],
      childAnchorPath: resolved,
      companionRefPath: '/refs/fox.png',
      config: 'A',
      requireChildAnchor: true,
    });
    expect(breakdown.child).toEqual([anchor]);
  });

  it('requireChildAnchor overrides config C so sellable path keeps child ref', () => {
    const anchor = '/orders/x/character-anchors/child-canonical-style02-a1.png';
    const { breakdown } = assembleStyle02BookReferencesWithLocks({
      styleRefPaths: ['/style/a.png', '/style/b.png', '/style/c.png'],
      childAnchorPath: anchor,
      companionRefPath: '/refs/fox.png',
      config: 'C',
      requireChildAnchor: true,
    });
    expect(breakdown.child).toEqual([anchor]);
    expect(breakdown.companion.length).toBeGreaterThan(0);
  });

  it('assertStyle02SellableChildAnchorInBreakdown throws when sellable and child missing', () => {
    const prev = process.env.STYLE02_SELLABLE;
    process.env.STYLE02_SELLABLE = 'true';
    try {
      expect(() =>
        assertStyle02SellableChildAnchorInBreakdown({
          breakdown: { child: [], style: ['/s.png'], companion: [], otherCharacters: [] },
          childAnchorPath: '/orders/x/character-anchors/child-canonical-style02.png',
        })
      ).toThrow(/config C cannot omit child ref/);
    } finally {
      if (prev === undefined) delete process.env.STYLE02_SELLABLE;
      else process.env.STYLE02_SELLABLE = prev;
    }
  });

  it('resolveStyle02RefBudgetConfig locks to A when STYLE02_SELLABLE=true', async () => {
    const { resolveStyle02RefBudgetConfig } = await import('../style02-gptimage');
    const prevSellable = process.env.STYLE02_SELLABLE;
    const prevConfig = process.env.PHASE2_STYLE02_REF_CONFIG;
    process.env.STYLE02_SELLABLE = 'true';
    process.env.PHASE2_STYLE02_REF_CONFIG = 'C';
    try {
      expect(resolveStyle02RefBudgetConfig()).toBe('A');
    } finally {
      if (prevSellable === undefined) delete process.env.STYLE02_SELLABLE;
      else process.env.STYLE02_SELLABLE = prevSellable;
      if (prevConfig === undefined) delete process.env.PHASE2_STYLE02_REF_CONFIG;
      else process.env.PHASE2_STYLE02_REF_CONFIG = prevConfig;
    }
  });

  it('fox_uri Style 02 manifest: all pages receive lock slice fields', async () => {
    if (!fs.existsSync(FOX_BANK)) return;

    const companion = getCompanionById('fox_uri');
    expect(companion).toBeTruthy();

    const story = await loadStoryFromBank(FOX_BANK, 'נועה', 'אורי', 'girl', {
      skipLlmPersonalization: true,
      maxPages: 20,
    });
    const beats = beatsFromStoryPages(story.pages);
    const shotPlan = resolveBookShotPlan({ storyFilePath: FOX_BANK, pages: beats });
    const locationPlan = resolveStoryLocationPlan({
      storyFilePath: FOX_BANK,
      challengeCategory: 'NIGHT_FEAR',
      direction: 'adventure',
      pages: beats,
    });
    const childAnchor =
      'https://app.example/orders/demo/character-anchors/child-canonical-style02-a1.png';
    const ctx = buildBookImageLockContext({
      bookShotPlan: shotPlan,
      storyLocationPlan: locationPlan,
      storyTimeOfDay: story.storyTimeOfDay ?? 'night',
      pageTimeOfDayOverrides: story.pageTimeOfDayOverrides,
      childCanonicalAnchorPath: childAnchor,
      totalPages: 20,
    });

    const refConfig = resolveStyle02RefBudgetConfig();
    const companionRef = resolveCompanionReferencePath(companion!.image);
    const resolvedChildAnchor = resolveStyle02ChildAnchorPath({
      childCanonicalAnchorPath: ctx.childCanonicalAnchorPath,
    });

    for (let pageNum = 1; pageNum <= 20; pageNum++) {
      const page = story.pages[pageNum - 1];
      const slice = resolvePageImageLockSlice(ctx, pageNum, {
        imageDirection: page?.imagePrompt,
        bookPageText: page?.text,
      });
      const plannedLoc = locationPlan.pagePlans.find((p) => p.page === pageNum);
      if (plannedLoc) {
        expect(slice.pageLocationPlan, `page ${pageNum} missing pageLocationPlan`).toBeTruthy();
      }
      expect(slice.effectivePageTimeOfDay, `page ${pageNum} missing timeOfDay`).toBeTruthy();
      const plannedShot = shotPlan.pages.find((p) => p.page === pageNum);
      if (plannedShot) {
        expect(slice.pageShot, `page ${pageNum} missing pageShot`).toBeTruthy();
      }

      const sceneClassification = classifyStyle02SceneClassDetailed({
        effectivePageTimeOfDay: slice.effectivePageTimeOfDay,
        pageLocationPlan: slice.pageLocationPlan,
        locationBible: slice.locationBible,
        imagePrompt: page?.imagePrompt,
        bookPageText: page?.text,
      });
      const sceneClass = sceneClassification.sceneClass;
      expect(sceneClassification.source, `page ${pageNum} should use lock classifier`).toBe('locks');
      const subsetKey = resolveStyle02SubsetKey(sceneClass);
      const styleRefs = resolveStyle02StyleReferencePaths(subsetKey, refConfig === 'A' ? 2 : 3);

      const { paths, breakdown } = assembleStyle02BookReferencesWithLocks({
        styleRefPaths: styleRefs,
        childAnchorPath: resolvedChildAnchor,
        companionRefPath: companionRef,
        isolatedObjectRefPaths: slice.isolatedObjectRefPaths,
        config: refConfig,
        requireChildAnchor: true,
      });

      const validation = validateStyle02ReferenceOrder(breakdown);
      expect(validation.ok, `page ${pageNum}: ${validation.violations.join('; ')}`).toBe(true);
      expect(breakdown.child?.length ?? 0).toBe(1);
      expect(paths.length).toBeGreaterThan(0);

      const line = formatStyle02LockManifestLine({ pageNumber: pageNum, slice, breakdown, paths });
      expect(line).toMatch(new RegExp(`^p${pageNum}`));
      expect(line).toMatch(/child=1/);
    }
  });
});
