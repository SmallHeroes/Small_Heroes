import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { canonicalHash } from '@/lib/canonical-json';
import {
  prepareStorySourceVisualDirectionReviewBatch,
  readStoryReviewBoundRegularFile,
  reviewBatchSelectionFromReport,
  type PreparedStorySourceVisualDirectionReviewBatch,
} from '@/lib/visual-package/storySourceVisualDirectionReviewBatch';
import {
  auditWizardAllStoryRenderReadiness,
  type WizardAllStoryRenderReadinessReport,
} from '@/lib/visual-package/wizardAllStoryRenderReadiness';

const REPO = process.cwd();
const OUTPUTS_ROOT = path.resolve(REPO, 'outputs');
const OUTPUT_TEST_PREFIX = 'r3b0b-review-batch-vitest-';
const FIXED_NOW = () => new Date('2026-09-02T12:00:00.000Z');
const EXPECTED_STORY_KEYS = [
  'bunny_ometz_adventure',
  'bunny_ometz_bedtime',
  'bunny_ometz_fantasy',
  'chameleon_koko_adventure',
  'chameleon_koko_fantasy',
  'dragon_dini_adventure',
  'dragon_dini_bedtime',
  'dragon_dini_fantasy',
  'fox_uri_adventure',
  'fox_uri_bedtime',
  'fox_uri_fantasy',
  'lion_shaket_adventure',
  'lion_shaket_bedtime',
  'lion_shaket_fantasy',
  'panda_anat_adventure',
  'panda_anat_bedtime',
  'panda_anat_fantasy',
] as const;
const RAW_AND_NORMALIZED_DIGEST_DIFFERENCES = [
  'bunny_ometz_adventure',
  'bunny_ometz_bedtime',
  'dragon_dini_bedtime',
  'fox_uri_adventure',
  'fox_uri_bedtime',
  'lion_shaket_adventure',
  'panda_anat_adventure',
  'panda_anat_bedtime',
] as const;
const FOX_FANTASY_CRITICAL_EVIDENCE = [
  'boy:3:ספר',
  'boy:4:ספר',
  'boy:4:ספר',
  'boy:5:ספר',
  'girl:4:ספר',
  'girl:4:ספר',
  'girl:5:ספר',
] as const;
const CHAMELEON_STORY_KEY = 'chameleon_koko_bedtime';
const DIRECTION_COUNTS = { bedtime: 5, adventure: 6, fantasy: 6 } as const;
const ZERO_EFFECT_KEYS = [
  'filesDeleted',
  'storySourcesRewritten',
  'visualDirectionsRewritten',
  'acceptancesCreated',
  'publicationsCreated',
  'runtimeActivations',
  'databaseReads',
  'databaseWrites',
  'storageReads',
  'storageWrites',
  'networkCalls',
  'providerCalls',
  'imagesGenerated',
  'audioGenerated',
  'pdfsGenerated',
  'ordersCreatedOrModified',
  'maximumSpendUsd',
] as const;

const ownedOutputRoots = new Set<string>();
const firstDryOutputRoot = newOwnedOutputRoot();
const secondDryOutputRoot = newOwnedOutputRoot();
let firstDryRun: PreparedStorySourceVisualDirectionReviewBatch;
let secondDryRun: PreparedStorySourceVisualDirectionReviewBatch;
let readinessReport: WizardAllStoryRenderReadinessReport;
let observedReadPaths: string[] = [];

function newOwnedOutputRoot(): string {
  const relative = `outputs/${OUTPUT_TEST_PREFIX}${randomUUID()}`;
  ownedOutputRoots.add(relative);
  return relative;
}

function absoluteRepoPath(relativePath: string): string {
  return path.resolve(REPO, ...relativePath.split('/'));
}

function normalizedFilesystemPath(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function cleanupOwnedOutputRoot(relativeRoot: string): void {
  const absolute = absoluteRepoPath(relativeRoot);
  const relativeToOutputs = path.relative(OUTPUTS_ROOT, absolute);
  if (
    relativeToOutputs === '' ||
    relativeToOutputs.startsWith('..') ||
    path.isAbsolute(relativeToOutputs) ||
    !path.basename(absolute).startsWith(OUTPUT_TEST_PREFIX)
  ) {
    throw new Error(`refusing to clean non-test output path: ${absolute}`);
  }
  fs.rmSync(absolute, { recursive: true, force: true });
}

function sha256File(relativePath: string): string {
  return createHash('sha256')
    .update(fs.readFileSync(absoluteRepoPath(relativePath)))
    .digest('hex');
}

function withSameSizeReadMutation<T>(args: {
  relativePath: string;
  mutate: (bytes: Buffer) => Buffer;
  callback: () => T;
}): T {
  const target = normalizedFilesystemPath(absoluteRepoPath(args.relativePath));
  const originalRead = fs.readFileSync.bind(fs) as (...callArgs: unknown[]) => unknown;
  const original = originalRead(absoluteRepoPath(args.relativePath)) as Buffer;
  const mutated = args.mutate(Buffer.from(original));
  expect(mutated.length).toBe(original.length);
  expect(mutated.equals(original)).toBe(false);
  const spy = vi.spyOn(fs, 'readFileSync').mockImplementation((
    (file: fs.PathOrFileDescriptor, options?: unknown) => {
      const candidate = typeof file === 'string'
        ? normalizedFilesystemPath(file)
        : Buffer.isBuffer(file)
          ? normalizedFilesystemPath(file.toString('utf8'))
          : null;
      if (candidate !== target) return originalRead(file, options);
      const encoding = typeof options === 'string'
        ? options
        : options && typeof options === 'object' && 'encoding' in options
          ? (options as { encoding?: unknown }).encoding
          : null;
      return typeof encoding === 'string'
        ? mutated.toString(encoding as BufferEncoding)
        : Buffer.from(mutated);
    }
  ) as typeof fs.readFileSync);
  try {
    return args.callback();
  } finally {
    spy.mockRestore();
  }
}

function withCanonicalAuditEnvironment<T>(callback: () => T): T {
  const previousV3 = process.env.ENABLE_V3_APPROVED_BANK;
  const previousQa = process.env.ENABLE_WIZARD_QA_RENDER_CATALOG;
  process.env.ENABLE_V3_APPROVED_BANK = 'true';
  process.env.ENABLE_WIZARD_QA_RENDER_CATALOG = 'false';
  try {
    return callback();
  } finally {
    if (previousV3 === undefined) delete process.env.ENABLE_V3_APPROVED_BANK;
    else process.env.ENABLE_V3_APPROVED_BANK = previousV3;
    if (previousQa === undefined) delete process.env.ENABLE_WIZARD_QA_RENDER_CATALOG;
    else process.env.ENABLE_WIZARD_QA_RENDER_CATALOG = previousQa;
  }
}

function expectAllZero(value: Record<string, number>): void {
  expect(Object.keys(value).sort()).toEqual([...ZERO_EFFECT_KEYS].sort());
  expect(Object.values(value)).toEqual(
    Array.from({ length: ZERO_EFFECT_KEYS.length }, () => 0),
  );
}

function unlinkAliasIfPresent(aliasPath: string): void {
  if (!fs.existsSync(aliasPath) && !fs.lstatSync(path.dirname(aliasPath)).isDirectory()) {
    return;
  }
  try {
    fs.unlinkSync(aliasPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EPERM') throw error;
    fs.rmdirSync(aliasPath);
  }
}

beforeAll(() => {
  expect(fs.existsSync(absoluteRepoPath(firstDryOutputRoot))).toBe(false);
  expect(fs.existsSync(absoluteRepoPath(secondDryOutputRoot))).toBe(false);

  const readSpy = vi.spyOn(fs, 'readFileSync');
  try {
    firstDryRun = prepareStorySourceVisualDirectionReviewBatch({
      repoRoot: REPO,
      outputRoot: firstDryOutputRoot,
      write: false,
    });
    secondDryRun = prepareStorySourceVisualDirectionReviewBatch({
      repoRoot: REPO,
      outputRoot: secondDryOutputRoot,
      write: false,
    });
    readinessReport = withCanonicalAuditEnvironment(() =>
      auditWizardAllStoryRenderReadiness({
        repoRoot: REPO,
        now: FIXED_NOW,
      }),
    );
    observedReadPaths = (readSpy.mock.calls as unknown[][])
      .map(([file]) => {
        if (typeof file === 'string') return normalizedFilesystemPath(file);
        if (Buffer.isBuffer(file)) {
          return normalizedFilesystemPath(file.toString('utf8'));
        }
        return null;
      })
      .filter((value): value is string => value !== null);
  } finally {
    readSpy.mockRestore();
  }
}, 30_000);

afterAll(() => {
  for (const relativeRoot of ownedOutputRoots) {
    cleanupOwnedOutputRoot(relativeRoot);
  }
});

describe('R3-B0b Story Source / Visual Direction review batch', () => {
  it('derives the exact sorted 17/1 split and approved 5/6/6, 208-beat shape', () => {
    const { batch, artifact } = firstDryRun;
    const storyKeys = batch.records.map((record) => record.storyKey);

    expect(storyKeys).toEqual(EXPECTED_STORY_KEYS);
    expect(storyKeys).toEqual([...storyKeys].sort());
    expect(new Set(storyKeys).size).toBe(17);
    expect(batch.selection).toMatchObject({
      nominalSlotCount: 18,
      candidateCount: 17,
      companionCount: 6,
      directionCounts: DIRECTION_COUNTS,
      totalPageCount: 208,
      fantasy: { storyCount: 6, pageCountPerStory: 16 },
    });
    expect(
      batch.records
        .filter((record) => record.direction === 'fantasy')
        .map((record) => record.pageCount),
    ).toEqual([16, 16, 16, 16, 16, 16]);
    expect(batch.selection.preservedExistingStrictAuthority).toHaveLength(1);
    expect(batch.selection.preservedExistingStrictAuthority[0]).toMatchObject({
      storyKey: CHAMELEON_STORY_KEY,
      packageRevisionDigest:
        '836a3414174dbe3060010371e81ebdbef821f705650a199cc4bbfd70081d523f',
    });
    expect(
      batch.selection.preservedExistingStrictAuthority[0]
        ?.qaCompletenessRecordDigest,
    ).toMatch(/^[a-f0-9]{64}$/);
    expect(storyKeys).not.toContain(CHAMELEON_STORY_KEY);
    expect(artifact).toEqual({
      path: `${firstDryOutputRoot}/${batch.digest}.json`,
      created: false,
    });
    expect(fs.existsSync(absoluteRepoPath(firstDryOutputRoot))).toBe(false);
  });

  it('binds every exact source projection, raw authority byte set, and preserved Chameleon package', () => {
    for (const record of firstDryRun.batch.records) {
      expect(record.authorityChain.sourceProjection).toMatchObject({
        imageDirectionLineCount: record.pageCount,
        bytes: record.authorityChain.acceptedStory.bytes,
        rawSha256: record.authorityChain.acceptedStory.rawSha256,
        byteIdenticalToAcceptedStory: true,
      });
      for (const descriptor of [
        record.authorityChain.v3ProductFallback.story,
        record.authorityChain.v3ProductFallback.importSidecar,
        record.authorityChain.acceptedManifest,
        record.authorityChain.acceptedStory,
        record.authorityChain.productAcceptance,
        record.authorityChain.editorialReview.trackedSnapshot,
        record.authorityChain.qaIntegratedStory,
        record.authorityChain.importSidecar,
        record.authorityChain.qaCandidate,
        record.authorityChain.visualDirection,
        record.authorityChain.visualDirectionReceipt,
        record.authorityChain.companionAuthority.manifest,
        ...record.authorityChain.companionAuthority.views,
        ...(record.authorityChain.productAcceptanceBinding.kind === 'corpus'
          ? [record.authorityChain.productAcceptanceBinding.corpusManifest]
          : []),
      ]) {
        expect(descriptor.bytes).toBeGreaterThan(0);
        expect(descriptor.rawSha256).toMatch(/^[a-f0-9]{64}$/);
        expect(sha256File(descriptor.path)).toBe(descriptor.rawSha256);
      }
      const { digest, ...recordPayload } = record;
      const { digestAlgorithm } = recordPayload;
      expect(digestAlgorithm).toBe('canonical-json-sha256');
      expect(digest).toBe(canonicalHash(recordPayload));
    }
    expect(
      firstDryRun.batch.records.filter(
        (record) => record.authorityChain.productAcceptanceBinding.kind === 'corpus',
      ),
    ).toHaveLength(16);
    expect(
      firstDryRun.batch.records.filter(
        (record) =>
          record.authorityChain.productAcceptanceBinding.kind === 'individual_story',
      ).map((record) => record.storyKey),
    ).toEqual(['dragon_dini_adventure']);

    const preserved =
      firstDryRun.batch.selection.preservedExistingStrictAuthority[0];
    expect(sha256File(preserved.locator.path)).toBe(preserved.locator.rawSha256);
    expect(sha256File(preserved.packageArtifact.path)).toBe(
      preserved.packageArtifact.rawSha256,
    );
    expect(preserved.packageArtifact.path).toContain(
      `${preserved.packageRevisionDigest}.visual-package.json`,
    );
  });

  it('retains the eight raw/normalized differences and all current QA narration evidence', () => {
    const rawDifferences = firstDryRun.batch.records
      .filter(
        (record) =>
          record.authorityChain.qaIntegratedStory.rawSha256 !==
          record.authorityChain.qaIntegratedStory.normalizedDigest,
      )
      .map((record) => record.storyKey);
    expect(rawDifferences).toEqual(RAW_AND_NORMALIZED_DIGEST_DIFFERENCES);

    const softItems = firstDryRun.batch.records.flatMap((record) =>
      (['boy', 'girl'] as const).flatMap((gender) =>
        record.narrationPreflight[gender].softTtsGaps.map(
          (gap) => `${record.storyKey}:${gender}:${gap.pageNumber}:${gap.lemma}`,
        ),
      ),
    );
    expect(softItems).toHaveLength(24);
    expect(new Set(softItems.map((item) => item.split(':').slice(-1)[0]))).toEqual(
      new Set(['שם']),
    );
    expect(
      firstDryRun.batch.records.reduce(
        (total, record) =>
          total + record.narrationPreflight.softTtsReviewItemCount,
        0,
      ),
    ).toBe(24);

    const foxFantasy = firstDryRun.batch.records.find(
      (record) => record.storyKey === 'fox_uri_fantasy',
    );
    expect(foxFantasy).toBeDefined();
    const criticalEvidence = (['boy', 'girl'] as const).flatMap((gender) =>
      foxFantasy!.narrationPreflight[gender].criticalTtsGaps.map(
        (gap) => `${gender}:${gap.pageNumber}:${gap.lemma}`,
      ),
    );
    expect(criticalEvidence).toEqual(FOX_FANTASY_CRITICAL_EVIDENCE);
    expect(foxFantasy!.narrationPreflight).toMatchObject({
      status: 'automated_evidence_only_human_review_pending',
      supportedCriticalTtsGateReady: false,
      supportedNarrationAutomatedPreflightReady: false,
    });
    expect(
      firstDryRun.batch.records.flatMap((record) =>
        (['boy', 'girl'] as const).flatMap(
          (gender) => record.narrationPreflight[gender].criticalTtsGaps,
        ),
      ),
    ).toHaveLength(7);
  });

  it('keeps all authority candidate-only, zero-effect, and human/independent review pending', () => {
    expect(firstDryRun.batch).toMatchObject({
      status: 'pending_exact_product_and_visual_review',
      authorityScope: 'review_candidates_only',
      productionEligible: false,
      runtimeEligible: false,
    });
    expectAllZero(firstDryRun.batch.effects);
    for (const record of firstDryRun.batch.records) {
      expect(record).toMatchObject({
        state: 'pending_exact_product_and_visual_review',
        productionEligible: false,
        runtimeEligible: false,
        reviewRequirements: {
          technical: 'pending_claude_code',
          exactProductAndVisual: 'pending_guy',
        },
      });
      expectAllZero(record.effects);
      expect(record.exclusions).toEqual(
        expect.arrayContaining([
          'acceptance',
          'publication',
          'runtime_eligibility',
        ]),
      );
    }

    const pendingCowork = firstDryRun.batch.records.filter(
      (record) =>
        record.reviewRequirements.storyQuality === 'pending_claude_cowork',
    );
    expect(pendingCowork.map((record) => record.storyKey)).toEqual([
      'lion_shaket_adventure',
    ]);
    expect(pendingCowork[0]?.reviewRequirements).toEqual({
      technical: 'pending_claude_code',
      exactProductAndVisual: 'pending_guy',
      storyQuality: 'pending_claude_cowork',
    });
  });

  it('uses the tracked Dini snapshot while retaining its ignored upstream locator as opaque provenance', () => {
    const dini = firstDryRun.batch.records.find(
      (record) => record.storyKey === 'dragon_dini_adventure',
    );
    expect(dini).toBeDefined();
    expect(dini!.authorityChain.editorialReview).toMatchObject({
      verdict: 'pass',
      trackedSnapshot: {
        path: 'story-pipeline/04_approved_story_sources/accepted/dragon_dini_adventure/editorial-review.json',
      },
      upstreamSource: {
        path: 'outputs/story-engine-vnext-dini-cake-musical-polish-editor-result-round3-20260814-v1/review.json',
        status: 'not_dereferenced_manifest_provenance',
      },
    });
    const trackedSnapshotPath = normalizedFilesystemPath(
      absoluteRepoPath(dini!.authorityChain.editorialReview.trackedSnapshot.path),
    );
    const opaqueUpstreamPath = normalizedFilesystemPath(
      absoluteRepoPath(dini!.authorityChain.editorialReview.upstreamSource.path),
    );
    expect(observedReadPaths).toContain(trackedSnapshotPath);
    expect(observedReadPaths).not.toContain(opaqueUpstreamPath);
    expect(
      sha256File(dini!.authorityChain.editorialReview.trackedSnapshot.path),
    ).toBe(dini!.authorityChain.editorialReview.trackedSnapshot.rawSha256);
  });

  it('is deterministic and keeps selection invariant under report enumeration order', () => {
    expect(secondDryRun.batch).toEqual(firstDryRun.batch);
    expect(secondDryRun.batch.digest).toBe(firstDryRun.batch.digest);
    expect(fs.existsSync(absoluteRepoPath(secondDryOutputRoot))).toBe(false);

    const { digest, ...batchPayload } = firstDryRun.batch;
    const { digestAlgorithm } = batchPayload;
    expect(digestAlgorithm).toBe('canonical-json-sha256');
    expect(digest).toBe(canonicalHash(batchPayload));
    expect(
      reviewBatchSelectionFromReport({
        records: [...readinessReport.records].reverse(),
      }),
    ).toEqual(EXPECTED_STORY_KEYS);
  });

  it('rejects invalid calendar authority and same-size mutations in the real authority graph', () => {
    const expectPreparationToReject = (pattern: RegExp) => {
      const outputRoot = newOwnedOutputRoot();
      expect(() =>
        prepareStorySourceVisualDirectionReviewBatch({
          repoRoot: REPO,
          outputRoot,
          write: false,
        }),
      ).toThrow(pattern);
      expect(fs.existsSync(absoluteRepoPath(outputRoot))).toBe(false);
    };

    withSameSizeReadMutation({
      relativePath:
        'story-pipeline/04_approved_story_sources/review-requests/r3b0b-qa-story-source-visual-direction-review-request.json',
      mutate: (bytes) => {
        const request = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
        request.authorizedOn = '2026-99-99';
        const { digest: _digest, ...payload } = request;
        request.digest = canonicalHash(payload);
        return Buffer.from(JSON.stringify(request, null, 2) + '\n', 'utf8');
      },
      callback: () => expectPreparationToReject(/ISO calendar date/),
    });

    withSameSizeReadMutation({
      relativePath:
        'story-pipeline/04_approved_story_sources/accepted/bunny_ometz_bedtime/manifest.json',
      mutate: (bytes) => Buffer.from(
        bytes.toString('utf8').replace(',\n  "status"', ', \n "status"'),
        'utf8',
      ),
      callback: () => expectPreparationToReject(/strict LF\/NFC pretty JSON/),
    });

    for (const relativePath of [
      'story-bank/qa-autonomous-20260815-v1/bunny_ometz_bedtime.import.json',
      'story-pipeline/05_storyboard_inputs/autonomous-20260815-v1/bunny_ometz_bedtime.visual-directions.json',
      'story-pipeline/05_storyboard_inputs/autonomous-20260815-v1/bunny_ometz_bedtime.receipt.json',
    ]) {
      withSameSizeReadMutation({
        relativePath,
        mutate: (bytes) => Buffer.from(
          bytes.toString('utf8').replace(
            'bunny_ometz_bedtime',
            'zunny_ometz_bedtime',
          ),
          'utf8',
        ),
        callback: () => expectPreparationToReject(/rejected|invalid|drifted/),
      });
    }

    withSameSizeReadMutation({
      relativePath:
        'story-pipeline/04_approved_story_sources/review-corpora/autonomous-20260815-v1/manifest.json',
      mutate: (bytes) => {
        const text = bytes.toString('utf8');
        const marker = '"storySha256": "';
        const digestStart = text.indexOf(marker) + marker.length;
        const first = text[digestStart]!;
        return Buffer.from(
          text.slice(0, digestStart) +
            (first === 'a' ? 'b' : 'a') +
            text.slice(digestStart + 1),
          'utf8',
        );
      },
      callback: () => expectPreparationToReject(/corpus raw digest drifted/),
    });

    withSameSizeReadMutation({
      relativePath: 'story-bank/qa-autonomous-20260815-v1/bunny_ometz_adventure.md',
      mutate: (bytes) => Buffer.from(
        bytes.toString('utf8').replace(
          /[\u0590-\u05ff]/u,
          (letter) => letter === 'א' ? 'ב' : 'א',
        ),
        'utf8',
      ),
      callback: () => expectPreparationToReject(/invalid|drifted|incomplete/),
    });
  }, 30_000);

  it('strictly preflights the excluded Chameleon QA dependency graph', () => {
    const relativePath =
      'qa-authorities/wizard/storyboard-candidates/chameleon_koko_bedtime.json';
    const target = normalizedFilesystemPath(absoluteRepoPath(relativePath));
    const originalRealpath = fs.realpathSync.bind(fs) as (...args: unknown[]) => unknown;
    const spy = vi.spyOn(fs, 'realpathSync').mockImplementation((
      (file: fs.PathLike, options?: unknown) => {
        if (normalizedFilesystemPath(String(file)) === target) {
          return path.resolve(String(file)) + '.alias';
        }
        return originalRealpath(file, options);
      }
    ) as typeof fs.realpathSync);
    try {
      expect(() =>
        prepareStorySourceVisualDirectionReviewBatch({
          repoRoot: REPO,
          outputRoot: newOwnedOutputRoot(),
          write: false,
        }),
      ).toThrow(/link or reparse alias/);
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects non-canonical, escaped, hard-linked, non-file, and oversized inputs', () => {
    const fixtureRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'small-heroes-r3b0b-reader-'),
    );
    const authorityRoot = path.join(fixtureRoot, 'authority');
    fs.mkdirSync(path.join(authorityRoot, 'directory'), { recursive: true });
    fs.writeFileSync(path.join(authorityRoot, 'safe.txt'), 'safe', 'utf8');
    fs.writeFileSync(path.join(fixtureRoot, 'escape.txt'), 'escape', 'utf8');
    fs.writeFileSync(path.join(authorityRoot, 'hard-source.txt'), 'hard', 'utf8');
    fs.linkSync(
      path.join(authorityRoot, 'hard-source.txt'),
      path.join(authorityRoot, 'hard-alias.txt'),
    );

    const read = (relativePath: string, maxBytes = 1024) =>
      readStoryReviewBoundRegularFile({
        repoRoot: fixtureRoot,
        relativePath,
        allowedRoot: 'authority',
        label: 'hostile fixture',
        maxBytes,
      });
    try {
      expect(read('authority/safe.txt').bytes.toString('utf8')).toBe('safe');
      for (const invalidPath of [
        'authority/../escape.txt',
        'authority\\safe.txt',
        path.resolve(authorityRoot, 'safe.txt'),
      ]) {
        expect(() => read(invalidPath)).toThrow(/path is not canonical/);
      }
      expect(() => read('authority/hard-source.txt')).toThrow(
        /not a single-link regular file/,
      );
      expect(() => read('authority/hard-alias.txt')).toThrow(
        /not a single-link regular file/,
      );
      expect(() => read('authority/directory')).toThrow(
        /not a single-link regular file/,
      );
      expect(() => read('authority/safe.txt', 3)).toThrow(
        /byte size is outside the allowed range/,
      );
    } finally {
      const resolvedFixture = path.resolve(fixtureRoot);
      const resolvedTemp = path.resolve(os.tmpdir());
      const relativeToTemp = path.relative(resolvedTemp, resolvedFixture);
      if (
        relativeToTemp === '' ||
        relativeToTemp.startsWith('..') ||
        path.isAbsolute(relativeToTemp) ||
        !path.basename(resolvedFixture).startsWith(
          'small-heroes-r3b0b-reader-',
        )
      ) {
        throw new Error(`refusing to clean reader fixture: ${resolvedFixture}`);
      }
      fs.rmSync(resolvedFixture, { recursive: true, force: true });
    }
  });

  it('rejects file symlinks and directory junction aliases when the host supports them', () => {
    const fixtureRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'small-heroes-r3b0b-links-'),
    );
    const authorityRoot = path.join(fixtureRoot, 'authority');
    const outsideDirectory = path.join(fixtureRoot, 'outside');
    const fileAlias = path.join(authorityRoot, 'file-alias.txt');
    const directoryAlias = path.join(authorityRoot, 'directory-alias');
    fs.mkdirSync(authorityRoot);
    fs.mkdirSync(outsideDirectory);
    fs.writeFileSync(path.join(authorityRoot, 'target.txt'), 'target', 'utf8');
    fs.writeFileSync(path.join(outsideDirectory, 'outside.txt'), 'outside', 'utf8');

    let fileLinkCreated = false;
    let directoryLinkCreated = false;
    try {
      try {
        fs.symlinkSync(path.join(authorityRoot, 'target.txt'), fileAlias, 'file');
        fileLinkCreated = true;
      } catch (error) {
        expect(['EACCES', 'EINVAL', 'ENOTSUP', 'EPERM', 'UNKNOWN']).toContain(
          (error as NodeJS.ErrnoException).code,
        );
      }
      try {
        fs.symlinkSync(
          outsideDirectory,
          directoryAlias,
          process.platform === 'win32' ? 'junction' : 'dir',
        );
        directoryLinkCreated = true;
      } catch (error) {
        expect(['EACCES', 'EINVAL', 'ENOTSUP', 'EPERM', 'UNKNOWN']).toContain(
          (error as NodeJS.ErrnoException).code,
        );
      }

      if (fileLinkCreated) {
        expect(() =>
          readStoryReviewBoundRegularFile({
            repoRoot: fixtureRoot,
            relativePath: 'authority/file-alias.txt',
            allowedRoot: 'authority',
            label: 'file symlink fixture',
            maxBytes: 1024,
          }),
        ).toThrow(/link or reparse alias/);
      }
      if (directoryLinkCreated) {
        expect(() =>
          readStoryReviewBoundRegularFile({
            repoRoot: fixtureRoot,
            relativePath: 'authority/directory-alias/outside.txt',
            allowedRoot: 'authority',
            label: 'junction fixture',
            maxBytes: 1024,
          }),
        ).toThrow(/link or reparse alias/);
      }
    } finally {
      if (fileLinkCreated) unlinkAliasIfPresent(fileAlias);
      if (directoryLinkCreated) unlinkAliasIfPresent(directoryAlias);
      const resolvedFixture = path.resolve(fixtureRoot);
      const relativeToTemp = path.relative(path.resolve(os.tmpdir()), resolvedFixture);
      if (
        relativeToTemp === '' ||
        relativeToTemp.startsWith('..') ||
        path.isAbsolute(relativeToTemp) ||
        !path.basename(resolvedFixture).startsWith('small-heroes-r3b0b-links-')
      ) {
        throw new Error(`refusing to clean link fixture: ${resolvedFixture}`);
      }
      fs.rmSync(resolvedFixture, { recursive: true, force: true });
    }
  });

  it('writes once, replays without a write, rejects collisions, and leaves Chameleon bytes unchanged', () => {
    const outputRoot = newOwnedOutputRoot();
    const preserved =
      firstDryRun.batch.selection.preservedExistingStrictAuthority[0];
    const chameleonRecord = readinessReport.records.find(
      (record) => record.storyKey === CHAMELEON_STORY_KEY,
    );
    expect(chameleonRecord?.sources.acceptedProductSource.path).toBeTruthy();
    const protectedPaths = [
      chameleonRecord!.sources.acceptedProductSource.path!,
      'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/manifest.json',
      'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/story.md',
      preserved.locator.path,
      preserved.packageArtifact.path,
    ];
    const before = new Map(
      protectedPaths.map((relativePath) => [relativePath, sha256File(relativePath)]),
    );
    let replayWriteSpy: ReturnType<typeof vi.spyOn> | null = null;
    try {
      expect(fs.existsSync(absoluteRepoPath(outputRoot))).toBe(false);
      const firstWrite = prepareStorySourceVisualDirectionReviewBatch({
        repoRoot: REPO,
        outputRoot,
        write: true,
      });
      expect(firstWrite.artifact.created).toBe(true);
      expect(firstWrite.batch).toEqual(firstDryRun.batch);
      const artifactAbsolute = absoluteRepoPath(firstWrite.artifact.path);
      expect(fs.lstatSync(artifactAbsolute).isFile()).toBe(true);
      expect(fs.lstatSync(artifactAbsolute).nlink).toBe(1);

      replayWriteSpy = vi.spyOn(fs, 'writeFileSync');
      const replay = prepareStorySourceVisualDirectionReviewBatch({
        repoRoot: REPO,
        outputRoot,
        write: true,
      });
      expect(replay.artifact).toEqual({
        path: firstWrite.artifact.path,
        created: false,
      });
      expect(replay.batch).toEqual(firstWrite.batch);
      expect(replayWriteSpy).not.toHaveBeenCalled();
      replayWriteSpy.mockRestore();
      replayWriteSpy = null;

      fs.writeFileSync(artifactAbsolute, '{"collision":true}\n', 'utf8');
      expect(() =>
        prepareStorySourceVisualDirectionReviewBatch({
          repoRoot: REPO,
          outputRoot,
          write: true,
        }),
      ).toThrow(/immutable output collision/);
    } finally {
      replayWriteSpy?.mockRestore();
      cleanupOwnedOutputRoot(outputRoot);
      for (const relativePath of protectedPaths) {
        expect(sha256File(relativePath)).toBe(before.get(relativePath));
      }
    }
  }, 40_000);

  it('exposes prepare as the only CLI command', () => {
    const require = createRequire(import.meta.url);
    const tsxCli = require.resolve('tsx/cli');
    const cli = path.resolve(
      REPO,
      'scripts/prepare-story-source-visual-direction-review-batch.ts',
    );
    const shim = path.resolve(REPO, 'scripts/shims/register-server-only.cjs');
    const run = (argv: string[]) =>
      spawnSync(process.execPath, [tsxCli, '--require', shim, cli, ...argv], {
        cwd: REPO,
        encoding: 'utf8',
        env: process.env,
      });

    const help = run(['--help']);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain(
      'prepare [--request <repo-relative-json>] [--output-root <outputs/...>] [--write true|false]',
    );
    for (const unsupported of ['accept', 'publish', 'render']) {
      const result = run([unsupported]);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('the only supported command is prepare');
    }
  }, 20_000);
});
