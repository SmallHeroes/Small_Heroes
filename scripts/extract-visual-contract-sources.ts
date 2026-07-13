/**
 * Brief 1, Component 1 — OFFLINE source extractor (.md → <storyKey>.source.json).
 *
 * NO RENDER. NO LLM. Pure text extraction. This is the decoupling seam documented by
 * scripts/compile-visual-contract-artifacts.ts: it turns a bank story .md into the
 * `<storyKey>.source.json` the compiler consumes, so the compiler never has to couple to the
 * bank loader's personalization signature.
 *
 * The emitted source is `CompileBookVisualContractInput` PLUS an ADDITIVE `pages[]` (per-page
 * prose). `pages[]` is what the deterministic fact extractor (Component 2) reads to build the
 * per-page presence / laterality graph — `fullStoryText` alone loses page boundaries. The field
 * is additive: the existing compile driver passes `{...raw}` through and ignores it.
 *
 * Usage (run with the server-only shim):
 *   tsx --require ./scripts/shims/register-server-only.cjs \
 *     scripts/extract-visual-contract-sources.ts --bank story-bank/v3-approved --out <sources dir> [--only <storyKey>]
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

import { parseStoryMarkdown } from '@/lib/story-validators/parser';
import { getCompanionById } from '@/lib/companions';
import {
  frontmatterField,
  stripGoldenSourceHeader,
} from '@/lib/story-bank-v3-import';
import type { CompileBookVisualContractInput } from '@/lib/visual-contract-compiler';
import { assertSourceHasRealProse } from '@/lib/visual-contract-compiler';

/** Default child gender when the bank frontmatter omits it (Phase-B default). */
const DEFAULT_CHILD_GENDER = 'female';

/** One page's Hebrew prose (imageDirection already stripped) — the deterministic-facts input. */
export interface SourcePage {
  pageNumber: number;
  text: string;
}

/** The <storyKey>.source.json body: the compiler input + additive per-page prose. */
export interface ContractSourceFile extends CompileBookVisualContractInput {
  storyKey: string;
  /** ADDITIVE — per-page prose for deterministic extraction (Component 2). Ignored by the LLM compile. */
  pages: SourcePage[];
}

/**
 * Return the story starting at its `---\ntitle:` frontmatter, dropping the golden import header
 * when present. On-disk v3-approved files carry a `# Story: …` comment header that is NOT part of
 * the canonical story; a staged/clean file may already start at the frontmatter.
 */
export function toFrontmatterMarkdown(raw: string): string {
  const normalized = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const body = /^---\ntitle:/.test(normalized) ? normalized : stripGoldenSourceHeader(normalized);
  // Drop the bank's trailing WORD_COUNT metadata line (a document trailer, NOT page prose — e.g.
  // "WORD_COUNT: [36, 41, ...] = 467" or "= [363]"). The parser now keeps prose on BOTH sides of the
  // imageDirection line, so without this the FINAL page's .text would fold the trailer into pages[] +
  // fullStoryText and hand it to the authoring LLM as story content. Anchored to end-of-document.
  return body.replace(/\n+WORD_COUNT:[^\n]*\s*$/i, '\n');
}

/** Extract a source object from one story .md. Pure — no LLM, no filesystem writes. */
export function extractSourceFromMarkdown(storyKey: string, rawMarkdown: string): ContractSourceFile {
  const md = toFrontmatterMarkdown(rawMarkdown);
  const companionId = frontmatterField(md, 'companionId');
  const gender = frontmatterField(md, 'gender') ?? DEFAULT_CHILD_GENDER;

  const parsed = parseStoryMarkdown(md);
  const orderedPages = parsed.pages.slice().sort((a, b) => a.pageNumber - b.pageNumber);
  if (orderedPages.length === 0) {
    throw new Error(`extract-vc-source: ${storyKey} parsed 0 pages (bad markers or empty story)`);
  }

  const pages: SourcePage[] = orderedPages.map((p) => ({
    pageNumber: p.pageNumber,
    text: p.text.trim(),
  }));

  // FAIL-CLOSED: never emit a source with empty/negligible prose. A story that parses N page markers but whose
  // per-page prose is empty (e.g. a parser drop) would otherwise flow to the compiler, which HALLUCINATES a fully-
  // valid contract from nothing. Refuse here so the empty source never reaches the LLM.
  assertSourceHasRealProse(storyKey, pages, 'extract-vc-source');
  const pageImageDirections = orderedPages
    .filter((p) => p.imageDirection.trim().length > 0)
    .map((p) => ({ pageNumber: p.pageNumber, imageDirection: p.imageDirection.trim() }));

  // fullStoryText carries page-boundary markers so the LLM can assign per-page contracts; the
  // imageDirection lines are supplied separately via pageImageDirections (never inlined here).
  const fullStoryText = pages.map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`).join('\n\n');

  const companion = companionId
    ? { id: companionId, name: getCompanionById(companionId)?.name }
    : null;

  return {
    storyKey,
    fullStoryText,
    pageCount: pages.length,
    childGender: gender,
    companion,
    pageImageDirections,
    pages,
  };
}

function parseArgs(argv: string[]): { bank: string; out: string; only?: string } {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const bank = get('--bank');
  const out = get('--out');
  if (!bank || !out) {
    throw new Error('usage: --bank <dir e.g. story-bank/v3-approved> --out <sources dir> [--only <storyKey>]');
  }
  return { bank, out, only: get('--only') };
}

function main(): void {
  const { bank, out, only } = parseArgs(process.argv.slice(2));
  if (!existsSync(bank)) throw new Error(`bank dir not found: ${bank}`);
  mkdirSync(out, { recursive: true });

  // `_`-prefixed files (e.g. _PRODUCTION_MANIFEST.md) are bank meta, not stories — skip them.
  const files = readdirSync(bank)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .sort();

  let extracted = 0;
  const failures: Array<{ storyKey: string; error: string }> = [];

  for (const file of files) {
    const storyKey = file.replace(/\.md$/, '');
    if (only && storyKey !== only) continue;
    try {
      const source = extractSourceFromMarkdown(storyKey, readFileSync(path.join(bank, file), 'utf8'));
      const outPath = path.join(out, `${storyKey}.source.json`);
      writeFileSync(outPath, `${JSON.stringify(source, null, 2)}\n`, 'utf8');
      extracted += 1;
      console.log(`[extract-vc-source] ${storyKey} → ${outPath} (${source.pageCount} pages)`);
    } catch (err) {
      failures.push({ storyKey, error: (err as Error).message });
      console.error(`[extract-vc-source] FAILED ${storyKey}: ${(err as Error).message}`);
    }
  }

  console.log(
    `[extract-vc-source] extracted ${extracted}/${files.length} source(s); ${failures.length} failure(s).`
  );
  if (failures.length > 0) process.exitCode = 1;
}

// Only run the CLI when invoked directly (not when imported by the compiler/tests).
if (process.argv[1] && /extract-visual-contract-sources\.(ts|js)$/.test(process.argv[1])) {
  main();
}
