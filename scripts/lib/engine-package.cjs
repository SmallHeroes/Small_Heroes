'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const LIMIT_BYTES = 250_000_000;
const slash = value => String(value).replace(/\\/g, '/');
const key = value => process.platform === 'win32' ? slash(path.resolve(value)).toLowerCase() : slash(path.resolve(value));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const within = (parent, file) => key(file) === key(parent) || key(file).startsWith(key(parent) + '/');
function forbiddenPath(file) {
  const parts = slash(file).split('/');
  return parts.some(part => /^\.env(?:\.|rc$|$)/i.test(part) || /^(?:\.npmrc|\.pypirc|\.netrc|\.git-credentials|\.yarnrc\.yml|id_rsa|id_ed25519)$/i.test(part) || /\.(?:pem|p12|pfx|key)$/i.test(part) ||
    /^(?:\.git|\.vercel|\.codex|\.claude|\.ssh|\.aws|\.azure|\.kube|_review)$/i.test(part));
}
function isEngineRoute(route) {
  return /^\/api\/engine-site\/v1(?:\/|$)/.test(route) || /^\/personal\/(?:book|review)(?:\/|$)/.test(route) ||
    route === '/' || route === '/wizard/personal' || /^\/personal\/orders(?:\/|$)/.test(route) || route === '/api/checkout' ||
    route === '/api/generate/worker' || /^\/api\/generate\/cron\/(?:outbox|exceptions|sweep|human-qa-reconcile|operator-notifications)$/.test(route);
}
const needsMedia = route => route === '/api/orders/[orderId]/video' || /^\/api\/dev\/personal-wizard\/intake\/(?:audio|status)$/.test(route) ||
  isEngineRoute(route) && !['/', '/wizard/personal', '/api/checkout'].includes(route) && !route.startsWith('/personal/orders/') &&
  !/\/(?:human-qa-reconcile|operator-notifications)$/.test(route);
function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (forbiddenPath(path.relative(base, file))) return [];
    if (entry.isSymbolicLink()) throw new Error('engine_package_asset_symlink');
    return entry.isDirectory() ? walk(file, base) : [file];
  });
}
function routeForTrace(dist, trace) {
  const relative = slash(path.relative(path.join(dist, 'server'), trace)).replace(/\.js\.nft\.json$/, '');
  if (relative.startsWith('app/')) return '/' + relative.slice(4).split('/').filter(part => part !== 'page' && part !== 'route' && !part.startsWith('@') && !/^\(.+\)$/.test(part)).join('/');
  if (relative.startsWith('pages/')) return '/' + relative.slice(6).replace(/\/index$/, '');
  return slash(path.relative(dist, trace)).replace(/\.js\.nft\.json$/, '');
}
function matchingExcludes(root, config, route, picomatch, globalOnly = false) {
  const patterns = Object.entries(config.outputFileTracingExcludes || {}).filter(([pattern]) => (!globalOnly || pattern === '**') && picomatch(pattern, { contains: true, dot: true })(route)).flatMap(([, values]) => values);
  // Next15 joins native Windows paths before matching. Normalize BOTH sides, not just a test's input.
  return picomatch(patterns.map(pattern => slash(path.resolve(root, pattern))), { contains: true, dot: true });
}
function requiredAssets(root, supplied) {
  const manifestFile = path.join(root, 'config/engine-runtime-assets.json');
  if (!supplied && (fs.lstatSync(manifestFile).isSymbolicLink() || !within(root, fs.realpathSync(manifestFile)))) throw new Error('engine_package_asset_path');
  const manifest = supplied || JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (manifest.version !== 'engine-runtime-assets/v1' || !manifest.groups ||
      ['fonts', 'style01', 'childTemplate', 'companionSheets'].some(group => !Array.isArray(manifest.groups[group]) || !manifest.groups[group].length)) throw new Error('engine_package_asset_manifest');
  const files = [], seen = new Set();
  for (const row of Object.values(manifest.groups).flat()) {
    if (!row || typeof row.path !== 'string' || path.isAbsolute(row.path) || /^[A-Za-z]:/.test(row.path) || forbiddenPath(row.path) ||
        !/^[a-f0-9]{64}$/.test(row.sha256) || !Number.isSafeInteger(row.bytes) || row.bytes <= 0) throw new Error('engine_package_asset_manifest');
    const file = path.resolve(root, row.path);
    if (!within(root, file) || !within(root, fs.realpathSync(file)) || forbiddenPath(path.relative(root, fs.realpathSync(file))) || seen.has(key(file))) throw new Error('engine_package_asset_path');
    const bytes = fs.readFileSync(file);
    if (bytes.length !== row.bytes || sha(bytes) !== row.sha256) throw new Error('engine_package_asset_changed');
    files.push(file); seen.add(key(file));
  }
  return files;
}
function expectedRoutes(root) {
  const result = [];
  for (const file of walk(path.join(root, 'app')).filter(file => ['route.ts', 'page.tsx'].includes(path.basename(file)))) {
      const route = '/' + slash(path.relative(path.join(root, 'app'), path.dirname(file))).split('/').filter(part => part && !part.startsWith('@') && !/^\(.+\)$/.test(part)).join('/');
      if (isEngineRoute(route)) result.push(route);
  }
  return [...new Set(result)];
}
function processBuild({ root, distDir, config, apply = false, limitBytes = LIMIT_BYTES, mediaPaths, nativeBundle, assetManifest, verifyOptions }) {
  if (!Number.isSafeInteger(limitBytes) || limitBytes <= 0 || limitBytes > LIMIT_BYTES) throw new Error('engine_package_limit');
  root = fs.realpathSync(path.resolve(root));
  const dist = path.resolve(root, distDir || config.distDir || '.next');
  if (!within(root, dist) || key(dist) === key(root) || within(path.join(root, 'node_modules'), dist) || forbiddenPath(path.relative(root, dist))) throw new Error('engine_package_output_path');
  if (fs.lstatSync(dist).isSymbolicLink() || !within(root, fs.realpathSync(dist))) throw new Error('engine_package_output_symlink');
  const load = createRequire(path.join(root, 'package.json'));
  const picomatch = require('next/dist/compiled/picomatch');
  const dependencies = fs.existsSync(path.join(root, 'node_modules')) ? fs.realpathSync(path.join(root, 'node_modules')) : path.join(root, 'node_modules');
  const allowed = file => within(root, file) || within(dependencies, file);
  const assets = requiredAssets(root, assetManifest);
  const native = nativeBundle ? nativeBundle.files : mediaPaths || [load('@ffmpeg-installer/ffmpeg').path, load('@ffprobe-installer/ffprobe').path];
  const rawNative = new Set((nativeBundle?.rawPaths || []).flatMap(file => [key(file), key(fs.realpathSync(file))]));
  const nativeLegal = new Set((nativeBundle?.rawPaths || []).flatMap(file => ['LICENSE', 'LICENSE.txt', 'LICENSE.md', 'COPYING', 'COPYING.txt'].map(name => key(path.join(path.dirname(file), name)))));
  const rawNames = new Set((nativeBundle?.rawPaths || []).map(file => path.basename(file)));
  const archiveKeys = new Set((nativeBundle?.files || []).map(key));
  const requiredRawNative = new Set(native.map(key));
  const information = new Map();
  function info(file) {
    const id = key(file);
    if (information.has(id)) return information.get(id);
    if (!allowed(file)) throw new Error('engine_package_path_escape');
    const stat = fs.statSync(file), real = fs.realpathSync(file);
    if (!allowed(real)) throw new Error('engine_package_symlink_escape');
    const relativeReal = within(root, real) ? path.relative(root, real) : path.join('node_modules', path.relative(dependencies, real));
    if (forbiddenPath(relativeReal)) throw new Error('engine_package_credential_alias');
    const result = { bytes: stat.isFile() ? stat.size : 0, real: key(real), directory: stat.isDirectory() };
    information.set(id, result); return result;
  }
  const rows = [], plans = [], errors = [];
  // No .env/credential file contents or pixels are read. Only NFT JSON and ordinary file metadata.
  for (const trace of walk(dist).filter(file => file.endsWith('.nft.json'))) {
    const before = fs.readFileSync(trace), data = JSON.parse(before.toString('utf8'));
    if (data.version !== 1 || !Array.isArray(data.files) || data.files.some(file => typeof file !== 'string' || !file || file.includes('\0') || path.isAbsolute(file) || /^[A-Za-z]:/.test(file))) throw new Error('engine_package_trace_schema');
    const route = routeForTrace(dist, trace), engine = isEngineRoute(route), exclude = matchingExcludes(root, config, route, picomatch);
    const kept = [], removed = [], seen = new Set(); let packedMedia = false;
    for (const entry of data.files) {
      const file = path.resolve(path.dirname(trace), slash(entry));
      const relativePolicyPath = within(root, file) ? path.relative(root, file) : within(dependencies, file) ? path.join('node_modules', path.relative(dependencies, file)) : file;
      if (forbiddenPath(relativePolicyPath)) { removed.push({ entry, reason: 'credential_path' }); continue; }
      if (exclude(slash(file)) && !nativeLegal.has(key(file)) && !(needsMedia(route) && !nativeBundle && requiredRawNative.has(key(file)))) {
        removed.push({ entry, reason: 'declared_exclusion' }); continue;
      }
      if (!allowed(file)) throw new Error('engine_package_path_escape');
      if (archiveKeys.has(key(file))) packedMedia = true;
      if (nativeBundle && (rawNative.has(key(file)) || rawNames.has(path.basename(file)) && fs.existsSync(file) && rawNative.has(key(fs.realpathSync(file))))) {
        removed.push({ entry, reason: 'lossless_native_archive' }); packedMedia = true; continue;
      }
      if (!seen.has(key(file))) { kept.push(entry); seen.add(key(file)); }
    }
    let added = 0;
    if (nativeBundle && (packedMedia || needsMedia(route))) for (const file of nativeBundle.files) {
      if (!allowed(file) || forbiddenPath(path.relative(root, file))) throw new Error('engine_package_native_path');
      if (!seen.has(key(file))) { kept.push(slash(path.relative(path.dirname(trace), file))); seen.add(key(file)); added++; }
    }
    // Next's shared next-server NFTs have no sibling .js: their server entry is already in files.
    const sibling = trace.slice(0, -'.nft.json'.length);
    const routeEntry = within(path.join(dist, 'server'), trace) ? [sibling] : [];
    const files = [...new Set([...kept.map(entry => path.resolve(path.dirname(trace), slash(entry))), ...routeEntry])];
    const missing = [], real = new Set(); let bytes = 0;
    for (const file of files) { try { const found = info(file); bytes += found.bytes; real.add(found.real); } catch (error) { if (error.code === 'ENOENT') missing.push(file); else throw error; } }
    const contains = file => { if (seen.has(key(file))) return true; try { return real.has(info(file).real); } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
    const required = [...(engine ? assets : []), ...((needsMedia(route) || packedMedia) ? native : [])];
    const absent = required.filter(file => !contains(file));
    if (missing.length || absent.length || bytes >= limitBytes || engine && !assets.length) errors.push({ route, missing, requiredMissing: absent, bytes, limitBytes });
    if (!apply && (removed.length || added)) errors.push({ route, unprocessedExcludedEntries: removed.length, unpackedNativeEntries: added });
    const after = Buffer.from(JSON.stringify({ ...data, files: kept }) + '\n');
    rows.push({ route, engine, trace: slash(path.relative(root, trace)), beforeSha256: sha(before), afterSha256: sha(after), files: kept.length,
      bytes, closureBelowLimit: bytes < limitBytes, requiredAssets: required.length, requiredMissing: absent.map(file => slash(path.relative(root, file))), missing,
      removed, mediaRequired: needsMedia(route), packedMedia });
    plans.push({ trace, route, files, before, after, changed: before.toString('utf8').trim() !== after.toString('utf8').trim() });
  }
  const present = new Set(rows.map(row => row.route));
  for (const route of expectedRoutes(root)) if (!present.has(route)) errors.push({ route, traceMissing: true });
  if (!rows.length) errors.push({ noTraces: true });
  let options = null;
  if (!errors.length && verifyOptions) {
    try { options = verifyOptions(plans.filter(plan => isEngineRoute(plan.route))); }
    catch (error) { errors.push({ optionsContract: 'engine_package_options_changed', detail: error.message }); }
  }
  const report = { version: 'engine-package/v1', status: errors.length ? 'HOLD' : 'LOCAL_TRACE_CONTRACT_SATISFIED', platform: process.platform,
    applied: false, limitBytes, distDir: slash(path.relative(root, dist)), requiredStaticAssets: assets.length, routes: rows, errors,
    options, limitations: ['NFT closure excludes unmeasured adapter/runtime layers.', 'Native execution and actual production recipe/private target qualification remain separate.', 'Only declared Next exclusions apply on both platforms; every measured route must still fit the cap.'] };
  report.allMeasuredRoutesBelowLimit = rows.every(row => row.closureBelowLimit);
  report.legacyOversized = rows.filter(row => !row.engine && !row.closureBelowLimit).map(({ route, bytes }) => ({ route, bytes, limitBytes }));
  if (!errors.length && apply) {
    for (const plan of plans.filter(item => item.changed)) {
      const backup = path.join(dist, 'engine-package-before', path.relative(dist, plan.trace) + '.' + sha(plan.before) + '.before');
      fs.mkdirSync(path.dirname(backup), { recursive: true }); if (!fs.existsSync(backup)) fs.writeFileSync(backup, plan.before, { flag: 'wx' });
      const temporary = plan.trace + '.' + crypto.randomUUID() + '.tmp';
      fs.writeFileSync(temporary, plan.after, { flag: 'wx' }); fs.renameSync(temporary, plan.trace);
    }
    report.applied = true;
  }
  return report;
}
module.exports = { LIMIT_BYTES, forbiddenPath, isEngineRoute, needsMedia, routeForTrace, matchingExcludes, requiredAssets, processBuild };
