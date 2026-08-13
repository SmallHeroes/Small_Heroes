#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CONTRACT_PATH = 'story-pipeline/00_NEXT_GENERATION_STORY_CONTRACT.md';
const WRITER_CONTRACT_PATH = 'story-pipeline/03_story_briefs/STORY_WRITER_CONTRACT.md';
const FREEDOM_CHARTER_PATH =
  'story-pipeline/03_story_briefs/STORY_WRITER_FREEDOM_CHARTER.md';
const COMPANION_CARDS_PATH =
  'story-pipeline/03_story_briefs/companion-authoring-cards.json';
const ARCHITECT_PILOTS_PATH =
  'story-pipeline/03_story_briefs/story-architect-pilots.json';
const ARCHITECT_CHARTER_PATH =
  'story-pipeline/03_story_briefs/STORY_ARCHITECT_PILOT_CHARTER.md';
const EDITORIAL_QA_PATH =
  'story-pipeline/03_story_briefs/STORY_DRAFT_EDITORIAL_QA_CONTRACT.md';
const CATALOG_PATH = 'story-pipeline/03_story_briefs/story-brief-catalog.json';
const COMPANION_CARD_KEYS = [
  'companionId',
  'displayName',
  'storyRole',
  'lovableMistake',
  'embodiedComedy',
  'childPartnership',
  'voiceDirection',
];
const ARCHITECT_PILOT_KEYS = [
  'briefId',
  'companionId',
  'companionPortrait',
  'premiseSeed',
];

function readUtf8(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readUtf8(relativePath));
}

function validateCompanionCardsDocument(document) {
  if (
    document?.version !== 'small-heroes-companion-authoring-cards/v1' ||
    document?.status !== 'staging_only' ||
    !Array.isArray(document.cards) ||
    document.cards.length !== 6 ||
    Object.keys(document).join(',') !== 'version,status,cards'
  ) {
    throw new Error('story_commission_companion_cards_invalid');
  }
  const companionIds = new Set();
  for (const card of document.cards) {
    if (
      Object.keys(card).join(',') !== COMPANION_CARD_KEYS.join(',') ||
      COMPANION_CARD_KEYS.some(
        (key) => typeof card[key] !== 'string' || card[key].trim().length < 3,
      ) ||
      companionIds.has(card.companionId)
    ) {
      throw new Error('story_commission_companion_cards_invalid');
    }
    companionIds.add(card.companionId);
  }
  return document;
}

function validateArchitectPilotsDocument(document) {
  if (
    document?.version !== 'small-heroes-story-architect-pilots/v1' ||
    document?.status !== 'staging_only' ||
    !Array.isArray(document.pilots) ||
    document.pilots.length !== 1 ||
    Object.keys(document).join(',') !== 'version,status,pilots'
  ) {
    throw new Error('story_architect_pilots_invalid');
  }
  const briefIds = new Set();
  for (const pilot of document.pilots) {
    if (
      Object.keys(pilot).join(',') !== ARCHITECT_PILOT_KEYS.join(',') ||
      ARCHITECT_PILOT_KEYS.some(
        (key) => typeof pilot[key] !== 'string' || pilot[key].trim().length < 3,
      ) ||
      briefIds.has(pilot.briefId)
    ) {
      throw new Error('story_architect_pilots_invalid');
    }
    briefIds.add(pilot.briefId);
  }
  return document;
}

function loadCommissionAuthority() {
  const catalog = readJson(CATALOG_PATH);
  const companionCardsDocument = validateCompanionCardsDocument(
    readJson(COMPANION_CARDS_PATH),
  );
  const records = [];

  for (const briefSetPath of catalog.briefSetPaths) {
    const briefSet = readJson(briefSetPath);
    for (const brief of briefSet.briefs) {
      records.push({
        brief,
        briefSetPath,
        companionId: briefSet.companionId,
        companionBiblePath: briefSet.companionBiblePath,
      });
    }
  }

  return {
    catalog,
    records,
    writerFreedomCharter: readUtf8(FREEDOM_CHARTER_PATH).trim(),
    companionCards: companionCardsDocument.cards,
    sourceDocuments: {
      sharedStoryContract: readUtf8(CONTRACT_PATH).trim(),
      writerContract: readUtf8(WRITER_CONTRACT_PATH).trim(),
    },
  };
}

function findCompanionCard(authority, companionId) {
  const matches = authority.companionCards.filter(
    (card) => card.companionId === companionId,
  );
  if (matches.length !== 1) {
    throw new Error(`story_commission_companion_card_not_unique:${companionId}`);
  }
  return matches[0];
}

function projectBriefForWriter(brief) {
  return {
    version: 'small-heroes-story-writer-rails/v1',
    briefId: brief.id,
    workingTitle: brief.workingTitle,
    category: brief.category,
    direction: brief.direction,
    textPageCount: brief.pageCount,
    storyPromise: brief.creativePromise,
    openingSituation: brief.openingHook,
    childGoal: brief.childWant,
    centralPhysicalProblem: brief.physicalProblem,
    physicalLogic: brief.playRule,
    setPieces: brief.setPieces.map(({ name }) => name),
    storyMovement: [...brief.lockedCausalMovement],
    companionComplication: brief.companionWrongHelp,
    childDiscovery: brief.childDiscovery,
    childClimaxAction: brief.childClimaxAction,
    visiblePayoff: brief.visiblePayoff,
    endingEnergy: brief.endingEnergy,
    continuity: {
      recurringObjects: [...brief.recurringObjects],
      transientCast: [...brief.transientCast],
    },
    creativeOpenings: [...brief.modelFreedom],
  };
}

function commissionMetadata(record) {
  const textPageCount = record.brief.pageCount;
  return {
    commissionVersion: 'small-heroes-story-commission/v2',
    authorityStatus: 'staging_only',
    briefId: record.brief.id,
    workingTitle: record.brief.workingTitle,
    companionId: record.companionId,
    category: record.brief.category,
    direction: record.brief.direction,
    textPageCount,
    physicalPageCount: textPageCount * 2,
    personalization: {
      childName: '{{childName}}',
      childGender: 'pipe_chips_boy_then_girl',
      childAppearance: 'not_supplied_story_writer_must_not_invent',
      childAgeBodyAuthority: 'downstream_visual_pipeline_only',
    },
  };
}

function buildCommissionBundle(authority, record) {
  const metadata = commissionMetadata(record);
  const companionCard = findCompanionCard(authority, record.companionId);
  const storyRails = projectBriefForWriter(record.brief);

  return [
    '# Small Heroes — ChatGPT Story Commission',
    '',
    'The JSON blocks are creative rails: preserve their dramatic truth, but never copy their labels or phrasing into dialogue.',
    'Return one complete staging draft only. Write it as an author, not as a specification converter.',
    '',
    '## Commission identity',
    '',
    '```json',
    JSON.stringify(metadata, null, 2),
    '```',
    '',
    '## Writer freedom charter',
    '',
    authority.writerFreedomCharter,
    '',
    '## Companion authoring card',
    '',
    '```json',
    JSON.stringify(companionCard, null, 2),
    '```',
    '',
    '## Story rails',
    '',
    '```json',
    JSON.stringify(storyRails, null, 2),
    '```',
    '',
    'Write now. Do not restate the rails, explain your choices, or turn `physicalLogic` into announced dialogue.',
    '',
  ].join('\n');
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function findRecord(authority, briefId) {
  const matches = authority.records.filter(({ brief }) => brief.id === briefId);
  if (matches.length !== 1) {
    throw new Error(`story_commission_brief_id_not_unique:${briefId}`);
  }
  return matches[0];
}

function writeCommissionFiles(authority, records, outputDir) {
  const absoluteOutputDir = path.resolve(outputDir);
  fs.mkdirSync(absoluteOutputDir, { recursive: true });
  const existing = fs.readdirSync(absoluteOutputDir);
  if (existing.length > 0) {
    throw new Error('story_commission_output_directory_not_empty');
  }

  const manifestRecords = [];
  for (const record of records) {
    const bundle = buildCommissionBundle(authority, record);
    const digest = sha256(bundle);
    const filename = `${record.brief.id}.${digest}.md`;
    fs.writeFileSync(path.join(absoluteOutputDir, filename), bundle, {
      encoding: 'utf8',
      flag: 'wx',
    });
    manifestRecords.push({
      ...commissionMetadata(record),
      filename,
      sha256: digest,
      sourceAuthority: {
        storyContract: {
          path: CONTRACT_PATH,
          sha256: sha256(authority.sourceDocuments.sharedStoryContract),
        },
        editorialWriterContract: {
          path: WRITER_CONTRACT_PATH,
          sha256: sha256(authority.sourceDocuments.writerContract),
        },
        writerFreedomCharter: {
          path: FREEDOM_CHARTER_PATH,
          sha256: sha256(authority.writerFreedomCharter),
        },
        companionCards: {
          path: COMPANION_CARDS_PATH,
          sha256: sha256(readUtf8(COMPANION_CARDS_PATH)),
        },
        companionBible: {
          path: record.companionBiblePath,
          sha256: sha256(readUtf8(record.companionBiblePath).trim()),
        },
        briefSet: {
          path: record.briefSetPath,
          sha256: sha256(readUtf8(record.briefSetPath)),
        },
      },
    });
  }

  const manifest = {
    version: 'small-heroes-story-commission-manifest/v2',
    status: 'staging_only',
    recordCount: manifestRecords.length,
    records: manifestRecords,
  };
  fs.writeFileSync(
    path.join(absoluteOutputDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  );
  const indexRows = manifestRecords.map((record) =>
    `| ${record.workingTitle} | ${record.companionId} | ${record.direction} | ${record.textPageCount} | ${record.physicalPageCount} | [copy-ready brief](${record.filename}) |`,
  );
  const index = [
    '# Small Heroes — ChatGPT Story Commissions',
    '',
    'כל קובץ בטבלה הוא פרומפט עצמאי במתכונת מסילות יצירתיות. מעתיקים את כל תוכן הקובץ לשיחה חדשה ב־ChatGPT.',
    'הפלט המבוקש הוא טיוטת staging בלבד; אין להעביר לבנק או לרינדור לפני עריכה ואישור.',
    '',
    '| שם עבודה | קומפניון | כיוון | עמודי טקסט | עמודים פיזיים | קובץ לשליחה |',
    '|---|---|---|---:|---:|---|',
    ...indexRows,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(absoluteOutputDir, 'INDEX.md'), index, {
    encoding: 'utf8',
    flag: 'wx',
  });
  return manifest;
}

function loadArchitectPilotAuthority(commissionAuthority = loadCommissionAuthority()) {
  const document = validateArchitectPilotsDocument(readJson(ARCHITECT_PILOTS_PATH));
  for (const pilot of document.pilots) {
    const record = findRecord(commissionAuthority, pilot.briefId);
    if (record.companionId !== pilot.companionId) {
      throw new Error('story_architect_pilot_companion_mismatch');
    }
  }
  return {
    commissionAuthority,
    architectCharter: readUtf8(ARCHITECT_CHARTER_PATH).trim(),
    postDraftEditorialQa: readUtf8(EDITORIAL_QA_PATH).trim(),
    pilots: document.pilots,
  };
}

function findArchitectPilot(authority, briefId) {
  const matches = authority.pilots.filter((pilot) => pilot.briefId === briefId);
  if (matches.length !== 1) {
    throw new Error(`story_architect_pilot_not_unique:${briefId}`);
  }
  return matches[0];
}

function buildArchitectPilotBundle(authority, record) {
  const pilot = findArchitectPilot(authority, record.brief.id);
  const identity = {
    commissionVersion: 'small-heroes-story-architect-commission/v1',
    authorityStatus: 'staging_pilot_only',
    briefId: record.brief.id,
    companionId: record.companionId,
    direction: record.brief.direction,
    futureTextPageCount: record.brief.pageCount,
    futurePhysicalPageCount: record.brief.pageCount * 2,
  };
  const creativeNucleus = {
    version: 'small-heroes-story-creative-nucleus/v1',
    premiseSeed: pilot.premiseSeed,
    visualJourneyRequirement:
      'A physical, funny journey through several materially different environments; exact locations and order are yours to invent.',
  };

  return [
    '# Small Heroes — Story Architect Pilot',
    '',
    'This is an interactive two-stage commission. On the first response, invent three genuinely different story shapes and stop.',
    'Do not write the story until Guy selects exactly one shape.',
    '',
    '## Pilot identity',
    '',
    '```json',
    JSON.stringify(identity, null, 2),
    '```',
    '',
    '## Story Architect charter',
    '',
    authority.architectCharter,
    '',
    '## Companion inner character',
    '',
    pilot.companionPortrait,
    '',
    '## Creative nucleus',
    '',
    '```json',
    JSON.stringify(creativeNucleus, null, 2),
    '```',
    '',
    'Begin with Stage 1 only. Return three story shapes and `WAITING_FOR_GUY_SELECTION`.',
    '',
  ].join('\n');
}

function writeArchitectPilotFiles(authority, record, outputDir) {
  const absoluteOutputDir = path.resolve(outputDir);
  fs.mkdirSync(absoluteOutputDir, { recursive: true });
  if (fs.readdirSync(absoluteOutputDir).length > 0) {
    throw new Error('story_architect_output_directory_not_empty');
  }

  const bundle = buildArchitectPilotBundle(authority, record);
  const digest = sha256(bundle);
  const filename = `${record.brief.id}.architect.${digest}.md`;
  fs.writeFileSync(path.join(absoluteOutputDir, filename), bundle, {
    encoding: 'utf8',
    flag: 'wx',
  });
  const manifest = {
    version: 'small-heroes-story-architect-pilot-manifest/v1',
    status: 'staging_pilot_only',
    recordCount: 1,
    record: {
      briefId: record.brief.id,
      companionId: record.companionId,
      direction: record.brief.direction,
      futureTextPageCount: record.brief.pageCount,
      filename,
      sha256: digest,
      sourceAuthority: {
        architectCharter: {
          path: ARCHITECT_CHARTER_PATH,
          sha256: sha256(authority.architectCharter),
        },
        architectPilots: {
          path: ARCHITECT_PILOTS_PATH,
          sha256: sha256(readUtf8(ARCHITECT_PILOTS_PATH)),
        },
        postDraftEditorialQa: {
          path: EDITORIAL_QA_PATH,
          sha256: sha256(authority.postDraftEditorialQa),
          dispatchedToArchitect: false,
        },
        briefSet: {
          path: record.briefSetPath,
          sha256: sha256(readUtf8(record.briefSetPath)),
        },
      },
    },
  };
  fs.writeFileSync(
    path.join(absoluteOutputDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  );
  return manifest;
}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  const values = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error('story_commission_cli_arguments_invalid');
    }
    values[key.slice(2)] = value;
  }
  return { command, values };
}

function main(argv) {
  const authority = loadCommissionAuthority();
  const { command, values } = parseArguments(argv);

  if (command === 'list') {
    if (Object.keys(values).length > 0) {
      throw new Error('story_commission_cli_arguments_invalid');
    }
    process.stdout.write(`${JSON.stringify(
      authority.records.map((record) => commissionMetadata(record)),
      null,
      2,
    )}\n`);
    return;
  }

  if (command === 'materialize' && values['brief-id'] && values['output-dir']) {
    const record = findRecord(authority, values['brief-id']);
    const manifest = writeCommissionFiles(authority, [record], values['output-dir']);
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    return;
  }

  if (command === 'materialize-all' && values['output-dir']) {
    const manifest = writeCommissionFiles(authority, authority.records, values['output-dir']);
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    return;
  }

  if (
    command === 'materialize-architect-pilot' &&
    values['brief-id'] &&
    values['output-dir'] &&
    Object.keys(values).sort().join(',') === 'brief-id,output-dir'
  ) {
    const architectAuthority = loadArchitectPilotAuthority(authority);
    const record = findRecord(authority, values['brief-id']);
    findArchitectPilot(architectAuthority, record.brief.id);
    const manifest = writeArchitectPilotFiles(
      architectAuthority,
      record,
      values['output-dir'],
    );
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    return;
  }

  throw new Error('story_commission_cli_arguments_invalid');
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildCommissionBundle,
  buildArchitectPilotBundle,
  commissionMetadata,
  findCompanionCard,
  findArchitectPilot,
  findRecord,
  loadArchitectPilotAuthority,
  loadCommissionAuthority,
  projectBriefForWriter,
  sha256,
  validateCompanionCardsDocument,
  validateArchitectPilotsDocument,
  writeCommissionFiles,
  writeArchitectPilotFiles,
};
