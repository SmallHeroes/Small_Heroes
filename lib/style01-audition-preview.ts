import { existsSync } from 'fs';
import { readdir, readFile, stat } from 'fs/promises';
import path from 'path';

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
