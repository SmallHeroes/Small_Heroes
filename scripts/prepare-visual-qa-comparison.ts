import fs from 'node:fs';
import path from 'node:path';
import { previewImageDigest, writePreviewJson } from '../lib/local-story-preview';
import { COMPARISON_VERSION, comparisonModels } from '../lib/visual-qa-comparison';

const outputs = fs.realpathSync(path.resolve(__dirname, '../outputs'));
const root = path.join(outputs, 'visual-qa-cross-family-20260915');
if (fs.existsSync(root) && fs.lstatSync(root).isSymbolicLink()) throw Error('comparison_root_link');
const groups = ['local-story-preview-dini-20260915', 'r3b1b-dini-low-book-20260912', 'r3b1b-dini-low-book-20260912-remaining',
  'r3b1b-dini-low-book-20260912-repair', 'local-story-preview-dini-20260915/repair-01'];
const selected = ['page-01.png', 'repair-01/page-01.png', 'page-03.png', 'page-05.png', 'page-09.png', 'page-12.png'].map(s => `local-story-preview-dini-20260915/${s}`);
const seen = new Set<string>();
const rows = [];
for (const group of groups) for (const file of fs.readdirSync(path.join(outputs, group)).filter(s => /^page-\d+\.png$/.test(s)).sort()) {
  const relative = `${group}/${file}`, sha = previewImageDigest(path.join(outputs, relative));
  if (seen.has(sha)) continue;
  seen.add(sha);
  const smokeIndex = selected.indexOf(relative), page = Number(file.match(/\d+/)![0]);
  rows.push({ id: `image-${String(rows.length + 1).padStart(2, '0')}`, path: relative, sha,
    family: `dini-page-${page}`, split: smokeIndex >= 0 ? 'smoke' : [0,1,3,5,9,12].includes(page) ? 'development' : 'reserved_unlabelled',
    label: { expected: smokeIndex === 0 ? 'defect' : smokeIndex > 0 ? 'pass' : null,
      authority: smokeIndex === 0 ? 'owner' : smokeIndex > 0 ? 'provisional' : 'unlabelled',
      basis: smokeIndex === 0 ? 'Guy rejected the visible anatomy in this exact original image.' : smokeIndex > 0 ? 'Prior implementer visual assessment; not independent human ground truth.' : 'No anatomical verdict assigned.' } });
}
const manifest = { version: COMPARISON_VERSION, models: comparisonModels, budgetUsd: 3, maxCalls: 12, scope: 'main_child_anatomy; other findings exploratory',
  notes: 'No general accuracy claim. Reserved rows must be independently labelled before held-out evaluation; no crops/repairs of a development page enter the reserved split.', rows };
fs.mkdirSync(root, { recursive: true });
const file = path.join(root, 'dataset.json');
if (!fs.existsSync(file)) writePreviewJson(file, manifest);
else if (JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8'))) !== JSON.stringify(manifest)) throw Error('comparison_dataset_changed');
console.log(JSON.stringify({ root, uniqueImages: rows.length, smoke: rows.filter(r => r.split === 'smoke').length, reserved: rows.filter(r => r.split === 'reserved_unlabelled').length }));
