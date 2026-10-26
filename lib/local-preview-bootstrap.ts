/**
 * Explicit secret-free local UI bootstrap. This skips only the eager global startup validation;
 * it does not change lib/env, authenticate a request, enable a worker or authorize a provider.
 * Pure and import-safe: no service/auth/DB dependencies. Off for every cloud/production runtime.
 */
export function isLocalUiOnlyBootstrap(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  if (env.NODE_ENV !== 'development' || env.PERSONAL_WIZARD_PREVIEW !== 'true' ||
      env.PERSONAL_WIZARD_LOCAL_UI_ONLY !== 'true') return false;
  if ([env.VERCEL, env.VERCEL_ENV, env.VERCEL_URL, env.VERCEL_PROJECT_ID].some(Boolean)) return false;
  if (['PERSONAL_WIZARD_LIVE_INTAKE', 'PERSONAL_WIZARD_NATIVE_BOOK_RUNNER', 'PERSONAL_WIZARD_SIMPLE_BOOK_RUNNER']
      .some(key => env[key] === 'true')) return false;
  const origins = [env.APP_URL, env.NEXT_PUBLIC_APP_URL].filter((value): value is string => !!value);
  if (!origins.length) return false;
  let expected: string | undefined;
  for (const value of origins) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
          url.username || url.password || url.pathname !== '/' || url.search || url.hash) return false;
      if (expected && url.origin !== expected) return false;
      expected = url.origin;
    } catch { return false; }
  }
  return true;
}

// The actual HTTP route must separately enforce loopback Host and same-origin writes. Application
// origin configuration alone is not request authority or a network bind instruction.
