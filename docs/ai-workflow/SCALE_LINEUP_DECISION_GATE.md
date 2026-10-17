# Decision Gate: common-scale lineup on the entities sheet, and its one comparison (2026-10-16)

**Owner decisions:** recorded verbatim in `_review/new-book-scale-lineup-20261016/OWNER-DECISIONS-SCALE-20261016.md`.
- Guy chose "Fix scale first (Recommended)": a common-scale lineup on the characters sheet, offline, then Codex QA, then a small comparison (~$0.48).
- He then delegated the open choices: "אל תשאל אותי עוד שאלות.. תענה בעצמך, קבל החלטה פשוט..".

Developer: Claude Code. QA: Codex. Product and spend: Guy.

**Plan and diagnosis:** `_review/new-book-scale-diagnosis-20261016/DECISION-GATE-SCALE-CONSISTENCY-20261016.md`, sections 1–5 and decision 3.

## 1. Problem (evidence, from the held sample)

- **Grandma** (written "three child heights tall") was drawn about child-sized in **5 of 6** renders. **Uri** (structured 0.42 child heights) was oversized in **3 of 6**.
- Corrections did not stick, and the written sizes reached every render.
- **No reference image shows relative size.** The entities sheet's isolated tiles each have their own magnification, and the sheet judge must "never demand cross-tile size ratios".

**Hypothesis H1 (unproven):** the renderer follows the picture (similar-sized tiles) over the text.

## 2. Change A: the opt-in lineup (`audition-scale-lineup/v1`)

**Source of the flag:** the spend grant's render scope only (`scope.scaleLineup`). It is never a CLI argument; `--scale-lineup` exists for a zero-provider dry-run preview only. The admission names the flag, so a resume under another flag is refused.

**What changes under the flag:**

| part | change |
|---|---|
| entities design | gains `scaleLineup`: a post `child_height`, the **members**, and `companionOutline` (the companion id and the plan's validated `companionStandingHeightInChildHeights`) |
| who joins the lineup | **every supporting character the entities sheet draws, by kind**, in design order. No word decides; each member's size stays in its own written design, verbatim. Props and landmarks never join. A character attached to an actor is not on the sheet, so not in the lineup. |
| entities sheet prompt | the legacy rules, then **one added line**: a full-width band, one shared ground line, a plain post one child height tall (never a child figure), each member once as a flat single-tone silhouette with its ID, then the companion outline at its structured height. One common scale; tiles keep their own magnification. Silhouettes are size marks: every ID is still drawn exactly once as its tile. |
| sheet judge | chosen **by the judged design itself** (`auditionJudgeInstruction`): the legacy instruction with one block inserted after the tile rule. Heights are compared only in the lineup, by eye, and only a clear contradiction is reported. A wrong height is continuity `scale_lineup:<id>`; a child figure instead of the post is identity `scale_lineup`. |
| sheet requirement ids | the legacy ids plus `scale_lineup`, `scale_lineup:<member>` and `scale_lineup:companion` |
| page prompt | the legacy suffix plus one rule: image 3's tiles show designs only; its lineup gives each character's height relative to the child, changed only by perspective; a character too tall for the frame is cropped, never shrunk; never draw the post or silhouettes |
| policy | `reviewed-audition-policy/v10` = every v9 rule unchanged, plus `scaleLineup` |

**Unchanged under the flag:**
- the locations sheet: its prompt, context and instruction;
- the page judge: its instruction and context;
- production, the Wizard, Style-01, models, the 0.70 bar, the sample gate and the meter.

**Flag absent: byte-identical.** Pinned at `69e1079a` and asserted in the spec: the designs, both sheet prompts, the repair prompt, both judge instructions, the page suffix and the v9 policy (sha-256). **On the real held book**, today's code rebuilds the held run's saved `{policy, designs}` byte for byte.

### Decisions made under Guy's delegation

1. **The companion joins** as a flat outline at 0.42. It uses the existing actor-outline rule, and Uri was oversized in 3 of 6.
2. **Tiles and the lineup together.** At one common scale a pocket-sized stone beside a three-child-height giant would be a few pixels: the tile keeps the design, the lineup carries the size.
3. **Membership by kind, not by words.** The gate's own negative control (the "pocket-sized" silver stone) states no size in child heights.
4. **The page judge is unchanged.** The comparison's page reviews then stay comparable with the held run's.

## 3. Change B: the one comparison of the held book (`scale-comparison`)

**Why this shape:** the held run's real costs (about $0.075 per sheet attempt, $0.16 per page attempt) and its reservations (render about $0.65, review $0.60) leave room for only one exact shape inside the remaining $1.059077:
- the new lineup entities sheet (at most 2 attempts, the policy's own);
- the held run's locations sheet, **reused exactly as judged** (its design and context are unchanged under the lineup);
- each held sample page (2 and 3) **drawn once**.

A fresh locations sheet or a second page attempt would not fit.

**Runner (generic, opt-in through a render grant):**

| part | rule |
|---|---|
| `reuseSheets {sourceRun, roles}` | `readReusedSheets` checks, before anything is created: that run's admission names the same request, storyboard, child and companion images; the named sheet is its own saved record; its chosen image matches by hash; every judged attempt's saved review is exactly its receipt's raw answer, judged with the instruction this run would send for it. **The saved record and every judged request must describe exactly the complete context this run derives** (`sameSheetContext`: the claimed sha is the hash of the evidence's own complete context, and both equal the derived ones; a claimed sha alone never binds). The admission names that source by hash. |
| orchestrator | each reused sheet binds **before anything is saved or drawn**: its complete saved context equals the one this run derives (same rule), with the same requirements, then every saved judgement is re-derived from its raw review (`audition_reuse_binding`) |
| `pageAttempts` | at most N attempts per page (1 to the policy's 3); the manifest records it |

**Experiment stage (one use, in the same ledger):**
- The amendment `new-book-20261012.scale-comparison-1.json` re-pins the reviewed source HEAD. It binds the acceptance amendment, the held audition's start record and grant, its `held_sample` seal and sample pages, and **every record of the held audition's folder** by hash.
- **After the amendment:** the original audition never starts or resumes again (`new_book_audition_closed`), and any change to the held folder refuses the whole chain.
- **Grant:** derived from the verified ledgers:
  - prior: the text stages, the child and the held audition's own calls, each re-derived;
  - carry: the same;
  - cap: $7;
  - `maxCalls`: 10;
  - scope: pages 2–3, the lineup, `reuseSheets: ['locations']`, `pageAttempts: 1`.
  - It is written once and compared on a resume.
- **Admission, before anything is written:** the reused sheet is checked against the real held run, its saved record and judged requests against the complete context the lineup run derives (`audition_reuse_source` on any drift or rewrite).

**Codex HOLD at `225477ee` (F1, P2), corrected:** reuse had bound the claimed `contextSha` rather than the complete context it describes. A held sheet whose context was rewritten while keeping the old sha (meter-coherent) was admitted and ran. One shared rule now binds the complete context at all three layers (source reading, orchestration, admission before the one-use write). Codex's exact case refuses with no amendment, grant, folder or call.
- **One start:** `--resume` continues the same folder and meter.

**Spend authority:** Guy's chosen plan plus his delegation (`OWNER-DECISIONS-SCALE-20261016.md`): ≈ $0.48, inside the $7, after Codex's technical PASS.

**Pre-registered criteria** (from the scale gate; categorical: the judge's verdicts plus Guy's eye, no pixel thresholds):
- **positive:** Grandma near Itai reads as a giant;
- **negative control:** Bumbum (½) and the silver stone stay small;
- **perspective control:** a distant Grandma with readable depth cues is not flagged;
- **occlusion control:** a cropped Grandma is not a scale defect.

## 4. Stop-check answers

| # | question | answer |
|---|---|---|
| 1 | General or story-specific? | General: membership by kind, the companion height from the plan, no book-specific word. |
| 2 | Could it break another story? | Opt-in through a grant; absent is byte-identical (pinned, and reproduced on the real held run). |
| 3 | Production? | None. |
| 4 | Money? | Offline build: none. The comparison: ≈ $0.48 inside this book's remaining $1.059077 (section 3). |
| 5 | Smallest validation? | The new entities sheet (≤ 2 attempts) plus the two held sample pages, one attempt each, with the held locations sheet reused. |
| 6 | Guy's decisions? | Delegated (OWNER-DECISIONS-SCALE-20261016.md); new money, other children's photos and production stay his. |
| 7 | To falsify? | Legacy pins; the flag only from the grant; the instruction chosen by the context; membership; the reuse binding; one attempt per page; ledger continuity; one-use. |
| 8 | Cowork? | Optional: the lineup wording. |
| 9 | Guy's eye? | Pages 2–3, held versus comparison: does Grandma read as a giant near Itai? Do Bumbum and the silver stone stay small? Is a far Grandma still fine? |

## 5. Validation

**Offline (synthetic providers only):**
- the lineup's design, prompt, checks, ids, page rule and policy;
- the legacy pins;
- the instruction chosen by the context;
- the grant literal;
- reuse and its refusals;
- the page bound;
- the experiment stage end to end: preview, run, one use, closure of the held audition, evidence binding, tamper refusals, resume.

Mutation checks prove each guard is exercised.

**Offline tests cannot prove** that the pixels follow the lineup. Only the one paid comparison (section 3), read by the judges and by Guy's eye, can.

## 6. Rollback

Revert the commits. The flag is opt-in, and no saved book or run changes.

## 7. Do not

- No production, Wizard, Style-01 or 0.70 change. No change to the locations sheet or the page judge.
- No second comparison, no retry, and no continuation of this book beyond the comparison without Guy's word.
- No spend beyond this book's $7 cap.
