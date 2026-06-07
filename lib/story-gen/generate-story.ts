import { OpenAIResponsesLLM, parseJsonFromLLM } from '../story-generator/llm';
import { buildCompanionContextBlock } from './companion-context';
import { formatFewShotsBlock, loadGoldenFewShots } from './golden-few-shots';
import {
  buildOutlineSystemPrompt,
  buildOutlineUserPrompt,
  buildProseSystemPrompt,
  buildProseUserPrompt,
} from './prompts';
import { buildPhaseBAdvisoryReport, isPhaseBScenario } from './scenario-prompt-block';
import { normalizePartialGenderChips, type ChipNormalizeReport } from './chip-normalize';
import { repairGenderChipsInStory, type GenderChipRepairReport } from './gender-chip-repair';
import { scanHebrewSanity, type HebrewSanityReport } from './hebrew-sanity';
import { runProofreadPass, type ProofreadReport } from './proofread-pass';
import {
  sanitizePowerCardMetadata,
  type PowerCardSanitizerReport,
} from './powercard-metadata-sanitizer';
import { normalizePhaseBStoryMarkdown } from './story-markdown-normalize';
import { runThinPageEnrichPass, type ThinPageEnrichReport } from './thin-page-enrich';
import type {
  PromptSnapshot,
  Scenario,
  StoryGenModelConfig,
  StoryGenRunResult,
  StoryOutline,
} from './story-generation-types';
import { DIRECTION_PAGE_COUNTS } from './story-generation-types';

function createLlm(modelId: string): OpenAIResponsesLLM {
  return new OpenAIResponsesLLM(modelId);
}

export async function generateStoryFromScenario(args: {
  scenario: Scenario;
  modelConfig?: StoryGenModelConfig;
}): Promise<Omit<StoryGenRunResult, 'runDir'>> {
  const modelConfig = args.modelConfig ?? {
    draftModel: process.env.GENERATOR_LLM_MODEL?.trim() || 'gpt-5-chat-latest',
    judgeModel: process.env.GENERATOR_LLM_MODEL?.trim() || 'gpt-5-chat-latest',
    revisionModel: process.env.GENERATOR_LLM_MODEL?.trim() || 'gpt-5-chat-latest',
  };

  const { scenario } = args;
  const beatCount = scenario.beatCount || DIRECTION_PAGE_COUNTS[scenario.direction];
  const companionBlock = buildCompanionContextBlock(scenario.companionId);
  const fewShots = loadGoldenFewShots(scenario.direction, 3, scenario.companionId);
  const fewShotsBlock = formatFewShotsBlock(fewShots);
  const prompts: PromptSnapshot[] = [];

  const outlineLlm = createLlm(modelConfig.draftModel);
  const outlineSystem = buildOutlineSystemPrompt();
  const outlineUser = buildOutlineUserPrompt({
    companionBlock,
    scenario,
    fewShotsBlock,
    beatCount,
  });

  const outlineResult = await outlineLlm.call({
    stage: 'outline',
    systemPrompt: outlineSystem,
    userPrompt: outlineUser,
    jsonMode: true,
    maxOutputTokens: 4096,
    temperature: 0.7,
  });

  prompts.push({
    stage: 'outline',
    systemPrompt: outlineSystem,
    userPrompt: outlineUser,
    modelId: modelConfig.draftModel,
    inputTokens: outlineResult.inputTokens,
    outputTokens: outlineResult.outputTokens,
  });

  const outline = parseJsonFromLLM<StoryOutline>(outlineResult.text, 'outline');
  if (outline.beats.length !== beatCount) {
    throw new Error(
      `[outline] Expected ${beatCount} beats, got ${outline.beats.length}`
    );
  }

  const phaseB = isPhaseBScenario(scenario);
  const proseLlm = createLlm(modelConfig.draftModel);
  const proseSystem = buildProseSystemPrompt(scenario.direction, phaseB);
  const proseUser = buildProseUserPrompt({
    companionBlock,
    scenario,
    outline,
    fewShotsBlock,
  });

  const proseResult = await proseLlm.call({
    stage: 'prose',
    systemPrompt: proseSystem,
    userPrompt: proseUser,
    maxOutputTokens: 16384,
    temperature: 0.75,
  });

  prompts.push({
    stage: 'prose',
    systemPrompt: proseSystem,
    userPrompt: proseUser,
    modelId: modelConfig.draftModel,
    inputTokens: proseResult.inputTokens,
    outputTokens: proseResult.outputTokens,
  });

  let storyMarkdown = proseResult.text.trim();
  let thinPageEnrich: ThinPageEnrichReport | undefined;
  let genderChipRepair: GenderChipRepairReport | undefined;
  let chipNormalize: ChipNormalizeReport | undefined;
  let proofread: ProofreadReport | undefined;
  let powerCardSanitizer: PowerCardSanitizerReport | undefined;
  let hebrewSanity: HebrewSanityReport | undefined;

  if (phaseB) {
    storyMarkdown = normalizePhaseBStoryMarkdown({
      rawMarkdown: storyMarkdown,
      scenario,
      outline,
    });

    if (scenario.direction === 'adventure') {
      const enrichResult = await runThinPageEnrichPass({
        storyMarkdown,
        scenario,
        outline,
        companionBlock,
        modelId: modelConfig.draftModel,
      });
      storyMarkdown = enrichResult.markdown;
      thinPageEnrich = enrichResult.report;
      prompts.push(...enrichResult.prompts);
    }

    const chipNormResult = normalizePartialGenderChips(storyMarkdown);
    storyMarkdown = chipNormResult.markdown;
    chipNormalize = chipNormResult.report;

    const chipResult = repairGenderChipsInStory(storyMarkdown);
    storyMarkdown = chipResult.markdown;
    genderChipRepair = chipResult.report;

    const proofreadResult = await runProofreadPass({
      storyMarkdown,
      modelId: modelConfig.draftModel,
    });
    storyMarkdown = proofreadResult.markdown;
    proofread = proofreadResult.report;

    const sanitizerResult = sanitizePowerCardMetadata({
      storyMarkdown,
      companionId: scenario.companionId,
    });
    storyMarkdown = sanitizerResult.markdown;
    powerCardSanitizer = sanitizerResult.report;

    hebrewSanity = scanHebrewSanity(storyMarkdown);
  }

  return {
    companionId: scenario.companionId,
    direction: scenario.direction,
    scenario,
    outline,
    storyMarkdown,
    prompts,
    modelVersions: {
      ...modelConfig,
      resolvedAt: new Date().toISOString(),
    },
    advisoryReport: {
      ...buildPhaseBAdvisoryReport({ scenario, companionBlock }),
      ...(thinPageEnrich ? { thinPageEnrich } : {}),
      ...(chipNormalize ? { chipNormalize } : {}),
      ...(genderChipRepair ? { genderChipRepair } : {}),
      ...(proofread ? { proofread } : {}),
      ...(powerCardSanitizer ? { powerCardSanitizer } : {}),
      ...(hebrewSanity ? { hebrewSanity } : {}),
    },
  };
}
