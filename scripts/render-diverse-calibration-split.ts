/**
 * SPLIT renderer for the diverse identity-calibration set — builds the remaining assets for ONE split
 * (DEV by default; HOLDOUT requires an explicit unlock). Per the Codex/Guy sequence: render DEV only,
 * develop+freeze crop/thresholds on DEV, then unlock HOLDOUT separately.
 *
 * Per split it renders (reusing the hard-pair anchors from the front-load — never re-rendered):
 *   - distinct children: synthetic photo → Method-B canonical anchor
 *   - expression-anchor children: an expression anchor (USED as the FIRST ref on that child's expression page)
 *   - every split child: 2 pages from its anchor (anchor FIRST ref + Style-01 style refs)
 * Hard-pair members share the SAME stress scene + SAME wardrobe (judge can't separate by scene/clothes).
 * Persists per page: model, quality, prompt, refs + order.
 *
 * DRY by default (prints the plan + per-page metadata + the call/ledger count, NO spend). Set CALIB_RENDER=1
 * to actually render — ONLY under Guy's explicit per-split spend approval. Hard cap 72 LOW total.
 *
 * Usage:  npx tsx scripts/render-diverse-calibration-split.ts                       (DEV, dry plan)
 *         CALIB_RENDER=1 npx tsx scripts/render-diverse-calibration-split.ts        (DEV, render — needs go)
 *         CALIB_SPLIT=holdout CALIB_HOLDOUT_UNLOCK=1 CALIB_RENDER=1 npx tsx ...      (HOLDOUT — separate go)
 */
import type { Order } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

const SPLIT = (process.env.CALIB_SPLIT ?? 'dev') as 'dev' | 'holdout';
const RENDER = process.env.CALIB_RENDER === '1';
const SMOKE = process.env.CALIB_SMOKE === '1'; // render only the FIRST split child (page-render smoke test)
const HOLDOUT_UNLOCK = process.env.CALIB_HOLDOUT_UNLOCK === '1';
const HARD_CAP = 72;

interface ManifestChild {
  id: string;
  gender: 'boy' | 'girl';
  age: number;
  skin: string;
  hairColor: string;
  hairTexture: string;
  glasses: boolean;
  faceTrait: string;
  pair: string | null;
  split: string;
  expressionAnchor: boolean;
  photoPrompt: string;
  pages: Array<{ page: number; stress: string; wardrobe: string; prompt: string }>;
}

function lockedDescription(c: ManifestChild): string {
  return (
    `A ${c.age}-year-old ${c.gender} with ${c.skin} skin, ${c.hairColor} ${c.hairTexture} hair, ` +
    `${c.faceTrait}${c.glasses ? ', wearing glasses' : ''}.`
  );
}
function syntheticOrder(c: ManifestChild): Order {
  return { id: `calib-${c.id}`, childName: c.id, childGender: c.gender, childAge: c.age, illustrationStyle: 'pencil_watercolor' } as unknown as Order;
}

/** Full scene clause per stress kind (mirrors the builder) — so a re-tag swaps the DESCRIPTION, not just the name. */
const STRESS_CLAUSE: Record<string, string> = {
  profile: 'the child in 3/4-to-profile view turning to look at a butterfly',
  occlusion: 'the child partly behind a low fence, lower face occluded by a raised hand waving',
  multi_child: 'the child in a small group of 2-3 OTHER different children at a sandbox (the target child most prominent, front-left)',
  small_target: 'a wide park scene where the child is small in frame (~20% height), reading a book on a bench',
};

/** Hard-pair members must share the SAME stress scene — swap BOTH the name AND the full scene description. */
function effectiveStress(c: ManifestChild): { page: number; stress: string; wardrobe: string; prompt: string } {
  const stressPage = c.pages.find((p) => p.page === 2)!;
  if (!c.pair) return stressPage;
  const byPair: Record<string, string> = { pA: 'profile', pB: 'occlusion', pC: 'multi_child', pD: 'small_target' };
  const stress = byPair[c.pair] ?? stressPage.stress;
  const base = `Children's storybook watercolour page. The child wears ${stressPage.wardrobe}.`;
  const prompt = `${base} STRESS case (${stress}): ${STRESS_CLAUSE[stress]}. Natural, varied pose. No text.`;
  return { ...stressPage, stress, prompt };
}

async function main() {
  if (SPLIT === 'holdout' && !HOLDOUT_UNLOCK) {
    throw new Error('HOLDOUT is LOCKED. Develop+freeze crop/thresholds on DEV first, then set CALIB_HOLDOUT_UNLOCK=1 with a separate spend approval.');
  }
  const root = path.join(process.cwd(), 'outputs', 'diverse-calibration');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'set-manifest.json'), 'utf8')) as { children: ManifestChild[] };
  const hardpairs = fs.existsSync(path.join(root, 'hardpairs', 'hardpairs-result.json'))
    ? (JSON.parse(fs.readFileSync(path.join(root, 'hardpairs', 'hardpairs-result.json'), 'utf8')) as Array<{ id: string; anchorUrl: string; photoUrl: string }>)
    : [];
  const anchorByChild = new Map(hardpairs.map((h) => [h.id, h.anchorUrl]));
  const photoByChild = new Map<string, string>(hardpairs.filter((h) => h.photoUrl).map((h) => [h.id, h.photoUrl]));

  const splitChildren = manifest.children.filter((c) => c.split === SPLIT);
  const needCanonical = splitChildren.filter((c) => !anchorByChild.has(c.id)); // distinct children (hard pairs already have anchors)
  const exprChildren = splitChildren.filter((c) => c.expressionAnchor);
  const plannedCalls = needCanonical.length * 2 /* photo+anchor */ + exprChildren.length /* expression anchor */ + splitChildren.length * 2 /* pages */;

  console.log(`=== DIVERSE CALIB SPLIT=${SPLIT} ${RENDER ? 'RENDER' : 'DRY (no spend)'} ===`);
  console.log(`split children (${splitChildren.length}): ${splitChildren.map((c) => c.id).join(',')}`);
  console.log(`need canonical (distinct): ${needCanonical.map((c) => c.id).join(',') || 'none'}  | reuse hard-pair anchors: ${splitChildren.filter((c) => anchorByChild.has(c.id)).map((c) => c.id).join(',')}`);
  console.log(`expression anchors: ${exprChildren.map((c) => c.id).join(',')}`);
  console.log(`PLANNED LOW calls this split = ${plannedCalls}  (front-load already spent 16 → cumulative ${16 + plannedCalls}/${HARD_CAP})`);

  const { resolveStyle01StyleReferencePaths, STYLE_01_AVOIDANCE_NEGATIVE, resolveStyle01GptModel } = await import('@/lib/style01-gptimage');
  const styleRefs = resolveStyle01StyleReferencePaths('fantasy-cave', 2);
  const model = resolveStyle01GptModel();

  // Build the per-page plan (metadata persisted regardless of dry/render).
  const pagePlan: Array<Record<string, unknown>> = [];
  for (const c of splitChildren) {
    const clear = c.pages.find((p) => p.page === 1)!;
    const stress = effectiveStress(c);
    for (const pg of [clear, stress]) {
      const isExpressionPage = c.expressionAnchor && pg.page === 2; // expression anchor drives the stress page
      pagePlan.push({
        childId: c.id, pair: c.pair, page: pg.page, stress: pg.stress, wardrobe: pg.wardrobe,
        isExpressionPage,
        refOrder: [isExpressionPage ? 'expression_anchor' : 'canonical_anchor', 'style_1', 'style_2'],
        model, quality: 'low', size: '1024x1536', sceneClass: 'fantasy-cave',
        styleRefs: styleRefs.map((p) => path.basename(p)),
        prompt: pg.prompt,
      });
    }
  }

  fs.mkdirSync(path.join(root, SPLIT), { recursive: true });
  fs.writeFileSync(path.join(root, SPLIT, 'page-plan.json'), JSON.stringify({ split: SPLIT, plannedCalls, cumulative: 16 + plannedCalls, pagePlan }, null, 2));
  console.log(`\nsample page metadata (persisted per page): ${JSON.stringify(pagePlan[0], null, 2)}`);
  console.log(`[split] wrote ${path.join(root, SPLIT, 'page-plan.json')}`);

  if (16 + plannedCalls > HARD_CAP) throw new Error(`ABORT: cumulative ${16 + plannedCalls} exceeds hard cap ${HARD_CAP}`);

  if (!RENDER) {
    console.log('\n[split] DRY ONLY — no spend. Set CALIB_RENDER=1 (with Guy\'s per-split spend approval) to render.');
    return;
  }

  // ── RENDER (gated) ──────────────────────────────────────────────────────────
  const { generateGPTImage } = await import('@/lib/generate-image');
  const { uploadOrderSubpathAsset } = await import('@/lib/image-storage');
  const { generateStage0MethodBAnchor } = await import('@/lib/generation-pipeline/stage0-method-b');
  const outDir = path.join(root, SPLIT, 'assets');
  fs.mkdirSync(outDir, { recursive: true });
  const ledger: Array<Record<string, unknown>> = [];
  const dl = async (url: string, dest: string) => { const r = await fetch(url); fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer())); };

  const targets = SMOKE ? splitChildren.slice(0, 1) : splitChildren;
  if (SMOKE) console.log(`[split] SMOKE — first split child only: ${targets[0]?.id} (page-render + expression smoke test)`);
  for (const c of targets) {
    // Resume-safe: skip a child whose pages are already rendered (e.g. the c01 smoke) — never re-spend.
    if ([1, 2].every((n) => fs.existsSync(path.join(outDir, `${c.id}-page${n}.png`)))) {
      console.log(`[split] ${c.id} pages already rendered — skipping (no re-spend)`);
      continue;
    }
    // canonical anchor — reuse hard-pair, else render
    let canonical = anchorByChild.get(c.id) ?? null;
    if (!canonical) {
      const photo = await generateGPTImage({ finalPrompt: c.photoPrompt, size: '1024x1024', quality: 'low' });
      const photoUrl = await uploadOrderSubpathAsset({ orderId: `calib-${c.id}`, subpath: 'source-photo.png', buffer: photo.buffer, contentType: 'image/png' });
      photoByChild.set(c.id, photoUrl);
      const anchor = await generateStage0MethodBAnchor({ order: syntheticOrder(c), childPhotoUrl: photoUrl, lockedChildDescription: lockedDescription(c) });
      canonical = anchor.anchorUrl;
      ledger.push({ id: c.id, kind: 'photo' }, { id: c.id, kind: 'canonical_anchor', url: canonical });
      await dl(canonical, path.join(outDir, `${c.id}-anchor.png`));
    }
    // expression anchor (USED as first ref on the expression page) — from the synthetic PHOTO, not the anchor.
    let expr: string | null = null;
    if (c.expressionAnchor) {
      const exprPhoto = photoByChild.get(c.id) ?? canonical;
      const ea = await generateStage0MethodBAnchor({ order: syntheticOrder(c), childPhotoUrl: exprPhoto, lockedChildDescription: `${lockedDescription(c)} Expression variant: warm open smile.`, attemptSuffix: 'expr' });
      expr = ea.anchorUrl;
      ledger.push({ id: c.id, kind: 'expression_anchor', url: expr });
    }
    // pages
    const clear = c.pages.find((p) => p.page === 1)!;
    const stress = effectiveStress(c);
    for (const pg of [clear, stress]) {
      const useExpr = c.expressionAnchor && pg.page === 2 && expr;
      const refs = [useExpr ? (expr as string) : canonical, ...styleRefs];
      const res = await generateGPTImage({ finalPrompt: pg.prompt, negativePrompt: STYLE_01_AVOIDANCE_NEGATIVE, referenceImages: refs, referenceMode: 'anchor_photo_style_only', requireReferenceEdit: true, size: '1024x1536', quality: 'low', modelOverride: model });
      const url = await uploadOrderSubpathAsset({ orderId: `calib-${c.id}`, subpath: `pages/page-${pg.page}.png`, buffer: res.buffer, contentType: 'image/png' });
      ledger.push({ id: c.id, kind: `page-${pg.page}`, isExpressionPage: Boolean(useExpr), url, refOrder: [useExpr ? 'expression_anchor' : 'canonical_anchor', 'style_1', 'style_2'], model, quality: 'low', prompt: pg.prompt });
      await dl(url, path.join(outDir, `${c.id}-page${pg.page}.png`));
      console.log(`[split] ${c.id} page-${pg.page}${useExpr ? ' (expression-anchor ref)' : ''} → ${url}`);
    }
  }
  fs.writeFileSync(path.join(root, SPLIT, 'render-ledger.json'), JSON.stringify(ledger, null, 2));
  console.log(`[split] rendered ${ledger.filter((l) => l.url).length} assets; ledger → ${path.join(root, SPLIT, 'render-ledger.json')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
