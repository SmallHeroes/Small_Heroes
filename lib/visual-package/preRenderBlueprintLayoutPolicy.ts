import type { BlueprintRegion } from './preRenderBlueprintTypes';

export const PRE_RENDER_BLUEPRINT_LAYOUT_POLICY_VERSION =
  'portrait-layout-compatibility/v1' as const;

export interface PreRenderBlueprintLayoutCompatibilityPolicy {
  version: typeof PRE_RENDER_BLUEPRINT_LAYOUT_POLICY_VERSION;
  aspectRatio: '2:3';
  coordinateSpace: 'portrait-normalized-1000';
  cover: {
    zone: 'top_clear';
    x: 0;
    y: 0;
    width: 1000;
    minHeight: 250;
    maxHeight: 350;
  };
  body: {
    zone: 'bottom_clear';
    x: 0;
    bottom: 1000;
    width: 1000;
    minHeight: 250;
    maxHeight: 350;
  };
  remapPolicy: 'reject';
}

/** Byte-stable shared authoring/package/runtime policy. */
export const PRE_RENDER_BLUEPRINT_LAYOUT_POLICY: PreRenderBlueprintLayoutCompatibilityPolicy =
  {
    version: PRE_RENDER_BLUEPRINT_LAYOUT_POLICY_VERSION,
    aspectRatio: '2:3',
    coordinateSpace: 'portrait-normalized-1000',
    cover: {
      zone: 'top_clear',
      x: 0,
      y: 0,
      width: 1000,
      minHeight: 250,
      maxHeight: 350,
    },
    body: {
      zone: 'bottom_clear',
      x: 0,
      bottom: 1000,
      width: 1000,
      minHeight: 250,
      maxHeight: 350,
    },
    remapPolicy: 'reject',
  };

export type PreRenderBlueprintFrameKind = 'cover' | 'page';

function isIntegerRegion(value: unknown): value is BlueprintRegion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const region = value as Record<string, unknown>;
  return [region.x, region.y, region.width, region.height].every(
    (entry) => typeof entry === 'number' && Number.isInteger(entry),
  );
}

/** The compiler-owned default. Providers and package/runtime adapters never author or remap it. */
export function canonicalPreRenderBlueprintTextSafeRegion(
  kind: PreRenderBlueprintFrameKind,
): BlueprintRegion {
  if (kind === 'cover') {
    const policy = PRE_RENDER_BLUEPRINT_LAYOUT_POLICY.cover;
    return { x: policy.x, y: policy.y, width: policy.width, height: policy.minHeight };
  }
  const policy = PRE_RENDER_BLUEPRINT_LAYOUT_POLICY.body;
  return {
    x: policy.x,
    y: policy.bottom - policy.minHeight,
    width: policy.width,
    height: policy.minHeight,
  };
}

/** Exact representability predicate shared by Blueprint, Visual Package, and runtime. */
export function preRenderBlueprintTextSafeRegionIsSupported(
  kind: PreRenderBlueprintFrameKind,
  value: unknown,
): value is BlueprintRegion {
  if (!isIntegerRegion(value)) return false;
  if (kind === 'cover') {
    const policy = PRE_RENDER_BLUEPRINT_LAYOUT_POLICY.cover;
    return (
      value.x === policy.x &&
      value.y === policy.y &&
      value.width === policy.width &&
      value.height >= policy.minHeight &&
      value.height <= policy.maxHeight
    );
  }
  const policy = PRE_RENDER_BLUEPRINT_LAYOUT_POLICY.body;
  return (
    value.x === policy.x &&
    value.width === policy.width &&
    value.y + value.height === policy.bottom &&
    value.height >= policy.minHeight &&
    value.height <= policy.maxHeight
  );
}

export function preRenderBlueprintTextZone(
  kind: PreRenderBlueprintFrameKind,
): 'top_clear' | 'bottom_clear' {
  return kind === 'cover'
    ? PRE_RENDER_BLUEPRINT_LAYOUT_POLICY.cover.zone
    : PRE_RENDER_BLUEPRINT_LAYOUT_POLICY.body.zone;
}
