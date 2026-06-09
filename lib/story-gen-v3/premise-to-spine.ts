import type { PremiseExperimentSpecV3, StoryPremiseCandidate, StorySpineV3 } from './types';
import { POPCORN_TONE_GUARD } from './hardened-premise-p10';

export const KOKO_TRANSITION_TONE_GUARD = [
  'Warm, silly, safe — color camouflage comedy and new-place physical confusion.',
  'TRANSITION = crossing into unfamiliar place/state with a concrete object or doorway problem.',
  'No therapy lesson, no "new things are good" moral headline.',
  'קוֹקוֹ feminine fixed — no gender chips on Koko.',
].join(' ');

export function toneGuardForSpec(spec: PremiseExperimentSpecV3): string {
  if (spec.companionId === 'chameleon_koko') return KOKO_TRANSITION_TONE_GUARD;
  if (spec.companionId === 'dragon_dini') return POPCORN_TONE_GUARD;
  return 'Warm, silly, safe picture-book tone.';
}

export function hardenedPremiseToSpineFields(
  premise: StoryPremiseCandidate,
  spec: PremiseExperimentSpecV3
): StorySpineV3 {
  return {
    premiseId: premise.id,
    titleSeed: premise.titleSeed,
    oneLineHook: premise.oneLineHook,
    childWant: premise.childWant,
    hiddenResilienceTool: premise.hiddenResilienceTool,
    physicalProblem: premise.physicalProblem,
    playSystem: premise.playSystem,
    keyObjects: premise.keyObjects,
    companionWrongHelp: premise.companionWrongHelp,
    firstTryFail: `${premise.firstTry} ${premise.whyFirstTryFails}`,
    diniOverHelpAfterFirstFail: premise.companionWrongHelp || premise.whyFirstTryFails,
    secondTryFail: premise.escalation,
    childDiscovery: premise.childDiscovery,
    braveChildAction: premise.braveChildAction,
    bigReleasePayoff: premise.bigReleasePayoff,
    toneGuard: toneGuardForSpec(spec),
    oneSentenceEventChain: [
      premise.oneLineHook,
      premise.childWant,
      premise.firstTry,
      premise.escalation,
      premise.childDiscovery,
      premise.braveChildAction,
      premise.bigReleasePayoff,
    ].join(' → '),
  };
}
