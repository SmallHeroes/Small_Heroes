/**
 * (Human-QA Slice 1, Unit 5) Idempotent RECONCILER / backfill for orders ALREADY sitting in terminal
 * `needs_human_qa`. The Unit-1 migration created HumanQaReviewCase / OperatorNotificationOutbox, but a migration
 * NEVER opens a case for an order that was held BEFORE those tables existed (or while `recordHumanQaHoldInTx` was
 * still inert). Those orders are silently held with NO case + NO operator notification — the gap that `cmrnuhsva`
 * proved. This script opens exactly one case (+ its scheduled operator notification) for every terminal
 * `needs_human_qa` order that has no active case.
 *
 * IDEMPOTENT: a re-run creates nothing new. Each order is pre-checked for an active case (`activeKey =
 * orderId:scope`) and skipped if one exists; even without that pre-check, `recordHumanQaHoldInTx` is idempotent (its
 * `ON CONFLICT DO NOTHING` inserts re-select the winning row), and each order runs in its OWN transaction so a
 * concurrent-reconcile conflict (P2002) rolls back only that one order.
 *
 * `legacy_unknown` orders (in needs_human_qa with no recognizable hold marker) ARE backfilled — a case is created —
 * AND listed in the summary for explicit operator attention.
 *
 * Runs on Guy's machine against the STAGING DB. `assertEnvSeparation()` HARD-REFUSES if any resource points at prod
 * (the `.env.local`→prod-DB trap). NEVER run against prod implicitly.
 *
 *   # dry-run everything (reports what it WOULD create, writes nothing):
 *   SH_ENV_FILE=.env.local npx tsx --require ./scripts/shims/register-server-only.cjs \
 *     scripts/reconcile-human-qa-holds.ts --dry-run
 *
 *   # reconcile a single order (e.g. the one that proved the gap):
 *   SH_ENV_FILE=.env.local npx tsx --require ./scripts/shims/register-server-only.cjs \
 *     scripts/reconcile-human-qa-holds.ts --only cmrnuhsva
 *
 *   # reconcile all held orders:
 *   SH_ENV_FILE=.env.local npx tsx --require ./scripts/shims/register-server-only.cjs \
 *     scripts/reconcile-human-qa-holds.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: process.env.SH_ENV_FILE || '.env.local' });

interface Cli {
  help: boolean;
  dryRun: boolean;
  onlyOrderId: string | null;
}

function parseCli(argv: string[]): Cli {
  const cli: Cli = { help: false, dryRun: false, onlyOrderId: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      cli.help = true;
    } else if (arg === '--dry-run') {
      cli.dryRun = true;
    } else if (arg === '--only') {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) throw new Error('--only requires an <orderId> argument');
      cli.onlyOrderId = next;
      i++;
    } else if (arg.startsWith('--only=')) {
      cli.onlyOrderId = arg.slice('--only='.length);
    } else {
      throw new Error(`Unrecognized argument: ${arg}`);
    }
  }
  return cli;
}

const USAGE = `reconcile-human-qa-holds — idempotent backfill of Human-QA review cases for already-held orders.

Opens one HumanQaReviewCase (+ its scheduled OperatorNotificationOutbox) for every order in terminal
'needs_human_qa' that has no active case. Safe to re-run — nothing new is created on a second pass.

Usage:
  tsx --require ./scripts/shims/register-server-only.cjs scripts/reconcile-human-qa-holds.ts [options]

Options:
  --dry-run            Report what WOULD be created; write nothing.
  --only <orderId>     Reconcile a single order only (e.g. --only cmrnuhsva).
  -h, --help           Show this help and exit (no DB access).

Env:
  SH_ENV_FILE          Dotenv file to load (default: .env.local).
  Refuses to run if any resource points at production (assertEnvSeparation).`;

async function main(): Promise<void> {
  const cli = parseCli(process.argv.slice(2));
  if (cli.help) {
    console.log(USAGE);
    return;
  }

  // Dynamic-import server modules AFTER loadEnv so validateEnv() sees the loaded env.
  const { prisma } = await import('@/lib/prisma');
  const { assertEnvSeparation } = await import('@/lib/generation-chunked/env-separation-guard');
  const { recordHumanQaHoldInTx } = await import('@/lib/human-qa/record-hold');
  const { planReconcileOrder } = await import('@/lib/human-qa/reconcile-plan');

  // Refuse to touch prod (guards the .env.local → prod-DB trap) BEFORE any read/write.
  assertEnvSeparation();

  const orders = await prisma.order.findMany({
    where: {
      status: 'needs_human_qa',
      ...(cli.onlyOrderId ? { id: cli.onlyOrderId } : {}),
    },
    select: {
      id: true,
      deliveryHoldReason: true,
      manualReviewRequired: true,
      childName: true,
      inputVersion: true,
      visualContractHash: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // `--only` with no match: distinguish "no such order" from "order exists but isn't held" so the operator gets a
  // clear reason nothing happened (rather than a silent empty scan).
  if (cli.onlyOrderId && orders.length === 0) {
    const exists = await prisma.order.findUnique({
      where: { id: cli.onlyOrderId },
      select: { status: true },
    });
    if (!exists) {
      console.log(`[reconcile] order ${cli.onlyOrderId} not found — nothing to reconcile.`);
    } else {
      console.log(
        `[reconcile] order ${cli.onlyOrderId} is status=${exists.status}, not needs_human_qa — nothing to reconcile.`,
      );
    }
    await prisma.$disconnect();
    return;
  }

  let created = 0;
  let wouldCreate = 0;
  let skippedExisting = 0;
  const unknownKind: string[] = [];
  const errors: Array<{ orderId: string; message: string }> = [];

  for (const order of orders) {
    const plan = planReconcileOrder(order);
    if (plan.needsOperatorAttention) unknownKind.push(plan.orderId);

    // An active case already covers this (orderId, scope) → nothing to do (idempotent skip).
    const active = await prisma.humanQaReviewCase.findUnique({ where: { activeKey: plan.activeKey } });
    if (active) {
      skippedExisting++;
      continue;
    }

    if (cli.dryRun) {
      wouldCreate++;
      console.log(
        `[reconcile] WOULD create ${plan.kind} case for order ${plan.orderId} ` +
          `(scope=${plan.scope}, rawReason=${plan.recordArgs.rawReason})`,
      );
      continue;
    }

    try {
      // Per-order transaction: a P2002 (a concurrent reconcile already opened the case) rolls back ONLY this order
      // and is a no-op on re-run. recordHumanQaHoldInTx is itself idempotent — a lost race re-selects the winning
      // case, so no duplicate case/outbox is ever created.
      const result = await prisma.$transaction((tx) => recordHumanQaHoldInTx(tx, plan.recordArgs));
      if (result.action === 'create') {
        created++;
        console.log(
          `[reconcile] created ${plan.kind} case ${result.caseId} (rev ${result.revision}) for order ${plan.orderId}`,
        );
      } else {
        // idempotent / supersede / skip_weaker: an active case already existed (raced). Count as skipped-existing.
        skippedExisting++;
        console.log(`[reconcile] order ${plan.orderId} already reconciled concurrently (${result.action}); skipped.`);
      }
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'P2002') {
        skippedExisting++;
        console.log(`[reconcile] order ${plan.orderId} reconciled concurrently (P2002); skipped.`);
      } else {
        errors.push({ orderId: plan.orderId, message: err instanceof Error ? err.message : String(err) });
        console.error(`[reconcile] ERROR reconciling order ${plan.orderId}:`, err);
      }
    }
  }

  console.log('');
  console.log('── reconcile summary ─────────────────────────────');
  console.log(`  mode:             ${cli.dryRun ? 'DRY-RUN (no writes)' : 'apply'}`);
  console.log(`  scanned:          ${orders.length}`);
  if (cli.dryRun) {
    console.log(`  would-create:     ${wouldCreate}`);
  } else {
    console.log(`  created:          ${created}`);
  }
  console.log(`  skipped-existing: ${skippedExisting}`);
  console.log(
    `  unknown-kind:     ${unknownKind.length}${unknownKind.length ? ` → ${unknownKind.join(', ')}` : ''}`,
  );
  if (errors.length) {
    console.log(`  errors:           ${errors.length}`);
    for (const e of errors) console.log(`    - ${e.orderId}: ${e.message}`);
  }
  console.log('──────────────────────────────────────────────────');
  if (unknownKind.length) {
    console.log(
      `[reconcile] NOTE: ${unknownKind.length} legacy_unknown order(s) were ` +
        `${cli.dryRun ? 'would-be ' : ''}backfilled AND need explicit operator attention: ${unknownKind.join(', ')}`,
    );
  }

  await prisma.$disconnect();
  if (errors.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
