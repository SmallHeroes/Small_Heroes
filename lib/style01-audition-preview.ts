import { existsSync } from 'fs';
import { readdir, readFile, stat } from 'fs/promises';
import path from 'path';

export type Style01AuditionManifestPage = {
  pageNumber: number;
  hebrewText?: string;
  imageUrl?: string | null;
  localPng?: string | null;
  failed?: boolean;
};

export type Style01AuditionManifest = {
  audition?: string;
  manifestDir?: string;
  orderId?: string;
  quality?: string;
  pages?: Style01AuditionManifestPage[];
};

export type Style01AuditionSummary = {
  dir: string;
  mtimeMs: number;
  pageCount: number;
  audition?: string;
  quality?: string;
  failedPages?: number[];
};

const LOGS_ROOT = path.join(process.cwd(), 'phase2-logs');
const DINI_PREFIX = 'style01-dini-audition-';

export function isStyle01AuditionDirName(name: string): boolean {
  return name.startsWith(DINI_PREFIX);
}

export async function listStyle01DiniAuditions(): Promise<Style01AuditionSummary[]> {
  if (!existsSync(LOGS_ROOT)) return [];
  const entries = await readdir(LOGS_ROOT, { withFileTypes: true });
  const summaries: Style01AuditionSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !isStyle01AuditionDirName(entry.name)) continue;
    const dirPath = path.join(LOGS_ROOT, entry.name);
    const manifestPath = path.join(dirPath, 'manifest.json');
    if (!existsSync(manifestPath)) continue;

    try {
      const [fileStat, raw] = await Promise.all([stat(manifestPath), readFile(manifestPath, 'utf-8')]);
      const manifest = JSON.parse(raw) as Style01AuditionManifest;
      const pages = manifest.pages ?? [];
      summaries.push({
        dir: entry.name,
        mtimeMs: fileStat.mtimeMs,
        pageCount: pages.length,
        audition: manifest.audition,
        quality: manifest.quality,
        failedPages: pages.filter((p) => p.failed).map((p) => p.pageNumber),
      });
    } catch {
      // skip corrupt manifests
    }
  }

  return summaries.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

export async function loadStyle01AuditionManifest(dirName: string): Promise<{
  dirPath: string;
  manifest: Style01AuditionManifest;
}> {
  if (!isStyle01AuditionDirName(dirName) || dirName.includes('..')) {
    throw new Error('Invalid audition directory');
  }
  const dirPath = path.join(LOGS_ROOT, dirName);
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

export function auditionAssetUrl(dirName: string, pageNumber: number): string {
  return `/api/dev/style01-book-preview/asset?dir=${encodeURIComponent(dirName)}&page=${pageNumber}`;
}
