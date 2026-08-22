export const STAGE0_ANCHOR_DEFAULT_MAX_ATTEMPTS = 4 as const;
export const STAGE0_ANCHOR_MIN_ATTEMPTS = 1 as const;
export const STAGE0_ANCHOR_MAX_ATTEMPTS = 6 as const;

export function resolveStage0AnchorMaxAttempts(
  rawValue: string | undefined = process.env.CHILD_ANCHOR_MAX_ATTEMPTS,
): number {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  const requested = parsed || STAGE0_ANCHOR_DEFAULT_MAX_ATTEMPTS;
  return Math.min(
    STAGE0_ANCHOR_MAX_ATTEMPTS,
    Math.max(STAGE0_ANCHOR_MIN_ATTEMPTS, requested),
  );
}
