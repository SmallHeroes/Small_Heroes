import type { GenerateInput } from '../types';

export const MVP_MATRIX: GenerateInput[] = (
  ['bolly_armadillo', 'chameleon_koko', 'bat_lily'] as const
).flatMap((companionId) =>
  (['bedtime', 'adventure', 'fantasy'] as const).map((direction) => ({
    companionId,
    direction,
    childName: 'נועה',
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
