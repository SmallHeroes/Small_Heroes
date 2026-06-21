import { existsSync } from 'fs';
import { readdir, readFile, stat } from 'fs/promises';
import path from 'path';

import { isServerlessRuntime } from '@/lib/generation-pipeline/runtime-artifact-store';
import {
  downloadOrderArtifactJson,
  listStorageFolder,
  uploadOrderArtifact,
} from '@/lib/image-storage';

/**
 * Durable QA audition manifests (0096 M5b). On serverless the audition output lives in /tmp (gone across
 * invocations), so the dev viewer/library 500'd reading the local `outputs/` FS. The rendered page IMAGES
 * already persist to Supabase (`orders/{qaOrderId}/pages/...`), so we also persist the audition MANIFEST
 * (whose `pages[].imageUrl` are those Supabase URLs) to `orders/qa-auditions/{dir}/manifest.json` and read
 * the library + book from there in serverless. Local dev keeps the FS path unchanged.
 */
const QA_AUDITIONS_ORDER = 'qa-auditions';
const QA_AUDITION_MANIFEST_FILE = 'manifest.json';

/** Parse the trailing `-YYYYMMDD-HHMMSS` an audition dir name carries into an epoch ms (0 if absent). */
function auditionDirMtimeMs(dir: string): number {
  const m = dir.match(/-(\d{8})-(\d{6})$/);
  if (!m) return 0;
  const [, ymd, hms] = m;
  const iso = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T${hms.slice(0, 2)}:${hms.slice(2, 4)}:${hms.slice(4, 6)}Z`;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

export type Style01AuditionManifestPage = {
  pageNumber: number;
  hebrewText?: string;
  narrationText?: string;
  imageUrl?: string | null;
  localPng?: string | null;
  audioUrl?: string | null;
  localMp3?: string | null;
  failed?: boolean;
  renderStatus?: 'rendered' | 'not rendered in this audition';
};

export type Style01AuditionManifest = {
  audition?: string;
  qaConsole?: boolean;
  storyKey?: string;
  storyFile?: string;
  companionId?: string;
  direction?: string;
  childProfile?: {
    name?: string;
    gender?: string;
    age?: number;
    photoFaithful?: boolean;
    preset?: string;
  };
  voiceId?: string;
  manifestDir?: string;
  orderId?: string;
  quality?: string;
  model?: string;
  renderedPageNumbers?: number[];
  totalStoryPages?: number;
  pages?: Style01AuditionManifestPage[];
  allStoryPages?: Style01AuditionManifestPage[];
};

export type Style01AuditionSummary = {
  dir: string;
  root: 'phase2-logs' | 'outputs';
  mtimeMs: number;
  pageCount: number;
  audition?: string;
  quality?: string;
  failedPages?: number[];
  /** Human-friendly label for run-history dropdown */
  label?: string;
};

const LOGS_ROOT = path.join(process.cwd(), 'phase2-logs');
const OUTPUTS_ROOT = path.join(process.cwd(), 'outputs', 'style01-auditions');

export function isStyle01AuditionDirName(name: string): boolean {
  if (!name || name.length > 120) return false;
  if (name.includes('..') || name.includes('/') || name.includes('\\')) return false;
  return /^[a-zA-Z0-9._-]+$/.test(name);
}

async function scanAuditionRoot(
  rootPath: string,
  rootLabel: 'phase2-logs' | 'outputs'
): Promise<Style01AuditionSummary[]> {
  if (!existsSync(rootPath)) return [];
  const entries = await readdir(rootPath, { withFileTypes: true });
  const summaries: Style01AuditionSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !isStyle01AuditionDirName(entry.name)) continue;
    const dirPath = path.join(rootPath, entry.name);
    const manifestPath = path.join(dirPath, 'manifest.json');
    if (!existsSync(manifestPath)) continue;

    try {
      const [fileStat, raw] = await Promise.all([stat(manifestPath), readFile(manifestPath, 'utf-8')]);
      const manifest = JSON.parse(raw) as Style01AuditionManifest;
      const pages = manifest.pages ?? [];
      const renderedCount =
        manifest.renderedPageNumbers?.length ??
        pages.filter((p) => !p.failed && (p.localPng || p.imageUrl)).length;
      const label =
        manifest.qaConsole && manifest.storyKey
          ? `${entry.name} (${manifest.storyKey}${manifest.childProfile?.name ? ` · ${manifest.childProfile.name}` : ''})`
          : entry.name;
      summaries.push({
        dir: entry.name,
        root: rootLabel,
        mtimeMs: fileStat.mtimeMs,
        pageCount: renderedCount,
        audition: manifest.audition ?? (manifest.qaConsole ? 'qa-console' : undefined),
        quality: manifest.quality,
        failedPages: pages.filter((p) => p.failed).map((p) => p.pageNumber),
        label,
      });
    } catch {
      // skip corrupt manifests
    }
  }

  return summaries;
}

/** Build a library summary from a manifest (shared by FS scan and Supabase listing). */
function summaryFromManifest(
  dir: string,
  manifest: Style01AuditionManifest,
  mtimeMs: number
): Style01AuditionSummary {
  const pages = manifest.pages ?? [];
  const renderedCount =
    manifest.renderedPageNumbers?.length ??
    pages.filter((p) => !p.failed && (p.localPng || p.imageUrl)).length;
  const label =
    manifest.qaConsole && manifest.storyKey
      ? `${dir} (${manifest.storyKey}${manifest.childProfile?.name ? ` · ${manifest.childProfile.name}` : ''})`
      : dir;
  return {
    dir,
    root: 'outputs',
    mtimeMs,
    pageCount: renderedCount,
    audition: manifest.audition ?? (manifest.qaConsole ? 'qa-console' : undefined),
    quality: manifest.quality,
    failedPages: pages.filter((p) => p.failed).map((p) => p.pageNumber),
    label,
  };
}

/**
 * Persist the audition manifest to Supabase so the dev viewer/library can read it across invocations.
 * Accepts `unknown` because the caller assembles a richer manifest object than Style01AuditionManifest
 * (extra QA/debug fields); it is read back, typed, via downloadOrderArtifactJson<Style01AuditionManifest>.
 */
export async function persistAuditionManifestDurable(dir: string, manifest: unknown): Promise<void> {
  if (!isServerlessRuntime()) return; // local dev reads the FS copy
  try {
    await uploadOrderArtifact({
      orderId: QA_AUDITIONS_ORDER,
      kind: dir,
      filename: QA_AUDITION_MANIFEST_FILE,
      buffer: Buffer.from(JSON.stringify(manifest, null, 2)),
      contentType: 'application/json',
    });
  } catch (err) {
    console.warn(`[qa-console] failed persisting durable audition manifest for ${dir}:`, err);
  }
}

async function listDurableAuditions(): Promise<Style01AuditionSummary[]> {
  const folders = await listStorageFolder(`orders/${QA_AUDITIONS_ORDER}`);
  const dirs = folders
    .map((f) => f.name)
    .filter(isStyle01AuditionDirName)
    .sort()
    .reverse()
    .slice(0, 80);
  const summaries = await Promise.all(
    dirs.map(async (dir) => {
      const manifest = await downloadOrderArtifactJson<Style01AuditionManifest>({
        orderId: QA_AUDITIONS_ORDER,
        kind: dir,
        filename: QA_AUDITION_MANIFEST_FILE,
      });
      return manifest ? summaryFromManifest(dir, manifest, auditionDirMtimeMs(dir)) : null;
    })
  );
  return summaries.filter((s): s is Style01AuditionSummary => s != null);
}

export async function listStyle01DiniAuditions(): Promise<Style01AuditionSummary[]> {
  if (isServerlessRuntime()) {
    // Local FS does not survive in serverless — list cloud-persisted auditions instead.
    return (await listDurableAuditions()).sort((a, b) => b.mtimeMs - a.mtimeMs);
  }
  const [legacy, outputs] = await Promise.all([
    scanAuditionRoot(LOGS_ROOT, 'phase2-logs'),
    scanAuditionRoot(OUTPUTS_ROOT, 'outputs'),
  ]);
  return [...legacy, ...outputs].sort((a, b) => b.mtimeMs - a.mtimeMs);
}

export function resolveAuditionDirPath(
  dirName: string,
  root?: 'phase2-logs' | 'outputs'
): string {
  if (!isStyle01AuditionDirName(dirName)) {
    throw new Error('Invalid audition directory');
  }
  if (root === 'outputs') {
    return path.join(OUTPUTS_ROOT, dirName);
  }
  if (root === 'phase2-logs') {
    return path.join(LOGS_ROOT, dirName);
  }
  const outputsPath = path.join(OUTPUTS_ROOT, dirName);
  if (existsSync(path.join(outputsPath, 'manifest.json'))) return outputsPath;
  return path.join(LOGS_ROOT, dirName);
}

export async function loadStyle01AuditionManifest(
  dirName: string,
  root?: 'phase2-logs' | 'outputs'
): Promise<{
  dirPath: string;
  manifest: Style01AuditionManifest;
}> {
  if (isServerlessRuntime()) {
    // /tmp manifest is gone across invocations — read the durable Supabase copy (0096 M5b).
    if (!isStyle01AuditionDirName(dirName)) throw new Error('Invalid audition directory');
    const manifest = await downloadOrderArtifactJson<Style01AuditionManifest>({
      orderId: QA_AUDITIONS_ORDER,
      kind: dirName,
      filename: QA_AUDITION_MANIFEST_FILE,
    });
    if (!manifest) throw new Error('manifest.json not found');
    // dirPath is unused in serverless (no local page files); the loader falls back to the Supabase
    // imageUrl carried in the manifest. Empty path makes existsSync() checks return false.
    return { dirPath: '', manifest: { ...manifest, manifestDir: dirName } };
  }
  const dirPath = resolveAuditionDirPath(dirName, root);
  const manifestPath = path.join(dirPath, 'manifest.json');
  if (!existsSync(manifestPath)) {
    throw new Error('manifest.json not found');
  }
  const raw = await readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(raw) as Style01AuditionManifest;
  return { dirPath, manifest: { ...manifest, manifestDir: dirName } };
}

export function resolveAuditionPageImagePath(
  dirPath: string,
  page: Style01AuditionManifestPage
): string | null {
  const local = page.localPng?.trim();
  if (local && existsSync(local)) return local;
  const fallback = path.join(
    dirPath,
    `page-${String(page.pageNumber).padStart(2, '0')}.png`
  );
  if (existsSync(fallback)) return fallback;
  return null;
}

export function auditionAssetUrl(
  dirName: string,
  pageNumber: number,
  kind: 'image' | 'audio' = 'image'
): string {
  const qs = new URLSearchParams({
    dir: dirName,
    page: String(pageNumber),
    kind,
  });
  return `/api/dev/style01-book-preview/asset?${qs.toString()}`;
}

export function resolveAuditionPageAudioPath(
  dirPath: string,
  page: Style01AuditionManifestPage
): string | null {
  const local = page.localMp3?.trim();
  if (local && existsSync(local)) return local;
  const fallback = path.join(dirPath, `page-${String(page.pageNumber).padStart(2, '0')}.mp3`);
  if (existsSync(fallback)) return fallback;
  return null;
}
