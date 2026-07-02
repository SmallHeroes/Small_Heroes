/**
 * Shared validation + golden-source prep for v3-approved bank imports.
 * Write path: scripts/import-v3-approved-story.ts (requires Guy's approval.json).
 * Staging-only: scripts/stage-golden-v3-import-run.ts (never writes v3-approved/).
 */
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
