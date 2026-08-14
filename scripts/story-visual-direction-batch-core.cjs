// @ts-check

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { MODEL, SERVICE_TIER, calculateCostUsd } = require('./story-autonomous-batch-core.cjs');

const VERSION = 'small-heroes-story-visual-direction-batch/v2';
const RECORD_VERSION = 'small-heroes-story-visual-direction-record/v1';
const CONTRACT_REL = 'story-pipeline/03_story_briefs/STORY_PAGE_VISUAL_DIRECTION_CONTRACT.md';
const ACCEPTED_ROOT_REL = 'story-pipeline/04_approved_story_sources/accepted';
const PRESENCE = ['present', 'partial', 'absent'];
const SHOTS = ['extreme_wide', 'wide', 'medium_wide', 'medium', 'medium_close', 'close', 'detail'];
const ANGLES = ['eye_level', 'high_angle', 'low_angle', 'overhead', 'ground_level', 'three_quarter'];

const PAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'pageNumber', 'settingKey', 'setting', 'childPresence', 'companionPresence',
    'supportingCharacters', 'mainAction', 'heroObject', 'shotType', 'cameraAngle',
    'lighting', 'continuityAnchors',
  ],
  properties: {
    pageNumber: { type: 'integer' },
    settingKey: { type: 'string' },
    setting: { type: 'string' },
    childPresence: { type: 'string', enum: PRESENCE },
    companionPresence: { type: 'string', enum: PRESENCE },
    supportingCharacters: { type: 'array', items: { type: 'string' } },
    mainAction: { type: 'string' },
    heroObject: { type: ['string', 'null'] },
    shotType: { type: 'string', enum: SHOTS },
    cameraAngle: { type: 'string', enum: ANGLES },
    lighting: { type: 'string' },
    continuityAnchors: { type: 'array', items: { type: 'string' } },
  },
};

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['version', 'storyKey', 'pages'],
  properties: {
    version: { type: 'string', enum: [RECORD_VERSION] },
    storyKey: { type: 'string' },
    pages: { type: 'array', items: PAGE_SCHEMA },
  },
};

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

function parseStory(storyText) {
  const companionId = storyText.match(/^companionId:\s*(\S+)\s*$/m)?.[1] ?? '';
  const direction = storyText.match(/^direction:\s*(\S+)\s*$/m)?.[1] ?? '';
  const category = storyText.match(/^category:\s*(\S+)\s*$/m)?.[1] ?? '';
  const declaredPages = Number(storyText.match(/^pages:\s*(\d+)\s*$/m)?.[1] ?? 0);
  const pageMarkers = [...storyText.matchAll(/^--- Page (\d+) ---\s*$/gm)];
  const pages = pageMarkers.map((match, index) => {
    const next = pageMarkers[index + 1];
    const start = (match.index ?? 0) + match[0].length;
    const end = next?.index ?? storyText.length;
    return { pageNumber: Number(match[1]), prose: storyText.slice(start, end).trim() };
  });
  if (
    !companionId || !['bedtime', 'adventure', 'fantasy'].includes(direction) || !category ||
    ![8, 12, 16].includes(declaredPages) || pages.length !== declaredPages ||
    pages.some((page, index) => page.pageNumber !== index + 1 || !page.prose)
  ) {
    throw new Error('story_visual_direction_story_invalid');
  }
  return { companionId, direction, category, declaredPages, pages };
}

function cleanText(value, minimum = 3, maximum = 320) {
  return typeof value === 'string' && value.trim().length >= minimum &&
    value.length <= maximum && !value.includes('\0') && !/[\u0590-\u05ff]/u.test(value) &&
    !value.includes('{{') && !value.includes('}}') && !/[{}]/.test(value);
}

function cleanStringArray(value, maximumItems, maximumLength = 120) {
  return Array.isArray(value) && value.length <= maximumItems &&
    new Set(value).size === value.length &&
    value.every((entry) => cleanText(entry, 2, maximumLength));
}

function normalizeVisualDirectionRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.pages)) {
    return value;
  }
  const normalizeArray = (entries) => Array.isArray(entries)
    ? [...new Set(entries.map((entry) => typeof entry === 'string' ? entry.trim() : entry))]
    : entries;
  return {
    ...value,
    storyKey: typeof value.storyKey === 'string' ? value.storyKey.trim() : value.storyKey,
    pages: value.pages.map((page) => {
      if (!page || typeof page !== 'object' || Array.isArray(page)) return page;
      return {
        ...page,
        settingKey: typeof page.settingKey === 'string'
          ? page.settingKey.trim().toLowerCase().replace(/[\s-]+/g, '_')
          : page.settingKey,
        setting: typeof page.setting === 'string' ? page.setting.trim() : page.setting,
        supportingCharacters: normalizeArray(page.supportingCharacters),
        mainAction: typeof page.mainAction === 'string' ? page.mainAction.trim() : page.mainAction,
        heroObject: typeof page.heroObject === 'string' ? page.heroObject.trim() : page.heroObject,
        lighting: typeof page.lighting === 'string' ? page.lighting.trim() : page.lighting,
        continuityAnchors: normalizeArray(page.continuityAnchors),
      };
    }),
  };
}

function validateVisualDirectionRecord(value, storyKey, expectedPageCount) {
  const topKeys = ['version', 'storyKey', 'pages'];
  const pageKeys = [
    'pageNumber', 'settingKey', 'setting', 'childPresence', 'companionPresence',
    'supportingCharacters', 'mainAction', 'heroObject', 'shotType', 'cameraAngle',
    'lighting', 'continuityAnchors',
  ];
  if (
    !exactKeys(value, topKeys) || value.version !== RECORD_VERSION ||
    value.storyKey !== storyKey || !Array.isArray(value.pages) ||
    value.pages.length !== expectedPageCount
  ) {
    throw new Error('story_visual_direction_output_invalid');
  }
  for (const [index, page] of value.pages.entries()) {
    if (
      !exactKeys(page, pageKeys) || page.pageNumber !== index + 1 ||
      !/^[a-z][a-z0-9_]{2,63}$/.test(page.settingKey) ||
      !cleanText(page.setting, 3, 240) || !PRESENCE.includes(page.childPresence) ||
      !PRESENCE.includes(page.companionPresence) ||
      !cleanStringArray(page.supportingCharacters, 8) || !cleanText(page.mainAction, 3, 320) ||
      !(page.heroObject === null || cleanText(page.heroObject, 2, 160)) ||
      !SHOTS.includes(page.shotType) || !ANGLES.includes(page.cameraAngle) ||
      !cleanText(page.lighting, 3, 160) || !cleanStringArray(page.continuityAnchors, 8)
    ) {
      throw new Error('story_visual_direction_output_invalid');
    }
  }
  return value;
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
  const unaccountedReservationUsd = unaccountedSeedCalls === 1 && missing.length > 0
    ? reservationUsd(buildRequest(repoRoot, missing[0]).request)
    : 0;
  manifest.actualCostUsd = Number(seed.actualCostUsd.toFixed(9));
  manifest.conservativeCostUsd = Number((manifest.actualCostUsd + unaccountedReservationUsd).toFixed(9));
  manifest.logicalProviderCalls = seed.logicalProviderCalls + unaccountedSeedCalls;
  manifest.applicationRetries = unaccountedSeedCalls;
  manifest.seed = {
    manifestSha256: sha256(seedManifestBytes),
    importedRecords: Object.keys(seed.records).length,
    accountedProviderCalls: seed.logicalProviderCalls,
    unaccountedCompletedCalls: unaccountedSeedCalls,
    unaccountedCostReservationUsd: Number(unaccountedReservationUsd.toFixed(9)),
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
      manifest.status = 'completed_with_holds';
      manifest.failures.push({
        storyKey: accepted.storyKey,
        reasonCode,
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
