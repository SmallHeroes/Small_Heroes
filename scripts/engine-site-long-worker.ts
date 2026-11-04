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
  do {
    const jobs = await prisma.generationJob.findMany({ where: { currentStage: 'engine_site_long', status: { in: ['pending', 'running'] },
      OR: [{ lockedBy: null }, { leaseExpiresAt: { lt: new Date() } }] }, orderBy: { updatedAt: 'asc' }, take: 1, select: { orderId: true } });
    if (jobs[0]) {
      const result = await runProductionPersonalWorker(prisma, jobs[0].orderId, 'long');
      if (result.kind === 'progress' && !['done', 'accept'].includes(result.phase)) chainGenerationWorker(jobs[0].orderId);
    }
    if (!once) await new Promise(resolve => setTimeout(resolve, 10_000));
  } while (!once);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  engineLongWorkerMain(process.argv.includes('--once')).catch(() => { console.error('engine_long_worker_stopped'); process.exitCode = 1; });
}
