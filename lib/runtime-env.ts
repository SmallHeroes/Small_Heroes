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
