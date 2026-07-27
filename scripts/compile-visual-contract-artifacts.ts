/**
 * Legacy BookVisualContract live compiler — intentionally retired.
 *
 * Provider-backed Visual Contract authoring must use the immutable Story
 * Source request/preflight/receipt lifecycle. This shim performs no argument
 * parsing, directory creation, credential loading, provider import, or write.
 */
export const LEGACY_VISUAL_CONTRACT_AUTHORING_DISABLED =
  'legacy_visual_contract_authoring_disabled: use production-visual-lifecycle source-authoring-preflight and a separately approved live milestone';

function main(): never {
  throw new Error(LEGACY_VISUAL_CONTRACT_AUTHORING_DISABLED);
}

try {
  main();
} catch (error) {
  console.error(
    `[compile-vc] FATAL: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
}
