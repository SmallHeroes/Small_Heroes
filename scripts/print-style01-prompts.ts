/**
 * scripts/print-style01-prompts.ts
 *
 * Prompt-only printer for Style 01 — Dini fantasy (pages 1-10) + Dobi adventure (pages 1-5).
 * NO image API calls. NO OpenAI cost. NO file uploads to OpenAI.
 *
 * Calls assembleStyle01Phase2Prompt() directly per page and writes the result
 * to outputs/style01-prompts/<companion>-p<N>.txt for human review.
 *
 * Usage:
 *   $env:PHASE2_STYLE01_BOOK_PIPELINE = "true"
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/print-style01-prompts.ts
 *
 * Override defaults via env:
 *   CHILD_NAME=נועם  CHILD_AGE=5  CHILD_GENDER=boy
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

import { loadStoryFromBank } from '../backend/providers/story-bank-loader';
import { getCompanionById } from '../lib/companions';
import { assembleStyle01Phase2Prompt } from '../lib/style01-prompt-assembly';

const CHILD_NAME = process.env.CHILD_NAME?.trim() || 'נועם';
const CHILD_AGE = Number.parseInt(process.env.CHILD_AGE?.trim() ?? '5', 10) || 5;
const CHILD_GENDER = (process.env.CHILD_GENDER?.trim() || 'boy') as 'boy' | 'girl';
const MAX_PAGES_DEFAULT = 5;
const OUT_DIR = path.join(process.cwd(), 'outputs', 'style01-prompts');

type Target = {
  id: string;
  label: string;
  companionId: string;
  storyFile: string;
  maxPages: number;
};

const TARGETS: Target[] = [
  {
    id: 'dini',
    label: 'Dini fantasy (dragon)',
    companionId: 'dragon_dini',
    storyFile: 'story-bank/v5-fixed-v2/dragon_dini_fantasy.md',
    maxPages: 10,
  },
  {
    id: 'dobi',
    label: 'Dobi adventure (bear cub)',
    companionId: 'bear_cub_gahal',
    storyFile: 'story-bank/v5-fixed-v2/bear_cub_gahal_adventure.md',
    maxPages: MAX_PAGES_DEFAULT,
  },
];

function summarizeEntityPresence(ep: unknown): string {
  try {
    return JSON.stringify(ep, null, 2);
  } catch {
    return String(ep);
  }
}

function summarizePageStoryState(ps: unknown): string {
  if (ps == null) return '(null - no state for this page)';
  try {
    return JSON.stringify(ps, null, 2);
  } catch {
    return String(ps);
  }
}

async function runOne(target: Target): Promise<void> {
  console.log(`\n>>> ${target.label}`);

  const companion = getCompanionById(target.companionId);
  if (!companion) {
    console.error(`  ! companion not found: ${target.companionId}`);
    return;
  }

  const storyPath = path.join(process.cwd(), target.storyFile);
  const story = await loadStoryFromBank(
    storyPath,
    CHILD_NAME,
    companion.name,
    CHILD_GENDER,
    { maxPages: target.maxPages, skipPersonalizationGate: true }
  );

  await mkdir(OUT_DIR, { recursive: true });

  for (let i = 0; i < Math.min(target.maxPages, story.pages.length); i++) {
    const page = story.pages[i];
    const pageNumber = page.pageNumber ?? i + 1;

    const result = assembleStyle01Phase2Prompt({
      pageNumber,
      pagePrompt: page.imagePrompt ?? null,
      rawScenePrompt: page.rawScenePrompt ?? page.imagePrompt ?? null,
      bookPageText: page.text ?? null,
      childFirstName: CHILD_NAME,
      childAge: CHILD_AGE,
      childGender: CHILD_GENDER,
      companion: {
        id: companion.id,
        name: companion.name,
        visualDescription: companion.visualDescription,
        image: companion.image,
      },
    });

    const outFile = path.join(OUT_DIR, `${target.id}-p${pageNumber}.txt`);
    const sections = [
      `=== ${target.label} - page ${pageNumber} ===`,
      ``,
      `SCENE CLASS: ${result.sceneClass}`,
      ``,
      `--- entityPresence ---`,
      summarizeEntityPresence(result.entityPresence),
      ``,
      `--- pageStoryState ---`,
      summarizePageStoryState(result.pageStoryState),
      ``,
      `--- compositionBlock ---`,
      result.compositionBlock || '(empty)',
      ``,
      `--- bookPageText (Hebrew) ---`,
      page.text ?? '(empty)',
      ``,
      `--- imageDirection (raw) ---`,
      (page.rawScenePrompt ?? page.imagePrompt ?? '').trim() || '(empty)',
      ``,
      `--- FINAL PROMPT (${result.prompt.length} chars) ---`,
      result.prompt,
      ``,
    ].join('\n');

    await writeFile(outFile, sections, 'utf-8');
    console.log(`  OK ${outFile} (${result.prompt.length} chars)`);
  }
}

async function main(): Promise<void> {
  console.log(`Style 01 prompt-only printer`);
  console.log(`  CHILD_NAME=${CHILD_NAME}  AGE=${CHILD_AGE}  GENDER=${CHILD_GENDER}`);
  console.log(`  out: ${OUT_DIR}`);

  let totalFiles = 0;
  for (const target of TARGETS) {
    try {
      await runOne(target);
      totalFiles += target.maxPages;
    } catch (err) {
      console.error(`! ${target.label} failed:`, err);
    }
  }

  console.log(`\nDone. ${totalFiles} prompt files written under: ${OUT_DIR}`);
  console.log(`(NO OpenAI / image API was called.)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
