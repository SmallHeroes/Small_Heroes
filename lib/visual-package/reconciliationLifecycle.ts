import path from 'path';

import type { AuthoredCoverAuthority } from '@/lib/visual-contract-compiler/coverSourceAuthority';
import type { BookVisualContractTemplate } from '@/lib/visual-contract-compiler/contractTemplateTypes';
import { parseStorySourceContent } from '@/lib/visual-contract-compiler/storySourceContent';

import {
  canonicalJsonDigest,
  repoRelativePath,
} from './integrity';
import {
  buildSourcePromptReconciliationDraft,
  sourcePromptReconciliationIssues,
  type SourcePromptReconciliation,
} from './sourcePromptReconciliation';
import type {
  StorySourceIdentity,
  VisualPackageIssue,
} from './types';
import { writeImmutableLocalArtifact } from './preRenderBlueprintLifecycle';

export const RECONCILIATION_REVIEW_BUNDLE_VERSION =
  'source-prompt-reconciliation-review-bundle/v1' as const;
export const RECONCILIATION_REVIEW_RENDERER_VERSION =
  'source-prompt-reconciliation-review-markdown/v1' as const;

export interface ReconciliationReviewRequirement {
  frameKind: 'cover' | 'page';
  pageNumber: number;
  sourceKind:
    | 'story_prose'
    | 'historical_image_direction'
    | 'authored_cover_authority';
  sourceText: string;
  visualBeatCount: number;
  unresolved: boolean;
  requiredCitationRoots: string[];
}

export interface ReconciliationReviewBundle {
  version: typeof RECONCILIATION_REVIEW_BUNDLE_VERSION;
  rendererVersion: typeof RECONCILIATION_REVIEW_RENDERER_VERSION;
  storyKey: string;
  sourceDigest: string;
  templateDigest: string;
  reconciliationDigest: string;
  requirements: ReconciliationReviewRequirement[];
  blockingIssues: VisualPackageIssue[];
  readyForApproval: boolean;
  reviewInstructions: string[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

function pageContractRoot(
  template: BookVisualContractTemplate,
  pageNumber: number,
): string[] {
  const index = template.pageContracts.findIndex(
    (page) => page.pageNumber === pageNumber,
  );
  return index < 0
    ? []
    : [
        `/pageContracts/${index}`,
        '/worldType',
        '/locations',
        '/zones',
        '/cast',
        '/humanCast',
        '/recurringProps',
        '/forbiddenGlobalElements',
      ];
}

function reviewPayload(
  value: Omit<ReconciliationReviewBundle, 'digestAlgorithm' | 'digest'>,
): unknown {
  return value;
}

export function buildReconciliationReviewBundle(args: {
  reconciliation: SourcePromptReconciliation;
  sourceIdentity: StorySourceIdentity;
  rawStorySource: string;
  template: BookVisualContractTemplate;
  authoredCoverAuthority?: AuthoredCoverAuthority;
}): ReconciliationReviewBundle {
  const templateDigest = canonicalJsonDigest(args.template);
  const blockingIssues = sourcePromptReconciliationIssues({
    raw: args.reconciliation,
    storyKey: args.reconciliation.storyKey,
    sourceIdentity: args.sourceIdentity,
    rawStorySource: args.rawStorySource,
    template: args.template,
    templateDigest,
    authoredCoverAuthority: args.authoredCoverAuthority,
    requireComplete: true,
  });
  const requirements = args.reconciliation.frames.flatMap((frame) =>
    frame.sourceRequirements.map((requirement) => ({
      frameKind: frame.frameKind,
      pageNumber: frame.pageNumber,
      sourceKind: requirement.sourceKind,
      sourceText: requirement.sourceText,
      visualBeatCount: requirement.visualBeats.length,
      unresolved:
        requirement.visualBeats.length === 0 ||
        requirement.visualBeats.some(
          (beat) => beat.disposition === 'unresolved',
        ),
      requiredCitationRoots:
        frame.frameKind === 'cover'
          ? [
              '/coverContract',
              '/worldType',
              '/locations',
              '/zones',
              '/cast',
              '/humanCast',
              '/recurringProps',
              '/forbiddenGlobalElements',
            ]
          : pageContractRoot(args.template, frame.pageNumber),
    })),
  );
  const withoutDigest = {
    version: RECONCILIATION_REVIEW_BUNDLE_VERSION,
    rendererVersion: RECONCILIATION_REVIEW_RENDERER_VERSION,
    storyKey: args.reconciliation.storyKey,
    sourceDigest: args.sourceIdentity.digest,
    templateDigest,
    reconciliationDigest: canonicalJsonDigest(args.reconciliation),
    requirements,
    blockingIssues,
    readyForApproval: blockingIssues.length === 0,
    reviewInstructions: [
      'Enumerate every visual beat required by each exact source requirement; do not replace sourceText with a paraphrase.',
      'A preserved beat must cite one or more exact RFC-6901 JSON pointers and exact current values.',
      'An intentionally superseded beat must include a human-reviewed justification and may not supersede authored cover authority.',
      'Leave uncertain or uncovered meaning unresolved; unresolved coverage blocks reconciliation and Blueprint approval.',
      'Reconciliation approval is independent and grants no Blueprint, Board, package, render, publication, or release authority.',
    ],
  };
  return {
    ...withoutDigest,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(reviewPayload(withoutDigest)),
  };
}

export function buildProductionReconciliationDraftBundle(args: {
  storyKey: string;
  sourceIdentity: StorySourceIdentity;
  rawStorySource: string;
  template: BookVisualContractTemplate;
  authoredCoverAuthority?: AuthoredCoverAuthority;
}): {
  reconciliation: SourcePromptReconciliation;
  reviewBundle: ReconciliationReviewBundle;
  markdown: string;
} {
  const content = parseStorySourceContent(args.rawStorySource);
  const reconciliation = buildSourcePromptReconciliationDraft(
    {
      storyKey: args.storyKey,
      sourceIdentity: args.sourceIdentity,
      pages: content.pages,
      pageImageDirections: content.pageImageDirections,
      authoredCoverAuthority: args.authoredCoverAuthority,
    },
    args.template,
  );
  const reviewBundle = buildReconciliationReviewBundle({
    reconciliation,
    sourceIdentity: args.sourceIdentity,
    rawStorySource: args.rawStorySource,
    template: args.template,
    authoredCoverAuthority: args.authoredCoverAuthority,
  });
  return {
    reconciliation,
    reviewBundle,
    markdown: renderReconciliationReviewMarkdown(reviewBundle),
  };
}

export function renderReconciliationReviewMarkdown(
  bundle: ReconciliationReviewBundle,
): string {
  const lines = [
    '# Source Prompt Reconciliation Review',
    '',
    `- Story: \`${bundle.storyKey}\``,
    `- Story Source digest: \`${bundle.sourceDigest}\``,
    `- Visual Contract digest: \`${bundle.templateDigest}\``,
    `- Reconciliation digest: \`${bundle.reconciliationDigest}\``,
    `- Review-bundle digest: \`${bundle.digest}\``,
    `- Ready for reconciliation approval: **${bundle.readyForApproval ? 'YES' : 'NO'}**`,
    '',
    '## Review rules',
    '',
    ...bundle.reviewInstructions.map((instruction) => `- ${instruction}`),
    '',
    '## Exact source requirements',
    '',
  ];
  for (const requirement of bundle.requirements) {
    lines.push(
      `### ${requirement.frameKind} ${requirement.pageNumber} — ${requirement.sourceKind}`,
      '',
      '```text',
      requirement.sourceText,
      '```',
      '',
      `- Visual beats: ${requirement.visualBeatCount}`,
      `- Unresolved/blocking: ${requirement.unresolved ? 'YES' : 'NO'}`,
      `- Allowed citation roots: ${requirement.requiredCitationRoots.map((root) => `\`${root}\``).join(', ')}`,
      '',
    );
  }
  lines.push('## Blocking issues', '');
  if (bundle.blockingIssues.length === 0) {
    lines.push('- None.', '');
  } else {
    lines.push(
      ...bundle.blockingIssues.map(
        (issue) =>
          `- \`${issue.code}\`${issue.field ? ` at \`${issue.field}\`` : ''}: ${issue.message}`,
      ),
      '',
    );
  }
  return `${lines.join('\n')}\n`;
}

export function persistReconciliationDraftBundle(args: {
  repoRoot: string;
  outputDir: string;
  reconciliation: SourcePromptReconciliation;
  reviewBundle: ReconciliationReviewBundle;
  markdown: string;
  write?: boolean;
}): {
  reconciliationPath: string;
  reviewBundlePath: string;
  markdownPath: string;
  wrote: boolean;
} {
  const root = resolveOutputRoot(args.repoRoot, args.outputDir);
  const revision = args.reviewBundle.digest;
  const reconciliationPath = path.join(
    root,
    'reconciliations',
    `${args.reviewBundle.reconciliationDigest}.json`,
  );
  const reviewBundlePath = path.join(
    root,
    'reviews',
    `${revision}.json`,
  );
  const markdownPath = path.join(root, 'reviews', `${revision}.md`);
  if (args.write === true) {
    writeImmutableLocalArtifact({
      destinationPath: reconciliationPath,
      bytes: `${JSON.stringify(args.reconciliation, null, 2)}\n`,
    });
    writeImmutableLocalArtifact({
      destinationPath: reviewBundlePath,
      bytes: `${JSON.stringify(args.reviewBundle, null, 2)}\n`,
    });
    writeImmutableLocalArtifact({
      destinationPath: markdownPath,
      bytes: args.markdown,
    });
  }
  return {
    reconciliationPath: repoRelativePath(args.repoRoot, reconciliationPath),
    reviewBundlePath: repoRelativePath(args.repoRoot, reviewBundlePath),
    markdownPath: repoRelativePath(args.repoRoot, markdownPath),
    wrote: args.write === true,
  };
}

function resolveOutputRoot(repoRoot: string, outputDir: string): string {
  const absolute = path.resolve(repoRoot, outputDir);
  repoRelativePath(repoRoot, absolute);
  return absolute;
}
