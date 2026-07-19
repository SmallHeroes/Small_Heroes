/**
 * (cutover Track 2, deliverable 2) assert-schema-equality — a MACHINE-CHECKED comparison of two Postgres schemas
 * across NINE dimensions. Equality of 30 tables is far past what a human can certify by eye, so the bridge is only
 * "proven" if THIS returns zero diffs. Pure catalog reads; no writes. Used by scripts/assert-schema-equality.ts
 * (prod-clone-after-bridge vs a FRESH canonical target) and by the PG self-test that proves it can actually fail.
 *
 * The nine dimensions: tables · columns (type/nullability/default) · enums (+ ordered values) · indexes ·
 * foreign keys · check constraints · RLS state (+ policies) · grants · seed rows.
 */

export type Dimension =
  | 'tables' | 'columns' | 'enums' | 'indexes' | 'foreign_keys'
  | 'check_constraints' | 'rls' | 'grants' | 'seed_rows';

export const ALL_DIMENSIONS: Dimension[] = [
  'tables', 'columns', 'enums', 'indexes', 'foreign_keys', 'check_constraints', 'rls', 'grants', 'seed_rows',
];

export interface Diff {
  dimension: Dimension;
  kind: 'missing_in_b' | 'extra_in_b' | 'changed';
  object: string;
  a?: string;
  b?: string;
}

/** A seed row set to compare by content (schema/target parity for migration-seeded config rows, e.g. Coupon FIRST100). */
export interface SeedSpec {
  table: string;
  /** Columns that identify the seed rows (used for ORDER BY + as the diff key). */
  keyColumns: string[];
  /** Columns whose VALUES must match (in addition to the keys). */
  valueColumns: string[];
  /** SQL predicate (no leading WHERE) selecting exactly the seeded rows — never user data. */
  where: string;
}

export interface CompareOptions {
  seeds?: SeedSpec[];
  /** Grant grantees to ignore (e.g. the DB owner, whose name differs between prod and a fresh target). */
  ignoreGrantees?: string[];
  /** Dimensions to run (default: all nine). */
  dimensions?: Dimension[];
}

/** One side of the comparison: a way to run catalog SQL scoped to a schema, plus a label for the report. */
export interface CatalogSide {
  query<T = Record<string, unknown>>(sql: string): Promise<T[]>;
  schema: string;
  label: string;
}

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function assertSchema(s: string): string {
  if (!IDENT.test(s)) throw new Error(`[schema-equality] refusing unsafe schema identifier: ${JSON.stringify(s)}`);
  return s;
}

/** Strip a side's own schema name out of a definition so a two-schema (ref vs cand) run does not false-diff on the
 *  schema qualifier. For a prod-vs-target run (both 'public') this replaces 'public'→'<S>' on BOTH sides — a no-op. */
function normalize(def: string, schema: string): string {
  return String(def).split(`"${schema}".`).join('"<S>".').split(`${schema}.`).join('<S>.');
}

const S = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** Build a key→value map for one side. `val` receives the side's schema so definitions can be schema-normalized. */
async function mapFor(
  side: CatalogSide,
  sql: string,
  key: (r: Record<string, unknown>) => string,
  val: (r: Record<string, unknown>, schema: string) => string,
): Promise<Map<string, string>> {
  const rows = await side.query<Record<string, unknown>>(sql);
  const m = new Map<string, string>();
  for (const r of rows) {
    const k = key(r);
    const v = val(r, side.schema);
    // enums/policies accumulate multiple rows per key — concatenate deterministically (queries are ORDER BY'd).
    m.set(k, m.has(k) ? `${m.get(k)}\n${v}` : v);
  }
  return m;
}

/** Emit missing/extra/changed diffs of map A (side a) against map B (side b). */
function diffMaps(dimension: Dimension, a: Map<string, string>, b: Map<string, string>): Diff[] {
  const out: Diff[] = [];
  for (const [k, av] of a) {
    if (!b.has(k)) out.push({ dimension, kind: 'missing_in_b', object: k, a: av });
    else if (b.get(k) !== av) out.push({ dimension, kind: 'changed', object: k, a: av, b: b.get(k) });
  }
  for (const [k, bv] of b) if (!a.has(k)) out.push({ dimension, kind: 'extra_in_b', object: k, b: bv });
  return out;
}

const query = {
  tables: (s: string) => `SELECT table_name FROM information_schema.tables WHERE table_schema='${s}' AND table_type='BASE TABLE' ORDER BY table_name`,
  columns: (s: string) => `SELECT table_name, column_name, udt_name, is_nullable, COALESCE(column_default,'') AS column_default FROM information_schema.columns WHERE table_schema='${s}' ORDER BY table_name, ordinal_position`,
  enums: (s: string) => `SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='${s}' ORDER BY t.typname, e.enumsortorder`,
  indexes: (s: string) => `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='${s}' ORDER BY indexname`,
  fks: (s: string) => `SELECT c.conname, pg_get_constraintdef(c.oid) AS def FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='${s}' AND c.contype='f' ORDER BY c.conname`,
  checks: (s: string) => `SELECT c.conname, pg_get_constraintdef(c.oid) AS def FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='${s}' AND c.contype='c' ORDER BY c.conname`,
  rlsState: (s: string) => `SELECT c.relname, c.relrowsecurity::text AS rls, c.relforcerowsecurity::text AS force FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='${s}' AND c.relkind='r' ORDER BY c.relname`,
  policies: (s: string) => `SELECT tablename, policyname, cmd, COALESCE(qual,'') AS qual, COALESCE(with_check,'') AS with_check, COALESCE(array_to_string(roles,','),'') AS roles FROM pg_policies WHERE schemaname='${s}' ORDER BY tablename, policyname`,
  grants: (s: string) => `SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants WHERE table_schema='${s}' ORDER BY grantee, table_name, privilege_type`,
};

/** Compare side A (reference/target) against side B (candidate/prod-clone). Returns every difference found. */
export async function compareSchemas(a: CatalogSide, b: CatalogSide, opts: CompareOptions = {}): Promise<Diff[]> {
  const sa = assertSchema(a.schema);
  const sb = assertSchema(b.schema);
  const dims = new Set(opts.dimensions ?? ALL_DIMENSIONS);
  const diffs: Diff[] = [];

  const both = async (
    dim: Dimension,
    sql: (s: string) => string,
    key: (r: Record<string, unknown>) => string,
    val: (r: Record<string, unknown>, schema: string) => string,
  ) => {
    const [ma, mb] = await Promise.all([mapFor(a, sql(sa), key, val), mapFor(b, sql(sb), key, val)]);
    diffs.push(...diffMaps(dim, ma, mb));
  };

  if (dims.has('tables')) await both('tables', query.tables, (r) => S(r.table_name), () => 'present');
  if (dims.has('columns')) await both('columns', query.columns, (r) => `${S(r.table_name)}.${S(r.column_name)}`, (r, s) => `${S(r.udt_name)}|nullable=${S(r.is_nullable)}|default=${normalize(S(r.column_default), s)}`);
  if (dims.has('enums')) await both('enums', query.enums, (r) => S(r.typname), (r) => S(r.enumlabel));
  if (dims.has('indexes')) await both('indexes', query.indexes, (r) => S(r.indexname), (r, s) => normalize(S(r.indexdef), s));
  if (dims.has('foreign_keys')) await both('foreign_keys', query.fks, (r) => S(r.conname), (r, s) => normalize(S(r.def), s));
  if (dims.has('check_constraints')) await both('check_constraints', query.checks, (r) => S(r.conname), (r, s) => normalize(S(r.def), s));
  if (dims.has('rls')) {
    await both('rls', query.rlsState, (r) => `table:${S(r.relname)}`, (r) => `rls=${S(r.rls)},force=${S(r.force)}`);
    await both('rls', query.policies, (r) => `policy:${S(r.tablename)}.${S(r.policyname)}`, (r, s) => `cmd=${S(r.cmd)}|roles=${S(r.roles)}|qual=${normalize(S(r.qual), s)}|check=${normalize(S(r.with_check), s)}`);
  }
  if (dims.has('grants')) {
    const ignore = new Set((opts.ignoreGrantees ?? []).map((x) => x.toLowerCase()));
    const [ga, gb] = await Promise.all([
      mapFor(a, query.grants(sa), (r) => `${S(r.grantee)}|${S(r.table_name)}|${S(r.privilege_type)}`, () => 'granted'),
      mapFor(b, query.grants(sb), (r) => `${S(r.grantee)}|${S(r.table_name)}|${S(r.privilege_type)}`, () => 'granted'),
    ]);
    for (const m of [ga, gb]) for (const k of [...m.keys()]) if (ignore.has(k.split('|')[0].toLowerCase())) m.delete(k);
    diffs.push(...diffMaps('grants', ga, gb));
  }
  if (dims.has('seed_rows') && opts.seeds?.length) {
    for (const seed of opts.seeds) {
      assertSchema(seed.table); // seed.table is a plain identifier interpolated into the query
      for (const c of [...seed.keyColumns, ...seed.valueColumns]) assertSchema(c);
      const cols = [...seed.keyColumns, ...seed.valueColumns].map((c) => `"${c}"`).join(', ');
      const order = seed.keyColumns.map((c) => `"${c}"`).join(', ');
      const sql = (s: string) => `SELECT ${cols} FROM "${s}"."${seed.table}" WHERE ${seed.where} ORDER BY ${order}`;
      const key = (r: Record<string, unknown>) => `${seed.table}:${seed.keyColumns.map((c) => S(r[c])).join('/')}`;
      const val = (r: Record<string, unknown>) => seed.valueColumns.map((c) => `${c}=${S(r[c])}`).join('|');
      await both('seed_rows', sql, key, val);
    }
  }

  return diffs;
}

/** Human-readable one-line-per-diff report. */
export function formatDiffs(diffs: Diff[], aLabel: string, bLabel: string): string {
  if (diffs.length === 0) return `EQUAL — ${aLabel} ≡ ${bLabel} across all checked dimensions.`;
  const byDim = new Map<Dimension, Diff[]>();
  for (const d of diffs) { const a = byDim.get(d.dimension) ?? []; a.push(d); byDim.set(d.dimension, a); }
  const lines = [`UNEQUAL — ${diffs.length} difference(s) between A=${aLabel} and B=${bLabel}:`];
  for (const dim of ALL_DIMENSIONS) {
    const ds = byDim.get(dim);
    if (!ds?.length) continue;
    lines.push(`  [${dim}] ${ds.length}`);
    for (const d of ds) {
      if (d.kind === 'missing_in_b') lines.push(`    - MISSING in B: ${d.object}  (A: ${d.a})`);
      else if (d.kind === 'extra_in_b') lines.push(`    - EXTRA in B:   ${d.object}  (B: ${d.b})`);
      else lines.push(`    - CHANGED:      ${d.object}\n        A: ${d.a}\n        B: ${d.b}`);
    }
  }
  return lines.join('\n');
}
