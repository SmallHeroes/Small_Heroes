/**
 * Stage 2b — compiler-owned TOPOLOGY graph. The compiler canonicalizes location/zone IDs and rewrites every
 * page + transition reference against ONE zone graph; a reference resolves to exactly one canonical zone or the
 * compile FAILS CLOSED (→ Stage-3 repair) — it never guesses a page's location. Reproduces the EXACT live
 * failures (before_transition-at-destination; undeclared-move; per-page zoneId ∉ its location's zones) and proves
 * the fixes. The transition KIND stays LLM-authored: a genuine continuity violation is left for the fail-closed
 * validator to reject (canonicalization fixes IDENTIFIERS, never invents intent).
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

import { extractSourceFromMarkdown } from '../../scripts/extract-visual-contract-sources';
import {
  compileBookVisualContractTemplate,
  TemplateRepairExhaustedError,
  type TemplateCompileInput,
} from '../visual-contract-compiler/compileBookVisualContractTemplate';
import { InvalidTemplateContractError } from '../visual-contract-compiler/validateTemplateContract';
import type { ContractLlmCaller } from '../visual-contract-compiler/compileBookVisualContract';
import { withCurrentActionSemanticCoverage } from './visual-contract-authoring-draft-fixtures';

const BUNNY_KEY = 'bunny_ometz_adventure';
const BANK = path.join(process.cwd(), 'story-bank/v3-approved');
function bunnySource(): TemplateCompileInput {
  return extractSourceFromMarkdown(BUNNY_KEY, fs.readFileSync(path.join(BANK, `${BUNNY_KEY}.md`), 'utf8')) as TemplateCompileInput;
}
// A FRESH deep copy each call (re-parses the file) so per-test mutations never leak.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bunnyDraft(): any {
  return withCurrentActionSemanticCoverage({
    draft: JSON.parse(fs.readFileSync(path.join(BANK, `${BUNNY_KEY}.visual-contract-template.json`), 'utf8')),
    pages: bunnySource().pages,
    sourceEvidenceCatalog: bunnySource().sourceEvidenceCatalog,
  });
}
const stubFrom = (t: unknown): ContractLlmCaller => async () => JSON.stringify(t);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const page = (t: any, n: number) => t.pageContracts.find((p: any) => p.pageNumber === n);

async function expectTypedRepairExhaustion(
  draft: unknown,
  code:
    | 'unresolved_reference'
    | 'ambiguous_reference'
    | 'final_structural_invariant_invalid'
    | 'topology_malformed',
): Promise<void> {
  let thrown: unknown;
  try {
    await compileBookVisualContractTemplate(bunnySource(), {
      callLLM: stubFrom(draft),
    });
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(TemplateRepairExhaustedError);
  const exhaustion = thrown as TemplateRepairExhaustedError;
  expect(exhaustion.attempts).toHaveLength(4);
  expect(
    exhaustion.attempts.every((attempt) =>
      attempt.diagnosticIssues.some((issue) => issue.code === code),
    ),
  ).toBe(true);
  if (code === 'final_structural_invariant_invalid') {
    expect(
      exhaustion.attempts.every((attempt) =>
        attempt.diagnosticIssues.some(
          (issue) =>
            issue.family === 'draft_contract' &&
            issue.code === 'final_structural_invariant_invalid' &&
            issue.locator.kind === 'page' &&
            'causes' in issue &&
            issue.causes.includes('page_transition_invalid'),
        ),
      ),
    ).toBe(true);
  }
  expect(JSON.stringify(exhaustion.attempts)).not.toContain(
    'clinic.nonexistent_room',
  );
}

describe('S2b — the valid bunny graph is a NO-OP (canonicalization never disturbs a consistent graph)', () => {
  it('preserves every page zoneId/locationId/transition + emits no topology notes', async () => {
    const draft = bunnyDraft();
    const { template, notes } = await compileBookVisualContractTemplate(bunnySource(), { callLLM: stubFrom(draft) });
    for (const src of draft.pageContracts) {
      const out = page(template, src.pageNumber);
      expect(out.zoneId).toBe(src.zoneId);
      expect(out.locationId).toBe(src.locationId);
      expect(out.transition ?? null).toEqual(src.transition ?? null);
    }
    expect(notes.some((n) => /canonicaliz|overridden/i.test(n))).toBe(false);
  });
});

describe('S2b — the compiler OWNS the zone-ref canonicalization', () => {
  it('resolves case/separator drift to the exact declared zone (unambiguous normalized match) + notes it', async () => {
    const draft = bunnyDraft();
    page(draft, 5).zoneId = 'Clinic.Exam_Room'; // drift of the declared "clinic.exam_room"
    page(draft, 5).transition.toZoneId = 'CLINIC-EXAM-ROOM'; // drift on a transition ref too
    const { template, notes } = await compileBookVisualContractTemplate(bunnySource(), { callLLM: stubFrom(draft) });
    expect(page(template, 5).zoneId).toBe('clinic.exam_room');
    expect(page(template, 5).transition.toZoneId).toBe('clinic.exam_room');
    expect(notes.some((n) => /canonicaliz/i.test(n))).toBe(true);
  });

  it('DERIVES each page locationId from its zone — the fox failure (zoneId ∉ its location) is cleared', async () => {
    const draft = bunnyDraft();
    page(draft, 5).locationId = 'clinic_exterior'; // WRONG: exam_room is a zone of "clinic", not clinic_exterior
    const { template, notes } = await compileBookVisualContractTemplate(bunnySource(), { callLLM: stubFrom(draft) });
    expect(page(template, 5).locationId).toBe('clinic'); // derived from the resolved zone, not the draft
    expect(notes.some((n) => /overridden/i.test(n))).toBe(true);
  });

  it('an unresolved zone ref (no declared zone) → repair (throws, never guesses)', async () => {
    const draft = bunnyDraft();
    page(draft, 5).zoneId = 'clinic.nonexistent_room';
    await expectTypedRepairExhaustion(
      draft,
      'unresolved_reference',
    );
  });

  it('an AMBIGUOUS zone ref (matches >1 declared zone) → repair (throws, never a coin-flip)', async () => {
    const draft = bunnyDraft();
    // Two distinct exact ids that share a normalized form → any non-exact ref matching that form is ambiguous.
    draft.zones.push({ id: 'clinic_exam_room', locationId: 'clinic', name: 'dup', description: 'dup', stableGeometry: ['x'] });
    page(draft, 1).zoneId = 'CLINIC-EXAM-ROOM'; // normalizes to clinic.exam.room, exact-matches neither
    await expectTypedRepairExhaustion(
      draft,
      'ambiguous_reference',
    );
  });

  it('a malformed graph (zone with an unknown parent location) → repair (throws)', async () => {
    const draft = bunnyDraft();
    draft.zones[0].locationId = 'nowhere';
    await expect(
      compileBookVisualContractTemplate(bunnySource(), { callLLM: stubFrom(draft) }),
    ).rejects.toBeInstanceOf(InvalidTemplateContractError);
  });
});

describe('S2b — genuine transition-CONTINUITY violations are left for the validator (repair, not a guess)', () => {
  it('before_transition sitting in the DESTINATION zone → the compile fails closed', async () => {
    const draft = bunnyDraft();
    // p5 already sits in the destination (exam_room); relabelling its move as before_transition is illegal there.
    page(draft, 5).transition = {
      kind: 'before_transition',
      fromZoneId: 'clinic.waiting_room',
      toZoneId: 'clinic.exam_room',
    };
    await expectTypedRepairExhaustion(
      draft,
      'final_structural_invariant_invalid',
    );
  });

  it('a steady page that changes zone with no transition (undeclared move) → the compile fails closed', async () => {
    const draft = bunnyDraft();
    // p6 was a steady exam_room page; teleport it to a different declared zone while still "steady".
    page(draft, 6).zoneId = 'clinic_exterior.entrance';
    page(draft, 6).transition = { kind: 'steady' };
    await expectTypedRepairExhaustion(
      draft,
      'topology_malformed',
    );
  });
});
