import path from 'path';

import {
  allMvpCategories,
  configuredSlotStatus,
  isSlotSellable,
  MVP_STORY_MATRIX,
  storyBankSourceDirForSlotStatus,
  type MvpCategory,
  type SlotStatus,
  type StoryDirection,
} from '@/backend/config/mvp-story-matrix';

import { evaluateRenderQualification, type RenderQualificationResult } from './qualification';
import { evaluateWizardVisualPackageSelection } from './wizardVisualPackageSelection';

const DIRECTIONS: StoryDirection[] = ['bedtime', 'adventure', 'fantasy'];

export interface RenderQualificationAuditRecord {
  category: MvpCategory;
  direction: StoryDirection;
  companionId: string;
  storyKey: string;
  configuredStatus: SlotStatus;
  nominallySellable: true;
  productSellable: boolean;
  renderQualified: boolean;
  reasons: RenderQualificationResult['reasons'];
  storySourcePath: string | null;
  approvedPackagePath: string | null;
}

export interface RenderQualificationAudit {
  auditVersion: 'render-qualification-audit/v1';
  generatedAt: string;
  nominalSlotCount: number;
  productSellableCount: number;
  renderQualifiedCount: number;
  records: RenderQualificationAuditRecord[];
}

/** Every configured approved slot gets one record, even when an availability flag currently makes it unsellable. */
export function auditMvpRenderQualification(args: {
  repoRoot: string;
  styleId: string;
  approvedPackagesDir?: string;
  boardRegistryRoot?: string;
  now?: () => Date;
}): RenderQualificationAudit {
  const records: RenderQualificationAuditRecord[] = [];
  for (const category of allMvpCategories()) {
    for (const direction of DIRECTIONS) {
      const configuredStatus = configuredSlotStatus(category, direction);
      if (configuredStatus !== 'approved' && configuredStatus !== 'approved_v3') continue;
      const companionId = MVP_STORY_MATRIX[category].companionId;
      const storyKey = `${companionId}_${direction}`;
      const storyPath = path.join(
        args.repoRoot,
        'story-bank',
        storyBankSourceDirForSlotStatus(configuredStatus),
        `${storyKey}.md`,
      );
      const legacyQualification = evaluateRenderQualification({
        repoRoot: args.repoRoot,
        storyKey,
        storyPath,
        styleId: args.styleId,
        approvedPackagesDir: args.approvedPackagesDir,
        boardRegistryRoot: args.boardRegistryRoot,
      });
      const wizardSelection = evaluateWizardVisualPackageSelection({
        repoRoot: args.repoRoot,
        storyKey,
        styleId: args.styleId,
        ...(args.approvedPackagesDir
          ? { approvedPackagesDir: args.approvedPackagesDir }
          : {}),
      });
      const productLineageRequiresVisualPackage =
        wizardSelection.visualPackageRequired;
      const productSellable = productLineageRequiresVisualPackage
        ? wizardSelection.renderQualified
        : isSlotSellable(category, direction, { repoRoot: args.repoRoot });
      const renderQualified = productLineageRequiresVisualPackage
        ? wizardSelection.renderQualified
        : legacyQualification.renderQualified;
      const reasons: RenderQualificationResult['reasons'] =
        productLineageRequiresVisualPackage
          ? wizardSelection.reasons.map((message) => ({
              code: 'product_lineage_package_not_qualified',
              message,
            }))
          : legacyQualification.reasons;
      records.push({
        category,
        direction,
        companionId,
        storyKey,
        configuredStatus,
        nominallySellable: true,
        productSellable,
        renderQualified,
        reasons,
        // Provenance must remain one authority lane. A rejected product-lineage
        // selection deliberately redacts its source, so do not pair that null
        // with a legacy-bank source while retaining the attempted v4 package.
        storySourcePath: productLineageRequiresVisualPackage
          ? wizardSelection.sourcePath
          : legacyQualification.storySourcePath,
        approvedPackagePath: productLineageRequiresVisualPackage
          ? wizardSelection.packagePath
          : legacyQualification.approvedPackagePath,
      });
    }
  }
  return {
    auditVersion: 'render-qualification-audit/v1',
    generatedAt: (args.now ?? (() => new Date()))().toISOString(),
    nominalSlotCount: records.length,
    productSellableCount: records.filter((record) => record.productSellable).length,
    renderQualifiedCount: records.filter((record) => record.renderQualified).length,
    records,
  };
}
