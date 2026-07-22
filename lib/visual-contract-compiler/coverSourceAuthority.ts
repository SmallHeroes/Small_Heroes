import type { BookVisualContractTemplate } from './contractTemplateTypes';
import type { CoverContract, VisualZone } from './types';

export interface AuthoredCoverAuthority {
  /** Zone id in the author-owned location-bible vocabulary. */
  sourceZoneId: string;
  /** Positive cover content authored on page 0. */
  visibleAnchors: string[];
  /** Page-0 drift prohibitions, kept verbatim for reviewability. */
  forbiddenDrift: string[];
  /** Structured spoiler objects that must remain hidden on the cover. */
  hiddenObjects: string[];
  /** Stable cast ids derived from the explicit page-0 actors. */
  castIds: string[];
  pageAction?: string;
}

export type CoverSourceFidelityIssueCode =
  | 'cover_source_authority_invalid'
  | 'cover_source_zone_unmapped'
  | 'cover_source_zone_ambiguous'
  | 'cover_source_location_mismatch'
  | 'cover_source_zone_mismatch'
  | 'cover_source_cast_mismatch'
  | 'cover_source_must_show_mismatch'
  | 'cover_source_prohibition_missing'
  | 'cover_source_spoiler_contradiction';

export interface CoverSourceFidelityIssue {
  code: CoverSourceFidelityIssueCode;
  message: string;
  field?: string;
  expected?: unknown;
  actual?: unknown;
}

export class AuthoredCoverAuthorityError extends Error {
  constructor(readonly issues: CoverSourceFidelityIssue[]) {
    super(issues.map((candidate) => candidate.message).join('; '));
    this.name = 'AuthoredCoverAuthorityError';
  }
}

interface CompanionIdentity {
  id: string;
  name?: string;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(String).map((candidate) => candidate.trim()).filter(Boolean)
    : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((candidate) => candidate.trim()).filter(Boolean))];
}

function normalizedText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function companionIsExplicitlyPresent(
  positiveCoverText: string,
  companion: CompanionIdentity | null | undefined,
): boolean {
  if (!companion) return false;
  const text = normalizedText(positiveCoverText);
  if (!text) return false;
  const tokens = unique([
    'companion',
    companion.name ?? '',
    ...companion.id.split(/[^\p{L}\p{N}]+/gu),
  ])
    .map(normalizedText)
    .filter((candidate) => candidate.length >= 2);
  return tokens.some((candidate) => new RegExp(`(?:^|\\s)${escapeRegExp(candidate)}(?:$|\\s)`, 'u').test(text));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse the explicit page-0 authority from a location-bible object. No page 0 means no authored cover authority,
 * preserving compatibility for older sources. A present-but-malformed page 0 fails closed.
 */
export function authoredCoverAuthorityFromLocationBible(
  raw: unknown,
  companion?: CompanionIdentity | null,
): AuthoredCoverAuthority | null {
  const bible = asObject(raw);
  const pagePlans = Array.isArray(bible.pagePlans) ? bible.pagePlans.map(asObject) : [];
  const coverPlan = pagePlans.find((candidate) => Number(candidate.page) === 0);
  if (!coverPlan) return null;

  const sourceZoneId = typeof coverPlan.zoneId === 'string' ? coverPlan.zoneId.trim() : '';
  const allowedZoneIds = new Set(
    (Array.isArray(bible.allowedZones) ? bible.allowedZones : [])
      .map(asObject)
      .map((candidate) => (typeof candidate.id === 'string' ? candidate.id.trim() : ''))
      .filter(Boolean),
  );
  const issues: CoverSourceFidelityIssue[] = [];
  if (!sourceZoneId) {
    issues.push({
      code: 'cover_source_authority_invalid',
      message: 'authored page 0 has no source zoneId',
      field: 'locationBible.pagePlans[page=0].zoneId',
    });
  } else if (!allowedZoneIds.has(sourceZoneId)) {
    issues.push({
      code: 'cover_source_authority_invalid',
      message: `authored page-0 zone "${sourceZoneId}" is not declared in allowedZones`,
      field: 'locationBible.pagePlans[page=0].zoneId',
      expected: [...allowedZoneIds],
      actual: sourceZoneId,
    });
  }
  if (issues.length > 0) throw new AuthoredCoverAuthorityError(issues);

  const visibleAnchors = unique(stringArray(coverPlan.visibleAnchors));
  const forbiddenDrift = unique(stringArray(coverPlan.forbiddenDrift));
  const spoilerPolicy = asObject(coverPlan.visualSpoilerPolicy);
  const hiddenObjects = unique(stringArray(spoilerPolicy.hiddenObjects));
  const pageAction = typeof coverPlan.pageAction === 'string' && coverPlan.pageAction.trim()
    ? coverPlan.pageAction.trim()
    : undefined;
  const positiveText = [...visibleAnchors, pageAction ?? ''].join('\n');
  const castIds = ['child:hero'];
  if (companionIsExplicitlyPresent(positiveText, companion)) {
    castIds.push(`companion:${companion!.id.replace(/^companion:/, '')}`);
  }

  return {
    sourceZoneId,
    visibleAnchors,
    forbiddenDrift,
    hiddenObjects,
    castIds,
    ...(pageAction ? { pageAction } : {}),
  };
}

const TOPOLOGY_TOKEN_ALIASES: Record<string, string> = {
  bedroom: 'room',
  interior: 'room',
  indoors: 'room',
};
const TOPOLOGY_NOISE = new Set(['z', 'zone', 'area', 'spot']);

/** Stable ID-only cross-vocabulary key. It deliberately does not use prose similarity or an LLM. */
export function canonicalCoverZoneKey(value: string): string {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => TOPOLOGY_TOKEN_ALIASES[token] ?? token)
    .filter((token) => token && !TOPOLOGY_NOISE.has(token))
    .join('.');
}

export function resolveAuthoredCoverZone(
  authority: AuthoredCoverAuthority,
  zones: Array<Pick<VisualZone, 'id' | 'locationId'>>,
): { id: string; locationId: string } {
  const exact = zones.filter((zone) => zone.id === authority.sourceZoneId);
  if (exact.length === 1) return exact[0];

  const sourceKey = canonicalCoverZoneKey(authority.sourceZoneId);
  const candidates = zones.filter((zone) => canonicalCoverZoneKey(zone.id) === sourceKey);
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) {
    throw new AuthoredCoverAuthorityError([{
      code: 'cover_source_zone_unmapped',
      message: `authored cover zone "${authority.sourceZoneId}" has no deterministic contract-zone mapping`,
      field: 'coverContract.zoneId',
      expected: authority.sourceZoneId,
      actual: zones.map((zone) => zone.id),
    }]);
  }
  throw new AuthoredCoverAuthorityError([{
    code: 'cover_source_zone_ambiguous',
    message: `authored cover zone "${authority.sourceZoneId}" maps ambiguously to ${candidates.map((zone) => zone.id).join(', ')}`,
    field: 'coverContract.zoneId',
    expected: authority.sourceZoneId,
    actual: candidates.map((zone) => zone.id),
  }]);
}

function hiddenObjectHumanLabel(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function authoredCoverProhibitions(authority: AuthoredCoverAuthority): string[] {
  return unique([
    ...authority.forbiddenDrift,
    ...authority.hiddenObjects.map(hiddenObjectHumanLabel),
  ]);
}

const HIDDEN_OBJECT_NOISE = new Set(['object', 'source', 'visible', 'show', 'showing']);

function hiddenObjectConflictsWithPositiveText(hiddenObject: string, positiveText: string): boolean {
  const positiveTokens = new Set(normalizedText(positiveText).split(' ').filter(Boolean));
  const objectTokens = normalizedText(hiddenObject)
    .split(' ')
    .filter((token) => token.length >= 3 && !HIDDEN_OBJECT_NOISE.has(token));
  return objectTokens.some((token) => positiveTokens.has(token));
}

export function coverSourceFidelityIssues(
  template: BookVisualContractTemplate,
  authority: AuthoredCoverAuthority,
): CoverSourceFidelityIssue[] {
  let expectedZone: { id: string; locationId: string };
  try {
    expectedZone = resolveAuthoredCoverZone(authority, template.zones);
  } catch (error) {
    if (error instanceof AuthoredCoverAuthorityError) return error.issues;
    throw error;
  }

  const cover = template.coverContract;
  const issues: CoverSourceFidelityIssue[] = [];
  if (cover.locationId !== expectedZone.locationId) {
    issues.push({
      code: 'cover_source_location_mismatch',
      message: 'cover location contradicts authored page 0',
      field: 'coverContract.locationId',
      expected: expectedZone.locationId,
      actual: cover.locationId,
    });
  }
  if (cover.zoneId !== expectedZone.id) {
    issues.push({
      code: 'cover_source_zone_mismatch',
      message: 'cover zone contradicts authored page 0',
      field: 'coverContract.zoneId',
      expected: expectedZone.id,
      actual: cover.zoneId ?? null,
    });
  }
  if (JSON.stringify(cover.castIds ?? []) !== JSON.stringify(authority.castIds)) {
    issues.push({
      code: 'cover_source_cast_mismatch',
      message: 'cover cast contradicts authored page 0',
      field: 'coverContract.castIds',
      expected: authority.castIds,
      actual: cover.castIds ?? null,
    });
  }
  if (JSON.stringify(cover.mustShow ?? []) !== JSON.stringify(authority.visibleAnchors)) {
    issues.push({
      code: 'cover_source_must_show_mismatch',
      message: 'cover positive content contradicts authored page 0',
      field: 'coverContract.mustShow',
      expected: authority.visibleAnchors,
      actual: cover.mustShow ?? [],
    });
  }

  const actualProhibitions = new Set((cover.mustNotShow ?? []).map(normalizedText));
  const missingProhibitions = authoredCoverProhibitions(authority)
    .filter((candidate) => !actualProhibitions.has(normalizedText(candidate)));
  if (missingProhibitions.length > 0) {
    issues.push({
      code: 'cover_source_prohibition_missing',
      message: 'cover omits authored page-0 prohibitions',
      field: 'coverContract.mustNotShow',
      expected: missingProhibitions,
      actual: cover.mustNotShow ?? [],
    });
  }

  const spoilerMustShow = (cover.mustShow ?? []).filter((entry) =>
    authority.hiddenObjects.some((hiddenObject) => hiddenObjectConflictsWithPositiveText(hiddenObject, entry)),
  );
  if (spoilerMustShow.length > 0) {
    issues.push({
      code: 'cover_source_spoiler_contradiction',
      message: 'cover mustShow contains an object page 0 explicitly hides',
      field: 'coverContract.mustShow',
      expected: authority.hiddenObjects,
      actual: spoilerMustShow,
    });
  }
  return issues;
}

export function applyAuthoredCoverAuthority(args: {
  cover: Record<string, unknown>;
  zones: Array<Pick<VisualZone, 'id' | 'locationId'>>;
  authority: AuthoredCoverAuthority;
}): { cover: Record<string, unknown>; notes: string[] } {
  const zone = resolveAuthoredCoverZone(args.authority, args.zones);
  const previous = args.cover as Partial<CoverContract>;
  const mustShowSpoilers = args.authority.visibleAnchors.filter((entry) =>
    args.authority.hiddenObjects.some((hiddenObject) => hiddenObjectConflictsWithPositiveText(hiddenObject, entry)),
  );
  if (mustShowSpoilers.length > 0) {
    throw new AuthoredCoverAuthorityError([{
      code: 'cover_source_spoiler_contradiction',
      message: 'authored page 0 both requires and hides the same spoiler object',
      field: 'locationBible.pagePlans[page=0].visibleAnchors',
      expected: args.authority.hiddenObjects,
      actual: mustShowSpoilers,
    }]);
  }

  const notes: string[] = [];
  if (previous.locationId !== zone.locationId) {
    notes.push(`coverContract locationId ${JSON.stringify(previous.locationId ?? null)} overridden by authored page 0 to "${zone.locationId}"`);
  }
  if (previous.zoneId !== zone.id) {
    notes.push(`coverContract zoneId ${JSON.stringify(previous.zoneId ?? null)} overridden by authored page 0 to "${zone.id}"`);
  }
  if (JSON.stringify(previous.castIds ?? []) !== JSON.stringify(args.authority.castIds)) {
    notes.push('coverContract castIds overridden by authored page 0');
  }
  if (JSON.stringify(previous.mustShow ?? []) !== JSON.stringify(args.authority.visibleAnchors)) {
    notes.push('coverContract mustShow overridden by authored page-0 visibleAnchors');
  }

  return {
    cover: {
      ...args.cover,
      locationId: zone.locationId,
      zoneId: zone.id,
      castIds: [...args.authority.castIds],
      mustShow: [...args.authority.visibleAnchors],
      mustNotShow: unique([
        ...stringArray(args.cover.mustNotShow),
        ...authoredCoverProhibitions(args.authority),
      ]),
    },
    notes,
  };
}
