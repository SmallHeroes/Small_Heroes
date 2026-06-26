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
  buildContractRerollSuppression,
  caughtStrayEntities,
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

async function renderPage(
  block: string,
  companionSheet: string,
  styleRefs: string[],
  suppression = '',
  extraNegative = ''
): Promise<Buffer> {
  const { generateGPTImage } = await import('@/lib/generate-image');
  const parts: string[] = [];
  // On a reroll the fed-back correction LEADS the prompt (max attention); attempt 0 keeps the static
  // allow-list. The authoritative contract block is always present.
  if (suppression) parts.push(suppression);
  parts.push(STYLE_01_SHARED, STYLE_01_NO_TEXT, block);
  if (!suppression) {
    parts.push(
      'CAST ALLOW-LIST: ONLY the child and the declared companion may appear. NO other animals, creatures, or pets — specifically NO armadillo, NO pangolin, NO extra background animal.'
    );
  }
  parts.push('Render this single Style 01 watercolor children\'s-book illustration faithfully to the VISUAL CONTRACT above.');
  const result = await generateGPTImage({
    finalPrompt: parts.join('\n\n'),
    // Push the specific caught strays into the negative prompt too (a strong suppression lever).
    negativePrompt: extraNegative
      ? `${STYLE_01_AVOIDANCE_NEGATIVE}, ${extraNegative}`
      : STYLE_01_AVOIDANCE_NEGATIVE,
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

  const MAX_REROLLS = Math.max(0, Number.parseInt(process.env.VISUAL_CONTRACT_MAX_REROLLS ?? '2', 10) || 2);
  const report: Array<Record<string, unknown>> = [];

  for (const pageNumber of selection.pageNumbers) {
    const isCover = pageNumber === 0;
    const page = isCover ? coverPage(contract) : byNum.get(pageNumber);
    if (!page) continue;
    const label = isCover ? 'cover' : `page-${String(pageNumber).padStart(2, '0')}`;
    const block = buildVisualContractPromptBlock(page, contract);
    const instruction = buildContractVisionInstruction(page, contract, isCover);

    const attempts: Array<Record<string, unknown>> = [];
    let detectedStray = false; // any attempt the gate flagged a forbidden/extra creature
    let finalPass = false;
    let finalFile = '';
    // attempt 0 = first render; bounded FEEDBACK-AWARE reroll on FAIL (detect → reroll → clean): the
    // caught entity / wrong location / etc. from the failed attempt is fed into the next attempt's
    // suppression (prompt-lead + negative prompt) — NOT a blind re-render of the same prompt.
    let suppression = '';
    let extraNegative = '';
    for (let attempt = 0; attempt <= MAX_REROLLS; attempt++) {
      const buffer = await renderPage(block, companionSheet, styleRefs, suppression, extraNegative);
      const file = path.join(OUT_DIR, 'pages', `${label}-attempt-${attempt}.png`);
      writeFileSync(file, buffer);
      const observation = interpretVisionJson(await visionObserve(buffer, instruction));
      const verdict = evaluatePageContractQa({ page, observation, isCover });
      const flaggedStray = verdict.failures.some((f) => f.check === 'forbidden_entity');
      if (flaggedStray) detectedStray = true;
      attempts.push({ attempt, file, pass: verdict.pass, failures: verdict.failures, observation, fedBackSuppression: Boolean(suppression) });
      console.log(
        `[calib] ${label} attempt ${attempt}: ${verdict.pass ? 'PASS' : 'FAIL'}` +
          `${verdict.failures.length ? ` [${verdict.failures.map((f) => f.check).join(', ')}]` : ''}` +
          ` forbiddenSeen=${JSON.stringify(observation.forbiddenEntitiesPresent)} loc=${observation.locationMatchesContract}` +
          `${suppression ? ' (fed-back suppression applied)' : ''}`
      );
      if (verdict.pass) {
        finalPass = true;
        finalFile = file;
        // Promote the clean attempt to the canonical page file for eyeballing.
        writeFileSync(path.join(OUT_DIR, 'pages', `${label}.png`), buffer);
        break;
      }
      // Feed the gate's findings forward so the NEXT attempt actively suppresses what was caught.
      suppression = buildContractRerollSuppression({ observation, verdict, page, contract, attempt });
      extraNegative = caughtStrayEntities(observation).join(', ');
    }
    const rerolledToClean = detectedStray && finalPass && attempts.length > 1;
    report.push({ pageNumber, isCover, label, finalPass, detectedStray, rerolledToClean, finalFile, attempts });
  }

  const locationStable = report.every((r) =>
    (r.attempts as Array<{ observation: { locationMatchesContract: boolean } }>).every((a) => a.observation.locationMatchesContract)
  );
  const allFinalPass = report.every((r) => r.finalPass);
  const demonstratedDetectRerollClean = report.some((r) => r.rerolledToClean);
  // Architecture PASS requires: location stable, every page ends clean, AND at least one real
  // detect→reroll→clean cycle was observed (gate detection alone is not sufficient).
  const architecturePass = locationStable && allFinalPass && demonstratedDetectRerollClean;

  writeFileSync(
    path.join(OUT_DIR, 'calibration-report.json'),
    JSON.stringify(
      { storyKey: STORY_KEY, architecturePass, locationStable, allFinalPass, demonstratedDetectRerollClean, maxRerolls: MAX_REROLLS, results: report },
      null,
      2
    )
  );
  console.log(
    `\n[calib] ===== locationStable=${locationStable} allFinalPass=${allFinalPass} ` +
      `detect→reroll→clean=${demonstratedDetectRerollClean} → architecture ${architecturePass ? 'PASS' : 'NOT PROVEN'} =====`
  );
  console.log('[calib] (eyeball the per-page *.png before trusting the gate — a false-pass armadillo = FAIL)');
  console.log(`[calib] report: ${path.join(OUT_DIR, 'calibration-report.json')}`);
  if (!architecturePass) process.exitCode = 2;
}

main().catch((err) => {
  console.error('[calib] FATAL:', err);
  process.exit(1);
});
