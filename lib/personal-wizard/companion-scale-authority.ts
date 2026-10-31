import 'server-only';
import { getPersonalAddedCompanion } from './personal-companions';
import { COMPANION_SCALE_VERSION, standingScaleSchema, type StandingScale, type CompanionScaleAuthority } from './companion-scale';
/** Additive registry authority; old visual/menu records retain exactly their historical fields. */
export const REGISTRY_COMPANION_SCALE: Readonly<Record<string,StandingScale>> = Object.freeze({
  bunny_ometz:Object.freeze({standingHeightInChildHeights:Object.freeze({min:0.25,max:0.35})}),
});
export function companionScaleAuthority(companionId:string):CompanionScaleAuthority {
  const value=getPersonalAddedCompanion(companionId)?.scale ?? REGISTRY_COMPANION_SCALE[companionId],p=standingScaleSchema.safeParse(value);
  if(!p.success)throw Error('personal_storyboard_companion_scale_unavailable');
  return {version:COMPANION_SCALE_VERSION,companionId,scale:p.data};
}
