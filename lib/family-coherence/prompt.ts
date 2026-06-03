import { detectHumanFamilyRolesOnPage, type DetectFamilyRolesInput } from './detect-roles';
import { lockTextForRole } from './member-locks';
import type { FamilyCoherenceBundle, FamilyMemberRole } from './types';

const PROFILE_HEADER = `FAMILY VISUAL COHERENCE (order-level — derived from hero photo-DNA + anchor, NOT re-invented per page):
- Hero child anchor is unchanged; these rules apply ONLY to human family members (parents, newborn sibling, grandparents).
- Coherence with natural variation — mixed/adoptive/single-parent families OK; do NOT assume genetic matching.
- NEVER default family to pale/pink when the hero’s profile is medium/deep tone.
- NEVER apply these rules to Dini, baby dragon, eggs, or any creature.`;

function uniqueRoles(roles: FamilyMemberRole[]): FamilyMemberRole[] {
  const seen = new Set<string>();
  const out: FamilyMemberRole[] = [];
  for (const r of roles) {
    const key =
      r === 'parent_1' ? 'mother' : r === 'parent_2' ? 'father' : r;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export function buildFamilyCoherencePromptBlock(
  bundle: FamilyCoherenceBundle | null | undefined,
  input: DetectFamilyRolesInput
): string {
  if (!bundle?.profile) return '';
  const roles = uniqueRoles(detectHumanFamilyRolesOnPage(input));
  if (roles.length === 0) return '';

  const parts: string[] = [
    PROFILE_HEADER,
    `Hero family skin-tone band: ${bundle.profile.skinTonePrompt}`,
    `Hero hair family: ${bundle.profile.hairTextureFamily} texture, ${bundle.profile.hairColorFamily} range.`,
    bundle.profile.glasses
      ? 'Hero wears glasses — a parent may share glasses naturally (optional, not all parents).'
      : '',
  ];

  for (const role of roles) {
    const lock = lockTextForRole(bundle.memberLocks, role);
    if (lock) parts.push(lock);
  }

  return parts.filter(Boolean).join('\n\n');
}

/** Replace static baby_sister lock with profile-derived lock when bundle present. */
export function applyFamilyCoherenceToEntityLocks(
  entityLocks: string,
  bundle: FamilyCoherenceBundle | null | undefined,
  input: DetectFamilyRolesInput
): string {
  if (!bundle) return entityLocks;
  const roles = detectHumanFamilyRolesOnPage(input);
  if (!roles.includes('baby_sibling')) return entityLocks;

  const babyLock = lockTextForRole(bundle.memberLocks, 'baby_sibling');
  if (!babyLock) return entityLocks;

  let out = entityLocks;
  if (out.includes('RECURRING ENTITY LOCK — BABY SISTER')) {
    out = out.replace(
      /RECURRING ENTITY LOCK — BABY SISTER[\s\S]*?(?=\n\nRECURRING|\n\nCOMPANION|$)/,
      `${babyLock}\n`
    );
  } else if (!out.includes('FAMILY MEMBER CONTINUITY LOCK — BABY SISTER')) {
    out = out ? `${out}\n\n${babyLock}` : babyLock;
  }
  return out;
}
