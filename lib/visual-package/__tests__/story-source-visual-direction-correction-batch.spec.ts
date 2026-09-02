import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { canonicalHash } from '@/lib/canonical-json';
import {
  DEFAULT_STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_PLAN_PATH,
  STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_BATCH_VERSION,
  STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_PLAN_VERSION,
  correctionCanonicalJsonBytes,
  materializeStorySourceVisualDirectionCorrectionCandidate,
  prepareStorySourceVisualDirectionCorrectionBatch,
  validateStorySourceVisualDirectionCorrectionCandidateManifest,
  validateStorySourceVisualDirectionCorrectionPlan,
  validateStorySourceVisualDirectionCorrectionPlanBindings,
  type StorySourceVisualDirectionCorrectionPlan,
} from '@/lib/visual-package/storySourceVisualDirectionCorrectionBatch';
import {
  prepareStorySourceVisualDirectionReviewBatch,
  type StorySourceVisualDirectionReviewBatch,
} from '@/lib/visual-package/storySourceVisualDirectionReviewBatch';

const REPO = process.cwd();
const require = createRequire(import.meta.url);
const TEST_OUTPUT_PREFIX = 'outputs/r3b1a-correction-batch-vitest-';
const PUBLICATION_LOCK = path.join(
  REPO,
  '.r3b1a-story-source-correction-publication.lock',
);
const ownedOutputRoots = new Set<string>();
let reviewBatch: StorySourceVisualDirectionReviewBatch;
let reviewRawSha256: string;
let planValue: StorySourceVisualDirectionCorrectionPlan;

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function absoluteRepoPath(relativePath: string): string {
  return path.resolve(REPO, ...relativePath.split('/'));
}

function newOutputRoot(): string {
  const relative = `${TEST_OUTPUT_PREFIX}${randomUUID()}`;
  ownedOutputRoots.add(relative);
  return relative;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function resealPlan(
  value: StorySourceVisualDirectionCorrectionPlan & Record<string, unknown>,
): void {
  const { digest: _digest, ...payload } = value;
  value.digest = canonicalHash(payload);
}

function allRelativeFiles(root: string): string[] {
  const result: string[] = [];
  const walk = (directory: string, prefix: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(absolute, relative);
      else result.push(relative);
    }
  };
  walk(root, '');
  return result.sort();
}

beforeAll(() => {
  reviewBatch = prepareStorySourceVisualDirectionReviewBatch({
    repoRoot: REPO,
    write: false,
  }).batch;
  reviewRawSha256 = sha256(correctionCanonicalJsonBytes(reviewBatch));
  planValue = JSON.parse(
    fs.readFileSync(
      absoluteRepoPath(
        DEFAULT_STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_PLAN_PATH,
      ),
      'utf8',
    ),
  ) as StorySourceVisualDirectionCorrectionPlan;
});

afterAll(() => {
  for (const relative of ownedOutputRoots) {
    if (!relative.startsWith(TEST_OUTPUT_PREFIX)) {
      throw new Error('refused to clean a non-test output root');
    }
    const absolute = absoluteRepoPath(relative);
    if (fs.existsSync(absolute)) fs.rmSync(absolute, { recursive: true });
  }
});

describe('R3-B1a story-source / visual-direction correction candidates', () => {
  it('binds one canonical proposal to the exact 17-record R3-B0b authority graph', () => {
    const pageCountByStory = new Map(
      reviewBatch.records.map((record) => [record.storyKey, record.pageCount]),
    );
    const validated = validateStorySourceVisualDirectionCorrectionPlan(
      planValue,
      pageCountByStory,
    );
    expect(validated.version).toBe(
      STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_PLAN_VERSION,
    );
    expect(validated.records).toHaveLength(17);
    expect(validated.records.map((record) => record.storyKey)).toEqual(
      reviewBatch.records.map((record) => record.storyKey),
    );
    expect(() =>
      validateStorySourceVisualDirectionCorrectionPlanBindings({
        batch: reviewBatch,
        plan: validated,
        reviewRawSha256,
      }),
    ).not.toThrow();
  });

  it(
    'dry-runs all 17 and 208 pages without creating the output root',
    () => {
      const outputRoot = newOutputRoot();
      const prepared = prepareStorySourceVisualDirectionCorrectionBatch({
        repoRoot: REPO,
        outputRoot,
        write: false,
      });
      expect(prepared.batch.version).toBe(
        STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_BATCH_VERSION,
      );
      expect(prepared.batch.summary).toMatchObject({
        candidateCount: 17,
        totalPageCount: 208,
        directionCounts: { bedtime: 5, adventure: 6, fantasy: 6 },
        neutralSourceCandidateCount: 17,
        femaleProseIdentityCount: 17,
        resolvedBoyProjectionCount: 17,
        resolvedGirlProjectionCount: 17,
        compositionValidCount: 17,
        singularEnglishGenderPronounCount: 0,
        holdRecordCount: 9,
        pendingExactReviewRecordCount: 8,
        unresolvedCreativeSourceIssueCount: 13,
        protectedAuthorityIssueCount: 1,
        criticalNarrationReviewItemCount: 7,
        softNarrationReviewItemCount: 24,
        narrationEarAcceptedCount: 0,
        strictRenderReadyCount: 0,
      });
      expect(prepared.batch.records).toHaveLength(17);
      expect(prepared.batch.policies).toEqual(
        prepared.batch.records[0]?.policies,
      );
      expect(prepared.artifact.path).toBe(
        `${outputRoot}/${prepared.batch.digest}.json`,
      );
      expect(
        prepared.batch.records.every(
          (record) =>
            record.runtimeEligible === false &&
            record.productionEligible === false &&
            record.invariants.femaleProseByteIdentical &&
            record.invariants.boyProjectionResolved &&
            record.invariants.girlProjectionResolved &&
            record.invariants.compositionValid &&
            record.invariants.singularEnglishGenderPronouns === 0,
        ),
      ).toBe(true);
      expect(prepared.artifact).toMatchObject({ created: false, fileCount: 1 });
      expect(fs.existsSync(absoluteRepoPath(outputRoot))).toBe(false);
    },
    120_000,
  );

  it(
    'atomically writes one closed artifact, replays it, and rejects hardlink/byte collisions',
    () => {
      const outputRoot = newOutputRoot();
      const first = prepareStorySourceVisualDirectionCorrectionBatch({
        repoRoot: REPO,
        outputRoot,
        write: true,
      });
      expect(first.artifact.created).toBe(true);
      const finalRoot = path.dirname(absoluteRepoPath(first.artifact.path));
      expect(allRelativeFiles(finalRoot)).toHaveLength(1);

      const replay = prepareStorySourceVisualDirectionCorrectionBatch({
        repoRoot: REPO,
        outputRoot,
        write: true,
      });
      expect(replay.artifact.created).toBe(false);
      expect(correctionCanonicalJsonBytes(replay.batch)).toBe(
        correctionCanonicalJsonBytes(first.batch),
      );

      const batchPath = absoluteRepoPath(first.artifact.path);
      const hardlinkPath = path.join(finalRoot, 'unexpected-hardlink.json');
      fs.linkSync(batchPath, hardlinkPath);
      expect(() =>
        prepareStorySourceVisualDirectionCorrectionBatch({
          repoRoot: REPO,
          outputRoot,
          write: true,
        }),
      ).toThrow(/identity|collision/);
      fs.unlinkSync(hardlinkPath);

      fs.appendFileSync(batchPath, ' ');
      expect(() =>
        prepareStorySourceVisualDirectionCorrectionBatch({
          repoRoot: REPO,
          outputRoot,
          write: true,
        }),
      ).toThrow(/identity|bytes differ/);
    },
    180_000,
  );

  it(
    'fails closed when another correction publication transaction owns the lock',
    () => {
      const outputRoot = newOutputRoot();
      expect(fs.existsSync(PUBLICATION_LOCK)).toBe(false);
      fs.writeFileSync(PUBLICATION_LOCK, 'owned-by-concurrency-test\n', {
        flag: 'wx',
      });
      try {
        expect(() =>
          prepareStorySourceVisualDirectionCorrectionBatch({
            repoRoot: REPO,
            outputRoot,
            write: true,
          }),
        ).toThrow('another correction publication transaction is active');
        expect(fs.existsSync(absoluteRepoPath(outputRoot))).toBe(false);
      } finally {
        fs.unlinkSync(PUBLICATION_LOCK);
      }
    },
    120_000,
  );

  it(
    'materializes one selected record into the existing revision lifecycle without accepting it',
    () => {
      const outputRoot = newOutputRoot();
      const dry = materializeStorySourceVisualDirectionCorrectionCandidate({
        repoRoot: REPO,
        storyKey: 'bunny_ometz_adventure',
        outputRoot,
        write: false,
      });
      expect(dry).toMatchObject({
        storyKey: 'bunny_ometz_adventure',
        status: 'pending_exact_product_review',
        recordDisposition: 'pending_exact_product_and_visual_review',
        runtimeEligible: false,
        productionEligible: false,
        created: false,
        fileCount: 6,
      });
      expect(fs.existsSync(absoluteRepoPath(outputRoot))).toBe(false);

      const written = materializeStorySourceVisualDirectionCorrectionCandidate({
        repoRoot: REPO,
        storyKey: 'bunny_ometz_adventure',
        outputRoot,
        write: true,
      });
      expect(written.created).toBe(true);
      const lifecycle = require('../../../scripts/story-source-revision-lifecycle.cjs') as {
        loadPendingRevision: (
          pendingManifestPath: string,
          roots?: { repoRoot?: string },
        ) => { pending: { storyKey: string; version: string } };
        prepareReview: (
          args: {
            pendingManifestPath: string;
            technicalReviewPath: string;
            outputDir: string;
            write: boolean;
          },
          roots?: { repoRoot?: string },
        ) => unknown;
        promoteRevision: (
          args: {
            pendingManifestPath: string;
            reviewBundlePath: string;
            acceptancePath: string;
            write: boolean;
          },
          roots?: { repoRoot?: string },
        ) => unknown;
      };
      expect(
        lifecycle.loadPendingRevision(written.pendingManifestPath, {
          repoRoot: REPO,
        }).pending,
      ).toMatchObject({
        storyKey: 'bunny_ometz_adventure',
        version: 'small-heroes-story-source-visual-direction-correction-pending-manifest/v1',
      });
      expect(() =>
        lifecycle.prepareReview(
          {
            pendingManifestPath: written.pendingManifestPath,
            technicalReviewPath: 'intentionally-not-read.json',
            outputDir: 'outputs/intentionally-not-created',
            write: false,
          },
          { repoRoot: REPO },
        ),
      ).toThrow('story_source_visual_direction_correction_review_not_implemented');
      expect(() =>
        lifecycle.promoteRevision(
          {
            pendingManifestPath: written.pendingManifestPath,
            reviewBundlePath: 'intentionally-not-read.json',
            acceptancePath: 'intentionally-not-read.json',
            write: false,
          },
          { repoRoot: REPO },
        ),
      ).toThrow('story_source_visual_direction_correction_promotion_not_implemented');

      const replay = materializeStorySourceVisualDirectionCorrectionCandidate({
        repoRoot: REPO,
        storyKey: 'bunny_ometz_adventure',
        outputRoot,
        write: true,
      });
      expect(replay.created).toBe(false);
      expect(replay.pendingManifestPath).toBe(written.pendingManifestPath);
    },
    120_000,
  );

  it('rejects hidden acceptance, reordered membership, and source-record swaps', () => {
    const pageCountByStory = new Map(
      reviewBatch.records.map((record) => [record.storyKey, record.pageCount]),
    );

    const hiddenAcceptance = clone(planValue) as StorySourceVisualDirectionCorrectionPlan &
      Record<string, unknown>;
    (hiddenAcceptance.records[0] as unknown as Record<string, unknown>).approved =
      true;
    resealPlan(hiddenAcceptance);
    expect(() =>
      validateStorySourceVisualDirectionCorrectionPlan(
        hiddenAcceptance,
        pageCountByStory,
      ),
    ).toThrow(/unexpected shape/);

    const reordered = clone(planValue) as StorySourceVisualDirectionCorrectionPlan &
      Record<string, unknown>;
    [reordered.records[0], reordered.records[1]] = [
      reordered.records[1],
      reordered.records[0],
    ];
    resealPlan(reordered);
    expect(() =>
      validateStorySourceVisualDirectionCorrectionPlan(
        reordered,
        pageCountByStory,
      ),
    ).toThrow(/ASCII-sorted/);

    const swapped = clone(planValue) as StorySourceVisualDirectionCorrectionPlan &
      Record<string, unknown>;
    [swapped.records[0].acceptedStory, swapped.records[1].acceptedStory] = [
      swapped.records[1].acceptedStory,
      swapped.records[0].acceptedStory,
    ];
    resealPlan(swapped);
    const validatedSwap = validateStorySourceVisualDirectionCorrectionPlan(
      swapped,
      pageCountByStory,
    );
    expect(() =>
      validateStorySourceVisualDirectionCorrectionPlanBindings({
        batch: reviewBatch,
        plan: validatedSwap,
        reviewRawSha256,
      }),
    ).toThrow(/plan-to-review binding/);
  });

  it('rejects deep provenance drift and authority fields from the untyped materializer result', () => {
    const prepared = prepareStorySourceVisualDirectionCorrectionBatch({
      repoRoot: REPO,
      outputRoot: newOutputRoot(),
      write: false,
    });
    const candidate = prepared.batch.records[0];
    const planRecord = planValue.records[0];
    const reviewRecord = reviewBatch.records[0];
    expect(candidate).toBeDefined();
    expect(planRecord).toBeDefined();
    expect(reviewRecord).toBeDefined();
    if (!candidate || !planRecord || !reviewRecord) {
      throw new Error('fixture record is missing');
    }
    // The validator first proves the request bytes. Reconstruct its exact sorted
    // representation from the embedded payload via a local CJS import.
    const materializer = require('../../../scripts/materialize-story-source-revision.cjs') as {
      canonicalBytes: (value: unknown) => string;
      applyExactTextReplacements: (
        source: string,
        replacements: unknown[],
        code: string,
      ) => string;
      applyDirectionReplacements: (
        record: Record<string, unknown>,
        replacements: unknown[],
      ) => Record<string, unknown>;
      resolveProjection: (source: string, gender: 'boy' | 'girl') => string;
      stripCanonicalSourceGenderLine: (
        source: string,
        gender: 'neutral',
      ) => string;
    };
    const integration = require('../../../scripts/story-bank-direction-integration.cjs') as {
      injectDirections: (
        source: string,
        record: Record<string, unknown>,
      ) => string;
    };
    const canonicalRequestBytes = Buffer.from(
      materializer.canonicalBytes(candidate.request.payload),
      'utf8',
    );
    const files = {
      source: candidate.candidateOutputs.acceptedStory.filename,
      direction: candidate.candidateOutputs.visualDirection.filename,
      integratedStory: candidate.candidateOutputs.integratedStory.filename,
      migration: candidate.candidateOutputs.directionMigration.filename,
      manifest: candidate.candidateOutputs.manifest.filename,
    };
    const requestFile = {
      bytes: canonicalRequestBytes,
      relativePath: candidate.request.identityPath,
      request: candidate.request.payload,
      sha256: candidate.request.sha256,
    };
    const revisedSource = materializer.applyExactTextReplacements(
      fs.readFileSync(absoluteRepoPath(planRecord.acceptedStory.path), 'utf8'),
      planRecord.textReplacements,
      'test_target_invalid',
    );
    const revisedDirection = materializer.applyDirectionReplacements(
      JSON.parse(
        fs.readFileSync(
          absoluteRepoPath(planRecord.visualDirection.path),
          'utf8',
        ),
      ) as Record<string, unknown>,
      planRecord.directionReplacements,
    );
    const girlProjection = materializer.resolveProjection(revisedSource, 'girl');
    const expected = {
      inputs: {
        acceptedManifest: {
          path: reviewRecord.authorityChain.acceptedManifest.path,
          bytes: reviewRecord.authorityChain.acceptedManifest.bytes,
          sha256: reviewRecord.authorityChain.acceptedManifest.rawSha256,
        },
        acceptedStory: {
          path: reviewRecord.authorityChain.acceptedStory.path,
          bytes: reviewRecord.authorityChain.acceptedStory.bytes,
          sha256: reviewRecord.authorityChain.acceptedStory.rawSha256,
        },
        visualDirections: {
          path: reviewRecord.authorityChain.visualDirection.path,
          bytes: reviewRecord.authorityChain.visualDirection.bytes,
          sha256: reviewRecord.authorityChain.visualDirection.rawSha256,
        },
        storyboardCorpusManifest: {
          path: reviewBatch.selection.storyboardCorpus.path,
          bytes: reviewBatch.selection.storyboardCorpus.bytes,
          sha256: reviewBatch.selection.storyboardCorpus.rawSha256,
          digest: reviewBatch.selection.storyboardCorpus.embeddedDigest,
        },
      },
      revisedSource,
      revisedDirectionBytes: `${JSON.stringify(revisedDirection, null, 2)}\n`,
      integratedStory: integration.injectDirections(revisedSource, revisedDirection),
      boyProjection: materializer.resolveProjection(revisedSource, 'boy'),
      girlProjection,
      girlProseProjection: materializer.stripCanonicalSourceGenderLine(
        girlProjection,
        'neutral',
      ),
    };
    expect(() =>
      validateStorySourceVisualDirectionCorrectionCandidateManifest({
        manifest: candidate.sourceRevisionManifest,
        files,
        requestFile,
        planRecord,
        expected,
      }),
    ).not.toThrow();
    const provenanceDrift = structuredClone(candidate.sourceRevisionManifest);
    provenanceDrift.inputs = {
      ...(provenanceDrift.inputs as Record<string, unknown>),
      acceptedStory: {
        ...((provenanceDrift.inputs as Record<string, unknown>)
          .acceptedStory as Record<string, unknown>),
        sha256: 'a'.repeat(64),
      },
    };
    expect(() =>
      validateStorySourceVisualDirectionCorrectionCandidateManifest({
        manifest: provenanceDrift,
        files,
        requestFile,
        planRecord,
        expected,
      }),
    ).toThrow(/input provenance/);
    const smuggled = {
      ...candidate.sourceRevisionManifest,
      runtimeEligible: true,
      productionEligible: true,
      acceptance: { status: 'approved' },
    };
    expect(() =>
      validateStorySourceVisualDirectionCorrectionCandidateManifest({
        manifest: smuggled,
        files,
        requestFile,
        planRecord,
        expected,
      }),
    ).toThrow(/unexpected shape/);
  });

  it('imports the CLI without parsing ambient argv or changing process state', async () => {
    const previousExitCode = process.exitCode;
    const cli = await import(
      '../../../scripts/prepare-story-source-visual-direction-corrections'
    );
    expect(cli.parseStorySourceVisualDirectionCorrectionArgs(['help'])).toMatchObject({
      help: true,
      write: false,
    });
    expect(process.exitCode).toBe(previousExitCode);
  });

  it(
    'runs the real CLI in dry-run mode and reports zero external effects',
    () => {
      const outputRoot = newOutputRoot();
      const run = spawnSync(
        process.execPath,
        [
          './node_modules/tsx/dist/cli.mjs',
          '--require',
          './scripts/shims/register-server-only.cjs',
          'scripts/prepare-story-source-visual-direction-corrections.ts',
          'prepare',
          '--output-root',
          outputRoot,
          '--write',
          'false',
        ],
        { cwd: REPO, encoding: 'utf8', timeout: 120_000 },
      );
      expect(run.status, run.stderr).toBe(0);
      const output = JSON.parse(run.stdout) as {
        summary: { candidateCount: number; totalPageCount: number };
        artifact: { created: boolean; fileCount: number };
        effects: Record<string, unknown>;
      };
      expect(output.summary).toMatchObject({ candidateCount: 17, totalPageCount: 208 });
      expect(output.artifact).toMatchObject({ created: false, fileCount: 1 });
      expect(output.effects).toMatchObject({
        providerCalls: 0,
        imagesGenerated: 0,
        audioGenerated: 0,
        databaseWrites: 0,
        storageWrites: 0,
        maximumSpendUsd: 0,
        resemblanceThresholdChanged: false,
      });
      expect(fs.existsSync(absoluteRepoPath(outputRoot))).toBe(false);

      const materialize = spawnSync(
        process.execPath,
        [
          './node_modules/tsx/dist/cli.mjs',
          '--require',
          './scripts/shims/register-server-only.cjs',
          'scripts/prepare-story-source-visual-direction-corrections.ts',
          'materialize-record',
          '--story-key',
          'bunny_ometz_adventure',
          '--output-root',
          outputRoot,
          '--write',
          'false',
        ],
        { cwd: REPO, encoding: 'utf8', timeout: 120_000 },
      );
      expect(materialize.status, materialize.stderr).toBe(0);
      expect(JSON.parse(materialize.stdout)).toMatchObject({
        storyKey: 'bunny_ometz_adventure',
        status: 'pending_exact_product_review',
        runtimeEligible: false,
        productionEligible: false,
        created: false,
        fileCount: 6,
      });
      expect(fs.existsSync(absoluteRepoPath(outputRoot))).toBe(false);
    },
    120_000,
  );
});
