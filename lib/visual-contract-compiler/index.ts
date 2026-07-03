/**
 * Visual Contract Compiler (Phase 1A — the spine).
 *
 * BookVisualContract is the TOP source of truth for a book's visual continuity: derived once from the
 * full story, validated fail-closed, and authoritative over imageDirection / extractLocationZone.
 * 1A is text-only — no set-ref generation, no vision-QA gate, no calibration/full render (those land
 * in 1B). It sits ABOVE StoryLocationBible / scene-memory / set-appearance.
 */
export * from './types';
export {
  validateBookVisualContract,
  assertValidBookVisualContract,
  InvalidVisualContractError,
  isInvalidVisualContractError,
  type ContractValidationResult,
} from './validateBookVisualContract';
export {
  validateVNextVisualContract,
  assertValidVNextVisualContract,
  InvalidVNextVisualContractError,
  isInvalidVNextVisualContractError,
  type VNextContractValidationResult,
} from './validateVNextVisualContract';
export {
  compileBookVisualContract,
  buildCompileSystemPrompt,
  buildCompileUserPrompt,
  parseContractJson,
  type ContractLlmCaller,
  type CompileBookVisualContractInput,
  type PageImageDirection,
} from './compileBookVisualContract';
export { normalizeRawBookVisualContract } from './normalizeRawContract';
export { computeVisualContractHash } from './contractHash';
export {
  CONTRACT_ARTIFACT_SUFFIX,
  MissingContractArtifactError,
  contractArtifactPath,
  parseVisualContractArtifact,
  loadVisualContractArtifact,
} from './contractArtifact';
export {
  derivePageVisualContracts,
  type ResolvedPageContract,
} from './derivePageVisualContracts';
export {
  buildVisualContractPromptBlock,
  composeContractAuthoritativePrompt,
} from './buildVisualContractPromptBlock';
export {
  resolveAuthoritativePageLocation,
  isLocationZoneAdvisoryOnly,
  type LocationHint,
  type ResolvedLocationAuthority,
} from './resolveLocationAuthority';

// ── Phase 1B — enforcement ──
export {
  planPageReferences,
  resolveLocationSetRef,
  type ReferencePlan,
  type AvailableRefs,
  type PlannedRef,
  type RefSlotKind,
} from './referenceBudgetPlanner';
export {
  evaluatePageContractQa,
  observePageForContractQa,
  buildContractVisionInstruction,
  interpretVisionJson,
  resolveMajorProps,
  type ContractQaCheck,
  type ContractQaVerdict,
  type ContractQaFailure,
  type PageVisionObservation,
  type ContractVisionCaller,
} from './pageVisualContractQa';
export {
  selectCalibrationPages,
  type CalibrationSelection,
} from './selectCalibrationPages';
export {
  runVisualContractCalibration,
  type CalibrationRenderer,
  type CalibrationVision,
  type CalibrationResult,
  type CalibrationPageResult,
  type CalibrationRenderTarget,
} from './calibrateBookVisualContract';
export {
  requireValidContractForRender,
  isVisualContractEnforcementEnabled,
  isVisualContractDevOverrideEnabled,
  isVisualContractFreezeEnabled,
  isVisualContractSteeringEnabled,
  MissingVisualContractError,
  isMissingVisualContractError,
  type RenderContext,
} from './contractRenderGuards';
export { readFrozenVisualContract } from './readFrozenVisualContract';
export {
  contractToLocationPlanBundle,
  contractPageEnvironmentClass,
  contractToCastRegistry,
  contractToHumanCastDetectionEntries,
  expectedCastIdsForPage,
  contractToQaObservability,
  type ContractCastKind,
  type ContractCastRegistryEntry,
  type HumanCastDetectionEntry,
  type ContractQaObservability,
  type FrozenCastExpectation,
} from './adapters';
