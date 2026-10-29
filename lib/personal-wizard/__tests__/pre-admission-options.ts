import { createHash } from 'node:crypto';
import type { PersonalWizardOptions } from '../options';

/** The options fingerprint before Momo's admission (2026-10-29): the six, computed from options.ts at a40677f4. */
export const PRE_ADMISSION_FINGERPRINT = 'f5ad4e9d849c971d05d60a72f3751cdcd4b03998a7c018a4865b0db1e56377ff';

/**
 * The offered menu exactly as it was before Momo's admission: the same options without him (back in "in preparation"), fingerprinted
 * by the same rule as options.ts. Used only to prove that a moved pin moved because the menu changed, never to build a real request.
 */
export function preAdmissionOptions(options: PersonalWizardOptions): PersonalWizardOptions {
  const momo = options.companions.find(c => c.id === 'elephant_momo');
  if (!momo) throw new Error('pre_admission_options_momo_not_offered');
  const companions = options.companions.filter(c => c !== momo);
  const fingerprint = createHash('sha256').update(JSON.stringify({ schema: 'personal-wizard-options/v2', companions, topics: options.topics,
    voices: options.voices.map(({ id, label }) => ({ id, label })), lengths: options.lengths })).digest('hex');
  return { ...options, companions, pendingCompanions: [momo, ...options.pendingCompanions], fingerprint };
}
