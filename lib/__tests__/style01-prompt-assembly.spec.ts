import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { GOLDEN_SHELF_ALL_ENTRIES, goldenShelfStoryFile } from '../power-cards/golden-shelf-catalog';
import { assembleStyle01Phase2Prompt, assertStyle01PromptInvariants } from '../style01-prompt-assembly';
import { classifyStyle01SceneClass } from '../style01-gptimage';

const STORY_BANK_DIR = path.join(process.cwd(), 'story-bank', 'v5-fixed-v2');

/** Minimal companion stubs — avoid server-only companions.ts in vitest. */
const COMPANION_STUBS: Record<string, { id: string; name: string; image: string }> = {
  dragon_dini: { id: 'dragon_dini', name: 'דיני', image: '/companions/NEW_SIBLING/dragon_dini.jpg' },
  bear_cub_gahal: {
    id: 'bear_cub_gahal',
    name: 'דובי',
    image: '/companions/ANGER_FRUSTRATION/bear_cub_gahal.jpg',
  },
};

type ParsedStoryPage = {
  pageNumber: number;
  text: string;
  imageDirection: string;
};

function parseStoryBankPagesSync(filePath: string): ParsedStoryPage[] {
  const raw = readFileSync(filePath, 'utf-8');
  const pageParts = raw.split(/---\s*Page\s*(\d+)\s*---/).slice(1);
  const pages: ParsedStoryPage[] = [];

  for (let i = 0; i < pageParts.length; i += 2) {
    const pageNumber = parseInt(pageParts[i], 10);
    if (!Number.isFinite(pageNumber)) continue;
    const block = pageParts[i + 1] ?? '';
    const imageDirectionMatch = block.match(/imageDirection:\s*(.+)/);
    const imageDirection = imageDirectionMatch?.[1]?.trim() ?? '';
    const text = block
      .replace(/imageDirection:.*/g, '')
      .replace(/WORD_COUNT:.*/g, '')
      .trim();
    pages.push({ pageNumber, text, imageDirection });
  }

  return pages.sort((a, b) => a.pageNumber - b.pageNumber);
}

function buildShelfPagePrompt(companionId: string, page: ParsedStoryPage): string {
  const companion = COMPANION_STUBS[companionId] ?? {
    id: companionId,
    name: companionId,
    image: '',
  };
  return assembleStyle01Phase2Prompt({
    pageNumber: page.pageNumber,
    rawScenePrompt: page.imageDirection,
    bookPageText: page.text,
    companion: {
      id: companion.id,
      name: companion.name,
      image: companion.image,
    },
  }).prompt;
}

const diniPages = parseStoryBankPagesSync(
  path.join(STORY_BANK_DIR, 'dragon_dini_fantasy.md')
).slice(0, 5);

const dobiPages = parseStoryBankPagesSync(
  path.join(STORY_BANK_DIR, 'bear_cub_gahal_adventure.md')
).slice(0, 5);

describe('Style 01 prompt assembly', () => {
  it('includes FRAMING RULE — BREATHE in every Dini page prompt', () => {
    for (const page of diniPages) {
      const prompt = buildShelfPagePrompt('dragon_dini', page);
      expect(prompt).toContain('FRAMING RULE — BREATHE');
    }
  });

  it('includes SUBJECT SCALE line in every Dini page prompt', () => {
    for (const page of diniPages) {
      const prompt = buildShelfPagePrompt('dragon_dini', page);
      expect(prompt).toMatch(/SUBJECT SCALE:\s*(small|medium|large)/);
    }
  });

  it('preserves first 50 chars of imageDirection (no then-truncation) on Dobi page 5', () => {
    const page5 = dobiPages.find((p) => p.pageNumber === 5);
    expect(page5).toBeDefined();
    const prompt = buildShelfPagePrompt('bear_cub_gahal', page5!);
    assertStyle01PromptInvariants(prompt, page5!.imageDirection, 5);
    expect(prompt).toContain('Dobi gently nudges the child');
    expect(prompt).not.toMatch(/^turns toward a deeper forest path/m);
  });

  it('only includes BLUE-SPECKLED EGG lock when egg is in presentEntities', () => {
    for (const page of diniPages) {
      const prompt = buildShelfPagePrompt('dragon_dini', page);
      if (page.pageNumber <= 2) {
        expect(prompt).not.toContain('BLUE-SPECKLED EGG');
      }
      if (page.pageNumber === 3) {
        expect(prompt).toContain('BLUE-SPECKLED EGG');
        expect(prompt).toContain('(INTACT)');
      }
      if (page.pageNumber === 4) {
        expect(prompt).toContain('BLUE-SPECKLED EGG');
        expect(prompt).toContain('(CRACKING)');
        expect(prompt).toContain('BABY DRAGON');
        expect(prompt).toContain('(EMERGING)');
        expect(prompt).not.toContain('(INTACT):');
      }
      if (page.pageNumber === 5) {
        expect(prompt).toContain('(FRAGMENTS)');
        expect(prompt).toContain('BABY DRAGON');
        expect(prompt).toContain('(PRESENT)');
      }
    }
  });

  it('does not classify Dobi forest pages as cozy-interior', () => {
    for (const page of dobiPages) {
      const sceneClass = classifyStyle01SceneClass({
        rawScenePrompt: page.imageDirection,
        bookPageText: page.text,
      });
      expect(sceneClass).not.toBe('cozy-interior');
      if (/forest|woods|trees|outdoor|meadow|clearing|path/i.test(page.imageDirection)) {
        expect(sceneClass).toMatch(/forest|outdoor/);
      }
    }
  });

  it('preserves imageDirection prefix for all golden-shelf story pages', () => {
    const failures: string[] = [];

    for (const entry of GOLDEN_SHELF_ALL_ENTRIES) {
      const filePath = path.join(STORY_BANK_DIR, goldenShelfStoryFile(entry.slug));
      const pages = parseStoryBankPagesSync(filePath);
      for (const page of pages) {
        if (!page.imageDirection || page.imageDirection.length < 10) continue;
        try {
          const prompt = buildShelfPagePrompt(entry.companionId, page);
          assertStyle01PromptInvariants(prompt, page.imageDirection, page.pageNumber);
        } catch (err) {
          failures.push(
            `${entry.slug} page ${page.pageNumber}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }

    expect(failures, failures.join('\n')).toEqual([]);
  });
});
