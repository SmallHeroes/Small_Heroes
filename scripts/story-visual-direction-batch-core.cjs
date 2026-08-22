// @ts-check

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { MODEL, SERVICE_TIER, calculateCostUsd } = require('./story-autonomous-batch-core.cjs');
const {
  ANGLES,
  PAGE_SCHEMA,
  PRESENCE,
  RECORD_VERSION,
  RESPONSE_SCHEMA,
  SHOTS,
  normalizeVisualDirectionRecord,
  parseStory,
  validateVisualDirectionRecord,
} = require('./story-visual-direction-contract.cjs');

const VERSION = 'small-heroes-story-visual-direction-batch/v2';
const CONTRACT_REL = 'story-pipeline/03_story_briefs/STORY_PAGE_VISUAL_DIRECTION_CONTRACT.md';
const ACCEPTED_ROOT_REL = 'story-pipeline/04_approved_story_sources/accepted';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

function readHead(repoRoot) {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function buildRequest(repoRoot, acceptedRecord) {
  const contract = fs.readFileSync(path.join(repoRoot, CONTRACT_REL), 'utf8');
  const storyText = fs.readFileSync(acceptedRecord.storyPath, 'utf8');
  const story = parseStory(storyText);
  return {
    story,
    request: {
      stage: 'page_visual_directions',
      reasoningEffort: 'medium',
      maxOutputTokens: story.declaredPages === 16 ? 6500 : story.declaredPages === 12 ? 5000 : 3800,
      schemaName: 'small_heroes_story_visual_directions',
      schema: RESPONSE_SCHEMA,
      systemPrompt: contract,
      userPrompt: JSON.stringify({
        storyKey: acceptedRecord.storyKey,
        companionId: story.companionId,
        direction: story.direction,
        category: story.category,
        pageCount: story.declaredPages,
        immutableStorySource: storyText,
      }),
    },
  };
}

function loadAcceptedStories(repoRoot) {
  const acceptedRoot = path.join(repoRoot, ACCEPTED_ROOT_REL);
  const records = fs.readdirSync(acceptedRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const directory = path.join(acceptedRoot, entry.name);
      const storyPath = path.join(directory, 'story.md');
      const manifestPath = path.join(directory, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (
        manifest.version !== 'small-heroes-product-accepted-story-source-manifest/v1' ||
        manifest.status !== 'product_accepted_story_source' ||
        manifest.authorityScope !== 'story_text_only' ||
        manifest.record?.story?.sha256 !== sha256(fs.readFileSync(storyPath))
      ) {
        throw new Error('story_visual_direction_accepted_source_invalid');
      }
      return { storyKey: entry.name, storyPath, manifestPath, manifest };
    })
    .sort((left, right) => left.storyKey.localeCompare(right.storyKey));
  if (records.length !== 18 || new Set(records.map(({ storyKey }) => storyKey)).size !== 18) {
    throw new Error('story_visual_direction_accepted_source_coverage_invalid');
  }
  return records;
}

function reservationUsd(request) {
  const inputBytes = Buffer.byteLength(`${request.systemPrompt}\n${request.userPrompt}`, 'utf8');
  return (inputBytes * 6.25 + request.maxOutputTokens * 30) / 1_000_000;
}

function canonicalWrite(directory, prefix, extension, value) {
  fs.mkdirSync(directory, { recursive: true });
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  const digest = sha256(bytes);
  const filename = `${prefix}.${digest}.${extension}`;
  const absolute = path.join(directory, filename);
  if (!fs.existsSync(absolute)) fs.writeFileSync(absolute, bytes, { flag: 'wx' });
  else if (!fs.readFileSync(absolute).equals(bytes)) throw new Error('story_visual_direction_digest_collision');
  return { filename, bytes: bytes.length, sha256: digest };
}

function atomicJsonWrite(absolutePath, value) {
  const temporary = `${absolutePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  fs.renameSync(temporary, absolutePath);
}

function readCanonicalBytes(directory, reference) {
  if (
    !exactKeys(reference, ['filename', 'bytes', 'sha256']) ||
    typeof reference.filename !== 'string' || !Number.isInteger(reference.bytes) ||
    !/^[a-f0-9]{64}$/.test(reference.sha256) || path.basename(reference.filename) !== reference.filename
  ) {
    throw new Error('story_visual_direction_seed_reference_invalid');
  }
  const bytes = fs.readFileSync(path.join(directory, reference.filename));
  if (bytes.length !== reference.bytes || sha256(bytes) !== reference.sha256) {
    throw new Error('story_visual_direction_seed_reference_drift');
  }
  return bytes;
}

function importSeedRecords({ repoRoot, seedRoot, records, contractSha256, outputRoot, manifest, unaccountedSeedCalls }) {
  if (!seedRoot) {
    if (unaccountedSeedCalls !== 0) throw new Error('story_visual_direction_seed_accounting_invalid');
    return;
  }
  const absoluteSeedRoot = path.resolve(seedRoot);
  if (absoluteSeedRoot === outputRoot) throw new Error('story_visual_direction_seed_root_rejected');
  const seedManifestBytes = fs.readFileSync(path.join(absoluteSeedRoot, 'manifest.json'));
  const seed = JSON.parse(seedManifestBytes.toString('utf8'));
  if (
    !['small-heroes-story-visual-direction-batch/v1', VERSION].includes(seed.version) ||
    seed.model !== MODEL || seed.serviceTier !== SERVICE_TIER || seed.store !== false ||
    seed.contract?.sha256 !== contractSha256 || !seed.records ||
    !Number.isInteger(unaccountedSeedCalls) || ![0, 1].includes(unaccountedSeedCalls) ||
    !Number.isInteger(seed.logicalProviderCalls) || seed.logicalProviderCalls < Object.keys(seed.records).length ||
    !Number.isFinite(seed.actualCostUsd) || seed.actualCostUsd < 0
  ) {
    throw new Error('story_visual_direction_seed_manifest_invalid');
  }
  const acceptedByKey = new Map(records.map((record) => [record.storyKey, record]));
  for (const [storyKey, seeded] of Object.entries(seed.records)) {
    const accepted = acceptedByKey.get(storyKey);
    if (!accepted || seeded?.status !== 'machine_qualified') {
      throw new Error('story_visual_direction_seed_record_invalid');
    }
    const sourceStorySha256 = sha256(fs.readFileSync(accepted.storyPath));
    const story = parseStory(fs.readFileSync(accepted.storyPath, 'utf8'));
    const seedRecordDir = path.join(absoluteSeedRoot, storyKey);
    const outputBytes = readCanonicalBytes(seedRecordDir, seeded.output);
    const receiptBytes = readCanonicalBytes(seedRecordDir, seeded.receipt);
    const outputValue = validateVisualDirectionRecord(
      normalizeVisualDirectionRecord(JSON.parse(outputBytes.toString('utf8'))),
      storyKey,
      story.declaredPages,
    );
    const receiptValue = JSON.parse(receiptBytes.toString('utf8'));
    if (
      receiptValue.version !== 'small-heroes-story-visual-direction-call-receipt/v1' ||
      receiptValue.storyKey !== storyKey || receiptValue.sourceStorySha256 !== sourceStorySha256 ||
      receiptValue.output?.sha256 !== seeded.output.sha256 || seeded.sourceStorySha256 !== sourceStorySha256
    ) {
      throw new Error('story_visual_direction_seed_receipt_invalid');
    }
    const targetDir = path.join(outputRoot, storyKey);
    const output = canonicalWrite(targetDir, 'visual-directions', 'json', `${JSON.stringify(outputValue, null, 2)}\n`);
    const receipt = canonicalWrite(targetDir, 'receipt', 'json', receiptBytes);
    manifest.records[storyKey] = { ...seeded, output, receipt, seeded: true };
  }
  const missing = records.filter(({ storyKey }) => !manifest.records[storyKey]);
  const continuingHeldSeed = seed.status === 'completed_with_holds' &&
    Array.isArray(seed.failures) && seed.failures.length === 1 &&
    seed.failures[0]?.storyKey === missing[0]?.storyKey ? 1 : 0;
  const unaccountedReservationUsd = unaccountedSeedCalls === 1 && missing.length > 0
    ? reservationUsd(buildRequest(repoRoot, missing[0]).request)
    : 0;
  manifest.actualCostUsd = Number(seed.actualCostUsd.toFixed(9));
  const inheritedConservativeCostUsd = Number.isFinite(seed.conservativeCostUsd) &&
    seed.conservativeCostUsd >= seed.actualCostUsd
    ? seed.conservativeCostUsd
    : seed.actualCostUsd;
  manifest.conservativeCostUsd = Number((inheritedConservativeCostUsd + unaccountedReservationUsd).toFixed(9));
  manifest.logicalProviderCalls = seed.logicalProviderCalls + unaccountedSeedCalls;
  manifest.applicationRetries = Number(seed.applicationRetries || 0) +
    unaccountedSeedCalls + continuingHeldSeed;
  if (manifest.applicationRetries > 2) throw new Error('story_visual_direction_retry_budget_exceeded');
  manifest.seed = {
    manifestSha256: sha256(seedManifestBytes),
    importedRecords: Object.keys(seed.records).length,
    accountedProviderCalls: seed.logicalProviderCalls,
    unaccountedCompletedCalls: unaccountedSeedCalls,
    unaccountedCostReservationUsd: Number(unaccountedReservationUsd.toFixed(9)),
    continuedHeldStory: continuingHeldSeed === 1,
  };
}

async function runVisualDirectionWave({
  repoRoot,
  outputRoot,
  provider,
  maxCostUsd,
  seedRoot = null,
  unaccountedSeedCalls = 0,
}) {
  if (!provider || typeof provider.complete !== 'function') throw new Error('story_visual_direction_provider_missing');
  if (!Number.isFinite(maxCostUsd) || maxCostUsd <= 0 || maxCostUsd > 5) {
    throw new Error('story_visual_direction_cost_cap_invalid');
  }
  const outputsRoot = path.join(repoRoot, 'outputs');
  const absoluteOutputRoot = path.resolve(outputRoot);
  if (!absoluteOutputRoot.startsWith(`${outputsRoot}${path.sep}`)) {
    throw new Error('story_visual_direction_output_root_rejected');
  }
  fs.mkdirSync(absoluteOutputRoot, { recursive: true });
  const manifestPath = path.join(absoluteOutputRoot, 'manifest.json');
  if (fs.existsSync(manifestPath)) throw new Error('story_visual_direction_output_root_not_fresh');
  const records = loadAcceptedStories(repoRoot);
  const contractBytes = fs.readFileSync(path.join(repoRoot, CONTRACT_REL));
  const manifest = {
    version: VERSION,
    status: 'in_progress',
    authorityStatus: 'qa_storyboard_inputs_only',
    model: MODEL,
    serviceTier: SERVICE_TIER,
    store: false,
    repoHead: readHead(repoRoot),
    contract: { path: CONTRACT_REL, sha256: sha256(contractBytes) },
    maxCostUsd,
    actualCostUsd: 0,
    conservativeCostUsd: 0,
    logicalProviderCalls: 0,
    newProviderCalls: 0,
    applicationRetries: 0,
    transportRetries: 0,
    fallbackUsed: false,
    credentialAccess: 'supervisor_child_only',
    failures: [],
    records: {},
  };
  importSeedRecords({
    repoRoot,
    seedRoot,
    records,
    contractSha256: manifest.contract.sha256,
    outputRoot: absoluteOutputRoot,
    manifest,
    unaccountedSeedCalls,
  });
  if (manifest.conservativeCostUsd > maxCostUsd) {
    throw new Error('story_visual_direction_seed_cost_exceeded');
  }
  atomicJsonWrite(manifestPath, manifest);

  for (const accepted of records) {
    if (manifest.records[accepted.storyKey]) continue;
    const { story, request } = buildRequest(repoRoot, accepted);
    if (manifest.conservativeCostUsd + reservationUsd(request) > maxCostUsd) {
      throw new Error('story_visual_direction_cost_reservation_exceeded');
    }
    const result = await provider.complete(request);
    if (
      !result?.completed || result.model !== MODEL || result.serviceTier !== SERVICE_TIER ||
      typeof result.text !== 'string' || !result.text.trim() ||
      !exactKeys(result.usage, ['inputTokens', 'cachedInputTokens', 'cacheWriteTokens', 'outputTokens', 'reasoningTokens', 'totalTokens'])
    ) {
      throw new Error('story_visual_direction_provider_result_invalid');
    }
    const costUsd = calculateCostUsd(result.usage, result.serviceTier);
    manifest.actualCostUsd = Number((manifest.actualCostUsd + costUsd).toFixed(9));
    manifest.conservativeCostUsd = Number((manifest.conservativeCostUsd + costUsd).toFixed(9));
    manifest.logicalProviderCalls += 1;
    manifest.newProviderCalls += 1;
    if (manifest.conservativeCostUsd > maxCostUsd) throw new Error('story_visual_direction_actual_cost_exceeded');
    let record;
    try {
      record = validateVisualDirectionRecord(
        normalizeVisualDirectionRecord(JSON.parse(result.text)),
        accepted.storyKey,
        story.declaredPages,
      );
    } catch (error) {
      const reasonCode = error instanceof SyntaxError
        ? 'story_visual_direction_provider_json_invalid'
        : 'story_visual_direction_output_invalid';
      const diagnosticCode = error instanceof Error && error.message.startsWith(`${reasonCode}:`)
        ? error.message.slice(reasonCode.length + 1)
        : null;
      manifest.status = 'completed_with_holds';
      manifest.failures.push({
        storyKey: accepted.storyKey,
        reasonCode,
        diagnosticCode,
        usage: result.usage,
        costUsd,
        rawOutputPersisted: false,
      });
      atomicJsonWrite(manifestPath, manifest);
      throw new Error(reasonCode);
    }
    const recordDir = path.join(absoluteOutputRoot, accepted.storyKey);
    const output = canonicalWrite(recordDir, 'visual-directions', 'json', `${JSON.stringify(record, null, 2)}\n`);
    const receiptPayload = {
      version: 'small-heroes-story-visual-direction-call-receipt/v1',
      storyKey: accepted.storyKey,
      modelRequested: MODEL,
      modelReturned: result.model,
      serviceTierRequested: SERVICE_TIER,
      serviceTierReturned: result.serviceTier,
      store: false,
      reasoningEffort: request.reasoningEffort,
      maxOutputTokens: request.maxOutputTokens,
      promptSha256: sha256(`${request.systemPrompt}\n${request.userPrompt}`),
      sourceStorySha256: sha256(fs.readFileSync(accepted.storyPath)),
      output,
      usage: result.usage,
      costUsd,
      transportRetries: 0,
      fallbackUsed: false,
      rawPromptPersisted: false,
      rawProviderEnvelopePersisted: false,
    };
    const receipt = canonicalWrite(recordDir, 'receipt', 'json', `${JSON.stringify(receiptPayload, null, 2)}\n`);
    manifest.records[accepted.storyKey] = {
      status: 'machine_qualified',
      sourceStorySha256: receiptPayload.sourceStorySha256,
      pageCount: story.declaredPages,
      output,
      receipt,
      costUsd,
    };
    atomicJsonWrite(manifestPath, manifest);
  }
  manifest.status = 'machine_qualified';
  atomicJsonWrite(manifestPath, manifest);
  return manifest;
}

module.exports = {
  ANGLES,
  CONTRACT_REL,
  PAGE_SCHEMA,
  PRESENCE,
  RECORD_VERSION,
  RESPONSE_SCHEMA,
  SHOTS,
  VERSION,
  buildRequest,
  loadAcceptedStories,
  normalizeVisualDirectionRecord,
  parseStory,
  reservationUsd,
  runVisualDirectionWave,
  validateVisualDirectionRecord,
};
