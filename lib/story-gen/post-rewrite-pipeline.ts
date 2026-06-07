/**
 * Shared post-rewrite pipeline: normalize → chip repair → proofread → powerCard sanitizer → gates.
 */

import { repairGenderChipsInStory, type GenderChipRepairReport } from './gender-chip-repair';
import { scanHebrewSanity, type HebrewSanityReport } from './hebrew-sanity';
import {
  sanitizePowerCardMetadata,
  type PowerCardSanitizerReport,
} from './powercard-metadata-sanitizer';
import { runProofreadPass, type ProofreadReport } from './proofread-pass';
import { buildRun1AdvisoryBundle, type Run1AdvisoryBundle } from './run1-advisory';
import { normalizePhaseBStoryMarkdown } from './story-markdown-normalize';
import type { Scenario, StoryOutline } from './story-generation-types';
import { DEFAULT_STORY_GEN_MODELS } from './story-generation-types';

export async function runPostRewritePipeline(args: {
  storyMarkdown: string;
  scenario: Scenario;
  outline: StoryOutline;
  runLabel?: string;
  judgeModel?: string;
}): Promise<{
  storyMarkdown: string;
  chipRepair: GenderChipRepairReport;
  proofread: ProofreadReport;
  powerCardSanitizer: PowerCardSanitizerReport;
  hebrewSanity: HebrewSanityReport;
  advisory: Run1AdvisoryBundle;
}> {
  let md = normalizePhaseBStoryMarkdown({
    rawMarkdown: args.storyMarkdown,
    scenario: args.scenario,
    outline: args.outline,
  });

  const chipResult = repairGenderChipsInStory(md);
  md = chipResult.markdown;

  const proofreadResult = await runProofreadPass({
    storyMarkdown: md,
    modelId: DEFAULT_STORY_GEN_MODELS.draftModel,
  });
  md = proofreadResult.markdown;

  const sanitizerResult = sanitizePowerCardMetadata({
    storyMarkdown: md,
    companionId: args.scenario.companionId,
  });
  md = sanitizerResult.markdown;

  const hebrewSanity = scanHebrewSanity(md);

  const advisory = await buildRun1AdvisoryBundle({
    scenario: args.scenario,
    storyMarkdown: md,
    runLabel: args.runLabel ?? 'writers-room-canary',
    judgeModel: args.judgeModel ?? DEFAULT_STORY_GEN_MODELS.judgeModel,
    chipRepairReport: chipResult.report,
    proofreadReport: proofreadResult.report,
    hebrewSanity,
    powerCardSanitizer: sanitizerResult.report,
  });

  return {
    storyMarkdown: md,
    chipRepair: chipResult.report,
    proofread: proofreadResult.report,
    powerCardSanitizer: sanitizerResult.report,
    hebrewSanity,
    advisory,
  };
}

export async function runRevalidateOnlyPipeline(args: {
  storyMarkdown: string;
  scenario: Scenario;
  outline: StoryOutline;
  runLabel?: string;
}): Promise<{
  storyMarkdown: string;
  powerCardSanitizer: PowerCardSanitizerReport;
  hebrewSanity: HebrewSanityReport;
  advisory: Run1AdvisoryBundle;
}> {
  const sanitizerResult = sanitizePowerCardMetadata({
    storyMarkdown: args.storyMarkdown,
    companionId: args.scenario.companionId,
  });
  let md = sanitizerResult.markdown;

  const chipResult = repairGenderChipsInStory(md);
  md = chipResult.markdown;

  const hebrewSanity = scanHebrewSanity(md);

  const advisory = await buildRun1AdvisoryBundle({
    scenario: args.scenario,
    storyMarkdown: md,
    runLabel: args.runLabel ?? 'writers-room-revalidate',
    judgeModel: DEFAULT_STORY_GEN_MODELS.judgeModel,
    chipRepairReport: chipResult.report,
    hebrewSanity,
    powerCardSanitizer: sanitizerResult.report,
  });

  return {
    storyMarkdown: md,
    powerCardSanitizer: sanitizerResult.report,
    hebrewSanity,
    advisory,
  };
}
