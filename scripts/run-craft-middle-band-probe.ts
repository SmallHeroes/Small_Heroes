/**
 * Phase A2 follow-up — middle-band craft probe on Phase-A Bolly story.
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-craft-middle-band-probe.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import {
  CRAFT_DIMENSIONS,
  runCraftRubricTest,
  type CraftHardFailId,
} from '../lib/story-gen/craft-rubric-test';
import { DEFAULT_STORY_GEN_MODELS } from '../lib/story-gen/story-generation-types';

const DEFAULT_INPUT = path.join(
  process.cwd(),
  'outputs',
  'story-gen-runs',
  '2026-06-07T10-21-49-454Z',
  'story.md'
);

function extractPhaseAStoryBody(markdown: string): string {
  const titleMatch = markdown.match(/title:\s*"([^"]+)"/);
  const title = titleMatch?.[1] ?? '';

  const pageRe =
    /\r?\n(?:--- Page (\d+) ---|### Page (\d+))\r?\n([\s\S]*?)(?=\r?\n(?:--- Page \d+ ---|### Page \d+|\r?\nWORD_COUNT:)|$)/g;
  const pages: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pageRe.exec(markdown)) !== null) {
    const pageNum = match[1] ?? match[2];
    const chunk = match[3]?.trim() ?? '';
    pages.push(`--- Page ${pageNum} ---\n${chunk}`);
  }

  const header = title ? `title: "${title}"\n\n` : '';
  return `${header}${pages.join('\n\n')}`.trim();
}

async function main(): Promise<void> {
  const inputPath = process.argv[2] ?? DEFAULT_INPUT;
  const markdown = fs.readFileSync(inputPath, 'utf8');
  const storyBody = extractPhaseAStoryBody(markdown);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(process.cwd(), 'outputs', 'story-gen-runs', timestamp);
  fs.mkdirSync(runDir, { recursive: true });

  console.log(`[middle-band-probe] input=${inputPath}`);
  console.log(`[middle-band-probe] judgeModel=${DEFAULT_STORY_GEN_MODELS.judgeModel}`);
  console.log(`[middle-band-probe] output=${runDir}`);

  const report = await runCraftRubricTest({ storyBody });

  fs.writeFileSync(
    path.join(runDir, 'middle-band-probe.json'),
    JSON.stringify({ inputPath, storyBody, report }, null, 2),
    'utf8'
  );

  const proseCraftDims = [
    'childDelight',
    'humor',
    'pageTurnValue',
    'emotionalTruth',
    'companionMemorability',
    'hebrewOrality',
    'rereadability',
    'commercialQuality',
  ] as const;

  const proseCraftAvg =
    proseCraftDims.reduce((sum, d) => {
      const hit = report.dimensions.find((x) => x.dimension === d);
      return sum + (hit?.score ?? 0);
    }, 0) / proseCraftDims.length;

  let band: string;
  if (report.overall < 5) band = 'TOO_HARSH (<5.0)';
  else if (report.overall <= 8.0) band = 'GOOD (6.0–8.0) — judge distinguishes mid from golden';
  else if (report.overall <= 8.7) band = 'CAUTION (8.1–8.7) — may be too generous';
  else band = 'PROBLEM (≥8.8) — over-rewards polished structure';

  const md = `# Middle-band craft probe — Phase-A Bolly adventure

**Input:** ${inputPath}  
**Judge model:** ${report.modelId}  
**Prompt version:** ${report.promptVersion}  
**Overall:** ${report.overall}  
**Verdict:** ${report.verdict}  
**Prose-craft avg (8 diagnostic dims):** ${Math.round(proseCraftAvg * 10) / 10}  
**Band:** ${band}

## Dimension scores

| Dimension | Score | Evidence |
| --- | ---: | --- |
${report.dimensions
  .map((d) => `| ${d.dimension} | ${d.score} | ${d.evidenceQuote.replace(/\|/g, '\\|')} |`)
  .join('\n')}

## Hard-fails

${report.hardFails
  .filter((h) => h.triggered)
  .map((h) => `- **${h.id}:** "${h.evidenceQuote}"`)
  .join('\n') || 'None triggered.'}

## Summary

${report.summary}
`;

  fs.writeFileSync(path.join(runDir, 'middle-band-probe.md'), md, 'utf8');

  console.log('\n--- Middle-band probe ---');
  console.log(`overall=${report.overall} verdict=${report.verdict} band=${band}`);
  console.log(`proseCraftAvg=${Math.round(proseCraftAvg * 10) / 10}`);
  for (const d of CRAFT_DIMENSIONS) {
    const hit = report.dimensions.find((x) => x.dimension === d)!;
    console.log(`  ${d}: ${hit.score} — "${hit.evidenceQuote.slice(0, 60)}..."`);
  }
  const triggered = report.hardFails.filter((h) => h.triggered).map((h) => h.id);
  console.log(`hardFails: ${triggered.length ? triggered.join(', ') : 'none'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
