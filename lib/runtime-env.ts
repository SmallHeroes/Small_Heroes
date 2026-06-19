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
 * Allows the QA/dev console on Vercel Preview/development only, behind an explicit flag.
 * Never opens on real Production, even if the flag is accidentally set there.
 */
export function canAccessStagingQa(): boolean {
  return process.env.ALLOW_STAGING_QA === 'true' && isVercelNonProductionRuntime();
}
