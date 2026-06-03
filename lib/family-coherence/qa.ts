import { pageHasHumanFamily, type DetectFamilyRolesInput } from './detect-roles';

export const FAMILY_COHERENCE_QA_PROMPT = `

FAMILY VISUAL COHERENCE (human family members only — when mother/father/newborn sibling appear):
Also return:
{
  "familyCoherenceOk": true ONLY if human parents/newborn belong to the SAME visual world as the child protagonist (skin-tone band coherent),
  "newbornNotDefaultPink": true ONLY if any newborn human has skin within the family tone (NOT unrelated pale-pink default),
  "recurringParentConsistent": true ONLY if the same mother/father would match earlier pages (same hair mass, skin band, age),
  "noHeroFaceCloneOnParent": true ONLY if parent faces are NOT copied from the child protagonist,
  "familyDefaultedWhite": true ONLY if CLEAR mismatch — darker/medium child with pale-white parents unrelated to child tone
}

FAIL family_coherence_failed if familyCoherenceOk is false OR newbornNotDefaultPink is false OR familyDefaultedWhite is true OR noHeroFaceCloneOnParent is false.
When no human parents/newborn in scene, set familyCoherenceOk and newbornNotDefaultPink to true.`;

export function familyCoherenceQaApplies(input: DetectFamilyRolesInput): boolean {
  return pageHasHumanFamily(input);
}

export function evaluateFamilyCoherenceFlags(raw: Record<string, unknown>): boolean {
  if (raw.familyDefaultedWhite === true) return false;
  if (raw.noHeroFaceCloneOnParent === false) return false;
  if (raw.newbornNotDefaultPink === false) return false;
  if (raw.familyCoherenceOk === false) return false;
  return true;
}
