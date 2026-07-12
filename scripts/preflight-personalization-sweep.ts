/**
 * Pre-launch personalization sweep — OFFLINE. No render, no ElevenLabs, no paid LLM, no cost.
 *
 * For every SELLABLE MVP slot (backend/config/mvp-story-matrix.ts → 6 companions × 3 directions) × {boy, girl}:
 *   1. Loads the story through the DETERMINISTIC paid path EXACTLY as the paid text finalizer does
 *      (lib/generation-pipeline/text-finalization.ts:66): loadStoryFromBank(..., { skipLlmPersonalization: false,
 *      allowLlmRewrite: false, patchContext: null, letterContext: null }). skipLlmPersonalization=false is how
 *      production sets it there (`cache.skipLlmPersonalization === true` is false for text finalization); allowLlmRewrite
 *      defaults OFF — so the Fork-B correction RUNS but stays deterministic: gender adaptation keeps the chip/slash
 *      resolution + the name-adjacent gate as the fail-closed re-check (NO LLM swap), plus the deterministic name
 *      top-up, name-floor assert, and diff-budget guard. Zero LLM / zero network. (skipLlmPersonalization=true is the
 *      LATER image/cover reload that SKIPS this correction — NOT the text-finalization path the old sweep used.)
 *      patchContext/letterContext are per-ORDER data (a test child has none) → null keeps it offline without touching
 *      the Fork-B name/gender logic under test.
 *   2. Asserts the personalization gate PASSES (assertStoryPersonalizationGate / runStoryPersonalizationGate):
 *      no wrong-gender CHILD marker, no unresolved chips/slashes/patches/placeholders, name-floor met, no leftover
 *      bank protagonist names, companion≠child. (The loader runs it internally; we ALSO re-run it on the resolved
 *      pages so the check never depends on the loader's internals.)
 *   3. Asserts NON-CHILD cast keeps its AUTHORED gender. The live bug (cmrgvvmrh: LLM feminized הרופא→הרופאה) is an
 *      LLM-path desync; on the deterministic path a supporting character can only shift gender if a mis-scoped gender
 *      chip/slash couples it to the CHILD. So the sweep requires supporting-cast gender to be INVARIANT across boy vs
 *      girl (any role that flips is the הרופא→הרופאה class), flags a role authored in BOTH forms, and — where a
 *      .visual-contract.json exists (bunny_ometz_adventure only) — cross-checks the resolved gender against the
 *      contract's humanCast[].gender (the frozen authority).
 *
 * Reports a table (slot × gender → PASS/FAIL) + the specific failing reason/line. Exits non-zero on any FAIL (CI).
 *
 * Run (offline):
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/preflight-personalization-sweep.ts
 */
import { existsSync } from 'fs';
import { join } from 'path';
import {
  MVP_STORY_MATRIX,
  configuredSlotStatus,
  allMvpCategories,
  type MvpCategory,
  type StoryDirection,
} from '@/backend/config/mvp-story-matrix';
import { STORY_BANK_V3_DIR_NAME, V3_APPROVED_DIR_NAME, isV3ApprovedBankEnabled } from '@/backend/providers/story-bank-index';
import { loadStoryFromBank } from '@/backend/providers/story-bank-loader';
import { runStoryPersonalizationGate, StoryPersonalizationGateError } from '@/lib/story-bank-personalization';
import { stripNikud } from '@/lib/hebrew-text';
import { getCompanionById } from '@/lib/companions';
import { loadVisualContractArtifact } from '@/lib/visual-contract-compiler';

const DIRECTIONS: StoryDirection[] = ['bedtime', 'adventure', 'fantasy'];
const GENDERS = ['boy', 'girl'] as const;
type Gender = (typeof GENDERS)[number];

/** Unisex, distinctive, and NOT in BANK_PROTAGONIST_DENYLIST (מיכל/נועה/יוסי/יעל/איתי/דני/מיה/עומר/שירה/Ella/תום). */
const TEST_CHILD = 'רוני';

type StoryResult = Awaited<ReturnType<typeof loadStoryFromBank>>;

/**
 * Supporting-cast role → masculine/feminine Hebrew forms. Matched on NIQQUD-STRIPPED text. Feminine forms that
 * contain the masculine form (רופאה⊃רופא, תינוקת⊃תינוק) are written so the masc pattern excludes the fem via a
 * negative lookahead. `single` roles (one person, e.g. the doctor) must resolve to ONE gender — both forms present
 * is an authoring inconsistency; non-single roles (parents/baby+sibling) may legitimately show both.
 */
const ROLE_PAIRS: { role: string; masc: RegExp; fem: RegExp; single: boolean; contractRoles: string[] }[] = [
  { role: 'doctor', masc: /רופא(?!ה)/g, fem: /רופאה/g, single: true, contractRoles: ['doctor'] },
  { role: 'parent (אבא/אמא)', masc: /אבא/g, fem: /אמא/g, single: false, contractRoles: ['mother', 'father', 'parent'] },
  { role: 'baby sibling', masc: /תינוק(?!ת)/g, fem: /תינוקת/g, single: false, contractRoles: ['baby', 'sibling'] },
];

function countForm(text: string, re: RegExp): number {
  return (text.match(new RegExp(re.source, 'g')) || []).length;
}

/** First page + short snippet where `re` appears (for the failing-line report). */
function findLine(pages: StoryResult['pages'], re: RegExp): string | null {
  for (const p of pages) {
    const stripped = stripNikud(p.text);
    const idx = stripped.search(new RegExp(re.source));
    if (idx >= 0) {
      const snip = stripped.slice(Math.max(0, idx - 22), idx + 26).replace(/\s+/g, ' ').trim();
      return `p${p.pageNumber}: …${snip}…`;
    }
  }
  return null;
}

type CellVerdict = 'PASS' | 'FAIL' | 'ERROR';
type Cell = { verdict: CellVerdict; failures: string[] };
type SlotRow = {
  label: string;
  status: string;
  hasContract: boolean;
  cells: Record<Gender, Cell>;
};

async function sweepSlot(category: MvpCategory, direction: StoryDirection): Promise<SlotRow | null> {
  const status = configuredSlotStatus(category, direction);
  if (status === 'missing' || status === 'in_gate') return null; // not a sellable slot

  const companionId = MVP_STORY_MATRIX[category].companionId;
  const companionName = getCompanionById(companionId)?.name ?? companionId;
  const slug = `${companionId}_${direction}`;
  const bankDir = status === 'approved_v3' ? V3_APPROVED_DIR_NAME : STORY_BANK_V3_DIR_NAME;
  const file = join(process.cwd(), 'story-bank', bankDir, `${slug}.md`);
  const contractDir = join(process.cwd(), 'story-bank', V3_APPROVED_DIR_NAME);
  const hasContract = existsSync(join(contractDir, `${slug}.visual-contract.json`));

  const cells: Record<Gender, Cell> = {
    boy: { verdict: 'PASS', failures: [] },
    girl: { verdict: 'PASS', failures: [] },
  };
  const label = `${category} · ${slug}`;

  if (!existsSync(file)) {
    for (const g of GENDERS) cells[g] = { verdict: 'ERROR', failures: [`story file missing: ${bankDir}/${slug}.md`] };
    return { label, status, hasContract, cells };
  }

  // 1) deterministic load + gate, per gender
  const stories: Partial<Record<Gender, StoryResult>> = {};
  for (const g of GENDERS) {
    try {
      // The paid text-finalization flag combo (text-finalization.ts:66) — NOT a hand-picked flag: skipLlmPersonalization
      // false (as production sets it) + allowLlmRewrite OFF ⇒ deterministic Fork-B name/gender correction runs, no LLM.
      const story = await loadStoryFromBank(file, TEST_CHILD, companionName, g, {
        skipLlmPersonalization: false,
        allowLlmRewrite: false,
        patchContext: null,
        letterContext: null,
      });
      stories[g] = story;
      // belt-and-suspenders: re-run the gate on the resolved pages (never depend on the loader running it)
      const failures = runStoryPersonalizationGate({
        wizard: { childName: TEST_CHILD, childGender: g, companionName },
        pages: story.pages.map((p) => ({ pageNumber: p.pageNumber, text: p.text, imagePrompt: p.imagePrompt })),
      });
      if (failures.length) cells[g].failures.push(...failures.map((f) => `gate: ${f}`));
    } catch (e) {
      if (e instanceof StoryPersonalizationGateError) {
        cells[g] = { verdict: 'FAIL', failures: e.failures.map((f) => `gate: ${f}`) };
      } else {
        cells[g] = { verdict: 'ERROR', failures: [`loader error: ${(e as Error).message}`] };
      }
    }
  }

  // 2) non-child cast gender checks (need resolved pages for both genders)
  if (stories.boy && stories.girl) {
    const text: Record<Gender, string> = {
      boy: stories.boy.pages.map((p) => stripNikud(p.text)).join('\n'),
      girl: stories.girl.pages.map((p) => stripNikud(p.text)).join('\n'),
    };
    for (const pair of ROLE_PAIRS) {
      const sig = (g: Gender) => ({ masc: countForm(text[g], pair.masc), fem: countForm(text[g], pair.fem) });
      const b = sig('boy');
      const gi = sig('girl');
      const label2 = (s: { masc: number; fem: number }) => `${s.masc ? 'M' : ''}${s.fem ? 'F' : ''}` || '∅';

      // 2a) INVARIANCE — a supporting role must not change gender with the child's gender (the הרופא→הרופאה class).
      if (label2(b) !== label2(gi)) {
        const flippedRe = gi.fem !== b.fem ? pair.fem : pair.masc;
        const line = findLine(stories.girl.pages, flippedRe) ?? findLine(stories.boy.pages, flippedRe);
        const msg = `cast "${pair.role}" gender CHANGES with child gender (boy=${label2(b)} girl=${label2(gi)}) — a mis-scoped gender chip/slash coupled it to the child${line ? `; ${line}` : ''}`;
        cells.boy.failures.push(msg);
        cells.girl.failures.push(msg);
      }

      // 2b) internal inconsistency — a SINGLE-person role authored in BOTH masc + fem forms.
      if (pair.single) {
        for (const g of GENDERS) {
          const s = g === 'boy' ? b : gi;
          if (s.masc > 0 && s.fem > 0) {
            cells[g].failures.push(`cast "${pair.role}" appears in BOTH masculine and feminine forms — inconsistent authored gender`);
          }
        }
      }
    }

    // 2c) contract cross-check (only bunny_ometz_adventure today) — resolved gender vs the frozen humanCast gender.
    if (hasContract) {
      try {
        const { contract } = loadVisualContractArtifact(contractDir, slug);
        const humanCast = contract.humanCast ?? [];
        for (const hc of humanCast) {
          const pair = ROLE_PAIRS.find((rp) => rp.contractRoles.some((r) => hc.role.toLowerCase().includes(r)));
          if (!pair || (hc.gender !== 'male' && hc.gender !== 'female')) continue;
          for (const g of GENDERS) {
            const s = { masc: countForm(text[g], pair.masc), fem: countForm(text[g], pair.fem) };
            if (hc.gender === 'male' && s.fem > 0) {
              cells[g].failures.push(`contract: humanCast "${hc.role}" is gender=male, but the resolved text has the FEMININE form`);
            }
            if (hc.gender === 'female' && s.masc > 0 && s.fem === 0) {
              cells[g].failures.push(`contract: humanCast "${hc.role}" is gender=female, but the resolved text has the MASCULINE form`);
            }
          }
        }
      } catch (e) {
        for (const g of GENDERS) cells[g].failures.push(`contract load error: ${(e as Error).message}`);
      }
    }
  }

  for (const g of GENDERS) {
    if (cells[g].verdict === 'PASS' && cells[g].failures.length > 0) cells[g].verdict = 'FAIL';
  }
  return { label, status, hasContract, cells };
}

async function main() {
  console.log('Pre-launch personalization sweep — OFFLINE (no render / no LLM / no cost)');
  console.log(`test child name: "${TEST_CHILD}"  ·  ENABLE_V3_APPROVED_BANK=${isV3ApprovedBankEnabled()} (sweep verifies content regardless of the runtime flag)\n`);

  const rows: SlotRow[] = [];
  for (const category of allMvpCategories()) {
    for (const direction of DIRECTIONS) {
      const row = await sweepSlot(category, direction);
      if (row) rows.push(row);
    }
  }

  // ── table ──
  const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - s.length));
  const w = Math.max(...rows.map((r) => r.label.length), 12) + 2;
  console.log(`${pad('SLOT', w)}${pad('status', 13)}${pad('boy', 7)}girl`);
  console.log('─'.repeat(w + 13 + 7 + 6));
  const mark = (c: Cell) => (c.verdict === 'PASS' ? 'PASS' : c.verdict === 'ERROR' ? 'ERR ' : 'FAIL');
  for (const r of rows) {
    const ct = r.hasContract ? ' *' : '';
    console.log(`${pad(r.label + ct, w)}${pad(r.status, 13)}${pad(mark(r.cells.boy), 7)}${mark(r.cells.girl)}`);
  }
  console.log('  (* = has a visual-contract.json cross-checked)\n');

  // ── failures ──
  const fails = rows.flatMap((r) =>
    GENDERS.filter((g) => r.cells[g].verdict !== 'PASS').map((g) => ({ slot: r.label, g, cell: r.cells[g] })),
  );
  if (fails.length) {
    console.log('FAILURES:\n');
    for (const f of fails) {
      console.log(`  ✗ ${f.slot} [${f.g}] — ${f.cell.verdict}`);
      for (const reason of f.cell.failures) console.log(`      • ${reason}`);
    }
    console.log('');
  }

  const total = rows.length * GENDERS.length;
  const passed = total - fails.length;
  console.log(`${passed}/${total} (slot × gender) PASS — ${fails.length} FAIL/ERROR across ${rows.length} sellable slots.`);
  process.exit(fails.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('sweep crashed:', e);
  process.exit(2);
});
