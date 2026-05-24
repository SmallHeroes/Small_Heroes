import type { VoiceFindingType } from './voice-schemas';
import { VoiceFamily } from './voice-schemas';
import type {
  HumanCalibrationNotes,
  HumanExpectedIssue,
} from './voice-calibration-types';
import { quoteOverlaps } from './voice-match-utils';

export interface FixtureCalibrationResult {
  storyId: string;
  findingCount: number;
  pageFindings: number;
  storyFindings: number;
  /** Non-optional expected findings matched. */
  matched: number;
  /** Optional expected findings matched (telemetry only). */
  matchedOptional: number;
  expectedCount: number;
  falsePositives: number;
  falseNegatives: number;
  falsePositiveDetails: Array<{ family: string; quote?: string }>;
  falseNegativeDetails: HumanExpectedIssue[];
}

export interface CalibrationStats {
  precision: number;
  recall: number;
  matched: number;
  falsePositives: number;
  falseNegatives: number;
}

export interface AxisCalibrationStats extends CalibrationStats {
  axis: string;
}

export interface FamilyCalibrationStats extends CalibrationStats {
  family: string;
}

function findingHaystack(finding: VoiceFindingType): string {
  return `${finding.quote ?? ''} ${finding.reason}`;
}

function findingMatchesExpected(
  finding: VoiceFindingType,
  expected: HumanExpectedIssue
): boolean {
  if (finding.family !== expected.family) return false;
  if (expected.scope && finding.scope !== expected.scope) return false;
  if (expected.page != null && finding.page !== expected.page) return false;
  if (expected.quoteContains) {
    if (!quoteOverlaps(findingHaystack(finding), expected.quoteContains)) {
      return false;
    }
  }
  return true;
}

function isExpectedNonFinding(
  finding: VoiceFindingType,
  notes: HumanCalibrationNotes
): boolean {
  for (const ok of notes.expectedNonFindings ?? []) {
    if (finding.family !== ok.family) continue;
    if (ok.quoteContains) {
      if (!quoteOverlaps(findingHaystack(finding), ok.quoteContains)) continue;
    }
    return true;
  }
  return false;
}

export function calibrateFixture(
  findings: VoiceFindingType[],
  human: HumanCalibrationNotes
): FixtureCalibrationResult {
  const expected = human.expectedFindings ?? [];
  const matchedRequired = new Set<number>();
  const matchedOptional = new Set<number>();
  const falsePositiveDetails: Array<{ family: string; quote?: string }> = [];

  for (const finding of findings) {
    let matched = false;
    for (let i = 0; i < expected.length; i++) {
      if (findingMatchesExpected(finding, expected[i])) {
        if (expected[i].optional) {
          matchedOptional.add(i);
        } else {
          matchedRequired.add(i);
        }
        matched = true;
        break;
      }
    }
    if (!matched && !isExpectedNonFinding(finding, human)) {
      falsePositiveDetails.push({ family: finding.family, quote: finding.quote });
    }
  }

  const falseNegativeDetails = expected.filter(
    (e, i) => !matchedRequired.has(i) && !e.optional
  );

  return {
    storyId: human.storyId,
    findingCount: findings.length,
    pageFindings: findings.filter((f) => f.scope === 'page').length,
    storyFindings: findings.filter((f) => f.scope === 'story').length,
    matched: matchedRequired.size,
    matchedOptional: matchedOptional.size,
    expectedCount: expected.filter((e) => !e.optional).length,
    falsePositives: falsePositiveDetails.length,
    falseNegatives: falseNegativeDetails.length,
    falsePositiveDetails,
    falseNegativeDetails,
  };
}

/** Drive calibration math from family id, not the LLM axis field. */
export function familyToAxis(family: string): string {
  const map: Record<string, string> = {
    therapeutic_abstract: 'voice',
    body_as_character: 'voice',
    ai_poetic: 'ai-smell',
    emotion_explained: 'voice',
    motif_overuse: 'voice',
    semantic_misuse: 'voice',
    read_aloud_stumble: 'read-aloud',
    mechanism_over_relationship: 'relationship',
    name_overuse: 'voice',
    parallel_action_chains: 'relationship',
    age_mismatch: 'age-fit',
  };
  return map[family] ?? 'voice';
}

const ALL_FAMILIES = VoiceFamily.options;

function summarizeByKey(
  fixtures: Array<{
    findings: VoiceFindingType[];
    human: HumanCalibrationNotes;
  }>,
  keyFn: (finding: VoiceFindingType) => string,
  expectedKeyFn: (exp: HumanExpectedIssue) => string
): Array<{ key: string } & CalibrationStats> {
  const stats: Record<string, { tp: number; fp: number; fn: number }> = {};

  for (const { findings, human } of fixtures) {
    for (const finding of findings) {
      const key = keyFn(finding);
      if (!stats[key]) stats[key] = { tp: 0, fp: 0, fn: 0 };
      const matchesHuman = human.expectedFindings.some((e) =>
        findingMatchesExpected(finding, e)
      );
      if (matchesHuman) stats[key].tp++;
      else if (!isExpectedNonFinding(finding, human)) stats[key].fp++;
    }
    for (const exp of human.expectedFindings) {
      if (exp.optional) continue;
      const key = expectedKeyFn(exp);
      if (!stats[key]) stats[key] = { tp: 0, fp: 0, fn: 0 };
      const hit = findings.some((f) => findingMatchesExpected(f, exp));
      if (!hit) stats[key].fn++;
    }
  }

  return Object.entries(stats).map(([key, { tp, fp, fn }]) => {
    const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 1;
    return {
      key,
      precision: Math.round(precision * 1000) / 10,
      recall: Math.round(recall * 1000) / 10,
      matched: tp,
      falsePositives: fp,
      falseNegatives: fn,
    };
  });
}

/** Per-axis precision/recall — axis derived from family only. */
export function summarizeAxisMetrics(
  fixtures: Array<{
    findings: VoiceFindingType[];
    result: FixtureCalibrationResult;
    human: HumanCalibrationNotes;
  }>
): AxisCalibrationStats[] {
  const axes = ['voice', 'ai-smell', 'read-aloud', 'relationship', 'age-fit'] as const;
  const raw = summarizeByKey(
    fixtures,
    (f) => familyToAxis(f.family),
    (e) => familyToAxis(e.family)
  );
  const byKey = new Map(raw.map((r) => [r.key, r]));

  return axes.map((axis) => {
    const row = byKey.get(axis);
    if (!row) {
      return {
        axis,
        precision: 100,
        recall: 100,
        matched: 0,
        falsePositives: 0,
        falseNegatives: 0,
      };
    }
    const { key: _k, ...stats } = row;
    return { axis, ...stats };
  });
}

/** Per-family precision/recall for all 11 families. */
export function summarizeFamilyMetrics(
  fixtures: Array<{
    findings: VoiceFindingType[];
    human: HumanCalibrationNotes;
  }>
): FamilyCalibrationStats[] {
  const raw = summarizeByKey(
    fixtures,
    (f) => f.family,
    (e) => e.family
  );
  const byKey = new Map(raw.map((r) => [r.key, r]));

  return ALL_FAMILIES.map((family) => {
    const row = byKey.get(family);
    if (!row) {
      return {
        family,
        precision: 100,
        recall: 100,
        matched: 0,
        falsePositives: 0,
        falseNegatives: 0,
      };
    }
    const { key: _k, ...stats } = row;
    return { family, ...stats };
  });
}

export function semanticMisuseKeystonePassed(
  findings: VoiceFindingType[],
  storyId: string
): boolean {
  if (storyId !== 'adventure_michal_run1') return true;
  return findings.some(
    (f) =>
      f.family === 'semantic_misuse' &&
      quoteOverlaps(findingHaystack(f), 'דוקדק')
  );
}

export function probeFixturePassed(
  findings: VoiceFindingType[],
  storyId: string,
  human: HumanCalibrationNotes
): boolean {
  const required = human.expectedFindings.filter((e) => !e.optional);
  if (required.length === 0) return true;
  return required.every((exp) =>
    findings.some((f) => findingMatchesExpected(f, exp))
  );
}
