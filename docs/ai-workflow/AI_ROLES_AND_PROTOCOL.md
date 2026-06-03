# AI Roles and Working Protocol

## Claude
Claude is the CTO / implementation planner.
Claude reads code, proposes implementation plans, writes technical briefs, and can implement in Cursor when approved.

## ChatGPT
ChatGPT is the product, UX, QA, creative, story, visual, and business reviewer.
ChatGPT challenges assumptions, checks whether fixes are general or too specific, reviews visual/story quality, and protects product direction.

## Cursor
Cursor executes approved implementation tasks in the codebase.

## Guy
Guy is the product owner and final decision maker.
Guy approves visual quality, product direction, and launch readiness.

## Protocol
For non-trivial changes:

1. Claude prepares a Decision Gate brief.
2. Guy sends the brief to ChatGPT.
3. ChatGPT reviews, challenges, and rewrites if needed.
4. Guy approves or rejects.
5. Cursor/Claude implement.
6. Claude reports exact files changed, tests run, outputs, and open risks.
7. Guy/ChatGPT review results before next major step.

## Rule of thumb
Claude proposes.
ChatGPT challenges.
Guy approves.
Cursor executes.