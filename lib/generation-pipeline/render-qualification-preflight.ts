import path from 'path';

import { STYLE_IDS, normalizeStyleId } from '@/lib/styles';
import { isVisualContractEnforcementEnabled } from '@/lib/visual-contract-compiler/contractRenderGuards';
import {
  evaluateRenderQualification,
  type RenderQualificationResult,
} from '@/lib/visual-package/qualification';

import { resolveCachedStoryFilePath } from './story-path';
import type { PipelineCache } from './types';

export class RenderQualificationPreflightError extends Error {
  readonly isRenderQualificationPreflightError = true as const;

  constructor(readonly qualification: RenderQualificationResult) {
    super(
      `[render_qualification] ${qualification.storyKey} blocked before image provider: ` +
        qualification.reasons.map((reason) => reason.code).join(', '),
    );
    this.name = 'RenderQualificationPreflightError';
  }
}

export interface RenderQualificationPreflightArgs {
  illustrationStyle?: string | null;
  cache: Pick<
    PipelineCache,
    'devStoryBankFile' | 'storyFilePath' | 'storyDir' | 'selectionFilename'
  >;
  repoRoot?: string;
  approvedPackagesDir?: string;
  boardRegistryRoot?: string;
}

/**
 * Shipped Style01 pre-image guard. It is coupled to the existing visual-contract enforcement boundary, which is
 * explicitly opt-in outside production and hard-false on Vercel production. Enforcement off therefore preserves
 * the documented legacy path; enforcement on requires a complete current approved package before invoking render.
 */
export function requireStyle01RenderQualification(
  args: RenderQualificationPreflightArgs,
): RenderQualificationResult | null {
  if (!isVisualContractEnforcementEnabled()) return null;
  if (normalizeStyleId(args.illustrationStyle) !== STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK) return null;

  const repoRoot = args.repoRoot ?? process.cwd();
  const storyPath = resolveCachedStoryFilePath(args.cache);
  const storyKey = (args.cache.selectionFilename
    ? path.basename(args.cache.selectionFilename, '.md')
    : storyPath
      ? path.basename(storyPath, '.md')
      : 'unknown_story');
  const qualification = evaluateRenderQualification({
    repoRoot,
    storyKey,
    storyPath: storyPath ?? path.join(repoRoot, 'story-bank', '__missing_story__.md'),
    styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
    approvedPackagesDir: args.approvedPackagesDir,
    boardRegistryRoot: args.boardRegistryRoot,
  });
  if (!qualification.renderQualified) throw new RenderQualificationPreflightError(qualification);
  return qualification;
}

/** Actual shipped call wrapper: the render callback is unreachable until the synchronous preflight succeeds. */
export async function runWithStyle01RenderQualification<T>(
  args: RenderQualificationPreflightArgs,
  render: () => Promise<T>,
): Promise<T> {
  requireStyle01RenderQualification(args);
  return render();
}
