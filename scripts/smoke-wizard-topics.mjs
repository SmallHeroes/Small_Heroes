/**
 * Smoke test: canonical 10 topics + 3 companions per category.
 * Run with dev server up: node scripts/smoke-wizard-topics.mjs [baseUrl]
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createContext, runInContext } from 'vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');

function runScript(src, globals = {}) {
  const ctx = createContext({ ...globals });
  runInContext(src, ctx);
  return ctx;
}

function loadCanonicalTopics() {
  const src = readFileSync(join(root, 'public/JS/canonical-topics.js'), 'utf8');
  const ctx = createContext({ window: {}, globalThis: {}, CONTENT: { he: { landing: { helps: {} }, wizard: {} } } });
  ctx.window = ctx;
  ctx.globalThis = ctx;
  runInContext(src, ctx);
  return ctx.CanonicalTopics;
}

function loadCompanionsByCategory() {
  const src = readFileSync(join(root, 'public/JS/companions.js'), 'utf8');
  const ctx = createContext({ window: {}, globalThis: {} });
  ctx.window = ctx;
  ctx.globalThis = ctx;
  runInContext(src, ctx);
  return ctx.window.COMPANIONS_BY_CATEGORY || ctx.COMPANIONS_BY_CATEGORY;
}

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const catalog = loadCanonicalTopics();
const map = loadCompanionsByCategory();

assert(catalog, 'CanonicalTopics failed to load');
const topics = catalog.CANONICAL_TOPICS;
assert(topics.length === 10, `expected 10 topics, got ${topics.length}`);

const wizardChips = catalog.buildWizardTopics();
assert(wizardChips.length === 10, `expected 10 wizard chips, got ${wizardChips.length}`);

const homeCards = catalog.buildHomepageHelpCards();
assert(homeCards.length === 9, `expected 9 homepage cards, got ${homeCards.length}`);

const hidden = topics.filter((t) => t.homepageVisible === false);
assert(hidden.length === 1 && hidden[0].id === 'focus', 'expected only focus hidden on home');

for (const t of topics) {
  const cat = catalog.getCategoryForTopic(t.id);
  const list = map[cat];
  assert(Array.isArray(list) && list.length === 3, `${t.id} → ${cat}: expected 3 companions, got ${list?.length ?? 0}`);
}

const wizardSrc = readFileSync(join(root, 'public/JS/wizard.js'), 'utf8');
for (const dead of [
  'syncTopicFearsPanel',
  'renderFearSubChips',
  'syncTopicOtherPanel',
  'bindTopicOtherPanel',
  'FEARS_CATEGORY_SET',
  'fearsRoutingUsesCompanionOnly',
  'topicOtherText',
]) {
  assert(!wizardSrc.includes(dead), `wizard.js still references removed symbol: ${dead}`);
}

for (const url of [`${base}/HTML/wizard.html`, `${base}/HTML/index.html`]) {
  const res = await fetch(url);
  assert(res.ok, `GET ${url} → ${res.status}`);
  const html = await res.text();
  assert(html.includes('canonical-topics.js'), `${url} missing canonical-topics.js script`);
}

console.log('OK: 10 wizard topics, 9 home cards, 3 companions each, no dead wizard refs, pages load');
