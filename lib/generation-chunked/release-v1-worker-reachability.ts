import type { GenerationReleaseContinuityV1 } from '@/lib/generation-pipeline/release-v1-continuity';

export const RELEASE_V1_WORKER_PROBE_HEADER =
  'x-small-heroes-release-worker-probe' as const;
export const RELEASE_V1_WORKER_PROBE_VERSION =
  'release-v1-worker-reachability/v1' as const;

/**
 * Prove that this deployment's own automation-bypass secret reaches the exact
 * immutable release/v1 worker URL. OPTIONS is deliberately state-free: the
 * worker POST handler, generation secret, database, and providers are never
 * touched.
 */
export async function probeReleaseV1WorkerReachability(
  continuity: GenerationReleaseContinuityV1,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const bypassSecret = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (!bypassSecret) {
    throw new Error('release/v1 worker automation bypass is not configured');
  }

  const response = await fetch(
    `${continuity.workerBaseUrl}${continuity.workerPath}`,
    {
      method: 'OPTIONS',
      headers: {
        'x-vercel-protection-bypass': bypassSecret,
        'x-vercel-set-bypass-cookie': 'false',
      },
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (
    response.status !== 204 ||
    response.headers.get(RELEASE_V1_WORKER_PROBE_HEADER) !==
      RELEASE_V1_WORKER_PROBE_VERSION
  ) {
    throw new Error('release/v1 worker protected reachability probe failed');
  }
}
