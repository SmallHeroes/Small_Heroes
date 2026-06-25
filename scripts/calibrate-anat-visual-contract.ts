/**
 * ענת (panda_anat_bedtime) Visual Contract calibration — RENDER-ONLY, no DB, no Supabase.
 *
 * Compiles the BookVisualContract from the full story, renders ONLY the 5 risk pages LOW with the
 * authoritative contract block injected, and runs the hard 5-check vision-QA gate on each. Full
 * render STAYS STOPPED — this never advances to a full book. Outputs (contract + PNGs + verdicts) go
 * to outputs/visual-contract-calibration/<story>/ (gitignored).
 *
 * Creds are borrowed from a real .env (default: Guy's clone) — set SH_ENV_FILE to override. This
 * script touches ONLY OpenAI (compile + gpt-image + vision); it never imports the prisma pipeline
 * (compileBookVisualContract takes an injected callLLM), so the prod DATABASE_URL is never used.
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/calibrate-anat-visual-contract.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: process.env.SH_ENV_FILE || 'C:/GNart/Work/Small_Heroes/.env.local' });

import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import OpenAI from 'openai';
import {
  compileBookVisualContract,
  derivePageVisualContracts,
  selectCalibrationPages,
  buildVisualContractPromptBlock,
  buildContractVisionInstruction,
  interpretVisionJson,
  evaluatePageContractQa,
  type BookVisualContract,
  type ResolvedPageContract,
} from '@/lib/visual-contract-compiler';
import {
  STYLE_01_SHARED,
  STYLE_01_NO_TEXT,
  STYLE_01_AVOIDANCE_NEGATIVE,
  resolveStyle01GptModel,
  resolveStyle01StyleReferencePaths,
} from '@/lib/style01-gptimage';

const STORY_KEY = process.env.CALIB_STORY_KEY || 'panda_anat_bedtime';
const STORY_PATH = `story-bank/v3-approved/${STORY_KEY}.md`;
const OUT_DIR = path.join('outputs', 'visual-contract-calibration', STORY_KEY);
const VISION_MODEL = process.env.CHILD_PHOTO_VISION_MODEL?.trim() || 'gpt-4o';
const TEXT_MODEL = process.env.CALIB_TEXT_MODEL?.trim() || 'gpt-4o';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function readStory(): { fullText: string; companionId: string; pageCount: number } {
  const raw = readFileSync(STORY_PATH, 'utf8');
  const companionId = /companionId:\s*(\S+)/.exec(raw)?.[1] ?? 'panda_anat';
  const pageCount = Number.parseInt(/pages:\s*(\d+)/.exec(raw)?.[1] ?? '8', 10) || 8;
  return { fullText: raw, companionId, pageCount };
}

/** Injected compiler LLM — direct OpenAI JSON, so we never import the prisma pipeline. */
async function callLLM(system: string, user: string): Promise<string> {
  const res = await openai.chat.completions.create({
    model: TEXT_MODEL,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  return res.choices[0]?.message?.content ?? '';
}

async function visionObserve(imageBuffer: Buffer, instruction: string): Promise<string> {
  const dataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;
  const res = await openai.chat.completions.create({
    model: VISION_MODEL,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: instruction },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
  });
  return res.choices[0]?.message?.content ?? '';
}

/** Cover represented as a page-shaped contract so the same gate/instruction logic applies. */
function coverPage(contract: BookVisualContract): ResolvedPageContract {
  const c = contract.coverContract;
  return {
    pageNumber: 0,
    locationId: c.locationId,
    sameLocationAs: null,
    mustShow: c.mustShow ?? [],
    mustNotShow: [...(c.mustNotShow ?? []), ...(contract.forbiddenGlobalElements ?? [])],
    characterPresence: { child: true, companion: false },
    propState: [],
    camera: 'cover composition, the book\'s promise',
    childWardrobeLock: contract.cast.child.wardrobe.description,
    locationName: contract.locations.find((l) => l.id === c.locationId)?.name ?? c.locationId,
  };
}

async function renderPage(block: string, companionSheet: string, styleRefs: string[]): Promise<Buffer> {
  const { generateGPTImage } = await import('@/lib/generate-image');
  const finalPrompt = [
    STYLE_01_SHARED,
    STYLE_01_NO_TEXT,
    block,
    'CAST ALLOW-LIST: ONLY the child and the declared companion may appear. NO other animals, creatures, or pets — specifically NO armadillo, NO pangolin, NO extra background animal.',
    'Render this single Style 01 watercolor children\'s-book illustration faithfully to the VISUAL CONTRACT above.',
  ].join('\n\n');
  const result = await generateGPTImage({
    finalPrompt,
    negativePrompt: STYLE_01_AVOIDANCE_NEGATIVE,
    referenceImages: [companionSheet, ...styleRefs].filter(Boolean),
    size: '1024x1536',
    quality: 'low',
    modelOverride: resolveStyle01GptModel(),
  });
  return result.buffer;
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY missing — set SH_ENV_FILE to a .env with creds.');
  }
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(path.join(OUT_DIR, 'pages'), { recursive: true });

  const { fullText, companionId, pageCount } = readStory();
  console.log(`[calib] story=${STORY_KEY} companion=${companionId} pages=${pageCount} model=${resolveStyle01GptModel()}`);

  // 1. compile + validate (fail-closed inside compileBookVisualContract)
  console.log('[calib] compiling BookVisualContract from full story...');
  const contract = await compileBookVisualContract(
    { storyKey: STORY_KEY, fullStoryText: fullText, pageCount, companion: { id: companionId } },
    { callLLM }
  );
  writeFileSync(path.join(OUT_DIR, 'contract.json'), JSON.stringify(contract, null, 2));
  console.log(
    `[calib] contract OK: worldType="${contract.worldType}" locations=${contract.locations.map((l) => l.id).join(',')} ` +
      `zones=${contract.zones.map((z) => `${z.locationId}/${z.id}`).join(',')} forbidden=[${contract.forbiddenGlobalElements.join(', ')}]`
  );

  const resolved = derivePageVisualContracts(contract);
  const byNum = new Map(resolved.map((p) => [p.pageNumber, p]));
  const selection = selectCalibrationPages(contract);
  console.log(`[calib] 5 risk pages = ${JSON.stringify(selection.pageNumbers)} (${JSON.stringify({
    cover: 0,
    establishing: selection.establishingLocation,
    zoneTransition: selection.zoneTransitionSamePlace,
    companionAction: selection.companionAction,
    keyProp: selection.keyProp,
  })})`);

  const companionSheet = `public/companions/${companionId}/style01-sheets/front.png`;
  const styleRefs = resolveStyle01StyleReferencePaths('bedroom-night', 2);

  const report: Array<Record<string, unknown>> = [];
  for (const pageNumber of selection.pageNumbers) {
    const isCover = pageNumber === 0;
    const page = isCover ? coverPage(contract) : byNum.get(pageNumber);
    if (!page) continue;
    const block = buildVisualContractPromptBlock(page, contract);
    console.log(`[calib] rendering ${isCover ? 'cover' : `page ${pageNumber}`} (location=${page.locationId}${page.zoneId ? `/${page.zoneId}` : ''})...`);
    const buffer = await renderPage(block, companionSheet, styleRefs);
    const file = path.join(OUT_DIR, 'pages', `${isCover ? 'cover' : `page-${String(pageNumber).padStart(2, '0')}`}.png`);
    writeFileSync(file, buffer);

    const instruction = buildContractVisionInstruction(page, contract, isCover);
    const visionRaw = await visionObserve(buffer, instruction);
    const observation = interpretVisionJson(visionRaw);
    const verdict = evaluatePageContractQa({ page, observation, isCover });
    console.log(
      `[calib]   → ${verdict.pass ? 'PASS' : 'FAIL'}${verdict.failures.length ? ` [${verdict.failures.map((f) => f.check).join(', ')}]` : ''}  file=${file}`
    );
    report.push({ pageNumber, isCover, file, pass: verdict.pass, failures: verdict.failures, observation });
  }

  const allPass = report.every((r) => r.pass);
  writeFileSync(
    path.join(OUT_DIR, 'calibration-report.json'),
    JSON.stringify({ storyKey: STORY_KEY, allPass, results: report }, null, 2)
  );
  console.log(`\n[calib] ===== ${allPass ? 'ALL 5 RISK PAGES PASS' : 'FAIL — DO NOT FULL-RENDER'} =====`);
  console.log(`[calib] report: ${path.join(OUT_DIR, 'calibration-report.json')}`);
  if (!allPass) process.exitCode = 2;
}

main().catch((err) => {
  console.error('[calib] FATAL:', err);
  process.exit(1);
});
