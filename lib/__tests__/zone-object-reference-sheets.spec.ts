import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';

import {
  assembleStyle01BookReferencesWithZoneSheets,
  buildIsolatedObjectReferencePromptBlock,
  buildPageActionPromptBlock,
  buildVisualSpoilerPromptBlock,
  enrichStoryLocationPlanWithReferenceSheets,
  loadApprovedZoneSheetManifest,
  pageAllowsIsolatedObjectRef,
  resolvePageReferenceSheets,
  validateZoneSheetManifest,
  ISOLATED_OBJECT_REFERENCE_INSTRUCTION,
} from '../story-location-bible/zone-sheets';
import { buildLocationContinuityPromptBlock } from '../story-location-bible/compose';
import { loadStoryLocationPlanOverride } from '../story-location-bible/resolve';
import { assembleStyle01Phase2Prompt } from '../style01-prompt-assembly';

const FOX_BANK = path.join(process.cwd(), 'story-bank', 'v3-approved', 'fox_uri_adventure.md');

function writeApprovedFixture(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'set.png'), Buffer.from('set'));
  fs.writeFileSync(path.join(dir, 'bucket-object.png'), Buffer.from('bucket-object'));
  fs.writeFileSync(
    path.join(dir, 'manifest.json'),
    JSON.stringify({
      zoneId: 'balcony_drip_area',
      approvedBy: 'Guy test fixture',
      generatedAt: '2026-06-12T00:00:00.000Z',
      files: { set: 'set.png', isolatedObject: 'bucket-object.png' },
    })
  );
}

describe('Zone & object reference sheets (isolated object fix)', () => {
  it('p5 resolves isolated object only — no set.png path', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zone-sheets-'));
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
      const bundle = loadStoryLocationPlanOverride(FOX_BANK);
      const enriched = enrichStoryLocationPlanWithReferenceSheets(bundle!, FOX_BANK);
      const p5 = enriched.pagePlans.find((p) => p.page === 5)!;
      expect(p5.referenceSheets?.zoneSetPath).toBeUndefined();
      expect(p5.referenceSheets?.isolatedObjectPaths?.[0]).toMatch(/bucket-object\.png$/);
      const p4 = enriched.pagePlans.find((p) => p.page === 4)!;
      expect(p4.referenceSheets).toBeUndefined();
    } finally {
      process.chdir(origCwd);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('pageAllowsIsolatedObjectRef respects spoiler on p1-4 and cover', () => {
    const bundle = loadStoryLocationPlanOverride(FOX_BANK)!;
    const cover = bundle.pagePlans.find((p) => p.page === 0)!;
    expect(pageAllowsIsolatedObjectRef(cover)).toBe(false);
    for (const n of [1, 2, 3, 4]) {
      const plan = bundle.pagePlans.find((p) => p.page === n)!;
      expect(pageAllowsIsolatedObjectRef(plan)).toBe(false);
    }
    const p5 = bundle.pagePlans.find((p) => p.page === 5)!;
    expect(pageAllowsIsolatedObjectRef(p5)).toBe(true);
  });

  it('bucket pages include window-ledge drip lock in location block', () => {
    const bundle = loadStoryLocationPlanOverride(FOX_BANK)!;
    const p6 = bundle.pagePlans.find((p) => p.page === 6)!;
    const block = buildLocationContinuityPromptBlock(bundle.bible, p6);
    expect(block).toMatch(/WINDOW LEDGE/i);
    expect(block).toMatch(/NEVER a downspout/i);
  });

  it('ref priority: child first; isolated object after companion; no set in assembly', () => {
    const child = '/tmp/child.jpg';
    const companion = '/tmp/companion.png';
    const bucketObj = '/tmp/bucket-object.png';
    const { paths, breakdown } = assembleStyle01BookReferencesWithZoneSheets({
      styleRefPaths: ['/s1.png', '/s2.png'],
      childPhotoPath: child,
      companionRefPaths: [companion],
      config: 'A',
      includeChildPhoto: true,
      isolatedObjectRefPaths: [bucketObj],
      zoneSetRefPath: '/set.png',
    });
    expect(paths[0]).toBe(child);
    expect(paths).not.toContain('/set.png');
    expect(paths).toContain(bucketObj);
    expect(breakdown.zoneSet).toEqual([]);
  });

  it('pageAction and isolated object guard appear in prompt', () => {
    const bundle = loadStoryLocationPlanOverride(FOX_BANK)!;
    const p8 = bundle.pagePlans.find((p) => p.page === 8)!;
    expect(buildPageActionPromptBlock(p8)).toMatch(/PAGE ACTION — MANDATORY/);
    const { prompt } = assembleStyle01Phase2Prompt({
      pageNumber: 8,
      rawScenePrompt: 'duet at bucket',
      challengeCategory: 'NIGHT_FEAR',
      locationBible: bundle.bible,
      pageLocationPlan: {
        ...p8,
        referenceSheets: {
          zoneId: 'balcony_drip_area',
          isolatedObjectPaths: ['/bucket-object.png'],
        },
      },
      companion: { id: 'fox_uri', name: 'אורי' },
    });
    expect(prompt).toMatch(/PAGE ACTION — MANDATORY/);
    expect(prompt).toMatch(/ISOLATED OBJECT reference/i);
    expect(prompt).toMatch(/BOOK LOCATION CONTINUITY/);
  });

  it('p1-4 visual spoiler block forbids bucket', () => {
    const bundle = loadStoryLocationPlanOverride(FOX_BANK)!;
    const p2 = bundle.pagePlans.find((p) => p.page === 2)!;
    const block = buildVisualSpoilerPromptBlock(p2);
    expect(block).toMatch(/FORBIDDEN/i);
    expect(block).toMatch(/metal_bucket|bucket/i);
  });

  it('manifest validation accepts isolatedObject file', () => {
    expect(
      validateZoneSheetManifest(
        {
          zoneId: 'balcony_drip_area',
          approvedBy: 'Guy',
          generatedAt: '2026-06-12',
          files: { isolatedObject: 'bucket-object.png' },
        },
        { requireApproval: true }
      )
    ).toBe(true);
  });
});
