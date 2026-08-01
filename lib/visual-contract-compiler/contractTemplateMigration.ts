import {
  VISUAL_CONTRACT_SCHEMA_VERSION,
  type BookVisualContractTemplate,
} from './contractTemplateTypes';
import {
  assertValidBookVisualContractTemplate,
  InvalidTemplateContractError,
} from './validateTemplateContract';

export const LEGACY_VISUAL_CONTRACT_SCHEMA_VERSION = 'vc-schema/v1' as const;

function objectValue(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/**
 * Explicit offline migration for immutable vc-schema/v1 template evidence.
 * Runtime loaders never call this function: historical bytes remain rejected as
 * current authority until a caller deliberately writes and reviews a new artifact.
 */
export function migrateLegacyBookVisualContractTemplateV1(
  input: unknown,
): BookVisualContractTemplate {
  if (!objectValue(input) || input.schemaVersion !== LEGACY_VISUAL_CONTRACT_SCHEMA_VERSION) {
    throw new InvalidTemplateContractError([
      `explicit migration requires ${LEGACY_VISUAL_CONTRACT_SCHEMA_VERSION} input`,
    ]);
  }
  const candidate = structuredClone(input);
  candidate.schemaVersion = VISUAL_CONTRACT_SCHEMA_VERSION;

  if (Array.isArray(candidate.pageContracts)) {
    for (const page of candidate.pageContracts) {
      if (!objectValue(page) || !Array.isArray(page.actionRequirements)) continue;
      for (const requirement of page.actionRequirements) {
        if (!objectValue(requirement) || !hasOwn(requirement, 'actorId')) continue;
        if (hasOwn(requirement, 'subject')) {
          throw new InvalidTemplateContractError([
            'legacy action requirement cannot carry both actorId and subject',
          ]);
        }
        if (typeof requirement.actorId !== 'string' || !requirement.actorId.trim()) {
          throw new InvalidTemplateContractError([
            'legacy action requirement actorId must be a non-empty string',
          ]);
        }
        requirement.subject = {
          kind: 'entity',
          entity: { kind: 'cast', id: requirement.actorId },
        };
        delete requirement.actorId;
      }
    }
  }

  assertValidBookVisualContractTemplate(candidate);
  return candidate;
}
