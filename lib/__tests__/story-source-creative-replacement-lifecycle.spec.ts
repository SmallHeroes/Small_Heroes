import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

import { afterEach, describe, expect, it, vi } from 'vitest';

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
  vi.restoreAllMocks();
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function buildV4Fixture() {
  const fixture = buildFixture();
  const storyKey = 'dragon_dini_adventure';
  const digest = '64dcd0e741f17fc08cde95ad8a5a00b303955aa28ccd065d44f01e49e9d155fc';
  const predecessorRoot = `story-pipeline/04_approved_story_sources/accepted/${storyKey}/revisions/${digest}`;
  fs.cpSync(path.join(REPO_ROOT, predecessorRoot), path.join(fixture.root, predecessorRoot), { recursive: true });
  const predecessorPath = path.join(fixture.root, predecessorRoot, 'manifest.json');
  const bytes = fs.readFileSync(predecessorPath);
  const brief = { ...creativeBrief(), category: 'NEW_SIBLING', direction: 'adventure', pageCount: 12 };
  writeJson(fixture.briefPath, brief);
  const text = `---\ntitle: "{{childName}} והדרך החדשה"\ncompanionId: dragon_dini\ndirection: adventure\ncategory: NEW_SIBLING\npages: 12\ngender: neutral\nendingType: resolution\n---\n\n${Array.from({ length: 12 }, (_, i) => `--- Page ${i + 1} ---\n\n{{childName}} {פתח|פתחה} את השער.\n`).join('\n')}`;
  writeBytes(fixture.storyPath, text);
  const request = {
    ...fixture.request, storyKey,
    identity: { companionId: 'dragon_dini', category: 'NEW_SIBLING', direction: 'adventure', pageCount: 12 },
    predecessor: { manifestPath: relative(fixture.root, predecessorPath), manifestSha256: materializer.sha256(bytes), revisionDigest: digest },
    creativeBrief: { ...fixture.request.creativeBrief, sha256: materializer.sha256(fs.readFileSync(fixture.briefPath)) },
    storyRevision: { ...fixture.request.storyRevision, sha256: materializer.sha256(text) },
    approvedStoryRevisionSha256: materializer.sha256(text),
  };
  writeJson(fixture.requestPath, request);
  return { ...fixture, request, predecessorPath, predecessorRoot, predecessorBytes: bytes };
}

function buildOriginalFixture(storyKey = 'panda_anat_adventure') {
  const fixture = buildFixture();
  const acceptedRoot = 'story-pipeline/04_approved_story_sources/accepted';
  const originalRoot = `${acceptedRoot}/${storyKey}`;
  for (const name of ['story.md', 'editorial-review.json', 'manifest.json']) {
    writeBytes(path.join(fixture.root, originalRoot, name), fs.readFileSync(path.join(REPO_ROOT, originalRoot, name)));
  }
  const manifestPath = `${originalRoot}/manifest.json`;
  const manifest = JSON.parse(fs.readFileSync(path.join(fixture.root, manifestPath), 'utf8'));
  const approvalPath = manifest.record.productAcceptance.path;
  writeBytes(path.join(fixture.root, approvalPath), fs.readFileSync(path.join(REPO_ROOT, approvalPath)));
  const approval = JSON.parse(fs.readFileSync(path.join(fixture.root, approvalPath), 'utf8'));
  if (approval.corpusManifestPath) {
    writeBytes(path.join(fixture.root, approval.corpusManifestPath), fs.readFileSync(path.join(REPO_ROOT, approval.corpusManifestPath)));
    const corpusStoryRoot = path.join(path.dirname(approval.corpusManifestPath), storyKey);
    for (const name of ['story.md', 'editorial-review.json']) {
      writeBytes(path.join(fixture.root, corpusStoryRoot, name), fs.readFileSync(path.join(REPO_ROOT, corpusStoryRoot, name)));
    }
  }
  const r = manifest.record;
  const brief = { ...creativeBrief(), category: r.category, direction: r.direction };
  writeJson(fixture.briefPath, brief);
  const text = story().replace('companionId: fox_uri', `companionId: ${r.companionId}`)
    .replace('direction: bedtime', `direction: ${r.direction}`).replace('category: TRANSITION', `category: ${r.category}`);
  writeBytes(fixture.storyPath, text);
  const request = { ...fixture.request,
    version: 'small-heroes-story-source-creative-replacement-request/v2', storyKey,
    identity: { companionId: r.companionId, direction: r.direction, category: r.category, pageCount: 2 },
    predecessor: { kind: 'accepted_root_v1', manifestPath,
      manifestSha256: materializer.sha256(fs.readFileSync(path.join(fixture.root, manifestPath))) },
    creativeBrief: { ...fixture.request.creativeBrief, sha256: materializer.sha256(fs.readFileSync(fixture.briefPath)) },
    storyRevision: { ...fixture.request.storyRevision, sha256: materializer.sha256(text) },
    approvedStoryRevisionSha256: materializer.sha256(text),
  };
  writeJson(fixture.requestPath, request);
  return { ...fixture, request, originalRoot, manifestPath, approvalPath, originalManifest: manifest };
}

describe('first creative replacement from original accepted source', () => {
  const argsFor = (f: ReturnType<typeof buildOriginalFixture>, write = false) => ({ requestPath: relative(f.root, f.requestPath), write });
  const repin = (f: ReturnType<typeof buildOriginalFixture>) => {
    f.request.predecessor.manifestSha256 = materializer.sha256(fs.readFileSync(path.join(f.root, f.manifestPath)));
    writeJson(f.requestPath, f.request);
  };
  it('previews without creating revisions, publishes, reloads and replays the exact source', () => {
    const f = buildOriginalFixture();
    const revisions = path.join(f.root, f.originalRoot, 'revisions');
    const args = { requestPath: relative(f.root, f.requestPath), write: false };
    expect(fs.existsSync(revisions)).toBe(false);
    const preview = lifecycle.publish(args, f.roots);
    expect(fs.existsSync(revisions)).toBe(false);
    expect(preview.manifest.version).toBe('small-heroes-product-accepted-story-source-creative-replacement-manifest/v2');
    expect(preview.manifest.predecessor).toEqual(f.request.predecessor);
    const published = lifecycle.publish({ ...args, write: true }, f.roots);
    expect(published.created).toBe(true);
    expect(published.revisionDigest).toBe(preview.revisionDigest);
    expect(lifecycle.loadAcceptedCreativeReplacement({ manifestPath: `${published.target}/manifest.json` }, f.roots).storySha256)
      .toBe(f.request.storyRevision.sha256);
    expect(lifecycle.publish({ ...args, write: true }, f.roots).created).toBe(false);
    expect(fs.readFileSync(path.join(f.root, f.manifestPath)))
      .toEqual(fs.readFileSync(path.join(REPO_ROOT, f.manifestPath)));
  });

  it('verifies all18 original roots read-only, including the independent single-story acceptance', () => {
    const root = 'story-pipeline/04_approved_story_sources/accepted';
    const records = fs.readdirSync(path.join(REPO_ROOT, root), { withFileTypes: true }).filter(x => x.isDirectory());
    expect(records).toHaveLength(18);
    for (const { name: storyKey } of records) {
      const bytes = fs.readFileSync(path.join(REPO_ROOT, root, storyKey, 'manifest.json'));
      const manifest = JSON.parse(bytes.toString('utf8'));
      const result = lifecycle.inspectOriginalAcceptedSource({ storyKey, manifestSha256: materializer.sha256(bytes) });
      expect(result.storySha256).toBe(manifest.record.story.sha256);
      expect(result.reviewSha256).toBe(manifest.record.editorialReview.sha256);
      expect(result.approvalSha256).toBe(manifest.record.productAcceptance.sha256);
      expect(result.predecessor).not.toHaveProperty('revisionDigest');
    }
  });

  it('handles a single-story original and refuses a new root fork once a revision exists', () => {
    const f = buildOriginalFixture('dragon_dini_adventure');
    const first = lifecycle.publish(argsFor(f, true), f.roots);
    writeBytes(f.storyPath, fs.readFileSync(f.storyPath, 'utf8').trimEnd().replace('השער', 'החלון') + '\n');
    f.request.storyRevision.sha256 = materializer.sha256(fs.readFileSync(f.storyPath));
    f.request.approvedStoryRevisionSha256 = f.request.storyRevision.sha256;
    writeJson(f.requestPath, f.request);
    expect(() => lifecycle.publish(argsFor(f, true), f.roots)).toThrow('predecessor_not_current');
    expect(fs.readdirSync(path.join(f.root, f.originalRoot, 'revisions'))).toEqual([first.revisionDigest]);
  });

  it.each(['story.md', 'editorial-review.json', 'manifest.json'])('rejects altered original %s without creating a revisions directory', name => {
    const f = buildOriginalFixture();
    fs.appendFileSync(path.join(f.root, f.originalRoot, name), ' ');
    expect(() => lifecycle.publish(argsFor(f, true), f.roots)).toThrow('original_invalid');
    expect(fs.existsSync(path.join(f.root, f.originalRoot, 'revisions'))).toBe(false);
  });

  it.each(['approval', 'corpus', 'member', 'review-copy'])('rejects altered %s evidence behind a rehashed manifest', kind => {
    const f = buildOriginalFixture();
    const m = f.originalManifest;
    if (kind === 'approval') {
      const approval = JSON.parse(fs.readFileSync(path.join(f.root, f.approvalPath), 'utf8'));
      approval.acceptedBy = 'NotGuy';
      writeJson(path.join(f.root, f.approvalPath), approval);
      const bytes = fs.readFileSync(path.join(f.root, f.approvalPath));
      m.record.productAcceptance.sha256 = materializer.sha256(bytes);
      m.record.productAcceptance.bytes = bytes.length;
    } else {
      const approval = JSON.parse(fs.readFileSync(path.join(f.root, f.approvalPath), 'utf8'));
      if (kind === 'corpus') fs.appendFileSync(path.join(f.root, approval.corpusManifestPath), ' ');
      if (kind === 'member') {
        const corpus = JSON.parse(fs.readFileSync(path.join(f.root, approval.corpusManifestPath), 'utf8'));
        corpus.records.find((r: any) => r.slot === f.request.storyKey).storySha256 = '0'.repeat(64);
        writeJson(path.join(f.root, approval.corpusManifestPath), corpus);
        approval.corpusManifestSha256 = materializer.sha256(fs.readFileSync(path.join(f.root, approval.corpusManifestPath)));
        writeJson(path.join(f.root, f.approvalPath), approval);
        const bytes = fs.readFileSync(path.join(f.root, f.approvalPath));
        m.record.productAcceptance.sha256 = materializer.sha256(bytes);
        m.record.productAcceptance.bytes = bytes.length;
      }
      if (kind === 'review-copy') fs.appendFileSync(path.join(f.root, m.record.editorialReview.sourcePath), ' ');
    }
    writeJson(path.join(f.root, f.manifestPath), m); repin(f);
    expect(() => lifecycle.publish(argsFor(f, true), f.roots)).toThrow();
    expect(fs.existsSync(path.join(f.root, f.originalRoot, 'revisions'))).toBe(false);
  });

  it.each(['identity', 'audit', 'exclusions', 'status', 'extra', 'approval-path'])('rejects rehashed manifest %s substitution', kind => {
    const f = buildOriginalFixture(); const m = f.originalManifest;
    if (kind === 'identity') m.record.companionId = 'fox_uri';
    if (kind === 'audit') m.record.independentArtifactAudit.reviewedHead = '1'.repeat(40);
    if (kind === 'exclusions') m.record.excludedAuthorities = [];
    if (kind === 'status') m.status = 'pending';
    if (kind === 'extra') m.runtimeOverride = true;
    if (kind === 'approval-path') m.record.productAcceptance.path = 'outputs/../outside.json';
    writeJson(path.join(f.root, f.manifestPath), m); repin(f);
    expect(() => lifecycle.publish(argsFor(f, true), f.roots)).toThrow('original_invalid');
    expect(fs.existsSync(path.join(f.root, f.originalRoot, 'revisions'))).toBe(false);
  });

  it('keeps versions explicit and never treats an original hash as a revision digest', () => {
    const f = buildOriginalFixture();
    expect(() => lifecycle.validateRequest({ ...f.request, version: lifecycle.REQUEST_VERSION })).toThrow('request_invalid');
    expect(() => lifecycle.validateRequest({ ...f.request, predecessor: { ...f.request.predecessor, revisionDigest: f.request.predecessor.manifestSha256 } })).toThrow('request_invalid');
  });

  it('refuses hardlinked authority, held locks and pre-existing revision branches', () => {
    const f = buildOriginalFixture();
    const original = path.join(f.root, f.originalRoot, 'story.md');
    const link = path.join(f.root, 'story-link.md');
    fs.linkSync(original, link);
    expect(() => lifecycle.publish(argsFor(f, true), f.roots)).toThrow('original_invalid');
    fs.unlinkSync(link);
    const lock = path.join(f.root, f.originalRoot, '.creative-replacement.lock');
    writeBytes(lock, 'held');
    expect(() => lifecycle.publish(argsFor(f, true), f.roots)).toThrow('locked');
    expect(fs.readFileSync(lock, 'utf8')).toBe('held');
    fs.unlinkSync(lock);
    fs.mkdirSync(path.join(f.root, f.originalRoot, 'revisions', 'f'.repeat(64)), { recursive: true });
    expect(() => lifecycle.publish(argsFor(f), f.roots)).toThrow('predecessor_not_current');
  });

  it('rejects request mutation after acquiring the lock and releases only its own lock', () => {
    const f = buildOriginalFixture();
    const open = fs.openSync;
    vi.spyOn(fs, 'openSync').mockImplementation(((file: any, flags: any, mode: any) => {
      const fd = open(file, flags, mode);
      if (String(file).endsWith('.creative-replacement.lock')) {
        writeJson(f.requestPath, { ...f.request, decision: f.request.decision + ' Changed concurrently.' });
      }
      return fd;
    }) as any);
    expect(() => lifecycle.publish(argsFor(f, true), f.roots)).toThrow('request_changed');
    expect(fs.existsSync(path.join(f.root, f.originalRoot, 'revisions'))).toBe(false);
    expect(fs.existsSync(path.join(f.root, f.originalRoot, '.creative-replacement.lock'))).toBe(false);
  });

  it('revalidates original evidence on reload and when it becomes a subsequent predecessor', () => {
    const f = buildOriginalFixture();
    const first = lifecycle.publish(argsFor(f, true), f.roots);
    const successor = { ...f.request, version: lifecycle.REQUEST_VERSION,
      predecessor: { manifestPath: `${first.target}/manifest.json`, revisionDigest: first.revisionDigest,
        manifestSha256: materializer.sha256(fs.readFileSync(path.join(f.root, first.target, 'manifest.json'))) } };
    writeJson(f.requestPath, successor);
    const second = lifecycle.publish(argsFor(f, true), f.roots);
    expect(second.created).toBe(true);
    fs.appendFileSync(path.join(f.root, f.originalRoot, 'story.md'), ' ');
    expect(() => lifecycle.loadAcceptedCreativeReplacement({ manifestPath: `${first.target}/manifest.json` }, f.roots)).toThrow('original_invalid');
    expect(() => lifecycle.loadAcceptedCreativeReplacement({ manifestPath: `${second.target}/manifest.json` }, f.roots)).toThrow('original_invalid');
  });

  it('rejects aliased original directories and aliased empty revisions targets', () => {
    const f = buildOriginalFixture();
    const original = path.join(f.root, f.originalRoot);
    const parked = path.join(f.root, 'parked-original');
    fs.renameSync(original, parked); // Both paths are within this test-owned temporary root.
    fs.symlinkSync(parked, original, 'junction');
    try { expect(() => lifecycle.publish(argsFor(f, true), f.roots)).toThrow('original_invalid'); }
    finally { fs.unlinkSync(original); fs.renameSync(parked, original); }
    const empty = path.join(f.root, 'empty-target'); fs.mkdirSync(empty);
    const revisions = path.join(original, 'revisions'); fs.symlinkSync(empty, revisions, 'junction');
    try { expect(() => lifecycle.publish(argsFor(f, true), f.roots)).toThrow('target_invalid'); }
    finally { fs.unlinkSync(revisions); }
    expect(fs.readdirSync(empty)).toEqual([]);
  });

  it('feeds a v2 successor through the real visual-direction enrichment consumer without old directions', () => {
    const f = buildOriginalFixture();
    // Structural fixture only: fresh12-page text, no real product acceptance.
    const text = fs.readFileSync(f.storyPath, 'utf8').split('--- Page 1 ---')[0].replace('pages: 2', 'pages: 12')
      + Array.from({ length: 12 }, (_, i) => `--- Page ${i + 1} ---\n\n{{childName}} {פתח|פתחה} את השער.\n\n`).join('').trimEnd() + '\n';
    writeBytes(f.storyPath, text);
    const brief = { ...creativeBrief(), category: f.request.identity.category, direction: f.request.identity.direction, pageCount: 12 };
    writeJson(f.briefPath, brief);
    f.request.identity.pageCount = 12;
    f.request.creativeBrief.sha256 = materializer.sha256(fs.readFileSync(f.briefPath));
    f.request.storyRevision.sha256 = materializer.sha256(text);
    f.request.approvedStoryRevisionSha256 = f.request.storyRevision.sha256;
    writeJson(f.requestPath, f.request);
    const published = lifecycle.publish(argsFor(f, true), f.roots);
    const directions = require('../../scripts/story-visual-direction-contract.cjs');
    const enrichment = require('../../scripts/story-source-visual-direction-enrichment-lifecycle.cjs');
    const record = directions.normalizeVisualDirectionRecord({ version: directions.RECORD_VERSION,
      storyKey: f.request.storyKey, pages: Array.from({ length: 12 }, (_, i) => ({
        pageNumber: i + 1, settingKey: 'garden_gate', setting: 'The same garden beside a wooden gate.',
        childPresence: 'present', companionPresence: 'present', supportingCharacters: [],
        mainAction: 'The child opens the gate while the companion watches.', heroObject: 'Wooden garden gate',
        shotType: ['wide', 'close', 'medium', 'detail'][i % 4], cameraAngle: ['eye_level', 'high_angle', 'low_angle'][i % 3],
        lighting: 'Soft daylight', continuityAnchors: ['Same garden gate'],
      })) });
    const directionPath = path.join(f.root, 'outputs', 'fresh-directions.json');
    writeBytes(directionPath, JSON.stringify(record, null, 2) + '\n');
    const requestPath = path.join(f.root, 'outputs', 'enrichment-request.json');
    const request = { version: enrichment.REQUEST_VERSION, storyKey: f.request.storyKey,
      sourceRevision: { manifestPath: `${published.target}/manifest.json`,
        manifestSha256: materializer.sha256(fs.readFileSync(path.join(f.root, published.target, 'manifest.json'))),
        manifestDigest: published.manifest.digest, revisionDigest: published.revisionDigest },
      visualDirections: { path: relative(f.root, directionPath), bytes: fs.statSync(directionPath).size,
        sha256: materializer.sha256(fs.readFileSync(directionPath)) },
      compositionPolicyVersion: enrichment.COMPOSITION_POLICY_VERSION,
      continuityIntent: { version: enrichment.CONTINUITY_INTENT_VERSION,
        childWardrobeAuthority: 'frozen_visual_contract', childWardrobeTransitionPages: [],
        companionAccessoryAuthority: 'canonical_companion_profile', companionAppearanceAuthority: 'frozen_companion_state', companionStateTransitionPages: [] },
    };
    writeJson(requestPath, request);
    const args = { requestPath: relative(f.root, requestPath), outputRoot: 'outputs/fresh-enrichment', write: false };
    const preview = enrichment.prepare(args, f.roots);
    expect(preview.sourceRevisionDigest).toBe(published.revisionDigest);
    expect(preview.runtimeEligibility.eligible).toBe(false);
    expect(fs.existsSync(path.join(f.root, args.outputRoot))).toBe(false);
    const made = enrichment.prepare({ ...args, write: true }, f.roots);
    expect(made.created).toBe(true);
    expect(fs.readFileSync(path.join(f.root, made.target, 'integrated.md'), 'utf8').replace(/^imageDirection:.*\r?\n/gm, ''))
      .toBe(text);
    expect(enrichment.loadExistingCandidate(args, f.roots).candidate.candidateDigest).toBe(made.candidateDigest);
    fs.appendFileSync(path.join(f.root, f.approvalPath), ' ');
    expect(() => enrichment.prepare(args, f.roots)).toThrow('original_invalid');
  });
});

describe('creative replacement from fully verified v4 predecessor', () => {
  function runBridgeFault(fixture: ReturnType<typeof buildFixture>, fault: string, manifestPath?: string) {
    const child = spawnSync(process.execPath, ['-e', `
      const Module=require('node:module');
      const original=Module._load;
      const fault=process.argv[2];
      let touched=false;
      Module._load=function(id,...args) {
        if(id!=='tsx/cjs/api') return original.call(this,id,...args);
        touched=true;
        if(fault==='missing') throw Object.assign(new Error('private-install-path'),{code:'MODULE_NOT_FOUND'});
        if(fault==='incompatible') return {};
        return {require() {
          if(fault==='load') throw new Error('private-module-path');
          if(fault==='export') return {};
          return {loadAcceptedStorySourceAuthoringAuthority() {
            if(fault==='validation') throw new Error('accepted_story_source_manifest_file_stale');
            if(fault==='null') return null;
            if(fault==='io') throw Object.assign(new Error('private-file-path'),{code:'EACCES'});
            throw new TypeError('private-validator-details');
          }};
        }};
      };
      const lifecycle=require(process.argv[1]);
      const input=JSON.parse(process.argv[3]),roots=JSON.parse(process.argv[4]);
      try {
        const result=input.manifestPath ? lifecycle.loadAcceptedCreativeReplacement(input,roots) : lifecycle.publish(input,roots);
        console.log(JSON.stringify({ok:true,touched,created:result.created}));
      } catch(error) {
        console.log(JSON.stringify({ok:false,touched,message:error.message,causeName:error.cause?.name,causeCode:error.cause?.code}));
      }
    `, path.join(REPO_ROOT, 'scripts/story-source-creative-replacement-lifecycle.cjs'), fault,
    JSON.stringify(manifestPath ? {manifestPath} : {requestPath:relative(fixture.root, fixture.requestPath),write:true}),
    JSON.stringify(fixture.roots)], {cwd:fixture.root,encoding:'utf8'});
    expect(child.status).toBe(0);
    expect(child.stderr).toBe('');
    return JSON.parse(child.stdout);
  }

  it.each([
    ['missing', 'toolchain_unavailable'], ['incompatible', 'toolchain_unavailable'],
    ['load', 'validator_load_failed'], ['export', 'validator_load_failed'],
    ['bug', 'validator_failed'], ['io', 'validator_failed'],
    ['validation', 'predecessor_invalid'], ['null', 'predecessor_invalid'],
  ])('classifies %s without creating a successor and preserves the reload boundary', (fault, code) => {
    const fixture = buildV4Fixture();
    const revisionsRoot = path.dirname(path.dirname(fixture.predecessorPath));
    const before = fs.readdirSync(revisionsRoot);
    const failed = runBridgeFault(fixture, fault);
    expect(failed).toMatchObject({ok:false,touched:true,message:`story_source_creative_replacement_${code}`});
    if (fault === 'missing') expect(failed.causeCode).toBe('MODULE_NOT_FOUND');
    if (fault === 'io') expect(failed.causeCode).toBe('EACCES');
    if (fault === 'bug') expect(failed.causeName).toBe('TypeError');
    expect(fs.readdirSync(revisionsRoot)).toEqual(before);
    const published = lifecycle.publish({requestPath:relative(fixture.root,fixture.requestPath),write:true},fixture.roots);
    const dir = path.join(fixture.root,published.target);
    const bytes = fs.readdirSync(dir).map(name => [name,fs.readFileSync(path.join(dir,name))] as const);
    expect(runBridgeFault(fixture,fault,`${published.target}/manifest.json`)).toMatchObject({ok:false,message:`story_source_creative_replacement_${code}`});
    for(const [name,original] of bytes) expect(fs.readFileSync(path.join(dir,name))).toEqual(original);
  });

  it('rejects unaccepted v4 status before touching the toolchain', () => {
    const fixture = buildV4Fixture();
    const {digest:_old,...payload} = JSON.parse(fs.readFileSync(fixture.predecessorPath,'utf8'));
    payload.status = 'pending';
    writeJson(fixture.predecessorPath,{...payload,digest:materializer.sha256(materializer.canonicalBytes(payload))});
    writeJson(fixture.requestPath,{...fixture.request,predecessor:{...fixture.request.predecessor,manifestSha256:materializer.sha256(fs.readFileSync(fixture.predecessorPath))}});
    expect(runBridgeFault(fixture,'missing')).toMatchObject({ok:false,touched:false,message:'story_source_creative_replacement_predecessor_invalid'});
  });

  it.each([
    ['missing','toolchain_unavailable'], ['load','validator_load_failed'],
    ['bug','validator_failed'], ['validation','predecessor_invalid'],
  ])('the actual CLI emits only the stable %s code, never private cause details', (fault,code) => {
    const fixture = buildV4Fixture();
    // Real repo predecessor, isolated staged inputs, preview-only even if a fault
    // injection unexpectedly stops working: no real publication can occur.
    const cliRequest = {...fixture.request,
      creativeBrief:{...fixture.request.creativeBrief,path:relative(REPO_ROOT,fixture.briefPath)},
      storyRevision:{...fixture.request.storyRevision,path:relative(REPO_ROOT,fixture.storyPath)},
      editorialReview:{...fixture.request.editorialReview,path:relative(REPO_ROOT,fixture.reviewPath)},
    };
    writeJson(fixture.requestPath,cliRequest);
    const hook = path.join(fixture.root,'fault-hook.cjs');
    writeBytes(hook, `
      const Module=require('node:module'),original=Module._load;
      Module._load=function(id,...args){
        if(id!=='tsx/cjs/api')return original.call(this,id,...args);
        const fault=${JSON.stringify(fault)};
        if(fault==='missing')throw new Error('PRIVATE_INSTALL_PATH:secret');
        return {require(){
          if(fault==='load')throw new Error('PRIVATE_MODULE_PATH:secret');
          return {loadAcceptedStorySourceAuthoringAuthority(){
            if(fault==='validation')throw new Error('accepted_story_source_embedded_digest_invalid:technical-review.json');
            throw new TypeError('PRIVATE_RUNTIME_DETAILS:secret');
          }};
        }};
      };
    `);
    const child=spawnSync(process.execPath,['--require',hook,
      path.join(REPO_ROOT,'scripts/story-source-creative-replacement-lifecycle.cjs'),
      'publish','--request',relative(REPO_ROOT,fixture.requestPath),'--write','false',
    ],{cwd:fixture.root,encoding:'utf8'});
    expect(child.status).toBe(1);
    expect(child.stdout).toBe('');
    expect(child.stderr.trim()).toBe(`story_source_creative_replacement_${code}`);
  });

  it('does not require the v4 toolchain for legacy v2 or creative-v1 predecessors', () => {
    const fixture = buildFixture();
    expect(runBridgeFault(fixture,'missing')).toMatchObject({ok:true,touched:false,created:true});
    const first = lifecycle.publish({requestPath:relative(fixture.root,fixture.requestPath),write:false},fixture.roots);
    const manifestPath = `${first.target}/manifest.json`;
    writeJson(fixture.requestPath,{...fixture.request,predecessor:{manifestPath,manifestSha256:materializer.sha256(fs.readFileSync(path.join(fixture.root,manifestPath))),revisionDigest:first.revisionDigest}});
    expect(runBridgeFault(fixture,'missing')).toMatchObject({ok:true,touched:false,created:true});
  });

  it('publishes and reloads without staging, then rejects a corrupted predecessor', () => {
    const fixture = buildV4Fixture();
    const args = { requestPath: relative(fixture.root, fixture.requestPath), write: false };
    const preview = lifecycle.publish(args, fixture.roots);
    expect(preview.created).toBe(false);
    const published = lifecycle.publish({ ...args, write: true }, fixture.roots);
    expect(published.revisionDigest).toBe(preview.revisionDigest);
    expect(published.manifest.runtimeEligibility.eligible).toBe(false);
    const manifestPath = `${published.target}/manifest.json`;
    expect(lifecycle.publish({ ...args, write: true }, fixture.roots).created).toBe(false);
    fs.rmSync(path.join(fixture.root, 'outputs'), { recursive: true, force: true });
    expect(lifecycle.loadAcceptedCreativeReplacement({ manifestPath }, fixture.roots).storySha256)
      .toBe(fixture.request.approvedStoryRevisionSha256);
    fs.appendFileSync(path.join(fixture.root, fixture.predecessorRoot, 'story.md'), 'tamper');
    expect(() => lifecycle.loadAcceptedCreativeReplacement({ manifestPath }, fixture.roots))
      .toThrow('story_source_creative_replacement_predecessor_invalid');
  });

  it.each(['story.md', 'technical-review.json', 'product-acceptance.json', 'revision-identity.json'])(
    'rejects a tampered v4 %s before creating a successor', filename => {
      const fixture = buildV4Fixture();
      fs.appendFileSync(path.join(fixture.root, fixture.predecessorRoot, filename), 'tamper');
      const before = fs.readdirSync(path.dirname(fixture.predecessorPath));
      expect(() => lifecycle.publish({ requestPath: relative(fixture.root, fixture.requestPath), write: true }, fixture.roots))
        .toThrow('story_source_creative_replacement_predecessor_invalid');
      expect(fs.readdirSync(path.dirname(fixture.predecessorPath))).toEqual(before);
      expect(fs.readdirSync(path.dirname(path.dirname(fixture.predecessorPath))))
        .toEqual([fixture.request.predecessor.revisionDigest]);
    },
  );

  it('rejects an incomplete v4 inventory and a second distinct successor', () => {
    const missing = buildV4Fixture();
    fs.unlinkSync(path.join(missing.root, missing.predecessorRoot, 'technical-review.json'));
    expect(() => lifecycle.publish({ requestPath: relative(missing.root, missing.requestPath), write: false }, missing.roots))
      .toThrow('story_source_creative_replacement_predecessor_invalid');
    const fork = buildV4Fixture();
    const args = { requestPath: relative(fork.root, fork.requestPath), write: true };
    lifecycle.publish(args, fork.roots);
    const revised = fs.readFileSync(fork.storyPath, 'utf8').replace('את השער', 'את הדלת');
    writeBytes(fork.storyPath, revised);
    writeJson(fork.requestPath, { ...fork.request,
      storyRevision: { ...fork.request.storyRevision, sha256: materializer.sha256(revised) },
      approvedStoryRevisionSha256: materializer.sha256(revised),
    });
    expect(() => lifecycle.publish(args, fork.roots)).toThrow('story_source_creative_replacement_predecessor_not_current');
  });

  it('rejects rehashed v4 authority drift and hard-linked predecessor files', () => {
    const forged = buildV4Fixture();
    const manifest = JSON.parse(fs.readFileSync(forged.predecessorPath, 'utf8'));
    manifest.acceptedWorldMode = 'fantasy';
    const { digest: _oldDigest, ...payload } = manifest;
    writeJson(forged.predecessorPath, { ...payload, digest: materializer.sha256(materializer.canonicalBytes(payload)) });
    writeJson(forged.requestPath, { ...forged.request, predecessor: {
      ...forged.request.predecessor, manifestSha256: materializer.sha256(fs.readFileSync(forged.predecessorPath)),
    } });
    expect(() => lifecycle.publish({ requestPath: relative(forged.root, forged.requestPath), write: false }, forged.roots))
      .toThrow('story_source_creative_replacement_predecessor_invalid');
    const linked = buildV4Fixture();
    fs.linkSync(path.join(linked.root, linked.predecessorRoot, 'story.md'), path.join(linked.root, 'linked-story.md'));
    expect(() => lifecycle.publish({ requestPath: relative(linked.root, linked.requestPath), write: false }, linked.roots))
      .toThrow('story_source_creative_replacement_predecessor_invalid');
  });

  it('runs the unchanged sync CJS interface in plain Node despite foreign cwd aliases', () => {
    const fixture = buildV4Fixture();
    writeJson(path.join(fixture.root, 'tsconfig.json'), {
      compilerOptions: { baseUrl: '.', paths: { '@/*': ['./nonexistent-foreign-code/*'] } },
    });
    const child = spawnSync(process.execPath, ['-e',
      `const lifecycle=require(process.argv[1]);const r=lifecycle.publish(JSON.parse(process.argv[2]),JSON.parse(process.argv[3]));console.log(JSON.stringify(r));`,
      path.join(REPO_ROOT, 'scripts/story-source-creative-replacement-lifecycle.cjs'),
      JSON.stringify({ requestPath: relative(fixture.root, fixture.requestPath), write: false }),
      JSON.stringify(fixture.roots),
    ], { cwd: fixture.root, encoding: 'utf8' });
    expect(child.stderr).toBe('');
    expect(child.status).toBe(0);
    expect(JSON.parse(child.stdout).manifest.runtimeEligibility.eligible).toBe(false);
  });
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
