import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { getCompanionById } from '../companions';
import { assembleStyle01Phase2Prompt } from '../style01-prompt-assembly';
import { loadStoryFromBank } from '@/backend/providers/story-bank-loader';

const STORY_PATH = path.join(
  process.cwd(),
  'story-bank',
  'v3-approved',
  'chameleon_koko_fantasy.md'
);

async function assembleKokoFantasyPage(pageNumber: number) {
  const companion = getCompanionById('chameleon_koko');
  expect(companion).toBeTruthy();
  const story = await loadStoryFromBank(STORY_PATH, 'נועם', companion!.name, 'boy', {
    maxPages: pageNumber,
    skipLlmPersonalization: true,
  });
  const page = story.pages.find((p) => p.pageNumber === pageNumber);
  expect(page).toBeTruthy();
  return assembleStyle01Phase2Prompt({
    pageNumber,
    pagePrompt: page!.imagePrompt,
    rawScenePrompt: page!.rawScenePrompt,
    bookPageText: page!.text,
    childFirstName: 'נועם',
    childAge: 5,
    childGender: 'boy',
    companion: companion!,
    storyFile: 'chameleon_koko_fantasy',
    direction: 'fantasy',
    storyTimeOfDay: story.storyTimeOfDay,
    challengeCategory: 'TRANSITION',
  });
}

describe('chameleon_koko_fantasy presence prompt contract (0071/J)', () => {
  it('page 2: companion lock present, no FORBIDDEN companion contradiction', async () => {
    const { prompt, entityPresence } = await assembleKokoFantasyPage(2);
    expect(entityPresence.companionPresence).toBe('present');
    expect(prompt).toMatch(/companionPresence:\s*present/i);
    expect(prompt).not.toMatch(/NO companion creature/i);
    expect(prompt).not.toMatch(/FORBIDDEN:.*companion creature/i);
    expect(prompt).toMatch(/COMPANION LOCK:/i);
    expect(prompt).toMatch(/EXACTLY ONE child protagonist/i);
  });

  it('page 5: companion lock present, no present+FORBIDDEN contradiction', async () => {
    const { prompt, entityPresence } = await assembleKokoFantasyPage(5);
    expect(entityPresence.companionPresence).toBe('present');
    expect(prompt).not.toMatch(/NO companion creature/i);
    expect(prompt).not.toMatch(/FORBIDDEN:.*companion creature/i);
    expect(prompt).toMatch(/COMPANION LOCK:/i);
    expect(prompt).toMatch(/EXACTLY ONE child protagonist/i);
    expect(prompt).not.toMatch(/pink dots/i);
  });
});

describe('chameleon_koko live bank name scan (0071/G)', () => {
  const liveFiles = [
    'story-bank/v3-approved/chameleon_koko_bedtime.md',
    'story-bank/v3-approved/chameleon_koko_fantasy.md',
    'story-bank/v5-fixed-v2/chameleon_koko_adventure.md',
  ];

  for (const rel of liveFiles) {
    it(`${rel} uses קים and not קוקו in title+prose`, () => {
      const text = readFileSync(path.join(process.cwd(), rel), 'utf-8');
      const prose = text.split('--- Page')[0] + text.split('--- Page').slice(1).join('');
      expect(prose).toMatch(/קים|קִים|Kim/i);
      expect(prose).not.toMatch(/קוקו/);
    });
  }
});
