/**
 * The current engine for paid/QA customer orders on the hosted site (no local grants, no CLI).
 *
 * One explicit, versioned bundle: every additive policy the owner-run local books proved (response schema,
 * accepted-board child binding, ownership-aware location sheets v2, source concurrency, the Image2.6 model),
 * plus two hosted mechanics: the Opus author runs through the Anthropic Message Batches API (so no step
 * exceeds a serverless invocation) and a held initial storyboard gets the engine's ordinary bounded repairs
 * automatically. Absent, a customer authority keeps the historical recipe and wire bytes exactly.
 */
export const ENGINE_CURRENT_CUSTOMER = 'customer-current-engine/v1' as const;
export const ENGINE_AUTHOR_BATCH = 'anthropic-message-batch/v1' as const;
/** The base storyboard ceiling: the first plan plus two focused repairs. No owner extension is implied. */
export const CUSTOMER_STORYBOARD_REPAIR_STEPS = Object.freeze(['initial_storyboard_repair_1', 'initial_storyboard_repair_2'] as const);

export function isCurrentCustomerEngine(authority: { purpose: string; currentEngine?: string }) {
  return authority.purpose === 'customer' && authority.currentEngine === ENGINE_CURRENT_CUSTOMER;
}
