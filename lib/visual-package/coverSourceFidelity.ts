import fs from 'fs';

import type { BookVisualContractTemplate } from '@/lib/visual-contract-compiler/contractTemplateTypes';
import {
  AuthoredCoverAuthorityError,
  authoredCoverAuthorityFromLocationBible,
  coverSourceFidelityIssues,
  type AuthoredCoverAuthority,
} from '@/lib/visual-contract-compiler/coverSourceAuthority';

import type { VisualPackageIssue } from './types';

function packageIssue(
  candidate: {
    code: VisualPackageIssue['code'];
    message: string;
    field?: string;
    expected?: unknown;
    actual?: unknown;
  },
): VisualPackageIssue {
  return {
    code: candidate.code,
    message: candidate.message,
    ...(candidate.field ? { field: candidate.field } : {}),
    ...(candidate.expected !== undefined ? { expected: candidate.expected } : {}),
    ...(candidate.actual !== undefined ? { actual: candidate.actual } : {}),
  };
}

/**
 * Read-only cover-to-page-0 fidelity gate. It is intentionally shared by candidate preparation, promotion, and
 * render qualification so a structurally valid but source-contradictory cover cannot advance at any boundary.
 */
export function storyCoverSourceFidelityIssues(args: {
  storyPath: string;
  template: BookVisualContractTemplate;
}): VisualPackageIssue[] {
  const loaded = loadStoryAuthoredCoverAuthority(args);
  if (loaded.issues.length > 0 || !loaded.authority) return loaded.issues;
  return coverSourceFidelityIssues(args.template, loaded.authority).map(packageIssue);
}

export function loadStoryAuthoredCoverAuthority(args: {
  storyPath: string;
  template: BookVisualContractTemplate;
}): { authority: AuthoredCoverAuthority | null; issues: VisualPackageIssue[] } {
  const locationBiblePath = args.storyPath.replace(/\.md$/i, '.location-bible.json');
  if (locationBiblePath === args.storyPath || !fs.existsSync(locationBiblePath)) {
    return { authority: null, issues: [] };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(locationBiblePath, 'utf8')) as unknown;
  } catch (error) {
    return {
      authority: null,
      issues: [packageIssue({
        code: 'cover_source_authority_invalid',
        message: `location-bible JSON is invalid: ${error instanceof Error ? error.message : String(error)}`,
        field: 'locationBible',
      })],
    };
  }

  try {
    const companion = args.template.cast.companion
      ? {
          id: args.template.cast.companion.id.replace(/^companion:/, ''),
          name: args.template.cast.companion.name,
        }
      : null;
    const authority = authoredCoverAuthorityFromLocationBible(raw, companion);
    return { authority, issues: [] };
  } catch (error) {
    if (error instanceof AuthoredCoverAuthorityError) {
      return { authority: null, issues: error.issues.map(packageIssue) };
    }
    throw error;
  }
}
