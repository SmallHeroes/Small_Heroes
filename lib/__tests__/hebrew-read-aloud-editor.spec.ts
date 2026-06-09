import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import {
  runDeterministicDiagnosis,
} from '../story-gen-v3/hebrew-read-aloud-editor';
import { DINI_POPCORN_PROTECTED_LINES } from '../story-gen-v3/hebrew-editorial-precedents';

const FIXTURE = path.join(
  process.cwd(),
  'lib/story-gen-v3/__fixtures__/dini-popcorn-hebrew-acceptance.md'
);

describe('HebrewReadAloudEditor v0 deterministic diagnosis', () => {
  it('flags acceptance-test bad lines and spares protected good lines', () => {
    const md = readFileSync(FIXTURE, 'utf8');
    const issues = runDeterministicDiagnosis(md, DINI_POPCORN_PROTECTED_LINES);
    const lines = issues.map((i) => i.exactLine).join('\n');
    const ids = issues.map((i) => i.id);

    expect(ids).toContain('prec-pose_hands_open_catch');
    expect(lines).toMatch(/מספיק לחמם אומץ/);
    expect(ids).toContain('prec-pride_heavy_full_shela_block');
    expect(ids).not.toContain('prec-guy_keep_dini_child_problem_roast');
    expect(ids).toContain('prec-guy_replace_version_two_with_physical_escalation');
    expect(ids).toContain('prec-guy_replace_tea_cup_safety_logic');

    const flaggedProtected = issues.some((i) =>
      i.exactLine.includes('רגע — לא גג. מפרש') ||
      i.exactLine.includes('אחרי הסרט')
    );
    expect(flaggedProtected).toBe(false);

    const tasteCalls = issues.filter((i) => i.actionMode === 'TASTE_CALL');
    expect(tasteCalls.length).toBe(0);
  });
});
