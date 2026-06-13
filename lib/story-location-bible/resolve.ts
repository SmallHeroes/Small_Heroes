import fs from 'fs';

import { readStoryWorldOverrideFromFrontmatter } from '../scenario-setting-lock';
import type { PageBeatInput } from '../book-shot-plan/types';
import { deriveBookLocationBible, derivePageLocationPlans } from './derive';
import {
  enrichStoryLocationPlanWithReferenceSheets,
  parseLocationZoneReferenceSheet,
} from './zone-sheets';
import type {
  BookLocationBible,
  FixedAnchor,
  LocationZone,
  PageLocationPlan,
  StoryLocationPlanBundle,
} from './types';

function parseZone(raw: unknown): LocationZone | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? '').trim();
  const description = String(o.description ?? '').trim();
  if (!id || !description) return null;
  return {
    id,
    description,
    stableGeometry: Array.isArray(o.stableGeometry)
      ? o.stableGeometry.map(String)
      : [],
    visualAnchors: Array.isArray(o.visualAnchors) ? o.visualAnchors.map(String) : [],
    allowedCameraAccess: Array.isArray(o.allowedCameraAccess)
      ? o.allowedCameraAccess.map(String)
      : [],
    referenceSheet: parseLocationZoneReferenceSheet(o.referenceSheet),
  };
}

function parseFixedAnchor(raw: unknown): FixedAnchor | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? '').trim();
  const label = String(o.label ?? '').trim();
  const description = String(o.description ?? '').trim();
  if (!id || !label || !description) return null;
  return {
    id,
    label,
    description,
    mustRemainSameAcrossPages: o.mustRemainSameAcrossPages !== false,
  };
}

function parsePagePlan(raw: unknown): PageLocationPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const page = Number(o.page);
  const zoneId = String(o.zoneId ?? '').trim();
  if (!Number.isFinite(page) || page < 0 || !zoneId) return null;
  return {
    page,
    zoneId,
    visibleAnchors: Array.isArray(o.visibleAnchors) ? o.visibleAnchors.map(String) : [],
    cameraPositionHint: o.cameraPositionHint ? String(o.cameraPositionHint) : undefined,
    allowedVariation:
      String(o.allowedVariation ?? '').trim() ||
      'Camera may move closer/wider per PageShot; spatial relationships remain stable.',
    forbiddenDrift: Array.isArray(o.forbiddenDrift) ? o.forbiddenDrift.map(String) : [],
    pageAction: o.pageAction ? String(o.pageAction).trim() : undefined,
    expectedBucketVisibility: o.expectedBucketVisibility
      ? (String(o.expectedBucketVisibility).trim() as PageLocationPlan['expectedBucketVisibility'])
      : undefined,
    visualSpoilerPolicy:
      o.visualSpoilerPolicy && typeof o.visualSpoilerPolicy === 'object'
        ? {
            hiddenObjects: Array.isArray((o.visualSpoilerPolicy as Record<string, unknown>).hiddenObjects)
              ? ((o.visualSpoilerPolicy as Record<string, unknown>).hiddenObjects as unknown[]).map(String)
              : undefined,
            revealObjects: Array.isArray((o.visualSpoilerPolicy as Record<string, unknown>).revealObjects)
              ? ((o.visualSpoilerPolicy as Record<string, unknown>).revealObjects as unknown[]).map(String)
              : undefined,
            note:
              typeof (o.visualSpoilerPolicy as Record<string, unknown>).note === 'string'
                ? String((o.visualSpoilerPolicy as Record<string, unknown>).note)
                : undefined,
          }
        : undefined,
  };
}

function parseBookLocationBible(raw: Record<string, unknown>, source: BookLocationBible['source']): BookLocationBible | null {
  const primarySetting = String(raw.primarySetting ?? '').trim();
  const continuityMode = String(raw.continuityMode ?? '').trim();
  if (!primarySetting || !continuityMode) return null;
  const allowedZones = (Array.isArray(raw.allowedZones) ? raw.allowedZones : [])
    .map(parseZone)
    .filter(Boolean) as LocationZone[];
  if (!allowedZones.length) return null;

  return {
    continuityMode: continuityMode as BookLocationBible['continuityMode'],
    primarySetting,
    allowedZones,
    fixedAnchors: (Array.isArray(raw.fixedAnchors) ? raw.fixedAnchors : [])
      .map(parseFixedAnchor)
      .filter(Boolean) as FixedAnchor[],
    forbiddenDrift: Array.isArray(raw.forbiddenDrift) ? raw.forbiddenDrift.map(String) : [],
    transitionRules: Array.isArray(raw.transitionRules) ? raw.transitionRules.map(String) : [],
    source,
    pageCount: Number.isFinite(Number(raw.pageCount)) ? Number(raw.pageCount) : undefined,
  };
}

/** Sidecar `<story>.location-bible.json` or frontmatter `locationBible:` JSON. */
export function loadStoryLocationPlanOverride(
  storyFilePath: string,
  rawMarkdown?: string
): StoryLocationPlanBundle | null {
  const sidecar = storyFilePath.replace(/\.md$/i, '.location-bible.json');
  if (fs.existsSync(sidecar)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(sidecar, 'utf8')) as Record<string, unknown>;
      const bible = parseBookLocationBible(parsed, 'sidecar');
      const pagePlans = (Array.isArray(parsed.pagePlans) ? parsed.pagePlans : [])
        .map(parsePagePlan)
        .filter(Boolean) as PageLocationPlan[];
      if (bible && pagePlans.length) {
        return { bible, pagePlans: pagePlans.sort((a, b) => a.page - b.page) };
      }
    } catch {
      /* fall through */
    }
  }

  const md = rawMarkdown ?? (fs.existsSync(storyFilePath) ? fs.readFileSync(storyFilePath, 'utf8') : '');
  const fmMatch = md.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;
  const planLine = fmMatch[1].match(/^locationBible:\s*(\{[\s\S]*\})\s*$/m);
  if (!planLine) return null;
  try {
    const parsed = JSON.parse(planLine[1]) as Record<string, unknown>;
    const bible = parseBookLocationBible(parsed, 'frontmatter');
    const pagePlans = (Array.isArray(parsed.pagePlans) ? parsed.pagePlans : [])
      .map(parsePagePlan)
      .filter(Boolean) as PageLocationPlan[];
    if (bible && pagePlans.length) return { bible, pagePlans };
  } catch {
    return null;
  }
  return null;
}

export function resolveStoryLocationPlan(args: {
  storyFilePath?: string;
  rawMarkdown?: string;
  challengeCategory: string | null | undefined;
  direction?: string | null;
  pages: PageBeatInput[];
}): StoryLocationPlanBundle {
  const override =
    args.storyFilePath != null
      ? loadStoryLocationPlanOverride(args.storyFilePath, args.rawMarkdown)
      : null;

  if (override) {
    const bundle = {
      bible: { ...override.bible, source: override.bible.source === 'derived' ? 'v3_artifact' : override.bible.source },
      pagePlans: override.pagePlans,
    };
    return args.storyFilePath
      ? enrichStoryLocationPlanWithReferenceSheets(bundle, args.storyFilePath)
      : bundle;
  }

  const storyWorldOverride = args.rawMarkdown
    ? readStoryWorldOverrideFromFrontmatter(args.rawMarkdown)
    : args.storyFilePath && fs.existsSync(args.storyFilePath)
      ? readStoryWorldOverrideFromFrontmatter(fs.readFileSync(args.storyFilePath, 'utf8'))
      : null;

  const derived = deriveBookLocationBible({
    challengeCategory: args.challengeCategory,
    storyWorldOverride,
    direction: args.direction,
    pages: args.pages,
  });

  return {
    bible: { ...derived, source: 'derived' },
    pagePlans: derivePageLocationPlans(derived, args.pages),
  };
}

export function resolvePageLocationPlan(
  bundle: StoryLocationPlanBundle,
  pageNumber: number
): PageLocationPlan | null {
  const direct = bundle.pagePlans.find((p) => p.page === pageNumber);
  if (direct) return direct;
  if (pageNumber === 0) {
    const p1 = bundle.pagePlans.find((p) => p.page === 1);
    if (!p1) return null;
    return {
      ...p1,
      page: 0,
      visibleAnchors: [
        ...p1.visibleAnchors,
        'story promise: child + companion + key home-night anchors',
      ],
    };
  }
  return null;
}

export function isStoryLocationPlanValid(bundle: StoryLocationPlanBundle): boolean {
  if (!bundle.bible.primarySetting.trim()) return false;
  if (!bundle.bible.allowedZones.length) return false;
  if (!bundle.pagePlans.length) return false;
  for (const plan of bundle.pagePlans) {
    if (!bundle.bible.allowedZones.some((z) => z.id === plan.zoneId)) return false;
  }
  return true;
}

export function formatLocationPlanTable(bundle: StoryLocationPlanBundle): string {
  const lines = [
    '| page | zoneId | visibleAnchors |',
    '|---:|---|---|',
    ...bundle.pagePlans.map(
      (p) =>
        `| ${p.page} | ${p.zoneId} | ${p.visibleAnchors.join('; ').replace(/\|/g, '/')} |`
    ),
  ];
  return lines.join('\n');
}
