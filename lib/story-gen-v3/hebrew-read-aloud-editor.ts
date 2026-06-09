/**
 * HebrewReadAloudEditor v0 — diagnose + safe/high-confidence local fixes.
 */

import fs from 'fs';
import path from 'path';

import { normalizePartialGenderChips } from '../story-gen/chip-normalize';
import { scanChipSafety } from '../story-gen/chip-safety';
import { pageProseOnly, parseStoryPages } from '../story-gen/story-page-utils';
import { OpenAIResponsesLLM } from '../story-generator/llm';
import { applyV3ChipArtifactFixes } from './chip-artifact-fix';
import {
  DINI_POPCORN_PROTECTED_LINES,
  HEBREW_EDITORIAL_PRECEDENTS,
  isProtectedLine,
  type HebrewEditorialPrecedent,
} from './hebrew-editorial-precedents';
import { buildHebrewReadAloudCalibrationBlock } from './hebrew-read-aloud-goldens';
import {
  renderStoryMdFromFiles,
  syncStoryPagesFromMarkdown,
  writeStoryPagesJson,
  type StoryPageRecord,
} from './story-md-renderer';
import {
  scanRawArtifactTokensInMarkdown,
  scanSlashChipsInMarkdown,
} from './artifact-token-scan';
import { derivePageCountFromStoryMarkdown } from './derive-page-count';
import { validateStoryMdReadBack } from './story-read-back-validation';
import { runStoryAliveGate } from './story-alive-gate';
import type { PageBeatV3 } from './types';
import type {
  HebrewReadAloudAppliedFix,
  HebrewReadAloudHumanDecision,
  HebrewReadAloudInput,
  HebrewReadAloudIssue,
  HebrewReadAloudMode,
  HebrewReadAloudReadBackValidation,
  HebrewReadAloudReport,
  HebrewReadAloudVerdict,
} from './hebrew-read-aloud-types';

const EDITOR_SYSTEM = `You are a senior Hebrew children's-book editor for ages 5–8.
You specialize in read-aloud Hebrew prose.
Your job is not to make the text prettier.
Your job is to decide whether each line sounds natural when read aloud by a Hebrew-speaking parent.
Preserve story structure, humor anchors, companion voice, chips, placeholders, protected lines, and page count.
Diagnose first. Suggest only unless actionMode is SAFE_FIX or HIGH_CONFIDENCE_EDITORIAL_FIX with high confidence.
A line can be logically correct and still fail if it sounds strange aloud.
A line can sound unusual and still be good if it fits the character and reads well.
Return JSON: { "issues": [ ...HebrewReadAloudIssue[] ] }`.trim();

function stripNiqqud(s: string): string {
  return s.replace(/[\u0591-\u05C7]/g, '');
}

function normLine(s: string): string {
  return stripNiqqud(s).trim();
}

export function readStoryMarkdownFromDisk(storyMarkdownPath: string): string {
  const abs = path.resolve(storyMarkdownPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`story.md not found: ${abs}`);
  }
  const buf = fs.readFileSync(abs);
  if (!buf.length) throw new Error(`story.md is empty: ${abs}`);
  return buf.toString('utf8');
}

function getProseLinesByPage(markdown: string): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const { page, body } of parseStoryPages(markdown)) {
    const lines = pageProseOnly(body)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    map.set(page, lines);
  }
  return map;
}

function precedentToIssue(
  page: number,
  exactLine: string,
  p: HebrewEditorialPrecedent
): HebrewReadAloudIssue {
  const requiresHuman =
    p.allowedActionMode === 'TASTE_CALL' ||
    p.allowedActionMode === 'PROTECTED_LINE_SUGGEST_ONLY' ||
    p.allowedActionMode === 'STRUCTURAL_CONCERN';

  return {
    id: `prec-${p.id}`,
    page,
    exactLine,
    issueType: p.issueType,
    severity: p.severity,
    actionMode: p.allowedActionMode,
    confidence: p.confidence,
    whyItFailsAloud: p.whyBad,
    suggestedReplacement: p.approvedPattern ?? p.approvedBlock?.join('\n'),
    alternateReplacements: p.alternateReplacements,
    replacementRisk: p.allowedActionMode === 'SAFE_FIX' ? 'low' : 'medium',
    preserveMeaningNotes: p.notes,
    requiresHumanDecision: requiresHuman,
  };
}

function findConsecutiveBlock(lines: string[], block: string[]): number {
  for (let i = 0; i <= lines.length - block.length; i++) {
    let ok = true;
    for (let j = 0; j < block.length; j++) {
      if (normLine(lines[i + j]) !== normLine(block[j])) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

export function runDeterministicDiagnosis(
  markdown: string,
  protectedLines: string[]
): HebrewReadAloudIssue[] {
  const issues: HebrewReadAloudIssue[] = [];
  const seen = new Set<string>();

  for (const [page, lines] of getProseLinesByPage(markdown)) {
    for (const p of HEBREW_EDITORIAL_PRECEDENTS) {
      if (p.skipDiagnosis || p.guyDecision === 'KEEP') continue;
      if (p.replaceLines?.length && p.approvedBlock?.length) {
        const idx = findConsecutiveBlock(lines, p.replaceLines);
        if (idx < 0) continue;
        const exactLine = p.replaceLines.join(' / ');
        const key = `${page}:${p.id}:block`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (protectedLines.some((pl) => p.replaceLines!.every((rl) => isProtectedLine(rl, [pl])))) {
          continue;
        }
        issues.push(precedentToIssue(page, exactLine, p));
        continue;
      }

      for (const line of lines) {
        if (isProtectedLine(line, protectedLines)) continue;
        const match =
          (p.badRegex && p.badRegex.test(line)) ||
          (line.includes(p.badPattern) && !p.badRegex);
        if (!match) continue;
        const key = `${page}:${p.id}:${normLine(line)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        issues.push(precedentToIssue(page, line, p));
      }
    }
  }

  for (const hit of scanRawArtifactTokensInMarkdown(markdown).hits) {
    const key = `artifact:${hit.page}:${hit.token}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push({
      id: `raw-artifact-${hit.page}-${hit.token}`,
      page: hit.page,
      exactLine: hit.line,
      issueType: 'raw_artifact_token_in_prose',
      severity: 'high',
      actionMode: 'FAIL',
      confidence: 1,
      whyItFailsAloud: `Raw internal token ${hit.token} must not appear in read-aloud prose.`,
      replacementRisk: 'high',
      requiresHumanDecision: false,
    });
  }

  for (const hit of scanSlashChipsInMarkdown(markdown).hits) {
    const key = `slash:${hit.page}:${hit.match}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push({
      id: `slash-chip-${hit.page}-${hit.match}`,
      page: hit.page,
      exactLine: hit.line,
      issueType: 'slash_chip_style',
      severity: 'high',
      actionMode: 'FAIL',
      confidence: 1,
      whyItFailsAloud: `Slash chip "${hit.match}" must be full {male|female} curly form.`,
      replacementRisk: 'low',
      requiresHumanDecision: false,
    });
  }

  return issues;
}

export async function runLlmDiagnosis(args: {
  markdown: string;
  input: HebrewReadAloudInput;
  protectedLines: string[];
  deterministicIssues: HebrewReadAloudIssue[];
  modelId: string;
}): Promise<HebrewReadAloudIssue[]> {
  const calibration = buildHebrewReadAloudCalibrationBlock(args.input.goldenReferenceIds);
  const pages = parseStoryPages(args.markdown);
  const storyBlock = pages
    .map(({ page, body }) => `--- Page ${page} ---\n${pageProseOnly(body)}`)
    .join('\n\n');

  const protectedBlock = args.protectedLines.map((l) => `- ${l}`).join('\n');
  const detSummary = args.deterministicIssues
    .map((i) => `p${i.page}: ${i.exactLine.slice(0, 50)} (${i.actionMode})`)
    .join('\n');

  const userPrompt = `
TARGET: Hebrew read-aloud ages ${args.input.targetReadAloudAge ?? '5–8'}
Companion: ${args.input.companionId ?? 'unknown'}
${args.input.companionVoiceNotes ? `Voice notes: ${args.input.companionVoiceNotes}` : ''}

PROTECTED LINES (do not suggest auto-fix):
${protectedBlock}

CALIBRATION GOLDENS:
${calibration}

DETERMINISTIC FLAGS ALREADY FOUND (do not duplicate):
${detSummary || '(none)'}

FULL STORY PROSE:
${storyBlock}

Diagnose Hebrew read-aloud issues. For each issue include all fields.
Use actionMode TASTE_CALL for subjective joke/voice calls.
Use STRUCTURAL_CONCERN only for plot/agency failures — not Hebrew taste.
Max 12 issues. Prioritize high/medium severity.
`.trim();

  const llm = new OpenAIResponsesLLM(args.modelId);
  const result = await llm.call({
    stage: 'v3-hebrew-read-aloud-diagnose',
    systemPrompt: EDITOR_SYSTEM,
    userPrompt,
    maxOutputTokens: 8000,
    jsonMode: true,
    temperature: 0.35,
  });

  let parsed: { issues?: HebrewReadAloudIssue[] };
  try {
    parsed = JSON.parse(result.text) as { issues?: HebrewReadAloudIssue[] };
  } catch {
    return [];
  }

  return (parsed.issues ?? []).filter((i) => i.page && i.exactLine);
}

function mergeIssues(
  deterministic: HebrewReadAloudIssue[],
  llm: HebrewReadAloudIssue[]
): HebrewReadAloudIssue[] {
  const out = [...deterministic];
  for (const issue of llm) {
    const dup = out.some(
      (d) =>
        d.page === issue.page &&
        (normLine(d.exactLine) === normLine(issue.exactLine) ||
          d.exactLine.includes(issue.exactLine) ||
          issue.exactLine.includes(d.exactLine))
    );
    if (!dup) out.push({ ...issue, id: issue.id || `llm-${issue.page}-${out.length}` });
  }
  return out;
}

function splitPageBody(body: string): { imageDirection: string; prose: string } {
  const trimmed = body.trim();
  const match = trimmed.match(/^imageDirection\s*:\s*(.+?)\r?\n\r?\n([\s\S]*)$/i);
  if (match) {
    return {
      imageDirection: `imageDirection: ${match[1].trim()}`,
      prose: match[2].trim(),
    };
  }
  const singleLine = trimmed.match(/^(imageDirection\s*:[^\n]+)\r?\n([\s\S]*)$/i);
  if (singleLine) {
    return { imageDirection: singleLine[1].trim(), prose: singleLine[2].trim() };
  }
  return { imageDirection: '', prose: pageProseOnly(trimmed) };
}

function joinPageBody(imageDirection: string, prose: string): string {
  const p = prose.trim();
  if (!imageDirection) return p;
  return `${imageDirection}\n\n${p}`;
}

function rebuildStoryMarkdown(
  originalMd: string,
  pageBodies: Map<number, string>
): string {
  const idx = originalMd.search(/\r?\n--- Page 1 ---/);
  const prefix = idx >= 0 ? originalMd.slice(0, idx).trimEnd() : '';
  const pages = parseStoryPages(originalMd);
  const section = pages
    .map((p) => {
      const body = pageBodies.get(p.page) ?? p.body;
      return `--- Page ${p.page} ---\n${body.trim()}`;
    })
    .join('\n\n');
  return `${prefix}\n${section}\n`;
}

function canAutoApply(issue: HebrewReadAloudIssue, mode: HebrewReadAloudMode): boolean {
  if (issue.requiresHumanDecision) return false;
  if (
    issue.actionMode === 'SAFE_FIX' &&
    (mode === 'apply_safe_fixes' || mode === 'apply_high_confidence_fixes')
  ) {
    return issue.confidence >= 0.95;
  }
  if (
    issue.actionMode === 'HIGH_CONFIDENCE_EDITORIAL_FIX' &&
    mode === 'apply_high_confidence_fixes'
  ) {
    return issue.confidence >= 0.9;
  }
  return false;
}

function replaceInPageBody(
  body: string,
  before: string,
  after: string
): { body: string; replaced: boolean } {
  const { imageDirection, prose } = splitPageBody(body);
  if (!prose.includes(before)) return { body, replaced: false };
  const newProse = prose.replace(before, after);
  return { body: joinPageBody(imageDirection, newProse), replaced: true };
}

function replaceBlockInPage(
  pageBody: string,
  replaceLines: string[],
  approvedBlock: string[]
): { body: string; replaced: boolean } {
  const { imageDirection, prose } = splitPageBody(pageBody);
  const proseLines = prose
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const idx = findConsecutiveBlock(proseLines, replaceLines);
  if (idx < 0) return { body: pageBody, replaced: false };

  const newProseLines = [
    ...proseLines.slice(0, idx),
    ...approvedBlock,
    ...proseLines.slice(idx + replaceLines.length),
  ];
  return {
    body: joinPageBody(imageDirection, newProseLines.join('\n')),
    replaced: true,
  };
}

export function applyHebrewReadAloudFixes(
  markdown: string,
  issues: HebrewReadAloudIssue[],
  mode: HebrewReadAloudMode,
  protectedLines: string[]
): { markdown: string; applied: HebrewReadAloudAppliedFix[]; touchedProtected: Array<{ page: number; line: string; reason: string }> } {
  const applied: HebrewReadAloudAppliedFix[] = [];
  const touchedProtected: Array<{ page: number; line: string; reason: string }> = [];
  const pageBodies = new Map<number, string>();
  for (const { page, body } of parseStoryPages(markdown)) {
    pageBodies.set(page, body);
  }

  const toApply = issues.filter((i) => canAutoApply(i, mode));

  for (const issue of toApply) {
    if (isProtectedLine(issue.exactLine, protectedLines)) {
      touchedProtected.push({
        page: issue.page,
        line: issue.exactLine,
        reason: 'protected — skipped auto-apply',
      });
      continue;
    }

    const precedent = HEBREW_EDITORIAL_PRECEDENTS.find((p) => issue.id === `prec-${p.id}`);
    const currentBody = pageBodies.get(issue.page);
    if (!currentBody) continue;

    let newBody = currentBody;
    let replaced = false;
    let after = issue.suggestedReplacement ?? '';

    if (precedent?.replaceLines && precedent.approvedBlock) {
      const r = replaceBlockInPage(newBody, precedent.replaceLines, precedent.approvedBlock);
      newBody = r.body;
      replaced = r.replaced;
      after = precedent.approvedBlock.join('\n');
    } else if (issue.suggestedReplacement) {
      const r = replaceInPageBody(newBody, issue.exactLine, issue.suggestedReplacement);
      newBody = r.body;
      replaced = r.replaced;
    }

    if (!replaced) continue;

    pageBodies.set(issue.page, newBody);
    applied.push({
      page: issue.page,
      before: issue.exactLine,
      after,
      actionMode: issue.actionMode,
      confidence: issue.confidence,
      reason: issue.whyItFailsAloud,
    });
  }

  const md = rebuildStoryMarkdown(markdown, pageBodies);
  return { markdown: md, applied, touchedProtected };
}

export function validateReadBack(args: {
  storyMarkdownPath: string;
  appliedFixes: HebrewReadAloudAppliedFix[];
  badLinesRemoved: string[];
  expectedPageCount?: number;
  endingProfile?: 'dini_popcorn' | 'koko_transition' | 'confidence_generic';
  storyPagesPath?: string;
}): HebrewReadAloudReadBackValidation {
  const md = readStoryMarkdownFromDisk(args.storyMarkdownPath);
  const pageCount = args.expectedPageCount ?? derivePageCountFromStoryMarkdown(md);
  const result = validateStoryMdReadBack({
    storyMarkdownPath: args.storyMarkdownPath,
    expectedPageCount: pageCount,
    appliedFixes: args.appliedFixes,
    badLinesRemoved: args.badLinesRemoved,
    endingProfile: args.endingProfile ?? 'dini_popcorn',
    storyPagesPath: args.storyPagesPath,
  });
  return {
    storyMdReadBack: result.storyMdReadBack && result.readFromDisk,
    validUtf8: result.validUtf8,
    completedEnding: result.completedEnding,
    allPagesPresent: result.allPagesPresent,
    appliedLinesPresent: result.appliedLinesPresent,
    badLinesRemoved: result.badLinesRemoved,
  };
}

function buildHumanDecisions(issues: HebrewReadAloudIssue[]): HebrewReadAloudHumanDecision[] {
  return issues
    .filter((i) => i.actionMode === 'TASTE_CALL' || i.requiresHumanDecision)
    .map((i) => {
      const precedent = HEBREW_EDITORIAL_PRECEDENTS.find((p) => i.id === `prec-${p.id}`);
      const options = [
        `Keep: ${i.exactLine}`,
        ...(i.alternateReplacements ?? []),
        ...(i.suggestedReplacement ? [i.suggestedReplacement] : []),
      ];
      return {
        page: i.page,
        line: i.exactLine,
        options: [...new Set(options)],
        recommendation:
          precedent?.recommendation ??
          i.suggestedReplacement ??
          'Human read-aloud decides.',
        whyHumanNeeded: i.whyItFailsAloud,
      };
    });
}

function countIssues(issues: HebrewReadAloudIssue[]) {
  return {
    low: issues.filter((i) => i.severity === 'low').length,
    medium: issues.filter((i) => i.severity === 'medium').length,
    high: issues.filter((i) => i.severity === 'high').length,
    safeFix: issues.filter((i) => i.actionMode === 'SAFE_FIX').length,
    highConfidenceFix: issues.filter((i) => i.actionMode === 'HIGH_CONFIDENCE_EDITORIAL_FIX').length,
    tasteCall: issues.filter((i) => i.actionMode === 'TASTE_CALL').length,
    protectedSuggestOnly: issues.filter((i) => i.actionMode === 'PROTECTED_LINE_SUGGEST_ONLY').length,
    structuralConcern: issues.filter((i) => i.actionMode === 'STRUCTURAL_CONCERN').length,
  };
}

function deriveVerdict(
  mode: HebrewReadAloudMode,
  issues: HebrewReadAloudIssue[],
  applied: HebrewReadAloudAppliedFix[],
  readBack: HebrewReadAloudReadBackValidation,
  opts?: { chipSafetyPass?: boolean; storyAlivePass?: boolean }
): HebrewReadAloudVerdict {
  if (issues.some((i) => i.actionMode === 'FAIL')) return 'FAIL';
  if (issues.some((i) => i.actionMode === 'STRUCTURAL_CONCERN')) return 'STRUCTURAL_CONCERN';
  if (!readBack.storyMdReadBack || !readBack.validUtf8 || !readBack.completedEnding) {
    return 'FAIL';
  }
  if (applied.some((a) => a.actionMode === 'HIGH_CONFIDENCE_EDITORIAL_FIX')) {
    return 'HIGH_CONFIDENCE_FIXES_APPLIED';
  }
  if (applied.length) return 'SAFE_FIXES_APPLIED';
  const blocking = issues.filter(
    (i) =>
      i.actionMode === 'TASTE_CALL' ||
      (i.requiresHumanDecision && i.actionMode !== 'PROTECTED_LINE_SUGGEST_ONLY')
  );
  if (blocking.length) return 'SUGGESTIONS_NEED_HUMAN';

  if (
    readBack.allPagesPresent &&
    readBack.appliedLinesPresent &&
    readBack.badLinesRemoved &&
    opts?.chipSafetyPass &&
    opts?.storyAlivePass
  ) {
    return 'AUTHOR_PASS_HEBREW';
  }
  if (!issues.length) return 'PASS';
  return 'SUGGESTIONS_NEED_HUMAN';
}

export function buildHebrewReadAloudReportMd(report: HebrewReadAloudReport, runDir: string): string {
  return [
    '# HebrewReadAloudEditor v0',
    '',
    `**Verdict:** ${report.verdict}`,
    `**Mode:** ${report.mode}`,
    `**Summary:** ${report.summary}`,
    '',
    '## Gates',
    `- completed_p12 (read-back): ${report.readBackValidation.completedEnding ? 'yes' : 'no'}`,
    `- chip_safety: ${report.chipSafetyPass ? 'pass' : 'fail'}`,
    `- chip_normalize: ${report.chipNormalizePass ? 'pass' : 'fail'}`,
    `- story_alive: ${report.storyAliveVerdict ?? 'n/a'}`,
    `- prose_not_image_prompt: see StoryAlive`,
    '',
    '## Issue counts',
    JSON.stringify(report.issueCounts, null, 2),
    '',
    '## Applied fixes',
    ...(report.appliedFixes.length
      ? report.appliedFixes.map(
          (f) => `- p${f.page} [${f.actionMode}]: \`${f.before.slice(0, 40)}…\` → \`${f.after.slice(0, 40)}…\``
        )
      : ['- none']),
    '',
    '## Human decisions needed',
    ...(report.remainingHumanDecisions.length
      ? report.remainingHumanDecisions.map(
          (h) =>
            `### p${h.page}\n**Line:** ${h.line}\n**Why:** ${h.whyHumanNeeded}\n**Recommendation:** ${h.recommendation}\n**Options:**\n${h.options.map((o) => `- ${o}`).join('\n')}`
        )
      : ['- none']),
    '',
    '## Read-back validation',
    JSON.stringify(report.readBackValidation, null, 2),
    '',
    `Artifacts: \`${runDir}\``,
    '',
    '**HARD STOP — Guy reads aloud. No auto-approve.**',
  ].join('\n');
}

export async function runHebrewReadAloudEditor(
  input: HebrewReadAloudInput
): Promise<HebrewReadAloudReport> {
  const protectedLines = [
    ...DINI_POPCORN_PROTECTED_LINES,
    ...(input.protectedLines ?? []),
  ];

  const markdown = readStoryMarkdownFromDisk(input.storyMarkdownPath);
  const pageCount = input.expectedPageCount ?? derivePageCountFromStoryMarkdown(markdown);
  const endingProfile =
    input.endingProfile ??
    (input.companionId === 'chameleon_koko'
      ? 'koko_transition'
      : input.companionId === 'lion_shaket' ||
          input.companionId === 'bunny_ometz' ||
          input.companionId === 'turtle_beiti'
        ? 'confidence_generic'
        : 'dini_popcorn');
  const artifactTokenScan = scanRawArtifactTokensInMarkdown(markdown);
  const slashChipStyle = scanSlashChipsInMarkdown(markdown);
  const deterministic = runDeterministicDiagnosis(markdown, protectedLines);

  let llmIssues: HebrewReadAloudIssue[] = [];
  if (!input.skipLlm) {
    llmIssues = await runLlmDiagnosis({
      markdown,
      input,
      protectedLines,
      deterministicIssues: deterministic,
      modelId: input.modelId ?? 'gpt-5-chat-latest',
    });
  }

  const issues = mergeIssues(deterministic, llmIssues);

  let workingMd = markdown;
  let applied: HebrewReadAloudAppliedFix[] = [];
  let touchedProtected: Array<{ page: number; line: string; reason: string }> = [];

  if (input.mode !== 'diagnose_only') {
    const result = applyHebrewReadAloudFixes(workingMd, issues, input.mode, protectedLines);
    workingMd = result.markdown;
    applied = result.applied;
    touchedProtected = result.touchedProtected;

    workingMd = applyV3ChipArtifactFixes(workingMd).markdown;
    const chipNorm = normalizePartialGenderChips(workingMd);
    workingMd = chipNorm.markdown.replace(/\r?\nWORD_COUNT:[\s\S]*$/i, '').trim();
    workingMd = applyV3ChipArtifactFixes(workingMd).markdown;

    const outDir = input.outputDir ?? path.dirname(path.resolve(input.storyMarkdownPath));
    fs.mkdirSync(outDir, { recursive: true });
    const storyMdPath = path.resolve(input.storyMarkdownPath);
    const storyPagesPath =
      input.storyPagesPath ?? path.join(outDir, 'story-pages.json');

    syncStoryPagesFromMarkdown(workingMd, storyPagesPath);
    renderStoryMdFromFiles({ storyMarkdownPath: storyMdPath, storyPagesPath });
    workingMd = readStoryMarkdownFromDisk(storyMdPath);

    const chipSafety = scanChipSafety(workingMd);
    fs.writeFileSync(
      path.join(outDir, 'chip-safety-report.json'),
      JSON.stringify(chipSafety, null, 2)
    );
    fs.writeFileSync(
      path.join(outDir, 'chip-normalize-report.json'),
      JSON.stringify(chipNorm.report, null, 2)
    );

    let beats: PageBeatV3[] = [];
    const beatsPath = input.pageBeatsPath ?? path.join(outDir, 'page-beats.json');
    if (fs.existsSync(beatsPath)) {
      beats = JSON.parse(fs.readFileSync(beatsPath, 'utf8')) as PageBeatV3[];
    }
    const alive = runStoryAliveGate({
      storyMarkdown: workingMd,
      beats,
      chipSafety,
      chipNormalizeFailed: chipNorm.report.advisoryFail,
      companionId: input.companionId,
      endingProfile,
      expectedPageCount: pageCount,
    });
    fs.writeFileSync(path.join(outDir, 'story-alive-report.json'), JSON.stringify(alive, null, 2));

    const readBackFull = validateStoryMdReadBack({
      storyMarkdownPath: storyMdPath,
      appliedFixes: applied,
      badLinesRemoved: applied.map((a) => a.before),
      expectedPageCount: pageCount,
      endingProfile,
      storyPagesPath,
    });
    const readBack = validateReadBack({
      storyMarkdownPath: storyMdPath,
      appliedFixes: applied,
      badLinesRemoved: applied.map((a) => a.before),
      expectedPageCount: pageCount,
      endingProfile,
      storyPagesPath,
    });

    let verdict = deriveVerdict(input.mode, issues, applied, readBack, {
      chipSafetyPass: !chipSafety.advisoryFail,
      storyAlivePass: alive.verdict === 'PASS' || alive.verdict === 'AUTHOR_PASS',
    });
    if (readBackFull.failures.length) {
      verdict = 'FAIL';
    }

    const report: HebrewReadAloudReport = {
      verdict,
      mode: input.mode,
      summary: `Diagnosed ${issues.length} issue(s); applied ${applied.length} fix(es).`,
      issueCounts: countIssues(issues),
      issues,
      appliedFixes: applied,
      remainingHumanDecisions: buildHumanDecisions(issues),
      protectedLinesTouched: touchedProtected,
      readBackValidation: readBack,
      chipSafetyPass: !chipSafety.advisoryFail,
      chipNormalizePass: !chipNorm.report.advisoryFail,
      storyAliveVerdict: alive.verdict,
      artifactTokenScan,
      slashChipStyle,
    };

    const outDirResolved = path.resolve(outDir);
    fs.writeFileSync(
      path.join(outDirResolved, 'hebrew-read-aloud-report.json'),
      JSON.stringify(report, null, 2)
    );
    fs.writeFileSync(
      path.join(outDirResolved, 'hebrew-read-aloud-report.md'),
      buildHebrewReadAloudReportMd(report, outDirResolved)
    );

    return report;
  }

  const storyPagesPath =
    input.storyPagesPath ??
    path.join(path.dirname(path.resolve(input.storyMarkdownPath)), 'story-pages.json');
  const readBackFull = validateStoryMdReadBack({
    storyMarkdownPath: input.storyMarkdownPath,
    expectedPageCount: pageCount,
    endingProfile,
    storyPagesPath: fs.existsSync(storyPagesPath) ? storyPagesPath : undefined,
  });
  const readBack = validateReadBack({
    storyMarkdownPath: input.storyMarkdownPath,
    appliedFixes: [],
    badLinesRemoved: [],
    expectedPageCount: pageCount,
    endingProfile,
    storyPagesPath: fs.existsSync(storyPagesPath) ? storyPagesPath : undefined,
  });

  const outDir = input.outputDir ?? path.dirname(path.resolve(input.storyMarkdownPath));
  const alivePath = path.join(outDir, 'story-alive-report.json');
  let storyAlivePass = false;
  if (fs.existsSync(alivePath)) {
    const aliveJson = JSON.parse(fs.readFileSync(alivePath, 'utf8')) as { verdict?: string };
    storyAlivePass = aliveJson.verdict === 'PASS' || aliveJson.verdict === 'AUTHOR_PASS';
  }

  let verdict = deriveVerdict(input.mode, issues, [], readBack, {
    chipSafetyPass: !scanChipSafety(readStoryMarkdownFromDisk(input.storyMarkdownPath)).advisoryFail,
    storyAlivePass,
  });
  if (readBackFull.failures.length) verdict = 'FAIL';

  const report: HebrewReadAloudReport = {
    verdict,
    mode: input.mode,
    summary: `Diagnosed ${issues.length} issue(s); no fixes applied (diagnose_only).`,
    issueCounts: countIssues(issues),
    issues,
    appliedFixes: [],
    remainingHumanDecisions: buildHumanDecisions(issues),
    protectedLinesTouched: [],
    readBackValidation: readBack,
    chipSafetyPass: !scanChipSafety(markdown).advisoryFail,
    chipNormalizePass: true,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'hebrew-read-aloud-report.json'),
    JSON.stringify(report, null, 2)
  );
  fs.writeFileSync(
    path.join(outDir, 'hebrew-read-aloud-report.md'),
    buildHebrewReadAloudReportMd(report, path.resolve(outDir))
  );

  return report;
}
