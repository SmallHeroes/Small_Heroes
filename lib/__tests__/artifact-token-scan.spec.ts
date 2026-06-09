import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import {
  scanRawArtifactTokensInMarkdown,
  scanSlashChipsInMarkdown,
} from '../story-gen-v3/artifact-token-scan';
import { scanSuffixChipsInMarkdown } from '../story-gen-v3/suffix-chip-scan';
import { runDeterministicDiagnosis } from '../story-gen-v3/hebrew-read-aloud-editor';
import { runStoryAliveGate } from '../story-gen-v3/story-alive-gate';
import { scanChipSafety } from '../story-gen/chip-safety';

const BROKEN_KOKO = path.join(
  process.cwd(),
  'lib/story-gen-v3/__fixtures__/koko-broken-artifact-tokens.md'
);

describe('artifact token scan', () => {
  it('detects [koko_*] tokens in canonical broken story', () => {
    const md = readFileSync(BROKEN_KOKO, 'utf8');
    const scan = scanRawArtifactTokensInMarkdown(md);
    expect(scan.pass).toBe(false);
    expect(scan.tokens).toContain('[koko_striped_wall_only]');
    expect(scan.tokens).toContain('[koko_panic_orange_calm_words]');
  });

  it('StoryAlive FAIL on broken artifact tokens', () => {
    const md = readFileSync(BROKEN_KOKO, 'utf8');
    const alive = runStoryAliveGate({
      storyMarkdown: md,
      beats: [],
      chipSafety: scanChipSafety(md),
      companionId: 'chameleon_koko',
      endingProfile: 'koko_transition',
    });
    expect(alive.verdict).toBe('FAIL');
    expect(alive.hardFails.some((f) => f.includes('raw artifact tokens'))).toBe(true);
  });

  it('HebrewReadAloud deterministic diagnosis FAIL on raw tokens', () => {
    const md = readFileSync(BROKEN_KOKO, 'utf8');
    const issues = runDeterministicDiagnosis(md, []);
    expect(issues.some((i) => i.issueType === 'raw_artifact_token_in_prose')).toBe(true);
    expect(issues.some((i) => i.actionMode === 'FAIL')).toBe(true);
  });

  it('detects slash chips in broken story', () => {
    const md = readFileSync(BROKEN_KOKO, 'utf8');
    const scan = scanSlashChipsInMarkdown(md);
    expect(scan.slashChipStylePass).toBe(false);
    expect(scan.slashChipCount).toBeGreaterThan(0);
  });

  it('FAILs suffix chips but ALLOWs full pipe chips and {{childName}}', () => {
    const broken = `--- Page 1 ---
{{childName}} נוגע{ת} בשלולית.
--- Page 2 ---
{פתח|פתחה} את הדלת.
`;
    const scan = scanSuffixChipsInMarkdown(broken);
    expect(scan.suffixChipPass).toBe(false);
    expect(scan.hits.some((h) => h.match === 'נוגע{ת}')).toBe(true);
    expect(scan.hits.some((h) => h.match.includes('פתח'))).toBe(false);
  });
});
