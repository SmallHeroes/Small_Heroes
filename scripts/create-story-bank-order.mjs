/**
 * Create a dev story-bank CREATOR order (chunked). Prints JSON with orderId.
 *
 *   node scripts/create-story-bank-order.mjs --photo "C:\path\IMG_3423.JPG" --audio --voice fairy
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';

loadEnv({ path: '.env.local' });
loadEnv();

const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}
const has = (name) => args.includes(name);

const photoPath = flag('--photo');
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

let childPhotoBase64 = null;
if (photoPath) {
  const buf = fs.readFileSync(photoPath);
  childPhotoBase64 = `data:image/jpeg;base64,${buf.toString('base64')}`;
}

const body = {
  storyFile: flag('--story') || 'dragon_dini_fantasy.md',
  childName: flag('--name') || 'מיה',
  childGender: flag('--gender') || 'girl',
  childAge: Number(flag('--age') || '5'),
  illustrationStyle: flag('--style') || 'soft_hand_drawn_storybook',
  maxPages: Number(flag('--pages') || '20'),
  skipCover: has('--skip-cover'),
  generateAudio: has('--audio'),
  voiceId: flag('--voice') || 'mom',
  childPhotoBase64,
};

const res = await fetch(`${baseUrl}/api/dev/story-bank`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const data = await res.json();
if (!res.ok) {
  console.error(data);
  process.exit(1);
}
console.log(JSON.stringify(data, null, 2));
