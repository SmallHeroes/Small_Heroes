import path from 'path';

import type { PageShot } from '../book-shot-plan/types';
import { resolveGPTImageEditMaxReferences } from '../generate-image';
import type { BookLocationBible, PageLocationPlan, SetTopologyElement } from './types';
import { pageAllowsIsolatedObjectRef } from './zone-sheets';

export function parseSetTopologyElement(raw: unknown): SetTopologyElement | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? '').trim();
  const placement = String(o.placement ?? '').trim();
  if (!id || !placement) return null;
  return {
    id,
    placement,
    wall: o.wall != null ? String(o.wall).trim() : undefined,
    zone: o.zone != null ? String(o.zone).trim() : undefined,
    colorLock: o.colorLock != null ? String(o.colorLock).trim() : undefined,
  };
}

export function parseSetTopology(raw: unknown): BookLocationBible['setTopology'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const elements = (Array.isArray(o.elements) ? o.elements : [])
    .map(parseSetTopologyElement)
    .filter(Boolean) as SetTopologyElement[];
  if (!elements.length) return undefined;
  return {
    elements,
    walls: o.walls != null ? String(o.walls).trim() : undefined,
    floor: o.floor != null ? String(o.floor).trim() : undefined,
    timeOfDay: o.timeOfDay != null ? String(o.timeOfDay).trim() : undefined,
    forbidden: Array.isArray(o.forbidden) ? o.forbidden.map(String).filter(Boolean) : undefined,
  };
}

export function parseSetElementFiles(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const file = String(value ?? '').trim();
    if (key.trim() && file) out[key.trim()] = file;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Renders fixed room geography into the prompt — data-driven, no story branches. */
export function buildSetTopologyLockBlock(bible: BookLocationBible): string | null {
  const topo = bible.setTopology;
  if (!topo?.elements?.length) return null;

  const lines = [
    'SET TOPOLOGY LOCK (same room every page — camera may move, geography may NOT):',
    ...topo.elements.map((el) => {
      const color = el.colorLock ? ` ${el.colorLock}` : '';
      return `- ${el.id}: ${el.placement}.${color}`;
    }),
  ];
  if (topo.walls) lines.push(`- Walls: ${topo.walls}.`);
  if (topo.floor) lines.push(`- Floor: ${topo.floor}.`);
  if (topo.timeOfDay) lines.push(`- Time: ${topo.timeOfDay}.`);
  if (topo.forbidden?.length) {
    lines.push(`- Forbidden additions: ${topo.forbidden.join('; ')}.`);
  }
  lines.push(
    'Do not redesign, recolor, or relocate major furniture. Do not add furniture or props not listed here.'
  );
  return lines.join('\n');
}

export function promptContainsSetTopologyLock(prompt: string): boolean {
  return /SET TOPOLOGY LOCK/i.test(prompt);
}

function isComposedSetMapRef(filePath: string): boolean {
  const base = path.basename(filePath).toLowerCase();
  return base === 'set.png' || /set-map|topology-map/i.test(base);
}

function elementRelevanceScore(elementId: string, haystack: string): number {
  const id = elementId.toLowerCase();
  let score = 0;
  if (id.includes('blanket') && /blanket|fold|thunder|שמיכה/i.test(haystack)) score += 3;
  if (id.includes('pillow') && /pillow|cave|fort|scattered|כרית|מערה/i.test(haystack)) score += 3;
  if (id.includes('bed') && /\bbed\b|מיטה/i.test(haystack)) score += 1;
  if (id.includes('lamp') && /lamp|מנורה/i.test(haystack)) score += 1;
  if (id.includes('rug') && /rug/i.test(haystack)) score += 1;
  return score;
}

function scoreCandidatePath(
  filePath: string,
  setElementFiles: Record<string, string> | undefined,
  haystack: string
): number {
  const base = path.basename(filePath).toLowerCase();
  let best = 0;
  if (setElementFiles) {
    for (const [elementId, file] of Object.entries(setElementFiles)) {
      if (path.basename(file).toLowerCase() === base) {
        best = Math.max(best, elementRelevanceScore(elementId, haystack));
      }
    }
  }
  if (/blanket-fold|blanket.fold/i.test(base)) {
    best = Math.max(best, elementRelevanceScore('blanket-fold', haystack));
  }
  if (/pillow-cave|pillow.cave/i.test(base)) {
    best = Math.max(best, elementRelevanceScore('pillow-cave', haystack));
  }
  return best;
}

export type PageSetElementRefSelection = {
  selected: string[];
  requested: string[];
  dropped: string[];
};

/**
 * General per-page isolated set-element ref picker.
 * Never returns more than maxSlots; never attaches composed set/map images.
 */
export function selectPageSetElementRefs(args: {
  pagePlan: PageLocationPlan | null | undefined;
  pageShot: PageShot | null | undefined;
  candidatePaths: string[];
  setElementFiles?: Record<string, string>;
  maxSlots: number;
  /** When true (future flag), still forbid composed map on close_up in Round 1. */
  allowTopologyMapRef?: boolean;
}): PageSetElementRefSelection {
  const requested = [...new Set(args.candidatePaths.filter(Boolean))];
  if (!args.pagePlan || !pageAllowsIsolatedObjectRef(args.pagePlan) || !requested.length) {
    return { selected: [], requested, dropped: [] };
  }

  const allowComposedMap =
    args.allowTopologyMapRef === true && args.pageShot?.shot !== 'close_up';
  const mapDropped = allowComposedMap
    ? []
    : requested.filter((p) => isComposedSetMapRef(p));
  const eligible = allowComposedMap
    ? requested
    : requested.filter((p) => !isComposedSetMapRef(p));

  const maxSlots = Math.max(0, Math.floor(args.maxSlots));
  if (maxSlots === 0) {
    return { selected: [], requested, dropped: requested };
  }

  const haystack = [
    args.pagePlan.pageAction ?? '',
    args.pagePlan.visibleAnchors.join(' '),
    ...(args.pagePlan.isolatedObjectFiles ?? []),
  ].join(' ');

  const ranked = [...eligible].sort((a, b) => {
    const sb = scoreCandidatePath(b, args.setElementFiles, haystack);
    const sa = scoreCandidatePath(a, args.setElementFiles, haystack);
    if (sb !== sa) return sb - sa;
    return a.localeCompare(b);
  });

  const selected = ranked.slice(0, maxSlots);
  const dropped = [...mapDropped, ...ranked.slice(maxSlots)];
  return { selected, requested, dropped };
}

export function computeMaxSetElementRefSlots(reservedIdentitySlots: number): number {
  const maxRefs = resolveGPTImageEditMaxReferences();
  return Math.max(0, Math.min(2, maxRefs - Math.max(0, reservedIdentitySlots)));
}

export function buildSetRefManifestFields(selection: PageSetElementRefSelection): {
  setRefsRequested: string[];
  setRefsPassed: string[];
  setRefsDropped: string[];
} {
  return {
    setRefsRequested: selection.requested.map((p) => path.basename(p)),
    setRefsPassed: selection.selected.map((p) => path.basename(p)),
    setRefsDropped: selection.dropped.map((p) => path.basename(p)),
  };
}
