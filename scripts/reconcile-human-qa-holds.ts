/**
 * (Human-QA Slice 1, re-gate P1-3) Idempotent RECONCILER for orders sitting in terminal `needs_human_qa`. It is the
 * guaranteed REPAIR for a review case whose POST-COMMIT write failed at a seam (the design deliberately moves case
 * creation out of every hold/money transaction — see lib/human-qa/sync-hold-case.ts). It is ALSO the backfill for
 * orders held before the case tables existed (the `cmrnuhsva` gap).
 *
 * It delegates EVERY classification decision to `syncHumanQaHoldCase` → `classifyHoldForCase`, the SAME function the
 * seams call post-commit, so the reconciler and the live path can never diverge. That classifier:
 *   - opens a case for a terminal MANUAL hold (safety / contract_world / anchor marker, or the payment fence) — a
 *     terminal marker WINS even over an active recovery case (a safety hold must get a case regardless);
 *   - SKIPS a recoverable `base_book_integrity:` park (owned by the ExceptionCase auto-recovery loop);
 *   - SKIPS an order with an active recovery ExceptionCase ONLY when it has no terminal manual marker (P2 fix: the
 *     header no longer claims active recovery is ALWAYS skipped — the marker is checked first);
 *   - NEVER auto-backfills an unknown/null marker — that requires explicit `--include-unknown`.
 * This closes the "total classifier" NO-GO: a recoverable hold no longer gets a spurious case + operator email.
 *
 * IDEMPOTENT: a re-run creates nothing new — `recordHumanQaHoldInTx` (inside `syncHumanQaHoldCase`) is idempotent and
 * each order runs in its OWN transaction, so a concurrent-reconcile conflict rolls back only that one order.
 *
 * (re-gate P0-B) The reconcile LOOP itself now lives in the shared, prod-capable core `lib/human-qa/reconcile-core.ts`
 * (also driven by the scheduled cron `app/api/generate/cron/human-qa-reconcile`). THIS script is the MANUAL,
 * STAGING-ONLY wrapper: it keeps `assertEnvSeparation()`, which HARD-REFUSES if any resource points at prod. The cron
 * deliberately does NOT inherit that guard so it can repair holds in production.
 *
 *   # dry-run everything (reports what it WOULD create, writes nothing):
 *   SH_ENV_FILE=.env.local npx tsx --require ./scripts/shims/register-server-only.cjs \
 *     scripts/reconcile-human-qa-holds.ts --dry-run
 *
 *   # reconcile a single order (e.g. the one that proved the gap):
 *   SH_ENV_FILE=.env.local npx tsx --require ./scripts/shims/register-server-only.cjs \
 *     scripts/reconcile-human-qa-holds.ts --only cmrnuhsva
 *
 *   # ALSO backfill historical unknown/null markers (explicit opt-in — off by default):
 *   SH_ENV_FILE=.env.local npx tsx --require ./scripts/shims/register-server-only.cjs \
 *     scripts/reconcile-human-qa-holds.ts --include-unknown
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: process.env.SH_ENV_FILE || '.env.local' });

interface Cli {
  help: boolean;
  dryRun: boolean;
  includeUnknown: boolean;
  onlyOrderId: string | null;
}

function parseCli(argv: string[]): Cli {
  const cli: Cli = { help: false, dryRun: false, includeUnknown: false, onlyOrderId: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      cli.help = true;
    } else if (arg === '--dry-run') {
      cli.dryRun = true;
    } else if (arg === '--include-unknown') {
      cli.includeUnknown = true;
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

const USAGE = `reconcile-human-qa-holds — idempotent repair/backfill of Human-QA review cases for held orders.

Opens exactly one HumanQaReviewCase (+ its scheduled OperatorNotificationOutbox) for every order in terminal
'needs_human_qa' whose TERMINAL MANUAL hold has no active case. Delegates classification to the same function the
live seams use, so recoverable holds (base_book_integrity), orders owned by the ExceptionCase recovery loop, and
unrecognized markers are SKIPPED — never given a spurious case. Safe to re-run — nothing new on a second pass.

Usage:
  tsx --require ./scripts/shims/register-server-only.cjs scripts/reconcile-human-qa-holds.ts [options]

Options:
  --dry-run            Report what WOULD be created; write nothing.
  --include-unknown    ALSO backfill orders with an unknown/null hold marker (kind=legacy_unknown). Off by default —
                       an unrecognized park is never auto-backfilled without this explicit opt-in.
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
  const { reconcileHumanQaHolds } = await import('@/lib/human-qa/reconcile-core');

  // Refuse to touch prod (guards the .env.local → prod-DB trap) BEFORE any read/write. THIS guard is the manual
  // script's alone — the shared core + cron do NOT have it (the cron must repair holds in production).
  assertEnvSeparation();

  // `--only` with no match: distinguish "no such order" from "order exists but isn't held" so the operator gets a
  // clear reason nothing happened (rather than a silent empty scan).
  if (cli.onlyOrderId) {
    const exists = await prisma.order.findUnique({ where: { id: cli.onlyOrderId }, select: { status: true } });
    if (!exists) {
      console.log(`[reconcile] order ${cli.onlyOrderId} not found — nothing to reconcile.`);
      await prisma.$disconnect();
      return;
    }
    if (exists.status !== 'needs_human_qa') {
      console.log(
        `[reconcile] order ${cli.onlyOrderId} is status=${exists.status}, not needs_human_qa — nothing to reconcile.`,
      );
      await prisma.$disconnect();
      return;
    }
  }

  const summary = await reconcileHumanQaHolds(prisma, {
    includeUnknown: cli.includeUnknown,
    dryRun: cli.dryRun,
    onlyOrderId: cli.onlyOrderId,
    onResult: (orderId, action, detail) => {
      if (action === 'created') {
        console.log(`[reconcile] created ${detail.kind} case${detail.caseId ? ` ${detail.caseId}` : ''} for order ${orderId} (scope=${detail.scope})`);
      } else if (action === 'would_create') {
        console.log(`[reconcile] WOULD create ${detail.kind} case for order ${orderId} (scope=${detail.scope})`);
      } else if (action === 'error') {
        console.error(`[reconcile] ERROR reconciling order ${orderId}: ${detail.message}`);
      }
    },
  });

  console.log('');
  console.log('── reconcile summary ─────────────────────────────');
  console.log(`  mode:             ${cli.dryRun ? 'DRY-RUN (no writes)' : 'apply'}`);
  console.log(`  include-unknown:  ${cli.includeUnknown ? 'yes' : 'no'}`);
  console.log(`  scanned:          ${summary.scanned}`);
  if (cli.dryRun) {
    console.log(`  would-create:     ${summary.wouldCreate}`);
  } else {
    console.log(`  created:          ${summary.created}`);
  }
  console.log(`  idempotent:       ${summary.idempotent}`);
  const skippedKeys = Object.keys(summary.skipped).sort();
  const skippedTotal = skippedKeys.reduce((n, k) => n + summary.skipped[k], 0);
  console.log(
    `  skipped:          ${skippedTotal}${skippedKeys.length ? ` → ${skippedKeys.map((k) => `${k}:${summary.skipped[k]}`).join(', ')}` : ''}`,
  );
  console.log(`  oldest-missing:   ${Math.round(summary.oldestMissingCaseAgeMs / 1000)}s`);
  if (summary.errors.length) {
    console.log(`  errors:           ${summary.errors.length}`);
    for (const e of summary.errors) console.log(`    - ${e.orderId}: ${e.message}`);
  }
  console.log('──────────────────────────────────────────────────');
  if (summary.legacyUnknown.length) {
    console.log(
      `[reconcile] NOTE: ${summary.legacyUnknown.length} legacy_unknown order(s) were ` +
        `${cli.dryRun ? 'would-be ' : ''}backfilled (via --include-unknown) AND need explicit operator triage: ${summary.legacyUnknown.join(', ')}`,
    );
  }

  await prisma.$disconnect();
  if (summary.errors.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
