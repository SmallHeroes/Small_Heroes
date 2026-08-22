const RECORD_VERSION = 'small-heroes-story-visual-direction-record/v1';
const PRESENCE = ['present', 'partial', 'absent'];
const SHOTS = [
  'extreme_wide',
  'wide',
  'medium_wide',
  'medium',
  'medium_close',
  'close',
  'detail',
];
const ANGLES = [
  'eye_level',
  'high_angle',
  'low_angle',
  'overhead',
  'ground_level',
  'three_quarter',
];

const PAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'pageNumber',
    'settingKey',
    'setting',
    'childPresence',
    'companionPresence',
    'supportingCharacters',
    'mainAction',
    'heroObject',
    'shotType',
    'cameraAngle',
    'lighting',
    'continuityAnchors',
  ],
  properties: {
    pageNumber: { type: 'integer' },
    settingKey: { type: 'string' },
    setting: { type: 'string' },
    childPresence: { type: 'string', enum: PRESENCE },
    companionPresence: { type: 'string', enum: PRESENCE },
    supportingCharacters: { type: 'array', items: { type: 'string' } },
    mainAction: { type: 'string' },
    heroObject: { type: ['string', 'null'] },
    shotType: { type: 'string', enum: SHOTS },
    cameraAngle: { type: 'string', enum: ANGLES },
    lighting: { type: 'string' },
    continuityAnchors: { type: 'array', items: { type: 'string' } },
  },
};

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['version', 'storyKey', 'pages'],
  properties: {
    version: { type: 'string', enum: [RECORD_VERSION] },
    storyKey: { type: 'string' },
    pages: { type: 'array', items: PAGE_SCHEMA },
  },
};

function exactKeys(value, keys) {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join('\0') === [...keys].sort().join('\0')
  );
}

function parseStory(storyText) {
  const companionId = storyText.match(/^companionId:\s*(\S+)\s*$/m)?.[1] ?? '';
  const direction = storyText.match(/^direction:\s*(\S+)\s*$/m)?.[1] ?? '';
  const category = storyText.match(/^category:\s*(\S+)\s*$/m)?.[1] ?? '';
  const declaredPages = Number(storyText.match(/^pages:\s*(\d+)\s*$/m)?.[1] ?? 0);
  const pageMarkers = [...storyText.matchAll(/^--- Page (\d+) ---\s*$/gm)];
  const pages = pageMarkers.map((match, index) => {
    const next = pageMarkers[index + 1];
    const start = (match.index ?? 0) + match[0].length;
    const end = next?.index ?? storyText.length;
    return { pageNumber: Number(match[1]), prose: storyText.slice(start, end).trim() };
  });
  if (
    !companionId ||
    !['bedtime', 'adventure', 'fantasy'].includes(direction) ||
    !category ||
    ![8, 12, 16].includes(declaredPages) ||
    pages.length !== declaredPages ||
    pages.some((page, index) => page.pageNumber !== index + 1 || !page.prose)
  ) {
    throw new Error('story_visual_direction_story_invalid');
  }
  return { companionId, direction, category, declaredPages, pages };
}

function cleanText(value, minimum = 3, maximum = 320) {
  return (
    typeof value === 'string' &&
    value.trim().length >= minimum &&
    value.length <= maximum &&
    !value.includes('\0') &&
    !/[\u0590-\u05ff]/u.test(value) &&
    !value.includes('{{') &&
    !value.includes('}}') &&
    !/[{}]/.test(value)
  );
}

function cleanStringArray(value, maximumItems, maximumLength = 120) {
  return (
    Array.isArray(value) &&
    value.length <= maximumItems &&
    new Set(value).size === value.length &&
    value.every((entry) => cleanText(entry, 2, maximumLength))
  );
}

function normalizeVisualDirectionRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.pages)) {
    return value;
  }
  const normalizeText = (entry) =>
    typeof entry === 'string'
      ? entry.trim().replaceAll('{{childName}}', 'the child')
      : entry;
  const normalizeArray = (entries) =>
    Array.isArray(entries) ? [...new Set(entries.map(normalizeText))] : entries;
  return {
    ...value,
    storyKey: typeof value.storyKey === 'string' ? value.storyKey.trim() : value.storyKey,
    pages: value.pages.map((page) => {
      if (!page || typeof page !== 'object' || Array.isArray(page)) return page;
      return {
        ...page,
        settingKey:
          typeof page.settingKey === 'string'
            ? page.settingKey.trim().toLowerCase().replace(/[\s-]+/g, '_')
            : page.settingKey,
        setting: normalizeText(page.setting),
        supportingCharacters: normalizeArray(page.supportingCharacters),
        mainAction: normalizeText(page.mainAction),
        heroObject: normalizeText(page.heroObject),
        lighting: normalizeText(page.lighting),
        continuityAnchors: normalizeArray(page.continuityAnchors),
      };
    }),
  };
}

function validateVisualDirectionRecord(value, storyKey, expectedPageCount) {
  const topKeys = ['version', 'storyKey', 'pages'];
  const pageKeys = [
    'pageNumber',
    'settingKey',
    'setting',
    'childPresence',
    'companionPresence',
    'supportingCharacters',
    'mainAction',
    'heroObject',
    'shotType',
    'cameraAngle',
    'lighting',
    'continuityAnchors',
  ];
  const reject = (code) => {
    throw new Error(`story_visual_direction_output_invalid:${code}`);
  };
  if (!exactKeys(value, topKeys)) reject('root_shape');
  if (value.version !== RECORD_VERSION) reject('record_version');
  if (value.storyKey !== storyKey) reject('story_key');
  if (!Array.isArray(value.pages) || value.pages.length !== expectedPageCount) {
    reject('page_coverage');
  }
  for (const [index, page] of value.pages.entries()) {
    const locator = `page_${index + 1}`;
    if (!exactKeys(page, pageKeys)) reject(`${locator}_shape`);
    if (page.pageNumber !== index + 1) reject(`${locator}_number`);
    if (!/^[a-z][a-z0-9_]{2,95}$/.test(page.settingKey)) reject(`${locator}_setting_key`);
    if (!cleanText(page.setting, 3, 800)) reject(`${locator}_setting`);
    if (!PRESENCE.includes(page.childPresence)) reject(`${locator}_child_presence`);
    if (!PRESENCE.includes(page.companionPresence)) reject(`${locator}_companion_presence`);
    if (!cleanStringArray(page.supportingCharacters, 12, 240)) {
      reject(`${locator}_supporting_characters`);
    }
    if (!cleanText(page.mainAction, 3, 1200)) reject(`${locator}_main_action`);
    if (!(page.heroObject === null || cleanText(page.heroObject, 2, 600))) {
      reject(`${locator}_hero_object`);
    }
    if (!SHOTS.includes(page.shotType)) reject(`${locator}_shot_type`);
    if (!ANGLES.includes(page.cameraAngle)) reject(`${locator}_camera_angle`);
    if (!cleanText(page.lighting, 3, 600)) reject(`${locator}_lighting`);
    if (!cleanStringArray(page.continuityAnchors, 12, 320)) {
      reject(`${locator}_continuity_anchors`);
    }
  }
  return value;
}

module.exports = {
  ANGLES,
  PAGE_SCHEMA,
  PRESENCE,
  RECORD_VERSION,
  RESPONSE_SCHEMA,
  SHOTS,
  normalizeVisualDirectionRecord,
  parseStory,
  validateVisualDirectionRecord,
};
