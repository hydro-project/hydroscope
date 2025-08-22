# Hydroscope Docs (Lean Index)

This folder is intentionally lean to reduce drift. For usage, API, and installing, see the project README at the repo root.

- User Guide and API: ../README.md
- Architecture overview: ./Architecture.md

## Source of truth

The code is the authoritative reference for APIs and types:
- Public exports: `src/index.ts`
- Components and props: `src/components/` (e.g., `Hydroscope*.tsx`)
- Visualization state: `src/core/VisualizationState.ts`
- Config/constants/types: `src/shared/config.ts` and `src/shared/types.ts`
- Rendering: `src/render/`

Prefer reading types/JSDoc directly in code rather than duplicating here.

## JSON schema docs

The JSON format documentation is generated from the actual parser interfaces.

- Source of truth: `src/core/JSONParser.ts`
- Generator: `docs/generateJSONSchema.ts`
- Sync script: `docs/syncSchema.js`
- Used by: `src/components/FileDropZone.tsx`

Regenerate locally:

```bash
cd docs
node syncSchema.js && node validateExample.js
```

Tip: run `npm run docs:sync` from the repo root (added script) to keep schema docs fresh.

---

Keep this page short. Link to code and the root README whenever possible.