const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIRS = ['HTML', 'CSS', 'JS'];
const ALLOWED_FILES = new Set(['README.md']);

function collectUnexpectedFiles(targetDir, baseDir) {
  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  const unexpected = [];

  for (const entry of entries) {
    const fullPath = path.join(targetDir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      unexpected.push(relPath + '/');
      continue;
    }

    if (!ALLOWED_FILES.has(entry.name)) {
      unexpected.push(relPath);
    }
  }

  return unexpected;
}

function main() {
  const repoRoot = process.cwd();
  const violations = [];

  for (const dirName of ROOT_DIRS) {
    const dirPath = path.join(repoRoot, dirName);
    if (!fs.existsSync(dirPath)) {
      continue;
    }

    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      violations.push(dirName);
      continue;
    }

    violations.push(...collectUnexpectedFiles(dirPath, repoRoot));
  }

  if (violations.length > 0) {
    console.error('');
    console.error('[check-root-static-deprecated] Unexpected files found in deprecated root static folders:');
    for (const item of violations) {
      console.error(` - ${item}`);
    }
    console.error('');
    console.error('Only README.md is allowed in repo-root HTML/, CSS/, and JS/.');
    console.error('Use public/HTML, public/CSS, and public/JS as the source of truth.');
    console.error('');
    process.exit(1);
  }

  console.log('[check-root-static-deprecated] OK: deprecated root static folders contain only README.md');
}

main();
