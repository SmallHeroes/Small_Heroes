'use strict';
// Build-only: execute the same option resolvers against each proposed function filesystem.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire, syncBuiltinESMExports } = require('node:module');
const normalized = file => { const value = path.resolve(String(file)); return process.platform === 'win32' ? value.toLowerCase() : value; };
function optionResolvers(root) {
  const load = createRequire(path.join(root, 'package.json'));
  load(path.join(root, 'scripts/shims/register-server-only.cjs'));
  const api = load('tsx/cjs/api');
  return { wizard: api.require(path.join(root, 'lib/personal-wizard/options.ts'), __filename),
    engine: api.require(path.join(root, 'lib/engine-site/personal-orders.ts'), __filename) };
}
function sourceOptionAssets(root, resolvers = optionResolvers(root)) {
  return resolvers.wizard.personalWizardPublicAssetPaths().map(file => path.join(root, 'public', file.slice(1)))
    .filter(file => fs.existsSync(file) && fs.statSync(file).isFile() && fs.statSync(file).size > 100);
}
function withPackagedFilesystem(root, files, run) {
  const prefix = normalized(root) + path.sep, present = new Set(files.map(normalized));
  const available = file => {
    if (typeof file === 'number') return true;
    const key = normalized(file instanceof URL ? require('node:url').fileURLToPath(file) : file);
    if (!key.startsWith(prefix)) return true; // Installed runtime modules are already loaded; this projects project data only.
    return present.has(key) || [...present].some(entry => entry.startsWith(key + path.sep));
  };
  const original = {};
  for (const name of ['existsSync', 'statSync', 'readFileSync', 'readdirSync']) {
    original[name] = fs[name];
    fs[name] = function(file, ...args) {
      if (!available(file)) {
        if (name === 'existsSync') return false;
        const error = new Error('packaged_option_file_missing'); error.code = 'ENOENT'; throw error;
      }
      const result = original[name].call(this, file, ...args);
      return name === 'readdirSync' ? result.filter(entry => available(path.join(String(file), typeof entry === 'string' ? entry : entry.name))) : result;
    };
  }
  syncBuiltinESMExports();
  try { return run(); } finally { Object.assign(fs, original); syncBuiltinESMExports(); }
}
function createOptionVerifier(root, manifest) {
  const resolvers = optionResolvers(root), declared = new Set(Object.values(manifest.groups).flat().map(row => normalized(path.join(root, row.path))));
  for (const file of sourceOptionAssets(root, resolvers)) if (!declared.has(normalized(file))) throw new Error('engine_package_option_asset_unpinned');
  const source = resolvers.engine.resolveEngineWizardOptions(root);
  return plans => plans.map(plan => {
    const actual = withPackagedFilesystem(root, plan.files, () => resolvers.engine.resolveEngineWizardOptions(root));
    if (actual.fingerprint !== source.fingerprint || JSON.stringify(actual.companions) !== JSON.stringify(source.companions)) throw new Error('engine_package_options_changed:' + plan.route);
    return { route: plan.route, fingerprint: actual.fingerprint, companions: actual.companions.map(item => item.id), sourceFingerprintMatched: true };
  });
}
module.exports = { optionResolvers, sourceOptionAssets, withPackagedFilesystem, createOptionVerifier };
