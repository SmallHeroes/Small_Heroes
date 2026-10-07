import 'server-only';
import type { PersonalWizardOptions } from './options';
import { admitCurrentStoryEdit } from './story-editor';
import { admitCurrentSimpleStorySource } from './simple-story-source';

/** One current policy at preparation AND frame extraction. No archive or bare-result downgrade. */
export function admitCurrentStoryboardStory(request: unknown, result: unknown, options: PersonalWizardOptions) {
  if (result && typeof result === 'object' && 'simpleSource' in result) return admitCurrentSimpleStorySource(request, result, options);
  return admitCurrentStoryEdit(result);
}
