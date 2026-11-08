/** Explicit local-test recovery only. Existing Sol and production defaults retain their104000-byte wire limit. */
export const LOCAL_INITIAL_REPAIR_WIRE_BYTES=120_000;
export const LOCAL_INITIAL_REPAIR_RESERVE_MICRO_USD=1_200_000;
/** A plan-only third attempt. No image, reference, narration, publication or old paid slot. */
export const LOCAL_PLAN_RECOVERY_STEPS=Object.freeze(['initial_storyboard_repair_2','initial_storyboard_repair_2_review'] as const);
