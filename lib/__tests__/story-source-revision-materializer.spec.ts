import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveStoryBankPlaceholders } from '@/lib/story-bank-personalization';

const require = createRequire(import.meta.url);
const materializer = require('../../scripts/materialize-story-source-revision.cjs') as {
  MANIFEST_VERSION: string;
  REQUEST_VERSION: string;
  buildStorySourceRevision: (input: {
    requestFile: ReturnType<typeof materializer.readRequestFile>;
    outputDir: string;
    write: boolean;
  }) => {
    created: boolean;
    files: Record<string, string>;
    manifest: any;
    outputDir: string;
  };
  parseArgs: (argv: string[]) => {
    outputDir: string;
    requestPath: string;
    write: boolean;
  };
  readRequestFile: (requestPath: string) => {
    bytes: Buffer;
    relativePath: string;
    request: StorySourceRevisionRequest;
    sha256: string;
  };
  resolveOutputDir: (outputDir: string) => string;
  resolveProjection: (source: string, gender: 'boy' | 'girl') => string;
  sha256: (value: string | Buffer) => string;
  validateRequest: (value: unknown) => StorySourceRevisionRequest;
};

type TextReplacement = {
  expectedCount: number;
  from: string;
  to: string;
};

type DirectionReplacement = TextReplacement & {
  field: string;
  pageNumber: number;
};

type StorySourceRevisionRequest = {
  version: string;
  storyKey: string;
  briefId: string;
  source: {
    manifest: { path: string; sha256: string };
    story: { path: string; sha256: string };
  };
  visualDirections: {
    record: { path: string; sha256: string };
  };
  textReplacements: TextReplacement[];
  directionReplacements: DirectionReplacement[];
};

const REPO_ROOT = path.resolve(process.cwd());
const OUTPUTS_ROOT = path.join(REPO_ROOT, 'outputs');
const SOURCE_PATH =
  'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/story.md';
const SOURCE_MANIFEST_PATH =
  'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/manifest.json';
const DIRECTION_PATH =
  'story-pipeline/05_storyboard_inputs/autonomous-20260815-v1/chameleon_koko_bedtime.visual-directions.json';

const EXPECTED_SOURCE_SHA =
  '6da0babf1d7e97a0841d1c414e15bd682a525d8ab0366df49def7247079dd407';
const EXPECTED_DIRECTION_SHA =
  'a3b9483889c56caf0698eac87e62f89978e589f377c3a0ca5299a3d5075e3d29';
const EXPECTED_INTEGRATED_SHA =
  'ac1d0693f327b04ccbf7e2208460b70ca5c26159f9e4f3193bc0153b8ab2f310';
const EXPECTED_FEMALE_SHA =
  'dc614739573e0637510ebda887f4ec98f43d5b20b5e35e9eb5b1f6b487929ab8';
const EXPECTED_MALE_SHA =
  'c0fca7240a668445c0ad68acc4c58e3eb55f6bb89b079abc76b2a40597f79e7a';

const temporaryRoots: string[] = [];

function sha256(value: Buffer | string) {
  return createHash('sha256').update(value).digest('hex');
}

function repoBytes(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, ...relativePath.split('/')));
}

function boundReference(relativePath: string) {
  return { path: relativePath, sha256: sha256(repoBytes(relativePath)) };
}

function requestFixture(): StorySourceRevisionRequest {
  return {
    version: materializer.REQUEST_VERSION,
    storyKey: 'chameleon_koko_bedtime',
    briefId: 'chameleon_koko_bedtime_walking_bus_stop_brief_v1',
    source: {
      manifest: boundReference(SOURCE_MANIFEST_PATH),
      story: boundReference(SOURCE_PATH),
    },
    visualDirections: {
      record: boundReference(DIRECTION_PATH),
    },
    textReplacements: [
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
        from:
          '{{childName}} טיפסה על הספסל, שחררה את הגג מן החבל והחזירה את הגרב. אחר כך הובילה את התחנה',
        to:
          '{{childName}} {טיפס|טיפסה} על הספסל, {שחרר|שחררה} את הגג מן החבל {והחזיר|והחזירה} את הגרב. אחר כך {הוביל|הובילה} את התחנה',
      },
      {
        expectedCount: 1,
        from:
          '{{childName}} הנהנה. עכשיו היא כבר לא ניסתה להחזיר את התחנה לפינה. היא הקשיבה איתה לעיר.',
        to:
          '{{childName}} {הנהן|הנהנה}. עכשיו {הוא|היא} כבר לא {ניסה|ניסתה} להחזיר את התחנה לפינה. {הוא|היא} {הקשיב|הקשיבה} איתה לעיר.',
      },
      {
        expectedCount: 1,
        from:
          'היא הובילה את האוטובוס אל המפרץ השקט שקִים זכרה. שם הניחה את תיק הגב כספסל קטן, הרימה את פנס הכיס כמו ירח זעיר וביקשה מקִים לחכות לצדה.',
        to:
          '{הוא|היא} {הוביל|הובילה} את האוטובוס אל המפרץ השקט שקִים זכרה. שם {הניח|הניחה} את תיק הגב כספסל קטן, {הרים|הרימה} את פנס הכיס כמו ירח זעיר {וביקש|וביקשה} מקִים לחכות {לצדו|לצדה}.',
      },
      {
        expectedCount: 1,
        from: '"זו התחנה ללילה אחד," הכריזה.',
        to: '"זו התחנה ללילה אחד," {הכריז|הכריזה}.',
      },
      {
        expectedCount: 1,
        from: 'עד הרחוב שלהן.',
        to: 'עד הרחוב {שלהם|שלהן}.',
      },
      {
        expectedCount: 1,
        from: 'בבית נכנסה {{childName}} למיטה, וקִים התכרבלה לידה.',
        to: 'בבית {נכנס|נכנסה} {{childName}} למיטה, וקִים התכרבלה {לידו|לידה}.',
      },
    ],
    directionReplacements: [
      {
        expectedCount: 1,
        field: 'mainAction',
        from: 'with her backpack',
        pageNumber: 6,
        to: "with the child's backpack",
      },
      {
        expectedCount: 1,
        field: 'mainAction',
        from: 'Kim curled beside her',
        pageNumber: 8,
        to: 'Kim curled beside the child',
      },
    ],
  };
}

function writeRequest(request = requestFixture()) {
  fs.mkdirSync(OUTPUTS_ROOT, { recursive: true });
  const root = fs.mkdtempSync(path.join(OUTPUTS_ROOT, 'story-source-revision-test-'));
  temporaryRoots.push(root);
  const requestPath = path.join(root, 'request.json');
  fs.writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`, 'utf8');
  return {
    outputAbsolute: path.join(root, 'pending'),
    outputRelative: path.relative(REPO_ROOT, path.join(root, 'pending')).split('\\').join('/'),
    requestPath,
    root,
  };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    const resolved = path.resolve(root);
    if (resolved.startsWith(`${path.resolve(OUTPUTS_ROOT)}${path.sep}`)) {
      fs.rmSync(resolved, { force: true, recursive: true });
    }
  }
});

describe('story source revision materializer', () => {
  it('builds the exact pending Chameleon revision without writing or approving anything', () => {
    const historicalStory = repoBytes(SOURCE_PATH);
    const historicalDirections = repoBytes(DIRECTION_PATH);
    const fixture = writeRequest();
    const requestFile = materializer.readRequestFile(fixture.requestPath);
    const outputDir = materializer.resolveOutputDir(fixture.outputRelative);

    const result = materializer.buildStorySourceRevision({
      requestFile,
      outputDir,
      write: false,
    });

    expect(result.created).toBe(false);
    expect(fs.existsSync(fixture.outputAbsolute)).toBe(false);
    expect(result.manifest.version).toBe(materializer.MANIFEST_VERSION);
    expect(result.manifest.status).toBe('pending_exact_product_review');
    expect(result.manifest.outputs.acceptedStoryCandidate).toMatchObject({
      bytes: 6220,
      sha256: EXPECTED_SOURCE_SHA,
    });
    expect(result.manifest.outputs.visualDirectionCandidate.sha256).toBe(
      EXPECTED_DIRECTION_SHA,
    );
    expect(result.manifest.outputs.integratedStoryCandidate).toMatchObject({
      bytes: 9641,
      sha256: EXPECTED_INTEGRATED_SHA,
    });
    expect(result.manifest.projections.female).toMatchObject({
      byteIdenticalToPrevious: true,
      sha256: EXPECTED_FEMALE_SHA,
    });
    expect(result.manifest.projections.male.sha256).toBe(EXPECTED_MALE_SHA);
    expect(result.manifest.invariants).toEqual({
      approved: false,
      databaseWrites: 0,
      editoriallyCanonical: true,
      historicalInputsRewritten: false,
      integratedSourceProjectionExact: true,
      providerCalls: 0,
      renders: 0,
      storageWrites: 0,
      visualDirectionsValid: true,
    });
    expect(repoBytes(SOURCE_PATH)).toEqual(historicalStory);
    expect(repoBytes(DIRECTION_PATH)).toEqual(historicalDirections);
  });

  it('writes only digest-named immutable pending files into a fresh outputs child', () => {
    const fixture = writeRequest();
    const requestFile = materializer.readRequestFile(fixture.requestPath);
    const outputDir = materializer.resolveOutputDir(fixture.outputRelative);

    const result = materializer.buildStorySourceRevision({
      requestFile,
      outputDir,
      write: true,
    });

    expect(result.created).toBe(true);
    const names = fs.readdirSync(fixture.outputAbsolute).sort();
    expect(names).toEqual(Object.values(result.files).sort());
    expect(names).toHaveLength(5);
    expect(names.every((name) => /^[a-f0-9]{64}\./.test(name))).toBe(true);
    const sourceBytes = fs.readFileSync(
      path.join(fixture.outputAbsolute, result.files.source),
    );
    const directionBytes = fs.readFileSync(
      path.join(fixture.outputAbsolute, result.files.direction),
    );
    const integratedBytes = fs.readFileSync(
      path.join(fixture.outputAbsolute, result.files.integratedStory),
    );
    expect(sha256(sourceBytes)).toBe(EXPECTED_SOURCE_SHA);
    expect(sha256(directionBytes)).toBe(EXPECTED_DIRECTION_SHA);
    expect(sha256(integratedBytes)).toBe(EXPECTED_INTEGRATED_SHA);
    expect(() => materializer.resolveOutputDir(fixture.outputRelative)).toThrow(
      'story_source_revision_output_not_fresh',
    );
  });

  it('keeps its gender projection exactly aligned with the production resolver', () => {
    const source = [
      '{{childName}} {ניסה|ניסתה} לעזור ל־{{companionName}}.',
      '{{childName}} צריך/ה להיות ילד/ה סבלני/ת.',
    ].join('\n');
    for (const gender of ['boy', 'girl'] as const) {
      expect(materializer.resolveProjection(source, gender)).toBe(
        resolveStoryBankPlaceholders(source, {
          childGender: gender,
          childName: '{{childName}}',
          companionName: '{{companionName}}',
        }),
      );
    }
  });

  it('rejects malformed requests, overlapping replacements and target drift', () => {
    const base = requestFixture();
    expect(() =>
      materializer.validateRequest({ ...base, unexpected: true }),
    ).toThrow('story_source_revision_request_invalid');
    expect(() =>
      materializer.validateRequest({
        ...base,
        source: {
          ...base.source,
          manifest: { ...base.source.manifest, path: 'outputs/forged/manifest.json' },
          story: { ...base.source.story, path: 'outputs/forged/story.md' },
        },
      }),
    ).toThrow('story_source_revision_request_invalid');
    expect(() =>
      materializer.validateRequest({
        ...base,
        textReplacements: [
          ...base.textReplacements,
          { expectedCount: 1, from: 'לילה', to: 'ערב' },
        ],
      }),
    ).toThrow('story_source_revision_request_invalid');

    const countDrift = structuredClone(base);
    countDrift.textReplacements[0].expectedCount = 2;
    const countFixture = writeRequest(countDrift);
    expect(() =>
      materializer.buildStorySourceRevision({
        requestFile: materializer.readRequestFile(countFixture.requestPath),
        outputDir: materializer.resolveOutputDir(countFixture.outputRelative),
        write: false,
      }),
    ).toThrow('story_source_revision_text_target_invalid');

    const directionDrift = structuredClone(base);
    directionDrift.directionReplacements[0].pageNumber = 5;
    const directionFixture = writeRequest(directionDrift);
    expect(() =>
      materializer.buildStorySourceRevision({
        requestFile: materializer.readRequestFile(directionFixture.requestPath),
        outputDir: materializer.resolveOutputDir(directionFixture.outputRelative),
        write: false,
      }),
    ).toThrow('story_source_revision_direction_target_invalid');
  });

  it('rejects source drift, female-projection drift and output escape', () => {
    const stale = requestFixture();
    stale.source.story.sha256 = '0'.repeat(64);
    const staleFixture = writeRequest(stale);
    expect(() =>
      materializer.buildStorySourceRevision({
        requestFile: materializer.readRequestFile(staleFixture.requestPath),
        outputDir: materializer.resolveOutputDir(staleFixture.outputRelative),
        write: false,
      }),
    ).toThrow('story_source_revision_story_invalid_drift');

    const femaleDrift = requestFixture();
    femaleDrift.textReplacements[0].to = '{{childName}} {ניסה|ניסו} לסובב';
    const femaleFixture = writeRequest(femaleDrift);
    expect(() =>
      materializer.buildStorySourceRevision({
        requestFile: materializer.readRequestFile(femaleFixture.requestPath),
        outputDir: materializer.resolveOutputDir(femaleFixture.outputRelative),
        write: false,
      }),
    ).toThrow('story_source_revision_female_projection_drift');

    expect(() => materializer.resolveOutputDir('story-pipeline/escape')).toThrow(
      'story_source_revision_output_path_rejected',
    );
  });

  it('requires the exact CLI surface and explicit write decision', () => {
    expect(
      materializer.parseArgs([
        'prepare',
        '--request',
        'outputs/request.json',
        '--out',
        'outputs/pending',
        '--write',
        'false',
      ]),
    ).toEqual({
      outputDir: 'outputs/pending',
      requestPath: 'outputs/request.json',
      write: false,
    });
    expect(() =>
      materializer.parseArgs([
        'prepare',
        '--request',
        'outputs/request.json',
        '--out',
        'outputs/pending',
        '--write',
        'yes',
      ]),
    ).toThrow('story_source_revision_cli_arguments_invalid');
  });
});
