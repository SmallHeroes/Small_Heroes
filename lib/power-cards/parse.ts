import { z } from 'zod';
import type {
  ParsedStoryPowerCard,
  PowerCardSpec,
  PowerCardValidationIssue,
  StoryFrontmatterPowerCardSource,
} from './types';

const EM_DASH_RE = /[\u2014\u2013]|--/;

const PowerCardSpecSchema = z.object({
  title: z.string().min(1, 'title is required'),
  subtitle: z.string().min(1, 'subtitle is required'),
  coreTool: z.string().min(1, 'coreTool is required'),
  steps: z
    .array(z.string().min(1))
    .length(4, 'steps must contain exactly 4 items'),
  companionReminder: z.string().min(1, 'companionReminder is required'),
  visualMotifs: z
    .array(z.string().min(1))
    .min(3, 'visualMotifs must have at least 3 items')
    .max(4, 'visualMotifs must have at most 4 items'),
});

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function zodIssuesToValidationIssues(error: z.ZodError): PowerCardValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || 'powerCard',
    severity: 'error' as const,
    message: issue.message,
  }));
}

function contentRuleIssues(spec: PowerCardSpec): PowerCardValidationIssue[] {
  const issues: PowerCardValidationIssue[] = [];

  if (!spec.subtitle.startsWith('כש')) {
    issues.push({
      path: 'powerCard.subtitle',
      severity: 'warning',
      message: 'Subtitle usually starts with "כש" to name the trigger moment.',
    });
  }

  if (!spec.title.includes('{{childName}}')) {
    issues.push({
      path: 'powerCard.title',
      severity: 'warning',
      message: 'Title does not include {{childName}} — allowed when the story demands it.',
    });
  }

  const reminderWords = countWords(spec.companionReminder);
  if (reminderWords > 16) {
    issues.push({
      path: 'powerCard.companionReminder',
      severity: 'error',
      message: `companionReminder must be ≤16 words (currently ${reminderWords}). Shorten to a story-anchored line.`,
    });
  }

  spec.steps.forEach((step, index) => {
    const path = `powerCard.steps[${index}]`;
    if (/[()]/.test(step)) {
      issues.push({
        path,
        severity: 'error',
        message: 'Step must not contain parentheses — use child-friendly language only.',
      });
    }
    if (EM_DASH_RE.test(step)) {
      issues.push({
        path,
        severity: 'warning',
        message:
          'Step contains an em dash — prefer a comma or two short sentences for child-facing copy.',
      });
    }
  });

  return issues;
}

function toPowerCardSpec(parsed: z.infer<typeof PowerCardSpecSchema>): PowerCardSpec {
  const motifs = parsed.visualMotifs;
  return {
    title: parsed.title,
    subtitle: parsed.subtitle,
    coreTool: parsed.coreTool,
    steps: parsed.steps as [string, string, string, string],
    companionReminder: parsed.companionReminder,
    visualMotifs:
      motifs.length === 3
        ? (motifs as [string, string, string])
        : (motifs as [string, string, string, string]),
  };
}

/**
 * Extract the YAML frontmatter block from a v5-fixed-v2 story file.
 * Handles comment headers before the first `---` delimiter.
 */
export function extractYamlFrontmatterBlock(markdown: string): string | null {
  const normalized = markdown.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const re = /^---\s*\n([\s\S]*?)\n---/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(normalized)) !== null) {
    const block = match[1];
    if (block.includes('companionId:')) {
      return block;
    }
  }
  return null;
}

function unquoteYamlString(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Parse the `powerCard:` subtree from a YAML frontmatter block (no external YAML deps).
 */
export function parsePowerCardFromFrontmatterYaml(yamlBlock: string): unknown | null {
  const lines = yamlBlock.split('\n');
  const startLine = lines.findIndex((line) => /^powerCard:\s*$/.test(line));
  if (startLine === -1) return null;

  const subtree: string[] = [];
  for (let i = startLine + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    if (/^[a-zA-Z][a-zA-Z0-9_]*:/.test(line)) break;
    subtree.push(line);
  }

  const out: Record<string, unknown> = {};
  let currentListKey: string | null = null;

  for (const line of subtree) {
    const listItem = line.match(/^\s+-\s+(.+)$/);
    if (listItem && currentListKey) {
      const arr = (out[currentListKey] as string[] | undefined) ?? [];
      arr.push(unquoteYamlString(listItem[1]));
      out[currentListKey] = arr;
      continue;
    }

    const kv = line.match(/^\s{2}([a-zA-Z][a-zA-Z0-9_]*):\s*(.*)$/);
    if (!kv) continue;

    const key = kv[1];
    const rawValue = kv[2].trim();
    if (rawValue === '') {
      currentListKey = key;
      out[key] = [];
      continue;
    }

    currentListKey = null;
    out[key] = unquoteYamlString(rawValue);
  }

  return out;
}

export function validatePowerCardRaw(raw: unknown): {
  spec: PowerCardSpec | null;
  issues: PowerCardValidationIssue[];
} {
  const parsed = PowerCardSpecSchema.safeParse(raw);
  if (!parsed.success) {
    return { spec: null, issues: zodIssuesToValidationIssues(parsed.error) };
  }

  const spec = toPowerCardSpec(parsed.data);
  const issues = contentRuleIssues(spec);
  const hasErrors = issues.some((i) => i.severity === 'error');
  return { spec: hasErrors ? null : spec, issues };
}

export function resolvePowerCard(source: StoryFrontmatterPowerCardSource): PowerCardSpec {
  const id =
    typeof source.powerCardId === 'string'
      ? source.powerCardId.trim()
      : source.powerCardId != null
        ? String(source.powerCardId).trim()
        : '';

  if (id) {
    throw new Error('Not implemented in MVP');
  }

  if (source.powerCard == null) {
    throw new Error('Story has neither powerCard nor powerCardId');
  }

  const { spec, issues } = validatePowerCardRaw(source.powerCard);
  const errors = issues.filter((i) => i.severity === 'error');
  if (!spec || errors.length > 0) {
    const detail = errors.map((e) => `${e.path}: ${e.message}`).join('; ');
    throw new Error(`Invalid powerCard block${detail ? ` — ${detail}` : ''}`);
  }

  return spec;
}

export function parsePowerCardFromStoryMarkdown(
  markdown: string,
  slug = 'story',
): { raw: unknown | null; issues: PowerCardValidationIssue[] } {
  const yamlBlock = extractYamlFrontmatterBlock(markdown);
  if (!yamlBlock) {
    return {
      raw: null,
      issues: [
        {
          path: 'frontmatter',
          severity: 'error',
          message: 'Could not find YAML frontmatter (companionId block).',
        },
      ],
    };
  }

  const raw = parsePowerCardFromFrontmatterYaml(yamlBlock);
  if (raw == null) {
    return {
      raw: null,
      issues: [
        {
          path: 'powerCard',
          severity: 'error',
          message: 'Missing powerCard: block in frontmatter.',
        },
      ],
    };
  }

  return { raw, issues: [] };
}

/** Guard against truncated story files after batch edits. */
export function validateStoryFileIntegrity(
  markdown: string,
  slug: string,
): PowerCardValidationIssue[] {
  const issues: PowerCardValidationIssue[] = [];

  if (!/WORD_COUNT:\s*\[/.test(markdown)) {
    issues.push({
      path: `${slug}`,
      severity: 'error',
      message: 'Missing WORD_COUNT line — file may be truncated.',
    });
  }

  const imageDirections = markdown.match(/^imageDirection:/gm);
  if (!imageDirections || imageDirections.length === 0) {
    issues.push({
      path: `${slug}`,
      severity: 'error',
      message: 'No imageDirection entries found — file may be truncated.',
    });
  }

  return issues;
}

export function parseAndValidateStoryPowerCard(
  markdown: string,
  slug: string,
): ParsedStoryPowerCard {
  const integrityIssues = validateStoryFileIntegrity(markdown, slug);
  const { raw, issues: parseIssues } = parsePowerCardFromStoryMarkdown(markdown, slug);
  if (raw == null) {
    return { slug, spec: null, issues: [...integrityIssues, ...parseIssues] };
  }

  const { spec, issues: validationIssues } = validatePowerCardRaw(raw);
  return {
    slug,
    spec,
    issues: [...integrityIssues, ...validationIssues],
  };
}
