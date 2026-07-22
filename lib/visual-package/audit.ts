import path from 'path';

import {
  allMvpCategories,
  configuredSlotStatus,
  isSlotSellable,
  MVP_STORY_MATRIX,
  type MvpCategory,
  type SlotStatus,
  type StoryDirection,
} from '@/backend/config/mvp-story-matrix';
import {
  STORY_BANK_V3_DIR_NAME,
  V3_APPROVED_DIR_NAME,
} from '@/backend/providers/story-bank-index';

import { evaluateRenderQualification, type RenderQualificationResult } from './qualification';

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
  storySourcePath: string;
  approvedPackagePath: string;
}

export interface RenderQualificationAudit {
  auditVersion: 'render-qualification-audit/v1';
  generatedAt: string;
  nominalSlotCount: number;
  productSellableCount: number;
  renderQualifiedCount: number;
  records: RenderQualificationAuditRecord[];
}

function sourceDirForStatus(status: SlotStatus): string {
  return status === 'approved_v3' ? V3_APPROVED_DIR_NAME : STORY_BANK_V3_DIR_NAME;
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
        sourceDirForStatus(configuredStatus),
        `${storyKey}.md`,
      );
      const qualification = evaluateRenderQualification({
        repoRoot: args.repoRoot,
        storyKey,
        storyPath,
        styleId: args.styleId,
        approvedPackagesDir: args.approvedPackagesDir,
        boardRegistryRoot: args.boardRegistryRoot,
      });
      records.push({
        category,
        direction,
        companionId,
        storyKey,
        configuredStatus,
        nominallySellable: true,
        productSellable: isSlotSellable(category, direction),
        renderQualified: qualification.renderQualified,
        reasons: qualification.reasons,
        storySourcePath: qualification.storySourcePath,
        approvedPackagePath: qualification.approvedPackagePath,
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
