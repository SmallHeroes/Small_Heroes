// @ts-check

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const {
  findCompanionCreativePsychology,
  findRecord,
  findStoryArchitectCommission,
  loadStoryArchitectAuthority,
  sha256,
  validateEditorialPassDraft,
  validateEditorialReviewResult,
} = require('./materialize-story-commission-briefs.cjs');

/** @typedef {import('../lib/story-pipeline/autonomous-story-batch-state').StoryCall} StoryCall */
/** @typedef {import('../lib/story-pipeline/autonomous-story-batch-state').StoryState} StoryState */
/** @typedef {import('../lib/story-pipeline/autonomous-story-batch-state').AutonomousStoryBatchManifest} AutonomousStoryBatchManifest */

const MODEL = 'gpt-5.6-sol';
const SERVICE_TIER = 'default';
const PIPELINE_VERSION = 'small-heroes-autonomous-story-batch/v1';
const EDITOR_MAX_OUTPUT_TOKENS = 6000;
const ACCEPTED_DINI_BRIEF_ID = 'dragon_dini_adventure_wobble_cake_convoy_brief_v1';
const SELECTOR_VERSION = 'small-heroes-autonomous-premise-selection/v1';
const ARCHITECT_VERSION = 'small-heroes-autonomous-architect-options/v1';
const DISQUALIFIERS = [
  'generic_ai_premise',
  'child_not_causal',
  'companion_replaceable',
  'repetitive_visual_journey',
  'weak_payoff',
  'unsafe_or_incoherent',
  'seed_paraphrase',
  'mini_screenplay',
];
const SCORE_KEYS = [
  'childDelight',
  'rereadDesire',
  'humorOrWonder',
  'childAgency',
  'companionSpecificity',
  'visualJourney',
  'causalityPayoff',
  'hebrewPotential',
];
const OPTION_KEYS = [
  'optionId',
  'title',
  'hook',
  'comicOrWonderEngine',
  'journeyShape',
  'childAgencyArc',
  'climaxPrinciple',
  'payoffFlavor',
  'whyThisCompanion',
  'surprise',
];
const ROOT = path.resolve(__dirname, '..');
const CONTRACTS = {
  architect: 'story-pipeline/03_story_briefs/STORY_ARCHITECT_CHARTER_V4.md',
  selector: 'story-pipeline/03_story_briefs/STORY_AUTONOMOUS_SELECTOR_CONTRACT.md',
  writer: 'story-pipeline/03_story_briefs/STORY_AUTONOMOUS_WRITER_CONTRACT.md',
  editor: 'story-pipeline/03_story_briefs/STORY_DRAFT_EDITORIAL_QA_CONTRACT_V3.md',
};

const ARCHITECT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['version', 'briefId', 'options'],
  properties: {
    version: { type: 'string', enum: [ARCHITECT_VERSION] },
    briefId: { type: 'string' },
    options: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: OPTION_KEYS,
        properties: {
          optionId: { type: 'string', enum: ['A', 'B', 'C'] },
          title: { type: 'string' },
          hook: { type: 'string' },
          comicOrWonderEngine: { type: 'string' },
          journeyShape: { type: 'string' },
          childAgencyArc: { type: 'string' },
          climaxPrinciple: { type: 'string' },
          payoffFlavor: { type: 'string' },
          whyThisCompanion: { type: 'string' },
          surprise: { type: 'string' },
        },
      },
    },
  },
};

const SELECTOR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['version', 'briefId', 'evaluations', 'recommendedOptionId', 'selectionReason'],
  properties: {
    version: { type: 'string', enum: [SELECTOR_VERSION] },
    briefId: { type: 'string' },
    evaluations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['optionId', ...SCORE_KEYS, 'disqualifiers', 'notes'],
        properties: {
          optionId: { type: 'string', enum: ['A', 'B', 'C'] },
          ...Object.fromEntries(SCORE_KEYS.map((key) => [key, { type: 'integer' }])),
          disqualifiers: {
            type: 'array',
            items: { type: 'string', enum: DISQUALIFIERS },
          },
          notes: { type: 'string' },
        },
      },
    },
    recommendedOptionId: { type: 'string', enum: ['A', 'B', 'C'] },
    selectionReason: { type: 'string' },
  },
};

const EDITORIAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['version', 'verdict', 'strengths', 'issues', 'revisionPriorities', 'mustPreserve'],
  properties: {
    version: { type: 'string', enum: ['small-heroes-story-editorial-review/v1'] },
    verdict: { type: 'string', enum: ['pass', 'revise', 'reject'] },
    strengths: { type: 'array', items: { type: 'string' } },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'severity', 'evidencePages', 'functionalGap'],
        properties: {
          code: {
            type: 'string',
            enum: [
              'hook_not_immediate',
              'comic_peak_insufficient',
              'child_pre_climax_agency_weak',
              'dramatic_function_repeated',
              'causality_gap',
              'payoff_weak',
              'companion_generic',
              'companion_obstructive',
              'hebrew_readaloud_issue',
              'personalization_syntax_invalid',
              'output_structure_invalid',
              'category_energy_mismatch',
              'visual_journey_repetitive',
            ],
          },
          severity: { type: 'string', enum: ['major', 'minor'] },
          evidencePages: { type: 'array', items: { type: 'integer' } },
          functionalGap: { type: 'string' },
        },
      },
    },
    revisionPriorities: { type: 'array', items: { type: 'string' } },
    mustPreserve: { type: 'array', items: { type: 'string' } },
  },
};

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length >= 2 && !value.includes('\0');
}

function validateArchitectOptions(value, briefId) {
  if (!exactKeys(value, ['version', 'briefId', 'options']) ||
      value.version !== ARCHITECT_VERSION || value.briefId !== briefId ||
      !Array.isArray(value.options) || value.options.length !== 3) {
    throw new Error('story_batch_architect_output_invalid');
  }
  const ids = [];
  for (const option of value.options) {
    if (!exactKeys(option, OPTION_KEYS) || !['A', 'B', 'C'].includes(option.optionId) ||
        OPTION_KEYS.filter((key) => key !== 'optionId').some((key) => !nonEmpty(option[key]))) {
      throw new Error('story_batch_architect_output_invalid');
    }
    ids.push(option.optionId);
  }
  if (ids.join(',') !== 'A,B,C') throw new Error('story_batch_architect_output_invalid');
  return value;
}

function validateSelection(value, briefId) {
  const topKeys = ['version', 'briefId', 'evaluations', 'recommendedOptionId', 'selectionReason'];
  const evaluationKeys = ['optionId', ...SCORE_KEYS, 'disqualifiers', 'notes'];
  if (!exactKeys(value, topKeys) || value.version !== SELECTOR_VERSION ||
      value.briefId !== briefId || !Array.isArray(value.evaluations) ||
      value.evaluations.length !== 3 || !['A', 'B', 'C'].includes(value.recommendedOptionId) ||
      !nonEmpty(value.selectionReason)) {
    throw new Error('story_batch_selector_output_invalid');
  }
  const ids = [];
  for (const evaluation of value.evaluations) {
    if (!exactKeys(evaluation, evaluationKeys) || !['A', 'B', 'C'].includes(evaluation.optionId) ||
        SCORE_KEYS.some((key) => !Number.isInteger(evaluation[key]) || evaluation[key] < 0 || evaluation[key] > 10) ||
        !Array.isArray(evaluation.disqualifiers) ||
        evaluation.disqualifiers.some((entry) => !DISQUALIFIERS.includes(entry)) ||
        new Set(evaluation.disqualifiers).size !== evaluation.disqualifiers.length || !nonEmpty(evaluation.notes)) {
      throw new Error('story_batch_selector_output_invalid');
    }
    ids.push(evaluation.optionId);
  }
  if (ids.join(',') !== 'A,B,C') throw new Error('story_batch_selector_output_invalid');
  return value;
}

function chooseQualifiedOption(architect, selection) {
  validateArchitectOptions(architect, selection.briefId);
  validateSelection(selection, architect.briefId);
  const scored = selection.evaluations.map((evaluation) => ({
    optionId: evaluation.optionId,
    total: SCORE_KEYS.reduce((sum, key) => sum + evaluation[key], 0),
    disqualified: evaluation.disqualifiers.length > 0,
  }));
  const qualifying = scored.filter(({ total, disqualified }) => !disqualified && total >= 60);
  qualifying.sort((left, right) => right.total - left.total || left.optionId.localeCompare(right.optionId));
  if (qualifying.length === 0 || qualifying.length > 1 && qualifying[0].total === qualifying[1].total) {
    return { status: 'reroll_required', scores: scored };
  }
  if (selection.recommendedOptionId !== qualifying[0].optionId) {
    throw new Error('story_batch_selector_recommendation_mismatch');
  }
  const selectedOption = architect.options.find(({ optionId }) => optionId === qualifying[0].optionId);
  if (!selectedOption) throw new Error('story_batch_selected_option_missing');
  return { status: 'selected', selectedOption, scores: scored };
}

function readContract(repoRoot, relativePath) {
  const absolute = path.resolve(repoRoot, relativePath);
  if (!absolute.startsWith(`${path.resolve(repoRoot)}${path.sep}`)) throw new Error('story_batch_contract_path_rejected');
  return fs.readFileSync(absolute, 'utf8').trim();
}

function visualRequirement(direction) {
  if (direction === 'bedtime') return 'At least two materially different situations or places; the visual journey settles rather than stalls.';
  if (direction === 'adventure') return 'At least three materially different environments or situation changes, including a memorable visual-comedy escalation.';
  if (direction === 'fantasy') return 'At least four materially different environments, transformations or visual states that justify a 16-page wonder journey.';
  throw new Error(`story_batch_direction_invalid:${direction}`);
}

function storyIdentity(record) {
  return {
    briefId: record.brief.id,
    companionId: record.companionId,
    direction: record.brief.direction,
    category: record.brief.category,
    textPageCount: record.brief.pageCount,
    physicalPageCount: record.brief.pageCount * 2,
    requiredFrontmatter: {
      companionId: record.companionId,
      direction: record.brief.direction,
      category: record.brief.category,
      pages: record.brief.pageCount,
      gender: 'female',
      endingType: 'resolution',
    },
  };
}

function requiredStoryEnvelope(record) {
  return [
    '---',
    'title: "{{childName}} ו־<כותרת עברית טבעית>"',
    `companionId: ${record.companionId}`,
    `direction: ${record.brief.direction}`,
    `category: ${record.brief.category}`,
    `pages: ${record.brief.pageCount}`,
    'gender: female',
    'endingType: resolution',
    '---',
    '',
    '--- Page 1 ---',
    '',
    '<prose>',
    '',
    `...continue sequentially through exactly --- Page ${record.brief.pageCount} ---`,
  ].join('\n');
}

function buildPrompts(repoRoot, authority, record, selectedOption, draft, review) {
  const commission = findStoryArchitectCommission(authority, record.brief.id);
  const psychology = findCompanionCreativePsychology(authority, record.companionId);
  const identity = storyIdentity(record);
  const creativeInput = {
    identity,
    companionPsychology: psychology,
    creativeNucleus: {
      premiseSeed: commission.premiseSeed,
      visualJourneyRequirement: visualRequirement(record.brief.direction),
    },
  };
  if (!selectedOption) {
    return {
      stage: 'architect',
      reasoningEffort: 'high',
      maxOutputTokens: 8000,
      schemaName: 'small_heroes_architect_options',
      schema: ARCHITECT_SCHEMA,
      systemPrompt: readContract(repoRoot, CONTRACTS.architect),
      userPrompt: JSON.stringify(creativeInput),
    };
  }
  if (!draft) {
    return {
      stage: 'writer',
      reasoningEffort: 'low',
      maxOutputTokens: record.brief.pageCount === 8 ? 4500 : record.brief.pageCount === 12 ? 6500 : 9000,
      systemPrompt: readContract(repoRoot, CONTRACTS.writer),
      userPrompt: JSON.stringify({
        identity,
        selectedPremise: selectedOption,
        companionPsychology: psychology,
        requiredOutputEnvelope: requiredStoryEnvelope(record),
        personalizationRule: 'Every gender chip contains two complete Hebrew forms inside the braces. Never attach a shared Hebrew prefix or suffix outside a chip.',
      }),
    };
  }
  if (!review) {
    return {
      stage: 'editor',
      reasoningEffort: 'high',
      maxOutputTokens: EDITOR_MAX_OUTPUT_TOKENS,
      schemaName: 'small_heroes_editorial_review',
      schema: EDITORIAL_SCHEMA,
      systemPrompt: `${readContract(repoRoot, CONTRACTS.editor)}\n\nClosed response rules: strengths contains 1–4 items; pass has zero issues and zero revisionPriorities; revise/reject has 1–16 issues and 1–4 revisionPriorities; mustPreserve contains 1–8 items. Return only the exact JSON object.`,
      userPrompt: JSON.stringify({ identity, companionPsychology: psychology, draft }),
    };
  }
  return {
    stage: 'revision',
    reasoningEffort: 'medium',
    maxOutputTokens: record.brief.pageCount === 8 ? 4500 : record.brief.pageCount === 12 ? 6500 : 9000,
    systemPrompt: readContract(repoRoot, CONTRACTS.writer),
    userPrompt: JSON.stringify({
      identity,
      selectedPremise: selectedOption,
      companionPsychology: psychology,
      diagnosedRevisionAuthority: {
        strengths: review.strengths,
        issues: review.issues,
        revisionPriorities: review.revisionPriorities,
        mustPreserve: review.mustPreserve,
      },
      originalDraft: draft,
      requiredOutputEnvelope: requiredStoryEnvelope(record),
      personalizationRule: 'Every gender chip contains two complete Hebrew forms inside the braces. Never attach a shared Hebrew prefix or suffix outside a chip.',
      instruction: 'Return the complete revised story only. Address only diagnosed gaps and preserve the listed strengths.',
    }),
  };
}

function buildSelectorPrompt(repoRoot, record, options) {
  return {
    stage: 'selector',
    reasoningEffort: 'high',
    maxOutputTokens: 2500,
    schemaName: 'small_heroes_premise_selection',
    schema: SELECTOR_SCHEMA,
    systemPrompt: readContract(repoRoot, CONTRACTS.selector),
    userPrompt: JSON.stringify({ identity: storyIdentity(record), architectOptions: options }),
  };
}

function validateWriterIsolation(prompt, rejectedOptions, selectorReview) {
  if (selectorReview && prompt.userPrompt.includes(JSON.stringify(selectorReview))) {
    throw new Error('story_batch_writer_selector_leak');
  }
  for (const option of rejectedOptions) {
    for (const field of OPTION_KEYS.filter((key) => key !== 'optionId')) {
      if (prompt.userPrompt.includes(option[field])) throw new Error('story_batch_writer_rejected_option_leak');
    }
  }
  return true;
}

function calculateCostUsd(usage, serviceTier = SERVICE_TIER) {
  const multiplier = serviceTier === 'priority' || serviceTier === 'fast' ? 2 : 1;
  const input = Number(usage.inputTokens || 0);
  const cached = Number(usage.cachedInputTokens || 0);
  const cacheWrite = Number(usage.cacheWriteTokens || 0);
  const uncached = Math.max(0, input - cached - cacheWrite);
  return multiplier * ((uncached * 5 + cached * 0.5 + cacheWrite * 6.25 + Number(usage.outputTokens || 0) * 30) / 1_000_000);
}

function conservativeReservationUsd(request) {
  const inputUpperBound = Buffer.byteLength(`${request.systemPrompt}\n${request.userPrompt}`, 'utf8');
  return (inputUpperBound * 6.25 + request.maxOutputTokens * 30) / 1_000_000;
}

function contentAddressedWrite(directory, prefix, extension, payload) {
  fs.mkdirSync(directory, { recursive: true });
  const bytes = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');
  const digest = sha256(bytes);
  const filename = `${prefix}.${digest}.${extension}`;
  const absolute = path.join(directory, filename);
  if (!fs.existsSync(absolute)) fs.writeFileSync(absolute, bytes, { flag: 'wx' });
  else if (!fs.readFileSync(absolute).equals(bytes)) throw new Error('story_batch_content_address_collision');
  return { filename, sha256: digest, bytes: bytes.length };
}

function atomicJsonWrite(absolutePath, value) {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  const temporary = `${absolutePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, body, { encoding: 'utf8', flag: 'wx' });
  fs.renameSync(temporary, absolutePath);
}

function resolveRepoHead(repoRoot) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    throw new Error('story_batch_git_head_unavailable');
  }
}

function ensureOutputRoot(repoRoot, outputRoot) {
  const root = path.resolve(repoRoot);
  const outputs = path.join(root, 'outputs');
  const absolute = path.resolve(outputRoot);
  if (!absolute.startsWith(`${outputs}${path.sep}`)) throw new Error('story_batch_output_root_rejected');
  fs.mkdirSync(absolute, { recursive: true });
  return absolute;
}

/** @returns {AutonomousStoryBatchManifest} */
function newManifest(repoRoot, briefIds, maxCostUsd) {
  return {
    version: PIPELINE_VERSION,
    status: 'in_progress',
    authorityStatus: 'machine_qualified_staging_only',
    model: MODEL,
    serviceTier: SERVICE_TIER,
    store: false,
    repoHead: resolveRepoHead(repoRoot),
    briefIds,
    maxCostUsd,
    actualCostUsd: 0,
    logicalProviderCalls: 0,
    transportRetries: 0,
    fallbackUsed: false,
    resumeCount: 0,
    credentialAccess: 'supervisor_child_only',
    stories: {},
    authorityDigests: Object.fromEntries(Object.entries(CONTRACTS).map(([key, value]) => [key, { path: value, sha256: sha256(readContract(repoRoot, value)) }])),
  };
}

/** @returns {AutonomousStoryBatchManifest} */
function loadManifestForResume(repoRoot, manifestPath, briefIds, maxCostUsd) {
  /** @type {AutonomousStoryBatchManifest} */
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch { throw new Error('story_batch_manifest_invalid'); }
  const expectedAuthority = newManifest(repoRoot, briefIds, maxCostUsd);
  if (manifest.version !== PIPELINE_VERSION || manifest.model !== MODEL ||
      manifest.serviceTier !== SERVICE_TIER || manifest.store !== false ||
      manifest.repoHead !== expectedAuthority.repoHead ||
      JSON.stringify(manifest.briefIds) !== JSON.stringify(briefIds) ||
      manifest.maxCostUsd !== maxCostUsd || manifest.transportRetries !== 0 ||
      manifest.fallbackUsed !== false ||
      JSON.stringify(manifest.authorityDigests) !== JSON.stringify(expectedAuthority.authorityDigests) ||
      !manifest.stories || typeof manifest.stories !== 'object' || Array.isArray(manifest.stories)) {
    throw new Error('story_batch_resume_authority_mismatch');
  }
  manifest.resumeCount = Number(manifest.resumeCount || 0) + 1;
  return manifest;
}

function parseProviderJson(result, invalidCode) {
  try { return JSON.parse(result.text); } catch { throw new Error(invalidCode); }
}

/**
 * @param {AutonomousStoryBatchManifest} manifest
 * @param {StoryState} storyState
 */
function recordCall(storyDir, manifest, storyState, request, result) {
  const artifact = contentAddressedWrite(
    storyDir,
    `${String(manifest.logicalProviderCalls + 1).padStart(2, '0')}-${request.stage}`,
    request.schema ? 'json' : 'md',
    result.text,
  );
  const costUsd = calculateCostUsd(result.usage, result.serviceTier);
  const receiptBody = {
    version: 'small-heroes-story-provider-call-receipt/v1',
    stage: request.stage,
    modelRequested: MODEL,
    modelReturned: result.model,
    serviceTierRequested: SERVICE_TIER,
    serviceTierReturned: result.serviceTier,
    store: false,
    reasoningEffort: request.reasoningEffort,
    maxOutputTokens: request.maxOutputTokens,
    promptSha256: sha256(`${request.systemPrompt}\n${request.userPrompt}`),
    output: artifact,
    usage: result.usage,
    costUsd,
    transportRetries: 0,
    fallbackUsed: false,
  };
  const receipt = contentAddressedWrite(storyDir, `${artifact.filename}.receipt`, 'json', `${JSON.stringify(receiptBody, null, 2)}\n`);
  manifest.logicalProviderCalls += 1;
  manifest.actualCostUsd = Number((manifest.actualCostUsd + costUsd).toFixed(9));
  storyState.calls.push({ stage: request.stage, output: artifact, receipt, costUsd });
  return artifact;
}

/**
 * @param {AutonomousStoryBatchManifest} manifest
 * @param {StoryState} storyState
 */
function recordTerminalCall(storyDir, manifest, storyState, request, result) {
  const costUsd = calculateCostUsd(result.usage, result.serviceTier);
  const receiptBody = {
    version: 'small-heroes-story-provider-terminal-call-receipt/v1',
    stage: request.stage,
    status: 'terminal',
    reasonCode: result.terminalReason,
    modelRequested: MODEL,
    modelReturned: result.model,
    serviceTierRequested: SERVICE_TIER,
    serviceTierReturned: result.serviceTier,
    store: false,
    reasoningEffort: request.reasoningEffort,
    maxOutputTokens: request.maxOutputTokens,
    promptSha256: sha256(`${request.systemPrompt}\n${request.userPrompt}`),
    usage: result.usage,
    costUsd,
    rawProviderMaterialPersisted: false,
    transportRetries: 0,
    fallbackUsed: false,
  };
  const receipt = contentAddressedWrite(
    storyDir,
    `${String(manifest.logicalProviderCalls + 1).padStart(2, '0')}-${request.stage}-terminal`,
    'json',
    `${JSON.stringify(receiptBody, null, 2)}\n`,
  );
  manifest.logicalProviderCalls += 1;
  manifest.actualCostUsd = Number((manifest.actualCostUsd + costUsd).toFixed(9));
  storyState.calls.push({ stage: request.stage, terminal: true, receipt, costUsd });
}

/**
 * @param {AutonomousStoryBatchManifest} manifest
 * @param {StoryState} storyState
 */
async function invoke(provider, storyDir, manifest, storyState, request, persist) {
  const reservation = conservativeReservationUsd(request);
  if (manifest.actualCostUsd + reservation > manifest.maxCostUsd) {
    throw new Error('story_batch_cost_reservation_exceeded');
  }
  storyState.inflight = {
    stage: request.stage,
    promptSha256: sha256(`${request.systemPrompt}\n${request.userPrompt}`),
  };
  persist();
  const result = await provider.complete(request);
  const completed = result?.completed !== false;
  if (!result || result.model !== MODEL || result.serviceTier !== SERVICE_TIER ||
      completed && !nonEmpty(result.text) ||
      !completed && !nonEmpty(result.terminalReason) ||
      !exactKeys(result.usage, ['inputTokens', 'cachedInputTokens', 'cacheWriteTokens', 'outputTokens', 'reasoningTokens', 'totalTokens'])) {
    throw new Error('story_batch_provider_result_invalid');
  }
  if (manifest.actualCostUsd + calculateCostUsd(result.usage, result.serviceTier) > manifest.maxCostUsd) {
    throw new Error('story_batch_actual_cost_exceeded');
  }
  if (!completed) {
    recordTerminalCall(storyDir, manifest, storyState, request, result);
    storyState.inflight = null;
    persist();
    throw new Error(result.terminalReason);
  }
  recordCall(storyDir, manifest, storyState, request, result);
  storyState.inflight = null;
  persist();
  return result;
}

/**
 * @param {string} storyDir
 * @param {StoryCall} call
 */
function readRecordedOutput(storyDir, call) {
  if (call?.terminal === true) throw new Error('story_batch_terminal_call_not_resumable');
  if (!call?.output || !exactKeys(call.output, ['filename', 'bytes', 'sha256'])) {
    throw new Error('story_batch_recorded_output_invalid');
  }
  const absolute = path.join(storyDir, call.output.filename);
  const bytes = fs.readFileSync(absolute);
  if (bytes.length !== call.output.bytes || sha256(bytes) !== call.output.sha256) {
    throw new Error('story_batch_recorded_output_drift');
  }
  return bytes.toString('utf8');
}

/**
 * @param {AutonomousStoryBatchManifest} manifest
 * @param {StoryState} storyState
 */
async function getOrInvoke(provider, storyDir, manifest, storyState, request, ordinal, persist) {
  const existing = storyState.calls.filter(({ stage }) => stage === request.stage)[ordinal];
  if (existing) return { text: readRecordedOutput(storyDir, existing), resumed: true };
  return { ...(await invoke(provider, storyDir, manifest, storyState, request, persist)), resumed: false };
}

/**
 * @param {{repoRoot: string, outputRoot: string, authority: any, provider: any, manifest: AutonomousStoryBatchManifest, persist: () => void}} context
 */
async function runOneStory(context, record) {
  const { repoRoot, outputRoot, authority, provider, manifest, persist } = context;
  const briefId = record.brief.id;
  const storyDir = path.join(outputRoot, briefId);
  fs.mkdirSync(storyDir, { recursive: true });
  /** @type {StoryState} */
  const storyState = manifest.stories[briefId] || {
    status: 'in_progress',
    identity: storyIdentity(record),
    calls: [],
    selectedOptionId: null,
    revisionCount: 0,
    inflight: null,
  };
  manifest.stories[briefId] = storyState;
  if (storyState.status === 'machine_qualified' || storyState.status === 'hold') return;
  if (storyState.inflight) {
    storyState.status = 'hold';
    storyState.reasonCode = 'story_batch_ambiguous_inflight_call';
    persist();
    return;
  }
  persist();

  try {
    let architect;
    let selection;
    let decision;
    for (let round = 0; round < 2; round += 1) {
      const architectRequest = buildPrompts(repoRoot, authority, record);
      architectRequest.userPrompt = JSON.stringify({ ...JSON.parse(architectRequest.userPrompt), architectRound: round + 1 });
      const architectResult = await getOrInvoke(provider, storyDir, manifest, storyState, architectRequest, round, persist);
      architect = validateArchitectOptions(parseProviderJson(architectResult, 'story_batch_architect_json_invalid'), briefId);
      persist();

      const selectorRequest = buildSelectorPrompt(repoRoot, record, architect);
      const selectorResult = await getOrInvoke(provider, storyDir, manifest, storyState, selectorRequest, round, persist);
      selection = validateSelection(parseProviderJson(selectorResult, 'story_batch_selector_json_invalid'), briefId);
      decision = chooseQualifiedOption(architect, selection);
      persist();
      if (decision.status === 'selected') break;
    }
    if (!decision || decision.status !== 'selected') throw new Error('story_batch_no_qualifying_premise');
    storyState.selectedOptionId = decision.selectedOption.optionId;

    const rejected = architect.options.filter(({ optionId }) => optionId !== decision.selectedOption.optionId);
    const writerRequest = buildPrompts(repoRoot, authority, record, decision.selectedOption);
    validateWriterIsolation(writerRequest, rejected, selection);
    let draftResult = await getOrInvoke(provider, storyDir, manifest, storyState, writerRequest, 0, persist);
    let draft = `${draftResult.text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trimEnd()}\n`;
    persist();

    for (let editorialRound = 0; editorialRound < 3; editorialRound += 1) {
      const editorRequest = buildPrompts(repoRoot, authority, record, decision.selectedOption, draft);
      const editorResult = await getOrInvoke(provider, storyDir, manifest, storyState, editorRequest, editorialRound, persist);
      const review = validateEditorialReviewResult(
        parseProviderJson(editorResult, 'story_batch_editor_json_invalid'),
        record.brief.pageCount,
      );
      persist();
      if (review.verdict === 'pass') {
        validateEditorialPassDraft(record, { text: draft, sha256: sha256(draft) });
        const finalStory = contentAddressedWrite(storyDir, 'final-story', 'md', draft);
        storyState.status = 'machine_qualified';
        storyState.editorialVerdict = 'pass';
        storyState.finalStory = finalStory;
        persist();
        return;
      }
      if (review.verdict === 'reject') throw new Error('story_batch_editor_rejected');
      if (editorialRound >= 2) throw new Error('story_batch_revision_budget_exhausted');
      const revisionRequest = buildPrompts(repoRoot, authority, record, decision.selectedOption, draft, review);
      const revisionResult = await getOrInvoke(provider, storyDir, manifest, storyState, revisionRequest, editorialRound, persist);
      draft = `${revisionResult.text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trimEnd()}\n`;
      storyState.revisionCount += 1;
      persist();
    }
  } catch (error) {
    storyState.status = 'hold';
    storyState.reasonCode = error instanceof Error ? error.message.split(':')[0] : 'story_batch_unknown_failure';
    persist();
  }
}

async function runAutonomousStoryWave({ repoRoot = ROOT, outputRoot, briefIds, provider, maxCostUsd }) {
  if (!provider || typeof provider.complete !== 'function') throw new Error('story_batch_provider_missing');
  if (!Number.isFinite(maxCostUsd) || maxCostUsd <= 0) throw new Error('story_batch_cost_cap_invalid');
  const absoluteOutputRoot = ensureOutputRoot(repoRoot, outputRoot);
  const manifestPath = path.join(absoluteOutputRoot, 'manifest.json');
  const authority = loadStoryArchitectAuthority();
  const records = briefIds.map((briefId) => findRecord(authority.commissionAuthority, briefId));
  if (new Set(briefIds).size !== briefIds.length) throw new Error('story_batch_brief_ids_not_unique');
  const manifest = fs.existsSync(manifestPath)
    ? loadManifestForResume(repoRoot, manifestPath, briefIds, maxCostUsd)
    : newManifest(repoRoot, briefIds, maxCostUsd);
  const persist = () => atomicJsonWrite(manifestPath, manifest);
  persist();
  for (const record of records) await runOneStory({ repoRoot, outputRoot: absoluteOutputRoot, authority, provider, manifest, persist }, record);
  const states = Object.values(manifest.stories).map(({ status }) => status);
  manifest.status = states.every((status) => status === 'machine_qualified') ? 'machine_qualified' : 'completed_with_holds';
  persist();
  return manifest;
}

module.exports = {
  ACCEPTED_DINI_BRIEF_ID,
  ARCHITECT_SCHEMA,
  CONTRACTS,
  DISQUALIFIERS,
  EDITORIAL_SCHEMA,
  EDITOR_MAX_OUTPUT_TOKENS,
  MODEL,
  PIPELINE_VERSION,
  SELECTOR_SCHEMA,
  SERVICE_TIER,
  buildPrompts,
  buildSelectorPrompt,
  calculateCostUsd,
  chooseQualifiedOption,
  conservativeReservationUsd,
  runAutonomousStoryWave,
  requiredStoryEnvelope,
  storyIdentity,
  validateArchitectOptions,
  validateSelection,
  validateWriterIsolation,
};
