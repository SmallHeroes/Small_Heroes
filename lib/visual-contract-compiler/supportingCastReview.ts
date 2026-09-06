/** Source-bound review input, not product acceptance or render authority. */
import { z } from 'zod';
import { canonicalHash } from '@/lib/canonical-json';
import { companionPresenceTokens } from '@/lib/companion-presence-aliases';
import { RELATIVE_ROLES } from './contractTemplateTypes';
import {
  extractDeterministicFacts,
  stripNiqqud,
  type DeterministicFacts,
  type DeterministicFactsInput,
  type HumanFact,
} from './extractDeterministicFacts';

export const SUPPORTING_CAST_REVIEW_VERSION = 'supporting-cast-review/v1' as const;
export const SUPPORTING_CAST_APPEARANCE_POLICY_VERSION = 'reviewed-cast-appearance/v1' as const;
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const text = z.string().min(1).max(240).refine((s) => s === s.trim() && !/[\u0000-\u001f]/u.test(s));
const evidence = z.object({
  source: z.enum(['story', 'visual_direction']),
  pageNumber: z.number().int().min(1).max(80),
  quote: z.string().min(1).max(4000).refine((s) => s.trim().length > 0),
}).strict();
const evidenceList = z.array(evidence).min(1).max(32);
const common = {
  role: text,
  aliases: z.array(text).min(1).max(16),
  identityEvidence: evidenceList,
  presence: z.array(z.object({
    pageNumber: z.number().int().min(1).max(80),
    evidence: evidenceList,
  }).strict()).min(1).max(80),
};
const suffix = '[a-z0-9][a-z0-9_-]{0,79}';
const individual = z.object({
  ...common,
  kind: z.literal('human_individual'),
  id: z.string().regex(new RegExp(`^human:${suffix}$`)),
  gender: z.enum(['male', 'female', 'unspecified']),
  genderEvidence: z.array(evidence).max(32),
  appearanceClass: z.enum(['family_profile', 'reviewed_non_relative']),
  relationshipEvidence: z.array(evidence).max(32),
}).strict();
const group = z.object({
  ...common,
  kind: z.literal('human_group'),
  id: z.string().regex(new RegExp(`^human-group:${suffix}$`)),
  appearanceClass: z.literal('reviewed_human_ensemble'),
  membership: z.literal('same_ensemble_when_recurring'),
  cardinality: z.literal('multiple_unspecified'),
}).strict();
const nonHuman = z.object({
  ...common,
  kind: z.literal('non_human'),
  id: z.string().regex(new RegExp(`^non-human:${suffix}$`)),
  species: text,
}).strict();
const entriesSchema = z.array(z.discriminatedUnion('kind', [individual, group, nonHuman])).max(80);
const bindingSchema = z.object({
  storyKey: text,
  sourceSnapshotDigest: digest,
  acceptedRevisionDigest: digest,
  acceptedAuthorityDigest: digest,
  sourceDigest: digest,
  visualDirectionsSha256: digest,
  compilerInputDigest: digest,
}).strict();
const reviewSchema = z.object({
  version: z.literal(SUPPORTING_CAST_REVIEW_VERSION),
  status: z.literal('source_bound_review_required'),
  binding: bindingSchema,
  entries: entriesSchema,
  digestAlgorithm: z.literal('canonical-json-sha256'),
  digest,
}).strict();

export type SupportingCastEvidence = z.infer<typeof evidence>;
export type SupportingCastEntry = z.infer<typeof entriesSchema>[number];
export type SupportingCastReview = z.infer<typeof reviewSchema>;
export type SupportingCastSourceBinding = z.infer<typeof bindingSchema>;
export type SupportingCastCompilerInput = DeterministicFactsInput & {
  sourceIdentity: unknown;
  sourceEvidenceCatalog: unknown;
  fullStoryText: string;
  childName?: string;
};

/** Binds every input field, including optional current/future compiler fields. */
export function supportingCastCompilerInputDigest(input: SupportingCastCompilerInput): string {
  return canonicalHash(input);
}

function fail(code: string): never { throw new Error(`supporting_cast_${code}`); }
function normalizedAlias(value: string): string {
  return stripNiqqud(value).toLowerCase().trim().replace(/\s+/gu, ' ');
}
function containsAlias(quote: string, alias: string): boolean {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, 'u').test(quote);
}
function assertUnique(values: readonly (string | number)[], code: string): void {
  if (new Set(values).size !== values.length) fail(code);
}

function validateEntries(entries: SupportingCastEntry[], input: SupportingCastCompilerInput): void {
  assertUnique(input.pages.map((p) => p.pageNumber), 'source_page_duplicate');
  assertUnique((input.pageImageDirections ?? []).map((p) => p.pageNumber), 'direction_page_duplicate');
  const story = new Map(input.pages.map((p) => [p.pageNumber, p.text]));
  const directions = new Map((input.pageImageDirections ?? []).map((p) => [p.pageNumber, p.imageDirection]));
  const checkEvidence = (item: SupportingCastEvidence, page?: number): void => {
    if (!story.has(item.pageNumber) || (page !== undefined && item.pageNumber !== page)) fail('evidence_page_mismatch');
    const source = (item.source === 'story' ? story : directions).get(item.pageNumber);
    if (!source?.includes(item.quote)) fail('evidence_quote_mismatch');
  };
  assertUnique(entries.map((e) => e.id), 'identity_duplicate');
  const aliasOwners = new Map<string, string>();
  const protectedAliases = new Set([
    '{{childName}}', '{{companionName}}', input.childName ?? '',
    ...(input.companion ? companionPresenceTokens(input.companion.name ?? input.companion.id, input.companion.id) : []),
  ].filter(Boolean).map(normalizedAlias));
  for (const entry of entries) {
    if (entry.id === 'human:child' || entry.role === 'child' || entry.role === 'companion') fail('reserved_identity');
    assertUnique(entry.presence.map((p) => p.pageNumber), 'presence_duplicate');
    entry.identityEvidence.forEach((e) => checkEvidence(e));
    entry.presence.forEach((p) => p.evidence.forEach((e) => checkEvidence(e, p.pageNumber)));
    // Every asserted identity must also be present on its identity-evidence page.
    const pages = new Set(entry.presence.map((p) => p.pageNumber));
    if (entry.identityEvidence.some((e) => !pages.has(e.pageNumber))) fail('identity_presence_mismatch');
    const aliases = entry.aliases.map(normalizedAlias);
    if (aliases.some((alias) => protectedAliases.has(alias))) fail('reserved_alias');
    assertUnique(aliases, 'alias_duplicate');
    const quotes = [...entry.identityEvidence, ...entry.presence.flatMap((p) => p.evidence)].map((e) => normalizedAlias(e.quote));
    for (const alias of aliases) {
      if (!alias || !quotes.some((quote) => containsAlias(quote, alias))) fail('alias_not_evidenced');
      if (aliasOwners.has(alias)) fail('alias_collision');
      aliasOwners.set(alias, entry.id);
    }
    if (entry.kind === 'human_individual') {
      entry.genderEvidence.forEach((e) => checkEvidence(e));
      entry.relationshipEvidence.forEach((e) => checkEvidence(e));
      if (entry.gender !== 'unspecified' && entry.genderEvidence.length === 0) fail('gender_evidence_missing');
      const relative = (RELATIVE_ROLES as readonly string[]).includes(entry.role);
      const reservedRelativeId = (RELATIVE_ROLES as readonly string[]).find((role) => entry.id === `human:${role}`);
      if (reservedRelativeId && entry.role !== reservedRelativeId) fail('relative_identity_conflict');
      if ((entry.appearanceClass === 'family_profile') !== relative) fail('appearance_class_conflict');
      if (relative && entry.relationshipEvidence.length === 0) fail('relationship_evidence_missing');
    }
  }
}

export function buildSupportingCastReview(args: {
  binding: SupportingCastSourceBinding;
  input: SupportingCastCompilerInput;
  entries: unknown;
}): SupportingCastReview {
  const payload = {
    version: SUPPORTING_CAST_REVIEW_VERSION,
    status: 'source_bound_review_required' as const,
    binding: bindingSchema.parse(args.binding),
    entries: entriesSchema.parse(args.entries),
  };
  const review: SupportingCastReview = { ...payload, digestAlgorithm: 'canonical-json-sha256', digest: canonicalHash(payload) };
  assertSupportingCastReview(review, args.input);
  return review;
}

/** Digest integrity proves binding, not the truth/completeness of human review. */
export function assertSupportingCastReview(value: unknown, input: SupportingCastCompilerInput): asserts value is SupportingCastReview {
  const review = reviewSchema.parse(value);
  const { digest: expected, digestAlgorithm: _algorithm, ...payload } = review;
  if (canonicalHash(payload) !== expected) fail('review_digest_mismatch');
  if (review.binding.storyKey !== input.storyKey || review.binding.compilerInputDigest !== supportingCastCompilerInputDigest(input)) fail('source_binding_mismatch');
  validateEntries(review.entries, input);
}

/** Shared by compiler preview and future recovery; never infer cast from draft prose. */
export function supportingCastFacts(input: SupportingCastCompilerInput, review: SupportingCastReview): DeterministicFacts {
  assertSupportingCastReview(review, input);
  assertSupportingCastIndividualCompilerSupported(review);
  const facts = extractDeterministicFacts(input);
  const humans = structuredClone(facts.humans);
  for (const entry of review.entries) {
    const overlaps = humans.filter((h) => h.id === entry.id || h.aliasesFound.some((a) => entry.aliases.some((b) => normalizedAlias(a) === normalizedAlias(b))));
    if (overlaps.length > 1) fail('extractor_identity_ambiguous');
    const overlap = overlaps[0];
    if (entry.kind !== 'human_individual') {
      fail('compiler_classification_not_yet_supported');
    }
    const pages = entry.presence.map((p) => p.pageNumber).sort((a, b) => a - b);
    if (overlap && (overlap.id !== entry.id || overlap.role !== entry.role ||
        (overlap.gender !== 'unspecified' && overlap.gender !== entry.gender) ||
        overlap.pagesPresent.some((page) => !pages.includes(page)))) fail('extractor_conflict');
    const cited = entry.genderEvidence[0] ?? entry.identityEvidence[0]!;
    const human: HumanFact = {
      id: entry.id, role: entry.role, gender: entry.gender,
      genderConfidence: entry.gender === 'unspecified' ? 'low' : 'high',
      genderEvidence: { page: cited.pageNumber, phrase: cited.quote },
      aliasesFound: [...new Set([...(overlap?.aliasesFound ?? []), ...entry.aliases])],
      pagesPresent: pages, lowConfidencePages: [],
      reviewedAppearanceClass: entry.appearanceClass,
    };
    if (overlap) humans[humans.indexOf(overlap)] = human;
    else humans.push(human);
  }
  return { ...facts, humans };
}

/** M1a deliberately has no group/non-human schema migration or provider fallback. */
export function assertSupportingCastIndividualCompilerSupported(review: SupportingCastReview): void {
  if (review.entries.some((e) => e.kind !== 'human_individual')) fail('compiler_classification_not_yet_supported');
}
