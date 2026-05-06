const path = require('path');
const sharp = require('sharp');

async function main() {
  const beforePath = path.join(process.cwd(), 'proof-output', 'stage1-reader-v2', '02-first-spread.png');
  const afterPath = path.join(process.cwd(), 'proof-output', 'stage1-reader-v2', '04-first-spread-stage1_5.png');
  const outputPath = path.join(process.cwd(), 'proof-output', 'stage1-reader-v2', '05-before-after-stage1_5.png');

  const before = sharp(beforePath);
  const after = sharp(afterPath);
  const [beforeMeta, afterMeta] = await Promise.all([before.metadata(), after.metadata()]);
  const height = Math.min(beforeMeta.height || 0, afterMeta.height || 0);
  const beforeBuffer = await before.resize({ height }).toBuffer();
  const afterBuffer = await after.resize({ height }).toBuffer();
  const beforeSized = await sharp(beforeBuffer).metadata();
  const afterSized = await sharp(afterBuffer).metadata();
  const width = (beforeSized.width || 0) + (afterSized.width || 0);

  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: '#101010',
    },
  })
    .composite([
      { input: beforeBuffer, left: 0, top: 0 },
      { input: afterBuffer, left: beforeSized.width || 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(outputPath);

  // eslint-disable-next-line no-console
  console.log(`Created comparison: ${outputPath}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});

