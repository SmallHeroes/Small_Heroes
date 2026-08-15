#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  RECORD_VERSION,
  VERSION: DIRECTION_BATCH_VERSION,
  loadAcceptedStories,
  normalizeVisualDirectionRecord,
  parseStory,
  validateVisualDirectionRecord,
} = require('./story-visual-direction-batch-core.cjs');

const IMPORT_VERSION = 'story-bank-import/v4';
const CORPUS_VERSION = 'small-heroes-storyboard-input-corpus/v1';
const STORYBOARD_ROOT_REL = 'story-pipeline/05_storyboard_inputs/autonomous-20260815-v1';
const BANK_ROOT_REL = 'story-bank/qa-autonomous-20260815-v1';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function canonicalBytes(value) {
  return `${JSON.stringify(canonical(value), null, 2)}\n`;
}

function readBoundFile(directory, reference) {
  if (
    !reference || typeof reference !== 'object' || Array.isArray(reference) ||
    path.basename(reference.filename || '') !== reference.filename ||
    !Number.isInteger(reference.bytes) || !/^[a-f0-9]{64}$/.test(reference.sha256 || '')
  ) {
    throw new Error('vnext_story_bank_direction_reference_invalid');
  }
  const absolute = path.join(directory, reference.filename);
  const bytes = fs.readFileSync(absolute);
  if (bytes.length !== reference.bytes || sha256(bytes) !== reference.sha256) {
    throw new Error('vnext_story_bank_direction_reference_drift');
  }
  return bytes;
}

function sentence(value) {
  const normalized = String(value).replace(/\s+/g, ' ').trim().replace(/[.]+$/u, '');
  return normalized ? `${normalized}.` : '';
}

function pageDirection(page) {
  const shot = page.shotType.replaceAll('_', ' ');
  const angle = page.cameraAngle.replaceAll('_', ' ');
  const parts = [
    sentence(`${shot} shot, ${angle} view, ${page.setting}`),
    sentence(page.mainAction),
    sentence(`Child ${page.childPresence}; companion ${page.companionPresence}`),
    page.supportingCharacters.length > 0
      ? sentence(`Supporting characters: ${page.supportingCharacters.join(', ')}`)
      : '',
    page.heroObject ? sentence(`Hero object: ${page.heroObject}`) : '',
    sentence(`Lighting: ${page.lighting}`),
    page.continuityAnchors.length > 0
      ? sentence(`Continuity: ${page.continuityAnchors.join('; ')}`)
      : '',
  ].filter(Boolean);
  const result = parts.join(' ');
  if (/\r|\n|[\u0590-\u05ff]|\{\{|\}\}/u.test(result) || result.length > 1600) {
    throw new Error('vnext_story_bank_image_direction_invalid');
  }
  return result;
}

function injectDirections(source, record) {
  if (/^imageDirection:/m.test(source)) throw new Error('vnext_story_bank_source_already_directed');
  let index = 0;
  const integrated = source.replace(/^--- Page (\d+) ---\s*$/gm, (marker, pageNumber) => {
    const page = record.pages[index];
    if (!page || page.pageNumber !== Number(pageNumber)) {
      throw new Error('vnext_story_bank_page_binding_invalid');
    }
    index += 1;
    return `${marker}\nimageDirection: ${pageDirection(page)}`;
  });
  if (index !== record.pages.length) throw new Error('vnext_story_bank_page_coverage_invalid');
  const projected = integrated.replace(/^imageDirection:.*\r?\n/gm, '');
  if (Buffer.from(projected, 'utf8').compare(Buffer.from(source, 'utf8')) !== 0) {
    throw new Error('vnext_story_bank_source_projection_drift');
  }
  return integrated;
}

function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== '--direction-root') {
    throw new Error('usage: --direction-root <directory>');
  }
  return path.resolve(argv[1]);
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const directionRoot = parseArgs(process.argv.slice(2));
  const directionManifestBytes = fs.readFileSync(path.join(directionRoot, 'manifest.json'));
  const directionManifest = JSON.parse(directionManifestBytes.toString('utf8'));
  if (
    directionManifest.version !== DIRECTION_BATCH_VERSION ||
    directionManifest.status !== 'machine_qualified' ||
    directionManifest.authorityStatus !== 'qa_storyboard_inputs_only' ||
    directionManifest.model !== 'gpt-5.6-sol' || directionManifest.serviceTier !== 'default' ||
    directionManifest.store !== false || directionManifest.logicalProviderCalls !== 20 ||
    directionManifest.transportRetries !== 0 || directionManifest.fallbackUsed !== false ||
    directionManifest.applicationRetries !== 2 ||
    !Number.isFinite(directionManifest.actualCostUsd) ||
    !Number.isFinite(directionManifest.conservativeCostUsd) ||
    directionManifest.conservativeCostUsd > directionManifest.maxCostUsd ||
    Object.keys(directionManifest.records || {}).length !== 18
  ) {
    throw new Error('vnext_story_bank_direction_manifest_invalid');
  }

  const accepted = loadAcceptedStories(repoRoot);
  const bankRoot = path.join(repoRoot, BANK_ROOT_REL);
  const storyboardRoot = path.join(repoRoot, STORYBOARD_ROOT_REL);
  fs.rmSync(bankRoot, { recursive: true, force: true });
  fs.mkdirSync(bankRoot, { recursive: true });
  fs.mkdirSync(storyboardRoot, { recursive: true });
  const records = [];
  for (const sourceRecord of accepted) {
    const storyKey = sourceRecord.storyKey;
    const directionEntry = directionManifest.records[storyKey];
    if (!directionEntry || directionEntry.status !== 'machine_qualified') {
      throw new Error('vnext_story_bank_direction_missing');
    }
    const sourceBytes = fs.readFileSync(sourceRecord.storyPath);
    const sourceSha256 = sha256(sourceBytes);
    const story = parseStory(sourceBytes.toString('utf8'));
    if (
      directionEntry.sourceStorySha256 !== sourceSha256 ||
      directionEntry.pageCount !== story.declaredPages
    ) {
      throw new Error('vnext_story_bank_source_binding_invalid');
    }
    const directionDir = path.join(directionRoot, storyKey);
    const directionBytes = readBoundFile(directionDir, directionEntry.output);
    const receiptBytes = readBoundFile(directionDir, directionEntry.receipt);
    const directionRecord = validateVisualDirectionRecord(
      normalizeVisualDirectionRecord(JSON.parse(directionBytes.toString('utf8'))),
      storyKey,
      story.declaredPages,
    );
    if (directionRecord.version !== RECORD_VERSION) {
      throw new Error('vnext_story_bank_direction_version_invalid');
    }
    const receipt = JSON.parse(receiptBytes.toString('utf8'));
    if (
      receipt.storyKey !== storyKey || receipt.sourceStorySha256 !== sourceSha256 ||
      receipt.output?.sha256 !== directionEntry.output.sha256 ||
      receipt.transportRetries !== 0 || receipt.fallbackUsed !== false || receipt.store !== false
    ) {
      throw new Error('vnext_story_bank_receipt_binding_invalid');
    }

    const storyboardPath = path.join(storyboardRoot, `${storyKey}.visual-directions.json`);
    const receiptPath = path.join(storyboardRoot, `${storyKey}.receipt.json`);
    fs.writeFileSync(storyboardPath, directionBytes);
    fs.writeFileSync(receiptPath, receiptBytes);

    const integrated = injectDirections(sourceBytes.toString('utf8'), directionRecord);
    const integratedBytes = Buffer.from(integrated, 'utf8');
    const bankStoryPath = path.join(bankRoot, `${storyKey}.md`);
    const sidecarPath = path.join(bankRoot, `${storyKey}.import.json`);
    const sidecar = {
      version: IMPORT_VERSION,
      status: 'qa_ready_for_low_story_generation',
      authorityScope: 'qa_only',
      productionEligible: false,
      storyKey,
      companionId: story.companionId,
      direction: story.direction,
      category: story.category,
      pageCount: story.declaredPages,
      physicalPageCount: story.declaredPages * 2,
      approvedBy: 'Guy',
      approvedAt: '2026-08-15T00:00:00+03:00',
      source: {
        acceptedManifestPath: path.relative(repoRoot, sourceRecord.manifestPath).replaceAll('\\', '/'),
        storySha256: sourceSha256,
      },
      visualDirections: {
        version: RECORD_VERSION,
        path: path.relative(repoRoot, storyboardPath).replaceAll('\\', '/'),
        sha256: directionEntry.output.sha256,
        receiptPath: path.relative(repoRoot, receiptPath).replaceAll('\\', '/'),
        receiptSha256: directionEntry.receipt.sha256,
      },
      integratedStory: {
        path: path.relative(repoRoot, bankStoryPath).replaceAll('\\', '/'),
        sha256: sha256(integratedBytes),
        sourceProjectionSha256: sourceSha256,
      },
      providerAccounting: {
        model: directionManifest.model,
        serviceTier: directionManifest.serviceTier,
        store: false,
        transportRetries: 0,
        fallbackUsed: false,
      },
      servedOnlyWhen: 'non-production and ENABLE_WIZARD_QA_RENDER_CATALOG=true',
    };
    fs.writeFileSync(bankStoryPath, integratedBytes);
    fs.writeFileSync(sidecarPath, canonicalBytes(sidecar), 'utf8');
    records.push({
      storyKey,
      companionId: story.companionId,
      direction: story.direction,
      category: story.category,
      pageCount: story.declaredPages,
      sourceStorySha256: sourceSha256,
      visualDirectionSha256: directionEntry.output.sha256,
      integratedStorySha256: sidecar.integratedStory.sha256,
      importSidecarSha256: sha256(canonicalBytes(sidecar)),
    });
  }

  const corpusPayload = {
    version: CORPUS_VERSION,
    status: 'qa_ready_for_low_story_generation',
    authorityScope: 'qa_only',
    productionEligible: false,
    directionBatch: {
      version: directionManifest.version,
      manifestSha256: sha256(directionManifestBytes),
      model: directionManifest.model,
      serviceTier: directionManifest.serviceTier,
      logicalProviderCalls: directionManifest.logicalProviderCalls,
      applicationRetries: directionManifest.applicationRetries,
      transportRetries: directionManifest.transportRetries,
      fallbackUsed: directionManifest.fallbackUsed,
      actualCostUsd: directionManifest.actualCostUsd,
      conservativeCostUsd: directionManifest.conservativeCostUsd,
    },
    storyCount: 18,
    companionCount: 6,
    directionCount: 3,
    productionStoryBankTouched: false,
    records: records.sort((left, right) => left.storyKey.localeCompare(right.storyKey)),
  };
  const corpus = { ...corpusPayload, digest: sha256(canonicalBytes(corpusPayload)) };
  fs.writeFileSync(path.join(storyboardRoot, 'manifest.json'), canonicalBytes(corpus), 'utf8');
  process.stdout.write(`${JSON.stringify({
    version: corpus.version,
    status: corpus.status,
    storyCount: corpus.storyCount,
    productionStoryBankTouched: corpus.productionStoryBankTouched,
    digest: corpus.digest,
  }, null, 2)}\n`);
}

if (require.main === module) {
  try { main(); } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message.split(':')[0] : 'vnext_story_bank_unknown_failure'}\n`);
    process.exitCode = 1;
  }
}

module.exports = { injectDirections, pageDirection };
