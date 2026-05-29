import { resolveStoryBankPlaceholders } from '@/lib/story-bank-personalization';
import type { PowerCardRenderInput } from './types';

export type PersonalizedPowerCardCopy = {
  title: string;
  subtitle: string;
  steps: [string, string, string, string];
  companionReminder: string;
};

function renderGenderForPersonalization(
  gender: PowerCardRenderInput['childGender']
): 'boy' | 'girl' {
  return gender === 'female' ? 'girl' : 'boy';
}

export function personalizePowerCardCopy(input: PowerCardRenderInput): PersonalizedPowerCardCopy {
  const ctx = {
    childName: input.childName,
    childGender: renderGenderForPersonalization(input.childGender),
    companionName: input.companionName,
  };

  return {
    title: resolveStoryBankPlaceholders(input.spec.title, ctx),
    subtitle: resolveStoryBankPlaceholders(input.spec.subtitle, ctx),
    steps: input.spec.steps.map(
      (step) => resolveStoryBankPlaceholders(step, ctx) as string
    ) as [string, string, string, string],
    companionReminder: resolveStoryBankPlaceholders(input.spec.companionReminder, ctx),
  };
}
