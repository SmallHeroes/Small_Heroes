import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import {
  STORY_SOURCE_REVISION_PACKAGE_MIGRATION_EXCLUSIONS,
  prepareStorySourceRevisionPackageMigration,
  projectStorySourceEvidenceBindings,
} from '../storySourceRevisionPackageMigrationLifecycle';
import { canonicalContentAddressedJsonBytes } from '../canonicalContentAddressedJson';
import { resolveRepoPath } from '../integrity';

const REPO_ROOT = process.cwd();
const STORY_KEY = 'chameleon_koko_bedtime';
const STYLE_ID = 'soft_hand_drawn_storybook';
const HISTORICAL_PACKAGE_PATH =
  'visual-packages/approved/revisions/a9c253d989118262ed2b38a671fc7eccf6af44a084512af35285ad2f548a14fb.visual-package.json';
const HISTORICAL_PACKAGE_DIGEST =
  'a9c253d989118262ed2b38a671fc7eccf6af44a084512af35285ad2f548a14fb';
const CURRENT_LOCATOR_PATH =
  'visual-packages/approved/chameleon_koko_bedtime.soft_hand_drawn_storybook.visual-package-current.json';
const ACCEPTED_MANIFEST_PATH =
  'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/revisions/20a1280107a94ca0134c08351bc18565883ee358ce7ed1ca47ea797549bca1eb/manifest.json';

function prepare(outputDir: string, write = false) {
  const locatorPath = `${outputDir}-historical-locator-${process.pid}.json`;
  const locatorAbsolute = resolveRepoPath(REPO_ROOT, locatorPath);
  fs.mkdirSync(path.dirname(locatorAbsolute), { recursive: true });
  fs.writeFileSync(
    locatorAbsolute,
    `${JSON.stringify({
      version: 'visual-package-current-locator/v3',
      storyKey: STORY_KEY,
      styleId: STYLE_ID,
      packagePath: HISTORICAL_PACKAGE_PATH,
      revisionDigest: HISTORICAL_PACKAGE_DIGEST,
    }, null, 2)}\n`,
    'utf8',
  );
  try {
    return prepareStorySourceRevisionPackageMigration({
      repoRoot: REPO_ROOT,
      outputDir,
      storyKey: STORY_KEY,
      styleId: STYLE_ID,
      locatorPath,
      acceptedRevisionManifestPath: ACCEPTED_MANIFEST_PATH,
      write,
    });
  } finally {
    fs.unlinkSync(locatorAbsolute);
  }
}

describe('Story Source revision package migration phase 1', () => {
  it('builds a zero-spend complete bijection and pending reconciliation from current authorities', () => {
    const outputDir = 'outputs/qa-story-source-revision-package-migration-preview';
    const outputAbsolute = resolveRepoPath(REPO_ROOT, outputDir);
    expect(fs.existsSync(outputAbsolute)).toBe(false);

    const result = prepare(outputDir);

    expect(result.manifest.stage).toBe('reconciliation_pending');
    expect(result.manifest.sourcePackage.revisionDigest).toBe(
      'a9c253d989118262ed2b38a671fc7eccf6af44a084512af35285ad2f548a14fb',
    );
    expect(result.manifest.acceptedRevision.revisionDigest).toBe(
      '20a1280107a94ca0134c08351bc18565883ee358ce7ed1ca47ea797549bca1eb',
    );
    expect(result.manifest.acceptedRevision.productReviewDigest).toBe(
      '2a84d1785e771072b5601e6fe1c85f84bd793b1666c229239ae60b3064d38565',
    );
    expect(result.evidenceMap.entries).toHaveLength(92);
    expect(result.evidenceMap.entries.filter((entry) => entry.excerptChanged)).toHaveLength(12);
    expect(new Set(result.evidenceMap.entries.map((entry) => entry.oldSourceEvidenceId))).toHaveLength(92);
    expect(new Set(result.evidenceMap.entries.map((entry) => entry.newSourceEvidenceId))).toHaveLength(92);
    expect(result.evidenceMap.entries.every(
      (entry) => entry.oldSourceEvidenceId !== entry.newSourceEvidenceId,
    )).toBe(true);
    expect(result.manifest.projection.templateEvidenceOccurrenceCount).toBe(8);
    expect(result.manifest.projection.coverageRecordCount).toBe(98);
    expect(result.manifest.projection.sourcePackageEvidenceOccurrenceCount).toBe(155);
    expect(result.manifest.projection.changedDirectionPages).toEqual([6, 8]);
    expect(result.reviewBundle.readyForApproval).toBe(false);
    expect(result.reviewBundle.blockingIssues.map((issue) => issue.code)).toEqual([
      'reconciliation_incomplete',
    ]);
    expect(result.pendingReconciliation.review).toEqual({
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
    });
    expect(result.pendingReconciliation.presentationRequirementDispositions.entries.every(
      (entry) => entry.review.status === 'pending',
    )).toBe(true);
    expect(result.manifest.externalCounters).toEqual({
      providerCalls: 0,
      imageRenders: 0,
      audioRenders: 0,
      databaseWrites: 0,
      storageWrites: 0,
      locatorWrites: 0,
    });
    expect(result.manifest.doesNotAuthorize).toEqual(
      STORY_SOURCE_REVISION_PACKAGE_MIGRATION_EXCLUSIONS,
    );
    expect(fs.existsSync(outputAbsolute)).toBe(false);
  });

  it('updates only exact mapped source identities and phrases', () => {
    const result = prepare('outputs/qa-story-source-revision-package-migration-projection');
    const newCatalog = new Map(
      result.newSnapshot.content.sourceEvidenceCatalog.entries.map((entry) => [
        entry.sourceEvidenceId,
        entry,
      ]),
    );
    for (const record of result.migratedCoverage) {
      const entry = newCatalog.get(record.sourceEvidenceId);
      expect(entry?.pageNumber).toBe(record.pageNumber);
      expect(entry?.excerpt).toBe(record.sourcePhrase);
    }
    const oldIds = new Set(result.evidenceMap.entries.map((entry) => entry.oldSourceEvidenceId));
    expect(JSON.stringify(result.migratedTemplate)).not.toMatch(
      new RegExp([...oldIds][0]!),
    );
    const mapping = result.evidenceMap.entries[0]!;
    expect(() => projectStorySourceEvidenceBindings({
      evidenceMap: result.evidenceMap,
      value: {
        sourceEvidenceId: mapping.oldSourceEvidenceId,
        sourcePhrase: `${mapping.oldExcerpt} drift`,
      },
    })).toThrow('sourcePhrase is stale');
    expect(() => projectStorySourceEvidenceBindings({
      evidenceMap: result.evidenceMap,
      value: { sourceEvidenceId: 'se1_'.padEnd(68, '0') },
    })).toThrow('not in the old authority map');
  });

  it('rebinds the exact changed source text and directions while preserving reviewed beat topology', () => {
    const result = prepare('outputs/qa-story-source-revision-package-migration-reconciliation');
    const pageSix = result.pendingReconciliation.frames.find(
      (frame) => frame.frameKind === 'page' && frame.pageNumber === 6,
    );
    const pageEight = result.pendingReconciliation.frames.find(
      (frame) => frame.frameKind === 'page' && frame.pageNumber === 8,
    );
    expect(pageSix?.sourceRequirements.find(
      (requirement) => requirement.sourceKind === 'historical_image_direction',
    )?.sourceText).toContain("the child's backpack");
    expect(pageEight?.sourceRequirements.find(
      (requirement) => requirement.sourceKind === 'historical_image_direction',
    )?.sourceText).toContain('beside the child');
    expect(pageEight?.sourceRequirements.find(
      (requirement) => requirement.sourceKind === 'story_prose',
    )?.sourceText).toContain('{לידו|לידה}');
    expect(result.pendingReconciliation.frames.map((frame) => ({
      frameKind: frame.frameKind,
      pageNumber: frame.pageNumber,
      beatCount: frame.sourceRequirements.reduce(
        (count, requirement) => count + requirement.visualBeats.length,
        0,
      ),
    }))).toEqual([
      { frameKind: 'cover', pageNumber: 0, beatCount: 1 },
      { frameKind: 'page', pageNumber: 1, beatCount: 2 },
      { frameKind: 'page', pageNumber: 2, beatCount: 2 },
      { frameKind: 'page', pageNumber: 3, beatCount: 2 },
      { frameKind: 'page', pageNumber: 4, beatCount: 2 },
      { frameKind: 'page', pageNumber: 5, beatCount: 2 },
      { frameKind: 'page', pageNumber: 6, beatCount: 2 },
      { frameKind: 'page', pageNumber: 7, beatCount: 2 },
      { frameKind: 'page', pageNumber: 8, beatCount: 2 },
    ]);
  });

  it('writes immutable canonical evidence and replays without rewriting it', () => {
    const suffix = `${process.pid}-${Date.now()}`;
    const outputDir = `outputs/qa-story-source-revision-package-migration-${suffix}`;
    const outputAbsolute = resolveRepoPath(REPO_ROOT, outputDir);
    expect(outputAbsolute.startsWith(path.join(REPO_ROOT, 'outputs') + path.sep)).toBe(true);
    try {
      const first = prepare(outputDir, true);
      expect(first.artifacts.created).toBe(true);
      const manifestAbsolute = resolveRepoPath(REPO_ROOT, first.artifacts.manifestPath);
      expect(fs.readFileSync(manifestAbsolute, 'utf8')).toBe(
        canonicalContentAddressedJsonBytes(first.manifest),
      );
      const inventoryBefore = fs.readdirSync(outputAbsolute, { recursive: true })
        .map(String)
        .sort();
      const bytesBefore = fs.readFileSync(manifestAbsolute);

      const second = prepare(outputDir, true);
      expect(second.artifacts.created).toBe(false);
      expect(second.manifest.digest).toBe(first.manifest.digest);
      expect(fs.readFileSync(manifestAbsolute)).toEqual(bytesBefore);
      expect(fs.readdirSync(outputAbsolute, { recursive: true }).map(String).sort()).toEqual(
        inventoryBefore,
      );

      const evidenceMapAbsolute = resolveRepoPath(
        REPO_ROOT,
        first.manifest.evidenceMigration.mapPath,
      );
      fs.unlinkSync(manifestAbsolute);
      fs.appendFileSync(evidenceMapAbsolute, 'tamper', 'utf8');
      expect(() => prepare(outputDir, true)).toThrow(
        'migration output artifact conflicts with requested immutable bytes',
      );
      expect(fs.existsSync(manifestAbsolute)).toBe(false);
    } finally {
      if (fs.existsSync(outputAbsolute)) {
        const resolved = path.resolve(outputAbsolute);
        if (!resolved.startsWith(path.join(REPO_ROOT, 'outputs') + path.sep)) {
          throw new Error('test cleanup escaped outputs root');
        }
        fs.rmSync(resolved, { recursive: true, force: true });
      }
    }
  });

  it('rejects a cross-story or noncanonical accepted revision path before projection', () => {
    expect(() => prepareStorySourceRevisionPackageMigration({
      repoRoot: REPO_ROOT,
      outputDir: 'outputs/qa-story-source-revision-package-migration-hostile',
      storyKey: STORY_KEY,
      styleId: STYLE_ID,
      locatorPath: CURRENT_LOCATOR_PATH,
      acceptedRevisionManifestPath: ACCEPTED_MANIFEST_PATH.replace(
        '/chameleon_koko_bedtime/',
        '/bunny_ometz_bedtime/',
      ),
      write: false,
    })).toThrow('not canonical for the story');
    expect(() => prepareStorySourceRevisionPackageMigration({
      repoRoot: REPO_ROOT,
      outputDir: 'outputs/qa-story-source-revision-package-migration-hostile',
      storyKey: STORY_KEY,
      styleId: STYLE_ID,
      locatorPath: CURRENT_LOCATOR_PATH,
      acceptedRevisionManifestPath: ACCEPTED_MANIFEST_PATH.split('/').join('\\'),
      write: false,
    })).toThrow('not canonical for the story');
    expect(() => prepareStorySourceRevisionPackageMigration({
      repoRoot: REPO_ROOT,
      outputDir: 'visual-packages/hostile-output',
      storyKey: STORY_KEY,
      styleId: STYLE_ID,
      locatorPath: CURRENT_LOCATOR_PATH,
      acceptedRevisionManifestPath: ACCEPTED_MANIFEST_PATH,
      write: false,
    })).toThrow('canonical child of outputs');

    const valid = prepare('outputs/qa-story-source-revision-package-migration-map-tamper');
    const staleMap = structuredClone(valid.evidenceMap);
    staleMap.entries[0]!.newExcerpt += ' tamper';
    expect(() => projectStorySourceEvidenceBindings({
      evidenceMap: staleMap,
      value: {},
    })).toThrow('map is stale or malformed');
  });
});
