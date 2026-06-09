/**
 * Shared STOP 3 gate runner (prose repair rerun + full STOP 3).
 */

import fs from 'fs';
import path from 'path';

import { normalizePartialGenderChips } from '../story-gen/chip-normalize';
import { scanChipSafety } from '../story-gen/chip-safety';
import { applyTtsAmbiguityNiqqudPass } from '../story-gen-v2/tts-ambiguity-niqqud';
import { applyV3ChipArtifactFixes } from './chip-artifact-fix';
import { pageCountForSpec } from './confidence-batch-specs';
import { scanChildCompanionBodyPartLeak } from './companion-body-part-guard';
import { derivePageCountFromStoryMarkdown } from './derive-page-count';
import { runHebrewReadAloudEditor } from './hebrew-read-aloud-editor';
import { scanMedicalProseRisks } from './medical-prose-guardrails';
import { scanSuffixChipsInMarkdown } from './suffix-chip-scan';
import {
  renderStoryMdFromFiles,
  syncStoryPagesFromMarkdown,
} from './story-md-renderer';
import { validateStoryMdReadBack } from './story-read-back-validation';
import { runStoryAliveGate } from './story-alive-gate';
import type { PageBeatV3, PremiseExperimentSpecV3, StoryPremiseCandidate } from './types';

const MODEL_ID = 'gpt-5-chat-latest';

export interface Stop3GateResult {
  runDir: string;
  pageCount: number;
  storyAliveVerdict: string;
  hebrewVerdict: string;
  readBackPass: boolean;
  medicalRisks: number;
  bodyPartLeaks: number;
  suffixChipHits: number;
  humanApproved: false;
  gatePassAutomated: boolean;
}

export async function rerunStop3Gates(args: {
  runDir: string;
  spec: PremiseExperimentSpecV3;
  premise: StoryPremiseCandidate;
  beats: PageBeatV3[];
  regenerateNiqqud?: boolean;
}): Promise<Stop3GateResult> {
  const runDir = path.resolve(args.runDir);
  const storyMdPath = path.join(runDir, 'story.md');
  let md = fs.readFileSync(storyMdPath, 'utf8');
  const pageCount =
    pageCountForSpec(args.spec) || derivePageCountFromStoryMarkdown(md);

  if (args.regenerateNiqqud) {
    md = applyV3ChipArtifactFixes(md).markdown;
    const chipNorm = normalizePartialGenderChips(md);
    md = chipNorm.markdown.replace(/\r?\nWORD_COUNT:[\s\S]*$/i, '').trim();
    const { markdown: withNiqqud } = applyTtsAmbiguityNiqqudPass(md);
    md = withNiqqud;
    fs.writeFileSync(storyMdPath, md, 'utf8');
  }

  const chipNorm = normalizePartialGenderChips(md);
  md = chipNorm.markdown;
  fs.writeFileSync(storyMdPath, md, 'utf8');

  const storyPagesPath = path.join(runDir, 'story-pages.json');
  syncStoryPagesFromMarkdown(md, storyPagesPath);
  renderStoryMdFromFiles({ storyMarkdownPath: storyMdPath, storyPagesPath });
  md = fs.readFileSync(storyMdPath, 'utf8');

  const chipSafety = scanChipSafety(md);
  const alive = runStoryAliveGate({
    storyMarkdown: md,
    beats: args.beats,
    chipSafety,
    chipNormalizeFailed: chipNorm.report.advisoryFail,
    companionId: args.spec.companionId,
    premise: args.premise,
    endingProfile: 'confidence_generic',
    expectedPageCount: pageCount,
  });

  const bodyPartLeaks =
    args.spec.companionId === 'bunny_ometz'
      ? scanChildCompanionBodyPartLeak(md, 'ears')
      : [];
  const suffixChipScan = scanSuffixChipsInMarkdown(md);
  const medicalRisks =
    args.spec.category === 'MEDICAL_PROCEDURE' ? scanMedicalProseRisks(md) : [];

  const hebrew = await runHebrewReadAloudEditor({
    storyMarkdownPath: storyMdPath,
    storyPagesPath,
    pageBeatsPath: path.join(runDir, 'page-beats.json'),
    storySpinePath: path.join(runDir, 'story-spine.json'),
    companionId: args.spec.companionId,
    targetReadAloudAge: '5–8',
    childAgeMin: 5,
    childAgeMax: 8,
    mode: 'apply_high_confidence_fixes',
    modelId: MODEL_ID,
    outputDir: runDir,
    goldenReferenceIds: args.spec.calibrationGoldenIds,
    expectedPageCount: pageCount,
    endingProfile: 'confidence_generic',
  });

  md = fs.readFileSync(storyMdPath, 'utf8');
  const readBackFinal = validateStoryMdReadBack({
    storyMarkdownPath: storyMdPath,
    expectedPageCount: pageCount,
    endingProfile: 'custom',
    storyPagesPath,
  });

  const gatePassAutomated =
    alive.verdict !== 'FAIL' &&
    !chipSafety.advisoryFail &&
    readBackFinal.failures.length === 0 &&
    medicalRisks.length === 0 &&
    bodyPartLeaks.length === 0 &&
    suffixChipScan.suffixChipPass &&
    hebrew.verdict === 'AUTHOR_PASS_HEBREW';

  const selfCheck = {
    storyAliveVerdict: alive.verdict,
    hebrewVerdict: hebrew.verdict,
    readBackPass: readBackFinal.failures.length === 0,
    medicalProseRisks: medicalRisks.length,
    childCompanionBodyPartLeaks: bodyPartLeaks.length,
    suffixChipHits: suffixChipScan.suffixChipCount,
    suffixChipPass: suffixChipScan.suffixChipPass,
    humanApproved: false as const,
    humanAloudReadRequired: true,
    gatePassAutomated,
    chipSafetyPass: !chipSafety.advisoryFail,
  };

  fs.writeFileSync(path.join(runDir, 'story-alive-report.json'), JSON.stringify(alive, null, 2));
  fs.writeFileSync(path.join(runDir, 'chip-safety-report.json'), JSON.stringify(chipSafety, null, 2));
  fs.writeFileSync(path.join(runDir, 'chip-normalize-report.json'), JSON.stringify(chipNorm.report, null, 2));
  fs.writeFileSync(path.join(runDir, 'read-back-validation.json'), JSON.stringify(readBackFinal, null, 2));
  fs.writeFileSync(
    path.join(runDir, 'hebrew-read-aloud-report.json'),
    JSON.stringify(hebrew, null, 2)
  );
  fs.writeFileSync(
    path.join(runDir, 'medical-prose-risk-report.json'),
    JSON.stringify({ hits: medicalRisks, humanAloudReadRequired: true }, null, 2)
  );
  fs.writeFileSync(
    path.join(runDir, 'companion-body-part-report.json'),
    JSON.stringify({ hits: bodyPartLeaks }, null, 2)
  );
  fs.writeFileSync(
    path.join(runDir, 'suffix-chip-report.json'),
    JSON.stringify(suffixChipScan, null, 2)
  );
  fs.writeFileSync(path.join(runDir, 'self-check.json'), JSON.stringify(selfCheck, null, 2));

  return {
    runDir,
    pageCount,
    storyAliveVerdict: alive.verdict,
    hebrewVerdict: hebrew.verdict,
    readBackPass: readBackFinal.failures.length === 0,
    medicalRisks: medicalRisks.length,
    bodyPartLeaks: bodyPartLeaks.length,
    suffixChipHits: suffixChipScan.suffixChipCount,
    humanApproved: false,
    gatePassAutomated,
  };
}
