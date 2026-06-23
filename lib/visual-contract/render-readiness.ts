/**
 * Increment 3 — production render PRECONDITION (amendment #5, fail-closed).
 *
 * A story may NOT enter full render unless its visual contract compiles render-ready
 * AND the story is calibration-trusted (its 5-page hard-gate calibration passed). v5
 * "approved" / golden slots are text-approved, NOT render-ready until that holds.
 *
 * Rollout is behind VISUAL_CONTRACT_GATE_ENABLED so enabling it doesn't block the other
 * live slots that haven't been calibrated yet — flip it on per environment once each slot
 * is trusted. The per-page production vision gate is Increment 4 (deferred).
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseStoryMarkdownForContract } from './parse-story';
import { compileBookVisualContract } from './compiler';

/** Stories whose contract compiled render-ready AND passed the 5-page calibration. */
export const CALIBRATION_TRUSTED_STORY_KEYS = new Set<string>(['lion_shaket_adventure']);

export function isVisualContractGateEnabled(): boolean {
  return process.env.VISUAL_CONTRACT_GATE_ENABLED?.trim().toLowerCase() === 'true';
}

export function deriveStoryKey(
  companionId: string | null | undefined,
  direction: string | null | undefined
): string | null {
  const c = companionId?.trim();
  const d = direction?.trim().toLowerCase();
  if (!c || !d) return null;
  return `${c}_${d}`;
}

function resolveStoryFile(storyKey: string): string | null {
  for (const dir of ['v5-fixed-v2', 'v3-approved']) {
    const p = path.join(process.cwd(), 'story-bank', dir, `${storyKey}.md`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export interface RenderReadiness {
  allowed: boolean;
  reason: string;
  storyKey: string | null;
  blockers?: string[];
}

/** Fail-closed: when the gate is enabled, only a trusted + render-ready story may render. */
export function assessStoryRenderReadiness(
  storyKey: string | null,
  opts?: { generatedAt?: string }
): RenderReadiness {
  if (!isVisualContractGateEnabled()) {
    return { allowed: true, reason: 'visual-contract gate disabled', storyKey };
  }
  if (!storyKey) {
    return { allowed: false, reason: 'could not derive story key (missing companion/direction)', storyKey };
  }
  if (!CALIBRATION_TRUSTED_STORY_KEYS.has(storyKey)) {
    return {
      allowed: false,
      reason: `story "${storyKey}" is not calibration-trusted (text-approved is not render-ready)`,
      storyKey,
    };
  }
  const file = resolveStoryFile(storyKey);
  if (!file) return { allowed: false, reason: `story file not found for "${storyKey}"`, storyKey };
  try {
    const contract = compileBookVisualContract(parseStoryMarkdownForContract(fs.readFileSync(file, 'utf8'), storyKey), {
      generatedAt: opts?.generatedAt ?? '1970-01-01T00:00:00.000Z',
    });
    if (!contract.renderReady) {
      return { allowed: false, reason: 'contract not render-ready', storyKey, blockers: contract.renderReadyBlockers };
    }
    return { allowed: true, reason: 'render-ready + calibration-trusted', storyKey };
  } catch (e) {
    return { allowed: false, reason: `contract compile failed: ${(e as Error).message}`, storyKey };
  }
}
