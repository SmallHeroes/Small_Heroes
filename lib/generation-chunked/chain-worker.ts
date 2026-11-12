/**
 * Fire-and-forget worker kick — MUST NOT await the next worker finishing.
 * Correctness is DB state + sweeper/resume, not this request: the self-chain is best-effort.
 * When it fails (e.g. a 401 from deployment protection / wrong host) we record a DB-visible
 * diagnostic so the stall is not silent, and the sweeper (cron / external scheduler) reclaims
 * the expired lease and continues. See sweeper.ts.
 */
import { after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertEnvSeparation } from './env-separation-guard';
import type { GenerationReleaseContinuityV1 } from '@/lib/generation-pipeline/release-v1-continuity';
import {engineStagingInternalHeaders} from '@/lib/engine-site/staging-access';

/**
 * Run best-effort background work DURABLY from a serverless request. Inside a request scope (Vercel /
 * `next dev`) register it with `after()` so the platform keeps the function alive until the promise
 * settles (waitUntil under the hood) even after the HTTP response is sent — this is what makes the
 * worker self-call actually fire. A bare `void fetch(...)` is NOT guaranteed to run once the route
 * returns (the function can freeze), which is exactly why full-book renders stranded at dispatch.
 * Outside a request scope (scripts / tests / non-Vercel node) `after` throws — there is no freeze there,
 * so we run the work detached instead. Never throws to the caller.
 */
export function runAfterResponse(work: () => Promise<void>): void {
  try {
    after(work);
    return;
  } catch {
    // Not in a request scope (`after` throws) — the process stays alive, so run it detached.
  }
  void work().catch(() => {});
}

async function failGenerationChain(orderId: string, message: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { frozenProductVersion: true } });
  if (order?.frozenProductVersion === 'engine-site/v1') {
    console.warn('[engine-site-dispatch] Executor configuration unavailable; order untouched',
      {orderId,code:'engine_dispatch_configuration_unavailable'});return;
  }
  console.error(`[chunked-gen] ${message}`, { orderId });
  await prisma.generationJob
    .update({
      where: { orderId },
      data: {
        status: 'failed',
        lastError: message,
        failedAt: new Date(),
        retryable: true,
      },
    })
    .catch(() => {});
  await prisma.order
    .update({ where: { id: orderId }, data: { status: 'failed', lastError: message } })
    .catch(() => {});
}

/** Record a best-effort self-chain diagnostic without failing the job (sweeper still recovers). */
async function recordChainDiagnostic(
  orderId: string,
  data: { lastChainStatus?: number | null; lastChainError?: string | null; lastWorkerKickAt?: Date }
): Promise<void> {
  await prisma.generationJob.update({ where: { orderId }, data }).catch(() => {});
}

export type InternalWorkerTarget = { url: string; source: string; isFallback: boolean };

/**
 * Resolve the base URL for the internal worker self-call. Prefer an explicit internal base or the
 * CURRENT deployment's own URL (VERCEL_URL) over the public APP_URL — APP_URL can point at a
 * different/protected/prod domain, which is exactly how the QA chain hit a 401. APP_URL /
 * NEXT_PUBLIC_APP_URL remain ONLY as a last-resort, warned fallback. Returns null if none set.
 */
export function resolveInternalWorkerBaseUrl(): InternalWorkerTarget | null {
  if(process.env.ENGINE_SITE_STAGING_ACCESS_ENABLED==='true') {
    const host=process.env.ENGINE_SITE_STAGING_HOST?.trim();
    return host?{url:`https://${host}`,source:'ENGINE_SITE_STAGING_HOST',isFallback:false}:null;
  }
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    const withProto = /^https?:\/\//i.test(vercelUrl) ? vercelUrl : `https://${vercelUrl}`;
    return { url: withProto.replace(/\/$/, ''), source: 'VERCEL_URL', isFallback: false };
  }
  const explicit = process.env.INTERNAL_WORKER_BASE_URL?.trim();
  if (explicit) {
    return { url: explicit.replace(/\/$/, ''), source: 'INTERNAL_WORKER_BASE_URL', isFallback: false };
  }
  const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (appUrl) {
    return { url: appUrl.replace(/\/$/, ''), source: 'APP_URL_FALLBACK', isFallback: true };
  }
  return null;
}

/** Global engine executor preflight, before a sweep may mutate any order or its deadline state. */
export function engineDispatchConfigurationAvailable():boolean {
  try{const target=resolveInternalWorkerBaseUrl();if(!target||!process.env.GENERATION_SECRET?.trim())throw Error('missing');
    const url=new URL(target.url);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error('target');
    engineStagingInternalHeaders(target.url);return true;
  }catch{console.warn('[engine-site-dispatch] Executor configuration unavailable; sweep untouched',{code:'engine_dispatch_configuration_unavailable'});return false;}
}

export function chainGenerationWorker(
  orderId: string,
  releaseContinuity?: GenerationReleaseContinuityV1,
  options?: { delayMs: number },
): void {
  const delayMs = options?.delayMs ?? 0;
  if (!Number.isSafeInteger(delayMs) || delayMs < 0 || delayMs > 20_000) throw Error('engine_poll_delay_invalid');
  // Env-separation guard (0089 P0): refuse to fan out if a non-production runtime is pointed at a
  // production resource (prod domain / prod Supabase). Throws loudly — staging must never drive prod.
  assertEnvSeparation();

  const target = releaseContinuity
    ? {
        url: releaseContinuity.workerBaseUrl,
        source: releaseContinuity.version,
        isFallback: false,
      }
    : resolveInternalWorkerBaseUrl();
  if (!target) {
    void failGenerationChain(
      orderId,
      'Generation chain aborted: no internal worker base URL (set INTERNAL_WORKER_BASE_URL or VERCEL_URL or APP_URL)'
    );
    return;
  }
  if (target.isFallback) {
    console.warn(
      `[chunked-gen] chain using fallback base URL (${target.source}=${target.url}); prefer VERCEL_URL / INTERNAL_WORKER_BASE_URL`,
      { orderId }
    );
  }

  const secret = process.env.GENERATION_SECRET?.trim();
  if (!secret) {
    void failGenerationChain(orderId, 'Generation chain aborted: GENERATION_SECRET is not configured');
    return;
  }

  const workerPath =
    releaseContinuity?.workerPath ?? '/api/generate/worker';
  const url = `${target.url}${workerPath}`;
  let host = target.url;
  try {
    host = new URL(url).host;
  } catch {
    /* keep target.url */
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // Internal auth: Bearer is primary; x-generation-secret for compat; body secret too.
    Authorization: `Bearer ${secret}`,
    'x-generation-secret': secret,
  };
  try {Object.assign(headers,engineStagingInternalHeaders(target.url));}
  catch {void failGenerationChain(orderId,'Staging worker target or access configuration is invalid');return;}
  // Vercel Deployment Protection is on for preview — get the internal self-call past the 401 with
  // the automation bypass secret (when configured). Do NOT set the bypass cookie on this server
  // request. Only added when VERCEL_AUTOMATION_BYPASS_SECRET is present.
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  // Option A (a dedicated staging project) has no platform protection and never forwards the bypass. A staging
  // Preview inside the shared project opts in explicitly: its self-call to its own recorded host carries both the
  // app's staging header (above) and the platform automation bypass.
  const sharedProjectStaging = process.env.ENGINE_SITE_STAGING_PLATFORM_BYPASS === 'true' && process.env.VERCEL_ENV === 'preview';
  if (bypassSecret && (process.env.ENGINE_SITE_STAGING_ACCESS_ENABLED !== 'true' || sharedProjectStaging)) {
    headers['x-vercel-protection-bypass'] = bypassSecret;
    headers['x-vercel-set-bypass-cookie'] = 'false';
  }

  // Durable dispatch: the diagnostic stamp + the self-call + the outcome record ALL run inside the
  // extended (post-response) window via runAfterResponse — so the kick actually fires in serverless
  // instead of being dropped when the route returns (the dispatch-stranding root cause).
  runAfterResponse(async () => {
    const kind=await prisma.order.findUnique({where:{id:orderId},select:{frozenProductVersion:true}});
    if(kind?.frozenProductVersion==='engine-site/v1'&&!engineDispatchConfigurationAvailable())return;
    if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
    // Stamp the kick attempt (so a hung/failed chain is visible) — awaited, inside the durable window.
    await recordChainDiagnostic(orderId, { lastWorkerKickAt: new Date(), lastChainError: null });
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ orderId, secret }),
        keepalive: true,
        redirect: 'manual',
      });
      if (!res.ok) {
        const snippet = await res
          .text()
          .then((t) => t.slice(0, 200))
          .catch(() => '');
        console.warn(
          `[chunked-gen] chain worker non-OK orderId=${orderId} host=${host} status=${res.status} body=${snippet}`
        );
        // DB-visible diagnostic — NEVER a silent 401. The job stays running with its lease;
        // the sweeper reclaims the expired lease and continues. We do NOT mark it failed here.
        await recordChainDiagnostic(orderId, {
          lastChainStatus: res.status,
          lastChainError: `chain ${res.status} @ ${host}${snippet ? `: ${snippet}` : ''}`,
        });
      } else {
        await recordChainDiagnostic(orderId, { lastChainStatus: res.status, lastChainError: null });
        const order=await prisma.order.findUnique({where:{id:orderId},select:{frozenProductVersion:true}});
        if(order?.frozenProductVersion==='engine-site/v1') {
          const {clearEngineInfrastructureFault}=await import('@/lib/engine-site/failure-policy');
          await clearEngineInfrastructureFault(prisma,orderId,'dispatch');
        }
      }
    } catch (err) {
      const msg = (err as Error)?.message ?? 'unknown';
      console.warn(`[chunked-gen] chain worker failed (non-fatal) orderId=${orderId} host=${host} err=${msg}`);
      await recordChainDiagnostic(orderId, {
        lastChainStatus: null,
        lastChainError: `chain fetch failed @ ${host}: ${msg}`,
      });
    }
  });
}
