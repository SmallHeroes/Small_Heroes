import 'server-only';
import { z } from 'zod';
import type { Prisma, PrismaClient } from '@prisma/client';
import { canonicalHash } from '@/lib/canonical-json';
import { assertEnginePrivateDatabase } from './private-assets';
import { identifierSchema, engineSiteFail } from './contract';
import { launchGatePolicySchema, policyDigest, type LaunchGatePolicy } from './delivery-gate';
const CURRENT = 'engine-site-launch-policy/v1/current';
const DEFAULT: LaunchGatePolicy = { version: 'engine-site-launch-gate/v1', revision: 'launch_required_v1', mode: 'required',
  changedBy: 'system_launch_default', changedAt: '2026-11-04T00:00:00.000Z', reason: 'Guy: each launch book requires an operator review above automatic acceptance.' };
const stateSchema = z.object({ version: z.literal('engine-site-launch-policy-state/v1'), policy: launchGatePolicySchema }).strict();
const commandSchema = z.object({ idempotencyKey: identifierSchema, expectedPolicySha256: z.string().length(64),
  mode: z.enum(['required', 'off']), reason: z.string().trim().min(1).max(500), actorId: identifierSchema }).strict();
export async function ensureEngineLaunchPolicy(db: PrismaClient) {
  await assertEnginePrivateDatabase(db);
  await db.wizardSession.upsert({ where: { sessionId: CURRENT }, update: {}, create: { sessionId: CURRENT,
    data: { version: 'engine-site-launch-policy-state/v1', policy: DEFAULT } } });
}
/** Lock global policy before Order. A concurrent gate change cannot pass between the send-time checks and CAS. */
export async function readEngineLaunchPolicy(db: Pick<Prisma.TransactionClient, 'wizardSession' | '$queryRaw'>, lock = false) {
  await assertEnginePrivateDatabase(db);
  if (lock) await db.$queryRaw`SELECT id FROM "WizardSession" WHERE "sessionId"=${CURRENT} FOR SHARE`;
  const row = await db.wizardSession.findUnique({ where: { sessionId: CURRENT } });
  if (!row) engineSiteFail('engine_launch_policy_missing');
  const policy = stateSchema.parse(row.data).policy;
  if (policyDigest(policy) === policyDigest(DEFAULT)) return policy;
  const event = await db.wizardSession.findUnique({ where: { sessionId: `engine-site-launch-policy/v1/event/${policy.revision}` } });
  const saved = z.object({ command: commandSchema, policy: launchGatePolicySchema }).strict().parse(event?.data);
  if (policyDigest(saved.policy) !== policyDigest(policy) || saved.command.idempotencyKey !== policy.revision ||
      saved.command.actorId !== policy.changedBy || saved.command.mode !== policy.mode || saved.command.reason !== policy.reason)
    engineSiteFail('engine_launch_policy_audit_changed');
  return policy;
}
/** Called only with the authenticated allowlisted session actor. No client actor/time or environment boolean can disable review. */
export async function changeEngineLaunchPolicy(db: PrismaClient, input: Omit<z.infer<typeof commandSchema>, 'actorId'>, actorId: string, now = new Date()) {
  const command = commandSchema.parse({ ...input, actorId }); await ensureEngineLaunchPolicy(db);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "WizardSession" WHERE "sessionId"=${CURRENT} FOR UPDATE`;
    const key = `engine-site-launch-policy/v1/event/${command.idempotencyKey}`;
    const previous = await tx.wizardSession.findUnique({ where: { sessionId: key } });
    if (previous) {
      const saved = z.object({ command: commandSchema, policy: launchGatePolicySchema }).strict().parse(previous.data);
      if (canonicalHash(saved.command) !== canonicalHash(command)) engineSiteFail('engine_launch_policy_replay_conflict');
      return saved.policy;
    }
    const current = await readEngineLaunchPolicy(tx);
    if (policyDigest(current) !== command.expectedPolicySha256 || now.toISOString() < current.changedAt) engineSiteFail('engine_launch_policy_conflict');
    const policy = launchGatePolicySchema.parse({ version: DEFAULT.version, revision: command.idempotencyKey, mode: command.mode,
      changedBy: command.actorId, changedAt: now.toISOString(), reason: command.reason });
    await tx.wizardSession.create({ data: { sessionId: key, data: { command, policy } as unknown as Prisma.InputJsonValue } });
    await tx.wizardSession.update({ where: { sessionId: CURRENT }, data: { data: { version: 'engine-site-launch-policy-state/v1', policy } } });
    return policy;
  });
}
