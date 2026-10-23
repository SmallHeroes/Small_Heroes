import 'server-only';
import path from 'node:path';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { localReaderAsset, localReaderId, localReaderPreviewSchema } from './local-reader-preview';

/** Strictly local development; staging overrides must never expose arbitrary local preview files. */
export function assertLocalReaderEnvironment() {
  if (process.env.NODE_ENV === 'production') throw Error('local_reader_dev_only');
}

async function previewDirectory(id: string) {
  assertLocalReaderEnvironment(); localReaderId(id);
  const root = await realpath(path.join(process.cwd(), 'outputs', 'local-reader-previews'));
  const directory = await realpath(path.join(root, id));
  if (path.relative(root, directory) !== id) throw Error('local_reader_path');
  return directory;
}

async function boundedFile(directory: string, name: string, maximum: number) {
  const file = await realpath(path.join(directory, name));
  if (path.relative(directory, file) !== name) throw Error('local_reader_path');
  const info = await stat(file);
  if (!info.isFile() || info.size <= 0 || info.size > maximum) throw Error('local_reader_file');
  return readFile(file);
}

export async function loadLocalReaderPreview(id: string) {
  const directory = await previewDirectory(id);
  const preview = localReaderPreviewSchema.parse(JSON.parse((await boundedFile(directory, 'manifest.json', 250000)).toString('utf8')));
  if (preview.id !== id) throw Error('local_reader_id_binding');
  return preview;
}

export async function loadLocalReaderAsset(id: string, file: string) {
  const preview = await loadLocalReaderPreview(id), asset = localReaderAsset(preview, file);
  const bytes = await boundedFile(await previewDirectory(id), file, 32000000);
  if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw Error('local_reader_asset_hash');
  return { bytes, contentType: asset.contentType };
}
