import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';

import { generateGPTImage } from '../generate-image';
import { resolveStyle01GptModel } from '../style01-gptimage';
import type { SceneAppearanceMemory, SetAppearanceBoardManifest } from './types';
import { qaSetAppearanceBoardImage } from './board-qa';
import {
  buildSetAppearanceBoardPrompt,
  saveSetAppearanceBoardManifest,
  setAppearanceBoardImagePath,
} from './board';
import { BOARD_MANIFEST_VERSION } from './quarantine';

export async function generateSetAppearanceBoard(args: {
  appearance: SceneAppearanceMemory;
  styleRefPaths: string[];
  quality?: 'low' | 'medium';
}): Promise<SetAppearanceBoardManifest> {
  const quality = args.quality ?? 'low';
  const boardPath = setAppearanceBoardImagePath(args.appearance.sceneId);
  const dir = path.dirname(boardPath);
  mkdirSync(dir, { recursive: true });

  const prompt = buildSetAppearanceBoardPrompt(args.appearance);
  const result = await generateGPTImage({
    finalPrompt: prompt,
    referenceImages: args.styleRefPaths.slice(0, 1),
    referenceMode: 'style02_book',
    quality,
    size: '1024x1024',
    // Use the same resolver as every other Style-01 image call. Without this the board fell through to
    // the raw GPT_IMAGE_MODEL env var, so an empty/misconfigured value (e.g. '') broke the board render
    // even though page renders worked — and the board generates first, taking down the whole run.
    modelOverride: resolveStyle01GptModel(),
  });

  writeFileSync(boardPath, result.buffer);
  const qa = await qaSetAppearanceBoardImage(boardPath);
  const manifest: SetAppearanceBoardManifest = {
    sceneId: args.appearance.sceneId,
    boardPath,
    approved: false,
    humanApprovedAt: null,
    qaPassed: qa.passed,
    qaFlags: qa.flags,
    qaCheckedAt: new Date().toISOString(),
    boardVersion: BOARD_MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    quality,
    promptExcerpt: prompt.slice(0, 240),
  };
  saveSetAppearanceBoardManifest(manifest);
  if (!qa.passed) {
    console.warn(
      `[set-appearance-board] QA REJECTED scene=${args.appearance.sceneId} flags=${JSON.stringify(qa.flags)}`
    );
  }
  return manifest;
}

export async function ensureSetAppearanceBoard(args: {
  appearance: SceneAppearanceMemory;
  styleRefPaths: string[];
  existing?: SetAppearanceBoardManifest | null;
  quality?: 'low' | 'medium';
  forceRegenerate?: boolean;
}): Promise<SetAppearanceBoardManifest> {
  const existing = args.existing;
  if (
    !args.forceRegenerate &&
    existing?.boardVersion === BOARD_MANIFEST_VERSION &&
    existing.qaPassed
  ) {
    return existing;
  }
  return generateSetAppearanceBoard({
    appearance: args.appearance,
    styleRefPaths: args.styleRefPaths,
    quality: args.quality,
  });
}
