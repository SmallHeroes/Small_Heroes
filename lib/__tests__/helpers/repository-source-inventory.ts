import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

export const STRUCTURAL_REPOSITORY_SCAN_TIMEOUT_MS = 15_000;

export interface RepositorySource {
  readonly absolute: string;
  readonly relative: string;
  readonly text: string;
}

interface RepositorySourceInventoryOptions {
  readonly root: string;
  readonly roots: readonly string[];
  readonly extensions: readonly string[];
  readonly excludedEntryNames?: readonly string[];
  readonly excludedDirectoryNames?: readonly string[];
  readonly excludedFileSuffixes?: readonly string[];
  readonly excludeDotEntries?: boolean;
  readonly followDirectorySymlinks?: boolean;
}

/**
 * Creates one immutable, lazily materialized source snapshot for a structural
 * spec. The cache is intentionally per spec/worker: fixture-only detector calls
 * continue to parse their supplied source independently.
 *
 * Full-suite evidence showed repository guards exceeding Vitest's 5-second
 * default only under concurrent load. The named 15-second budget is applied
 * only to assertions that legitimately inspect hundreds of repository files;
 * it is not a global timeout or a retry.
 */
export function createRepositorySourceInventory(
  options: RepositorySourceInventoryOptions,
): () => readonly RepositorySource[] {
  const roots = [...options.roots];
  const extensions = [...options.extensions];
  const excludedEntryNames = new Set(options.excludedEntryNames ?? []);
  const excludedDirectoryNames = new Set(options.excludedDirectoryNames ?? []);
  const excludedFileSuffixes = [...(options.excludedFileSuffixes ?? [])];
  const excludeDotEntries = options.excludeDotEntries ?? false;
  const followDirectorySymlinks = options.followDirectorySymlinks ?? true;
  let cached: readonly RepositorySource[] | undefined;

  return () => {
    if (cached) return cached;

    const sources: RepositorySource[] = [];
    const visit = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (
          excludedEntryNames.has(entry.name) ||
          (excludeDotEntries && entry.name.startsWith('.'))
        ) {
          continue;
        }

        const absolute = path.join(directory, entry.name);
        const isDirectory = followDirectorySymlinks
          ? statSync(absolute).isDirectory()
          : entry.isDirectory();
        if (isDirectory) {
          if (!excludedDirectoryNames.has(entry.name)) visit(absolute);
          continue;
        }
        if (
          !extensions.some((extension) => entry.name.endsWith(extension)) ||
          excludedFileSuffixes.some((suffix) => entry.name.endsWith(suffix))
        ) {
          continue;
        }

        sources.push(
          Object.freeze({
            absolute,
            relative: path.relative(options.root, absolute).split(path.sep).join('/'),
            text: readFileSync(absolute, 'utf8'),
          }),
        );
      }
    };

    for (const relativeRoot of roots) {
      visit(path.join(options.root, relativeRoot));
    }
    cached = Object.freeze(sources);
    return cached;
  };
}
