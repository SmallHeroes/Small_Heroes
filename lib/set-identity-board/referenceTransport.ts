/**
 * Set Identity Board — Milestone B: the TYPED TAGGED-REFERENCE TRANSPORT. PURE: no I/O, no env, no clock.
 *
 * Today a reference is an untyped `string` path in a positional array: the provider is handed N images and must
 * INFER what each one is for. That inference is exactly where a set board goes wrong — the model copies the board's
 * camera/framing instead of its geometry, or a style ref silently evicts an identity ref. This module makes the role
 * EXPLICIT and the budget DECIDABLE BEFORE the provider call:
 *
 *  - `orderReferenceAssets` fixes ONE priority order (identity → state/action-critical prop → required set → style).
 *  - `planReferenceAssets` evicts ONLY style, and THROWS rather than silently drop an identity/prop/set ref.
 *  - `buildImageRoleMapBlock` tells the model which image is which, by index.
 *  - `SET_REFERENCE_COPY_INSTRUCTION` fences what a set ref may contribute (geometry — never camera/layout).
 *  - `buildReferenceAssetManifestFromAssembly` is the role/order/hash proof for the render record.
 *
 * NOTE ON THE LIVE SEAM: the authoritative cap/eviction/throw for the FULL assembled ref list already lives in
 * `assembleStyle01BookReferencesWithZoneSheets` (lib/story-location-bible/zone-sheets.ts). This module does not
 * replace it — it plans the TAGGED subset before it is fed in. Absent tagged refs, everything here is a no-op.
 */
import type { BookVisualContract } from '@/lib/visual-contract-compiler';

import type { SetIdentityBoardBinding } from './types';

/** What a reference image is FOR. Drives priority, the role map, and the eviction rule. */
export type ReferenceRole = 'child' | 'companion' | 'other_character' | 'set' | 'prop' | 'style';

/**
 * One typed reference image. `url` is the locator handed to the provider; `assetSha256` fences the bytes and
 * `identityId` ties a `set` ref back to the set identity it was bound for (both proof-only — never render inputs).
 */
export interface ReferenceAsset {
  kind: ReferenceRole;
  url: string;
  assetSha256?: string;
  identityId?: string;
  /** Structured content declaration used by the page/reference compatibility fence. */
  declaredPropIds?: string[];
  /** Set-board content-policy identity, required for versioned set references. */
  contentPolicyDigest?: string;
  /** Exact approved package/catalog identity for a page-conditioned prop reference. */
  artifactIdentityDigest?: string;
}

/**
 * Raised when the REQUIRED (non-style) references alone exceed the provider's reference cap. This is a HARD failure
 * by design: every remaining ref is an identity / action-critical prop / required set board, and dropping any of them
 * silently produces a wrong-but-plausible paid page. Thrown BEFORE any provider call is made.
 */
export class ReferenceBudgetExceededError extends Error {
  /** How many REQUIRED (non-style) refs were still needed after every style ref was evicted. */
  readonly required: number;
  /** The provider's maximum reference count. */
  readonly cap: number;

  constructor(required: number, cap: number) {
    super(
      `[reference_transport] required reference budget exceeded (${required}/${cap}) — ` +
        `identity, prop, and set-board refs must never be silently evicted`
    );
    this.name = 'ReferenceBudgetExceededError';
    this.required = required;
    this.cap = cap;
    // Restore the prototype chain so `instanceof` survives the ES5 `extends Error` downlevel.
    Object.setPrototypeOf(this, ReferenceBudgetExceededError.prototype);
  }
}

/**
 * The REQUIRED priority order. Identity first (the child is what the book is sold on), then the state/action-critical
 * prop, then the required set board, then style last — style is the ONLY droppable tier, so it sorts last.
 */
const ROLE_PRIORITY: readonly ReferenceRole[] = [
  'child',
  'companion',
  'other_character',
  'prop',
  'set',
  'style',
];

/** Human-readable role label used in the image role map. Deterministic, one per role. */
const ROLE_LABEL: Readonly<Record<ReferenceRole, string>> = {
  child: 'child identity reference',
  companion: 'companion identity reference',
  other_character: 'other character identity reference',
  prop: 'prop identity reference',
  set: 'set identity board',
  style: 'style reference',
};

/** A ref that is NOT droppable under budget pressure. Everything except `style`. */
function isRequiredRole(role: ReferenceRole): boolean {
  return role !== 'style';
}

/**
 * Sort into the required priority order. STABLE within a role: two assets of the same role keep their input order,
 * so a caller's authored ordering (e.g. companion 1 before companion 2) survives.
 */
export function orderReferenceAssets(assets: ReferenceAsset[]): ReferenceAsset[] {
  return assets
    .map((asset, index) => ({ asset, index }))
    .sort((a, b) => {
      const pa = ROLE_PRIORITY.indexOf(a.asset.kind);
      const pb = ROLE_PRIORITY.indexOf(b.asset.kind);
      if (pa !== pb) return pa - pb;
      return a.index - b.index; // stable within a role
    })
    .map((entry) => entry.asset);
}

/**
 * Order the assets, then fit them to `cap` by evicting ONLY style refs, LAST-FIRST (the least-important style ref
 * goes first). If the REQUIRED refs alone still exceed the cap, THROW `ReferenceBudgetExceededError` — never silently
 * drop an identity / prop / set ref.
 *
 * `evicted` is returned in EVICTION order (last style ref first), so a log reads as the order things were dropped.
 */
export function planReferenceAssets(
  assets: ReferenceAsset[],
  cap: number
): { ordered: ReferenceAsset[]; evicted: ReferenceAsset[] } {
  const ordered = orderReferenceAssets(assets);
  const requiredCount = ordered.filter((a) => isRequiredRole(a.kind)).length;

  // Fail BEFORE any provider call: no amount of style eviction can fit these.
  if (requiredCount > cap) {
    throw new ReferenceBudgetExceededError(requiredCount, cap);
  }

  const kept = ordered.slice();
  const evicted: ReferenceAsset[] = [];
  // Style sorts last, so the tail is style — pop until we fit. Guarded by the check above, which guarantees we can.
  while (kept.length > cap && kept.length > 0 && kept[kept.length - 1].kind === 'style') {
    evicted.push(kept.pop() as ReferenceAsset);
  }

  return { ordered: kept, evicted };
}

/**
 * The explicit image→role map for a TAGGED SUBSET, 1-indexed in the given (already-ordered) array order.
 *
 * ⚠ INDEX SAFETY: this is only correct when the tagged array IS the whole provider array. On the live Style-01 path
 * it is NOT — the provider array is assembled elsewhere and contains untagged refs (child/companion/style) too. Use
 * `buildImageRoleMapFromAssembly` there. Kept for callers whose tagged set is the complete array.
 */
export function buildImageRoleMapBlock(ordered: ReferenceAsset[]): string {
  if (ordered.length === 0) return '';
  const lines = ordered.map((asset, i) => `Image ${i + 1} -> ${ROLE_LABEL[asset.kind]}`);
  return ['IMAGE ROLE MAP:', ...lines].join('\n');
}

/**
 * Breakdown-bucket key → the ROLE that bucket carries AND the LABEL the role map prints for it. The buckets ARE the
 * roles on the assembled Style-01 path.
 *
 * ONE SOURCE OF TRUTH, deliberately: the prompt's role map (`buildImageRoleMapFromAssembly`) and the proof manifest
 * (`buildReferenceAssetManifestFromAssembly`) both derive from this via `describeAssembledReferences`, so a slot can
 * never be labelled one thing to the model and recorded as another in the render record.
 *
 * `label` is NOT always `ROLE_LABEL[role]`: `setAppearanceBoard` and `contractSetSheets` are both the `set` ROLE but
 * are different BOARDS, and the prompt says which one it is handing over. The manifest only needs the role.
 */
const BREAKDOWN_BUCKET: Readonly<Record<string, { role: ReferenceRole; label: string }>> = {
  child: { role: 'child', label: ROLE_LABEL.child },
  companion: { role: 'companion', label: ROLE_LABEL.companion },
  otherCharacters: { role: 'other_character', label: ROLE_LABEL.other_character },
  setAppearanceBoard: { role: 'set', label: 'set appearance board' },
  contractSetSheets: { role: 'set', label: ROLE_LABEL.set },
  contractPropSheets: { role: 'prop', label: ROLE_LABEL.prop },
  objectAnchors: { role: 'prop', label: ROLE_LABEL.prop },
  isolatedObjects: { role: 'prop', label: ROLE_LABEL.prop },
  style: { role: 'style', label: ROLE_LABEL.style },
};

/**
 * The role recorded in the manifest. `'unknown'` is REACHABLE ONLY off the live path (every assembled path comes out
 * of a breakdown bucket by construction — see `rebuildPaths` in zone-sheets.ts) and exists so an unrecognised slot is
 * recorded as unknown rather than GUESSED. This is a proof record: an honest 'unknown' beats a confident lie.
 */
export type ManifestRole = ReferenceRole | 'unknown';

/** One slot of the ACTUAL assembled provider array: its 1-indexed position, its url, its role, and its prompt label. */
export interface AssembledReferenceSlot {
  /** 1-indexed position in the ASSEMBLED array — matches the `Image N` line of the role map. */
  order: number;
  url: string;
  role: ManifestRole;
  label: string;
}

/**
 * Walk the ACTUAL assembled provider array and describe each slot from the `breakdown` bucket that contains it.
 *
 * The ONLY index-safe derivation, and the shared base of both the role map and the manifest. First bucket to claim a
 * path wins (`objectAnchors` and `isolatedObjects` legitimately overlap — both are `prop`, so the winner is moot).
 * A path in an unrecognised bucket keeps the bucket key as its label; a path in NO bucket is `'reference'`/`'unknown'`.
 */
export function describeAssembledReferences(
  orderedPaths: readonly string[],
  breakdown: Readonly<Record<string, string[]>>
): AssembledReferenceSlot[] {
  const bucketOf = new Map<string, { role: ManifestRole; label: string }>();
  for (const [key, paths] of Object.entries(breakdown ?? {})) {
    const claim = BREAKDOWN_BUCKET[key] ?? { role: 'unknown' as const, label: key };
    for (const p of paths ?? []) {
      if (p && !bucketOf.has(p)) bucketOf.set(p, claim);
    }
  }
  return orderedPaths.map((p, i) => {
    const claim = bucketOf.get(p);
    return {
      order: i + 1,
      url: p,
      role: claim?.role ?? 'unknown',
      label: claim?.label ?? 'reference',
    };
  });
}

/**
 * The image→role map derived from the ACTUAL assembled provider array — the only INDEX-SAFE source.
 *
 * The live Style-01 array is assembled by `assembleStyle01BookReferencesWithZoneSheets` as
 * child → companion → setAppearanceBoard → contractPropSheets → contractSetSheets → objectAnchors →
 * otherCharacters → style. A map built
 * from the tagged SUBSET alone would confidently claim `Image 1 -> set identity board` while the provider's image 1
 * is the child anchor — and a confidently WRONG map steers worse than no map at all. So the map is built by walking
 * the assembled `orderedPaths` and labelling each slot from the `breakdown` bucket that contains it.
 *
 * Empty array → empty string (caller may prepend unconditionally).
 */
export function buildImageRoleMapFromAssembly(
  orderedPaths: readonly string[],
  breakdown: Readonly<Record<string, string[]>>
): string {
  if (orderedPaths.length === 0) return '';
  const lines = describeAssembledReferences(orderedPaths, breakdown).map(
    (slot) => `Image ${slot.order} -> ${slot.label}`
  );
  return ['IMAGE ROLE MAP:', ...lines].join('\n');
}

/**
 * The `set` role fence. A set board is an EMPTY REFERENCE PLATE — it exists to pin what the room IS (geometry,
 * materials, lighting), not how a page is shot. Without this, the model treats the board like a page and copies its
 * camera/framing, and every page in that set comes back looking like the board.
 */
export const SET_REFERENCE_COPY_INSTRUCTION = [
  'SET REFERENCE USE:',
  'From the set identity board, copy ONLY the set identity: geometry, materials, and lighting.',
  'NEVER copy camera, page layout, framing, pose, or composition from the set reference.',
  'The set reference is an empty reference plate, not a page.',
].join('\n');

export const PROP_REFERENCE_COPY_INSTRUCTION = [
  'PROP REFERENCE USE:',
  'From a prop reference, copy ONLY that prop identity, material, scale, and stable design.',
  'NEVER copy the neutral background, sheet layout, camera, framing, pose, or composition.',
  'Place the prop only where the authoritative page contract requires it.',
].join('\n');

/** One manifest row: the durable role/order/hash proof for a single reference image. */
export interface ReferenceAssetManifestEntry {
  order: number;
  role: ManifestRole;
  url: string;
  assetSha256?: string;
  identityId?: string;
  declaredPropIds?: string[];
  contentPolicyDigest?: string;
  artifactIdentityDigest?: string;
}

/**
 * The role/order/hash proof for a TAGGED SUBSET, 1-indexed in the given (already-ordered) array order.
 *
 * ⚠ INDEX SAFETY: same caveat as `buildImageRoleMapBlock` — this is only correct when the tagged array IS the whole
 * provider array. On the live Style-01 path it is NOT, so `order` here would renumber the tagged refs from 1 and the
 * record would claim the set board sat in slot 1 while the provider put it in slot 3. A proof record that lies about
 * which slot a ref occupied is worse than no record. Use `buildReferenceAssetManifestFromAssembly` there. Kept for
 * callers whose tagged set is the complete array.
 */
export function buildReferenceAssetManifest(ordered: ReferenceAsset[]): ReferenceAssetManifestEntry[] {
  return ordered.map((asset, i) => ({
    order: i + 1,
    role: asset.kind,
    url: asset.url,
    assetSha256: asset.assetSha256,
    identityId: asset.identityId,
    declaredPropIds: asset.declaredPropIds,
    contentPolicyDigest: asset.contentPolicyDigest,
    artifactIdentityDigest: asset.artifactIdentityDigest,
  }));
}

/**
 * The role/order/hash proof derived from the ACTUAL assembled provider array — the only INDEX-SAFE source, and the
 * INDEX-FOR-INDEX twin of `buildImageRoleMapFromAssembly` (both walk `describeAssembledReferences`, so what the prompt
 * tells the model and what the record proves can never diverge).
 *
 * `order`/`role`/`url` come from the ASSEMBLED array: a board the provider received as Image 3 is recorded as order 3,
 * NOT renumbered to 1 as a subset-derived manifest would. `assetSha256`/`identityId` are the fences that only the
 * TAGGED asset knows, carried over by url match and OMITTED when the slot has no tagged twin (an untagged child/style
 * ref has no sha to prove) — never invented.
 */
export function buildReferenceAssetManifestFromAssembly(
  orderedPaths: readonly string[],
  breakdown: Readonly<Record<string, string[]>>,
  tagged: readonly ReferenceAsset[]
): ReferenceAssetManifestEntry[] {
  const taggedByUrl = new Map<string, ReferenceAsset>();
  for (const asset of tagged ?? []) {
    if (asset && typeof asset.url === 'string' && !taggedByUrl.has(asset.url)) {
      taggedByUrl.set(asset.url, asset);
    }
  }

  return describeAssembledReferences(orderedPaths, breakdown).map((slot) => {
    const twin = taggedByUrl.get(slot.url);
    const entry: ReferenceAssetManifestEntry = { order: slot.order, role: slot.role, url: slot.url };
    if (twin?.assetSha256 !== undefined) entry.assetSha256 = twin.assetSha256;
    if (twin?.identityId !== undefined) entry.identityId = twin.identityId;
    if (twin?.declaredPropIds !== undefined) entry.declaredPropIds = twin.declaredPropIds;
    if (twin?.contentPolicyDigest !== undefined) entry.contentPolicyDigest = twin.contentPolicyDigest;
    if (twin?.artifactIdentityDigest !== undefined) entry.artifactIdentityDigest = twin.artifactIdentityDigest;
    return entry;
  });
}

/**
 * Resolve the board reference for ONE location, fail-closed.
 *
 * `locationId` → that location's `setIdentityId` (falling back to the location id itself, matching
 * `groupLocationsBySetIdentity`) → `bindings[identityId]`. Returns `undefined` when the location is unknown, has no
 * binding, or the binding carries no usable url.
 *
 * NEVER returns another location's board: the identity is derived from the location itself, and a binding whose own
 * `setIdentityId` disagrees with the key it is filed under is treated as mis-wired and REJECTED rather than used.
 */
export function selectBoardRefForLocation(args: {
  contract: BookVisualContract;
  bindings: Record<string, SetIdentityBoardBinding>;
  locationId: string;
}): ReferenceAsset | undefined {
  const { contract, bindings, locationId } = args;

  const location = (contract.locations ?? []).find((l) => l && l.id === locationId);
  if (!location) return undefined; // unknown location → no board

  const identityId = location.setIdentityId ?? location.id;

  const binding = Object.prototype.hasOwnProperty.call(bindings ?? {}, identityId)
    ? bindings[identityId]
    : undefined;
  if (!binding) return undefined; // unbound identity → no board

  // Cross-wire fence: a binding filed under one identity but self-declaring another is not trustworthy.
  if (binding.setIdentityId !== identityId) return undefined;

  const url = binding.resolvedUrl;
  if (typeof url !== 'string' || url.trim().length === 0) return undefined; // no usable url → no board

  return {
    kind: 'set',
    url,
    assetSha256: binding.assetSha256,
    identityId,
    declaredPropIds: binding.declaredPropIds,
    contentPolicyDigest: binding.contentPolicyDigest,
  };
}
