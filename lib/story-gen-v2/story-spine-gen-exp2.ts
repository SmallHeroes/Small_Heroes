/**
 * Exp2 — StorySpine with Dini fantasy child-led guardrails.
 */

import { OpenAIResponsesLLM, parseJsonFromLLM } from '../story-generator/llm';
import { buildCompanionContextBlock } from '../story-gen/companion-context';
import type { ExperimentSpecV2, GoldenStoryDNA, StorySpineV2 } from './types';

const SPINE_EXP2_SYSTEM = `You design the event engine of a children's fantasy story. You are NOT writing prose.
A beautiful mood is not a story. A page is valid only if something changes.
The CHILD must CAUSE the story — not Dini, not baby dragon, not magic alone.

HARD GUARDRAILS (Dini fantasy Exp2):
- The child's desire/problem is central — NOT Dini's egg, NOT baby dragon's arc as protagonist.
- Mandatory child try-fail: child wants X, tries Y, Y fails from concrete obstacle on child's action.
- Child owns climax: child discovery → child brave action → visible world release/payoff.
- Dini may misread, overprotect, joke, fail physically — but supports child's arc.
- Baby dragon may appear as story element — child changes outcome, not creature solving alone.
- Payoff must be visible release (something moves/opens/changes) — not calm understanding only.
- Do NOT copy golden egg/nest/hug-card plot.

Return ONLY valid JSON matching StorySpineV2.
oneSentenceEventChain: desire → try/fail → companion misread → child discovery → brave child action → world response (release) → residue.`.trim();

export async function generateStorySpineExp2(args: {
  dna: GoldenStoryDNA;
  spec: ExperimentSpecV2;
  modelId: string;
}): Promise<{ spine: StorySpineV2; inputTokens: number; outputTokens: number }> {
  const companionBlock = buildCompanionContextBlock(args.spec.companionId);

  const userPrompt = `
Companion profile:
${companionBlock}

GOLDEN EVENT DNA (structural template only — do NOT copy golden plot/props):
${JSON.stringify(
    {
      childDesire: args.dna.childDesire,
      entryBarrier: args.dna.entryBarrier,
      firstTry: args.dna.firstTry,
      firstTryFailsBecause: args.dna.firstTryFailsBecause,
      companionComicMistake: args.dna.companionComicMistake,
      companionVulnerability: args.dna.companionVulnerability,
      childNotices: args.dna.childNotices,
      childInvents: args.dna.childInvents,
      braveAction: args.dna.braveAction,
      worldResponse: args.dna.worldResponse,
      residue: args.dna.residue,
    },
    null,
    2
  )}

NEW STORY CONSTRAINTS (must use — different plot from golden):
- setting: ${args.spec.setting}
- game/play: ${args.spec.gameOrPlayPattern}
- key object: ${args.spec.keyObject}
- entry: ${args.spec.entryMethod}
- final child action: ${args.spec.finalChildAction}
- theme: ${args.spec.resilienceTheme}
- pages: ${args.spec.pageCount}
- direction: ${args.spec.direction}

FORBIDDEN:
${args.spec.forbidPlotCopy.map((f) => `- ${f}`).join('\n')}

payoff MUST describe visible release after child's brave action (group joins, path opens, creature reacts, game changes).
emotionalResidue may be quiet but payoff must feel like a WIN for the child.

Return StorySpineV2 JSON. titleSeed includes {{childName}}. companionId=${args.spec.companionId}.`.trim();

  const llm = new OpenAIResponsesLLM(args.modelId);
  const result = await llm.call({
    stage: 'v2-story-spine-exp2',
    systemPrompt: SPINE_EXP2_SYSTEM,
    userPrompt,
    jsonMode: true,
    maxOutputTokens: 4096,
    temperature: 0.65,
  });

  const raw = parseJsonFromLLM<StorySpineV2 & { storySpineV2?: Partial<StorySpineV2> }>(
    result.text,
    'v2-story-spine-exp2'
  );
  const spine = normalizeStorySpine(raw, args.spec);
  return { spine, inputTokens: result.inputTokens, outputTokens: result.outputTokens };
}

type NestedSpineAliases = Partial<StorySpineV2> & {
  childDesire?: string;
  entryBarrier?: string;
  firstTry?: string;
  firstTryFailsBecause?: string;
  companionComicMistake?: string;
  childNotices?: string;
  childInvents?: string;
  braveAction?: string;
  worldResponse?: string;
  residue?: string;
};

function normalizeStorySpine(
  raw: StorySpineV2 & { storySpineV2?: NestedSpineAliases },
  spec: ExperimentSpecV2
): StorySpineV2 {
  const nested: NestedSpineAliases = raw.storySpineV2 ?? {};
  const pick = (key: keyof StorySpineV2): string => {
    const top = raw[key];
    const inner = nested[key as keyof typeof nested];
    if (typeof top === 'string' && top.trim().length >= 8) return top.trim();
    if (typeof inner === 'string' && inner.trim().length >= 8) return inner.trim();
    return '';
  };

  const chain = pick('oneSentenceEventChain');
  const fromChain = parseEventChain(chain);

  const protagonistWant =
    pick('protagonistWant') || nested.childDesire?.trim() || fromChain.protagonistWant || '';
  const firstAttempt = pick('firstAttempt') || nested.firstTry?.trim() || fromChain.firstAttempt || '';
  const firstAttemptFailsBecause =
    pick('firstAttemptFailsBecause') ||
    nested.firstTryFailsBecause?.trim() ||
    fromChain.firstAttemptFailsBecause ||
    '';
  const childDiscovery =
    pick('childDiscovery') || nested.childNotices?.trim() || fromChain.childDiscovery || '';
  const childPlan = pick('childPlan') || nested.childInvents?.trim() || fromChain.childPlan || '';
  const childBraveAction =
    pick('childBraveAction') || nested.braveAction?.trim() || fromChain.childBraveAction || '';
  const payoff = pick('payoff') || nested.worldResponse?.trim() || fromChain.payoff || '';

  return {
    titleSeed: pick('titleSeed') || `{{childName}} ודִּינִי — ${spec.resilienceTheme}`,
    direction: spec.direction,
    companionId: spec.companionId,
    resilienceTheme: pick('resilienceTheme') || spec.resilienceTheme,
    protagonistWant,
    visibleProblem:
      pick('visibleProblem') || nested.entryBarrier?.trim() || fromChain.visibleProblem || spec.setting,
    firstAttempt,
    firstAttemptFailsBecause,
    secondComplication: pick('secondComplication') || fromChain.secondComplication || '',
    companionMisread:
      pick('companionMisread') || nested.companionComicMistake?.trim() || fromChain.companionMisread || '',
    companionVulnerability:
      pick('companionVulnerability') || nested.companionVulnerability?.trim() || undefined,
    childDiscovery,
    childPlan,
    childBraveAction,
    climaxChoice: pick('climaxChoice') || childBraveAction,
    payoff,
    emotionalResidue:
      pick('emotionalResidue') || nested.residue?.trim() || fromChain.emotionalResidue || '',
    oneSentenceEventChain: chain,
  };
}

function parseEventChain(chain: string): Partial<StorySpineV2> {
  if (!chain?.trim()) return {};
  const parts = chain.split(/→|->/).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 5) return {};

  const tryFail = parts[1] ?? '';
  return {
    protagonistWant: parts[0],
    firstAttempt: tryFail,
    firstAttemptFailsBecause: tryFail,
    companionMisread: parts[2],
    childDiscovery: parts[3],
    childPlan: parts[3],
    childBraveAction: parts[4],
    climaxChoice: parts[4],
    payoff: parts[5] ?? parts[4],
    emotionalResidue: parts[6] ?? parts[parts.length - 1],
  };
}
