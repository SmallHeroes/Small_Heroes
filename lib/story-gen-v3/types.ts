/**
 * Generator-v3 — Story Premise Engine (isolated R&D).
 */

export type StoryDirectionV3 = 'bedtime' | 'adventure' | 'fantasy';

export interface StoryPremiseCandidate {
  id: string;
  titleSeed: string;

  resilienceTheme: string;
  hiddenResilienceTool: string;

  oneLineHook: string;
  openingWeirdEvent: string;

  childWant: string;
  whyItMattersToChild: string;

  physicalProblem: string;
  playSystem: string;
  keyObjects: string[];

  companionComicEngineUsed: string;
  companionWrongHelp: string;

  firstTry: string;
  whyFirstTryFails: string;
  funnyFailureImage: string;

  escalation: string;
  childDiscovery: string;
  braveChildAction: string;

  bigReleasePayoff: string;
  oneResilienceLineMax: string;

  whyChildWillCare: string;
  whyParentWillCare: string;
  whyNotTherapeuticFable: string;
  whyNotGoldenCopy: string;

  /** Set during generation */
  premiseFamily?: PremiseFamily;
}

export type PremiseFamily =
  | 'everyday_magical_invasion'
  | 'companion_causes_comic_mess'
  | 'child_game_social'
  | 'object_creature_absurdity';

export interface GoldenPremiseRecord {
  sourceStoryId: string;
  companionId: string;
  direction: StoryDirectionV3;
  premise: StoryPremiseCandidate;
  calibrationNotes: string;
}

export interface PremiseHardFail {
  code: string;
  message: string;
}

export interface PremiseScoreDimensions {
  hookStrength: number;
  comicEngineStrength: number;
  physicalPlayPotential: number;
  childAgencyPotential: number;
  tryFailPotential: number;
  payoffReleasePotential: number;
  companionSpecificity: number;
  visualPageVariety: number;
  lowMoralizingRisk: number;
  emotionalAlignment: number;
}

export interface PremiseScoredCandidate {
  candidate: StoryPremiseCandidate;
  hardFails: PremiseHardFail[];
  disqualified: boolean;
  scores?: PremiseScoreDimensions;
  weightedTotal?: number;
  judgeNotes?: string;
  criticAttacks?: string[];
  diversityCluster?: string;
}

export interface PremiseTournamentResult {
  candidates: PremiseScoredCandidate[];
  topThree: PremiseScoredCandidate[];
  selected: StoryPremiseCandidate;
  selectionReason: string;
}

export interface PremiseExperimentSpecV3 {
  id: string;
  companionId: string;
  direction: StoryDirectionV3;
  resilienceTheme: string;
  childAgeMin: number;
  childAgeMax: number;
  candidateCount: number;
  calibrationGoldenIds: string[];
  forbidPlotCopy: string[];
}

export interface PremiseExperimentRunResult {
  runDir: string;
  goldenPremises: GoldenPremiseRecord[];
  tournament: PremiseTournamentResult;
  stoppedAt: 'premise_complete' | 'error';
}
