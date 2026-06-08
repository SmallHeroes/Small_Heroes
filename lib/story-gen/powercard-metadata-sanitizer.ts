/**
 * Metadata / powerCard sanitizer — non-literary, runs after rewrite, before validation.
 * Fixes companion-anatomy leaks on child-facing powerCard steps and label leaks in metadata.
 */

function stripHebrewDiacritics(text: string): string {
  return text.replace(/[\u0591-\u05C7\u05F3\u05F4]/g, '');
}

export interface PowerCardSanitizerHit {
  field: 'powerCard.steps' | 'powerCard.companionReminder' | 'metadata' | 'worldRule' | 'title';
  stepIndex?: number;
  token: string;
  reason:
    | 'companion_anatomy_on_child_step'
    | 'child_tool_matches_companion_reminder'
    | 'label_leak'
    | 'identical_gender_chip';
  context: string;
  autoFixed: boolean;
}

export interface PowerCardSanitizerReport {
  status: 'deterministic_sanitize';
  companionId: string;
  hits: PowerCardSanitizerHit[];
  fixes: Array<{ field: string; before: string; after: string; reason: string }>;
  hitCount: number;
  fixCount: number;
  advisoryFail: boolean;
}

const LABEL_LEAK_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /too[\s‑-]?SHUT/gi, reason: 'label_leak' },
  { pattern: /tooSHUT/gi, reason: 'label_leak' },
];

/** Deterministic step replacements (exact known bad strings). */
const KNOWN_STEP_REPLACEMENTS: Array<{
  pattern: RegExp;
  replacement: string;
  reason: string;
}> = [
  {
    pattern: /נוֹשֵׁף\/ת קְטַנָּה מֵהַחָדָק/g,
    replacement: '"{נושם|נושמת} נשיפה קטנה מהאף"',
    reason: 'elephant_child_trunk_step',
  },
  {
    pattern: /נושף\/ת קטנה מהחדק/g,
    replacement: '"{נושם|נושמת} נשיפה קטנה מהאף"',
    reason: 'elephant_child_trunk_step',
  },
  {
    pattern: /נְשִׁיפָה קטנה דרך החדק \(או האף\)/g,
    replacement: '"{נושם|נושמת} נשיפה קטנה מהאף"',
    reason: 'elephant_child_trunk_step',
  },
  {
    pattern: /נשיפה קטנה דרך החדק/g,
    replacement: '"{נושם|נושמת} נשיפה קטנה מהאף"',
    reason: 'elephant_child_trunk_step',
  },
  {
    pattern: /\{שָׁם\|שָׁםָה\}/g,
    replacement: '{שם|שמה}',
    reason: 'identical_chip_niqqud',
  },
  {
    pattern: /"\s*אני \{שָׁם\|שָׁםָה\} לב/g,
    replacement: '"אני {שם|שמה} לב',
    reason: 'identical_chip_niqqud',
  },
];

function frontmatterBlock(markdown: string): string {
  const idx = markdown.search(/\r?\n--- Page 1 ---/);
  return idx >= 0 ? markdown.slice(0, idx) : markdown;
}

function extractPowerCardSteps(block: string): string[] {
  const stepsBlock = block.match(/steps:[\s\S]*?(?=^\s+\w+:|\n---\s*$)/m)?.[0] ?? '';
  const lines = stepsBlock.match(/^\s+-\s+(.+)$/gm) ?? [];
  return lines.map((l) => l.replace(/^\s+-\s+/, '').trim());
}

function extractCompanionReminder(block: string): string {
  const m = block.match(/companionReminder:\s*(.+)$/m);
  return m?.[1]?.trim() ?? '';
}

function isMetaphoricalShellReference(step: string): boolean {
  const s = stripHebrewDiacritics(step);
  return /לחזור ל?(?:ק)?ליפה|חזור ל?(?:ק)?ליפה|ל?(?:ק)?ליפה.*(?:לא מוחק|מותר|בית)/i.test(s);
}

function scanChildStep(
  companionId: string,
  step: string,
  stepIndex: number,
  companionReminder: string
): PowerCardSanitizerHit[] {
  const hits: PowerCardSanitizerHit[] = [];
  const stripped = stripHebrewDiacritics(step);

  const isElephant =
    companionId === 'baby_elephant' || companionId.includes('elephant');
  const isArmadillo = companionId === 'bolly_armadillo';

  if (isElephant) {
    if (/חדק|חטם|trunk/i.test(stripped) && !/\(או[^)]*\)/.test(step)) {
      hits.push({
        field: 'powerCard.steps',
        stepIndex,
        token: step,
        reason: 'companion_anatomy_on_child_step',
        context: 'Child step must not use trunk (חדק) — use nose/breath',
        autoFixed: false,
      });
    }
    if (/אוזנ(?:י|ות).*פיל|פיל.*אוזנ|כפות.*פיל|פיל.*כפות/i.test(stripped)) {
      hits.push({
        field: 'powerCard.steps',
        stepIndex,
        token: step,
        reason: 'companion_anatomy_on_child_step',
        context: 'Child step must not use elephant-specific body parts',
        autoFixed: false,
      });
    }
    if (/מקפל[^.]*אוזנ|אוזנ[^.]*(?:לחצי|מקפל)/i.test(stripped)) {
      hits.push({
        field: 'powerCard.steps',
        stepIndex,
        token: step,
        reason: 'companion_anatomy_on_child_step',
        context:
          'Child step must not fold companion ears — use child body (hands near ears, listening)',
        autoFixed: false,
      });
    }
  }

  if (/מקפל[^.]*אוזנ|אוזנ[^.]*לחצי/i.test(stripped) && !isElephant) {
    hits.push({
      field: 'powerCard.steps',
      stepIndex,
      token: step,
      reason: 'companion_anatomy_on_child_step',
      context: 'Child step ascribes companion ear-fold action to the child',
      autoFixed: false,
    });
  }

  if (isArmadillo && /קליפה|שריון|shell/i.test(stripped)) {
    if (!isMetaphoricalShellReference(step)) {
      hits.push({
        field: 'powerCard.steps',
        stepIndex,
        token: step,
        reason: 'companion_anatomy_on_child_step',
        context: 'Child step uses shell literally — only metaphorical return-to-shell is OK',
        autoFixed: false,
      });
    }
  }

  if (/חדק|חטם|trunk/i.test(stripped) && !isElephant) {
    hits.push({
      field: 'powerCard.steps',
      stepIndex,
      token: step,
      reason: 'companion_anatomy_on_child_step',
      context: 'Companion trunk anatomy on child step',
      autoFixed: false,
    });
  }

  const stepNorm = stripped.replace(/[{}"']/g, '').trim();
  const reminderNorm = stripHebrewDiacritics(companionReminder)
    .replace(/[{}"']/g, '')
    .trim();
  if (stepNorm.length > 8 && reminderNorm.length > 8) {
    if (stepNorm === reminderNorm || reminderNorm.includes(stepNorm)) {
      hits.push({
        field: 'powerCard.steps',
        stepIndex,
        token: step,
        reason: 'child_tool_matches_companion_reminder',
        context: 'Child powerCard step duplicates companionReminder — tools must differ',
        autoFixed: false,
      });
    }
  }

  const chipMatch = step.match(/\{([^{}|]+)\|([^{}|]+)\}/);
  if (chipMatch && stripHebrewDiacritics(chipMatch[1]) === stripHebrewDiacritics(chipMatch[2])) {
    hits.push({
      field: 'powerCard.steps',
      stepIndex,
      token: chipMatch[0],
      reason: 'identical_gender_chip',
      context: 'Gender chip options are identical after stripping niqqud',
      autoFixed: false,
    });
  }

  return hits;
}

function scanMetadataLabelLeaks(block: string): PowerCardSanitizerHit[] {
  const hits: PowerCardSanitizerHit[] = [];
  for (const { pattern, reason } of LABEL_LEAK_PATTERNS) {
    if (pattern.test(block)) {
      hits.push({
        field: 'metadata',
        token: block.match(pattern)?.[0] ?? 'label_leak',
        reason: 'label_leak',
        context: 'Internal/English label in metadata block',
        autoFixed: false,
      });
      pattern.lastIndex = 0;
    }
  }
  return hits;
}

export function scanPowerCardMetadata(
  markdown: string,
  companionId: string
): PowerCardSanitizerReport {
  const block = frontmatterBlock(markdown);
  const steps = extractPowerCardSteps(block);
  const reminder = extractCompanionReminder(block);
  const hits: PowerCardSanitizerHit[] = [...scanMetadataLabelLeaks(block)];

  steps.forEach((step, i) => {
    hits.push(...scanChildStep(companionId, step, i, reminder));
  });

  return {
    status: 'deterministic_sanitize',
    companionId,
    hits,
    fixes: [],
    hitCount: hits.length,
    fixCount: 0,
    advisoryFail: hits.some((h) => !h.autoFixed),
  };
}

function applyStepReplacementsInBlock(block: string): {
  block: string;
  fixes: PowerCardSanitizerReport['fixes'];
} {
  let out = block;
  const fixes: PowerCardSanitizerReport['fixes'] = [];
  for (const { pattern, replacement, reason } of KNOWN_STEP_REPLACEMENTS) {
    const before = out;
    out = out.replace(pattern, replacement);
    if (out !== before) {
      fixes.push({
        field: 'powerCard.steps',
        before: before.match(pattern)?.[0] ?? pattern.source,
        after: replacement.replace(/^"|"$/g, ''),
        reason,
      });
    }
  }
  return { block: out, fixes };
}

/** Strip leftover parentheticals after anatomy replacement on child-facing steps. */
function stripSanitizedStepParentheticals(block: string): {
  block: string;
  fixes: PowerCardSanitizerReport['fixes'];
} {
  let out = block;
  const fixes: PowerCardSanitizerReport['fixes'] = [];

  const stepLineRe = /^(\s+-\s+)(.+)$/gm;
  out = out.replace(stepLineRe, (full, prefix: string, stepContent: string) => {
    let step = stepContent.trim();
    const before = step;

    step = step.replace(/\s*\(או[^)]*\)/g, '');
    step = step.replace(/"\s*\(או[^)]*\)"/g, '"');
    step = step.replace(/(\{[^}]+\}[^"(]*?)\s*\(או[^)]*\)/g, '$1');

    if (step !== before) {
      fixes.push({
        field: 'powerCard.steps',
        before,
        after: step,
        reason: 'parenthetical_residue',
      });
      return `${prefix}${step}`;
    }
    return full;
  });

  return { block: out, fixes };
}

function removeLabelLeaks(block: string): { block: string; fixes: PowerCardSanitizerReport['fixes'] } {
  let out = block;
  const fixes: PowerCardSanitizerReport['fixes'] = [];
  for (const { pattern } of LABEL_LEAK_PATTERNS) {
    const m = out.match(pattern);
    if (m) {
      out = out.replace(pattern, 'סגור מדי');
      fixes.push({
        field: 'metadata',
        before: m[0],
        after: 'סגור מדי',
        reason: 'label_leak',
      });
    }
  }
  return { block: out, fixes };
}

export function sanitizePowerCardMetadata(args: {
  storyMarkdown: string;
  companionId: string;
}): { markdown: string; report: PowerCardSanitizerReport } {
  const prefix = frontmatterBlock(args.storyMarkdown);
  const suffixMatch = args.storyMarkdown.match(/(\r?\n--- Page 1 ---[\s\S]*)$/);
  const suffix = suffixMatch?.[1] ?? '';

  let block = prefix;
  const allFixes: PowerCardSanitizerReport['fixes'] = [];

  const labelResult = removeLabelLeaks(block);
  block = labelResult.block;
  allFixes.push(...labelResult.fixes);

  const stepResult = applyStepReplacementsInBlock(block);
  block = stepResult.block;
  allFixes.push(...stepResult.fixes);

  const residueResult = stripSanitizedStepParentheticals(block);
  block = residueResult.block;
  allFixes.push(...residueResult.fixes);

  const markdown = block.trimEnd() + suffix;
  const scanAfter = scanPowerCardMetadata(markdown, args.companionId);

  for (const fix of allFixes) {
    scanAfter.fixes.push(fix);
  }
  scanAfter.fixCount = allFixes.length;
  scanAfter.advisoryFail = scanAfter.hits.length > 0;

  for (const hit of scanAfter.hits) {
    const fixed = allFixes.some(
      (f) =>
        hit.reason === 'companion_anatomy_on_child_step' &&
        f.reason === 'elephant_child_trunk_step' &&
        hit.stepIndex != null
    );
    if (fixed || hit.reason === 'identical_gender_chip') {
      hit.autoFixed = allFixes.some((f) => f.reason.includes('chip') || f.reason.includes('trunk'));
    }
  }

  if (allFixes.length > 0) {
    const rescan = scanPowerCardMetadata(markdown, args.companionId);
    scanAfter.hits = rescan.hits;
    scanAfter.hitCount = rescan.hitCount;
    scanAfter.advisoryFail = rescan.hitCount > 0;
    scanAfter.fixes = allFixes;
    scanAfter.fixCount = allFixes.length;
  }

  return { markdown, report: scanAfter };
}
