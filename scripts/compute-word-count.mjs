#!/usr/bin/env node
import { readFileSync } from 'fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/compute-word-count.mjs <story.md>');
  process.exit(1);
}

const content = readFileSync(file, 'utf8');

function countHebrewWords(text) {
  const cleaned = text
    .split('\n')
    .filter((l) => !l.trim().startsWith('imageDirection:'))
    .join(' ');
  const normalized = cleaned
    .replace(/\{\{childName\}\}/g, 'CHILD')
    .replace(/["""״׳,;:!?.\-—–…()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return 0;
  return normalized.split(/\s+/).filter(Boolean).length;
}

const pageRegex = /--- Page (\d+) ---\n([\s\S]*?)(?=--- Page \d+ ---|WORD_COUNT:|$)/g;
const counts = [];
let m;
while ((m = pageRegex.exec(content)) !== null) {
  const lines = m[2].trim().split('\n').filter((l) => !l.trim().startsWith('imageDirection:'));
  counts.push(countHebrewWords(lines.join('\n')));
}
const total = counts.reduce((a, b) => a + b, 0);
console.log(`WORD_COUNT: [${counts.join(', ')}] = ${total}`);
console.log(`pages: ${counts.length}`);
