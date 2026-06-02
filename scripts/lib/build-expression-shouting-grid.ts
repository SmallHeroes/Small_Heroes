import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const LABELS = [
  { file: 'canonical-B.png', label: 'Canonical B' },
  { file: 'shouting.png', label: 'Shouting v1' },
  { file: 'shouting-v2.png', label: 'Shouting v2' },
  { file: 'shouting-v3.png', label: 'Shouting v3' },
] as const;

export async function buildExpressionShoutingGrid(outDir: string): Promise<string> {
  const tileW = 480;
  const tileH = 720;
  const cols = LABELS.length;
  const composites: sharp.OverlayOptions[] = [];

  for (let i = 0; i < LABELS.length; i += 1) {
    const src = path.join(outDir, LABELS[i].file);
    if (!fs.existsSync(src)) {
      throw new Error(`Missing grid source: ${src}`);
    }
    const tile = await sharp(src)
      .resize(tileW, tileH, { fit: 'contain', background: '#f5f0e8' })
      .png()
      .toBuffer();
    composites.push({ input: tile, left: i * tileW, top: 0 });
  }

  const gridPath = path.join(outDir, 'shouting-grid.png');
  await sharp({
    create: {
      width: tileW * cols,
      height: tileH,
      channels: 3,
      background: '#f5f0e8',
    },
  })
    .composite(composites)
    .png()
    .toFile(gridPath);

  const md = [
    '# Shouting anchor comparison',
    '',
    'Pick **v1**, **v2**, or **v3**, then:',
    '`npx tsx --require ./scripts/shims/register-server-only.cjs scripts/select-mia-shouting-anchor.ts v2`',
    '',
    '| Slot | File |',
    '|------|------|',
    ...LABELS.map((l) => `| ${l.label} | \`${l.file}\` |`),
    '',
    `![grid](shouting-grid.png)`,
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'SHOUTING-GRID.md'), md);

  return gridPath;
}
