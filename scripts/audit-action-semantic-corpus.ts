import fs from 'node:fs';
import path from 'node:path';

import {
  auditActionSemanticCorpus,
} from '../lib/visual-contract-compiler/actionSemanticCorpusAudit';

function option(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

const repoRoot = path.resolve(option('--repo-root') ?? process.cwd());
const bankRelative = option('--bank') ?? 'story-bank/v3-approved';
const bank = path.resolve(repoRoot, bankRelative);
const relative = path.relative(repoRoot, bank);
if (
  relative === '..' ||
  relative.startsWith(`..${path.sep}`) ||
  path.isAbsolute(relative)
) {
  throw new Error('Story Source bank must remain inside repoRoot');
}

const sources = fs
  .readdirSync(bank, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isFile() &&
      entry.name.endsWith('.md') &&
      !entry.name.startsWith('_'),
  )
  .map((entry) => ({
    sourceId: entry.name.slice(0, -3),
    rawStorySource: fs.readFileSync(
      path.join(bank, entry.name),
      'utf8',
    ),
  }));

process.stdout.write(
  `${JSON.stringify(auditActionSemanticCorpus(sources), null, 2)}\n`,
);
