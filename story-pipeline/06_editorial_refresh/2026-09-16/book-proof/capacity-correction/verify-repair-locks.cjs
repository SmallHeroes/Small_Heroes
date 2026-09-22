'use strict';
// Offline Codex counter-check of Claude's a2d30f89. No writes or visual verdicts.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const Module = require('node:module'), { execFileSync } = require('node:child_process');
const ts = require('typescript');
const repo = path.resolve(__dirname, '../../../../..');
const { previewSha, selectedDraftQaContext } = require('../../../../../lib/local-story-preview.ts');
const { buildLocalRepairPrompt, preflightLocalBookPrompts, assertLocalImagePrompt } = require('../../../../../lib/local-preview-capacity.ts');
const { sequencePageState } = require('../../../../../lib/local-book-sequence.ts');
const { QUALITY_CATEGORIES } = require('../../../../../lib/local-preview-quality.ts');
const style = require('../../../../../lib/style01-gptimage.ts');
const { buildStyle01AnatomyIntegrityLock } = require('../../../../../lib/style01-visual-polish.ts');
const { loadOwnerDraft } = require('../../../../../scripts/run-owner-book-draft.ts');
globalThis.fetch = () => { throw Error('offline_provider_forbidden'); };
// Load the pre-fix module from Git into memory, never overwrite the working tree.
const source = execFileSync('git', ['show', 'f6bdf5f7:lib/local-preview-capacity.ts'], { cwd: repo, encoding: 'utf8' });
const filename = path.join(repo, 'lib/local-preview-capacity.ts');
const baseline = new Module(filename, module); baseline.filename = filename;
baseline.paths = Module._nodeModulePaths(path.dirname(filename));
baseline._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const configPath = path.join(repo, 'outputs/panda-book-sequence-input-20260919/config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const priorReviewPath = path.join(repo, 'outputs/panda-five-page-selected-sample-20260919/sample-page-02.json');
const preservedFiles = [configPath, path.join(repo, 'outputs/panda-book-sequence-input-20260919/sequence.json'), priorReviewPath];
const snapshot = () => preservedFiles.map(file => ({ file: path.relative(repo, file), sha: previewSha(fs.readFileSync(file)), mtimeMs: fs.statSync(file).mtimeMs }));
const before = snapshot();
const { plan, story, sequence } = loadOwnerDraft(repo, config);
const texts = [story.title, ...story.pages.map(p => p.text)];
const capacity = preflightLocalBookPrompts(plan, sequence, texts, config);
const rows = []; let currentAttributesChecked = 0;
for (const page of plan.pages) {
  const n = page.pageNumber, margin = n ? 512 : 0;
  const packet = n ? { ...sequencePageState(sequence, plan, n), predecessor: null } : null;
  const checks = QUALITY_CATEGORIES.map(category => ({ category, correction: 'X'.repeat(1800) }));
  const realistic = [{ category: 'anatomy', correction: 'Reconnect the forearm to its own elbow while preserving the child identity and existing pose.' }];
  const blocks = [style.STYLE_01_SHARED, style.STYLE_01_RENDERING_CORRECTION, style.STYLE_01_CANONICAL_CHILD_ANCHOR_RULE,
    style.buildStyle01ChildAnatomicalLock({ childAge: config.childAge, allowDistinctSupportingChildren: true }),
    buildStyle01AnatomyIntegrityLock(), page.shot === 'close' ? style.STYLE_01_FRAMING_RULE_CLOSE_UP : style.STYLE_01_FRAMING_RULE];
  const typical = buildLocalRepairPrompt(plan, n, texts[n], config, packet, 4, realistic);
  assert.equal(typical.lockTier, 'full'); blocks.forEach(block => assert(typical.prompt.includes(block)));
  const old = baseline.exports.localRepairPrompt(plan, n, texts[n], config, packet, 4, realistic);
  assert.equal(blocks.filter(block => old.includes(block)).length, 0); // original regression reproduced
  const selected = selectedDraftQaContext(plan, n);
  for (const refs of [3, 4]) {
    const worst = buildLocalRepairPrompt(plan, n, texts[n], config, packet, refs, checks, margin);
    const transport = assertLocalImagePrompt(worst.prompt + 'X'.repeat(margin), refs, true);
    assert(transport.finalPrompt.replace(/\r\n|\r|\n/g, '\r\n').length <= 32000);
    for (const c of checks) assert(worst.prompt.includes(`${c.category}: ${c.correction}`));
    const effective = JSON.parse(worst.prompt.split('\n').find(line => line.startsWith('CURRENT PAGE AUTHORITY: ')).slice(24));
    assert.deepEqual(effective, { ...selected, continuity: { ...selected.continuity,
      entities: selected.continuity.entities.map(({ id, kind, currentState }) => ({ id, kind, currentState })) } });
    if (packet) assert(worst.prompt.includes(JSON.stringify(packet)));
    if (worst.lockTier === 'none') assert.equal(worst.prompt, baseline.exports.localRepairPrompt(plan, n, texts[n], config, packet, refs, checks));
    if (refs === 4) {
      currentAttributesChecked += selected.continuity.entities.reduce((sum, e) => sum + Object.keys(e.currentState).length, 0);
      rows.push({ page: n, typicalTier: typical.lockTier, maximumCorrectionTier: worst.lockTier,
        maximumCorrectionMultipartChars: transport.finalPrompt.replace(/\r\n|\r|\n/g, '\r\n').length });
    }
  }
  const threshold = capacity.rows[n].fullLockCorrectionCharsPerCategory;
  assert.notEqual(threshold, null);
  const tierAt = per => buildLocalRepairPrompt(plan, n, texts[n], config, packet, 4,
    QUALITY_CATEGORIES.map(category => ({ category, correction: 'X'.repeat(per) })), margin).lockTier;
  assert.equal(tierAt(threshold), 'full');
  if (threshold < 1800) assert.notEqual(tierAt(threshold + 1), 'full');
}
// Actual saved corrections are only replayed into prompt assembly. No new image or
// QA claim is made, and no historical context/candidate hash is rebound.
const saved = JSON.parse(fs.readFileSync(priorReviewPath, 'utf8'));
const savedChecks = saved.history.at(-1).review.checks.filter(c => c.verdict === 'defect');
assert.equal(savedChecks.length, 2);
const savedPacket = { ...sequencePageState(sequence, plan, 2), predecessor: null };
const savedRepair = buildLocalRepairPrompt(plan, 2, texts[2], config, savedPacket, 4, savedChecks);
assert.equal(savedRepair.lockTier, 'full');
savedChecks.forEach(c => assert(savedRepair.prompt.includes(c.correction.replace(/\s+/gu, ' ').trim())));
assertLocalImagePrompt(savedRepair.prompt, 4, true);
assert.deepEqual(snapshot(), before);
assert(!fs.existsSync(path.join(repo, 'outputs/panda-book-sequence-unexecuted-20260919')));
console.log(JSON.stringify({ providerCalls: 0, writes: 0, costUsd: 0,
  baseline: 'f6bdf5f7', baselineMissingBlocksPerPage: 6, currentMissingBlocksForTypicalCorrection: 0,
  currentAttributesChecked, referencesCheckedPerPage: [3, 4], rows,
  savedPage2CorrectionProbe: { defects: savedChecks.length, totalChars: savedChecks.reduce((sum, c) => sum + c.correction.length, 0),
    maximumSingleChars: Math.max(...savedChecks.map(c => c.correction.length)), lockTier: savedRepair.lockTier,
    scope: 'offline prompt assembly only; no render, re-QA or re-binding of historical evidence' },
  limitation: 'Synthetic corrections on saved inputs; not measured judge-length distribution or visual success.' }, null, 2));
