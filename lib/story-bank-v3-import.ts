/**
 * Shared validation + golden-source prep for v3-approved bank imports.
 * Write path: scripts/import-v3-approved-story.ts (requires Guy's approval.json).
 * Staging-only: stageGoldenImportRun() / scripts/stage-golden-v3-import-run.ts (never v3-approved/).
 */
import fs from 'fs';
import path from 'path';

import { getCompanionById } from './companions';
import {
  resolveStoryBankPlaceholders,
  runStoryPersonalizationGate,
  type WizardPersonalizationContext,
} from './story-bank-personalization';
import { parseStoryPages } from './story-gen/story-page-utils';
import {
  scanRawArtifactTokensInMarkdown,
  scanSlashChipsInMarkdown,
} from './story-gen-v3/artifact-token-scan';
import { scanSuffixChipsInMarkdown } from './story-gen-v3/suffix-chip-scan';

export const V3_PAGES_BY_DIRECTION: Record<string, number> = {
  bedtime: 8,
  adventure: 12,
  fantasy: 16,
};

export interface V3ImportValidation {
  companionId: string;
  direction: string;
  pageCount: number;
  errors: string[];
  personalizationWarnings: string[];
}

export type V3ImportGateMode = 'strict' | 'warn';

export const V3_APPROVED_REL = 'story-bank/v3-approved';

export interface V3ImportSelfCheck {
  gatePassAutomated?: boolean;
  personalizationGateWarnings?: string[];
}

export interface V3ImportApproval {
  approvedBy: string;
  approvedAt: string;
  note?: string;
}

export interface StageGoldenImportResult {
  runId: string;
  runDir: string;
  relRunDir: string;
  validation: V3ImportValidation;
}

export function resolveImportGateModeFromSelfCheck(selfCheck: V3ImportSelfCheck): V3ImportGateMode {
  return Array.isArray(selfCheck.personalizationGateWarnings) &&
    selfCheck.personalizationGateWarnings.length > 0
    ? 'warn'
    : 'strict';
}

export function resolveRepoRelativePath(repoRoot: string, rel: string): string {
  const resolved = path.resolve(repoRoot, rel);
  const rootNorm = path.resolve(repoRoot);
  if (!resolved.toLowerCase().startsWith(rootNorm.toLowerCase())) {
    throw new Error(`source escapes repo: ${rel}`);
  }
  return resolved;
}

export function assertNotV3ApprovedWrite(repoRoot: string, targetPath: string): void {
  const rel = path
    .relative(repoRoot, path.resolve(targetPath))
    .split(path.sep)
    .join('/');
  if (rel === V3_APPROVED_REL || rel.startsWith(`${V3_APPROVED_REL}/`)) {
    throw new Error(`refusing to write under ${V3_APPROVED_REL}: ${rel}`);
  }
}

export function readApprovalJson(runDir: string): V3ImportApproval | null {
  const approvalPath = path.join(runDir, 'approval.json');
  if (!fs.existsSync(approvalPath)) return null;
  const approval = JSON.parse(fs.readFileSync(approvalPath, 'utf8')) as Partial<V3ImportApproval>;
  if (!approval.approvedBy?.trim()) {
    throw new Error('approval.json missing non-empty approvedBy');
  }
  if (!approval.approvedAt || Number.isNaN(Date.parse(approval.approvedAt))) {
    throw new Error('approval.json approvedAt is not a valid ISO timestamp');
  }
  return approval as V3ImportApproval;
}

/** Enforce owner approval + document gate exceptions recorded at staging time. */
export function assertApprovalReadyForImport(
  approval: V3ImportApproval | null,
  selfCheck: V3ImportSelfCheck,
): asserts approval is V3ImportApproval {
  if (!approval) {
    throw new Error(
      'no approval.json in run dir — import REFUSED (Guy must write approval.json by hand)'
    );
  }
  if (
    resolveImportGateModeFromSelfCheck(selfCheck) === 'warn' &&
    !approval.note?.trim()
  ) {
    throw new Error(
      'approval.json note required when self-check recorded personalizationGateWarnings'
    );
  }
}

export function stageGoldenImportRun(opts: {
  repoRoot: string;
  runsRoot: string;
  sourceRel: string;
  runIdOverride?: string;
  personalizationGate?: V3ImportGateMode;
}): StageGoldenImportResult {
  const sourcePath = resolveRepoRelativePath(opts.repoRoot, opts.sourceRel);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`missing source: ${opts.sourceRel}`);
  }

  const storyMd = stripGoldenSourceHeader(fs.readFileSync(sourcePath, 'utf8'));
  const validation = validateStoryForV3Import(storyMd, {
    personalizationGate: opts.personalizationGate ?? 'strict',
  });
  if (validation.errors.length) {
    throw new Error(
      `staging validation failed (${opts.sourceRel}): ${validation.errors.join('; ')}`
    );
  }

  const runId =
    opts.runIdOverride ?? goldenRunId(validation.companionId, validation.direction);
  const runDir = path.join(opts.runsRoot, runId);
  assertNotV3ApprovedWrite(opts.repoRoot, runDir);

  if (fs.existsSync(path.join(runDir, 'approval.json'))) {
    throw new Error(
      `run dir already has approval.json — refusing to overwrite staged content: ${runDir}`
    );
  }

  fs.mkdirSync(runDir, { recursive: true });
  const storyPath = path.join(runDir, 'story.md');
  const selfCheckPath = path.join(runDir, 'self-check.json');
  assertNotV3ApprovedWrite(opts.repoRoot, storyPath);
  assertNotV3ApprovedWrite(opts.repoRoot, selfCheckPath);

  fs.writeFileSync(storyPath, storyMd, 'utf8');
  fs.writeFileSync(
    selfCheckPath,
    JSON.stringify(
      {
        gatePassAutomated: true,
        stagedFrom: opts.sourceRel.split(path.sep).join('/'),
        stagedAt: new Date().toISOString(),
        companionId: validation.companionId,
        direction: validation.direction,
        pageCount: validation.pageCount,
        ...(validation.personalizationWarnings.length
          ? { personalizationGateWarnings: validation.personalizationWarnings }
          : {}),
      },
      null,
      2
    ),
    'utf8'
  );

  const relRunDir = path.relative(opts.repoRoot, runDir).split(path.sep).join('/');
  return { runId, runDir, relRunDir, validation };
}

export function frontmatterField(md: string, field: string): string | null {
  const m = md.match(new RegExp(`^${field}:\\s*['"]?(.+?)['"]?\\s*$`, 'm'));
  return m?.[1]?.trim() ?? null;
}

/** Strip v5/golden comment header; return YAML+pages starting at `---\ntitle:`. */
export function stripGoldenSourceHeader(md: string): string {
  const normalized = md.replace(/\r\n/g, '\n');
  const m = normalized.match(/\n---\n(title:)/);
  if (!m || m.index === undefined) {
    throw new Error('stripGoldenSourceHeader: no YAML frontmatter block (expected --- then title:)');
  }
  return `---\n${normalized.slice(m.index + 5)}`;
}

export function validateStoryForV3Import(
  md: string,
  opts?: { personalizationGate?: V3ImportGateMode },
): V3ImportValidation {
  const gateMode = opts?.personalizationGate ?? 'strict';
  const errors: string[] = [];
  const personalizationWarnings: string[] = [];

  const title = frontmatterField(md, 'title');
  const companionId = frontmatterField(md, 'companionId') ?? '';
  const direction = (frontmatterField(md, 'direction') ?? '').toLowerCase();
  const category = frontmatterField(md, 'category');
  const gender = frontmatterField(md, 'gender');
  const declaredPages = parseInt(frontmatterField(md, 'pages') ?? '', 10);

  if (!title) errors.push('frontmatter missing title');
  if (!companionId) errors.push('frontmatter missing companionId');
  if (!category) errors.push('frontmatter missing category');
  if (!gender) errors.push('frontmatter missing gender');

  const companion = getCompanionById(companionId);
  if (!companion) errors.push(`companionId "${companionId}" not in companions registry`);

  const expectedPages = V3_PAGES_BY_DIRECTION[direction];
  if (!expectedPages) {
    errors.push(`direction "${direction}" must be bedtime|adventure|fantasy`);
  }

  const pages = parseStoryPages(md);
  const pageCount = pages.length;
  if (expectedPages && pageCount !== expectedPages) {
    errors.push(`page count ${pageCount} != ${expectedPages} required for direction=${direction}`);
  }
  if (Number.isFinite(declaredPages) && declaredPages !== pageCount) {
    errors.push(`frontmatter pages=${declaredPages} != parsed page count ${pageCount}`);
  }
  for (let n = 1; n <= (expectedPages || pageCount); n++) {
    const page = pages.find((p) => p.page === n);
    if (!page) {
      errors.push(`missing page ${n}`);
      continue;
    }
    if (!/imageDirection\s*:\s*\S/.test(page.body)) {
      errors.push(`page ${n} missing imageDirection`);
    }
  }

  if (!md.includes('{{childName}}')) errors.push('story has no {{childName}} placeholder');

  const suffixScan = scanSuffixChipsInMarkdown(md);
  if (!suffixScan.suffixChipPass) {
    errors.push(
      `suffix chips: ${suffixScan.hits.map((h) => `p${h.page} ${h.match}`).join(', ')}`
    );
  }
  const artifactScan = scanRawArtifactTokensInMarkdown(md);
  if (!artifactScan.pass) errors.push(`raw artifact tokens: ${artifactScan.tokens.join(', ')}`);
  const slashScan = scanSlashChipsInMarkdown(md);
  if (!slashScan.slashChipStylePass) {
    errors.push(`slash chips: ${slashScan.hits.map((h) => `p${h.page} ${h.match}`).join(', ')}`);
  }

  const companionName = companion?.name ?? companionId;
  const dryRuns: Array<{ label: string; ctx: WizardPersonalizationContext }> = [
    { label: 'girl', ctx: { childName: 'נועה', childGender: 'girl', companionName } },
    { label: 'boy', ctx: { childName: 'יואב', childGender: 'boy', companionName } },
  ];
  for (const { label, ctx } of dryRuns) {
    const resolvedPages = pages.map((p) => {
      const imageDirection = p.body.match(/imageDirection:\s*(.+)/)?.[1] ?? '';
      const text = p.body.replace(/imageDirection:.*/g, '').trim();
      return {
        pageNumber: p.page,
        text: resolveStoryBankPlaceholders(text, ctx),
        imagePrompt: resolveStoryBankPlaceholders(imageDirection, ctx),
      };
    });
    const gateFailures = runStoryPersonalizationGate({ wizard: ctx, pages: resolvedPages });
    for (const f of gateFailures) {
      const msg = `personalization gate (${label}): ${f}`;
      if (gateMode === 'warn') personalizationWarnings.push(msg);
      else errors.push(msg);
    }
  }

  return { companionId, direction, pageCount, errors, personalizationWarnings };
}

export function goldenRunId(companionId: string, direction: string, date = '2026-07-02'): string {
  return `golden-${companionId}_${direction}-${date}`;
}
