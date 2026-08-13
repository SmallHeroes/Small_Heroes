import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildCommissionBundle,
  commissionMetadata,
  findRecord,
  loadCommissionAuthority,
  writeCommissionFiles,
} = require('../../scripts/materialize-story-commission-briefs.cjs') as {
  buildCommissionBundle: (authority: CommissionAuthority, record: CommissionRecord) => string;
  commissionMetadata: (record: CommissionRecord) => CommissionMetadata;
  findRecord: (authority: CommissionAuthority, briefId: string) => CommissionRecord;
  loadCommissionAuthority: () => CommissionAuthority;
  writeCommissionFiles: (
    authority: CommissionAuthority,
    records: CommissionRecord[],
    outputDir: string,
  ) => { recordCount: number; records: Array<CommissionMetadata & { filename: string; sha256: string }> };
};

interface CommissionRecord {
  brief: {
    id: string;
    category: string;
    direction: 'bedtime' | 'adventure' | 'fantasy';
    pageCount: number;
    workingTitle: string;
  };
  companionId: string;
  companionBiblePath: string;
}

interface CommissionAuthority {
  records: CommissionRecord[];
  sharedStoryContract: string;
  writerContract: string;
}

interface CommissionMetadata {
  commissionVersion: 'small-heroes-story-commission/v1';
  authorityStatus: 'staging_only';
  briefId: string;
  companionId: string;
  category: string;
  direction: 'bedtime' | 'adventure' | 'fantasy';
  textPageCount: number;
  physicalPageCount: number;
  personalization: {
    childAppearance: 'not_supplied_story_writer_must_not_invent';
    childAgeBodyAuthority: 'downstream_visual_pipeline_only';
  };
}

describe('story commission materializer', () => {
  it('materializes the exact 18 curated slots with 8/12/16 text pages and 16/24/32 physical pages', () => {
    const authority = loadCommissionAuthority();
    const metadata = authority.records.map(commissionMetadata);

    expect(metadata).toHaveLength(18);
    expect(new Set(metadata.map(({ briefId }) => briefId)).size).toBe(18);
    expect(new Set(metadata.map(({ companionId }) => companionId)).size).toBe(6);

    const pageContracts = new Map([
      ['bedtime', [8, 16]],
      ['adventure', [12, 24]],
      ['fantasy', [16, 32]],
    ]);
    for (const record of metadata) {
      expect(
        [record.textPageCount, record.physicalPageCount],
        record.briefId,
      ).toEqual(pageContracts.get(record.direction));
      expect(record.personalization.childAppearance).toBe(
        'not_supplied_story_writer_must_not_invent',
      );
      expect(record.personalization.childAgeBodyAuthority).toBe(
        'downstream_visual_pipeline_only',
      );
    }
  });

  it('builds one self-contained prompt from only the shared contracts, selected companion, and selected brief', () => {
    const authority = loadCommissionAuthority();
    const selected = authority.records.find(
      ({ brief }) => brief.direction === 'adventure',
    )!;
    const another = authority.records.find(
      ({ brief }) => brief.id !== selected.brief.id,
    )!;
    const bundle = buildCommissionBundle(authority, selected);

    expect(bundle).toContain(authority.sharedStoryContract);
    expect(bundle).toContain(authority.writerContract);
    expect(bundle).toContain(selected.brief.id);
    expect(bundle).toContain(selected.brief.workingTitle);
    expect(bundle).toContain('"textPageCount": 12');
    expect(bundle).toContain('"physicalPageCount": 24');
    expect(bundle).not.toContain(another.brief.id);
    expect(bundle).toContain("Do not invent the child's height, body proportions, clothing, face, hair, or visual style.");
  });

  it('writes content-addressed bundles and refuses ambiguous IDs or a non-empty output directory', () => {
    const authority = loadCommissionAuthority();
    const selected = authority.records[0]!;
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'small-heroes-story-commission-'));

    try {
      const manifest = writeCommissionFiles(authority, [selected], outputDir);
      expect(manifest.recordCount).toBe(1);
      expect(manifest.records[0]!.filename).toMatch(
        new RegExp(`^${selected.brief.id}\\.[a-f0-9]{64}\\.md$`),
      );
      expect(fs.readdirSync(outputDir).sort()).toEqual(
        [manifest.records[0]!.filename, 'manifest.json'].sort(),
      );
      expect(() => writeCommissionFiles(authority, [selected], outputDir)).toThrow(
        'story_commission_output_directory_not_empty',
      );
      expect(() => findRecord(authority, 'not-a-real-brief')).toThrow(
        'story_commission_brief_id_not_unique:not-a-real-brief',
      );
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
