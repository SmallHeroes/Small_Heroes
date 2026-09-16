'use strict';
// Read-only probe of the existing parser, resolver and personalization gate.
// No imports of preview/render/provider modules and no network or filesystem writes.
require('tsx/cjs');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { parseStoryMarkdown } = require('../../../lib/story-validators/parser.ts');
const { resolveStoryBankPlaceholders, runStoryPersonalizationGate } = require('../../../lib/story-bank-personalization.ts');
const rows = JSON.parse(fs.readFileSync(path.join(__dirname, 'sources.json'), 'utf8')).sources;
const companions = { bunny_ometz: 'בוני', chameleon_koko: 'קים', dragon_dini: 'דיני',
  fox_uri: 'אורי', lion_shaket: 'ליאו', panda_anat: 'ענת' };
const names = ['בר', 'נועה', 'אור מאיר', 'אן־לי'];
const checks = [];
for (const row of rows) {
  const raw = fs.readFileSync(path.join(__dirname, row.key + '.md'), 'utf8');
  const parsed = parseStoryMarkdown(raw);
  const companionName = companions[parsed.frontmatter.companionId];
  assert.ok(companionName);
  assert.equal(parsed.pages.length, row.pages);
  const title = parsed.frontmatter.title;
  assert.ok(typeof title === 'string' && title.includes('{{childName}}'));
  for (const childName of names) for (const childGender of ['boy', 'girl']) {
    const wizard = { childName, childGender, companionName };
    const reference = value => value.split('{{childName}}').join(childName)
      .replace(/\{([^{}|]+)\|([^{}|]+)\}/gu, (_, boy, girl) => childGender === 'boy' ? boy : girl);
    const resolvedTitle = resolveStoryBankPlaceholders(title, wizard);
    assert.equal(resolvedTitle, reference(title));
    const pages = parsed.pages.map(p => {
      const text = resolveStoryBankPlaceholders(p.text, wizard);
      assert.equal(text, reference(p.text), row.key + ':resolver_divergence');
      assert.doesNotMatch(text, /[{}|]/u, row.key + ':unresolved_token');
      // A dash supplied as part of the child's own name must NOT be altered.
      assert.doesNotMatch(text.split(childName).join(''), /[\p{Dash_Punctuation}\u2212\u00ad]/u,
        row.key + ':authored_dash');
      const templateCount = p.text.split('{{childName}}').length - 1;
      assert.ok(text.split(childName).length - 1 >= templateCount, row.key + ':missing_name');
      return { pageNumber: p.pageNumber, text };
    });
    assert.deepEqual(runStoryPersonalizationGate({ wizard, pages }), [], row.key + ':' + childGender + ':' + childName);
    assert.doesNotMatch(resolvedTitle.split(childName).join(''), /[{}|\p{Dash_Punctuation}\u2212\u00ad]/u);
    checks.push({ key: row.key, childName, childGender, pages: pages.length });
  }
}
const negatives = [
  { childGender: 'boy', text: 'איתן היא מחזיקה את הדובי.' },
  { childGender: 'girl', text: 'איתן הוא מחזיק את הדובי.' },
  { childGender: 'boy', text: 'איתן ראה את מיכל. היא כאן.' },
  { childGender: 'boy', text: 'איתן ראה {{childName}}.' },
  { childGender: 'boy', text: 'איתן {הלך|הלכה}.' },
];
for (const n of negatives) {
  const failures = runStoryPersonalizationGate({ wizard: { childName: 'איתן',
    childGender: n.childGender, companionName: 'בוני' }, pages: [{ pageNumber: 1, text: n.text }] });
  assert.ok(failures.length > 0, 'negative_control_not_rejected');
}
console.log(JSON.stringify({ status: 'existing_personalization_functions_checked',
  manuscripts: rows.length, nameGenderCases: checks.length,
  renderedTextPages: checks.reduce((sum, c) => sum + c.pages, 0),
  negativeControlsRejected: negatives.length, checks,
  providerCalls: 0, writes: 0, runtimePromotion: false,
  limitations: ['Not exhaustive Hebrew grammar analysis', 'Not the full bank/visual/release gate',
    'Tests four names; does not establish validity for every possible input',
    'A parent-supplied name retains its exact spelling, including its own hyphen'] }, null, 2));
