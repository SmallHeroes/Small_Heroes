import { existsSync } from 'fs';
import { readdir, readFile, stat } from 'fs/promises';
import path from 'path';

export type Style01AuditionManifestPage = {
  pageNumber: number;
  hebrewText?: string;
  imageUrl?: string | null;
  localPng?: string | null;
  failed?: boolean;
  renderStatus?: 'rendered' | 'not rendered in this audition';
};

export type Style01AuditionManifest = {
  audition?: string;
  manifestDir?: string;
  orderId?: string;
  quality?: string;
  model?: string;
  renderedPageNumbers?: number[];
  totalStoryPages?: number;
  pages?: Style01AuditionManifestPage[];
};

export type Style01AuditionSummary = {
  dir: string;
  root: 'phase2-logs' | 'outputs';
  mtimeMs: number;
  pageCount: number;
  audition?: string;
  quality?: string;
  failedPages?: number[];
};

const LOGS_ROOT = path.join(process.cwd(), 'phase2-logs');
const OUTPUTS_ROOT = path.join(process.cwd(), 'outputs', 'style01-auditions');

const LEGACY_DINI_PREFIX = 'style01-dini-audition-';
const BOUNDARY_EGG_PREFIX = 'dini-boundary-egg-low-';

export function isStyle01AuditionDirName(name: string): boolean {
  return name.startsWith(LEGACY_DINI_PREFIX) || name.startsWith(BOUNDARY_EGG_PREFIX);
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
      summaries.push({
        dir: entry.name,
        root: rootLabel,
        mtimeMs: fileStat.mtimeMs,
        pageCount: renderedCount,
        audition: manifest.audition,
        quality: manifest.quality,
        failedPages: pages.filter((p) => p.failed).map((p) => p.pageNumber),
      });
    } catch {
      // skip corrupt manifests
    }
  }

  return summaries;
}

export async function listStyle01DiniAuditions(): Promise<Style01AuditionSummary[]> {
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
  if (!isStyle01AuditionDirName(dirName) || dirName.includes('..')) {
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

export function auditionAssetUrl(dirName: string, pageNumber: number): string {
  return `/api/dev/style01-book-preview/asset?dir=${encodeURIComponent(dirName)}&page=${pageNumber}`;
}
