import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';
import {
  classifyLexicalHits,
  summarizeLexicalFindings,
} from '../story-gen/hebrew-lexical-classify';
import { runDeterministicLexicalBackstop } from '../story-gen/hebrew-lexical-backstop';

function runLexical(markdown: string) {
  const raw = runDeterministicLexicalBackstop(markdown);
  const findings = classifyLexicalHits(raw, markdown);
  return summarizeLexicalFindings(findings);
}

const VALID_FORMS_SNIPPET = `---
companionId: dragon_dini
---
--- Page 6 ---
הדרקונית מהנהנת, הקש בקן מתפזר מנשימתה.
טוּבִּי מהנהן באיטיות.

--- Page 7 ---
והזנב מצטמצם שוב בלי כוונה.
הגוף מצטמצמת מול הרוח.

WORD_COUNT: [4, 4] = 8`;

const TRUNCATED_DEFECTS_SNIPPET = `---
companionId: bolly_armadillo
---
--- Page 2 ---
{{childName}} מצטמצ, הָאֶצְבָּעוֹת מְחַזִּיקוֹת.

--- Page 8 ---
טוּבִּי מַהְנֵה באיטיות.

--- Page 10 ---
בּוֹלִי מִצְטָץ.

--- Page 3 ---
בּוֹלִי מַצְמִיץ אֹף קָטָן.

WORD_COUNT: [1, 1, 1, 1] = 4`;

const DINI_F1_STEP5_PATH = path.join(
  process.cwd(),
  'outputs/story-gen-runs/step5-dini-f1-2026-06-08T18-04-12-529Z/story.md'
);

describe('anchored broken-form lexical patterns', () => {
  it('does NOT BLOCKER valid מהנהנת / מהנהן / מצטמצם / מצטמצמת', () => {
    const { blockers, reviews } = runLexical(VALID_FORMS_SNIPPET);
    expect(blockers).toHaveLength(0);
    expect(reviews.filter((r) => /מהנה|מצטמצ/.test(r.original))).toHaveLength(0);
  });

  it('still BLOCKERs truncated מצטמצ and malformed מַהְנֵה and B2 nonce family', () => {
    const { blockers } = runLexical(TRUNCATED_DEFECTS_SNIPPET);
    expect(blockers.length).toBeGreaterThanOrEqual(4);
    const blob = blockers.map((b) => b.original + b.issue).join(' ');
    expect(blob).toMatch(/מצטמצ|truncated|מתכווץ/);
    expect(blob).toMatch(/מהנה|מַהְנֵה/);
    expect(blob).toMatch(/מצטץ|מציץ/);
    expect(blob).toMatch(/מצמיץ|מציץ/);
  });

  it('re-runs Step 5 Dini artifact with zero deterministic BLOCKERs when present on disk', () => {
    if (!fs.existsSync(DINI_F1_STEP5_PATH)) {
      return;
    }
    const markdown = fs.readFileSync(DINI_F1_STEP5_PATH, 'utf8');
    const { blockers } = runLexical(markdown);
    expect(blockers).toHaveLength(0);
  });
});
