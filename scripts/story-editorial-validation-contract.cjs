const crypto = require('node:crypto');

const FRONTMATTER_KEYS = [
  'title',
  'companionId',
  'direction',
  'category',
  'pages',
  'gender',
  'endingType',
];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function parseMinimalFrontmatterLines(lines) {
  const values = {};
  const keys = [];
  for (const line of lines) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.+)$/);
    if (!match) {
      throw new Error('story_writer_revision_frontmatter_invalid');
    }
    const key = match[1];
    if (keys.includes(key)) {
      throw new Error('story_writer_revision_frontmatter_invalid');
    }
    keys.push(key);
    values[key] = match[2].trim().replace(/^"(.*)"$/, '$1');
  }
  if (keys.join(',') !== FRONTMATTER_KEYS.join(',')) {
    throw new Error('story_writer_revision_frontmatter_invalid');
  }
  return values;
}

function validateFullGenderChips(markdown) {
  const malformed = [];
  const chipPattern = /(?<!\{)\{(?!\{)([^{}]*)\}(?!\})/g;
  let match;
  while ((match = chipPattern.exec(markdown)) !== null) {
    const before = markdown.slice(Math.max(0, match.index - 1), match.index);
    const forms = match[1].split('|');
    if (
      /[\u0590-\u05FF]/u.test(before) ||
      forms.length !== 2 ||
      forms.some(
        (form) =>
          form.trim().length < 2 ||
          !/^[\u0590-\u05FF\u05F3\u05F4'"־\- ]+$/u.test(form.trim()),
      )
    ) {
      malformed.push(match[0]);
    }
  }
  if (malformed.length > 0) {
    throw new Error('story_writer_revision_gender_chips_invalid');
  }
}

const EDITORIAL_SOURCE_PROFILE_LEGACY_FEMALE = 'legacy_female';
const EDITORIAL_SOURCE_PROFILE_GENDER_FLEXIBLE = 'gender_flexible';

function expectedSourceGender(profile) {
  if (
    profile === undefined ||
    profile === EDITORIAL_SOURCE_PROFILE_LEGACY_FEMALE
  ) {
    return 'female';
  }
  if (profile === EDITORIAL_SOURCE_PROFILE_GENDER_FLEXIBLE) {
    return 'neutral';
  }
  throw new Error('story_writer_revision_source_profile_invalid');
}

function normalizeAndValidateStoryDraft(
  record,
  draft,
  allowDelimiterNormalization,
  options = {},
) {
  const normalized = draft.text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  if (lines[0] !== '---') {
    throw new Error('story_writer_revision_frontmatter_invalid');
  }
  const firstPageIndex = lines.findIndex((line) => /^--- Page 1 ---$/.test(line));
  if (firstPageIndex < 3) {
    throw new Error('story_writer_revision_frontmatter_invalid');
  }
  const delimiterIndexes = [];
  for (let index = 1; index < firstPageIndex; index += 1) {
    if (/^-{3,}$/.test(lines[index])) delimiterIndexes.push(index);
  }
  if (delimiterIndexes.length !== 1) {
    throw new Error('story_writer_revision_frontmatter_invalid');
  }
  const closingIndex = delimiterIndexes[0];
  const originalDelimiter = lines[closingIndex];
  if (originalDelimiter !== '---' && !allowDelimiterNormalization) {
    throw new Error('story_writer_revision_frontmatter_invalid');
  }
  const frontmatter = parseMinimalFrontmatterLines(
    lines.slice(1, closingIndex).filter((line) => line.length > 0),
  );
  if (
    !frontmatter.title ||
    frontmatter.companionId !== record.companionId ||
    frontmatter.direction !== record.brief.direction ||
    frontmatter.category !== record.brief.category ||
    Number(frontmatter.pages) !== record.brief.pageCount ||
    frontmatter.gender !== expectedSourceGender(options.sourceProfile) ||
    frontmatter.endingType !== 'resolution'
  ) {
    throw new Error('story_writer_revision_identity_mismatch');
  }
  lines[closingIndex] = '---';
  const normalizedStory = `${lines.join('\n').trimEnd()}\n`;
  const pageNumbers = [...normalizedStory.matchAll(/^--- Page (\d+) ---$/gm)].map(
    (entry) => Number(entry[1]),
  );
  const expectedPages = Array.from(
    { length: record.brief.pageCount },
    (_, index) => index + 1,
  );
  if (pageNumbers.join(',') !== expectedPages.join(',')) {
    throw new Error('story_writer_revision_page_contract_invalid');
  }
  const pageBodies = normalizedStory.split(/^--- Page \d+ ---$/gm).slice(1);
  if (
    pageBodies.length !== record.brief.pageCount ||
    pageBodies.some((body) => !body.trim())
  ) {
    throw new Error('story_writer_revision_page_contract_invalid');
  }
  validateFullGenderChips(normalizedStory);
  return {
    text: normalizedStory,
    sha256: sha256(normalizedStory),
    actions:
      originalDelimiter === '---'
        ? []
        : [
            {
              code: 'frontmatter_closing_delimiter_normalized',
              fromLength: originalDelimiter.length,
              to: '---',
            },
          ],
  };
}

function validateEditorialPassDraft(record, draft, options = {}) {
  const validated = normalizeAndValidateStoryDraft(
    record,
    draft,
    false,
    options,
  );
  if (
    validated.actions.length !== 0 ||
    validated.text !== draft.text ||
    validated.sha256 !== draft.sha256
  ) {
    throw new Error('story_editorial_pass_draft_not_canonical');
  }
  return validated;
}

module.exports = {
  EDITORIAL_SOURCE_PROFILE_GENDER_FLEXIBLE,
  EDITORIAL_SOURCE_PROFILE_LEGACY_FEMALE,
  normalizeAndValidateStoryDraft,
  validateEditorialPassDraft,
};
