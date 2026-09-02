import { describe, expect, it } from 'vitest';

import {
  allNominalMvpStorySlots,
  MVP_STORY_MATRIX,
  type SlotStatus,
} from '@/backend/config/mvp-story-matrix';
import type {
  RenderQualificationAudit,
  RenderQualificationAuditRecord,
} from '@/lib/visual-package/audit';
import {
  evaluateRenderQualificationReleaseGate,
  renderQualificationReleaseGateScope,
  renderQualificationStrictMode,
} from '@/lib/visual-package/releaseGate';

function allReadyAudit(): RenderQualificationAudit {
  const records: RenderQualificationAuditRecord[] =
    allNominalMvpStorySlots().map((slot) => ({
      ...slot,
      nominallySellable: true,
      productSellable: true,
      renderQualified: true,
      reasons: [],
      storySourcePath: `story-bank/v3-approved/${slot.storyKey}.md`,
      approvedPackagePath: `visual-packages/approved/${slot.storyKey}.visual-package.json`,
    }));
  return {
    auditVersion: 'render-qualification-audit/v1',
    generatedAt: '2026-09-02T00:00:00.000Z',
    nominalSlotCount: records.length,
    productSellableCount: records.length,
    renderQualifiedCount: records.length,
    records,
  };
}

function failureCodes(
  audit: RenderQualificationAudit,
): Map<string, string[]> {
  return new Map(
    evaluateRenderQualificationReleaseGate(audit, true, 'all_nominal')
      .failures.map((failure) => [failure.storyKey, failure.reasonCodes]),
  );
}

describe('render qualification release-gate scopes', () => {
  it('maps strict flags to their explicit release-gate scope', () => {
    expect(renderQualificationStrictMode([])).toBe(false);
    expect(renderQualificationReleaseGateScope([])).toBe('product_sellable');

    expect(renderQualificationStrictMode(['--require-render-qualified'])).toBe(
      true,
    );
    expect(
      renderQualificationReleaseGateScope(['--require-render-qualified']),
    ).toBe('product_sellable');

    expect(renderQualificationStrictMode(['--require-all-render-ready'])).toBe(
      true,
    );
    expect(
      renderQualificationReleaseGateScope(['--require-all-render-ready']),
    ).toBe('all_nominal');

    expect(
      renderQualificationReleaseGateScope([
        '--require-render-qualified',
        '--require-all-render-ready',
      ]),
    ).toBe('all_nominal');
  });

  it('preserves product-sellable semantics while all-nominal catches an unsellable unqualified slot', () => {
    const audit = allReadyAudit();
    audit.records[0] = {
      ...audit.records[0]!,
      productSellable: false,
      renderQualified: false,
      reasons: [
        {
          code: 'approved_package_missing',
          message: 'fixture package is missing',
        },
      ],
    };
    audit.productSellableCount -= 1;
    audit.renderQualifiedCount -= 1;

    expect(
      evaluateRenderQualificationReleaseGate(
        audit,
        true,
        'product_sellable',
      ),
    ).toMatchObject({
      strict: true,
      scope: 'product_sellable',
      pass: true,
      failures: [],
    });

    expect(
      evaluateRenderQualificationReleaseGate(audit, true, 'all_nominal'),
    ).toMatchObject({
      strict: true,
      scope: 'all_nominal',
      pass: false,
      failures: [
        {
          storyKey: audit.records[0]!.storyKey,
          reasonCodes: ['approved_package_missing'],
        },
      ],
    });
  });

  it('requires the exact canonical key set even when every observed record is qualified', () => {
    const canonical = allReadyAudit();
    expect(
      evaluateRenderQualificationReleaseGate(
        canonical,
        true,
        'all_nominal',
      ),
    ).toMatchObject({ pass: true, failures: [] });

    const missing = structuredClone(canonical);
    const missingKey = missing.records.shift()!.storyKey;
    const missingCodes = failureCodes(missing);
    expect(missingCodes.get(missingKey)).toContain(
      'nominal_slot_missing_from_audit',
    );
    expect(missingCodes.get('__audit_metadata__')).toContain(
      'nominal_slot_count_mismatch',
    );

    const unknown = structuredClone(canonical);
    const displacedKey = unknown.records[0]!.storyKey;
    unknown.records[0] = {
      ...unknown.records[0]!,
      storyKey: 'non_nominal_fixture_story',
    };
    const unknownCodes = failureCodes(unknown);
    expect(unknownCodes.get(displacedKey)).toContain(
      'nominal_slot_missing_from_audit',
    );
    expect(unknownCodes.get('non_nominal_fixture_story')).toContain(
      'non_nominal_slot_present_in_audit',
    );
  });

  it('fails closed at runtime when a status demotion shrinks the nominal inventory to 17', () => {
    const directions = MVP_STORY_MATRIX.NIGHT_FEAR
      .directions as unknown as Record<string, SlotStatus>;
    const originalStatus = directions.bedtime;
    try {
      directions.bedtime = 'in_gate';
      const audit = allReadyAudit();
      expect(audit.records).toHaveLength(17);

      const codes = failureCodes(audit);
      expect(codes.get('__matrix_contract__')).toContain(
        'canonical_nominal_inventory_contract_mismatch',
      );
      expect(codes.get('fox_uri_bedtime')).toContain(
        'nominal_slot_missing_from_audit',
      );
      expect(codes.get('__audit_metadata__')).toContain(
        'nominal_slot_count_mismatch',
      );
    } finally {
      directions.bedtime = originalStatus!;
    }
  });

  it('rejects duplicate canonical records even when record count still equals the matrix count', () => {
    const audit = allReadyAudit();
    const duplicateKey = audit.records[0]!.storyKey;
    const lastRecord = audit.records[audit.records.length - 1]!;
    const displacedKey = lastRecord.storyKey;
    audit.records[audit.records.length - 1] = {
      ...lastRecord,
      storyKey: duplicateKey,
    };

    const codes = failureCodes(audit);
    expect(codes.get(duplicateKey)).toContain(
      'nominal_slot_duplicate_in_audit',
    );
    expect(codes.get(displacedKey)).toContain(
      'nominal_slot_missing_from_audit',
    );
    expect(codes.has('__audit_metadata__')).toBe(false);
  });

  it('keeps report-only mode non-blocking while retaining diagnostics', () => {
    const audit = allReadyAudit();
    audit.records.pop();

    const gate = evaluateRenderQualificationReleaseGate(
      audit,
      false,
      'all_nominal',
    );
    expect(gate.pass).toBe(true);
    expect(gate.failures.length).toBeGreaterThan(0);
  });
});
