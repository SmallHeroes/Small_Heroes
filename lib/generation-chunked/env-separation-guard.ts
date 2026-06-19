import 'server-only';

/**
 * Env-separation guard (roundtable 0089 P0).
 *
 * Staging/Preview must NEVER drive generation against PRODUCTION resources. The chunked-generation
 * chain fans out to the next worker via NEXT_PUBLIC_APP_URL/APP_URL (see chain-worker.ts), and image
 * writes go to SUPABASE_URL. If a Preview deploy were misconfigured to the prod domain or pointed at
 * the prod Supabase project, staging could trigger prod generation or write into prod storage.
 *
 * This refuses to run the moment such a misconfiguration is detected. There is intentionally NO
 * override env var — failing loud is the whole point.
 */

// Known PRODUCTION identifiers. Kept as literals (not env-configurable) so a leaked prod value can't
// be "allow-listed away": the guard exists precisely to catch a prod value where it must not be.
const PROD_APP_HOSTS = ['smallheroes.co.il', 'www.smallheroes.co.il'];
// Prod/dev Supabase project ref (host = <ref>.supabase.co). Staging is a different ref.
const PROD_SUPABASE_REF = 'ozxjmnzybzetqudivlbw';

function hostOf(value: string | undefined): string {
  if (!value) return '';
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

/** True only on Vercel Production. Preview, local dev, and tests are all treated as non-production. */
export function isProductionRuntime(): boolean {
  return (process.env.VERCEL_ENV || '').toLowerCase() === 'production';
}

/**
 * Returns a human-readable reason if a PRODUCTION resource is configured, else null.
 * (Bucket name is identical across envs — `book-images` — so the project is identified by SUPABASE_URL.)
 */
export function findProdResourceLeak(): string | null {
  const appHost = hostOf(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL);
  if (appHost && PROD_APP_HOSTS.includes(appHost)) {
    return `app URL host "${appHost}" is the PRODUCTION domain`;
  }
  const supabaseHost = hostOf(process.env.SUPABASE_URL);
  if (supabaseHost && supabaseHost.includes(PROD_SUPABASE_REF)) {
    return `SUPABASE_URL "${supabaseHost}" is the PRODUCTION Supabase project`;
  }
  const dbConn = `${process.env.DATABASE_URL || ''}|${process.env.DIRECT_URL || ''}`.toLowerCase();
  if (dbConn.includes(PROD_SUPABASE_REF)) {
    return `DATABASE_URL/DIRECT_URL points at the PRODUCTION Supabase project (${PROD_SUPABASE_REF})`;
  }
  return null;
}

/**
 * Throw if a non-production runtime is pointed at a production resource. No-op on Vercel Production
 * (prod is allowed to use prod resources).
 */
export function assertEnvSeparation(): void {
  if (isProductionRuntime()) return;
  const leak = findProdResourceLeak();
  if (leak) {
    throw new Error(
      `[env-separation] Refusing to run: ${leak}, but VERCEL_ENV is ` +
        `"${process.env.VERCEL_ENV || '(unset)'}" (non-production). Staging/Preview must use ` +
        `staging resources only — set the Preview-scoped env vars (NEXT_PUBLIC_APP_URL = the ` +
        `Preview domain; SUPABASE_URL = the staging project).`
    );
  }
}
