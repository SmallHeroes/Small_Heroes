/**
 * The current engine for paid/QA customer orders on the hosted site (no local grants, no CLI).
 *
 * One explicit, versioned bundle: every additive policy the owner-run local books proved (response schema,
 * accepted-board child binding, ownership-aware location sheets v2, source concurrency, the Image2.6 model),
 * plus two hosted mechanics: the Opus author runs through the Anthropic Message Batches API (so no step
 * exceeds a serverless invocation) and a held initial storyboard gets the engine's ordinary bounded repairs
 * automatically. Absent, a customer authority keeps the historical recipe and wire bytes exactly.
 */
import { PICTURE_BOOK_REVIEW, PICTURE_BOOK_SCALE_REVIEW, PICTURE_BOOK_SPARSE_LANDMARK_REVIEW } from '@/lib/personal-wizard/picture-book-direction';

export const ENGINE_CURRENT_CUSTOMER = 'customer-current-engine/v1' as const;
/**
 * customer-current-engine/v2: v1 exactly, plus (1) ONE bound storyboard repair and its review after a held bound review
 * (storyboard-bound-repair/v1), whose two slots take the place of the legacy prep_storyboard_0 pair this bundle never uses (same slot
 * count, so the same call ceiling), and (2) typed, canonical child-anchor and page corrections (no reviewer free text reaches a renderer).
 * A v1 authority keeps every v1 step, wire and stop exactly.
 */
export const ENGINE_CURRENT_CUSTOMER_V2 = 'customer-current-engine/v2' as const;
/** Adds an entities-only drawing packet to v2. The full sheet design still goes to the judge. */
export const ENGINE_CURRENT_CUSTOMER_V3 = 'customer-current-engine/v3' as const;
/** Explicit picture-book art direction and materiality rubric for prospective image requests. */
export const ENGINE_CURRENT_CUSTOMER_V4 = 'customer-current-engine/v4' as const;
/** Separates explicit source geometry into visible parts and a composition guide. */
export const ENGINE_CURRENT_CUSTOMER_V5 = 'customer-current-engine/v5' as const;
/** Source-bound targeted correction of a reviewed spatial sheet. */
export const ENGINE_CURRENT_CUSTOMER_V6 = 'customer-current-engine/v6' as const;
/** Distinguishes an unmeasurable standing comparison from a material scale issue. */
export const ENGINE_CURRENT_CUSTOMER_V7 = 'customer-current-engine/v7' as const;
/** Admits complete whole-object evidence when the source has no second decisive aspect. */
export const ENGINE_CURRENT_CUSTOMER_V8 = 'customer-current-engine/v8' as const;
export const ENGINE_CURRENT_VERSIONS = [ENGINE_CURRENT_CUSTOMER, ENGINE_CURRENT_CUSTOMER_V2, ENGINE_CURRENT_CUSTOMER_V3, ENGINE_CURRENT_CUSTOMER_V4, ENGINE_CURRENT_CUSTOMER_V5, ENGINE_CURRENT_CUSTOMER_V6, ENGINE_CURRENT_CUSTOMER_V7, ENGINE_CURRENT_CUSTOMER_V8] as const;
export type EngineCurrentVersion = (typeof ENGINE_CURRENT_VERSIONS)[number];
export const ENGINE_AUTHOR_BATCH = 'anthropic-message-batch/v1' as const;
/** The base storyboard ceiling: the first plan plus two focused repairs. No owner extension is implied. */
export const CUSTOMER_STORYBOARD_REPAIR_STEPS = Object.freeze(['initial_storyboard_repair_1', 'initial_storyboard_repair_2'] as const);

export function isCurrentCustomerEngine(authority: { purpose: string; currentEngine?: string }) {
  return authority.purpose === 'customer' && (ENGINE_CURRENT_VERSIONS as readonly (string | undefined)[]).includes(authority.currentEngine);
}
/** The bound repair and typed image corrections start at v2. */
export function usesTypedCustomerCorrections(authority: { purpose: string; currentEngine?: string }) {
  return authority.purpose === 'customer' && (authority.currentEngine === ENGINE_CURRENT_CUSTOMER_V2 ||
    authority.currentEngine === ENGINE_CURRENT_CUSTOMER_V3 || authority.currentEngine === ENGINE_CURRENT_CUSTOMER_V4 ||
    usesLocationSpatialDirection(authority));
}

export function usesPictureBookReview(authority: { currentEngine?: string }) {
  return authority.currentEngine === ENGINE_CURRENT_CUSTOMER_V4 || usesLocationSpatialDirection(authority);
}

export function enginePictureBookReview(authority: { currentEngine?: string }) {
  return authority.currentEngine === ENGINE_CURRENT_CUSTOMER_V8 ? PICTURE_BOOK_SPARSE_LANDMARK_REVIEW :
    authority.currentEngine === ENGINE_CURRENT_CUSTOMER_V7 ? PICTURE_BOOK_SCALE_REVIEW :
    usesPictureBookReview(authority) ? PICTURE_BOOK_REVIEW : undefined;
}

export function usesLocationSpatialDirection(authority: { currentEngine?: string }) {
  return authority.currentEngine === ENGINE_CURRENT_CUSTOMER_V5 || usesCorrectedLocationSpatialDirection(authority);
}

export function usesCorrectedLocationSpatialDirection(authority: { currentEngine?: string }) {
  return authority.currentEngine === ENGINE_CURRENT_CUSTOMER_V6 || authority.currentEngine === ENGINE_CURRENT_CUSTOMER_V7 ||
    authority.currentEngine === ENGINE_CURRENT_CUSTOMER_V8;
}
