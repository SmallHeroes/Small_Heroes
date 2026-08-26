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
  type ContractLlmCallOptions,
  type CompileBookVisualContractInput,
  type PageImageDirection,
} from './compileBookVisualContract';
export * from './authoringPolicy';
export { normalizeRawBookVisualContract } from './normalizeRawContract';
export { computeVisualContractHash } from './contractHash';
export {
  setBoardStableAuthorityErrors,
  requireSetBoardStableAuthority,
  InvalidSetBoardStableAuthorityError,
} from './setBoardStableAuthority';
export {
  CONTRACT_ARTIFACT_SUFFIX,
  CONTRACT_TEMPLATE_ARTIFACT_SUFFIX,
  MissingContractArtifactError,
  contractArtifactPath,
  contractTemplateArtifactPath,
  parseVisualContractArtifact,
  loadVisualContractArtifact,
  loadVisualContractTemplateArtifact,
  tryLoadVisualContractTemplateArtifact,
} from './contractArtifact';
export {
  derivePageVisualContracts,
  deriveCoverVisualContract,
  type ResolvedPageContract,
} from './derivePageVisualContracts';
export {
  buildVisualContractPromptBlock,
  buildPvbVisualContractFactsPromptBlock,
  projectPvbVisualContractFacts,
  composeContractAuthoritativePrompt,
  PVB_VISUAL_CONTRACT_FACTS_VERSION,
  type PvbVisualContractFactsProjection,
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
  type CalibrationRisk,
  type CalibrationRiskAssignment,
  type CalibrationRiskEvidence,
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
  contractPageSupportingCharacters,
  expectedCastIdsForPage,
  contractToQaObservability,
  contractPageWorldExpectation,
  type ContractCastKind,
  type ContractCastRegistryEntry,
  type ContractSupportingCharacter,
  type HumanCastDetectionEntry,
  type ContractQaObservability,
  type FrozenCastExpectation,
  type ContractPageWorldExpectation,
} from './adapters';

// ── P0 — Contract Template + Resolved (structured appearance foundation; pure — no live-path wiring yet) ──
export {
  VISUAL_CONTRACT_SCHEMA_VERSION,
  MATERIALIZER_VERSION,
  PALETTE_VERSION,
  APPROVED_RUNTIME_AUTHORITY_VERSION,
  RELATIVE_ROLES,
  type RelativeRole,
  type AppearanceBindingMode,
  type AppearanceEvidenceOrigin,
  type TemplateTraitBinding,
  type ResolvedTrait,
  type Garment,
  type HumanAppearanceTraits,
  type TemplateHumanCastMember,
  type ResolvedHumanCastMember,
  type ResolvedFamilyAppearanceProfile,
  type BookVisualContractTemplate,
  type ResolvedBookVisualContract,
  type ApprovedRuntimeAuthorityBinding,
} from './contractTemplateTypes';
export {
  validateBookVisualContractTemplate,
  assertValidBookVisualContractTemplate,
  InvalidTemplateContractError,
  type TemplateValidationResult,
} from './validateTemplateContract';
export {
  validateResolvedBookVisualContract,
  assertValidResolvedBookVisualContract,
  InvalidResolvedContractError,
  type ResolvedValidationResult,
} from './validateResolvedContract';
export {
  DEFAULT_APPEARANCE_PALETTE,
  normalizeStoryKey,
  paletteIndexFor,
  paletteEntryFor,
  type PaletteEntry,
  type AppearancePalette,
} from './appearancePalette';
export { materialize, MaterializationError } from './materializeContract';
export {
  LEGACY_VISUAL_CONTRACT_SCHEMA_VERSION,
  LEGACY_VISUAL_CONTRACT_SCHEMA_VERSION_V2,
  LEGACY_VISUAL_CONTRACT_SCHEMA_VERSION_V3,
  migrateLegacyBookVisualContractTemplateV1,
  migrateLegacyBookVisualContractTemplateV2,
  migrateLegacyBookVisualContractTemplateV3,
  migrateBookVisualContractTemplateTimeOfDayAuthority,
  type VisualContractReferenceDomainMigration,
} from './contractTemplateMigration';
export {
  projectResolvedCoarseAppearance,
  projectResolvedWardrobeDescription,
  type ResolvedHumanProseSource,
} from './projectResolvedHumanProse';
/**
 * (Stage 3 / Contract v2) Deterministic prose PROJECTIONS of the structured schema. Tier A is wired both sides —
 * the validator enforces `stableGeometry` equality once a zone authors `spatialNodes`. Tier B ships pure + unwired,
 * for Stage 4's containment check. Tier C is wired straight to the prompt block (never stored, never hashed).
 */
export {
  projectZoneStableGeometry,
  projectPageMustShow,
  projectPageMustShowLegacySpatial,
  projectPageMustNotShow,
  projectPageMustNotShowLegacySpatial,
  projectCoverMustNotShow,
  SPATIAL_REFERENCE_PROJECTION_VERSION,
  PROVIDER_SPATIAL_REFERENCE_PROJECTION_VERSION,
  projectPageActionProse,
  projectPageSafetyProse,
  assertProviderPromptHasNoInternalSpatialMarkers,
  projectProviderSafeBookSpatialProse,
  projectProviderSafeSpatialProse,
  projectPageProviderPromptProse,
  type ProviderPagePromptProse,
} from './projectContractProse';
/**
 * (Stage 4) Deterministic check-id resolution for a page's enforcement-relevant claims — Stage 5 binds exactly one
 * QA result per id, and the validator rejects a page whose claims collide on one.
 */
export { resolvePageCheckIds, type PageCheck, type PageCheckKind } from './pageCheckIds';
/** (Stage 4) A hazard citing a story quote must be quoting that page — needs the SOURCE, so the compiler calls it. */
export {
  sourceEvidenceErrors,
  sourceEvidenceValidation,
  type SourceEvidencePage,
  type SourceEvidenceValidation,
} from './validateSourceEvidence';
export * from './draftValidationDiagnostics';
export {
  effectivePropVisibility,
  requiredPropIdsForPage,
  forbiddenPropIdsForPage,
  type EffectivePropVisibility,
} from './propLifecycle';
export {
  bindingCoherenceError,
  coherentOriginKindsFor,
  type OriginKind,
} from './appearanceBindingCoherence';
export {
  assertSourceHasRealProse,
  countProseLetters,
  MIN_PAGE_PROSE_LETTERS,
  MIN_AVG_PROSE_LETTERS_PER_PAGE,
  type SourceProsePage,
} from './assertSourceProse';
export * from './sourceEvidenceCatalog';
export * from './sourceEvidenceIdRepair';
export * from './pageContractRepair';
export * from './representedElsewhereRepair';
export * from './structuralBundleRepair';
export * from './bookSurfaceRepair';
export * from './stablePropScopeRepair';
