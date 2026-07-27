/**
 * Legacy live Visual Contract/render calibration — intentionally retired.
 *
 * The former entrypoint loaded credentials, authored through a direct provider
 * client, rendered images, and invoked Vision without the immutable Story
 * Source lifecycle. This shim does none of those things and always fails
 * before external reachability.
 */
export const LEGACY_VISUAL_CONTRACT_CALIBRATION_DISABLED =
  'legacy_visual_contract_calibration_disabled: live authoring and rendering require separately approved lifecycle milestones';

function main(): never {
  throw new Error(LEGACY_VISUAL_CONTRACT_CALIBRATION_DISABLED);
}

try {
  main();
} catch (error) {
  console.error(
    `[visual-contract-calibration] FATAL: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
}
