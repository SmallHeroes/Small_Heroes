/**
 * IDENTITY CALIBRATION HARNESS (Phase 1 — NO RENDERS, vision/text spend only).
 *
 * Calibrates IDENTITY_VISION_MIN_CONFIDENCE for the reroll identity gate (child-identity-vision.ts) on
 * REAL, already-rendered pages:
 *   - POSITIVES (same child): each order's approved child anchor vs its OWN rendered pages (same child by
 *     construction). Includes the T16 order (cmqt4635e) pages 1-2 + the page-3 storage images (the reroll
 *     that scored the 0.252 false-low + attempt-0).
 *   - NEGATIVES (different child): order A's anchor vs order B's page where childName differs.
 * Scores every pair with checkChildIdentityViaVision, then applies the REAL gate policy — ASYMMETRIC:
 * same >= IDENTITY_VISION_SAME_MIN_CONFIDENCE → pass, different >= IDENTITY_VISION_DIFFERENT_MIN_CONFIDENCE
 * → fail, else human review — and writes that policy's confusion + the diagnostic per-threshold sweep, so
 * the artifact matches the gate (no symmetric-threshold drift). CALIB_ANALYZE_ONLY=1 recomputes from the
 * committed scores (no DB, no vision).
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
const ANALYZE_ONLY = process.env.CALIB_ANALYZE_ONLY === '1'; // recompute the matrix+policy from existing scores (no DB/vision)
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

/** Apply the REAL gate policy (asymmetric, from the gate module thresholds) to one scored pair. */
function classifyByPolicy(s: Scored, thr: { same: number; different: number }): 'pass' | 'fail' | 'not_measurable' {
  if (s.verdict === 'same' && s.confidence >= thr.same) return 'pass';
  if (s.verdict === 'different' && s.confidence >= thr.different) return 'fail';
  return 'not_measurable';
}

/** Confusion matrix (diagnostic sweep) + the REAL asymmetric policy result; writes the artifact. */
function analyzeAndWrite(
  scored: Scored[],
  thr: { same: number; different: number },
  outDir: string,
  outFile: string
): void {
  const pos = scored.filter((s) => s.label === 'same');
  const neg = scored.filter((s) => s.label === 'different');

  // Per-threshold sweep — diagnostic only; shows WHY one symmetric threshold can't split the false-passes.
  const thresholds = [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0];
  const matrix = thresholds.map((t) => {
    const posPass = pos.filter((s) => s.verdict === 'same' && s.confidence >= t).length;
    const posFalseFail = pos.filter((s) => s.verdict === 'different' && s.confidence >= t).length;
    const negCatch = neg.filter((s) => s.verdict === 'different' && s.confidence >= t).length;
    const negMiss = neg.filter((s) => s.verdict === 'same' && s.confidence >= t).length;
    return {
      threshold: t,
      posN: pos.length, posPass, posFalseFail, posNotMeasurable: pos.length - posPass - posFalseFail,
      negN: neg.length, negCatch, negMiss, negNotMeasurable: neg.length - negCatch - negMiss,
    };
  });

  // THE REAL GATE POLICY (asymmetric): same >= thr.same → pass; different >= thr.different → fail; else review.
  const tally = (rows: Scored[]) => {
    const r = { pass: 0, fail: 0, not_measurable: 0 };
    for (const s of rows) r[classifyByPolicy(s, thr)] += 1;
    return r;
  };
  const p = tally(pos);
  const n = tally(neg);
  const policy = {
    sameMinConfidence: thr.same,
    differentMinConfidence: thr.different,
    positives: { n: pos.length, autoPass: p.pass, falseFail: p.fail, humanReview: p.not_measurable },
    negatives: { n: neg.length, autoFail: n.fail, falsePass: n.pass, humanReview: n.not_measurable },
  };

  console.table(matrix);
  console.log(`\n[calib] ASYMMETRIC POLICY (the REAL gate — same>=${thr.same} → pass, different>=${thr.different} → fail):`);
  console.log(JSON.stringify(policy, null, 2));

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({ policy, matrix, scored }, null, 2));
  console.log(`[calib] wrote ${outFile}`);
}

async function main() {
  const outDir = path.join(process.cwd(), 'outputs', 'identity-calibration');
  const outFile = path.join(outDir, 'calibration.json');
  const { IDENTITY_VISION_SAME_MIN_CONFIDENCE, IDENTITY_VISION_DIFFERENT_MIN_CONFIDENCE } = await import(
    '@/lib/generation-pipeline/visual-contract-gate'
  );
  const thr = { same: IDENTITY_VISION_SAME_MIN_CONFIDENCE, different: IDENTITY_VISION_DIFFERENT_MIN_CONFIDENCE };

  // Recompute the matrix + policy from the committed scores (no DB, no vision spend).
  if (ANALYZE_ONLY) {
    const existing = JSON.parse(fs.readFileSync(outFile, 'utf8')) as { scored: Scored[] };
    console.log(`[calib] ANALYZE-ONLY: re-using ${existing.scored.length} scored pairs from ${outFile}`);
    analyzeAndWrite(existing.scored, thr, outDir, outFile);
    return;
  }

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

  analyzeAndWrite(scored, thr, outDir, outFile);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
