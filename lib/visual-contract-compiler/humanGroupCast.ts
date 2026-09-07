import { z } from 'zod';
import type { HumanGroupCastMember } from './types';
import { stripNiqqud } from './extractDeterministicFacts';

const text = z.string().min(1).max(240).refine(s => s === s.trim() && !/[\u0000-\u001f]/u.test(s));
const groupSchema = z.object({
  kind: z.literal('human_group'),
  id: z.string().regex(/^human-group:[a-z0-9][a-z0-9_-]{0,79}$/),
  role: text,
  aliases: z.array(text).min(1).max(16),
  textEvidence: z.string().min(1).max(128031).refine(s => s.trim().length > 0),
  pagesPresent: z.array(z.number().int().min(1).max(80)).min(1).max(80),
  cardinality: z.literal('multiple_unspecified'),
  membership: z.literal('same_ensemble_when_recurring'),
  appearancePolicy: z.literal('reviewed-human-ensemble/v1'),
}).strict();

/** The template/resolved extension is explicit; v4 must not silently gain groups. */
export function humanGroupSchemaIsSupported(input: { schemaVersion?: unknown; humanGroups?: unknown }): boolean {
  return input.schemaVersion === 'vc-schema/v4' ? input.humanGroups === undefined
    : input.schemaVersion === 'vc-schema/v5' && Array.isArray(input.humanGroups) && input.humanGroups.length > 0;
}

/** Pure validation before any projector can mistake malformed ensembles for people. */
export function humanGroupCastIssues(input: {
  humanGroups?: unknown;
  humanCast?: unknown;
  cast?: unknown;
  pageContracts?: unknown;
}): string[] {
  const invalidIndividualNamespace = Array.isArray(input.humanCast) && input.humanCast.some(member =>
    member && typeof member === 'object' && typeof member.id === 'string' && member.id.startsWith('human-group:'));
  const classificationErrors = invalidIndividualNamespace ? ['humanGroups must not be encoded as individual humanCast members'] : [];
  if (input.humanGroups === undefined) return classificationErrors;
  const parsed = z.array(groupSchema).min(1).max(80).safeParse(input.humanGroups);
  if (!parsed.success) return ['humanGroups must contain closed, source-reviewed human ensembles'];
  const errors: string[] = [...classificationErrors];
  const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const cast = object(input.cast);
  const individuals = [object(cast.child), object(cast.companion), ...(Array.isArray(input.humanCast) ? input.humanCast.map(object) : [])];
  const ids = new Set(individuals.map(member => member.id));
  const normalizeAlias = (alias: string) => stripNiqqud(alias).toLowerCase().trim().replace(/\s+/gu, ' ');
  const aliasOwners = new Set(individuals.flatMap(member => [member.name, ...(Array.isArray(member.aliases) ? member.aliases : [])]).filter((a): a is string => typeof a === 'string').map(normalizeAlias));
  const pages = Array.isArray(input.pageContracts) ? input.pageContracts.map(object) : [];
  for (const group of parsed.data) {
    if (ids.has(group.id)) errors.push(`humanGroups duplicate/colliding identity ${group.id}`);
    ids.add(group.id);
    if (new Set(group.pagesPresent).size !== group.pagesPresent.length) errors.push(`humanGroups ${group.id} duplicate presence`);
    for (const alias of group.aliases) {
      const key = normalizeAlias(alias);
      if (aliasOwners.has(key)) errors.push(`humanGroups ${group.id} colliding alias`);
      aliasOwners.add(key);
    }
    for (const page of group.pagesPresent) {
      if (!pages.some(p => p.pageNumber === page)) errors.push(`humanGroups ${group.id} unknown page ${page}`);
    }
    for (const page of pages) {
      const declared = Array.isArray(page.castIds) && page.castIds.includes(group.id);
      if (declared !== group.pagesPresent.includes(page.pageNumber as number)) {
        errors.push(`humanGroups ${group.id} page ${page.pageNumber} presence/castIds mismatch`);
      }
    }
  }
  return errors;
}

/** No count, sex, family traits or individual roster is inferred from a group. */
export function projectHumanGroup(group: HumanGroupCastMember): string {
  groupSchema.parse(group);
  return `${group.role} [${group.id}]: multiple distinct human members, not one person; exact headcount and gender unspecified. Preserve the same recognizable ensemble and established member appearances on recurring pages. Keep members distinct from the hero and companion; do not inherit the hero's family appearance.`;
}
