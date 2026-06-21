import { mkdirSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';

import { uploadOrderArtifact } from '../image-storage';

/**
 * RuntimeArtifactStore (roundtable 0094)
 * ======================================
 * One place to decide WHERE a render-path artifact is allowed to live, so the cloud render
 * stops dying with `ENOENT mkdir /var/task/outputs` (Vercel FS is read-only except the OS temp
 * dir). Two scopes:
 *
 *   - TEMP (ephemeral / per-invocation): `tempPath()` under `os.tmpdir()`. Scratch only — gone
 *     when the serverless invocation ends. Clean up after use (`cleanupTemp`).
 *   - DURABLE (cross-chunk): `persistBuffer` / `persistJson` → Supabase, returning a descriptor
 *     `{ url, storageKey }` that the caller stores in `pipelineCache`. The render is chunked across
 *     invocations, so anything a future chunk consumes MUST be durable + referenced by URL.
 *
 * The render must NEVER write to the project FS in the cloud. `assertArtifactWriteAllowed` is the
 * loud backstop: on a serverless runtime (`VERCEL_ENV` set), any path outside the OS temp dir
 * throws — mirroring the override-free spirit of `lib/generation-chunked/env-separation-guard.ts`.
 * Local dev (no `VERCEL_ENV`) is unaffected; it may still write `outputs/` as before.
 */

const TEMP_NAMESPACE = 'small-heroes';

/** True on any Vercel runtime (production OR preview). Local dev and tests have no VERCEL_ENV. */
export function isServerlessRuntime(): boolean {
  return !!(process.env.VERCEL_ENV && process.env.VERCEL_ENV.trim());
}

/** Local-mirror opt-in: write a copy under ./outputs only when explicitly enabled in local dev. */
export function isLocalArtifactMirrorEnabled(): boolean {
  return process.env.LOCAL_ARTIFACTS_ENABLED === 'true';
}

function sanitizeSegment(value: string): string {
  return String(value)
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9/_.-]+/g, '-');
}

/** True if `absPath` resolves to the OS temp dir or somewhere inside it. */
export function isUnderOsTmp(absPath: string): boolean {
  const tmp = path.resolve(os.tmpdir());
  const resolved = path.resolve(absPath);
  if (resolved === tmp) return true;
  const rel = path.relative(tmp, resolved);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Throw if `absPath` is outside the OS temp dir on a serverless runtime. No-op when the path is
 * under the temp dir, and no-op on local dev (where project writes are fine). There is intentionally
 * NO override env var — failing loud is the whole point.
 */
export function assertArtifactWriteAllowed(absPath: string): void {
  if (isUnderOsTmp(absPath)) return;
  if (isServerlessRuntime()) {
    throw new Error(
      `[runtime-artifact-store] Refusing to write outside the OS temp dir on a serverless runtime ` +
        `(VERCEL_ENV="${process.env.VERCEL_ENV}"). Path: ${absPath}. Vercel's filesystem is read-only ` +
        `except ${os.tmpdir()} — use RuntimeArtifactStore.tempPath() for ephemeral scratch, or ` +
        `persistBuffer()/persistJson() for durable cross-chunk artifacts (Supabase).`
    );
  }
}

/**
 * Ephemeral scratch directory under the OS temp dir: `<os.tmpdir()>/small-heroes/{orderId}/{kind}/`.
 * Creates it (mkdir -p) and returns the absolute path. Callers join filenames onto it and must clean
 * up via `cleanupTemp` when done. NEVER use this for anything a later chunk needs — it's invocation-local.
 */
/**
 * Canon/reference-sheet generators (companion sheets, zone/object sheets, …) are LOCAL dev tools that
 * write committed assets under public/ or story-bank/. They must never run on a serverless runtime: in
 * the cloud those assets are pre-baked, committed, and loaded read-only. Call at the top of each
 * generator so a stray production invocation fails fast with a clear message instead of mkdir-ing a
 * canon asset mid-render (which is what ENOENT'd on /var/task).
 */
export function assertCanonGenerationLocal(toolName: string): void {
  if (isServerlessRuntime()) {
    throw new Error(
      `[runtime-artifact-store] ${toolName} is a local canon/dev tool and must not run on a serverless ` +
        `runtime (VERCEL_ENV="${process.env.VERCEL_ENV}"). Its assets are pre-baked and committed ` +
        `(public/companions/<id>/style01-sheets, story-bank/v3-approved/...) and loaded read-only in the ` +
        `cloud — regenerate them locally and commit, never mid-render.`
    );
  }
}

export function artifactsBaseDir(kind: string): string {
  const safeKind = sanitizeSegment(kind) || 'misc';
  const base = isServerlessRuntime()
    ? path.join(os.tmpdir(), TEMP_NAMESPACE, safeKind)
    : path.join(process.cwd(), 'outputs', safeKind);
  assertArtifactWriteAllowed(base);
  return base;
}

export function tempPath(orderId: string, kind: string): string {
  const dir = path.join(
    os.tmpdir(),
    TEMP_NAMESPACE,
    sanitizeSegment(orderId) || 'unknown',
    sanitizeSegment(kind) || 'misc'
  );
  // By construction this is under tmp; assert anyway so a future refactor can't silently break it.
  assertArtifactWriteAllowed(dir);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Write an ephemeral file under `tempPath(orderId, kind)` and return its absolute path. */
export function writeTempFile(
  orderId: string,
  kind: string,
  filename: string,
  data: Buffer | string
): string {
  const dir = tempPath(orderId, kind);
  const abs = path.join(dir, sanitizeSegment(filename) || 'artifact');
  assertArtifactWriteAllowed(abs);
  writeFileSync(abs, data);
  return abs;
}

/** Remove an ephemeral subtree. `kind` omitted → removes the whole order temp namespace. */
export function cleanupTemp(orderId: string, kind?: string): void {
  const base = path.join(os.tmpdir(), TEMP_NAMESPACE, sanitizeSegment(orderId) || 'unknown');
  const target = kind ? path.join(base, sanitizeSegment(kind) || 'misc') : base;
  try {
    rmSync(target, { recursive: true, force: true });
  } catch {
    /* best-effort cleanup — never fail a render over a temp delete */
  }
}

/**
 * Persist a durable binary artifact to Supabase and return its descriptor. Stored under
 * `orders/{orderId}/{kind}/{filename}`. Touches no local disk.
 */
export async function persistBuffer(
  orderId: string,
  kind: string,
  filename: string,
  buffer: Buffer,
  contentType: string
): Promise<{ url: string; storageKey: string }> {
  return uploadOrderArtifact({ orderId, kind, filename, buffer, contentType });
}

/** Persist a durable JSON artifact to Supabase and return its descriptor. Touches no local disk. */
export async function persistJson(
  orderId: string,
  kind: string,
  filename: string,
  object: unknown
): Promise<{ url: string; storageKey: string }> {
  const buffer = Buffer.from(JSON.stringify(object, null, 2));
  return persistBuffer(orderId, kind, filename, buffer, 'application/json');
}

/**
 * Cache invariant (0094 M3b)
 * --------------------------
 * pipelineCache is carried across serverless invocations, so it must hold ONLY durable references
 * (https URLs / descriptors) — never an ephemeral, invocation-local artifact path. A path under
 * `outputs/`, `/tmp`, `/var/task`, or a Windows absolute dir would simply not exist in the next
 * chunk's invocation. Committed read-only paths (e.g. `story-bank/v3-approved/...md`) are fine and are
 * deliberately NOT flagged — only ephemeral/writable artifact locations are.
 */
const EPHEMERAL_PATH_PATTERNS: RegExp[] = [
  /^[A-Za-z]:[\\/]/, // Windows absolute (C:\..., includes the temp dir)
  /^\/(?:var\/task|tmp)(?:[\\/]|$)/, // serverless absolute scratch / read-only bundle root
  /(?:^|[\\/])outputs[\\/]/, // any ./outputs artifact directory
];

/**
 * Committed, read-only bundle assets (the deployment's `story-bank/` and `public/` trees) DO exist in
 * every serverless invocation, so referencing them across chunks is legitimate — they are not ephemeral
 * artifacts. Only generated WRITES outside `/tmp` are forbidden. This carve-out covers in-flight caches
 * that still hold an absolute committed path (e.g. a legacy `/var/task/story-bank/...` storyFilePath).
 */
const COMMITTED_BUNDLE_READ = /^\/var\/task\/(?:story-bank|public)\//i;

function looksLikeEphemeralLocalPath(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (/^https?:\/\//i.test(v) || /^data:/i.test(v)) return false; // URLs/data are the durable form
  if (COMMITTED_BUNDLE_READ.test(v)) return false; // committed read-only bundle, not a generated artifact
  return EPHEMERAL_PATH_PATTERNS.some((re) => re.test(v));
}

/** Recursively collect `keyPath = value` strings in `node` that look like ephemeral local paths. */
export function findEphemeralLocalArtifactPaths(node: unknown): string[] {
  const out: string[] = [];
  const walk = (n: unknown, keyP: string): void => {
    if (typeof n === 'string') {
      if (looksLikeEphemeralLocalPath(n)) out.push(`${keyP || '(root)'} = ${n}`);
      return;
    }
    if (Array.isArray(n)) {
      n.forEach((c, i) => walk(c, `${keyP}[${i}]`));
      return;
    }
    if (n && typeof n === 'object') {
      for (const [k, v] of Object.entries(n)) walk(v, keyP ? `${keyP}.${k}` : k);
    }
  };
  walk(node, '');
  return out;
}

/** Throw if `cache` carries any ephemeral local artifact path (see findEphemeralLocalArtifactPaths). */
export function assertCacheHasNoLocalArtifactPaths(cache: unknown): void {
  const offenders = findEphemeralLocalArtifactPaths(cache);
  if (offenders.length) {
    throw new Error(
      `[runtime-artifact-store] pipelineCache must carry only durable URLs/descriptors across chunks, ` +
        `but found ephemeral local artifact path(s): ${offenders.join('; ')}. Persist the artifact via ` +
        `persistBuffer()/persistJson() and store its {url, storageKey} descriptor instead.`
    );
  }
}

/**
 * Mirror an artifact to `./outputs/{relPath}` for local eyeballing — ONLY when
 * `LOCAL_ARTIFACTS_ENABLED === 'true'` AND not on a serverless runtime. No-op otherwise, so it can
 * be called unconditionally from the render path without ever writing the project FS in the cloud.
 */
export function maybeMirrorLocal(relPath: string, data: Buffer | string): void {
  if (!isLocalArtifactMirrorEnabled() || isServerlessRuntime()) return;
  const abs = path.join(process.cwd(), 'outputs', relPath);
  assertArtifactWriteAllowed(abs);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, data);
}
