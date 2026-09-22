'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const Module = require('node:module'), { execFileSync } = require('node:child_process');
const ts = require('typescript');
const { previewSha, previewStory, previewStoryEvidence } = require('../../../../../lib/local-story-preview.ts');
const { validateBookSequence } = require('../../../../../lib/local-book-sequence.ts');
const { loadOwnerDraft } = require('../../../../../scripts/run-owner-book-draft.ts');
const repo = path.resolve(__dirname, '../../../../..');
globalThis.fetch = () => { throw Error('offline_provider_forbidden'); };
const config = JSON.parse(fs.readFileSync(path.join(repo, 'outputs/panda-book-sequence-input-20260919/config.json'), 'utf8'));
const records = [config.story, config.plan, config.sequence];
const snap = () => records.map(r => { const file = path.join(repo, r.file); return { sha: previewSha(fs.readFileSync(file)), bytes: fs.statSync(file).size, mtimeMs: fs.statSync(file).mtimeMs }; });
const before = snap(); before.forEach((r, i) => assert.equal(r.sha, records[i].sha));
const { story, plan, sequence } = loadOwnerDraft(repo, config);
function baselineModule(relative) {
  const filename = path.join(repo, relative);
  const loaded = new Module(filename, module); loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const source = execFileSync('git', ['show', `9d0bbe1d:${relative}`], { cwd: repo, encoding: 'utf8' });
  loaded._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  return loaded.exports;
}
const baseline = baselineModule('lib/local-book-sequence.ts');
const legacy = { plan, planSha: config.plan.sha, sourceSha: config.story.sha,
  texts: [story.title, ...story.pages.map(p => p.text + ' extra')] };
assert.deepEqual(baseline.validateBookSequence(sequence, legacy), sequence);
assert.throws(() => validateBookSequence(sequence, legacy), /source_binding/);
const current = { plan, planSha: config.plan.sha, story };
assert.deepEqual(validateBookSequence(sequence, current), sequence);
assert.throws(() => validateBookSequence(sequence, { ...current, texts: legacy.texts }), /source_binding/);
assert.throws(() => validateBookSequence(sequence, { ...current, story: structuredClone(story) }), /source_binding/);
const evidence = previewStoryEvidence(story); evidence.texts[1] += ' forged';
assert.notDeepEqual(previewStoryEvidence(story), evidence);
const raw = fs.readFileSync(path.join(repo, config.story.file), 'utf8');
assert.deepEqual(previewStory(raw, config.childName, config.gender), story);
assert.equal(JSON.stringify(baselineModule('lib/local-story-preview.ts').previewStory(raw, config.childName, config.gender)), JSON.stringify(story));
const tampered = previewStory(raw, config.childName, config.gender); tampered.pages.forEach(p => { p.text += ' extra'; });
assert.throws(() => validateBookSequence(sequence, { ...current, story: tampered }), /source_binding/);
assert.deepEqual(snap(), before);
console.log(JSON.stringify({ baseline: '9d0bbe1d', baselineAcceptedDetachedTexts: true,
  currentRejectsDetachedTexts: true, currentRejectsMutatedStory: true, currentRejectsClone: true,
  validSequenceUnchanged: true, parsedStoryBytesUnchanged: true, defensiveCopy: true,
  preserved: before, providerCalls: 0, writes: 0, costUsd: 0 }, null, 2));
