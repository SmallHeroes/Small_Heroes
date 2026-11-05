import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { afterEach, vi } from 'vitest';
const load = createRequire(resolve('package.json'));
const config = load(resolve('next.config.js'));
const picomatch = load('next/dist/compiled/picomatch');
const policy = load(resolve('scripts/lib/engine-package.cjs'));
const slash = (value: string) => value.replace(/\\/g, '/');
function excluded(route: string, file: string) {
  const patterns = Object.entries(config.outputFileTracingExcludes as Record<string, string[]>).
    filter(([key]) => picomatch(key, { contains: true, dot: true })(route)).flatMap(([, value]) => value);
  return picomatch(patterns.map(pattern => slash(resolve(pattern))), { contains: true, dot: true })(slash(resolve(file)));
}
describe('general server package contract', () => {
  it.each(['/api/engine-site/v1/orders', '/api/engine-site/v1/books/[orderId]', '/personal/book/[orderId]', '/personal/review/[orderId]'])(
    '%s excludes unrelated UI/style archives without dropping runtime authorities', route => {
      for (const file of ['public/Images/unused.png', 'style-references/02/unused.png', 'style-references/01/_archive/old.png'])
        expect(excluded(route, file), `${route}: ${file}`).toBe(true);
      for (const file of ['style-references/01/current.png', 'style-references/01-child-template/child.png',
        'public/companions/any/style01-sheets/front.png', 'backend/assets/fonts/font.ttf', 'node_modules/@ffmpeg-installer/linux-x64/ffmpeg'])
        expect(excluded(route, file), `${route}: ${file}`).toBe(false);
    });
  it('forbids environment/credential trace paths on engine and legacy routes', () => {
    for (const route of ['/api/engine-site/v1/orders', '/api/generate/worker', '/api/payme/return'])
      for (const file of ['node_modules/any/.env', 'nested/.env.local', 'nested/.npmrc', '.git/config'])
        expect(excluded(route, file), `${route}: ${file}`).toBe(true);
  });
});

const roots: string[] = [];
const unpacked: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of unpacked.splice(0)) {
    if (path.dirname(dir) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('smallheroes-native-')) throw new Error('unsafe native fixture cleanup');
    fs.rmSync(dir, { recursive: true, force: true });
  }
  for (const root of roots.splice(0)) {
    if (path.dirname(root) !== path.resolve(tmpdir()) || !path.basename(root).startsWith('engine-package-m16-')) throw new Error('unsafe fixture cleanup');
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('lossless native packaging and lazy private extraction', () => {
  const runtime = load(resolve('scripts/lib/native-media.cjs'));
  const builder = load(resolve('scripts/lib/native-media-build.cjs'));
  function packed() {
    const f = fixture();
    const bundle = builder.prepareNativeArchive(f.root, { ffmpeg: f.native[0], ffprobe: f.native[1] });
    return { ...f, bundle, manifestFile: path.join(bundle.directory, 'manifest.json') };
  }
  it('reproduces exact executable bytes, privately, without touching the installers; repeated use is cached', () => {
    const f = packed(), Module = load('node:module'), original = Module._load;
    Module._load = function(id: string, ...args: unknown[]) { if (id.startsWith('@ffmpeg-installer/') || id.startsWith('@ffprobe-installer/')) throw new Error('installer unavailable'); return original.call(this, id, ...args); };
    try {
      const result = runtime.nativeMediaBinaries({ root: f.root }); unpacked.push(path.dirname(result.ffmpeg));
      expect(fs.readFileSync(result.ffmpeg)).toEqual(fs.readFileSync(f.native[0])); expect(fs.readFileSync(result.ffprobe)).toEqual(fs.readFileSync(f.native[1]));
      expect(path.dirname(result.ffmpeg)).not.toBe(path.dirname(f.native[0]));
      if (process.platform !== 'win32') expect(fs.statSync(path.dirname(result.ffmpeg)).mode & 0o777).toBe(0o700);
      expect(runtime.nativeMediaBinaries({ root: f.root })).toEqual(result);
    } finally { Module._load = original; }
  });
  it.each(['platform', 'arch', 'version', 'raw-hash', 'raw-size', 'gzip-hash', 'file-path', 'extra-key'])(
    'refuses a present invalid archive (%s), never falling back to installers', kind => {
      const f = packed(), manifest = JSON.parse(fs.readFileSync(f.manifestFile, 'utf8'));
      if (kind === 'platform') manifest.platform = 'other';
      if (kind === 'arch') manifest.arch = 'other';
      if (kind === 'version') manifest.version = 'other';
      if (kind === 'raw-hash') { manifest.binaries.ffmpeg.sha256 = 'a'.repeat(64); manifest.binaries.ffmpeg.file = 'a'.repeat(64) + '.gz'; fs.copyFileSync(f.bundle.files[1], path.join(f.bundle.directory, manifest.binaries.ffmpeg.file)); }
      if (kind === 'raw-size') manifest.binaries.ffmpeg.bytes++;
      if (kind === 'gzip-hash') manifest.binaries.ffmpeg.gzipSha256 = 'a'.repeat(64);
      if (kind === 'file-path') manifest.binaries.ffmpeg.file = '../../.env.local';
      if (kind === 'extra-key') manifest.fallback = true;
      fs.writeFileSync(f.manifestFile, JSON.stringify(manifest));
      expect(() => runtime.nativeMediaBinaries({ root: f.root })).toThrow();
    });
  it('refuses a missing manifest, truncated gzip and changed content even after a cached extraction', () => {
    const f = packed(), binaries = runtime.nativeMediaBinaries({ root: f.root }); unpacked.push(path.dirname(binaries.ffmpeg));
    fs.writeFileSync(f.bundle.files[1], 'truncated');
    expect(() => runtime.nativeMediaBinaries({ root: f.root })).toThrow('native_media_archive_changed');
    fs.unlinkSync(f.manifestFile); expect(() => runtime.nativeMediaBinaries({ root: f.root })).toThrow();
  });
  it('re-verifies a cached extracted executable before returning it for another use',()=>{
    const f=packed(),binaries=runtime.nativeMediaBinaries({root:f.root});unpacked.push(path.dirname(binaries.ffmpeg));
    fs.writeFileSync(binaries.ffmpeg,'changed-after-extraction');
    expect(()=>runtime.nativeMediaBinaries({root:f.root})).toThrow('native_media_cached_binary_changed');
  });
  it('re-extracts a deleted cached binary, but never hides tampering in its surviving peer',()=>{
    const f=packed(),first=runtime.nativeMediaBinaries({root:f.root});unpacked.push(path.dirname(first.ffmpeg));fs.unlinkSync(first.ffmpeg);
    const next=runtime.nativeMediaBinaries({root:f.root});unpacked.push(path.dirname(next.ffmpeg));expect(fs.readFileSync(next.ffmpeg)).toEqual(fs.readFileSync(f.native[0]));
    expect(fs.existsSync(path.dirname(first.ffmpeg))).toBe(false);
    fs.unlinkSync(next.ffmpeg);fs.writeFileSync(next.ffprobe,'tampered-peer');expect(()=>runtime.nativeMediaBinaries({root:f.root})).toThrow('native_media_cached_binary_changed');
  });
  it('replaces raw native references in both engine and legacy video traces; keeps original dependencies and licenses', () => {
    const f = packed(), legacy = f.put('.next/proof/server/app/api/orders/[orderId]/video/route.js.nft.json', '{}');
    f.put('.next/proof/server/app/api/orders/[orderId]/video/route.js', 'module.exports={}');
    const license = f.put('node_modules/@ffmpeg-installer/linux-x64/LICENSE');
    fs.writeFileSync(legacy, JSON.stringify({ version: 1, files: [...f.native, license, ...f.unnecessary].map(file => path.relative(path.dirname(legacy), file)) }));
    const args = { ...f.args, nativeBundle: f.bundle };
    expect(policy.processBuild(args).status).toBe('HOLD');
    const report = policy.processBuild({ ...args, apply: true }); expect(report.errors).toEqual([]);
    for (const trace of [f.trace, legacy]) {
      const files = JSON.parse(fs.readFileSync(trace, 'utf8')).files.map((entry: string) => path.resolve(path.dirname(trace), entry));
    expect(f.native.some(file => files.includes(file))).toBe(false); expect(f.bundle.files.every((file: string) => files.includes(file))).toBe(true);
    }
    expect(JSON.parse(fs.readFileSync(legacy, 'utf8')).files).toContain(path.relative(path.dirname(legacy), license));
    expect(policy.processBuild(args).errors).toEqual([]);
    expect(f.native.every(file => fs.existsSync(file))).toBe(true);
  });
  it('keeps the existing video pipeline lazy and binds both media consumers to the same native resolver', () => {
    const source = fs.readFileSync(resolve('backend/providers/video.ts'), 'utf8');
    expect(source).not.toContain("from '@ffmpeg-installer/ffmpeg'"); expect(source).toContain('nativeMediaBinaries()');
    expect(source.indexOf('configureMedia();')).toBeGreaterThan(source.indexOf('export async function generateBookVideo'));
    expect(load(resolve('scripts/lib/narration-media.cjs')).narrationMediaBinaries).toBe(runtime.nativeMediaBinaries);
  });
  it.each(['.env.local', 'outside-ffmpeg'] as const)('refuses %s as a native input before opening its contents', kind => {
    const f = fixture(), invalid = kind === '.env.local' ? path.join(f.root, '.env.local') : f.put('outside/ffmpeg');
    const read = fs.readFileSync, opened: string[] = [];
    vi.spyOn(fs, 'readFileSync').mockImplementation(((file: fs.PathOrFileDescriptor, ...args: unknown[]) => { opened.push(String(file)); return (read as any)(file, ...args); }) as typeof fs.readFileSync);
    expect(() => builder.prepareNativeArchive(f.root, { ffmpeg: invalid, ffprobe: f.native[1] })).toThrow('native_media_binary_path');
    expect(opened).not.toContain(invalid);
  });
  it('refuses an oversized non-engine route without dropping its legacy assets or claiming full-project qualification', () => {
    const f = fixture(), legacy = f.put('.next/proof/server/app/api/orders/route.js.nft.json', '{}');
    f.put('.next/proof/server/app/api/orders/route.js', 'x'.repeat(500));
    fs.writeFileSync(legacy, JSON.stringify({ version: 1, files: [] }));
    const report = policy.processBuild({ ...f.args, apply: true, limitBytes: 450 });
    expect(report.status).toBe('HOLD'); expect(report.applied).toBe(false); expect(report.allMeasuredRoutesBelowLimit).toBe(false);
    expect(report.legacyOversized).toEqual([{ route: '/api/orders', bytes: 500, limitBytes: 450 }]);
  });
});
function fixture() {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'engine-package-m16-')); roots.push(root);
  const put = (name: string, text = 'synthetic-only') => { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); return file; };
  const groups = { fonts: 'backend/assets/fonts/a.ttf', style01: 'style-references/01/a.png', childTemplate: 'style-references/01-child-template/a.png', companionSheets: 'public/companions/any/style01-sheets/a.png' };
  const manifest = { version: 'engine-runtime-assets/v1', groups: Object.fromEntries(Object.entries(groups).map(([key, name]) => {
    const file = put(name), bytes = fs.readFileSync(file); return [key, [{ path: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }]];
  })) };
  put('package.json', '{}'); put('app/api/engine-site/v1/orders/route.ts', 'export {}');
  const native = [put('node_modules/@ffmpeg-installer/linux-x64/ffmpeg'), put('node_modules/@ffprobe-installer/linux-x64/ffprobe')];
  const unnecessary = [put('public/Images/unused.png'), put('style-references/02/unused.png'), put('style-references/01/_archive/old.png')];
  const trace = put('.next/proof/server/app/api/engine-site/v1/orders/route.js.nft.json', '{}'); put('.next/proof/server/app/api/engine-site/v1/orders/route.js', 'module.exports={}');
  const required = [...Object.values(groups).map(name => path.join(root, name)), ...native];
  const setFiles = (files: string[]) => fs.writeFileSync(trace, JSON.stringify({ version: 1, files: files.map(file => path.relative(path.dirname(trace), file)) }));
  setFiles([...required, ...unnecessary, path.join(root, 'node_modules/any/.env')]);
  const args = { root, distDir: '.next/proof', config, mediaPaths: native, assetManifest: manifest };
  return { root, put, trace, native, unnecessary, required, manifest, setFiles, args };
}
describe('actual generated trace admission and platform-neutral filtering', () => {
  it('check refuses an unprocessed trace; apply retains exact required files, removes only listed assets, never reads an env and is idempotent', () => {
    const f = fixture(), originalRead = fs.readFileSync;
    vi.spyOn(fs, 'readFileSync').mockImplementation(((file: fs.PathOrFileDescriptor, ...args: unknown[]) => {
      if (typeof file !== 'number' && /^\.env(?:\.|$)/i.test(path.basename(String(file)))) throw new Error('secret read');
      return (originalRead as any)(file, ...args);
    }) as typeof fs.readFileSync);
    expect(policy.processBuild(f.args).status).toBe('HOLD');
    const result = policy.processBuild({ ...f.args, apply: true }); expect(result.errors).toEqual([]); expect(result.applied).toBe(true);
    const saved = JSON.parse(fs.readFileSync(f.trace, 'utf8'));
    expect(saved.files).toHaveLength(f.required.length); expect(result.routes[0].requiredMissing).toEqual([]);
    expect(f.unnecessary.every(file => fs.existsSync(file))).toBe(true); // Packaging removes references, not source files.
    const before = fs.readFileSync(f.trace); expect(policy.processBuild(f.args).errors).toEqual([]);
    expect(policy.processBuild({ ...f.args, apply: true }).errors).toEqual([]); expect(fs.readFileSync(f.trace)).toEqual(before);
  });
  it.each(['missing-ref', 'over-limit', 'missing-trace'] as const)('refuses %s atomically without rewriting any trace', reason => {
    const f = fixture(); if (reason === 'missing-ref') f.setFiles(f.required.slice(1));
    if (reason === 'missing-trace') fs.unlinkSync(f.trace);
    const before = fs.existsSync(f.trace) ? fs.readFileSync(f.trace) : null;
    const result = policy.processBuild({ ...f.args, apply: true, ...(reason === 'over-limit' ? { limitBytes: 1 } : {}) });
    expect(result.status).toBe('HOLD'); expect(result.applied).toBe(false);
    if (before) expect(fs.readFileSync(f.trace)).toEqual(before);
  });
  it('binds static contents to the frozen manifest and rejects forbidden manifest paths before reading them', () => {
    const f = fixture(); f.put('backend/assets/fonts/a.ttf', 'changed');
    expect(() => policy.processBuild({ ...f.args, apply: true })).toThrow('engine_package_asset_changed');
    f.manifest.groups.fonts[0].path = '.env.local';
    expect(() => policy.processBuild(f.args)).toThrow('engine_package_asset_manifest');
  });
  it('rejects an innocent asset name resolving to credential data before opening it', () => {
    const f = fixture(), realpath = fs.realpathSync, target = path.resolve(f.root, 'backend/assets/fonts/a.ttf');
    vi.spyOn(fs, 'realpathSync').mockImplementation(((file: fs.PathLike, ...args: unknown[]) => path.resolve(String(file)) === target ? path.join(f.root, '.env.local') : (realpath as any)(file, ...args)) as typeof fs.realpathSync);
    expect(() => policy.processBuild(f.args)).toThrow('engine_package_asset_path');
  });
  it('applies the declared legacy exclusions while preserving native media and all source files', () => {
    const f = fixture(), legacy = f.put('.next/proof/server/app/api/orders/[orderId]/video/route.js.nft.json', '{}');
    f.put('.next/proof/server/app/api/orders/[orderId]/video/route.js', 'module.exports={}');
    const keep = [...f.native, ...f.unnecessary];
    fs.writeFileSync(legacy, JSON.stringify({ version: 1, files: [...keep, path.join(f.root, '.env.local')].map(file => path.relative(path.dirname(legacy), file)) }));
    expect(policy.processBuild({ ...f.args, apply: true }).errors).toEqual([]);
    expect(JSON.parse(fs.readFileSync(legacy, 'utf8')).files).toHaveLength(f.native.length); // This declared lean route needs media, not UI/style pixels.
    expect(f.unnecessary.every(file=>fs.existsSync(file))).toBe(true);
  });
  it('checks Next shared-server NFTs without inventing a nonexistent sibling JS and excludes only declared retired data',()=>{
    const f=fixture(), trace=f.put('.next/proof/next-server.js.nft.json','{}'),entry=f.put('node_modules/next/dist/server/next-server.js','synthetic-server');
    fs.writeFileSync(trace,JSON.stringify({version:1,files:[entry,f.unnecessary[2]].map(file=>path.relative(path.dirname(trace),file))}));
    const result=policy.processBuild({...f.args,apply:true});expect(result.errors).toEqual([]);
    expect(result.routes.find((row:any)=>row.route==='next-server')).toMatchObject({missing:[],requiredMissing:[]});
    expect(JSON.parse(fs.readFileSync(trace,'utf8')).files).toEqual([path.relative(path.dirname(trace),entry)]);
    expect(fs.existsSync(f.unnecessary[2])).toBe(true);
  });
  it('refuses an escaped dependency path before any IO there', () => {
    const f = fixture(); f.setFiles([...f.required, path.join(path.parse(f.root).root, 'engine-package-outside-private-file')]);
    expect(() => policy.processBuild({ ...f.args, apply: true })).toThrow('engine_package_path_escape');
  });
  it('refuses a caller-raised limit and absolute trace entries without altering the trace', () => {
    const f = fixture(); expect(() => policy.processBuild({ ...f.args, limitBytes: 250_000_001 })).toThrow('engine_package_limit');
    fs.writeFileSync(f.trace, JSON.stringify({ version: 1, files: ['C:\\outside\\file'] }));
    expect(() => policy.processBuild({ ...f.args, apply: true })).toThrow('engine_package_trace_schema');
  });
  it('keeps media optional during module import and resolves native bindings only on explicit use', () => {
    const Module = load('node:module'), filename = resolve('scripts/lib/narration-media.cjs'), previous = Module._load;
    const calls: string[] = []; delete load.cache[filename];
    Module._load = function(id: string, ...args: unknown[]) { if (id === '@ffmpeg-installer/ffmpeg' || id === '@ffprobe-installer/ffprobe') { calls.push(id); return { path: id }; } return previous.call(this, id, ...args); };
    try { const module = load(filename); expect(calls).toEqual([]); expect(module.narrationMediaBinaries({ root: fixture().root })).toEqual({ ffmpeg: '@ffmpeg-installer/ffmpeg', ffprobe: '@ffprobe-installer/ffprobe' }); expect(calls).toHaveLength(2); }
    finally { Module._load = previous; delete load.cache[filename]; }
  });
});
