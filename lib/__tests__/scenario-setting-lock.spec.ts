import { describe, expect, it } from 'vitest';

import {
  MVP_SETTING_LOCK_CATEGORIES,
  buildScenarioSettingLockBlock,
  readStoryWorldOverrideFromFrontmatter,
  resolveScenarioSettingLock,
} from '../scenario-setting-lock';

describe('scenario setting lock — 6 MVP categories', () => {
  it('maps every MVP category to a non-empty default anchor', () => {
    for (const category of MVP_SETTING_LOCK_CATEGORIES) {
      const lock = resolveScenarioSettingLock(category);
      expect(lock, category).toBeTruthy();
      expect(lock!.length).toBeGreaterThan(40);
    }
  });

  it('storyWorld frontmatter overrides category default', () => {
    const raw = `---
title: test
world: Floating cloud kingdom with rainbow bridges
---
body`;
    const override = readStoryWorldOverrideFromFrontmatter(raw);
    expect(override).toMatch(/cloud kingdom/);
    const lock = resolveScenarioSettingLock('NEW_SIBLING', { storyWorldOverride: override });
    expect(lock).toMatch(/cloud kingdom/);
    expect(lock).not.toMatch(/nursery corner/);
  });

  it('buildScenarioSettingLockBlock injects header', () => {
    const block = buildScenarioSettingLockBlock('NIGHT_FEAR');
    expect(block).toMatch(/SCENARIO SETTING LOCK/);
    expect(block).toMatch(/bedroom at night/);
  });

  it('returns null for unknown categories', () => {
    expect(resolveScenarioSettingLock('NOISE_FEAR')).toBeNull();
    expect(buildScenarioSettingLockBlock(undefined)).toBe('');
  });
});
