/**
 * STOP 1 report helpers for confidence batch — family diversity + autonomy.
 */

import type { PremiseFamily, PremiseScoredCandidate, StoryPremiseCandidate } from './types';
import type { PremiseExperimentSpecV3 } from './types';
import { classifyAutoPremiseAutonomy, type AutoPremiseAutonomy } from './auto-premise-autonomy';
import { analyzePremiseDiversity } from './premise-collapse-check';

export interface Stop1StoryReport {
  specId: string;
  companionId: string;
  category: string;
  pageCount: number;
  autoSelected: StoryPremiseCandidate;
  autoPremiseAutonomy: AutoPremiseAutonomy;
  autonomyReasons: string[];
  diversity: ReturnType<typeof analyzePremiseDiversity>;
  familyDiversityCount: number;
  top3Families: PremiseFamily[];
}

export function buildStop1StoryReport(args: {
  spec: PremiseExperimentSpecV3;
  pageCount: number;
  candidates: PremiseScoredCandidate[];
  selected: StoryPremiseCandidate;
}): Stop1StoryReport {
  const diversity = analyzePremiseDiversity(args.candidates.map((c) => c.candidate));
  const selectedScored = args.candidates.find((c) => c.candidate.id === args.selected.id);

  const families = args.candidates
    .map((c) => c.candidate.premiseFamily)
    .filter(Boolean) as PremiseFamily[];
  const familyCounts = new Map<PremiseFamily, number>();
  for (const f of families) familyCounts.set(f, (familyCounts.get(f) ?? 0) + 1);
  const top3Families = [...familyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([f]) => f);

  const autonomy = classifyAutoPremiseAutonomy({
    scored: selectedScored,
    selected: args.selected,
    spec: args.spec,
  });

  return {
    specId: args.spec.id,
    companionId: args.spec.companionId,
    category: args.spec.category ?? args.spec.resilienceTheme,
    pageCount: args.pageCount,
    autoSelected: args.selected,
    autoPremiseAutonomy: autonomy.status,
    autonomyReasons: autonomy.reasons,
    diversity,
    familyDiversityCount: new Set(families).size,
    top3Families,
  };
}

export function analyzeBatchFamilyDiversity(
  reports: Stop1StoryReport[]
): {
  familyDiversityCount: number;
  top3Families: PremiseFamily[];
  batchReskinRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  selectedFamilies: PremiseFamily[];
  pass: boolean;
} {
  const selectedFamilies = reports
    .map((r) => r.autoSelected.premiseFamily)
    .filter(Boolean) as PremiseFamily[];
  const unique = new Set(selectedFamilies);
  const familyDiversityCount = unique.size;

  const familyCounts = new Map<PremiseFamily, number>();
  for (const f of selectedFamilies) familyCounts.set(f, (familyCounts.get(f) ?? 0) + 1);
  const top3Families = [...familyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([f]) => f);

  let batchReskinRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (familyDiversityCount < 3) batchReskinRisk = 'HIGH';
  else if (reports.some((r) => !r.diversity.passStop1)) batchReskinRisk = 'MEDIUM';

  const pass = familyDiversityCount >= 3 && batchReskinRisk !== 'HIGH';

  return {
    familyDiversityCount,
    top3Families,
    batchReskinRisk,
    selectedFamilies,
    pass,
  };
}

export function renderReskinControlQuestion(spec: PremiseExperimentSpecV3): string {
  const swap =
    spec.category === 'ANGER_FRUSTRATION'
      ? 'If I swap Leo for Dini/Koko and roar-weight for popcorn/paint — same arc?'
      : spec.category === 'MEDICAL_PROCEDURE'
        ? 'If I swap Bunny for Dini/Koko and clinic wait for popcorn/paint — same arc?'
        : 'If I swap Turtle for Dini/Koko and moving house for popcorn/paint — same arc?';
  return swap;
}
