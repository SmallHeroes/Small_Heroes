import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const lifecycle = require(
  '../../scripts/story-source-visual-direction-acceptance-lifecycle.cjs',
) as any;
const materializer = require(
  '../../scripts/materialize-story-source-revision.cjs',
) as any;

const REPO_ROOT = path.resolve(process.cwd());
const OUTPUTS_ROOT = path.join(REPO_ROOT, 'outputs');
const STORY_KEY = 'chameleon_koko_bedtime';
const CANDIDATE_DIGEST =
  '3ef645415b3cdd5945baeaa275d97ae0aa0491bf30addbcc46208475278f534a';
const REVIEW_BUNDLE_DIGEST =
  'fa519a11bca42e0d565479329b9d5c0767972814ee28d6e73a764a35a1a3b57c';
const ENRICHMENT_ROOT =
  'outputs/r1d-chameleon-first-kindergarten-visual-directions-v1';
const ACCEPTED_STORY_ROOT =
  'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime';
const temporaryRoots: string[] = [];

function relative(root: string, target: string): string {
  return path.relative(root, target).replace(/\\/g, '/');
}

function writePrettyJson(filePath: string, value: unknown): Buffer {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, bytes);
  return bytes;
}

function writeCanonicalJson(filePath: string, value: unknown): Buffer {
  const bytes = Buffer.from(materializer.canonicalBytes(value), 'utf8');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, bytes);
  return bytes;
}

function buildFixture() {
  const root = fs.mkdtempSync(
    path.join(OUTPUTS_ROOT, 'visual-direction-acceptance-test-'),
  );
  temporaryRoots.push(root);
  const acceptedTarget = path.join(root, ACCEPTED_STORY_ROOT);
  fs.mkdirSync(path.dirname(acceptedTarget), { recursive: true });
  fs.cpSync(path.join(REPO_ROOT, ACCEPTED_STORY_ROOT), acceptedTarget, {
    recursive: true,
  });
  const enrichmentTarget = path.join(root, ENRICHMENT_ROOT);
  fs.mkdirSync(path.dirname(enrichmentTarget), { recursive: true });
  fs.cpSync(path.join(REPO_ROOT, ENRICHMENT_ROOT), enrichmentTarget, {
    recursive: true,
  });
  const reviewPayload = {
    version: lifecycle.TECHNICAL_REVIEW_VERSION,
    status: 'pass',
    reviewer: 'Claude Code',
    baseCommit: '15fa4c9dc2d2757a7b82e41d98207a51c633cb8f',
    headCommit: '67d08a31ea6e822f0c4f2bd3e225a5dad5b0bbd0',
    blocker: 0,
    major: 0,
    minor: 1,
    acceptedMinor: [
      {
        code: 'node_type_stripping_runtime_coupling',
        disposition: 'accepted_non_blocking',
        note: 'Verified on Node 22.19; repository-wide runtime pinning remains separate hardening.',
      },
    ],
    candidateDigest: CANDIDATE_DIGEST,
    reviewBundleDigest: REVIEW_BUNDLE_DIGEST,
  };
  const review = lifecycle.attachDigest(reviewPayload);
  const reviewPath = path.join(root, 'outputs/acceptance/technical-review.json');
  const reviewBytes = writeCanonicalJson(reviewPath, review);
  const request = {
    version: lifecycle.REQUEST_VERSION,
    storyKey: STORY_KEY,
    candidate: {
      requestPath: `${ENRICHMENT_ROOT}/request.json`,
      outputRoot: `${ENRICHMENT_ROOT}/candidates`,
      candidateDigest: CANDIDATE_DIGEST,
      reviewBundleDigest: REVIEW_BUNDLE_DIGEST,
    },
    technicalReview: {
      path: relative(root, reviewPath),
      bytes: reviewBytes.length,
      sha256: materializer.sha256(reviewBytes),
      digest: review.digest,
    },
    productAcceptance: {
      acceptedBy: 'Guy',
      acceptedAt: '2026-08-23T12:00:00.000Z',
      decision:
        'Guy approved the exact Visual Directions Candidate and Review Bundle.',
    },
  };
  const requestPath = path.join(root, 'outputs/acceptance/request.json');
  writePrettyJson(requestPath, request);
  return {
    outputRoot: 'outputs/acceptance/publication-candidates',
    request,
    requestPath,
    review,
    reviewPath,
    root,
  };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('general Visual Directions acceptance and publication lifecycle', () => {
  it('prepares one exact runtime-ineligible publication bundle and byte-replays it', () => {
    const fixture = buildFixture();
    const args = {
      requestPath: relative(fixture.root, fixture.requestPath),
      outputRoot: fixture.outputRoot,
    };
    const preview = lifecycle.prepare(
      { ...args, write: false },
      { repoRoot: fixture.root },
    );
    expect(preview.created).toBe(false);
    expect(preview.revisionDigest).toBe(CANDIDATE_DIGEST);
    expect(preview.runtimeEligibility).toEqual({
      eligible: false,
      reason: 'accepted_story_source_requires_fresh_visual_contract',
    });
    expect(fs.existsSync(path.join(fixture.root, fixture.outputRoot))).toBe(false);

    const written = lifecycle.prepare(
      { ...args, write: true },
      { repoRoot: fixture.root },
    );
    expect(written.created).toBe(true);
    const target = path.join(fixture.root, written.target);
    expect(fs.readdirSync(target).sort()).toEqual([
      'enrichment-manifest.json',
      'enrichment-review-bundle.json',
      'integrated.md',
      'manifest.json',
      'product-acceptance.json',
      'revision-identity.json',
      'story.md',
      'technical-review.json',
      'visual-directions.json',
    ]);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(target, 'manifest.json'), 'utf8'),
    );
    expect(manifest.revisionDigest).toBe(CANDIDATE_DIGEST);
    expect(manifest.files.enrichmentReviewBundle.digest).toBe(
      REVIEW_BUNDLE_DIGEST,
    );
    expect(manifest.runtimeEligibility).toEqual(preview.runtimeEligibility);
    expect(
      fs.readFileSync(path.join(target, 'revision-identity.json')).equals(
        fs.readFileSync(
          path.join(
            fixture.root,
            ENRICHMENT_ROOT,
            'candidates',
            CANDIDATE_DIGEST,
            'revision-identity.json',
          ),
        ),
      ),
    ).toBe(true);

    const replay = lifecycle.prepare(
      { ...args, write: true },
      { repoRoot: fixture.root },
    );
    expect(replay.created).toBe(false);
    expect(replay.manifestDigest).toBe(written.manifestDigest);
    expect(replay.productAcceptanceDigest).toBe(
      written.productAcceptanceDigest,
    );
  });

  it('publishes only an exact staged bundle and replays one complete accepted directory', () => {
    const fixture = buildFixture();
    const args = {
      requestPath: relative(fixture.root, fixture.requestPath),
      outputRoot: fixture.outputRoot,
    };
    expect(() =>
      lifecycle.publish(
        { ...args, write: false },
        { repoRoot: fixture.root },
      ),
    ).toThrow('story_visual_direction_publication_candidate_missing');
    lifecycle.prepare({ ...args, write: true }, { repoRoot: fixture.root });
    const preview = lifecycle.publish(
      { ...args, write: false },
      { repoRoot: fixture.root },
    );
    expect(preview.created).toBe(false);
    expect(preview.wouldCreate).toBe(true);
    expect(fs.existsSync(path.join(fixture.root, preview.target))).toBe(false);

    const published = lifecycle.publish(
      { ...args, write: true },
      { repoRoot: fixture.root },
    );
    expect(published.created).toBe(true);
    expect(published.wouldCreate).toBe(false);
    expect(fs.readdirSync(path.join(fixture.root, published.target)).length).toBe(
      9,
    );
    const replay = lifecycle.publish(
      { ...args, write: true },
      { repoRoot: fixture.root },
    );
    expect(replay.created).toBe(false);
    expect(replay.wouldCreate).toBe(false);
    expect(replay.manifestDigest).toBe(published.manifestDigest);
  });

  it('fails closed on stale authority, wrong approver, HOLD review, and hardlinks', () => {
    const stale = buildFixture();
    stale.request.candidate.reviewBundleDigest = 'f'.repeat(64);
    writePrettyJson(stale.requestPath, stale.request);
    expect(() =>
      lifecycle.prepare(
        {
          requestPath: relative(stale.root, stale.requestPath),
          outputRoot: stale.outputRoot,
          write: false,
        },
        { repoRoot: stale.root },
      ),
    ).toThrow('story_visual_direction_acceptance_candidate_invalid');

    const wrongApprover = buildFixture();
    wrongApprover.request.productAcceptance.acceptedBy = 'Codex';
    writePrettyJson(wrongApprover.requestPath, wrongApprover.request);
    expect(() =>
      lifecycle.prepare(
        {
          requestPath: relative(wrongApprover.root, wrongApprover.requestPath),
          outputRoot: wrongApprover.outputRoot,
          write: false,
        },
        { repoRoot: wrongApprover.root },
      ),
    ).toThrow('story_visual_direction_acceptance_request_invalid');

    const held = buildFixture();
    const heldPayload = {
      ...held.review,
      status: 'hold',
    };
    delete (heldPayload as any).digest;
    const heldReview = lifecycle.attachDigest(
      (({ digestAlgorithm: _digestAlgorithm, ...payload }) => payload)(heldPayload),
    );
    const heldBytes = writeCanonicalJson(held.reviewPath, heldReview);
    held.request.technicalReview.bytes = heldBytes.length;
    held.request.technicalReview.sha256 = materializer.sha256(heldBytes);
    held.request.technicalReview.digest = heldReview.digest;
    writePrettyJson(held.requestPath, held.request);
    expect(() =>
      lifecycle.prepare(
        {
          requestPath: relative(held.root, held.requestPath),
          outputRoot: held.outputRoot,
          write: false,
        },
        { repoRoot: held.root },
      ),
    ).toThrow('story_visual_direction_technical_review_invalid');

    const linked = buildFixture();
    const hardlinkPath = path.join(
      linked.root,
      'outputs/acceptance/technical-review-hardlink.json',
    );
    fs.linkSync(linked.reviewPath, hardlinkPath);
    linked.request.technicalReview.path = relative(linked.root, hardlinkPath);
    writePrettyJson(linked.requestPath, linked.request);
    expect(() =>
      lifecycle.prepare(
        {
          requestPath: relative(linked.root, linked.requestPath),
          outputRoot: linked.outputRoot,
          write: false,
        },
        { repoRoot: linked.root },
      ),
    ).toThrow('story_visual_direction_technical_review_invalid');
  });

  it('rejects staging and accepted-target collisions without partial replacement', () => {
    const staged = buildFixture();
    const args = {
      requestPath: relative(staged.root, staged.requestPath),
      outputRoot: staged.outputRoot,
    };
    const prepared = lifecycle.prepare(
      { ...args, write: true },
      { repoRoot: staged.root },
    );
    fs.writeFileSync(path.join(staged.root, prepared.target, 'unexpected.txt'), 'x');
    expect(() =>
      lifecycle.publish(
        { ...args, write: false },
        { repoRoot: staged.root },
      ),
    ).toThrow('story_visual_direction_publication_candidate_collision');

    const accepted = buildFixture();
    const acceptedArgs = {
      requestPath: relative(accepted.root, accepted.requestPath),
      outputRoot: accepted.outputRoot,
    };
    lifecycle.prepare(
      { ...acceptedArgs, write: true },
      { repoRoot: accepted.root },
    );
    const target = path.join(
      accepted.root,
      ACCEPTED_STORY_ROOT,
      'revisions',
      CANDIDATE_DIGEST,
    );
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'hostile.txt'), 'collision');
    expect(() =>
      lifecycle.publish(
        { ...acceptedArgs, write: true },
        { repoRoot: accepted.root },
      ),
    ).toThrow('story_visual_direction_accepted_revision_collision');
    expect(fs.readFileSync(path.join(target, 'hostile.txt'), 'utf8')).toBe(
      'collision',
    );
  });

  it('keeps CLI and production code closed to story-specific or external capabilities', () => {
    const productionSource = fs.readFileSync(
      path.join(
        REPO_ROOT,
        'scripts',
        'story-source-visual-direction-acceptance-lifecycle.cjs',
      ),
      'utf8',
    );
    expect(productionSource).not.toMatch(
      /bar|kim|chameleon|kindergarten|lantern|bedtime|3ef64541|fa519a11/i,
    );
    expect(productionSource).not.toMatch(
      /fetch\s*\(|https?:|openai|anthropic|replicate|supabase|prisma|child_process|execFile|spawn/i,
    );
    expect(
      lifecycle.parseArgs([
        'prepare',
        '--request',
        'outputs/request.json',
        '--output-root',
        'outputs/publication-candidates',
        '--write',
        'false',
      ]),
    ).toEqual({
      command: 'prepare',
      requestPath: 'outputs/request.json',
      outputRoot: 'outputs/publication-candidates',
      write: false,
    });
    expect(() =>
      lifecycle.parseArgs([
        'publish',
        '--request',
        'outputs/request.json',
        '--output-root',
        'outputs/publication-candidates',
        '--write',
        'true',
        '--locator',
        'visual-packages/current.json',
      ]),
    ).toThrow('story_visual_direction_acceptance_arguments_invalid');
  });
});
