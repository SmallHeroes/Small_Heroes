# Style 01 child character template (system asset)

Permanent **character template** for Stage 0 anchor generation — NOT a scene/style-ref from `style-references/01/`.

- **Purpose:** `images.edit` base = cute simplified Style 01 child proportions/rendering.
- **Identity** comes from DNA text + optional raw photo as a **last** reference cue only.
- Approve by eye once; set paths in `.env.local` or place files here:

| File | Use |
|------|-----|
| `girl.png` | Default for `childGender=girl` |
| `boy.png` | Default for `childGender=boy` |

Generate placeholders:

```bash
npx tsx --require ./scripts/shims/register-server-only.cjs scripts/generate-style01-child-template.ts girl
npx tsx --require ./scripts/shims/register-server-only.cjs scripts/generate-style01-child-template.ts boy
```

Override: `STYLE01_CHILD_TEMPLATE_GIRL`, `STYLE01_CHILD_TEMPLATE_BOY` (absolute paths).
