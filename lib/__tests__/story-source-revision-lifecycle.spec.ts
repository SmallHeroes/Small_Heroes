import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const materializer = require('../../scripts/materialize-story-source-revision.cjs') as any;
const lifecycle = require('../../scripts/story-source-revision-lifecycle.cjs') as any;

const REPO_ROOT = path.resolve(process.cwd());
const OUTPUTS_ROOT = path.join(REPO_ROOT, 'outputs');
const temporaryRoots: string[] = [];

function relative(absolutePath: string): string {
  return path.relative(REPO_ROOT, absolutePath).split('\\').join('/');
}

function requestFixture() {
  return {
    version: materializer.REQUEST_VERSION,
    storyKey: 'chameleon_koko_bedtime',
    briefId: 'chameleon_koko_bedtime_walking_bus_stop_brief_v1',
    source: {
      manifest: {
        path: 'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/manifest.json',
        sha256: '32b3d0b7777839d874dc412c7c84a0cb8744512372791d51b2cd6b66d3cec4dd',
      },
      story: {
        path: 'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/story.md',
        sha256: '49d2866ee4cdef5ea5155c87f7769f6c653ba224ff4b5ec490a039dfd632a76d',
      },
    },
    visualDirections: {
      corpusManifest: {
        path: 'story-pipeline/05_storyboard_inputs/autonomous-20260815-v1/manifest.json',
        sha256: '2c884372b36b4e45266490f920fdae2c59809a4e8a444e4780471de8e62c631d',
        digest: 'a793038efca754ea028aa9fc528f896261ade25b671865657282fb6220cfb6fa',
      },
      record: {
        path: 'story-pipeline/05_storyboard_inputs/autonomous-20260815-v1/chameleon_koko_bedtime.visual-directions.json',
        sha256: '9656e61abb35cdcf9dbffa9e0ace5bc5996714f9f36d581d881173977c523070',
      },
    },
    textReplacements: [
      { expectedCount: 1, from: 'gender: female', to: 'gender: neutral' },
      {
        expectedCount: 1,
        from: '{{childName}} ניסתה לסובב',
        to: '{{childName}} {ניסה|ניסתה} לסובב',
      },
      {
        expectedCount: 1,
        from: 'הן יצאו לדרך בסמטאות הנרדמות.',
        to: '{הם יצאו|הן יצאו} לדרך בסמטאות הנרדמות.',
      },
      {
        expectedCount: 1,
        from: '{{childName}} טיפסה על הספסל, שחררה את הגג מן החבל והחזירה את הגרב. אחר כך הובילה את התחנה',
        to: '{{childName}} {טיפס|טיפסה} על הספסל, {שחרר|שחררה} את הגג מן החבל {והחזיר|והחזירה} את הגרב. אחר כך {הוביל|הובילה} את התחנה',
      },
      {
        expectedCount: 1,
        from: '{{childName}} הנהנה. עכשיו היא כבר לא ניסתה להחזיר את התחנה לפינה. היא הקשיבה איתה לעיר.',
        to: '{{childName}} {הנהן|הנהנה}. עכשיו {הוא|היא} כבר לא {ניסה|ניסתה} להחזיר את התחנה לפינה. {הוא|היא} {הקשיב|הקשיבה} איתה לעיר.',
      },
      {
        expectedCount: 1,
        from: 'היא הובילה את האוטובוס אל המפרץ השקט שקִים זכרה. שם הניחה את תיק הגב כספסל קטן, הרימה את פנס הכיס כמו ירח זעיר וביקשה מקִים לחכות לצדה.',
        to: '{הוא|היא} {הוביל|הובילה} את האוטובוס אל המפרץ השקט שקִים זכרה. שם {הניח|הניחה} את תיק הגב כספסל קטן, {הרים|הרימה} את פנס הכיס כמו ירח זעיר {וביקש|וביקשה} מקִים לחכות {לצדו|לצדה}.',
      },
      {
        expectedCount: 1,
        from: '"זו התחנה ללילה אחד," הכריזה.',
        to: '"זו התחנה ללילה אחד," {הכריז|הכריזה}.',
      },
      { expectedCount: 1, from: 'עד הרחוב שלהן.', to: 'עד הרחוב {שלהם|שלהן}.' },
      {
        expectedCount: 1,
        from: 'בבית נכנסה {{childName}} למיטה, וקִים התכרבלה לידה.',
        to: 'בבית {נכנס|נכנסה} {{childName}} למיטה, וקִים התכרבלה {לידו|לידה}.',
      },
    ],
    directionReplacements: [
      {
        expectedCount: 1,
        pageNumber: 6,
        field: 'mainAction',
        from: 'with her backpack',
        to: "with the child's backpack",
      },
      {
        expectedCount: 1,
        pageNumber: 8,
        field: 'mainAction',
        from: 'Kim curled beside her',
        to: 'Kim curled beside the child',
      },
    ],
  };
}

function writeCanonical(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, materializer.canonicalBytes(value), 'utf8');
}

function technicalReview() {
  const payload = {
    version: lifecycle.TECHNICAL_REVIEW_VERSION,
    status: 'pass',
    reviewer: 'Claude Code',
    baseCommit: '1'.repeat(40),
    headCommit: '2'.repeat(40),
    blocker: 0,
    major: 0,
    minor: 0,
  };
  return { ...payload, digest: materializer.sha256(materializer.canonicalBytes(payload)) };
}

function buildFixture() {
  fs.mkdirSync(OUTPUTS_ROOT, { recursive: true });
  const root = fs.mkdtempSync(path.join(OUTPUTS_ROOT, 'story-source-lifecycle-test-'));
  temporaryRoots.push(root);
  const requestPath = path.join(root, 'request.json');
  writeCanonical(requestPath, requestFixture());
  const pendingDir = path.join(root, 'pending');
  const pending = materializer.buildStorySourceRevision({
    requestFile: materializer.readRequestFile(requestPath),
    outputDir: pendingDir,
    write: true,
  });
  const pendingPath = path.join(pendingDir, `${pending.manifest.digest}.manifest.json`);
  const technical = technicalReview();
  const technicalPath = path.join(root, `${technical.digest}.technical-review.json`);
  writeCanonical(technicalPath, technical);
  const reviewDir = path.join(root, 'review');
  const prepared = lifecycle.prepareReview({
    pendingManifestPath: relative(pendingPath),
    technicalReviewPath: relative(technicalPath),
    outputDir: relative(reviewDir),
    write: true,
  });
  const reviewPath = path.join(reviewDir, prepared.filename);
  return { pendingPath, prepared, reviewDir, reviewPath, root, technicalPath };
}

function acceptanceFixture(prepared: any, acceptedAt = '2026-08-22T12:00:00.000Z') {
  return {
    version: lifecycle.ACCEPTANCE_VERSION,
    status: 'accepted',
    acceptedBy: 'Guy',
    acceptedAt,
    storyKey: prepared.review.storyKey,
    revisionDigest: prepared.review.revisionDigest,
    sourceGenderMode: prepared.review.sourceGenderMode,
    metadataChanges: prepared.review.proposed.metadataChanges,
    acceptedStorySha256: prepared.review.proposed.acceptedStorySha256,
    visualDirectionSha256: prepared.review.proposed.visualDirectionSha256,
    integratedStorySha256: prepared.review.proposed.integratedStorySha256,
    directionMigration: prepared.review.proposed.directionMigration,
    pendingManifest: prepared.review.proposed.pendingManifest,
    reviewBundle: {
      digest: prepared.review.digest,
      sha256: prepared.reviewSha256,
    },
    exclusions: lifecycle.EXCLUSIONS,
    decision: 'I approve this exact gender-flexible Story Source revision.',
  };
}

function promotionFixture() {
  const fixture = buildFixture();
  const approvalRoot = path.join(fixture.root, 'approvals');
  const acceptedRoot = path.join(fixture.root, 'accepted');
  const legacyRoot = path.join(acceptedRoot, fixture.prepared.review.storyKey);
  fs.mkdirSync(legacyRoot, { recursive: true });
  const acceptancePath = path.join(
    approvalRoot,
    fixture.prepared.review.storyKey,
    `${fixture.prepared.review.revisionDigest}.product-acceptance.json`,
  );
  writeCanonical(acceptancePath, acceptanceFixture(fixture.prepared));
  const roots = {
    repoRoot: REPO_ROOT,
    outputsRootRelative: 'outputs',
    acceptedRootRelative: relative(acceptedRoot),
    approvalRootRelative: relative(approvalRoot),
  };
  return { ...fixture, acceptancePath, acceptedRoot, legacyRoot, roots };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    const resolved = path.resolve(root);
    if (resolved.startsWith(`${path.resolve(OUTPUTS_ROOT)}${path.sep}`)) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
});

describe('story source revision lifecycle', () => {
  it('builds a fresh v2 review with explicit neutral metadata and complete boy/girl projections', () => {
    const fixture = buildFixture();
    const review = fixture.prepared.review;

    expect(review.version).toBe('small-heroes-story-source-revision-review-bundle/v2');
    expect(review.sourceGenderMode).toBe('neutral');
    expect(review.proposed.metadataChanges).toEqual([
      { field: 'gender', from: 'female', to: 'neutral' },
    ]);
    expect(review.productReview.femaleProjection.text).toContain('gender: neutral');
    expect(review.productReview.maleProjection.text).toContain('gender: neutral');
    expect(review.productReview.femaleProjection.sha256).toBe(
      '19efe8f3f3f62adf219ee903f3a2b20be0ccc1cdcabf4cf75c9806d1483a872d',
    );
    expect(review.productReview.maleProjection.sha256).toBe(
      '75999df45ff3b7e04bd8d390c51fd892cf03154a3d56e7a64afe64cf8909ce8d',
    );
    expect(review.productReview.femaleProjection.proseByteIdenticalToPrevious).toBe(true);
    expect(fs.readdirSync(fixture.reviewDir)).toEqual([fixture.prepared.filename]);
    expect(fs.readFileSync(fixture.reviewPath, 'utf8')).toBe(
      materializer.canonicalBytes(review),
    );
    expect(() =>
      lifecycle.prepareReview({
        pendingManifestPath: relative(fixture.pendingPath),
        technicalReviewPath: relative(fixture.technicalPath),
        outputDir: relative(fixture.reviewDir),
        write: true,
      }),
    ).toThrow('story_source_revision_review_output_rejected');
  });

  it('accepts only an exact Guy decision with a canonical UTC timestamp', () => {
    const fixture = buildFixture();
    const valid = acceptanceFixture(fixture.prepared);
    expect(lifecycle.validateAcceptance(valid, fixture.prepared)).toEqual(valid);

    for (const acceptedAt of [
      '2026',
      '2026-08-22',
      '2026-08-22T12:00:00Z',
      '2026-08-22T12:00:00.000+00:00',
      '2026-02-30T12:00:00.000Z',
      '2026-13-01T12:00:00.000Z',
      '2026-08-22T24:00:00.000Z',
      'not-a-date',
    ]) {
      expect(() =>
        lifecycle.validateAcceptance({ ...valid, acceptedAt }, fixture.prepared),
      ).toThrow('story_source_revision_product_acceptance_invalid');
    }
    expect(() =>
      lifecycle.validateAcceptance({ ...valid, acceptedBy: 'Codex' }, fixture.prepared),
    ).toThrow('story_source_revision_product_acceptance_invalid');
    expect(() =>
      lifecycle.validateAcceptance({ ...valid, sourceGenderMode: 'female' }, fixture.prepared),
    ).toThrow('story_source_revision_product_acceptance_invalid');
    expect(() =>
      lifecycle.validateAcceptance({ ...valid, extra: true }, fixture.prepared),
    ).toThrow('story_source_revision_product_acceptance_invalid');
  });

  it('previews, atomically promotes, and byte-replays one immutable accepted revision', () => {
    const fixture = promotionFixture();
    const args = {
      pendingManifestPath: relative(fixture.pendingPath),
      reviewBundlePath: relative(fixture.reviewPath),
      acceptancePath: relative(fixture.acceptancePath),
    };
    const preview = lifecycle.promoteRevision({ ...args, write: false }, fixture.roots);
    expect(preview.created).toBe(false);
    expect(fs.existsSync(path.resolve(REPO_ROOT, preview.target))).toBe(false);

    const promoted = lifecycle.promoteRevision({ ...args, write: true }, fixture.roots);
    expect(promoted.created).toBe(true);
    const target = path.resolve(REPO_ROOT, promoted.target);
    expect(fs.readdirSync(target).sort()).toEqual([
      'direction-migration.json',
      'integrated.md',
      'manifest.json',
      'review-bundle.json',
      'revision-identity.json',
      'source-revision-manifest.json',
      'story.md',
      'visual-directions.json',
    ]);
    const manifest = JSON.parse(fs.readFileSync(path.join(target, 'manifest.json'), 'utf8'));
    expect(manifest.version).toBe(
      'small-heroes-product-accepted-story-source-revision-manifest/v2',
    );
    expect(manifest.sourceGenderMode).toBe('neutral');
    expect(manifest.metadataChanges).toEqual([
      { field: 'gender', from: 'female', to: 'neutral' },
    ]);
    expect(manifest.files.revisionIdentity.digest).toBe(promoted.revisionDigest);

    const inventory = new Map(
      fs.readdirSync(target).map((name) => [name, fs.readFileSync(path.join(target, name))]),
    );
    expect(lifecycle.promoteRevision({ ...args, write: true }, fixture.roots)).toEqual({
      created: false,
      revisionDigest: promoted.revisionDigest,
      target: promoted.target,
    });
    for (const [name, bytes] of inventory) {
      expect(fs.readFileSync(path.join(target, name))).toEqual(bytes);
    }
  });

  it('rejects linked review inputs, linked output parents, and hard-linked accepted replay bytes', () => {
    const fixture = promotionFixture();
    const technicalHardLink = path.join(fixture.root, 'technical-hard-link.json');
    fs.linkSync(fixture.technicalPath, technicalHardLink);
    expect(() =>
      lifecycle.prepareReview({
        pendingManifestPath: relative(fixture.pendingPath),
        technicalReviewPath: relative(technicalHardLink),
        outputDir: relative(path.join(fixture.root, 'other-review')),
        write: false,
      }),
    ).toThrow('story_source_revision_technical_review_path_rejected');
    fs.rmSync(technicalHardLink);

    const outside = fs.mkdtempSync(path.join(OUTPUTS_ROOT, 'story-source-lifecycle-outside-'));
    temporaryRoots.push(outside);
    const junction = path.join(fixture.root, 'review-junction');
    fs.symlinkSync(outside, junction, 'junction');
    expect(() =>
      lifecycle.prepareReview({
        pendingManifestPath: relative(fixture.pendingPath),
        technicalReviewPath: relative(fixture.technicalPath),
        outputDir: relative(path.join(junction, 'review')),
        write: true,
      }),
    ).toThrow('story_source_revision_review_output_rejected');

    const args = {
      pendingManifestPath: relative(fixture.pendingPath),
      reviewBundlePath: relative(fixture.reviewPath),
      acceptancePath: relative(fixture.acceptancePath),
    };
    const revisionsJunction = path.join(fixture.legacyRoot, 'revisions');
    fs.symlinkSync(outside, revisionsJunction, 'junction');
    expect(() =>
      lifecycle.promoteRevision({ ...args, write: true }, fixture.roots),
    ).toThrow('story_source_revision_accepted_target_invalid');
    fs.unlinkSync(revisionsJunction);

    const promoted = lifecycle.promoteRevision({ ...args, write: true }, fixture.roots);
    const target = path.resolve(REPO_ROOT, promoted.target);
    const storyPath = path.join(target, 'story.md');
    const copied = path.join(fixture.root, 'story-copy.md');
    fs.copyFileSync(storyPath, copied);
    fs.rmSync(storyPath);
    fs.linkSync(copied, storyPath);
    expect(() =>
      lifecycle.promoteRevision({ ...args, write: true }, fixture.roots),
    ).toThrow('story_source_revision_accepted_collision');
  });

  it('keeps v1/v3 lifecycle artifacts out and requires the exact CLI surface', () => {
    const fixture = promotionFixture();
    const pending = JSON.parse(fs.readFileSync(fixture.pendingPath, 'utf8'));
    const { digest: _pendingDigest, ...pendingPayload } = pending;
    const legacyPendingPayload = {
      ...pendingPayload,
      version: 'small-heroes-story-source-revision-pending-manifest/v3',
    };
    const legacyPending = {
      ...legacyPendingPayload,
      digest: materializer.sha256(materializer.canonicalBytes(legacyPendingPayload)),
    };
    expect(() => lifecycle.validatePendingShape(legacyPending)).toThrow(
      'story_source_revision_pending_invalid',
    );

    const { digest: _reviewDigest, ...reviewPayload } = fixture.prepared.review;
    const legacyReviewPayload = {
      ...reviewPayload,
      version: 'small-heroes-story-source-revision-review-bundle/v1',
    };
    const legacyReview = {
      ...legacyReviewPayload,
      digest: materializer.sha256(materializer.canonicalBytes(legacyReviewPayload)),
    };
    const legacyReviewPath = path.join(
      fixture.root,
      `${legacyReview.digest}.review-bundle.json`,
    );
    writeCanonical(legacyReviewPath, legacyReview);
    expect(() =>
      lifecycle.promoteRevision(
        {
          pendingManifestPath: relative(fixture.pendingPath),
          reviewBundlePath: relative(legacyReviewPath),
          acceptancePath: relative(fixture.acceptancePath),
          write: false,
        },
        fixture.roots,
      ),
    ).toThrow('story_source_revision_review_bundle_invalid');

    expect(lifecycle.REVIEW_VERSION).toBe(
      'small-heroes-story-source-revision-review-bundle/v2',
    );
    expect(lifecycle.REVISION_IDENTITY_VERSION).toBe(
      'small-heroes-story-source-revision-identity/v2',
    );
    expect(lifecycle.ACCEPTED_REVISION_VERSION).toBe(
      'small-heroes-product-accepted-story-source-revision-manifest/v2',
    );
    expect(
      lifecycle.parseArgs([
        'prepare-review',
        '--pending',
        'outputs/pending.json',
        '--technical-review',
        'outputs/review.json',
        '--out',
        'outputs/prepared',
        '--write',
        'false',
      ]),
    ).toEqual({
      command: 'prepare-review',
      pendingManifestPath: 'outputs/pending.json',
      technicalReviewPath: 'outputs/review.json',
      outputDir: 'outputs/prepared',
      write: false,
    });
    expect(() =>
      lifecycle.parseArgs([
        'prepare-review',
        '--pending',
        'outputs/pending.json',
        '--technical-review',
        'outputs/review.json',
        '--out',
        'outputs/prepared',
        '--write',
        'yes',
      ]),
    ).toThrow('story_source_revision_lifecycle_arguments_invalid');
  });

  it('loads no provider, render, storage, database, or deployment capability', () => {
    const fixture = buildFixture();
    const sentinelPath = path.join(fixture.root, 'forbidden-import-sentinel.cjs');
    fs.writeFileSync(
      sentinelPath,
      [
        "const Module = require('node:module');",
        'const originalLoad = Module._load;',
        "const forbidden = ['openai', 'replicate', '@supabase', 'generate-image', 'prisma', 'vercel'];",
        'Module._load = function(request, parent, isMain) {',
        "  if (forbidden.some((entry) => String(request).includes(entry))) throw new Error(`forbidden_external_import:${request}`);",
        '  return originalLoad.call(this, request, parent, isMain);',
        '};',
        '',
      ].join('\n'),
      'utf8',
    );
    const cleanLoad = spawnSync(
      process.execPath,
      ['--require', sentinelPath, '-e', "require('./scripts/story-source-revision-lifecycle.cjs')"],
      { cwd: REPO_ROOT, encoding: 'utf8', windowsHide: true },
    );
    expect({ stderr: cleanLoad.stderr, status: cleanLoad.status }).toEqual({
      stderr: '',
      status: 0,
    });
  });
});
