/**
 * Brief 1 driver — compile `.visual-contract-template.json` CANDIDATES + `.visual-contract-review.md` from
 * `<storyKey>.source.json` sources. OFFLINE by default: it REFUSES to call a live model unless `--live` is
 * passed (the tool is human-in-the-loop; a live LLM drafts descriptive fields only, never on the paid path).
 * For the offline pilot, pass `--fixture-draft <file.json>` to use a saved descriptive draft as the LLM output.
 *
 * NO RENDER. NO write under story-bank/v3-approved (candidates land in --out for human review, never frozen).
 *
 * Usage (offline pilot, with the server-only shim):
 *   tsx --require ./scripts/shims/register-server-only.cjs scripts/compile-visual-contract-templates.ts \
 *     --sources <dir> --out <dir> [--only <storyKey>] [--prev-bank story-bank/v3-approved] \
 *     [--fixture-draft <file.json> | --live]
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

import {
  compileBookVisualContractTemplate,
  type TemplateCompileInput,
} from '@/lib/visual-contract-compiler/compileBookVisualContractTemplate';
import { validateBookVisualContractTemplate } from '@/lib/visual-contract-compiler/validateTemplateContract';
import { renderVisualContractReview } from '@/lib/visual-contract-compiler/writeVisualContractReview';
import type { ContractLlmCaller } from '@/lib/visual-contract-compiler/compileBookVisualContract';
import type { BookVisualContractTemplate } from '@/lib/visual-contract-compiler/contractTemplateTypes';

const SOURCE_SUFFIX = '.source.json';
const TEMPLATE_SUFFIX = '.visual-contract-template.json';
const REVIEW_SUFFIX = '.visual-contract-review.md';

function parseArgs(argv: string[]) {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const sources = get('--sources');
  const out = get('--out');
  if (!sources || !out) throw new Error('usage: --sources <dir> --out <dir> [--only <k>] [--prev-bank <dir>] [--fixture-draft <f> | --live]');
  return {
    sources,
    out,
    only: get('--only'),
    prevBank: get('--prev-bank'),
    fixtureDraft: get('--fixture-draft'),
    live: argv.includes('--live'),
  };
}

function loadPrevTemplate(prevBank: string | undefined, storyKey: string): BookVisualContractTemplate | undefined {
  if (!prevBank) return undefined;
  const p = path.join(prevBank, `${storyKey}${TEMPLATE_SUFFIX}`);
  if (!existsSync(p)) return undefined;
  const res = validateBookVisualContractTemplate(JSON.parse(readFileSync(p, 'utf8')));
  return res.ok ? res.template : undefined;
}

async function main(): Promise<void> {
  const { sources, out, only, prevBank, fixtureDraft, live } = parseArgs(process.argv.slice(2));
  if (!existsSync(sources)) throw new Error(`sources dir not found: ${sources}`);
  mkdirSync(out, { recursive: true });

  // Resolve the LLM caller. Offline (fixture) by default; a live model requires the explicit --live opt-in.
  let callLLM: ContractLlmCaller;
  if (fixtureDraft) {
    const draftText = readFileSync(fixtureDraft, 'utf8');
    callLLM = async () => draftText;
  } else if (live) {
    const { callLLM: pipelineCall } = await import('@/backend/providers/pipeline');
    callLLM = async (system, user) => (await pipelineCall(system, user, 4000, 0.4, 'VisualContractTemplate', true)).text;
  } else {
    throw new Error('refusing to call a live model: pass --fixture-draft <file.json> (offline) or --live to opt in');
  }

  const files = readdirSync(sources).filter((f) => f.endsWith(SOURCE_SUFFIX)).sort();
  let ok = 0;
  const failures: Array<{ storyKey: string; error: string }> = [];

  for (const file of files) {
    const raw = JSON.parse(readFileSync(path.join(sources, file), 'utf8')) as TemplateCompileInput;
    const storyKey = raw.storyKey ?? file.replace(SOURCE_SUFFIX, '');
    if (only && storyKey !== only) continue;
    try {
      const { template, facts, notes } = await compileBookVisualContractTemplate({ ...raw, storyKey }, { callLLM });
      const templatePath = path.join(out, `${storyKey}${TEMPLATE_SUFFIX}`);
      writeFileSync(templatePath, `${JSON.stringify(template, null, 2)}\n`, 'utf8');

      const previous = loadPrevTemplate(prevBank, storyKey);
      const review = renderVisualContractReview({ storyKey, facts, template, notes, valid: true, previous });
      writeFileSync(path.join(out, `${storyKey}${REVIEW_SUFFIX}`), review, 'utf8');

      ok += 1;
      console.log(`[compile-vc-template] ${storyKey} → ${templatePath} (${notes.length} note(s))`);
    } catch (err) {
      failures.push({ storyKey, error: (err as Error).message });
      console.error(`[compile-vc-template] FAILED ${storyKey}: ${(err as Error).message}`);
    }
  }

  console.log(`[compile-vc-template] compiled ${ok}; ${failures.length} failure(s).`);
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
