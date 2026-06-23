/**
 * Backfill / inspect a BookVisualContract for a story-bank slot.
 *
 *   npx tsx scripts/compile-visual-contract.ts lion_shaket_adventure
 *
 * Reads the golden story .md, compiles the contract (deterministic), writes it to
 * outputs/visual-contracts/<storyKey>.contract.json, and prints render-ready + confidence.
 * No render spend, no DB, no Supabase.
 */
import * as fs from 'fs';
import * as path from 'path';
import { parseStoryMarkdownForContract } from '../lib/visual-contract/parse-story';
import { compileBookVisualContract } from '../lib/visual-contract/compiler';

function resolveStoryFile(storyKey: string): string {
  const candidates = [
    path.join(process.cwd(), 'story-bank', 'v5-fixed-v2', `${storyKey}.md`),
    path.join(process.cwd(), 'story-bank', 'v3-approved', `${storyKey}.md`),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error(`story file not found for "${storyKey}" (looked in v5-fixed-v2, v3-approved)`);
}

function main(): void {
  const storyKey = process.argv[2] || 'lion_shaket_adventure';
  const file = resolveStoryFile(storyKey);
  const raw = fs.readFileSync(file, 'utf8');
  const input = parseStoryMarkdownForContract(raw, storyKey);
  const contract = compileBookVisualContract(input, { generatedAt: new Date().toISOString(), maxRerolls: 2 });

  const outDir = path.join(process.cwd(), 'outputs', 'visual-contracts');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${storyKey}.contract.json`);
  fs.writeFileSync(outPath, JSON.stringify(contract, null, 2));

  console.log(`[visual-contract] compiled ${storyKey} from ${path.relative(process.cwd(), file)}`);
  console.log(`  pages=${contract.pageCount} criticalObjects=${contract.criticalObjects.map((o) => o.objectId).join(', ')}`);
  console.log(`  scenes=${contract.scenes.map((s) => `${s.sceneId}[${s.pages.join('/')}]`).join('  ')}`);
  console.log(`  confidence overall=${contract.confidence.overall} byClass=${JSON.stringify(contract.confidence.byClass)}`);
  console.log(`  renderReady=${contract.renderReady} blockers=${JSON.stringify(contract.renderReadyBlockers)}`);
  console.log(`  → ${path.relative(process.cwd(), outPath)}`);
}

main();
