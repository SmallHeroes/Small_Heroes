import type { RuntimeBlueprintFrameProjection } from './runtime-blueprint-projection';

export type ProviderImageCanvas =
  | '1024x1024'
  | '1024x1536'
  | '1536x1536';

export const PVB_PORTRAIT_PROVIDER_CANVAS =
  '1024x1536' as const satisfies ProviderImageCanvas;

export class RuntimeBlueprintCanvasError extends Error {
  constructor(message: string) {
    super(`[runtime_blueprint_canvas] ${message}`);
    this.name = 'RuntimeBlueprintCanvasError';
  }
}

function isExactRegion(
  value: unknown,
  expected: { x: number; y: number; width: number; height: number },
): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const region = value as Record<string, unknown>;
  return (
    region.x === expected.x &&
    region.y === expected.y &&
    region.width === expected.width &&
    region.height === expected.height
  );
}

/**
 * Final provider-seam canvas authority.
 *
 * Legacy callers supply their already-resolved canvas unchanged. An authoritative
 * PVB frame must match the exact currently approved portrait policy and always
 * resolves to 1024x1536; mutable PDF/preview flags cannot quantize or remap it.
 */
export function resolveRuntimeBlueprintProviderCanvas(args: {
  frame?: RuntimeBlueprintFrameProjection | null;
  legacyCanvas: ProviderImageCanvas;
}): ProviderImageCanvas {
  if (!args.frame) return args.legacyCanvas;

  const frame = args.frame as RuntimeBlueprintFrameProjection & {
    layoutPlan?: Record<string, unknown>;
  };
  const layout = frame.layoutPlan;
  if (
    !layout ||
    layout.aspectRatio !== '2:3' ||
    layout.coordinateSpace !== 'portrait-normalized-1000' ||
    layout.remapPolicy !== 'reject'
  ) {
    throw new RuntimeBlueprintCanvasError(
      `frame ${frame.frameId} has unsupported layout; expected exact 2:3 portrait-normalized-1000 with remapPolicy=reject`,
    );
  }

  const isCover = frame.pageNumber === 0;
  const expectedTextZone = isCover ? 'top_clear' : 'bottom_clear';
  const expectedRegion = isCover
    ? { x: 0, y: 0, width: 1000, height: 250 }
    : { x: 0, y: 750, width: 1000, height: 250 };
  if (
    layout.textZone !== expectedTextZone ||
    !isExactRegion(layout.textSafeRegion, expectedRegion)
  ) {
    throw new RuntimeBlueprintCanvasError(
      `frame ${frame.frameId} is not exactly representable by the approved ${expectedTextZone} portrait policy; remap rejected`,
    );
  }

  return PVB_PORTRAIT_PROVIDER_CANVAS;
}

/**
 * Adapter for older orchestration APIs that still expose only a PDF boolean.
 * An authoritative frame is validated immediately and neutralizes that legacy
 * square-render hint. The final provider seam validates the frame again.
 */
export function resolveRuntimeBlueprintPdfOptimization(args: {
  frame?: RuntimeBlueprintFrameProjection | null;
  legacyPdfEnabled: boolean;
}): boolean {
  if (!args.frame) return args.legacyPdfEnabled;
  resolveRuntimeBlueprintProviderCanvas({
    frame: args.frame,
    legacyCanvas: args.legacyPdfEnabled ? '1536x1536' : '1024x1536',
  });
  return false;
}
