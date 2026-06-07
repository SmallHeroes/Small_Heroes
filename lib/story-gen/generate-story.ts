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
    },
  };
}
