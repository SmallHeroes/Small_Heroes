import type { FamilyMemberRole } from './types';

export type DetectFamilyRolesInput = {
  bookPageText?: string | null;
  imageDirection?: string | null;
  rawScenePrompt?: string | null;
  pagePrompt?: string | null;
  staging?: string | null;
  presentEntityIds?: string[];
};

function textBlob(input: DetectFamilyRolesInput): string {
  return [
    input.imageDirection ?? '',
    input.rawScenePrompt ?? '',
    input.pagePrompt ?? '',
    input.bookPageText ?? '',
    input.staging ?? '',
  ]
    .join('\n')
    .toLowerCase();
}

const MOTHER =
  /\b(mother|mom|mum|ima|אמא|אימא|mommy|mama)\b|האמא|האימא/i;
const FATHER =
  /\b(father|dad|daddy|aba|אבא|abba|papa)\b|האבא/i;
const GRAND =
  /\b(grandmother|grandfather|grandma|grandpa|grandparent|סבתא|סבא)\b/i;
const OLDER_SIBLING =
  /\b(older sibling|big brother|big sister|אח\b|אחות\b)(?!.*תינוק)/i;
const BABY_HUMAN =
  /\b(baby sister|newborn baby|newborn human|tiny human baby|swaddled baby|תינוקת|אחות קטנה|baby in crib)\b/i;

/** HUMANS only — never Dini / baby_dragon. */
export function detectHumanFamilyRolesOnPage(
  input: DetectFamilyRolesInput
): FamilyMemberRole[] {
  const roles = new Set<FamilyMemberRole>();
  const text = textBlob(input);
  const entities = input.presentEntityIds ?? [];

  if (entities.includes('baby_sister') || BABY_HUMAN.test(text)) {
    roles.add('baby_sibling');
  }
  if (MOTHER.test(text)) {
    roles.add('mother');
    roles.add('parent_1');
  }
  if (FATHER.test(text)) {
    roles.add('father');
    roles.add('parent_2');
  }
  if (GRAND.test(text)) roles.add('grandparent');
  if (OLDER_SIBLING.test(text)) roles.add('sibling');

  // Deduplicate parent aliases for prompt (prefer specific roles)
  const out: FamilyMemberRole[] = [];
  if (roles.has('mother')) out.push('mother');
  else if (roles.has('parent_1')) out.push('parent_1');
  if (roles.has('father')) out.push('father');
  else if (roles.has('parent_2')) out.push('parent_2');
  if (roles.has('baby_sibling')) out.push('baby_sibling');
  if (roles.has('sibling')) out.push('sibling');
  if (roles.has('grandparent')) out.push('grandparent');
  return out;
}

export function pageHasHumanFamily(input: DetectFamilyRolesInput): boolean {
  return detectHumanFamilyRolesOnPage(input).length > 0;
}
