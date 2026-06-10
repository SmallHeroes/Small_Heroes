import { getCompanionById } from '@/lib/companions';

export type CompanionStructuredProfile = {
  species: string;
  size: string;
  coloring: string;
  feature: string;
};

export type CompanionLockSource = {
  visualDescription?: string;
  structured?: CompanionStructuredProfile;
  source: 'registry' | 'dna' | 'none';
};

/**
 * HORIZONTAL RULE (bunny forensics Gap 1):
 * For a companion that exists in the registry (lib/companions.ts), the
 * COMPANION LOCK text comes ONLY from the registry visualDescription.
 * LLM-derived DNA (companionDNA / companionStructured) is allowed ONLY for
 * non-registry dynamic entities (baby creatures, one-off story beings).
 *
 * Proven failure: bunny order cmq82b5f3 carried DNA lock text
 * "Stuffed rabbit toy... soft gray fur" that contradicted the canonical
 * cream-white living bunny — the prompt itself fought the companion identity.
 */
export function resolveCompanionLockSource(input: {
  companionId?: string | null;
  dnaStructured?: CompanionStructuredProfile | null;
  dnaVisualDescription?: string | null;
}): CompanionLockSource {
  const registry = input.companionId ? getCompanionById(input.companionId) : null;
  if (registry?.visualDescription?.trim()) {
    return {
      visualDescription: registry.visualDescription.trim(),
      structured: undefined,
      source: 'registry',
    };
  }
  if (input.dnaStructured?.species?.trim()) {
    return {
      visualDescription: input.dnaVisualDescription?.trim() || undefined,
      structured: input.dnaStructured,
      source: 'dna',
    };
  }
  if (input.dnaVisualDescription?.trim()) {
    return {
      visualDescription: input.dnaVisualDescription.trim(),
      structured: undefined,
      source: 'dna',
    };
  }
  return { source: 'none' };
}
