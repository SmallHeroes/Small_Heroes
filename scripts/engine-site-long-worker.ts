/** Separate long-call host, SAME GenerationJob/lease/meter. Inactive until a separately approved deployment/spend activation. */
import 'server-only';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { assertEnvSeparation, assertProdGenerationAllowed } from '../lib/generation-chunked/env-separation-guard';
import { configuredEngineSpendPolicy } from '../lib/engine-site/platform-policy';

export async function engineLongWorkerMain(once = false) {
  if (process.env.ENGINE_SITE_LONG_WORKER_ENABLED !== 'true') throw Error('engine_long_worker_disabled');
  const policy = configuredEngineSpendPolicy();
  const actual = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  if (actual !== policy.sourceRevision) throw Error('engine_long_worker_revision_mismatch');
  const changed = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const extraSource = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', 'app', 'lib', 'backend', 'scripts'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  if (changed || extraSource) throw Error('engine_long_worker_source_not_clean');
  assertProdGenerationAllowed(); assertEnvSeparation();
  // Imports occur only after explicit activation and exact source verification. Never run this entry in USD0 verification.
  const { prisma } = await import('../lib/prisma');
  const { runProductionPersonalWorker } = await import('../lib/engine-site/production-worker');
  const { chainGenerationWorker } = await import('../lib/generation-chunked/chain-worker');
  const { reconcileEngineGeneration } = await import('../lib/engine-site/generation-backstop');
  const { engineRecoveryDue, recordEngineInfrastructureFault, clearEngineInfrastructureFault } = await import('../lib/engine-site/failure-policy');
  do {
    const jobs = await prisma.generationJob.findMany({ where: { currentStage: 'engine_site_long', status: { in: ['pending', 'running'] },
      OR: [{ lockedBy: null }, { leaseExpiresAt: { lt: new Date() } }] }, orderBy: { updatedAt: 'asc' }, take: 5, select: { orderId: true } });
    for (const job of jobs) {
      try {
        if (!await engineRecoveryDue(prisma, job.orderId, 'long')) continue;
        const backstop = await reconcileEngineGeneration(prisma, job.orderId);
        if (backstop.status !== 'long') continue;
        const result = await runProductionPersonalWorker(prisma, job.orderId, 'long');
        if (result.kind === 'progress' || result.kind === 'pending') await clearEngineInfrastructureFault(prisma, job.orderId, 'long');
        if (result.kind === 'pending') chainGenerationWorker(job.orderId, undefined, { delayMs: 15_000 });
        else if (result.kind === 'progress' && !['done', 'accept'].includes(result.phase)) chainGenerationWorker(job.orderId);
        break; // At most one paid invocation per scan; free failures cannot block the rest of the queue.
      } catch (error) {
        await recordEngineInfrastructureFault(prisma, job.orderId, 'long', error).catch(() => {});
      }
    }
    if (!once) await new Promise(resolve => setTimeout(resolve, 10_000));
  } while (!once);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  engineLongWorkerMain(process.argv.includes('--once')).catch(() => { console.error('engine_long_worker_stopped'); process.exitCode = 1; });
}
