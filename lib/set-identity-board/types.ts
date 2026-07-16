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

/** Version of the SET projection + prompt derivation. Bump to force every board to be re-minted. */
export const SET_IDENTITY_BOARD_VERSION = 'set-board/v1' as const;

/** Version of the on-disk registry entry schema. Bump to invalidate previously-saved registry entries. */
export const SET_IDENTITY_REGISTRY_VERSION = 'set-registry/v1' as const;

/** A location as it appears in the SET-only projection (set facts only — no cast/appearance/page data). */
export interface SetDefinitionLocation {
  id: string;
  description: string;
  timeOfDay?: string;
  lighting?: string;
  environmentClass?: string;
  anchors: Array<{ id: string; description: string }>;
  topology?: string;
}

/** A zone as it appears in the SET-only projection. Nodes/relations in authored DECLARATION order (hash-significant). */
export interface SetDefinitionZone {
  id: string;
  name?: string;
  description?: string;
  spatialNodes: SpatialNode[];
  spatialRelations: SpatialRelation[];
  /** Deterministic prose projection of the zone geometry (`projectZoneStableGeometry(zone) ?? []`). */
  geometry: string[];
}

/** A fixed set fact = a recurring prop bound INTO the set geometry (via a `{kind:'prop'}` spatialNode `bindsTo`). */
export interface SetDefinitionFixedFact {
  propId: string;
  material?: string;
  scale?: string;
}

/**
 * The SET-only projection that gets hashed. Contains ONLY set-relevant, reusable facts — deliberately NO cast, NO
 * humanCast, NO page camera/action, NO transient prop state, NO firstRevealPage, NO family/appearance, NO order data.
 * Two contracts that differ only in those excluded dimensions project to an IDENTICAL `SetDefinition` (same hash).
 */
export interface SetDefinition {
  boardVersion: string;
  storyKey: string;
  styleId: string;
  setIdentityId: string;
  locations: SetDefinitionLocation[];
  zones: SetDefinitionZone[];
  fixedSetFacts: SetDefinitionFixedFact[];
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
 */
export interface SetIdentityBoardBinding {
  setIdentityId: string;
  setDefinitionHash: string;
  styleId: string;
  storageKey: string;
  resolvedUrl?: string;
  assetSha256: string;
  boardVersion: string;
  approvedAt: string;
}

/**
 * The set of board bindings for one order, pinned to the order's frozen contract hash. `mode:'required-v1'` marks
 * that every board-required set identity MUST have a binding (fail-closed) — enforcement is a later milestone.
 */
export interface SetIdentityBoardBindingContext {
  mode: 'required-v1';
  frozenContractHash: string;
  bindings: Record<string, SetIdentityBoardBinding>;
}

/** Result of the character-free QA pass over a rendered board image. */
export interface BoardQaResult {
  qaStatus: 'passed' | 'failed';
  qaFlags: string[];
}
