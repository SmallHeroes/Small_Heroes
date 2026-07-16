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
  type SetDefinition,
  type SetDefinitionLocation,
  type SetDefinitionZone,
  type SetDefinitionFixedFact,
  type SetIdentityBoardRegistryEntry,
  type SetIdentityBoardBinding,
  type SetIdentityBoardBindingContext,
  type BoardQaResult,
} from './types';

export {
  groupLocationsBySetIdentity,
  listRequiredSetIdentityIds,
  projectSetDefinition,
  computeSetDefinitionHash,
} from './setDefinition';

export { buildSetIdentityBoardPrompt } from './boardPrompt';

export {
  validateSetIdentityBoardRegistryEntry,
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
