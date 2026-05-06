const path = require('path');
const sharp = require('sharp');

const SIZE = 2048;
const MEAN = 0.5;
const AMPLITUDE = 0.3;
const BLUR_RADIUS = 0.4;

function toByte(value01) {
  const clamped = Math.max(0, Math.min(1, value01));
  return Math.round(clamped * 255);
}

async function main() {
  const pixels = Buffer.alloc(SIZE * SIZE);
  for (let i = 0; i < pixels.length; i += 1) {
    const centered = (Math.random() * 2 - 1) * AMPLITUDE;
    pixels[i] = toByte(MEAN + centered);
  }

  const outputPath = path.join(process.cwd(), 'public', 'assets', 'paper', 'grain.png');
  await sharp(pixels, {
    raw: {
      width: SIZE,
      height: SIZE,
      channels: 1,
    },
  })
    .blur(BLUR_RADIUS)
    .png({ compressionLevel: 9 })
    .toFile(outputPath);

  // eslint-disable-next-line no-console
  console.log(`Generated ${outputPath}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});

