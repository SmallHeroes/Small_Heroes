import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

import { canonicalHash } from '@/lib/canonical-json';
import { parseStoryMarkdown } from '@/lib/story-validators/parser';

import {
  STORY_SOURCE_IDENTITY_VERSION,
  type StorySourceIdentity,
} from './types';

export function normalizeTextForDigest(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').normalize('NFC');
}

export function normalizedTextDigest(text: string): string {
  return createHash('sha256').update(normalizeTextForDigest(text), 'utf8').digest('hex');
}

export function canonicalJsonDigest(value: unknown): string {
  return canonicalHash(value);
}

export function parseJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}

export function repoRelativePath(repoRoot: string, targetPath: string): string {
  const root = path.resolve(repoRoot);
  const absolute = path.resolve(targetPath);
  const relative = path.relative(root, absolute);
  if (relative === '' || relative === '.') return '.';
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`path escapes repository root: ${targetPath}`);
  }
  return relative.split(path.sep).join('/');
}

export function resolveRepoPath(repoRoot: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) {
    throw new Error(`manifest path must be repository-relative: ${relativePath}`);
  }
  const resolved = path.resolve(repoRoot, relativePath);
  repoRelativePath(repoRoot, resolved);
  return resolved;
}

export function buildStorySourceIdentity(args: {
  repoRoot: string;
  storyPath: string;
}): StorySourceIdentity {
  const absolute = path.isAbsolute(args.storyPath)
    ? path.resolve(args.storyPath)
    : path.resolve(args.repoRoot, args.storyPath);
  const relative = repoRelativePath(args.repoRoot, absolute);
  const raw = fs.readFileSync(absolute, 'utf8');
  const normalized = normalizeTextForDigest(raw);
  const pages = parseStoryMarkdown(normalized).pages;
  const pageNumbers = pages.map((page) => page.pageNumber);
  return {
    version: STORY_SOURCE_IDENTITY_VERSION,
    path: relative,
    digestAlgorithm: 'sha256-normalized-utf8',
    digest: normalizedTextDigest(normalized),
    pageCount: pageNumbers.length,
    pageNumbers,
  };
}

export function isoTimestampIsValid(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

export function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
