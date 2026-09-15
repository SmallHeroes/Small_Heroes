import { describe, it, expect, vi } from 'vitest';
vi.mock('./generate-image', () => ({ generateGPTImage: vi.fn(() => { throw Error('network_forbidden'); }) }));
import { repairBinding } from '../scripts/repair-local-story-preview';
const identity = { version: 'owner-book-draft/v1', config: { intent: 'owner_requested_unaccepted_draft', story: { sha: 'a'.repeat(64) }, plan: { sha: 'b'.repeat(64) }, imageBudgetUsd: 10 } };
const manifest = { sourceSha: 'a'.repeat(64), planSha: 'b'.repeat(64), productionReady: false };
describe('explicit manual correction binding', () => {
  it('accepts exact editorial source and plan without product acceptance', () => { expect(repairBinding(identity, manifest).budgetUsd).toBe(10); });
  it('preserves legacy source/budget binding', () => { expect(repairBinding({ sourceSha: manifest.sourceSha, config: { budgetUsd: 2 } }, manifest).budgetUsd).toBe(2); });
  it.each([{ sourceSha: 'c'.repeat(64) }, { planSha: 'c'.repeat(64) }, { productionReady: true }])('rejects changed manifest %j', change => {
    expect(() => repairBinding(identity, { ...manifest, ...change })).toThrow('repair_source_mismatch');
  });
  it('rejects missing or excessive allowance', () => {
    for (const imageBudgetUsd of [undefined, 11, -1, NaN]) expect(() => repairBinding({ ...identity, config: { ...identity.config, imageBudgetUsd } }, manifest)).toThrow('repair_budget_invalid');
  });
  it('does not adopt draft binding without literal intent', () => {
    expect(() => repairBinding({ ...identity, config: { ...identity.config, intent: 'accepted' } }, manifest)).toThrow('repair_source_mismatch');
  });
});
