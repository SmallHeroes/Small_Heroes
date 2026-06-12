import fs from 'fs';
import path from 'path';
import { deriveBookShotPlan } from './derive';
import { validateBookShotPlan } from './validate';
import type { BookShotPlan, PageBeatInput, PageShot, ShotType } from './types';
import { SHOT_TYPES } from './types';

export class BookShotPlanError extends Error {
  readonly issues: string[];
  constructor(message: string, issues: string[] = []) {
    super(message);
    this.name = 'BookShotPlanError';
    this.issues = issues;
  }
}

function parsePageShot(raw: unknown): PageShot | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const page = Number(o.page);
  const shot = String(o.shot ?? '') as ShotType;
  if (!Number.isFinite(page) || page < 1 || !SHOT_TYPES.includes(shot)) return null;
  const rationale = String(o.rationale ?? '').trim();
  if (!rationale) return null;
  const angle =
    o.angle === 'low' || o.angle === 'high' || o.angle === 'eye' || o.angle === 'over_shoulder'
      ? o.angle
      : undefined;
  return { page, shot, rationale, ...(angle ? { angle } : {}) };
}

/** Optional override: frontmatter `bookShotPlan` JSON or sidecar `<story>.shot-plan.json`. */
export function loadBookShotPlanOverride(
  storyFilePath: string,
  rawMarkdown?: string
): BookShotPlan | null {
  const sidecar = storyFilePath.replace(/\.md$/i, '.shot-plan.json');
  if (fs.existsSync(sidecar)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(sidecar, 'utf8')) as BookShotPlan;
      if (parsed?.pages?.length) {
        return { ...parsed, source: 'override', pageCount: parsed.pageCount ?? parsed.pages.length };
      }
    } catch {
      /* fall through */
    }
  }

  const md = rawMarkdown ?? (fs.existsSync(storyFilePath) ? fs.readFileSync(storyFilePath, 'utf8') : '');
  const fmMatch = md.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;
  const planLine = fmMatch[1].match(/^bookShotPlan:\s*(\{[\s\S]*\})\s*$/m);
  if (!planLine) return null;
  try {
    const parsed = JSON.parse(planLine[1]) as { pages?: unknown[]; pageCount?: number };
    const pages = (parsed.pages ?? []).map(parsePageShot).filter(Boolean) as PageShot[];
    if (!pages.length) return null;
    return {
      pageCount: parsed.pageCount ?? pages.length,
      source: 'override',
      pages: pages.sort((a, b) => a.page - b.page),
    };
  } catch {
    return null;
  }
}

export function beatsFromStoryPages(
  pages: Array<{ pageNumber: number; text: string; imagePrompt?: string; rawScenePrompt?: string }>
): PageBeatInput[] {
  return pages.map((p) => ({
    page: p.pageNumber,
    imageDirection: (p.rawScenePrompt ?? p.imagePrompt ?? '').trim(),
    bookPageText: p.text ?? '',
  }));
}

/**
 * Resolve shot plan: override wins, else deterministic derivation.
 * Dev: throws on invalid plan. Prod: logs and re-derives.
 */
export function resolveBookShotPlan(args: {
  storyFilePath?: string;
  rawMarkdown?: string;
  pages: PageBeatInput[];
}): BookShotPlan {
  const override =
    args.storyFilePath != null
      ? loadBookShotPlanOverride(args.storyFilePath, args.rawMarkdown)
      : null;

  const plan = override ?? deriveBookShotPlan(args.pages);
  const issues = validateBookShotPlan(plan).map((i) => `${i.rule}: ${i.message}`);

  if (issues.length === 0) return plan;

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    console.warn('[book-shot-plan] invalid plan — re-deriving', { issues, source: plan.source });
    const repaired = deriveBookShotPlan(args.pages);
    const repairIssues = validateBookShotPlan(repaired).map((i) => `${i.rule}: ${i.message}`);
    if (repairIssues.length) {
      console.error('[book-shot-plan] repaired plan still invalid', repairIssues);
    }
    return repaired;
  }

  throw new BookShotPlanError(`BookShotPlan contract failed for ${args.storyFilePath ?? 'story'}`, issues);
}

export function formatBookShotPlanTable(plan: BookShotPlan): string {
  const lines = [
    '| page | shot | angle | rationale |',
    '|---:|---|---|---|',
    ...plan.pages.map(
      (p) => `| ${p.page} | ${p.shot} | ${p.angle ?? 'eye'} | ${p.rationale.replace(/\|/g, '/')} |`
    ),
  ];
  return lines.join('\n');
}
