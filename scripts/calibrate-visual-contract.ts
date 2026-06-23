/**
 * Phase-1 Visual Contract CALIBRATION harness (render-only, NO DB).
 *
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs \
 *     scripts/calibrate-visual-contract.ts
 *
 * For lion_shaket_adventure: compile the contract, generate critical-object reference
 * sheets, render 5 representative LOW pages via generateGPTImage (contract-driven prompt
 * + child anchor + companion sheet + object sheets), then run the HARD vision gate
 * (continuity + entity + storytelling) on each. Writes images + per-page pass/fail to
 * outputs/. Does NOT seed an order or touch the DB.
 */
import { config as loadEnv } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// This checkout may not carry secrets; SH_ENV_FILE can point at the real .env.local.
loadEnv({ path: process.env.SH_ENV_FILE || '.env.local' });
loadEnv({ path: '.env.local' });
loadEnv();
process.env.GPT_IMAGE_QUALITY = process.env.GPT_IMAGE_QUALITY?.trim() || 'low';

import './shims/register-server-only.cjs';

import { parseStoryMarkdownForContract } from '../lib/visual-contract/parse-story';
import { compileBookVisualContract, assertContractRenderReady } from '../lib/visual-contract/compiler';
import { buildCalibrationPagePrompt } from '../lib/visual-contract/render-prompt';
import { evaluatePageAgainstContract, decideGateVerdict } from '../lib/visual-contract/gate';
// generateObjectReferenceSheet + observePageForContract are imported dynamically inside
// main() (after the server-only shim) since they pull the render engine.

const STORY_KEY = 'lion_shaket_adventure';
const PAGES = [1, 2, 6, 11, 12];
const DEFAULT_CHILD_ANCHOR =
  'https://qvksgpzzosotubcbizay.supabase.co/storage/v1/object/public/book-images/orders/cmqq8j8zm0002la04ofmhxi4n/character-anchors/child-canonical-method-b-a3.png';

function flag(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

async function main() {
  const { generateGPTImage } = await import('@/lib/generate-image');
  const { resolveStyle01GptModel } = await import('@/lib/style01-gptimage');
  const { listPublishedCompanionSheetViews } = await import('@/lib/generation-pipeline/companion-character-sheet');
  const { generateObjectReferenceSheet } = await import('../lib/visual-contract/object-reference-sheet');
  const { observePageForContract } = await import('../lib/visual-contract/contract-vision');

  const childAnchor = flag('--childAnchor') || DEFAULT_CHILD_ANCHOR;
  const model = resolveStyle01GptModel();
  const outDir = path.join(process.cwd(), 'outputs', 'visual-contract-calibration', STORY_KEY);
  const pagesDir = path.join(outDir, 'pages');
  const objDir = path.join(outDir, 'objects');
  fs.mkdirSync(pagesDir, { recursive: true });
  fs.mkdirSync(objDir, { recursive: true });

  const raw = fs.readFileSync(path.join(process.cwd(), 'story-bank', 'v5-fixed-v2', `${STORY_KEY}.md`), 'utf8');
  const contract = compileBookVisualContract(parseStoryMarkdownForContract(raw, STORY_KEY), {
    generatedAt: new Date().toISOString(),
    maxRerolls: 2,
  });
  assertContractRenderReady(contract);
  fs.writeFileSync(path.join(outDir, 'contract.json'), JSON.stringify(contract, null, 2));
  console.log(`[calibrate] contract render-ready (conf ${contract.confidence.overall}); model=${model}`);

  const companionFront = listPublishedCompanionSheetViews('lion_shaket').front ?? null;
  console.log(`[calibrate] companion front sheet: ${companionFront ?? '(none — single image fallback)'}`);

  // ── Generate critical-object reference sheets (one per object/state we use).
  const obj = (id: string) => contract.criticalObjects.find((o) => o.objectId === id)!;
  const sheetSpecs: Array<{ key: string; objectId: string; state: string }> = [
    { key: 'red_cube', objectId: 'red_cube', state: 'a single small red play cube' },
    { key: 'fallen_block_castle', objectId: 'fallen_block_castle', state: 'collapsed / fallen on the floor' },
    { key: 'golden_sand_portal', objectId: 'golden_sand_portal', state: 'open on the floor' },
    { key: 'stone_gate:closed', objectId: 'stone_gate', state: 'closed, with a clear circular mark at its center' },
    { key: 'stone_gate:open', objectId: 'stone_gate', state: 'open / opening, circular center mark glowing' },
  ];
  const sheetPath: Record<string, string> = {};
  for (const spec of sheetSpecs) {
    try {
      const res = await generateObjectReferenceSheet(obj(spec.objectId), spec.state, 'low');
      const p = path.join(objDir, `${spec.key.replace(/[^a-z0-9]+/gi, '_')}.png`);
      fs.writeFileSync(p, res.buffer);
      sheetPath[spec.key] = p;
      console.log(`[calibrate] object sheet ${spec.key} → ${path.basename(p)}`);
    } catch (e) {
      console.warn(`[calibrate] object sheet ${spec.key} FAILED: ${(e as Error).message}`);
    }
  }

  function sheetsForPage(page: number): string[] {
    const pc = contract.pageContracts.find((p) => p.page === page)!;
    const ids = pc.mustShow.filter((m) => m.startsWith('object:')).map((m) => m.slice('object:'.length));
    const out: string[] = [];
    for (const id of ids) {
      if (id === 'stone_gate') {
        const st = obj('stone_gate').stateTimeline.find((s) => s.page === page)?.state ?? '';
        out.push(/open/.test(st) ? sheetPath['stone_gate:open'] : sheetPath['stone_gate:closed']);
      } else {
        out.push(sheetPath[id]);
      }
    }
    return out.filter(Boolean);
  }

  // ── Render + gate each calibration page.
  const reports: Array<Record<string, unknown>> = [];
  for (const page of PAGES) {
    const pc = contract.pageContracts.find((p) => p.page === page)!;
    const prompt = buildCalibrationPagePrompt(contract, pc, { childName: 'נועם' });
    // referencePlan order: child identity → companion identity → critical objects.
    const refs = [childAnchor, ...(pc.companion.present && companionFront ? [companionFront] : []), ...sheetsForPage(page)];
    console.log(`\n[calibrate] page ${page} (${pc.sceneId}) refs=${refs.length} …`);
    try {
      const res = await generateGPTImage({
        finalPrompt: prompt,
        referenceImages: refs,
        quality: 'low',
        modelOverride: model,
        requireReferenceEdit: false,
      });
      const imgPath = path.join(pagesDir, `page-${String(page).padStart(2, '0')}.png`);
      fs.writeFileSync(imgPath, res.buffer);
      const dataUrl = `data:image/png;base64,${res.buffer.toString('base64')}`;
      const obs = await observePageForContract(dataUrl, contract, page);
      const gate = evaluatePageAgainstContract(contract, page, obs);
      const verdict = decideGateVerdict(gate, 0, contract.qaPolicy.maxRerolls);
      const byClass = {
        continuity: gate.failures.filter((f) => f.failureClass === 'continuity').map((f) => f.assertion),
        entity: gate.failures.filter((f) => f.failureClass === 'entity').map((f) => f.assertion),
        storytelling: gate.failures.filter((f) => f.failureClass === 'storytelling').map((f) => f.assertion),
      };
      console.log(`[calibrate] page ${page} → ${gate.passed ? 'PASS' : 'FAIL'} (${verdict}) ${gate.passed ? '' : JSON.stringify(byClass)}`);
      reports.push({ page, sceneId: pc.sceneId, passed: gate.passed, verdict, failuresByClass: byClass, failures: gate.failures, image: path.relative(process.cwd(), imgPath) });
    } catch (e) {
      console.warn(`[calibrate] page ${page} render/gate FAILED: ${(e as Error).message}`);
      reports.push({ page, sceneId: pc.sceneId, passed: false, verdict: 'fail', error: (e as Error).message });
    }
  }

  const summary = {
    storyKey: STORY_KEY,
    model,
    childAnchor,
    pages: reports,
    passed: reports.filter((r) => r.passed).length,
    total: reports.length,
  };
  fs.writeFileSync(path.join(outDir, 'calibration-report.json'), JSON.stringify(summary, null, 2));
  console.log(`\n[calibrate] ${summary.passed}/${summary.total} pages passed the hard gate. → ${path.relative(process.cwd(), outDir)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
