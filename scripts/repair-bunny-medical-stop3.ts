/**
 * Bunny REPAIR_PROSE_ONLY — surgical line swaps + STOP 3 gate rerun (no regenerate).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/repair-bunny-medical-stop3.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { BUNNY_OMETZ_MEDICAL } from '../lib/story-gen-v3/confidence-batch-specs';
import { rerunStop3Gates } from '../lib/story-gen-v3/stop3-gates';
import type { PageBeatV3, StoryPremiseCandidate } from '../lib/story-gen-v3/types';

const DEFAULT_RUN = path.join(
  process.cwd(),
  'outputs/story-gen-v3-runs/confidence_bunny_ometz_medical-stop3-2026-06-09T17-43-41-766Z'
);

const SURGICAL_SWAPS: Array<{ from: string; to: string }> = [
  {
    from: 'מנסה שהלב לא ישמע דרך האוזניים שלה',
    to: 'מנסה שהלב לא ידפוק בקול רם מדי',
  },
  { from: 'האוזניים שלה רועדות כמו ג\'לי', to: 'הידיים שלה רועדות קצת כמו ג\'לי' },
  {
    from: 'מקפיץ את האוזניים שלה עוד יותר',
    to: 'מצחיק אותה עוד יותר',
  },
  {
    from: 'עכשיו כולם מסתכלים, גם האחות',
    to: 'האחות מרימה עיניים ומחייכת בשקט',
  },
  {
    from: 'היא מנענעת בכוונה אוזן אחת, אחר כך את השנייה',
    to: 'היא מנענעת בכוונה את הידיים כאילו היו אוזניים',
  },
  { from: 'מזיזה אוזן קטנה קדימה', to: 'מזיזה יד קטנה קדימה, כמו אוזן במשחק' },
  { from: 'היא מריםה גבה', to: 'היא מרימה גבה' },
  { from: '"גם שלי רוצות לזוז קצת."', to: '"גם הידיים שלי קצת רועדות."' },
  { from: 'האחות צוחקת:', to: 'האחות מחייכת:' },
  { from: '"איזה אוזניים נהדרות יש לכם!"', to: '"איזה משחק אוזניים נהדר יש לכם."' },
  {
    from: 'האוזניים של שניהם רועדות כאילו מנגנות יחד שיר סודי',
    to: 'הידיים שלה ואוזניו של בוּנִי רועדות כאילו מנגנות יחד שיר סודי',
  },
  {
    from: 'הם מתופפים באוזניים יחד, קצב עדין של "טוק־טוק־טוק".',
    to: 'היא עושה טוק־טוק בידיים, ובּוּנִי עושה טוק־טוק באוזניים — קצב עדין של "טוק־טוק־טוק".',
  },
  {
    from: 'imageDirection: two statuesque figures—child and bunny—frozen mid‑pose with ears stretched tall',
    to: 'imageDirection: child and bunny frozen mid pose — child hands raised like ear-statues, bunny ears stretched tall',
  },
  {
    from: "imageDirection: child’s ears trembling visibly while bunny leans in, whispering exaggeratedly",
    to: "imageDirection: child's hands trembling visibly while bunny leans in, whispering exaggeratedly",
  },
  {
    from: 'imageDirection: mirror reflection of child and bunny wiggling ears deliberately, smiling',
    to: 'imageDirection: mirror reflection — child wiggling hands like ears, bunny wiggling ears, both smiling',
  },
  {
    from: 'imageDirection: nurse leaning in with thermometer, child’s ear slightly tilted forward',
    to: 'imageDirection: nurse leaning in with thermometer, child hand slightly forward like an ear in the game',
  },
  {
    from: 'imageDirection: child and bunny laughing, ears mid‑dance, nurse smiling in background',
    to: 'imageDirection: child and bunny laughing — bunny ears mid-dance, child hands tapping rhythm, nurse smiling',
  },
  {
    from: 'imageDirection: nurse laughing, bunny bowing, child grinning proudly',
    to: 'imageDirection: nurse smiling, bunny bowing, child grinning proudly',
  },
  {
    from: 'imageDirection: soft close‑up of child and bunny side by side, one ear tipping playfully',
    to: 'imageDirection: soft close-up of child and bunny side by side, one bunny ear tipping playfully',
  },
];

function runDir(): string {
  return path.resolve(
    process.argv.find((a) => a.startsWith('--run='))?.split('=')[1] ?? DEFAULT_RUN
  );
}

async function main(): Promise<void> {
  const dir = runDir();
  const storyPath = path.join(dir, 'story.md');
  let md = fs.readFileSync(storyPath, 'utf8');
  const applied: Array<{ from: string; to: string; ok: boolean }> = [];

  for (const swap of SURGICAL_SWAPS) {
    const ok = md.includes(swap.from);
    if (ok) md = md.replace(swap.from, swap.to);
    applied.push({ ...swap, ok });
  }

  const missing = applied.filter((a) => !a.ok);
  if (missing.length) {
    console.warn('[bunny-repair] swaps not found:', missing.map((m) => m.from));
  }

  fs.writeFileSync(path.join(dir, 'prose-repair-log.json'), JSON.stringify({ applied }, null, 2));
  fs.writeFileSync(storyPath, md, 'utf8');

  const premise = JSON.parse(
    fs.readFileSync(path.join(dir, 'hardened-premise.json'), 'utf8')
  ) as StoryPremiseCandidate;
  const beats = JSON.parse(
    fs.readFileSync(path.join(dir, 'page-beats.json'), 'utf8')
  ) as PageBeatV3[];

  console.log('[bunny-repair] surgical swaps applied — rerunning STOP 3 gates only...');
  const result = await rerunStop3Gates({
    runDir: dir,
    spec: BUNNY_OMETZ_MEDICAL,
    premise,
    beats,
  });

  const report = `# Bunny REPAIR_PROSE_ONLY — gate rerun

## NOT human-approved
humanAloudReadRequired: true

## Surgical swaps
${applied.map((a) => `- ${a.ok ? 'OK' : 'MISSING'}: \`${a.from.slice(0, 50)}…\``).join('\n')}

## Gates
- StoryAlive: ${result.storyAliveVerdict}
- HebrewReadAloud: ${result.hebrewVerdict}
- read-back: ${result.readBackPass ? 'PASS' : 'FAIL'}
- medicalRisks: ${result.medicalRisks}
- bodyPartLeaks: ${result.bodyPartLeaks}
- gatePassAutomated: ${result.gatePassAutomated}

Run dir: \`${dir}\`
`;
  fs.writeFileSync(path.join(dir, 'report.md'), report, 'utf8');

  console.log(`[bunny-repair] StoryAlive: ${result.storyAliveVerdict}`);
  console.log(`[bunny-repair] Hebrew: ${result.hebrewVerdict}`);
  console.log(`[bunny-repair] gatePassAutomated: ${result.gatePassAutomated}`);
  console.log('[bunny-repair] NOT human-approved — Guy reads aloud');

  if (!result.gatePassAutomated) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
