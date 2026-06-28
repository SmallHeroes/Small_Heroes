/**
 * DIVERSE IDENTITY-CALIBRATION SET BUILDER (Codex-approved spec).
 *
 * Builds a dedicated SYNTHETIC diverse set to calibrate the identity gate's "ruler". Faithful path
 * (Codex-corrected — the gate compares ILLUSTRATION → ILLUSTRATION, not photo → watercolor):
 *     synthetic photo  →  Stage-0 Method-B canonical WATERCOLOR anchor  →  live-style WATERCOLOR pages
 * Calibration then measures: canonical/expression ANCHOR → PAGE.
 *
 * Spec: 16 children · 8 dev / 8 holdout (frozen) · 4 hard-lookalike pairs (2 per split, a pair stays whole
 * in one split) · 2 pages/child (clear + balanced stress) · >=4 expression anchors · changed-wardrobe
 * positives · opaque IDs (NO child name anywhere) · hard budget <=72 LOW image-gen calls. The 3 existing
 * REAL children are a FROZEN sentinel (regression), not part of this set.
 *
 * THIS RUN IS DRY by default — prints the full plan + the exact call breakdown + writes the manifest, NO
 * spend. Render execution is wired in the NEXT step, ONLY after Guy's explicit render-go.
 *
 * Usage:  npx tsx scripts/build-diverse-calibration-set.ts        (dry plan + manifest, no spend)
 */
import fs from 'fs';
import path from 'path';

const HARD_IMAGE_BUDGET = 72;

type Gender = 'boy' | 'girl';
type Split = 'dev' | 'holdout';
type StressKind = 'profile' | 'occlusion' | 'multi_child' | 'small_target';

interface Child {
  id: string; // OPAQUE — never a name
  gender: Gender;
  age: number;
  skin: string;
  hairColor: string;
  hairTexture: string;
  glasses: boolean;
  /** Distinguishing facial trait — for hard pairs the two share everything else but differ HERE. */
  faceTrait: string;
  pair: string | null; // hard-lookalike pair id, or null
  split: Split;
  expressionAnchor: boolean; // gets an extra expression anchor (>=4 total)
}

// 16 children. 4 hard pairs (pA,pB in DEV · pC,pD in HOLDOUT). Distinct kids fill the rest of each split.
const CHILDREN: Child[] = [
  // ── Hard pair A (DEV) — girl 6, medium skin, dark-brown curly; differ only in face trait
  { id: 'c01', gender: 'girl', age: 6, skin: 'medium', hairColor: 'dark brown', hairTexture: 'curly', glasses: false, faceTrait: 'round face, small button nose', pair: 'pA', split: 'dev', expressionAnchor: true },
  { id: 'c02', gender: 'girl', age: 6, skin: 'medium', hairColor: 'dark brown', hairTexture: 'curly', glasses: false, faceTrait: 'oval face, light freckles across the nose', pair: 'pA', split: 'dev', expressionAnchor: false },
  // ── Hard pair B (DEV) — boy 5, light skin, blonde straight
  { id: 'c03', gender: 'boy', age: 5, skin: 'light', hairColor: 'blonde', hairTexture: 'straight', glasses: false, faceTrait: 'wide-set blue eyes, dimpled chin', pair: 'pB', split: 'dev', expressionAnchor: false },
  { id: 'c04', gender: 'boy', age: 5, skin: 'light', hairColor: 'blonde', hairTexture: 'straight', glasses: false, faceTrait: 'narrow green eyes, no dimple', pair: 'pB', split: 'dev', expressionAnchor: false },
  // ── Hard pair C (HOLDOUT) — girl 7, dark skin, black coily
  { id: 'c05', gender: 'girl', age: 7, skin: 'dark', hairColor: 'black', hairTexture: 'coily', glasses: false, faceTrait: 'high cheekbones, gap-toothed smile', pair: 'pC', split: 'holdout', expressionAnchor: true },
  { id: 'c06', gender: 'girl', age: 7, skin: 'dark', hairColor: 'black', hairTexture: 'coily', glasses: false, faceTrait: 'rounder cheeks, full smile no gap', pair: 'pC', split: 'holdout', expressionAnchor: false },
  // ── Hard pair D (HOLDOUT) — boy 8, tan skin, red wavy, glasses
  { id: 'c07', gender: 'boy', age: 8, skin: 'tan', hairColor: 'auburn red', hairTexture: 'wavy', glasses: true, faceTrait: 'square jaw, thick eyebrows', pair: 'pD', split: 'holdout', expressionAnchor: false },
  { id: 'c08', gender: 'boy', age: 8, skin: 'tan', hairColor: 'auburn red', hairTexture: 'wavy', glasses: true, faceTrait: 'softer jaw, thin eyebrows, freckled cheeks', pair: 'pD', split: 'holdout', expressionAnchor: false },
  // ── Distinct DEV kids
  { id: 'c09', gender: 'girl', age: 4, skin: 'light', hairColor: 'light brown', hairTexture: 'wavy', glasses: false, faceTrait: 'big hazel eyes, chubby cheeks', pair: null, split: 'dev', expressionAnchor: true },
  { id: 'c10', gender: 'boy', age: 7, skin: 'tan', hairColor: 'black', hairTexture: 'straight', glasses: false, faceTrait: 'almond eyes, straight brows', pair: null, split: 'dev', expressionAnchor: false },
  { id: 'c11', gender: 'girl', age: 8, skin: 'light', hairColor: 'blonde', hairTexture: 'curly', glasses: true, faceTrait: 'long face, pointed chin', pair: null, split: 'dev', expressionAnchor: false },
  { id: 'c12', gender: 'boy', age: 6, skin: 'dark', hairColor: 'dark brown', hairTexture: 'coily', glasses: false, faceTrait: 'broad nose, warm round face', pair: null, split: 'dev', expressionAnchor: false },
  // ── Distinct HOLDOUT kids
  { id: 'c13', gender: 'girl', age: 5, skin: 'medium', hairColor: 'auburn red', hairTexture: 'straight', glasses: false, faceTrait: 'freckles, upturned nose', pair: null, split: 'holdout', expressionAnchor: true },
  { id: 'c14', gender: 'boy', age: 4, skin: 'tan', hairColor: 'light brown', hairTexture: 'curly', glasses: false, faceTrait: 'round face, deep dimples', pair: null, split: 'holdout', expressionAnchor: false },
  { id: 'c15', gender: 'girl', age: 6, skin: 'light', hairColor: 'black', hairTexture: 'wavy', glasses: false, faceTrait: 'dark eyes, defined eyebrows', pair: null, split: 'holdout', expressionAnchor: false },
  { id: 'c16', gender: 'boy', age: 7, skin: 'medium', hairColor: 'blonde', hairTexture: 'coily', glasses: true, faceTrait: 'oval face, light eyebrows', pair: null, split: 'holdout', expressionAnchor: false },
];

const STRESS_BY_INDEX: StressKind[] = ['profile', 'occlusion', 'multi_child', 'small_target'];

/** Synthetic SOURCE photo prompt (the input to Stage-0). Opaque, no name. Hard pairs share all but faceTrait. */
function photoPrompt(c: Child): string {
  return (
    `Candid head-and-shoulders PHOTOGRAPH of a ${c.age}-year-old ${c.gender}, ${c.skin} skin tone, ` +
    `${c.hairColor} ${c.hairTexture} hair${c.glasses ? ', wearing kids glasses' : ''}, ${c.faceTrait}. ` +
    `Neutral soft-grey studio background, gentle daylight, natural relaxed expression, looking at camera. ` +
    `Photorealistic, sharp focus on the face. No text.`
  );
}

/** A page SCENE prompt (identity comes from the anchor, not here). page 1 = clear; page 2 = balanced stress. */
function pagePrompt(c: Child, page: 1 | 2, stress: StressKind, wardrobe: string): string {
  const base = `Children's storybook watercolour page. The child wears ${wardrobe}.`;
  if (page === 1) {
    return `${base} CLEAR establishing shot: the child front-facing, full upper body, calm simple playroom, face fully visible. No text.`;
  }
  const stressClause: Record<StressKind, string> = {
    profile: 'the child in 3/4-to-profile view turning to look at a butterfly',
    occlusion: 'the child partly behind a low fence, lower face occluded by a raised hand waving',
    multi_child: 'the child in a small group of 2-3 OTHER different children at a sandbox (the target child most prominent, front-left)',
    small_target: 'a wide park scene where the child is small in frame (~20% height), reading a book on a bench',
  };
  return `${base} STRESS case (${stress}): ${stressClause[stress]}. Natural, varied pose. No text.`;
}

function main(): void {
  const dev = CHILDREN.filter((c) => c.split === 'dev');
  const holdout = CHILDREN.filter((c) => c.split === 'holdout');
  const expr = CHILDREN.filter((c) => c.expressionAnchor);

  // Per child: 1 photo + 1 canonical anchor + 2 pages; expression-anchor children: +1 expression anchor.
  const photos = CHILDREN.length;
  const canonical = CHILDREN.length;
  const expressionAnchors = expr.length;
  const pages = CHILDREN.length * 2;
  const totalImageGen = photos + canonical + expressionAnchors + pages;

  const manifest = {
    spec: 'diverse-identity-calibration-v1 (Codex-approved)',
    faithfulPath: 'synthetic photo -> Stage-0 Method-B canonical watercolour anchor -> live-style watercolour pages; measure anchor->page',
    flag: 'VISUAL_CONTRACT_IDENTITY_VISION stays OFF (offline scoring)',
    split: { dev: dev.map((c) => c.id), holdout: holdout.map((c) => c.id) },
    hardPairs: ['pA', 'pB', 'pC', 'pD'].map((p) => ({
      pair: p,
      children: CHILDREN.filter((c) => c.pair === p).map((c) => c.id),
      split: CHILDREN.find((c) => c.pair === p)?.split,
    })),
    expressionAnchorChildren: expr.map((c) => c.id),
    sentinelRealChildren: ['יובל', 'בר', 'נועם'],
    callBudget: { photos, canonical, expressionAnchors, pages, totalImageGen, hardCap: HARD_IMAGE_BUDGET },
    children: CHILDREN.map((c, i) => ({
      ...c,
      photoPrompt: photoPrompt(c),
      pages: [
        { page: 1, stress: 'none', wardrobe: 'a plain green t-shirt and blue shorts', prompt: pagePrompt(c, 1, 'profile', 'a plain green t-shirt and blue shorts') },
        // CHANGED-WARDROBE positive on page 2 (prove the judge is not ID-ing by clothing) + a balanced stress case.
        { page: 2, stress: STRESS_BY_INDEX[i % STRESS_BY_INDEX.length], wardrobe: 'a yellow raincoat and red boots', prompt: pagePrompt(c, 2, STRESS_BY_INDEX[i % STRESS_BY_INDEX.length], 'a yellow raincoat and red boots') },
      ],
    })),
    groundTruthProtocol: 'per-page BLIND check before use (synthetic-ID is NOT auto ground truth); generator-drifted pages rejected/replaced within budget',
    hardPairProtocol: 'blinded 2AFC vs BOTH anchors; humans-indistinguishable pair -> ambiguity_challenge, not a certain negative',
    judgeProtocol: 'hard cases scored 3x, fixed model version pinned + documented in the proof',
    holdoutPolicy: 'opened ONCE, after crop + thresholds frozen on DEV',
  };

  // ── DRY plan output ───────────────────────────────────────────────────────
  console.log('=== DIVERSE IDENTITY-CALIBRATION SET — DRY PLAN (no spend) ===\n');
  console.log(`children: ${CHILDREN.length}  |  dev: ${dev.length}  holdout: ${holdout.length}  |  expression anchors: ${expr.length}`);
  console.log(`hard pairs: pA,pB (dev) · pC,pD (holdout) — each pair entirely in one split\n`);
  console.log('id  | split   | g/age | skin   | hair                 | glasses | pair | exprAnchor');
  for (const c of CHILDREN) {
    console.log(
      `${c.id} | ${c.split.padEnd(7)} | ${c.gender[0]}/${c.age}   | ${c.skin.padEnd(6)} | ` +
        `${(c.hairColor + ' ' + c.hairTexture).padEnd(20)} | ${c.glasses ? 'yes' : 'no '}     | ${c.pair ?? '--'}   | ${c.expressionAnchor ? 'yes' : 'no'}`
    );
  }
  console.log('\nSample synthetic-photo prompts (opaque IDs, no names):');
  for (const c of [CHILDREN[0], CHILDREN[1], CHILDREN[4], CHILDREN[8]]) {
    console.log(`  ${c.id}: ${photoPrompt(c)}`);
  }
  console.log('\nHard-pair contrast (pA — same everything, DIFFERENT face trait):');
  console.log(`  c01: ${CHILDREN[0].faceTrait}`);
  console.log(`  c02: ${CHILDREN[1].faceTrait}`);
  console.log('\n=== CALL BUDGET (LOW image-gen) ===');
  console.log(`  photos: ${photos} + canonical anchors: ${canonical} + expression anchors: ${expressionAnchors} + pages: ${pages}`);
  console.log(`  TOTAL image-gen = ${totalImageGen}  (hard cap ${HARD_IMAGE_BUDGET}) → ${totalImageGen <= HARD_IMAGE_BUDGET ? 'WITHIN BUDGET' : 'OVER BUDGET'}`);
  console.log('  + vision-judge calls (hard cases x3) at scoring time. Pages-only, no orders, flag OFF.\n');

  const outDir = path.join(process.cwd(), 'outputs', 'diverse-calibration');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'set-manifest.json');
  fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2));
  console.log(`[builder] wrote PLAN manifest → ${outFile}`);
  console.log('[builder] DRY ONLY — render execution is wired in the next step, after Guy\'s explicit render-go.');

  if (totalImageGen > HARD_IMAGE_BUDGET) {
    console.error(`[builder] ABORT: plan exceeds the ${HARD_IMAGE_BUDGET}-call hard budget.`);
    process.exit(1);
  }
}

main();
