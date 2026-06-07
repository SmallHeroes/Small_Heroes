/**
 * Phase B scenario fields for outline + prose prompt assembly.
 */

import { BOLLY_ENGINE, BOLLY_REFRAINS } from './scenarios-bolly-armadillo';
import type { PhaseBScenario, Scenario } from './story-generation-types';

export function isPhaseBScenario(scenario: Scenario): scenario is PhaseBScenario {
  return (
    'qaLine' in scenario &&
    'engineUse' in scenario &&
    'comicBeat' in scenario &&
    'childAgency' in scenario
  );
}

function formatPhaseBExtensions(scenario: PhaseBScenario, companionId: string): string {
  const lines: string[] = [
    '',
    '=== Phase B scenario contract (locked) ===',
    `QA line (story MUST pass): ${scenario.qaLine}`,
    `Status: ${scenario.status}${scenario.validationOrder != null ? ` · validationOrder #${scenario.validationOrder}` : ''}`,
    `Trigger: ${scenario.trigger}`,
    `Child problem: ${scenario.childProblem}`,
    `Misread: ${scenario.misread}`,
    `Companion entry: ${scenario.companionEntry}`,
    `Engine / tool (show as action, never lecture): ${scenario.engineUse}`,
    `Child agency (child leads — never coax companion): ${scenario.childAgency}`,
    `Comic beat (REQUIRED — companion is a character): ${scenario.comicBeat}`,
    `Imagery: ${scenario.imagery}`,
    `Climax: ${scenario.climax}`,
    `Residue: ${scenario.residue}`,
    `Why fresh: ${scenario.whyThisIsFresh}`,
  ];

  if (scenario.antiPatternNotes) {
    lines.push(`Anti-pattern guard: ${scenario.antiPatternNotes}`);
  }
  if (scenario.forbiddenPatterns?.length) {
    lines.push(`Forbidden patterns: ${scenario.forbiddenPatterns.join(' · ')}`);
  }

  if (companionId === 'bolly_armadillo') {
    lines.push(`Companion engine: ${BOLLY_ENGINE}`);
    lines.push(`Signature refrains (may echo, not spam): ${BOLLY_REFRAINS.join(' · ')}`);
  }
  if (companionId === 'baby_elephant') {
    lines.push(
      'Companion core refrain (may echo): חצי אוזן. קול אחד. · Tool shown: כפות → נשיפה → אוזניים באמצע → קול אחד → השאר מעבר לחלון'
    );
  }

  lines.push('=== end Phase B contract ===');
  return lines.join('\n');
}

/** Scenario block for outline + prose prompts (Phase A base + Phase B extensions when present). */
export function formatScenarioPromptBlock(scenario: Scenario, companionId: string): string {
  const base = `
Scenario (locked — do not drift):
- id: ${scenario.id}
- setting: ${scenario.setting}
- inciting: ${scenario.incitingIncident}
- emotional core: ${scenario.emotionalCore}
- companion role: ${scenario.companionRole}
- agency transfer: ${scenario.agencyTransfer}
- climax: ${scenario.climaxShape}
- ending residue: ${scenario.endingResidue}
- distinctness: ${scenario.distinctnessNotes}
- direction: ${scenario.direction} (${scenario.beatCount} pages)
- category: ${scenario.category}
- title seed: ${scenario.titleSeed}`.trim();

  if (!isPhaseBScenario(scenario)) {
    return base;
  }
  return `${base}\n${formatPhaseBExtensions(scenario, companionId)}`;
}

/** Advisory metadata saved alongside generation runs (no LLM call). */
export function buildPhaseBAdvisoryReport(args: {
  scenario: Scenario;
  companionBlock: string;
}): Record<string, unknown> {
  const { scenario, companionBlock } = args;
  return {
    promptVersion: 'v5-story-gen-phase-b-plumbing',
    companionId: scenario.companionId,
    scenarioId: scenario.id,
    phaseB: isPhaseBScenario(scenario),
    scenarioPromptBlock: formatScenarioPromptBlock(scenario, scenario.companionId),
    companionContextPreview: companionBlock.slice(0, 2000),
    validationOrder: isPhaseBScenario(scenario) ? scenario.validationOrder : undefined,
    status: isPhaseBScenario(scenario) ? scenario.status : undefined,
  };
}
