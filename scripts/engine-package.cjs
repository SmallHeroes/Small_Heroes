'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { processBuild } = require('./lib/engine-package.cjs');
const { installedMedia, prepareNativeArchive } = require('./lib/native-media-build.cjs');
const { readArchive } = require('./lib/native-media.cjs');
const { createOptionVerifier } = require('./lib/option-package.cjs');
const root = process.cwd(), args = process.argv.slice(2);
if (args.some((value, index) => !['--apply', '--check', '--dist-dir'].includes(value) && args[index - 1] !== '--dist-dir') || args.includes('--apply') && args.includes('--check')) throw new Error('engine_package_arguments');
const config = require(path.join(root, 'next.config.js'));
const index = args.indexOf('--dist-dir');
if (index >= 0 && !args[index + 1]) throw new Error('engine_package_dist_argument');
const raw = installedMedia(root);
const nativeBundle = args.includes('--apply') ? prepareNativeArchive(root, raw) : { ...readArchive(root), rawPaths: Object.values(raw) };
if (!nativeBundle.files) throw new Error('engine_package_native_archive_missing');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'config/engine-runtime-assets.json'), 'utf8'));
const report = processBuild({ root, config, nativeBundle, verifyOptions: createOptionVerifier(root, manifest), distDir: index >= 0 ? args[index + 1] : config.distDir, apply: args.includes('--apply') });
report.nativeArchive = nativeBundle.manifest;
const reportFile = path.join(root, report.distDir, 'engine-package-report.json');
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, applied: report.applied, engineRoutes: report.routes.filter(row => row.engine).length,
  traces: report.routes.length, largestEngineBytes: Math.max(0, ...report.routes.filter(row => row.engine).map(row => row.bytes)), legacyOversized: report.legacyOversized.length,
  allMeasuredRoutesBelowLimit: report.allMeasuredRoutesBelowLimit, errors: report.errors.length, reportFile }));
process.exitCode = report.errors.length ? 1 : 0;
