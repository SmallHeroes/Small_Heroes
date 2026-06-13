import { existsSync, readFileSync } from 'fs';
import path from 'path';

import { resolveGPTImageEditMaxReferences } from '../generate-image';
import { assembleStyle01BookReferences } from '../style01-gptimage';
import type { Style02RefBudgetConfig } from '../style02-gptimage';
import { resolveZoneById } from './compose';
import type {
  BookLocationBible,
  LocationZone,
  PageLocationPlan,
  PageReferenceSheets,
  StoryLocationPlanBundle,
  ZoneSheetManifest,
} from './types';

/** Zones that inherit isolated object sheets from a parent zone. */
export const ZONE_SHEET_ASSET_PARENT: Record<string, string> = {
  bucket_close_area: 'balcony_drip_area',
  balcony_threshold: 'balcony_drip_area',
  bedroom_window_or_bucket_resolution: 'balcony_drip_area',
};

/** @deprecated — scene set refs removed from page generation. */
export const ZONE_OBJECT_REFERENCE_INSTRUCTION = `Use the ZONE/OBJECT reference images for SET LAYOUT, OBJECT IDENTITY, and SCALE ONLY:
same wall/window/railing/floor, same small galvanized bucket (child knee-height), same drip source.
Do NOT copy the reference composition or camera. Compose this page per its own COMPOSITION block.
No characters appear in the reference — characters come from CHILD/COMPANION locks only.`;

export const ISOLATED_OBJECT_REFERENCE_INSTRUCTION = `Use the ISOLATED OBJECT reference image for BUCKET IDENTITY and SCALE ONLY:
same small galvanized metal bucket (dull silver, child knee-height, wire handle — NOT plastic, NOT basin-sized).
Do NOT copy the neutral cream background, sheet layout, or centered product pose from the reference.
Compose THIS page per PAGE ACTION and COMPOSITION — place the bucket only where the page action requires it.
No characters appear in the object reference — characters come from CHILD/COMPANION locks only.`;

export function storyKeyFromStoryFilePath(storyFilePath: string): string {
  return path.basename(storyFilePath, path.extname(storyFilePath));
}

export function resolveApprovedZoneSheetsDir(storyKey: string, zoneId: string): string {
  return path.join(process.cwd(), 'story-bank', 'v3-approved', `${storyKey}.zone-sheets`, zoneId);
}

export function resolveZoneSheetCandidatesDir(storyKey: string, zoneId: string): string {
  return path.join(process.cwd(), 'outputs', 'zone-sheets', storyKey, zoneId, 'candidates');
}

export function parseLocationZoneReferenceSheet(raw: unknown): LocationZone['referenceSheet'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const setFile = o.setFile != null ? String(o.setFile).trim() : undefined;
  const isolatedObjectFile =
    o.isolatedObjectFile != null ? String(o.isolatedObjectFile).trim() : undefined;
  const objectFiles = Array.isArray(o.objectFiles)
    ? o.objectFiles.map(String).filter(Boolean)
    : undefined;
  if (!setFile && !objectFiles?.length && !isolatedObjectFile) return undefined;
  return { setFile, objectFiles, isolatedObjectFile };
}

export function validateZoneSheetManifest(
  manifest: ZoneSheetManifest,
  options?: { requireApproval?: boolean }
): boolean {
  if (!manifest.zoneId?.trim()) return false;
  if (!manifest.generatedAt?.trim()) return false;
  if (options?.requireApproval && !manifest.approvedBy?.trim()) return false;
  const hasObject =
    manifest.files?.isolatedObject?.trim() ||
    manifest.files?.objects?.length ||
    false;
  if (!manifest.files?.set?.trim() && !hasObject) return false;
  return true;
}

export function loadZoneSheetManifest(dir: string): ZoneSheetManifest | null {
  const manifestPath = path.join(dir, 'manifest.json');
  if (!existsSync(manifestPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as ZoneSheetManifest;
    if (!validateZoneSheetManifest(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadApprovedZoneSheetManifest(dir: string): ZoneSheetManifest | null {
  const manifest = loadZoneSheetManifest(dir);
  if (!manifest || !manifest.approvedBy?.trim()) return null;
  return manifest;
}

export function resolveZoneForAssetSheets(
  bible: BookLocationBible,
  zoneId: string
): LocationZone | undefined {
  const zone = resolveZoneById(bible, zoneId);
  if (zone?.referenceSheet) return zone;
  const parentId = ZONE_SHEET_ASSET_PARENT[zoneId];
  if (parentId) return resolveZoneById(bible, parentId);
  return zone;
}

export function pageAllowsIsolatedObjectRef(pagePlan: PageLocationPlan): boolean {
  // Cover mystery — never attach bucket object ref on cover
  if (pagePlan.page === 0) return false;

  const hidden = pagePlan.visualSpoilerPolicy?.hiddenObjects ?? [];
  if (hidden.some((o) => /bucket|drip/i.test(o))) return false;

  if (pagePlan.page >= 5 && pagePlan.page <= 12) return true;

  return false;
}

export function resolveIsolatedObjectFile(
  sheetZone: LocationZone,
  manifest: ZoneSheetManifest
): string {
  return (
    sheetZone.referenceSheet?.isolatedObjectFile ??
    manifest.files.isolatedObject ??
    sheetZone.referenceSheet?.objectFiles?.find((f) => f.includes('object')) ??
    'bucket-object.png'
  );
}

export function resolvePageReferenceSheets(
  bible: BookLocationBible,
  storyKey: string,
  pagePlan: PageLocationPlan
): PageReferenceSheets | undefined {
  const sheetZone = resolveZoneForAssetSheets(bible, pagePlan.zoneId);
  if (!sheetZone?.referenceSheet) return undefined;

  const dir = resolveApprovedZoneSheetsDir(storyKey, sheetZone.id);
  const manifest = loadApprovedZoneSheetManifest(dir);
  if (!manifest) return undefined;

  if (!pageAllowsIsolatedObjectRef(pagePlan)) return undefined;

  const objFile = resolveIsolatedObjectFile(sheetZone, manifest);
  const objPath = path.join(dir, objFile);
  if (!existsSync(objPath)) return undefined;

  return {
    zoneId: sheetZone.id,
    isolatedObjectPaths: [objPath],
  };
}

export function enrichStoryLocationPlanWithReferenceSheets(
  bundle: StoryLocationPlanBundle,
  storyFilePath: string
): StoryLocationPlanBundle {
  const storyKey = storyKeyFromStoryFilePath(storyFilePath);
  return {
    ...bundle,
    pagePlans: bundle.pagePlans.map((plan) => ({
      ...plan,
      referenceSheets: resolvePageReferenceSheets(bundle.bible, storyKey, plan),
    })),
  };
}

export function buildPageActionPromptBlock(
  pagePlan: PageLocationPlan | null | undefined
): string | null {
  const action = pagePlan?.pageAction?.trim();
  if (!action) return null;
  return [
    'PAGE ACTION — MANDATORY (wins over location continuity and generic staging):',
    action,
    'Draw EXACTLY this action. Do NOT default to "child + fox sitting near bucket" unless this action says so.',
  ].join('\n');
}

export function buildVisualSpoilerPromptBlock(
  pagePlan: PageLocationPlan | null | undefined
): string | null {
  const policy = pagePlan?.visualSpoilerPolicy;
  if (!policy) return null;
  const lines = ['VISUAL SPOILER CONTROL:'];
  if (policy.hiddenObjects?.length) {
    lines.push(
      `FORBIDDEN on this page: ${policy.hiddenObjects.join(', ')} — no visible bucket, no clear drip source, no water-catching solution object.`
    );
  }
  if (policy.revealObjects?.length) {
    lines.push(`FIRST REVEAL on this page: ${policy.revealObjects.join(', ')}.`);
  }
  if (policy.note?.trim()) lines.push(policy.note.trim());
  return lines.length > 1 ? lines.join('\n') : null;
}

export function buildIsolatedObjectReferencePromptBlock(
  pagePlan: PageLocationPlan | null | undefined
): string | null {
  if (!pagePlan?.referenceSheets?.isolatedObjectPaths?.length) return null;
  return ISOLATED_OBJECT_REFERENCE_INSTRUCTION;
}

/** @deprecated use buildIsolatedObjectReferencePromptBlock */
export function buildZoneObjectReferencePromptBlock(
  pagePlan: PageLocationPlan | null | undefined
): string | null {
  return buildIsolatedObjectReferencePromptBlock(pagePlan);
}

export function assembleStyle01BookReferencesWithZoneSheets(input: {
  styleRefPaths: string[];
  childPhotoPath?: string;
  companionRefPath?: string;
  companionRefPaths?: string[];
  otherCharacterRefPaths?: string[];
  config: Style02RefBudgetConfig;
  includeChildPhoto: boolean;
  useMultiCompanionSheets?: boolean;
  /** @deprecated scene set refs — never pass for page generation */
  zoneSetRefPath?: string;
  objectAnchorRefPaths?: string[];
  /** Isolated object refs (bucket-object.png) — identity only */
  isolatedObjectRefPaths?: string[];
}): { paths: string[]; breakdown: Record<string, string[]> } {
  const base = assembleStyle01BookReferences(input);
  const objectPaths = (
    input.isolatedObjectRefPaths ??
    input.objectAnchorRefPaths ??
    []
  ).filter(Boolean);

  const breakdown: Record<string, string[]> = {
    ...base.breakdown,
    zoneSet: [],
    objectAnchors: objectPaths,
    isolatedObjects: objectPaths,
  };

  let paths = [
    ...breakdown.child,
    ...breakdown.companion,
    ...breakdown.objectAnchors,
    ...breakdown.otherCharacters,
    ...breakdown.style,
  ];

  const maxRefs = resolveGPTImageEditMaxReferences();
  while (paths.length > maxRefs && breakdown.style.length > 0) {
    breakdown.style.pop();
    paths = [
      ...breakdown.child,
      ...breakdown.companion,
      ...breakdown.objectAnchors,
      ...breakdown.otherCharacters,
      ...breakdown.style,
    ];
  }

  return { paths, breakdown };
}

/** @deprecated — use pageAllowsIsolatedObjectRef */
export function pageNeedsObjectAnchor(pagePlan: PageLocationPlan): boolean {
  return pageAllowsIsolatedObjectRef(pagePlan);
}
