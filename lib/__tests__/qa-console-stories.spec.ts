import { describe, expect, it } from 'vitest';

import { listQaStoryBankEntries, parseStoryKey, storyPathForKey } from '../qa-console-stories';

describe('listQaStoryBankEntries', () => {
  it('includes v3-approved owner slots and v5 stories with distinct keys', async () => {
    const entries = await listQaStoryBankEntries();
    expect(entries.length).toBeGreaterThan(0);

    const foxV3 = entries.find((e) => e.storyKey === 'fox_uri_adventure@v3-approved');
    expect(foxV3).toBeDefined();
    expect(foxV3?.bankDir).toBe('v3-approved');
    expect(foxV3?.source).toBe('v3-approved');

    const foxV5 = entries.find((e) => e.storyKey === 'fox_uri_adventure' && e.source === 'v5');
    expect(foxV5).toBeDefined();

    const bunnyV3 = entries.find((e) => e.storyKey === 'bunny_ometz_bedtime@v3-approved');
    expect(bunnyV3).toBeDefined();
  });

  it('storyPathForKey resolves v3-approved directory', () => {
    const { bankDir } = parseStoryKey('fox_uri_adventure@v3-approved');
    expect(bankDir).toBe('v3-approved');
    expect(storyPathForKey('fox_uri_adventure@v3-approved')).toMatch(/story-bank[/\\]v3-approved[/\\]fox_uri_adventure\.md$/);
  });
});
