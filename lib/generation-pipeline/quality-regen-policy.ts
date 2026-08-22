/** Durable per-artifact image-regeneration budget: one candidate plus two replacements. */
export const QUALITY_REGEN_BUDGET = 2 as const;

/**
 * Shared Page Visual QA policy resolver. The environment may lower the durable
 * budget but can never raise it above the evidence gate's canonical authority.
 */
export function resolvePageVisualQaMaxRegens(
  rawValue: string | undefined = process.env.PAGE_VISUAL_QA_MAX_REGENS,
): number {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  const requested = parsed || QUALITY_REGEN_BUDGET;
  return Math.min(QUALITY_REGEN_BUDGET, Math.max(0, requested));
}
