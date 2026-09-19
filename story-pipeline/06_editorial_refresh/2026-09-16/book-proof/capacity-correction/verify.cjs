'use strict';
// Read-only offline size/usage witness, not a live response or visual acceptance.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { previewSha } = require('../../../../../lib/local-story-preview.ts');
const { preflightLocalBookPrompts } = require('../../../../../lib/local-preview-capacity.ts');
const { loadOwnerDraft } = require('../../../../../scripts/run-owner-book-draft.ts');
globalThis.fetch = () => { throw Error('offline_provider_forbidden'); };
const repo = path.resolve(__dirname, '../../../../..');
const read = file => fs.readFileSync(path.join(repo, file));
const files = ['outputs/local-story-preview-dini-20260915/steps/plan.result.json',
  'outputs/panda-book-sequence-input-20260919/config.json', 'outputs/panda-book-sequence-input-20260919/sequence.json'];
const before = files.map(file => ({ file, sha: previewSha(read(file)), mtime: fs.statSync(path.join(repo, file)).mtimeMs }));
const dini = JSON.parse(read(files[0]));
const output = dini.usage.output_tokens, reasoning = dini.usage.output_tokens_details.reasoning_tokens;
const config = JSON.parse(read(files[1]));
const { plan, sequence, story } = loadOwnerDraft(repo, config);
const sparse = { premise: sequence.premise, mutableAttributes: sequence.mutableAttributes,
  initialStates: sequence.pages[0].states, pages: sequence.pages.map(({ states, ...rest }) => rest) };
const sparseChars = JSON.stringify(sparse).length;
const ratio = dini.value.outputText.length / (output - reasoning);
const projected12 = output + sparseChars / ratio;
const projected16 = ((output - reasoning) + sparseChars / ratio) * 16 / 12 + reasoning;
const promptCapacity = preflightLocalBookPrompts(plan, sequence, [story.title, ...story.pages.map(p => p.text)], config);
assert.equal(promptCapacity.rows.length, 13);
for (const r of promptCapacity.rows) { assert(r.initialCharsWithMargin < 24200); assert(r.maxRepairCharsWithMargin < 31200); }
for (const row of before) { assert.equal(previewSha(read(row.file)), row.sha); assert.equal(fs.statSync(path.join(repo, row.file)).mtimeMs, row.mtime); }
console.log(JSON.stringify({ providerCalls: 0, writes: 0, costUsd: 0, preserved: before,
  historicDini: { output, reasoning, visible: output - reasoning, visibleChars: dini.value.outputText.length },
  sparseSequenceChars: sparseChars, projected12, projected16,
  projectionOnly: 'cross-artifact capacity estimate, not observed joint-plan output or semantic proof',
  outputPolicy: { pages8: 24000, pages12: 28000, pages16: 32000 }, promptCapacity }, null, 2));
