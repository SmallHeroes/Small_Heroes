import type { RenderQualificationAudit } from './audit';
import {
  allMatrixMvpStorySlots,
  evaluateMvpWizardCatalogContract,
  MVP_WIZARD_CATALOG_CONTRACT,
} from '@/backend/config/mvp-story-matrix';

export type RenderQualificationReleaseGateScope =
  | 'product_sellable'
  | 'all_nominal';

export interface RenderQualificationReleaseGate {
  strict: boolean;
  scope: RenderQualificationReleaseGateScope;
  pass: boolean;
  failures: Array<{
    storyKey: string;
    reasonCodes: string[];
  }>;
}

export function renderQualificationStrictMode(argv: readonly string[]): boolean {
  return (
    argv.includes('--require-render-qualified') ||
    argv.includes('--require-all-render-ready')
  );
}

export function renderQualificationReleaseGateScope(
  argv: readonly string[],
): RenderQualificationReleaseGateScope {
  return argv.includes('--require-all-render-ready')
    ? 'all_nominal'
    : 'product_sellable';
}

export function evaluateRenderQualificationReleaseGate(
  audit: RenderQualificationAudit,
  strict: boolean,
  scope: RenderQualificationReleaseGateScope = 'product_sellable',
): RenderQualificationReleaseGate {
  const failureReasons = new Map<string, Set<string>>();
  const addFailure = (storyKey: string, reasonCodes: readonly string[]) => {
    const reasons = failureReasons.get(storyKey) ?? new Set<string>();
    for (const reason of reasonCodes) reasons.add(reason);
    failureReasons.set(storyKey, reasons);
  };

  for (const record of audit.records) {
    if (
      !record.renderQualified &&
      (scope === 'all_nominal' || record.productSellable)
    ) {
      addFailure(
        record.storyKey,
        record.reasons.length > 0
          ? record.reasons.map((reason) => reason.code)
          : ['render_qualification_failed_without_reason'],
      );
    }
  }

  if (scope === 'all_nominal') {
    const catalogContract = evaluateMvpWizardCatalogContract();
    const expectedKeys = new Set(
      allMatrixMvpStorySlots().map((slot) => slot.storyKey),
    );
    if (!catalogContract.complete) {
      addFailure('__matrix_contract__', [
        'canonical_nominal_inventory_contract_mismatch',
      ]);
    }
    const counts = new Map<string, number>();
    for (const record of audit.records) {
      counts.set(record.storyKey, (counts.get(record.storyKey) ?? 0) + 1);
    }
    for (const storyKey of expectedKeys) {
      const count = counts.get(storyKey) ?? 0;
      if (count === 0) addFailure(storyKey, ['nominal_slot_missing_from_audit']);
      if (count > 1) addFailure(storyKey, ['nominal_slot_duplicate_in_audit']);
    }
    for (const storyKey of counts.keys()) {
      if (!expectedKeys.has(storyKey)) {
        addFailure(storyKey, ['non_nominal_slot_present_in_audit']);
      }
    }
    if (
      audit.nominalSlotCount !== expectedKeys.size ||
      audit.records.length !== expectedKeys.size ||
      audit.nominalSlotCount !==
        MVP_WIZARD_CATALOG_CONTRACT.storySlotCount ||
      audit.records.length !== MVP_WIZARD_CATALOG_CONTRACT.storySlotCount
    ) {
      addFailure('__audit_metadata__', ['nominal_slot_count_mismatch']);
    }
  }

  const failures = [...failureReasons]
    .map(([storyKey, reasonCodes]) => ({
      storyKey,
      reasonCodes: [...reasonCodes].sort((left, right) =>
        left.localeCompare(right),
      ),
    }))
    .sort((left, right) => left.storyKey.localeCompare(right.storyKey));
  return {
    strict,
    scope,
    pass: !strict || failures.length === 0,
    failures,
  };
}
