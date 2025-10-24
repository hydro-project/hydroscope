# Refactor: Split Monolithic Config into Modular System

## Summary

This PR refactors the configuration system by splitting the monolithic 600+ line `config.ts` file into a clean, modular structure with clear separation of concerns.

## Motivation

The original `config.ts` file had become difficult to maintain:
- 600+ lines with mixed concerns (layout, styling, UI, performance, search)
- Hard to find specific configuration values
- Scattered constants throughout the codebase
- Duplicate definitions
- Poor organization

## Changes

### New Configuration Structure

```
src/shared/config/
├── index.ts          # Main exports and legacy compatibility
├── layout.ts         # Layout, ELK, dimensions, spacing (180 lines)
├── styling.ts        # Colors, styles, edges, visual appearance (330 lines)
├── ui.ts            # UI components, typography, animations (150 lines)
├── search.ts        # Search and navigation constants (50 lines)
└── performance.ts   # Performance limits and optimization (60 lines)
```

### Key Improvements

1. **Modular Organization**
   - Each configuration domain is now in its own file
   - Clear separation of concerns
   - Easier to find and update related constants

2. **Better Naming**
   - `LAYOUT_CONSTANTS` → Split into `LAYOUT_DIMENSIONS`, `LAYOUT_SPACING`, `SMART_COLLAPSE_CONFIG`
   - More descriptive constant names that indicate their purpose
   - Removed redundant prefixes

3. **Cleaner Imports**
   ```typescript
   // Before
   import { LAYOUT_CONSTANTS, UI_CONSTANTS, ... } from "../shared/config.js";
   
   // After
   import { LAYOUT_DIMENSIONS, LAYOUT_SPACING } from "../shared/config/layout.js";
   import { UI_CONSTANTS } from "../shared/config/ui.js";
   ```

4. **Bug Fixes**
   - Fixed `NODE_WIDTH_DEFAULT` value (was incorrectly 120, restored to 180)
   - Removed unused imports
   - Added proper type assertions

### Files Updated

- **Core Files**: 15+ files updated with new modular imports
- **Tests**: Updated test files to use new structure
- **Components**: Updated React components to use new imports

### Documentation

- Added `CONFIGURATION_CLEANUP.md` with detailed summary
- Added `config-migration.md` with migration guide for developers

## Testing

- ✅ **All 1406 tests passing** (0 failures)
- ✅ **Build succeeds** with no errors or warnings
- ✅ **Lint passes** with no warnings
- ✅ **Type checking** passes

## Benefits

1. **Maintainability**: Much easier to find and update configuration values
2. **Clarity**: Clear organization by domain makes the codebase more understandable
3. **Performance**: Smaller import footprint (only import what you need)
4. **Type Safety**: Better TypeScript support with focused modules
5. **Documentation**: Each module is self-documenting by its domain

## Migration Guide

For developers working on other branches, see `src/shared/config-migration.md` for detailed migration instructions.

### Quick Migration Example

```typescript
// Old import
import { LAYOUT_CONSTANTS, UI_CONSTANTS } from "../shared/config.js";

// New imports
import { LAYOUT_DIMENSIONS, LAYOUT_SPACING } from "../shared/config/layout.js";
import { UI_CONSTANTS } from "../shared/config/ui.js";

// Old usage
const width = LAYOUT_CONSTANTS.DEFAULT_NODE_WIDTH;

// New usage
const width = LAYOUT_DIMENSIONS.NODE_WIDTH_DEFAULT;
```

## Backward Compatibility

The main `index.ts` re-exports commonly used constants for backward compatibility, making the migration smoother for existing code.

## Checklist

- [x] Tests pass
- [x] Build succeeds
- [x] Lint passes
- [x] Documentation added
- [x] Migration guide provided
- [x] No breaking changes to public API

## Related Issues

Closes #[issue-number-if-applicable]
