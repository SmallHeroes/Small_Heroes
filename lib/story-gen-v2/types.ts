/**
 * Generator-v2 — event-driven story schemas (isolated spike; not Phase-B).
 */

export type StoryDirectionV2 = 'bedtime' | 'adventure' | 'fantasy';

export interface GoldenPageEvent {
  page: number;
  storyFactBefore: string;
  eventOnPage: string;
  childAction: string;
  complicationOrChange: string;
  companionResponse?: string;
  emotionalShift: string;
  storyFactAfter: string;
  pageTurnReason?: string;
}

export interface GoldenStoryDNA {
  sourceStoryId: string;
  direction: StoryDirectionV2;
  companionId: string;

  childDesire: string;
  entryBarrier: string;

  firstTry: string;
  firstTryFailsBecause: string;

  companionComicMistake: string;
  companionVulnerability?: string;

  childNotices: string;
  childInvents: string;
  braveAction: string;

  worldResponse: string;
  residue: string;

  pageEventMap: GoldenPageEvent[];
}

export interface StorySpineV2 {
  titleSeed: string;
  direction: StoryDirectionV2;
  companionId: string;
  resilienceTheme: string;

  protagonistWant: string;
  visibleProblem: string;

  firstAttempt: string;
  firstAttemptFailsBecause: string;

  secondComplication: string;

  companionMisread: string;
  companionVulnerability?: string;

  childDiscovery: string;
  childPlan: string;
  childBraveAction: string;

  climaxChoice: string;
  payoff: string;
  emotionalResidue: string;

  oneSentenceEventChain: string;
}

export interface PageBeatV2 {
  page: number;

  storyFactBefore: string;
  eventOnPage: string;
  childAction: string;

  complicationOrChange: string;
  companionReaction?: string;

  emotionalShift: string;

  storyFactAfter: string;
  pageTurnReason: string;

  imageDirectionSeed?: string;
}

export interface EventMomentumReport {
  verdict: 'PASS' | 'FAIL';

  missingChildDesire: boolean;
  missingTryFail: boolean;
  missingCompanionMisread: boolean;
  missingChildDiscovery: boolean;
  missingBraveChildAction: boolean;
  missingWorldResponse: boolean;

  pagesWithoutConcreteEvent: number[];
  passiveChildPages: number[];
  staticPages: number[];
  weakPageTurnPages: number[];

  longestStaticRun: number;

  notes: string[];
}

export interface ExperimentSpecV2 {
  id: string;
  companionId: string;
  direction: StoryDirectionV2;
  pageCount: number;
  resilienceTheme: string;
  goldenDnaSourceId: string;

  /** Must differ from golden plot */
  setting: string;
  gameOrPlayPattern: string;
  keyObject: string;
  entryMethod: string;
  finalChildAction: string;

  forbidPlotCopy: string[];
}

export interface StoryGenV2RunResult {
  runDir: string;
  experimentId: string;
  momentumBeforeProse: EventMomentumReport;
  storyMarkdown?: string;
  stoppedAt: 'momentum_fail' | 'prose_complete';
}
