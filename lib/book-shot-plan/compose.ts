import type { Style01CompositionSpec } from '../style01-gptimage';
import type { PageShot } from './types';

/** Map BookShotPlan slot → Style 01 COMPOSITION block spec. */
export function shotPlanToCompositionSpec(shot: PageShot): Style01CompositionSpec {
  const angle = shot.angle ?? 'eye';
  switch (shot.shot) {
    case 'establishing_wide':
      return {
        shotType: 'wide establishing',
        subjectScale: 'small',
        camera: `wide environmental ${angle} angle — place and relationship readable`,
        subjectDominance: 'environment-led; characters embedded in clinic/setting',
        staging: 'Full setting with breathing room; child and companion visible together',
        pagePurpose: 'Establish place and relationship',
        allowSmallChildForEstablishing: true,
      };
    case 'medium_wide':
      return {
        shotType: 'medium-wide establishing',
        subjectScale: 'small',
        camera: `medium-wide ${angle} angle — environment shares frame`,
        subjectDominance: 'Balanced character and setting; room context visible',
        staging: 'Characters in setting with clear spatial context',
        pagePurpose: 'Story beat with environmental readability',
        allowSmallChildForEstablishing: true,
      };
    case 'medium':
      return {
        shotType: 'medium story beat',
        subjectScale: 'medium',
        camera: `medium shot, ${angle} level`,
        subjectDominance: 'Balanced character and environment',
        staging: 'Action embedded in setting — nurse/clinic/objects legible',
        pagePurpose: 'Quiet transition or story advancement',
      };
    case 'intimate':
      return {
        shotType: 'intimate story beat',
        subjectScale: 'medium',
        camera: 'medium framing on emotional focus — surroundings still visible',
        subjectDominance: 'Child + companion share frame; intimacy without portrait crop',
        staging: 'Cozy shared moment; ceiling/walls/depth remain visible',
        pagePurpose: 'Emotional beat',
      };
    case 'close_up':
      return {
        shotType: 'close_up',
        subjectScale: 'medium',
        camera: 'tight storybook crop — child + companion hands/face/object together',
        subjectDominance: 'Shared intimacy frame; NOT isolated giant face portrait',
        staging: 'Tight crop allowed; companion or meaningful object in frame',
        pagePurpose: 'Emotional peak — quiet truth beat',
      };
    case 'dynamic_angle':
      return {
        shotType: 'dynamic action beat',
        subjectScale: 'medium',
        camera:
          angle === 'low'
            ? 'low angle — playful heroic energy in full setting'
            : angle === 'high'
              ? 'high angle — comic movement in environment'
              : 'dynamic angle — movement and staging in full scene',
        subjectDominance: 'Action energy with environment context',
        staging: 'Comedy/action staging — chair jump, shout, dance, or motion',
        pagePurpose: 'Action/comedy beat',
      };
    default:
      return {
        shotType: 'medium story beat',
        subjectScale: 'medium',
        camera: 'medium shot, eye-level',
        subjectDominance: 'Balanced character and environment',
        staging: 'Action embedded in setting',
        pagePurpose: 'Advance story moment',
      };
  }
}

export function pageShotUsesRelaxedBreathe(shot: PageShot | undefined): boolean {
  return shot?.shot === 'close_up' || shot?.shot === 'intimate';
}
