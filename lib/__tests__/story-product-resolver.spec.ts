/**
 * Order product source-of-truth: direction/pages/price must come from the
 * story that will actually be served — never from a silent fallback.
 * Point-of-sale integrity: client direction is NEVER overridden by a v3 binding.
 * Canonical BEAT counts (2026-06-10): bedtime=8, adventure=12, fantasy=16;
 * customer display = beats × 2 physical pages (displayPages).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resolveStoryProductTruth,
  StoryProductResolutionError,
} from '../../backend/providers/story-product-resolver';
import { allMvpCategories, companionForCategory, isSlotSellable } from '../../backend/config/mvp-story-matrix';

const V3_APPROVED_DIR = path.join(process.cwd(), 'story-bank', 'v3-approved');
const QA_AUTONOMOUS_DIR = path.join(
  process.cwd(),
  'story-bank',
  'qa-autonomous-20260815-v1',
);
const CHAMELEON_LEGACY_REVISION = path.join(
  process.cwd(),
  'story-pipeline',
  '04_approved_story_sources',
  'accepted',
  'chameleon_koko_bedtime',
  'revisions',
  '20a1280107a94ca0134c08351bc18565883ee358ce7ed1ca47ea797549bca1eb',
  'integrated.md',
);
const CHAMELEON_PRODUCT_REVISION = path.join(
  process.cwd(),
  'story-pipeline',
  '04_approved_story_sources',
  'accepted',
  'chameleon_koko_bedtime',
  'revisions',
  '3ef645415b3cdd5945baeaa275d97ae0aa0491bf30addbcc46208475278f534a',
  'integrated.md',
);
const CHAMELEON_PACKAGE_REVISION_DIGEST =
  '836a3414174dbe3060010371e81ebdbef821f705650a199cc4bbfd70081d523f';
const CHAMELEON_PACKAGE_LOCATOR_RELATIVE_PATH = path.join(
  'visual-packages',
  'approved',
  'chameleon_koko_bedtime.soft_hand_drawn_storybook.visual-package-current.json',
);
const BUNNY_BEDTIME = path.join(V3_APPROVED_DIR, 'bunny_ometz_bedtime.md');

const originalFlag = process.env.ENABLE_V3_APPROVED_BANK;
const originalQaFlag = process.env.ENABLE_WIZARD_QA_RENDER_CATALOG;
// Only delete the fixture if WE created it (a real import may land here later).
let createdFixture = false;
const temporaryRoots: string[] = [];

function productLineageRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'product-lineage-resolver-'));
  temporaryRoots.push(root);
  const relative = path.join(
    'story-pipeline',
    '04_approved_story_sources',
    'accepted',
    'chameleon_koko_bedtime',
  );
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(path.join(process.cwd(), relative), target, { recursive: true });
  return root;
}

function copyCurrentChameleonPackage(root: string): void {
  for (const relativePath of [
    CHAMELEON_PACKAGE_LOCATOR_RELATIVE_PATH,
    path.join(
      'visual-packages',
      'approved',
      'revisions',
      `${CHAMELEON_PACKAGE_REVISION_DIGEST}.visual-package.json`,
    ),
  ]) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(process.cwd(), relativePath), target);
  }
}

function writeBunnyFixture(pages: number, direction = 'bedtime') {
  fs.mkdirSync(V3_APPROVED_DIR, { recursive: true });
  fs.writeFileSync(
    BUNNY_BEDTIME,
    `---\ntitle: "באני fixture"\ncompanionId: bunny_ometz\ndirection: ${direction}\npages: ${pages}\n---\n--- Page 1 ---\nimageDirection: x\nשלום\n`,
    'utf8'
  );
}

describe('resolveStoryProductTruth', () => {
  beforeEach(() => {
    createdFixture = !fs.existsSync(BUNNY_BEDTIME);
  });

  afterEach(() => {
    if (createdFixture && fs.existsSync(BUNNY_BEDTIME)) fs.unlinkSync(BUNNY_BEDTIME);
    if (originalFlag === undefined) delete process.env.ENABLE_V3_APPROVED_BANK;
    else process.env.ENABLE_V3_APPROVED_BANK = originalFlag;
    if (originalQaFlag === undefined) delete process.env.ENABLE_WIZARD_QA_RENDER_CATALOG;
    else process.env.ENABLE_WIZARD_QA_RENDER_CATALOG = originalQaFlag;
    for (const root of temporaryRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('client adventure + bunny (v3 adventure binding) → v3 adventure, NOT bedtime override', () => {
    process.env.ENABLE_V3_APPROVED_BANK = 'true';
    if (createdFixture) writeBunnyFixture(8);

    const resolved = resolveStoryProductTruth({
      companionId: 'bunny_ometz',
      clientDirection: 'adventure',
    });
    expect(resolved.storyDirection).toBe('adventure');
    expect(resolved.storyLength).toBe('medium');
    expect(resolved.priceILS).toBe(79);
    expect(resolved.source).toBe('v3_approved_binding');
    expect(resolved.visualPackageAuthority).toBeUndefined();
  });

  it('client bedtime + bunny → v3 bedtime binding preserved', () => {
    process.env.ENABLE_V3_APPROVED_BANK = 'true';
    if (createdFixture) writeBunnyFixture(8);

    const resolved = resolveStoryProductTruth({
      companionId: 'bunny_ometz',
      clientDirection: 'bedtime',
    });
    expect(resolved.storyDirection).toBe('bedtime');
    expect(resolved.storyLength).toBe('short');
    expect(resolved.pages).toBe(8);
    expect(resolved.displayPages).toBe(16);
    expect(resolved.priceILS).toBe(59);
    expect(resolved.source).toBe('v3_approved_binding');
    expect(resolved.visualPackageAuthority).toBeUndefined();
  });

  it('guard: sellable matrix combos never change direction between request and response', () => {
    process.env.ENABLE_V3_APPROVED_BANK = 'true';
    if (createdFixture) writeBunnyFixture(8);

    const directions = ['bedtime', 'adventure', 'fantasy'] as const;
    for (const category of allMvpCategories()) {
      for (const direction of directions) {
        if (!isSlotSellable(category, direction)) continue;
        const companionId = companionForCategory(category);
        if (!companionId) continue;
        const resolved = resolveStoryProductTruth({
          companionId,
          clientDirection: direction,
          challengeCategory: category,
        });
        expect(resolved.storyDirection).toBe(direction);
        const isPublishedChameleon =
          companionId === 'chameleon_koko' && direction === 'bedtime';
        expect(resolved.source).toBe(
          isPublishedChameleon
            ? 'visual_package_v4'
            : 'v3_approved_binding',
        );
        expect(resolved.storyFile).toBe(
          isPublishedChameleon
            ? CHAMELEON_PRODUCT_REVISION
            : path.join(V3_APPROVED_DIR, `${companionId}_${direction}.md`),
        );
      }
    }
  });

  it('serves the exact current product package for an accepted lineage and never its legacy predecessor', () => {
    delete process.env.ENABLE_V3_APPROVED_BANK;
    delete process.env.ENABLE_WIZARD_QA_RENDER_CATALOG;

    const resolved = resolveStoryProductTruth({
      challengeCategory: 'TRANSITION',
      companionId: 'chameleon_koko',
      clientDirection: 'bedtime',
    });

    expect(resolved).toMatchObject({
      source: 'visual_package_v4',
      storyDirection: 'bedtime',
      pages: 8,
      displayPages: 16,
      priceILS: 59,
      storyFile: CHAMELEON_PRODUCT_REVISION,
      visualPackageAuthority: {
        version: 'frozen-visual-package-authority/v3',
        packageRevisionDigest: CHAMELEON_PACKAGE_REVISION_DIGEST,
        blueprintDigest:
          '97fad2ac1499c6b578087771f614d474972b3c1f2f7153b3321c59c3f87bbdce',
        sourcePath:
          'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/revisions/3ef645415b3cdd5945baeaa275d97ae0aa0491bf30addbcc46208475278f534a/integrated.md',
      },
    });
    expect(resolved.storyFile).not.toBe(CHAMELEON_LEGACY_REVISION);
    expect(CHAMELEON_LEGACY_REVISION).not.toBe(CHAMELEON_PRODUCT_REVISION);
  });

  it('never selects a Style 01 package for an Order requesting another illustration style', () => {
    process.env.ENABLE_V3_APPROVED_BANK = 'true';
    expect(() =>
      resolveStoryProductTruth({
        challengeCategory: 'TRANSITION',
        companionId: 'chameleon_koko',
        clientDirection: 'bedtime',
        illustrationStyle: 'detailed_whimsical_world',
      }),
    ).toThrow('requires an exact render-qualified Visual Package');
  });

  it('does not let v3 or QA flags reopen fallback when a product-accepted lineage has no package', () => {
    process.env.ENABLE_V3_APPROVED_BANK = 'true';
    process.env.ENABLE_WIZARD_QA_RENDER_CATALOG = 'true';
    const repoRoot = productLineageRoot();

    let caught: unknown = null;
    try {
      resolveStoryProductTruth(
        {
          challengeCategory: 'TRANSITION',
          companionId: 'chameleon_koko',
          clientDirection: 'bedtime',
        },
        { repoRoot },
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(StoryProductResolutionError);
    expect((caught as StoryProductResolutionError).httpStatus).toBe(422);
    expect(String((caught as Error).message)).not.toContain('v3-approved');

    const malformedRoot = productLineageRoot();
    const acceptancePath = path.join(
      malformedRoot,
      'story-pipeline',
      '04_approved_story_sources',
      'accepted',
      'chameleon_koko_bedtime',
      'revisions',
      '3ef645415b3cdd5945baeaa275d97ae0aa0491bf30addbcc46208475278f534a',
      'product-acceptance.json',
    );
    const linkedSource = path.join(malformedRoot, 'linked-acceptance.json');
    fs.renameSync(acceptancePath, linkedSource);
    fs.linkSync(linkedSource, acceptancePath);
    expect(() =>
      resolveStoryProductTruth(
        {
          challengeCategory: 'TRANSITION',
          companionId: 'chameleon_koko',
          clientDirection: 'bedtime',
        },
        { repoRoot: malformedRoot },
      ),
    ).toThrow('requires an exact render-qualified Visual Package');

    const tamperedPackageRoot = productLineageRoot();
    copyCurrentChameleonPackage(tamperedPackageRoot);
    expect(
      resolveStoryProductTruth(
        {
          challengeCategory: 'TRANSITION',
          companionId: 'chameleon_koko',
          clientDirection: 'bedtime',
        },
        { repoRoot: tamperedPackageRoot },
      ).visualPackageAuthority?.packageRevisionDigest,
    ).toBe(CHAMELEON_PACKAGE_REVISION_DIGEST);
    const locator = JSON.parse(
      fs.readFileSync(
        path.join(tamperedPackageRoot, CHAMELEON_PACKAGE_LOCATOR_RELATIVE_PATH),
        'utf8',
      ),
    ) as Record<string, unknown>;
    locator.hostileExtraKey = true;
    const tamperedLocatorPath = path.join(
      tamperedPackageRoot,
      CHAMELEON_PACKAGE_LOCATOR_RELATIVE_PATH,
    );
    fs.mkdirSync(path.dirname(tamperedLocatorPath), { recursive: true });
    fs.writeFileSync(
      tamperedLocatorPath,
      `${JSON.stringify(locator, null, 2)}\n`,
      'utf8',
    );
    expect(() =>
      resolveStoryProductTruth(
        {
          challengeCategory: 'TRANSITION',
          companionId: 'chameleon_koko',
          clientDirection: 'bedtime',
        },
        { repoRoot: tamperedPackageRoot },
      ),
    ).toThrow('requires an exact render-qualified Visual Package');
  });

  it('never selects a legacy story from process cwd when an explicit repository root is empty', () => {
    process.env.ENABLE_V3_APPROVED_BANK = 'true';
    const repoRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'legacy-resolver-root-'),
    );
    temporaryRoots.push(repoRoot);
    expect(() =>
      resolveStoryProductTruth(
        {
          companionId: 'bunny_ometz',
          clientDirection: 'bedtime',
        },
        { repoRoot },
      ),
    ).toThrow('No bank story for companion=bunny_ometz direction=bedtime');
  });

  it('QA flag binds all sellable slots to the autonomous QA bank with canonical page counts', () => {
    process.env.ENABLE_WIZARD_QA_RENDER_CATALOG = 'true';
    const expectedPages = { bedtime: 8, adventure: 12, fantasy: 16 } as const;

    for (const category of allMvpCategories()) {
      for (const direction of Object.keys(expectedPages) as Array<keyof typeof expectedPages>) {
        if (!isSlotSellable(category, direction)) continue;
        const companionId = companionForCategory(category);
        if (!companionId) continue;
        const resolved = resolveStoryProductTruth({
          companionId,
          clientDirection: direction,
          challengeCategory: category,
        });
        const isPublishedChameleon =
          companionId === 'chameleon_koko' && direction === 'bedtime';
        expect(resolved.storyFile).toBe(
          isPublishedChameleon
            ? CHAMELEON_PRODUCT_REVISION
            : path.join(QA_AUTONOMOUS_DIR, `${companionId}_${direction}.md`),
        );
        expect(resolved.pages).toBe(expectedPages[direction]);
        expect(resolved.displayPages).toBe(expectedPages[direction] * 2);
      }
    }
  });

  it('flag OFF: v3-approved file is ignored, client direction resolves via companion golden', () => {
    delete process.env.ENABLE_V3_APPROVED_BANK;
    if (createdFixture) writeBunnyFixture(8);

    const resolved = resolveStoryProductTruth({
      companionId: 'bunny_ometz',
      clientDirection: 'adventure',
    });
    expect(resolved.storyDirection).toBe('adventure');
    expect(resolved.priceILS).toBe(79);
    expect(resolved.source).toBe('companion_golden');
    expect(resolved.visualPackageAuthority).toBeUndefined();
  });

  it('v3 binding with mismatched pages frontmatter fails loudly (500) — old 10-beat bedtime rejected', () => {
    process.env.ENABLE_V3_APPROVED_BANK = 'true';
    if (!createdFixture) return; // never overwrite a real import
    writeBunnyFixture(10);

    expect(() =>
      resolveStoryProductTruth({ companionId: 'bunny_ometz', clientDirection: 'bedtime' })
    ).toThrowError(StoryProductResolutionError);
  });

  it('missing direction with no derivable story fails loudly (400) — no adventure guess', () => {
    delete process.env.ENABLE_V3_APPROVED_BANK;
    let caught: unknown = null;
    try {
      resolveStoryProductTruth({ companionId: null, clientDirection: null });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(StoryProductResolutionError);
    expect((caught as StoryProductResolutionError).httpStatus).toBe(400);
  });

  it('legacy product.length still maps (short → bedtime/59)', () => {
    delete process.env.ENABLE_V3_APPROVED_BANK;
    const resolved = resolveStoryProductTruth({ legacyLength: 'short' });
    expect(resolved.storyDirection).toBe('bedtime');
    expect(resolved.priceILS).toBe(59);
    expect(resolved.source).toBe('legacy_length');
    expect(resolved.visualPackageAuthority).toBeUndefined();
  });

  it('non-canonical frontmatter: pages follow the served story, dev warning fires (launch-routing guard)', () => {
    delete process.env.ENABLE_V3_APPROVED_BANK;
    // Templated v5 adventure files with pages=15 (old rule) deviate from the
    // new canonical 12 beats — they must resolve to their ACTUAL count and warn.
    const v5Dir = path.join(
      process.cwd(),
      'story-bank',
      (process.env.STORY_BANK_V3_DIR || 'v5-fixed-v2').trim()
    );
    const samples = fs
      .readdirSync(v5Dir)
      .filter((f) => /_adventure\.md$/.test(f) && /^pages:\s*15\s*$/m.test(fs.readFileSync(path.join(v5Dir, f), 'utf8')));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // Not every bank file belongs to a servable (active) companion — find
      // one the selector actually binds.
      let resolved = null;
      for (const sample of samples) {
        try {
          resolved = resolveStoryProductTruth({
            companionId: sample.replace(/_adventure\.md$/, ''),
            clientDirection: 'adventure',
          });
          break;
        } catch {
          /* companion not servable — try the next file */
        }
      }
      if (!resolved) return; // bank normalized / no servable deviating story
      expect(resolved.pages).toBe(15); // frontmatter truth — served as-is
      expect(resolved.displayPages).toBe(30);
      expect(resolved.priceILS).toBe(79); // price stays on the table
      expect(
        warnSpy.mock.calls.some((args) => String(args[0]).includes('non-canonical story bound'))
      ).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('canonical frontmatter (12-beat adventure) binds without a warning', () => {
    delete process.env.ENABLE_V3_APPROVED_BANK;
    const v5Dir = path.join(
      process.cwd(),
      'story-bank',
      (process.env.STORY_BANK_V3_DIR || 'v5-fixed-v2').trim()
    );
    const sample = fs
      .readdirSync(v5Dir)
      .find((f) => /_adventure\.md$/.test(f) && /^pages:\s*12\s*$/m.test(fs.readFileSync(path.join(v5Dir, f), 'utf8')));
    if (!sample) return;
    const companionId = sample.replace(/_adventure\.md$/, '');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const resolved = resolveStoryProductTruth({ companionId, clientDirection: 'adventure' });
      expect(resolved.pages).toBe(12);
      expect(resolved.displayPages).toBe(24);
      expect(
        warnSpy.mock.calls.some((args) => String(args[0]).includes('non-canonical story bound'))
      ).toBe(false);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
