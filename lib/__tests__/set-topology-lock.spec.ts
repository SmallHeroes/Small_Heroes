import path from 'path';
import { describe, expect, it } from 'vitest';

import { buildLocationContinuityPromptBlock } from '../story-location-bible/compose';
import { loadStoryLocationPlanOverride } from '../story-location-bible/resolve';
import {
  assembleStyle01BookReferencesWithZoneSheets,
  enrichStoryLocationPlanWithReferenceSheets,
} from '../story-location-bible/zone-sheets';
import {
  buildSetTopologyLockBlock,
  computeMaxSetElementRefSlots,
  promptContainsSetTopologyLock,
  selectPageSetElementRefs,
} from '../story-location-bible/set-topology';
import { assembleStyle01Phase2Prompt } from '../style01-prompt-assembly';

const LION_STORY = path.join(
  process.cwd(),
  'story-bank',
  'v5-fixed-v2',
  'lion_shaket_bedtime.md'
);

describe('Set Topology Lock (Brief I — general mechanism)', () => {
  it('emits SET TOPOLOGY LOCK with bible geometry for fixed-location pages', () => {
    const bundle = loadStoryLocationPlanOverride(LION_STORY)!;
    expect(bundle.bible.setTopology?.elements.length).toBeGreaterThan(0);

    const block = buildSetTopologyLockBlock(bundle.bible);
    expect(block).toMatch(/SET TOPOLOGY LOCK/i);
    expect(block).toContain('back-right wall, headboard to the right');
    expect(block).toContain('back-left wall, PURPLE curtains');
    expect(block).toContain('round, blue-grey, CENTER of floor');
    expect(block).toContain('BOOKS ONLY, no plush');

    const p1 = bundle.pagePlans.find((p) => p.page === 1)!;
    const locationBlock = buildLocationContinuityPromptBlock(bundle.bible, p1);
    expect(locationBlock).toContain('SET TOPOLOGY LOCK');
    expect(promptContainsSetTopologyLock(locationBlock)).toBe(true);
  });

  it('does not attach composed set/map image paths (isolated objects only)', () => {
    const bundle = loadStoryLocationPlanOverride(LION_STORY)!;
    const enriched = enrichStoryLocationPlanWithReferenceSheets(bundle, LION_STORY);
    const p6 = enriched.pagePlans.find((p) => p.page === 6)!;
    expect(p6.referenceSheets?.zoneSetPath).toBeUndefined();
    expect(p6.referenceSheets?.isolatedObjectPaths?.length).toBeGreaterThan(0);
    for (const ref of p6.referenceSheets?.isolatedObjectPaths ?? []) {
      expect(ref).not.toMatch(/set\.png$/i);
      expect(ref).not.toMatch(/set-map/i);
    }
  });

  it('selectPageSetElementRefs respects maxSlots and never exceeds budget', () => {
    const bundle = loadStoryLocationPlanOverride(LION_STORY)!;
    const enriched = enrichStoryLocationPlanWithReferenceSheets(bundle, LION_STORY);
    const p6 = enriched.pagePlans.find((p) => p.page === 6)!;
    const candidates = p6.referenceSheets?.isolatedObjectPaths ?? [];
    const maxSlots = 2;
    const selection = selectPageSetElementRefs({
      pagePlan: p6,
      pageShot: { page: 6, shot: 'medium_wide', angle: 'eye', rationale: 'test' },
      candidatePaths: candidates,
      setElementFiles: bundle.bible.setElementFiles,
      maxSlots,
    });
    expect(selection.selected.length).toBeLessThanOrEqual(maxSlots);
    expect(selection.requested.length).toBe(candidates.length);
    expect(selection.dropped.length + selection.selected.length).toBe(selection.requested.length);
  });

  it('computeMaxSetElementRefSlots caps at 2 after child+companion reserved', () => {
    expect(computeMaxSetElementRefSlots(2)).toBe(2);
    expect(computeMaxSetElementRefSlots(3)).toBe(1);
    expect(computeMaxSetElementRefSlots(4)).toBe(0);
  });

  it('preserves ref order child → companion → set/object → other → style', () => {
    const { paths, breakdown } = assembleStyle01BookReferencesWithZoneSheets({
      styleRefPaths: ['/style/a.png', '/style/b.png'],
      childPhotoPath: '/child.png',
      companionRefPaths: ['/companion.png'],
      otherCharacterRefPaths: ['/other.png'],
      config: 'A',
      includeChildPhoto: true,
      isolatedObjectRefPaths: ['/objects/pillow-cave-object.png'],
    });
    expect(paths[0]).toBe('/child.png');
    expect(paths[1]).toBe('/companion.png');
    expect(paths[2]).toBe('/objects/pillow-cave-object.png');
    expect(paths[3]).toBe('/other.png');
    expect(breakdown.style.every((p) => paths.slice(4).includes(p))).toBe(true);
  });

  it('composed map refs drop on non-close pages unless allowTopologyMapRef is true', () => {
    const bundle = loadStoryLocationPlanOverride(LION_STORY)!;
    const p6 = bundle.pagePlans.find((p) => p.page === 6)!;
    const candidates = ['/fake/set-map.png', '/fake/blanket-fold-object.png'];

    const withoutFlag = selectPageSetElementRefs({
      pagePlan: p6,
      pageShot: { page: 6, shot: 'medium_wide', angle: 'eye', rationale: 'test' },
      candidatePaths: candidates,
      setElementFiles: bundle.bible.setElementFiles,
      maxSlots: 2,
      allowTopologyMapRef: false,
    });
    expect(withoutFlag.selected).toEqual(['/fake/blanket-fold-object.png']);
    expect(withoutFlag.dropped).toContain('/fake/set-map.png');

    const withFlag = selectPageSetElementRefs({
      pagePlan: p6,
      pageShot: { page: 6, shot: 'medium_wide', angle: 'eye', rationale: 'test' },
      candidatePaths: candidates,
      setElementFiles: bundle.bible.setElementFiles,
      maxSlots: 2,
      allowTopologyMapRef: true,
    });
    expect(withFlag.selected).toContain('/fake/set-map.png');
    expect(withFlag.selected).toContain('/fake/blanket-fold-object.png');
  });

  it('close_up pages never receive composed map refs even when future flag is on', () => {
    const bundle = loadStoryLocationPlanOverride(LION_STORY)!;
    const enriched = enrichStoryLocationPlanWithReferenceSheets(bundle, LION_STORY);
    const p7 = enriched.pagePlans.find((p) => p.page === 7)!;
    const selection = selectPageSetElementRefs({
      pagePlan: p7,
      pageShot: { page: 7, shot: 'close_up', angle: 'eye', rationale: 'test' },
      candidatePaths: ['/fake/set-map.png', '/fake/blanket-fold-object.png'],
      setElementFiles: bundle.bible.setElementFiles,
      maxSlots: 2,
      allowTopologyMapRef: true,
    });
    expect(selection.selected).toEqual(['/fake/blanket-fold-object.png']);
    expect(selection.dropped).toContain('/fake/set-map.png');
    expect(selection.selected).not.toContain('/fake/set-map.png');
  });

  it('lion bedtime prompt has no fox/bucket staging strings', () => {
    const bundle = loadStoryLocationPlanOverride(LION_STORY)!;
    const p1 = bundle.pagePlans.find((p) => p.page === 1)!;
    const { prompt } = assembleStyle01Phase2Prompt({
      pageNumber: 1,
      pagePrompt: 'Night bedroom, collapsed pillow fort.',
      bookPageText: 'כבר היה לילה.',
      childFirstName: 'בר',
      childAge: 6,
      childGender: 'boy',
      childStructured: {
        face: 'Round face.',
        hair: 'Short hair.',
        body: 'Child build.',
        clothing: 'Pajamas.',
        signature: '',
      },
      companion: { id: 'lion_shaket', name: 'ליאו' },
      storyFile: 'lion_shaket_bedtime',
      direction: 'bedtime',
      storyTimeOfDay: 'night',
      pageLocationPlan: p1,
      locationBible: bundle.bible,
    });
    expect(prompt).toContain('SET TOPOLOGY LOCK');
    expect(prompt).not.toMatch(/fox sitting near bucket/i);
    expect(prompt).not.toMatch(/child \+ fox/i);
    expect(prompt).not.toMatch(/galvanized.*bucket/i);
    expect(prompt).not.toMatch(/WINDOW LEDGE DRIP/i);
  });
});
