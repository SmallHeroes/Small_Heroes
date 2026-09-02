import type { RuntimeBlueprintFrameProjection } from './runtime-blueprint-projection';

/**
 * One authority-aware answer for whether a page must prove the child's identity.
 * Package-backed pages use the frozen runtime frame; legacy pages keep their
 * historical `child` identifier contract.
 */
export function pageRequiresChildIdentity(args: {
  runtimeBlueprintFrame?: Pick<RuntimeBlueprintFrameProjection, 'entityPresence'> | null;
  expectedCharacterIds?: readonly string[] | null;
}): boolean {
  if (args.runtimeBlueprintFrame) {
    return args.runtimeBlueprintFrame.entityPresence.childPresence === 'present';
  }
  return args.expectedCharacterIds?.includes('child') ?? false;
}
