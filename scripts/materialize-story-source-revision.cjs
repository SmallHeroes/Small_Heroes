#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { injectDirections } = require('./story-bank-direction-integration.cjs');
const {
  validateEditorialPassDraft,
} = require('./story-editorial-validation-contract.cjs');
const {
  parseStory,
  validateVisualDirectionRecord,
} = require('./story-visual-direction-contract.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUTS_ROOT = path.join(REPO_ROOT, 'outputs');
const ACCEPTED_SOURCE_ROOT =
  'story-pipeline/04_approved_story_sources/accepted/';
const STORYBOARD_INPUT_ROOT = 'story-pipeline/05_storyboard_inputs/';
const REQUEST_VERSION = 'small-heroes-story-source-revision-request/v1';
const MANIFEST_VERSION = 'small-heroes-story-source-revision-pending-manifest/v1';
const DIRECTION_MIGRATION_VERSION =
  'small-heroes-story-visual-direction-deterministic-migration/v1';
const ALLOWED_DIRECTION_FIELDS = new Set([
  'heroObject',
  'lighting',
  'mainAction',
  'setting',
]);

const REQUEST_KEYS = [
  'briefId',
  'directionReplacements',
  'source',
  'storyKey',
  'textReplacements',
  'version',
  'visualDirections',
];
const FILE_REFERENCE_KEYS = ['path', 'sha256'];
const TEXT_REPLACEMENT_KEYS = ['expectedCount', 'from', 'to'];
const DIRECTION_REPLACEMENT_KEYS = [
  'expectedCount',
  'field',
  'from',
  'pageNumber',
  'to',
];

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

function canonicalBytes(value) {
  return `${JSON.stringify(canonical(value), null, 2)}\n`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function exactKeys(value, keys) {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join('\0') === [...keys].sort().join('\0')
  );
}

function pathIsInside(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function canonicalRepoRelativePathIsValid(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 512 &&
    !value.includes('\0') &&
    !value.includes('\\') &&
    value === value.trim() &&
    value === path.posix.normalize(value) &&
    !value.startsWith('/') &&
    !value.startsWith('../') &&
    value !== '..'
  );
}

function storyKeyFromAcceptedSourcePath(sourceStoryPath) {
  const acceptedRoot = ACCEPTED_SOURCE_ROOT.replace(/\/$/, '');
  const sourceDirectory = path.posix.dirname(sourceStoryPath);
  const relativeDirectory = path.posix.relative(acceptedRoot, sourceDirectory);
  if (
    !/^[a-z][a-z0-9_]{2,95}$/.test(relativeDirectory) ||
    relativeDirectory.includes('/')
  ) {
    throw new Error('story_source_revision_request_invalid');
  }
  return relativeDirectory;
}

function assertNoSymbolicLinkComponents(rootPath, targetPath, code) {
  const relative = path.relative(rootPath, targetPath);
  if (
    relative.length === 0 ||
    relative.startsWith('..') ||
    path.isAbsolute(relative)
  ) {
    throw new Error(code);
  }
  let current = rootPath;
  const rootStat = fs.lstatSync(current);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error(code);
  }
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    if (fs.lstatSync(current).isSymbolicLink()) {
      throw new Error(code);
    }
  }
}

function cleanText(value, maximum = 4096) {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= maximum &&
    !value.includes('\0')
  );
}

function validateFileReference(value, code) {
  if (
    !exactKeys(value, FILE_REFERENCE_KEYS) ||
    !canonicalRepoRelativePathIsValid(value.path) ||
    !/^[a-f0-9]{64}$/.test(value.sha256)
  ) {
    throw new Error(code);
  }
  return value;
}

function validateReplacement(value, keys, code) {
  if (
    !exactKeys(value, keys) ||
    !cleanText(value.from) ||
    !cleanText(value.to) ||
    value.from === value.to ||
    !Number.isInteger(value.expectedCount) ||
    value.expectedCount < 1 ||
    value.expectedCount > 16
  ) {
    throw new Error(code);
  }
  return value;
}

function validateRequest(value) {
  if (
    !exactKeys(value, REQUEST_KEYS) ||
    value.version !== REQUEST_VERSION ||
    !/^[a-z][a-z0-9_]{2,95}$/.test(value.storyKey) ||
    !/^[a-z][a-z0-9_]{2,159}$/.test(value.briefId) ||
    !exactKeys(value.source, ['manifest', 'story']) ||
    !exactKeys(value.visualDirections, ['record']) ||
    !Array.isArray(value.textReplacements) ||
    value.textReplacements.length < 1 ||
    value.textReplacements.length > 64 ||
    !Array.isArray(value.directionReplacements) ||
    value.directionReplacements.length > 32
  ) {
    throw new Error('story_source_revision_request_invalid');
  }

  validateFileReference(value.source.manifest, 'story_source_revision_request_invalid');
  validateFileReference(value.source.story, 'story_source_revision_request_invalid');
  validateFileReference(
    value.visualDirections.record,
    'story_source_revision_request_invalid',
  );
  const sourceStoryKey = storyKeyFromAcceptedSourcePath(value.source.story.path);
  if (
    !value.source.manifest.path.startsWith(ACCEPTED_SOURCE_ROOT) ||
    !value.source.story.path.startsWith(ACCEPTED_SOURCE_ROOT) ||
    path.posix.basename(value.source.manifest.path) !== 'manifest.json' ||
    path.posix.basename(value.source.story.path) !== 'story.md' ||
    path.posix.dirname(value.source.manifest.path) !==
      path.posix.dirname(value.source.story.path) ||
    value.storyKey !== sourceStoryKey ||
    !value.visualDirections.record.path.startsWith(STORYBOARD_INPUT_ROOT) ||
    path.posix.basename(value.visualDirections.record.path) !==
      `${sourceStoryKey}.visual-directions.json`
  ) {
    throw new Error('story_source_revision_request_invalid');
  }

  const textFrom = new Set();
  for (const replacement of value.textReplacements) {
    validateReplacement(
      replacement,
      TEXT_REPLACEMENT_KEYS,
      'story_source_revision_request_invalid',
    );
    if (textFrom.has(replacement.from)) {
      throw new Error('story_source_revision_request_invalid');
    }
    textFrom.add(replacement.from);
  }
  const textReplacements = value.textReplacements;
  for (let leftIndex = 0; leftIndex < textReplacements.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < textReplacements.length; rightIndex += 1) {
      const left = textReplacements[leftIndex];
      const right = textReplacements[rightIndex];
      if (
        left.from.includes(right.from) ||
        right.from.includes(left.from) ||
        left.to.includes(right.from) ||
        right.to.includes(left.from)
      ) {
        throw new Error('story_source_revision_request_invalid');
      }
    }
  }

  const directionIdentities = new Set();
  for (const replacement of value.directionReplacements) {
    validateReplacement(
      replacement,
      DIRECTION_REPLACEMENT_KEYS,
      'story_source_revision_request_invalid',
    );
    if (
      !Number.isInteger(replacement.pageNumber) ||
      replacement.pageNumber < 1 ||
      replacement.pageNumber > 32 ||
      !ALLOWED_DIRECTION_FIELDS.has(replacement.field)
    ) {
      throw new Error('story_source_revision_request_invalid');
    }
    const identity = `${replacement.pageNumber}:${replacement.field}`;
    if (directionIdentities.has(identity)) {
      throw new Error('story_source_revision_request_invalid');
    }
    directionIdentities.add(identity);
  }
  return value;
}

function readBoundRepoFile(reference, maximumBytes, code, allowedRootRelative) {
  const absolutePath = path.resolve(REPO_ROOT, ...reference.path.split('/'));
  const absoluteAllowedRoot = path.resolve(
    REPO_ROOT,
    ...allowedRootRelative.replace(/\/$/, '').split('/'),
  );
  let linkStat;
  let realPath;
  let realAllowedRoot;
  try {
    if (!pathIsInside(absoluteAllowedRoot, absolutePath)) {
      throw new Error(code);
    }
    assertNoSymbolicLinkComponents(absoluteAllowedRoot, absolutePath, code);
    linkStat = fs.lstatSync(absolutePath);
    realPath = fs.realpathSync(absolutePath);
    realAllowedRoot = fs.realpathSync(absoluteAllowedRoot);
  } catch {
    throw new Error(code);
  }
  if (
    linkStat.isSymbolicLink() ||
    !linkStat.isFile() ||
    linkStat.nlink !== 1 ||
    !pathIsInside(realAllowedRoot, realPath) ||
    linkStat.size < 1 ||
    linkStat.size > maximumBytes
  ) {
    throw new Error(code);
  }
  const bytes = fs.readFileSync(realPath);
  if (sha256(bytes) !== reference.sha256) {
    throw new Error(`${code}_drift`);
  }
  return {
    absolutePath: realPath,
    bytes,
    relativePath: path.relative(REPO_ROOT, realPath).replaceAll('\\', '/'),
    sha256: reference.sha256,
  };
}

function readRequestFile(requestPath) {
  const absoluteRequestPath = path.resolve(requestPath);
  let linkStat;
  let realPath;
  let realOutputsRoot;
  try {
    if (!pathIsInside(OUTPUTS_ROOT, absoluteRequestPath)) {
      throw new Error('story_source_revision_request_path_rejected');
    }
    assertNoSymbolicLinkComponents(
      OUTPUTS_ROOT,
      absoluteRequestPath,
      'story_source_revision_request_path_rejected',
    );
    linkStat = fs.lstatSync(absoluteRequestPath);
    realPath = fs.realpathSync(absoluteRequestPath);
    realOutputsRoot = fs.realpathSync(OUTPUTS_ROOT);
  } catch {
    throw new Error('story_source_revision_request_path_rejected');
  }
  if (
    path.extname(realPath).toLowerCase() !== '.json' ||
    linkStat.isSymbolicLink() ||
    !linkStat.isFile() ||
    linkStat.nlink !== 1 ||
    !pathIsInside(realOutputsRoot, realPath) ||
    linkStat.size < 1 ||
    linkStat.size > 128 * 1024
  ) {
    throw new Error('story_source_revision_request_path_rejected');
  }
  const bytes = fs.readFileSync(realPath);
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error('story_source_revision_request_json_invalid');
  }
  return {
    bytes,
    relativePath: path.relative(REPO_ROOT, realPath).replaceAll('\\', '/'),
    request: validateRequest(value),
    sha256: sha256(bytes),
  };
}

function resolveOutputDir(outputDir) {
  if (!canonicalRepoRelativePathIsValid(outputDir)) {
    throw new Error('story_source_revision_output_path_rejected');
  }
  const absoluteOutputDir = path.resolve(REPO_ROOT, ...outputDir.split('/'));
  const realOutputsRoot = fs.realpathSync(OUTPUTS_ROOT);
  if (!pathIsInside(realOutputsRoot, absoluteOutputDir)) {
    throw new Error('story_source_revision_output_path_rejected');
  }
  let current = absoluteOutputDir;
  const parents = [];
  while (current !== realOutputsRoot && pathIsInside(realOutputsRoot, current)) {
    parents.push(current);
    current = path.dirname(current);
  }
  for (const entry of parents.reverse()) {
    if (fs.existsSync(entry) && fs.lstatSync(entry).isSymbolicLink()) {
      throw new Error('story_source_revision_output_path_rejected');
    }
  }
  if (fs.existsSync(absoluteOutputDir)) {
    const stat = fs.lstatSync(absoluteOutputDir);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error('story_source_revision_output_path_rejected');
    }
    if (fs.readdirSync(absoluteOutputDir).length > 0) {
      throw new Error('story_source_revision_output_not_fresh');
    }
  }
  return absoluteOutputDir;
}

function countOccurrences(value, needle) {
  return value.split(needle).length - 1;
}

function applyExactTextReplacements(source, replacements, code) {
  for (const replacement of replacements) {
    if (countOccurrences(source, replacement.from) !== replacement.expectedCount) {
      throw new Error(code);
    }
  }
  let output = source;
  for (const replacement of replacements) {
    output = output.split(replacement.from).join(replacement.to);
  }
  return output;
}

function resolveSlashedGenderForms(text, gender) {
  const finalToNonfinal = { 'ם': 'מ', 'ן': 'נ', 'ץ': 'צ', 'ף': 'פ', 'ך': 'כ' };
  return text.replace(
    /([\u0590-\u05FF]+)\/([\u0590-\u05FF]+)(?=$|[^\u0590-\u05FF])/gu,
    (_, base, suffix) => {
      const key = `${base}/${suffix}`;
      if (gender === 'girl') {
        if (key === 'ילד/ה') return 'ילדה';
        if (key === 'שם/ה') return 'שמה';
        if (key === 'צריך/ה') return 'צריכה';
        if (key === 'את/ה') return 'את';
        if (suffix.length > 1) return suffix;
        if (suffix === 'ת') {
          const last = base.slice(-1);
          return `${base.slice(0, -1)}${finalToNonfinal[last] ?? last}ת`;
        }
        return `${base}${suffix}`;
      }
      return key === 'את/ה' ? 'אתה' : base;
    },
  );
}

function resolveProjection(source, gender) {
  let output = source.replace(/\{([^{}|]+)\|([^{}|]+)\}/gu, (_, male, female) =>
      gender === 'girl' ? female.trim() : male.trim(),
    );
  output = resolveSlashedGenderForms(output, gender);
  return output;
}

function applyDirectionReplacements(record, replacements) {
  const output = structuredClone(record);
  for (const replacement of replacements) {
    const page = output.pages[replacement.pageNumber - 1];
    if (!page || page.pageNumber !== replacement.pageNumber) {
      throw new Error('story_source_revision_direction_target_invalid');
    }
    const current = page[replacement.field];
    if (
      typeof current !== 'string' ||
      countOccurrences(current, replacement.from) !== replacement.expectedCount
    ) {
      throw new Error('story_source_revision_direction_target_invalid');
    }
    page[replacement.field] = current.split(replacement.from).join(replacement.to);
  }
  return output;
}

function validateSourceManifest(manifest, request, sourceFile, story) {
  if (
    manifest?.version !== 'small-heroes-product-accepted-story-source-manifest/v1' ||
    manifest?.status !== 'product_accepted_story_source' ||
    manifest?.authorityScope !== 'story_text_only' ||
    manifest?.record?.briefId !== request.briefId ||
    manifest?.record?.story?.filename !== path.basename(sourceFile.relativePath) ||
    manifest?.record?.story?.bytes !== sourceFile.bytes.length ||
    manifest?.record?.story?.sha256 !== sourceFile.sha256 ||
    story.companionId !== manifest?.record?.companionId ||
    story.direction !== manifest?.record?.direction ||
    story.category !== manifest?.record?.category ||
    story.declaredPages !== manifest?.record?.textPageCount
  ) {
    throw new Error('story_source_revision_source_authority_invalid');
  }
}

function buildStorySourceRevision({ requestFile, outputDir, write }) {
  const request = requestFile.request;
  const sourceManifestFile = readBoundRepoFile(
    request.source.manifest,
    128 * 1024,
    'story_source_revision_manifest_invalid',
    ACCEPTED_SOURCE_ROOT,
  );
  const sourceFile = readBoundRepoFile(
    request.source.story,
    128 * 1024,
    'story_source_revision_story_invalid',
    ACCEPTED_SOURCE_ROOT,
  );
  const directionFile = readBoundRepoFile(
    request.visualDirections.record,
    256 * 1024,
    'story_source_revision_direction_invalid',
    STORYBOARD_INPUT_ROOT,
  );

  let sourceManifest;
  let directionRecord;
  try {
    sourceManifest = JSON.parse(sourceManifestFile.bytes.toString('utf8'));
    directionRecord = JSON.parse(directionFile.bytes.toString('utf8'));
  } catch {
    throw new Error('story_source_revision_input_json_invalid');
  }
  const sourceText = sourceFile.bytes.toString('utf8');
  const sourceStory = parseStory(sourceText);
  validateSourceManifest(sourceManifest, request, sourceFile, sourceStory);
  const record = {
    companionId: sourceManifest.record.companionId,
    brief: {
      id: sourceManifest.record.briefId,
      direction: sourceManifest.record.direction,
      category: sourceManifest.record.category,
      pageCount: sourceManifest.record.textPageCount,
    },
  };
  validateVisualDirectionRecord(directionRecord, request.storyKey, sourceStory.declaredPages);

  const revisedSourceText = applyExactTextReplacements(
    sourceText,
    request.textReplacements,
    'story_source_revision_text_target_invalid',
  );
  const revisedSourceSha256 = sha256(revisedSourceText);
  validateEditorialPassDraft(record, {
    text: revisedSourceText,
    sha256: revisedSourceSha256,
  });
  const revisedStory = parseStory(revisedSourceText);

  const previousFemaleProjection = resolveProjection(
    sourceText,
    'girl',
  );
  const revisedFemaleProjection = resolveProjection(
    revisedSourceText,
    'girl',
  );
  if (previousFemaleProjection !== revisedFemaleProjection) {
    throw new Error('story_source_revision_female_projection_drift');
  }
  const revisedMaleProjection = resolveProjection(
    revisedSourceText,
    'boy',
  );
  if (/\{[^{}]+\|[^{}]+\}/u.test(
    `${revisedFemaleProjection}\n${revisedMaleProjection}`,
  )) {
    throw new Error('story_source_revision_projection_incomplete');
  }

  const revisedDirectionRecord = applyDirectionReplacements(
    directionRecord,
    request.directionReplacements,
  );
  validateVisualDirectionRecord(
    revisedDirectionRecord,
    request.storyKey,
    revisedStory.declaredPages,
  );
  const revisedDirectionBytes = `${JSON.stringify(revisedDirectionRecord, null, 2)}\n`;
  const revisedDirectionSha256 = sha256(revisedDirectionBytes);
  const integratedText = injectDirections(revisedSourceText, revisedDirectionRecord);
  const integratedSha256 = sha256(integratedText);
  const strippedIntegratedText = integratedText.replace(/^imageDirection:.*\r?\n/gm, '');
  if (strippedIntegratedText !== revisedSourceText) {
    throw new Error('story_source_revision_integrated_projection_drift');
  }

  const sourceFilename = `${revisedSourceSha256}.story.md`;
  const directionFilename = `${revisedDirectionSha256}.visual-directions.json`;
  const integratedFilename = `${integratedSha256}.integrated.md`;
  const migrationPayload = {
    version: DIRECTION_MIGRATION_VERSION,
    status: 'pending_exact_review',
    authorityScope: 'deterministic_direction_text_migration_only',
    storyKey: request.storyKey,
    sourceStorySha256: revisedSourceSha256,
    previousDirectionSha256: directionFile.sha256,
    revisedDirectionSha256,
    replacements: request.directionReplacements.map((replacement) => ({
      expectedCount: replacement.expectedCount,
      field: replacement.field,
      pageNumber: replacement.pageNumber,
    })),
    providerCalls: 0,
    transportRetries: 0,
    fallbackUsed: false,
  };
  const migrationDigest = sha256(canonicalBytes(migrationPayload));
  const migration = { ...migrationPayload, digest: migrationDigest };
  const migrationBytes = canonicalBytes(migration);
  const migrationFilename = `${migrationDigest}.direction-migration.json`;

  const manifestPayload = {
    version: MANIFEST_VERSION,
    status: 'pending_exact_product_review',
    authorityScope: 'story_source_and_visual_directions_only',
    storyKey: request.storyKey,
    briefId: request.briefId,
    request: {
      path: requestFile.relativePath,
      bytes: requestFile.bytes.length,
      sha256: requestFile.sha256,
      version: request.version,
    },
    inputs: {
      acceptedManifest: {
        path: sourceManifestFile.relativePath,
        bytes: sourceManifestFile.bytes.length,
        sha256: sourceManifestFile.sha256,
      },
      acceptedStory: {
        path: sourceFile.relativePath,
        bytes: sourceFile.bytes.length,
        sha256: sourceFile.sha256,
      },
      visualDirections: {
        path: directionFile.relativePath,
        bytes: directionFile.bytes.length,
        sha256: directionFile.sha256,
      },
    },
    outputs: {
      acceptedStoryCandidate: {
        filename: sourceFilename,
        bytes: Buffer.byteLength(revisedSourceText, 'utf8'),
        sha256: revisedSourceSha256,
      },
      visualDirectionCandidate: {
        filename: directionFilename,
        bytes: Buffer.byteLength(revisedDirectionBytes, 'utf8'),
        sha256: revisedDirectionSha256,
      },
      integratedStoryCandidate: {
        filename: integratedFilename,
        bytes: Buffer.byteLength(integratedText, 'utf8'),
        sha256: integratedSha256,
      },
      directionMigration: {
        filename: migrationFilename,
        bytes: Buffer.byteLength(migrationBytes, 'utf8'),
        sha256: sha256(migrationBytes),
        digest: migrationDigest,
      },
    },
    projections: {
      female: {
        byteIdenticalToPrevious: true,
        bytes: Buffer.byteLength(revisedFemaleProjection, 'utf8'),
        sha256: sha256(revisedFemaleProjection),
      },
      male: {
        bytes: Buffer.byteLength(revisedMaleProjection, 'utf8'),
        sha256: sha256(revisedMaleProjection),
      },
    },
    invariants: {
      historicalInputsRewritten: false,
      editoriallyCanonical: true,
      visualDirectionsValid: true,
      integratedSourceProjectionExact: true,
      approved: false,
      providerCalls: 0,
      storageWrites: 0,
      databaseWrites: 0,
      renders: 0,
    },
  };
  const manifestDigest = sha256(canonicalBytes(manifestPayload));
  const manifest = { ...manifestPayload, digest: manifestDigest };
  const manifestBytes = canonicalBytes(manifest);
  const manifestFilename = `${manifestDigest}.manifest.json`;

  const output = {
    created: write,
    outputDir: path.relative(REPO_ROOT, outputDir).replaceAll('\\', '/'),
    manifest,
    files: {
      direction: directionFilename,
      integratedStory: integratedFilename,
      manifest: manifestFilename,
      migration: migrationFilename,
      source: sourceFilename,
    },
  };
  if (!write) return output;

  fs.mkdirSync(outputDir, { recursive: true });
  if (fs.readdirSync(outputDir).length > 0) {
    throw new Error('story_source_revision_output_not_fresh');
  }
  fs.writeFileSync(path.join(outputDir, sourceFilename), revisedSourceText, {
    encoding: 'utf8',
    flag: 'wx',
  });
  fs.writeFileSync(path.join(outputDir, directionFilename), revisedDirectionBytes, {
    encoding: 'utf8',
    flag: 'wx',
  });
  fs.writeFileSync(path.join(outputDir, integratedFilename), integratedText, {
    encoding: 'utf8',
    flag: 'wx',
  });
  fs.writeFileSync(path.join(outputDir, migrationFilename), migrationBytes, {
    encoding: 'utf8',
    flag: 'wx',
  });
  fs.writeFileSync(path.join(outputDir, manifestFilename), manifestBytes, {
    encoding: 'utf8',
    flag: 'wx',
  });
  return output;
}

function parseArgs(argv) {
  const [command, ...tokens] = argv;
  if (command !== 'prepare' || tokens.length !== 6) {
    throw new Error(
      'usage: prepare --request <outputs-json> --out <outputs-dir> --write true|false',
    );
  }
  const values = new Map();
  for (let index = 0; index < tokens.length; index += 2) {
    const key = tokens[index];
    const value = tokens[index + 1];
    if (!['--out', '--request', '--write'].includes(key) || values.has(key)) {
      throw new Error('story_source_revision_cli_arguments_invalid');
    }
    values.set(key, value);
  }
  if ([...values.keys()].sort().join(',') !== '--out,--request,--write') {
    throw new Error('story_source_revision_cli_arguments_invalid');
  }
  const writeValue = values.get('--write');
  if (!['true', 'false'].includes(writeValue)) {
    throw new Error('story_source_revision_cli_arguments_invalid');
  }
  return {
    outputDir: values.get('--out'),
    requestPath: values.get('--request'),
    write: writeValue === 'true',
  };
}

function main(argv) {
  const args = parseArgs(argv);
  const requestFile = readRequestFile(args.requestPath);
  const outputDir = resolveOutputDir(args.outputDir);
  const result = buildStorySourceRevision({
    requestFile,
    outputDir,
    write: args.write,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message.split(':')[0] : 'story_source_revision_unknown_failure'}\n`,
    );
    process.exitCode = 1;
  }
}

module.exports = {
  DIRECTION_MIGRATION_VERSION,
  MANIFEST_VERSION,
  REQUEST_VERSION,
  applyDirectionReplacements,
  applyExactTextReplacements,
  buildStorySourceRevision,
  canonicalBytes,
  parseArgs,
  readBoundRepoFile,
  readRequestFile,
  resolveOutputDir,
  resolveProjection,
  sha256,
  storyKeyFromAcceptedSourcePath,
  validateRequest,
};
