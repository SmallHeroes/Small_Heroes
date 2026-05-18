import type { Finding, FindingSeverity } from './types';

export function normalizeCompanionId(raw: string): string {
  return raw.trim().toLowerCase().replace(/-/g, '_');
}

export function excerptAround(text: string, index: number, radius = 30): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  const slice = text.slice(start, end);
  return (start > 0 ? '…' : '') + slice + (end < text.length ? '…' : '');
}

export function finding(
  validator: string,
  severity: FindingSeverity,
  message: string,
  extra?: Pick<Finding, 'page' | 'excerpt' | 'suggestion'>
): Finding {
  return { validator, severity, message, ...extra };
}

/** Strip wizard template syntax before Hebrew-only scans. */
export function stripStoryTemplates(text: string): string {
  return text
    .replace(/\{\{#age\}\}[\s\S]*?\{\{\/age\}\}/g, ' ')
    .replace(/\{\{[^}]+\}\}/g, ' ')
    .replace(/\{[^{}|]+\|[^{}]+\}/g, ' ')
    .replace(/\{[^{}]+\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function normalizeForMatch(text: string): string {
  return stripNikud(text).replace(/\s+/g, ' ').trim().toLowerCase();
}

export function stripNikud(text: string): string {
  return text.replace(/[\u0591-\u05C7]/g, '');
}

export function countOccurrences(haystack: string, needle: string): number {
  if (!needle.trim()) return 0;
  const h = normalizeForMatch(haystack);
  const n = normalizeForMatch(needle);
  if (!n) return 0;
  let count = 0;
  let pos = 0;
  while (true) {
    const idx = h.indexOf(n, pos);
    if (idx === -1) break;
    count++;
    pos = idx + Math.max(1, n.length);
  }
  return count;
}

export function extractShotType(imageDirection: string): string {
  const lower = imageDirection.toLowerCase();
  const patterns: Array<[RegExp, string]> = [
    [/\bclose[- ]?up\b|\bclose shot\b/i, 'close'],
    [/\bwide\b|\bwide shot\b/i, 'wide'],
    [/\bmedium\b|\bmid[- ]?shot\b/i, 'medium'],
    [/\bextreme close\b/i, 'extreme_close'],
    [/\bfull[- ]?body\b/i, 'full_body'],
    [/\baerial\b|\bbird['']?s[- ]?eye\b/i, 'aerial'],
    [/\blow angle\b/i, 'low_angle'],
    [/\bhigh angle\b/i, 'high_angle'],
  ];
  for (const [re, label] of patterns) {
    if (re.test(lower)) return label;
  }
  return 'other';
}

export function parseSimpleYaml(block: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    let value: unknown = trimmed.slice(colon + 1).trim();
    if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (/^\d+$/.test(String(value))) value = Number(value);
    out[key] = value;
  }
  return out;
}
