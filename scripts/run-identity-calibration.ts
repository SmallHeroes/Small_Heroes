/**
 * IDENTITY CALIBRATION HARNESS (Phase 1 — NO RENDERS, vision/text spend only).
 *
 * Calibrates IDENTITY_VISION_MIN_CONFIDENCE for the reroll identity gate (child-identity-vision.ts) on
 * REAL, already-rendered pages:
 *   - POSITIVES (same child): each order's approved child anchor vs its OWN rendered pages (same child by
 *     construction). Includes the T16 order (cmqt4635e) pages 1-2 + the page-3 storage images (the reroll
 *     that scored the 0.252 false-low + attempt-0).
 *   - NEGATIVES (different child): order A's anchor vs order B's page where childName differs.
 * Scores every pair with checkChildIdentityViaVision, sweeps the confidence threshold, prints a confusion
 * matrix, and recommends a threshold in [0.75,0.85] that holds false-fails at ~0 while catching different
 * children — while confirming the same→pass side actually passes.
 *
 * NOT a render. One gpt-4o vision call per pair (text+vision). Set CALIB_DRY_RUN=1 to gather + size the
 * data without any vision calls (free).
 *
 * Usage:  npx tsx scripts/run-identity-calibration.ts            (scores ~MAX_POS + MAX_NEG pairs)
 *         CALIB_DRY_RUN=1 npx tsx scripts/run-identity-calibration.ts   (gather only, no spend)
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

const DRY = process.env.CALIB_DRY_RUN === '1';
const MAX_POS = Number(process.env.CALIB_MAX_POS ?? 30);
const MAX_NEG = Number(process.env.CALIB_MAX_NEG ?? 30);
const T16_ORDER = 'cmqt4635e0002il04xrm12dde';
const T16_PAGES_BASE =
  'https://qvksgpzzosotubcbizay.supabase.co/storage/v1/object/public/book-images/orders/cmqt4635e0002il04xrm12dde/pages/';

const normName = (n: string | null | undefined): string => (n ?? '').trim().toLowerCase();

interface Subject {
  orderId: string;
  child: string;
  anchorUrl: string;
  pages: Array<{ n: number; url: string }>;
}
interface Pair {
  anchor: string;
  page: string;
  label: 'same' | 'different';
  src: string;
}
interface Scored extends Pair {
  verdict: 'same' | 'different' | 'uncertain' | 'error';
  confidence: number;
  reason: string;
}

/** Deterministic, evenly-strided sample (no RNG) so the run is reproducible. */
function sample<T>(arr: T[], n: number, seed: number): T[] {
  if (arr.length <= n) return arr.slice();
  const out: T[] = [];
  const step = arr.length / n;
  for (let i = 0; out.length < n; i++) out.push(arr[Math.floor((i * step + seed) % arr.length)]);
  return out;
}

async function main() {
  const { prisma } = await import('@/lib/prisma');
  const { getApprovedChildCanonicalAnchor } = await import('@/lib/generation-pipeline/character-anchor-store');
  const { checkChildIdentityViaVision } = await import('@/lib/generation-pipeline/child-identity-vision');

  const orders = await prisma.order.findMany({
    where: { generationJob: { isNot: null } },
    select: {
      id: true,
      childName: true,
      generationJob: { select: { pipelineCache: true } },
      book: { select: { pages: { select: { pageNumber: true, imageAsset: { select: { url: true } } } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const subjects: Subject[] = [];
  for (const o of orders) {
    const cache = (o.generationJob?.pipelineCache ?? {}) as never;
    let anchorUrl: string | undefined;
    try {
      anchorUrl = getApprovedChildCanonicalAnchor(cache)?.url;
    } catch {
      anchorUrl = undefined;
    }
    if (!anchorUrl) continue;
    const pages = (o.book?.pages ?? [])
      .filter((p) => p.imageAsset?.url)
      .map((p) => ({ n: p.pageNumber, url: p.imageAsset!.url }));
    if (!pages.length) continue;
    subjects.push({ orderId: o.id, child: normName(o.childName), anchorUrl, pages });
  }

  // Add the T16 page-3 storage images (same child, never promoted) as extra positives — the false-low case.
  const t16 = subjects.find((s) => s.orderId === T16_ORDER);
  if (t16) {
    t16.pages.push({ n: 301, url: `${T16_PAGES_BASE}page-003-9ea2875474231d38.png` }); // blocked reroll (0.252)
    t16.pages.push({ n: 302, url: `${T16_PAGES_BASE}page-003-ad0f0c94949a85c0.png` }); // attempt-0
  }

  const childPages = new Map<string, number>();
  for (const s of subjects) childPages.set(s.child, (childPages.get(s.child) ?? 0) + s.pages.length);
  console.log(`[calib] subjects=${subjects.length} distinct children=${childPages.size}`);
  for (const [c, n] of [...childPages.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  - "${c}": ${n} rendered page(s)`);
  }

  // POSITIVES: same-order anchor vs own pages (same child by construction).
  const positives: Pair[] = [];
  for (const s of subjects) {
    for (const p of s.pages) positives.push({ anchor: s.anchorUrl, page: p.url, label: 'same', src: `${s.orderId}#${p.n}` });
  }
  // NEGATIVES: cross-childName anchor vs page (different child).
  const negatives: Pair[] = [];
  for (const a of subjects) {
    for (const b of subjects) {
      if (a.child === b.child || !a.child || !b.child) continue;
      for (const p of b.pages) {
        negatives.push({ anchor: a.anchorUrl, page: p.url, label: 'different', src: `${a.child}~vs~${b.orderId}#${p.n}` });
      }
    }
  }

  const posSample = sample(positives, MAX_POS, 0);
  const negSample = sample(negatives, MAX_NEG, 7);
  console.log(
    `[calib] positives: ${positives.length} available → ${posSample.length} sampled; ` +
      `negatives: ${negatives.length} available → ${negSample.length} sampled`
  );

  if (childPages.size < 2) {
    console.warn('[calib] WARNING: <2 distinct children — negatives are unreliable. Need more distinct children.');
  }
  if (DRY) {
    console.log('[calib] DRY RUN — gathered only, no vision calls. Re-run without CALIB_DRY_RUN to score.');
    await prisma.$disconnect();
    return;
  }

  const all: Pair[] = [...posSample, ...negSample];
  const scored: Scored[] = [];
  for (let i = 0; i < all.length; i++) {
    const pair = all[i];
    try {
      const v = await checkChildIdentityViaVision(pair.anchor, pair.page);
      scored.push({ ...pair, verdict: v.sameChild, confidence: v.confidence, reason: v.reason });
      console.log(`[calib] ${i + 1}/${all.length} [${pair.label}] → ${v.sameChild}@${v.confidence.toFixed(2)}  (${pair.src})`);
    } catch (e) {
      scored.push({ ...pair, verdict: 'error', confidence: 0, reason: (e as Error)?.message ?? 'error' });
      console.warn(`[calib] ${i + 1}/${all.length} [${pair.label}] → ERROR ${(e as Error)?.message}`);
    }
  }

  // Confusion matrix across candidate thresholds.
  const pos = scored.filter((s) => s.label === 'same');
  const neg = scored.filter((s) => s.label === 'different');
  const thresholds = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9];
  const matrix = thresholds.map((t) => {
    const posPass = pos.filter((s) => s.verdict === 'same' && s.confidence >= t).length;
    const posFalseFail = pos.filter((s) => s.verdict === 'different' && s.confidence >= t).length;
    const negCatch = neg.filter((s) => s.verdict === 'different' && s.confidence >= t).length;
    const negMiss = neg.filter((s) => s.verdict === 'same' && s.confidence >= t).length; // different child PASSED — bad
    return {
      threshold: t,
      posN: pos.length,
      posPass,
      posFalseFail,
      posNotMeasurable: pos.length - posPass - posFalseFail,
      negN: neg.length,
      negCatch,
      negMiss,
      negNotMeasurable: neg.length - negCatch - negMiss,
    };
  });
  console.log('\n[calib] CONFUSION MATRIX (posFalseFail must be ~0; negCatch high; negMiss must be ~0):');
  console.table(matrix);

  // Recommend: in [0.75,0.85], minimize false-fails, then maximize catch.
  const band = matrix.filter((m) => m.threshold >= 0.75 && m.threshold <= 0.85);
  const recommended =
    [...band].sort((a, b) => a.posFalseFail - b.posFalseFail || b.negCatch - a.negCatch)[0] ?? matrix[0];
  console.log(
    `\n[calib] RECOMMENDED IDENTITY_VISION_MIN_CONFIDENCE = ${recommended.threshold}  ` +
      `(false-fails ${recommended.posFalseFail}/${recommended.posN}, different-child catch ${recommended.negCatch}/${recommended.negN}, ` +
      `negMiss ${recommended.negMiss}/${recommended.negN})`
  );

  const outDir = path.join(process.cwd(), 'outputs', 'identity-calibration');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'calibration.json');
  fs.writeFileSync(outFile, JSON.stringify({ recommended, matrix, scored }, null, 2));
  console.log(`[calib] wrote ${outFile}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
