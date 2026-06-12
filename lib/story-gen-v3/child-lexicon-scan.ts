/**
 * Ages 5–8 child lexicon gate — config-driven blocked adult/abstract wording.
 */

import fs from 'fs';
import path from 'path';

import { pageProseOnly, parseStoryPages } from '../story-gen/story-page-utils';

export interface ChildLexiconHit {
  page: number;
  match: string;
  line: string;
  ruleId: string;
}

export interface ChildLexiconScanReport {
  pass: boolean;
  hits: ChildLexiconHit[];
  hitCount: number;
}

export interface ChildLexiconConfig {
  version: string;
  description?: string;
  blockedPhrases: string[];
  blockedWordPatterns: Array<{ id: string; pattern: string; note?: string }>;
}

const CONFIG_PATH = path.join(__dirname, 'config', 'child-lexicon-ages-5-8.json');

let cachedConfig: ChildLexiconConfig | null = null;

export function stripHebrewNiqqud(text: string): string {
  return text.replace(/[\u0591-\u05C7]/g, '');
}

export function loadChildLexiconConfig(configPath = CONFIG_PATH): ChildLexiconConfig {
  if (cachedConfig && configPath === CONFIG_PATH) return cachedConfig;
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as ChildLexiconConfig;
  if (configPath === CONFIG_PATH) cachedConfig = raw;
  return raw;
}

/** Reset cached config — tests only. */
export function resetChildLexiconConfigCache(): void {
  cachedConfig = null;
}

function normalizeForScan(line: string): string {
  return stripHebrewNiqqud(line).replace(/\u2011|\u2010|\u2013|\u2014/g, '-');
}

export function scanChildLexiconInText(
  text: string,
  page: number,
  config: ChildLexiconConfig
): ChildLexiconHit[] {
  const hits: ChildLexiconHit[] = [];
  const normalized = normalizeForScan(text);

  for (const phrase of config.blockedPhrases) {
    const needle = normalizeForScan(phrase);
    if (!needle) continue;
    if (normalized.includes(needle)) {
      hits.push({
        page,
        match: phrase,
        line: text.slice(0, 120),
        ruleId: `phrase:${phrase}`,
      });
    }
  }

  for (const { id, pattern } of config.blockedWordPatterns) {
    const re = new RegExp(normalizeForScan(pattern), 'u');
    const m = normalized.match(re);
    if (m) {
      hits.push({
        page,
        match: m[0],
        line: text.slice(0, 120),
        ruleId: id,
      });
    }
  }

  return hits;
}

export function scanChildLexiconInMarkdown(
  markdown: string,
  configPath?: string
): ChildLexiconScanReport {
  const config = loadChildLexiconConfig(configPath);
  const hits: ChildLexiconHit[] = [];

  for (const { page, body } of parseStoryPages(markdown)) {
    const prose = pageProseOnly(body);
    for (const rawLine of prose.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.includes('imageDirection')) continue;
      hits.push(...scanChildLexiconInText(line, page, config));
    }
  }

  const deduped = hits.filter(
    (h, i, arr) =>
      arr.findIndex((x) => x.page === h.page && x.ruleId === h.ruleId && x.match === h.match) ===
      i
  );

  return {
    pass: deduped.length === 0,
    hits: deduped,
    hitCount: deduped.length,
  };
}
