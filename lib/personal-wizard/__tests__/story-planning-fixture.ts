import type { AdventureSelection } from '../story-planning-contract';

/** Structurally valid synthetic evidence; emphatically not good-story proof. */
export function fixtureAdventureSelection(spreads = 8, factId = 'f_interest0001'): AdventureSelection {
  return {
    candidates: ['A', 'B'].map((id, i) => ({
      id: id as 'A' | 'B', curiosity: i ? 'Who erased the creature tracks?' : 'Who owns the flying letter?',
      childWant: i ? 'Find the creature who lost its tracks' : 'Deliver her drawing to a cloud',
      companionWant: i ? 'Leave a recognisable footprint' : 'Send a letter of her own',
      complication: i ? 'Tracks disappear before they can be followed' : 'The letter folds itself shut',
      discovery: i ? 'The creature is walking backwards' : 'The cloud cannot read unfolded pictures',
      childContribution: i ? 'Draws a path they can both follow' : 'Invents a fold that opens in the wind',
      payoff: i ? 'The creature and friends find their own tracks' : 'Both letters reach their readers',
      personalFactUses: [{ factId, contribution: 'The approved drawing interest changes the proposed action' }],
    })),
    contrast: { dimensions: ['childWant', 'complication', 'discovery', 'childContribution'], explanation: 'Different wants, discoveries and consequential child contributions, not different scenery' },
    selectedId: 'A', reason: 'A concise synthetic choice explanation, not proof that this is the better adventure',
    outlineChecks: {
      curiosity_and_stakes: { outcome: 'supported', evidenceSpreads: [1], note: 'The synthetic first beat starts a question; no literary acceptance' },
      causal_child_choices: { outcome: 'supported', evidenceSpreads: [3], note: 'The synthetic child choice changes events; no semantic entailment proof' },
      earned_payoff: { outcome: 'supported', evidenceSpreads: [spreads], note: 'The synthetic final beat refers to the goal; no creative acceptance' },
    },
  };
}
