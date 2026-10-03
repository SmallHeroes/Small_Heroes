import { companionTrialCohort } from './personal-book-companion-cohort';

/** New fictional experiment inputs, never mutate the consumed paid cohort. */
export function causalTrialCohort() {
  const cases = structuredClone(companionTrialCohort());
  const sparse = cases[3].request;
  sparse.facts = sparse.facts.filter(f => f.kind === 'interest');
  sparse.noDifficulty = true; sparse.intent = { kind: 'just_for_fun' }; sparse.storyPlace = null;
  for (const index of [1, 4]) {
    const interest = cases[index].request.facts.find(f => f.kind === 'interest')!;
    interest.value = 'לקפל מטוסי נייר ולנסות איך הם עפים';
  }
  // Distinct supplied habits remain; no automatic hobby-to-superpower mapping.
  return cases;
}
