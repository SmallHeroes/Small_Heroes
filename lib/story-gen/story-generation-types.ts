/**
 * Phase A — minimal shared types for outline-first story generation.
 * Full Scenario schema lands in Phase B.
 */

export type StoryDirection = 'bedtime' | 'adventure' | 'fantasy';

/** Configurable model seam — defaults only in Phase A; no multi-model wiring yet. */
export interface StoryGenModelConfig {
  draftModel: string;
  judgeModel: string;
  revisionModel: string;
}

export const DEFAULT_STORY_GEN_MODELS: StoryGenModelConfig = {
  draftModel: process.env.GENERATOR_LLM_MODEL?.trim() || 'gpt-5-chat-latest',
  judgeModel: process.env.GENERATOR_LLM_MODEL?.trim() || 'gpt-5-chat-latest',
  revisionModel: process.env.GENERATOR_LLM_MODEL?.trim() || 'gpt-5-chat-latest',
};

export const DIRECTION_PAGE_COUNTS: Record<StoryDirection, number> = {
  bedtime: 8,
  adventure: 12,
  fantasy: 16,
};

/** Inline scenario — hand-authored for Phase A kill-switch runs. */
export interface Scenario {
  id: string;
  companionId: string;
  direction: StoryDirection;
  category: string;
  beatCount: number;
  titleSeed: string;
  setting: string;
  incitingIncident: string;
  emotionalCore: string;
  companionRole: string;
  agencyTransfer: string;
  climaxShape: string;
  endingResidue: string;
  /** Self-audit: why this is not a retread of an existing golden. */
  distinctnessNotes: string;
}

/** Phase B — hand-authored scenario bank fields (companion-specific). */
export type ScenarioStatus = 'active' | 'reserve';

export interface PhaseBScenario extends Scenario {
  status: ScenarioStatus;
  /** Hebrew working title */
  titleHe: string;
  /** Required on every Tubi scenario */
  qaLine: string;
  trigger: string;
  childProblem: string;
  misread: string;
  companionEntry: string;
  engineUse: string;
  childAgency: string;
  comicBeat: string;
  imagery: string;
  climax: string;
  residue: string;
  whyThisIsFresh: string;
  /** Hard guardrails (anti-whale, anti-fawn, etc.) */
  forbiddenPatterns?: string[];
  antiPatternNotes?: string;
  /** Phase B validation order — lower runs first; omit for reserve/unscheduled */
  validationOrder?: number;
}

export interface OutlineBeat {
  page: number;
  beatSummary: string;
  emotionalTurn: string;
  companionBeat?: string;
}

export interface StoryOutline {
  title: string;
  worldRule: string;
  powerCard: {
    title: string;
    subtitle: string;
    coreTool: string;
    steps: string[];
    companionReminder: string;
    visualMotifs: string[];
  };
  metadata: {
    storyStyle: string;
    metaphor: string;
    stakes: string;
    quietPagePosition: number;
    heartLine: string;
    emotionalMistake: string;
    uncomfortableTruth: string;
    agencyTransfer: string;
  };
  beats: OutlineBeat[];
}

export interface PromptSnapshot {
  stage: string;
  systemPrompt: string;
  userPrompt: string;
  modelId: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface StoryGenRunResult {
  runDir: string;
  companionId: string;
  direction: StoryDirection;
  scenario: Scenario;
  outline: StoryOutline;
  storyMarkdown: string;
  prompts: PromptSnapshot[];
  modelVersions: StoryGenModelConfig & { resolvedAt: string };
  /** Phase B plumbing — scenario + profile advisory snapshot (no judge scores). */
  advisoryReport?: Record<string, unknown>;
}
