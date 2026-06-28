/**
 * WHOLE-SCENE BASELINE on the diverse DEV set (Codex spec) — scores anchor→page with the CURRENT gate
 * (checkChildIdentityViaVision + the asymmetric policy IDENTITY_VISION_SAME_MIN/DIFFERENT_MIN). No image
 * renders; vision-judge only. 4 report buckets:
 *   - clear positives:  all 8 page-1 (anchor → own page-1)            → expect PASS
 *   - stress positives: all 8 page-2 (anchor → own page-2)            → expect PASS; c01,c09 tagged SEPARATELY
 *                       (their page-2 derives from the synthetic photo via the expression anchor, NOT the
 *                        canonical anchor — so NOT live-expression-path fidelity proof, just general stress)
 *   - hard negatives:   the 4 pA/pB directions, against page-1 ONLY (page-1 = controlled identical scene+wardrobe)
 *   - easy negatives:   a FIXED balanced sample of clearly-different children, against page-1
 *
 * NOTE: this set is NOT a valid proof of the ENTITY gate — any unexpected creature on a page is
 * `extraneous_entity` NOISE, not an identity failure.
 *
 * Usage:  npx tsx scripts/baseline-diverse-calibration.ts
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

// Actual stress per DEV page-2 (re-tag by eyeball — the rendered scene followed the per-index DESCRIPTION).
const ACTUAL_STRESS: Record<string, string> = {
  c01: 'profile', c02: 'occlusion', c03: 'multi_child', c04: 'small_target',
  c09: 'profile', c10: 'occlusion', c11: 'multi_child', c12: 'small_target',
};
const EXPRESSION_DERIVED = new Set(['c01', 'c09']); // page-2 rendered from the expression anchor

type Verdict = 'pass' | 'fail' | 'not_measurable';

async function main() {
  const root = path.join(process.cwd(), 'outputs', 'diverse-calibration');
  const hardpairs = JSON.parse(fs.readFileSync(path.join(root, 'hardpairs', 'hardpairs-result.json'), 'utf8')) as Array<{ id: string; anchorUrl: string }>;
  const ledger = JSON.parse(fs.readFileSync(path.join(root, 'dev', 'render-ledger.json'), 'utf8')) as Array<{ id: string; kind: string; url?: string }>;

  const anchor: Record<string, string> = {};
  for (const h of hardpairs) anchor[h.id] = h.anchorUrl;
  for (const l of ledger) if (l.kind === 'canonical_anchor' && l.url) anchor[l.id] = l.url;
  const page: Record<string, { 1?: string; 2?: string }> = {};
  for (const l of ledger) {
    const m = /^page-([12])$/.exec(l.kind);
    if (m && l.url) (page[l.id] ??= {})[Number(m[1]) as 1 | 2] = l.url;
  }
  const DEV = ['c01', 'c02', 'c03', 'c04', 'c09', 'c10', 'c11', 'c12'];
  for (const id of DEV) {
    if (!anchor[id] || !page[id]?.[1] || !page[id]?.[2]) throw new Error(`missing assets for ${id} (anchor/page1/page2)`);
  }

  interface Pair { bucket: string; tag: string; anchorChild: string; pageChild: string; anchorUrl: string; pageUrl: string; }
  const pairs: Pair[] = [];
  // clear positives — anchor → own page-1
  for (const id of DEV) pairs.push({ bucket: 'clear_positive', tag: id, anchorChild: id, pageChild: id, anchorUrl: anchor[id], pageUrl: page[id][1]! });
  // stress positives — anchor → own page-2 (tag expression-derived separately)
  for (const id of DEV) pairs.push({ bucket: EXPRESSION_DERIVED.has(id) ? 'stress_positive_expression' : 'stress_positive', tag: `${id}:${ACTUAL_STRESS[id]}`, anchorChild: id, pageChild: id, anchorUrl: anchor[id], pageUrl: page[id][2]! });
  // hard negatives — pA(c01,c02) + pB(c03,c04) cross directions, PAGE-1 only
  const hard: Array<[string, string]> = [['c01', 'c02'], ['c02', 'c01'], ['c03', 'c04'], ['c04', 'c03']];
  for (const [a, p] of hard) pairs.push({ bucket: 'hard_negative', tag: `${a}->${p}`, anchorChild: a, pageChild: p, anchorUrl: anchor[a], pageUrl: page[p][1]! });
  // easy negatives — fixed balanced sample of clearly-different children, PAGE-1
  const easy: Array<[string, string]> = [['c01', 'c03'], ['c03', 'c01'], ['c09', 'c10'], ['c10', 'c09'], ['c11', 'c12'], ['c12', 'c11']];
  for (const [a, p] of easy) pairs.push({ bucket: 'easy_negative', tag: `${a}->${p}`, anchorChild: a, pageChild: p, anchorUrl: anchor[a], pageUrl: page[p][1]! });

  const { checkChildIdentityViaVision } = await import('@/lib/generation-pipeline/child-identity-vision');
  const { IDENTITY_VISION_SAME_MIN_CONFIDENCE, IDENTITY_VISION_DIFFERENT_MIN_CONFIDENCE } = await import('@/lib/generation-pipeline/visual-contract-gate');
  const classify = (v: { sameChild: string; confidence: number }): Verdict =>
    v.sameChild === 'same' && v.confidence >= IDENTITY_VISION_SAME_MIN_CONFIDENCE ? 'pass'
    : v.sameChild === 'different' && v.confidence >= IDENTITY_VISION_DIFFERENT_MIN_CONFIDENCE ? 'fail'
    : 'not_measurable';

  console.log(`[baseline] scoring ${pairs.length} pairs (vision-judge, no renders)...`);
  const scored: Array<Pair & { verdict: string; confidence: number; policy: Verdict }> = [];
  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i];
    const v = await checkChildIdentityViaVision(p.anchorUrl, p.pageUrl).catch(() => ({ sameChild: 'uncertain' as const, confidence: 0, reason: 'error' }));
    const policy = classify(v);
    scored.push({ ...p, verdict: v.sameChild, confidence: v.confidence, policy });
    console.log(`[baseline] ${i + 1}/${pairs.length} [${p.bucket}] ${p.tag} → ${v.sameChild}@${v.confidence.toFixed(2)} ⇒ ${policy}`);
  }

  const buckets = ['clear_positive', 'stress_positive', 'stress_positive_expression', 'hard_negative', 'easy_negative'];
  const expect: Record<string, Verdict> = { clear_positive: 'pass', stress_positive: 'pass', stress_positive_expression: 'pass', hard_negative: 'fail', easy_negative: 'fail' };
  const matrix = buckets.map((b) => {
    const rows = scored.filter((s) => s.bucket === b);
    const want = expect[b];
    return {
      bucket: b, n: rows.length, expect: want,
      correct: rows.filter((s) => s.policy === want).length,
      not_measurable: rows.filter((s) => s.policy === 'not_measurable').length,
      wrong: rows.filter((s) => s.policy !== want && s.policy !== 'not_measurable').length, // false-fail (pos) / false-pass (neg)
    };
  });
  console.log('\n[baseline] 4-BUCKET MATRIX (positives: correct=pass · wrong=false-FAIL; negatives: correct=fail · wrong=false-PASS):');
  console.table(matrix);
  console.log('NOTE: NOT a valid proof of the ENTITY gate — any unexpected creature is extraneous_entity NOISE, not identity failure.');

  fs.writeFileSync(path.join(root, 'dev', 'baseline-result.json'), JSON.stringify({ matrix, scored }, null, 2));
  console.log(`[baseline] wrote ${path.join(root, 'dev', 'baseline-result.json')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
