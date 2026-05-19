import type { GenerateInput, MvpCompanionId } from '../types';

/**
 * v0.2: Focus on Bolly first (stress-test companion — clear mechanic, clear forbids).
 * Once Bolly is 3/3 PASS, expand to all 3 companions × 3 directions = 9 stories.
 *
 * To run the full 9-story matrix, set MVP_FULL_MATRIX=1 in env.
 */
const MVP_COMPANIONS: MvpCompanionId[] =
  process.env.MVP_FULL_MATRIX === '1'
    ? ['bolly_armadillo', 'chameleon_koko', 'bat_lily']
    : ['bolly_armadillo'];

export const MVP_MATRIX: GenerateInput[] = MVP_COMPANIONS.flatMap((companionId) =>
  (['bedtime', 'adventure', 'fantasy'] as const).map((direction) => ({
    companionId,
    direction,
    childName: process.env.SMOKE_CHILD_NAME?.trim() || 'נועה',
    childGender: 'girl' as const,
    childAge: 5,
    prescription: {
      emotionalSituation: 'ילדה לא מצליחה להירדם כשהחדר שקט מדי.',
      physicalMechanicSuggestion: 'כתף יורדת, נשימה איטית, חפץ חם ביד.',
      tabooDirectWords: ['חרדה', 'להתמודד'],
      narrativeConstraint: 'בלי מסר מוסרי ישיר — רק פעולה פיזית.',
    },
  }))
);
