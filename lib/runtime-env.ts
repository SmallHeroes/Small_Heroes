/**
 * Pure runtime-env helpers — NO imports (safe for edge/middleware and server alike).
 *
 * Why this exists: Vercel runs `NODE_ENV=production` on BOTH real production AND Preview
 * deployments, so `NODE_ENV` cannot distinguish real prod from staging. `VERCEL_ENV` can:
 * it is 'production' only on the real production deployment ('preview' / 'development' otherwise).
 */

/** True only on the real Vercel Production deployment. Preview, local dev, and tests are NOT. */
export function isVercelProductionRuntime(): boolean {
  return (process.env.VERCEL_ENV || '').toLowerCase() === 'production';
}

export function isVercelNonProductionRuntime(): boolean {
  const vercelEnv = (process.env.VERCEL_ENV || '').toLowerCase();
  return vercelEnv === 'preview' || vercelEnv === 'development';
}

/**
 * True when the runtime must be treated as production for dev/fake-payment gating:
 * real Vercel Production (VERCEL_ENV=production), OR a production NODE_ENV that is NOT a
 * recognized Vercel Preview/Development (e.g. VERCEL_ENV unset on a self-hosted prod host).
 *
 * Why the second clause: fake payments are safe only on local dev (NODE_ENV!=='production')
 * or a known Vercel non-prod. On a production NODE_ENV with no Vercel env tag we cannot prove
 * we're on staging, so we fail closed — mirroring middleware.ts and dev-only-guard.isDevEnvironment(),
 * which already treat unset-VERCEL_ENV as closed. On real Vercel this second clause never fires
 * (Vercel always sets VERCEL_ENV); it only hardens off-Vercel/misconfigured hosts.
 */
export function isProductionLikeRuntime(): boolean {
  if (isVercelProductionRuntime()) return true;
  return process.env.NODE_ENV === 'production' && !isVercelNonProductionRuntime();
}

/**
 * Allows the QA/dev console on Vercel Preview/development only, behind an explicit flag.
 * Never opens on real Production, even if the flag is accidentally set there.
 */
export function canAccessStagingQa(): boolean {
  return process.env.ALLOW_STAGING_QA === 'true' && isVercelNonProductionRuntime();
}
