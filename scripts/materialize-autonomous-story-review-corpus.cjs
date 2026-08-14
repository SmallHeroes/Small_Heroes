#!/usr/bin/env node
// @ts-check

const fs = require('node:fs');
const path = require('node:path');

const {
  findRecord,
  loadStoryArchitectAuthority,
  sha256,
  validateEditorialPassDraft,
  validateEditorialReviewResult,
} = require('./materialize-story-commission-briefs.cjs');

const ROOT = path.resolve(__dirname, '..');
const OUTPUTS_ROOT = path.join(ROOT, 'outputs');
const REVIEW_ROOT = path.join(
  ROOT,
  'story-pipeline',
  '04_approved_story_sources',
  'review-corpora',
);
const VERSION = 'small-heroes-autonomous-story-review-corpus/v1';
const SELECTION_VERSION = 'small-heroes-autonomous-story-corpus-selection/v1';
const ACCEPTED_DINI_BRIEF_ID = 'dragon_dini_adventure_wobble_cake_convoy_brief_v1';
const PIPELINE_VERSIONS = new Set([
  'small-heroes-autonomous-story-batch/v1',
  'small-heroes-autonomous-story-batch/v2',
  'small-heroes-autonomous-story-batch/v3',
]);

function hasExactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join('|') === [...keys].sort().join('|');
}

function isInside(parent, target) {
  const relative = path.relative(path.resolve(parent), path.resolve(target));
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined || key in values) {
      throw new Error('story_review_corpus_arguments_invalid');
    }
    values[key.slice(2)] = value;
  }
  if (!values.selection || !values['output-dir'] || Object.keys(values).length !== 2) {
    throw new Error('story_review_corpus_arguments_invalid');
  }
  return values;
}

function readJson(filePath, code) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    throw new Error(code);
  }
}

function validateSelection(value, authority) {
  if (
    !hasExactKeys(value, ['version', 'acceptedExistingBriefId', 'manifestDigests', 'records']) ||
    value.version !== SELECTION_VERSION ||
    value.acceptedExistingBriefId !== ACCEPTED_DINI_BRIEF_ID ||
    !Array.isArray(value.records) ||
    !value.manifestDigests ||
    typeof value.manifestDigests !== 'object' ||
    Array.isArray(value.manifestDigests)
  ) {
    throw new Error('story_review_corpus_selection_invalid');
  }
  const expected = authority.commissions
    .map(({ briefId }) => briefId)
    .filter((briefId) => briefId !== ACCEPTED_DINI_BRIEF_ID)
    .sort();
  const actual = value.records.map(({ briefId }) => briefId).sort();
  if (
    value.records.length !== 17 ||
    new Set(actual).size !== actual.length ||
    actual.join('|') !== expected.join('|')
  ) {
    throw new Error('story_review_corpus_coverage_invalid');
  }
  for (const record of value.records) {
    if (
      !hasExactKeys(record, [
        'briefId', 'root', 'storySha256', 'reviewSha256', 'pipelineVersion', 'repoHead',
      ]) ||
      typeof record.briefId !== 'string' ||
      typeof record.root !== 'string' ||
      !/^outputs\/[a-zA-Z0-9._/-]+$/.test(record.root) ||
      !/^[a-f0-9]{64}$/.test(record.storySha256) ||
      !/^[a-f0-9]{64}$/.test(record.reviewSha256) ||
      !PIPELINE_VERSIONS.has(record.pipelineVersion) ||
      !/^[a-f0-9]{40}$/.test(record.repoHead)
    ) {
      throw new Error('story_review_corpus_selection_invalid');
    }
  }
  const selectedRoots = [...new Set(value.records.map(({ root }) => root))].sort();
  if (
    Object.keys(value.manifestDigests).sort().join('|') !== selectedRoots.join('|') ||
    Object.values(value.manifestDigests).some(
      (digest) => typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest),
    )
  ) {
    throw new Error('story_review_corpus_manifest_digests_invalid');
  }
  return value;
}

function readContentAddressed(root, descriptor, expectedSha, extension) {
  if (
    !hasExactKeys(descriptor, ['filename', 'sha256', 'bytes']) ||
    descriptor.sha256 !== expectedSha ||
    !descriptor.filename.endsWith(extension) ||
    !descriptor.filename.includes(expectedSha)
  ) {
    throw new Error('story_review_corpus_descriptor_invalid');
  }
  const absolute = path.resolve(root, descriptor.filename);
  if (!isInside(root, absolute)) throw new Error('story_review_corpus_path_rejected');
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== descriptor.bytes) {
    throw new Error('story_review_corpus_file_invalid');
  }
  const bytes = fs.readFileSync(absolute);
  if (sha256(bytes) !== expectedSha) throw new Error('story_review_corpus_digest_mismatch');
  return bytes;
}

function materializeAutonomousStoryReviewCorpus({ selectionPath, outputDir }) {
  const authority = loadStoryArchitectAuthority();
  const absoluteSelection = path.resolve(selectionPath);
  const selection = validateSelection(
    readJson(absoluteSelection, 'story_review_corpus_selection_json_invalid'),
    authority,
  );
  const absoluteOutput = path.resolve(outputDir);
  if (!isInside(REVIEW_ROOT, absoluteOutput)) throw new Error('story_review_corpus_output_path_rejected');
  fs.mkdirSync(absoluteOutput, { recursive: true });
  if (fs.readdirSync(absoluteOutput).length > 0) throw new Error('story_review_corpus_output_not_empty');

  const outputRecords = [];
  for (const selected of selection.records) {
    const root = path.resolve(ROOT, selected.root);
    if (!isInside(OUTPUTS_ROOT, root)) throw new Error('story_review_corpus_source_path_rejected');
    const manifestPath = path.join(root, 'manifest.json');
    const manifestBytes = fs.readFileSync(manifestPath);
    if (sha256(manifestBytes) !== selection.manifestDigests[selected.root]) {
      throw new Error('story_review_corpus_manifest_digest_mismatch');
    }
    const manifest = readJson(manifestPath, 'story_review_corpus_manifest_json_invalid');
    const storyState = manifest.stories?.[selected.briefId];
    if (
      manifest.version !== selected.pipelineVersion ||
      manifest.repoHead !== selected.repoHead ||
      !['machine_qualified', 'completed_with_holds', 'in_progress'].includes(manifest.status) ||
      manifest.authorityStatus !== 'machine_qualified_staging_only' ||
      storyState?.status !== 'machine_qualified' ||
      storyState.inflight !== null ||
      !storyState.finalStory ||
      !Array.isArray(storyState.calls)
    ) {
      throw new Error('story_review_corpus_manifest_binding_invalid');
    }
    const record = findRecord(authority.commissionAuthority, selected.briefId);
    const storyDir = path.join(root, selected.briefId);
    const storyBytes = readContentAddressed(
      storyDir,
      storyState.finalStory,
      selected.storySha256,
      '.md',
    );
    const storyText = storyBytes.toString('utf8');
    validateEditorialPassDraft(record, { text: storyText, sha256: selected.storySha256 });
    const trailingWhitespaceMatches = storyText.match(/[ \t]+$/gmu) ?? [];
    const trackedStoryText = storyText.replace(/[ \t]+$/gmu, '');
    const trackedStoryBytes = Buffer.from(trackedStoryText, 'utf8');
    const trackedStorySha256 = sha256(trackedStoryBytes);
    validateEditorialPassDraft(record, {
      text: trackedStoryText,
      sha256: trackedStorySha256,
    });

    const editorCalls = storyState.calls.filter(({ stage }) => stage === 'editor');
    const lastEditor = editorCalls.at(-1);
    if (!lastEditor?.output) throw new Error('story_review_corpus_editor_pass_missing');
    const reviewBytes = readContentAddressed(
      storyDir,
      lastEditor.output,
      selected.reviewSha256,
      '.json',
    );
    const review = validateEditorialReviewResult(
      JSON.parse(reviewBytes.toString('utf8')),
      record.brief.pageCount,
    );
    if (
      review.verdict !== 'pass' ||
      review.issues.length !== 0 ||
      review.revisionPriorities.length !== 0
    ) {
      throw new Error('story_review_corpus_editor_pass_invalid');
    }

    const slot = `${record.companionId}_${record.brief.direction}`;
    const slotDir = path.join(absoluteOutput, slot);
    fs.mkdirSync(slotDir, { recursive: false });
    fs.writeFileSync(path.join(slotDir, 'story.md'), trackedStoryBytes, { flag: 'wx' });
    fs.writeFileSync(path.join(slotDir, 'editorial-review.json'), reviewBytes, { flag: 'wx' });
    const copied = {
      briefId: selected.briefId,
      slot,
      companionId: record.companionId,
      direction: record.brief.direction,
      category: record.brief.category,
      textPageCount: record.brief.pageCount,
      physicalPageCount: record.brief.pageCount * 2,
      storySha256: trackedStorySha256,
      reviewSha256: selected.reviewSha256,
      normalizationActions: trailingWhitespaceMatches.length > 0
        ? [{ code: 'trailing_horizontal_whitespace_removed', lineCount: trailingWhitespaceMatches.length }]
        : [],
      source: {
        root: selected.root,
        pipelineVersion: selected.pipelineVersion,
        repoHead: selected.repoHead,
        manifestSha256: selection.manifestDigests[selected.root],
        waveStatus: manifest.status,
        storySha256: selected.storySha256,
        logicalProviderCalls: manifest.logicalProviderCalls,
        actualCostUsd: manifest.actualCostUsd,
        transportRetries: manifest.transportRetries,
        fallbackUsed: manifest.fallbackUsed,
        selectedOptionId: storyState.selectedOptionId,
        revisionCount: storyState.revisionCount,
      },
    };
    fs.writeFileSync(
      path.join(slotDir, 'manifest.json'),
      `${JSON.stringify({ version: VERSION, status: 'pending_independent_artifact_audit', record: copied }, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx' },
    );
    outputRecords.push(copied);
  }

  outputRecords.sort((left, right) => left.slot.localeCompare(right.slot));
  const corpus = {
    version: VERSION,
    status: 'pending_independent_artifact_audit',
    authorityScope: 'story_text_candidates_only',
    selection: path.relative(ROOT, absoluteSelection).replace(/\\/g, '/'),
    acceptedExistingBriefId: ACCEPTED_DINI_BRIEF_ID,
    candidateCount: outputRecords.length,
    completeSlotCountAfterExistingAcceptance: outputRecords.length + 1,
    records: outputRecords,
    exclusions: [
      'product_acceptance',
      'story_bank_import',
      'wizard_runtime',
      'visual_contract',
      'render',
      'deployment',
    ],
  };
  fs.writeFileSync(
    path.join(absoluteOutput, 'manifest.json'),
    `${JSON.stringify(corpus, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  );
  return corpus;
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const corpus = materializeAutonomousStoryReviewCorpus({
      selectionPath: args.selection,
      outputDir: args['output-dir'],
    });
    process.stdout.write(`${JSON.stringify({ status: corpus.status, candidateCount: corpus.candidateCount, completeSlotCountAfterExistingAcceptance: corpus.completeSlotCountAfterExistingAcceptance })}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message.split(':')[0] : 'story_review_corpus_failure'}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  ACCEPTED_DINI_BRIEF_ID,
  SELECTION_VERSION,
  VERSION,
  materializeAutonomousStoryReviewCorpus,
  validateSelection,
};
