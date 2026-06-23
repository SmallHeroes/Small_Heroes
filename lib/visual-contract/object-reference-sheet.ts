/**
 * Critical-object reference sheets (Phase 1).
 *
 * Mirrors the companion-sheet idea for plot-critical OBJECTS: render a clean,
 * single-object reference for each critical object/state (stone-gate-closed/open,
 * red-cube, golden-sand-portal) so a page render gets "here is the gate, use this"
 * instead of "remember the gate". Calibration writes these to outputs/; a later phase
 * can publish + attach them on the production path.
 */

import { generateGPTImage } from '@/lib/generate-image';
import { resolveStyle01GptModel } from '@/lib/style01-gptimage';
import type { CriticalObject } from './types';

export interface ObjectSheetResult {
  objectId: string;
  stateLabel: string;
  buffer: Buffer;
  prompt: string;
  model: string;
}

/** Pure: the prompt used to render one object reference sheet. */
export function buildObjectSheetPrompt(obj: CriticalObject, stateLabel: string): string {
  return [
    'Children’s-book object reference sheet: a SINGLE object, centered, full view, on a plain neutral background.',
    `Object: ${obj.canonicalDescription}.`,
    `State: ${stateLabel}.`,
    `Scale rule: ${obj.scaleLock}.`,
    obj.forbiddenVariants.length ? `Do NOT render it as: ${obj.forbiddenVariants.join('; ')}.` : '',
    'Style: soft hand-drawn watercolor storybook. No text, no people, no companion, no other objects.',
  ]
    .filter(Boolean)
    .join(' ');
}

export async function generateObjectReferenceSheet(
  obj: CriticalObject,
  stateLabel: string,
  quality: 'low' | 'medium' | 'high' = 'low'
): Promise<ObjectSheetResult> {
  const prompt = buildObjectSheetPrompt(obj, stateLabel);
  const res = await generateGPTImage({ finalPrompt: prompt, quality, modelOverride: resolveStyle01GptModel() });
  return { objectId: obj.objectId, stateLabel, buffer: res.buffer, prompt, model: res.model };
}
