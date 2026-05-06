# experiments/debug/

Development scripts for testing and inspecting pipeline outputs.
Not part of the production app. Not deployed.

## Scripts

### `debug-stages-12.mjs`
Runs Stage 1 (StoryBrain) + Stage 2 (PageOutline) + Stage 3 (Prose: 3A→3B→3C→3D) + Stage 4A (VisualBible) + Stage 4B (CompositionPlan).

Outputs JSON to stdout. Progress logs go to stderr.

```bash
# From the project root:
node experiments/debug/debug-stages-12.mjs
node experiments/debug/debug-stages-12.mjs 2>/dev/null          # JSON only
node experiments/debug/debug-stages-12.mjs 2>/dev/null > story-output.json
```

### `debug-stage4.mjs`
Runs Stage 4A + 4B + 4C from an existing story output.
Reads from a file argument or stdin.

```bash
# Pipe from debug-stages-12:
node experiments/debug/debug-stages-12.mjs 2>/dev/null | node experiments/debug/debug-stage4.mjs

# From a saved file:
node experiments/debug/debug-stage4.mjs experiments/debug/story-output.json
```

## story-output.json
Sample Stage 1–3 output for use as Stage 4 input during development.
