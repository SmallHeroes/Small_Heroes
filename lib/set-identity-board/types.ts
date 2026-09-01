/**
 * Set Identity Board — Milestone A types (PURE, offline; NO live-path wiring).
 *
 * A "Set Identity Board" is ONE reusable, character-free establishing reference for a physical SET (one or more
 * `VisualLocation`s that share a `setIdentityId`). It is derived deterministically from the frozen visual contract
 * — the SET-only projection (`SetDefinition`) — and, once rendered + human-approved, lives in a GLOBAL registry
 * keyed by its `setDefinitionHash`. This file defines only the data shapes; all derivation is in `setDefinition.ts`
 * / `boardPrompt.ts` and all validation is in `registry.ts`.
 *
 * Design invariants encoded here:
 *  - ZERO story-specific literals. Every field is contract-derived and reusable across any story/style.
 *  - The board is keyed by a HASH of the SET projection, so family/appearance/camera/prop-state changes (which are
 *    NOT part of the set) never invalidate an approved board.
 *  - Human approval is EXPLICIT and never auto-set (see `registry.ts`); a candidate is minted `pending`.
 */
import type { SpatialNode, SpatialRelation } from '@/lib/visual-contract-compiler';

/** Version of the spoiler-neutral SET projection + prompt derivation. */
export const SET_IDENTITY_BOARD_VERSION = 'set-board/v6' as const;

/** Version of the on-disk registry entry schema. Bump to invalidate previously-saved registry entries. */
export const SET_IDENTITY_REGISTRY_VERSION = 'set-registry/v6' as const;

/** Version of the declared board-content policy carried through registry/package/runtime identities. */
export const SET_BOARD_CONTENT_POLICY_VERSION = 'set-board-content/v5' as const;

/** Version of the bounded non-narrative dressing range carried by every current Set Definition. */
export const SET_BOARD_AMBIENT_DRESSING_POLICY_VERSION =
  'set-board-ambient-dressing/v2' as const;

export const SET_BOARD_AMBIENT_PALETTE_COLOR_FAMILIES = [
  'sage_green',
  'teal',
  'muted_violet',
  'ochre',
  'natural_linen',
] as const;

export type SetBoardAmbientPaletteColorFamily =
  (typeof SET_BOARD_AMBIENT_PALETTE_COLOR_FAMILIES)[number];

export const SET_BOARD_AMBIENT_PALETTE_TARGETS = [
  'large_soft_furnishings_and_bedding',
  'toy_clothing',
] as const;

export type SetBoardAmbientPaletteTarget =
  (typeof SET_BOARD_AMBIENT_PALETTE_TARGETS)[number];

export const SET_BOARD_AMBIENT_DRESSING_CATEGORIES = [
  'fixed_practical_light',
  'books_without_readable_text',
  'soft_furnishing',
  'toy_storage_and_blocks',
  'clearly_inanimate_cloth_doll',
  'non_text_wall_decor',
  'plant',
  'ordinary_storage',
  'surface_detail',
] as const;

export type SetBoardAmbientDressingCategory =
  (typeof SET_BOARD_AMBIENT_DRESSING_CATEGORIES)[number];

export interface SetBoardAmbientDressingPolicy {
  version: typeof SET_BOARD_AMBIENT_DRESSING_POLICY_VERSION;
  density: 'rich_lived_in';
  selectionMode: 'space_appropriate_subset';
  minimumDistinctDetails: 4;
  allowedCategories: SetBoardAmbientDressingCategory[];
  inanimateOnly: true;
  textFree: true;
  spoilerNeutral: true;
  paletteIntent: 'balanced_child_friendly';
  preferredColorFamilies: SetBoardAmbientPaletteColorFamily[];
  paletteTargets: SetBoardAmbientPaletteTarget[];
  isolatedPinkAccentAllowed: true;
  avoidDominantGenderCoding: true;
}

/** Version of the structured cast/undeclared-prop guard carried by every direct prompt input. */
export const LEGACY_SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION =
  'set-board-positive-authority/v1' as const;
export const SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION =
  'set-board-positive-authority/v2' as const;
/**
 * Precise matcher semantics for definitions that the stricter v2 matcher
 * rejects only because physical modifier/semantic-head tokens collide with
 * cast or prop vocabulary. Clean v2 definitions deliberately remain v2 so
 * already-approved Registry identities do not drift.
 */
export const SET_BOARD_POSITIVE_AUTHORITY_PRECISE_POLICY_VERSION =
  'set-board-positive-authority/v3' as const;
/**
 * Context-bound precision for definitions that remain rejected by v3 only
 * because a physical fixture modifier or a human-role context qualifier
 * collides with cast vocabulary. V2/v3 semantics remain immutable.
 */
export const SET_BOARD_POSITIVE_AUTHORITY_CONTEXTUAL_POLICY_VERSION =
  'set-board-positive-authority/v4' as const;

export type SetBoardPositiveAuthorityPolicyVersion =
  | typeof SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION
  | typeof SET_BOARD_POSITIVE_AUTHORITY_PRECISE_POLICY_VERSION
  | typeof SET_BOARD_POSITIVE_AUTHORITY_CONTEXTUAL_POLICY_VERSION;

/** A location as it appears in the SET-only projection (set facts only — no cast/appearance/page data). */
export interface SetDefinitionLocation {
  id: string;
  name: string;
  timeOfDay?: string;
  lighting?: string;
  environmentClass?: string;
}

/** A zone as it appears in the SET-only projection. Nodes/relations in authored DECLARATION order (hash-significant). */
export interface SetDefinitionZone {
  id: string;
  locationId: string;
  spatialNodes: SpatialNode[];
  spatialRelations: SpatialRelation[];
  /** Deterministic spoiler-neutral prose projection using local node aliases rather than authored ids. */
  geometry: string[];
}

export interface SetDefinitionFixedFactPlacement {
  zoneId: string;
  nodeId: string;
  nodeKind: SpatialNode['kind'];
}

/** A fixed prop that is safe on every cover/page consuming this board. */
export interface SetDefinitionFixedFact {
  propId: string;
  name: string;
  material?: string;
  scale?: string;
  quantity: number;
  placements: SetDefinitionFixedFactPlacement[];
}

export type SetBoardExclusionReason = 'lifecycle' | 'page_forbidden';

export interface SetBoardExcludedProp {
  propId: string;
  name: string;
  reasons: SetBoardExclusionReason[];
}

export interface SetBoardContentPolicy {
  version: typeof SET_BOARD_CONTENT_POLICY_VERSION;
  includedPropIds: string[];
  excludedProps: SetBoardExcludedProp[];
  /** Non-story dressing is a bounded generative range; approved bytes lock its exact visual realization. */
  ambientDressing: SetBoardAmbientDressingPolicy;
}

export interface SetBoardBlockedCastIdentity {
  castId: string;
  labels: string[];
}

export interface SetBoardBlockedPropIdentity {
  propId: string;
  name: string;
}

export interface SetBoardPositiveAuthorityPolicy {
  version: SetBoardPositiveAuthorityPolicyVersion;
  blockedCast: SetBoardBlockedCastIdentity[];
  /** Every recurring prop not explicitly listed in `contentPolicy.includedPropIds`. */
  blockedProps: SetBoardBlockedPropIdentity[];
}

/**
 * The SET-only projection. Its physical authority, content policy, and blocked-prop policy get hashed; blocked-cast
 * evidence remains guard-only so cast/family changes never invalidate an otherwise identical reusable board. It
 * deliberately contains NO page camera/action, transient prop state, family appearance, or order data.
 */
export interface SetDefinition {
  boardVersion: string;
  storyKey: string;
  styleId: string;
  setIdentityId: string;
  locations: SetDefinitionLocation[];
  zones: SetDefinitionZone[];
  fixedSetFacts: SetDefinitionFixedFact[];
  contentPolicy: SetBoardContentPolicy;
  /** Guard-only structured evidence. It is never emitted into positive or negative prompt prose. */
  positiveAuthorityPolicy: SetBoardPositiveAuthorityPolicy;
}

/**
 * A GLOBAL registry entry for an approved (or candidate) board. Keyed logically by
 * `(storyKey, setIdentityId, styleId, setDefinitionHash, boardVersion)` — see `computeExpectedRegistryKey`.
 *
 * `storageKey` is the durable, environment-independent locator for the board bytes; any resolved URL is
 * env-specific and advisory only. `assetSha256` fences the bytes: a re-render that changes them invalidates the
 * entry. `approvedBy`/`approvedAt` are the human-approval gate — both non-empty ONLY after an explicit human sign-off;
 * code never auto-approves (a freshly minted candidate carries `null`/`null` + `qaStatus:'pending'`).
 */
export interface SetIdentityBoardRegistryEntry {
  registryVersion: string;
  boardVersion: string;
  storyKey: string;
  setIdentityId: string;
  styleId: string;
  setDefinitionHash: string;
  contentPolicyDigest: string;
  declaredPropIds: string[];
  storageKey: string;
  assetSha256: string;
  promptHash: string;
  model: string;
  quality: string;
  qaStatus: 'passed' | 'failed' | 'pending';
  qaCheckedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
}

/**
 * A per-order binding of an approved board into a frozen render context. Carries the durable `storageKey`
 * (authority) and an optional resolved URL (advisory) plus the fences needed to re-verify at bind time.
 *
 * (Milestone C) A `type` alias, NOT an `interface`, and it must stay one: from Milestone C this shape is a field of
 * `PipelineCache`, which has to remain structurally assignable to `Prisma.InputJsonValue`. TypeScript gives type
 * aliases an implicit index signature and interfaces none, so `interface` here breaks every
 * `pipelineCache: cache` write in the repo. Same reason `PipelineCache.visualContract` is stored as opaque JSON.
 */
export type SetIdentityBoardBinding = {
  setIdentityId: string;
  setDefinitionHash: string;
  contentPolicyDigest: string;
  declaredPropIds: string[];
  styleId: string;
  storageKey: string;
  resolvedUrl?: string;
  assetSha256: string;
  boardVersion: string;
  approvedAt: string;
};

/**
 * The set of board bindings for one order, pinned to the order's frozen contract hash. `mode:'required-v2'` marks
 * that every board-required set identity MUST have a binding (fail-closed) — enforced from Milestone C by
 * `assertBoardsBoundForRender` before any paid image.
 *
 * (Milestone C) A `type` alias, not an `interface` — see `SetIdentityBoardBinding` above; this shape is persisted
 * in `PipelineCache` and must stay assignable to `Prisma.InputJsonValue`.
 */
export type SetIdentityBoardBindingContext = {
  mode: 'required-v2';
  frozenContractHash: string;
  bindings: Record<string, SetIdentityBoardBinding>;
};

/** Result of the character-free QA pass over a rendered board image. */
export interface BoardQaResult {
  qaStatus: 'passed' | 'failed';
  qaFlags: string[];
}
