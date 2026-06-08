import { BOLLY_ADVENTURE_KILL_SWITCH_SCENARIO } from './scenarios-phase-a';
import { getBabyElephantScenario } from './scenarios-baby-elephant';
import { getBollyArmadilloScenario } from './scenarios-bolly-armadillo';
import { getDragonDiniScenario } from './scenarios-dragon-dini';
import type { PhaseBScenario, Scenario, StoryDirection } from './story-generation-types';

const PHASE_B_LOOKUP: Array<(id: string) => PhaseBScenario | undefined> = [
  getBabyElephantScenario,
  getBollyArmadilloScenario,
  getDragonDiniScenario,
];

export function resolveScenarioById(scenarioId: string): PhaseBScenario {
  for (const lookup of PHASE_B_LOOKUP) {
    const hit = lookup(scenarioId);
    if (hit) return hit;
  }
  throw new Error(
    `Unknown Phase B scenario id "${scenarioId}". Check scenarios-baby-elephant.ts / scenarios-bolly-armadillo.ts / scenarios-dragon-dini.ts.`
  );
}

/** Phase A default when no --scenario-id; Phase B when scenario-id is set. */
export function resolveScenario(args: {
  companionId: string;
  direction: StoryDirection;
  scenarioId?: string;
}): Scenario {
  if (args.scenarioId) {
    const scenario = resolveScenarioById(args.scenarioId);
    if (scenario.companionId !== args.companionId) {
      throw new Error(
        `Scenario ${args.scenarioId} is companionId=${scenario.companionId}, not ${args.companionId}`
      );
    }
    if (scenario.direction !== args.direction) {
      throw new Error(
        `Scenario ${args.scenarioId} is direction=${scenario.direction}, not ${args.direction}`
      );
    }
    if (scenario.status === 'reserve') {
      throw new Error(`Scenario ${args.scenarioId} is reserve — not for validation runs.`);
    }
    return scenario;
  }

  if (args.companionId === 'bolly_armadillo' && args.direction === 'adventure') {
    return BOLLY_ADVENTURE_KILL_SWITCH_SCENARIO;
  }

  throw new Error(
    `No default scenario for ${args.companionId}/${args.direction}. Pass --scenario-id for Phase B runs.`
  );
}
