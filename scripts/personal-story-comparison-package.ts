/** Offline only. This command cannot generate text, spend, read a key or reopen a trial. */
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { resolvePersonalWizardOptions } from '../lib/personal-wizard/options';
import { buildStoryComparison, renderBlindStoryComparison, storyReviewPacket, STORY_REVIEW_PHASES } from '../lib/personal-wizard/story-comparison';

export function main(argv = process.argv.slice(2)) {
  if (argv.length !== 4 || argv[0] !== '--manifest' || argv[2] !== '--output-name' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(argv[3])) throw Error('story_comparison_arguments');
  const outputs = path.resolve('outputs');
  if (!existsSync(outputs) || lstatSync(outputs).isSymbolicLink() || realpathSync(outputs).toLowerCase() !== outputs.toLowerCase()) throw Error('story_comparison_output_root');
  const root = path.join(outputs, argv[3]);
  if (existsSync(root)) throw Error('story_comparison_already_exists');
  // All structural/binding checks happen before writing a package.
  const manifest = JSON.parse(readFileSync(path.resolve(argv[1]), 'utf8'));
  const packageData = buildStoryComparison(manifest, resolvePersonalWizardOptions());
  mkdirSync(root);
  for (const phase of STORY_REVIEW_PHASES) {
    const phaseRoot = path.join(root, `review-${phase}`); mkdirSync(phaseRoot);
    writeFileSync(path.join(phaseRoot, 'review.json'), JSON.stringify(storyReviewPacket(packageData.blind, phase), null, 2), { flag: 'wx' });
    writeFileSync(path.join(phaseRoot, 'index.html'), renderBlindStoryComparison(packageData.blind, phase), { flag: 'wx' });
  }
  // Outside all reviewer folders. Directory separation is NOT access control.
  writeFileSync(path.join(root, 'private-evidence.json'), JSON.stringify(packageData.privateEvidence, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ output: root, cases: manifest.cases.length,
    firstDraftPairs: packageData.blind.firstDraftPairs.length, editingPairs: packageData.blind.editingPairs.length,
    finalTexts: packageData.blind.finalTexts.length, providerCalls: 0, keyReads: 0, costUsd: 0,
    distributeOnePhasePerReviewer: STORY_REVIEW_PHASES.map(phase => `review-${phase}/`),
    neverDistributeRoot: true, noQualityVerdict: true }));
}
if (require.main === module) {
  try { main(); } catch { console.error('story_comparison_failed'); process.exitCode = 1; }
}
