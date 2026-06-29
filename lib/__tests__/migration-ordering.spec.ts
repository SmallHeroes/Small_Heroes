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
});
