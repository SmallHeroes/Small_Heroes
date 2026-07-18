/**
 * Cutover Track 1.3 — explicit quarantine of pre-cutover in-flight work.
 * DESIGN + rationale: backend/cutover/QUARANTINE-DESIGN.md.
 *
 * Parks the 19 `generating` + 1 `paid` Orders and their GenerationJobs terminally, writes a manual register, and
 * neutralizes safely-cancellable ExceptionCases — so NOTHING auto-resumes once generation is enabled. It NEVER sets
 * Order.status='failed' (that auto-refunds — see the design) and NEVER opens a fresh ExceptionCase.
 *
 * Touches PRODUCTION data — DRY-RUN by default (writes nothing but the register snapshot).
 *   # dry-run: prints the target set + snapshot, writes backend/cutover/QUARANTINE-REGISTER.dryrun.csv only
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/cutover-quarantine.ts
 *   # commit (ONLY after Guy/Codex review the dry-run register):
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/cutover-quarantine.ts --commit --i-understand-this-writes-production
 *
 * Flags: --order-ids=o1,o2 (explicit allowlist instead of the status predicate)
 *        --expect-orders=20 --expect-jobs=3 (fail-closed count invariant; refuses on mismatch)
 *        --before=2026-07-18T00:00:00Z (only orders created before this cutoff; default: now)
 */
import fs from 'fs';
import path from 'path';
import { OrderStatus, type ExceptionCaseKind } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { writeOrderHoldFenced } from '../lib/generation-pipeline/order-authority';
import { resolveActiveRecoveryCaseInTx, EXCEPTION_SCOPE_BASE_BOOK } from '../lib/generation-chunked/exception-case';

const argv = process.argv.slice(2);
const has = (f: string): boolean => argv.includes(f);
const val = (f: string): string | undefined => {
  const a = argv.find((x) => x.startsWith(`${f}=`));
  return a ? a.slice(f.length + 1) : undefined;
};

const COMMIT = has('--commit') && has('--i-understand-this-writes-production');
const EXPECT_ORDERS = Number(val('--expect-orders') ?? '20');
const EXPECT_JOBS = Number(val('--expect-jobs') ?? '3');
const ORDER_IDS = val('--order-ids')?.split(',').map((s) => s.trim()).filter(Boolean);
const BEFORE = new Date(val('--before') ?? new Date().toISOString());

function maskDbHost(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? '');
    return `${u.protocol}//***@${u.hostname}${u.pathname}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

type PlanItem = { id: string; prior: string; caseKind?: ExceptionCaseKind; caseStatus?: string };

async function main(): Promise<void> {
  console.log(`[quarantine] DB: ${maskDbHost()}  mode: ${COMMIT ? 'COMMIT (writes prod)' : 'DRY-RUN (no writes)'}`);

  // 1) target set — explicit allowlist OR the status predicate, created before the cutoff.
  const orders = await prisma.order.findMany({
    where: ORDER_IDS
      ? { id: { in: ORDER_IDS } }
      : { status: { in: [OrderStatus.generating, OrderStatus.paid] }, createdAt: { lt: BEFORE } },
    select: {
      id: true, status: true, createdAt: true, customerEmail: true, totalPrice: true,
      paymentProvider: true, stripePaymentId: true, paymeTransactionId: true,
      generationJob: { select: { status: true, currentStage: true, retryable: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const runningJobs = await prisma.generationJob.count({
    where: { orderId: { in: orders.map((o) => o.id) }, status: 'running' },
  });
  console.log(`[quarantine] matched ${orders.length} orders (expect ${EXPECT_ORDERS}), ${runningJobs} running jobs (expect ${EXPECT_JOBS}).`);

  // 2) fail-closed count invariant (skipped only for an explicit --order-ids allowlist).
  if (!ORDER_IDS && (orders.length !== EXPECT_ORDERS || runningJobs !== EXPECT_JOBS)) {
    throw new Error(
      `[quarantine] REFUSED: count mismatch (orders ${orders.length}!=${EXPECT_ORDERS} or runningJobs ${runningJobs}!=${EXPECT_JOBS}). ` +
        `Re-check the §1.1 freeze, or pass --order-ids=... to target an explicit set.`,
    );
  }

  // 3) snapshot → register.
  const now = new Date();
  const rows = ['orderId,priorOrderStatus,paid,paymentProvider,paymentId,amountAgorot,customerEmail,jobStatus,jobStage,exceptionCaseId,exceptionCaseStatus,quarantinedAt,marker,resolution,resolvedBy,resolvedAt'];
  const plan: PlanItem[] = [];
  for (const o of orders) {
    const kase = await prisma.exceptionCase.findUnique({
      where: { activeKey: `${o.id}:${EXCEPTION_SCOPE_BASE_BOOK}` },
      select: { id: true, status: true, kind: true },
    });
    const paymentId = o.stripePaymentId ?? o.paymeTransactionId ?? '';
    const paid = Boolean(paymentId) || o.status === OrderStatus.paid;
    rows.push([
      o.id, o.status, String(paid), o.paymentProvider ?? '', paymentId, String(o.totalPrice ?? ''), o.customerEmail ?? '',
      o.generationJob?.status ?? '', o.generationJob?.currentStage ?? '', kase?.id ?? '', kase?.status ?? '',
      now.toISOString(), `quarantine_cutover:${o.status}`, '', '', '',
    ].join(','));
    plan.push({ id: o.id, prior: o.status, caseKind: kase?.kind, caseStatus: kase?.status });
  }
  const outDir = path.join(process.cwd(), 'backend', 'cutover');
  fs.mkdirSync(outDir, { recursive: true });
  const regPath = path.join(outDir, `QUARANTINE-REGISTER${COMMIT ? '' : '.dryrun'}.csv`);
  fs.writeFileSync(regPath, `${rows.join('\n')}\n`, 'utf8');
  console.log(`[quarantine] register written: ${regPath}`);

  const flagged = plan.filter((p) => p.caseStatus && ['refund_pending', 'customer_action'].includes(p.caseStatus));
  if (flagged.length) {
    console.log(`[quarantine] ⚠ ${flagged.length} order(s) carry a refund_pending/customer_action case — a real payment obligation. Resolve these MANUALLY before turning READINESS_MANIFEST_ENABLED on: ${flagged.map((f) => f.id).join(', ')}`);
  }

  if (!COMMIT) {
    console.log('[quarantine] DRY-RUN complete — no state changed. Review the register, then re-run with --commit --i-understand-this-writes-production.');
    return;
  }

  // 4) COMMIT — per order: park job (excludes it from sweeper+lease), neutralize a safely-cancellable case, park order.
  let parked = 0;
  for (const p of plan) {
    await prisma.generationJob.updateMany({
      where: { orderId: p.id },
      data: { status: 'failed', currentStage: 'failed', retryable: false, lastError: 'cutover_quarantine', failedAt: now },
    });
    if (p.caseKind) {
      // The resolver self-guards: it cancels ONLY open/retry_scheduled cases with no external action; it no-ops a
      // refund_pending/customer_action (payment-obligation) case, which is then left for manual resolution.
      await prisma.$transaction((tx) => resolveActiveRecoveryCaseInTx(tx, { orderId: p.id, kinds: [p.caseKind as ExceptionCaseKind], reason: 'cutover_quarantine', now }));
    }
    const res = await writeOrderHoldFenced(prisma, {
      orderId: p.id, newStatus: 'needs_human_qa', newHoldReason: `quarantine_cutover:${p.prior}`, requireNotDelivered: true,
    });
    console.log(`[quarantine] ${p.id}: job→failed/failed, order→${res}`);
    if (res === 'applied') parked += 1;
  }
  console.log(`[quarantine] COMMIT complete — ${parked}/${plan.length} orders parked. Verify all target jobs are failed/failed and orders are needs_human_qa (quarantine_cutover:*), fill the register resolutions, THEN proceed to Track 3.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
