import type { PageShot } from '../book-shot-plan/types';
import { buildSetTopologyLockBlock } from './set-topology';
import { buildSceneMemoryLockBlock } from '../scene-memory/compose';
import type { SceneMemory } from '../scene-memory/types';
import { buildSetAppearanceLockBlock } from '../set-appearance/compose';
import type { SceneAppearanceMemory } from '../set-appearance/types';
import { buildStagingLockBlock } from './staging-lock';
import type { BookLocationBible, PageLocationPlan } from './types';

export function resolveZoneById(bible: BookLocationBible, zoneId: string) {
  return bible.allowedZones.find((z) => z.id === zoneId);
}

function pageUsesBucketAnchors(pagePlan: PageLocationPlan): boolean {
  return (
    pagePlan.zoneId === 'bucket_close_area' ||
    pagePlan.zoneId === 'balcony_drip_area' ||
    pagePlan.visibleAnchors.some((a) => /bucket/i.test(a))
  );
}

export const WINDOW_LEDGE_DRIP_LOCK =
  'Water drips from the same stone/plaster WINDOW LEDGE directly above the bucket — a slow gentle drip from the ledge edge. NEVER a downspout, gutter, drainpipe, faucet, wall pipe, roof pipe, or tap.';

export const COVER_MYSTERY_LOCK =
  'Cover takes place inside the child\'s room near the night window. It suggests a mysterious sound outside but does NOT reveal the bucket or drip source. NO bucket. NO drip. NO falling water. NO water-catching object.';

/** Story-level + page-level location block — replaces SCENARIO SETTING LOCK when present. */
export function buildLocationContinuityPromptBlock(
  bible: BookLocationBible,
  pagePlan: PageLocationPlan,
  options?: {
    pageShot?: PageShot | null;
    isCover?: boolean;
    sceneMemory?: SceneMemory | null;
    sceneAppearance?: SceneAppearanceMemory | null;
    imageDirection?: string;
  }
): string {
  const zone = resolveZoneById(bible, pagePlan.zoneId);
  const shotNote = options?.pageShot
    ? shotIntegrationNote(options.pageShot)
    : 'Camera may move according to PageShot. Do not change to unrelated location.';

  const lines = [
    'BOOK LOCATION CONTINUITY:',
    'This book uses one coherent physical set. Camera angles may change, but fixed spaces and objects must not redesign between pages.',
    'Same physical set across pages. Do not redesign the location set. Camera may move according to PageShot. Do not change to unrelated location.',
    '',
    `STORY WORLD: ${bible.primarySetting.trim()}`,
    '',
    'PAGE LOCATION:',
    `zone: ${pagePlan.zoneId}`,
    zone?.description ? `zone description: ${zone.description}` : '',
    `visible anchors: ${pagePlan.visibleAnchors.join(', ')}`,
    pagePlan.cameraPositionHint ? `camera position hint: ${pagePlan.cameraPositionHint}` : '',
    `allowed variation: ${pagePlan.allowedVariation}`,
    `forbidden drift: ${[...new Set([...pagePlan.forbiddenDrift, ...bible.forbiddenDrift])].join(', ')}`,
    '',
    shotNote,
  ];

  if (options?.isCover) {
    lines.push('', 'COVER:', COVER_MYSTERY_LOCK);
  }

  if (pageUsesBucketAnchors(pagePlan)) {
    lines.push('', 'DRIP SOURCE (canonical):', WINDOW_LEDGE_DRIP_LOCK);
  }

  const topologyBlock = buildSetTopologyLockBlock(bible);
  if (topologyBlock) {
    lines.push('', topologyBlock);
  }

  const sceneMemoryBlock = buildSceneMemoryLockBlock(options?.sceneMemory, {
    pageShot: options?.pageShot,
    pageNumber: pagePlan.page,
  });
  if (sceneMemoryBlock) {
    lines.push('', sceneMemoryBlock);
  }

  const appearanceBlock = buildSetAppearanceLockBlock(options?.sceneAppearance, {
    pageShot: options?.pageShot,
    pageNumber: pagePlan.page,
  });
  if (appearanceBlock) {
    lines.push('', appearanceBlock);
  }

  const stagingBlock = buildStagingLockBlock(pagePlan, options?.imageDirection);
  if (stagingBlock) {
    lines.push('', stagingBlock);
  }

  if (bible.transitionRules.length) {
    lines.push('', 'TRANSITION RULES:', ...bible.transitionRules.map((r) => `- ${r}`));
  }

  if (pageUsesBucketAnchors(pagePlan)) {
    lines.push(
      '',
      'FIXED OBJECT SCALE:',
      'The bucket is a small galvanized metal bucket, roughly child knee-height — never oversized, never basin-sized, never taller than Uri.'
    );
  }

  return lines.filter(Boolean).join('\n');
}

function shotIntegrationNote(shot: PageShot): string {
  switch (shot.shot) {
    case 'establishing_wide':
    case 'medium_wide':
      return 'PageShot is wide — show MORE of the same location set; do not swap to a new environment.';
    case 'close_up':
      return 'PageShot is close-up — show FEWER anchors, but visible anchors must still be correct. Do not introduce props or furniture not listed in SET TOPOLOGY LOCK. Do not swap to a new room.';
    case 'dynamic_angle':
      return 'PageShot is dynamic — move the camera, not the scene. Same physical set; new angle only.';
    case 'intimate':
      return 'PageShot is intimate — keep enough fixed anchors visible to preserve continuity with prior pages.';
    default:
      return 'PageShot controls framing only — keep the same physical world.';
  }
}

export function formatPageLocationManifestLine(args: {
  page: number;
  shot?: string;
  angle?: string;
  pagePlan: PageLocationPlan;
  source: BookLocationBible['source'];
}): string {
  const { page, shot, angle, pagePlan, source } = args;
  return (
    `p${page} — shot: ${shot ?? '-'} · angle: ${angle ?? 'eye'} · ` +
    `locationZone: ${pagePlan.zoneId} · ` +
    `visibleAnchors: ${pagePlan.visibleAnchors.join(', ')} · ` +
    `forbiddenDrift: ${pagePlan.forbiddenDrift.slice(0, 6).join(', ')} · ` +
    `location source: ${source}`
  );
}
