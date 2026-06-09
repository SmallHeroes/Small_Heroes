/**
 * Phase 2 human-read report.
 */

import type { PageBeatV3, StorySpineV3, StructureHardFail } from './types';

export function buildPhase2Report(args: {
  runDir: string;
  premiseId: string;
  spine: StorySpineV3;
  beats: PageBeatV3[];
  spineHardFails: StructureHardFail[];
  beatHardFails: StructureHardFail[];
}): string {
  const popcornHits = args.beats.filter((b) =>
    /פופקורן|גרעין|קערה|מגבת|אף/i.test(JSON.stringify(b))
  ).length;

  const checklist = [
    ['Popcorn hook alive', /אש|גרעין|פופקורן/i.test(args.spine.oneLineHook)],
    ['Child want child-owned', /הבטיח|בפעם הראשונה|ערב סרט/i.test(args.spine.childWant)],
    ['First try-fail (lid/cover)', /מכסה|כיסוי|ענן/i.test(args.spine.firstTryFail)],
    ['Second try-fail (wing roof)', /כנף|שולחן|על האף/i.test(args.spine.secondTryFail)],
    ['Discovery physical (towel/wind)', /מגבת|רוח|נוחתים בשקט/i.test(args.spine.childDiscovery)],
    ['Child owns brave action', /מגבת|מפרש|מנהרת/i.test(args.spine.braveChildAction)],
    ['Payoff visible release', /גשם|קשת|עוד סרט|על האף/i.test(args.spine.bigReleasePayoff)],
    ['Avoids generic template', !/עטיפה\/החזקה מדי|צריך מרחב/i.test(JSON.stringify(args.spine))],
  ];

  return [
    '# Generator-v3 Sprint A — Phase 2 Report',
    '',
    `**Premise:** ${args.premiseId} (hardened popcorn arc)`,
    `**Pages:** ${args.beats.length}`,
    `**Artifacts:** \`${args.runDir}\``,
    '',
    '## Machine structure checks (advisory)',
    '',
    `- Spine hard-fails: **${args.spineHardFails.length}**${args.spineHardFails.length ? ` — ${args.spineHardFails.map((f) => f.code).join(', ')}` : ''}`,
    `- Beat hard-fails: **${args.beatHardFails.length}**${args.beatHardFails.length ? ` (see structure-validation.json)` : ''}`,
    `- Beats with popcorn anchors: **${popcornHits}/${args.beats.length}**`,
    '',
    '## Locked arc summary',
    '',
    `**Hook:** ${args.spine.oneLineHook}`,
    `**Child want:** ${args.spine.childWant}`,
    `**First fail:** ${args.spine.firstTryFail.slice(0, 120)}…`,
    `**Second fail:** ${args.spine.secondTryFail.slice(0, 120)}…`,
    `**Discovery:** ${args.spine.childDiscovery}`,
    `**Brave action:** ${args.spine.braveChildAction}`,
    `**Payoff:** ${args.spine.bigReleasePayoff}`,
    '',
    '## Human-read checklist',
    '',
    ...checklist.map(([label, ok]) => `- [ ] ${label}: **${ok ? 'likely yes (machine)' : 'CHECK'}**`),
    '',
    '**Make-or-break:** Does the ARC feel popcorn-specific, or did it inherit generic "Dini wraps → air gap"?',
    '',
    '- [ ] PASS → Sprint B planning (prose + humor weaving)',
    '- [ ] FAIL → repair spine/beats before any prose',
    '',
    '## Page beat summary',
    '',
    ...args.beats.map(
      (b) =>
        `### p${b.page}\n- **event:** ${b.event}\n- **child:** ${b.childDoes}\n- **companion:** ${b.companionDoes ?? '—'}\n- **changes:** ${b.whatChanges}\n- **visual:** ${b.visualAnchor}`
    ),
    '',
    '---',
    '**HARD STOP — no prose. No production. No bank write.**',
  ].join('\n');
}
