# Simple story engine: trials and closeout

Date: 2026-10-07 (overnight). Author: Claude Code, implementer for this task.
Engine commit `7c71ff71` on local branch `claude/simple-story-engine-20261007`.
Evidence lives outside the repository, in the Claude scratchpad
`.../scratchpad/simple-engine/` (`run-r1`, `run-r2`). Each case folder holds:

- `prepared.json` (brief, shape, seed, request ID);
- the exact `*-instructions.txt` for each stage;
- `*-wire.json` (digest, bytes, reservation, exact input);
- `*-receipt.json` (CLI output, usage, cost, timing, raw stdout);
- `evidence.json` (draft, draft checks, editor findings, edit, final checks,
  editor changes);
- `result.json` (the contract result);
- `story.md` and `draft.md`.

Profiles are fictional (`*Source: 'fixture'`). No images, audio, push or
deployment. Costs are CLI-reported list-price estimates (Claude Max
list-equivalent), not invoices.

## Round 1: first prompt version, before any commit

This version is preserved verbatim in `run-r1/*/author-instructions.txt` and
`editor-instructions.txt`. The round-2 prompts are the ones in `7c71ff71`,
unchanged in `1aa67f42`, which only adds output headroom and a coded compile
failure.

Eight books, one per profile, covering 7 companions (5 of them not offered in
the wizard yet), ages 4 to 8, lengths 8/12/16, six topics plus one just-for-fun
book, and two Bar seeds for diversity.

| Case | Spine | Pages | Result | USD | Seconds |
|---|---|---|---|---|---|
| bar5 sirens Dini (a) | great_mixup | 8 | OK | 0.402 | 157 |
| bar5 sirens Dini (b) | something_missing | 8 | OK | 0.437 | 172 |
| neta6 sibling Anat | learning_something | 12 | OK | 1.029 | 280 |
| yoav7 losing Nula | just_this_once | 16 | OK | 1.163 | 316 |
| maya6 night Shush | strange_visitor | 12 | OK | 0.572 | 244 |
| tom4 fun Momo | great_mixup | 8 | OK | 0.394 | 167 |
| ella8 medical Zohar | secret_world | 16 | OK | 0.660 | ~300 |
| amit5 social Tuti | wrong_size | 8 | OK | 0.416 | 172 |

**Total:** 8/8 complete, 0 hard-check failures, 0 dashes in any draft,
**USD 5.072**. Words per page were inside the soft target on 87 of 88 pages.
Measured on the final texts: "tummy tightened" appears in 6/8 books, and
parent words appear only in Neta's book (7 times).

### Claude's critical reading of round 1

This is literary judgement, not product acceptance.

- **Humour:** every book has several real comic set pieces built for reading
  aloud:
  - swapped parcels that give a drum band silence and a sleepless thunder-baby
    a bouncing "boom";
  - a sock trail that "smells of feet";
  - a meow lesson where each attempt fails funnier (a "meow?" answered with
    "that's a question, we need an answer", a sneeze, a "moo");
  - an owl referee who always announces the wrong goal;
  - an octopus, flamingos and a whale each sure the smeared invitation means
    them ("you're not a dinosaur!");
  - Dr. Tuning Fork ("then where's the spaghetti?").

  Running gags pay off on the last page in 8/8 books.
- **The child drives the big moment** in 8/8 books (an observation, an idea, a
  choice, a pass to the companion).
- **The companion** has its own want and comic body in 8/8, and is never a
  teacher.
- **Theme moments** are honest and change the story:
  - Bar asks for his ears to be covered, then stands by the drum;
  - Neta uses her baby brother's cry to save a kitten;
  - Yoav: "I'm still angry, but not at you", passes the ball, and loses;
  - Ella asks to be told before the shot, after helping a drum through the
    same thing.

  No cures and no stated morals. Safety-sensitive topics stay truthful
  ("it'll pinch, then it's over"; the sirens-like boom becomes a warning that
  helps everyone get to the shelter cave).
- **Structure:** 7 different spines. All books differ in plot.
- **The editor stage earns its cost.** It fixed real problems in 5/8 books:
  - a container logic contradiction;
  - a size contradiction;
  - a factual slip (a plesiosaur is not a dinosaur);
  - a payoff that was never set up (now planted on page 1);
  - an explanatory feelings sentence (replaced by a concrete half-smile).

  It also strengthened callbacks. This is why the Astra reader is not needed
  in the loop for quality.

**Defects found and fixed for round 2** (prompt and hygiene only, general and
not story-specific):

1. **Family assumption.** Neta's book wrote "Dad ran, Mom ran"; the brief never
   named the parents. Fixes:
   - author and editor rules: never assume the child's parents;
   - a soft `parent_mentioned` check, which reaches the editor as a finding.
2. **Pointing.** The niqqud finding made the editor strip pointing from
   invented sound words, which helps read-aloud. Pointed sound words are now
   allowed. Niqqud is reported only and is no longer sent to the editor.
3. **Stock phrase.** "His/her tummy tightened" appeared in 6 of 8 books. Author
   and editor are now asked for fresh, specific images for feelings.
4. **Cloud world.** Both Bar books went to a cloud world (trampoline leads to
   bouncy clouds), echoing the old cloud attractor. "A world made of clouds"
   was added to the freshness list.

## Round 2: commit 7c71ff71

Eleven books:

- two more Bar seeds;
- Neta again (family-rule check);
- eight new profiles covering the remaining companions (Kim, Leo, Tuk, Uri,
  Puf, Mishi, Tzuki, Buni), ages 3 to 8, and the four untested topics
  (transitions, confidence, sensitivity, focus).

The seeds were searched so this round covers the 8 spines that round 1 left
untested. That is a test-coverage choice. Production draws the spine uniformly
from request ID plus seed, and clumping does happen: the default `r2` seeds
gave "just this once" 5 times in 11.

### Rules set before reading any round-2 output

- **Success:**
  - at least 10/11 complete without a hard-check failure;
  - in Claude's reading, at least 9/11 books have at least two genuine laugh
    moments and a child-driven climax;
  - no assumed parent in the final text;
  - no false safety claim;
  - the two new Bar books use spines and settings different from round 1;
  - "tummy tightened" appears in at most 3 of 11 books.
- **Failure:** at most 8/11 complete; or the old template returns (the
  interest as the magic key, or a discovered-rule puzzle) in more than half
  the books; or the editor makes books worse.
- **Cost:** at most USD 10 for the round (runner ceiling) and at most USD 20
  for the night.
- **Stop:** if the same defect survives two prompt revisions, or a round
  fails, consult Codex before any further spend.

### Round-2 results

| Case | Spine | Pages | Result | USD | Seconds |
|---|---|---|---|---|---|
| bar5 sirens Dini (c) | silly_contest | 8 | OK | 0.430 | 175 |
| bar5 sirens Dini (d) | one_more | 8 | OK | 0.370 | 143 |
| neta6 sibling Anat (r2) | big_day_sideways | 12 | OK | 0.560 | 259 |
| noa3 moving Kim | there_and_back | 8 | OK | 0.450 | 191 |
| itai8 confidence Leo | the_chase | 12 | OK | 0.651 | 280 |
| shira5 sensitivity Tuk | making_together | 8 | OK | 0.730 | 213 |
| ido7 focus Uri | in_charge | 12 | OK | 0.573 | 248 |
| lia6 fun Puf | wrong_size | 8 | OK | 0.373 | 161 |
| ari4 night Mishi | learning_something | 8 | OK | 0.372 | 150 |
| yael6 sibling Tzuki | secret_world | 8 | OK | 0.478 | 203 |
| omer6 social Buni | something_missing | 8 | OK | 0.451 | 192 |

**Round 2:** 11/11 complete, 0 hard failures, 0 draft findings, 0 dashes,
**USD 5.438**.

**Night total:** 19/19 books, **USD 10.510**. Words per page were inside the
soft target on 187 of 188 pages.

### Verdict against the pre-set rules

| Rule | Target | Result |
|---|---|---|
| Completion | at least 10/11 | 11/11 |
| Laughs and a child-driven climax (Claude's reading) | at least 9/11 | 11/11 |
| Assumed parent in final text | 0 | 0; "the grown-ups" used instead |
| False safety claim | 0 | 0 |
| New Bar books differ in spine and setting | required | contest in a mushroom field; cumulative tale in the moshav yard |
| "Tummy tightened" | at most 3/11 | 0/11, down from 6/8 |
| Round cost | at most USD 10 | USD 5.44 |
| Night cost | at most USD 20 | USD 10.51 |

On the stock phrase: authors still reach for tummy images in drafts, and
editors replaced them every time (stated in their change lists).

No failure condition was met:

- **Magic-key interest:** 0/11.
- **Discovered-rule puzzle:** 0/11.
- **Interest in the climax:** the interest takes part in the climax in about
  half the books, as the child's own skill or way of seeing (dancing a scary
  jump, backing in "like a garbage truck", climbing), never as a magic power
  or a hidden rule.
- **The editor:** it improved every book in this reading. It kept 73–98% of
  draft wording and fixed:
  - continuity (an object with no source, "there is no candy in this story");
  - gender agreement;
  - ambiguity;
  - a companion acting against its body (a cloud that rolls);
  - lesson-like lines ("I was once too small too" became partnership);
  - a breathing technique (removed per the brief).

### Contract compatibility on the real books

These checks run from the checkout root (see the QA brief's reproduction trap):

- `personalStoryResultSchema`: 19/19.
- Existing editor `prepareStoryEdit`: 19/19.
- `preparePersonalStoryboard`: 10/10 for books whose companion is offered in
  the wizard. The 9 books with the newer companions fail with
  `companion_unavailable`, because the legacy visual registry has no entry for
  them. This is pre-existing, and it blocks images for those companions, not
  text.

### Found after round 2 and fixed in code

**Dash forms.** The dash class shared with the current writer
(`story-writer.ts:178`, `[-־–—]`) misses U+2010–U+2015 (one
editor emitted U+2011, a non-breaking hyphen, in its notes), U+2212, the soft
hyphen and full-width forms. No final text contains any of them; scanned
across all 19.

- **In this engine:** the class is widened in both the normaliser and the
  check, and pinned by tests.
- **In the current writer:** reported to Codex, not changed here.

### Found in round 3 and fixed in `eea87d28`: spine examples become plots

Round 3 ran `e098a9a9` on four new requests with the default empty seed, as
production would. The default seed gave the Bar request the "silly contest"
spine, the same spine as round 2's Bar (c). The two books are structurally
near-identical:

- Dini "never won anything";
- round one is "the slowest jump";
- a round of carrying a bowl or cup without spilling;
- a "quietest landing" finale.

The cause is the parenthetical examples in four spine texts, which models
copy:

| Spine | Book | Example used |
|---|---|---|
| mix-up | Bar (a) | swapped parcel |
| mix-up | Tom | message that arrives wrong |
| contest | Bar (c) | slowest race |
| contest | Bar default | slowest race |
| chase | Itai | drawing that came alive |
| just this once | Yoav | none |

Five of the six books whose spine had examples used one of them.

`eea87d28` removes every example list from the spines, and a test pins it.
Round 3's fourth book, Dana on "just this once" with the old examples, adds a
seventh data point: it became a once-a-century parade of Tiberias's cooking
pots, close to the "toys hold a parade" example. That makes 6 of 7.

### Rounds 3 and 4: smoke and diversity checks

**Round 3** ran on `e098a9a9` with default seeds, the way production draws
them: 4 new requests, 4/4 complete, USD 2.209.

- Gal, 7, sirens, Sderot, avoid "war" and "missiles", 16 pages, Uri: the most
  sensitive case.
  - The siren in the story is an ambulance "hurrying to help someone".
  - The grown-ups are near, and the child holds a paw and names the sound.
  - Coping is shown as anticipation ("someone who hears the noise before
    you") and as making the noise on purpose.
  - It contains no war or missile words and no false safety claim.
- Ron, 4, anger, Shush:
  - real frustration (he raises the ring to throw it), a funny outlet, then
    his own idea;
  - a playful "long walrus breath" on the last page sits near the
    breathing-ritual line; watch item.
- Dana, 8, just for fun, Kim: see above.
- Bar default: see the spine-example finding.

**Round 4** ran on `eea87d28` with the same requests and seeds: 3/3 complete,
USD 1.363.

- **Tom (mix-up):** a completely different plot. A misheard roar becomes a
  seagull meal call, and the lifeguard announces a "real dinosaur". Nothing
  from the old examples.
- **Itai (chase):** a runaway sesame bagel through Jerusalem, a classic chase
  shape rather than the old "drawing came alive" example.
- **Bar (contest), the same spine for the same child again:** new rounds, but
  a similar macro structure (a contest, Dini wanting to win, noise from the
  judge's instrument).

**Conclusion.** Removing the examples fixes example copying. Same child plus
same spine still gives a similar book. That happens about once in 14 when two
books are drawn for one child; avoiding a child's previous spines needs order
history and is an integration item.

### Night totals

- 26/26 books, 0 hard failures, **USD 14.082** (CLI list-price estimate).
- Result contract 26/26; existing editor preparation 26/26; storyboard 15/15
  for offered companions. The 11 books with the newer companions stop at the
  known visual-registry gap.
- Hygiene across rounds 2 to 4: 0/18 books with the stock tummy phrase, 0/18
  with assumed parents, 0/26 with dashes, and no excluded subject in any final
  text.

### Watch items (not defects)

- **Theme devices repeat across books.** Asking a crowd to "cheer without
  sound" solves the noise moment in both Bar (c) and Shira. Both
  "something missing" books have a shy culprit who mirrors the child, which
  comes from that spine.
- **Pointed sound words** now appear in every round-2 book. Check that the
  reader and TTS show and pronounce them well, and that Guy likes the look.
- **Spines are drawn uniformly,** so a family ordering several books can get a
  repeat. A later option is to avoid a child's previous spines, which needs
  history.
- **Time per book** is 2.4 to 5.3 minutes (author plus editor, sequential).
- **Cost figures** are CLI list-price estimates. Actual subscription billing
  may differ.

## Alternatives considered

1. **Patch the causal pipeline** (plan, replan, author, editor, Astra
   readers): remove the candidate slots and the rule and clue craft text, and
   keep the stages. Rejected as the first move. The template lives in the plan
   schema, the validators and the reader rubric together, so patching one
   leaves the others pulling the same way. It costs about 3 to 5 times more per
   book and is much harder to reason about.
2. **Simple engine (built):** an author and a fresh editor on a seed-picked
   spine, prose first.
3. **Much simpler: author only, no editor.** Cheapest, about half the cost.
   Round 1 shows why the editor stays: it fixed real logic, setup or fact
   problems in 5/8 books, including two that a parent would notice.
4. **Story bank with personalisation** (current production `v3-approved`).
   Reliable, but neither personal nor varied. It stays the production path
   until Guy decides.
5. **Generate several books and choose.** Two or three full drafts with a
   blind choice. Not needed at the quality seen; possible later for a premium
   tier.

## Recommendation

- **Change:** make the simple engine the personal-wizard text engine, behind a
  flag, after Codex's technical PASS and Guy's product acceptance.
- **Remove from the personal text path:**
  - adventure candidate selection and outline checks;
  - synopsis review and repair;
  - the Astra reader in the generation loop;
  - interest-must-drive and rule/clue requirements.
- **Keep:**
  - request acceptance and identity;
  - companion canon v4 (all 15);
  - the result, storyboard and editor contracts;
  - the fresh-session editor;
  - the hygiene checks;
  - the pinned-CLI transport and the receipts.
- **Optional later:** a blind "fun reader" used only as an evaluation tool,
  never as a gate. It would record laugh points, confusion points and age fit
  across a fixed profile set, to compare engine versions.

## Integration plan (not implemented)

The native worker (`scripts/personal-native-wizard-worker.ts`) currently runs
`singleBookCalibrationCLI` (the causal pipeline with Astra reviews, USD 12
ceiling). A small change would add an explicit `--engine simple` that:

1. prepares with `prepareSimpleStory` on the queued request;
2. runs `writeSimpleStory` with the same pinned-CLI `generate` as
   `scripts/personal-simple-story.ts`;
3. publishes `NativeBookView` updates for writing, editing, complete and
   failed;
4. stores the result in the existing contract, which the storyboard already
   accepts.

The expected ceiling is about USD 1.5 per book instead of 12.

This changes the production generation flow, so it needs Guy's go, a Decision
Gate update and Codex QA first.
