/**
 * Server source-of-truth for order product (direction / pages / price).
 *
 * The order's direction+pages+price must match the story that will actually be
 * served. NEVER guess a product (no silent adventure/medium fallback) — a
 * customer must not see "15 pages / ₪99" and receive a 10-page book.
 *
 * Resolution order:
 *  1. v3-approved binding (ENABLE_V3_APPROVED_BANK=true + companion has an
 *     owner-approved story) — that story's frontmatter direction wins.
 *  2. Client direction validated against the companion's golden in the bank.
 *  3. Legacy product.length mapping (old sessions) — still validated.
 *  Missing/invalid direction with no derivable story → loud 400.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { DIRECTION_PAGE_MAP, displayPagesForBeats } from '../config/wizard';
import {
  isV3ApprovedBankEnabled,
  selectCompanionStory,
  STORY_BANK_V3_DIR_NAME,
  V3_APPROVED_DIR_NAME,
} from './story-bank-index';

export type StoryDirection = 'bedtime' | 'adventure' | 'fantasy';
const DIRECTIONS: StoryDirection[] = ['bedtime', 'adventure', 'fantasy'];

const DIRECTION_TO_STORY_LENGTH: Record<StoryDirection, 'short' | 'medium' | 'long'> = {
  bedtime: 'short',
  adventure: 'medium',
  fantasy: 'long',
};

const LEGACY_LENGTH_TO_DIRECTION: Record<string, StoryDirection> = {
  short: 'bedtime',
  medium: 'adventure',
  long: 'fantasy',
};

export class StoryProductResolutionError extends Error {
  readonly httpStatus: number;
  constructor(message: string, httpStatus: number) {
    super(message);
    this.name = 'StoryProductResolutionError';
    this.httpStatus = httpStatus;
  }
}

export type ResolvedStoryProduct = {
  storyDirection: StoryDirection;
  storyLength: 'short' | 'medium' | 'long';
  /** BEAT count of the actual story that will be served (frontmatter truth).
   *  One beat = one generated image + one text block — drives generation. */
  pages: number;
  /** PHYSICAL page count for customer display ONLY (beats × 2 — each beat is
   *  a printed spread). NEVER feed this into generation. */
  displayPages: number;
  /** Base price — always from DIRECTION_PAGE_MAP (the pricing table). */
  priceILS: number;
  source: 'v3_approved_binding' | 'companion_golden' | 'client_direction' | 'legacy_length';
  storyFile?: string;
};

function normalizeDirection(value: unknown): StoryDirection | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return (DIRECTIONS as string[]).includes(raw) ? (raw as StoryDirection) : null;
}

function readStoryFrontmatter(filePath: string): { direction: StoryDirection | null; pages: number | null } {
  const raw = readFileSync(filePath, 'utf-8');
  const dirMatch = raw.match(/^direction:\s*['"]?(\w+)['"]?\s*$/m);
  const pagesMatch = raw.match(/^pages:\s*['"]?(\d+)['"]?\s*$/m);
  const pages = pagesMatch ? parseInt(pagesMatch[1], 10) : null;
  return {
    direction: normalizeDirection(dirMatch?.[1]),
    pages: Number.isFinite(pages) ? pages : null,
  };
}

function buildResolved(
  direction: StoryDirection,
  source: ResolvedStoryProduct['source'],
  storyFile?: string,
  frontmatterPages?: number | null
): ResolvedStoryProduct {
  const map = DIRECTION_PAGE_MAP[direction];
  if (!map) {
    throw new StoryProductResolutionError(
      `direction "${direction}" missing from DIRECTION_PAGE_MAP`,
      500
    );
  }
  // Story frontmatter is the page-count truth (the serve path renders the
  // file as-is); the table is the expected canonical default.
  const pages = frontmatterPages ?? map.pages;
  // Launch-routing guard: a non-golden/templated story whose beat count
  // deviates from the canonical 8/12/16 must not silently enter launch
  // routing — the displayed package would not match the served book.
  if (frontmatterPages != null && frontmatterPages !== map.pages) {
    console.warn(
      `[story-product-resolver] story ${storyFile ?? '(unknown)'} declares pages=${frontmatterPages} ` +
        `but canonical for ${direction} is ${map.pages} beats (source=${source}) — non-canonical story bound`
    );
  }
  return {
    storyDirection: direction,
    storyLength: DIRECTION_TO_STORY_LENGTH[direction],
    pages,
    displayPages: displayPagesForBeats(pages),
    priceILS: map.priceILS,
    source,
    ...(storyFile ? { storyFile } : {}),
  };
}

/**
 * Resolve the order product from the story that will actually be served.
 * Throws StoryProductResolutionError (400 client / 500 config) — never guesses.
 */
export function resolveStoryProductTruth(input: {
  companionId?: string | null;
  clientDirection?: string | null;
  legacyLength?: string | null;
}): ResolvedStoryProduct {
  const clientDirection = normalizeDirection(input.clientDirection);
  const companionId = typeof input.companionId === 'string' ? input.companionId.trim() : '';

  // ── 1. v3-approved binding — server truth overrides client claims ──
  if (companionId && isV3ApprovedBankEnabled()) {
    const v3ApprovedDir = join(process.cwd(), 'story-bank', V3_APPROVED_DIR_NAME);
    const boundDirections = DIRECTIONS.filter((d) =>
      existsSync(join(v3ApprovedDir, `${companionId}_${d}.md`))
    );
    if (boundDirections.length > 0) {
      const direction =
        clientDirection && boundDirections.includes(clientDirection)
          ? clientDirection
          : boundDirections[0];
      // Respect the serve path's own rules (active companion etc.) — if the
      // selector would not serve this binding, fall through to the normal path.
      const selection = selectCompanionStory(companionId, direction);
      if (selection?.dirName === V3_APPROVED_DIR_NAME) {
        const storyFile = join(v3ApprovedDir, selection.filename);
        const fm = readStoryFrontmatter(storyFile);
        if (fm.direction && fm.direction !== direction) {
          throw new StoryProductResolutionError(
            `v3-approved story ${selection.filename} declares direction=${fm.direction} — misconfigured import`,
            500
          );
        }
        if (fm.pages != null && fm.pages !== DIRECTION_PAGE_MAP[direction].pages) {
          throw new StoryProductResolutionError(
            `v3-approved story ${selection.filename} declares pages=${fm.pages}, expected ${DIRECTION_PAGE_MAP[direction].pages} for ${direction}`,
            500
          );
        }
        return buildResolved(direction, 'v3_approved_binding', storyFile, fm.pages);
      }
    }
  }

  // ── 2./3. Client direction (or legacy length) — must be valid, no guessing ──
  const legacyDirection = clientDirection
    ? null
    : LEGACY_LENGTH_TO_DIRECTION[String(input.legacyLength ?? '').trim()] ?? null;
  const direction = clientDirection ?? legacyDirection;
  if (!direction) {
    throw new StoryProductResolutionError(
      'Missing story direction — wizard must send a valid product.direction (bedtime|adventure|fantasy)',
      400
    );
  }

  if (companionId) {
    const selection = selectCompanionStory(companionId, direction);
    if (selection) {
      const storyFile = join(
        process.cwd(),
        'story-bank',
        selection.dirName ?? STORY_BANK_V3_DIR_NAME,
        selection.filename
      );
      const fm = readStoryFrontmatter(storyFile);
      if (fm.direction && fm.direction !== direction) {
        throw new StoryProductResolutionError(
          `story ${selection.filename} declares direction=${fm.direction} but order requested ${direction}`,
          500
        );
      }
      return buildResolved(direction, 'companion_golden', storyFile, fm.pages);
    }
    // Companion without a golden for this direction → the wizard offered a
    // product we cannot serve. Loud failure, not a silent reroute.
    throw new StoryProductResolutionError(
      `No bank story for companion=${companionId} direction=${direction}`,
      400
    );
  }

  return buildResolved(direction, clientDirection ? 'client_direction' : 'legacy_length');
}
