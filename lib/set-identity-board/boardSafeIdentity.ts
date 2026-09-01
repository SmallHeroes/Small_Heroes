import { canonicalHash } from '@/lib/canonical-json';

import {
  LEGACY_SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION,
  SET_BOARD_POSITIVE_AUTHORITY_CONTEXTUAL_POLICY_VERSION,
  SET_BOARD_POSITIVE_AUTHORITY_PRECISE_POLICY_VERSION,
  SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION,
  type SetDefinition,
  type SetDefinitionLocation,
} from './types';
import { positiveAuthorityLabelIsSafe } from './positiveAuthoritySpoilerGuard';

const SAFE_IDENTITY_PROJECTION_VERSION =
  'set-board-safe-identity-projection/v1' as const;
const RESERVED_OPAQUE_LABEL = /^(?:set|location)_[a-f0-9]{64}$/;

function opaqueLabel(kind: 'set' | 'location', value: string): string {
  return `${kind}_${canonicalHash({
    version: SAFE_IDENTITY_PROJECTION_VERSION,
    kind,
    value,
  })}`;
}

function providerSafeOrOpaque(
  definition: SetDefinition,
  kind: 'set' | 'location',
  value: string,
): string {
  // Reserve the generated namespace. Without this check, a distinct clean raw
  // label could equal another identity's generated label without any hash
  // collision and collapse their provider-facing identities.
  return positiveAuthorityLabelIsSafe(definition, value) &&
    !RESERVED_OPAQUE_LABEL.test(value)
    ? value
    : opaqueLabel(kind, value);
}

function policyVersion(definition: SetDefinition): string {
  return definition.positiveAuthorityPolicy?.version ?? '';
}

/**
 * Provider-safe display identity only. Raw Set identity remains the registry,
 * storage and runtime authority and is never rewritten by this projection.
 */
export function setBoardSafeIdentityLabel(definition: SetDefinition): string {
  const version = policyVersion(definition);
  if (version === LEGACY_SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION) {
    return definition.setIdentityId;
  }
  if (
    version !== SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION &&
    version !== SET_BOARD_POSITIVE_AUTHORITY_PRECISE_POLICY_VERSION &&
    version !== SET_BOARD_POSITIVE_AUTHORITY_CONTEXTUAL_POLICY_VERSION
  ) {
    throw new Error(
      `unsupported Set Board positive-authority policy version: ${version || '(missing)'}`,
    );
  }
  return providerSafeOrOpaque(
    definition,
    'set',
    definition.setIdentityId,
  );
}

/**
 * Location names are prompt labels, not physical authority. Unsafe labels are
 * replaced by an opaque content-addressed value; descriptive physical fields
 * remain unmodified and continue through the full positive-authority guard.
 */
export function setBoardSafeLocationName(
  definition: SetDefinition,
  location: SetDefinitionLocation,
): string {
  const version = policyVersion(definition);
  if (version === LEGACY_SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION) {
    return location.name;
  }
  if (
    version !== SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION &&
    version !== SET_BOARD_POSITIVE_AUTHORITY_PRECISE_POLICY_VERSION &&
    version !== SET_BOARD_POSITIVE_AUTHORITY_CONTEXTUAL_POLICY_VERSION
  ) {
    throw new Error(
      `unsupported Set Board positive-authority policy version: ${version || '(missing)'}`,
    );
  }
  if (
    positiveAuthorityLabelIsSafe(definition, location.name) &&
    !RESERVED_OPAQUE_LABEL.test(location.name)
  ) {
    return location.name;
  }
  return opaqueLabel('location', `${location.id}\u0000${location.name}`);
}
