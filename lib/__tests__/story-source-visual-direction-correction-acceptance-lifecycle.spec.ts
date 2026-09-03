import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  DEFAULT_STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_OUTPUT_ROOT,
  materializeStorySourceVisualDirectionCorrectionCandidate,
  prepareStorySourceVisualDirectionCorrectionBatch,
} from '@/lib/visual-package/storySourceVisualDirectionCorrectionBatch';
import {
  acceptedProductLineageDisposition,
  loadAcceptedStorySourceAuthoringAuthority,
} from '@/lib/visual-package/acceptedStorySourceAuthoringAuthority';
import { auditWizardAllStoryRenderReadiness } from '@/lib/visual-package/wizardAllStoryRenderReadiness';

const require = createRequire(import.meta.url);
const lifecycle = require(
  '../../scripts/story-source-visual-direction-correction-acceptance-lifecycle.cjs',
) as any;
const materializer = require(
  '../../scripts/materialize-story-source-revision.cjs',
) as any;

const REPO_ROOT = path.resolve(process.cwd());
const STORY_KEY = 'dragon_dini_adventure';
const BATCH_DIGEST =
  '96154a39091b71c9dffb64dcf60b8667c149b78d4b4c0d5a07787189d00a7e9b';
const P1_REVISION_DIGEST =
  '64dcd0e741f17fc08cde95ad8a5a00b303955aa28ccd065d44f01e49e9d155fc';
const BATCH_PATH =
  `${DEFAULT_STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_OUTPUT_ROOT}/${BATCH_DIGEST}.json`;
const DECISION_SOURCE =
  'story-pipeline/04_approved_story_sources/approvals/' +
  'r3b1b-story-source-visual-direction-correction-product-decision.json';
const P1_PENDING_MANIFEST =
  `${DEFAULT_STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_OUTPUT_ROOT}/` +
  'request-identities/4a19ed8592597de780adcc36655f3e53085e32fd594cfef2d985b7c5f4e7ac6b/' +
  'records/dragon_dini_adventure/candidate/' +
  '71c8ba64f3fa6b5fabc46412646723dd85a8a7fce830cd287df07be8c18e09f8.manifest.json';
const FIXED_NOW = () => new Date('2026-09-03T12:00:00.000Z');

const temporaryRoots: string[] = [];
let removePreparedBatch = false;
let removeMaterializedRecord = false;

function repoRelative(absolutePath: string): string {
  return path.relative(REPO_ROOT, absolutePath).split('\\').join('/');
}

function writeCanonicalJson(filePath: string, value: unknown): Buffer {
  const bytes = Buffer.from(materializer.canonicalBytes(value), 'utf8');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, bytes, { flag: 'wx' });
  return bytes;
}

function signed(payload: Record<string, unknown>): Record<string, unknown> {
  return lifecycle.attachDigest(payload);
}

function directoryFileHashes(root: string): Record<string, string> {
  const result: Record<string, string> = {};
  const visit = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else if (entry.isFile()) {
        result[path.relative(root, absolute).split('\\').join('/')] =
          materializer.sha256(fs.readFileSync(absolute));
      }
    }
  };
  visit(root);
  return result;
}

function textReadinessWithoutSourcePath<T extends { sourcePath?: unknown } | null>(
  value: T,
) {
  if (!value) return value;
  const { sourcePath: _sourcePath, ...readiness } = value;
  return readiness;
}

function buildFixture() {
  const root = fs.mkdtempSync(
    path.join(REPO_ROOT, 'outputs', 'r3b1b-acceptance-test-'),
  );
  temporaryRoots.push(root);
  const rootRelative = repoRelative(root);
  const approvalRoot = path.join(root, 'approvals');
  fs.mkdirSync(approvalRoot, { recursive: true });
  const decisionPath = path.join(approvalRoot, 'product-decision.json');
  fs.copyFileSync(path.join(REPO_ROOT, DECISION_SOURCE), decisionPath);
  const roots = {
    approvalRootRelative: repoRelative(approvalRoot),
  };
  const inspectArgs = {
    decisionPath: repoRelative(decisionPath),
    pendingManifestPath: P1_PENDING_MANIFEST,
  };
  const inspected = lifecycle.inspect(inspectArgs, roots);
  const technicalReview = signed({
    version: lifecycle.TECHNICAL_REVIEW_VERSION,
    status: 'pass',
    reviewer: 'Claude Code',
    baseCommit: '1111111111111111111111111111111111111111',
    headCommit: '2222222222222222222222222222222222222222',
    p0: 0,
    p1: 0,
    p2: 2,
    candidateBatchDigest: inspected.candidateBatchDigest,
    productDecisionDigest: inspected.productDecisionDigest,
    recordDecisionDigest: inspected.recordDecisionDigest,
    revisionDigest: inspected.revisionDigest,
  });
  const technicalReviewPath = path.join(root, 'technical-review.json');
  writeCanonicalJson(technicalReviewPath, technicalReview);
  const productAcceptance = signed({
    version: lifecycle.PRODUCT_ACCEPTANCE_VERSION,
    status: 'accepted',
    acceptedBy: 'Guy',
    authorityScope: lifecycle.AUTHORITY_SCOPE,
    storyKey: inspected.storyKey,
    revisionDigest: inspected.revisionDigest,
    candidateRecordDigest: inspected.candidateRecordDigest,
    productDecisionDigest: inspected.productDecisionDigest,
    recordDecisionDigest: inspected.recordDecisionDigest,
    technicalReviewDigest: technicalReview.digest,
    acceptedWorldMode: inspected.acceptedWorldMode,
    decision:
      'Synthetic test-only final confirmation for the exact revision digest.',
    runtimeEligibility: lifecycle.RUNTIME_ELIGIBILITY,
    exclusions: lifecycle.EXCLUSIONS,
  });
  const productAcceptancePath = path.join(
    approvalRoot,
    'product-acceptance.json',
  );
  writeCanonicalJson(productAcceptancePath, productAcceptance);
  const acceptedRoot = path.join(root, 'accepted');
  fs.cpSync(
    path.join(
      REPO_ROOT,
      'story-pipeline/04_approved_story_sources/accepted',
    ),
    acceptedRoot,
    { recursive: true },
  );
  const fixtureRevisionRoot = path.join(
    acceptedRoot,
    STORY_KEY,
    'revisions',
    P1_REVISION_DIGEST,
  );
  if (fs.existsSync(fixtureRevisionRoot)) {
    fs.rmSync(fixtureRevisionRoot, { recursive: true, force: true });
  }
  return {
    acceptedRoot,
    acceptedRootRelative: repoRelative(acceptedRoot),
    approvalRoot,
    decisionPath,
    inspectArgs,
    inspected,
    outputRoot: `${rootRelative}/publication`,
    productAcceptance,
    productAcceptancePath,
    root,
    rootRelative,
    roots,
    technicalReview,
    technicalReviewPath,
  };
}

function publicationArgs(fixture: ReturnType<typeof buildFixture>) {
  return {
    ...fixture.inspectArgs,
    technicalReviewPath: repoRelative(fixture.technicalReviewPath),
    productAcceptancePath: repoRelative(fixture.productAcceptancePath),
    outputRoot: fixture.outputRoot,
  };
}

beforeAll(() => {
  const prepared = prepareStorySourceVisualDirectionCorrectionBatch({
    repoRoot: REPO_ROOT,
    write: true,
  });
  expect(prepared.batch.digest).toBe(BATCH_DIGEST);
  expect(prepared.artifact.path).toBe(BATCH_PATH);
  removePreparedBatch = prepared.artifact.created;
  const materialized =
    materializeStorySourceVisualDirectionCorrectionCandidate({
      repoRoot: REPO_ROOT,
      storyKey: STORY_KEY,
      write: true,
    });
  expect(materialized.pendingManifestPath).toBe(P1_PENDING_MANIFEST);
  removeMaterializedRecord = materialized.created;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

afterAll(() => {
  if (removePreparedBatch) {
    fs.rmSync(path.join(REPO_ROOT, BATCH_PATH), { force: true });
  }
  if (removeMaterializedRecord) {
    const candidateRoot = path.dirname(path.join(REPO_ROOT, P1_PENDING_MANIFEST));
    const recordRoot = path.dirname(candidateRoot);
    fs.rmSync(recordRoot, { recursive: true, force: true });
  }
});

describe('R3-B1b correction acceptance and publication lifecycle', () => {
  it('records the seven exact acceptance intents, thirteen directions, and P6 referral without publishing', () => {
    const decision = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, DECISION_SOURCE), 'utf8'),
    );
    expect(decision.digest).toBe(
      '9b625e71318cf3a26117bc89744a1e39c04d13f6d74f632cddab4aaa639113e8',
    );
    expect(decision).toMatchObject({
      version:
        'small-heroes-story-source-visual-direction-correction-product-decision/v2',
      candidateTechnicalQa: {
        p0: 0,
        p1: 0,
        p2: 3,
      },
      candidateTechnicalQaCloseout: {
        baseCommit: 'e7c7bf4a3dda1e06a692802000a0a93cb1646bd0',
        headCommit: 'e1df111f9b956fa360a03d53ef0bfc438bb29c2c',
        p0: 0,
        p1: 0,
        p2: 0,
        closes: {
          baseCommit: '462aaf4c19c7e8809284a96579fb993400e5a593',
          headCommit: '85ef104cd7765a3e0376bb5ec84a72e75103d9c8',
          p0: 0,
          p1: 0,
          p2: 3,
        },
      },
    });
    expect(decision.acceptedIntents.map((entry: any) => entry.decisionId)).toEqual([
      'P1',
      'P2',
      'P3',
      'P4',
      'P5',
      'P7',
      'P8',
    ]);
    expect(decision.coworkReferrals).toEqual([
      expect.objectContaining({
        decisionId: 'P6',
        status: 'referred_not_accepted',
      }),
    ]);
    expect(decision.correctionDirections.map((entry: any) => entry.decisionId)).toEqual(
      Array.from({ length: 13 }, (_value, index) => `D${index + 1}`),
    );
    expect(decision.correctionDirections[5].selection).toBe(
      'D6A_STORM_STRIPES_PURPLE_ORANGE_GOLD_OVERLAY',
    );

    const fixture = buildFixture();
    expect(fixture.inspected).toMatchObject({
      version: lifecycle.ACCEPTED_REVISION_VERSION,
      status: 'pending_implementation_technical_review_and_final_confirmation',
      storyKey: STORY_KEY,
      candidateBatchDigest: BATCH_DIGEST,
      revisionDigest:
        '64dcd0e741f17fc08cde95ad8a5a00b303955aa28ccd065d44f01e49e9d155fc',
      pendingRequirements: [
        'implementation_technical_review',
        'guy_final_digest_confirmation',
      ],
    });
    expect(Object.values(fixture.inspected.externalCounters)).toEqual(
      Array(10).fill(0),
    );
    expect(fs.existsSync(path.join(fixture.root, 'publication'))).toBe(false);
  });

  it('fails closed on referred P6, HOLD records, stale world mode, and absent final gates', () => {
    const fixture = buildFixture();
    const batch = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, BATCH_PATH), 'utf8'));
    const p6 = batch.records.find(
      (record: any) => record.storyKey === 'lion_shaket_adventure',
    );
    const hold = batch.records.find(
      (record: any) => record.storyKey === 'dragon_dini_fantasy',
    );
    expect(() =>
      lifecycle.inspect(
        {
          decisionPath: fixture.inspectArgs.decisionPath,
          pendingManifestPath:
            `${path.posix.dirname(p6.request.identityPath)}/candidate/` +
            p6.candidateOutputs.manifest.filename,
        },
        fixture.roots,
      ),
    ).toThrow('story_correction_candidate_not_accepted');
    expect(() =>
      lifecycle.inspect(
        {
          decisionPath: fixture.inspectArgs.decisionPath,
          pendingManifestPath:
            `${path.posix.dirname(hold.request.identityPath)}/candidate/` +
            hold.candidateOutputs.manifest.filename,
        },
        fixture.roots,
      ),
    ).toThrow('story_correction_candidate_not_accepted');

    const altered = JSON.parse(fs.readFileSync(fixture.decisionPath, 'utf8'));
    altered.acceptedIntents[0].worldMode = 'fantastical';
    const { digest: _digest, digestAlgorithm: _algorithm, ...payload } = altered;
    fs.rmSync(fixture.decisionPath);
    writeCanonicalJson(fixture.decisionPath, signed(payload));
    expect(() => lifecycle.inspect(fixture.inspectArgs, fixture.roots)).toThrow(
      'story_correction_candidate_record_invalid',
    );

    expect(() =>
      lifecycle.prepare(
        {
          ...fixture.inspectArgs,
          technicalReviewPath: 'outputs/does-not-exist.json',
          productAcceptancePath: repoRelative(fixture.productAcceptancePath),
          outputRoot: fixture.outputRoot,
          write: false,
        },
        fixture.roots,
      ),
    ).toThrow();
  });

  it('rejects substituted packet, batch, QA range, partial decision, and traversal identities', () => {
    const mutations = [
      (decision: any) => {
        decision.packet.sha256 = 'a'.repeat(64);
      },
      (decision: any) => {
        decision.candidateBatch.digest = 'b'.repeat(64);
      },
      (decision: any) => {
        decision.candidateTechnicalQa.headCommit = 'c'.repeat(40);
      },
      (decision: any) => {
        decision.candidateTechnicalQa.p2 = 0;
      },
      (decision: any) => {
        decision.candidateTechnicalQaCloseout.closes.p2 = 2;
      },
      (decision: any) => {
        decision.correctionDirections.pop();
      },
    ];
    for (const mutate of mutations) {
      const fixture = buildFixture();
      const decision = JSON.parse(fs.readFileSync(fixture.decisionPath, 'utf8'));
      mutate(decision);
      const { digest: _digest, digestAlgorithm: _algorithm, ...payload } = decision;
      fs.rmSync(fixture.decisionPath);
      writeCanonicalJson(fixture.decisionPath, signed(payload));
      expect(() => lifecycle.inspect(fixture.inspectArgs, fixture.roots)).toThrow(
        'story_correction_product_decision_invalid',
      );
    }

    const traversal = buildFixture();
    expect(() =>
      lifecycle.inspect(
        {
          ...traversal.inspectArgs,
          decisionPath:
            `${traversal.roots.approvalRootRelative}/../approvals/` +
            'product-decision.json',
        },
        traversal.roots,
      ),
    ).toThrow('story_correction_product_decision_invalid');
  });

  it('rejects substituted record, Story Source, and Visual Direction identities against the immutable batch', () => {
    for (const field of [
      'recordDigest',
      'storyCandidateSha256',
      'visualDirectionCandidateSha256',
    ]) {
      const fixture = buildFixture();
      const decision = JSON.parse(
        fs.readFileSync(fixture.decisionPath, 'utf8'),
      );
      decision.acceptedIntents[0][field] = 'f'.repeat(64);
      const {
        digest: _digest,
        digestAlgorithm: _algorithm,
        ...payload
      } = decision;
      fs.rmSync(fixture.decisionPath);
      writeCanonicalJson(fixture.decisionPath, signed(payload));
      expect(() => lifecycle.inspect(fixture.inspectArgs, fixture.roots)).toThrow(
        'story_correction_candidate_record_invalid',
      );
    }
  });

  it('rejects a non-Claude review and a final acceptance for another digest', () => {
    const invalidReview = buildFixture();
    const review = JSON.parse(
      fs.readFileSync(invalidReview.technicalReviewPath, 'utf8'),
    );
    review.reviewer = 'Codex';
    const { digest: _reviewDigest, digestAlgorithm: _reviewAlgorithm, ...reviewPayload } =
      review;
    fs.rmSync(invalidReview.technicalReviewPath);
    writeCanonicalJson(invalidReview.technicalReviewPath, signed(reviewPayload));
    expect(() =>
      lifecycle.prepare(
        { ...publicationArgs(invalidReview), write: false },
        invalidReview.roots,
      ),
    ).toThrow('story_correction_technical_review_invalid');

    const invalidAcceptance = buildFixture();
    const acceptance = JSON.parse(
      fs.readFileSync(invalidAcceptance.productAcceptancePath, 'utf8'),
    );
    acceptance.revisionDigest = 'd'.repeat(64);
    const {
      digest: _acceptanceDigest,
      digestAlgorithm: _acceptanceAlgorithm,
      ...acceptancePayload
    } = acceptance;
    fs.rmSync(invalidAcceptance.productAcceptancePath);
    writeCanonicalJson(
      invalidAcceptance.productAcceptancePath,
      signed(acceptancePayload),
    );
    expect(() =>
      lifecycle.prepare(
        { ...publicationArgs(invalidAcceptance), write: false },
        invalidAcceptance.roots,
      ),
    ).toThrow('story_correction_product_acceptance_invalid');
  });

  it('prepares, atomically publishes to a temporary root, and replays byte-identically', () => {
    const fixture = buildFixture();
    const args = publicationArgs(fixture);
    const preview = lifecycle.prepare(
      { ...args, write: false },
      fixture.roots,
    );
    expect(preview.created).toBe(false);
    expect(preview.revisionDigest).toBe(fixture.inspected.revisionDigest);
    expect([...preview.bundle.files.keys()].sort()).toEqual(
      [...lifecycle.EXPECTED_INVENTORY].sort(),
    );
    expect(fs.existsSync(path.join(fixture.root, 'publication'))).toBe(false);

    const prepared = lifecycle.prepare(
      { ...args, write: true },
      fixture.roots,
    );
    expect(prepared.created).toBe(true);
    expect(fs.readdirSync(path.join(REPO_ROOT, prepared.target)).sort()).toEqual(
      [...lifecycle.EXPECTED_INVENTORY].sort(),
    );
    const replay = lifecycle.prepare(
      { ...args, write: true },
      fixture.roots,
    );
    expect(replay.created).toBe(false);
    expect(replay.manifestDigest).toBe(prepared.manifestDigest);

    const published = lifecycle.publish(
      { ...args, write: true },
      {
        ...fixture.roots,
        acceptedRootRelative: fixture.acceptedRootRelative,
      },
    );
    expect(published.created).toBe(true);
    const publishedReplay = lifecycle.publish(
      { ...args, write: true },
      {
        ...fixture.roots,
        acceptedRootRelative: fixture.acceptedRootRelative,
      },
    );
    expect(publishedReplay.created).toBe(false);
    expect(publishedReplay.revisionDigest).toBe(published.revisionDigest);

    const storyPath =
      `${fixture.acceptedRootRelative}/${STORY_KEY}/revisions/` +
      `${published.revisionDigest}/integrated.md`;
    const authority = loadAcceptedStorySourceAuthoringAuthority({
      repoRoot: REPO_ROOT,
      storyKey: STORY_KEY,
      storyPath,
      acceptedRootRelative: fixture.acceptedRootRelative,
    });
    expect(authority).toMatchObject({
      revisionDigest: published.revisionDigest,
      manifestDigest: published.manifestDigest,
      productAcceptanceDigest: fixture.productAcceptance.digest,
      technicalReviewDigest: fixture.technicalReview.digest,
    });
    expect(Object.keys(authority!.fileSha256).sort()).toEqual(
      [...lifecycle.EXPECTED_INVENTORY].sort(),
    );
    expect(
      acceptedProductLineageDisposition({
        repoRoot: REPO_ROOT,
        storyKey: STORY_KEY,
        acceptedRootRelative: fixture.acceptedRootRelative,
      }),
    ).toEqual({ kind: 'present' });
  });

  it('rejects conflicting publication bytes and hardlinked accepted inventory', () => {
    const fixture = buildFixture();
    const args = publicationArgs(fixture);
    const prepared = lifecycle.prepare(
      { ...args, write: true },
      fixture.roots,
    );
    const candidateStory = path.join(REPO_ROOT, prepared.target, 'story.md');
    fs.appendFileSync(candidateStory, 'collision');
    expect(() =>
      lifecycle.prepare({ ...args, write: true }, fixture.roots),
    ).toThrow('story_correction_publication_candidate_collision');

    fs.rmSync(path.join(REPO_ROOT, prepared.target), {
      recursive: true,
      force: true,
    });
    lifecycle.prepare({ ...args, write: true }, fixture.roots);
    const published = lifecycle.publish(
      { ...args, write: true },
      {
        ...fixture.roots,
        acceptedRootRelative: fixture.acceptedRootRelative,
      },
    );
    const revisionRoot = path.join(REPO_ROOT, published.target);
    const story = path.join(revisionRoot, 'story.md');
    const held = path.join(fixture.root, 'held-story.md');
    fs.renameSync(story, held);
    fs.linkSync(held, story);
    expect(() =>
      loadAcceptedStorySourceAuthoringAuthority({
        repoRoot: REPO_ROOT,
        storyKey: STORY_KEY,
        storyPath:
          `${fixture.acceptedRootRelative}/${STORY_KEY}/revisions/` +
          `${published.revisionDigest}/integrated.md`,
        acceptedRootRelative: fixture.acceptedRootRelative,
      }),
    ).toThrow('accepted_story_source_inventory_file_invalid');
  });

  it('rejects a partial accepted inventory and a junction-aliased revision root', () => {
    const partial = buildFixture();
    const partialArgs = publicationArgs(partial);
    lifecycle.prepare({ ...partialArgs, write: true }, partial.roots);
    const partialPublished = lifecycle.publish(
      { ...partialArgs, write: true },
      {
        ...partial.roots,
        acceptedRootRelative: partial.acceptedRootRelative,
      },
    );
    const partialRoot = path.join(REPO_ROOT, partialPublished.target);
    fs.rmSync(path.join(partialRoot, 'direction-migration.json'));
    expect(() =>
      loadAcceptedStorySourceAuthoringAuthority({
        repoRoot: REPO_ROOT,
        storyKey: STORY_KEY,
        storyPath:
          `${partial.acceptedRootRelative}/${STORY_KEY}/revisions/` +
          `${partialPublished.revisionDigest}/integrated.md`,
        acceptedRootRelative: partial.acceptedRootRelative,
      }),
    ).toThrow('accepted_story_source_inventory_invalid');

    const aliased = buildFixture();
    const aliasedArgs = publicationArgs(aliased);
    lifecycle.prepare({ ...aliasedArgs, write: true }, aliased.roots);
    const aliasedPublished = lifecycle.publish(
      { ...aliasedArgs, write: true },
      {
        ...aliased.roots,
        acceptedRootRelative: aliased.acceptedRootRelative,
      },
    );
    const revisionRoot = path.join(REPO_ROOT, aliasedPublished.target);
    const heldRoot = path.join(aliased.root, 'held-revision');
    fs.renameSync(revisionRoot, heldRoot);
    fs.symlinkSync(
      heldRoot,
      revisionRoot,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    expect(() =>
      loadAcceptedStorySourceAuthoringAuthority({
        repoRoot: REPO_ROOT,
        storyKey: STORY_KEY,
        storyPath:
          `${aliased.acceptedRootRelative}/${STORY_KEY}/revisions/` +
          `${aliasedPublished.revisionDigest}/integrated.md`,
        acceptedRootRelative: aliased.acceptedRootRelative,
      }),
    ).toThrow('accepted_story_source_inventory_alias_rejected');
  });

  it('changes only the accepted-source readiness facts in the single-record proof', () => {
    vi.stubEnv('ENABLE_V3_APPROVED_BANK', 'true');
    vi.stubEnv('ENABLE_WIZARD_QA_RENDER_CATALOG', 'false');
    const canonicalAcceptedRoot = path.join(
      REPO_ROOT,
      'story-pipeline/04_approved_story_sources/accepted',
    );
    const acceptedBytesBefore = directoryFileHashes(canonicalAcceptedRoot);
    const fixture = buildFixture();
    const args = publicationArgs(fixture);
    const baseline = auditWizardAllStoryRenderReadiness({
      repoRoot: REPO_ROOT,
      now: FIXED_NOW,
      acceptedRootRelative: fixture.acceptedRootRelative,
    });
    lifecycle.prepare({ ...args, write: true }, fixture.roots);
    lifecycle.publish(
      { ...args, write: true },
      {
        ...fixture.roots,
        acceptedRootRelative: fixture.acceptedRootRelative,
      },
    );
    const after = auditWizardAllStoryRenderReadiness({
      repoRoot: REPO_ROOT,
      now: FIXED_NOW,
      acceptedRootRelative: fixture.acceptedRootRelative,
    });
    expect(after.summary).toEqual({
      ...baseline.summary,
      acceptedProductLineageCount:
        baseline.summary.acceptedProductLineageCount + 1,
      sourceCorpusConflictCount: baseline.summary.sourceCorpusConflictCount,
      supportedGenderProjectionReadyCount:
        baseline.summary.supportedGenderProjectionReadyCount + 1,
      supportedNarrationAutomatedPreflightReadyCount:
        baseline.summary.supportedNarrationAutomatedPreflightReadyCount + 1,
      softTtsReviewItemCount: baseline.summary.softTtsReviewItemCount - 2,
      storiesWithSoftTtsReviewItemsCount:
        baseline.summary.storiesWithSoftTtsReviewItemsCount - 1,
    });
    const beforeByStory = new Map(
      baseline.records.map((record) => [record.storyKey, record]),
    );
    for (const record of after.records) {
      if (record.storyKey === STORY_KEY) continue;
      const before = beforeByStory.get(record.storyKey)!;
      expect({
        acceptedProductLineage: record.acceptedProductLineage,
        authoringPolicy: record.authoringPolicy,
        earliestBlocker: record.earliestBlocker,
        nextCanonicalAction: record.nextCanonicalAction,
        productTextReadiness: textReadinessWithoutSourcePath(
          record.productTextReadiness,
        ),
        productionStages: record.productionStages,
        qaTextReadiness: record.qaTextReadiness,
      }).toEqual({
        acceptedProductLineage: before.acceptedProductLineage,
        authoringPolicy: before.authoringPolicy,
        earliestBlocker: before.earliestBlocker,
        nextCanonicalAction: before.nextCanonicalAction,
        productTextReadiness: textReadinessWithoutSourcePath(
          before.productTextReadiness,
        ),
        productionStages: before.productionStages,
        qaTextReadiness: before.qaTextReadiness,
      });
    }
    const p1 = after.records.find((record) => record.storyKey === STORY_KEY)!;
    expect(p1.sources.currentProductSourceRole).toBe('accepted_product_source');
    expect(p1.sources.corpusDecisionRequired).toBe(false);
    expect(p1.productionStages.acceptedSourceRevision).toBe(true);
    expect(p1.productionStages.renderQualified).toBe(false);
    expect(p1.productTextReadiness).toMatchObject({
      supportedGenderProjectionReady: true,
      supportedNarrationInputReady: true,
      supportedCriticalTtsGateReady: true,
      supportedNarrationAutomatedPreflightReady: true,
      softTtsReviewItemCount: 0,
    });
    expect(directoryFileHashes(canonicalAcceptedRoot)).toEqual(
      acceptedBytesBefore,
    );
  });

  it('rejects an accepted-root traversal before revision inventory enumeration', () => {
    vi.stubEnv('ENABLE_V3_APPROVED_BANK', 'true');
    vi.stubEnv('ENABLE_WIZARD_QA_RENDER_CATALOG', 'false');
    expect(() =>
      auditWizardAllStoryRenderReadiness({
        repoRoot: REPO_ROOT,
        now: FIXED_NOW,
        acceptedRootRelative: '../outside-accepted-root',
      }),
    ).toThrow('accepted_story_source_root_path_invalid');
  });

  it('keeps the operator surface provider-free and strict about commands', () => {
    const source = fs.readFileSync(
      path.join(
        REPO_ROOT,
        'scripts/story-source-visual-direction-correction-acceptance-lifecycle.cjs',
      ),
      'utf8',
    );
    expect(source).not.toMatch(/openai|anthropic|elevenlabs|fetch\s*\(|prisma/i);
    expect(() => lifecycle.parseArgs(['publish'])).toThrow(
      'story_correction_acceptance_arguments_invalid',
    );
    expect(() => lifecycle.parseArgs(['erase'])).toThrow(
      'story_correction_acceptance_arguments_invalid',
    );
  });
});
