/**
 * JUDGE EXPERIMENT (Codex conditional GO) — can a stronger judge config lift hard-neg recall on the DEV
 * crops, where whole-scene AND 512/low crop both false-passed 0/12? P1 fix first: RECROP from the SOURCE
 * image at 1024 / pad 1.2 using the ALREADY-cached bbox (no detector re-run), so detail:'high' has real
 * pixels. Then 3 PREDEFINED configs (FIXED thresholds, no 4th, no post-hoc tuning):
 *   1. recrop + gpt-4o            + detail:high + EXISTING prompt        (isolates resolution)
 *   2. recrop + gpt-4o            + detail:high + discrimination prompt  (isolates prompt)
 *   3. recrop + gpt-5.5 snapshot  + detail:high + discrimination prompt  (isolates model)
 * Stop-rule per config (ALL simultaneously): clear 8/8 pass · stress zero-fail · easy 6/6 fail ·
 * hard ZERO auto-pass across 12 runs · >=3/4 directions majority-fail (rest <= not_measurable).
 * NONE pass → STOP (discrimination floor → human-in-the-loop). ONE passes → freeze + request holdout.
 * NO image renders. Crops local. Vision-judge only.
 *
 * Usage:  RECROP_ONLY=1 npx tsx scripts/judge-experiment-dev.ts   (recrop + exit, for eyeball)
 *         npx tsx scripts/judge-experiment-dev.ts                 (recrop[cached] + smoke + 3 configs)
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();
import './shims/register-server-only.cjs';
import { cropToHead, type HeadDetection } from './crop-head-lib';
import { judgeIdentity, CHILD_IDENTITY_INSTRUCTION, DISCRIMINATION_INSTRUCTION, type JudgeEndpoint } from './identity-judge-lib';

const GPT55 = 'gpt-5.5-2026-04-23'; // LOCKED snapshot per Codex (NOT an alias)
const RECROP_SIZE = 1024;
const RECROP_PAD = 1.2;
const ACTUAL_STRESS: Record<string, string> = { c01: 'profile', c02: 'occlusion', c03: 'multi_child', c04: 'small_target', c09: 'profile', c10: 'occlusion', c11: 'multi_child', c12: 'small_target' };
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
  const hpFile = path.join(root, 'hardpairs', 'hardpairs-result.json');
  const hardpairs = JSON.parse(fs.readFileSync(hpFile, 'utf8')) as Array<{ id: string; anchorUrl: string }>;
  const ledger = JSON.parse(fs.readFileSync(path.join(root, 'dev', 'render-ledger.json'), 'utf8')) as Array<{ id: string; kind: string; url?: string }>;
  const detCache = JSON.parse(fs.readFileSync(path.join(cropDir, 'detections.json'), 'utf8')) as Record<string, { det: HeadDetection; aligned: boolean; cropOk: boolean }>;

  const anchor: Record<string, string> = {};
  for (const h of hardpairs) anchor[h.id] = h.anchorUrl;
  for (const l of ledger) if (l.kind === 'canonical_anchor' && l.url) anchor[l.id] = l.url;
  const page: Record<string, { 1?: string; 2?: string }> = {};
  for (const l of ledger) { const m = /^page-([12])$/.exec(l.kind); if (m && l.url) (page[l.id] ??= {})[Number(m[1]) as 1 | 2] = l.url; }
  const DEV = ['c01', 'c02', 'c03', 'c04', 'c09', 'c10', 'c11', 'c12'];
  const imgUrl: Record<string, string> = {};
  for (const id of DEV) { imgUrl[`${id}-anchor`] = anchor[id]; imgUrl[`${id}-p1`] = page[id][1]!; imgUrl[`${id}-p2`] = page[id][2]!; }

  // ---- P1 RECROP from source at 1024/1.2 using cached bbox (no detector re-run) ----
  const hiPath = (label: string) => path.join(cropDir, `${label}.hi.png`);
  console.log(`[recrop] ${RECROP_SIZE}px pad=${RECROP_PAD} from source using cached bbox...`);
  for (const [label, url] of Object.entries(imgUrl)) {
    if (fs.existsSync(hiPath(label)) && process.env.RECROP_FRESH !== '1') { console.log(`[recrop] ${label} cached`); continue; }
    const entry = detCache[label];
    if (!entry?.det?.detected) { console.log(`[recrop] ${label} undetected → skip (not_measurable)`); continue; }
    const crop = await cropToHead(await download(url), entry.det, { size: RECROP_SIZE, pad: RECROP_PAD });
    if (crop) { fs.writeFileSync(hiPath(label), crop.buffer); console.log(`[recrop] ${label} → ${RECROP_SIZE}px aligned=${crop.aligned}`); }
    else { console.log(`[recrop] ${label} → no crop`); }
  }
  const hiUrl = (label: string): string | null => fs.existsSync(hiPath(label)) ? `data:image/png;base64,${fs.readFileSync(hiPath(label)).toString('base64')}` : null;
  if (process.env.RECROP_ONLY === '1') { console.log('[recrop] RECROP_ONLY — exiting for eyeball.'); return; }

  // ---- Pairs (same 26) ----
  interface Pair { bucket: string; tag: string; aLabel: string; pLabel: string; }
  const pairs: Pair[] = [];
  for (const id of DEV) pairs.push({ bucket: 'clear_positive', tag: id, aLabel: `${id}-anchor`, pLabel: `${id}-p1` });
  for (const id of DEV) pairs.push({ bucket: EXPRESSION_DERIVED.has(id) ? 'stress_positive_expression' : 'stress_positive', tag: `${id}:${ACTUAL_STRESS[id]}`, aLabel: `${id}-anchor`, pLabel: `${id}-p2` });
  const hard: Array<[string, string]> = [['c01', 'c02'], ['c02', 'c01'], ['c03', 'c04'], ['c04', 'c03']];
  for (const [a, p] of hard) pairs.push({ bucket: 'hard_negative', tag: `${a}->${p}`, aLabel: `${a}-anchor`, pLabel: `${p}-p1` });
  const easy: Array<[string, string]> = [['c01', 'c03'], ['c03', 'c01'], ['c09', 'c10'], ['c10', 'c09'], ['c11', 'c12'], ['c12', 'c11']];
  for (const [a, p] of easy) pairs.push({ bucket: 'easy_negative', tag: `${a}->${p}`, aLabel: `${a}-anchor`, pLabel: `${p}-p1` });

  const { IDENTITY_VISION_SAME_MIN_CONFIDENCE: SAME, IDENTITY_VISION_DIFFERENT_MIN_CONFIDENCE: DIFF } = await import('@/lib/generation-pipeline/visual-contract-gate');
  const classify = (v: { sameChild: string; confidence: number }): Verdict => v.sameChild === 'same' && v.confidence >= SAME ? 'pass' : v.sameChild === 'different' && v.confidence >= DIFF ? 'fail' : 'not_measurable';

  // ---- Smoke gpt-5.5 endpoint on ONE pair (chat first per Codex; fallback responses) ----
  const sa = hiUrl('c01-anchor')!, sp = hiUrl('c01-p1')!;
  let gpt55Endpoint: JudgeEndpoint = 'responses';
  let gpt55Version = GPT55;
  for (const ep of ['chat', 'responses'] as JudgeEndpoint[]) {
    try {
      const r = await judgeIdentity(sa, sp, { model: GPT55, detail: 'high', instruction: DISCRIMINATION_INSTRUCTION, endpoint: ep });
      gpt55Endpoint = ep; gpt55Version = r.modelVersion;
      console.log(`[smoke] ${GPT55} works on '${ep}' → model=${r.modelVersion} verdict=${r.verdict.sameChild}@${r.verdict.confidence} raw="${r.raw.slice(0, 80)}"`);
      break;
    } catch (e) { console.log(`[smoke] ${GPT55} '${ep}' FAILED: ${(e as Error).message}`); if (ep === 'responses') console.log('[smoke] gpt-5.5 unavailable on both endpoints — config 3 will be skipped.'); }
  }
  const gpt55Ok = await judgeIdentity(sa, sp, { model: GPT55, detail: 'high', instruction: DISCRIMINATION_INSTRUCTION, endpoint: gpt55Endpoint }).then(() => true).catch(() => false);

  interface Cfg { id: number; label: string; model: string; detail: 'high'; instruction: string; promptId: string; endpoint: JudgeEndpoint; }
  const configs: Cfg[] = [
    { id: 1, label: 'recrop+gpt4o+high+existing', model: 'gpt-4o', detail: 'high', instruction: CHILD_IDENTITY_INSTRUCTION, promptId: 'existing', endpoint: 'chat' },
    { id: 2, label: 'recrop+gpt4o+high+discrim', model: 'gpt-4o', detail: 'high', instruction: DISCRIMINATION_INSTRUCTION, promptId: 'discrimination', endpoint: 'chat' },
    ...(gpt55Ok ? [{ id: 3, label: 'recrop+gpt5.5+high+discrim', model: GPT55, detail: 'high' as const, instruction: DISCRIMINATION_INSTRUCTION, promptId: 'discrimination', endpoint: gpt55Endpoint }] : []),
  ];

  const expect: Record<string, Verdict> = { clear_positive: 'pass', stress_positive: 'pass', stress_positive_expression: 'pass', hard_negative: 'fail', easy_negative: 'fail' };
  const buckets = Object.keys(expect);
  const reports: Array<Record<string, unknown>> = [];

  for (const cfg of configs) {
    console.log(`\n========== CONFIG ${cfg.id}: ${cfg.label} (model=${cfg.model} endpoint=${cfg.endpoint} detail=${cfg.detail} prompt=${cfg.promptId}) ==========`);
    interface Row { bucket: string; tag: string; runIndex: number; verdict: string; confidence: number; reason: string; policy: Verdict; modelVersion: string; }
    const rows: Row[] = [];
    for (const pr of pairs) {
      const runs = pr.bucket === 'hard_negative' ? 3 : 1;
      const a = hiUrl(pr.aLabel), p = hiUrl(pr.pLabel);
      for (let r = 0; r < runs; r++) {
        if (!a || !p) { rows.push({ bucket: pr.bucket, tag: pr.tag, runIndex: r, verdict: 'uncertain', confidence: 0, reason: `undetected a=${!!a} p=${!!p}`, policy: 'not_measurable', modelVersion: cfg.model }); continue; }
        const o = await judgeIdentity(a, p, { model: cfg.model, detail: cfg.detail, instruction: cfg.instruction, endpoint: cfg.endpoint }).catch((e) => ({ verdict: { sameChild: 'uncertain' as const, confidence: 0, reason: `err:${(e as Error).message.slice(0, 40)}` }, modelVersion: cfg.model, endpoint: cfg.endpoint, raw: '' }));
        const policy = classify(o.verdict);
        rows.push({ bucket: pr.bucket, tag: pr.tag, runIndex: r, verdict: o.verdict.sameChild, confidence: o.verdict.confidence, reason: o.verdict.reason, policy, modelVersion: o.modelVersion });
        if (pr.bucket === 'hard_negative' || pr.bucket === 'clear_positive') console.log(`  [${pr.bucket}] ${pr.tag} r${r} → ${o.verdict.sameChild}@${o.verdict.confidence.toFixed(2)} ⇒ ${policy}  (${o.verdict.reason.slice(0, 50)})`);
      }
    }
    const matrix = buckets.map((b) => { const rs = rows.filter((x) => x.bucket === b); const want = expect[b]; return { bucket: b, n: rs.length, correct: rs.filter((x) => x.policy === want).length, not_measurable: rs.filter((x) => x.policy === 'not_measurable').length, wrong: rs.filter((x) => x.policy !== want && x.policy !== 'not_measurable').length }; });
    console.table(matrix);
    const hr = (b: string) => rows.filter((x) => x.bucket === b);
    const dirMaj = (dir: string): Verdict => { const rs = hr('hard_negative').filter((x) => x.tag === dir); const f = rs.filter((x) => x.policy === 'fail').length, ps = rs.filter((x) => x.policy === 'pass').length; return f >= 2 ? 'fail' : ps >= 2 ? 'pass' : 'not_measurable'; };
    const dirVerdicts = hard.map(([a, p]) => ({ dir: `${a}->${p}`, majority: dirMaj(`${a}->${p}`), runs: hr('hard_negative').filter((x) => x.tag === `${a}->${p}`).map((x) => x.policy[0]).join('') }));
    const hardAutoPass = hr('hard_negative').filter((x) => x.policy === 'pass').length;
    const dirsFail = dirVerdicts.filter((d) => d.majority === 'fail').length;
    const dirsPass = dirVerdicts.filter((d) => d.majority === 'pass').length;
    const stop = {
      clear_8of8_pass: hr('clear_positive').filter((x) => x.policy === 'pass').length === 8,
      stress_zero_fail: [...hr('stress_positive'), ...hr('stress_positive_expression')].every((x) => x.policy !== 'fail'),
      easy_6of6_fail: hr('easy_negative').filter((x) => x.policy === 'fail').length === 6,
      hard_zero_autopass: hardAutoPass === 0,
      hard_3of4_majority_fail: dirsFail >= 3 && dirsPass === 0,
    };
    const stopPass = Object.values(stop).every(Boolean);
    for (const d of dirVerdicts) console.log(`  hard ${d.dir}: majority=${d.majority} [${d.runs}]`);
    for (const [k, v] of Object.entries(stop)) console.log(`  ${v ? 'PASS' : 'FAIL'}  ${k}`);
    console.log(`  >>> CONFIG ${cfg.id} STOP-RULE ${stopPass ? 'PASS' : 'FAIL'} <<<`);
    reports.push({ config: cfg, modelVersionSeen: rows[0]?.modelVersion, matrix, dirVerdicts, hardAutoPass, stop, stopPass, rows });
  }

  const anyPass = reports.filter((r) => r.stopPass);
  console.log(`\n================ SUMMARY ================`);
  for (const r of reports) console.log(`  config ${(r.config as Cfg).id} ${(r.config as Cfg).label}: STOP-RULE ${r.stopPass ? 'PASS' : 'FAIL'}`);
  console.log(anyPass.length ? `\n  >>> ${anyPass.length} config(s) PASS — eligible to freeze + request holdout <<<` : `\n  >>> NO config passed — discrimination floor; launch stays human-in-the-loop <<<`);

  const out = { meta: { thresholds: { same: SAME, different: DIFF }, recrop: { size: RECROP_SIZE, pad: RECROP_PAD }, gpt55: { requested: GPT55, version: gpt55Version, endpoint: gpt55Endpoint, available: gpt55Ok }, framing: '4 hard-neg = 4 directions of 2 independent pairs (pA=c01/c02, pB=c03/c04)' }, reports };
  fs.writeFileSync(path.join(root, 'dev', 'judge-experiment-result.json'), JSON.stringify(out, null, 2));
  console.log(`\n[judge-exp] wrote ${path.join(root, 'dev', 'judge-experiment-result.json')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
