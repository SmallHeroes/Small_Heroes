import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const lifecycle = require(
  '../../scripts/story-source-visual-direction-enrichment-lifecycle.cjs',
) as any;
const materializer = require(
  '../../scripts/materialize-story-source-revision.cjs',
) as any;

const REPO_ROOT = path.resolve(process.cwd());
const OUTPUTS_ROOT = path.join(REPO_ROOT, 'outputs');
const STORY_KEY = 'chameleon_koko_bedtime';
const SOURCE_REVISION =
  'eca8b3c8a8ed32a6a884cd9bd4fc493fcc6f00fed3c4ebe710c6a870ead2115d';
const ACCEPTED_STORY_RELATIVE =
  'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime';
const SOURCE_MANIFEST_RELATIVE =
  `${ACCEPTED_STORY_RELATIVE}/revisions/${SOURCE_REVISION}/manifest.json`;
const TRACKED_DIRECTION_PATH = path.join(
  REPO_ROOT,
  ACCEPTED_STORY_RELATIVE,
  'revisions',
  '20a1280107a94ca0134c08351bc18565883ee358ce7ed1ca47ea797549bca1eb',
  'visual-directions.json',
);
const temporaryRoots: string[] = [];

function relative(root: string, filePath: string): string {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function writePrettyJson(filePath: string, value: unknown): Buffer {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, bytes);
  return bytes;
}

function validDirectionRecord(): any {
  const value = JSON.parse(fs.readFileSync(TRACKED_DIRECTION_PATH, 'utf8'));
  const shots = [
    ['medium_close', 'three_quarter'],
    ['wide', 'ground_level'],
    ['close', 'low_angle'],
    ['extreme_wide', 'overhead'],
    ['detail', 'high_angle'],
    ['medium_wide', 'eye_level'],
    ['medium', 'three_quarter'],
    ['medium_close', 'eye_level'],
  ];
  value.pages.forEach((page: any, index: number) => {
    [page.shotType, page.cameraAngle] = shots[index];
  });
  value.pages[2].mainAction =
    'The child frees the roof from a laundry line while the companion watches beside the same moving stop.';
  value.pages[3].mainAction =
    'The child and bus stop listen while Kim keeps both eyes closed, with the busy bakery, splashing fountain, and still-moving swing marking noisy choices.';
  return value;
}

function buildFixture() {
  const root = fs.mkdtempSync(
    path.join(OUTPUTS_ROOT, 'visual-direction-enrichment-test-'),
  );
  temporaryRoots.push(root);
  const acceptedTarget = path.join(root, ACCEPTED_STORY_RELATIVE);
  fs.mkdirSync(path.dirname(acceptedTarget), { recursive: true });
  fs.cpSync(path.join(REPO_ROOT, ACCEPTED_STORY_RELATIVE), acceptedTarget, {
    recursive: true,
  });
  const outputs = path.join(root, 'outputs');
  fs.mkdirSync(outputs, { recursive: true });
  const directionPath = path.join(outputs, 'visual-directions.json');
  const directionBytes = writePrettyJson(directionPath, validDirectionRecord());
  const sourceManifestPath = path.join(root, SOURCE_MANIFEST_RELATIVE);
  const sourceManifestBytes = fs.readFileSync(sourceManifestPath);
  const sourceManifest = JSON.parse(sourceManifestBytes.toString('utf8'));
  const request = {
    version: lifecycle.REQUEST_VERSION,
    storyKey: STORY_KEY,
    sourceRevision: {
      manifestPath: SOURCE_MANIFEST_RELATIVE,
      manifestSha256: materializer.sha256(sourceManifestBytes),
      manifestDigest: sourceManifest.digest,
      revisionDigest: SOURCE_REVISION,
    },
    visualDirections: {
      path: relative(root, directionPath),
      bytes: directionBytes.length,
      sha256: materializer.sha256(directionBytes),
    },
    compositionPolicyVersion: lifecycle.COMPOSITION_POLICY_VERSION,
    continuityIntent: {
      version: lifecycle.CONTINUITY_INTENT_VERSION,
      childWardrobeAuthority: 'frozen_visual_contract',
      childWardrobeTransitionPages: [8],
      companionAccessoryAuthority: 'canonical_companion_profile',
      companionAppearanceAuthority: 'frozen_companion_state',
      companionStateTransitionPages: [2, 3, 5, 6],
    },
  };
  const requestPath = path.join(outputs, 'request.json');
  writePrettyJson(requestPath, request);
  return {
    directionPath,
    outputRoot: 'outputs/candidates',
    request,
    requestPath,
    root,
    sourceManifestPath,
  };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('general Story Source visual-direction enrichment lifecycle', () => {
  it('previews, atomically writes, and byte-replays one exact candidate', () => {
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
    expect(preview.runtimeEligibility).toEqual({
      eligible: false,
      reason: 'visual_directions_candidate_not_product_accepted',
    });
    expect(preview.composition.widePageNumbers).toEqual([2, 4]);
    expect(preview.composition.closeFocusPageNumbers).toEqual([1, 3, 5, 8]);
    expect(fs.existsSync(path.join(fixture.root, fixture.outputRoot))).toBe(false);

    const written = lifecycle.prepare(
      { ...args, write: true },
      { repoRoot: fixture.root },
    );
    expect(written.created).toBe(true);
    const target = path.join(fixture.root, written.target);
    expect(fs.readdirSync(target).sort()).toEqual([
      'integrated.md',
      'manifest.json',
      'review-bundle.json',
      'revision-identity.json',
      'visual-directions.json',
    ]);
    const integrated = fs.readFileSync(path.join(target, 'integrated.md'), 'utf8');
    const projected = integrated.replace(/^imageDirection:.*\r?\n/gm, '');
    const sourceStory = fs.readFileSync(
      path.join(
        fixture.root,
        ACCEPTED_STORY_RELATIVE,
        'revisions',
        SOURCE_REVISION,
        'story.md',
      ),
      'utf8',
    );
    expect(Buffer.from(projected, 'utf8').equals(Buffer.from(sourceStory, 'utf8'))).toBe(true);

    const replay = lifecycle.prepare(
      { ...args, write: true },
      { repoRoot: fixture.root },
    );
    expect(replay.created).toBe(false);
    expect(replay.candidateDigest).toBe(written.candidateDigest);
    expect(replay.reviewBundleDigest).toBe(written.reviewBundleDigest);
    const existing = lifecycle.loadExistingCandidate(
      { requestPath: args.requestPath, outputRoot: args.outputRoot },
      { repoRoot: fixture.root },
    );
    expect(existing.candidate.candidateDigest).toBe(written.candidateDigest);
    expect(relative(fixture.root, existing.target)).toBe(written.target);
  });

  it('rejects weak composition and loose protected appearance authority', () => {
    const fixture = buildFixture();
    const weak = validDirectionRecord();
    weak.pages.forEach((page: any) => {
      page.shotType = 'medium';
      page.cameraAngle = 'eye_level';
    });
    let bytes = writePrettyJson(fixture.directionPath, weak);
    fixture.request.visualDirections.bytes = bytes.length;
    fixture.request.visualDirections.sha256 = materializer.sha256(bytes);
    writePrettyJson(fixture.requestPath, fixture.request);
    expect(() =>
      lifecycle.prepare(
        {
          requestPath: relative(fixture.root, fixture.requestPath),
          outputRoot: fixture.outputRoot,
          write: false,
        },
        { repoRoot: fixture.root },
      ),
    ).toThrow('story_visual_direction_enrichment_composition_invalid');

    const protectedRecord = validDirectionRecord();
    protectedRecord.pages[0].mainAction =
      'The companion turns teal while the child lights the paper lantern.';
    bytes = writePrettyJson(fixture.directionPath, protectedRecord);
    fixture.request.visualDirections.bytes = bytes.length;
    fixture.request.visualDirections.sha256 = materializer.sha256(bytes);
    writePrettyJson(fixture.requestPath, fixture.request);
    expect(() =>
      lifecycle.prepare(
        {
          requestPath: relative(fixture.root, fixture.requestPath),
          outputRoot: fixture.outputRoot,
          write: false,
        },
        { repoRoot: fixture.root },
      ),
    ).toThrow('story_visual_direction_enrichment_protected_authority_invalid');
  });

  it('rejects declared companion aliases, elliptical body-state prose, and ordinary wardrobe phrasing', () => {
    const companionAppearanceBypasses = [
      'Kim body hue turns teal.',
      'Kim turns olive and striped.',
      'The chameleon body colour shifts to blue-green.',
      'Her body hue shifts to teal.',
      'The companion stands by the gate. Body hue turns teal.',
    ];
    for (const mainAction of companionAppearanceBypasses) {
      const record = validDirectionRecord();
      record.pages[0].mainAction = mainAction;
      expect(
        lifecycle.protectedAuthorityIssues(record, 'chameleon_koko'),
        mainAction,
      ).toContain('page_1_mainAction_companion_appearance_authority');
    }

    const wardrobeBypasses = [
      'The child puts on a coat.',
      'The child waits in a hoodie.',
      'The child ties her shoes.',
      'The child gets dressed.',
      'The child changes clothes.',
      'The child waits in a scarf.',
    ];
    for (const mainAction of wardrobeBypasses) {
      const record = validDirectionRecord();
      record.pages[0].mainAction = mainAction;
      expect(
        lifecycle.protectedAuthorityIssues(record, 'chameleon_koko'),
        mainAction,
      ).toContain('page_1_mainAction_wardrobe_authority');
    }

    for (const mainAction of [
      'Kim stands beside green trees.',
      'The companion stands by the gate. Green banners hang above it.',
      'The child carries a green paper label.',
    ]) {
      const record = validDirectionRecord();
      record.pages[0].mainAction = mainAction;
      expect(
        lifecycle.protectedAuthorityIssues(record, 'chameleon_koko'),
        mainAction,
      ).toEqual([]);
    }

    expect(
      lifecycle.protectedAuthorityIssues(validDirectionRecord(), 'unknown_companion'),
    ).toEqual(['companion_appearance_state_authority_missing']);
  });

  it('allows a fixed companion without a state axis, but fails closed for state transitions or body-state prose', () => {
    const fixedContinuity = {
      version: lifecycle.CONTINUITY_INTENT_VERSION,
      childWardrobeAuthority: 'frozen_visual_contract',
      childWardrobeTransitionPages: [],
      companionAccessoryAuthority: 'canonical_companion_profile',
      companionAppearanceAuthority: 'frozen_companion_state',
      companionStateTransitionPages: [],
    };
    expect(
      lifecycle.protectedAuthorityIssues(
        validDirectionRecord(),
        'unknown_companion',
        fixedContinuity,
      ),
    ).toEqual([]);

    expect(
      lifecycle.protectedAuthorityIssues(
        validDirectionRecord(),
        'unknown_companion',
        { ...fixedContinuity, companionStateTransitionPages: [2] },
      ),
    ).toContain('companion_appearance_state_authority_missing');

    const bodyState = validDirectionRecord();
    bodyState.pages[0].mainAction = 'The companion body colour turns blue.';
    expect(
      lifecycle.protectedAuthorityIssues(
        bodyState,
        'unknown_companion',
        fixedContinuity,
      ),
    ).toContain('companion_appearance_state_authority_missing');
  });

  it('rejects singular gender pronouns and ignores unrelated supporting-character clothing', () => {
    const fixedContinuity = {
      version: lifecycle.CONTINUITY_INTENT_VERSION,
      childWardrobeAuthority: 'frozen_visual_contract',
      childWardrobeTransitionPages: [],
      companionAccessoryAuthority: 'canonical_companion_profile',
      companionAppearanceAuthority: 'frozen_companion_state',
      companionStateTransitionPages: [],
    };
    const gendered = validDirectionRecord();
    gendered.pages[0].mainAction = 'The child holds her flashlight.';
    expect(
      lifecycle.protectedAuthorityIssues(
        gendered,
        'unknown_companion',
        fixedContinuity,
      ),
    ).toContain('page_1_mainAction_gendered_pronoun');

    for (const mainAction of [
      'A sock seller waits beside the cart.',
      'A short secured board rests across the gap.',
      'The crew wearing silver flowers stands in the background.',
      "The child passes the handle to Anat while Anat frees Anat's upside-down shirt.",
    ]) {
      const unrelated = validDirectionRecord();
      unrelated.pages[0].mainAction = mainAction;
      expect(
        lifecycle.protectedAuthorityIssues(
          unrelated,
          'unknown_companion',
          fixedContinuity,
        ),
        mainAction,
      ).toEqual([]);
    }
  });

  it('rejects stale source bindings, extra request keys, and hard-linked inputs', () => {
    const stale = buildFixture();
    stale.request.sourceRevision.manifestDigest = 'f'.repeat(64);
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
    ).toThrow('story_visual_direction_enrichment_source_revision_invalid');

    const extra = buildFixture();
    writePrettyJson(extra.requestPath, { ...extra.request, unreviewed: true });
    expect(() =>
      lifecycle.prepare(
        {
          requestPath: relative(extra.root, extra.requestPath),
          outputRoot: extra.outputRoot,
          write: false,
        },
        { repoRoot: extra.root },
      ),
    ).toThrow('story_visual_direction_enrichment_request_invalid');

    const linked = buildFixture();
    fs.linkSync(
      linked.directionPath,
      path.join(path.dirname(linked.directionPath), 'direction-alias.json'),
    );
    expect(() =>
      lifecycle.prepare(
        {
          requestPath: relative(linked.root, linked.requestPath),
          outputRoot: linked.outputRoot,
          write: false,
        },
        { repoRoot: linked.root },
      ),
    ).toThrow('story_visual_direction_enrichment_directions_invalid');
  });

  it('fails closed on candidate inventory or byte collisions', () => {
    const fixture = buildFixture();
    const args = {
      requestPath: relative(fixture.root, fixture.requestPath),
      outputRoot: fixture.outputRoot,
      write: true,
    };
    const written = lifecycle.prepare(args, { repoRoot: fixture.root });
    const target = path.join(fixture.root, written.target);
    fs.writeFileSync(path.join(target, 'unexpected.txt'), 'hostile');
    expect(() => lifecycle.prepare(args, { repoRoot: fixture.root })).toThrow(
      'story_visual_direction_enrichment_candidate_collision',
    );
  });

  it('keeps the CLI closed to the exact prepare argument surface', () => {
    const productionSource = fs.readFileSync(
      path.join(
        REPO_ROOT,
        'scripts',
        'story-source-visual-direction-enrichment-lifecycle.cjs',
      ),
      'utf8',
    );
    expect(productionSource).not.toMatch(
      /bar|kim|chameleon|kindergarten|lantern|bedtime|eca8b3c8/i,
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
        'outputs/candidates',
        '--write',
        'false',
      ]),
    ).toEqual({
      requestPath: 'outputs/request.json',
      outputRoot: 'outputs/candidates',
      write: false,
    });
    expect(() =>
      lifecycle.parseArgs([
        'prepare',
        '--request',
        'outputs/request.json',
        '--output-root',
        'outputs/candidates',
        '--write',
        'false',
        '--provider',
        'openai',
      ]),
    ).toThrow('story_visual_direction_enrichment_arguments_invalid');
  });
});
