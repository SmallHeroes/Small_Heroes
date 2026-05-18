import type { ValidationInput } from '@/lib/story-validators';
import { resolvePageCount } from '../data/direction-dna';
import type { GenerateInput, Plan } from '../types';

export function buildValidationContext(plan: Plan, input: GenerateInput): ValidationInput['context'] {
  const pageCount = resolvePageCount(input.direction, input.pageCount);
  return {
    companionId: input.companionId,
    direction: input.direction,
    pageCount,
    childName: input.childName,
    childGender: input.childGender,
    childAge: input.childAge,
    declared: {
      moment: {
        page: plan.momentContract.page,
        type: plan.momentContract.type,
        physicalAction: plan.momentContract.physicalAction,
        companionSignature: plan.momentContract.companionSignature,
      },
      hook: {
        sound: plan.hookContract.sound,
        phrase: plan.hookContract.phrase,
        microAction: plan.hookContract.microAction,
        object: plan.hookContract.object,
        appearsOnPages: plan.hookContract.appearsOnPages,
      },
    },
  };
}
