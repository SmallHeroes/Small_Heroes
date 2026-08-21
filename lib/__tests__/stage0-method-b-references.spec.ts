import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildStage0DescriptionTemplatePrompt,
  buildStage0DescriptionTemplateReferences,
  buildStage0MethodBReferences,
  buildStage0MethodBPrompt,
  sanitizeStage0AnchorIdentityText,
  shouldGenerateStage0DescriptionTemplateAnchor,
  stage0DescriptionTemplateCandidatePassesQa,
  type Stage0MethodBReferenceLayout,
} from '../generation-pipeline/stage0-method-b';
import { STYLE_01_CHILD_PHOTO_IDENTITY_RULE } from '../style01-gptimage';
import {
  LION_BEDTIME_BAR_CHILD_PHOTO_DESCRIPTION,
  LION_BEDTIME_BAR_LOCKED_CHILD_DESCRIPTION,
} from '../generation-pipeline/stage0-resemblance-experiment';
import {
  buildStage0DescriptionTemplateQaDiagnostics,
  formatStage0DescriptionTemplateQaBudgetFailure,
  sanitizeStage0StyleQaNotes,
  stage0DescriptionTemplateQaDiagnosticsIsValid,
  summarizeStage0DescriptionTemplateQaReasons,
} from '../generation-pipeline/stage0-qa-diagnostics';

describe('Stage0 Method B reference layouts (Brief F)', () => {
  const photo = '/tmp/bar.jpg';

  it('production default is photo + style refs only (no boy.png template)', () => {
    const refs = buildStage0MethodBReferences({
      childPhotoUrl: photo,
      childGender: 'boy',
    });
    expect(refs.layout).toBe('photo_only_no_template');
    expect(refs.referenceMode).toBe('anchor_photo_style_only');
    expect(refs.labels[0]).toBe('raw_child_photo');
    expect(refs.labels.join(' ')).not.toContain('style01_child_template');
    expect(refs.paths[0]).toBe(photo);
    expect(refs.paths.some((p) => p.endsWith('boy.png'))).toBe(false);
  });

  it('legacy template_first_photo_last layout still available', () => {
    const refs = buildStage0MethodBReferences({
      childPhotoUrl: photo,
      childGender: 'boy',
      layout: 'template_first_photo_last',
    });
    expect(refs.layout).toBe('template_first_photo_last');
    expect(refs.referenceMode).toBe('anchor_template_photo_last');
    expect(refs.labels[0]).toBe('style01_child_template');
    expect(refs.labels[refs.labels.length - 1]).toBe('raw_child_photo');
  });

  it('photo_first_with_template puts raw photo first (variant A)', () => {
    const refs = buildStage0MethodBReferences({
      childPhotoUrl: photo,
      childGender: 'boy',
      layout: 'photo_first_with_template',
    });
    expect(refs.referenceMode).toBe('anchor_photo_template_middle');
    expect(refs.labels[0]).toBe('raw_child_photo');
    expect(refs.labels[1]).toBe('style01_child_template');
    expect(refs.paths[0]).toBe(photo);
  });

  it('photo_only_no_template drops boy.png (variant B)', () => {
    const refs = buildStage0MethodBReferences({
      childPhotoUrl: photo,
      childGender: 'boy',
      layout: 'photo_only_no_template',
    });
    expect(refs.referenceMode).toBe('anchor_photo_style_only');
    expect(refs.labels[0]).toBe('raw_child_photo');
    expect(refs.labels.join(' ')).not.toContain('style01_child_template');
    expect(refs.paths[0]).toBe(photo);
    expect(refs.paths.some((p) => p.endsWith('boy.png'))).toBe(false);
  });

  it('builds the no-photo authority from one approved child template plus character-free style refs', () => {
    const refs = buildStage0DescriptionTemplateReferences({ childGender: 'boy' });
    expect(refs.referenceMode).toBe('anchor_template');
    expect(refs.labels[0]).toBe('style01_child_template');
    expect(refs.paths[0].replace(/\\/g, '/')).toMatch(/style-references\/01-child-template\/boy\.png$/);
    expect(refs.labels).not.toContain('raw_child_photo');
    expect(refs.paths).toHaveLength(refs.labels.length);
    expect(refs.labels.slice(1).every((label) => /^style01_ref_\d$/.test(label))).toBe(true);
  });

  it('keeps the no-photo prompt bound to story DNA and wardrobe without photo-likeness claims', () => {
    const prompt = buildStage0DescriptionTemplatePrompt({
      order: { childGender: 'boy', childAge: 5 },
      lockedChildDescription: 'Short curly black hair, warm brown skin, dark eyes.',
      wardrobeLock: 'BOOK WARDROBE LOCK: teal pajamas with small moon shapes.',
    });
    expect(prompt).toContain('DESCRIPTION-DEFINED STORYBOOK CHILD');
    expect(prompt).toContain('Short curly black hair');
    expect(prompt).toContain('teal pajamas');
    expect(prompt).toContain('5-year-old kindergarten-age boy');
    expect(prompt).not.toContain(STYLE_01_CHILD_PHOTO_IDENTITY_RULE);
    expect(prompt).not.toMatch(/PHOTO IDENTITY|raw child photo|resemblance|likeness/i);
  });

  it('selects the no-photo generator only for a missing Style 01 child anchor', () => {
    expect(shouldGenerateStage0DescriptionTemplateAnchor({
      hasExistingChildAnchor: false,
      childImageUrl: null,
      orderStyleBranch: 'style01',
    })).toBe(true);
    expect(shouldGenerateStage0DescriptionTemplateAnchor({
      hasExistingChildAnchor: true,
      childImageUrl: null,
      orderStyleBranch: 'style01',
    })).toBe(false);
    expect(shouldGenerateStage0DescriptionTemplateAnchor({
      hasExistingChildAnchor: false,
      childImageUrl: 'https://example.test/child.png',
      orderStyleBranch: 'style01',
    })).toBe(false);
    expect(shouldGenerateStage0DescriptionTemplateAnchor({
      hasExistingChildAnchor: false,
      childImageUrl: null,
      orderStyleBranch: 'style02',
    })).toBe(false);
  });

  it('requires both semantic and style QA for a no-photo candidate', () => {
    const result = (semantic: boolean, style: boolean) => ({
      anchorVisionDescription: 'A five-year-old child.',
      semantic: { ok: semantic },
      styleQa: { ok: style, notes: 'Authoritative visual QA result.' },
    }) as Parameters<typeof stage0DescriptionTemplateCandidatePassesQa>[0];
    expect(stage0DescriptionTemplateCandidatePassesQa(result(true, true))).toBe(true);
    expect(stage0DescriptionTemplateCandidatePassesQa(result(false, true))).toBe(false);
    expect(stage0DescriptionTemplateCandidatePassesQa(result(true, false))).toBe(false);
    expect(stage0DescriptionTemplateCandidatePassesQa(result(false, false))).toBe(false);
    expect(stage0DescriptionTemplateCandidatePassesQa({
      ...result(true, true),
      anchorVisionDescription: null,
    })).toBe(false);
    expect(stage0DescriptionTemplateCandidatePassesQa({
      ...result(true, true),
      styleQa: { ok: true, notes: 'OPENAI_API_KEY missing — style vision QA skipped' },
    } as Parameters<typeof stage0DescriptionTemplateCandidatePassesQa>[0])).toBe(false);
  });

  it('persists closed ordered no-photo QA reasons and sanitized bounded style evidence', () => {
    const diagnostics = buildStage0DescriptionTemplateQaDiagnostics({
      anchorVisionDescription: 'A child with short brown hair.',
      semantic: {
        genderMismatch: true,
        missingHairTraits: ['wavy'],
        faceDetectOk: false,
      },
      styleQa: {
        style01Match: false,
        looksPhotoreal: true,
        looksPortrait: true,
        notes:
          '  Too glossy\u0000; see https://example.test/private and user@example.test.  ',
      },
    });

    expect(diagnostics).toEqual({
      version: 'stage0-description-template-candidate-qa/v1',
      reasonCodes: [
        'gender_mismatch',
        'hair_trait_missing',
        'face_detect_low',
        'style_mismatch',
        'style_photoreal',
        'style_portrait',
      ],
      styleNotes: 'Too glossy; see [redacted] and [redacted].',
    });
    expect(stage0DescriptionTemplateQaDiagnosticsIsValid(diagnostics)).toBe(true);
    expect(JSON.stringify(diagnostics)).not.toContain('example.test');
  });

  it('keeps unavailable evidence distinct and rejects malformed diagnostic authority', () => {
    const diagnostics = buildStage0DescriptionTemplateQaDiagnostics({
      anchorVisionDescription: null,
      semantic: {
        genderMismatch: false,
        missingHairTraits: [],
        faceDetectOk: true,
      },
      styleQa: {
        style01Match: true,
        looksPhotoreal: false,
        looksPortrait: false,
        notes: 'style QA HTTP 503 — skipped',
      },
    });
    expect(diagnostics.reasonCodes).toEqual([
      'vision_description_missing',
      'style_evidence_unavailable',
    ]);
    expect(summarizeStage0DescriptionTemplateQaReasons([diagnostics, diagnostics])).toEqual(
      diagnostics.reasonCodes
    );
    expect(formatStage0DescriptionTemplateQaBudgetFailure({
      diagnostics: [diagnostics],
      attemptsUsed: 1,
      maxAttempts: 1,
    })).toBe(
      'ANCHOR_QA_BLOCK: description-template child anchor did not pass semantic and style QA ' +
      'within the bounded attempt budget (attempts=1/1 ' +
      'reasonCodes=vision_description_missing|style_evidence_unavailable)'
    );

    expect(stage0DescriptionTemplateQaDiagnosticsIsValid({
      ...diagnostics,
      extra: true,
    })).toBe(false);
    expect(stage0DescriptionTemplateQaDiagnosticsIsValid({
      ...diagnostics,
      reasonCodes: [...diagnostics.reasonCodes].reverse(),
    })).toBe(false);
    expect(stage0DescriptionTemplateQaDiagnosticsIsValid({
      ...diagnostics,
      styleNotes: ' unsanitized ',
    })).toBe(false);
  });

  it('caps sanitized style notes and redacts secret-like tokens', () => {
    const sanitized = sanitizeStage0StyleQaNotes(
      `api-1234567890 ${'x'.repeat(400)}`
    );
    expect(sanitized).not.toContain('api-1234567890');
    expect(Array.from(sanitized ?? '')).toHaveLength(240);
  });

  it('Bar corrected identity has olive/tan skin — not pale, no toddler-pushing softness', () => {
    expect(LION_BEDTIME_BAR_CHILD_PHOTO_DESCRIPTION).toMatch(/olive/i);
    expect(LION_BEDTIME_BAR_CHILD_PHOTO_DESCRIPTION).toMatch(/NOT pale/i);
    expect(LION_BEDTIME_BAR_CHILD_PHOTO_DESCRIPTION).not.toMatch(/\bwarm pale\b/i);
    expect(LION_BEDTIME_BAR_CHILD_PHOTO_DESCRIPTION).not.toMatch(/young-child softness/i);
    expect(LION_BEDTIME_BAR_CHILD_PHOTO_DESCRIPTION).toMatch(/prominent cheeks/i);
    expect(LION_BEDTIME_BAR_CHILD_PHOTO_DESCRIPTION).toMatch(/round face/i);
    expect(LION_BEDTIME_BAR_LOCKED_CHILD_DESCRIPTION).not.toMatch(/t-shirt|denim|sneaker/i);
  });

  it('buildStage0MethodBPrompt enforces kindergarten-age 5 — not toddler, not 7–8', () => {
    const prompt = buildStage0MethodBPrompt({
      order: { childGender: 'boy', childAge: 5 },
      lockedChildDescription: 'Round face with prominent cheeks. Warm olive skin.',
    });
    expect(prompt).toMatch(/5-year-old kindergarten-age boy/i);
    expect(prompt).toMatch(/NOT a toddler/i);
    expect(prompt).toMatch(/NOT a baby/i);
    expect(prompt).toMatch(/Do NOT make him look 7–8 or older/i);
    expect(prompt).toMatch(/ANTI-TODDLER/i);
    expect(prompt).toMatch(/NOT baby cheeks/i);
    expect(prompt).not.toMatch(/MUST read clearly as a boy of about 5/i);
  });

  it('sanitizeStage0AnchorIdentityText strips toddler phrasing but keeps cheeks', () => {
    const cleaned = sanitizeStage0AnchorIdentityText(
      'Round face with prominent cheeks and young-child softness. Large eyes and a broad open smile.'
    );
    expect(cleaned).not.toMatch(/young-child softness/i);
    expect(cleaned).not.toMatch(/smile|open mouth/i);
    expect(cleaned).toMatch(/prominent cheeks/i);
    expect(cleaned).toMatch(/Round face/i);
  });

  it('buildStage0MethodBPrompt separates reusable identity/style from photographed expression', () => {
    const prompt = buildStage0MethodBPrompt({
      order: { childGender: 'boy', childAge: 5 },
      lockedChildDescription:
        'Round-oval face, warm olive skin, dense dark curls, recognisable broad open smile.',
      childPhotoDescription: 'Brown eyes, open mouth, cheerful expression, thick brows.',
    });
    expect(prompt).toContain('ANCHOR EXPRESSION (mandatory)');
    expect(prompt).toContain('lips naturally closed');
    expect(prompt).toContain('ANCHOR STYLE FIDELITY (mandatory)');
    expect(prompt).toContain('refined semi-naturalistic Style 01 watercolor');
    expect(prompt).not.toMatch(/recognisable broad open smile/i);
    expect(prompt).not.toMatch(/PHOTO IDENTITY CUES[^\n]*open mouth/i);
    expect(prompt).toContain('Round-oval face');
    expect(prompt).toContain('dense dark curls');
  });

  it('keeps shared anchor prefixes child-agnostic and semi-naturalistic', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'lib', 'generate-image.ts'), 'utf8');
    expect(source).not.toMatch(/Mia identity|bird-print pajamas|green left wrist bracelet/);
    expect(source).not.toMatch(/Render as cute simplified Style 01 watercolor child/);
    expect(source).toContain('refined semi-naturalistic Style 01 watercolor child');
    expect(source).toContain('preserve the exact child identity');
  });

  it('keeps all identity-neutral Style 01 template generators on the same fidelity target', () => {
    for (const relativePath of [
      ['scripts', 'generate-style01-child-template.ts'],
      ['scripts', 'generate-child-template-redo.ts'],
    ]) {
      const source = fs.readFileSync(path.join(process.cwd(), ...relativePath), 'utf8');
      expect(source).not.toMatch(/cute simplified/i);
      expect(source).toContain('STYLE_01_CHILD_TEMPLATE_STYLE_RULE');
    }
  });
});
