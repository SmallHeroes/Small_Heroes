'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SENTINEL_PREFIX =
  'TEST_VERIFICATION_WRITE_SENTINEL';
const metadata =
  globalThis.__LIVE_REQUEST_VERIFICATION_WRITE_SENTINEL__;

if (!metadata) {
  throw new Error('write sentinel metadata is unavailable');
}

function requiredPath(name) {
  const value = process.env[name];
  if (
    typeof value !== 'string' ||
    !path.isAbsolute(value)
  ) {
    throw new Error(`missing probe path: ${name}`);
  }
  return value;
}

const unsafeSource = requiredPath(
  'LIVE_REQUEST_VERIFICATION_PROBE_UNSAFE_SOURCE',
);
const unsafeTarget = requiredPath(
  'LIVE_REQUEST_VERIFICATION_PROBE_UNSAFE_TARGET',
);
const cacheRoot = requiredPath(
  'LIVE_REQUEST_VERIFICATION_SENTINEL_TSX_CACHE_ROOT',
);
const cacheFile = path.join(
  cacheRoot,
  '12345-0123456789abcdef0123456789abcdef01234567',
);
const secondCacheFile = path.join(
  cacheRoot,
  '12346-0123456789abcdef0123456789abcdef01234567',
);

function topLevelArgs(method) {
  const callback = () => {};
  const args = {
    appendFile: [unsafeTarget, 'x', callback],
    appendFileSync: [unsafeTarget, 'x'],
    chmod: [unsafeTarget, 0o600, callback],
    chmodSync: [unsafeTarget, 0o600],
    chown: [unsafeTarget, 0, 0, callback],
    chownSync: [unsafeTarget, 0, 0],
    copyFile: [unsafeSource, unsafeTarget, callback],
    copyFileSync: [unsafeSource, unsafeTarget],
    cp: [unsafeSource, unsafeTarget, callback],
    cpSync: [unsafeSource, unsafeTarget],
    createWriteStream: [unsafeTarget],
    link: [unsafeSource, unsafeTarget, callback],
    linkSync: [unsafeSource, unsafeTarget],
    mkdir: [unsafeTarget, { recursive: true }, callback],
    mkdirSync: [unsafeTarget, { recursive: true }],
    mkdtemp: [unsafeTarget, callback],
    mkdtempSync: [unsafeTarget],
    rename: [unsafeSource, unsafeTarget, callback],
    renameSync: [unsafeSource, unsafeTarget],
    rm: [unsafeTarget, { force: true }, callback],
    rmSync: [unsafeTarget, { force: true }],
    rmdir: [unsafeTarget, callback],
    rmdirSync: [unsafeTarget],
    symlink: [unsafeSource, unsafeTarget, 'file', callback],
    symlinkSync: [unsafeSource, unsafeTarget, 'file'],
    truncate: [unsafeTarget, 0, callback],
    truncateSync: [unsafeTarget, 0],
    unlink: [unsafeTarget, callback],
    unlinkSync: [unsafeTarget],
    utimes: [unsafeTarget, new Date(0), new Date(0), callback],
    utimesSync: [unsafeTarget, new Date(0), new Date(0)],
    writeFile: [unsafeTarget, 'x', callback],
    writeFileSync: [unsafeTarget, 'x'],
  };
  return args[method];
}

function promiseArgs(method) {
  const args = {
    appendFile: [unsafeTarget, 'x'],
    chmod: [unsafeTarget, 0o600],
    chown: [unsafeTarget, 0, 0],
    copyFile: [unsafeSource, unsafeTarget],
    cp: [unsafeSource, unsafeTarget],
    link: [unsafeSource, unsafeTarget],
    mkdir: [unsafeTarget, { recursive: true }],
    mkdtemp: [unsafeTarget],
    rename: [unsafeSource, unsafeTarget],
    rm: [unsafeTarget, { force: true }],
    rmdir: [unsafeTarget],
    symlink: [unsafeSource, unsafeTarget, 'file'],
    truncate: [unsafeTarget, 0],
    unlink: [unsafeTarget],
    utimes: [unsafeTarget, new Date(0), new Date(0)],
    writeFile: [unsafeTarget, 'x'],
  };
  return args[method];
}

function assertSentinelError(error, scope, method) {
  if (
    !(error instanceof Error) ||
    error.message !== `${SENTINEL_PREFIX}:${scope}:${method}`
  ) {
    throw error;
  }
}

async function exerciseCoverage() {
  const observed = { fs: [], promises: [] };
  for (const method of metadata.fs) {
    try {
      fs[method](...topLevelArgs(method));
      throw new Error(`top-level method escaped: ${method}`);
    } catch (error) {
      assertSentinelError(error, 'fs', method);
      observed.fs.push(method);
    }
  }
  for (const method of metadata.promises) {
    try {
      await fs.promises[method](...promiseArgs(method));
      throw new Error(`promise method escaped: ${method}`);
    } catch (error) {
      assertSentinelError(error, 'promises', method);
      observed.promises.push(method);
    }
  }
  process.stdout.write(`${JSON.stringify(observed)}\n`);
}

function expectDenied(label, method, args) {
  try {
    fs[method](...args);
    throw new Error(`path case escaped: ${label}`);
  } catch (error) {
    assertSentinelError(error, 'fs', method);
    return label;
  }
}

async function expectPromiseDenied(label, method, args) {
  try {
    await fs.promises[method](...args);
    throw new Error(`promise path case escaped: ${label}`);
  } catch (error) {
    assertSentinelError(error, 'promises', method);
    return label;
  }
}

async function exercisePaths() {
  const cases = [
    expectDenied('repository', 'writeFileSync', [
      requiredPath(
        'LIVE_REQUEST_VERIFICATION_PROBE_REPOSITORY_TARGET',
      ),
      'x',
    ]),
    expectDenied('output', 'writeFileSync', [
      requiredPath(
        'LIVE_REQUEST_VERIFICATION_PROBE_OUTPUT_TARGET',
      ),
      'x',
    ]),
    expectDenied('temp_neighbor', 'writeFileSync', [
      requiredPath(
        'LIVE_REQUEST_VERIFICATION_PROBE_TEMP_NEIGHBOR',
      ),
      'x',
    ]),
    expectDenied('cache_traversal', 'writeFileSync', [
      path.join(cacheRoot, '..', 'escape.txt'),
      'x',
    ]),
    expectDenied('alias', 'writeFileSync', [
      requiredPath(
        'LIVE_REQUEST_VERIFICATION_PROBE_ALIAS_TARGET',
      ),
      'x',
    ]),
    expectDenied('copy_source_escape', 'copyFileSync', [
      unsafeSource,
      cacheFile,
    ]),
    expectDenied('copy_target_escape', 'copyFileSync', [
      cacheFile,
      unsafeTarget,
    ]),
    expectDenied('rename_target_escape', 'renameSync', [
      cacheFile,
      unsafeTarget,
    ]),
    expectDenied('link_target_escape', 'linkSync', [
      cacheFile,
      unsafeTarget,
    ]),
    expectDenied('symlink_target_escape', 'symlinkSync', [
      cacheFile,
      unsafeTarget,
      'file',
    ]),
    expectDenied('multi_path_cache_only', 'renameSync', [
      cacheFile,
      secondCacheFile,
    ]),
    await expectPromiseDenied(
      'promise_cache_traversal',
      'writeFile',
      [path.join(cacheRoot, '..', 'escape.txt'), 'x'],
    ),
    await expectPromiseDenied(
      'promise_alias',
      'writeFile',
      [
        requiredPath(
          'LIVE_REQUEST_VERIFICATION_PROBE_ALIAS_TARGET',
        ),
        'x',
      ],
    ),
  ];
  process.stdout.write(`${JSON.stringify(cases)}\n`);
}

function exerciseOldStackShape() {
  const applicationWrite = new Function(
    'fs',
    'target',
    [
      "fs.writeFileSync(target, 'x');",
      '//# sourceURL=C:/simulated/node_modules/tsx/application-write-frame.cjs',
    ].join('\n'),
  );
  applicationWrite(
    fs,
    requiredPath(
      'LIVE_REQUEST_VERIFICATION_PROBE_REPOSITORY_TARGET',
    ),
  );
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'coverage') return exerciseCoverage();
  if (mode === 'paths') return exercisePaths();
  if (mode === 'old-stack-shape') {
    return exerciseOldStackShape();
  }
  throw new Error(`unknown probe mode: ${mode ?? '<missing>'}`);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
});
