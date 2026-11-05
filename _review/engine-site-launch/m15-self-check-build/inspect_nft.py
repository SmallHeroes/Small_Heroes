"""Read generated Next traces only. Missing build output is UNKNOWN, never inferred from config."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import platform

ROOT = Path(__file__).resolve().parents[3]
parser = argparse.ArgumentParser()
parser.add_argument('--build-dir', default='.next/m15-build-proof/output-final')
parser.add_argument('--build-manifest', default='.next/m15-build-proof/BUILD-FINAL.json')
parser.add_argument('--report', default='_review/engine-site-launch/m15-self-check-build/NFT-INSPECTION.json')
args = parser.parse_args()
build = ROOT / args.build_dir
attempt = ROOT / args.build_manifest
build_succeeded = attempt.is_file() and json.loads(attempt.read_text()).get('exitCode') == 0
sources = {ROOT / 'app/api/generate/worker/route.ts'}
for name, pattern in [('app/api/generate/cron', 'route.ts'), ('app/api/engine-site/v1', 'route.ts'),
                      ('app/personal/book', 'page.tsx'), ('app/personal/review', 'page.tsx')]:
    sources.update((ROOT / name).rglob(pattern))
results = []
for source in sorted(sources):
    relative = source.relative_to(ROOT / 'app')
    stem = relative.with_suffix('.js')
    trace = build / 'server/app' / (str(stem) + '.nft.json')
    row = {'route': '/' + relative.parent.as_posix(), 'source': source.relative_to(ROOT).as_posix(),
           'trace': trace.relative_to(ROOT).as_posix(), 'tracePresent': trace.is_file(),
           'requiredForPersonalFlow': '/human-qa-reconcile/' not in source.as_posix() and '/operator-notifications/' not in source.as_posix(),
           'assetPresence': None, 'tracedBytes': None, 'tracedClosureBelow250MB': None}
    if trace.is_file():
        raw = trace.read_bytes()
        value = json.loads(raw)
        # Distinct logical paths count separately even if a junction resolves them to the same inode.
        files = {os.path.normcase(os.path.abspath(trace.parent / name)) for name in value['files']}
        files.add(os.path.normcase(os.path.abspath(str(trace)[:-len('.nft.json')])))
        missing, sizes, paths, forbidden = [], [], [], []
        for filename in sorted(files):
            p = Path(filename)
            if p.name == '.env' or p.name.startswith('.env.'):
                forbidden.append(filename)
                continue  # Never open or inspect secret-file contents.
            if not p.is_file():
                missing.append(filename)
                continue
            sizes.append(p.stat().st_size)
            paths.append(filename.replace('\\', '/').lower())
        presence = {
            'fonts': any('/backend/assets/fonts/' in p and p.endswith(('.ttf', '.otf')) for p in paths),
            'style01': any('/style-references/01/' in p and p.endswith('.png') for p in paths),
            'childTemplate': any('/style-references/01-child-template/' in p and p.endswith('.png') for p in paths),
            'companionSheets': any('/public/companions/' in p and '/style01-sheets/' in p and p.endswith('.png') for p in paths),
            'companionManifests': any('/public/companions/' in p and '/style01-sheets/' in p and p.endswith('/manifest.json') for p in paths),
            'ffmpeg': any('/@ffmpeg-installer/' in p and p.endswith(('/ffmpeg', '/ffmpeg.exe')) for p in paths),
            'ffprobe': any('/@ffprobe-installer/' in p and p.endswith(('/ffprobe', '/ffprobe.exe')) for p in paths),
        }
        complete = not missing and not forbidden
        row.update(traceSha256=hashlib.sha256(raw).hexdigest(), tracedLogicalFiles=len(files),
                   missingFiles=missing, forbiddenEnvFiles=forbidden, assetPresence=presence,
                   tracedBytes=sum(sizes), tracedClosureBelow250MB=sum(sizes) < 250_000_000 if complete else None,
                   allRequestedCategoriesPresent=complete and all(presence.values()))
    results.append(row)
complete = build_succeeded and bool(results) and all(r['tracePresent'] and r.get('allRequestedCategoriesPresent')
                                 and r['tracedClosureBelow250MB'] for r in results)
result = {'status': 'LOCAL_TRACE_CATEGORIES_AND_SIZE_OBSERVED' if complete else 'NOT_PROVEN',
          'platform': platform.system(), 'buildDir': args.build_dir, 'buildSucceeded': build_succeeded,
          'traceStage': 'COMPLETE_BUILD' if build_succeeded else 'FAILED_BUILD_PARTIAL_UNPROCESSED_TRACES', 'routes': len(results),
          'generatedNFTFiles': len(list(build.rglob('*.nft.json'))), 'results': results,
          'limits': ['Missing traces never prove inclusion or function size.',
                     'Presence means category membership; selected runtime authorities still need exact asset qualification.',
                     'Trace closure bytes do not include all Vercel adapter/runtime layers or prove deployed package size.',
                     'A Windows trace cannot prove Linux native binary execution.']}
target = ROOT / args.report
if not target.resolve().is_relative_to((ROOT / '_review/engine-site-launch').resolve()):
    raise ValueError('Report must remain in the assigned review workspace')
target.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'status': result['status'], 'routes': result['routes'], 'generatedNFTFiles': result['generatedNFTFiles']}))
raise SystemExit(0 if complete else 2)
