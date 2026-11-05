'use strict';
// Executable bytes are losslessly packed by the build, never downloaded at runtime.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const DIRECTORY = '.next/engine-native-media-v1';
const VERSION = 'engine-native-media/v1';
const MAX_BINARY_BYTES = 128 * 1024 * 1024;
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const cache = new Map();
function removeOwnedExtraction(directory) {
  directory = path.resolve(directory);
  if (path.dirname(directory) !== path.resolve(os.tmpdir()) || !path.basename(directory).startsWith('smallheroes-native-')) throw new Error('native_media_cleanup_path');
  let stat; try { stat = fs.lstatSync(directory); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (!stat.isDirectory() || stat.isSymbolicLink() || path.dirname(fs.realpathSync(directory)) !== fs.realpathSync(os.tmpdir())) throw new Error('native_media_cleanup_path');
  fs.rmSync(directory, { recursive: true, force: true });
}
process.once('exit',()=>{for(const value of cache.values()) {
  try { removeOwnedExtraction(path.dirname(value.ffmpeg)); } catch {}
}});
function readArchive(root = process.cwd()) {
  root = fs.realpathSync(root);
  const directory = path.join(root, DIRECTORY), manifestFile = path.join(directory, 'manifest.json');
  if (!fs.existsSync(directory)) return null;
  if (fs.lstatSync(directory).isSymbolicLink() || fs.realpathSync(directory) !== directory || fs.lstatSync(manifestFile).isSymbolicLink()) throw new Error('native_media_archive_path');
  const bytes = fs.readFileSync(manifestFile);
  const manifest = JSON.parse(bytes.toString('utf8'));
  if (Object.keys(manifest).sort().join(',') !== 'arch,binaries,platform,version' || manifest.version !== VERSION || manifest.platform !== process.platform || manifest.arch !== process.arch ||
      !manifest.binaries || Object.keys(manifest.binaries).sort().join(',') !== 'ffmpeg,ffprobe') throw new Error('native_media_archive_manifest');
  const files = [manifestFile];
  for (const name of ['ffmpeg', 'ffprobe']) {
    const row = manifest.binaries[name];
    if (!row || Object.keys(row).sort().join(',') !== 'bytes,file,gzipBytes,gzipSha256,sha256' || !/^[a-f0-9]{64}$/.test(row.sha256) || !/^[a-f0-9]{64}$/.test(row.gzipSha256) ||
        row.file !== row.sha256 + '.gz' || !Number.isSafeInteger(row.bytes) || row.bytes <= 0 || row.bytes > MAX_BINARY_BYTES ||
        !Number.isSafeInteger(row.gzipBytes) || row.gzipBytes <= 0 || row.gzipBytes > MAX_BINARY_BYTES) throw new Error('native_media_archive_manifest');
    const file = path.join(directory, row.file);
    if (fs.lstatSync(file).isSymbolicLink() || fs.realpathSync(file) !== file) throw new Error('native_media_archive_path');
    const compressed = fs.readFileSync(file);
    if (compressed.length !== row.gzipBytes || sha(compressed) !== row.gzipSha256) throw new Error('native_media_archive_changed');
    files.push(file);
  }
  return { directory, manifest, files, digest: sha(bytes) };
}
function nativeMediaBinaries({ root = process.cwd() } = {}) {
  const archive = readArchive(root);
  if (!archive) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) throw new Error('native_media_archive_required');
    return { ffmpeg: require('@ffmpeg-installer/ffmpeg').path, ffprobe: require('@ffprobe-installer/ffprobe').path };
  }
  const id = archive.directory + ':' + archive.digest;
  if (cache.has(id)) {
    const saved=cache.get(id);
    let missing=false;for(const name of ['ffmpeg','ffprobe']) {try{
      if(fs.lstatSync(saved[name]).isSymbolicLink()||sha(fs.readFileSync(saved[name]))!==archive.manifest.binaries[name].sha256)throw new Error('native_media_cached_binary_changed');
    }catch(error){if(error.code!=='ENOENT')throw error;missing=true;}}
    if(!missing)return saved;
    // Both surviving binaries were verified first. Retire only this resolver's owned directory.
    removeOwnedExtraction(path.dirname(saved.ffmpeg));cache.delete(id);
  }
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'smallheroes-native-'));
  fs.chmodSync(temporary, 0o700);
  const result = {};
  try {
    for (const name of ['ffmpeg', 'ffprobe']) {
      const row = archive.manifest.binaries[name];
      const raw = zlib.gunzipSync(fs.readFileSync(path.join(archive.directory, row.file)), { maxOutputLength: row.bytes });
      if (raw.length !== row.bytes || sha(raw) !== row.sha256) throw new Error('native_media_binary_changed');
      const file = path.join(temporary, name + (process.platform === 'win32' ? '.exe' : ''));
      fs.writeFileSync(file, raw, { flag: 'wx', mode: 0o700 }); fs.chmodSync(file, 0o700); result[name] = file;
    }
  } catch (error) {
    // Only this resolver's newly created private directory, never a shared cache or dependency.
    removeOwnedExtraction(temporary); throw error;
  }
  cache.set(id, result); return result;
}
module.exports = { DIRECTORY, VERSION, MAX_BINARY_BYTES, readArchive, nativeMediaBinaries };
