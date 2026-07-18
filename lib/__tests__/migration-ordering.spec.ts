import { describe, it, expect } from 'vitest';
import { readdirSync } from 'fs';
import path from 'path';

/**
 * Guard the migration ORDER invariant (P1-e3). Prisma applies migrations in lexicographic folder-name order,
 * so a migration that ALTERs a table MUST sort AFTER the migration that CREATEs it. Concretely:
 * `20260630_add_input_version` (ALTERs BookReadinessManifest) must sort after `20260629_base_book_integrity`
 * (CREATEs it) — a fresh `prisma migrate deploy` in the wrong order would fail on "relation does not exist".
 * This regression is exactly what the original `20260629_add_input_version` name caused.
 */
describe('migration ordering', () => {
  const migDir = path.join(process.cwd(), 'backend', 'migrations');
  const migrations = readdirSync(migDir).filter((m) => !m.endsWith('.toml') && !m.startsWith('.')).sort();

  it('add_input_version (ALTER) sorts AFTER base_book_integrity (CREATE)', () => {
    const base = migrations.indexOf('20260629_base_book_integrity');
    const add = migrations.indexOf('20260630_add_input_version');
    expect(base).toBeGreaterThanOrEqual(0); // base migration present
    expect(add).toBeGreaterThanOrEqual(0); // add migration present
    expect(add).toBeGreaterThan(base); // and ordered after it
  });

  it('outbox binding columns exist before their NOT NULL constraints are applied', () => {
    const addBinding = migrations.indexOf('20260630_outbox_manifest_binding');
    const enforceNotNull = migrations.indexOf('20260630_outbox_zz_binding_not_null');
    expect(addBinding).toBeGreaterThanOrEqual(0);
    expect(enforceNotNull).toBeGreaterThanOrEqual(0);
    expect(enforceNotNull).toBeGreaterThan(addBinding);
  });

  it('the delivery-fence Outbox reconcile (Unit D) sorts AFTER the column it re-derives', () => {
    // The reconcile UPDATEs DeliveryOutbox."deliveryFenceVersion"; it MUST run after the ALTER that adds it, else a
    // fresh `migrate deploy` fails on "column does not exist". Guards the cutover backfill order.
    const addColumn = migrations.indexOf('20260719_zz_outbox_delivery_fence');
    const reconcile = migrations.indexOf('20260720_outbox_fence_reconcile');
    expect(addColumn).toBeGreaterThanOrEqual(0);
    expect(reconcile).toBeGreaterThanOrEqual(0);
    expect(reconcile).toBeGreaterThan(addColumn);
  });

  it('the coupon 50% correction (cutover 1.2) sorts AFTER the migration that creates the Coupon table', () => {
    // 20260721 UPDATEs "Coupon"; it MUST run after 20260707 CREATEs it, else a fresh `migrate deploy` fails on
    // "relation does not exist". Restoring 20260707 to its as-applied 25% bytes + this corrective is the checksum-safe
    // way to reach 50% without rewriting an applied migration.
    const createCoupon = migrations.indexOf('20260707_add_coupon_code');
    const correct50 = migrations.indexOf('20260721_coupon_first100_50pct');
    expect(createCoupon).toBeGreaterThanOrEqual(0);
    expect(correct50).toBeGreaterThanOrEqual(0);
    expect(correct50).toBeGreaterThan(createCoupon);
  });
});
