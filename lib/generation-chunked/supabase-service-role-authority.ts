export const SUPABASE_SERVICE_ROLE_AUTHORITY_STATUS_VALUES = [
  'matched',
  'mismatched',
  'missing',
  'unverifiable',
] as const;

export type SupabaseServiceRoleAuthorityStatus =
  (typeof SUPABASE_SERVICE_ROLE_AUTHORITY_STATUS_VALUES)[number];

type SupabaseLegacyJwtClaims = {
  issuer: string;
  projectRef: string;
  role: string;
};

function decodeLegacyJwtClaims(value: string | undefined): SupabaseLegacyJwtClaims | null {
  const candidate = value?.trim();
  if (!candidate) return null;
  const parts = candidate.split('.');
  if (parts.length !== 3) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    ) as unknown;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const record = payload as Record<string, unknown>;
    if (
      typeof record.iss !== 'string' ||
      typeof record.ref !== 'string' ||
      typeof record.role !== 'string'
    ) {
      return null;
    }
    return {
      issuer: record.iss,
      projectRef: record.ref,
      role: record.role,
    };
  } catch {
    return null;
  }
}

/**
 * Classifies a backend Supabase key without returning any key bytes or claims.
 * Legacy service-role keys are JWTs with closed `iss`, `ref`, and `role` claims.
 * New `sb_secret_*` keys intentionally expose no project identity, so this
 * zero-network classifier fails them closed as unverifiable rather than guessing.
 */
export function classifySupabaseServiceRoleAuthority(
  value: string | undefined,
  expectedProjectRef: string,
): SupabaseServiceRoleAuthorityStatus {
  if (!value?.trim()) return 'missing';
  const claims = decodeLegacyJwtClaims(value);
  if (!claims) return 'unverifiable';
  return claims.issuer === 'supabase' &&
    claims.role === 'service_role' &&
    claims.projectRef === expectedProjectRef
    ? 'matched'
    : 'mismatched';
}

/** Detects a decoded legacy Supabase JWT for one exact project without exposing it. */
export function supabaseLegacyJwtReferencesProject(
  value: string | undefined,
  projectRef: string,
): boolean {
  const claims = decodeLegacyJwtClaims(value);
  return claims?.issuer === 'supabase' && claims.projectRef === projectRef;
}
