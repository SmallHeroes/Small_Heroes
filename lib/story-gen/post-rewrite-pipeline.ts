/**
 * Shared post-rewrite pipeline: normalize → chip normalize → chip repair → proofread
 * → adventure density enrich → powerCard sanitizer → gates.
 */

import { checkAdventureDensity } from './adventure-density-gate';
import { normalizePartialGenderChips, type ChipNormalizeReport } from './chip-normalize';
import { buildCompanionContextBlock } from './companion-context';
import { repairGenderChipsInStory, type GenderChipRepairReport } from './gender-chip-repair';
import { scanHebrewSanity, type HebrewSanityReport } from './hebrew-sanity';
import {
  sanitizePowerCardMetadata,
  type PowerCardSanitizerReport,
} from './powercard-metadata-sanitizer';
import { runProofreadPass, type ProofreadReport } from './proofread-pass';
import { buildRun1AdvisoryBundle, type Run1AdvisoryBundle } from './run1-advisory';
import { normalizePhaseBStoryMarkdown } from './story-markdown-normalize';
import { runThinPageEnrichPass, type ThinPageEnrichReport } from './thin-page-enrich';
import type { Scenario, StoryOutline } from './story-generation-types';
import { DEFAULT_STORY_GEN_MODELS } from './story-generation-types';

function applyChipPasses(markdown: string): {
  markdown: string;
  chipNormalize: ChipNormalizeReport;
  chipRepair: GenderChipRepairReport;
} {
  const norm = normalizePartialGenderChips(markdown);
  const repair = repairGenderChipsInStory(norm.markdown);
  return {
    markdown: repair.markdown,
    chipNormalize: norm.report,
    chipRepair: repair.report,
  };
}

async function maybeAdventureEnrich(args: {
  storyMarkdown: string;
  scenario: Scenario;
  outline: StoryOutline;
  companionBlock: string;
  modelId: string;
  skipEnrich?: boolean;
}): Promise<{
  storyMarkdown: string;
  enrichReport?: ThinPageEnrichReport;
  densityCheck: ReturnType<typeof checkAdventureDensity>;
}> {
  const densityCheck = checkAdventureDensity(args.storyMarkdown, args.scenario.direction);
  if (args.skipEnrich || !densityCheck.needsEnrich) {
    return { storyMarkdown: args.storyMarkdown, densityCheck };
  }

  const enrichResult = await runThinPageEnrichPass({
    storyMarkdown: args.storyMarkdown,
    scenario: args.scenario,
    outline: args.outline,
    companionBlock: args.companionBlock,
    modelId: args.modelId,
  });

  return {
    storyMarkdown: enrichResult.markdown,
    enrichReport: enrichResult.report,
    densityCheck,
  };
}

export async function runPostRewritePipeline(args: {
  storyMarkdown: string;
  scenario: Scenario;
  outline: StoryOutline;
  companionBlock?: string;
  runLabel?: string;
  judgeModel?: string;
  draftModel?: string;
  skipAdventureEnrich?: boolean;
  skipProofread?: boolean;
}): Promise<{
  storyMarkdown: string;
  chipNormalize: ChipNormalizeReport;
  chipRepair: GenderChipRepairReport;
  proofread?: ProofreadReport;
  adventureDensity: ReturnType<typeof checkAdventureDensity>;
  thinPageEnrich?: ThinPageEnrichReport;
  powerCardSanitizer: PowerCardSanitizerReport;
  hebrewSanity: HebrewSanityReport;
  advisory: Run1AdvisoryBundle;
}> {
  const companionBlock =
    args.companionBlock ?? buildCompanionContextBlock(args.scenario.companionId);
  const draftModel = args.draftModel ?? DEFAULT_STORY_GEN_MODELS.draftModel;

  let md = normalizePhaseBStoryMarkdown({
    rawMarkdown: args.storyMarkdown,
    scenario: args.scenario,
    outline: args.outline,
  });

  let chipPasses = applyChipPasses(md);
  md = chipPasses.markdown;

  let proofread: ProofreadReport | undefined;
  if (!args.skipProofread) {
    const proofreadResult = await runProofreadPass({
      storyMarkdown: md,
      modelId: draftModel,
    });
    md = proofreadResult.markdown;
    proofread = proofreadResult.report;
  }

  const enrichResult = await maybeAdventureEnrich({
    storyMarkdown: md,
    scenario: args.scenario,
    outline: args.outline,
    companionBlock,
    modelId: draftModel,
    skipEnrich: args.skipAdventureEnrich,
  });
  md = enrichResult.storyMarkdown;

  if (enrichResult.enrichReport) {
    chipPasses = applyChipPasses(md);
    md = chipPasses.markdown;
  }

  const sanitizerResult = sanitizePowerCardMetadata({
    storyMarkdown: md,
    companionId: args.scenario.companionId,
  });
  md = sanitizerResult.markdown;

  const postSanitizerChips = applyChipPasses(md);
  md = postSanitizerChips.markdown;
  chipPasses = {
    markdown: md,
    chipNormalize: {
      ...chipPasses.chipNormalize,
      fixes: [...chipPasses.chipNormalize.fixes, ...postSanitizerChips.chipNormalize.fixes],
      fixCount: chipPasses.chipNormalize.fixCount + postSanitizerChips.chipNormalize.fixCount,
      unrepaired: [
        ...chipPasses.chipNormalize.unrepaired,
        ...postSanitizerChips.chipNormalize.unrepaired,
      ],
    },
    chipRepair: postSanitizerChips.chipRepair,
  };

  const hebrewSanity = scanHebrewSanity(md);

  const advisory = await buildRun1AdvisoryBundle({
    scenario: args.scenario,
    storyMarkdown: md,
    runLabel: args.runLabel ?? 'writers-room-canary',
    judgeModel: args.judgeModel ?? DEFAULT_STORY_GEN_MODELS.judgeModel,
    chipRepairReport: chipPasses.chipRepair,
    chipNormalizeReport: chipPasses.chipNormalize,
    proofreadReport: proofread,
    hebrewSanity,
    powerCardSanitizer: sanitizerResult.report,
    enrichReport: enrichResult.enrichReport,
  });

  return {
    storyMarkdown: md,
    chipNormalize: chipPasses.chipNormalize,
    chipRepair: chipPasses.chipRepair,
    proofread,
    adventureDensity: enrichResult.densityCheck,
    thinPageEnrich: enrichResult.enrichReport,
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
  draftModel?: string;
  skipAdventureEnrich?: boolean;
}): Promise<{
  storyMarkdown: string;
  chipNormalize: ChipNormalizeReport;
  chipRepair: GenderChipRepairReport;
  adventureDensity: ReturnType<typeof checkAdventureDensity>;
  thinPageEnrich?: ThinPageEnrichReport;
  powerCardSanitizer: PowerCardSanitizerReport;
  hebrewSanity: HebrewSanityReport;
  advisory: Run1AdvisoryBundle;
}> {
  const companionBlock = buildCompanionContextBlock(args.scenario.companionId);
  const draftModel = args.draftModel ?? DEFAULT_STORY_GEN_MODELS.draftModel;

  let md = args.storyMarkdown;

  let chipPasses = applyChipPasses(md);
  md = chipPasses.markdown;

  const enrichResult = await maybeAdventureEnrich({
    storyMarkdown: md,
    scenario: args.scenario,
    outline: args.outline,
    companionBlock,
    modelId: draftModel,
    skipEnrich: args.skipAdventureEnrich,
  });
  md = enrichResult.storyMarkdown;

  if (enrichResult.enrichReport) {
    chipPasses = applyChipPasses(md);
    md = chipPasses.markdown;
  }

  const sanitizerResult = sanitizePowerCardMetadata({
    storyMarkdown: md,
    companionId: args.scenario.companionId,
  });
  md = sanitizerResult.markdown;

  const postSanitizerChips = applyChipPasses(md);
  md = postSanitizerChips.markdown;
  chipPasses = {
    markdown: md,
    chipNormalize: {
      ...chipPasses.chipNormalize,
      fixes: [...chipPasses.chipNormalize.fixes, ...postSanitizerChips.chipNormalize.fixes],
      fixCount: chipPasses.chipNormalize.fixCount + postSanitizerChips.chipNormalize.fixCount,
      unrepaired: [
        ...chipPasses.chipNormalize.unrepaired,
        ...postSanitizerChips.chipNormalize.unrepaired,
      ],
    },
    chipRepair: postSanitizerChips.chipRepair,
  };

  const hebrewSanity = scanHebrewSanity(md);

  const advisory = await buildRun1AdvisoryBundle({
    scenario: args.scenario,
    storyMarkdown: md,
    runLabel: args.runLabel ?? 'writers-room-revalidate',
    judgeModel: DEFAULT_STORY_GEN_MODELS.judgeModel,
    chipRepairReport: chipPasses.chipRepair,
    chipNormalizeReport: chipPasses.chipNormalize,
    hebrewSanity,
    powerCardSanitizer: sanitizerResult.report,
    enrichReport: enrichResult.enrichReport,
  });

  return {
    storyMarkdown: md,
    chipNormalize: chipPasses.chipNormalize,
    chipRepair: chipPasses.chipRepair,
    adventureDensity: enrichResult.densityCheck,
    thinPageEnrich: enrichResult.enrichReport,
    powerCardSanitizer: sanitizerResult.report,
    hebrewSanity,
    advisory,
  };
}
