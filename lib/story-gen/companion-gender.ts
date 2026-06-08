/**
 * Registered companion gender — bible first, then DeepProfile. Not hardcoded "all male".
 */

import { getCompanionBible } from '../companion-bible';
import { getDeepProfile } from '../companion-deep-profiles';

export type CompanionRegisteredGender = 'male' | 'female';

export function resolveCompanionGender(
  companionId: string
): CompanionRegisteredGender | null {
  const bible = getCompanionBible(companionId);
  if (bible?.gender) return bible.gender;

  const profile = getDeepProfile(companionId);
  if (profile.gender) return profile.gender;

  return null;
}

/** Hebrew name tokens used to detect companion-subject chips in prose. */
export function resolveCompanionNameMarkers(companionId: string): string[] {
  const names = new Set<string>();
  const bible = getCompanionBible(companionId);
  if (bible) {
    names.add(bible.canonicalName);
    names.add(bible.nameClean);
  }
  if (companionId === 'baby_elephant') {
    names.add('טוּבִּי');
    names.add('טובי');
  }
  if (companionId === 'bolly_armadillo') {
    names.add('בּוֹלִי');
    names.add('בולי');
  }
  return [...names].filter((n) => n.length >= 2);
}
