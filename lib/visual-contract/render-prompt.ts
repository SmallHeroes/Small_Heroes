/**
 * Contract-driven page prompt for the Phase-1 calibration harness.
 *
 * Deterministic, pure: assembles a Style-01 page prompt straight from a PageContract
 * (action + scene + companion scale + critical-object states + mustNotShow negatives).
 * This is the render-obedience prompt — it encodes exactly what the hard gate will then
 * verify. (The production page-prompt stack stays separate; calibration drives this.)
 */

import type { BookVisualContract, PageContract } from './types';

const SCENE_LABEL: Record<string, string> = {
  bedroom: 'the child’s real-world bedroom',
  fantasy_exterior: 'an outdoor golden-sand fantasy kingdom',
  gate_area: 'an outdoor area in front of a large stone gate',
  return: 'back in the child’s real-world bedroom',
};

export function buildCalibrationPagePrompt(
  contract: BookVisualContract,
  pc: PageContract,
  opts?: { childName?: string }
): string {
  const childName = opts?.childName ?? 'נועם';
  const lines: string[] = [];
  lines.push('Children’s storybook illustration, soft hand-drawn watercolor style. Do NOT render any text or letters in the image.');
  lines.push(`Setting: ${SCENE_LABEL[pc.sceneId] ?? pc.sceneId}.`);
  lines.push(`Central action (must be clearly the focus): ${pc.action}`);
  lines.push(`Emotional tone: ${pc.emotionalBeat.replace(/_/g, ' ')}.`);
  lines.push(`Show exactly ONE child named ${childName} (the protagonist), illustrated — never a photo or photoreal cutout, never duplicated/cloned.`);

  // Hard cast allow-list — gpt-image tends to add an uninvited "default pet" (an armadillo
  // showed up across calibration); name it explicitly and forbid any other creature.
  const cast =
    pc.companion.present && contract.companionLock
      ? `the child and the small ${contract.companionLock.species ?? 'companion'} cub`
      : 'the child only';
  lines.push(
    `The ONLY living characters allowed anywhere in the image — including the background — are: ${cast}. ` +
      `Do NOT add any other animal, pet, armadillo, rodent, or bird; no extra creatures of any kind.`
  );

  if (pc.companion.present && contract.companionLock) {
    const lock = contract.companionLock;
    lines.push(
      `Include the companion ${lock.species ?? lock.companionId} as a SMALL CUB (${lock.characterScaleLock.relativeScale}). ` +
        `The cub must NEVER be adult-sized or giant — small cub on every page.`
    );
  }

  const objectIds = pc.mustShow.filter((m) => m.startsWith('object:')).map((m) => m.slice('object:'.length));
  for (const oid of objectIds) {
    const obj = contract.criticalObjects.find((o) => o.objectId === oid);
    if (!obj) continue;
    const state = obj.stateTimeline.find((s) => s.page === pc.page)?.state;
    lines.push(`Include ${obj.canonicalDescription}${state ? ` — ${state}` : ''}. Scale: ${obj.scaleLock}.`);
  }

  // Non-object storytelling mustShow clauses (e.g. the focused roar-line).
  for (const m of pc.mustShow) {
    if (m.startsWith('object:') || m.startsWith('protagonist:') || m.startsWith('companion:')) continue;
    lines.push(`Must depict: ${m}.`);
  }

  if (pc.mustNotShow.length) lines.push(`Do NOT include: ${pc.mustNotShow.join('; ')}.`);
  return lines.join('\n');
}
