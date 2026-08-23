import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const lifecycle = require(
  '../../scripts/story-source-creative-replacement-lifecycle.cjs',
) as any;
const materializer = require(
  '../../scripts/materialize-story-source-revision.cjs',
) as any;

const REPO_ROOT = path.resolve(process.cwd());
const OUTPUTS_ROOT = path.join(REPO_ROOT, 'outputs');
const temporaryRoots: string[] = [];

function writeBytes(filePath: string, bytes: Buffer | string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, bytes);
}

function writeJson(filePath: string, value: unknown): void {
  writeBytes(filePath, materializer.canonicalBytes(value));
}

function relative(root: string, filePath: string): string {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function creativeBrief() {
  return {
    briefVersion: 'story-creative-brief/v1',
    id: 'test_story_creative_replacement_brief_v1',
    status: 'draft_for_guy_review',
    category: 'TRANSITION',
    direction: 'bedtime',
    pageCount: 2,
    workingTitle: 'A new beginning',
    mechanicKey: 'closed_route_mechanic',
    creativePromise: 'A child builds a visible route through a new place.',
    hiddenUnderlayer: 'A new place becomes legible through action.',
    openingHook: 'A small cart leaves before the child is ready.',
    childWant: 'The child wants one made object to arrive first.',
    physicalProblem: 'The cart follows incomplete labels.',
    playRule: 'A complete ordered chain makes one route.',
    setPieces: [{ id: 'set_one', name: 'Set one', dramaticUse: 'Start' }],
    lockedCausalMovement: [
      'The cart follows the first incomplete label.',
      'The child tests a closed loop and sees it fail.',
      'The child opens the loop and leads the final segment.',
    ],
    companionWrongHelp: 'The companion labels one clue as the whole route.',
    comicEscalations: [
      { level: 1, setup: 'One label', consequence: 'One wrong stop' },
    ],
    attempts: [{ attempt: 'Close a loop', failure: 'The cart returns' }],
    childDiscovery: 'The route needs an open end.',
    childClimaxAction: 'The child opens and leads the route.',
    visiblePayoff: 'The made object waits at the new place.',
    endingEnergy: 'The journey settles into bedtime.',
    recurringObjects: ['paper lantern', 'small cart'],
    transientCast: ['night guard'],
    rereadHooks: ['The open end is visible early.'],
    lineTargets: { childRepeatable: 'A path, not a ring.' },
    companionIndispensability: 'The companion records the ordered clues.',
    worldAndSafetyLocks: [
      'The cart remains slow and on pedestrian paths.',
      'The companion keeps one body and one accessory.',
    ],
    mustAvoid: ['A moral explaining the transition.'],
    oldStoryAntiCopy: ['Do not reuse the predecessor mechanism.'],
    modelFreedom: ['Spoken phrasing.'],
  };
}

function story(pageTwo = 'בבוקר, {{childName}} {ראה|ראתה} שהדרך חיכתה בשקט.') {
  return `---
title: "{{childName}} והדרך החדשה"
companionId: fox_uri
direction: bedtime
category: TRANSITION
pages: 2
gender: neutral
endingType: resolution
---

--- Page 1 ---

{{childName}} {פתח|פתחה} את השער, ואוּרי שמר על התיק הקטן.

--- Page 2 ---

${pageTwo}
`;
}

function editorialReview() {
  return {
    version: 'small-heroes-story-editorial-review/v1',
    verdict: 'pass',
    strengths: ['The child owns the causal action and the final visible payoff.'],
    issues: [],
    revisionPriorities: [],
    mustPreserve: ['Preserve the opened route and the child-led final segment.'],
  };
}

function buildFixture() {
  const root = fs.mkdtempSync(
    path.join(OUTPUTS_ROOT, 'creative-replacement-lifecycle-test-'),
  );
  temporaryRoots.push(root);
  const outputs = path.join(root, 'outputs');
  const acceptedRoot = path.join(
    root,
    'story-pipeline',
    '04_approved_story_sources',
    'accepted',
  );
  const revisionsRoot = path.join(acceptedRoot, 'test_story', 'revisions');
  const predecessorDigest = 'a'.repeat(64);
  const predecessorDir = path.join(revisionsRoot, predecessorDigest);
  fs.mkdirSync(predecessorDir, { recursive: true });
  const predecessorPayload = {
    version: 'small-heroes-product-accepted-story-source-revision-manifest/v2',
    status: 'product_accepted_story_source_revision',
    storyKey: 'test_story',
    revisionDigest: predecessorDigest,
  };
  const predecessor = {
    ...predecessorPayload,
    digest: materializer.sha256(materializer.canonicalBytes(predecessorPayload)),
  };
  const predecessorPath = path.join(predecessorDir, 'manifest.json');
  writeJson(predecessorPath, predecessor);
  const predecessorBytes = fs.readFileSync(predecessorPath);

  const briefPath = path.join(outputs, 'creative-brief.json');
  const storyPath = path.join(outputs, 'story.md');
  const reviewPath = path.join(outputs, 'editorial-review.json');
  writeJson(briefPath, creativeBrief());
  writeBytes(storyPath, story());
  writeJson(reviewPath, editorialReview());
  const storySha256 = materializer.sha256(fs.readFileSync(storyPath));
  const reviewSha256 = materializer.sha256(fs.readFileSync(reviewPath));
  const request = {
    version: lifecycle.REQUEST_VERSION,
    storyKey: 'test_story',
    sourceProfile: lifecycle.SOURCE_PROFILE,
    identity: {
      category: 'TRANSITION',
      companionId: 'fox_uri',
      direction: 'bedtime',
      pageCount: 2,
    },
    predecessor: {
      manifestPath: relative(root, predecessorPath),
      manifestSha256: materializer.sha256(predecessorBytes),
      revisionDigest: predecessorDigest,
    },
    creativeBrief: {
      path: relative(root, briefPath),
      sha256: materializer.sha256(fs.readFileSync(briefPath)),
    },
    storyRevision: {
      path: relative(root, storyPath),
      sha256: storySha256,
    },
    editorialReview: {
      path: relative(root, reviewPath),
      sha256: reviewSha256,
    },
    approvedStoryRevisionSha256: storySha256,
    approvedEditorialReviewSha256: reviewSha256,
    acceptedBy: 'Guy',
    acceptedAt: '2026-08-23T08:00:00.000Z',
    decision:
      'Guy approved the exact Story Revision and Editorial Review and authorized the general creative replacement route without render.',
  };
  const requestPath = path.join(outputs, 'request.json');
  writeJson(requestPath, request);
  const roots = {
    repoRoot: root,
    outputsRootRelative: 'outputs',
    acceptedRootRelative:
      'story-pipeline/04_approved_story_sources/accepted',
  };
  return {
    briefPath,
    predecessorBytes,
    predecessorPath,
    request,
    requestPath,
    reviewPath,
    roots,
    root,
    storyPath,
  };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('general Story Source creative replacement lifecycle', () => {
  it('previews, atomically publishes, and byte-replays one runtime-ineligible story-only revision', () => {
    const fixture = buildFixture();
    const requestPath = relative(fixture.root, fixture.requestPath);
    const preview = lifecycle.publish(
      { requestPath, write: false },
      fixture.roots,
    );

    expect(preview.created).toBe(false);
    expect(preview.manifest.version).toBe(lifecycle.ACCEPTED_REVISION_VERSION);
    expect(preview.manifest.authorityScope).toBe('story_text_only');
    expect(preview.manifest.sourceProfile).toBe('gender_flexible');
    expect(preview.manifest.sourceGenderMode).toBe('neutral');
    expect(preview.manifest.runtimeEligibility).toEqual({
      eligible: false,
      reason: 'visual_directions_not_approved',
    });
    expect(fs.existsSync(path.join(fixture.root, preview.target))).toBe(false);

    const published = lifecycle.publish(
      { requestPath, write: true },
      fixture.roots,
    );
    expect(published.created).toBe(true);
    expect(published.revisionDigest).toBe(preview.revisionDigest);
    const target = path.join(fixture.root, published.target);
    expect(fs.readdirSync(target).sort()).toEqual([
      'creative-brief.json',
      'editorial-review.json',
      'manifest.json',
      'product-acceptance.json',
      'review-bundle.json',
      'revision-identity.json',
      'story.md',
    ]);
    expect(fs.existsSync(path.join(target, 'integrated.md'))).toBe(false);
    expect(fs.existsSync(path.join(target, 'visual-directions.json'))).toBe(false);
    expect(fs.readFileSync(path.join(target, 'story.md'))).toEqual(
      fs.readFileSync(fixture.storyPath),
    );
    expect(fs.readFileSync(fixture.predecessorPath)).toEqual(
      fixture.predecessorBytes,
    );

    const acceptance = JSON.parse(
      fs.readFileSync(path.join(target, 'product-acceptance.json'), 'utf8'),
    );
    expect(acceptance.acceptedBy).toBe('Guy');
    expect(acceptance.approvedStoryRevisionSha256).toBe(
      fixture.request.approvedStoryRevisionSha256,
    );
    expect(acceptance.approvedEditorialReviewSha256).toBe(
      fixture.request.approvedEditorialReviewSha256,
    );

    const before = fs
      .readdirSync(target)
      .map((name) => [name, fs.readFileSync(path.join(target, name))] as const);
    const replay = lifecycle.publish(
      { requestPath, write: true },
      fixture.roots,
    );
    expect(replay).toEqual({ ...published, created: false });
    for (const [name, bytes] of before) {
      expect(fs.readFileSync(path.join(target, name))).toEqual(bytes);
    }

    fs.rmSync(path.join(fixture.root, 'outputs'), {
      recursive: true,
      force: true,
    });
    expect(
      lifecycle.loadAcceptedCreativeReplacement(
        { manifestPath: `${published.target}/manifest.json` },
        fixture.roots,
      ),
    ).toMatchObject({
      revisionDigest: published.revisionDigest,
      storyPath: `${published.target}/story.md`,
      storySha256: fixture.request.approvedStoryRevisionSha256,
    });
  });

  it('fails closed on collision and on a second successor from the same predecessor', () => {
    const collision = buildFixture();
    const collisionRequest = relative(collision.root, collision.requestPath);
    const published = lifecycle.publish(
      { requestPath: collisionRequest, write: true },
      collision.roots,
    );
    fs.appendFileSync(
      path.join(collision.root, published.target, 'story.md'),
      'tamper',
    );
    expect(() =>
      lifecycle.publish(
        { requestPath: collisionRequest, write: true },
        collision.roots,
      ),
    ).toThrow('story_source_creative_replacement_collision');

    const fork = buildFixture();
    const forkRequestPath = relative(fork.root, fork.requestPath);
    lifecycle.publish(
      { requestPath: forkRequestPath, write: true },
      fork.roots,
    );
    writeBytes(
      fork.storyPath,
      story('בבוקר, {{childName}} {גילה|גילתה} שהשביל החדש כבר חיכה.'),
    );
    const secondStorySha = materializer.sha256(fs.readFileSync(fork.storyPath));
    const secondRequest = {
      ...fork.request,
      storyRevision: {
        ...fork.request.storyRevision,
        sha256: secondStorySha,
      },
      approvedStoryRevisionSha256: secondStorySha,
    };
    writeJson(fork.requestPath, secondRequest);
    expect(() =>
      lifecycle.publish(
        { requestPath: forkRequestPath, write: false },
        fork.roots,
      ),
    ).toThrow('story_source_creative_replacement_predecessor_not_current');
  });

  it('rejects unlike approval, non-pass review, extra Brief keys, and hard-linked inputs', () => {
    const unlike = buildFixture();
    writeJson(unlike.requestPath, {
      ...unlike.request,
      approvedStoryRevisionSha256: 'b'.repeat(64),
    });
    expect(() =>
      lifecycle.publish(
        { requestPath: relative(unlike.root, unlike.requestPath), write: false },
        unlike.roots,
      ),
    ).toThrow('story_source_creative_replacement_request_invalid');

    const failedReview = buildFixture();
    writeJson(failedReview.reviewPath, {
      ...editorialReview(),
      verdict: 'revise',
      issues: [
        {
          code: 'causal_chain_gap',
          severity: 'minor',
          evidencePages: [2],
          functionalGap: 'The payoff needs revision.',
        },
      ],
      revisionPriorities: ['Repair the payoff.'],
    });
    const failedReviewSha = materializer.sha256(
      fs.readFileSync(failedReview.reviewPath),
    );
    writeJson(failedReview.requestPath, {
      ...failedReview.request,
      editorialReview: {
        ...failedReview.request.editorialReview,
        sha256: failedReviewSha,
      },
      approvedEditorialReviewSha256: failedReviewSha,
    });
    expect(() =>
      lifecycle.publish(
        {
          requestPath: relative(failedReview.root, failedReview.requestPath),
          write: false,
        },
        failedReview.roots,
      ),
    ).toThrow('story_source_creative_replacement_editorial_review_invalid');

    const extraBrief = buildFixture();
    writeJson(extraBrief.briefPath, {
      ...creativeBrief(),
      storyKeyOverride: 'test_story',
    });
    const extraBriefSha = materializer.sha256(
      fs.readFileSync(extraBrief.briefPath),
    );
    writeJson(extraBrief.requestPath, {
      ...extraBrief.request,
      creativeBrief: {
        ...extraBrief.request.creativeBrief,
        sha256: extraBriefSha,
      },
    });
    expect(() =>
      lifecycle.publish(
        {
          requestPath: relative(extraBrief.root, extraBrief.requestPath),
          write: false,
        },
        extraBrief.roots,
      ),
    ).toThrow('story_source_creative_replacement_brief_invalid');

    const hardLink = buildFixture();
    const hardLinkPath = path.join(path.dirname(hardLink.storyPath), 'story-link.md');
    fs.linkSync(hardLink.storyPath, hardLinkPath);
    writeJson(hardLink.requestPath, {
      ...hardLink.request,
      storyRevision: {
        path: relative(hardLink.root, hardLinkPath),
        sha256: hardLink.request.storyRevision.sha256,
      },
    });
    expect(() =>
      lifecycle.publish(
        {
          requestPath: relative(hardLink.root, hardLink.requestPath),
          write: false,
        },
        hardLink.roots,
      ),
    ).toThrow('story_source_creative_replacement_story_invalid');
  });

  it('keeps the CLI surface exact and closed', () => {
    expect(
      lifecycle.parseArgs([
        'publish',
        '--request',
        'outputs/request.json',
        '--write',
        'false',
      ]),
    ).toEqual({ requestPath: 'outputs/request.json', write: false });
    expect(() =>
      lifecycle.parseArgs([
        'publish',
        '--request',
        'outputs/request.json',
        '--write',
        'false',
        '--extra',
        'x',
      ]),
    ).toThrow('story_source_creative_replacement_arguments_invalid');
  });

  it('rebuilds accepted authority and rejects a hostile accepted-manifest key', () => {
    const fixture = buildFixture();
    const published = lifecycle.publish(
      {
        requestPath: relative(fixture.root, fixture.requestPath),
        write: true,
      },
      fixture.roots,
    );
    const manifestPath = path.join(
      fixture.root,
      published.target,
      'manifest.json',
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    writeJson(manifestPath, { ...manifest, runtimeOverride: true });
    expect(() =>
      lifecycle.loadAcceptedCreativeReplacement(
        { manifestPath: `${published.target}/manifest.json` },
        fixture.roots,
      ),
    ).toThrow('story_source_creative_replacement_accepted_invalid');
  });
});
