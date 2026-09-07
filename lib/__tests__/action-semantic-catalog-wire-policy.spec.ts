import { describe, expect, it } from 'vitest';
import { canonicalHash } from '../canonical-json';
import { actionSchemaForCatalog, actionSchemasForCatalog } from '../visual-contract-compiler/actionSemanticCatalogWirePolicy';
import { ACTION_SEMANTIC_CATALOG_VERSION, LEGACY_ACTION_SEMANTIC_CATALOG_VERSION_V3, type ActionSemanticCatalogVersion } from '../visual-contract-compiler/actionSemanticCatalog';
import { buildTemplateCompileSystemPrompt, buildTemplateRepairSystemPrompt } from '../visual-contract-compiler/compileBookVisualContractTemplate';
import { TEMPLATE_DRAFT_JSON_SCHEMA } from '../visual-contract-compiler/templateDraftSchema';
import { PAGE_CONTRACT_REPAIR_JSON_SCHEMA, PAGE_SPATIAL_REFERENCE_REPAIR_JSON_SCHEMA } from '../visual-contract-compiler/pageContractRepair';
import { STRUCTURAL_BUNDLE_REPAIR_JSON_SCHEMA } from '../visual-contract-compiler/structuralBundleRepair';
import { BOOK_SURFACE_REPAIR_JSON_SCHEMA } from '../visual-contract-compiler/bookSurfaceRepair';
import { SOURCE_EVIDENCE_ID_REPAIR_JSON_SCHEMA } from '../visual-contract-compiler/sourceEvidenceIdRepair';
import { REPRESENTED_ELSEWHERE_REPAIR_JSON_SCHEMA } from '../visual-contract-compiler/representedElsewhereRepair';
import { PRESENTATION_REQUIREMENT_REPAIR_JSON_SCHEMA } from '../visual-contract-compiler/presentationRequirementRepair';
import { STABLE_PROP_SCOPE_REPAIR_JSON_SCHEMA } from '../visual-contract-compiler/stablePropScopeRepair';

// Measured read-only at protected 768ccb2f before cutover, not repinned from
// today's projection. Includes every initial / bounded-repair provider schema.
const historicalSchemas = [
  ['draft', TEMPLATE_DRAFT_JSON_SCHEMA, '82f8c6dbb51c2bacea8265eef33b6cb2f9fb2ba76be8dea516344204966a88d6'],
  ['page', PAGE_CONTRACT_REPAIR_JSON_SCHEMA, '1c7049591737ec2ecd68fb585a993ae1d87752f1aa3b41103ee5bc6c010b10d3'],
  ['spatial', PAGE_SPATIAL_REFERENCE_REPAIR_JSON_SCHEMA, '316d076c978321fb18413e36720ac13ef0093b6d778fb177306e8a7197a97951'],
  ['structural', STRUCTURAL_BUNDLE_REPAIR_JSON_SCHEMA, 'e2741e87904493c50865bb0a89064c743d1a6b10bb2c99aaa8d32642829d03ea'],
  ['book', BOOK_SURFACE_REPAIR_JSON_SCHEMA, 'a1d16581b25d9af14b33fdaa21806713f739212e51afa53643ba4c030739b20f'],
  ['source', SOURCE_EVIDENCE_ID_REPAIR_JSON_SCHEMA, '8f9514a8e2ad479aa7a8d2f01e322dadc34d522829ee417960d2f271adc51c6e'],
  ['elsewhere', REPRESENTED_ELSEWHERE_REPAIR_JSON_SCHEMA, 'c15013c5ed2a5482156e19dd95c3e46b10bdb01fa9df5da04c4d78b321c20a4d'],
  ['presentation', PRESENTATION_REQUIREMENT_REPAIR_JSON_SCHEMA, '2f69576faeb3603fdeeeec15f1aef5400054e47d616d22b40605f75d116acc3f'],
  ['prop', STABLE_PROP_SCOPE_REPAIR_JSON_SCHEMA, 'b189a20c336cb17491ac440f740b21f0bc6596b27e445451b2b8ad11a4c7ee70'],
] as const;
const v3 = LEGACY_ACTION_SEMANTIC_CATALOG_VERSION_V3;
const v4 = ACTION_SEMANTIC_CATALOG_VERSION;

describe('explicit catalog wire policy', () => {
  it.each(historicalSchemas)('reproduces historical %s schema without modifying current authority', (_name, schema, digest) => {
    const before = canonicalHash(schema);
    const old = actionSchemaForCatalog(schema, v3);
    expect(canonicalHash(old)).toBe(digest);
    expect(JSON.stringify(old)).not.toContain('"runs"');
    expect(actionSchemaForCatalog(schema, v4)).toBe(schema);
    expect(canonicalHash(schema)).toBe(before);
  });
  it('preserves both exact historical prompt identities and accounts for the new bounded input', () => {
    expect(canonicalHash(buildTemplateCompileSystemPrompt(v3))).toBe('c5e49585f76dc398e07859311508cefe6da954d1d8041ced3f4bdd7a14651d9c');
    expect(canonicalHash(buildTemplateRepairSystemPrompt(v3))).toBe('486e7475ed98193a445eabc360de718e221f66d5dcdd950126e1a8106706c24f');
    expect(buildTemplateCompileSystemPrompt()).toContain('action-semantic-catalog/v4');
    expect(buildTemplateCompileSystemPrompt(v3)).not.toContain('["runs",');
    expect(Buffer.byteLength(buildTemplateCompileSystemPrompt()) - Buffer.byteLength(buildTemplateCompileSystemPrompt(v3))).toBe(73);
    expect(Buffer.byteLength(JSON.stringify(TEMPLATE_DRAFT_JSON_SCHEMA)) - Buffer.byteLength(JSON.stringify(actionSchemaForCatalog(TEMPLATE_DRAFT_JSON_SCHEMA, v3)))).toBe(7);
  });
  it('isolates interleaved policy projections and rejects unknown policies or future schema shapes', async () => {
    const results = await Promise.all([v3, v4, v3, v4].map(async (version) => {
      const schema = actionSchemasForCatalog({ draft: TEMPLATE_DRAFT_JSON_SCHEMA }, version);
      await Promise.resolve();
      return JSON.stringify(schema).includes('"runs"');
    }));
    expect(results).toEqual([false, true, false, true]);
    expect(() => actionSchemaForCatalog(TEMPLATE_DRAFT_JSON_SCHEMA, 'catalog/unknown' as ActionSemanticCatalogVersion)).toThrow('action_semantic_catalog_version_unsupported');
    expect(() => actionSchemaForCatalog({ enum: ['runs'] }, v3)).toThrow('legacy_catalog_schema_shape_changed');
  });
});
