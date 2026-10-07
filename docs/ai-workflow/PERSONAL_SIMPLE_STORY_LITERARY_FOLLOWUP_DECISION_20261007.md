# Simple story engine — literary follow-up Decision Gate (2026-10-07)

Status: local prompt milestone, approved by Guy through Codex's brief. Claude Code implements; Codex runs independent QA.
This is an explicit exception to the default AGENTS role split, as Guy set for this task. No self-awarded PASS.

- Worktree: `C:/Users/guyna/.codex/worktrees/simple-story-literary-followup/Small_Heroes`
- Branch: `codex/claude-simple-story-literary-20261007`
- Base: `0a84528584f4424878d62bd379af7e0f42805a38` (technical HOLD fixes `ebd6cb03..0a845285`, not yet PASS by Codex)
- Literary review range: `0a845285..HEAD`, kept separate from the technical range.
- Not touched: `claude/simple-story-engine-20261007`, the original evidence root, saved books, wizard, production paths.

## Observed (read-only evidence, run-r4)

`tom4-fun-momo-8-v2` (age 4, no theme) and `itai8-confidence-leo-12-v2` (age 8, confidence) are good stories with real plot
variety. Codex's reading holds against the saved drafts and edits:

1. Both books contain the clue-spotting line "saw what nobody saw" (Momo p6, Itai p7), and in both the companion offers to do the
   child's part ("shall I trumpet for them?", "can I roar at her?").
2. The no-theme book invents a voice fear for Tom (p6, "his voice felt small as a shell"). The brief has no difficulty.
3. Itai's parent fact is "thinks he is not good at anything and is afraid to try new things". The draft adds specific history the
   brief never gave: "I always fall" (stairs, p3) and "I never catch, the ball always gets away" (p9). The theme returns as a test on
   pages 3, 5, 9 and 10. Page 1 ("Lego I know, everything else, I'm not good at") is grounded in the fact and is fine.
4. Recurring stock body images: spaghetti knees, jelly legs, words stuck in the throat like gum.
5. The ice cream vendor chases his cart (Momo p3), laughs on p7 and is never seen getting it back. That thread was opened and not
   closed.
6. The editor kept all of 1 to 5 (they are in the drafts), but it did make useful changes. It set up the bagel hole and replaced an
   ending summary with a concrete image. Those changes must be kept.

## Diagnosis (code-based hypotheses, not proven cause)

The author prompt asks for exactly these things:
- "the child noticing what the grown-ups or creatures miss", listed under comic craft.
- "Still give the child a moment of hesitation or a real choice" with no theme. The schema also requires at least one
  resilienceMoment ("a hesitation or a real choice"), so a fun book is pushed to invent a fear.
- "a final smile that echoes something from earlier" and "a running gag ... returns with a twist at the end", which nudges every
  ending toward the same callback.
- "Show feelings through a fresh, specific image", plus an editor example about a tummy, which pushes toward body similes.
- Nothing separates an in-story reaction from an invented biography, and nothing tells the editor to check opened threads.

## Change (smallest general one, prompt text and field descriptions only)

Author:
- Remove the clue-spotting line from the comic list and drop "at the end" from the running gag.
- Hero: the child's influence can take many forms (starting, improvising, persuading, teaming up, changing the plan or the goal).
  Spotting a clue is one of them, and nobody needs to announce it. The companion does not keep offering to do the child's part.
- Age: fit voice, humour, complexity and situations to the age, not only length.
- Facts: no invented habits, weaknesses or history. A reaction in the moment is fine; a claim about who the child always is is not.
- Theme: not every scene is a test.
- No theme: no invented fear or hesitation. A natural choice or a funny tangle the child gets out of is enough.
- Ending: warm and complete. It can echo something from earlier or close on something new.
- Feelings: mostly through action and words. Use a comparison only when it belongs to this story.

Editor:
- Keep the author's voice and best jokes.
- Check cause and effect, time and place, and consistent behaviour.
- Close threads that matter; small props do not need closing.
- The big moment rests on behaviour the listener has seen, with no magic-rule lecture needed.
- The child's part is not taken by the companion. No invented biography. No added fear when there is no theme.
- Stock body comparisons get replaced.

Schema: only the `resilienceMoments` / `whatHelps` descriptions change. Shape, min(1), max(4) and the downstream
`personalStoryPlanSchema` stay as they are, so there is no migration.

Unchanged: `SIMPLE_STORY_ENGINE_VERSION` (it seeds the shape pick, so a comparison run keeps the same shapes for the same seeds),
the two-call flow, hard/soft checks, name/dash/parent rules, safety, family rules, freshness list, runner, and token caps.

## Rejected

- Banned-word list for jelly/spaghetti/"nobody saw": it would breed synonyms. No mechanical detector added either. A word-list
  detector says nothing reliable about quality, and Codex already reads the evidence.
- Removing the resilienceMoments minimum for no-theme books: that is a contract migration (`story-contract.ts` min(1)). The
  description change gets the same freedom without one.
- Bumping the engine version: it would re-roll the shapes and confound the comparison. Prompt identity is already recorded as
  call digests in evidence.
- A third model call, a fact memory, Astra, or a new QA layer: no proven failure needs them.
- Editing saved Momo/Itai text: we are improving the engine, not the samples.

## Risks

- Looser no-theme guidance may produce flatter books with no stakes. The comparison must check that.
- The "do not take the child's part" line could make companions passive. The comparison should check companion personality too.
- Prompt tests prove the contract only. Whether the literature improved is unproven until new outputs are read.

## Stop-check

General fix, not a story patch: yes. No production, payments, images, canon or spend. Smallest validation: tsc, the focused
spec, then `npm run check` once. Guy decides separately on any paid comparison. Falsification targets are in the closeout.

## Visual notes for later (not acted on)

- Leo is written as four-legged ("four legs that argue who goes first"), but Guy earlier set a bipedal visual direction.
- Momo lifts Tom while the size ratio is not approved.
- Both need resolving at the storyboard stage. No body, scale or render change is authorized here.
