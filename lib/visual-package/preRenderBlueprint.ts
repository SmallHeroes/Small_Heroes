import { canonicalize } from '@/lib/canonical-json';
import {
  forbiddenPropIdsForPage,
  requiredPropIdsForPage,
} from '@/lib/visual-contract-compiler/propLifecycle';
import type {
  EntityRef,
  PageActionRequirement,
  PagePropConstraint,
  PageVisualContract,
  VisualZone,
} from '@/lib/visual-contract-compiler/types';
import type { BookVisualContractTemplate } from '@/lib/visual-contract-compiler/contractTemplateTypes';
import { validateBookVisualContractTemplate } from '@/lib/visual-contract-compiler/validateTemplateContract';
import { parseStorySourceContent } from '@/lib/visual-contract-compiler/storySourceContent';
import { isActionPredicate } from '@/lib/visual-contract-compiler/actionSemanticCatalog';

import { canonicalJsonDigest, normalizedTextDigest } from './integrity';
import {
  sourcePromptReconciliationIssues,
  type SourcePromptReconciliation,
} from './sourcePromptReconciliation';
import {
  PRE_RENDER_BLUEPRINT_AUTHORING_AUTHORITY_VERSION,
  PRE_RENDER_BLUEPRINT_COORDINATE_SPACE,
  PRE_RENDER_BLUEPRINT_DIGEST_ALGORITHM,
  PRE_RENDER_BLUEPRINT_PORTRAIT_ASPECT_RATIO,
  PRE_RENDER_BLUEPRINT_RECONCILIATION_DIGEST_ALGORITHM,
  PRE_RENDER_BOOK_VISUAL_BLUEPRINT_VERSION,
  InvalidPreRenderBookVisualBlueprintError,
  type BlueprintAffordanceConsumer,
  type BlueprintFramePlacement,
  type BlueprintRegion,
  type BlueprintSpatialAffordance,
  type BlueprintWorldConnection,
  type PortraitBlueprintFrame,
  type PreRenderBlueprintAuthoringAuthority,
  type PreRenderBlueprintIdentity,
  type PreRenderBlueprintIssue,
  type PreRenderBlueprintIssueCode,
  type PreRenderBlueprintReconciliationAuthority,
  type PreRenderBlueprintStyleAuthority,
  type PreRenderBlueprintValidationContext,
  type PreRenderBlueprintValidationResult,
  type PreRenderBookVisualBlueprint,
  type PreRenderBookVisualBlueprintDraft,
  type RevealSafeSupportingGeometry,
} from './preRenderBlueprintTypes';
import type {
  StorySourceIdentity,
  VisualPackageTemplateIdentity,
} from './types';

type Obj = Record<string, unknown>;

const NARRATIVE_PURPOSES = new Set([
  'cover_promise',
  'establish_world',
  'introduce_cast',
  'advance_action',
  'transition',
  'reveal',
  'emotional_turn',
  'resolution',
]);
const AFFORDANCE_KINDS = new Set([
  'traversal',
  'opening_clearance',
  'placement_support',
  'action_space',
  'camera_access',
  'safe_boundary',
]);
const CONNECTION_KINDS = new Set([
  'doorway',
  'opening',
  'threshold',
  'path',
  'portal',
  'continuous_space',
]);
const CAMERA_SHOTS = new Set(['wide', 'medium', 'close_up', 'over_shoulder', 'tracking']);
const CAMERA_ANGLES = new Set([
  'eye_level',
  'low_angle',
  'high_angle',
  'three_quarter',
  'overhead',
]);
const HEX_SHA256 = /^[a-f0-9]{64}$/;

function isObj(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStr(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function issue(
  code: PreRenderBlueprintIssueCode,
  message: string,
  extra: Omit<PreRenderBlueprintIssue, 'code' | 'message'> = {},
): PreRenderBlueprintIssue {
  return { code, message, ...extra };
}

function lexicalCompare(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function canonicalKey(value: unknown): string {
  return JSON.stringify(canonicalize(value)) ?? 'undefined';
}

function sameCanonical(left: unknown, right: unknown): boolean {
  return canonicalKey(left) === canonicalKey(right);
}

function sameStringSet(left: unknown, right: readonly string[]): boolean {
  if (!Array.isArray(left) || !left.every((entry) => typeof entry === 'string')) return false;
  const actual = [...left].sort(lexicalCompare);
  const expected = [...right].sort(lexicalCompare);
  return sameCanonical(actual, expected);
}

function entityRefKey(ref: EntityRef): string {
  return `${ref.kind}:${ref.id}`;
}

function entityRefEquals(left: unknown, right: unknown): boolean {
  return (
    isObj(left) &&
    isObj(right) &&
    isStr(left.kind) &&
    isStr(left.id) &&
    left.kind === right.kind &&
    left.id === right.id
  );
}

function normalizedClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeOwnedArrays(
  draft: PreRenderBookVisualBlueprintDraft,
): PreRenderBookVisualBlueprintDraft {
  const normalized = normalizedClone(draft);
  normalized.worldPlan.connections.sort((a, b) => lexicalCompare(a.id, b.id));
  normalized.worldPlan.affordances.sort((a, b) => lexicalCompare(a.id, b.id));
  normalized.worldPlan.revealSafeSupportingGeometry.sort((a, b) =>
    lexicalCompare(a.id, b.id),
  );
  normalized.frames.sort((a, b) => {
    if (a.kind === 'cover') return b.kind === 'cover' ? lexicalCompare(a.id, b.id) : -1;
    if (b.kind === 'cover') return 1;
    return a.pageNumber - b.pageNumber || lexicalCompare(a.id, b.id);
  });
  for (const connection of normalized.worldPlan.connections) {
    connection.traversalAffordanceIds.sort(lexicalCompare);
    connection.openingClearanceAffordanceIds.sort(lexicalCompare);
    connection.safeBoundaryAffordanceIds.sort(lexicalCompare);
  }
  for (const affordance of normalized.worldPlan.affordances) {
    affordance.consumers.sort((a, b) => lexicalCompare(canonicalKey(a), canonicalKey(b)));
    if (affordance.kind === 'placement_support' || affordance.kind === 'action_space') {
      affordance.supportedEntities.sort((a, b) =>
        lexicalCompare(entityRefKey(a), entityRefKey(b)),
      );
    }
    if (affordance.kind === 'action_space') {
      affordance.supportedPredicates.sort(lexicalCompare);
    }
  }
  for (const geometry of normalized.worldPlan.revealSafeSupportingGeometry) {
    geometry.supportsPropIds.sort(lexicalCompare);
  }
  for (const frame of normalized.frames) {
    frame.castIds.sort(lexicalCompare);
    frame.propLifecycle.requiredPropIds.sort(lexicalCompare);
    frame.propLifecycle.forbiddenPropIds.sort(lexicalCompare);
    frame.placements.sort((a, b) => lexicalCompare(a.id, b.id));
    frame.affordanceIds.sort(lexicalCompare);
    frame.continuity.carryoverRefs.sort((a, b) =>
      lexicalCompare(entityRefKey(a), entityRefKey(b)),
    );
  }
  return normalized;
}

function digestPayload(
  blueprint: PreRenderBookVisualBlueprint | PreRenderBookVisualBlueprintDraft,
): PreRenderBookVisualBlueprintDraft {
  const {
    digest: _digest,
    digestAlgorithm: _digestAlgorithm,
    ...payload
  } = blueprint as PreRenderBookVisualBlueprint;
  return payload;
}

/** Canonical JSON for durable artifact bytes. No clock, randomness, filesystem, or mutation. */
export function serializePreRenderBookVisualBlueprint(
  blueprint: PreRenderBookVisualBlueprint,
): string {
  return JSON.stringify(canonicalize(blueprint));
}

/** SHA-256 over canonical normalized blueprint content, excluding the self-referential digest fields. */
export function computePreRenderBookVisualBlueprintDigest(
  blueprint: PreRenderBookVisualBlueprint | PreRenderBookVisualBlueprintDraft,
): string {
  return canonicalJsonDigest(normalizeOwnedArrays(digestPayload(blueprint)));
}

/**
 * Deterministically normalize and stamp a draft. This is the only supported digest constructor;
 * callers cannot supply a digest that disagrees with content.
 */
export function finalizePreRenderBookVisualBlueprint(
  draft: PreRenderBookVisualBlueprintDraft,
): PreRenderBookVisualBlueprint {
  const normalized = normalizeOwnedArrays(draft);
  return {
    ...normalized,
    digestAlgorithm: PRE_RENDER_BLUEPRINT_DIGEST_ALGORITHM,
    digest: computePreRenderBookVisualBlueprintDigest(normalized),
  };
}

export function projectPreRenderBlueprintReconciliationSemanticContent(
  reconciliation: SourcePromptReconciliation,
): unknown {
  const { review: _review, ...stable } = normalizedClone(reconciliation);
  return {
    ...stable,
    frames: Array.isArray(stable.frames)
      ? stable.frames.map((frame) => ({
          ...frame,
          sourceRequirements: Array.isArray(frame.sourceRequirements)
            ? frame.sourceRequirements.map((requirement) => ({
                ...requirement,
                visualBeats: Array.isArray(requirement.visualBeats)
                  ? requirement.visualBeats.map((beat) => {
                      const {
                        supersessionReview: _supersessionReview,
                        ...stableBeat
                      } = beat;
                      return stableBeat;
                    })
                  : requirement.visualBeats,
              }))
            : frame.sourceRequirements,
        }))
      : stable.frames,
  };
}

/** Stable semantic reconciliation digest; review identities, state, and timestamps are deliberately excluded. */
export function computePreRenderBlueprintReconciliationDigest(
  reconciliation: SourcePromptReconciliation,
): string {
  return canonicalJsonDigest(
    projectPreRenderBlueprintReconciliationSemanticContent(reconciliation),
  );
}

export function buildPreRenderBlueprintReconciliationAuthority(args: {
  artifactPath: string;
  reconciliation: SourcePromptReconciliation;
}): PreRenderBlueprintReconciliationAuthority {
  return {
    artifactPath: args.artifactPath,
    digestAlgorithm: PRE_RENDER_BLUEPRINT_RECONCILIATION_DIGEST_ALGORITHM,
    digest: computePreRenderBlueprintReconciliationDigest(args.reconciliation),
    version: args.reconciliation.version,
    projectionVersion: args.reconciliation.projectionVersion,
  };
}

function authoringAuthorityDigestPayload(
  authority: Omit<
    PreRenderBlueprintAuthoringAuthority,
    'digestAlgorithm' | 'digest'
  >,
): Omit<PreRenderBlueprintAuthoringAuthority, 'digestAlgorithm' | 'digest'> {
  return normalizedClone(authority);
}

export function computePreRenderBlueprintAuthoringAuthorityDigest(
  authority:
    | PreRenderBlueprintAuthoringAuthority
    | Omit<PreRenderBlueprintAuthoringAuthority, 'digestAlgorithm' | 'digest'>,
): string {
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = authority as PreRenderBlueprintAuthoringAuthority;
  return canonicalJsonDigest(authoringAuthorityDigestPayload(payload));
}

export function buildPreRenderBlueprintAuthoringAuthority(args: {
  storyKey: string;
  source: StorySourceIdentity;
  template: VisualPackageTemplateIdentity;
  reconciliation: SourcePromptReconciliation;
  reconciliationArtifactPath: string;
  style: PreRenderBlueprintStyleAuthority;
}): PreRenderBlueprintAuthoringAuthority {
  const payload = {
    version: PRE_RENDER_BLUEPRINT_AUTHORING_AUTHORITY_VERSION,
    storyKey: args.storyKey,
    styleId: args.style.styleId,
    source: normalizedClone(args.source),
    visualContract: normalizedClone(args.template),
    reconciliation: buildPreRenderBlueprintReconciliationAuthority({
      artifactPath: args.reconciliationArtifactPath,
      reconciliation: args.reconciliation,
    }),
    style: normalizedClone(args.style),
  } satisfies Omit<
    PreRenderBlueprintAuthoringAuthority,
    'digestAlgorithm' | 'digest'
  >;
  return {
    ...payload,
    digestAlgorithm: PRE_RENDER_BLUEPRINT_DIGEST_ALGORITHM,
    digest: computePreRenderBlueprintAuthoringAuthorityDigest(payload),
  };
}

export function buildPreRenderBlueprintIdentity(args: {
  authority: PreRenderBlueprintAuthoringAuthority;
}): PreRenderBlueprintIdentity {
  return {
    storyKey: args.authority.storyKey,
    styleId: args.authority.styleId,
    authoringAuthority: normalizedClone(args.authority),
  };
}

function regionIsValid(value: unknown): value is BlueprintRegion {
  if (!isObj(value)) return false;
  const values = [value.x, value.y, value.width, value.height];
  if (!values.every((entry) => typeof entry === 'number' && Number.isInteger(entry))) return false;
  const { x, y, width, height } = value as unknown as BlueprintRegion;
  return (
    x >= 0 &&
    y >= 0 &&
    width > 0 &&
    height > 0 &&
    x + width <= 1000 &&
    y + height <= 1000
  );
}

function regionContains(container: BlueprintRegion, inner: BlueprintRegion): boolean {
  return (
    inner.x >= container.x &&
    inner.y >= container.y &&
    inner.x + inner.width <= container.x + container.width &&
    inner.y + inner.height <= container.y + container.height
  );
}

function regionsOverlap(left: BlueprintRegion, right: BlueprintRegion): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function regionMinimumDimension(region: BlueprintRegion): number {
  return Math.min(region.width, region.height);
}

function addRegionIssue(
  issues: PreRenderBlueprintIssue[],
  value: unknown,
  field: string,
): value is BlueprintRegion {
  if (regionIsValid(value)) return true;
  issues.push(
    issue(
      'region_invalid',
      'region must use integer normalized-1000 coordinates with positive size inside 0..1000',
      { field, actual: value },
    ),
  );
  return false;
}

interface ContractIndex {
  locations: Map<string, BookVisualContractTemplate['locations'][number]>;
  zones: Map<string, VisualZone>;
  props: Map<string, BookVisualContractTemplate['recurringProps'][number]>;
  castIds: Set<string>;
  pages: Map<number, PageVisualContract>;
}

function durableRecurringProps(
  template: BookVisualContractTemplate,
): BookVisualContractTemplate['recurringProps'] {
  if (!Array.isArray(template.recurringProps)) return [];
  return template.recurringProps.filter(
    (entry) =>
      isObj(entry) &&
      isStr(entry.id) &&
      isStr(entry.name),
  ) as BookVisualContractTemplate['recurringProps'];
}

function recurringPropsAreIndexable(template: BookVisualContractTemplate): boolean {
  return (
    Array.isArray(template.recurringProps) &&
    template.recurringProps.every(
      (entry) =>
        isObj(entry) &&
        isStr(entry.id) &&
        isStr(entry.name),
    )
  );
}

function buildContractIndex(template: BookVisualContractTemplate): ContractIndex {
  const castIds = new Set<string>([template.cast.child.id]);
  if (template.cast.companion) castIds.add(template.cast.companion.id);
  for (const member of template.humanCast) castIds.add(member.id);
  return {
    locations: new Map(template.locations.map((entry) => [entry.id, entry])),
    zones: new Map(template.zones.map((entry) => [entry.id, entry])),
    // Defense in depth: this function indexes durable input. The canonical Template validator rejects malformed
    // recurringProps before this path, but indexing remains non-throwing if that upstream contract changes.
    props: new Map(durableRecurringProps(template).map((entry) => [entry.id, entry])),
    castIds,
    pages: new Map(template.pageContracts.map((entry) => [entry.pageNumber, entry])),
  };
}

function entityRefResolves(
  ref: unknown,
  zoneId: string,
  index: ContractIndex,
): ref is EntityRef {
  if (!isObj(ref) || !isStr(ref.kind) || !isStr(ref.id)) return false;
  switch (ref.kind) {
    case 'cast':
      return index.castIds.has(ref.id);
    case 'prop':
      return index.props.has(ref.id);
    case 'spatial':
      return Boolean(index.zones.get(zoneId)?.spatialNodes?.some((node) => node.id === ref.id));
    case 'anchor': {
      const zone = index.zones.get(zoneId);
      if (!zone) return false;
      return Boolean(index.locations.get(zone.locationId)?.anchors?.some((anchor) => anchor.id === ref.id));
    }
    default:
      return false;
  }
}

type BlueprintTraversalDirection = 'forward' | 'reverse';

function connectionTransitionDirection(
  connection: BlueprintWorldConnection,
  fromZoneId: string,
  toZoneId: string,
): BlueprintTraversalDirection | null {
  if (connection.from?.zoneId === fromZoneId && connection.to?.zoneId === toZoneId) {
    return 'forward';
  }
  if (
    connection.bidirectional &&
    connection.from?.zoneId === toZoneId &&
    connection.to?.zoneId === fromZoneId
  ) {
    return 'reverse';
  }
  return null;
}

function traversalSupportsDirection(
  affordance: Extract<BlueprintSpatialAffordance, { kind: 'traversal' }>,
  direction: BlueprintTraversalDirection,
): boolean {
  return affordance.direction === 'both' || affordance.direction === direction;
}

function consumerEquals(left: BlueprintAffordanceConsumer, right: BlueprintAffordanceConsumer): boolean {
  return sameCanonical(left, right);
}

function hasConsumer(
  affordance: BlueprintSpatialAffordance,
  expected: BlueprintAffordanceConsumer,
): boolean {
  return (
    Array.isArray(affordance.consumers) &&
    affordance.consumers.some((consumer) => consumerEquals(consumer, expected))
  );
}

const GENERIC_PROP_ID_NAMESPACES = new Set([
  'prop',
  'props',
  'item',
  'object',
  'recurring',
]);

function semanticTokens(value: string): string[] {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .match(
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]|[\p{L}\p{N}]+/gu,
    ) ?? [];
}

function semanticPropTerms(propId: string, propName: string): string[][] {
  const idTokens = semanticTokens(propId);
  while (idTokens.length > 1 && GENERIC_PROP_ID_NAMESPACES.has(idTokens[0])) {
    idTokens.shift();
  }
  const nameTokens = semanticTokens(propName);
  const terms = [idTokens, nameTokens].filter((tokens) => tokens.length > 0);
  return terms.filter(
    (tokens, index) =>
      terms.findIndex(
        (candidate) =>
          canonicalKey([...candidate].sort(lexicalCompare)) ===
          canonicalKey([...tokens].sort(lexicalCompare)),
      ) === index,
  );
}

function textContainsTerm(text: string, term: string[]): boolean {
  const tokens = semanticTokens(text);
  if (term.length === 0 || tokens.length < term.length) return false;
  const available = new Map<string, number>();
  for (const token of tokens) {
    available.set(token, (available.get(token) ?? 0) + 1);
  }
  const required = new Map<string, number>();
  for (const token of term) {
    required.set(token, (required.get(token) ?? 0) + 1);
  }
  return [...required].every(
    ([token, count]) => (available.get(token) ?? 0) >= count,
  );
}

function frameNumber(frame: PortraitBlueprintFrame): number {
  return frame.kind === 'cover' ? 0 : frame.pageNumber;
}

function expectedPreviousFrameId(
  frame: PortraitBlueprintFrame,
  sourcePages: readonly number[],
): string | null {
  if (frame.kind === 'cover') return null;
  const index = sourcePages.indexOf(frame.pageNumber);
  if (index <= 0) return 'frame:cover';
  return `frame:page:${sourcePages[index - 1]}`;
}

function framePlacementForCast(
  placements: readonly BlueprintFramePlacement[],
  castId: string,
): BlueprintFramePlacement | null {
  return (
    placements.find(
      (placement) => placement.subject.kind === 'cast' && placement.subject.castId === castId,
    ) ?? null
  );
}

function framePlacementForProp(
  placements: readonly BlueprintFramePlacement[],
  propId: string,
): BlueprintFramePlacement | null {
  return (
    placements.find(
      (placement) => placement.subject.kind === 'prop' && placement.subject.propId === propId,
    ) ?? null
  );
}

function framePlacementForAction(
  placements: readonly BlueprintFramePlacement[],
  checkId: string,
): BlueprintFramePlacement | null {
  return (
    placements.find(
      (placement) => placement.subject.kind === 'action' && placement.subject.checkId === checkId,
    ) ?? null
  );
}

function expectedPropLifecycle(
  template: BookVisualContractTemplate,
  frame: PortraitBlueprintFrame,
): { required: string[]; forbidden: string[] } {
  if (frame.kind === 'cover') {
    return {
      required: [],
      forbidden: durableRecurringProps(template)
        .filter((prop) => prop.firstRevealPage !== undefined)
        .map((prop) => prop.id)
        .sort(),
    };
  }
  const page = template.pageContracts.find((entry) => entry.pageNumber === frame.pageNumber);
  return {
    required: page ? requiredPropIdsForPage(template, page.pageNumber).sort() : [],
    forbidden: page ? forbiddenPropIdsForPage(template, page.pageNumber).sort() : [],
  };
}

function validateIdentity(
  raw: Obj,
  blueprint: PreRenderBookVisualBlueprint,
  context: PreRenderBlueprintValidationContext,
  issues: PreRenderBlueprintIssue[],
): void {
  if (!isObj(raw.identity)) {
    issues.push(issue('schema_invalid', 'identity must be an object', { field: 'identity' }));
    return;
  }
  const identityRaw = raw.identity;
  const authorityRaw = isObj(identityRaw.authoringAuthority)
    ? identityRaw.authoringAuthority
    : null;
  if (!authorityRaw) {
    issues.push(issue('schema_invalid', 'identity.authoringAuthority must be an object', {
      field: 'identity.authoringAuthority',
    }));
    return;
  }

  const contextTemplateDigest = canonicalJsonDigest(context.template);
  const embeddedTemplateDigest = canonicalJsonDigest(blueprint.visualContract);
  const contextStoryKey = isStr(context.template.storyKey)
    ? context.template.storyKey
    : '';
  const expectedAuthority = buildPreRenderBlueprintAuthoringAuthority({
    storyKey: contextStoryKey,
    source: context.source,
    template: context.templateIdentity,
    reconciliation: context.reconciliation,
    reconciliationArtifactPath: context.reconciliationArtifactPath,
    style: context.style,
  });

  if (
    identityRaw.storyKey !== contextStoryKey ||
    identityRaw.storyKey !== blueprint.visualContract.storyKey ||
    identityRaw.styleId !== context.style.styleId ||
    authorityRaw.storyKey !== contextStoryKey ||
    authorityRaw.styleId !== context.style.styleId
  ) {
    issues.push(
      issue('identity_mismatch', 'story/style identities disagree across Blueprint authoring inputs', {
        field: 'identity',
      }),
    );
  }

  let parsedSourceIdentityIsCurrent = false;
  try {
    const parsed = parseStorySourceContent(context.rawStorySource);
    parsedSourceIdentityIsCurrent =
      context.source.digest === normalizedTextDigest(context.rawStorySource) &&
      context.source.pageCount === parsed.pages.length &&
      sameCanonical(
        context.source.pageNumbers,
        parsed.pages.map((page) => page.pageNumber),
      );
  } catch {
    parsedSourceIdentityIsCurrent = false;
  }
  if (
    !parsedSourceIdentityIsCurrent ||
    !isObj(authorityRaw.source) ||
    !sameCanonical(authorityRaw.source, context.source)
  ) {
    issues.push(
      issue('source_stale', 'blueprint Story Source identity is not the current authoritative source', {
        field: 'identity.authoringAuthority.source',
        expected: context.source,
        actual: authorityRaw.source,
      }),
    );
  }

  if (
    !isObj(authorityRaw.visualContract) ||
    !sameCanonical(authorityRaw.visualContract, context.templateIdentity) ||
    context.templateIdentity.digest !== contextTemplateDigest ||
    embeddedTemplateDigest !== contextTemplateDigest
  ) {
    issues.push(
      issue('template_stale', 'blueprint Visual Contract identity/content is not current', {
        field: 'identity.authoringAuthority.visualContract',
        expected: {
          identity: context.templateIdentity,
          digest: contextTemplateDigest,
        },
        actual: {
          identity: authorityRaw.visualContract,
          embeddedDigest: embeddedTemplateDigest,
        },
      }),
    );
  }

  const reconciliationIssues = sourcePromptReconciliationIssues({
    raw: context.reconciliation,
    storyKey: contextStoryKey,
    sourceIdentity: context.source,
    rawStorySource: context.rawStorySource,
    template: context.template,
    templateDigest: contextTemplateDigest,
    authoredCoverAuthority: context.authoredCoverAuthority,
    requireComplete: true,
  });
  for (const reconciliationIssue of reconciliationIssues) {
    const code: PreRenderBlueprintIssueCode =
      /unresolved/i.test(reconciliationIssue.message)
        ? 'reconciliation_unresolved'
        : reconciliationIssue.field === 'review' ||
            /human review|supersession lacks valid.*review/i.test(reconciliationIssue.message)
          ? 'reconciliation_unapproved'
          : 'reconciliation_stale';
    issues.push(
      issue(code, reconciliationIssue.message, {
        field: reconciliationIssue.field ?? 'identity.authoringAuthority.reconciliation',
        expected: reconciliationIssue.expected,
        actual: reconciliationIssue.actual,
      }),
    );
  }
  if (
    !isObj(authorityRaw.reconciliation) ||
    !sameCanonical(authorityRaw.reconciliation, expectedAuthority.reconciliation)
  ) {
    issues.push(
      issue('reconciliation_stale', 'blueprint reconciliation semantic authority changed', {
        field: 'identity.authoringAuthority.reconciliation',
        expected: expectedAuthority.reconciliation,
        actual: authorityRaw.reconciliation,
      }),
    );
  }

  if (
    !isObj(authorityRaw.style) ||
    !sameCanonical(authorityRaw.style, context.style) ||
    canonicalJsonDigest(context.styleContent) !== context.style.digest
  ) {
    issues.push(
      issue('style_stale', 'blueprint style identity/content digest changed', {
        field: 'identity.authoringAuthority.style',
        expected: context.style,
        actual: authorityRaw.style,
      }),
    );
  }

  if (
    authorityRaw.version !== PRE_RENDER_BLUEPRINT_AUTHORING_AUTHORITY_VERSION ||
    authorityRaw.digestAlgorithm !== PRE_RENDER_BLUEPRINT_DIGEST_ALGORITHM ||
    !isStr(authorityRaw.digest) ||
    !HEX_SHA256.test(authorityRaw.digest)
  ) {
    issues.push(
      issue('schema_invalid', 'authoring authority version/digest metadata is invalid', {
        field: 'identity.authoringAuthority',
      }),
    );
  } else {
    const computedAuthorityDigest =
      computePreRenderBlueprintAuthoringAuthorityDigest(
        authorityRaw as unknown as PreRenderBlueprintAuthoringAuthority,
      );
    if (authorityRaw.digest !== computedAuthorityDigest) {
      issues.push(
        issue(
          'authoring_authority_mismatch',
          'authoring authority content does not match its digest',
          {
            field: 'identity.authoringAuthority.digest',
            expected: computedAuthorityDigest,
            actual: authorityRaw.digest,
          },
        ),
      );
    }
  }

  if (!sameCanonical(authorityRaw, expectedAuthority)) {
    issues.push(
      issue('authoring_authority_mismatch', 'blueprint authoring authority is not the current stable authority', {
        field: 'identity.authoringAuthority',
        expected: expectedAuthority,
        actual: authorityRaw,
      }),
    );
  }

  const requiredDigests = [
    context.source.digest,
    context.templateIdentity.digest,
    context.style.digest,
    expectedAuthority.reconciliation.digest,
    expectedAuthority.digest,
  ];
  if (!requiredDigests.every((digest) => HEX_SHA256.test(digest))) {
    issues.push(
      issue('schema_invalid', 'source/contract/reconciliation/style/authority digests must be lowercase SHA-256 hex', {
        field: 'identity.authoringAuthority',
      }),
    );
  }
}

function validateAffordanceShape(
  affordance: BlueprintSpatialAffordance,
  field: string,
  index: ContractIndex,
  issues: PreRenderBlueprintIssue[],
): void {
  if (!isStr(affordance.id) || !isStr(affordance.zoneId) || !AFFORDANCE_KINDS.has(affordance.kind)) {
    issues.push(issue('schema_invalid', 'affordance id/zoneId/kind is invalid', { field }));
    return;
  }
  if (!index.zones.has(affordance.zoneId)) {
    issues.push(
      issue('reference_unresolved', `affordance zone "${affordance.zoneId}" is not declared`, {
        field: `${field}.zoneId`,
      }),
    );
  }
  addRegionIssue(issues, affordance.footprint, `${field}.footprint`);
  if (!Array.isArray(affordance.consumers) || affordance.consumers.length === 0) {
    issues.push(issue('schema_invalid', 'affordance consumers must be a non-empty array', {
      field: `${field}.consumers`,
    }));
  }

  switch (affordance.kind) {
    case 'traversal':
      if (!isStr(affordance.connectionId) || !['forward', 'reverse', 'both'].includes(affordance.direction)) {
        issues.push(issue('schema_invalid', 'traversal connectionId/direction is invalid', { field }));
      }
      if (
        typeof affordance.minimumClearance !== 'number' ||
        !Number.isInteger(affordance.minimumClearance) ||
        affordance.minimumClearance < 1 ||
        affordance.minimumClearance > 1000
      ) {
        issues.push(issue('schema_invalid', 'minimumClearance must be an integer in 1..1000', {
          field: `${field}.minimumClearance`,
        }));
      }
      break;
    case 'opening_clearance':
      if (!isStr(affordance.connectionId)) {
        issues.push(issue('schema_invalid', 'opening clearance connectionId is missing', { field }));
      }
      addRegionIssue(issues, affordance.clearanceRegion, `${field}.clearanceRegion`);
      if (
        affordance.openingSpatialNodeId !== undefined &&
        !index.zones
          .get(affordance.zoneId)
          ?.spatialNodes?.some((node) => node.id === affordance.openingSpatialNodeId)
      ) {
        issues.push(
          issue('reference_unresolved', 'openingSpatialNodeId does not resolve in the affordance zone', {
            field: `${field}.openingSpatialNodeId`,
          }),
        );
      }
      break;
    case 'placement_support':
      if (!entityRefResolves(affordance.support, affordance.zoneId, index)) {
        issues.push(issue('reference_unresolved', 'placement support reference does not resolve', {
          field: `${field}.support`,
        }));
      }
      if (
        !Array.isArray(affordance.supportedEntities) ||
        affordance.supportedEntities.length === 0
      ) {
        issues.push(issue('schema_invalid', 'supportedEntities must be non-empty', {
          field: `${field}.supportedEntities`,
        }));
      } else {
        affordance.supportedEntities.forEach((ref, refIndex) => {
          if (!entityRefResolves(ref, affordance.zoneId, index)) {
            issues.push(issue('reference_unresolved', 'supported entity does not resolve', {
              field: `${field}.supportedEntities[${refIndex}]`,
            }));
          }
        });
      }
      if (
        !Number.isInteger(affordance.maximumOccupants) ||
        affordance.maximumOccupants < 1
      ) {
        issues.push(issue('schema_invalid', 'maximumOccupants must be a positive integer', {
          field: `${field}.maximumOccupants`,
        }));
      }
      break;
    case 'action_space':
      if (
        !Array.isArray(affordance.supportedPredicates) ||
        affordance.supportedPredicates.length === 0 ||
        !affordance.supportedPredicates.every(isActionPredicate) ||
        !Array.isArray(affordance.supportedEntities) ||
        affordance.supportedEntities.length === 0 ||
        !Number.isInteger(affordance.maximumActors) ||
        affordance.maximumActors < 1
      ) {
        issues.push(issue('schema_invalid', 'action-space predicates/entities/maximumActors are incomplete', {
          field,
        }));
      } else {
        affordance.supportedEntities.forEach((ref, refIndex) => {
          if (!entityRefResolves(ref, affordance.zoneId, index)) {
            issues.push(issue('reference_unresolved', 'action-space entity does not resolve', {
              field: `${field}.supportedEntities[${refIndex}]`,
            }));
          }
        });
      }
      break;
    case 'camera_access':
      addRegionIssue(issues, affordance.visibleRegion, `${field}.visibleRegion`);
      break;
    case 'safe_boundary':
      if (!entityRefResolves(affordance.target, affordance.zoneId, index)) {
        issues.push(issue('reference_unresolved', 'safe-boundary target does not resolve', {
          field: `${field}.target`,
        }));
      }
      addRegionIssue(issues, affordance.permittedRegion, `${field}.permittedRegion`);
      break;
  }
}

function validateConsumerReferences(args: {
  affordance: BlueprintSpatialAffordance;
  field: string;
  frames: Map<string, PortraitBlueprintFrame>;
  index: ContractIndex;
  issues: PreRenderBlueprintIssue[];
}): void {
  const consumers = Array.isArray(args.affordance.consumers) ? args.affordance.consumers : [];
  const seen = new Set<string>();
  consumers.forEach((consumer, consumerIndex) => {
    const field = `${args.field}.consumers[${consumerIndex}]`;
    if (!isObj(consumer) || !isStr(consumer.kind)) {
      args.issues.push(issue('schema_invalid', 'consumer must be a discriminated object', { field }));
      return;
    }
    const key = canonicalKey(consumer);
    if (seen.has(key)) {
      args.issues.push(issue('reference_duplicate', 'duplicate affordance consumer', { field }));
    }
    seen.add(key);
    switch (consumer.kind) {
      case 'frame':
        if (!isStr(consumer.frameId) || !args.frames.has(consumer.frameId)) {
          args.issues.push(issue('reference_unresolved', 'frame consumer does not resolve', { field }));
        }
        break;
      case 'action': {
        const page = args.index.pages.get(consumer.pageNumber as number);
        if (
          args.affordance.kind !== 'action_space' ||
          !page?.actionRequirements?.some((action) => action.checkId === consumer.checkId)
        ) {
          args.issues.push(issue('affordance_incompatible', 'action consumer is missing or on the wrong affordance kind', {
            field,
          }));
        }
        break;
      }
      case 'placement': {
        const page = args.index.pages.get(consumer.pageNumber as number);
        if (
          args.affordance.kind !== 'placement_support' ||
          !page?.propConstraints?.some((constraint) => constraint.propId === consumer.propId)
        ) {
          args.issues.push(issue('affordance_incompatible', 'placement consumer is missing or on the wrong affordance kind', {
            field,
          }));
        }
        break;
      }
      case 'transition': {
        const page = args.index.pages.get(consumer.pageNumber as number);
        if (
          !page ||
          !page.transition ||
          page.transition.kind === 'steady' ||
          !['traversal', 'opening_clearance', 'safe_boundary'].includes(args.affordance.kind)
        ) {
          args.issues.push(issue('affordance_incompatible', 'transition consumer is missing or on an incompatible affordance', {
            field,
          }));
        }
        break;
      }
      case 'safety': {
        const page = args.index.pages.get(consumer.pageNumber as number);
        const matches = page?.safetyConstraints?.some(
          (constraint) =>
            constraint.subjectId === consumer.subjectId &&
            constraint.relation === consumer.relation &&
            sameCanonical(constraint.target, consumer.target),
        );
        if (args.affordance.kind !== 'safe_boundary' || !matches) {
          args.issues.push(issue('affordance_incompatible', 'safety consumer is missing or on the wrong affordance kind', {
            field,
          }));
        }
        break;
      }
      default:
        args.issues.push(issue('schema_invalid', `unknown affordance consumer kind "${String((consumer as Obj).kind)}"`, {
          field,
        }));
    }
  });
}

function validateConnection(
  connection: BlueprintWorldConnection,
  field: string,
  index: ContractIndex,
  affordances: Map<string, BlueprintSpatialAffordance>,
  issues: PreRenderBlueprintIssue[],
): void {
  if (!isStr(connection.id) || !CONNECTION_KINDS.has(connection.kind)) {
    issues.push(issue('schema_invalid', 'connection id/kind is invalid', { field }));
    return;
  }
  if (typeof connection.bidirectional !== 'boolean') {
    issues.push(issue('schema_invalid', 'connection bidirectional must be boolean', {
      field: `${field}.bidirectional`,
    }));
  }
  for (const [name, endpoint] of [
    ['from', connection.from],
    ['to', connection.to],
  ] as const) {
    if (!isObj(endpoint) || !isStr(endpoint.zoneId) || !index.zones.has(endpoint.zoneId)) {
      issues.push(issue('reference_unresolved', `connection ${name} zone does not resolve`, {
        field: `${field}.${name}`,
      }));
      continue;
    }
    if (
      endpoint.spatialNodeId !== undefined &&
      !index.zones.get(endpoint.zoneId)?.spatialNodes?.some(
        (node) => node.id === endpoint.spatialNodeId,
      )
    ) {
      issues.push(issue('reference_unresolved', `connection ${name} spatial node does not resolve`, {
        field: `${field}.${name}.spatialNodeId`,
      }));
    }
  }
  if (connection.from?.zoneId === connection.to?.zoneId) {
    issues.push(issue('transition_invalid', 'connection endpoints must be different zones', { field }));
  }
  const traversalIds = Array.isArray(connection.traversalAffordanceIds)
    ? connection.traversalAffordanceIds.filter((id): id is string => typeof id === 'string')
    : [];
  if (
    !Array.isArray(connection.traversalAffordanceIds) ||
    traversalIds.length !== connection.traversalAffordanceIds.length ||
    traversalIds.length === 0
  ) {
    issues.push(issue('schema_invalid', 'traversalAffordanceIds must be a non-empty string array', {
      field: `${field}.traversalAffordanceIds`,
    }));
  }
  if (new Set(traversalIds).size !== traversalIds.length) {
    issues.push(issue('reference_duplicate', 'connection traversal affordance ids must be unique', {
      field: `${field}.traversalAffordanceIds`,
    }));
  }
  const connectionTraversals: Array<
    Extract<BlueprintSpatialAffordance, { kind: 'traversal' }>
  > = [];
  traversalIds.forEach((id, offset) => {
    const traversal = affordances.get(id);
    const traversalField = `${field}.traversalAffordanceIds[${offset}]`;
    if (
      !traversal ||
      traversal.kind !== 'traversal' ||
      traversal.connectionId !== connection.id
    ) {
      issues.push(issue('traversal_infeasible', 'connection traversal affordance is missing or mismatched', {
        field: traversalField,
      }));
      return;
    }
    connectionTraversals.push(traversal);
    const endpointZoneValid =
      traversal.zoneId === connection.from?.zoneId ||
      traversal.zoneId === connection.to?.zoneId;
    const directionValid =
      traversal.direction !== 'reverse' || connection.bidirectional === true;
    if (!endpointZoneValid || !directionValid) {
      issues.push(issue('transition_invalid', 'traversal must use a connection endpoint zone and a permitted direction', {
        field: traversalField,
        actual: {
          direction: traversal.direction,
          zoneId: traversal.zoneId,
        },
      }));
    }
    if (
      regionIsValid(traversal.footprint) &&
      Number.isInteger(traversal.minimumClearance) &&
      regionMinimumDimension(traversal.footprint) < traversal.minimumClearance
    ) {
      issues.push(issue('traversal_infeasible', 'traversal footprint is narrower than minimumClearance', {
        field: `${traversalField}.footprint`,
        expected: traversal.minimumClearance,
        actual: regionMinimumDimension(traversal.footprint),
      }));
    }
  });
  if (!Array.isArray(connection.openingClearanceAffordanceIds)) {
    issues.push(issue('schema_invalid', 'openingClearanceAffordanceIds must be an array', { field }));
  } else {
    if (
      ['doorway', 'opening', 'threshold', 'portal'].includes(connection.kind) &&
      connection.openingClearanceAffordanceIds.length === 0
    ) {
      issues.push(issue('traversal_infeasible', 'an opening-like connection requires authored opening clearance', {
        field: `${field}.openingClearanceAffordanceIds`,
      }));
    }
    connection.openingClearanceAffordanceIds.forEach((id, offset) => {
      const opening = affordances.get(id);
      const openingField = `${field}.openingClearanceAffordanceIds[${offset}]`;
      if (
        !opening ||
        opening.kind !== 'opening_clearance' ||
        opening.connectionId !== connection.id
      ) {
        issues.push(issue('traversal_infeasible', 'opening-clearance affordance is missing or mismatched', {
          field: openingField,
        }));
        return;
      }
      if (
        opening.zoneId !== connection.from?.zoneId &&
        opening.zoneId !== connection.to?.zoneId
      ) {
        issues.push(issue('transition_invalid', 'opening clearance must be pinned to a connection endpoint zone', {
          field: openingField,
          actual: opening.zoneId,
        }));
      }
      const sameZoneTraversals = connectionTraversals.filter(
        (traversal) => traversal.zoneId === opening.zoneId,
      );
      if (sameZoneTraversals.length === 0) {
        issues.push(issue('traversal_infeasible', 'opening clearance has no same-zone traversal authority', {
          field: openingField,
          actual: opening.zoneId,
        }));
      }
      if (regionIsValid(opening.clearanceRegion)) {
        for (const traversal of sameZoneTraversals) {
          if (
            Number.isInteger(traversal.minimumClearance) &&
            regionMinimumDimension(opening.clearanceRegion) <
              traversal.minimumClearance
          ) {
            issues.push(issue('traversal_infeasible', 'opening clearance is narrower than traversal minimumClearance', {
              field: `${openingField}.clearanceRegion`,
              expected: traversal.minimumClearance,
              actual: regionMinimumDimension(opening.clearanceRegion),
            }));
          }
        }
      }
    });
  }
  if (!Array.isArray(connection.safeBoundaryAffordanceIds)) {
    issues.push(issue('schema_invalid', 'safeBoundaryAffordanceIds must be an array', { field }));
  } else {
    connection.safeBoundaryAffordanceIds.forEach((id, offset) => {
      if (affordances.get(id)?.kind !== 'safe_boundary') {
        issues.push(issue('safety_infeasible', 'connection safe-boundary affordance is missing or mismatched', {
          field: `${field}.safeBoundaryAffordanceIds[${offset}]`,
        }));
      }
    });
  }
}

function validateSupportingGeometry(
  geometry: RevealSafeSupportingGeometry,
  field: string,
  index: ContractIndex,
  issues: PreRenderBlueprintIssue[],
): void {
  const zone = index.zones.get(geometry.zoneId);
  const node = zone?.spatialNodes?.find((entry) => entry.id === geometry.spatialNodeId);
  if (
    !isStr(geometry.id) ||
    !zone ||
    !node ||
    geometry.spoilerNeutral !== true ||
    !Array.isArray(geometry.supportsPropIds) ||
    geometry.supportsPropIds.length === 0
  ) {
    issues.push(issue('schema_invalid', 'reveal-safe supporting geometry is incomplete or unresolved', {
      field,
    }));
    return;
  }
  for (const [offset, propId] of geometry.supportsPropIds.entries()) {
    const prop = index.props.get(propId);
    if (!prop) {
      issues.push(issue('reference_unresolved', `supporting geometry prop "${propId}" does not resolve`, {
        field: `${field}.supportsPropIds[${offset}]`,
      }));
      continue;
    }
    if (node.bindsTo?.kind === 'prop' && node.bindsTo.id === propId) {
      issues.push(issue('reveal_violation', 'spoiler-neutral geometry cannot bind directly to the hidden prop', {
        field: `${field}.spatialNodeId`,
      }));
    }
    if (semanticPropTerms(prop.id, prop.name).some((term) => textContainsTerm(node.description, term))) {
      issues.push(issue('reveal_violation', 'spoiler-neutral geometry description names a supported hidden prop', {
        field: `${field}.spatialNodeId`,
        actual: node.description,
      }));
    }
  }
}

function actionSupportIsCompatible(
  affordance: Extract<BlueprintSpatialAffordance, { kind: 'action_space' }>,
  action: PageActionRequirement,
): boolean {
  const entities: EntityRef[] = [{ kind: 'cast', id: action.actorId }];
  if (action.object) entities.push(action.object);
  return (
    Array.isArray(affordance.supportedPredicates) &&
    Array.isArray(affordance.supportedEntities) &&
    affordance.supportedPredicates.includes(action.predicate) &&
    entities.every((expected) =>
      affordance.supportedEntities.some((actual) => entityRefEquals(actual, expected)),
    )
  );
}

function placementSupportIsCompatible(
  affordance: Extract<BlueprintSpatialAffordance, { kind: 'placement_support' }>,
  constraint: PagePropConstraint,
): boolean {
  const propRef: EntityRef = { kind: 'prop', id: constraint.propId };
  if (!Array.isArray(affordance.supportedEntities)) return false;
  if (!affordance.supportedEntities.some((entry) => entityRefEquals(entry, propRef))) return false;
  if (!constraint.anchorId) return true;
  return entityRefEquals(affordance.support, { kind: 'anchor', id: constraint.anchorId });
}

function validateFrame(args: {
  frame: PortraitBlueprintFrame;
  field: string;
  template: BookVisualContractTemplate;
  sourcePages: number[];
  index: ContractIndex;
  affordances: Map<string, BlueprintSpatialAffordance>;
  connections: Map<string, BlueprintWorldConnection>;
  supportingGeometry: Map<string, RevealSafeSupportingGeometry>;
  frames: Map<string, PortraitBlueprintFrame>;
  issues: PreRenderBlueprintIssue[];
}): void {
  const {
    frame,
    field,
    template,
    sourcePages,
    index,
    affordances,
    connections,
    supportingGeometry,
    frames,
    issues,
  } = args;
  const expectedId = frame.kind === 'cover' ? 'frame:cover' : `frame:page:${frame.pageNumber}`;
  if (frame.kind === 'page' && (!Number.isInteger(frame.pageNumber) || frame.pageNumber < 1)) {
    issues.push(issue('schema_invalid', 'page frame pageNumber must be a positive integer', {
      field: `${field}.pageNumber`,
    }));
  }
  if (frame.id !== expectedId) {
    issues.push(issue('frame_authority_mismatch', 'frame id is not the stable cover/page id', {
      field: `${field}.id`,
      expected: expectedId,
      actual: frame.id,
    }));
  }
  if (
    !isObj(frame.aspectRatio) ||
    frame.aspectRatio.width !== PRE_RENDER_BLUEPRINT_PORTRAIT_ASPECT_RATIO.width ||
    frame.aspectRatio.height !== PRE_RENDER_BLUEPRINT_PORTRAIT_ASPECT_RATIO.height
  ) {
    issues.push(issue('aspect_ratio_invalid', 'every book frame must be exact 2:3 portrait', {
      field: `${field}.aspectRatio`,
      expected: PRE_RENDER_BLUEPRINT_PORTRAIT_ASPECT_RATIO,
      actual: frame.aspectRatio,
    }));
  }
  if (frame.coordinateSpace !== PRE_RENDER_BLUEPRINT_COORDINATE_SPACE) {
    issues.push(issue('schema_invalid', 'frame coordinateSpace is unsupported', {
      field: `${field}.coordinateSpace`,
    }));
  }
  if (
    !isObj(frame.narrative) ||
    !NARRATIVE_PURPOSES.has(frame.narrative.purpose) ||
    !isStr(frame.narrative.summary)
  ) {
    issues.push(issue('schema_invalid', 'frame narrative purpose/summary is incomplete', {
      field: `${field}.narrative`,
    }));
  }
  const textRegionOk = addRegionIssue(issues, frame.textSafeRegion, `${field}.textSafeRegion`);
  const zone = index.zones.get(frame.zoneId);
  if (!zone || zone.locationId !== frame.locationId || !index.locations.has(frame.locationId)) {
    issues.push(issue('reference_unresolved', 'frame location/zone does not resolve coherently', {
      field: `${field}.zoneId`,
    }));
  }

  const page = frame.kind === 'page' ? index.pages.get(frame.pageNumber) : null;
  const authority = frame.kind === 'cover' ? template.coverContract : page;
  if (!authority) {
    issues.push(issue('coverage_extra', 'frame has no corresponding cover/page authority', { field }));
    return;
  }
  const authorityCast = authority.castIds;
  if (
    authority.locationId !== frame.locationId ||
    !authority.zoneId ||
    authority.zoneId !== frame.zoneId ||
    !authorityCast ||
    !sameStringSet(frame.castIds, authorityCast)
  ) {
    issues.push(issue('frame_authority_mismatch', 'frame location/zone/cast does not exactly project the Visual Contract', {
      field,
      expected: {
        locationId: authority.locationId,
        zoneId: authority.zoneId,
        castIds: authorityCast,
      },
      actual: {
        locationId: frame.locationId,
        zoneId: frame.zoneId,
        castIds: frame.castIds,
      },
    }));
  }

  const lifecycle = expectedPropLifecycle(template, frame);
  if (
    !isObj(frame.propLifecycle) ||
    !sameStringSet(frame.propLifecycle.requiredPropIds, lifecycle.required) ||
    !sameStringSet(frame.propLifecycle.forbiddenPropIds, lifecycle.forbidden)
  ) {
    issues.push(issue('frame_authority_mismatch', 'frame prop lifecycle is not the exact deterministic contract projection', {
      field: `${field}.propLifecycle`,
      expected: lifecycle,
      actual: frame.propLifecycle,
    }));
  }

  const frameCastIds = Array.isArray(frame.castIds)
    ? frame.castIds.filter((entry): entry is string => typeof entry === 'string')
    : [];
  if (
    !Array.isArray(frame.castIds) ||
    frameCastIds.length !== frame.castIds.length ||
    new Set(frameCastIds).size !== frameCastIds.length
  ) {
    issues.push(issue('reference_duplicate', 'frame castIds must be unique', { field: `${field}.castIds` }));
  }
  for (const castId of frameCastIds) {
    if (!index.castIds.has(castId)) {
      issues.push(issue('reference_unresolved', `frame cast "${castId}" is undeclared`, {
        field: `${field}.castIds`,
      }));
    }
  }

  if (!Array.isArray(frame.placements)) {
    issues.push(issue('schema_invalid', 'frame placements must be an array', { field: `${field}.placements` }));
    return;
  }
  const validPlacements: BlueprintFramePlacement[] = [];
  const placementIds = new Set<string>();
  const subjectKeys = new Set<string>();
  frame.placements.forEach((placement, placementIndex) => {
    const placementField = `${field}.placements[${placementIndex}]`;
    if (!isObj(placement) || !isStr(placement.id) || !isObj(placement.subject)) {
      issues.push(issue('schema_invalid', 'placement id/subject is invalid', { field: placementField }));
      return;
    }
    validPlacements.push(placement);
    if (placementIds.has(placement.id)) {
      issues.push(issue('reference_duplicate', `duplicate placement id "${placement.id}"`, {
        field: placementField,
      }));
    }
    placementIds.add(placement.id);
    const subjectKey = canonicalKey(placement.subject);
    if (subjectKeys.has(subjectKey)) {
      issues.push(issue('reference_duplicate', 'a frame subject may have only one placement', {
        field: placementField,
      }));
    }
    subjectKeys.add(subjectKey);
    addRegionIssue(issues, placement.region, `${placementField}.region`);
    if (!['foreground', 'midground', 'background'].includes(placement.depth)) {
      issues.push(issue('schema_invalid', 'placement depth is invalid', { field: `${placementField}.depth` }));
    }
    if (!['key', 'supporting'].includes(placement.importance)) {
      issues.push(issue('schema_invalid', 'placement importance is invalid', { field: `${placementField}.importance` }));
    }
    const subject = placement.subject;
    switch (subject.kind) {
      case 'cast':
        if (!frameCastIds.includes(subject.castId)) {
          issues.push(issue('reference_unresolved', 'cast placement is not in this frame cast', {
            field: `${placementField}.subject`,
          }));
        }
        break;
      case 'prop':
        if (
          !index.props.has(subject.propId) ||
          lifecycle.forbidden.includes(subject.propId)
        ) {
          issues.push(issue('reveal_violation', 'prop placement is undeclared or forbidden on this frame', {
            field: `${placementField}.subject`,
          }));
        }
        break;
      case 'action':
        if (
          frame.kind === 'cover' ||
          !page?.actionRequirements?.some(
            (action) => action.checkId === subject.checkId && action.polarity === 'must',
          )
        ) {
          issues.push(issue('reference_unresolved', 'action placement does not resolve to a required page action', {
            field: `${placementField}.subject`,
          }));
        }
        break;
      case 'supporting_geometry': {
        const geometry = supportingGeometry.get(subject.geometryId);
        if (!geometry || geometry.zoneId !== frame.zoneId || geometry.spoilerNeutral !== true) {
          issues.push(issue('reveal_violation', 'supporting-geometry placement is unresolved or not spoiler-neutral', {
            field: `${placementField}.subject`,
          }));
        }
        break;
      }
      default:
        issues.push(issue('schema_invalid', 'unknown placement subject kind', {
          field: `${placementField}.subject`,
        }));
    }
  });

  const mustActions =
    frame.kind === 'page'
      ? (page?.actionRequirements ?? []).filter((action) => action.polarity === 'must')
      : [];
  const requiredPlacements: BlueprintFramePlacement[] = [];
  for (const castId of frameCastIds) {
    const placement = framePlacementForCast(validPlacements, castId);
    if (!placement || placement.importance !== 'key') {
      issues.push(issue('placement_infeasible', `key cast "${castId}" lacks exactly one key placement`, {
        field: `${field}.placements`,
      }));
    } else {
      requiredPlacements.push(placement);
    }
  }
  for (const propId of lifecycle.required) {
    const placement = framePlacementForProp(validPlacements, propId);
    if (!placement || placement.importance !== 'key') {
      issues.push(issue('placement_infeasible', `required prop "${propId}" lacks exactly one key placement`, {
        field: `${field}.placements`,
      }));
    } else {
      requiredPlacements.push(placement);
    }
  }
  for (const action of mustActions) {
    const placement = framePlacementForAction(validPlacements, action.checkId);
    if (!placement || placement.importance !== 'key') {
      issues.push(issue('action_infeasible', `required action "${action.checkId}" lacks exactly one key evidence region`, {
        field: `${field}.placements`,
      }));
    } else {
      requiredPlacements.push(placement);
    }
  }
  if (textRegionOk) {
    for (const placement of requiredPlacements) {
      if (regionIsValid(placement.region) && regionsOverlap(frame.textSafeRegion, placement.region)) {
        issues.push(issue('text_safe_collision', 'text-safe region overlaps key cast/action/required-prop evidence', {
          field: `${field}.textSafeRegion`,
          actual: placement.id,
        }));
      }
    }
  }

  const frameAffordanceIds = Array.isArray(frame.affordanceIds)
    ? frame.affordanceIds.filter((entry): entry is string => typeof entry === 'string')
    : [];
  if (
    !Array.isArray(frame.affordanceIds) ||
    frameAffordanceIds.length !== frame.affordanceIds.length ||
    new Set(frameAffordanceIds).size !== frameAffordanceIds.length
  ) {
    issues.push(issue('reference_duplicate', 'frame affordanceIds must be a unique array', {
      field: `${field}.affordanceIds`,
    }));
  }
  for (const [offset, affordanceId] of frameAffordanceIds.entries()) {
    if (!affordances.has(affordanceId)) {
      issues.push(issue('reference_unresolved', `frame affordance "${affordanceId}" does not resolve`, {
        field: `${field}.affordanceIds[${offset}]`,
      }));
    }
  }

  const camera = affordances.get(frame.camera?.affordanceId);
  if (
    !isObj(frame.camera) ||
    !CAMERA_SHOTS.has(frame.camera.shot) ||
    !CAMERA_ANGLES.has(frame.camera.angle) ||
    !camera ||
    camera.kind !== 'camera_access' ||
    camera.zoneId !== frame.zoneId ||
    !frameAffordanceIds.includes(frame.camera.affordanceId) ||
    !hasConsumer(camera, { kind: 'frame', frameId: frame.id })
  ) {
    issues.push(issue('camera_infeasible', 'frame camera does not resolve to a compatible camera-access affordance', {
      field: `${field}.camera`,
    }));
  } else if (regionIsValid(camera.visibleRegion)) {
    for (const placement of requiredPlacements) {
      if (regionIsValid(placement.region) && !regionContains(camera.visibleRegion, placement.region)) {
        issues.push(issue('camera_infeasible', 'camera visible region does not contain all key evidence', {
          field: `${field}.camera.affordanceId`,
          actual: placement.id,
        }));
      }
    }
  }

  if (frame.kind === 'page' && page) {
    const propAssignments = new Map<string, Set<string>>();
    for (const constraint of (page.propConstraints ?? []).filter(
      (entry) => lifecycle.required.includes(entry.propId),
    )) {
      const placement = framePlacementForProp(validPlacements, constraint.propId);
      const compatibleSupports = [...affordances.values()].filter(
        (candidate) =>
          candidate.kind === 'placement_support' &&
          candidate.zoneId === frame.zoneId &&
          frameAffordanceIds.includes(candidate.id) &&
          hasConsumer(candidate, {
            kind: 'placement',
            pageNumber: frame.pageNumber,
            propId: constraint.propId,
          }) &&
          placementSupportIsCompatible(candidate, constraint) &&
          Boolean(
            placement &&
              regionIsValid(candidate.footprint) &&
              regionIsValid(placement.region) &&
              regionContains(candidate.footprint, placement.region),
          ),
      );
      if (compatibleSupports.length === 0) {
        issues.push(issue('placement_infeasible', `required prop "${constraint.propId}" has no compatible placement/support affordance`, {
          field: `${field}.affordanceIds`,
        }));
      } else if (compatibleSupports.length > 1) {
        issues.push(issue('affordance_incompatible', `required prop "${constraint.propId}" has ambiguous placement/support assignments`, {
          field: `${field}.affordanceIds`,
          actual: compatibleSupports.map((support) => support.id).sort(lexicalCompare),
        }));
      } else {
        const assigned = propAssignments.get(compatibleSupports[0].id) ?? new Set<string>();
        assigned.add(constraint.propId);
        propAssignments.set(compatibleSupports[0].id, assigned);
      }
    }
    for (const [supportId, propIds] of propAssignments) {
      const support = affordances.get(supportId);
      if (
        support?.kind === 'placement_support' &&
        Number.isInteger(support.maximumOccupants) &&
        propIds.size > support.maximumOccupants
      ) {
        issues.push(issue('placement_infeasible', 'placement support exceeds maximumOccupants for this frame', {
          field: `worldPlan.affordances.${supportId}.maximumOccupants`,
          expected: support.maximumOccupants,
          actual: [...propIds].sort(lexicalCompare),
        }));
      }
    }

    const actionActorAssignments = new Map<string, Set<string>>();
    for (const action of mustActions) {
      const placement = framePlacementForAction(validPlacements, action.checkId);
      const compatibleSupports = [...affordances.values()].filter(
        (candidate) =>
          candidate.kind === 'action_space' &&
          candidate.zoneId === frame.zoneId &&
          frameAffordanceIds.includes(candidate.id) &&
          hasConsumer(candidate, {
            kind: 'action',
            pageNumber: frame.pageNumber,
            checkId: action.checkId,
          }) &&
          actionSupportIsCompatible(candidate, action) &&
          Boolean(
            placement &&
              regionIsValid(candidate.footprint) &&
              regionIsValid(placement.region) &&
              regionContains(candidate.footprint, placement.region),
          ),
      );
      if (compatibleSupports.length === 0) {
        issues.push(issue('action_infeasible', `action "${action.checkId}" has no compatible action-space affordance`, {
          field: `${field}.affordanceIds`,
        }));
      } else if (compatibleSupports.length > 1) {
        issues.push(issue('affordance_incompatible', `action "${action.checkId}" has ambiguous action-space assignments`, {
          field: `${field}.affordanceIds`,
          actual: compatibleSupports.map((support) => support.id).sort(lexicalCompare),
        }));
      } else {
        const actors =
          actionActorAssignments.get(compatibleSupports[0].id) ?? new Set<string>();
        // Capacity counts the unique cast members performing required actions. An action object,
        // even when it is another cast member, is acted upon and is not a second actor.
        actors.add(action.actorId);
        actionActorAssignments.set(compatibleSupports[0].id, actors);
      }
    }
    for (const [supportId, actorIds] of actionActorAssignments) {
      const support = affordances.get(supportId);
      if (
        support?.kind === 'action_space' &&
        Number.isInteger(support.maximumActors) &&
        actorIds.size > support.maximumActors
      ) {
        issues.push(issue('action_infeasible', 'action space exceeds maximumActors for this frame', {
          field: `worldPlan.affordances.${supportId}.maximumActors`,
          expected: support.maximumActors,
          actual: [...actorIds].sort(lexicalCompare),
        }));
      }
    }

    for (const constraint of page.safetyConstraints ?? []) {
      const consumer: BlueprintAffordanceConsumer = {
        kind: 'safety',
        pageNumber: frame.pageNumber,
        subjectId: constraint.subjectId,
        relation: constraint.relation,
        target: constraint.target,
      };
      const subjectPlacement = framePlacementForCast(validPlacements, constraint.subjectId);
      const boundary = [...affordances.values()].find(
        (candidate) =>
          candidate.kind === 'safe_boundary' &&
          candidate.zoneId === frame.zoneId &&
          frameAffordanceIds.includes(candidate.id) &&
          entityRefEquals(candidate.target, constraint.target) &&
          hasConsumer(candidate, consumer) &&
          Boolean(
            subjectPlacement &&
              regionIsValid(subjectPlacement.region) &&
              regionIsValid(candidate.permittedRegion) &&
              regionContains(candidate.permittedRegion, subjectPlacement.region),
          ),
      );
      if (!boundary) {
        issues.push(issue('safety_infeasible', 'safety constraint lacks a compatible containing safe boundary', {
          field: `${field}.affordanceIds`,
          actual: consumer,
        }));
      }
    }
  }

  const expectedPrevious = expectedPreviousFrameId(frame, sourcePages);
  const expectedTransition = frame.kind === 'cover' ? 'steady' : page?.transition?.kind ?? 'steady';
  const continuity = isObj(frame.continuity) ? frame.continuity : null;
  const carryoverRefs = continuity && Array.isArray(continuity.carryoverRefs)
    ? continuity.carryoverRefs
    : [];
  if (
    !continuity ||
    continuity.previousFrameId !== expectedPrevious ||
    continuity.transitionKind !== expectedTransition ||
    !Array.isArray(continuity.carryoverRefs)
  ) {
    issues.push(issue('transition_invalid', 'frame continuity does not match cover/page order and transition authority', {
      field: `${field}.continuity`,
      expected: { previousFrameId: expectedPrevious, transitionKind: expectedTransition },
      actual: frame.continuity,
    }));
  }
  if (
    isStr(continuity?.previousFrameId) &&
    !frames.has(continuity.previousFrameId)
  ) {
    issues.push(issue('reference_unresolved', 'previousFrameId does not resolve', {
      field: `${field}.continuity.previousFrameId`,
    }));
  }
  for (const [offset, ref] of carryoverRefs.entries()) {
    if (!entityRefResolves(ref, frame.zoneId, index)) {
      issues.push(issue('reference_unresolved', 'continuity carryover ref does not resolve in the frame', {
        field: `${field}.continuity.carryoverRefs[${offset}]`,
      }));
      continue;
    }
    if (ref.kind === 'cast' && !frameCastIds.includes(ref.id)) {
      issues.push(issue('frame_authority_mismatch', 'cast carryover is not present in the current frame', {
        field: `${field}.continuity.carryoverRefs[${offset}]`,
      }));
    }
    if (ref.kind === 'prop' && lifecycle.forbidden.includes(ref.id)) {
      issues.push(issue('reveal_violation', 'forbidden prop cannot be a continuity carryover', {
        field: `${field}.continuity.carryoverRefs[${offset}]`,
      }));
    }
  }

  if (frame.kind === 'cover' || expectedTransition === 'steady') {
    if (continuity?.connectionId !== undefined) {
      issues.push(issue('transition_invalid', 'cover/steady frame must not declare a connection', {
        field: `${field}.continuity.connectionId`,
      }));
    }
  } else if (page?.transition?.fromZoneId && page.transition.toZoneId) {
    const connection = connections.get(
      isStr(continuity?.connectionId) ? continuity.connectionId : '',
    );
    const transitionDirection = connection
      ? connectionTransitionDirection(
          connection,
          page.transition.fromZoneId,
          page.transition.toZoneId,
        )
      : null;
    if (!connection || !transitionDirection) {
      issues.push(issue('transition_invalid', 'page transition does not follow the authored connection graph', {
        field: `${field}.continuity.connectionId`,
      }));
    } else {
      const transitionConsumer: BlueprintAffordanceConsumer = {
        kind: 'transition',
        pageNumber: frame.pageNumber,
      };
      const transitionZoneValid =
        (page.transition.kind === 'before_transition' &&
          frame.zoneId === page.transition.fromZoneId) ||
        (page.transition.kind === 'after_transition' &&
          frame.zoneId === page.transition.toZoneId) ||
        (page.transition.kind === 'threshold' &&
          (frame.zoneId === page.transition.fromZoneId ||
            frame.zoneId === page.transition.toZoneId));
      if (!transitionZoneValid || !index.zones.has(frame.zoneId)) {
        issues.push(issue('transition_invalid', 'transition frame zone does not match its authored transition kind', {
          field: `${field}.zoneId`,
          expected:
            page.transition.kind === 'before_transition'
              ? page.transition.fromZoneId
              : page.transition.kind === 'after_transition'
                ? page.transition.toZoneId
                : [page.transition.fromZoneId, page.transition.toZoneId],
          actual: frame.zoneId,
        }));
      }
      const traversalIds = Array.isArray(connection.traversalAffordanceIds)
        ? connection.traversalAffordanceIds
        : [];
      const visibleTraversalCandidates = traversalIds
        .map((id) => affordances.get(id))
        .filter(
          (
            candidate,
          ): candidate is Extract<BlueprintSpatialAffordance, { kind: 'traversal' }> =>
            candidate?.kind === 'traversal' &&
            candidate.connectionId === connection.id &&
            candidate.zoneId === frame.zoneId &&
            hasConsumer(candidate, transitionConsumer) &&
            frameAffordanceIds.includes(candidate.id),
        );
      const matchingTraversals = visibleTraversalCandidates.filter((candidate) =>
        traversalSupportsDirection(candidate, transitionDirection),
      );
      if (
        visibleTraversalCandidates.length > 0 &&
        matchingTraversals.length === 0
      ) {
        issues.push(issue('transition_invalid', 'visible traversal direction cannot serve the authored transition', {
          field: `${field}.affordanceIds`,
          expected: transitionDirection,
          actual: visibleTraversalCandidates.map((candidate) => candidate.direction),
        }));
      }
      const castTouchesTraversal = matchingTraversals.some((traversal) =>
        frameCastIds.some((castId) => {
          const placement = framePlacementForCast(validPlacements, castId);
          return Boolean(
            placement &&
              regionIsValid(placement.region) &&
              regionIsValid(traversal.footprint) &&
              regionsOverlap(placement.region, traversal.footprint),
          );
        }),
      );
      if (matchingTraversals.length === 0 || !castTouchesTraversal) {
        issues.push(issue('traversal_infeasible', 'transition frame lacks visible compatible traversal support', {
          field: `${field}.affordanceIds`,
        }));
      }
      const openingIds = Array.isArray(connection.openingClearanceAffordanceIds)
        ? connection.openingClearanceAffordanceIds
        : [];
      const visibleFrameOpenings = openingIds
        .map((id) => affordances.get(id))
        .filter(
          (
            candidate,
          ): candidate is Extract<
            BlueprintSpatialAffordance,
            { kind: 'opening_clearance' }
          > =>
            candidate?.kind === 'opening_clearance' &&
            candidate.connectionId === connection.id &&
            candidate.zoneId === frame.zoneId,
        );
      if (
        ['doorway', 'opening', 'threshold', 'portal'].includes(connection.kind) &&
        visibleFrameOpenings.length === 0
      ) {
        issues.push(issue('traversal_infeasible', 'transition has no opening clearance in the authoritative frame zone', {
          field: `${field}.affordanceIds`,
          expected: frame.zoneId,
        }));
      }
      for (const opening of visibleFrameOpenings) {
        if (
          !hasConsumer(opening, transitionConsumer) ||
          !frameAffordanceIds.includes(opening.id)
        ) {
          issues.push(issue('traversal_infeasible', 'transition opening-clearance support is missing', {
            field: `${field}.affordanceIds`,
            actual: opening.id,
          }));
          continue;
        }
        if (regionIsValid(opening.clearanceRegion)) {
          for (const propId of lifecycle.required) {
            const placement = framePlacementForProp(validPlacements, propId);
            if (
              placement &&
              regionIsValid(placement.region) &&
              regionsOverlap(opening.clearanceRegion, placement.region)
            ) {
              issues.push(issue('traversal_infeasible', 'required prop blocks authored opening clearance', {
                field: `${field}.placements`,
                actual: placement.id,
              }));
            }
          }
        }
      }
      const pageSafetyIds = [...affordances.values()]
        .filter(
          (candidate) =>
            candidate.kind === 'safe_boundary' &&
            (page.safetyConstraints ?? []).some((constraint) =>
              hasConsumer(candidate, {
                kind: 'safety',
                pageNumber: frame.pageNumber,
                subjectId: constraint.subjectId,
                relation: constraint.relation,
                target: constraint.target,
              }),
            ),
        )
        .map((candidate) => candidate.id);
      const connectionSafetyIds = Array.isArray(connection.safeBoundaryAffordanceIds)
        ? connection.safeBoundaryAffordanceIds
        : [];
      for (const safetyId of pageSafetyIds) {
        if (!connectionSafetyIds.includes(safetyId)) {
          issues.push(issue('safety_infeasible', 'transition connection omits a page safety boundary', {
            field: `${field}.continuity.connectionId`,
            actual: safetyId,
          }));
        }
      }
    }
  }

  const numericPage = frameNumber(frame);
  for (const prop of durableRecurringProps(template)) {
    if (prop.firstRevealPage === undefined || numericPage >= prop.firstRevealPage) continue;
    if (
      isStr(frame.narrative?.summary) &&
      semanticPropTerms(prop.id, prop.name).some((term) =>
        textContainsTerm(frame.narrative.summary, term),
      )
    ) {
      issues.push(issue('reveal_violation', `pre-reveal frame narrative names hidden prop "${prop.id}"`, {
        field: `${field}.narrative.summary`,
      }));
    }
    if (
      validPlacements.some(
        (placement) =>
          placement.subject.kind === 'prop' && placement.subject.propId === prop.id,
      )
    ) {
      issues.push(issue('reveal_violation', `pre-reveal frame depicts hidden prop "${prop.id}"`, {
        field: `${field}.placements`,
      }));
    }
  }
}

function validateCoverage(
  frames: unknown[],
  source: StorySourceIdentity,
  issues: PreRenderBlueprintIssue[],
): void {
  const validFrames = frames.filter(
    (frame): frame is PortraitBlueprintFrame =>
      isObj(frame) && (frame.kind === 'cover' || frame.kind === 'page'),
  );
  const covers = validFrames.filter((frame) => frame.kind === 'cover');
  if (covers.length !== 1) {
    issues.push(issue('coverage_incomplete', 'blueprint must contain exactly one cover frame', {
      field: 'frames',
      expected: 1,
      actual: covers.length,
    }));
  }
  const pageNumbers = validFrames
    .filter((frame): frame is Extract<PortraitBlueprintFrame, { kind: 'page' }> => frame.kind === 'page')
    .map((frame) => frame.pageNumber);
  const duplicates = pageNumbers.filter(
    (pageNumber, index) => pageNumbers.indexOf(pageNumber) !== index,
  );
  if (duplicates.length > 0) {
    issues.push(issue('coverage_duplicate', 'blueprint contains duplicate page frames', {
      field: 'frames',
      actual: [...new Set(duplicates)].sort((a, b) => a - b),
    }));
  }
  const sourceSet = new Set(source.pageNumbers);
  const extras = pageNumbers.filter((pageNumber) => !sourceSet.has(pageNumber));
  if (extras.length > 0) {
    issues.push(issue('coverage_extra', 'blueprint contains frames outside the Story Source', {
      field: 'frames',
      actual: extras,
    }));
  }
  const present = new Set(pageNumbers);
  const missing = source.pageNumbers.filter((pageNumber) => !present.has(pageNumber));
  if (missing.length > 0 || pageNumbers.length !== source.pageCount) {
    issues.push(issue('coverage_incomplete', 'blueprint page-frame coverage is incomplete', {
      field: 'frames',
      expected: source.pageNumbers,
      actual: pageNumbers,
    }));
  }
}

function deterministicIssues(issues: PreRenderBlueprintIssue[]): PreRenderBlueprintIssue[] {
  const seen = new Set<string>();
  return issues
    .slice()
    .sort((a, b) => {
      const left = `${a.code}\u0000${a.field ?? ''}\u0000${a.message}`;
      const right = `${b.code}\u0000${b.field ?? ''}\u0000${b.message}`;
      return lexicalCompare(left, right);
    })
    .filter((entry) => {
      const key = canonicalKey(entry);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Pure, fail-closed validation against current source/template/package authority.
 *
 * The context is required: internal self-consistency alone cannot prove that a story or package
 * has not changed since the blueprint was compiled.
 */
function validatePreRenderBookVisualBlueprintInternal(
  input: unknown,
  context: PreRenderBlueprintValidationContext,
): PreRenderBlueprintValidationResult {
  const issues: PreRenderBlueprintIssue[] = [];
  if (!isObj(input)) {
    return {
      ok: false,
      issues: [issue('schema_invalid', 'blueprint must be an object')],
    };
  }
  if (input.version !== PRE_RENDER_BOOK_VISUAL_BLUEPRINT_VERSION) {
    issues.push(issue('schema_version_unsupported', 'unsupported pre-render blueprint version', {
      field: 'version',
      expected: PRE_RENDER_BOOK_VISUAL_BLUEPRINT_VERSION,
      actual: input.version,
    }));
  }
  if (input.digestAlgorithm !== PRE_RENDER_BLUEPRINT_DIGEST_ALGORITHM) {
    issues.push(issue('schema_invalid', 'unsupported blueprint digest algorithm', {
      field: 'digestAlgorithm',
    }));
  }
  if (!isStr(input.digest) || !HEX_SHA256.test(input.digest)) {
    issues.push(issue('schema_invalid', 'blueprint digest must be lowercase SHA-256 hex', {
      field: 'digest',
    }));
  }
  if (!isObj(input.visualContract)) {
    issues.push(issue('schema_invalid', 'visualContract must be an embedded template object', {
      field: 'visualContract',
    }));
  }
  if (!isObj(input.worldPlan)) {
    issues.push(issue('schema_invalid', 'worldPlan must be an object', { field: 'worldPlan' }));
  }
  if (!Array.isArray(input.frames)) {
    issues.push(issue('schema_invalid', 'frames must be an array', { field: 'frames' }));
  }
  if (issues.some((entry) => entry.code === 'schema_invalid' && ['visualContract', 'worldPlan', 'frames'].includes(entry.field ?? ''))) {
    return { ok: false, issues: deterministicIssues(issues) };
  }

  const blueprint = input as unknown as PreRenderBookVisualBlueprint;
  try {
    const computedDigest = computePreRenderBookVisualBlueprintDigest(blueprint);
    if (blueprint.digest !== computedDigest) {
      issues.push(issue('digest_mismatch', 'blueprint content does not match its canonical digest', {
        field: 'digest',
        expected: computedDigest,
        actual: blueprint.digest,
      }));
    }
  } catch (error) {
    issues.push(issue('schema_invalid', 'blueprint content cannot be normalized for digest validation', {
      field: 'digest',
      actual: error instanceof Error ? error.message : String(error),
    }));
  }

  const templateValidation = validateBookVisualContractTemplate(blueprint.visualContract);
  const recurringPropsIndexable = recurringPropsAreIndexable(blueprint.visualContract);
  if (!templateValidation.ok || !recurringPropsIndexable) {
    issues.push(issue('visual_contract_invalid', 'embedded Visual Contract template is invalid', {
      field: 'visualContract',
      actual: [
        ...(!templateValidation.ok ? templateValidation.errors : []),
        ...(!recurringPropsIndexable
          ? ['recurringProps must be an array of objects with non-empty id and name']
          : []),
      ],
    }));
  }
  validateIdentity(input, blueprint, context, issues);
  if (!templateValidation.ok || !recurringPropsIndexable) {
    return { ok: false, issues: deterministicIssues(issues) };
  }

  const index = buildContractIndex(blueprint.visualContract);
  validateCoverage(blueprint.frames, context.source, issues);

  const worldPlan = blueprint.worldPlan;
  const rawAffordances = Array.isArray(worldPlan.affordances) ? worldPlan.affordances : [];
  const rawConnections = Array.isArray(worldPlan.connections) ? worldPlan.connections : [];
  const rawGeometry = Array.isArray(worldPlan.revealSafeSupportingGeometry)
    ? worldPlan.revealSafeSupportingGeometry
    : [];
  if (!Array.isArray(worldPlan.affordances)) {
    issues.push(issue('schema_invalid', 'worldPlan.affordances must be an array', {
      field: 'worldPlan.affordances',
    }));
  }
  if (!Array.isArray(worldPlan.connections)) {
    issues.push(issue('schema_invalid', 'worldPlan.connections must be an array', {
      field: 'worldPlan.connections',
    }));
  }
  if (!Array.isArray(worldPlan.revealSafeSupportingGeometry)) {
    issues.push(issue('schema_invalid', 'worldPlan.revealSafeSupportingGeometry must be an array', {
      field: 'worldPlan.revealSafeSupportingGeometry',
    }));
  }

  const affordances = new Map<string, BlueprintSpatialAffordance>();
  rawAffordances.forEach((affordance, offset) => {
    const field = `worldPlan.affordances[${offset}]`;
    if (!isObj(affordance)) {
      issues.push(issue('schema_invalid', 'affordance must be an object', { field }));
      return;
    }
    validateAffordanceShape(affordance, field, index, issues);
    if (isStr(affordance.id)) {
      if (affordances.has(affordance.id)) {
        issues.push(issue('reference_duplicate', `duplicate affordance id "${affordance.id}"`, {
          field: `${field}.id`,
        }));
      }
      affordances.set(affordance.id, affordance);
    }
  });

  const connections = new Map<string, BlueprintWorldConnection>();
  rawConnections.forEach((connection, offset) => {
    const field = `worldPlan.connections[${offset}]`;
    if (!isObj(connection) || !isStr(connection.id)) {
      issues.push(issue('schema_invalid', 'connection must have an id', { field }));
      return;
    }
    if (connections.has(connection.id)) {
      issues.push(issue('reference_duplicate', `duplicate connection id "${connection.id}"`, {
        field: `${field}.id`,
      }));
    }
    connections.set(connection.id, connection);
  });
  rawConnections.forEach((connection, offset) => {
    if (isObj(connection)) {
      validateConnection(connection, `worldPlan.connections[${offset}]`, index, affordances, issues);
    }
  });

  const supportingGeometry = new Map<string, RevealSafeSupportingGeometry>();
  rawGeometry.forEach((geometry, offset) => {
    const field = `worldPlan.revealSafeSupportingGeometry[${offset}]`;
    if (!isObj(geometry) || !isStr(geometry.id)) {
      issues.push(issue('schema_invalid', 'supporting geometry must have an id', { field }));
      return;
    }
    if (supportingGeometry.has(geometry.id)) {
      issues.push(issue('reference_duplicate', `duplicate supporting geometry id "${geometry.id}"`, {
        field: `${field}.id`,
      }));
    }
    supportingGeometry.set(geometry.id, geometry);
    validateSupportingGeometry(geometry, field, index, issues);
  });

  const frames = new Map<string, PortraitBlueprintFrame>();
  blueprint.frames.forEach((frame, offset) => {
    const field = `frames[${offset}]`;
    if (!isObj(frame) || !isStr(frame.id) || !['cover', 'page'].includes(String(frame.kind))) {
      issues.push(issue('schema_invalid', 'frame must have a stable id and cover|page kind', { field }));
      return;
    }
    if (frames.has(frame.id)) {
      issues.push(issue('reference_duplicate', `duplicate frame id "${frame.id}"`, {
        field: `${field}.id`,
      }));
    }
    frames.set(frame.id, frame);
  });

  rawAffordances.forEach((affordance, offset) => {
    if (isObj(affordance) && isStr(affordance.id)) {
      validateConsumerReferences({
        affordance,
        field: `worldPlan.affordances[${offset}]`,
        frames,
        index,
        issues,
      });
    }
  });

  blueprint.frames.forEach((frame, offset) => {
    if (isObj(frame) && isStr(frame.id) && (frame.kind === 'cover' || frame.kind === 'page')) {
      validateFrame({
        frame,
        field: `frames[${offset}]`,
        template: blueprint.visualContract,
        sourcePages: context.source.pageNumbers,
        index,
        affordances,
        connections,
        supportingGeometry,
        frames,
        issues,
      });
    }
  });

  const finalIssues = deterministicIssues(issues);
  return finalIssues.length === 0
    ? { ok: true, blueprint }
    : { ok: false, issues: finalIssues };
}

/**
 * Total public durable-input boundary. The validators above own precise issue collection; this deterministic
 * containment is defense in depth if an unforeseen malformed nested shape reaches a typed helper.
 */
export function validatePreRenderBookVisualBlueprint(
  input: unknown,
  context: PreRenderBlueprintValidationContext,
): PreRenderBlueprintValidationResult {
  try {
    return validatePreRenderBookVisualBlueprintInternal(input, context);
  } catch {
    return {
      ok: false,
      issues: [
        issue(
          'schema_invalid',
          'blueprint validation could not safely inspect malformed nested input',
        ),
      ],
    };
  }
}

export function assertValidPreRenderBookVisualBlueprint(
  input: unknown,
  context: PreRenderBlueprintValidationContext,
): asserts input is PreRenderBookVisualBlueprint {
  const result = validatePreRenderBookVisualBlueprint(input, context);
  if (!result.ok) throw new InvalidPreRenderBookVisualBlueprintError(result.issues);
}
