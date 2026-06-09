/**
 * Premise tournament: hard-fail → judge → diversity → top 3 → critic → select.
 */

import type {
  GoldenPremiseRecord,
  PremiseExperimentSpecV3,
  PremiseScoredCandidate,
  PremiseTournamentResult,
  StoryPremiseCandidate,
} from './types';
import { generatePremiseCandidates } from './premise-gen';
import { criticAttackPremise, passesEmotionalThreshold, scorePremiseCandidate } from './premise-score';
import { validatePremiseHardFails } from './premise-validator';

function diversityCluster(c: StoryPremiseCandidate): string {
  return c.premiseFamily ?? c.playSystem?.slice(0, 40) ?? c.id;
}

function selectTopThreeWithDiversity(
  scored: PremiseScoredCandidate[]
): PremiseScoredCandidate[] {
  const eligible = scored
    .filter((s) => !s.disqualified && s.weightedTotal != null)
    .sort((a, b) => (b.weightedTotal ?? 0) - (a.weightedTotal ?? 0));

  const picked: PremiseScoredCandidate[] = [];
  const clusters = new Set<string>();

  for (const s of eligible) {
    const cluster = diversityCluster(s.candidate);
    if (picked.length < 3 && !clusters.has(cluster)) {
      picked.push(s);
      clusters.add(cluster);
    }
    if (picked.length >= 3) break;
  }

  for (const s of eligible) {
    if (picked.length >= 3) break;
    if (!picked.includes(s)) picked.push(s);
  }

  return picked.slice(0, 3);
}

export async function runPremiseTournament(args: {
  spec: PremiseExperimentSpecV3;
  goldenPremises: GoldenPremiseRecord[];
  modelId: string;
  candidates?: StoryPremiseCandidate[];
}): Promise<PremiseTournamentResult> {
  const rawCandidates =
    args.candidates ??
    (await generatePremiseCandidates({
      spec: args.spec,
      goldenPremises: args.goldenPremises,
      modelId: args.modelId,
    }));

  const scored: PremiseScoredCandidate[] = [];

  for (const candidate of rawCandidates) {
    const hardFails = validatePremiseHardFails(candidate);
    const entry: PremiseScoredCandidate = {
      candidate,
      hardFails,
      disqualified: hardFails.length > 0,
    };

    if (!entry.disqualified) {
      console.log(`[v3] judge: ${candidate.id}`);
      const judged = await scorePremiseCandidate({
        candidate,
        goldenPremises: args.goldenPremises,
        modelId: args.modelId,
      });
      entry.scores = judged.scores;
      entry.weightedTotal = judged.weightedTotal;
      entry.judgeNotes = judged.notes;

      if (!passesEmotionalThreshold(judged.scores)) {
        entry.disqualified = true;
        entry.hardFails.push({
          code: 'emotional_alignment_below_threshold',
          message: `emotionalAlignment ${judged.scores.emotionalAlignment} < 6`,
        });
      }
    }

    scored.push(entry);
  }

  const topThree = selectTopThreeWithDiversity(scored);

  for (const entry of topThree) {
    if (!entry.disqualified) {
      entry.criticAttacks = await criticAttackPremise({
        candidate: entry.candidate,
        modelId: args.modelId,
      });
      entry.diversityCluster = diversityCluster(entry.candidate);
    }
  }

  const winner =
    topThree.find((t) => !t.disqualified) ??
    scored.find((s) => !s.disqualified) ??
    topThree[0] ??
    scored[0];

  const selectionReason = winner.disqualified
    ? `No candidate passed all gates; selected highest-scoring for human review (${winner.candidate.id}, score=${winner.weightedTotal ?? 'n/a'}, fails=${winner.hardFails.map((f) => f.code).join(', ')})`
    : `Top after diversity + critic: ${winner.candidate.id} (score=${winner.weightedTotal}, cluster=${diversityCluster(winner.candidate)})`;

  return {
    candidates: scored,
    topThree,
    selected: winner.candidate,
    selectionReason,
  };
}
