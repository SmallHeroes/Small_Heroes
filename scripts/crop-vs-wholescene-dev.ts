/**
 * HEAD-TO-HEAD: whole-scene vs crop+align on the SAME 26 DEV pairs (Codex GO). Same judge
 * (checkChildIdentityViaVision), same prompt, same FIXED thresholds — only the INPUT changes (whole image
 * vs fair head crop). No new image RENDERS; vision-judge + head-detector calls only (cached/resumable).
 *
 * Precisions folded in:
 *  - 4 hard-neg = 4 DIRECTIONS of 2 INDEPENDENT pairs (pA = c01/c02, pB = c03/c04) — reported as such.
 *  - x3 runs per hard direction in BOTH arms; decide by majority.
 *  - Artifact persists actual model, verdict reason, prompt versions, run index, detection details.
 *
 * Bar for the CROP arm (all must hold before requesting the holdout unlock):
 *  clear 8/8 pass · stress zero-fail (nm ok) · easy 6/6 fail ·
 *  hard x3: ZERO auto-pass · >=3 of 4 directions majority-fail · rest at most not_measurable.
 *
 * Usage:  npx tsx scripts/crop-vs-wholescene-dev.ts        (resumes cached detections/crops)
 *         CROP_FRESH=1 npx tsx scripts/crop-vs-wholescene-dev.ts   (ignore cache, re-detect)
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';
import { detectChildHead, cropToHead, CROP_DETECTOR_PROMPT_VERSION, type HeadDetection } from './crop-head-lib';

const VISION_MODEL = process.env.CHILD_PHOTO_VISION_MODEL?.trim() || 'gpt-4o';
const JUDGE_PROMPT_VERSION = 'child-identity-vision-v1';
const FRESH = process.env.CROP_FRESH === '1';

const ACTUAL_STRESS: Record<string, string> = {
  c01: 'profile', c02: 'occlusion', c03: 'multi_child', c04: 'small_target',
  c09: 'profile', c10: 'occlusion', c11: 'multi_child', c12: 'small_target',
};
const EXPRESSION_DERIVED = new Set(['c01', 'c09']);
type Verdict = 'pass' | 'fail' | 'not_measurable';

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const root = path.join(process.cwd(), 'outputs', 'diverse-calibration');
  const cropDir = path.join(root, 'dev', 'crops');
  fs.mkdirSync(cropDir, { recursive: true });
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

  // Unique images → label → url
  const imgUrl: Record<string, string> = {};
  for (const id of DEV) { imgUrl[`${id}-anchor`] = anchor[id]; imgUrl[`${id}-p1`] = page[id][1]!; imgUrl[`${id}-p2`] = page[id][2]!; }
  for (const [label, url] of Object.entries(imgUrl)) if (!url) throw new Error(`missing image url for ${label}`);

  // ---- Detect + crop every unique image (blind, cached) ----
  const detCache: Record<string, { det: HeadDetection; aligned: boolean; cropOk: boolean }> = {};
  const detJsonPath = path.join(cropDir, 'detections.json');
  const prior = !FRESH && fs.existsSync(detJsonPath) ? JSON.parse(fs.readFileSync(detJsonPath, 'utf8')) as typeof detCache : {};
  console.log(`[crop] detecting + cropping ${Object.keys(imgUrl).length} unique images (model=${VISION_MODEL}, detector=${CROP_DETECTOR_PROMPT_VERSION})...`);
  for (const [label, url] of Object.entries(imgUrl)) {
    const cropPng = path.join(cropDir, `${label}.crop.png`);
    if (!FRESH && prior[label] && (prior[label].cropOk ? fs.existsSync(cropPng) : true)) {
      detCache[label] = prior[label];
      console.log(`[crop] ${label} (cached) det=${prior[label].det.detected} pose=${prior[label].det.pose} crop=${prior[label].cropOk}`);
      continue;
    }
    const buf = await download(url);
    const det = await detectChildHead(url, VISION_MODEL);
    const crop = det.detected ? await cropToHead(buf, det) : null;
    if (crop) fs.writeFileSync(cropPng, crop.buffer); else if (fs.existsSync(cropPng)) fs.unlinkSync(cropPng);
    detCache[label] = { det, aligned: crop?.aligned ?? false, cropOk: !!crop };
    console.log(`[crop] ${label} det=${det.detected}@${det.confidence.toFixed(2)} pose=${det.pose} aligned=${crop?.aligned ?? false} crop=${!!crop} — ${det.reason}`);
  }
  fs.writeFileSync(detJsonPath, JSON.stringify(detCache, null, 2));
  const cropDataUrl = (label: string): string | null => {
    const p = path.join(cropDir, `${label}.crop.png`);
    return detCache[label]?.cropOk && fs.existsSync(p) ? `data:image/png;base64,${fs.readFileSync(p).toString('base64')}` : null;
  };

  // ---- Pairs (same 26 as the baseline) ----
  interface Pair { bucket: string; tag: string; aLabel: string; pLabel: string; aUrl: string; pUrl: string; }
  const pairs: Pair[] = [];
  for (const id of DEV) pairs.push({ bucket: 'clear_positive', tag: id, aLabel: `${id}-anchor`, pLabel: `${id}-p1`, aUrl: anchor[id], pUrl: page[id][1]! });
  for (const id of DEV) pairs.push({ bucket: EXPRESSION_DERIVED.has(id) ? 'stress_positive_expression' : 'stress_positive', tag: `${id}:${ACTUAL_STRESS[id]}`, aLabel: `${id}-anchor`, pLabel: `${id}-p2`, aUrl: anchor[id], pUrl: page[id][2]! });
  const hard: Array<[string, string]> = [['c01', 'c02'], ['c02', 'c01'], ['c03', 'c04'], ['c04', 'c03']];
  for (const [a, p] of hard) pairs.push({ bucket: 'hard_negative', tag: `${a}->${p}`, aLabel: `${a}-anchor`, pLabel: `${p}-p1`, aUrl: anchor[a], pUrl: page[p][1]! });
  const easy: Array<[string, string]> = [['c01', 'c03'], ['c03', 'c01'], ['c09', 'c10'], ['c10', 'c09'], ['c11', 'c12'], ['c12', 'c11']];
  for (const [a, p] of easy) pairs.push({ bucket: 'easy_negative', tag: `${a}->${p}`, aLabel: `${a}-anchor`, pLabel: `${p}-p1`, aUrl: anchor[a], pUrl: page[p][1]! });

  const { checkChildIdentityViaVision } = await import('@/lib/generation-pipeline/child-identity-vision');
  const { IDENTITY_VISION_SAME_MIN_CONFIDENCE: SAME, IDENTITY_VISION_DIFFERENT_MIN_CONFIDENCE: DIFF } = await import('@/lib/generation-pipeline/visual-contract-gate');
  const classify = (v: { sameChild: string; confidence: number }): Verdict =>
    v.sameChild === 'same' && v.confidence >= SAME ? 'pass' : v.sameChild === 'different' && v.confidence >= DIFF ? 'fail' : 'not_measurable';

  // ---- Score both arms (x3 on hard directions) ----
  interface Row { arm: 'whole_scene' | 'crop'; bucket: string; tag: string; runIndex: number; model: string; promptVersion: string; verdict: string; confidence: number; reason: string; policy: Verdict; detector?: { aPose: string; pPose: string; aAligned: boolean; pAligned: boolean; aConf: number; pConf: number }; }
  const rows: Row[] = [];
  for (const pr of pairs) {
    const runs = pr.bucket === 'hard_negative' ? 3 : 1;
    const aCrop = cropDataUrl(pr.aLabel), pCrop = cropDataUrl(pr.pLabel);
    for (let r = 0; r < runs; r++) {
      const ws = await checkChildIdentityViaVision(pr.aUrl, pr.pUrl).catch(() => ({ sameChild: 'uncertain' as const, confidence: 0, reason: 'error' }));
      rows.push({ arm: 'whole_scene', bucket: pr.bucket, tag: pr.tag, runIndex: r, model: VISION_MODEL, promptVersion: JUDGE_PROMPT_VERSION, verdict: ws.sameChild, confidence: ws.confidence, reason: ws.reason, policy: classify(ws) });
      let cropRow: Row;
      if (aCrop && pCrop) {
        const cv = await checkChildIdentityViaVision(aCrop, pCrop).catch(() => ({ sameChild: 'uncertain' as const, confidence: 0, reason: 'error' }));
        cropRow = { arm: 'crop', bucket: pr.bucket, tag: pr.tag, runIndex: r, model: VISION_MODEL, promptVersion: JUDGE_PROMPT_VERSION, verdict: cv.sameChild, confidence: cv.confidence, reason: cv.reason, policy: classify(cv) };
      } else {
        cropRow = { arm: 'crop', bucket: pr.bucket, tag: pr.tag, runIndex: r, model: VISION_MODEL, promptVersion: JUDGE_PROMPT_VERSION, verdict: 'uncertain', confidence: 0, reason: `undetected: a=${!!aCrop} p=${!!pCrop}`, policy: 'not_measurable' };
      }
      cropRow.detector = { aPose: detCache[pr.aLabel].det.pose, pPose: detCache[pr.pLabel].det.pose, aAligned: detCache[pr.aLabel].aligned, pAligned: detCache[pr.pLabel].aligned, aConf: detCache[pr.aLabel].det.confidence, pConf: detCache[pr.pLabel].det.confidence };
      rows.push(cropRow);
      console.log(`[${pr.bucket}] ${pr.tag} r${r}  WS=${rows[rows.length - 2].policy.padEnd(15)} CROP=${cropRow.policy} (${cropRow.verdict}@${cropRow.confidence.toFixed(2)})`);
    }
  }

  // ---- Matrices ----
  const expect: Record<string, Verdict> = { clear_positive: 'pass', stress_positive: 'pass', stress_positive_expression: 'pass', hard_negative: 'fail', easy_negative: 'fail' };
  const buckets = Object.keys(expect);
  const matrixFor = (arm: string) => buckets.map((b) => {
    const rs = rows.filter((x) => x.arm === arm && x.bucket === b);
    const want = expect[b];
    return { bucket: b, n: rs.length, expect: want, correct: rs.filter((x) => x.policy === want).length, not_measurable: rs.filter((x) => x.policy === 'not_measurable').length, wrong: rs.filter((x) => x.policy !== want && x.policy !== 'not_measurable').length };
  });
  const wsM = matrixFor('whole_scene');
  const cropM = matrixFor('crop');
  console.log('\n=== WHOLE-SCENE ==='); console.table(wsM);
  console.log('=== CROP+ALIGN ==='); console.table(cropM);

  // ---- Bar (crop arm) ----
  const cropRows = (b: string) => rows.filter((x) => x.arm === 'crop' && x.bucket === b);
  const dirMajority = (dir: string): Verdict => {
    const rs = cropRows('hard_negative').filter((x) => x.tag === dir);
    const f = rs.filter((x) => x.policy === 'fail').length, p = rs.filter((x) => x.policy === 'pass').length;
    return f >= 2 ? 'fail' : p >= 2 ? 'pass' : 'not_measurable';
  };
  const hardAutoPass = cropRows('hard_negative').filter((x) => x.policy === 'pass').length;
  const dirVerdicts = hard.map(([a, p]) => ({ dir: `${a}->${p}`, majority: dirMajority(`${a}->${p}`) }));
  const dirsMajorityFail = dirVerdicts.filter((d) => d.majority === 'fail').length;
  const dirsPass = dirVerdicts.filter((d) => d.majority === 'pass').length;
  const bar = {
    clear_8of8_pass: cropRows('clear_positive').every((x) => x.policy === 'pass') && cropRows('clear_positive').length === 8,
    stress_zero_fail: [...cropRows('stress_positive'), ...cropRows('stress_positive_expression')].every((x) => x.policy !== 'fail'),
    easy_6of6_fail: cropRows('easy_negative').filter((x) => x.policy === 'fail').length === 6,
    hard_zero_autopass: hardAutoPass === 0,
    hard_3of4_majority_fail: dirsMajorityFail >= 3 && dirsPass === 0,
  };
  const barPass = Object.values(bar).every(Boolean);
  console.log('\n=== HARD-NEG per direction (2 independent pairs pA=c01/c02, pB=c03/c04 → 4 directions), CROP x3 ===');
  for (const d of dirVerdicts) console.log(`  ${d.dir}: majority=${d.majority}  [${cropRows('hard_negative').filter((x) => x.tag === d.dir).map((x) => x.policy[0]).join('')}]`);
  console.log(`  whole-scene hard-neg auto-pass count: ${rows.filter((x) => x.arm === 'whole_scene' && x.bucket === 'hard_negative' && x.policy === 'pass').length}/12`);
  console.log('\n=== BAR (crop arm) ===');
  for (const [k, v] of Object.entries(bar)) console.log(`  ${v ? 'PASS' : 'FAIL'}  ${k}`);
  console.log(`\n  >>> BAR ${barPass ? 'PASS — crop beats baseline; eligible to freeze + request holdout unlock' : 'NOT MET — do NOT request holdout'} <<<`);

  const out = { meta: { model: VISION_MODEL, judgePromptVersion: JUDGE_PROMPT_VERSION, detectorPromptVersion: CROP_DETECTOR_PROMPT_VERSION, thresholds: { same: SAME, different: DIFF }, framing: '4 hard-neg = 4 directions of 2 independent pairs (pA=c01/c02, pB=c03/c04)' }, wholeScene: wsM, crop: cropM, bar, barPass, dirVerdicts, hardAutoPass, rows };
  fs.writeFileSync(path.join(root, 'dev', 'crop-vs-wholescene-result.json'), JSON.stringify(out, null, 2));
  console.log(`\n[crop] wrote ${path.join(root, 'dev', 'crop-vs-wholescene-result.json')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
