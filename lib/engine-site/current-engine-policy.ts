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
/**
 * customer-current-engine/v2: v1 exactly, plus (1) ONE bound storyboard repair and its review after a held bound review
 * (storyboard-bound-repair/v1), whose two slots take the place of the legacy prep_storyboard_0 pair this bundle never uses (same slot
 * count, so the same call ceiling), and (2) typed, canonical child-anchor and page corrections (no reviewer free text reaches a renderer).
 * A v1 authority keeps every v1 step, wire and stop exactly.
 */
export const ENGINE_CURRENT_CUSTOMER_V2 = 'customer-current-engine/v2' as const;
export const ENGINE_CURRENT_VERSIONS = [ENGINE_CURRENT_CUSTOMER, ENGINE_CURRENT_CUSTOMER_V2] as const;
export type EngineCurrentVersion = (typeof ENGINE_CURRENT_VERSIONS)[number];
export const ENGINE_AUTHOR_BATCH = 'anthropic-message-batch/v1' as const;
/** The base storyboard ceiling: the first plan plus two focused repairs. No owner extension is implied. */
export const CUSTOMER_STORYBOARD_REPAIR_STEPS = Object.freeze(['initial_storyboard_repair_1', 'initial_storyboard_repair_2'] as const);

export function isCurrentCustomerEngine(authority: { purpose: string; currentEngine?: string }) {
  return authority.purpose === 'customer' && (ENGINE_CURRENT_VERSIONS as readonly (string | undefined)[]).includes(authority.currentEngine);
}
/** Only the v2 bundle: the bound repair and the typed corrections. */
export function isCurrentCustomerEngineV2(authority: { purpose: string; currentEngine?: string }) {
  return authority.purpose === 'customer' && authority.currentEngine === ENGINE_CURRENT_CUSTOMER_V2;
}
