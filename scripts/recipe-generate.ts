/**
 * Recipe few-shot story generator.
 *
 * Usage:
 *   npx tsx scripts/recipe-generate.ts \
 *     --slug turtle_beiti --direction bedtime \
 *     --category PATIENCE \
 *     --companion-name 'טולי' \
 *     --companion-description 'צב קטן עם קונכייה שיודעת ללוות אותו לכל מקום, וצעדים שמתעקשים על קצב משלהם' \
 *     --child-challenge 'הילד חי בבית שבו כולם נמהרים — אמא, אבא, אח, חברים — ולו לוקח יותר זמן לכל דבר' \
 *     --resilience 'טולי נושא את הבית שלו על הגב — אין מירוץ שדורש ממנו להשאיר משהו מאחור'
 *
 * Output:
 *   recipe-output/<slug>_<direction>.draft.md  (raw LLM output)
 *   recipe-output/<slug>_<direction>.md         (cleaned + gate-checked)
 */

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import {
  GOLDEN_TRAINING_SET,
  selectExamplesForDirection,
  type RecipeDirection,
} from '../lib/recipe/golden-examples';
import { loadGoldenExample } from '../lib/recipe/load-golden';
import { buildFewShotPrompt, type RecipeRequest } from '../lib/recipe/build-prompt';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true';
      args[key] = val;
      if (val !== 'true') i++;
    }
  }
  return args;
}

async function callOpenAI(system: string, user: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY in .env.local');
  const model = process.env.RECIPE_MODEL ?? 'gpt-5';

  const startedAt = Date.now();
  console.log(`[recipe] calling ${model}...`);
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_output_tokens: 16000,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errBody}`);
  }
  const data = await res.json() as {
    output?: Array<{ content?: Array<{ text?: string }> }>;
    output_text?: string;
  };
  const text = data.output_text
    ?? data.output?.flatMap((o) => o.content?.map((c) => c.text ?? '') ?? []).join('')
    ?? '';
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[recipe] received ${text.length} chars in ${elapsed}s`);
  return text;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const required = ['slug', 'direction', 'category', 'companion-name', 'companion-description', 'child-challenge', 'resilience'];
  for (const k of required) {
    if (!args[k]) {
      console.error(`Missing --${k}`);
      process.exit(1);
    }
  }
  if (!['bedtime', 'adventure', 'fantasy'].includes(args.direction)) {
    console.error(`--direction must be bedtime|adventure|fantasy, got '${args.direction}'`);
    process.exit(1);
  }

  const request: RecipeRequest = {
    companionSlug: args.slug,
    companionName: args['companion-name'],
    companionDescription: args['companion-description'],
    direction: args.direction as RecipeDirection,
    category: args.category,
    childChallenge: args['child-challenge'],
    resilienceMetaphor: args.resilience,
  };

  console.log(`[recipe] loading ${GOLDEN_TRAINING_SET.length}-item training set, filtering for ${request.direction}...`);
  const exampleRefs = selectExamplesForDirection(request.direction);
  console.log(`[recipe] ${exampleRefs.length} examples selected for ${request.direction}:`);
  for (const ref of exampleRefs) console.log(`  - ${ref.slug} (${ref.category}) — ${ref.why}`);

  const examples = await Promise.all(exampleRefs.map((r) => loadGoldenExample(r.slug)));
  const totalExampleWords = examples.reduce((acc, ex) => acc + ex.raw.split(/\s+/).length, 0);
  console.log(`[recipe] examples loaded — total ${totalExampleWords} words across ${examples.length} stories`);

  const { system, user, expectedPageCount } = buildFewShotPrompt(request, examples);
  console.log(`[recipe] prompt built — system ${system.length} chars, user ${user.length} chars, expecting ${expectedPageCount} pages`);

  const outDir = path.join(process.cwd(), 'recipe-output');
  await mkdir(outDir, { recursive: true });

  const text = await callOpenAI(system, user);
  const draftPath = path.join(outDir, `${request.companionSlug}_${request.direction}.draft.md`);
  await writeFile(draftPath, text, 'utf8');
  console.log(`[recipe] draft written: ${draftPath}`);

  // Quick sanity checks
  const pageCount = (text.match(/^--- Page \d+ ---$/gm) ?? []).length;
  const imgDirCount = (text.match(/^imageDirection:/gm) ?? []).length;
  const childNameCount = (text.match(/\{\{childName\}\}/g) ?? []).length;
  console.log('');
  console.log(`=== Quick sanity ===`);
  console.log(`  Pages found: ${pageCount} / ${expectedPageCount} expected — ${pageCount === expectedPageCount ? '✓' : '✗'}`);
  console.log(`  imageDirection lines: ${imgDirCount} — ${imgDirCount === pageCount ? '✓' : '✗'}`);
  console.log(`  {{childName}} occurrences: ${childNameCount} — ${childNameCount >= 5 ? '✓' : '✗'} (≥5 required)`);
}

main().catch((e) => {
  console.error('[recipe] failed:', e);
  process.exit(1);
});
