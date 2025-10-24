# Configuration Migration Guide

The old monolithic `config.ts` file has been split into modular configuration files for better organization and maintainability.

## New Structure

```
src/shared/config/
├── index.ts          # Main exports and legacy compatibility
├── layout.ts         # Layout, ELK, and positioning constants
├── styling.ts        # Colors, styles, and visual appearance
├── ui.ts            # UI components, typography, and interactions
├── search.ts        # Search and navigation constants
└── performance.ts   # Performance limits and optimization settings
```

## Migration Examples

### Before
```typescript
import { LAYOUT_CONSTANTS, UI_CONSTANTS } from "../shared/config.js";
```

### After
```typescript
import { LAYOUT_DIMENSIONS, SMART_COLLAPSE_CONFIG } from "../shared/config/layout.js";
import { UI_CONSTANTS } from "../shared/config/ui.js";
```

## Key Changes

- `LAYOUT_CONSTANTS` → Split into `LAYOUT_DIMENSIONS`, `LAYOUT_SPACING`, `SMART_COLLAPSE_CONFIG`
- All styling constants moved to `styling.ts`
- Search/navigation constants moved to `search.ts`
- Performance constants consolidated in `performance.ts`

## Legacy Compatibility

The main `index.ts` re-exports commonly used constants for backward compatibility.