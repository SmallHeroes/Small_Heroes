/**
 * Set Identity Board (Milestone A) — public API barrel.
 *
 * A PURE, offline subsystem: it PROJECTS the set-only facts out of a frozen visual contract, HASHES them, builds a
 * character-free multi-view board prompt, validates a global registry entry fail-closed, and QAs a rendered board.
 * NOTHING here is wired into the live render path — that is a later milestone.
 */
export {
  SET_IDENTITY_BOARD_VERSION,
  SET_IDENTITY_REGISTRY_VERSION,
  SET_BOARD_CONTENT_POLICY_VERSION,
  SET_BOARD_AMBIENT_DRESSING_POLICY_VERSION,
  SET_BOARD_AMBIENT_DRESSING_CATEGORIES,
  SET_BOARD_AMBIENT_PALETTE_COLOR_FAMILIES,
  SET_BOARD_AMBIENT_PALETTE_TARGETS,
  LEGACY_SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION,
  SET_BOARD_POSITIVE_AUTHORITY_CONTEXTUAL_POLICY_VERSION,
  SET_BOARD_POSITIVE_AUTHORITY_PRECISE_POLICY_VERSION,
  SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION,
  type SetDefinition,
  type SetDefinitionLocation,
  type SetDefinitionZone,
  type SetDefinitionFixedFact,
  type SetBoardContentPolicy,
  type SetBoardAmbientDressingPolicy,
  type SetBoardAmbientDressingCategory,
  type SetBoardAmbientPaletteColorFamily,
  type SetBoardAmbientPaletteTarget,
  type SetBoardExcludedProp,
  type SetBoardPositiveAuthorityPolicy,
  type SetBoardPositiveAuthorityPolicyVersion,
  type SetBoardBlockedCastIdentity,
  type SetBoardBlockedPropIdentity,
  type SetIdentityBoardRegistryEntry,
  type SetIdentityBoardBinding,
  type SetIdentityBoardBindingContext,
  type BoardQaResult,
} from './types';

export {
  currentSetBoardAmbientDressingPolicy,
  assertCurrentSetBoardAmbientDressingPolicy,
  SET_BOARD_AMBIENT_DRESSING_LABELS,
} from './ambientDressing';

export {
  groupLocationsBySetIdentity,
  listRequiredSetIdentityIds,
  collectSetDefinitionAdmissionIssues,
  projectSetDefinition,
  computeSetBoardContentPolicyDigest,
  computeSetDefinitionHash,
} from './setDefinition';

export {
  SET_BOARD_ADMISSION_CENSUS_VERSION,
  collectRequiredSetBoardAdmissionCensus,
  assertRequiredSetBoardAdmission,
  RequiredSetBoardAdmissionError,
  type SetBoardAdmissionIssue,
  type SetBoardAdmissionResult,
  type RequiredSetBoardAdmissionCensus,
} from './setBoardAdmission';

export { buildSetIdentityBoardPrompt } from './boardPrompt';

export {
  setBoardSafeIdentityLabel,
  setBoardSafeLocationName,
} from './boardSafeIdentity';

export {
  assertSetBoardPositiveAuthoritySpoilerNeutral,
  collectSetBoardPositiveAuthorityIssues,
  canonicalSetBoardWords,
  deriveExcludedPropCanonicalTerms,
  positiveAuthorityLabelIsSafe,
  SetBoardPositiveAuthoritySpoilerError,
  SetBoardPositiveAuthorityLeakError,
  type SetBoardPositiveAuthorityIssue,
} from './positiveAuthoritySpoilerGuard';

export {
  validateSetIdentityBoardRegistryEntry,
  validateSetIdentityBoardRegistryIdentity,
  verifyBoardAssetBytes,
  loadRegistryEntry,
  saveRegistryEntry,
  computeExpectedRegistryKey,
  type ExpectedRegistryIdentity,
  type RegistryValidation,
} from './registry';

export {
  qaSetIdentityBoardImage,
  boardContaminationFlags,
  buildBoardQaInstruction,
} from './boardQa';

export {
  orderReferenceAssets,
  planReferenceAssets,
  selectBoardRefForLocation,
  ReferenceBudgetExceededError,
  SET_REFERENCE_COPY_INSTRUCTION,
  PROP_REFERENCE_COPY_INSTRUCTION,
  type ReferenceAsset,
  type ReferenceRole,
} from './referenceTransport';

export { isSetIdentityBoardEnabled } from './flags';

export {
  snapshotBoardMode,
  resolveBoardBindings,
  assertBoardsBoundForRender,
  hasUnboundRequiredSetIdentity,
  SetIdentityBoardUnavailableError,
  type BoardResolverDeps,
  /** (P0-4b) Byte-re-verification deps for the pre-render assert — a swapped object must fail closed. */
  type BoardByteVerifierDeps,
} from './resolveBoards';

export {
  createLiveBoardResolverDeps,
  setIdentityBoardRegistryPath,
  SET_IDENTITY_BOARD_REGISTRY_DIR,
  /**
   * (P0-4a) The ONE content-addressed key builder — public API deliberately. The offline mint and the live binder
   * MUST derive the SAME key or an approved board can never be found, so this stays a single shared contract
   * instead of two copies that can drift. `assetSha256` is a PATH COMPONENT: different bytes are physically a
   * different object, which is what makes an approved board unswappable.
   */
  setIdentityBoardStorageKey,
  type BoardStorageIdentity,
} from './liveResolverDeps';
