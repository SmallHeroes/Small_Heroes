import { readFileSync } from 'fs';
import { createHash } from 'node:crypto';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { runDeterministicDiagnosis } from '../story-gen-v3/hebrew-read-aloud-editor';
import { scanChildLexiconInMarkdown } from '../story-gen-v3/child-lexicon-scan';
import fixtureProvenance from './fixtures/residual-gate/provenance.json';

const SLOT01_STORY = path.join(
  process.cwd(),
  'lib/__tests__/fixtures/residual-gate/lexicon/story.md'
);

describe('child lexicon ages 5–8 gate', () => {
  it('preserves all 14 historical regression fixture byte identities without reading provenance locations', () => {
    expect(fixtureProvenance.files).toHaveLength(14);
    for (const file of fixtureProvenance.files) {
      const bytes = readFileSync(path.join(process.cwd(), 'lib/__tests__/fixtures/residual-gate', file.path));
      expect(bytes.length, file.path).toBe(file.bytes);
      expect(createHash('sha256').update(bytes).digest('hex'), file.path).toBe(file.sha256);
    }
  });

  it('flags blocked adult words in prose', () => {
    const bad = `--- Page 1 ---
{{childName}} חייך. "זה דואט רשמי," אמר אוּרי. פנסו נדלק.
`;
    const scan = scanChildLexiconInMarkdown(bad);
    expect(scan.pass).toBe(false);
    expect(scan.hits.some((h) => h.match.includes('דואט'))).toBe(true);
    expect(scan.hits.some((h) => h.ruleId === 'literary_possessive_panso')).toBe(true);

    const issues = runDeterministicDiagnosis(bad, []);
    expect(issues.some((i) => i.issueType === 'adult_or_technical_wording')).toBe(true);
    expect(issues.some((i) => i.actionMode === 'FAIL' && i.exactLine.includes('דואט'))).toBe(
      true
    );
  });

  it('flags ספוט, גורלי, and קונצרט patterns', () => {
    const samples = [
      '--- Page 2 ---\nמחזיק את הפנס כמו ספוט על במה.\n',
      '--- Page 3 ---\n"זהו רגע גורלי!"\n',
      '--- Page 4 ---\n"זה קונצרט גשם פרטי,"\n',
    ];
    for (const md of samples) {
      expect(scanChildLexiconInMarkdown(md).pass).toBe(false);
    }
  });

  it('slot #1 revised story passes child lexicon scan', () => {
    const md = readFileSync(SLOT01_STORY, 'utf8');
    const scan = scanChildLexiconInMarkdown(md);
    expect(scan.pass, JSON.stringify(scan.hits, null, 2)).toBe(true);

    const issues = runDeterministicDiagnosis(md, []);
    const lexiconFails = issues.filter(
      (i) => i.issueType === 'adult_or_technical_wording' && i.actionMode === 'FAIL'
    );
    expect(lexiconFails).toEqual([]);
  });
});
