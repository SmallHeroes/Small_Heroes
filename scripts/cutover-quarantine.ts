/**
 * Cutover Track 1.3 — explicit quarantine of pre-cutover in-flight work (HARDENED per Codex re-gate).
 * DESIGN + rationale: backend/cutover/QUARANTINE-DESIGN.md. Core logic + tests: lib/cutover/quarantine-park.ts.
 *
 * Parks the pre-cutover `generating`/`paid` Orders and their GenerationJobs terminally, writes a PII-free register,
 * and neutralizes safely-cancellable ExceptionCases — so NOTHING auto-resumes once generation is enabled. It NEVER
 * sets Order.status='failed' (that auto-refunds — see the design) and NEVER opens a fresh ExceptionCase.
 *
 * SEQUENCING: this runs ONLY after the Track-2 reconciliation bridge lands (ExceptionCase / HumanQaReviewCase tables,
 * Order.deliveryFenceVersion / manualReviewRequired, the needs_human_qa enum). A schema preflight enforces that.
 *
 * Touches PRODUCTION data — DRY-RUN by default.
 *   # dry-run: preflight + snapshot; writes backend/cutover/QUARANTINE-REGISTER.dryrun.csv only (no DB writes)
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/cutover-quarantine.ts
 *   # commit (ONLY after Guy/Codex review the dry-run register):
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/cutover-quarantine.ts --commit --i-understand-this-writes-production
 *
 * Flags: --order-ids=o1,o2 · --expect-orders=20 --expect-jobs=3 (fail-closed) · --before=2026-07-18T00:00:00Z
 * Exits NON-ZERO on: schema-preflight failure, PAYMENT_PROVIDER != payme, count mismatch, ANY active
 * refund_pending/customer_action case, a per-order park abort, or a post-verification mismatch.
 */
import fs from 'fs';
import path from 'path';
import { OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
  assertSchemaPreflight, classifyPayment, scanActiveCases, blockingCases, parkOneOrderAtomic, verifyParked,
  type ActiveCaseRow,
} from '../lib/cutover/quarantine-park';

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

function die(msg: string): never {
  console.error(msg);
  void prisma.$disconnect();
  process.exit(1);
}
function maskDbHost(): string {
  try { const u = new URL(process.env.DATABASE_URL ?? ''); return `${u.protocol}//***@${u.hostname}${u.pathname}`; } catch { return '(unparseable DATABASE_URL)'; }
}

async function main(): Promise<void> {
  console.log(`[quarantine] DB: ${maskDbHost()}  mode: ${COMMIT ? 'COMMIT (writes prod)' : 'DRY-RUN (no DB writes)'}`);

  // ── Preflight ─────────────────────────────────────────────────────────────────────────────────────────────────
  // (P1-5b) Stripe webhook status-writes are inert when PayMe is the active provider (the handler early-returns for a
  // non-Stripe provider), so lock PayMe for the window rather than editing the payment path.
  if ((process.env.PAYMENT_PROVIDER ?? '') !== 'payme') {
    die(`[quarantine] REFUSED: PAYMENT_PROVIDER='${process.env.PAYMENT_PROVIDER ?? ''}' — must be 'payme' so Stripe cannot overwrite a parked order. Lock it for the window.`);
  }
  // (P0-4) The park depends on bridge schema; fail closed if it is not present yet.
  try { await assertSchemaPreflight(prisma); } catch (e) { die(e instanceof Error ? e.message : String(e)); }

  // ── Target set + fail-closed count invariant ──────────────────────────────────────────────────────────────────
  const orders = await prisma.order.findMany({
    where: ORDER_IDS ? { id: { in: ORDER_IDS } } : { status: { in: [OrderStatus.generating, OrderStatus.paid] }, createdAt: { lt: BEFORE } },
    select: { id: true, status: true, createdAt: true, stripePaymentId: true, paymeTransactionId: true, generationJob: { select: { status: true, currentStage: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const runningJobs = await prisma.generationJob.count({ where: { orderId: { in: orders.map((o) => o.id) }, status: 'running' } });
  console.log(`[quarantine] matched ${orders.length} orders (expect ${EXPECT_ORDERS}), ${runningJobs} running jobs (expect ${EXPECT_JOBS}).`);
  if (!ORDER_IDS && (orders.length !== EXPECT_ORDERS || runningJobs !== EXPECT_JOBS)) {
    die(`[quarantine] REFUSED: count mismatch — re-check the §1.1 freeze, or pass --order-ids=... for an explicit set.`);
  }

  // ── (P0-2) Scan ALL active cases in EVERY scope; HARD-STOP on any refund_pending/customer_action ───────────────
  const allCases = await scanActiveCases(prisma, orders.map((o) => o.id));
  const blocking = blockingCases(allCases);
  if (blocking.length > 0) {
    die(`[quarantine] REFUSED: ${blocking.length} active refund_pending/customer_action case(s) carry a payment/customer obligation — resolve MANUALLY first: ${blocking.map((c) => `${c.orderId}#${c.scope}:${c.status}`).join(', ')}`);
  }
  const casesByOrder = new Map<string, ActiveCaseRow[]>();
  for (const c of allCases) { const a = casesByOrder.get(c.orderId) ?? []; a.push(c); casesByOrder.set(c.orderId, a); }

  // ── (P1-6 + P0-8) Classify payment from PaymentRecord/ids (never Order.status); register carries IDENTIFIERS ONLY ─
  const now = new Date();
  const rows = ['orderId,priorOrderStatus,paymentClass,jobStatus,jobStage,activeCaseCount,activeCaseScopes,quarantinedAt,marker,resolution,resolvedBy,resolvedAt'];
  const plan: Array<{ id: string; prior: string; cases: ActiveCaseRow[] }> = [];
  for (const o of orders) {
    const rec = await prisma.paymentRecord.findUnique({ where: { orderId: o.id }, select: { provider: true, paid: true } });
    const cls = classifyPayment(o, rec);
    const oc = casesByOrder.get(o.id) ?? [];
    rows.push([o.id, o.status, cls, o.generationJob?.status ?? '', o.generationJob?.currentStage ?? '', String(oc.length), oc.map((c) => c.scope).join('|'), now.toISOString(), `quarantine_cutover:${o.status}`, '', '', ''].join(','));
    plan.push({ id: o.id, prior: o.status, cases: oc });
  }
  const outDir = path.join(process.cwd(), 'backend', 'cutover');
  fs.mkdirSync(outDir, { recursive: true });
  const regPath = path.join(outDir, `QUARANTINE-REGISTER${COMMIT ? '' : '.dryrun'}.csv`);
  fs.writeFileSync(regPath, `${rows.join('\n')}\n`, 'utf8');
  console.log(`[quarantine] register (identifiers only, no PII): ${regPath}`);
  const paidLike = plan.filter((p) => { const cls = classifyPayment(orders.find((o) => o.id === p.id)!, null); return cls !== 'unpaid'; });
  if (paidLike.length) console.log(`[quarantine] note: ${paidLike.length} order(s) classify as paid/status-paid/fake — see paymentClass column (no external refund is owed per the verified prod state).`);

  if (!COMMIT) {
    console.log('[quarantine] DRY-RUN complete — no DB writes. Review the register, then re-run with --commit --i-understand-this-writes-production.');
    return;
  }

  // ── (P0-1) COMMIT — one atomic transaction per order; a failure leaves that order UNTOUCHED ────────────────────
  for (const p of plan) {
    try {
      await parkOneOrderAtomic(prisma, { orderId: p.id, prior: p.prior, cases: p.cases, now });
      console.log(`[quarantine] ${p.id}: parked (job→failed/failed, order→needs_human_qa quarantine_cutover:${p.prior})`);
    } catch (e) {
      die(`[quarantine] ABORT at ${p.id}: ${e instanceof Error ? e.message : String(e)} — this order is untouched (tx rolled back). Fix and re-run (idempotent).`);
    }
  }

  // ── (P0-7) Hard post-verification — non-zero exit if even one did not park exactly ────────────────────────────
  const mismatches = await verifyParked(prisma, plan.map((p) => p.id));
  if (mismatches.length > 0) {
    die(`[quarantine] POST-VERIFY FAILED: ${mismatches.map((m) => `${m.orderId} (${m.reason})`).join('; ')}`);
  }
  console.log(`[quarantine] COMMIT + verify OK — ${plan.length} orders parked exactly. Fill the register resolutions, THEN proceed to Track 3.`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
