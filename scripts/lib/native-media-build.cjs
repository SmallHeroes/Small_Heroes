'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { createRequire } = require('node:module');
const { DIRECTORY, VERSION, MAX_BINARY_BYTES, readArchive } = require('./native-media.cjs');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function installedMedia(root) {
  const load = createRequire(path.join(root, 'package.json'));
  return { ffmpeg: load('@ffmpeg-installer/ffmpeg').path, ffprobe: load('@ffprobe-installer/ffprobe').path };
}
function prepareNativeArchive(root, binaries = installedMedia(root)) {
  root = fs.realpathSync(root);
  if (!binaries || Object.keys(binaries).sort().join(',') !== 'ffmpeg,ffprobe') throw new Error('native_media_binary_path');
  const dependencies = fs.realpathSync(path.join(root, 'node_modules'));
  for (const name of ['ffmpeg', 'ffprobe']) {
    const file = binaries[name];
    if (typeof file !== 'string' || ![name, name + '.exe'].includes(path.basename(file))) throw new Error('native_media_binary_path');
    const real = fs.realpathSync(file);
    if (!real.startsWith(dependencies + path.sep) || ![name, name + '.exe'].includes(path.basename(real)) || !fs.statSync(real).isFile()) throw new Error('native_media_binary_path');
  }
  const directory = path.join(root, DIRECTORY);
  const parent = path.dirname(directory);
  if (fs.existsSync(parent) && (fs.lstatSync(parent).isSymbolicLink() || fs.realpathSync(parent) !== parent)) throw new Error('native_media_archive_path');
  fs.mkdirSync(directory, { recursive: true });
  if (fs.lstatSync(directory).isSymbolicLink() || fs.realpathSync(directory) !== directory) throw new Error('native_media_archive_path');
  const manifest = { version: VERSION, platform: process.platform, arch: process.arch, binaries: {} };
  for (const name of ['ffmpeg', 'ffprobe']) {
    const raw = fs.readFileSync(binaries[name]);
    if (!raw.length || raw.length > MAX_BINARY_BYTES) throw new Error('native_media_binary_size');
    const digest = sha(raw), file = digest + '.gz', compressed = zlib.gzipSync(raw, { level: 9 });
    const destination = path.join(directory, file);
    if (fs.existsSync(destination) && fs.lstatSync(destination).isSymbolicLink()) throw new Error('native_media_archive_path');
    fs.writeFileSync(destination, compressed);
    manifest.binaries[name] = { file, bytes: raw.length, sha256: digest, gzipBytes: compressed.length, gzipSha256: sha(compressed) };
  }
  const manifestFile = path.join(directory, 'manifest.json');
  if (fs.existsSync(manifestFile) && fs.lstatSync(manifestFile).isSymbolicLink()) throw new Error('native_media_archive_path');
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  return { ...readArchive(root), rawPaths: Object.values(binaries) };
}
module.exports = { installedMedia, prepareNativeArchive };
