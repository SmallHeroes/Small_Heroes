import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

import type { PageShot } from '../book-shot-plan/types';
import { artifactsBaseDir } from '../generation-pipeline/runtime-artifact-store';
import type { SceneAppearanceMemory, SetAppearanceBoardManifest } from './types';
import {
  BOARD_MANIFEST_VERSION,
  BOARD_QUARANTINE_FORBIDDEN_LINES,
  buildFixedBoardAppearanceMemory,
} from './quarantine';

// Set-appearance boards are a DEV/QA-console artifact (not wired into the chunked production render),
// generated and consumed within a single invocation. On a serverless runtime the board PNG + manifest
// live under the OS temp dir (Vercel FS is read-only except /tmp); local dev keeps ./outputs as before.
// existsSync()-based usability and local-path refs still work because it's all one invocation — no
// cross-chunk durability is required, so no Supabase descriptor is needed here.
export const SET_APPEARANCE_BOARD_ROOT = artifactsBaseDir('set-appearance-boards');

export function setAppearanceBoardDir(sceneId: string): string {
  return path.join(SET_APPEARANCE_BOARD_ROOT, sceneId.replace(/[^a-z0-9_-]+/gi, '_'));
}

export function setAppearanceBoardImagePath(sceneId: string): string {
  return path.join(setAppearanceBoardDir(sceneId), 'set-appearance-board.png');
}

export function setAppearanceBoardManifestPath(sceneId: string): string {
  return path.join(setAppearanceBoardDir(sceneId), 'manifest.json');
}

export function loadSetAppearanceBoardManifest(
  sceneId: string
): SetAppearanceBoardManifest | null {
  const manifestPath = setAppearanceBoardManifestPath(sceneId);
  if (!existsSync(manifestPath)) return null;
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf-8')) as SetAppearanceBoardManifest;
  } catch {
    return null;
  }
}

export function saveSetAppearanceBoardManifest(manifest: SetAppearanceBoardManifest): void {
  const dir = setAppearanceBoardDir(manifest.sceneId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(setAppearanceBoardManifestPath(manifest.sceneId), JSON.stringify(manifest, null, 2));
}

export function isSetAppearanceBoardUsable(manifest: SetAppearanceBoardManifest | null): boolean {
  if (!manifest?.approved || !manifest.boardPath?.trim()) return false;
  if (!manifest.humanApprovedAt?.trim()) return false;
  if (!manifest.qaPassed) return false;
  if (manifest.boardVersion !== BOARD_MANIFEST_VERSION) return false;
  return existsSync(manifest.boardPath);
}

export class SetAppearanceBoardReviewRequiredError extends Error {
  readonly sceneId: string;
  readonly boardPath: string;
  readonly qaPassed: boolean;

  constructor(review: { sceneId: string; boardPath: string; qaPassed: boolean }) {
    super(
      `SET_APPEARANCE_BOARD_REVIEW_REQUIRED: scene=${review.sceneId} awaits human approval. ` +
        `Eyeball ${review.boardPath} in /dev/creator then approve before customer render.`
    );
    this.name = 'SetAppearanceBoardReviewRequiredError';
    this.sceneId = review.sceneId;
    this.boardPath = review.boardPath;
    this.qaPassed = review.qaPassed;
  }
}

export function approveSetAppearanceBoardManifest(
  sceneId: string
): SetAppearanceBoardManifest | null {
  const manifest = loadSetAppearanceBoardManifest(sceneId);
  if (!manifest?.qaPassed || manifest.boardVersion !== BOARD_MANIFEST_VERSION) return null;
  const updated: SetAppearanceBoardManifest = {
    ...manifest,
    approved: true,
    humanApprovedAt: new Date().toISOString(),
  };
  saveSetAppearanceBoardManifest(updated);
  return updated;
}

export function pageAllowsSetAppearanceBoardRef(pageShot?: PageShot | null): boolean {
  return pageShot?.shot !== 'close_up';
}

/** Character-free FIXED-OBJECTS board — quarantined from stateful/collapsible forms. */
export function buildSetAppearanceBoardPrompt(appearance: SceneAppearanceMemory): string {
  const fixed = buildFixedBoardAppearanceMemory(appearance);
  const objectLines = fixed.signatures.map((s) => {
    const detail = [s.silhouette, s.material, s.colorFamily, s.formNote].filter(Boolean).join('; ');
    return `- ${s.factId}: ${detail || 'fixed design from story set'}`;
  });

  return [
    'CHARACTER-FREE FIXED SET APPEARANCE REFERENCE SHEET — isolated FIXED object studies on neutral warm cream paper.',
    'CRITICAL WINDOW RULE: every window study is BARE FRAME + GLASS PANES ONLY — zero curtains, zero drapes, zero valances, zero hanging fabric of any kind.',
    'Layout: grid of SEPARATE fixed furniture/surfaces with breathing room — NOT a composed bedroom scene, NOT a room interior.',
    'NO child, NO animal, NO human figures, NO characters.',
    '',
    'FIXED OBJECTS ONLY (appearance identity and palette):',
    ...objectLines,
    '',
    'BED STUDY RULE: show headboard + bed frame silhouette ONLY — bare mattress, NO pillows on bed, NO blanket on bed.',
    '',
    'WINDOW STUDY RULE: show bare window FRAME and GLASS panes ONLY — NO curtains, drapes, valances, tiebacks, or any soft fabric on or around the window.',
    '',
    BOARD_QUARANTINE_FORBIDDEN_LINES,
    '',
    `LIGHTING for sheet: ${fixed.lightingLockNote}`,
    '',
    'STYLE: soft watercolor children\'s book illustration on cream paper — gentle washes, readable object silhouettes.',
    'Each object shows its fixed materials, colours, and form family for set continuity across pages.',
    '[NO TEXT] No letters, labels, or watermarks.',
  ].join('\n');
}
